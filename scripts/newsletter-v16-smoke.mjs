import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const baseURL=(process.env.SMOKE_URL||'http://127.0.0.1:4173/').replace(/\/$/,'');
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

async function mainPage(browser,width,name){
  const context=await browser.newContext({viewport:{width,height:width<600?844:900}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
  const response=await page.goto(`${baseURL}/`,{waitUntil:'networkidle',timeout:45000});
  await page.waitForSelector('.betaBannerV16',{state:'visible',timeout:15000});
  const metrics=await page.evaluate(()=>({
    bannerTitle:document.querySelector('#betaBannerTitleV16')?.textContent.trim()||'',
    newsletterButton:Boolean(document.querySelector('[data-newsletter-open]')),
    premiumLink:document.querySelector('.betaBannerV16 a')?.getAttribute('href')||'',
    footerLinks:Array.from(document.querySelectorAll('.businessLinksV10 a')).map(a=>a.getAttribute('href')),
    offlineShown:document.querySelector('.offlineBanner')?.classList.contains('show')||false,
    overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2,
  }));
  check(`${name} HTTP 응답`,response?.status()===200,{status:response?.status()});
  check(`${name} 무료 베타 배너`,metrics.bannerTitle==='핵심 분석 기능은 지금 무료입니다'&&metrics.newsletterButton&&metrics.premiumLink==='/premium/',metrics);
  check(`${name} 정책 링크`,['/newsletter/','/data/','/privacy/','/terms/'].every(link=>metrics.footerLinks.includes(link)),metrics);
  check(`${name} 오프라인 오탐 없음`,!metrics.offlineShown,metrics);
  check(`${name} 가로 넘침 없음`,!metrics.overflow,metrics);
  await page.locator('[data-newsletter-open]').first().click();
  await page.waitForSelector('#newsletterDialogV16',{state:'visible'});
  check(`${name} 뉴스레터 대화상자`,await page.locator('#newsletterDialogV16 input[name="email"]').count()===1&&await page.locator('#newsletterDialogV16 input[type="checkbox"]').count()===2,{});
  await axe(page,`${name} 메인`);
  check(`${name} 실행 오류 없음`,errors.length===0,{errors});
  await page.screenshot({path:path.join(auditDir,`newsletter-v16-${name}.png`),fullPage:true});
  await context.close();
}

async function staticPage(browser,pathName,label,heading){
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
  const response=await page.goto(`${baseURL}${pathName}`,{waitUntil:'networkidle',timeout:30000});
  const metrics=await page.evaluate(()=>({
    heading:document.querySelector('main h1')?.textContent.trim()||'',
    canonical:document.querySelector('link[rel="canonical"]')?.href||'',
    csp:Boolean(document.querySelector('meta[http-equiv="Content-Security-Policy"]')),
    overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2,
  }));
  check(`${label} HTTP 응답`,response?.status()===200,{status:response?.status()});
  check(`${label} 제목`,metrics.heading===heading,metrics);
  check(`${label} 보안·SEO`,metrics.csp&&metrics.canonical.endsWith(pathName),metrics);
  check(`${label} 가로 넘침 없음`,!metrics.overflow,metrics);
  check(`${label} 실행 오류 없음`,errors.length===0,{errors});
  await axe(page,label);
  await page.screenshot({path:path.join(auditDir,`newsletter-v16-${label}.png`),fullPage:true});
  await context.close();
}

async function newsletterRoundTrip(browser){
  const context=await browser.newContext({viewport:{width:1100,height:900}});
  const page=await context.newPage();
  const email=`unfollow-ci-${Date.now()}@example.com`;
  await page.goto(`${baseURL}/newsletter/`,{waitUntil:'networkidle',timeout:30000});
  const subscribe=page.locator('form[data-newsletter-action="subscribe"]');
  await subscribe.locator('input[name="email"]').fill(email);
  await subscribe.locator('input[name="privacyConsent"]').check();
  await subscribe.locator('input[name="marketingConsent"]').check();
  await page.waitForTimeout(1400);
  await subscribe.locator('button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('form[data-newsletter-action="subscribe"] [data-newsletter-result]')?.dataset.state==='success',{timeout:20000});
  const subscribeText=await subscribe.locator('[data-newsletter-result]').innerText();
  check('뉴스레터 실제 신청 API',/완료/.test(subscribeText),{subscribeText,email});

  const unsubscribe=page.locator('form[data-newsletter-action="unsubscribe"]');
  await unsubscribe.locator('input[name="email"]').fill(email);
  await page.waitForTimeout(1400);
  await unsubscribe.locator('button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('form[data-newsletter-action="unsubscribe"] [data-newsletter-result]')?.dataset.state==='success',{timeout:20000});
  const unsubscribeText=await unsubscribe.locator('[data-newsletter-result]').innerText();
  check('뉴스레터 실제 해지·삭제 API',/해지|삭제/.test(unsubscribeText),{unsubscribeText,email});
  await context.close();
}

const browser=await chromium.launch({headless:true});
try{
  await mainPage(browser,1440,'desktop-1440');
  await mainPage(browser,390,'mobile-390');
  await staticPage(browser,'/premium/','premium','무료 분석은 유지하고, 기록과 관리 기능을 확장합니다');
  await staticPage(browser,'/newsletter/','newsletter','프리미엄 출시와 중요한 업데이트만 알려드릴게요');
  await staticPage(browser,'/data/','data','ZIP 분석 데이터와 뉴스레터 이메일은 서로 분리됩니다');
  await staticPage(browser,'/privacy/','privacy','ZIP 분석은 로컬에서, 뉴스레터 이메일만 선택적으로 저장합니다');
  await staticPage(browser,'/terms/','terms','맞팔체커 이용약관');
  await newsletterRoundTrip(browser);
}finally{
  await browser.close();
}

const report={version:'16.0',checks,failures};
fs.writeFileSync(path.join(auditDir,'newsletter-v16-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(failures.length) process.exit(1);
