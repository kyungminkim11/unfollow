(()=>{
  const add=(tag,attrs={},html='')=>{const el=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>k==='class'?el.className=v:el.setAttribute(k,v));el.innerHTML=html;return el};
  const updateSummary=()=>{const map={following:'countFollowing',mutual:'countMutual',nonmutual:'countNonMutual',done:'countDone'};Object.entries(map).forEach(([k,id])=>{const a=document.querySelector(`[data-sum="${k}"]`),b=document.getElementById(id);if(a&&b)a.textContent=b.textContent})};
  new MutationObserver(updateSummary).observe(document.body,{subtree:true,childList:true,characterData:true});updateSummary();
  const sheet=add('div',{class:'returnSheetV8'},`<div class="returnCardV8"><h3>Instagram에서 돌아오셨나요?</h3><p>실제 처리 결과를 선택하면 다음 계정으로 자동 이동합니다.</p><div class="actionsV8"><button class="btn ok" data-ret="done">팔로우 취소 완료 · 다음</button><button class="btn warn" data-ret="keep">이 계정은 유지 · 다음</button><button class="btn ghost" data-ret="later">나중에 결정</button></div></div>`);document.body.appendChild(sheet);
  document.addEventListener('click',e=>{if(e.target.closest('[data-action="open"],#focusOpenBtn,#openNextBtn'))sessionStorage.setItem('matchal_v8_profile_open','1')});
  const maybeReturn=()=>{if(innerWidth<=900&&sessionStorage.getItem('matchal_v8_profile_open')==='1')setTimeout(()=>sheet.classList.add('show'),180)};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')maybeReturn()});window.addEventListener('pageshow',maybeReturn);
  sheet.querySelector('[data-ret="done"]').addEventListener('click',()=>{sheet.classList.remove('show');sessionStorage.removeItem('matchal_v8_profile_open');document.getElementById('focusDoneBtn')?.click()});
  sheet.querySelector('[data-ret="keep"]').addEventListener('click',()=>{sheet.classList.remove('show');sessionStorage.removeItem('matchal_v8_profile_open');document.getElementById('focusKeepBtn')?.click()});
  sheet.querySelector('[data-ret="later"]').addEventListener('click',()=>{sheet.classList.remove('show');sessionStorage.removeItem('matchal_v8_profile_open')});
  const app=document.getElementById('appPanel');if(app)new MutationObserver(()=>{if(innerWidth<=760&&!app.classList.contains('hidden'))setTimeout(()=>app.scrollIntoView({behavior:'smooth',block:'start'}),180)}).observe(app,{attributes:true,attributeFilter:['class']});
})();