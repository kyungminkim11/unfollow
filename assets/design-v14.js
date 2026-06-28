(()=>{
  'use strict';

  const VERSION='14.0';
  const q=(selector,root=document)=>root.querySelector(selector);
  const qa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  let decorateTimer=0;
  let observer;

  function loadStylesheet(){
    if(q('link[data-design-v14]')) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/assets/design-v14.css?v=14.0';
    link.dataset.designV14='true';
    document.head.appendChild(link);
  }

  function updateVisibleVersion(){
    qa('body *').forEach(element=>{
      if(element.children.length) return;
      if(/^v(?:10|11|12|13)(?:\.\d+)?$/i.test(element.textContent.trim())){
        element.textContent=`v${VERSION}`;
      }
    });
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
    q('.resourceBar',primary)?.classList.add('v14ResourceBar');
    q('.heroSummaryV8',aside)?.classList.add('v14SummaryGrid');
    q('.v10Steps',aside)?.classList.add('v14StepStrip');

    if(aside){
      const secondaryGuide=q('.quickStart',aside)||qa('h2,h3,strong',aside).find(element=>/처음이라면|3단계만/.test(element.textContent||''))?.parentElement;
      if(secondaryGuide&&secondaryGuide!==aside) secondaryGuide.classList.add('v14SecondaryGuide');
    }
  }

  function decorateTopbar(){
    const topbar=q('.serviceTopbar');
    if(!topbar||q('.v14LocalChip',topbar)) return;
    const chip=document.createElement('span');
    chip.className='v14LocalChip';
    chip.innerHTML='<i aria-hidden="true"></i><span>브라우저 로컬 분석</span>';
    chip.setAttribute('title','선택한 ZIP 파일은 외부 서버로 전송되지 않습니다.');
    const actions=q('.serviceTopActions',topbar);
    if(actions) topbar.insertBefore(chip,actions);
    else topbar.appendChild(chip);
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
    decorateSidebar();
    decorateCards();
    updateVisibleVersion();
  }

  function scheduleDecorate(){
    clearTimeout(decorateTimer);
    decorateTimer=setTimeout(decorate,60);
  }

  function start(){
    document.body.classList.add('design-v14');
    document.documentElement.classList.add('design-v14-ready');
    loadStylesheet();
    decorate();

    observer=new MutationObserver(scheduleDecorate);
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer?.disconnect(),8000);
    addEventListener('resize',scheduleDecorate,{passive:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
