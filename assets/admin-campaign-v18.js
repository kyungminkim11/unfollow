(()=>{
  'use strict';
  const SUPABASE_URL='https://jnciddblcndmthmmvqrz.supabase.co';
  const PUBLISHABLE_KEY='sb_publishable_UUzSE7O9wqI0WN9cKG9OAQ_VleRkL4I';
  const API_URL=`${SUPABASE_URL}/functions/v1/unfollow-newsletter-campaigns`;
  const SESSION_KEY='unfollow_admin_session_v17';
  const PAGE_SIZE=20;
  const SEGMENT_LABELS={all_active:'활성 구독자 전체',recent_30d:'최근 30일 신청자',premium_interest:'프리미엄 의견 참여자'};
  const STATUS_LABELS={draft:'초안',scheduled:'예약 대기',sending:'발송 중',sent:'발송 완료',failed:'실패',cancelled:'취소'};
  const $=selector=>document.querySelector(selector);
  const state={page:0,count:0,rows:[],providerReady:false,started:false,estimateTimer:null};

  function setStatus(message,type=''){
    const target=$('#campaignFormStatusV18');
    if(!target) return;
    target.textContent=message||'';
    if(type) target.dataset.state=type; else delete target.dataset.state;
  }
  function session(){
    try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');}catch{return null;}
  }
  async function call(payload){
    const current=session();
    if(!current?.accessToken) throw new Error('관리자 로그인이 필요합니다.');
    const response=await fetch(API_URL,{method:'POST',headers:{apikey:PUBLISHABLE_KEY,Authorization:`Bearer ${current.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await response.json().catch(()=>({ok:false,message:'응답을 읽지 못했습니다.'}));
    if(!response.ok||data.ok===false) throw Object.assign(new Error(data.message||'캠페인 요청을 처리하지 못했습니다.'),{status:response.status,providerReady:data.providerReady});
    return data;
  }
  function formatDate(value){
    if(!value) return '—';
    const date=new Date(value);
    if(Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short'}).format(date);
  }
  function showCampaignTab(){
    $('#tabCampaigns').setAttribute('aria-selected','true');
    $('#tabSubscribers').setAttribute('aria-selected','false');
    $('#tabInterest').setAttribute('aria-selected','false');
    $('#panelSubscribers').hidden=true;
    $('#panelInterest').hidden=true;
    $('#panelCampaigns').hidden=false;
    loadCampaigns().catch(error=>setStatus(error.message,'error'));
  }
  function hideCampaignTab(){
    $('#tabCampaigns').setAttribute('aria-selected','false');
    $('#panelCampaigns').hidden=true;
  }
  function formPayload(){
    return {
      id:$('#campaignIdV18').value.trim()||undefined,
      internalName:$('#campaignInternalNameV18').value.trim(),
      subject:$('#campaignSubjectV18').value.trim(),
      previewText:$('#campaignPreviewTextV18').value.trim(),
      segment:$('#campaignSegmentV18').value,
      bodyText:$('#campaignBodyTextV18').value.trim(),
      ctaLabel:$('#campaignCtaLabelV18').value.trim(),
      ctaUrl:$('#campaignCtaUrlV18').value.trim(),
    };
  }
  function resetForm(){
    $('#campaignFormV18').reset();
    $('#campaignIdV18').value='';
    $('#campaignEditorTitleV18').textContent='새 뉴스레터';
    $('#campaignDeleteV18').disabled=true;
    setStatus('');
    renderPreview();
    estimateRecipients().catch(()=>{});
  }
  function fillForm(row){
    $('#campaignIdV18').value=row.id||'';
    $('#campaignInternalNameV18').value=row.internal_name||'';
    $('#campaignSubjectV18').value=row.subject||'';
    $('#campaignPreviewTextV18').value=row.preview_text||'';
    $('#campaignSegmentV18').value=row.segment||'all_active';
    $('#campaignBodyTextV18').value=row.body_text||'';
    $('#campaignCtaLabelV18').value=row.cta_label||'';
    $('#campaignCtaUrlV18').value=row.cta_url||'';
    $('#campaignScheduledAtV18').value='';
    $('#campaignEditorTitleV18').textContent=row.internal_name||'캠페인 초안';
    $('#campaignDeleteV18').disabled=false;
    renderPreview();
    estimateRecipients().catch(()=>{});
    $('#campaignFormV18').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function renderPreview(){
    const title=$('#campaignSubjectV18').value.trim()||'제목을 입력해 주세요';
    const body=$('#campaignBodyTextV18').value.trim();
    const label=$('#campaignCtaLabelV18').value.trim();
    const url=$('#campaignCtaUrlV18').value.trim();
    $('#campaignPreviewTitleV18').textContent=title;
    const container=$('#campaignPreviewBodyV18');
    container.replaceChildren();
    if(!body){const p=document.createElement('p');p.textContent='본문을 입력하면 여기에 표시됩니다.';container.appendChild(p);return;}
    body.split(/\n{2,}/).forEach(part=>{const p=document.createElement('p');p.textContent=part;container.appendChild(p);});
    if(label&&url){const link=document.createElement('a');link.href=url;link.textContent=label;link.target='_blank';link.rel='noopener noreferrer';container.appendChild(link);}
  }
  async function estimateRecipients(){
    const result=await call({action:'estimate_recipients',segment:$('#campaignSegmentV18').value});
    $('#campaignEstimateV18').textContent=`${Number(result.count||0).toLocaleString('ko-KR')}명`;
  }
  function scheduleEstimate(){
    clearTimeout(state.estimateTimer);
    state.estimateTimer=setTimeout(()=>estimateRecipients().catch(error=>setStatus(error.message,'error')),350);
  }
  async function saveCampaign(quiet=false){
    const button=$('#campaignSaveV18');
    button.disabled=true;
    if(!quiet) setStatus('캠페인 초안을 저장하는 중입니다.');
    try{
      const data=await call({action:'save_campaign',...formPayload()});
      $('#campaignIdV18').value=data.row.id;
      $('#campaignEditorTitleV18').textContent=data.row.internal_name;
      $('#campaignDeleteV18').disabled=false;
      if(!quiet) setStatus(data.message||'초안을 저장했습니다.','success');
      await loadCampaigns();
      return data.row;
    }catch(error){setStatus(error.message||'초안을 저장하지 못했습니다.','error');return null;}
    finally{button.disabled=false;}
  }
  function providerView(provider){
    state.providerReady=Boolean(provider?.ready);
    const badge=$('#campaignProviderBadge');
    const text=$('#campaignProviderText');
    badge.dataset.ready=String(state.providerReady);
    badge.textContent=state.providerReady?'발송 가능':'연결 필요';
    text.textContent=state.providerReady?`${provider.from||'발신 주소'}로 실제 메일을 보낼 수 있습니다.`:'초안·미리보기·대기열은 사용할 수 있지만 실제 발송에는 Resend API 키와 발신 주소가 필요합니다.';
  }
  function actionButton(label,className,handler){
    const button=document.createElement('button');
    button.type='button';button.className=className;button.textContent=label;
    button.addEventListener('click',async()=>{button.disabled=true;try{await handler();}finally{button.disabled=false;}});
    return button;
  }
  function renderCampaigns(rows){
    const tbody=$('#campaignRowsV18');
    tbody.replaceChildren();
    if(!rows.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=7;td.className='adminEmpty';td.textContent='아직 만든 캠페인이 없습니다.';tr.appendChild(td);tbody.appendChild(tr);return;}
    rows.forEach(row=>{
      const tr=document.createElement('tr');
      const title=document.createElement('td');title.className='campaignTitleCellV18';const strong=document.createElement('strong');strong.textContent=row.internal_name||'이름 없음';const sub=document.createElement('span');sub.textContent=row.subject||'제목 없음';title.append(strong,sub);
      const segment=document.createElement('td');segment.textContent=SEGMENT_LABELS[row.segment]||row.segment;
      const status=document.createElement('td');const badge=document.createElement('span');badge.className='campaignStateV18';badge.dataset.status=row.status;badge.textContent=STATUS_LABELS[row.status]||row.status;status.appendChild(badge);
      const recipients=document.createElement('td');recipients.textContent=Number(row.recipient_count||0).toLocaleString('ko-KR');
      const result=document.createElement('td');result.className='campaignResultV18';const resultText=document.createElement('span');resultText.textContent=`성공 ${Number(row.sent_count||0).toLocaleString('ko-KR')} · 실패 ${Number(row.failed_count||0).toLocaleString('ko-KR')}`;const progress=document.createElement('span');progress.className='campaignProgressV18';const bar=document.createElement('i');const total=Math.max(1,Number(row.recipient_count||0));bar.style.width=`${Math.min(100,Math.round((Number(row.sent_count||0)+Number(row.failed_count||0))/total*100))}%`;progress.appendChild(bar);result.append(resultText,progress);
      const date=document.createElement('td');date.textContent=row.scheduled_at?`예약 ${formatDate(row.scheduled_at)}`:`갱신 ${formatDate(row.updated_at)}`;
      const actions=document.createElement('td');actions.className='campaignRowActionsV18';
      if(row.status==='draft'){
        actions.append(actionButton('편집','adminSecondary',async()=>fillForm(row)),actionButton('테스트','adminSecondary',async()=>sendTest(row.id)),actionButton('복제','adminSecondary',async()=>duplicateCampaign(row.id)),actionButton('삭제','adminDanger',async()=>deleteCampaign(row.id)));
      }else if(['scheduled','sending','failed'].includes(row.status)){
        const label=row.status==='scheduled'?'예약 실행':row.status==='failed'?'실패 재시도':'발송 계속';
        actions.append(actionButton(label,'adminPrimary',async()=>sendCampaign(row.id)),actionButton('취소','adminDanger',async()=>cancelCampaign(row.id)),actionButton('복제','adminSecondary',async()=>duplicateCampaign(row.id)));
      }else actions.append(actionButton('복제','adminSecondary',async()=>duplicateCampaign(row.id)));
      tr.append(title,segment,status,recipients,result,date,actions);tbody.appendChild(tr);
    });
  }
  async function loadCampaigns(){
    const data=await call({action:'list_campaigns',page:state.page,pageSize:PAGE_SIZE});
    state.rows=data.rows||[];state.count=Number(data.count||0);
    providerView(data.provider||{});
    renderCampaigns(state.rows);
    $('#campaignCountV18').textContent=`총 ${state.count.toLocaleString('ko-KR')}건 · ${state.page+1}페이지`;
    $('#campaignPrevV18').disabled=state.page===0;
    $('#campaignNextV18').disabled=(state.page+1)*PAGE_SIZE>=state.count;
  }
  async function duplicateCampaign(id){
    const data=await call({action:'duplicate_campaign',id});
    setStatus(data.message,'success');
    fillForm(data.row);await loadCampaigns();
  }
  async function deleteCampaign(id){
    if(!confirm('이 캠페인 초안을 삭제할까요?')) return;
    const data=await call({action:'delete_campaign',id});
    if($('#campaignIdV18').value===id) resetForm();
    setStatus(data.message,'success');await loadCampaigns();
  }
  async function sendTest(id){
    if(!id){setStatus('캠페인을 먼저 저장해 주세요.','error');return;}
    setStatus('관리자 이메일로 테스트 메일을 보내는 중입니다.');
    try{const data=await call({action:'send_test',id});setStatus(data.message,'success');}
    catch(error){setStatus(error.message,'error');}
  }
  async function queueCampaign(scheduled){
    const row=await saveCampaign(true);if(!row) return;
    let scheduledAt=null;
    if(scheduled){
      const value=$('#campaignScheduledAtV18').value;
      if(!value){setStatus('예약 시간을 선택해 주세요.','error');return;}
      const date=new Date(value);
      if(Number.isNaN(date.getTime())||date.getTime()<=Date.now()+60000){setStatus('예약 시간은 현재보다 1분 이후로 설정해 주세요.','error');return;}
      scheduledAt=date.toISOString();
    }
    const prompt=scheduled?'선택한 시간으로 발송 대기열을 만들까요?':'현재 활성 구독자를 확정하고 발송 대기열을 만들까요?';
    if(!confirm(prompt)) return;
    setStatus('수신 대상을 확정하고 대기열을 만드는 중입니다.');
    try{
      const data=await call({action:'queue_campaign',id:row.id,scheduledAt});
      setStatus(data.message,'success');resetForm();await loadCampaigns();
      if(!scheduled&&state.providerReady&&confirm('대기열이 준비됐습니다. 지금 실제 발송을 시작할까요?')) await sendCampaign(row.id);
    }catch(error){setStatus(error.message,'error');}
  }
  async function sendCampaign(id){
    if(!state.providerReady){setStatus('Resend 발송 연결이 필요합니다. 초안과 대기열은 그대로 보관됩니다.','error');return;}
    if(!confirm('실제 구독자에게 이메일을 발송합니다. 계속할까요?')) return;
    setStatus('뉴스레터 발송을 시작합니다. 창을 닫지 마세요.');
    try{
      let last=null;
      for(let batch=0;batch<20;batch++){
        last=await call({action:'send_batch',id});
        const counts=last.counts||{};
        setStatus(`발송 중 · 성공 ${Number(counts.sent||0).toLocaleString('ko-KR')} · 실패 ${Number(counts.failed||0).toLocaleString('ko-KR')} · 남음 ${Number(counts.pending||0).toLocaleString('ko-KR')}`);
        await loadCampaigns();
        if(last.done){setStatus(last.message||'발송을 완료했습니다.',counts.failed?'error':'success');return;}
      }
      setStatus('한 번에 1,000건까지 처리했습니다. 캠페인 목록에서 발송 계속을 눌러 주세요.','success');
    }catch(error){setStatus(error.message||'발송 중 문제가 발생했습니다.','error');await loadCampaigns().catch(()=>{});}
  }
  async function cancelCampaign(id){
    if(!confirm('남은 뉴스레터 발송을 취소할까요? 이미 발송된 메일은 취소되지 않습니다.')) return;
    try{const data=await call({action:'cancel_campaign',id});setStatus(data.message,'success');await loadCampaigns();}
    catch(error){setStatus(error.message,'error');}
  }
  function bind(){
    $('#tabCampaigns').addEventListener('click',showCampaignTab);
    $('#tabSubscribers').addEventListener('click',hideCampaignTab,true);
    $('#tabInterest').addEventListener('click',hideCampaignTab,true);
    $('#campaignFormV18').addEventListener('submit',event=>{event.preventDefault();saveCampaign();});
    $('#campaignNewV18').addEventListener('click',resetForm);
    $('#campaignDeleteV18').addEventListener('click',()=>{const id=$('#campaignIdV18').value;if(id) deleteCampaign(id);});
    $('#campaignTestV18').addEventListener('click',()=>sendTest($('#campaignIdV18').value));
    $('#campaignQueueV18').addEventListener('click',()=>queueCampaign(false));
    $('#campaignScheduleV18').addEventListener('click',()=>queueCampaign(true));
    $('#campaignEstimateButtonV18').addEventListener('click',()=>estimateRecipients().catch(error=>setStatus(error.message,'error')));
    $('#campaignSegmentV18').addEventListener('change',scheduleEstimate);
    ['#campaignSubjectV18','#campaignBodyTextV18','#campaignCtaLabelV18','#campaignCtaUrlV18'].forEach(selector=>$(selector).addEventListener('input',renderPreview));
    $('#campaignRefreshV18').addEventListener('click',()=>loadCampaigns().catch(error=>setStatus(error.message,'error')));
    $('#campaignPrevV18').addEventListener('click',()=>{if(state.page>0){state.page--;loadCampaigns().catch(()=>{});}});
    $('#campaignNextV18').addEventListener('click',()=>{if((state.page+1)*PAGE_SIZE<state.count){state.page++;loadCampaigns().catch(()=>{});}});
    $('#adminRefresh').addEventListener('click',()=>{if(!$('#panelCampaigns').hidden) loadCampaigns().catch(()=>{});});
  }
  function startWhenReady(){
    const dashboard=$('#adminDashboard');
    const launch=()=>{
      if(state.started||dashboard.hidden||!session()?.accessToken) return;
      state.started=true;resetForm();loadCampaigns().catch(error=>setStatus(error.message,'error'));
    };
    launch();
    new MutationObserver(launch).observe(dashboard,{attributes:true,attributeFilter:['hidden']});
  }
  function start(){bind();renderPreview();$('#campaignDeleteV18').disabled=true;startWhenReady();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();