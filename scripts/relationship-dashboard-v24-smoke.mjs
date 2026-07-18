import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const root=process.cwd();
const baseURL=(process.env.SMOKE_URL||'http://127.0.0.1:4173/').replace(/\/$/,'');
const auditDir=path.join(root,'audit');
fs.mkdirSync(auditDir,{recursive:true});
const checks=[];
const failures=[];
function check(name,pass,details={}){const item={name,pass:Boolean(pass),details};checks.push(item);if(!item.pass) failures.push(item);}

const manifest=JSON.parse(fs.readFileSync(path.join(root,'extension','manifest.json'),'utf8'));
const background=fs.readFileSync(path.join(root,'extension','background.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'extension','content-bridge.js'),'utf8');
const sidepanel=fs.readFileSync(path.join(root,'extension','sidepanel.html'),'utf8');
const sidepanelDashboard=fs.readFileSync(path.join(root,'extension','sidepanel-v24.js'),'utf8');
const webDashboard=fs.readFileSync(path.join(root,'assets','relationship-dashboard-v24.js'),'utf8');

check('Companion v24 manifest',manifest.manifest_version===3&&manifest.version==='24.0.0',{version:manifest.version});
check('권한 증가 없음',JSON.stringify(manifest.permissions)===JSON.stringify(['storage','tabs','sidePanel']),{permissions:manifest.permissions});
check('관계 이력 로컬 저장',/matchalRelationshipHistoryV24/.test(sidepanelDashboard)&&/chrome\.storage\.local/.test(sidepanelDashboard),{});
check('대시보드 백그라운드 API',/MATCHAL_GET_RELATIONSHIP_DASHBOARD/.test(background)&&/getRelationshipHistory/.test(background),{});
check('웹-확장 대시보드 브리지',/MATCHAL_RELATIONSHIP_DASHBOARD/.test(bridge)&&/matchalRelationshipHistoryV24/.test(bridge),{});
check('사이드패널 대시보드 UI',/dashboardProfileV24/.test(sidepanel)&&/dashboardQueueV24/.test(sidepanel)&&/sidepanel-v24\.js/.test(sidepanel),{});
check('변화 계산과 작업 연결',/lostFollowersStillFollowing/.test(webDashboard)&&/newNonMutual/.test(webDashboard)&&/MATCHAL_SAVE_QUEUE/.test(webDashboard),{});
check('Companion v24 ZIP 생성',fs.existsSync(path.join(root,'dist','downloads','matchal-companion-v24.zip')),{});

const previous={
  id:'before',profileUsername:'sample.owner',createdAt:'2026-07-10T10:00:00.000Z',complete:true,
  followers:['alpha','mutual.user','lost.but.followed','follower.only.old'],
  following:['alpha','mutual.user','lost.but.followed','old.nonmutual'],
  mutual:['alpha','mutual.user','lost.but.followed'],nonMutual:['old.nonmutual']
};
const current={
  id:'after',profileUsername:'sample.owner',createdAt:'2026-07-18T10:00:00.000Z',lastScanAt:'2026-07-18T10:00:00.000Z',status:'completed',complete:true,
  followers:['alpha','mutual.user','new.follower','new.mutual'],
  following:['alpha','mutual.user','lost.but.followed','new.nonmutual','new.mutual','new.following'],
  mutual:['alpha','mutual.user','new.mutual'],nonMutual:['lost.but.followed','new.nonmutual','new.following']
};

const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{width:1440,height:1000,label:'desktop'},{width:390,height:844,label:'mobile'}]){
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    page.on('console',message=>{if(message.type()==='error'&&!/ERR_FAILED|Failed to load resource/i.test(message.text())) errors.push(message.text());});
    try{
      const response=await page.goto(`${baseURL}/`,{waitUntil:'networkidle',timeout:45000});
      await page.waitForSelector('#relationshipDashboardV24',{state:'visible',timeout:15000});
      await page.evaluate(({previous,current})=>{
        window.__dashboardQueue=null;
        window.addEventListener('message',event=>{if(event.data?.source==='MATCHAL_WEB'&&event.data?.type==='MATCHAL_SAVE_QUEUE') window.__dashboardQueue=event.data.payload;});
        window.postMessage({source:'MATCHAL_EXTENSION',type:'MATCHAL_READY',payload:{version:'24.0.0'}},location.origin);
        window.postMessage({source:'MATCHAL_EXTENSION',type:'MATCHAL_RELATIONSHIP_DASHBOARD',payload:{current,history:[current,previous]}},location.origin);
      },{previous,current});
      await page.waitForFunction(()=>document.querySelector('[data-v24-metric="followers"] strong')?.textContent.trim()==='4');
      const metrics=await page.evaluate(()=>({
        title:document.title,
        section:Boolean(document.querySelector('#relationshipDashboardV24')),
        summary:[...document.querySelectorAll('#relationshipDashboardV24 .dashboardSummaryV24 article strong')].map(node=>node.textContent.trim()),
        changes:[...document.querySelectorAll('#relationshipDashboardV24 [data-v24-change-count]')].map(node=>node.textContent.trim()),
        rows:document.querySelectorAll('#relationshipDashboardV24 .dashboardRowV24').length,
        connected:document.querySelector('#relationshipDashboardV24 .dashboardConnectionV24')?.dataset.v24Connected,
        overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2
      }));
      check(`${viewport.label} 페이지와 대시보드 렌더링`,response?.status()===200&&metrics.title.includes('맞팔체커')&&metrics.section,metrics);
      check(`${viewport.label} 관계 요약`,metrics.summary.join(',')==='4,6,3,3,1',metrics);
      check(`${viewport.label} 변화 계산`,metrics.changes.join(',')==='1,2,3,1,3,1'&&metrics.rows===1,metrics);
      check(`${viewport.label} 확장 연결`,metrics.connected==='true',metrics);
      check(`${viewport.label} 가로 넘침 없음`,!metrics.overflow,metrics);

      await page.locator('#relationshipDashboardV24 [data-v24-confirm]').check();
      await page.locator('#relationshipDashboardV24 [data-v24-queue]').click();
      await page.waitForFunction(()=>window.__dashboardQueue?.items?.length===1);
      const queue=await page.evaluate(()=>window.__dashboardQueue);
      check(`${viewport.label} 언팔 변화 큐`,queue.sourceType==='scan_history_lost_followers'&&queue.items[0]?.username==='lost.but.followed',queue);

      await page.locator('#relationshipDashboardV24 [data-v24-view="newFollowers"]').click();
      await page.waitForFunction(()=>document.querySelector('#relationshipDashboardV24 [data-v24-list-title]')?.textContent.includes('새 팔로워'));
      check(`${viewport.label} 새 팔로워 전환`,await page.locator('#relationshipDashboardV24 .dashboardRowV24').count()===2,{});
      check(`${viewport.label} 정보용 목록 실행 차단`,await page.locator('#relationshipDashboardV24 [data-v24-queue]').isDisabled(),{});

      const axe=await new AxeBuilder({page}).include('#relationshipDashboardV24').analyze();
      const serious=axe.violations.filter(item=>['critical','serious'].includes(item.impact));
      check(`${viewport.label} 대시보드 접근성`,serious.length===0,{violations:serious.map(item=>item.id)});
      check(`${viewport.label} 실행 오류 없음`,errors.length===0,{errors});
      await page.screenshot({path:path.join(auditDir,`relationship-dashboard-v24-${viewport.label}.png`),fullPage:true});
    }catch(error){
      check(`${viewport.label} 대시보드 검사 실행`,false,{error:error?.message||String(error),stack:error?.stack||''});
      await page.screenshot({path:path.join(auditDir,`relationship-dashboard-v24-${viewport.label}-error.png`),fullPage:true}).catch(()=>{});
    }finally{
      await context.close();
    }
  }
}finally{
  await browser.close();
}

const report={version:'24.0',checks,failures};
fs.writeFileSync(path.join(auditDir,'relationship-dashboard-v24-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(failures.length) process.exit(1);