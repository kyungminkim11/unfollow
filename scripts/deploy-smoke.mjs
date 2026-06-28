import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';

const baseURL=process.env.SMOKE_URL||'http://127.0.0.1:4173/';
const fixtureDir=path.join(process.cwd(),'smoke-fixtures');
const failures=[];
const checks=[];

function check(name,condition,details={}){
  checks.push({name,pass:!!condition,details});
  if(!condition) failures.push({name,details});
}

async function number(page,selector){
  const text=await page.locator(selector).first().textContent().catch(()=>'');
  const match=String(text||'').replaceAll(',','').match(/\d+/);
  return match?Number(match[0]):null;
}

async function axe(page,name){
  const report=await new AxeBuilder({page}).analyze();
  const serious=report.violations.filter(item=>['critical','serious'].includes(item.impact));
  check(`${name} 접근성`,serious.length===0,{violations:serious.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.length}))});
}

async function desktop(browser){
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  const errors=[]; const external=[]; const baseOrigin=new URL(baseURL).origin;
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('request',request=>{
    const url=request.url();
    if(url.startsWith('http')&&new URL(url).origin!==baseOrigin) external.push({url,type:request.resourceType(),method:request.method()});
  });

  const response=await page.goto(baseURL,{waitUntil:'networkidle',timeout:45000});
  check('데스크톱 페이지 로드',response?.ok(),{status:response?.status()});
  check('데스크톱 초기 오류 없음',errors.length===0,{errors});
  check('외부 리소스 요청 없음',external.length===0,{external});
  check('CSP 메타 존재',await page.locator('meta[http-equiv="Content-Security-Policy"]').count()===1,{});
  check('정렬 필터 이름',!!(await page.locator('#sortSelect').getAttribute('aria-label')),{});
  check('상태 필터 이름',!!(await page.locator('#statusSelect').getAttribute('aria-label')),{});

  await page.locator('#zipInput').setInputFiles(path.join(fixtureDir,'basic.zip'));
  await page.waitForFunction(()=>Number((document.querySelector('#countFollowing')?.textContent||'').replace(/\D/g,''))===2,null,{timeout:15000});
  check('실제 ZIP 분석',await number(page,'#countFollowing')===2&&await number(page,'#countMutual')===1&&await number(page,'#countNonMutual')===1,{
    following:await number(page,'#countFollowing'),mutual:await number(page,'#countMutual'),nonMutual:await number(page,'#countNonMutual')
  });

  await page.locator('#progressInput').setInputFiles(path.join(fixtureDir,'renamed-progress.txt'));
  await page.waitForTimeout(500);
  check('내용 기반 JSON 기록 불러오기',await number(page,'#countDone')===1,{done:await number(page,'#countDone')});

  await page.locator('#zipInput').setInputFiles(path.join(fixtureDir,'account-a.zip'));
  await page.waitForFunction(()=>Number((document.querySelector('#countFollowing')?.textContent||'').replace(/\D/g,''))===2);
  await page.locator('#searchInput').fill('shared_target');
  await page.locator('#searchInput').dispatchEvent('input');
  await page.waitForTimeout(150);
  await page.locator('#focusDoneBtn').click();
  await page.waitForTimeout(200);
  check('계정 A 상태 저장',await number(page,'#countDone')===1,{done:await number(page,'#countDone')});

  await page.locator('#zipInput').setInputFiles(path.join(fixtureDir,'account-b.zip'));
  await page.waitForFunction(()=>Number((document.querySelector('#countFollowing')?.textContent||'').replace(/\D/g,''))===2);
  check('계정별 진행 기록 분리',await number(page,'#countDone')===0,{done:await number(page,'#countDone')});

  const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2);
  check('데스크톱 가로 넘침 없음',!overflow,{overflow});
  await axe(page,'데스크톱 결과 화면');
  check('데스크톱 실행 오류 없음',errors.length===0,{errors});
  await context.close();
}

async function mobile(browser){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  const errors=[];
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(baseURL,{waitUntil:'networkidle',timeout:45000});

  const sample=page.locator('button').filter({hasText:/샘플/});
  for(let i=0;i<await sample.count();i++){
    if(await sample.nth(i).isVisible()){await sample.nth(i).click();break;}
  }
  await page.waitForFunction(()=>Number((document.querySelector('#countFollowing')?.textContent||'').replace(/\D/g,''))===13,null,{timeout:15000});

  check('모바일 상단바 표시',await page.locator('.mobileTopV8').isVisible().catch(()=>false),{});
  check('모바일 하단 내비 표시',await page.locator('.bottomNavV8').isVisible().catch(()=>false),{});
  check('모바일 카드 결과 표시',await page.locator('.mobileList').isVisible().catch(()=>false),{});
  check('데스크톱 표 모바일 숨김',await page.locator('.tableWrap').isHidden().catch(()=>false),{});
  const toggle=page.locator('.mobileFilterToggle');
  check('모바일 필터 버튼 표시',await toggle.isVisible().catch(()=>false),{});
  if(await toggle.isVisible().catch(()=>false)){
    await toggle.click();
    check('모바일 필터 펼치기',await toggle.getAttribute('aria-expanded')==='true',{expanded:await toggle.getAttribute('aria-expanded')});
  }
  const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2);
  check('모바일 가로 넘침 없음',!overflow,{overflow,width:390,scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth)});
  await axe(page,'모바일 결과 화면');
  check('모바일 실행 오류 없음',errors.length===0,{errors});
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
