(()=>{
  'use strict';

  const SUPABASE_URL='https://jnciddblcndmthmmvqrz.supabase.co';
  const PUBLISHABLE_KEY='sb_publishable_UUzSE7O9wqI0WN9cKG9OAQ_VleRkL4I';
  const API_URL=`${SUPABASE_URL}/functions/v1/unfollow-newsletter-admin`;
  const SESSION_KEY='unfollow_admin_session_v17';
  const PAGE_SIZE=25;
  const CATEGORY_LABELS={service:'서비스 이용',data:'데이터 처리',privacy:'개인정보',premium:'프리미엄',extension:'Chrome 확장',bug:'오류 신고',partnership:'제휴·사업',other:'기타'};
  const STATUS_LABELS={new:'신규',in_progress:'처리 중',resolved:'답변 완료',spam:'스팸'};
  const DELIVERY_LABELS={pending:'대기',sent:'전송',failed:'실패',configuration_required:'연결 필요'};
  const $=selector=>document.querySelector(selector);
  const state={page:0,count:0,search:'',status:'',admin:null,started:false};

  function session(){try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');}catch{return null;}}
  function setStatus(message,type=''){
    const target=$('#adminStatus');
    if(!target) return;
    target.textContent=message||'';
    if(type) target.dataset.state=type; else delete target.dataset.state;
  }
  async function call(payload){
    const current=session();
    if(!current?.accessToken) throw new Error('관리자 로그인이 필요합니다.');
    const response=await fetch(API_URL,{method:'POST',headers:{apikey:PUBLISHABLE_KEY,Authorization:`Bearer ${current.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await response.json().catch(()=>({ok:false,message:'응답을 읽지 못했습니다.'}));
    if(!response.ok||data.ok===false) throw Object.assign(new Error(data.message||'문의 관리 요청을 처리하지 못했습니다.'),{status:response.status});
    return data;
  }
  function formatDate(value){
    if(!value) return '—';
    const date=new Date(value);
    if(Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short'}).format(date);
  }
  function cell(className=''){
    const td=document.createElement('td');
    if(className) td.className=className;
    return td;
  }
  function statusBadge(value,type='delivery'){
    const span=document.createElement('span');
    span.className='inquiryBadgeV21';
    span.dataset.state=value||'unknown';
    span.textContent=(type==='status'?STATUS_LABELS[value]:DELIVERY_LABELS[value])||value||'—';
    return span;
  }
  function canManage(){return ['owner','editor'].includes(state.admin?.role);}
  function isOwner(){return state.admin?.role==='owner';}

  async function updateStatus(row,value,select){
    select.disabled=true;
    try{
      const data=await call({action:'update_inquiry_status',id:row.id,status:value});
      row.status=data.row.status;
      setStatus(data.message||'문의 상태를 변경했습니다.','success');
      await loadStats();
    }catch(error){
      select.value=row.status;
      setStatus(error.message||'문의 상태를 변경하지 못했습니다.','error');
    }finally{select.disabled=false;}
  }
  async function deleteInquiry(row,button){
    if(!confirm(`${row.name}님의 문의 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    button.disabled=true;
    try{
      const data=await call({action:'delete_inquiry',id:row.id});
      setStatus(data.message||'문의 기록을 삭제했습니다.','success');
      await Promise.all([loadInquiries(),loadStats()]);
    }catch(error){setStatus(error.message||'문의 기록을 삭제하지 못했습니다.','error');}
    finally{button.disabled=false;}
  }
  function render(rows){
    const tbody=$('#inquiryRowsV21');
    tbody.replaceChildren();
    if(!rows.length){
      const tr=document.createElement('tr');
      const td=cell('adminEmpty');td.colSpan=8;td.textContent='조건에 맞는 문의가 없습니다.';tr.appendChild(td);tbody.appendChild(tr);return;
    }
    rows.forEach(row=>{
      const tr=document.createElement('tr');
      const reference=cell('inquiryReferenceV21');reference.textContent=String(row.id||'').slice(0,8).toUpperCase();

      const person=cell('inquiryPersonV21');
      const name=document.createElement('strong');name.textContent=row.name||'이름 없음';
      const email=document.createElement('a');email.href=`mailto:${row.email}`;email.textContent=row.email||'—';
      person.append(name,email);

      const category=cell();category.appendChild(statusBadge(row.category,'category'));category.firstChild.textContent=CATEGORY_LABELS[row.category]||row.category||'기타';

      const content=cell('inquiryContentV21');
      const subject=document.createElement('strong');subject.textContent=row.subject||'제목 없음';
      const details=document.createElement('details');
      const summary=document.createElement('summary');summary.textContent='내용 보기';
      const message=document.createElement('p');message.textContent=row.message||'내용 없음';
      details.append(summary,message);content.append(subject,details);

      const delivery=cell('inquiryDeliveryV21');
      const adminLine=document.createElement('span');adminLine.append('운영자 ',statusBadge(row.admin_notification_status));
      const requesterLine=document.createElement('span');requesterLine.append('신청자 ',statusBadge(row.requester_confirmation_status));
      delivery.append(adminLine,requesterLine);
      if(row.last_email_error){const error=document.createElement('small');error.textContent=row.last_email_error;delivery.appendChild(error);}

      const status=cell();
      if(canManage()){
        const select=document.createElement('select');select.className='inquiryStatusSelectV21';
        Object.entries(STATUS_LABELS).forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;select.appendChild(option);});
        select.value=row.status||'new';select.addEventListener('change',()=>updateStatus(row,select.value,select));status.appendChild(select);
      }else status.appendChild(statusBadge(row.status,'status'));

      const date=cell();date.textContent=formatDate(row.created_at);
      const action=cell('inquiryActionsV21');
      const reply=document.createElement('a');reply.className='adminSecondary';reply.href=`mailto:${row.email}?subject=${encodeURIComponent(`[맞팔체커 문의 ${String(row.id||'').slice(0,8).toUpperCase()}] ${row.subject||''}`)}`;reply.textContent='답장';
      action.appendChild(reply);
      if(isOwner()){
        const remove=document.createElement('button');remove.type='button';remove.className='adminDanger';remove.textContent='삭제';remove.addEventListener('click',()=>deleteInquiry(row,remove));action.appendChild(remove);
      }
      tr.append(reference,person,category,content,delivery,status,date,action);
      tbody.appendChild(tr);
    });
  }

  async function loadStats(){
    const data=await call({action:'stats'});
    state.admin=data.admin;
    const target=$('#statInquiry');
    if(target) target.textContent=Number(data.stats.newInquiryCount||0).toLocaleString('ko-KR');
  }
  async function loadInquiries(){
    const tbody=$('#inquiryRowsV21');
    if(tbody){tbody.innerHTML='<tr><td colspan="8" class="adminEmpty">문의 내역을 불러오는 중입니다.</td></tr>';}
    const data=await call({action:'list_inquiries',page:state.page,pageSize:PAGE_SIZE,search:state.search,status:state.status});
    state.admin=data.admin;state.count=Number(data.count||0);
    render(data.rows||[]);
    $('#inquiryCountV21').textContent=`총 ${state.count.toLocaleString('ko-KR')}건 · ${state.page+1}페이지`;
    $('#inquiryPrevV21').disabled=state.page===0;
    $('#inquiryNextV21').disabled=(state.page+1)*PAGE_SIZE>=state.count;
  }
  function hideInquiryTab(){
    const tab=$('#tabInquiries');const panel=$('#panelInquiries');
    if(tab) tab.setAttribute('aria-selected','false');
    if(panel) panel.hidden=true;
  }
  function showInquiryTab(){
    ['#tabSubscribers','#tabInterest','#tabCampaigns'].forEach(selector=>$(selector)?.setAttribute('aria-selected','false'));
    $('#tabInquiries').setAttribute('aria-selected','true');
    ['#panelSubscribers','#panelInterest','#panelCampaigns'].forEach(selector=>{const panel=$(selector);if(panel) panel.hidden=true;});
    $('#panelInquiries').hidden=false;
    loadInquiries().catch(error=>setStatus(error.message,'error'));
  }
  function bind(){
    $('#tabInquiries')?.addEventListener('click',showInquiryTab);
    ['#tabSubscribers','#tabInterest','#tabCampaigns'].forEach(selector=>$(selector)?.addEventListener('click',hideInquiryTab,true));
    $('#inquirySearchFormV21')?.addEventListener('submit',event=>{event.preventDefault();state.search=$('#inquirySearchV21').value.trim();state.page=0;loadInquiries().catch(error=>setStatus(error.message,'error'));});
    $('#inquiryClearV21')?.addEventListener('click',()=>{$('#inquirySearchV21').value='';$('#inquiryStatusFilterV21').value='';state.search='';state.status='';state.page=0;loadInquiries().catch(()=>{});});
    $('#inquiryStatusFilterV21')?.addEventListener('change',()=>{state.status=$('#inquiryStatusFilterV21').value;state.page=0;loadInquiries().catch(error=>setStatus(error.message,'error'));});
    $('#inquiryPrevV21')?.addEventListener('click',()=>{if(state.page>0){state.page--;loadInquiries().catch(()=>{});}});
    $('#inquiryNextV21')?.addEventListener('click',()=>{if((state.page+1)*PAGE_SIZE<state.count){state.page++;loadInquiries().catch(()=>{});}});
    $('#inquiryRefreshV21')?.addEventListener('click',()=>Promise.all([loadInquiries(),loadStats()]).catch(error=>setStatus(error.message,'error')));
    $('#adminRefresh')?.addEventListener('click',()=>{loadStats().catch(()=>{});if(!$('#panelInquiries')?.hidden) loadInquiries().catch(()=>{});});
  }
  function startWhenReady(){
    const dashboard=$('#adminDashboard');
    if(!dashboard) return;
    const launch=()=>{
      if(state.started||dashboard.hidden||!session()?.accessToken) return;
      state.started=true;loadStats().catch(()=>{});
    };
    launch();
    new MutationObserver(launch).observe(dashboard,{attributes:true,attributeFilter:['hidden']});
  }
  function start(){bind();startWhenReady();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();