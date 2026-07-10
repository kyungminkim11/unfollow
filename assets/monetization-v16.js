(()=>{
  'use strict';

  const ENDPOINT='https://jnciddblcndmthmmvqrz.supabase.co/functions/v1/unfollow-newsletter';
  const q=(selector,root=document)=>root.querySelector(selector);
  const qa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));

  function createNewsletterForm(){
    const form=document.createElement('form');
    form.className='newsletterFormV16';
    form.noValidate=true;
    form.innerHTML=`
      <label class="newsletterFieldV16">
        <span>이메일</span>
        <input type="email" name="email" autocomplete="email" inputmode="email" maxlength="254" placeholder="name@example.com" required>
      </label>
      <label class="newsletterHoneypotV16" aria-hidden="true">웹사이트<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
      <label class="newsletterConsentV16">
        <input type="checkbox" name="privacyConsent" required>
        <span><b>[필수]</b> 뉴스레터 발송을 위한 개인정보 수집·이용에 동의합니다. <a href="/privacy/#newsletter">내용 보기</a></span>
      </label>
      <label class="newsletterConsentV16">
        <input type="checkbox" name="marketingConsent" required>
        <span><b>[필수]</b> 맞팔체커 업데이트와 프리미엄 출시 소식 이메일 수신에 동의합니다. <a href="/newsletter/#consent">내용 보기</a></span>
      </label>
      <button class="newsletterSubmitV16" type="submit">무료 베타 소식 신청</button>
      <p class="newsletterResultV16" role="status" aria-live="polite"></p>
      <p class="newsletterFootnoteV16">회원가입은 필요하지 않습니다. 언제든 <a href="/newsletter/#unsubscribe">수신 해지</a>할 수 있습니다.</p>`;

    let startedAt=Date.now();
    form.addEventListener('focusin',()=>{if(!startedAt) startedAt=Date.now();},{once:true});
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const result=q('.newsletterResultV16',form);
      const submit=q('button[type="submit"]',form);
      const email=q('input[name="email"]',form)?.value.trim()||'';
      const privacyConsent=Boolean(q('input[name="privacyConsent"]',form)?.checked);
      const marketingConsent=Boolean(q('input[name="marketingConsent"]',form)?.checked);
      if(!email||!privacyConsent||!marketingConsent){
        result.textContent='이메일과 필수 동의를 확인해 주세요.';
        result.dataset.state='error';
        return;
      }

      submit.disabled=true;
      submit.textContent='신청 중…';
      result.textContent='';
      result.dataset.state='';
      try{
        const response=await fetch(ENDPOINT,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            action:'subscribe',
            email,
            privacyConsent,
            marketingConsent,
            website:q('input[name="website"]',form)?.value||'',
            startedAt,
          }),
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok||data.ok!==true) throw new Error(data.message||'신청 처리에 실패했습니다.');
        result.textContent=data.message||'뉴스레터 신청이 완료되었습니다.';
        result.dataset.state='success';
        submit.textContent='신청 완료';
        localStorage.setItem('unfollow_newsletter_subscribed_v16','1');
        qa('[data-newsletter-open]').forEach(button=>button.textContent='뉴스레터 신청 완료');
      }catch(error){
        result.textContent=error?.message||'신청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
        result.dataset.state='error';
        submit.disabled=false;
        submit.textContent='무료 베타 소식 신청';
      }
    });
    return form;
  }

  function openDialog(dialog){
    const form=q('form',dialog);
    if(form&&!localStorage.getItem('unfollow_newsletter_subscribed_v16')) q('input[name="email"]',form)?.focus({preventScroll:true});
    if(typeof dialog.showModal==='function') dialog.showModal();
    else{dialog.hidden=false;dialog.classList.add('open');}
  }

  function closeDialog(dialog){
    if(typeof dialog.close==='function'&&dialog.open) dialog.close();
    else{dialog.classList.remove('open');dialog.hidden=true;}
  }

  function buildDialog(){
    if(q('#newsletterDialogV16')) return q('#newsletterDialogV16');
    const dialog=document.createElement('dialog');
    dialog.id='newsletterDialogV16';
    dialog.className='newsletterDialogV16';
    dialog.innerHTML=`
      <div class="newsletterDialogInnerV16">
        <button type="button" class="newsletterCloseV16" aria-label="뉴스레터 창 닫기">×</button>
        <span class="newsletterBadgeV16">희망자 뉴스레터</span>
        <h2>프리미엄 출시와 주요 업데이트만 보내드릴게요</h2>
        <p>현재 맞팔체커의 핵심 분석 기능은 무료입니다. 향후 기록 동기화, 고급 비교, 리포트 같은 프리미엄 기능이 준비되면 가장 먼저 알려드립니다.</p>
        <div data-newsletter-form></div>
      </div>`;
    q('[data-newsletter-form]',dialog)?.appendChild(createNewsletterForm());
    q('.newsletterCloseV16',dialog)?.addEventListener('click',()=>closeDialog(dialog));
    dialog.addEventListener('click',event=>{if(event.target===dialog) closeDialog(dialog);});
    dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog);});
    document.body.appendChild(dialog);
    return dialog;
  }

  function buildBanner(){
    if(q('.betaBannerV16')) return;
    const hero=q('.hero');
    if(!hero) return;
    const banner=document.createElement('section');
    banner.className='betaBannerV16';
    banner.setAttribute('aria-labelledby','betaBannerTitleV16');
    banner.innerHTML=`
      <div class="betaBannerCopyV16">
        <span class="betaPillV16">무료 베타 운영 중</span>
        <div>
          <h2 id="betaBannerTitleV16">핵심 분석 기능은 지금 무료입니다</h2>
          <p>향후 분석 기록 동기화, 고급 비교, 월간 리포트 등 프리미엄 기능이 추가될 수 있습니다.</p>
        </div>
      </div>
      <div class="betaBannerActionsV16">
        <button type="button" data-newsletter-open>출시 소식 받기</button>
        <a href="/premium/">예정 기능 보기</a>
      </div>`;
    hero.before(banner);
  }

  function wireNewsletterButtons(){
    const dialog=buildDialog();
    qa('[data-newsletter-open]').forEach(button=>{
      if(button.dataset.newsletterBound==='true') return;
      button.dataset.newsletterBound='true';
      if(localStorage.getItem('unfollow_newsletter_subscribed_v16')) button.textContent='뉴스레터 신청 완료';
      button.addEventListener('click',()=>openDialog(dialog));
    });
  }

  function start(){
    document.body.classList.add('monetization-v16');
    buildBanner();
    wireNewsletterButtons();
    setTimeout(wireNewsletterButtons,400);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
