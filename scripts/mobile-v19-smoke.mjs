import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const baseURL=(process.env.SMOKE_URL||'http://127.0.0.1:4173/').replace(/\/$/,'');
const auditDir=path.join(process.cwd(),'audit');
fs.mkdirSync(auditDir,{recursive:true});
const checks=[];const failures=[];
function check(name,pass,details={}){const item={name,pass:Boolean(pass),details};checks.push(item);if(!item.pass) failures.push(item);}
async function axe(page,name){const result=await new AxeBuilder({page}).analyze();const serious=result.violations.filter(item=>['critical','serious'].includes(item.impact));check(`${name} 접근성`,serious.length===0,{violations:serious.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.slice(0,5).map(node=>node.target)}))});}

async function inspect(width,height,label){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width,height},isMobile:width<600});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
  const response=await page.goto(`${baseURL}/`,{waitUntil:'networkidle',timeout:45000});
  await page.waitForSelector('body.design-v14.mobile-app-v19',{timeout:20000});
  await page.waitForSelector('link[data-v19-header-fix]',{state:'attached',timeout:10000});
  await page.waitForTimeout(1200);
  const metrics=await page.evaluate(()=>{
    const sidebarElement=document.querySelector('.sidebar');
    const topbarElement=document.querySelector('.serviceTopbar,.v15ServiceTopbar,.topbar');
    const actionWrap=document.querySelector('.serviceTopActions,.v15TopActions,.topActions');
    const sidebar=sidebarElement?.getBoundingClientRect();
    const topbar=topbarElement?.getBoundingClientRect();
    const hero=document.querySelector('.v14HeroPrimary')?.getBoundingClientRect();
    const drop=document.querySelector('.v14PrimaryDrop')?.getBoundingClientRect();
    const banner=document.querySelector('.offlineBanner')?.getBoundingClientRect();
    const firstAction=actionWrap?.querySelector('a,button')||document.querySelector('.serviceTopActions a,.serviceTopActions button,.v15TopActions a,.v15TopActions button');
    const visibleDuplicateHeaders=Array.from(document.querySelectorAll('.v19DuplicateHeader,.v14DuplicateMobileHeader,.mobileTopV8')).filter(element=>{
      if(element===sidebarElement||sidebarElement?.contains(element)) return false;
      const style=getComputedStyle(element);
      const rect=element.getBoundingClientRect();
      return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;
    }).length;
    return {
      ready:document.body.classList.contains('mobile-app-v19')&&document.documentElement.classList.contains('mobile-app-v19-ready'),
      mobileCss:Boolean(document.querySelector('link[href*="mobile-app-v19.css"]')),
      headerFixCss:Boolean(document.querySelector('link[href*="mobile-app-v19-header.css"]')),
      sidebar:{top:sidebar?.top,width:sidebar?.width,height:sidebar?.height,position:sidebarElement?getComputedStyle(sidebarElement).position:''},
      topbar:{right:topbar?innerWidth-topbar.right:null,position:topbarElement?getComputedStyle(topbarElement).position:''},
      hero:{top:hero?.top,width:hero?.width,height:hero?.height},
      drop:{top:drop?.top,height:drop?.height},
      banner:{height:banner?.height,shown:document.querySelector('.offlineBanner')?.classList.contains('show')},
      actionLabel:firstAction?.getAttribute('aria-label')||'',
      duplicateHeaders:visibleDuplicateHeaders,
      overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2,
      firstScreenUpload:(drop?.top||9999)<820,
    };
  });
  check(`${label} HTTP 응답`,response?.status()===200,{status:response?.status()});
  check(`${label} v19 적용`,metrics.ready&&metrics.mobileCss&&metrics.headerFixCss,metrics);
  check(`${label} 단일 앱바`,metrics.sidebar.position==='sticky'&&metrics.sidebar.height<=70&&metrics.duplicateHeaders===0,metrics);
  check(`${label} 첫 화면 업로드 노출`,metrics.firstScreenUpload,metrics);
  check(`${label} 오프라인 배너 기본 숨김`,!metrics.banner.shown,metrics);
  check(`${label} 가로 넘침 없음`,!metrics.overflow,metrics);
  check(`${label} 상단 버튼 라벨`,Boolean(metrics.actionLabel),metrics);
  check(`${label} 실행 오류 없음`,errors.length===0,{errors});
  await axe(page,label);
  await page.screenshot({path:path.join(auditDir,`mobile-v19-${label}.png`),fullPage:true});
  await context.close();
  await browser.close();
}
await inspect(390,844,'mobile-390');
await inspect(430,932,'mobile-430');
const report={version:'19.1',checks,failures};
fs.writeFileSync(path.join(auditDir,'mobile-v19-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(failures.length) process.exit(1);
