import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const baseURL=(process.env.SMOKE_URL||'http://127.0.0.1:4173/').replace(/\/$/,'');
const supabaseURL='https://jnciddblcndmthmmvqrz.supabase.co';
const adminAPI=`${supabaseURL}/functions/v1/unfollow-newsletter-admin`;
const campaignAPI=`${supabaseURL}/functions/v1/unfollow-newsletter-campaigns`;
const newsletterAPI=`${supabaseURL}/functions/v1/unfollow-newsletter`;
const publishableKey='sb_publishable_UUzSE7O9wqI0WN9cKG9OAQ_VleRkL4I';
const auditDir=path.join(process.cwd(),'audit');
fs.mkdirSync(auditDir,{recursive:true});
const checks=[];const failures=[];
function check(name,pass,details={}){const item={name,pass:Boolean(pass),details};checks.push(item);if(!item.pass) failures.push(item);}
async function axe(page,name){const result=await new AxeBuilder({page}).analyze();const serious=result.violations.filter(item=>['critical','serious'].includes(item.impact));check(`${name} 접근성`,serious.length===0,{violations:serious.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.length}))});}
function adminResponse(action){
  if(action==='stats') return {ok:true,admin:{email:'lavalabs.ceo@gmail.com',role:'owner'},stats:{active:12,last7Days:3,last30Days:8,interestCount:5,featureCounts:{history:5,reports:3},priceCounts:{'3000_5900':4}},recent:[]};
  if(action==='list_subscribers') return {ok:true,admin:{email:'lavalabs.ceo@gmail.com',role:'owner'},count:0,rows:[]};
  if(action==='list_interest') return {ok:true,admin:{email:'lavalabs.ceo@gmail.com',role:'owner'},count:0,rows:[]};
  if(action==='export_subscribers') return {ok:true,rows:[]};
  return {ok:true,message:'완료'};
}
const sample={id:'11111111-1111-4111-8111-111111111111',internal_name:'7월 기능 업데이트',subject:'맞팔체커 새 기능을 소개합니다',preview_text:'관계 비교와 관리 기능이 더 편해졌습니다.',body_text:'안녕하세요.\n\n맞팔체커의 새로운 기능을 안내드립니다.',cta_label:'서비스 열기',cta_url:'https://unfollow.lavalabs.co.kr/',segment:'all_active',status:'draft',scheduled_at:null,recipient_count:0,sent_count:0,failed_count:0,updated_at:'2026-07-10T12:00:00Z'};
function campaignResponse(action,body){
  if(action==='list_campaigns') return {ok:true,admin:{email:'lavalabs.ceo@gmail.com',role:'owner'},provider:{ready:false,from:null},count:1,page:0,pageSize:20,rows:[sample]};
  if(action==='estimate_recipients') return {ok:true,count:12};
  if(action==='save_campaign') return {ok:true,message:'캠페인 초안을 저장했습니다.',row:{...sample,internal_name:body.internalName||sample.internal_name,subject:body.subject||sample.subject,body_text:body.bodyText||sample.body_text}};
  if(action==='duplicate_campaign') return {ok:true,message:'캠페인을 새 초안으로 복제했습니다.',row:{...sample,id:'22222222-2222-4222-8222-222222222222',internal_name:'7월 기능 업데이트 복사본'}};
  if(action==='delete_campaign') return {ok:true,message:'캠페인 초안을 삭제했습니다.'};
  return {ok:true,message:'완료'};
}
async function campaignPage(browser,width,label){
  const context=await browser.newContext({viewport:{width,height:width<600?844:960}});
  await context.addInitScript(({key})=>sessionStorage.setItem(key,JSON.stringify({accessToken:'mock-access-token',refreshToken:'mock-refresh-token',expiresAt:Math.floor(Date.now()/1000)+3600})),{key:'unfollow_admin_session_v17'});
  await context.route(adminAPI,async route=>{let body={};try{body=route.request().postDataJSON();}catch{}await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(adminResponse(String(body.action||'stats')))});});
  await context.route(campaignAPI,async route=>{let body={};try{body=route.request().postDataJSON();}catch{}await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(campaignResponse(String(body.action||'list_campaigns'),body))});});
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
  const response=await page.goto(`${baseURL}/admin/newsletter/`,{waitUntil:'networkidle',timeout:30000});
  await page.waitForSelector('#adminDashboard:not([hidden])',{timeout:15000});
  await page.locator('#tabCampaigns').click();
  await page.waitForSelector('#panelCampaigns:not([hidden])');
  await page.waitForFunction(()=>document.querySelectorAll('#campaignRowsV18 tr').length===1&&document.querySelector('#campaignEstimateV18')?.textContent.includes('12'));
  const metrics=await page.evaluate(()=>({
    title:document.querySelector('#campaignRowsV18')?.textContent||'',
    provider:document.querySelector('#campaignProviderBadge')?.textContent||'',
    fields:document.querySelectorAll('#campaignFormV18 input,#campaignFormV18 select,#campaignFormV18 textarea').length,
    overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2,
  }));
  check(`${label} 캠페인 화면`,response?.status()===200&&metrics.title.includes('7월 기능 업데이트')&&metrics.provider.includes('연결 필요')&&metrics.fields>=9,metrics);
  check(`${label} 가로 넘침 없음`,!metrics.overflow,metrics);
  await page.locator('#campaignSubjectV18').fill('테스트 뉴스레터 제목');
  await page.locator('#campaignBodyTextV18').fill('첫 번째 문단입니다.\n\n두 번째 문단입니다.');
  await page.waitForFunction(()=>document.querySelector('#campaignPreviewTitleV18')?.textContent==='테스트 뉴스레터 제목'&&document.querySelectorAll('#campaignPreviewBodyV18 p').length===2);
  check(`${label} 실시간 미리보기`,true,{});
  if(width>600){
    await page.locator('#campaignInternalNameV18').fill('CI 캠페인');
    await page.locator('#campaignSaveV18').click();
    await page.waitForFunction(()=>document.querySelector('#campaignFormStatusV18')?.dataset.state==='success');
    check('캠페인 초안 저장 UI',(await page.locator('#campaignFormStatusV18').innerText()).includes('저장'),{});
  }
  await axe(page,label);
  check(`${label} 실행 오류 없음`,errors.length===0,{errors});
  await page.screenshot({path:path.join(auditDir,`campaign-v18-${label}.png`),fullPage:true});
  await context.close();
}
async function securityChecks(){
  const unauthorized=await fetch(campaignAPI,{method:'POST',headers:{apikey:publishableKey,Origin:'http://127.0.0.1:4173','Content-Type':'application/json'},body:JSON.stringify({action:'list_campaigns'})});
  check('캠페인 API 비로그인 차단',[401,403].includes(unauthorized.status),{status:unauthorized.status});
  const invalidToken=await fetch(newsletterAPI,{method:'POST',headers:{Origin:'http://127.0.0.1:4173','Content-Type':'application/json'},body:JSON.stringify({action:'token_unsubscribe',token:'not-a-token'})});
  check('잘못된 수신 해지 토큰 차단',invalidToken.status===400,{status:invalidToken.status});
}
const browser=await chromium.launch({headless:true});
try{await campaignPage(browser,1280,'campaign-desktop');await campaignPage(browser,390,'campaign-mobile');await securityChecks();}finally{await browser.close();}
const report={version:'18.0',checks,failures};fs.writeFileSync(path.join(auditDir,'campaign-v18-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failures.length) process.exit(1);