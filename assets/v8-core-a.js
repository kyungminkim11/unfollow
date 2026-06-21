(()=>{
  const make=(tag,cls,html)=>{const el=document.createElement(tag);el.className=cls;el.innerHTML=html;return el};
  document.querySelectorAll('.logo').forEach(el=>{el.textContent='';const icon=document.createElement('span');icon.className='iconify';icon.dataset.icon='ph:users-three-fill';el.appendChild(icon)});
  const sidebar=document.querySelector('.sidebar');
  if(sidebar&&!sidebar.querySelector('.serviceNav')){
    const nav=make('nav','serviceNav','<small>MENU</small><a class="active" href="#top"><span class="iconify" data-icon="ph:house-fill"></span>홈</a><a href="#drop"><span class="iconify" data-icon="ph:cloud-arrow-up"></span>분석하기</a><a href="#appPanel"><span class="iconify" data-icon="ph:chart-bar"></span>결과 보기</a><a href="#appPanel"><span class="iconify" data-icon="ph:check-square-offset"></span>작업 모드<span class="newBadge">모바일</span></a><a href="#beginnerGuide"><span class="iconify" data-icon="ph:book-open-text"></span>사용 가이드</a><a href="#faq"><span class="iconify" data-icon="ph:question"></span>도움말 & FAQ</a><button data-v8="sample"><span class="iconify" data-icon="ph:play-circle"></span>샘플로 체험</button><button data-v8="save"><span class="iconify" data-icon="ph:download-simple"></span>진행 저장</button><button data-v8="clear"><span class="iconify" data-icon="ph:trash"></span>진행 초기화</button>');
    sidebar.querySelector('.brand')?.after(nav);
    sidebar.appendChild(make('div','sideTrustV8','<strong><span class="iconify" data-icon="ph:shield-check-fill"></span>브라우저 로컬 분석</strong><p>ZIP 파일과 작업 기록은 외부 서버로 전송되지 않습니다.</p>'));
    nav.querySelector('[data-v8="sample"]')?.addEventListener('click',()=>document.getElementById('sideSampleBtn')?.click());
    nav.querySelector('[data-v8="save"]')?.addEventListener('click',()=>document.getElementById('sideExportBtn')?.click());
    nav.querySelector('[data-v8="clear"]')?.addEventListener('click',()=>document.getElementById('sideClearBtn')?.click());
  }
  const main=document.querySelector('.main');
  if(main&&!main.querySelector('.serviceTopbar')) main.prepend(make('header','serviceTopbar','<p>안녕하세요. 오늘도 필요한 계정만 차분하게 정리해보세요.</p><div class="serviceTopActions"><a href="https://github.com/kyungminkim11/matchal-checker/issues/new" target="_blank" rel="noopener"><span class="iconify" data-icon="ph:chat-circle-text"></span>피드백 보내기</a><button class="themeV8" aria-label="테마 변경"><span class="iconify" data-icon="ph:moon"></span></button></div>'));
  document.querySelector('.serviceTopbar')?.setAttribute('id','top');
})();