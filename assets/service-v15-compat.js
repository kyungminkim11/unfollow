(()=>{
  'use strict';

  const q=(selector,root=document)=>root.querySelector(selector);
  const qa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  let timer=0;
  let observer;

  function visible(element){
    const style=getComputedStyle(element);
    const box=element.getBoundingClientRect();
    return !element.hidden&&style.display!=='none'&&style.visibility!=='hidden'&&box.width>0&&box.height>0;
  }

  function disableDuplicate(element){
    if(element.classList.contains('mobileTopV8')) element.classList.remove('mobileTopV8');
    if(!element.classList.contains('v14DuplicateMobileHeader')) element.classList.add('v14DuplicateMobileHeader');
    if(element.getAttribute('aria-hidden')!=='true') element.setAttribute('aria-hidden','true');
    if(!element.hasAttribute('inert')) element.setAttribute('inert','');
  }

  function normalizeMobileHeader(){
    if(!matchMedia('(max-width:760px)').matches) return;
    const marked=qa('.mobileTopV8');
    if(!marked.length) return;

    const preferred=marked.find(element=>!element.classList.contains('v14DuplicateMobileHeader')&&visible(element))
      || marked.find(element=>!element.classList.contains('v14DuplicateMobileHeader'))
      || marked[marked.length-1];

    if(!preferred.classList.contains('mobileTopV8')) preferred.classList.add('mobileTopV8');
    preferred.classList.remove('v14DuplicateMobileHeader');
    preferred.removeAttribute('aria-hidden');
    preferred.removeAttribute('inert');

    marked.filter(element=>element!==preferred).forEach(disableDuplicate);

    qa('header,[class*="mobile" i],[class*="Mobile"]').filter(element=>{
      if(element===preferred||element.closest('.sidebar')||element.closest('.bottomNavV8')||element.classList.contains('v14DuplicateMobileHeader')) return false;
      const text=(element.textContent||'').replace(/\s+/g,' ').trim();
      const box=element.getBoundingClientRect();
      return text.includes('맞팔체커')&&box.width>=innerWidth*.75&&box.height>=36&&box.height<=90&&box.top<=150;
    }).forEach(disableDuplicate);
  }

  function normalizeBottomNavigation(){
    const existing=q('.bottomNavV8');
    if(!existing) return;

    qa('.v15MobileNav:not(.bottomNavV8)').forEach(element=>element.remove());
    if(existing.dataset.v15Normalized==='true') return;

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
      const currentLabel=q('span',item)?.textContent||'';
      const currentDescription=q('small',item)?.textContent||'';
      if(currentLabel===label&&currentDescription===description) return;
      item.replaceChildren();
      const span=document.createElement('span');
      span.textContent=label;
      const small=document.createElement('small');
      small.textContent=description;
      item.append(span,small);
    });
    existing.dataset.v15Normalized='true';
  }

  function normalizeUploadInput(){
    const input=q('#zipInput');
    const trust=q('.v15TrustGrid');
    if(!input||!trust) return;
    input.setAttribute('accept','.zip,application/zip');
    input.setAttribute('aria-describedby','v15UploadHelp');
    if(q('#v15UploadHelp')) return;
    const help=document.createElement('p');
    help.id='v15UploadHelp';
    help.className='v15UploadHelp';
    help.innerHTML='지원 형식: Instagram JSON ZIP · 최대 80MB · <a href="/guide/">데이터 받는 방법</a>';
    trust.after(help);
  }

  function apply(){
    normalizeMobileHeader();
    normalizeBottomNavigation();
    normalizeUploadInput();
  }

  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(apply,80);
  }

  function start(){
    apply();
    setTimeout(apply,300);
    setTimeout(apply,1000);
    observer=new MutationObserver(schedule);
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer?.disconnect(),8000);
    addEventListener('resize',schedule,{passive:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
