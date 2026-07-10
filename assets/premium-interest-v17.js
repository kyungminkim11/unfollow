(()=>{
  const ENDPOINT='https://jnciddblcndmthmmvqrz.supabase.co/functions/v1/unfollow-premium-interest';
  const form=document.querySelector('#premiumInterestFormV17');
  if(!form) return;
  const result=document.querySelector('#premiumInterestResultV17');
  const submit=document.querySelector('#premiumInterestSubmitV17');
  const remove=document.querySelector('#premiumInterestDeleteV17');
  const startedAt=Date.now();

  function setResult(message,state=''){
    result.textContent=message||'';
    if(state) result.dataset.state=state; else delete result.dataset.state;
  }
  function email(){return String(form.elements.email?.value||'').trim();}
  async function request(payload){
    const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,website:String(form.elements.website?.value||''),startedAt})});
    const data=await response.json().catch(()=>({ok:false,message:'응답을 읽지 못했습니다.'}));
    if(!response.ok||data.ok===false) throw new Error(data.message||'요청을 처리하지 못했습니다.');
    return data;
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const features=Array.from(form.querySelectorAll('input[name="features"]:checked')).map(input=>input.value);
    if(!features.length){setResult('관심 있는 기능을 하나 이상 선택해 주세요.','error');return;}
    submit.disabled=true;remove.disabled=true;setResult('의견을 저장하는 중입니다.');
    try{
      const data=await request({action:'submit',email:email(),features,pricePreference:form.elements.pricePreference.value,accountCountRange:form.elements.accountCountRange.value,comment:form.elements.comment.value,privacyConsent:form.elements.privacyConsent.checked});
      localStorage.setItem('unfollow_premium_interest_submitted_v17','1');
      setResult(data.message,'success');
    }catch(error){setResult(error.message||'의견을 저장하지 못했습니다.','error');}
    finally{submit.disabled=false;remove.disabled=false;}
  });
  remove.addEventListener('click',async()=>{
    const value=email();
    if(!value){setResult('삭제할 의견에 사용한 이메일을 입력해 주세요.','error');return;}
    if(!confirm('이 이메일로 저장된 프리미엄 관심 의견을 삭제할까요?')) return;
    submit.disabled=true;remove.disabled=true;setResult('저장된 의견을 삭제하는 중입니다.');
    try{
      const data=await request({action:'delete',email:value});
      localStorage.removeItem('unfollow_premium_interest_submitted_v17');
      setResult(data.message,'success');
    }catch(error){setResult(error.message||'저장된 의견을 삭제하지 못했습니다.','error');}
    finally{submit.disabled=false;remove.disabled=false;}
  });
  if(localStorage.getItem('unfollow_premium_interest_submitted_v17')==='1') setResult('이 브라우저에서 이전에 의견을 제출했습니다. 같은 이메일로 다시 제출하면 최신 의견으로 갱신됩니다.');
})();
