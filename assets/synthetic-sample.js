(()=>{
  const SAMPLE_KEY='unfollow_synthetic_sample_v1';
  const encoder=new TextEncoder();

  document.addEventListener('click',event=>{
    const trigger=event.target.closest('button,a');
    if(!trigger) return;
    const isSample=trigger.matches('[data-v8="sample"],#sideSampleBtn,[data-sample]')||/샘플로\s*(먼저\s*)?(보기|체험)/.test(trigger.textContent||'');
    if(isSample){
      event.preventDefault();
      event.stopImmediatePropagation();
      loadSyntheticSample();
      return;
    }

    if(sessionStorage.getItem(SAMPLE_KEY)==='1'){
      const instagramLink=trigger.closest('a[href*="instagram.com"],a[href*="instagram.com/"]');
      if(instagramLink){
        event.preventDefault();
        event.stopImmediatePropagation();
        notify('가상 샘플 계정은 실제 Instagram 프로필로 연결되지 않습니다.');
      }
    }
  },true);

  async function loadSyntheticSample(){
    const input=document.querySelector('input[type="file"]');
    if(!input){notify('ZIP 파일 입력 영역을 찾지 못했습니다. 페이지를 새로고침해 주세요.');return;}

    try{
      const suffix=randomSuffix();
      const now=Math.floor(Date.now()/1000);
      const mutual=makeNames('mutual',6,suffix);
      const followingOnly=makeNames('following',7,suffix);
      const followerOnly=makeNames('follower',4,suffix);

      const following={relationships_following:[...mutual,...followingOnly].map((name,index)=>followingItem(name,now-index*86400))};
      const followers=[...mutual,...followerOnly].map((name,index)=>followerItem(name,now-index*93600));

      const zip=createZip([
        ['connections/followers_and_following/following.json',JSON.stringify(following,null,2)],
        ['connections/followers_and_following/followers_1.json',JSON.stringify(followers,null,2)]
      ]);

      const file=new File([zip],`instagram-lava-demo-${suffix}.zip`,{type:'application/zip',lastModified:Date.now()});
      const transfer=new DataTransfer();
      transfer.items.add(file);
      input.files=transfer.files;
      sessionStorage.setItem(SAMPLE_KEY,'1');
      input.dispatchEvent(new Event('change',{bubbles:true}));
      showSampleBanner();
      notify('실제 계정과 무관한 가상 샘플 데이터를 불러왔습니다.');
      setTimeout(disableSampleProfileLinks,100);
      setTimeout(disableSampleProfileLinks,600);
      setTimeout(disableSampleProfileLinks,1500);
    }catch(error){
      console.error(error);
      notify('가상 샘플을 만드는 중 문제가 발생했습니다.');
    }
  }

  function makeNames(group,count,suffix){
    return Array.from({length:count},(_,index)=>`lava_demo_${group}_${suffix}_${String(index+1).padStart(2,'0')}`);
  }

  function followingItem(name,timestamp){
    return {title:name,string_list_data:[{href:`https://www.instagram.com/${name}/`,value:name,timestamp}]};
  }

  function followerItem(name,timestamp){
    return {title:'',media_list_data:[],string_list_data:[{href:`https://www.instagram.com/${name}/`,value:name,timestamp}]};
  }

  function randomSuffix(){
    const bytes=new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return Array.from(bytes,b=>b.toString(36).padStart(2,'0')).join('').slice(0,6);
  }

  function showSampleBanner(){
    let banner=document.getElementById('syntheticSampleBanner');
    if(!banner){
      banner=document.createElement('div');
      banner.id='syntheticSampleBanner';
      banner.className='syntheticSampleBanner';
      banner.setAttribute('role','status');
      banner.innerHTML='<strong>가상 샘플 모드</strong><span>모든 계정명과 팔로우 관계는 브라우저에서 무작위로 생성되며 실제 인물·계정과 무관합니다. 샘플에서는 Instagram 프로필 링크가 열리지 않습니다.</span>';
      const panel=document.getElementById('appPanel')||document.querySelector('.uploadPanel')||document.querySelector('.main');
      panel?.prepend(banner);
    }
    banner.hidden=false;
  }

  function disableSampleProfileLinks(){
    if(sessionStorage.getItem(SAMPLE_KEY)!=='1') return;
    document.querySelectorAll('a[href*="instagram.com"]').forEach(link=>{
      link.dataset.syntheticSample='true';
      link.setAttribute('aria-label','가상 샘플 계정 — Instagram 링크 비활성화');
      link.setAttribute('title','가상 샘플 계정은 실제 프로필로 연결되지 않습니다.');
      link.removeAttribute('target');
    });
    showSampleBanner();
  }

  new MutationObserver(()=>disableSampleProfileLinks()).observe(document.documentElement,{subtree:true,childList:true});

  function createZip(entries){
    const files=entries.map(([name,text])=>{
      const nameBytes=encoder.encode(name);
      const data=encoder.encode(text);
      return {nameBytes,data,crc:crc32(data),offset:0};
    });

    const localParts=[];
    let offset=0;
    files.forEach(file=>{
      file.offset=offset;
      const header=new Uint8Array(30+file.nameBytes.length);
      const view=new DataView(header.buffer);
      view.setUint32(0,0x04034b50,true);
      view.setUint16(4,20,true);
      view.setUint16(6,0,true);
      view.setUint16(8,0,true);
      view.setUint16(10,0,true);
      view.setUint16(12,0,true);
      view.setUint32(14,file.crc,true);
      view.setUint32(18,file.data.length,true);
      view.setUint32(22,file.data.length,true);
      view.setUint16(26,file.nameBytes.length,true);
      view.setUint16(28,0,true);
      header.set(file.nameBytes,30);
      localParts.push(header,file.data);
      offset+=header.length+file.data.length;
    });

    const centralOffset=offset;
    const centralParts=[];
    files.forEach(file=>{
      const header=new Uint8Array(46+file.nameBytes.length);
      const view=new DataView(header.buffer);
      view.setUint32(0,0x02014b50,true);
      view.setUint16(4,20,true);
      view.setUint16(6,20,true);
      view.setUint16(8,0,true);
      view.setUint16(10,0,true);
      view.setUint16(12,0,true);
      view.setUint16(14,0,true);
      view.setUint32(16,file.crc,true);
      view.setUint32(20,file.data.length,true);
      view.setUint32(24,file.data.length,true);
      view.setUint16(28,file.nameBytes.length,true);
      view.setUint16(30,0,true);
      view.setUint16(32,0,true);
      view.setUint16(34,0,true);
      view.setUint16(36,0,true);
      view.setUint32(38,0,true);
      view.setUint32(42,file.offset,true);
      header.set(file.nameBytes,46);
      centralParts.push(header);
      offset+=header.length;
    });

    const centralSize=offset-centralOffset;
    const end=new Uint8Array(22);
    const endView=new DataView(end.buffer);
    endView.setUint32(0,0x06054b50,true);
    endView.setUint16(4,0,true);
    endView.setUint16(6,0,true);
    endView.setUint16(8,files.length,true);
    endView.setUint16(10,files.length,true);
    endView.setUint32(12,centralSize,true);
    endView.setUint32(16,centralOffset,true);
    endView.setUint16(20,0,true);
    return new Blob([...localParts,...centralParts,end],{type:'application/zip'});
  }

  const crcTable=(()=>{
    const table=new Uint32Array(256);
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++) c=(c&1)?0xedb88320^(c>>>1):c>>>1;
      table[n]=c>>>0;
    }
    return table;
  })();

  function crc32(bytes){
    let crc=0xffffffff;
    for(const byte of bytes) crc=crcTable[(crc^byte)&0xff]^(crc>>>8);
    return (crc^0xffffffff)>>>0;
  }

  function notify(message){
    if(typeof window.unfollowToast==='function') window.unfollowToast(message);
    else console.info(message);
  }
})();
