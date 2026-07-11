import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const baseURL=process.env.SMOKE_URL||'http://127.0.0.1:4173/';
const auditDir=path.join(process.cwd(),'audit');
fs.mkdirSync(auditDir,{recursive:true});

const checks=[];
const failures=[];
function check(name,pass,details={}){
  const item={name,pass:Boolean(pass),details};
  checks.push(item);
  if(!item.pass) failures.push(item);
}

async function inspect(browser,{name,width,height,mobile=false}){
  const context=await browser.newContext({viewport:{width,height}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});

  await page.goto(baseURL,{waitUntil:'networkidle',timeout:45000});
  await page.waitForSelector('body.design-v14',{state:'attached',timeout:15000});
  await page.waitForSelector('link[data-design-v14]',{state:'attached',timeout:15000});
  await page.waitForTimeout(1100);

  const metrics=await page.evaluate(()=>{
    const rect=selector=>{
      const element=document.querySelector(selector);
      if(!element) return null;
      const box=element.getBoundingClientRect();
      const style=getComputedStyle(element);
      return {x:box.x,y:box.y,width:box.width,height:box.height,display:style.display,position:style.position,fontSize:parseFloat(style.fontSize)||0,lineHeight:parseFloat(style.lineHeight)||0};
    };
    const isVisible=element=>{
      const style=getComputedStyle(element);
      const box=element.getBoundingClientRect();
      return !element.hidden&&style.display!=='none'&&style.visibility!=='hidden'&&box.width>0&&box.height>0;
    };
    const hero=document.querySelector('.hero');
    const headerCandidates=Array.from(document.querySelectorAll('header,.v19NativeAppBar,[class*="mobile" i],[class*="Mobile"]')).filter(element=>{
      if(element.closest('.sidebar')) return false;
      const text=(element.textContent||'').replace(/\s+/g,' ').trim();
      if(!text.includes('맞팔체커')) return false;
      const box=element.getBoundingClientRect();
      return box.width>=innerWidth*.75&&box.height>=36&&box.height<=90&&box.top<=150&&element.querySelectorAll('button,a').length>0;
    }).filter((element,index,array)=>!array.some((other,otherIndex)=>otherIndex!==index&&other.contains(element)));
    return {
      overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2,
      bodyClass:document.body.className,
      sidebar:rect('.sidebar'),
      nativeAppbar:rect('.v19NativeAppBar'),
      main:rect('.main'),
      hero:rect('.hero'),
      primary:rect('.v14HeroPrimary'),
      aside:rect('.v14HeroAside'),
      summary:rect('.v14SummaryGrid'),
      steps:rect('.v14StepStrip'),
      heading:rect('.v14HeroPrimary h1'),
      drop:rect('.v14PrimaryDrop'),
      chip:rect('.v14LocalChip'),
      resource:rect('.v14ResourceBar'),
      heroChildren:hero?Array.from(hero.children).length:0,
      mobileHeaderCount:headerCandidates.length,
      visibleMobileHeaderCount:headerCandidates.filter(isVisible).length,
      duplicateMobileHeaders:document.querySelectorAll('.v14DuplicateMobileHeader').length,
      version:Array.from(document.querySelectorAll('body *')).map(node=>node.children.length?null:node.textContent?.trim()).find(text=>/^v14(?:\.0)?$/i.test(text||''))||''
    };
  });

  check(`${name} 디자인 레이어 적용`,/design-v14/.test(metrics.bodyClass),metrics);
  check(`${name} 가로 넘침 없음`,!metrics.overflow,{width,documentWidth:await page.evaluate(()=>document.documentElement.scrollWidth)});
  check(`${name} 히어로 구조 유지`,metrics.heroChildren>=2&&metrics.primary&&metrics.aside,metrics);
  check(`${name} 업로드 영역 표시`,metrics.drop&&metrics.drop.height>=90,metrics.drop||{});
  check(`${name} 실행 오류 없음`,errors.length===0,{errors});

  if(!mobile&&width>=1200){
    check(`${name} 사이드바 폭 정돈`,metrics.sidebar&&metrics.sidebar.width>=200&&metrics.sidebar.width<=230,metrics.sidebar||{});
    check(`${name} 메인 영역 우선`,metrics.primary&&metrics.aside&&metrics.primary.width>metrics.aside.width*1.25,{primary:metrics.primary,aside:metrics.aside});
    check(`${name} 제목 크기 절제`,metrics.heading&&metrics.heading.fontSize>=40&&metrics.heading.fontSize<=55,metrics.heading||{});
    check(`${name} 업로드 카드 높이 절제`,metrics.drop&&metrics.drop.height<=165,metrics.drop||{});
    check(`${name} 로컬 분석 배지 표시`,metrics.chip&&metrics.chip.display!=='none'&&metrics.chip.width>80,metrics.chip||{});
  }

  if(width<=980){
    const asideDeferred=metrics.aside?.display==='none'||metrics.aside?.height===0;
    check(`${name} 히어로 단일 열 전환`,asideDeferred||(metrics.primary&&metrics.aside&&metrics.aside.y>=metrics.primary.y+metrics.primary.height-3),{primary:metrics.primary,aside:metrics.aside,asideDeferred});
    check(`${name} 요약 패널 전체 폭 사용`,asideDeferred||(metrics.summary&&metrics.aside&&metrics.summary.width>=metrics.aside.width*.88),{summary:metrics.summary,aside:metrics.aside,asideDeferred});
  }

  if(mobile){
    const sidebarAppbar=metrics.sidebar&&metrics.sidebar.display!=='none'&&metrics.sidebar.position==='sticky'&&metrics.sidebar.height<=82;
    const dedicatedAppbar=metrics.nativeAppbar&&metrics.nativeAppbar.display!=='none'&&metrics.nativeAppbar.position==='sticky'&&metrics.nativeAppbar.height<=82;
    const legacyHeader=metrics.sidebar&&metrics.sidebar.display==='none'&&metrics.visibleMobileHeaderCount===1;
    check(`${name} 모바일 제목 크기`,metrics.heading&&metrics.heading.fontSize<=43,metrics.heading||{});
    check(`${name} 모바일 앱바 표시`,dedicatedAppbar||sidebarAppbar||legacyHeader,{sidebar:metrics.sidebar,nativeAppbar:metrics.nativeAppbar,visibleHeaders:metrics.visibleMobileHeaderCount});
    check(`${name} 모바일 상단 헤더 하나만 표시`,metrics.visibleMobileHeaderCount===1&&Boolean(dedicatedAppbar||legacyHeader)||(sidebarAppbar&&metrics.visibleMobileHeaderCount===0),{total:metrics.mobileHeaderCount,visible:metrics.visibleMobileHeaderCount,duplicates:metrics.duplicateMobileHeaders,dedicatedAppbar,sidebarAppbar});
  }

  const axe=await new AxeBuilder({page}).analyze();
  const serious=axe.violations.filter(item=>['critical','serious'].includes(item.impact));
  check(`${name} 접근성`,serious.length===0,{violations:serious.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.length}))});

  await page.screenshot({path:path.join(auditDir,`design-v14-${name}.png`),fullPage:true});
  await context.close();
}

const browser=await chromium.launch({headless:true});
try{
  await inspect(browser,{name:'desktop-1536',width:1536,height:960});
  await inspect(browser,{name:'desktop-1280',width:1280,height:800});
  await inspect(browser,{name:'tablet-900',width:900,height:900});
  await inspect(browser,{name:'mobile-390',width:390,height:844,mobile:true});
}finally{
  await browser.close();
}

const report={checks,failures};
fs.writeFileSync(path.join(auditDir,'design-v14-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(failures.length) process.exit(1);
