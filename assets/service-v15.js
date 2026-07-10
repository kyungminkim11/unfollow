(()=>{
  'use strict';

  const VERSION='15.0';
  const q=(selector,root=document)=>root.querySelector(selector);
  const qa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  let observer;
  let refreshTimer=0;
  const setText=(element,text)=>{if(element&&element.textContent.trim()!==text) element.textContent=text;};

  const leafCopy=new Map([
    ['맞팔·언팔 검토 도우미','Instagram 관계 분석 도구'],
    ['전체 팔로잉','내가 팔로우 중'],
    ['취소 검토','나만 팔로우 중'],
    ['팔로워만','나를 팔로우 중'],
    ['완료 체크','검토 완료'],
    ['새로 나를 팔로우하지 않는 계정','팔로워에서 이탈한 계정'],
    ['두 시점 변화 비교','관계 변화 비교'],
    ['파일을 선택해 주세요','ZIP 파일을 선택해 주세요'],
    ['맞팔 결과 확인','분석 결과 확인'],
    ['Instagram ZIP 받기','Instagram 데이터 받기'],
    ['ZIP 그대로 선택','JSON ZIP 선택']
  ]);

  function addStylesheet(){
    if(q('link[data-service-v15]')) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/assets/service-v15.css?v=15.0';
    link.dataset.serviceV15='true';
    document.head.appendChild(link);
  }

  function addSkipLink(){
    if(q('.v15SkipLink')) return;
    const link=document.createElement('a');
    link.className='v15SkipLink';
    link.href='#serviceMainV15';
    link.textContent='본문으로 바로가기';
    document.body.prepend(link);
  }

  function setPageSemantics(){
    const main=q('.main');
    if(main){
      main.id='serviceMainV15';
      main.setAttribute('role','main');
      main.setAttribute('tabindex','-1');
    }
    q('.sidebar')?.setAttribute('aria-label','맞팔체커 서비스 메뉴');
    q('.hero')?.setAttribute('aria-labelledby','serviceHeadingV15');
    const heading=q('.hero h1');
    if(heading) heading.id='serviceHeadingV15';
    ['#top','#appPanel','#compareV13','#beginnerGuide','#faq','#privacyNoticeV10'].forEach(selector=>q(selector)?.classList.add('v15Anchor'));
  }

  function rewriteCopy(){
    const version=`v${VERSION}`;
    qa('body *').forEach(element=>{
      if(element.children.length) return;
      const current=(element.textContent||'').trim();
      const next=leafCopy.get(current);
      if(next&&current!==next) element.textContent=next;
      if(/^v(?:10|11|12|13|14)(?:\.\d+)?$/i.test(current)&&current!==version) element.textContent=version;
    });

    const brandSubtitle=q('.sidebar .brandText > span:not(.lavaByline),.sidebar .brand > span:not(.logo):not(.lavaByline)');
    setText(brandSubtitle,'Instagram 관계 분석 도구');

    const topbarText=q('.serviceTopbar>p,.topbar>p');
    setText(topbarText,'분석, 변화 비교, 작업 기록을 한 곳에서 관리하세요.');

    const hero=q('.hero');
    const eyebrow=q('.eyebrow',hero||document);
    setText(eyebrow,'로그인 없는 브라우저 로컬 분석');
    const heading=q('h1',hero||document);
    setText(heading,'Instagram 팔로우 관계를 안전하게 확인하세요');
    const lead=q('.lead',hero||document);
    setText(lead,'Instagram에서 내려받은 JSON ZIP을 선택하면 맞팔, 나만 팔로우 중인 계정, 나를 팔로우 중인 계정을 이 브라우저에서 분석합니다.');

    const drop=q('.drop');
    const dropStrong=q('strong',drop||document);
    setText(dropStrong,'Instagram 데이터 ZIP 선택');
    const dropText=qa('span,p,small',drop||document).find(element=>!element.children.length&&/ZIP|파일|선택|드래그/.test(element.textContent||''));
    setText(dropText,'다운로드 형식을 JSON으로 설정한 ZIP을 압축 해제하지 말고 선택하세요.');

    const compare=q('#compareV13');
    const compareParagraph=q('.compareHeadV13 p',compare||document);
    setText(compareParagraph,'이전 ZIP과 최신 ZIP을 비교해 두 데이터 시점 사이의 팔로우 관계 변화를 확인합니다.');
    const comparePrivacy=q('.comparePrivacyV13 span',compare||document);
    setText(comparePrivacy,'두 파일은 모두 브라우저 안에서만 처리됩니다.');

    const privacy=q('#privacyNoticeV10');
    const privacyTitle=q('h2',privacy||document);
    setText(privacyTitle,'파일은 업로드되지 않고 이 브라우저에서만 처리됩니다');
    const privacyText=q('p',privacy||document);
    setText(privacyText,'선택한 ZIP과 분석 결과는 외부 서버로 전송되지 않습니다. 검토 상태와 작업공간 이름만 현재 브라우저의 로컬 저장소에 보관되며 언제든 삭제할 수 있습니다.');
  }

  function navLink(href,label,description){
    const link=document.createElement('a');
    link.href=href;
    link.className='v15NavItem';
    const text=document.createElement('span');
    text.textContent=label;
    const small=document.createElement('small');
    small.textContent=description;
    link.append(text,small);
    return link;
  }

  function buildNavigation(){
    const sidebar=q('.sidebar');
    if(!sidebar||q('.v15ServiceNav',sidebar)) return;

    const existing=q('.serviceNav,.nav',sidebar);
    if(existing){
      existing.classList.add('v15LegacyNav');
      existing.setAttribute('aria-hidden','true');
    }

    const nav=document.createElement('nav');
    nav.className='v15ServiceNav';
    nav.setAttribute('aria-label','서비스 주요 메뉴');

    const serviceTitle=document.createElement('strong');
    serviceTitle.className='v15NavTitle';
    serviceTitle.textContent='서비스';
    nav.append(serviceTitle);
    nav.append(
      navLink('/#top','분석 시작','ZIP 한 개 분석'),
      navLink('/#compareV13','변화 비교','두 시점 비교')
    );

    const workspace=document.createElement('button');
    workspace.type='button';
    workspace.className='v15NavItem';
    workspace.dataset.v15Workspace='true';
    workspace.innerHTML='<span>작업 기록</span><small>브라우저 저장 기록</small>';
    workspace.addEventListener('click',()=>{
      const trigger=q('[data-v13-workspace]');
      if(trigger) trigger.click();
      else q('#businessInfoV10')?.scrollIntoView({behavior:'smooth'});
    });
    nav.append(workspace);

    const helpTitle=document.createElement('strong');
    helpTitle.className='v15NavTitle';
    helpTitle.textContent='안내';
    nav.append(helpTitle);
    nav.append(
      navLink('/guide/','사용 가이드','데이터 받는 방법'),
      navLink('/help/','도움말','오류 해결과 FAQ'),
      navLink('/privacy/','개인정보 안내','처리·저장·삭제')
    );

    const brand=q('.brand',sidebar);
    if(brand) brand.after(nav); else sidebar.prepend(nav);

    if(!q('.bottomNavV8')){
      const mobile=document.createElement('nav');
      mobile.className='v15MobileNav';
      mobile.setAttribute('aria-label','모바일 주요 메뉴');
      mobile.append(
        navLink('/#top','분석','ZIP 분석'),
        navLink('/#compareV13','비교','변화 확인')
      );
      const mobileWorkspace=document.createElement('button');
      mobileWorkspace.type='button';
      mobileWorkspace.className='v15NavItem';
      mobileWorkspace.innerHTML='<span>기록</span><small>작업공간</small>';
      mobileWorkspace.addEventListener('click',()=>q('[data-v13-workspace]')?.click());
      mobile.append(mobileWorkspace,navLink('/help/','도움말','문제 해결'));
      document.body.appendChild(mobile);
    }

    updateNavigationState();
  }

  function updateNavigationState(){
    const path=location.pathname;
    const hash=location.hash||'#top';
    qa('.v15ServiceNav a,.v15MobileNav a').forEach(link=>{
      const target=new URL(link.href,location.origin);
      const active=target.pathname===path&&((path!=='/'&&path!=='/index.html')||target.hash===hash||(target.hash==='#top'&&!location.hash));
      link.classList.toggle('active',active);
      if(active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    });
  }

  function enhanceUpload(){
    const upload=q('.uploadPanel')||q('.v14HeroPrimary');
    if(!upload||q('.v15TrustGrid',upload)) return;

    const trust=document.createElement('div');
    trust.className='v15TrustGrid';
    trust.innerHTML=`
      <div><strong>파일 전송 없음</strong><span>선택은 업로드가 아닙니다. 분석은 기기 안에서 진행됩니다.</span></div>
      <div><strong>로그인 정보 불필요</strong><span>Instagram 아이디나 비밀번호를 입력하지 않습니다.</span></div>
      <div><strong>자동 언팔 없음</strong><span>결과를 확인한 뒤 Instagram에서 직접 판단하고 처리합니다.</span></div>`;

    const drop=q('.drop',upload);
    if(drop) drop.after(trust); else upload.appendChild(trust);

    const input=q('#zipInput,input[type="file"]',upload);
    if(input){
      input.setAttribute('accept','.zip,application/zip');
      input.setAttribute('aria-describedby','v15UploadHelp');
      const help=document.createElement('p');
      help.id='v15UploadHelp';
      help.className='v15UploadHelp';
      help.innerHTML='지원 형식: Instagram JSON ZIP · 최대 80MB · <a href="/guide/">데이터 받는 방법</a>';
      trust.after(help);
    }

    if(!('DecompressionStream' in window)){
      const warning=document.createElement('div');
      warning.className='v15BrowserWarning';
      warning.setAttribute('role','alert');
      warning.innerHTML='<strong>이 브라우저에서는 ZIP 분석이 제한될 수 있습니다.</strong><span>Chrome, Edge 또는 Safari 최신 버전에서 이용해 주세요.</span>';
      upload.prepend(warning);
    }
  }

  function addSnapshotNotice(){
    const app=q('#appPanel');
    if(!app||q('.v15SnapshotNotice',app)) return;
    const notice=document.createElement('aside');
    notice.className='v15SnapshotNotice';
    notice.innerHTML='<strong>결과는 ZIP을 생성한 시점의 스냅샷입니다.</strong><span>Instagram의 현재 상태와 다를 수 있으므로 실제 팔로우 변경 전 프로필을 한 번 더 확인하세요.</span>';
    const header=q('.panelHeader',app);
    if(header) header.after(notice); else app.prepend(notice);
  }

  function addServiceSummary(){
    const hero=q('.hero');
    const primary=q('.v14HeroPrimary',hero||document)||hero?.firstElementChild;
    if(!primary||q('.v15ServiceSummary',primary)) return;
    const summary=document.createElement('div');
    summary.className='v15ServiceSummary';
    summary.innerHTML='<span><b>1</b> JSON ZIP 선택</span><span><b>2</b> 관계 자동 분류</span><span><b>3</b> 직접 확인·처리</span>';
    const lead=q('.lead',primary);
    if(lead) lead.after(summary); else primary.prepend(summary);
  }

  function improveButtonsAndErrors(){
    qa('button,a,input,select,summary').forEach(control=>{
      if(!control.getAttribute('aria-label')&&!control.textContent?.trim()&&control instanceof HTMLElement) control.setAttribute('aria-label','기능 실행');
    });
    const error=q('#errorBox');
    if(error&&!error.dataset.v15Observed){
      error.dataset.v15Observed='true';
      error.setAttribute('role','alert');
      error.setAttribute('aria-live','assertive');
      new MutationObserver(()=>{
        const visible=!error.hidden&&!error.classList.contains('hidden')&&error.textContent.trim();
        if(visible){error.setAttribute('tabindex','-1');error.focus({preventScroll:true});error.scrollIntoView({behavior:'smooth',block:'center'});}
      }).observe(error,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});
    }
  }

  function decorate(){
    rewriteCopy();
    setPageSemantics();
    buildNavigation();
    enhanceUpload();
    addSnapshotNotice();
    addServiceSummary();
    improveButtonsAndErrors();
    updateNavigationState();
  }

  function scheduleDecorate(){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(decorate,70);
  }

  function start(){
    document.documentElement.classList.add('service-v15-ready');
    document.body.classList.add('service-v15');
    addStylesheet();
    addSkipLink();
    decorate();
    setTimeout(decorate,350);
    setTimeout(decorate,1200);

    observer=new MutationObserver(scheduleDecorate);
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer?.disconnect(),2500);
    addEventListener('hashchange',updateNavigationState);
    addEventListener('popstate',updateNavigationState);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
