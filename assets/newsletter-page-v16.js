(()=>{
  'use strict';
  const ENDPOINT='https://jnciddblcndmthmmvqrz.supabase.co/functions/v1/unfollow-newsletter';

  async function tokenUnsubscribe(){
    const token=new URLSearchParams(location.search).get('unsubscribe_token')||'';
    if(!token) return;
    const form=document.querySelector('form[data-newsletter-action="unsubscribe"]');
    const result=form?.querySelector('[data-newsletter-result]');
    const submit=form?.querySelector('button[type="submit"]');
    const email=form?.querySelector('input[name="email"]');
    if(!form||!result||!submit) return;
    result.textContent='뉴스레터 수신 해지를 처리하는 중입니다.';
    result.dataset.state='';
    submit.disabled=true;
    if(email) email.disabled=true;
    try{
      const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'token_unsubscribe',token})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data.ok!==true) throw new Error(data.message||'수신 해지를 처리하지 못했습니다.');
      result.textContent=data.message||'뉴스레터 수신 해지가 완료되었습니다.';
      result.dataset.state='success';
      submit.textContent='수신 해지 완료';
      localStorage.removeItem('unfollow_newsletter_subscribed_v16');
      history.replaceState(null,'',`${location.pathname}#unsubscribe`);
    }catch(error){
      result.textContent=error?.message||'수신 해지 처리 중 문제가 발생했습니다. 이메일을 직접 입력해 다시 시도해 주세요.';
      result.dataset.state='error';
      submit.disabled=false;
      if(email) email.disabled=false;
      history.replaceState(null,'',`${location.pathname}#unsubscribe`);
    }
  }

  document.querySelectorAll('form[data-newsletter-action]').forEach(form=>{
    let startedAt=Date.now();
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const action=form.dataset.newsletterAction==='unsubscribe'?'unsubscribe':'subscribe';
      const email=form.querySelector('input[name="email"]')?.value.trim()||'';
      const result=form.querySelector('[data-newsletter-result]');
      const submit=form.querySelector('button[type="submit"]');
      const privacyConsent=action==='subscribe'?Boolean(form.querySelector('input[name="privacyConsent"]')?.checked):false;
      const marketingConsent=action==='subscribe'?Boolean(form.querySelector('input[name="marketingConsent"]')?.checked):false;

      if(!email||(action==='subscribe'&&(!privacyConsent||!marketingConsent))){
        result.textContent=action==='subscribe'?'이메일과 필수 동의를 확인해 주세요.':'이메일 주소를 확인해 주세요.';
        result.dataset.state='error';
        return;
      }

      submit.disabled=true;
      const original=submit.textContent;
      submit.textContent=action==='subscribe'?'신청 중…':'해지 중…';
      result.textContent='';
      result.dataset.state='';
      try{
        const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,email,privacyConsent,marketingConsent,website:form.querySelector('input[name="website"]')?.value||'',startedAt})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok||data.ok!==true) throw new Error(data.message||'요청을 처리하지 못했습니다.');
        result.textContent=data.message||'요청이 처리되었습니다.';
        result.dataset.state='success';
        if(action==='subscribe'){
          localStorage.setItem('unfollow_newsletter_subscribed_v16','1');
          submit.textContent='신청 완료';
        }else{
          localStorage.removeItem('unfollow_newsletter_subscribed_v16');
          submit.textContent='수신 해지 완료';
        }
      }catch(error){
        result.textContent=error?.message||'요청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
        result.dataset.state='error';
        submit.disabled=false;
        submit.textContent=original;
      }
      startedAt=Date.now();
    });
  });

  tokenUnsubscribe();
})();