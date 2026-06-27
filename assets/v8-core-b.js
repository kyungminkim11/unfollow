(()=>{
  const make=(tag,cls,html)=>{const el=document.createElement(tag);el.className=cls;el.innerHTML=html;return el};
  const upload=document.querySelector('.uploadPanel');
  if(upload&&!upload.querySelector('.heroSummaryV8')) upload.insertBefore(make('div','heroSummaryV8','<div class="sum purple"><span>전체 팔로잉</span><strong data-sum="following">0</strong></div><div class="sum green"><span>맞팔</span><strong data-sum="mutual">0</strong></div><div class="sum purple"><span>취소 검토</span><strong data-sum="nonmutual">0</strong></div><div class="sum"><span>완료</span><strong data-sum="done">0</strong></div>'),upload.querySelector('.quickStart'));
  document.body.prepend(make('div','mobileTopV8','<div class="miniBrand"><div class="miniLogo"><span class="iconify" data-icon="ph:users-three-fill"></span></div>맞팔체커</div><button class="iconBtnV8 themeV8" aria-label="테마 변경"><span class="iconify" data-icon="ph:moon"></span></button>'));
  document.body.appendChild(make('nav','bottomNavV8','<a href="#top"><span class="iconify" data-icon="ph:house-fill"></span>홈</a><a href="#appPanel"><span class="iconify" data-icon="ph:chart-bar"></span>결과</a><a class="work" href="#appPanel"><span class="iconify" data-icon="ph:check-square-offset-fill"></span>작업</a><a href="#faq"><span class="iconify" data-icon="ph:question"></span>도움말</a>'));
  const currentKey='unfollow_theme_v10';
  const legacyKey='matchal_checker_theme_v8';
  const saved=localStorage.getItem(currentKey)||localStorage.getItem(legacyKey);
  if(saved==='dark') document.body.classList.add('v8-dark');
  if(saved&&!localStorage.getItem(currentKey)) localStorage.setItem(currentKey,saved);
  const sync=()=>document.querySelectorAll('.themeV8 .iconify').forEach(i=>i.dataset.icon=document.body.classList.contains('v8-dark')?'ph:sun':'ph:moon');sync();
  document.querySelectorAll('.themeV8').forEach(b=>b.addEventListener('click',()=>{document.body.classList.toggle('v8-dark');localStorage.setItem(currentKey,document.body.classList.contains('v8-dark')?'dark':'light');sync()}));
  const update=()=>{const map={following:'countFollowing',mutual:'countMutual',nonmutual:'countNonMutual',done:'countDone'};Object.entries(map).forEach(([k,id])=>{const out=document.querySelector('[data-sum="'+k+'"]'),src=document.getElementById(id);if(out&&src)out.textContent=src.textContent})};
  new MutationObserver(update).observe(document.body,{subtree:true,childList:true,characterData:true});update();
})();
