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
const scanner=fs.readFileSync(path.join(root,'extension','instagram-scan.js'),'utf8');
const sidepanel=fs.readFileSync(path.join(root,'extension','sidepanel.html'),'utf8');
const sidepanelScript=fs.readFileSync(path.join(root,'extension','sidepanel.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'extension','content-bridge.js'),'utf8');
const webScript=fs.readFileSync(path.join(root,'assets','relationship-scan-v23.js'),'utf8');

check('Companion v23 manifest',manifest.manifest_version===3&&manifest.version==='23.0.0',{version:manifest.version});
check('스캐너 콘텐츠 스크립트 등록',manifest.content_scripts?.some(item=>item.matches?.includes('https://www.instagram.com/*')&&item.js?.includes('instagram-scan.js')),{contentScripts:manifest.content_scripts});
check('권한 증가 없음',JSON.stringify(manifest.permissions)===JSON.stringify(['storage','tabs','sidePanel']),{permissions:manifest.permissions});
check('호스트 권한 제한',manifest.host_permissions?.length===2&&manifest.host_permissions.includes('https://www.instagram.com/*')&&manifest.host_permissions.includes('https://unfollow.lavalabs.co.kr/*'),{hostPermissions:manifest.host_permissions});
check('비공개 API·쿠키 미사용',!/(chrome\.cookies|document\.cookie|graphql|\/api\/v1\/|fetch\s*\()/i.test(scanner),{});
check('팔로워·팔로잉 DOM 스크롤 수집',/MATCHAL_SCAN_LIST/.test(scanner)&&/findScrollContainer/.test(scanner)&&/collectDialogUsernames/.test(scanner)&&/scrollTop/.test(scanner),{});
check('내 프로필 확인과 안전 중지',/ownProfileConfirmed/.test(scanner)&&/login_required/.test(scanner)&&/challenge/.test(scanner)&&/MATCHAL_SCAN_STOP/.test(scanner),{});
check('사이드패널 3개 명단 UI',/scanFollowersCount/.test(sidepanel)&&/scanFollowingCount/.test(sidepanel)&&/scanNonMutualCount/.test(sidepanel),{});
check('비맞팔 계산과 큐 연결',/following\.filter\(usernameValue => !followerSet\.has\(usernameValue\)\)/.test(sidepanelScript)&&/instagram_scan_non_mutual/.test(sidepanelScript),{});
check('웹-확장 스캔 상태 브리지',/MATCHAL_GET_RELATIONSHIP_SCAN/.test(bridge)&&/MATCHAL_RELATIONSHIP_SCAN/.test(bridge),{});
check('웹 스캔 결과 UI',/relationshipScanV23/.test(webScript)&&/팔로워 명단/.test(webScript)&&/맞팔 아닌 명단/.test(webScript),{});
check('v22 제어 속성과 충돌 없음',!/data-confirm|data-list-title|data-list-description|data-list(?:[\s>])|data-select-all/.test(webScript),{});
check('Companion v23 ZIP 생성',fs.existsSync(path.join(root,'dist','downloads','matchal-companion-v23.zip')),{});

const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{width:1280,height:900,label:'desktop'},{width:390,height:844,label:'mobile'}]){
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    page.on('console',message=>{if(message.type()==='error'&&!/ERR_FAILED|Failed to load resource/i.test(message.text())) errors.push(message.text());});
    try{
      const response=await page.goto(`${baseURL}/`,{waitUntil:'networkidle',timeout:45000});
      await page.waitForSelector('#relationshipScanV23',{state:'visible',timeout:15000});
      await page.evaluate(()=>{
        window.__scanQueue=null;
        window.addEventListener('message',event=>{if(event.data?.source==='MATCHAL_WEB'&&event.data?.type==='MATCHAL_SAVE_QUEUE') window.__scanQueue=event.data.payload;});
        window.postMessage({source:'MATCHAL_EXTENSION',type:'MATCHAL_READY',payload:{version:'23.0.0'}},location.origin);
        window.postMessage({source:'MATCHAL_EXTENSION',type:'MATCHAL_RELATIONSHIP_SCAN',payload:{state:{profileUsername:'sample.owner',followers:['alpha','mutual.user','gamma'],following:['alpha','mutual.user','not.back','brand.only'],nonMutual:['not.back','brand.only'],complete:true,warnings:[],lastScanAt:new Date().toISOString(),status:'completed'}}},location.origin);
      });
      await page.waitForFunction(()=>document.querySelector('[data-v23-count="nonMutual"]')?.textContent.trim()==='2');
      const metrics=await page.evaluate(()=>({
        section:Boolean(document.querySelector('#relationshipScanV23')),
        counts:[...document.querySelectorAll('#relationshipScanV23 .relationshipCountsV23 strong')].map(node=>node.textContent.trim()),
        rows:document.querySelectorAll('#relationshipScanV23 .relationshipRowV23').length,
        connected:document.querySelector('.relationshipConnectionV23')?.dataset.v23Connected,
        overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2
      }));
      check(`${viewport.label} 웹 스캔 요약`,response?.status()===200&&metrics.section&&metrics.counts.join(',')==='3,4,2'&&metrics.rows===2,metrics);
      check(`${viewport.label} 확장 연결 상태`,metrics.connected==='true',metrics);
      check(`${viewport.label} 가로 넘침 없음`,!metrics.overflow,metrics);

      await page.locator('#relationshipScanV23 [data-v23-confirm]').check();
      await page.locator('#relationshipScanV23 [data-v23-send]').click();
      await page.waitForFunction(()=>window.__scanQueue?.items?.length===2);
      const payload=await page.evaluate(()=>window.__scanQueue);
      check(`${viewport.label} 비맞팔 큐`,payload.sourceType==='instagram_scan_non_mutual'&&payload.items.map(item=>item.username).join(',')==='not.back,brand.only',payload);

      await page.locator('#relationshipScanV23 [data-v23-view="followers"]').click();
      await page.waitForFunction(()=>document.querySelector('#relationshipScanV23 [data-v23-list-title]')?.textContent.includes('팔로워'));
      check(`${viewport.label} 팔로워 명단 전환`,await page.locator('#relationshipScanV23 .relationshipRowV23').count()===3,{});

      const axe=await new AxeBuilder({page}).include('#relationshipScanV23').analyze();
      const serious=axe.violations.filter(item=>['critical','serious'].includes(item.impact));
      check(`${viewport.label} 웹 스캔 접근성`,serious.length===0,{violations:serious.map(item=>item.id)});
      check(`${viewport.label} 실행 오류 없음`,errors.length===0,{errors});
      await page.screenshot({path:path.join(auditDir,`relationship-scan-v23-${viewport.label}.png`),fullPage:true});
    }catch(error){
      check(`${viewport.label} 웹 스캔 검사 실행`,false,{error:error?.message||String(error),stack:error?.stack||''});
      await page.screenshot({path:path.join(auditDir,`relationship-scan-v23-${viewport.label}-error.png`),fullPage:true}).catch(()=>{});
    }finally{
      await page.close();
    }
  }

  const scannerPage=await browser.newPage({viewport:{width:1000,height:800},bypassCSP:true});
  try{
    await scannerPage.goto(`${baseURL}/`,{waitUntil:'networkidle',timeout:45000});
    await scannerPage.evaluate(()=>{
      history.replaceState({},'', '/sample.owner/');
      document.body.innerHTML=`<main><header><a href="/sample.owner/followers/">3 followers</a><a href="/sample.owner/following/">4 following</a><button>Edit profile</button></header></main>`;
      const data={followers:['alpha','mutual.user','gamma'],following:['alpha','mutual.user','not.back','brand.only']};
      for(const kind of ['followers','following']){
        document.querySelector(`a[href="/sample.owner/${kind}/"]`).addEventListener('click',event=>{
          event.preventDefault();
          const dialog=document.createElement('div');
          dialog.setAttribute('role','dialog');
          dialog.style.width='420px';
          dialog.style.minHeight='260px';
          const list=document.createElement('div');
          list.style.height='220px';
          list.style.overflowY='auto';
          for(const username of data[kind]){
            const row=document.createElement('div');row.style.height='60px';
            const link=document.createElement('a');link.href=`/${username}/`;link.textContent=username;row.appendChild(link);list.appendChild(row);
          }
          const close=document.createElement('button');close.textContent='Close';close.addEventListener('click',()=>dialog.remove());
          dialog.append(close,list);document.body.appendChild(dialog);
        });
      }
      window.__scannerListener=null;
      Object.defineProperty(window,'chrome',{configurable:true,value:{runtime:{onMessage:{addListener(listener){window.__scannerListener=listener;}},sendMessage(){return Promise.resolve({ok:true});}}}});
    });
    await scannerPage.addScriptTag({path:path.join(root,'extension','instagram-scan.js')});
    await scannerPage.waitForFunction(()=>typeof window.__scannerListener==='function');
    const scanResult=await scannerPage.evaluate(async()=>{
      const call=message=>new Promise(resolve=>window.__scannerListener(message,{},resolve));
      const detected=await call({type:'MATCHAL_SCAN_DETECT_PROFILE'});
      const followers=await call({type:'MATCHAL_SCAN_LIST',username:'sample.owner',kind:'followers'});
      const following=await call({type:'MATCHAL_SCAN_LIST',username:'sample.owner',kind:'following'});
      return {detected,followers,following};
    });
    check('DOM 스캐너 계정 감지',scanResult.detected?.ok&&scanResult.detected.username==='sample.owner'&&scanResult.detected.confirmed,scanResult.detected);
    check('DOM 스캐너 팔로워 수집',scanResult.followers?.ok&&scanResult.followers.usernames?.length===3,scanResult.followers);
    check('DOM 스캐너 팔로잉 수집',scanResult.following?.ok&&scanResult.following.usernames?.length===4,scanResult.following);
  }catch(error){
    check('DOM 스캐너 fixture 실행',false,{error:error?.message||String(error),stack:error?.stack||''});
  }finally{
    await scannerPage.close();
  }
}finally{
  await browser.close();
}

const report={version:'23.0',checks,failures};
fs.writeFileSync(path.join(auditDir,'relationship-scan-v23-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(failures.length) process.exit(1);