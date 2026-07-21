import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const baseURL=(process.env.SMOKE_URL||'http://127.0.0.1:4173/').replace(/\/$/,'');
const supabaseURL='https://jnciddblcndmthmmvqrz.supabase.co';
const publishableKey='sb_publishable_UUzSE7O9wqI0WN9cKG9OAQ_VleRkL4I';
const adminAPI=`${supabaseURL}/functions/v1/unfollow-newsletter-admin`;
const auditDir=path.join(process.cwd(),'audit');
fs.mkdirSync(auditDir,{recursive:true});
const checks=[];
const failures=[];

function check(name,pass,details={}){
  const item={name,pass:Boolean(pass),details};
  checks.push(item);
  if(!item.pass) failures.push(item);
}
async function axe(page,name){
  const result=await new AxeBuilder({page}).analyze();
  const serious=result.violations.filter(item=>['critical','serious'].includes(item.impact));
  check(`${name} 접근성`,serious.length===0,{violations:serious.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.length}))});
}

async function premiumPage(browser,width,label,roundTrip=false){
  const context=await browser.newContext({viewport:{width,height:width<600?844:960}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
  const response=await page.goto(`${baseURL}/premium/`,{waitUntil:'networkidle',timeout:45000});
  const metrics=await page.evaluate(()=>({
    heading:document.querySelector('main h1')?.textContent.trim()||'',
    form:Boolean(document.querySelector('#premiumInterestFormV17')),
    featureCount:document.querySelectorAll('input[name="features"]').length,
    privacyLink:document.querySelector('.interestConsentV17 a')?.getAttribute('href')||'',
    csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content||'',
    overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2,
  }));
  check(`${label} HTTP 응답`,response?.status()===200,{status:response?.status()});
  check(`${label} 수요조사`,metrics.heading==='무료 분석은 유지하고, 기록과 관리 기능을 확장합니다'&&metrics.form&&metrics.featureCount===8,metrics);
  check(`${label} 개인정보 안내`,metrics.privacyLink==='/privacy/#premium-interest',metrics);
  check(`${label} API CSP`,metrics.csp.includes('https://jnciddblcndmthmmvqrz.supabase.co'),metrics);
  check(`${label} 가로 넘침 없음`,!metrics.overflow,metrics);
  await axe(page,label);

  if(roundTrip){
    const email=`premium-ci-${Date.now()}@example.com`;
    const form=page.locator('#premiumInterestFormV17');
    await form.locator('input[name="email"]').fill(email);
    await form.locator('select[name="accountCountRange"]').selectOption('2_3');
    await form.locator('input[value="history"]').check();
    await form.locator('input[value="reports"]').check();
    await form.locator('select[name="pricePreference"]').selectOption('3000_5900');
    await form.locator('textarea[name="comment"]').fill('CI 수요조사 테스트');
    await form.locator('input[name="privacyConsent"]').check();
    await page.waitForTimeout(1400);
    await form.locator('#premiumInterestSubmitV17').click();
    await page.waitForFunction(()=>document.querySelector('#premiumInterestResultV17')?.dataset.state==='success',{timeout:20000});
    const first=await page.locator('#premiumInterestResultV17').innerText();
    check('프리미엄 의견 실제 저장 API',/저장/.test(first),{first,email});

    await form.locator('select[name="pricePreference"]').selectOption('6000_9900');
    await form.locator('#premiumInterestSubmitV17').click();
    await page.waitForFunction(()=>document.querySelector('#premiumInterestResultV17')?.dataset.state==='success',{timeout:20000});
    const updated=await page.locator('#premiumInterestResultV17').innerText();
    check('프리미엄 의견 실제 갱신 API',/저장/.test(updated),{updated,email});

    page.once('dialog',dialog=>dialog.accept());
    await form.locator('#premiumInterestDeleteV17').click();
    await page.waitForFunction(()=>document.querySelector('#premiumInterestResultV17')?.dataset.state==='success'&&/삭제/.test(document.querySelector('#premiumInterestResultV17')?.textContent||''),{timeout:20000});
    const removed=await page.locator('#premiumInterestResultV17').innerText();
    check('프리미엄 의견 실제 삭제 API',/삭제/.test(removed),{removed,email});
  }

  check(`${label} 실행 오류 없음`,errors.length===0,{errors});
  await page.screenshot({path:path.join(auditDir,`admin-v17-${label}.png`),fullPage:true});
  await context.close();
}

async function adminLoginPage(browser){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  const response=await page.goto(`${baseURL}/admin/newsletter/`,{waitUntil:'networkidle',timeout:30000});
  const metrics=await page.evaluate(()=>({
    loginVisible:!document.querySelector('#adminLogin')?.hidden,
    buttonText:document.querySelector('#adminLoginButton')?.textContent.trim()||'',
    robots:document.querySelector('meta[name="robots"]')?.content||'',
    overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2,
  }));
  check('관리자 로그인 페이지 응답',response?.status()===200,{status:response?.status()});
  check('관리자 매직링크 화면',metrics.loginVisible&&/로그인 링크/.test(metrics.buttonText),metrics);
  check('관리자 검색 차단',metrics.robots.includes('noindex')&&metrics.robots.includes('noarchive'),metrics);
  check('관리자 로그인 모바일 넘침 없음',!metrics.overflow,metrics);
  await axe(page,'관리자 로그인');
  await page.screenshot({path:path.join(auditDir,'admin-v17-login-mobile.png'),fullPage:true});
  await context.close();
}

function mockAdminResponse(action){
  if(action==='stats') return {ok:true,admin:{email:'unfollow@lavalabs.co.kr',role:'owner'},stats:{active:12,last7Days:3,last30Days:8,interestCount:5,featureCounts:{history:5,reports:3,multi_account:2},priceCounts:{'3000_5900':4,under_3000:1},accountCounts:{'1':2,'2_3':3},consentCounts:{subscribe:8}},recent:[]};
  if(action==='list_subscribers') return {ok:true,admin:{email:'unfollow@lavalabs.co.kr',role:'owner'},count:2,page:0,pageSize:25,rows:[{id:'11111111-1111-4111-8111-111111111111',email:'alpha@example.com',status:'active',source:'unfollow',subscribed_at:'2026-07-10T10:00:00Z'},{id:'22222222-2222-4222-8222-222222222222',email:'beta@example.com',status:'active',source:'unfollow',subscribed_at:'2026-07-09T10:00:00Z'}]};
  if(action==='list_interest') return {ok:true,admin:{email:'unfollow@lavalabs.co.kr',role:'owner'},count:1,page:0,pageSize:25,rows:[{id:'33333333-3333-4333-8333-333333333333',email:'alpha@example.com',feature_codes:['history','reports'],price_preference:'3000_5900',account_count_range:'2_3',comment:'월간 리포트가 필요합니다.',updated_at:'2026-07-10T10:00:00Z'}]};
  if(action==='export_subscribers') return {ok:true,rows:[{email:'alpha@example.com',status:'active',source:'unfollow',subscribed_at:'2026-07-10T10:00:00Z'}]};
  if(action.startsWith('delete_')) return {ok:true,message:'삭제했습니다.'};
  return {ok:false,message:'지원하지 않는 작업'};
}

async function adminDashboard(browser,width,label){
  const context=await browser.newContext({viewport:{width,height:width<600?844:960},acceptDownloads:true});
  await context.addInitScript(({key})=>{
    if(location.origin.startsWith('http://127.0.0.1')||location.origin.startsWith('http://localhost')) sessionStorage.setItem(key,JSON.stringify({accessToken:'mock-access-token',refreshToken:'mock-refresh-token',expiresAt:Math.floor(Date.now()/1000)+3600}));
  },{key:'unfollow_admin_session_v17'});
  await context.route(adminAPI,async route=>{
    const request=route.request();
    let body={};
    try{body=request.postDataJSON();}catch{}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mockAdminResponse(String(body.action||'stats')))});
  });
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
  await page.goto(`${baseURL}/admin/newsletter/`,{waitUntil:'networkidle',timeout:30000});
  await page.waitForSelector('#adminDashboard:not([hidden])',{timeout:15000});
  await page.waitForFunction(()=>document.querySelector('#statActive')?.textContent.trim()==='12');
  const metrics=await page.evaluate(()=>({
    identity:document.querySelector('#adminIdentity')?.textContent.trim()||'',
    subscriberRows:document.querySelectorAll('#subscriberRows tr').length,
    featureBars:document.querySelectorAll('#featureBars .adminBarRow').length,
    overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2,
  }));
  check(`${label} 관리자 인증 상태`,metrics.identity.includes('unfollow@lavalabs.co.kr')&&metrics.identity.includes('owner'),metrics);
  check(`${label} 관리자 통계·구독자`,metrics.subscriberRows===2&&metrics.featureBars>=2,metrics);
  check(`${label} 가로 넘침 없음`,!metrics.overflow,metrics);
  await page.locator('#tabInterest').click();
  await page.waitForSelector('#panelInterest:not([hidden])');
  await page.waitForFunction(()=>/월간 리포트/.test(document.querySelector('#interestRows')?.textContent||''),{timeout:10000});
  const interestText=await page.locator('#interestRows').innerText();
  check(`${label} 프리미엄 의견 탭`,interestText.includes('월간 리포트'),{interestText});
  if(width>600){
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#adminExport').click();
    const download=await downloadPromise;
    check('관리자 CSV 내보내기',download.suggestedFilename().endsWith('.csv'),{filename:download.suggestedFilename()});
  }
  await axe(page,label);
  check(`${label} 실행 오류 없음`,errors.length===0,{errors});
  await page.screenshot({path:path.join(auditDir,`admin-v17-${label}.png`),fullPage:true});
  await context.close();
}

async function unauthorizedAdminAPI(){
  const response=await fetch(adminAPI,{method:'POST',headers:{apikey:publishableKey,Origin:'http://127.0.0.1:4173','Content-Type':'application/json'},body:JSON.stringify({action:'stats'})});
  check('관리자 API 비로그인 차단',[401,403].includes(response.status),{status:response.status,body:(await response.text()).slice(0,300)});
}

const browser=await chromium.launch({headless:true});
try{
  await premiumPage(browser,1280,'premium-desktop',true);
  await premiumPage(browser,390,'premium-mobile',false);
  await adminLoginPage(browser);
  await adminDashboard(browser,1280,'admin-desktop');
  await adminDashboard(browser,390,'admin-mobile');
  await unauthorizedAdminAPI();
}finally{
  await browser.close();
}

const report={version:'17.0',checks,failures};
fs.writeFileSync(path.join(auditDir,'admin-v17-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(failures.length) process.exit(1);
