(()=>{
  const loadScript=(src,key,onload)=>{
    const existing=document.querySelector(`script[data-loader="${key}"]`);
    if(existing){
      if(onload){
        if(existing.dataset.loaded==='true') onload();
        else existing.addEventListener('load',onload,{once:true});
      }
      return;
    }
    const script=document.createElement('script');
    script.src=src;
    script.dataset.loader=key;
    script.addEventListener('load',()=>{
      script.dataset.loaded='true';
      onload?.();
    },{once:true});
    document.head.appendChild(script);
  };

  const loadStyle=(href,key)=>{
    if(document.querySelector(`link[data-loader="${key}"]`)) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.dataset.loader=key;
    document.head.appendChild(link);
  };

  loadStyle('/assets/business-info.css?v=20.0','business-info');

  const organizeFooterUtilities=()=>{
    const footer=document.getElementById('businessInfoV10');
    const links=footer?.querySelector('.businessLinksV10');
    if(!footer||!links) return;
    const controls=Array.from(links.querySelectorAll('[data-v13-workspace],[data-v13-diagnostic]'));
    if(!controls.length) return;

    let utility=footer.querySelector('.businessUtilitiesV20');
    if(!utility){
      utility=document.createElement('section');
      utility.className='businessUtilitiesV20';
      utility.setAttribute('aria-label','브라우저 로컬 관리 도구');

      const copy=document.createElement('div');
      copy.className='businessUtilitiesCopyV20';
      const title=document.createElement('strong');
      title.textContent='로컬 관리 도구';
      const desc=document.createElement('span');
      desc.textContent='작업 기록을 관리하거나 개인정보가 제외된 진단 파일을 저장합니다.';
      copy.append(title,desc);

      const actions=document.createElement('div');
      actions.className='businessUtilitiesActionsV20';
      utility.append(copy,actions);

      const details=footer.querySelector('.businessDetailsV10');
      if(details) footer.insertBefore(utility,details);
      else footer.appendChild(utility);
    }

    const actions=utility.querySelector('.businessUtilitiesActionsV20');
    controls.forEach(control=>{
      control.classList.add('businessUtilityButtonV20');
      actions.appendChild(control);
    });
  };

  const loadCompanionLayout=()=>{
    loadStyle('/assets/extension-site.css?v=4','extension-site');
    loadStyle('/assets/responsive-final.css?v=4','responsive-final');
    loadStyle('/assets/automation-v22.css?v=22.0','automation-v22');
    loadStyle('/assets/relationship-scan-v23.css?v=23.0','relationship-scan-v23');
    loadScript('/assets/feedback-v20.js?v=20.0','feedback-v20');
    loadScript('/assets/extension-site.js?v=23.0','extension-site',()=>{
      loadScript('/assets/automation-parser-v22.js?v=22.0','automation-parser-v22',()=>{
        loadScript('/assets/automation-v22.js?v=22.0','automation-v22',()=>{
          loadScript('/assets/relationship-scan-v23.js?v=23.0','relationship-scan-v23');
        });
      });
    });
  };

  const loadFeatureStack=()=>{
    loadScript('/assets/v13-features.js?v=13.0','v13-features',()=>{
      organizeFooterUtilities();
      loadScript('/assets/design-v14.js?v=14.0','design-v14',()=>{
        loadScript('/assets/service-v15.js?v=15.3','service-v15',()=>{
          loadStyle('/assets/service-v15-a11y.css?v=15.1','service-v15-a11y');
          loadScript('/assets/service-v15-compat.js?v=15.1','service-v15-compat',()=>{
            loadStyle('/assets/monetization-v16.css?v=16.0','monetization-v16');
            loadScript('/assets/monetization-v16.js?v=16.0','monetization-v16',()=>{
              loadStyle('/assets/mobile-native-v19.css?v=19.0','mobile-native-v19');
              loadStyle('/assets/mobile-native-v19-fixes.css?v=19.3','mobile-native-v19-fixes');
              loadScript('/assets/mobile-native-v19.js?v=19.2','mobile-native-v19',loadCompanionLayout);
            });
          });
        });
      });
    });
  };

  loadScript('/assets/synthetic-sample.js?v=10.2','synthetic-sample');
  loadScript('/assets/ux-v11.js?v=11.0','ux-v11');

  const link=(href,text,external=false)=>{
    const element=document.createElement('a');
    element.href=href;
    element.textContent=text;
    if(external){element.target='_blank';element.rel='noopener noreferrer';}
    return element;
  };

  const navGroup=(title,items)=>{
    const group=document.createElement('section');
    group.className='businessLinkGroupV20';
    const heading=document.createElement('strong');
    heading.className='businessLinkTitleV20';
    heading.textContent=title;
    const list=document.createElement('div');
    list.className='businessLinkListV20';
    items.forEach(item=>list.appendChild(link(item.href,item.label,item.external)));
    group.append(heading,list);
    return group;
  };

  const start=()=>{
    if(document.getElementById('businessInfoV10')){
      loadFeatureStack();
      return;
    }

    const footer=document.createElement('footer');
    footer.id='businessInfoV10';
    footer.className='businessInfoV10';

    const top=document.createElement('div');
    top.className='businessTopV10';

    const brand=document.createElement('div');
    brand.className='businessBrandV10';

    const brandHome=document.createElement('a');
    brandHome.className='businessBrandHomeV20';
    brandHome.href='/';
    brandHome.setAttribute('aria-label','맞팔체커 홈');
    const logo=document.createElement('img');
    logo.className='businessBrandLogoV20';
    logo.src='/favicon.svg';
    logo.width=44;
    logo.height=44;
    logo.alt='';
    const brandCopy=document.createElement('span');
    brandCopy.className='businessBrandNameV20';
    const serviceName=document.createElement('strong');
    serviceName.textContent='맞팔체커';
    const operator=document.createElement('small');
    operator.textContent='by Lava Labs';
    brandCopy.append(serviceName,operator);
    brandHome.append(logo,brandCopy);

    const desc=document.createElement('p');
    desc.textContent='Instagram 공식 ZIP 분석과 Chrome Companion 웹 스캔으로 팔로우 관계를 확인하는 도구입니다.';
    const beta=document.createElement('span');
    beta.className='businessBetaV20';
    beta.textContent='무료 베타 · 분석과 스캔 결과 로컬 처리';
    const copyright=document.createElement('small');
    copyright.className='businessCopyrightV20';
    copyright.textContent='© 2026 Lava Labs';
    brand.append(brandHome,desc,beta,copyright);

    const links=document.createElement('nav');
    links.className='businessLinksV10';
    links.setAttribute('aria-label','사이트 하단 메뉴');
    links.append(
      navGroup('서비스',[
        {href:'/#relationshipScanV23',label:'팔로워·팔로잉 웹 스캔'},
        {href:'/#automationV22',label:'팔로우 취소 자동화'},
        {href:'/premium/',label:'프리미엄 예정'}
      ]),
      navGroup('이용 안내',[
        {href:'/guide/',label:'사용 가이드'},
        {href:'/help/',label:'도움말'},
        {href:'/data/',label:'데이터 처리'}
      ]),
      navGroup('정책 · 문의',[
        {href:'/newsletter/',label:'뉴스레터'},
        {href:'/privacy/',label:'개인정보 처리방침'},
        {href:'/terms/',label:'이용약관'},
        {href:'/contact/',label:'문의하기'}
      ])
    );

    top.append(brand,links);

    const details=document.createElement('details');
    details.className='businessDetailsV10';
    const summary=document.createElement('summary');
    summary.textContent='운영자·사업자 정보';

    const grid=document.createElement('dl');
    grid.className='businessGridV10';
    const rows=[
      ['상호','라바랩스(LavaLabs)'],
      ['대표자','김경민'],
      ['사업자등록번호','455-23-01867'],
      ['통신판매업 신고번호','2025-고양일산서-1352'],
      ['사업장 소재지','경기도 고양시 일산서구 일현로 47, 2층 204호 1308호실(탄현동, 예일 큰프라자)'],
      ['이메일','info@lavalabs.co.kr']
    ];

    rows.forEach(([label,value])=>{
      const dt=document.createElement('dt');
      const dd=document.createElement('dd');
      dt.textContent=label;
      if(label==='이메일') dd.appendChild(link('mailto:info@lavalabs.co.kr',value));
      else dd.textContent=value;
      grid.append(dt,dd);
    });

    const website=document.createElement('p');
    website.className='businessNoticeV10';
    website.append('운영사 홈페이지: ',link('https://lavalabs.co.kr/','lavalabs.co.kr',true));

    const notice=document.createElement('p');
    notice.className='businessNoticeV10';
    notice.textContent='맞팔체커는 Instagram 또는 Meta와 제휴하거나 공식적으로 운영되는 서비스가 아닙니다. ZIP 원본, 웹 스캔 명단과 자동화 작업 상태는 라바랩스 서버로 전송하지 않고 각 브라우저와 확장 프로그램 로컬 저장소에서 처리합니다.';

    details.append(summary,grid,website,notice);
    footer.append(top,details);

    const main=document.querySelector('.main')||document.body;
    main.appendChild(footer);
    loadFeatureStack();
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();