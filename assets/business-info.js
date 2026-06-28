(()=>{
  const loadScript=(src,key)=>{
    if(document.querySelector(`script[data-loader="${key}"]`)) return;
    const script=document.createElement('script');
    script.src=src;
    script.dataset.loader=key;
    document.head.appendChild(script);
  };

  loadScript('/assets/synthetic-sample.js?v=10.2','synthetic-sample');
  loadScript('/assets/ux-v11.js?v=11.0','ux-v11');

  const start=()=>{
    if(document.getElementById('businessInfoV10')){
      loadScript('/assets/v13-features.js?v=13.0','v13-features');
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
    desc.textContent='라바랩스에서 운영하는 무료 브라우저 로컬 분석 도구입니다.';
    brand.append(title,desc);

    const links=document.createElement('div');
    links.className='businessLinksV10';
    const website=document.createElement('a');
    website.href='https://lavalabs.co.kr/';
    website.target='_blank';
    website.rel='noopener';
    website.textContent='라바랩스 홈페이지';
    const mail=document.createElement('a');
    mail.href='mailto:lavalabs.ceo@gmail.com';
    mail.textContent='문의';
    links.append(website,mail);

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
      if(label==='이메일'){
        const a=document.createElement('a');
        a.href='mailto:lavalabs.ceo@gmail.com';
        a.textContent=value;
        dd.appendChild(a);
      }else{
        dd.textContent=value;
      }
      grid.append(dt,dd);
    });

    const notice=document.createElement('p');
    notice.className='businessNoticeV10';
    notice.textContent='맞팔체커는 Instagram 또는 Meta와 제휴하거나 공식적으로 운영되는 서비스가 아닙니다. 선택한 ZIP 파일과 분석 결과는 외부 서버로 전송되지 않습니다.';

    details.append(summary,grid,notice);
    footer.append(top,details);

    const main=document.querySelector('.main')||document.body;
    main.appendChild(footer);
    loadScript('/assets/v13-features.js?v=13.0','v13-features');
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
