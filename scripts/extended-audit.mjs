import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseURL = process.env.AUDIT_URL || 'http://127.0.0.1:4173/';
const root = process.cwd();
const fixtureDir = path.join(root, 'audit-fixtures');
const outDir = path.join(root, 'audit');
fs.mkdirSync(outDir, { recursive: true });
const report = { generatedAt: new Date().toISOString(), checks: [], dom: {}, source: {} };

const add = (name, status, severity, details={}) => report.checks.push({name,status,severity,details});
const num = async (page, selector) => {
  const text = await page.locator(selector).first().textContent().catch(()=>'');
  const m = String(text||'').replaceAll(',','').match(/\d+/);
  return m ? Number(m[0]) : null;
};
const upload = async (page, name, waitFollowing=null) => {
  await page.locator('input[type=file]').first().setInputFiles(path.join(fixtureDir,name));
  if(waitFollowing!==null) await page.waitForFunction(value=>Number((document.querySelector('#countFollowing')?.textContent||'').replace(/\D/g,''))===value,waitFollowing,{timeout:15000}).catch(()=>{});
  await page.waitForTimeout(250);
};
const visibleButton = async (page, regex) => {
  const locator=page.locator('button').filter({hasText:regex});
  for(let i=0;i<await locator.count();i++) if(await locator.nth(i).isVisible()) return locator.nth(i);
  return null;
};
const messages = async page => page.locator('#v10Toast,.toast,.error,[role=alert]').allInnerTexts().catch(()=>[]);

const browser = await chromium.launch({headless:true});
try{
  const context = await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(baseURL,{waitUntil:'networkidle'});

  await upload(page,'case-insensitive.zip',1);
  add('사용자명 대소문자 정규화',await num(page,'#countMutual')===1?'pass':'fail','high',{mutual:await num(page,'#countMutual'),following:await num(page,'#countFollowing')});

  await upload(page,'duplicates.zip',1);
  add('중복 관계 데이터 제거',await num(page,'#countFollowing')===1&&await num(page,'#countMutual')===1?'pass':'fail','high',{following:await num(page,'#countFollowing'),mutual:await num(page,'#countMutual')});

  await upload(page,'shared-account-a.zip',2);
  const doneButton=page.locator('#focusDoneBtn');
  if(await doneButton.isVisible()) await doneButton.click();
  await page.waitForTimeout(300);
  const doneA=await num(page,'#countDone');
  const storageA=await page.evaluate(()=>({...localStorage}));
  await upload(page,'shared-account-b.zip',2);
  const doneB=await num(page,'#countDone');
  const currentB=await page.locator('.focusPanel').innerText().catch(()=>'');
  add('서로 다른 내 계정의 작업 기록 격리',doneA===1&&doneB===0?'pass':'fail','high',{doneA,doneB,currentB,storageA});

  await upload(page,'shared-account-a.zip',2);
  const restoredBeforeReload=await num(page,'#countDone');
  await page.reload({waitUntil:'networkidle'});
  await upload(page,'shared-account-a.zip',2);
  const restoredAfterReload=await num(page,'#countDone');
  add('동일 ZIP 재업로드 시 진행 기록 복원',restoredBeforeReload===1&&restoredAfterReload===1?'pass':'fail','high',{restoredBeforeReload,restoredAfterReload});

  report.dom.inputs=await page.locator('input').evaluateAll(nodes=>nodes.map(node=>({id:node.id,type:node.type,accept:node.accept,name:node.name,hidden:node.hidden,outerHTML:node.outerHTML})));
  report.dom.buttons=await page.locator('button').evaluateAll(nodes=>nodes.map(node=>({id:node.id,text:(node.textContent||'').trim(),hidden:node.hidden,className:node.className})).filter(item=>/저장|불러|초기화|내보|가져/.test(item.text)||/export|import|clear/i.test(item.id)));

  let downloadInfo={available:false};
  const exportButton=page.locator('#sideExportBtn');
  if(await exportButton.count()){
    try{
      const [download]=await Promise.all([page.waitForEvent('download',{timeout:5000}),exportButton.click({force:true})]);
      const downloadPath=await download.path();
      const content=downloadPath?fs.readFileSync(downloadPath,'utf8'):'';
      downloadInfo={available:true,filename:download.suggestedFilename(),bytes:Buffer.byteLength(content),validJSON:false,path:downloadPath};
      try{JSON.parse(content);downloadInfo.validJSON=true;}catch{}
      report.downloadPath=downloadPath;
    }catch(error){downloadInfo={available:true,error:String(error)};}
  }
  add('진행 기록 내보내기',downloadInfo.available&&downloadInfo.validJSON?'pass':'fail','high',downloadInfo);

  const clearButton=page.locator('#sideClearBtn');
  if(await clearButton.count()){
    page.once('dialog',dialog=>dialog.accept());
    await clearButton.click({force:true});
    await page.waitForTimeout(300);
  }
  const storageAfterClear=await page.evaluate(()=>({...localStorage}));
  add('현재 기록 초기화',!('matchal_checker_v7_progress' in storageAfterClear)?'pass':'fail','high',{storageAfterClear});

  const importInput=page.locator('input[type=file][accept*="json"],#sideImportInput,input[id*="import" i]').first();
  let importResult={exists:await importInput.count()>0};
  if(importResult.exists&&report.downloadPath){
    await importInput.setInputFiles(report.downloadPath);
    await page.waitForTimeout(500);
    await upload(page,'shared-account-a.zip',2);
    importResult.done=await num(page,'#countDone');
  }
  add('진행 기록 불러오기',importResult.exists&&importResult.done===1?'pass':importResult.exists?'fail':'warn','medium',importResult);

  await upload(page,'malformed-json.zip');
  await page.waitForTimeout(500);
  const malformedMessages=await messages(page);
  add('손상 JSON 오류 안내',malformedMessages.some(t=>/JSON|읽|손상|오류|문제/.test(t))?'pass':'fail','high',{messages:malformedMessages});

  await upload(page,'invalid-extension.txt');
  await page.waitForTimeout(300);
  const primaryFiles=await page.locator('input[type=file]').first().evaluate(input=>input.files?.length||0);
  add('ZIP이 아닌 확장자 차단',primaryFiles===0?'pass':'fail','medium',{primaryFiles,messages:await messages(page)});

  await upload(page,'empty-valid.zip',0);
  add('빈 팔로워·팔로잉 데이터 처리',await num(page,'#countFollowing')===0&&errors.length===0?'pass':'fail','medium',{following:await num(page,'#countFollowing'),errors});

  await upload(page,'valid-basic.zip',3);
  const profileLink=page.locator('a[href*="instagram.com"],#focusOpenBtn').first();
  const profile={count:await profileLink.count()};
  if(profile.count){profile.href=await profileLink.getAttribute('href');profile.target=await profileLink.getAttribute('target');profile.rel=await profileLink.getAttribute('rel');}
  add('실제 데이터 프로필 링크 형식',profile.href&&/^https:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._]+\/?$/.test(profile.href)?'pass':'fail','high',profile);

  await context.close();
}finally{await browser.close();}

const html=fs.readFileSync(path.join(root,'dist','index.html'),'utf8');
for(const term of ['file.size','loadAsync','matchal_checker_v7_progress','followers_1.json','JSON.parse']){
  const contexts=[];let i=html.indexOf(term);
  while(i>=0&&contexts.length<8){contexts.push(html.slice(Math.max(0,i-400),Math.min(html.length,i+1000)));i=html.indexOf(term,i+term.length);}
  report.source[term]=contexts;
}
report.source.hasExplicitFileSizeLimit=/file\.size\s*[><=]/.test(html);
report.source.hasProgressNamespace=/matchal_checker_v7_progress/.test(html);
fs.writeFileSync(path.join(outDir,'extended-report.json'),JSON.stringify(report,null,2));
