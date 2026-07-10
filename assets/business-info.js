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

  const loadFeatureStack=()=>{
    loadScript('/assets/v13-features.js?v=13.0','v13-features',()=>{
      loadScript('/assets/design-v14.js?v=14.0','design-v14',()=>{
        loadScript('/assets/service-v15.js?v=15.0','service-v15',()=>{
          loadStyle('/assets/service-v15-a11y.css?v=15.1','service-v15-a11y');
          loadScript('/assets/service-v15-compat.js?v=15.1','service-v15-compat',()=>{
            loadStyle('/assets/monetization-v16.css?v=16.0','monetization-v16');
            loadScript('/assets/monetization-v16.js?v=16.0','monetization-v16');
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
    if(external){element.target='_blank';element.rel='noopener';}
    return element;
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
    const title=document.createElement('strong');
    title.textContent='© 2026 Lava Labs · 맞팔체커';
    const desc=document.createElement('span');
    desc.textContent='무료 베타로 운영 중인 브라우저 로컬 Instagram 관계 분석 서비스입니다.';
    brand.append(title,desc);

    const links=document.createElement('div');
    links.className='businessLinksV10';
    links.append(
      link('/premium/','프리미엄 예정'),
      link('/newsletter/','뉴스레터'),
      link('/guide/','사용 가이드'),
      link('/help/','도움말'),
      link('/data/','데이터 처리'),
      link('/privacy/','개인정보 처리방침'),
      link('/terms/','이용약관'),
      link('mailto:lavalabs.ceo@gmail.com','문의')
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
      ['이메일','lavalabs.ceo@gmail.com']
    ];

    rows.forEach(([label,value])=>{
      const dt=document.createElement('dt');
      const dd=document.createElement('dd');
      dt.textContent=label;
      if(label==='이메일') dd.appendChild(link('mailto:lavalabs.ceo@gmail.com',value));
      else dd.textContent=value;
      grid.append(dt,dd);
    });

    const website=document.createElement('p');
    website.className='businessNoticeV10';
    website.append('운영사 홈페이지: ',link('https://lavalabs.co.kr/','lavalabs.co.kr',true));

    const notice=document.createElement('p');
    notice.className='businessNoticeV10';
    notice.textContent='맞팔체커는 Instagram 또는 Meta와 제휴하거나 공식적으로 운영되는 서비스가 아닙니다. Instagram ZIP 원본과 분석 결과는 외부 서버로 전송되지 않으며, 뉴스레터를 신청한 경우에만 이메일과 동의 기록을 별도로 저장합니다.';

    details.append(summary,grid,website,notice);
    footer.append(top,details);

    const main=document.querySelector('.main')||document.body;
    main.appendChild(footer);
    loadFeatureStack();
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
