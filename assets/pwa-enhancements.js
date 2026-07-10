(()=>{
  const q=s=>document.querySelector(s);
  const start=()=>{
    const offline=document.createElement('div');
    offline.className='offlineBanner';
    offline.setAttribute('role','status');
    offline.setAttribute('aria-live','polite');
    offline.textContent='인터넷 연결이 끊겼습니다. ZIP 분석은 계속 사용할 수 있습니다.';
    document.body.appendChild(offline);

    let checking=false;
    const confirmConnection=async()=>{
      if(checking) return;
      checking=true;
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),4500);
      try{
        const response=await fetch(`/favicon.svg?connectivity=${Date.now()}`,{
          method:'HEAD',
          cache:'no-store',
          signal:controller.signal,
        });
        offline.classList.toggle('show',!response.ok);
      }catch{
        offline.classList.add('show');
      }finally{
        clearTimeout(timeout);
        checking=false;
      }
    };

    addEventListener('online',()=>{
      offline.classList.remove('show');
      confirmConnection();
    });
    addEventListener('offline',()=>setTimeout(confirmConnection,700));
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
