(()=>{
  const start=()=>{
    document.documentElement.classList.add('mobile-app-v19-ready');
    document.body.classList.add('mobile-app-v19');

    document.querySelectorAll('.serviceTopActions a,.serviceTopActions button').forEach(item=>{
      const text=(item.textContent||'').trim();
      if(!item.getAttribute('aria-label')){
        if(/도움|가이드|\?/.test(text)||item.matches('a[href*="help"],a[href*="guide"]')) item.setAttribute('aria-label','도움말');
        else if(/다크|모드|테마|☾|🌙/.test(text)||item.tagName==='BUTTON') item.setAttribute('aria-label','화면 모드');
      }
      if(item.matches('a[href*="help"],a[href*="guide"]')) item.title='도움말';
      if(item.tagName==='BUTTON'&&!item.id) item.title='화면 모드';
    });

    const drop=document.querySelector('.v14PrimaryDrop,[data-upload-zone],.dropZone,.uploadArea');
    if(drop&&!drop.querySelector('[data-v19-mobile-hint]')){
      const hint=document.createElement('span');
      hint.dataset.v19MobileHint='true';
      hint.textContent='휴대폰 파일 앱에서 Instagram JSON ZIP을 선택하세요.';
      hint.className='v19MobileUploadHint';
      drop.appendChild(hint);
    }
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
