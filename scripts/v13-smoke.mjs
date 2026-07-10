import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const baseURL=process.env.SMOKE_URL||'http://127.0.0.1:4173/';
const fixtures=path.join(process.cwd(),'smoke-fixtures');
const checks=[];
const failures=[];

function check(name,condition,details={}){
  const result={name,pass:Boolean(condition),details};
  checks.push(result);
  if(!condition) failures.push(result);
}

async function axe(page,name){
  const report=await new AxeBuilder({page}).analyze();
  const serious=report.violations.filter(item=>['critical','serious'].includes(item.impact));
  check(name,serious.length===0,{violations:serious.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.length}))});
}

async function number(page,selector){
  const text=await page.locator(selector).first().textContent().catch(()=>'');
  const match=String(text||'').replace(/[^0-9]/g,'').match(/\d+/);
  return match?Number(match[0]):0;
}

async function desktop(browser){
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  const page=await context.newPage();
  const errors=[];
  const external=[];
  const origin=new URL(baseURL).origin;
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
  page.on('request',request=>{
    const url=request.url();
    if(url.startsWith('http')&&new URL(url).origin!==origin) external.push({url,type:request.resourceType(),method:request.method()});
  });

  await page.goto(baseURL,{waitUntil:'networkidle',timeout:45000});
  await page.waitForSelector('#compareV13',{state:'visible'});
  check('v13 비교 화면 표시',await page.locator('#compareV13').isVisible(),{});
  check('v13 내비게이션 링크 표시',await page.locator('[data-v13-compare-link]').count()===1,{});
  check('초기 외부 요청 없음',external.length===0,{external});

  await page.locator('#comparePreviousV13').setInputFiles(path.join(fixtures,'compare-previous.zip'));
  await page.locator('#compareCurrentV13').setInputFiles(path.join(fixtures,'compare-current.zip'));
  check('두 ZIP 선택 후 비교 버튼 활성화',await page.locator('#compareRunV13').isEnabled(),{});
  await page.locator('#compareRunV13').click();
  await page.waitForFunction(()=>!document.querySelector('#compareResultsV13')?.hidden,{timeout:20000});

  const counts=await page.locator('.compareStatV13').evaluateAll(nodes=>Object.fromEntries(nodes.map(node=>[node.dataset.category,Number(node.querySelector('strong')?.textContent.replace(/,/g,''))])));
  check('두 시점 관계 변화 계산 정확성',
    counts.lostFollowers===2&&counts.newFollowers===2&&counts.newFollowing===1&&counts.stoppedFollowing===1&&counts.newlyMutual===1&&counts.mutualEnded===1,
    {counts}
  );
  const listText=await page.locator('#compareListV13').innerText();
  check('팔로워 이탈 목록 정확성',/@bob/.test(listText)&&/@dave/.test(listText)&&!/@alice/.test(listText),{listText});

  const [csvDownload]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('#compareCsvV13').click()
  ]);
  const csvPath=await csvDownload.path();
  const csv=csvPath?fs.readFileSync(csvPath,'utf8'):'';
  check('변화 목록 CSV 저장',/bob/.test(csv)&&/dave/.test(csv)&&/profile_url/.test(csv),{filename:csvDownload.suggestedFilename(),bytes:Buffer.byteLength(csv)});

  await page.evaluate(()=>{
    localStorage.setItem('unfollow_progress_v12_testspace',JSON.stringify({sample_user:{username:'sample_user',status:'done',updatedAt:'2026-06-28T00:00:00.000Z'}}));
  });
  await page.locator('[data-v13-workspace]').click();
  check('작업공간 관리 창 표시',await page.locator('#workspaceDialogV13').isVisible(),{});
  check('저장 작업공간 목록 표시',await page.locator('.workspaceCardV13').count()>=1,{count:await page.locator('.workspaceCardV13').count()});
  await page.locator('[data-close-workspaces]').first().click();

  const [diagnosticDownload]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-v13-diagnostic]').click()
  ]);
  const diagnosticPath=await diagnosticDownload.path();
  const diagnosticText=diagnosticPath?fs.readFileSync(diagnosticPath,'utf8'):'';
  let diagnostic={};
  try{diagnostic=JSON.parse(diagnosticText);}catch{}
  check('개인정보 없는 진단 파일 저장',
    diagnostic.reportType==='unfollow-safe-diagnostic'&&diagnostic.version==='13.0'&&!diagnosticText.includes('sample_user')&&!diagnosticText.includes('compare-current.zip'),
    {filename:diagnosticDownload.suggestedFilename(),keys:Object.keys(diagnostic)}
  );

  await page.locator('#zipInput').setInputFiles(path.join(fixtures,'basic.zip'));
  await page.waitForFunction(()=>Number((document.querySelector('#countFollowing')?.textContent||'').replace(/\D/g,''))===2,{timeout:15000});
  check('기존 단일 ZIP 분석 유지',await page.locator('#countFollowing').innerText()==='2',{text:await page.locator('#countFollowing').innerText()});
  check('분석 상태 UI 생성',await page.locator('#analysisStatusV13').count()===1,{});

  await page.locator('#zipInput').setInputFiles(path.join(fixtures,'data-2026-06-01.zip'));
  await page.waitForFunction(()=>Number((document.querySelector('#countFollowing')?.textContent||'').replace(/\D/g,''))===3,{timeout:15000});
  await page.locator('#searchInput').fill('stable_one');
  await page.locator('#searchInput').dispatchEvent('input');
  await page.waitForFunction(()=>{
    const button=document.querySelector('#focusDoneBtn');
    const focusText=(document.querySelector('#focusUsername')?.textContent||document.querySelector('.focusPanel')?.textContent||'').toLowerCase();
    return Boolean(button&&!button.disabled&&focusText.includes('stable_one'));
  },null,{timeout:5000});
  await page.locator('#focusDoneBtn').click();
  await page.waitForTimeout(180);
  const firstWorkspace=await page.evaluate(()=>sessionStorage.getItem('unfollow_active_workspace'));
  const firstDone=await number(page,'#countDone');

  await page.locator('#zipInput').setInputFiles(path.join(fixtures,'data-2026-06-28.zip'));
  await page.waitForFunction(()=>Number((document.querySelector('#countFollowing')?.textContent||'').replace(/\D/g,''))===3,{timeout:15000});
  const secondWorkspace=await page.evaluate(()=>sessionStorage.getItem('unfollow_active_workspace'));
  const secondDone=await number(page,'#countDone');
  check('내용 유사도로 같은 계정 작업공간 이어쓰기',firstWorkspace===secondWorkspace&&firstWorkspace?.startsWith('data_')&&firstDone===1&&secondDone===1,{firstWorkspace,secondWorkspace,firstDone,secondDone});

  await axe(page,'v13 데스크톱 접근성');
  check('v13 데스크톱 실행 오류 없음',errors.length===0,{errors});
  await context.close();
}

async function mobile(browser){
  const context=await browser.newContext({viewport:{width:320,height:700}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
  await page.goto(baseURL,{waitUntil:'networkidle',timeout:45000});
  await page.waitForSelector('#compareV13',{state:'visible'});
  await page.locator('#comparePreviousV13').setInputFiles(path.join(fixtures,'compare-previous.zip'));
  await page.locator('#compareCurrentV13').setInputFiles(path.join(fixtures,'compare-current.zip'));
  await page.locator('#compareRunV13').click();
  await page.waitForFunction(()=>!document.querySelector('#compareResultsV13')?.hidden,{timeout:20000});
  const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2);
  check('v13 320px 가로 넘침 없음',!overflow,{width:320,scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth)});
  check('v13 모바일 비교 결과 표시',await page.locator('#compareResultsV13').isVisible(),{});
  await axe(page,'v13 모바일 접근성');
  check('v13 모바일 실행 오류 없음',errors.length===0,{errors});
  await context.close();
}

const browser=await chromium.launch({headless:true});
try{
  await desktop(browser);
  await mobile(browser);
}finally{
  await browser.close();
}

console.log(JSON.stringify({checks,failures},null,2));
if(failures.length) process.exit(1);
