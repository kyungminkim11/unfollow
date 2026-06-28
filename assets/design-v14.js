(()=>{
  'use strict';

  const VERSION='14.0';
  const q=(selector,root=document)=>root.querySelector(selector);
  const qa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  let decorateTimer=0;
  let observer;

  function addStylesheet(href,key){
    if(q(`link[data-design-style="${key}"]`)) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.dataset.designStyle=key;
    if(key==='main') link.dataset.designV14='true';
    document.head.appendChild(link);
  }

  function loadStylesheets(){
    addStylesheet('/assets/design-v14.css?v=14.3','main');
    addStylesheet('/assets/design-v14-fixes.css?v=14.3','fixes');
  }

  function updateVisibleVersion(){
    qa('body *').forEach(element=>{
      if(element.children.length) return;
      const text=element.textContent.trim();
      if(/^v(?:10|11|12|13|14)(?:\.\d+)?$/i.test(text)) element.textContent=`v${VERSION}`;
      else if(text.length<=18&&/\bv13\b/i.test(text)) element.textContent=text.replace(/\bv13\b/i,'v14');
    });
  }

  function findResourceBar(primary){
    const action=qa('a,button',primary).find(element=>/Instagram 데이터 다운로드/.test(element.textContent||''));
    if(!action) return null;
    const named=action.closest('.resourceBar,.resourceLinks,.resourceActions');
    if(named) return named;
    const parent=action.parentElement;
    if(parent&&parent!==primary&&qa('a,button',parent).length>=2) return parent;
    return null;
  }

  function findSummaryGrid(aside){
    const direct=q('.heroSummaryV8,.summaryGrid,.resultSummary',aside);
    if(direct) return direct;
    const candidates=qa('div,section',aside).filter(element=>{
      if(element===aside||element.closest('.v10Steps')) return false;
      const text=(element.textContent||'').replace(/\s+/g,' ');
      const matchingLabels=['전체 팔로잉','맞팔','취소 검토','팔로워만'].filter(label=>text.includes(label)).length;
      return matchingLabels>=3&&element.children.length>=2;
    });
    return candidates.sort((a,b)=>{
      const areaA=a.getBoundingClientRect().width*a.getBoundingClientRect().height;
      const areaB=b.getBoundingClientRect().width*b.getBoundingClientRect().height;
      return areaA-areaB;
    })[0]||null;
  }

  function findSecondaryGuide(aside){
    const direct=q('.quickStart',aside);
    if(direct) return direct;
    const candidates=qa('div,section,ol',aside).filter(element=>{
      if(element===aside||element.closest('.v10Steps')||q('.v10Steps',element)||element.classList.contains('v14SummaryGrid')) return false;
      const text=(element.textContent||'').replace(/\s+/g,' ');
      return text.includes('Instagram 데이터 다운로드')&&text.includes('ZIP 파일 업로드')&&/결과 확인|직접 처리/.test(text);
    });
    return candidates.sort((a,b)=>(a.textContent||'').length-(b.textContent||'').length)[0]||null;
  }

  function decorateHero(){
    const hero=q('.hero');
    if(!hero) return;
    hero.classList.add('v14Hero');

    const children=Array.from(hero.children).filter(element=>element.nodeType===1);
    const primary=children.find(element=>q('h1',element)||q('.drop',element))||children[0];
    const aside=children.find(element=>element!==primary)||children[1];

    primary?.classList.add('v14HeroPrimary');
    aside?.classList.add('v14HeroAside');
    q('.drop',primary)?.classList.add('v14PrimaryDrop');
    findResourceBar(primary)?.classList.add('v14ResourceBar');
    findSummaryGrid(aside)?.classList.add('v14SummaryGrid');
    q('.v10Steps',aside)?.classList.add('v14StepStrip');

    if(aside){
      const secondaryGuide=findSecondaryGuide(aside);
      if(secondaryGuide&&secondaryGuide!==aside) secondaryGuide.classList.add('v14SecondaryGuide');
    }
  }

  function decorateTopbar(){
    const topbar=q('.serviceTopbar,.topbar');
    if(!topbar||q('.v14LocalChip',topbar)) return;
    const chip=document.createElement('span');
    chip.className='v14LocalChip';
    chip.innerHTML='<i aria-hidden="true"></i><span>브라우저 로컬 분석</span>';
    chip.setAttribute('title','선택한 ZIP 파일은 외부 서버로 전송되지 않습니다.');
    const actions=q('.serviceTopActions,.topActions',topbar);
    if(actions) topbar.insertBefore(chip,actions);
    else topbar.appendChild(chip);
  }

  function mobileHeaderCandidates(){
    if(!matchMedia('(max-width:760px)').matches) return [];
    const raw=qa('header,[class*="mobile" i],[class*="Mobile"]');
    return raw.filter(element=>{
      if(element.closest('.sidebar')||element.classList.contains('v14DuplicateMobileHeader')) return false;
      const text=(element.textContent||'').replace(/\s+/g,' ').trim();
      if(!text.includes('맞팔체커')) return false;
      const box=element.getBoundingClientRect();
      if(box.width<innerWidth*.75||box.height<36||box.height>90||box.top>150) return false;
      return qa('button,a',element).length>0;
    }).filter((element,index,array)=>{
      return !array.some((other,otherIndex)=>otherIndex!==index&&other.contains(element));
    });
  }

  function dedupeMobileHeaders(){
    const candidates=mobileHeaderCandidates();
    if(candidates.length<=1) return;
    const score=element=>qa('button,a',element).length*20+element.children.length+element.getBoundingClientRect().top/100;
    const keep=[...candidates].sort((a,b)=>score(b)-score(a))[0];
    keep.classList.add('mobileTopV8');
    keep.classList.remove('v14DuplicateMobileHeader');
    keep.removeAttribute('aria-hidden');
    candidates.filter(element=>element!==keep).forEach(element=>{
      element.classList.add('v14DuplicateMobileHeader');
      element.setAttribute('aria-hidden','true');
    });
  }

  function decorateSidebar(){
    const sidebar=q('.sidebar');
    if(!sidebar) return;
    sidebar.classList.add('v14Sidebar');
    const nav=q('.serviceNav',sidebar)||q('.nav',sidebar);
    nav?.classList.add('v14Nav');
    qa('a,button',nav).forEach((item,index)=>item.dataset.v14NavIndex=String(index));
  }

  function decorateCards(){
    qa('.dashboard .stat').forEach((card,index)=>card.style.setProperty('--v14-stat-index',String(index)));
    q('#compareV13')?.classList.add('v14Compare');
    q('#beginnerGuide')?.classList.add('v14GuideSection');
    q('#faq')?.classList.add('v14FaqSection');
  }

  function decorate(){
    decorateHero();
    decorateTopbar();
    dedupeMobileHeaders();
    decorateSidebar();
    decorateCards();
    updateVisibleVersion();
  }

  function scheduleDecorate(){
    clearTimeout(decorateTimer);
    decorateTimer=setTimeout(decorate,80);
  }

  function start(){
    document.body.classList.add('design-v14');
    document.documentElement.classList.add('design-v14-ready');
    loadStylesheets();
    decorate();
    setTimeout(decorate,300);
    setTimeout(decorate,900);

    observer=new MutationObserver(scheduleDecorate);
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer?.disconnect(),8000);
    addEventListener('resize',scheduleDecorate,{passive:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
