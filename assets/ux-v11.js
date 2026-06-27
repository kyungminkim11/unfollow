(()=>{
  const q=(selector,root=document)=>root.querySelector(selector);
  const qa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const mobileQuery=matchMedia('(max-width:760px)');
  let resultObserver=null;
  let scrollObserver=null;

  const start=()=>{
    document.body.classList.add('ux-v11');
    document.documentElement.classList.add('ux-v11-ready');
    updateVisibleVersion();
    prepareAnchors();
    setupMobileFilters();
    setupMobileResultSummary();
    setupBottomNavigation();
    setupScrollableHints();
    improveControlLabels();
    syncResponsiveState();

    mobileQuery.addEventListener?.('change',syncResponsiveState);
    addEventListener('resize',debounce(()=>{
      syncResponsiveState();
      updateScrollableHints();
    },120));

    document.addEventListener('change',event=>{
      if(event.target.closest?.('.topTools,.panelHeader')){
        updateFilterToggle();
        setTimeout(updateMobileResultSummary,30);
      }
    });
    document.addEventListener('input',event=>{
      if(event.target.closest?.('.topTools,.panelHeader')) setTimeout(updateMobileResultSummary,30);
    });
    document.addEventListener('click',event=>{
      if(event.target.closest?.('.tab')){
        setTimeout(updateMobileResultSummary,30);
        if(mobileQuery.matches) document.body.classList.remove('mobileFiltersOpen');
        updateFilterToggle();
      }
    });

    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&document.body.classList.contains('mobileFiltersOpen')){
        document.body.classList.remove('mobileFiltersOpen');
        updateFilterToggle();
        q('.mobileFilterToggle')?.focus();
      }
    });
  };

  function updateVisibleVersion(){
    qa('body *').forEach(element=>{
      if(element.children.length) return;
      const text=element.textContent.trim();
      if(/^v10(?:\.\d+)?$/i.test(text)) element.textContent='v11.0';
    });
  }

  function prepareAnchors(){
    const anchors=[q('#top'),q('#appPanel'),q('#beginnerGuide'),q('#faq')].filter(Boolean);
    anchors.forEach(element=>element.classList.add('sectionAnchorV11'));
  }

  function setupMobileFilters(){
    const tools=q('.topTools');
    if(!tools||q('.mobileFilterToggle')) return;

    const search=q('.search',tools)||q('input[type="search"],input[placeholder*="검색"]',tools);
    let searchHost=search;
    while(searchHost&&searchHost.parentElement!==tools) searchHost=searchHost.parentElement;
    if(searchHost&&searchHost.parentElement===tools) searchHost.classList.add('mobilePrimarySearch');

    const button=document.createElement('button');
    button.type='button';
    button.className='mobileFilterToggle';
    button.setAttribute('aria-controls','mobileFilterControlsV11');
    button.setAttribute('aria-expanded','false');
    button.innerHTML='<span>필터 및 정렬</span><span data-filter-count>펼치기</span>';
    tools.id=tools.id||'mobileFilterControlsV11';
    tools.before(button);

    button.addEventListener('click',()=>{
      document.body.classList.toggle('mobileFiltersOpen');
      updateFilterToggle();
      if(document.body.classList.contains('mobileFiltersOpen')){
        setTimeout(()=>tools.querySelector('select,button:not(.mobileFilterToggle)')?.focus(),100);
      }
    });
    updateFilterToggle();
  }

  function updateFilterToggle(){
    const button=q('.mobileFilterToggle');
    const tools=q('.topTools');
    if(!button||!tools) return;

    const count=activeFilterCount(tools);
    const open=document.body.classList.contains('mobileFiltersOpen');
    button.setAttribute('aria-expanded',String(open));
    const status=q('[data-filter-count]',button);
    if(status) status.textContent=open?'접기':count?`${count}개 적용`:'펼치기';
  }

  function activeFilterCount(tools){
    let count=0;
    qa('select',tools).forEach(select=>{
      if(select.selectedIndex>0&&select.value!==''&&select.value!=='all') count++;
    });
    qa('input[type="checkbox"]',tools.parentElement||tools).forEach(input=>{
      if(input.checked) count++;
    });
    return count;
  }

  function setupMobileResultSummary(){
    const list=q('.mobileList');
    const tableBody=q('.table tbody');
    const tableWrap=q('.tableWrap');
    const host=list?.parentElement||tableWrap?.parentElement;
    if(!host||q('.mobileResultSummary',host)) return;

    const summary=document.createElement('div');
    summary.className='mobileResultSummary';
    summary.setAttribute('role','status');
    summary.setAttribute('aria-live','polite');
    summary.innerHTML='<span>현재 결과</span><strong data-mobile-result-count>0개</strong>';
    if(list) list.before(summary); else tableWrap.before(summary);

    const observed=list||tableBody;
    if(observed){
      resultObserver=new MutationObserver(debounce(updateMobileResultSummary,60));
      resultObserver.observe(observed,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden']});
    }
    updateMobileResultSummary();
  }

  function updateMobileResultSummary(){
    const output=q('[data-mobile-result-count]');
    if(!output) return;

    const visibleCards=qa('.mobileList .userCard,.mobileList>[data-username],.mobileList>article').filter(isVisible);
    const visibleRows=qa('.table tbody tr').filter(isVisible);
    const count=visibleCards.length||visibleRows.length;
    const activeTab=q('.tab.active');
    const tabText=activeTab?.textContent?.trim().replace(/\s+/g,' ')||'';
    const next=tabText?`${tabText} · ${count}명`:`${count}명`;
    if(output.textContent!==next) output.textContent=next;
  }

  function setupBottomNavigation(){
    const nav=q('.bottomNavV8');
    if(!nav) return;

    const links=qa('a',nav);
    links.forEach(link=>{
      link.addEventListener('click',()=>{
        links.forEach(item=>item.classList.remove('active'));
        link.classList.add('active');
      });
    });

    const map=[
      ['#top',links[0]],
      ['#appPanel',links[1]],
      ['.focusPanel',links[2]],
      ['#faq',links[3]]
    ].filter(([,link])=>link);

    const elements=map.map(([selector,link])=>({element:q(selector),link})).filter(item=>item.element);
    if(!elements.length) return;

    scrollObserver?.disconnect();
    scrollObserver=new IntersectionObserver(entries=>{
      const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(!visible) return;
      const match=elements.find(item=>item.element===visible.target);
      if(!match) return;
      links.forEach(link=>link.classList.remove('active'));
      match.link.classList.add('active');
    },{rootMargin:'-18% 0px -64% 0px',threshold:[0,.1,.35]});
    elements.forEach(item=>scrollObserver.observe(item.element));
    links[0]?.classList.add('active');
  }

  function setupScrollableHints(){
    const panel=q('.panelHeader');
    const tabs=q('.tabs');
    if(panel&&tabs&&!q('.mobileScrollHint',panel)){
      const hint=document.createElement('div');
      hint.className='mobileScrollHint';
      hint.textContent='필터는 좌우로 넘겨볼 수 있어요 →';
      tabs.before(hint);
    }
    updateScrollableHints();
  }

  function updateScrollableHints(){
    qa('.mobileScrollHint').forEach(hint=>{
      const tabs=q('.tabs',hint.parentElement)||q('.tabs');
      hint.hidden=!(mobileQuery.matches&&tabs&&tabs.scrollWidth>tabs.clientWidth+4);
    });
  }

  function improveControlLabels(){
    qa('input,select,textarea').forEach(control=>{
      if(!control.getAttribute('aria-label')&&!control.id){
        const placeholder=control.getAttribute('placeholder');
        if(placeholder) control.setAttribute('aria-label',placeholder);
      }
    });
    qa('.btn,button').forEach(button=>{
      if(!button.getAttribute('aria-label')&&!button.textContent.trim()) button.setAttribute('aria-label','기능 실행');
    });
  }

  function syncResponsiveState(){
    if(!mobileQuery.matches) document.body.classList.remove('mobileFiltersOpen');
    updateFilterToggle();
    updateMobileResultSummary();
    updateScrollableHints();
  }

  function isVisible(element){
    if(element.hidden||element.classList.contains('hidden')) return false;
    const style=getComputedStyle(element);
    return style.display!=='none'&&style.visibility!=='hidden';
  }

  function debounce(fn,delay){
    let timer;
    return (...args)=>{
      clearTimeout(timer);
      timer=setTimeout(()=>fn(...args),delay);
    };
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
