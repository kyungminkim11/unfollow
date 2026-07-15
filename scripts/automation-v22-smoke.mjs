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
const instagramScript=fs.readFileSync(path.join(root,'extension','instagram-content.js'),'utf8');
const panelScript=fs.readFileSync(path.join(root,'extension','sidepanel.js'),'utf8');
const bridgeScript=fs.readFileSync(path.join(root,'extension','content-bridge.js'),'utf8');
const parserScript=fs.readFileSync(path.join(root,'assets','automation-parser-v22.js'),'utf8');

check('Manifest V3',manifest.manifest_version===3,{manifestVersion:manifest.manifest_version});
check('필요한 최소 권한',JSON.stringify(manifest.permissions)===JSON.stringify(['storage','tabs','sidePanel']),{permissions:manifest.permissions});
check('호스트 권한 제한',manifest.host_permissions?.length===2&&manifest.host_permissions.includes('https://www.instagram.com/*')&&manifest.host_permissions.includes('https://unfollow.lavalabs.co.kr/*'),{hostPermissions:manifest.host_permissions});
check('쿠키·비공개 API 미사용',!/(chrome\.cookies|document\.cookie|graphql|\/api\/v1\/|fetch\s*\()/i.test(instagramScript),{});
check('정확한 버튼 텍스트 기반 처리',/FOLLOWING_LABELS/.test(instagramScript)&&/UNFOLLOW_LABELS/.test(instagramScript)&&/confirmation_missing/.test(instagramScript),{});
check('챌린지·로그인 안전 중지',/challenge/.test(instagramScript)&&/login_required/.test(instagramScript),{});
check('배치 상한과 연속 오류 중지',/max="30"/.test(fs.readFileSync(path.join(root,'extension','sidepanel.html'),'utf8'))&&/consecutiveErrors >= 2/.test(panelScript),{});
check('웹-확장 메시지 브리지',/MATCHAL_SAVE_QUEUE/.test(bridgeScript)&&/MATCHAL_QUEUE_SAVED/.test(bridgeScript),{});
check('A-B 교집합 계산',/lostFollowerTargets: lostFollowers\.filter\(username => state\.current\.following\.has\(username\)\)/.test(parserScript),{});
check('확장 ZIP 생성',fs.existsSync(path.join(root,'dist','downloads','matchal-companion-v22.zip')),{});

let browser;
try{
  browser=await chromium.launch({headless:true});
  for(const viewport of [{width:1280,height:900,label:'desktop'},{width:390,height:844,label:'mobile'}]){
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    page.on('console',message=>{if(message.type()==='error'&&!/ERR_FAILED|Failed to load resource/i.test(message.text())) errors.push(message.text());});
    try{
      const response=await page.goto(`${baseURL}/`,{waitUntil:'networkidle',timeout:45000});
      await page.waitForSelector('#automationV22',{state:'visible',timeout:15000});
      await page.evaluate(()=>{
        window.__MATCHAL_AUTOMATION__={getCurrent:()=>({loaded:true,sourceName:'latest.zip',nonMutual:['alpha.user','beta_user']})};
        window.MatchalComparisonV22={getCandidates:()=>({ready:true,sourceName:'old.zip → latest.zip',lostFollowerTargets:['lost.one'],currentNonMutual:['alpha.user','beta_user']})};
        window.__capturedQueue=null;
        window.addEventListener('message',event=>{if(event.data?.source==='MATCHAL_WEB'&&event.data?.type==='MATCHAL_SAVE_QUEUE') window.__capturedQueue=event.data.payload;});
        window.dispatchEvent(new CustomEvent('matchal:analysis-ready'));
        window.dispatchEvent(new CustomEvent('matchal:comparison-ready'));
        window.postMessage({source:'MATCHAL_EXTENSION',type:'MATCHAL_READY',payload:{version:'22.0.0'}},location.origin);
      });
      await page.waitForFunction(()=>document.querySelector('[data-source-count="current_non_mutual"]')?.textContent.trim()==='2',{timeout:10000});
      const metrics=await page.evaluate(()=>({
        section:Boolean(document.querySelector('#automationV22')?.getBoundingClientRect().height),
        sources:document.querySelectorAll('.automationSourceV22').length,
        rows:document.querySelectorAll('.automationRowV22').length,
        connected:document.body.classList.contains('matchal-extension-connected'),
        disabled:document.querySelector('[data-send-queue]')?.disabled,
        overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2
      }));
      check(`${viewport.label} 자동화 UI`,response?.status()===200&&metrics.section&&metrics.sources===2&&metrics.rows===2,metrics);
      check(`${viewport.label} 확장 연결 상태`,metrics.connected,metrics);
      check(`${viewport.label} 확인 전 실행 차단`,metrics.disabled,metrics);
      check(`${viewport.label} 가로 넘침 없음`,!metrics.overflow,metrics);

      await page.locator('[data-confirm]').check();
      await page.locator('[data-send-queue]').click();
      await page.waitForFunction(()=>window.__capturedQueue?.items?.length===2,{timeout:10000});
      const payload=await page.evaluate(()=>window.__capturedQueue);
      check(`${viewport.label} 큐 페이로드`,payload.sourceType==='current_non_mutual'&&payload.items.every(item=>/^[a-z0-9._]{1,30}$/.test(item.username)),payload);

      const axe=await new AxeBuilder({page}).include('#automationV22').analyze();
      const serious=axe.violations.filter(item=>['critical','serious'].includes(item.impact));
      check(`${viewport.label} 자동화 UI 접근성`,serious.length===0,{violations:serious.map(item=>({id:item.id,nodes:item.nodes.slice(0,5).map(node=>({target:node.target,failureSummary:node.failureSummary}))}))});
      check(`${viewport.label} 실행 오류 없음`,errors.length===0,{errors});
      await page.screenshot({path:path.join(auditDir,`automation-v22-${viewport.label}.png`),fullPage:true});
    }catch(error){
      check(`${viewport.label} 브라우저 검사 실행`,false,{error:error?.message||String(error),stack:error?.stack||''});
      await page.screenshot({path:path.join(auditDir,`automation-v22-${viewport.label}-error.png`),fullPage:true}).catch(()=>{});
    }finally{
      await page.close();
    }
  }
}catch(error){
  check('Playwright 실행',false,{error:error?.message||String(error),stack:error?.stack||''});
}finally{
  await browser?.close().catch(()=>{});
}

const report={version:'22.0',checks,failures};
fs.writeFileSync(path.join(auditDir,'automation-v22-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(failures.length) process.exit(1);