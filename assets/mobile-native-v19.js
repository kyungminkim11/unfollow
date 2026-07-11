(()=>{
  'use strict';

  const mobileQuery=matchMedia('(max-width:760px)');
  const q=(selector,root=document)=>root.querySelector(selector);
  const qa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const originalText=new WeakMap();
  let sectionObserver=null;
  let resultObserver=null;

  const icons={
    help:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none"/><path d="M9.8 9a2.35 2.35 0 0 1 4.6.7c0 1.9-2.4 2.05-2.4 3.8" fill="none"/><path d="M12 17h.01" fill="none"/></svg>',
    moon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z" fill="none"/></svg>',
    sun:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5" fill="none"/><path d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" fill="none"/></svg>',
    shield:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 19 6v5.1c0 4.3-2.8 7.8-7 9.7-4.2-1.9-7-5.4-7-9.7V6l7-2.8Z" fill="none"/><path d="m8.8 12 2 2 4.5-4.5" fill="none"/></svg>',
    upload:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5v1.2A2.3 2.3 0 0 0 6.3 20h11.4a2.3 2.3 0 0 0 2.3-2.3v-1.2" fill="none"/><path d="M12 16V4M7.8 8.2 12 4l4.2 4.2" fill="none"/></svg>',
    analyze:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v13H4z" fill="none"/><path d="M7 15v-3M12 15V8M17 15v-5" fill="none"/></svg>',
    compare:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h11M15 4l3 3-3 3M17 17H6M9 14l-3 3 3 3" fill="none"/></svg>',
    history:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" fill="none"/><path d="M4 4v4.6h4.6M12 8v4l2.7 1.7" fill="none"/></svg>'
  };

  function setResponsiveText(element,mobileText){
    if(!element) return;
    if(!originalText.has(element)) originalText.set(element,element.textContent);
    element.textContent=mobileQuery.matches?mobileText:originalText.get(element);
  }

  function buildNativeAppBar(){
    let appbar=q('.v19NativeAppBar');
    q('.v19HeaderActions')?.remove();

    if(!appbar){
      appbar=document.createElement('div');
      appbar.className='v19NativeAppBar';
      appbar.setAttribute('role','banner');
      appbar.setAttribute('aria-label','맞팔체커 앱 메뉴');

      const home=document.createElement('a');
      home.href='/';
      home.className='v19AppBrand';
      home.setAttribute('aria-label','맞팔체커 홈');

      const sourceLogo=q('.sidebar .logo');
      const logo=sourceLogo?sourceLogo.cloneNode(true):document.createElement('span');
      logo.removeAttribute?.('id');
      logo.classList.add('v19AppLogo');
      if(!sourceLogo) logo.textContent='M';

      const copy=document.createElement('span');
      copy.className='v19AppBrandCopy';
      copy.innerHTML='<strong>맞팔체커</strong><small>Instagram 관계 분석</small>';
      home.append(logo,copy);

      const actions=document.createElement('div');
      actions.className='v19AppActions';

      const help=document.createElement('a');
      help.href='/help/';
      help.className='v19AppButton';
      help.setAttribute('aria-label','도움말 열기');
      help.title='도움말';
      help.innerHTML=icons.help;

      const theme=document.createElement('button');
      theme.type='button';
      theme.className='v19AppButton';
      theme.dataset.v19Theme='true';
      theme.addEventListener('click',()=>{
        const dark=!document.body.classList.contains('v8-dark');
        document.body.classList.toggle('v8-dark',dark);
        localStorage.setItem('unfollow_theme_v19',dark?'dark':'light');
        updateThemeButton(theme);
      });
      actions.append(help,theme);
      appbar.append(home,actions);

      const shell=q('.appShell');
      const sidebar=q('.sidebar',shell||document);
      if(shell) shell.insertBefore(appbar,sidebar||shell.firstChild);
      else document.body.prepend(appbar);
    }

    appbar.hidden=!mobileQuery.matches;
    const saved=localStorage.getItem('unfollow_theme_v19');
    if(saved==='dark') document.body.classList.add('v8-dark');
    if(saved==='light') document.body.classList.remove('v8-dark');
    updateThemeButton(q('[data-v19-theme]',appbar));
  }

  function updateThemeButton(button){
    if(!button) return;
    const dark=document.body.classList.contains('v8-dark');
    button.innerHTML=dark?icons.sun:icons.moon;
    button.setAttribute('aria-label',dark?'밝은 화면으로 전환':'어두운 화면으로 전환');
    button.title=button.getAttribute('aria-label');
  }

  function enhanceBanner(){
    const banner=q('.betaBannerV16');
    if(!banner) return;
    setResponsiveText(q('.betaPillV16',banner),'무료 베타');
    setResponsiveText(q('h2',banner),'현재 무료로 이용할 수 있어요');
    setResponsiveText(q('[data-newsletter-open]',banner),'출시 알림');
    setResponsiveText(q('a[href="/premium/"]',banner),'예정 기능');
  }

  function enhanceHero(){
    const primary=q('.v14HeroPrimary');
    if(!primary) return;
    setResponsiveText(q('h1',primary),'Instagram 관계 분석');
    setResponsiveText(q('.lead',primary),'Instagram에서 받은 JSON ZIP을 선택하면 맞팔과 팔로우 관계를 기기 안에서 확인합니다.');

    if(!q('.v19PrivacyLine',primary)){
      const line=document.createElement('div');
      line.className='v19PrivacyLine v19MobileOnly';
      line.innerHTML=`${icons.shield}<span>로그인 없이 · 파일 업로드 없이 분석</span>`;
      const heading=q('h1',primary);
      if(heading) heading.before(line); else primary.prepend(line);
    }

    const drop=q('.v14PrimaryDrop,.drop',primary);
    if(drop){
      const icon=q('.dropIcon',drop);
      if(icon&&!icon.dataset.v19Icon){icon.dataset.v19Icon='true';icon.innerHTML=icons.upload;}
      setResponsiveText(q('strong',drop),'ZIP 파일 선택');
      const description=qa('span,p,small',drop).find(element=>!element.classList.contains('dropIcon')&&!element.classList.contains('v19DropAction')&&/JSON|ZIP|파일|선택|다운로드|압축/.test(element.textContent||''));
      setResponsiveText(description,'Instagram에서 받은 JSON ZIP을 선택하세요.');
      if(!q('.v19DropAction',drop)){
        const action=document.createElement('span');
        action.className='v19DropAction v19MobileOnly';
        action.textContent='휴대폰에서 파일 선택';
        drop.appendChild(action);
      }
    }

    setResponsiveText(q('.fileSafetyV12',primary),'지원 형식: JSON ZIP · 최대 80MB · 압축을 풀지 마세요.');

    if(!q('.v19TrustRow',primary)){
      const row=document.createElement('div');
      row.className='v19TrustRow v19MobileOnly';
      row.innerHTML='<span><i></i>기기 내 분석</span><span><i></i>비밀번호 입력 없음</span><span><i></i>자동 언팔 없음</span>';
      const help=q('.v15UploadHelp',primary);
      const trust=q('.v15TrustGrid',primary);
      if(help) help.before(row); else if(trust) trust.after(row); else drop?.after(row);
    }

    qa('a,button',primary).forEach(control=>{
      const text=(control.textContent||'').trim();
      if(/Instagram 데이터 (다운로드|받기)/.test(text)) setResponsiveText(control,'데이터 받는 방법');
      if(/샘플로 먼저 보기/.test(text)) setResponsiveText(control,'샘플 보기');
      if(/^사용 방법$/.test(text)) setResponsiveText(control,'도움말');
    });
  }

  function navItem({href,label,icon,button=false,onClick}){
    const item=button?document.createElement('button'):document.createElement('a');
    if(button) item.type='button'; else item.href=href;
    item.className='v19BottomNavItem';
    item.innerHTML=`${icons[icon]}<span>${label}</span>`;
    if(onClick) item.addEventListener('click',onClick);
    return item;
  }

  function buildBottomNavigation(){
    if(q('.v19BottomNav')) return;
    const nav=document.createElement('nav');
    nav.className='v19BottomNav';
    nav.setAttribute('aria-label','모바일 앱 메뉴');
    const analyze=navItem({href:'/#top',label:'분석',icon:'analyze'});
    analyze.dataset.v19Section='top';
    const compare=navItem({href:'/#compareV13',label:'비교',icon:'compare'});
    compare.dataset.v19Section='compare';
    const history=navItem({label:'기록',icon:'history',button:true,onClick:()=>{
      q('[data-v13-workspace]')?.click();
      setActiveNav(history);
    }});
    const help=navItem({href:'/help/',label:'도움말',icon:'help'});
    nav.append(analyze,compare,history,help);
    document.body.appendChild(nav);

    [analyze,compare].forEach(item=>item.addEventListener('click',()=>setActiveNav(item)));
    sectionObserver?.disconnect();
    const targets=[{element:q('#top')||q('.hero'),item:analyze},{element:q('#compareV13'),item:compare}].filter(entry=>entry.element);
    if(targets.length){
      sectionObserver=new IntersectionObserver(entries=>{
        const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
        const target=targets.find(entry=>entry.element===visible?.target);
        if(target) setActiveNav(target.item);
      },{rootMargin:'-20% 0px -66% 0px',threshold:[0,.1,.4]});
      targets.forEach(entry=>sectionObserver.observe(entry.element));
    }
    setActiveNav(analyze);
  }

  function setActiveNav(active){
    qa('.v19BottomNavItem').forEach(item=>{
      const selected=item===active;
      item.classList.toggle('active',selected);
      if(selected) item.setAttribute('aria-current','page'); else item.removeAttribute('aria-current');
    });
  }

  function syncDataState(){
    const input=q('#zipInput');
    const counts=['#countFollowing','#countMutual','#countNonMutual','#countFollowerOnly'].map(selector=>Number((q(selector)?.textContent||'').replace(/\D/g,''))||0);
    const hasData=Boolean(input?.files?.length)||counts.some(value=>value>0);
    document.body.classList.toggle('v19HasData',hasData);
  }

  function observeResults(){
    const targets=['#countFollowing','#countMutual','#countNonMutual','#countFollowerOnly','#appPanel'].map(selector=>q(selector)).filter(Boolean);
    if(!targets.length) return;
    resultObserver?.disconnect();
    resultObserver=new MutationObserver(syncDataState);
    targets.forEach(target=>resultObserver.observe(target,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden']}));
    q('#zipInput')?.addEventListener('change',()=>setTimeout(syncDataState,50),{once:true});
    syncDataState();
  }

  function sync(){
    document.documentElement.classList.add('mobile-native-v19-ready');
    document.body.classList.add('mobile-native-v19');
    buildNativeAppBar();
    enhanceBanner();
    enhanceHero();
    buildBottomNavigation();
    observeResults();
    q('.offlineBanner')?.classList.add('offlineNoticeV19');
  }

  function start(){
    sync();
    setTimeout(sync,250);
    setTimeout(sync,900);
    mobileQuery.addEventListener?.('change',sync);
    const observer=new MutationObserver(()=>setTimeout(sync,40));
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),4000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
