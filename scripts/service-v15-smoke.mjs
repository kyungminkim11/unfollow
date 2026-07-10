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

async function accessibility(page,name){
  const result=await new AxeBuilder({page}).analyze();
  const serious=result.violations.filter(item=>['critical','serious'].includes(item.impact));
  check(`${name} 접근성`,serious.length===0,{violations:serious.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.length}))});
}

async function inspectApp(browser,{name,width,height}){
  const context=await browser.newContext({viewport:{width,height}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
  const response=await page.goto(`${baseURL}/`,{waitUntil:'networkidle',timeout:45000});
  await page.waitForSelector('body.service-v15',{timeout:15000});
  await page.waitForSelector('link[data-service-v15]',{state:'attached',timeout:15000});
  await page.waitForTimeout(900);
  const status=response?.status()||0;
  const metrics=await page.evaluate(()=>{
    const visibleText=Array.from(document.querySelectorAll('body *')).filter(element=>{
      const style=getComputedStyle(element);
      const box=element.getBoundingClientRect();
      return !element.children.length&&!element.hidden&&style.display!=='none'&&style.visibility!=='hidden'&&box.width>0&&box.height>0;
    }).map(element=>element.textContent.trim());
    const summaryText=document.querySelector('.v14SummaryGrid .sum span');
    return {
      title:document.title,
      heading:document.querySelector('.hero h1')?.textContent.trim()||'',
      serviceNav:document.querySelectorAll('.v15ServiceNav .v15NavItem').length,
      mobileNav:document.querySelectorAll('.v15MobileNav .v15NavItem').length,
      trust:document.querySelectorAll('.v15TrustGrid>div').length,
      uploadHelp:document.querySelector('#zipInput,input[type="file"]')?.getAttribute('aria-describedby')||'',
      oldCopy:visibleText.includes('취소 검토')||visibleText.includes('팔로워만')||visibleText.includes('전체 팔로잉'),
      summaryFont:summaryText?parseFloat(getComputedStyle(summaryText).fontSize):0,
      overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2,
      version:visibleText.find(text=>/^v15(?:\.0)?$/i.test(text))||'',
      privacyLink:Boolean(document.querySelector('a[href="/privacy/"]')),
      guideLink:Boolean(document.querySelector('a[href="/guide/"]')),
      helpLink:Boolean(document.querySelector('a[href="/help/"]'))
    };
  });
  check(`${name} HTTP 응답`,status===200,{status});
  check(`${name} v15 레이어 적용`,metrics.heading==='Instagram 팔로우 관계를 안전하게 확인하세요'&&metrics.version==='v15.0',metrics);
  check(`${name} 서비스 메뉴`,metrics.serviceNav>=6&&metrics.mobileNav===4,metrics);
  check(`${name} 신뢰 안내`,metrics.trust===3&&metrics.uploadHelp==='v15UploadHelp',metrics);
  check(`${name} 문구 정리`,!metrics.oldCopy,metrics);
  check(`${name} 안내 페이지 연결`,metrics.privacyLink&&metrics.guideLink&&metrics.helpLink,metrics);
  check(`${name} 요약 글자 크기`,metrics.summaryFont>=11,metrics);
  check(`${name} 가로 넘침 없음`,!metrics.overflow,metrics);
  check(`${name} 실행 오류 없음`,errors.length===0,{errors});
  await accessibility(page,name);
  await page.screenshot({path:path.join(auditDir,`service-v15-${name}.png`),fullPage:true});
  await context.close();
}

async function inspectPage(browser,{pathName,label,heading}){
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
    current:document.querySelector('.pageNav [aria-current="page"]')?.getAttribute('href')||'',
    overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2
  }));
  check(`${label} HTTP 응답`,response?.status()===200,{status:response?.status()});
  check(`${label} 제목`,metrics.heading===heading,metrics);
  check(`${label} 보안·SEO 메타`,metrics.csp&&metrics.canonical.endsWith(pathName),metrics);
  check(`${label} 현재 메뉴`,metrics.current===pathName,metrics);
  check(`${label} 가로 넘침 없음`,!metrics.overflow,metrics);
  check(`${label} 실행 오류 없음`,errors.length===0,{errors});
  await accessibility(page,label);
  await page.screenshot({path:path.join(auditDir,`service-v15-${label}.png`),fullPage:true});
  await context.close();
}

const browser=await chromium.launch({headless:true});
try{
  await inspectApp(browser,{name:'desktop-1440',width:1440,height:900});
  await inspectApp(browser,{name:'mobile-390',width:390,height:844});
  await inspectPage(browser,{pathName:'/guide/',label:'guide',heading:'Instagram 데이터 ZIP을 준비하는 방법'});
  await inspectPage(browser,{pathName:'/help/',label:'help',heading:'분석이 되지 않을 때 확인하세요'});
  await inspectPage(browser,{pathName:'/privacy/',label:'privacy',heading:'ZIP 내용은 외부 서버로 전송되지 않습니다'});
}finally{
  await browser.close();
}
const report={version:'15.0',checks,failures};
fs.writeFileSync(path.join(auditDir,'service-v15-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(failures.length) process.exit(1);
