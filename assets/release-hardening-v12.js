(()=>{
  const MAX_ZIP_BYTES=80*1024*1024;
  const q=(selector,root=document)=>root.querySelector(selector);
  const qa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  let observerTimer=0;

  const start=()=>{
    document.body.classList.add('release-v12');
    normalizeMobileNavigation();
    improveAccessibility();
    addWorkspaceStatus();
    addFileSafetyNote();
    bindPreflightChecks();
    bindActiveNavigation();
    watchDynamicUI();
  };

  function normalizeMobileNavigation(){
    let top=q('.mobileTopV8,.mobileHeader,.mobileTop,.mobileBar');
    if(top){
      top.classList.add('mobileTopV8');
    }else{
      top=document.createElement('header');
      top.className='mobileTopV8';
      top.innerHTML='<div class="miniBrand"><div class="miniLogo" aria-hidden="true"><span class="iconify" data-icon="ph:users-three-fill"></span></div><span>맞팔체커</span></div><button type="button" class="iconBtnV8 themeV12" aria-label="화면 테마 변경"><span aria-hidden="true">☾</span></button>';
      document.body.prepend(top);
      q('.themeV12',top)?.addEventListener('click',toggleTheme);
    }

    let nav=q('.bottomNavV8,.bottomNav');
    if(nav){
      nav.classList.add('bottomNavV8');
    }else{
      nav=document.createElement('nav');
      nav.className='bottomNavV8';
      nav.setAttribute('aria-label','모바일 주요 메뉴');
      nav.innerHTML='<a href="#top"><span class="iconify" data-icon="ph:house-fill" aria-hidden="true"></span><span>홈</span></a><a href="#results"><span class="iconify" data-icon="ph:chart-bar" aria-hidden="true"></span><span>결과</span></a><a href="#work"><span class="iconify" data-icon="ph:check-square-offset-fill" aria-hidden="true"></span><span>작업</span></a><a href="#faq"><span class="iconify" data-icon="ph:question" aria-hidden="true"></span><span>도움말</span></a>';
      document.body.appendChild(nav);
    }

    nav.setAttribute('aria-label','모바일 주요 메뉴');
    qa('a',nav).forEach(link=>{
      const text=link.textContent.trim();
      if(!link.getAttribute('aria-label')&&text) link.setAttribute('aria-label',text);
    });
  }

  function toggleTheme(){
    document.body.classList.toggle('v8-dark');
    localStorage.setItem('unfollow_theme_v10',document.body.classList.contains('v8-dark')?'dark':'light');
  }

  function improveAccessibility(){
    const labels={
      zipInput:'Instagram 데이터 ZIP 파일 선택',
      progressInput:'작업 기록 JSON 또는 CSV 파일 선택',
      searchInput:'Instagram 아이디 검색',
      sortSelect:'계정 정렬 기준',
      statusSelect:'작업 상태 필터',
      dailyGoalInput:'오늘 작업 목표 인원',
      hideDoneInput:'완료 또는 유지한 계정 숨기기',
      sameTabInput:'Instagram 프로필을 현재 탭에서 열기'
    };
    Object.entries(labels).forEach(([id,label])=>{
      const element=document.getElementById(id);
      if(element&&!element.getAttribute('aria-label')) element.setAttribute('aria-label',label);
    });

    qa('select').forEach((select,index)=>{
      if(!select.getAttribute('aria-label')&&!select.getAttribute('aria-labelledby')) select.setAttribute('aria-label',index===0?'정렬 기준':'상태 필터');
    });

    const scrollRegions=[
      ['.tabs','분석 결과 분류 탭'],
      ['.dashboard','분석 요약 통계'],
      ['.v10Steps','사용 단계 안내'],
      ['.onboardingBoard','처음 사용자 안내'],
      ['.serviceNav','서비스 메뉴'],
      ['.tableWrap','계정 결과 표'],
      ['.heroBadges','서비스 특징'],
      ['.trustRow','개인정보 보호 안내']
    ];
    scrollRegions.forEach(([selector,label])=>qa(selector).forEach(element=>{
      element.classList.add('scrollRegionV12');
      if(!element.hasAttribute('tabindex')) element.tabIndex=0;
      if(!element.hasAttribute('role')) element.setAttribute('role','region');
      if(!element.getAttribute('aria-label')) element.setAttribute('aria-label',label);
    }));

    const loadStatus=q('#loadStatus');
    if(loadStatus){loadStatus.setAttribute('role','status');loadStatus.setAttribute('aria-live','polite');}
    const error=q('#errorBox');
    if(error){error.setAttribute('role','alert');error.setAttribute('aria-live','assertive');}

    qa('button').forEach(button=>{
      if(!button.getAttribute('aria-label')&&!button.textContent.trim()) button.setAttribute('aria-label','기능 실행');
    });
  }

  function addWorkspaceStatus(){
    const host=q('#loadStatus')?.parentElement||q('.heroButtons')?.parentElement||q('.uploadPanel');
    if(!host||q('#workspaceBadgeV12')) return;
    const badge=document.createElement('div');
    badge.id='workspaceBadgeV12';
    badge.className='workspaceBadgeV12';
    badge.hidden=true;
    badge.setAttribute('role','status');
    badge.setAttribute('aria-live','polite');
    badge.innerHTML='<strong>작업공간</strong><span data-workspace-name>ZIP을 선택하면 계정별로 기록을 분리해 저장합니다.</span>';
    q('#loadStatus')?.after(badge);

    window.addEventListener('unfollow:workspace',event=>{
      const id=event.detail?.id||'default';
      badge.hidden=false;
      q('[data-workspace-name]',badge).textContent=id==='sample'?'가상 샘플 · 실제 작업 기록과 분리됨':`${friendlyWorkspace(id)} · 이 작업공간에만 진행 기록 저장`;
    });

    document.addEventListener('change',event=>{
      const input=event.target.closest?.('#zipInput');
      const file=input?.files?.[0];
      if(!file) return;
      badge.hidden=false;
      q('[data-workspace-name]',badge).textContent=`${friendlyWorkspace(workspaceFromFilename(file.name))} · 분석 준비 중`;
    },true);
  }

  function addFileSafetyNote(){
    const drop=q('.drop');
    if(!drop||q('.fileSafetyV12')) return;
    const note=document.createElement('div');
    note.className='fileSafetyV12';
    note.innerHTML='<span aria-hidden="true">◇</span><span><b>안전 제한:</b> ZIP 80MB 이하 · JSON 전체 50MB 이하 · 최대 50,000계정. 전체 Instagram 백업 대신 “팔로워 및 팔로잉”만 내려받아 주세요.</span>';
    drop.after(note);
  }

  function bindPreflightChecks(){
    document.addEventListener('change',event=>{
      const input=event.target.closest?.('#zipInput');
      const file=input?.files?.[0];
      if(!file) return;
      if(file.size>MAX_ZIP_BYTES){
        event.preventDefault();
        event.stopImmediatePropagation();
        input.value='';
        showInputError('ZIP 파일이 80MB를 초과합니다. Instagram 다운로드에서 “팔로워 및 팔로잉” 항목만 선택해 다시 받아주세요.');
      }
    },true);

    document.addEventListener('drop',event=>{
      const file=event.dataTransfer?.files?.[0];
      if(!file||file.size<=MAX_ZIP_BYTES) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showInputError('ZIP 파일이 80MB를 초과합니다. 필요한 팔로워 및 팔로잉 데이터만 다시 내려받아 주세요.');
    },true);
  }

  function showInputError(message){
    const box=q('#errorBox');
    if(box){box.textContent=message;box.classList.remove('hidden');}
    const status=q('#loadStatus');
    if(status) status.textContent='파일을 확인해 주세요';
    box?.scrollIntoView({behavior:'smooth',block:'center'});
  }

  function bindActiveNavigation(){
    const nav=q('.bottomNavV8');
    if(!nav) return;
    const links=qa('a',nav);
    links.forEach(link=>link.addEventListener('click',()=>{
      links.forEach(item=>item.classList.remove('active','isActive'));
      link.classList.add('active');
    }));

    const targets=links.map(link=>{
      const selector=link.getAttribute('href');
      return {link,element:selector?.startsWith('#')?q(selector):null};
    }).filter(item=>item.element);
    if(!targets.length||!('IntersectionObserver' in window)) return;
    const observer=new IntersectionObserver(entries=>{
      const current=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(!current) return;
      const target=targets.find(item=>item.element===current.target);
      if(!target) return;
      links.forEach(item=>item.classList.remove('active','isActive'));
      target.link.classList.add('active');
    },{rootMargin:'-18% 0px -65% 0px',threshold:[0,.1,.35]});
    targets.forEach(item=>observer.observe(item.element));
    links[0]?.classList.add('active');
  }

  function watchDynamicUI(){
    new MutationObserver(()=>{
      clearTimeout(observerTimer);
      observerTimer=setTimeout(()=>{
        normalizeMobileNavigation();
        improveAccessibility();
      },80);
    }).observe(document.body,{subtree:true,childList:true});
  }

  function workspaceFromFilename(filename){
    let value=String(filename||'').replace(/\.zip$/i,'').toLowerCase();
    if(/^instagram[-_]lava[-_]demo[-_]/.test(value)) return 'sample';
    value=value.replace(/^instagram[-_]?/,'');
    value=value.replace(/[-_](?:19|20)\d{2}[-_]\d{1,2}[-_]\d{1,2}.*$/,'');
    value=value.replace(/[-_]\d{8}.*$/,'');
    value=value.replace(/[^a-z0-9._-]+/g,'_').replace(/^[_-]+|[_-]+$/g,'').slice(0,80);
    return value||'default';
  }

  function friendlyWorkspace(id){
    return id.replaceAll('_',' ').replaceAll('-',' ').replace(/\s+/g,' ').trim()||'기본 작업공간';
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
