(()=>{
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const start=()=>{
    document.documentElement.classList.add('product-v10');

    qa('a[href*="github.com/kyungminkim11/matchal-checker"]').forEach(a=>{
      a.href=a.href.replace('kyungminkim11/matchal-checker','kyungminkim11/unfollow');
    });

    const brand=q('.brand');
    if(brand){
      const logo=brand.querySelector(':scope > .logo');
      const title=brand.querySelector(':scope > strong');
      let subtitle=qa(':scope > span',brand).find(el=>!el.classList.contains('iconify'));
      let byline=brand.querySelector(':scope > .lavaByline');
      let copy=brand.querySelector(':scope > .brandText');

      if(logo){
        logo.textContent='';
        const icon=document.createElement('span');
        icon.className='iconify';
        icon.dataset.icon='ph:users-three-fill';
        icon.setAttribute('aria-hidden','true');
        logo.appendChild(icon);
      }

      if(!subtitle){
        subtitle=document.createElement('span');
      }
      subtitle.textContent='맞팔·언팔 검토 도우미';

      if(!byline){
        byline=document.createElement('small');
        byline.className='lavaByline';
        const link=document.createElement('a');
        link.href='https://lavalabs.co.kr/';
        link.target='_blank';
        link.rel='noopener';
        link.textContent='by Lava Labs';
        byline.appendChild(link);
      }

      if(!copy){
        copy=document.createElement('div');
        copy.className='brandText';
        if(logo) logo.after(copy); else brand.prepend(copy);
      }

      if(title) copy.appendChild(title);
      copy.appendChild(subtitle);
      copy.appendChild(byline);
    }

    qa('body *').forEach(el=>{
      if(el.children.length) return;
      const text=el.textContent.trim();
      if(text==='Matchal Checker') el.textContent='맞팔체커';
      if(text==='v9.2') el.textContent='v10.0';
    });

    const hints={
      '맞팔':'서로 팔로우',
      '취소 검토':'나만 팔로우 중',
      '팔로워만':'상대만 나를 팔로우',
      '완료 체크':'검토 완료'
    };
    qa('strong,span,div,p,button').forEach(el=>{
      if(el.children.length) return;
      const hint=hints[el.textContent.trim()];
      if(hint){el.title=hint;el.dataset.labelHint=hint;}
    });

    const upload=q('.uploadPanel');
    if(upload&&!upload.querySelector('.v10Steps')){
      const steps=document.createElement('div');
      steps.className='v10Steps';
      ['Instagram ZIP 받기','ZIP 그대로 선택','맞팔 결과 확인'].forEach((text,index)=>{
        const item=document.createElement('div');
        const number=document.createElement('b');
        const label=document.createElement('span');
        number.textContent=String(index+1);
        label.textContent=text;
        item.append(number,label);
        steps.appendChild(item);
      });
      upload.prepend(steps);
    }

    if(upload&&!upload.querySelector('.preflightDetails')){
      const items=qa('.quickStart,.safeNotice',upload);
      if(items.length){
        const details=document.createElement('details');
        details.className='preflightDetails';
        const summary=document.createElement('summary');
        const body=document.createElement('div');
        summary.textContent='업로드 전 체크 및 개인정보 안내';
        body.className='preflightBody';
        items.forEach(item=>body.appendChild(item));
        details.append(summary,body);
        upload.appendChild(details);
      }
    }

    const input=q('input[type="file"]');
    if(input&&!q('#zipPreflight')){
      const box=document.createElement('div');
      box.id='zipPreflight';
      box.className='zipPreflight hidden';
      box.setAttribute('role','status');
      box.setAttribute('aria-live','polite');
      const host=input.closest('.drop')||input.parentElement;
      host?.appendChild(box);
      input.addEventListener('change',()=>{
        const file=input.files&&input.files[0];
        if(!file){box.className='zipPreflight hidden';return;}
        const valid=/\.zip$/i.test(file.name)||String(file.type).includes('zip');
        const size=file.size<1048576?`${(file.size/1024).toFixed(1)} KB`:`${(file.size/1048576).toFixed(1)} MB`;
        box.className=`zipPreflight ${valid?'ok':'error'}`;
        box.replaceChildren();
        const strong=document.createElement('strong');
        const detail=document.createElement('span');
        const small=document.createElement('small');
        strong.textContent=valid?'ZIP 형식을 확인했습니다':'ZIP 파일을 선택해 주세요';
        detail.textContent=`${file.name} · ${size}`;
        small.textContent=valid?'내부 JSON 항목은 분석 단계에서 확인합니다.':'Instagram 다운로드 형식은 JSON으로 설정해 주세요.';
        box.append(strong,detail,small);
        if(!valid) input.value='';
      });
    }

    const main=q('.main')||document.body;
    if(!q('#privacyNoticeV10')){
      const section=document.createElement('section');
      section.id='privacyNoticeV10';
      section.className='privacyNoticeV10';
      const title=document.createElement('h2');
      const text=document.createElement('p');
      const note=document.createElement('small');
      title.textContent='데이터는 이 브라우저 안에서만 처리됩니다';
      text.textContent='선택한 ZIP 파일과 분석 결과는 외부 서버로 전송되지 않습니다. 작업 상태와 설정은 현재 브라우저의 로컬 저장소에 보관되며 ‘현재 기록 초기화’로 삭제할 수 있습니다.';
      note.textContent='맞팔체커는 Instagram 또는 Meta와 제휴하거나 공식적으로 운영되는 서비스가 아닙니다.';
      section.append(title,text,note);
      const faq=q('#faq');
      if(faq) faq.before(section); else main.appendChild(section);
    }
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
