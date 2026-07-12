(()=>{
  'use strict';

  const ENDPOINT='https://jnciddblcndmthmmvqrz.supabase.co/functions/v1/unfollow-contact';
  const form=document.querySelector('[data-contact-form]');
  if(!form) return;

  const result=form.querySelector('[data-contact-result]');
  const submit=form.querySelector('button[type="submit"]');
  let startedAt=Date.now();

  const setResult=(message,state='')=>{
    if(!result) return;
    result.textContent=message||'';
    if(state) result.dataset.state=state;
    else delete result.dataset.state;
  };

  form.addEventListener('focusin',()=>{
    if(!form.dataset.started){form.dataset.started='1';startedAt=Date.now();}
  },{once:true});

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const data=new FormData(form);
    const payload={
      name:String(data.get('name')||'').trim(),
      email:String(data.get('email')||'').trim(),
      category:String(data.get('category')||'other'),
      subject:String(data.get('subject')||'').trim(),
      message:String(data.get('message')||'').trim(),
      privacyConsent:data.get('privacyConsent')==='on',
      website:String(data.get('website')||''),
      startedAt
    };

    if(!payload.name||!payload.email||payload.subject.length<2||payload.message.length<10||!payload.privacyConsent){
      setResult('이름, 이메일, 제목, 문의 내용과 필수 동의를 확인해 주세요.','error');
      return;
    }

    const original=submit?.textContent||'문의 보내기';
    if(submit){submit.disabled=true;submit.textContent='접수 중…';}
    setResult('문의 내용을 안전하게 접수하는 중입니다.');

    try{
      const response=await fetch(ENDPOINT,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok||body.ok!==true) throw new Error(body.message||'문의를 접수하지 못했습니다.');
      const reference=body.referenceId?` 접수번호: ${body.referenceId}`:'';
      setResult(`${body.message||'문의가 접수되었습니다.'}${reference}`,'success');
      form.reset();
      startedAt=Date.now();
      if(submit) submit.textContent='접수 완료';
    }catch(error){
      setResult(error?.message||'문의 접수 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.','error');
      if(submit){submit.disabled=false;submit.textContent=original;}
    }
  });
})();