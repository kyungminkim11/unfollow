(()=>{
  'use strict';

  if(window.__MATCHAL_FEEDBACK_V20__) return;
  window.__MATCHAL_FEEDBACK_V20__=true;

  const FEEDBACK_URL='https://github.com/kyungminkim11/unfollow/issues/new?template=feedback.yml';
  const FEEDBACK_TEXT='피드백 보내기';
  let observer;
  let stopTimer=0;

  const normalize=value=>(value||'').replace(/\s+/g,' ').trim();

  function findFeedbackControl(){
    return Array.from(document.querySelectorAll('a,button')).find(control=>{
      const text=normalize(control.textContent);
      const href=control instanceof HTMLAnchorElement ? control.getAttribute('href')||'' : '';
      return text===FEEDBACK_TEXT || /github\.com\/kyungminkim11(?:\/unfollow)?\/issues\/new/i.test(href);
    })||null;
  }

  function replaceButton(button){
    const link=document.createElement('a');
    Array.from(button.attributes).forEach(attribute=>{
      if(!['type','disabled'].includes(attribute.name)) link.setAttribute(attribute.name,attribute.value);
    });
    link.className=button.className;
    link.innerHTML=button.innerHTML;
    button.replaceWith(link);
    return link;
  }

  function upgrade(){
    let control=findFeedbackControl();
    if(!control) return false;
    if(!(control instanceof HTMLAnchorElement)) control=replaceButton(control);

    control.href=FEEDBACK_URL;
    control.target='_blank';
    control.rel='noopener noreferrer';
    control.dataset.feedbackReady='true';
    control.setAttribute('aria-label','맞팔체커 피드백 보내기 · 새 탭에서 GitHub 양식 열기');
    control.title='오류 신고와 개선 의견을 남겨주세요';
    return true;
  }

  function start(){
    if(upgrade()) return;
    observer=new MutationObserver(()=>{
      if(upgrade()) observer?.disconnect();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    stopTimer=window.setTimeout(()=>observer?.disconnect(),5000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  addEventListener('pagehide',()=>{
    observer?.disconnect();
    clearTimeout(stopTimer);
  },{once:true});
})();
