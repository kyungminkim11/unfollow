(()=>{
  const MOBILE_QUERY='(max-width:760px)';
  let observer;
  let timer=0;

  const isMobile=()=>matchMedia(MOBILE_QUERY).matches;

  function loadHeaderFixStyles(){
    if(document.querySelector('link[data-v19-header-fix]')) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/assets/mobile-app-v19-header.css?v=19.1';
    link.dataset.v19HeaderFix='true';
    document.head.appendChild(link);
  }

  function labelActions(){
    document.querySelectorAll('.serviceTopActions a,.serviceTopActions button').forEach(item=>{
      const text=(item.textContent||'').trim();
      if(!item.getAttribute('aria-label')){
        if(/도움|가이드|\?/.test(text)||item.matches('a[href*="help"],a[href*="guide"]')) item.setAttribute('aria-label','도움말');
        else if(/다크|모드|테마|☾|🌙/.test(text)||item.tagName==='BUTTON') item.setAttribute('aria-label','화면 모드');
      }
      if(item.matches('a[href*="help"],a[href*="guide"]')) item.title='도움말';
      if(item.tagName==='BUTTON'&&!item.id) item.title='화면 모드';
    });
  }

  function hideDuplicateHeaders(){
    if(!isMobile()) return;
    const primary=document.querySelector('.sidebar');
    if(!primary) return;

    const candidates=new Set([
      ...document.querySelectorAll('.mobileTopV8,.v14DuplicateMobileHeader,.mobileHeader,.mobileTopbar,[class*="mobileTop"],[class*="MobileTop"],[class*="mobileHeader"],[class*="MobileHeader"],header')
    ]);

    candidates.forEach(element=>{
      if(!(element instanceof HTMLElement)) return;
      if(element===primary||primary.contains(element)||element.contains(primary)) return;
      if(element.closest('.serviceTopbar,.bottomNavV8,.v15MobileNav')) return;

      const text=(element.textContent||'').replace(/\s+/g,' ').trim();
      const rect=element.getBoundingClientRect();
      const looksLikeDuplicate=/맞팔체커|Instagram 관계 분석 도구/i.test(text)
        && rect.top<190
        && rect.width>innerWidth*.55
        && rect.height>24
        && rect.height<110;

      if(looksLikeDuplicate||element.classList.contains('v14DuplicateMobileHeader')){
        element.classList.add('v19DuplicateHeader');
        element.setAttribute('aria-hidden','true');
        element.setAttribute('inert','');
      }
    });
  }

  function moveUploadFirst(){
    const drop=document.querySelector('.v14PrimaryDrop,[data-upload-zone],.dropZone,.uploadArea');
    const steps=document.querySelector('.v10Steps,.v15StepList,.heroSteps');
    const lead=document.querySelector('.v14HeroPrimary .lead,.hero .lead');
    if(drop&&steps&&lead&&isMobile()){
      if(lead.nextElementSibling!==drop) lead.insertAdjacentElement('afterend',drop);
      drop.classList.add('v19UploadFirst');
      steps.classList.add('v19StepsAfterUpload');
    }
    if(drop&&!drop.querySelector('[data-v19-mobile-hint]')){
      const hint=document.createElement('span');
      hint.dataset.v19MobileHint='true';
      hint.textContent='휴대폰 파일 앱에서 Instagram JSON ZIP을 선택하세요.';
      hint.className='v19MobileUploadHint';
      drop.appendChild(hint);
    }
  }

  function normalize(){
    document.documentElement.classList.add('mobile-app-v19-ready');
    document.body.classList.add('mobile-app-v19');
    labelActions();
    hideDuplicateHeaders();
    moveUploadFirst();
  }

  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(normalize,70);
  }

  function start(){
    loadHeaderFixStyles();
    normalize();
    setTimeout(normalize,300);
    setTimeout(normalize,1000);
    observer=new MutationObserver(schedule);
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer?.disconnect(),6000);
    addEventListener('resize',schedule,{passive:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
