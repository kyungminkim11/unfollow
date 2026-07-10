(()=>{
  'use strict';

  const q=(selector,root=document)=>root.querySelector(selector);
  const qa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  let timer=0;

  function normalizeMobileHeader(){
    const preferred=q('.mobileTopV8');
    if(!preferred) return;
    preferred.classList.remove('v14DuplicateMobileHeader');
    preferred.removeAttribute('aria-hidden');

    if(!matchMedia('(max-width:760px)').matches) return;
    const candidates=qa('header,[class*="mobile" i],[class*="Mobile"]').filter(element=>{
      if(element===preferred||element.closest('.sidebar')||element.closest('.bottomNavV8')) return false;
      const text=(element.textContent||'').replace(/\s+/g,' ').trim();
      const box=element.getBoundingClientRect();
      return text.includes('맞팔체커')&&box.width>=innerWidth*.75&&box.height>=36&&box.height<=90&&box.top<=150;
    });
    candidates.forEach(element=>{
      element.classList.add('v14DuplicateMobileHeader');
      element.setAttribute('aria-hidden','true');
    });
  }

  function normalizeBottomNavigation(){
    const existing=q('.bottomNavV8');
    if(!existing) return;

    qa('.v15MobileNav:not(.bottomNavV8)').forEach(element=>element.remove());
    existing.classList.add('v15MobileNav');
    existing.setAttribute('aria-label','모바일 주요 메뉴');

    const map=[
      ['/#top','분석','ZIP 선택'],
      ['/#appPanel','결과','관계 목록'],
      ['/#compareV13','비교','변화 확인'],
      ['/help/','도움말','문제 해결']
    ];
    qa('a,button',existing).slice(0,4).forEach((item,index)=>{
      const [href,label,description]=map[index];
      item.classList.add('v15NavItem');
      if(item.tagName==='A') item.setAttribute('href',href);
      item.replaceChildren();
      const span=document.createElement('span');
      span.textContent=label;
      const small=document.createElement('small');
      small.textContent=description;
      item.append(span,small);
    });
  }

  function apply(){
    normalizeMobileHeader();
    normalizeBottomNavigation();
  }

  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(apply,60);
  }

  function start(){
    apply();
    setTimeout(apply,300);
    setTimeout(apply,1000);
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    addEventListener('resize',schedule,{passive:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
