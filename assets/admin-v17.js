(()=>{
  const SUPABASE_URL='https://jnciddblcndmthmmvqrz.supabase.co';
  const PUBLISHABLE_KEY='sb_publishable_UUzSE7O9wqI0WN9cKG9OAQ_VleRkL4I';
  const ADMIN_EMAIL='lavalabs.ceo@gmail.com';
  const SESSION_KEY='unfollow_admin_session_v17';
  const REDIRECT_URL=`${location.origin}/admin/newsletter/`;
  const API_URL=`${SUPABASE_URL}/functions/v1/unfollow-newsletter-admin`;
  const PAGE_SIZE=25;
  const FEATURE_LABELS={history:'분석 이력',multi_account:'여러 계정',advanced_compare:'고급 비교',reports:'PDF·월간 리포트',cloud_sync:'기기 동기화',team:'팀 관리',alerts:'변화 알림',ai_insights:'AI 요약'};
  const PRICE_LABELS={free_only:'무료만 사용',under_3000:'월 3천원 미만',3000_5900:'월 3,000~5,900원',6000_9900:'월 6,000~9,900원',10000_plus:'월 1만원 이상',unsure:'아직 모르겠음'};
  const ACCOUNT_LABELS={'1':'1개','2_3':'2~3개','4_10':'4~10개','11_plus':'11개 이상'};

  const $=selector=>document.querySelector(selector);
  const state={session:null,admin:null,subscriberPage:0,subscriberSearch:'',subscriberCount:0,interestPage:0,interestSearch:'',interestCount:0,activeTab:'subscribers'};

  function setStatus(element,message,type=''){
    if(!element) return;
    element.textContent=message||'';
    if(type) element.dataset.state=type; else delete element.dataset.state;
  }
  function readSession(){
    try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');}catch{return null;}
  }
  function saveSession(session){
    state.session=session;
    if(session) sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  }
  function parseAuthRedirect(){
    const params=new URLSearchParams(location.hash.replace(/^#/,''));
    const accessToken=params.get('access_token');
    if(accessToken){
      const expiresIn=Number(params.get('expires_in')||3600);
      saveSession({
        accessToken,
        refreshToken:params.get('refresh_token')||'',
        expiresAt:Number(params.get('expires_at')||Math.floor(Date.now()/1000)+expiresIn)
      });
      history.replaceState(null,'',location.pathname+location.search);
      return true;
    }
    const error=params.get('error_description')||params.get('error');
    if(error){
      setStatus($('#adminLoginStatus'),'로그인 링크가 만료됐거나 사용할 수 없습니다. 새 링크를 받아 주세요.','error');
      history.replaceState(null,'',location.pathname+location.search);
    }
    return false;
  }
  async function refreshSession(){
    const session=state.session||readSession();
    if(!session?.refreshToken) throw new Error('관리자 로그인 세션이 없습니다.');
    const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{
      method:'POST',
      headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:session.refreshToken})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.access_token) throw new Error('로그인 세션이 만료되었습니다.');
    const next={accessToken:data.access_token,refreshToken:data.refresh_token||session.refreshToken,expiresAt:Number(data.expires_at||Math.floor(Date.now()/1000)+Number(data.expires_in||3600))};
    saveSession(next);
    return next;
  }
  async function validSession(){
    let session=state.session||readSession();
    if(!session?.accessToken) return null;
    state.session=session;
    if(Number(session.expiresAt||0)<Math.floor(Date.now()/1000)+60){
      try{session=await refreshSession();}catch{saveSession(null);return null;}
    }
    return session;
  }
  async function callAdmin(payload){
    const session=await validSession();
    if(!session) throw Object.assign(new Error('관리자 로그인이 필요합니다.'),{status:401});
    const response=await fetch(API_URL,{
      method:'POST',
      headers:{apikey:PUBLISHABLE_KEY,Authorization:`Bearer ${session.accessToken}`,'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    const data=await response.json().catch(()=>({ok:false,message:'응답을 읽지 못했습니다.'}));
    if(response.status===401){saveSession(null);showLogin();}
    if(!response.ok||data.ok===false) throw Object.assign(new Error(data.message||'관리자 요청을 처리하지 못했습니다.'),{status:response.status});
    return data;
  }
  async function sendMagicLink(){
    const button=$('#adminLoginButton');
    button.disabled=true;
    setStatus($('#adminLoginStatus'),'관리자 이메일로 로그인 링크를 보내는 중입니다.');
    try{
      const response=await fetch(`${SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(REDIRECT_URL)}`,{
        method:'POST',
        headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({email:ADMIN_EMAIL,create_user:true})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.msg||data.message||'로그인 링크를 보내지 못했습니다.');
      setStatus($('#adminLoginStatus'),'로그인 링크를 보냈습니다. 이메일에서 링크를 열어 주세요.','success');
    }catch(error){
      setStatus($('#adminLoginStatus'),error.message||'로그인 링크를 보내지 못했습니다.','error');
    }finally{button.disabled=false;}
  }
  function showLogin(){
    $('#adminLogin').hidden=false;
    $('#adminDashboard').hidden=true;
    $('#adminLogout').hidden=true;
  }
  function showDashboard(){
    $('#adminLogin').hidden=true;
    $('#adminDashboard').hidden=false;
    $('#adminLogout').hidden=false;
  }
  function formatDate(value){
    if(!value) return '—';
    const date=new Date(value);
    if(Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(date);
  }
  function createCell(text,className=''){
    const td=document.createElement('td');
    td.textContent=text;
    if(className) td.className=className;
    return td;
  }
  function emptyRow(tbody,colspan,message){
    tbody.replaceChildren();
    const tr=document.createElement('tr');
    const td=createCell(message,'adminEmpty');
    td.colSpan=colspan;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
  function canManage(){return ['owner','editor'].includes(state.admin?.role);}
  function renderSubscribers(rows){
    const tbody=$('#subscriberRows');
    tbody.replaceChildren();
    if(!rows.length){emptyRow(tbody,5,'조건에 맞는 구독자가 없습니다.');return;}
    rows.forEach(row=>{
      const tr=document.createElement('tr');
      tr.append(createCell(row.email||'—'),createCell(row.source||'—'),createCell(formatDate(row.subscribed_at)),createCell(row.status||'—'));
      const action=document.createElement('td');
      if(canManage()){
        const button=document.createElement('button');
        button.type='button';button.className='adminDanger';button.textContent='삭제';
        button.addEventListener('click',()=>deleteSubscriber(row));
        action.appendChild(button);
      }else action.textContent='보기 전용';
      tr.appendChild(action);tbody.appendChild(tr);
    });
  }
  function renderInterests(rows){
    const tbody=$('#interestRows');
    tbody.replaceChildren();
    if(!rows.length){emptyRow(tbody,7,'등록된 프리미엄 의견이 없습니다.');return;}
    rows.forEach(row=>{
      const tr=document.createElement('tr');
      tr.appendChild(createCell(row.email||'—'));
      const features=document.createElement('td');
      const chips=document.createElement('div');chips.className='adminChipList';
      (row.feature_codes||[]).forEach(code=>{const chip=document.createElement('span');chip.className='adminChip';chip.textContent=FEATURE_LABELS[code]||code;chips.appendChild(chip);});
      features.appendChild(chips);tr.appendChild(features);
      tr.append(createCell(PRICE_LABELS[row.price_preference]||row.price_preference||'—'),createCell(ACCOUNT_LABELS[row.account_count_range]||row.account_count_range||'—'),createCell(row.comment||'—','adminComment'),createCell(formatDate(row.updated_at)));
      const action=document.createElement('td');
      if(canManage()){
        const button=document.createElement('button');button.type='button';button.className='adminDanger';button.textContent='삭제';button.addEventListener('click',()=>deleteInterest(row));action.appendChild(button);
      }else action.textContent='보기 전용';
      tr.appendChild(action);tbody.appendChild(tr);
    });
  }
  function renderBars(container,counts,labels){
    container.replaceChildren();
    const entries=Object.entries(counts||{}).sort((a,b)=>b[1]-a[1]);
    if(!entries.length){const p=document.createElement('p');p.className='adminStatus';p.textContent='아직 집계할 의견이 없습니다.';container.appendChild(p);return;}
    const max=Math.max(...entries.map(([,count])=>count),1);
    entries.forEach(([key,count])=>{
      const row=document.createElement('div');row.className='adminBarRow';
      const label=document.createElement('span');label.textContent=labels[key]||key;
      const track=document.createElement('span');track.className='adminBarTrack';const bar=document.createElement('i');bar.style.width=`${Math.max(4,Math.round(count/max*100))}%`;track.appendChild(bar);
      const value=document.createElement('strong');value.textContent=String(count);
      row.append(label,track,value);container.appendChild(row);
    });
  }
  async function loadStats(){
    const data=await callAdmin({action:'stats'});
    state.admin=data.admin;
    $('#adminIdentity').textContent=`${data.admin.email} · ${data.admin.role}`;
    $('#statActive').textContent=Number(data.stats.active||0).toLocaleString('ko-KR');
    $('#statWeek').textContent=Number(data.stats.last7Days||0).toLocaleString('ko-KR');
    $('#statMonth').textContent=Number(data.stats.last30Days||0).toLocaleString('ko-KR');
    $('#statInterest').textContent=Number(data.stats.interestCount||0).toLocaleString('ko-KR');
    renderBars($('#featureBars'),data.stats.featureCounts,FEATURE_LABELS);
    renderBars($('#priceBars'),data.stats.priceCounts,PRICE_LABELS);
  }
  async function loadSubscribers(){
    emptyRow($('#subscriberRows'),5,'구독자 정보를 불러오는 중입니다.');
    const data=await callAdmin({action:'list_subscribers',page:state.subscriberPage,pageSize:PAGE_SIZE,search:state.subscriberSearch});
    state.subscriberCount=data.count||0;
    renderSubscribers(data.rows||[]);
    $('#subscriberCount').textContent=`총 ${state.subscriberCount.toLocaleString('ko-KR')}명 · ${state.subscriberPage+1}페이지`;
    $('#subscriberPrev').disabled=state.subscriberPage===0;
    $('#subscriberNext').disabled=(state.subscriberPage+1)*PAGE_SIZE>=state.subscriberCount;
  }
  async function loadInterests(){
    emptyRow($('#interestRows'),7,'프리미엄 의견을 불러오는 중입니다.');
    const data=await callAdmin({action:'list_interest',page:state.interestPage,pageSize:PAGE_SIZE,search:state.interestSearch});
    state.interestCount=data.count||0;
    renderInterests(data.rows||[]);
    $('#interestCount').textContent=`총 ${state.interestCount.toLocaleString('ko-KR')}건 · ${state.interestPage+1}페이지`;
    $('#interestPrev').disabled=state.interestPage===0;
    $('#interestNext').disabled=(state.interestPage+1)*PAGE_SIZE>=state.interestCount;
  }
  async function refreshAll(){
    setStatus($('#adminStatus'),'최신 데이터를 불러오는 중입니다.');
    try{
      await loadStats();
      if(state.activeTab==='subscribers') await loadSubscribers(); else await loadInterests();
      setStatus($('#adminStatus'),'최신 상태로 갱신했습니다.','success');
    }catch(error){setStatus($('#adminStatus'),error.message||'데이터를 불러오지 못했습니다.','error');throw error;}
  }
  async function deleteSubscriber(row){
    if(!confirm(`${row.email} 구독 정보와 동의 기록을 삭제할까요?`)) return;
    setStatus($('#adminStatus'),'구독 정보를 삭제하는 중입니다.');
    try{const data=await callAdmin({action:'delete_subscriber',id:row.id});setStatus($('#adminStatus'),data.message,'success');await Promise.all([loadStats(),loadSubscribers()]);}
    catch(error){setStatus($('#adminStatus'),error.message,'error');}
  }
  async function deleteInterest(row){
    if(!confirm(`${row.email}의 프리미엄 의견을 삭제할까요?`)) return;
    setStatus($('#adminStatus'),'의견을 삭제하는 중입니다.');
    try{const data=await callAdmin({action:'delete_interest',id:row.id});setStatus($('#adminStatus'),data.message,'success');await Promise.all([loadStats(),loadInterests()]);}
    catch(error){setStatus($('#adminStatus'),error.message,'error');}
  }
  function csvValue(value){return `"${String(value??'').replaceAll('"','""')}"`;}
  async function exportSubscribers(){
    const button=$('#adminExport');button.disabled=true;setStatus($('#adminStatus'),'CSV를 만드는 중입니다.');
    try{
      const data=await callAdmin({action:'export_subscribers'});
      const lines=[['email','status','source','subscribed_at'].map(csvValue).join(',')];
      (data.rows||[]).forEach(row=>lines.push([row.email,row.status,row.source,row.subscribed_at].map(csvValue).join(',')));
      const blob=new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`matchal-newsletter-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      setStatus($('#adminStatus'),`${(data.rows||[]).length.toLocaleString('ko-KR')}명의 구독자 CSV를 저장했습니다.`,'success');
    }catch(error){setStatus($('#adminStatus'),error.message,'error');}
    finally{button.disabled=false;}
  }
  function selectTab(tab){
    state.activeTab=tab;
    const subscribers=tab==='subscribers';
    $('#tabSubscribers').setAttribute('aria-selected',String(subscribers));
    $('#tabInterest').setAttribute('aria-selected',String(!subscribers));
    $('#panelSubscribers').hidden=!subscribers;
    $('#panelInterest').hidden=subscribers;
    (subscribers?loadSubscribers():loadInterests()).catch(error=>setStatus($('#adminStatus'),error.message,'error'));
  }
  function bind(){
    $('#adminLoginButton').addEventListener('click',sendMagicLink);
    $('#adminLogout').addEventListener('click',()=>{saveSession(null);showLogin();setStatus($('#adminLoginStatus'),'로그아웃했습니다.','success');});
    $('#adminRefresh').addEventListener('click',()=>refreshAll().catch(()=>{}));
    $('#adminExport').addEventListener('click',exportSubscribers);
    $('#tabSubscribers').addEventListener('click',()=>selectTab('subscribers'));
    $('#tabInterest').addEventListener('click',()=>selectTab('interest'));
    $('#subscriberSearchForm').addEventListener('submit',event=>{event.preventDefault();state.subscriberSearch=$('#subscriberSearch').value.trim();state.subscriberPage=0;loadSubscribers().catch(error=>setStatus($('#adminStatus'),error.message,'error'));});
    $('#subscriberClear').addEventListener('click',()=>{$('#subscriberSearch').value='';state.subscriberSearch='';state.subscriberPage=0;loadSubscribers().catch(()=>{});});
    $('#interestSearchForm').addEventListener('submit',event=>{event.preventDefault();state.interestSearch=$('#interestSearch').value.trim();state.interestPage=0;loadInterests().catch(error=>setStatus($('#adminStatus'),error.message,'error'));});
    $('#interestClear').addEventListener('click',()=>{$('#interestSearch').value='';state.interestSearch='';state.interestPage=0;loadInterests().catch(()=>{});});
    $('#subscriberPrev').addEventListener('click',()=>{if(state.subscriberPage>0){state.subscriberPage--;loadSubscribers().catch(()=>{});}});
    $('#subscriberNext').addEventListener('click',()=>{if((state.subscriberPage+1)*PAGE_SIZE<state.subscriberCount){state.subscriberPage++;loadSubscribers().catch(()=>{});}});
    $('#interestPrev').addEventListener('click',()=>{if(state.interestPage>0){state.interestPage--;loadInterests().catch(()=>{});}});
    $('#interestNext').addEventListener('click',()=>{if((state.interestPage+1)*PAGE_SIZE<state.interestCount){state.interestPage++;loadInterests().catch(()=>{});}});
  }
  async function start(){
    bind();parseAuthRedirect();state.session=readSession();
    if(await validSession()){
      showDashboard();
      try{await refreshAll();}catch(error){if(error.status===401) showLogin();}
    }else showLogin();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
