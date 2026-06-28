(()=>{
  'use strict';

  const VERSION='13.0';
  const MAX_ZIP_BYTES=80*1024*1024;
  const MAX_JSON_ENTRY=25*1024*1024;
  const MAX_JSON_TOTAL=50*1024*1024;
  const MAX_ENTRIES=10000;
  const MAX_RATIO=300;
  const WORKSPACE_PREFIX='unfollow_progress_v12_';
  const LABELS_KEY='unfollow_workspace_labels_v13';
  const q=(selector,root=document)=>root.querySelector(selector);
  const qa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const state={previous:null,current:null,result:null,category:'lostFollowers'};
  let analysisTimer=0;
  let analysisStartedAt=0;

  const start=()=>{
    document.body.classList.add('v13');
    loadStylesheet();
    addComparisonSection();
    addWorkspaceDialog();
    addNavigationLinks();
    addDiagnosticButton();
    setupAnalysisStatus();
    updateVisibleVersion();
  };

  function loadStylesheet(){
    if(q('link[data-v13-style]')) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/assets/v13-features.css?v=13.0';
    link.dataset.v13Style='true';
    document.head.appendChild(link);
  }

  function updateVisibleVersion(){
    qa('body *').forEach(element=>{
      if(element.children.length) return;
      if(/^v1[012](?:\.\d+)?$/i.test(element.textContent.trim())) element.textContent='v13.0';
    });
  }

  function addNavigationLinks(){
    const nav=q('.serviceNav,.nav');
    if(nav&&!q('[data-v13-compare-link]',nav)){
      const link=document.createElement('a');
      link.href='#compareV13';
      link.dataset.v13CompareLink='true';
      link.innerHTML='<span class="iconify" aria-hidden="true">⇄</span><span>변화 비교</span>';
      nav.appendChild(link);
    }
  }

  function addComparisonSection(){
    if(q('#compareV13')) return;
    const section=document.createElement('section');
    section.id='compareV13';
    section.className='compareV13 card sectionAnchorV11';
    section.innerHTML=`
      <div class="compareHeadV13">
        <div>
          <span class="compareEyebrowV13">NEW · v13</span>
          <h2>두 시점 변화 비교</h2>
          <p>이전 ZIP과 최신 ZIP을 비교해 새 팔로워, 이탈 팔로워, 새 팔로잉과 맞팔 변화를 정확하게 확인합니다.</p>
        </div>
        <div class="comparePrivacyV13"><strong>로컬 비교</strong><span>두 파일 모두 서버로 전송되지 않습니다.</span></div>
      </div>
      <div class="compareInputsV13">
        <label class="compareFileV13" for="comparePreviousV13">
          <span class="compareStepV13">1</span>
          <strong>이전 데이터 ZIP</strong>
          <span data-file-name="previous">파일을 선택해 주세요</span>
          <input id="comparePreviousV13" type="file" accept=".zip,application/zip">
        </label>
        <div class="compareArrowV13" aria-hidden="true">→</div>
        <label class="compareFileV13" for="compareCurrentV13">
          <span class="compareStepV13">2</span>
          <strong>최신 데이터 ZIP</strong>
          <span data-file-name="current">파일을 선택해 주세요</span>
          <input id="compareCurrentV13" type="file" accept=".zip,application/zip">
        </label>
      </div>
      <div class="compareActionsV13">
        <button type="button" class="btn primary" id="compareRunV13" disabled>변화 분석하기</button>
        <button type="button" class="btn ghost" id="compareResetV13">초기화</button>
        <span id="compareStatusV13" role="status" aria-live="polite">두 ZIP을 선택하면 비교할 수 있어요.</span>
      </div>
      <div id="compareResultsV13" class="compareResultsV13" hidden>
        <div class="compareStatsV13" role="tablist" aria-label="변화 항목"></div>
        <div class="compareToolbarV13">
          <div>
            <h3 id="compareCategoryTitleV13">변화 계정</h3>
            <p id="compareCategoryDescriptionV13"></p>
          </div>
          <div class="compareToolbarActionsV13">
            <input id="compareSearchV13" type="search" placeholder="아이디 검색" aria-label="변화 계정 아이디 검색">
            <button type="button" class="btn ghost" id="compareCopyV13">아이디 복사</button>
            <button type="button" class="btn ghost" id="compareCsvV13">CSV 저장</button>
          </div>
        </div>
        <div class="compareListV13" id="compareListV13" role="region" tabindex="0" aria-label="변화 계정 목록"></div>
      </div>`;

    const anchor=q('#beginnerGuide')||q('#faq')||q('#businessInfoV10');
    const main=q('.main')||document.body;
    if(anchor?.parentElement) anchor.parentElement.insertBefore(section,anchor);
    else main.appendChild(section);

    q('#comparePreviousV13').addEventListener('change',event=>selectCompareFile('previous',event.target.files?.[0]));
    q('#compareCurrentV13').addEventListener('change',event=>selectCompareFile('current',event.target.files?.[0]));
    q('#compareRunV13').addEventListener('click',runComparison);
    q('#compareResetV13').addEventListener('click',resetComparison);
    q('#compareSearchV13').addEventListener('input',renderCompareList);
    q('#compareCopyV13').addEventListener('click',copyCurrentCategory);
    q('#compareCsvV13').addEventListener('click',downloadCompareCsv);
  }

  function selectCompareFile(type,file){
    if(!file){state[type]=null;updateCompareReady();return;}
    if(!/\.zip$/i.test(file.name)||file.size>MAX_ZIP_BYTES){
      state[type]=null;
      q(`#compare${type==='previous'?'Previous':'Current'}V13`).value='';
      setCompareStatus(file.size>MAX_ZIP_BYTES?'ZIP은 80MB 이하만 비교할 수 있습니다.':'Instagram JSON ZIP 파일을 선택해 주세요.','error');
      updateCompareReady();
      return;
    }
    state[type]=file;
    const label=q(`[data-file-name="${type}"]`);
    label.textContent=`${safeDisplayName(file.name)} · ${formatBytes(file.size)}`;
    updateCompareReady();
  }

  function updateCompareReady(){
    q('#compareRunV13').disabled=!(state.previous&&state.current);
    if(state.previous&&state.current) setCompareStatus('준비됐습니다. 두 시점의 관계 변화를 분석할 수 있어요.');
  }

  async function runComparison(){
    const button=q('#compareRunV13');
    button.disabled=true;
    button.textContent='분석 중…';
    setCompareStatus('이전 ZIP을 읽고 있습니다…');
    try{
      const previous=await parseRelationshipZip(state.previous,progress=>setCompareStatus(`이전 ZIP · ${progress}`));
      setCompareStatus('최신 ZIP을 읽고 있습니다…');
      const current=await parseRelationshipZip(state.current,progress=>setCompareStatus(`최신 ZIP · ${progress}`));
      state.result=buildComparison(previous,current);
      state.category='lostFollowers';
      renderComparison();
      setCompareStatus(`비교 완료 · 이전 ${previous.all.size.toLocaleString()}명 / 최신 ${current.all.size.toLocaleString()}명`,'success');
    }catch(error){
      console.error(error);
      setCompareStatus(friendlyCompareError(error),'error');
    }finally{
      button.disabled=!(state.previous&&state.current);
      button.textContent='변화 분석하기';
    }
  }

  function buildComparison(previous,current){
    const diff=(a,b)=>[...a].filter(value=>!b.has(value)).sort();
    const previousMutual=new Set([...previous.following].filter(value=>previous.followers.has(value)));
    const currentMutual=new Set([...current.following].filter(value=>current.followers.has(value)));
    return {
      previous,current,
      newFollowing:diff(current.following,previous.following),
      stoppedFollowing:diff(previous.following,current.following),
      newFollowers:diff(current.followers,previous.followers),
      lostFollowers:diff(previous.followers,current.followers),
      newlyMutual:diff(currentMutual,previousMutual),
      mutualEnded:diff(previousMutual,currentMutual)
    };
  }

  const categories={
    lostFollowers:{title:'새로 나를 팔로우하지 않는 계정',short:'팔로워 이탈',description:'이전에는 나를 팔로우했지만 최신 데이터에서는 팔로워가 아닌 계정입니다.'},
    newFollowers:{title:'새로 나를 팔로우한 계정',short:'새 팔로워',description:'최신 데이터에서 새롭게 팔로워로 확인된 계정입니다.'},
    newFollowing:{title:'내가 새로 팔로우한 계정',short:'새 팔로잉',description:'이전 데이터 이후 내가 새로 팔로우한 계정입니다.'},
    stoppedFollowing:{title:'내가 팔로우를 멈춘 계정',short:'팔로잉 종료',description:'이전에는 팔로우했지만 최신 데이터에서는 팔로우하지 않는 계정입니다.'},
    newlyMutual:{title:'새롭게 맞팔이 된 계정',short:'새 맞팔',description:'이전과 달리 최신 데이터에서 서로 팔로우하는 계정입니다.'},
    mutualEnded:{title:'맞팔 상태가 끝난 계정',short:'맞팔 종료',description:'이전에는 맞팔이었지만 최신 데이터에서는 맞팔이 아닌 계정입니다.'}
  };

  function renderComparison(){
    const result=q('#compareResultsV13');
    result.hidden=false;
    const stats=q('.compareStatsV13',result);
    stats.replaceChildren();
    Object.entries(categories).forEach(([key,meta])=>{
      const button=document.createElement('button');
      button.type='button';
      button.className=`compareStatV13${state.category===key?' active':''}`;
      button.setAttribute('role','tab');
      button.setAttribute('aria-selected',String(state.category===key));
      button.dataset.category=key;
      const strong=document.createElement('strong');
      strong.textContent=state.result[key].length.toLocaleString();
      const span=document.createElement('span');
      span.textContent=meta.short;
      button.append(strong,span);
      button.addEventListener('click',()=>{state.category=key;renderComparison();});
      stats.appendChild(button);
    });
    const meta=categories[state.category];
    q('#compareCategoryTitleV13').textContent=`${meta.title} · ${state.result[state.category].length.toLocaleString()}명`;
    q('#compareCategoryDescriptionV13').textContent=meta.description;
    renderCompareList();
    result.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function currentFilteredUsers(){
    if(!state.result) return [];
    const query=q('#compareSearchV13')?.value.trim().toLowerCase()||'';
    return state.result[state.category].filter(username=>!query||username.includes(query));
  }

  function renderCompareList(){
    const list=q('#compareListV13');
    if(!list||!state.result) return;
    list.replaceChildren();
    const users=currentFilteredUsers();
    if(!users.length){
      const empty=document.createElement('div');
      empty.className='compareEmptyV13';
      empty.textContent=q('#compareSearchV13').value?'검색 결과가 없습니다.':'해당 변화가 없습니다.';
      list.appendChild(empty);
      return;
    }
    const fragment=document.createDocumentFragment();
    users.forEach((username,index)=>{
      const row=document.createElement('div');
      row.className='compareRowV13';
      const number=document.createElement('span');
      number.className='compareNumberV13';
      number.textContent=String(index+1);
      const name=document.createElement('strong');
      name.textContent=`@${username}`;
      const actions=document.createElement('div');
      const copy=document.createElement('button');
      copy.type='button';
      copy.className='compareMiniButtonV13';
      copy.textContent='복사';
      copy.addEventListener('click',()=>copyText(username,'아이디를 복사했습니다.'));
      const open=document.createElement('a');
      open.className='compareMiniButtonV13 primary';
      open.href=`https://www.instagram.com/${encodeURIComponent(username)}/`;
      open.target='_blank';
      open.rel='noopener noreferrer';
      open.textContent='프로필';
      actions.append(copy,open);
      row.append(number,name,actions);
      fragment.appendChild(row);
    });
    list.appendChild(fragment);
  }

  function copyCurrentCategory(){
    const users=currentFilteredUsers();
    if(!users.length){setCompareStatus('복사할 계정이 없습니다.','error');return;}
    copyText(users.join('\n'),`${users.length.toLocaleString()}개 아이디를 복사했습니다.`);
  }

  function downloadCompareCsv(){
    const users=currentFilteredUsers();
    if(!users.length){setCompareStatus('저장할 계정이 없습니다.','error');return;}
    const meta=categories[state.category];
    const rows=[['category','username','profile_url'],...users.map(username=>[meta.short,username,`https://www.instagram.com/${username}/`])];
    const csv='\uFEFF'+rows.map(row=>row.map(csvEscape).join(',')).join('\r\n');
    downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),`unfollow-compare-${state.category}-${dateStamp()}.csv`);
    setCompareStatus('CSV를 저장했습니다.','success');
  }

  function resetComparison(){
    state.previous=null;state.current=null;state.result=null;
    q('#comparePreviousV13').value='';
    q('#compareCurrentV13').value='';
    q('[data-file-name="previous"]').textContent='파일을 선택해 주세요';
    q('[data-file-name="current"]').textContent='파일을 선택해 주세요';
    q('#compareResultsV13').hidden=true;
    q('#compareSearchV13').value='';
    q('#compareRunV13').disabled=true;
    setCompareStatus('두 ZIP을 선택하면 비교할 수 있어요.');
  }

  function setCompareStatus(message,type='normal'){
    const status=q('#compareStatusV13');
    if(!status) return;
    status.textContent=message;
    status.dataset.type=type;
  }

  async function parseRelationshipZip(file,onProgress=()=>{}){
    if(!file||file.size>MAX_ZIP_BYTES) throw new Error('ZIP_LIMIT');
    onProgress('파일 확인 중');
    const buffer=await file.arrayBuffer();
    const zip=parseZipEntries(buffer);
    const followingEntries=zip.entries.filter(entry=>/(^|\/)following\.json$/i.test(entry.name));
    const followerEntries=zip.entries.filter(entry=>/(^|\/)followers_\d+\.json$/i.test(entry.name));
    if(!followingEntries.length||!followerEntries.length) throw new Error('FILES_MISSING');
    const following=new Set();
    const followers=new Set();
    let processed=0;
    const total=followingEntries.length+followerEntries.length;
    for(const entry of followingEntries){
      onProgress(`팔로잉 읽는 중 ${++processed}/${total}`);
      extractUsers(JSON.parse(await inflateEntry(zip,entry))).forEach(value=>following.add(value));
    }
    for(const entry of followerEntries){
      onProgress(`팔로워 읽는 중 ${++processed}/${total}`);
      extractUsers(JSON.parse(await inflateEntry(zip,entry))).forEach(value=>followers.add(value));
    }
    const all=new Set([...following,...followers]);
    return {following,followers,all};
  }

  function parseZipEntries(buffer){
    if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<22) throw new Error('ZIP_INVALID');
    const view=new DataView(buffer);
    const eocd=findEocd(view);
    const total=view.getUint16(eocd+10,true);
    const centralSize=view.getUint32(eocd+12,true);
    const centralOffset=view.getUint32(eocd+16,true);
    if(total>MAX_ENTRIES||centralOffset+centralSize>buffer.byteLength) throw new Error('ZIP_INVALID');
    const decoder=new TextDecoder();
    const entries=[];
    let offset=centralOffset;
    let totalJson=0;
    for(let index=0;index<total;index++){
      if(offset+46>buffer.byteLength||view.getUint32(offset,true)!==0x02014b50) throw new Error('ZIP_INVALID');
      const method=view.getUint16(offset+10,true);
      const compressedSize=view.getUint32(offset+20,true);
      const uncompressedSize=view.getUint32(offset+24,true);
      const nameLength=view.getUint16(offset+28,true);
      const extraLength=view.getUint16(offset+30,true);
      const commentLength=view.getUint16(offset+32,true);
      const localOffset=view.getUint32(offset+42,true);
      const next=offset+46+nameLength+extraLength+commentLength;
      if(next>buffer.byteLength||localOffset+30>buffer.byteLength) throw new Error('ZIP_INVALID');
      const name=decoder.decode(new Uint8Array(buffer,offset+46,nameLength));
      if(/\.json$/i.test(name)){
        if(uncompressedSize>MAX_JSON_ENTRY) throw new Error('JSON_LIMIT');
        totalJson+=uncompressedSize;
        if(totalJson>MAX_JSON_TOTAL) throw new Error('JSON_TOTAL_LIMIT');
        if(uncompressedSize>1024&&(!compressedSize||uncompressedSize/compressedSize>MAX_RATIO)) throw new Error('ZIP_RATIO');
      }
      entries.push({name,method,compressedSize,uncompressedSize,localOffset});
      offset=next;
    }
    return {buffer,entries};
  }

  function findEocd(view){
    const minimum=Math.max(0,view.byteLength-65557);
    for(let offset=view.byteLength-22;offset>=minimum;offset--){
      if(view.getUint32(offset,true)===0x06054b50) return offset;
    }
    throw new Error('ZIP_INVALID');
  }

  async function inflateEntry(zip,entry){
    const view=new DataView(zip.buffer);
    if(view.getUint32(entry.localOffset,true)!==0x04034b50) throw new Error('ZIP_INVALID');
    const nameLength=view.getUint16(entry.localOffset+26,true);
    const extraLength=view.getUint16(entry.localOffset+28,true);
    const start=entry.localOffset+30+nameLength+extraLength;
    if(start+entry.compressedSize>zip.buffer.byteLength) throw new Error('ZIP_INVALID');
    const compressed=new Uint8Array(zip.buffer.slice(start,start+entry.compressedSize));
    if(entry.method===0) return new TextDecoder().decode(compressed);
    if(entry.method!==8||!('DecompressionStream' in window)) throw new Error('ZIP_UNSUPPORTED');
    const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const output=await new Response(stream).arrayBuffer();
    if(output.byteLength>MAX_JSON_ENTRY) throw new Error('JSON_LIMIT');
    return new TextDecoder().decode(output);
  }

  function extractUsers(data){
    let rows=[];
    if(Array.isArray(data)) rows=data;
    else if(Array.isArray(data?.relationships_following)) rows=data.relationships_following;
    else if(Array.isArray(data?.relationships_followers)) rows=data.relationships_followers;
    const users=[];
    rows.forEach(row=>{
      const value=String(row?.string_list_data?.[0]?.value||row?.title||'').trim().replace(/^@/,'').toLowerCase();
      if(/^[a-z0-9._]{1,30}$/.test(value)) users.push(value);
    });
    return users;
  }

  function friendlyCompareError(error){
    const code=String(error?.message||error);
    const messages={
      ZIP_LIMIT:'ZIP 파일은 80MB 이하만 비교할 수 있습니다.',
      ZIP_INVALID:'ZIP 파일이 손상됐거나 Instagram 데이터 형식이 아닙니다.',
      FILES_MISSING:'followers_*.json 또는 following.json을 찾지 못했습니다. Instagram 다운로드 형식을 JSON으로 설정해 주세요.',
      JSON_LIMIT:'ZIP 안의 JSON 파일이 너무 큽니다.',
      JSON_TOTAL_LIMIT:'ZIP 안의 JSON 전체 크기가 50MB를 초과합니다.',
      ZIP_RATIO:'비정상적으로 압축률이 높은 ZIP은 안전을 위해 비교하지 않습니다.',
      ZIP_UNSUPPORTED:'이 브라우저에서는 ZIP 압축을 해제할 수 없습니다. Chrome, Edge 또는 Safari 최신 버전을 이용해 주세요.'
    };
    if(messages[code]) return messages[code];
    if(/JSON/i.test(code)) return 'JSON 파일을 읽지 못했습니다. Instagram 데이터 형식을 확인해 주세요.';
    return '비교 중 문제가 발생했습니다. ZIP 파일을 다시 확인해 주세요.';
  }

  function addWorkspaceDialog(){
    if(q('#workspaceDialogV13')) return;
    const dialog=document.createElement('dialog');
    dialog.id='workspaceDialogV13';
    dialog.className='workspaceDialogV13';
    dialog.innerHTML=`
      <div class="workspaceDialogHeadV13"><div><span>브라우저 로컬 저장소</span><h2>작업공간 관리</h2></div><button type="button" data-close-workspaces aria-label="닫기">×</button></div>
      <p class="workspaceDialogIntroV13">계정별 작업 기록은 이 브라우저에만 저장됩니다. 이름 변경, 백업, 개별 삭제를 할 수 있습니다.</p>
      <div id="workspaceListV13" class="workspaceListV13"></div>
      <div class="workspaceDialogFootV13"><button type="button" class="btn ghost" id="workspaceExportAllV13">전체 백업</button><button type="button" class="btn ghost" data-close-workspaces>닫기</button></div>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('click',event=>{
      if(event.target===dialog||event.target.closest('[data-close-workspaces]')) dialog.close();
    });
    q('#workspaceExportAllV13').addEventListener('click',exportAllWorkspaces);
  }

  function openWorkspaceDialog(){
    renderWorkspaces();
    const dialog=q('#workspaceDialogV13');
    if(typeof dialog.showModal==='function') dialog.showModal();
    else dialog.setAttribute('open','');
  }

  function renderWorkspaces(){
    const host=q('#workspaceListV13');
    host.replaceChildren();
    const labels=readJsonStorage(LABELS_KEY,{});
    const spaces=[];
    for(let index=0;index<localStorage.length;index++){
      const key=localStorage.key(index);
      if(!key?.startsWith(WORKSPACE_PREFIX)) continue;
      const progress=readJsonStorage(key,{});
      const values=Object.values(progress).filter(value=>value&&typeof value==='object');
      spaces.push({key,id:key.slice(WORKSPACE_PREFIX.length),progress,total:values.length,done:values.filter(value=>value.status==='done').length,updatedAt:values.map(value=>value.updatedAt).filter(Boolean).sort().at(-1)||''});
    }
    spaces.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    if(!spaces.length){
      const empty=document.createElement('div');
      empty.className='workspaceEmptyV13';
      empty.textContent='아직 저장된 실제 작업공간이 없습니다.';
      host.appendChild(empty);
      return;
    }
    spaces.forEach(space=>{
      const card=document.createElement('article');
      card.className='workspaceCardV13';
      const top=document.createElement('div');
      const input=document.createElement('input');
      input.type='text';
      input.value=labels[space.id]||friendlyWorkspaceName(space.id);
      input.maxLength=40;
      input.setAttribute('aria-label','작업공간 이름');
      const meta=document.createElement('span');
      meta.textContent=`기록 ${space.total.toLocaleString()}개 · 완료 ${space.done.toLocaleString()}개${space.updatedAt?` · ${formatDate(space.updatedAt)}`:''}`;
      top.append(input,meta);
      const actions=document.createElement('div');
      const save=document.createElement('button');
      save.type='button';save.className='compareMiniButtonV13';save.textContent='이름 저장';
      save.addEventListener('click',()=>{labels[space.id]=input.value.trim()||friendlyWorkspaceName(space.id);localStorage.setItem(LABELS_KEY,JSON.stringify(labels));save.textContent='저장됨';setTimeout(()=>save.textContent='이름 저장',1000);});
      const backup=document.createElement('button');
      backup.type='button';backup.className='compareMiniButtonV13';backup.textContent='백업';
      backup.addEventListener('click',()=>downloadBlob(new Blob([JSON.stringify({version:13,workspaceId:space.id,label:input.value.trim(),progress:space.progress},null,2)],{type:'application/json'}),`unfollow-workspace-${safeFilename(input.value||space.id)}.json`));
      const remove=document.createElement('button');
      remove.type='button';remove.className='compareMiniButtonV13 danger';remove.textContent='삭제';
      remove.addEventListener('click',()=>{if(confirm('이 작업공간의 진행 기록을 삭제할까요?')){localStorage.removeItem(space.key);delete labels[space.id];localStorage.setItem(LABELS_KEY,JSON.stringify(labels));renderWorkspaces();}});
      actions.append(save,backup,remove);
      card.append(top,actions);
      host.appendChild(card);
    });
  }

  function exportAllWorkspaces(){
    const workspaces={};
    for(let index=0;index<localStorage.length;index++){
      const key=localStorage.key(index);
      if(key?.startsWith(WORKSPACE_PREFIX)) workspaces[key.slice(WORKSPACE_PREFIX.length)]=readJsonStorage(key,{});
    }
    const payload={version:13,exportedAt:new Date().toISOString(),labels:readJsonStorage(LABELS_KEY,{}),workspaces};
    downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`unfollow-all-workspaces-${dateStamp()}.json`);
  }

  function addDiagnosticButton(){
    const links=q('.businessLinksV10');
    if(!links||q('[data-v13-diagnostic]',links)) return;
    const workspace=document.createElement('button');
    workspace.type='button';
    workspace.dataset.v13Workspace='true';
    workspace.textContent='작업공간 관리';
    workspace.addEventListener('click',openWorkspaceDialog);
    const diagnostic=document.createElement('button');
    diagnostic.type='button';
    diagnostic.dataset.v13Diagnostic='true';
    diagnostic.textContent='진단 파일 저장';
    diagnostic.addEventListener('click',downloadDiagnostic);
    links.append(workspace,diagnostic);
  }

  async function downloadDiagnostic(){
    const registrations='serviceWorker' in navigator?await navigator.serviceWorker.getRegistrations().catch(()=>[]):[];
    const progressKeys=Array.from({length:localStorage.length},(_,index)=>localStorage.key(index)).filter(key=>key?.startsWith(WORKSPACE_PREFIX));
    const count=id=>Number((q(id)?.textContent||'').replace(/[^0-9]/g,''))||0;
    const payload={
      reportType:'unfollow-safe-diagnostic',
      version:VERSION,
      createdAt:new Date().toISOString(),
      page:{origin:location.origin,path:location.pathname,online:navigator.onLine,language:navigator.language},
      browser:{userAgent:navigator.userAgent,platform:navigator.platform||'',viewport:{width:innerWidth,height:innerHeight},devicePixelRatio:devicePixelRatio||1},
      support:{decompressionStream:'DecompressionStream' in window,cryptoSubtle:!!crypto?.subtle,serviceWorker:'serviceWorker' in navigator,fileSystemAccess:'showOpenFilePicker' in window},
      app:{darkMode:document.body.classList.contains('v8-dark'),workspaceCount:progressKeys.length,serviceWorkerRegistrations:registrations.length,visibleError:!!q('#errorBox:not(.hidden)'),counts:{following:count('#countFollowing'),mutual:count('#countMutual'),review:count('#countNonMutual'),followersOnly:count('#countFollowerOnly'),done:count('#countDone')}},
      privacy:'사용자 아이디, ZIP 파일명, 파일 내용, 작업 메모는 포함하지 않았습니다.'
    };
    downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`unfollow-diagnostic-${dateStamp()}.json`);
  }

  function setupAnalysisStatus(){
    const input=q('#zipInput');
    if(!input) return;
    let panel=q('#analysisStatusV13');
    if(!panel){
      panel=document.createElement('div');
      panel.id='analysisStatusV13';
      panel.className='analysisStatusV13';
      panel.hidden=true;
      panel.setAttribute('role','status');
      panel.setAttribute('aria-live','polite');
      panel.innerHTML='<span class="analysisSpinnerV13" aria-hidden="true"></span><div><strong>분석 중</strong><span data-analysis-message>ZIP을 확인하고 있습니다.</span></div><time data-analysis-time>0초</time>';
      const host=q('#loadStatus')?.parentElement||q('.uploadPanel');
      host?.appendChild(panel);
    }
    input.addEventListener('change',()=>{
      if(!input.files?.length) return;
      analysisStartedAt=Date.now();
      panel.hidden=false;
      clearInterval(analysisTimer);
      analysisTimer=setInterval(updateAnalysisPanel,250);
      updateAnalysisPanel();
    });
    const loadStatus=q('#loadStatus');
    if(loadStatus){
      new MutationObserver(()=>{
        const text=loadStatus.textContent.trim();
        q('[data-analysis-message]',panel).textContent=text||'데이터를 정리하고 있습니다.';
        if(/완료|실패/.test(text)){
          clearInterval(analysisTimer);
          q('strong',panel).textContent=/실패/.test(text)?'분석 실패':'분석 완료';
          panel.classList.toggle('success',/완료/.test(text));
          panel.classList.toggle('error',/실패/.test(text));
          setTimeout(()=>panel.hidden=true,2500);
        }
      }).observe(loadStatus,{childList:true,subtree:true,characterData:true});
    }
  }

  function updateAnalysisPanel(){
    const panel=q('#analysisStatusV13');
    if(!panel||panel.hidden) return;
    const seconds=Math.max(0,Math.floor((Date.now()-analysisStartedAt)/1000));
    q('[data-analysis-time]',panel).textContent=`${seconds}초`;
  }

  function copyText(text,message){
    navigator.clipboard?.writeText(text).then(()=>setCompareStatus(message,'success')).catch(()=>{
      const area=document.createElement('textarea');area.value=text;document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();setCompareStatus(message,'success');
    });
  }

  function downloadBlob(blob,filename){
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function readJsonStorage(key,fallback){
    try{return JSON.parse(localStorage.getItem(key)||'')||fallback;}catch{return fallback;}
  }
  function formatBytes(bytes){return bytes<1024*1024?`${Math.max(1,Math.round(bytes/1024))}KB`:`${(bytes/1024/1024).toFixed(1)}MB`;}
  function formatDate(value){try{return new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch{return '';}}
  function dateStamp(){return new Date().toISOString().slice(0,10);}
  function csvEscape(value){const text=String(value??'');return /[",\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;}
  function safeDisplayName(name){return String(name).replace(/[\r\n<>]/g,'').slice(0,80);}
  function safeFilename(name){return String(name).trim().replace(/[^a-zA-Z0-9가-힣._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50)||'workspace';}
  function friendlyWorkspaceName(id){return id==='default'?'기본 작업공간':id==='sample'?'가상 샘플':String(id).replaceAll('_',' ').replaceAll('-',' ').replace(/\s+/g,' ').trim().slice(0,40);}

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
