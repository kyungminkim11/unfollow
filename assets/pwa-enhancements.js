(()=>{
  const q=s=>document.querySelector(s);
  const start=()=>{
    const offline=document.createElement('aside');
    offline.className='offlineBanner';
    offline.setAttribute('role','status');
    offline.setAttribute('aria-live','polite');
    offline.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M8.5 8.4A10 10 0 0 1 20 10.2M4 10.2a12 12 0 0 1 2.3-1.4M7.2 14a7.2 7.2 0 0 1 8.2-.9M10.5 17.3a2.8 2.8 0 0 1 3 0M12 20h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="offlineBannerText">오프라인 모드 · ZIP 분석은 계속 가능해요</span><button type="button" class="offlineBannerClose" aria-label="오프라인 안내 닫기">×</button>';
    document.body.appendChild(offline);

    let checking=false;
    let failures=0;
    let dismissed=false;
    let retryTimer=0;
    const hide=()=>offline.classList.remove('show');
    const show=()=>{if(!dismissed) offline.classList.add('show');};
    q('.offlineBannerClose')?.addEventListener('click',()=>{dismissed=true;hide();});

    const confirmConnection=async({retry=true}={})=>{
      if(checking) return;
      checking=true;
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),4200);
      try{
        const response=await fetch(`/favicon.svg?connectivity=${Date.now()}`,{
          method:'GET',
          cache:'no-store',
          credentials:'omit',
          signal:controller.signal,
        });
        if(!response.ok) throw new Error('connectivity check failed');
        failures=0;
        dismissed=false;
        hide();
      }catch{
        failures+=1;
        if(failures>=2) show();
        else if(retry){
          clearTimeout(retryTimer);
          retryTimer=setTimeout(()=>confirmConnection({retry:false}),900);
        }
      }finally{
        clearTimeout(timeout);
        checking=false;
      }
    };

    addEventListener('online',()=>{
      failures=0;
      dismissed=false;
      hide();
      confirmConnection();
    });
    addEventListener('offline',()=>{
      failures=0;
      setTimeout(()=>confirmConnection(),350);
    });
    if(!navigator.onLine) confirmConnection();

    let promptEvent=null;
    addEventListener('beforeinstallprompt',event=>{
      event.preventDefault();
      promptEvent=event;
      const actions=q('.serviceTopActions');
      if(!actions||q('#installAppBtn')) return;
      const button=document.createElement('button');
      button.id='installAppBtn';
      button.type='button';
      button.textContent='앱으로 설치';
      button.addEventListener('click',async()=>{
        await promptEvent?.prompt();
        promptEvent=null;
        button.remove();
      });
      actions.prepend(button);
    });

    addEventListener('unhandledrejection',event=>notify(friendly(event.reason)));
    addEventListener('error',event=>{if(event.message) notify(friendly(event.error||event.message));});
  };

  function friendly(error){
    const text=String(error&&error.message||error||'');
    if(/followers?_\d+\.json|following\.json/i.test(text)) return 'ZIP에서 팔로워 또는 팔로잉 JSON 파일을 찾지 못했습니다.';
    if(/json/i.test(text)) return 'JSON 형식을 읽지 못했습니다. Instagram 다운로드 형식을 JSON으로 선택했는지 확인해 주세요.';
    if(/zip|archive|central directory/i.test(text)) return 'ZIP 파일이 손상됐거나 지원하지 않는 형식입니다.';
    return '처리 중 문제가 발생했습니다. 파일 형식과 기간 설정을 확인한 뒤 다시 시도해 주세요.';
  }

  function notify(message){
    if(typeof window.unfollowToast==='function') window.unfollowToast(message);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
