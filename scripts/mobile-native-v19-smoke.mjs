import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const baseURL=(process.env.SMOKE_URL||'http://127.0.0.1:4173/').replace(/\/$/,'');
const auditDir=path.join(process.cwd(),'audit');
fs.mkdirSync(auditDir,{recursive:true});
const checks=[];
const failures=[];
function check(name,pass,details={}){const item={name,pass:Boolean(pass),details};checks.push(item);if(!item.pass) failures.push(item);}
async function axe(page,name){
  const result=await new AxeBuilder({page}).analyze();
  const serious=result.violations.filter(item=>['critical','serious'].includes(item.impact));
  check(`${name} 접근성`,serious.length===0,{violations:serious.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.slice(0,6).map(node=>({target:node.target,html:node.html,failureSummary:node.failureSummary}))}))});
}

async function inspectMobile(browser,width,height,label){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors=[];
  let expectingNetworkFailure=false;
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{
    if(message.type()!=='error') return;
    const text=message.text();
    if(expectingNetworkFailure&&/ERR_FAILED|Failed to load resource/i.test(text)) return;
    errors.push(text);
  });
  const response=await page.goto(`${baseURL}/`,{waitUntil:'networkidle',timeout:45000});
  await page.waitForSelector('body.mobile-native-v19',{timeout:15000});
  await page.waitForSelector('.v19NativeAppBar',{state:'visible',timeout:15000});
  await page.waitForSelector('.v19BottomNav',{state:'visible',timeout:15000});
  await page.waitForSelector('.v19DropAction',{state:'visible',timeout:15000});
  await page.waitForTimeout(500);

  const metrics=await page.evaluate(()=>{
    const rect=selector=>document.querySelector(selector)?.getBoundingClientRect()||null;
    const isHidden=element=>{
      if(!element) return true;
      const style=getComputedStyle(element);
      const box=element.getBoundingClientRect();
      return style.display==='none'||style.visibility==='hidden'||box.width===0||box.height===0;
    };
    const oldNavHidden=Array.from(document.querySelectorAll('.v15MobileNav,.bottomNavV8')).every(isHidden);
    const oldHeaderHidden=[document.querySelector('.sidebar'),document.querySelector('.serviceTopbar'),document.querySelector('.mobileTopV8')].every(isHidden);
    const targetRects=Array.from(document.querySelectorAll('.v19AppButton,.v19BottomNavItem,.betaBannerActionsV16 a,.betaBannerActionsV16 button,.v19DropAction')).map(element=>{
      const box=element.getBoundingClientRect();
      return {label:element.getAttribute('aria-label')||element.textContent.trim(),width:box.width,height:box.height};
    });
    const appbar=rect('.v19NativeAppBar');
    const beta=rect('.betaBannerV16');
    const brand=rect('.v19AppBrand');
    const actions=rect('.v19AppActions');
    return {
      title:document.querySelector('.v14HeroPrimary h1')?.textContent.trim()||'',
      lead:document.querySelector('.v14HeroPrimary .lead')?.textContent.trim()||'',
      appbar,
      brand,
      actions,
      beta,
      upload:rect('.v14PrimaryDrop'),
      nav:rect('.v19BottomNav'),
      navItems:document.querySelectorAll('.v19BottomNavItem').length,
      appButtons:document.querySelectorAll('.v19AppButton').length,
      uploadSvg:Boolean(document.querySelector('.v14PrimaryDrop .dropIcon svg')),
      privacyLine:Boolean(document.querySelector('.v19PrivacyLine')),
      oldNavHidden,
      oldHeaderHidden,
      headerOverlap:Boolean(appbar&&beta&&appbar.bottom>beta.top+1),
      actionWraps:Boolean(appbar&&brand&&actions&&brand.right<=actions.left+1&&actions.right<=appbar.right+1),
      overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2,
      offlineVisible:document.querySelector('.offlineBanner')?.classList.contains('show')||false,
      targetRects
    };
  });
  check(`${label} HTTP 응답`,response?.status()===200,{status:response?.status()});
  check(`${label} 단일 네이티브 앱바`,metrics.appbar&&metrics.appbar.height<=82&&metrics.appbar.top===0&&metrics.appButtons===2&&metrics.oldHeaderHidden,metrics);
  check(`${label} 앱바 정렬`,metrics.actionWraps&&!metrics.headerOverlap,metrics);
  check(`${label} 작업 중심 첫 화면`,metrics.title==='Instagram 관계 분석'&&metrics.upload&&metrics.upload.top<620&&metrics.uploadSvg&&metrics.privacyLine,metrics);
  check(`${label} 무료 베타 배너 압축`,metrics.beta&&metrics.beta.height<170,metrics);
  check(`${label} 하단 탭바`,metrics.navItems===4&&metrics.nav&&metrics.nav.bottom<=height+1&&metrics.oldNavHidden,metrics);
  check(`${label} 터치 영역`,metrics.targetRects.every(item=>item.height>=38),{targets:metrics.targetRects});
  check(`${label} 가로 넘침 없음`,!metrics.overflow,metrics);
  check(`${label} 정상 연결에서 오프라인 안내 없음`,!metrics.offlineVisible,metrics);

  expectingNetworkFailure=true;
  await context.setOffline(true);
  await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
  await page.waitForSelector('.offlineBanner.show',{timeout:8000});
  await page.waitForTimeout(350);
  const offline=await page.evaluate(()=>{
    const banner=document.querySelector('.offlineBanner');
    const box=banner.getBoundingClientRect();
    const style=getComputedStyle(banner);
    return {text:banner.textContent.replace('×','').trim(),top:box.top,bottom:box.bottom,height:box.height,navTop:document.querySelector('.v19BottomNav').getBoundingClientRect().top,position:style.position,width:box.width};
  });
  check(`${label} 오프라인 안내 비가림`,offline.text.includes('오프라인 모드')&&offline.top>=58&&offline.bottom<offline.navTop&&offline.height<60,offline);
  await page.locator('.offlineBannerClose').click();
  await page.waitForFunction(()=>!document.querySelector('.offlineBanner')?.classList.contains('show'));
  check(`${label} 오프라인 안내 닫기`,true,{});
  await context.setOffline(false);
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(400);
  expectingNetworkFailure=false;

  const theme=page.locator('.v19NativeAppBar [data-v19-theme]');
  await theme.click();
  check(`${label} 화면 모드 전환`,await page.locator('body.v8-dark').count()===1,{});
  await theme.click();

  await axe(page,label);
  check(`${label} 실행 오류 없음`,errors.length===0,{errors});
  await page.screenshot({path:path.join(auditDir,`mobile-native-v19-${label}.png`),fullPage:true});
  await context.close();
}

const browser=await chromium.launch({headless:true});
try{
  await inspectMobile(browser,390,844,'mobile-390');
  await inspectMobile(browser,320,700,'mobile-320');
}finally{
  await browser.close();
}
const report={version:'19.2',checks,failures};
fs.writeFileSync(path.join(auditDir,'mobile-native-v19-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(failures.length) process.exit(1);
