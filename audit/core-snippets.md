# Core snippets

Generated: 2026-06-28T02:03:17.050Z

## async function handleZip

### Hit 1 at 76329

```js
em.string_list_data)?item.string_list_data:[];
      if(sld[0]){ username=sld[0].value||username||usernameFromHref(sld[0].href); href=sld[0].href||href; ts=sld[0].timestamp||ts; }
      const labels=Array.isArray(item.label_values)?item.label_values:[];
      for(const lv of labels){ const val=lv && lv.value; if(looksLikeUsername(val)) username=val; }
      if(!username && href) username=usernameFromHref(href);
      addToMap(map,username,href,ts,source);
    }
    return map;
  }
  function findEntries(zip){
    const jsons=zip.entries.filter(e=>/\.json$/i.test(e.name));
    const followingEntry=jsons.find(e=>/(^|\/)connections\/followers_and_following\/following\.json$/i.test(e.name)) || jsons.find(e=>/(^|\/)following\.json$/i.test(e.name));
    const followerEntries=jsons.filter(e=>/(^|\/)connections\/followers_and_following\/followers_\d+\.json$/i.test(e.name));
    const looseFollowers=jsons.filter(e=>/(^|\/)followers_\d+\.json$/i.test(e.name));
    const recentUnfollowedEntry=jsons.find(e=>/(^|\/)recently_unfollowed_profiles\.json$/i.test(e.name));
    return {followingEntry, followerEntries:followerEntries.length?followerEntries:looseFollowers, recentUnfollowedEntry};
  }
  async function handleZip(file){
    setError(''); els.loadStatus.textContent='ZIP을 읽는 중입니다...'; state.sourceName=file.name;
    try{
      const zip=parseZipEntries(await file.arrayBuffer()); const found=findEntries(zip);
      if(!found.followingEntry || found.followerEntries.length===0){
        throw new Error('필수 파일을 찾지 못했습니다. Instagram 데이터 내보내기에서 “팔로워 및 팔로잉” 데이터를 체크해서 다시 받아주세요.\n필요 파일: following.json, followers_1.json');
      }
      els.loadStatus.textContent='팔로잉 데이터를 분석하는 중입니다...';
      const followingJson=JSON.parse(await inflateEntry(zip, found.followingEntry)); const following=extractUsers(followingJson,'relationships_following','following');
      els.loadStatus.textContent='팔로워 데이터를 분석하는 중입니다...';
      const followers=new Map();
      for(const ent of found.followerEntries){ const json=JSON.parse(await inflateEntry(zip,ent)); for(const [k,v] of extractUsers(json,null,'followers')) followers.set(k,v); }
      const recentUnfollowed=new Map();
      if(found.recentUnfollowedEntry){ try{ const json=JSON.parse(await inflateEntry(zip,found.recentUnfollowedEntry)); for(const [k,v] of extractUsers(json,null,'recentlyUnfollowed')) recentUnfollowed.set(k,v); }catch(e){ console.warn(e); } }
      const allKeys=new Set([...following.keys(),...followers.keys(),...recentUnfollowed.keys()]); const rows=[];
      for(const key of allKeys){
        const fwing=following.get(key), fwer=followers.get(key), ru=recentUnfollowed.get(key), base=fwing||fwer||ru; const isFollowing=!!fwing, isFollower=!!fwer;
        let type='followersOnly', label='팔로워만';
        if(isFollowing&&isFollower){ type='mutual'; label='맞팔'; }
        else if(isFollowing&&!isFollower){ type='nonMutual'; label='취소 검토'; }
        else if(!isFollowing&&isFollower){ type='followersOnly'; label='팔로워만'; }
        else if(ru){ type='recentlyUnfollowed'; label='최근 언팔 기록'; }
        const deleted=/^__deleted__/i.test(base.username)||/deleted/i.test(base.username);
        rows.push({key,username:base.username,href:base.href||instagramUrl(base.username),timestamp:base.timestamp||0,isFollowing,isFollower,type,label,deleted,recentlyUnfollowed:!!ru});
      }
      state.allRows=rows; state.counts={following:following.size,followers:followers.size,mutual:rows.filter(r=>r.isFollowing&&r.isFollower).length,nonMutual:rows.filter(r=>r.isFollowing&&!r.isFollower).length,followersOnly:rows.filter(r=>!r.isFollowing&&r.isFollower).length,deleted:rows.filter(r=>r.deleted).length,recentlyUnfollowed:recentUnfollowed.size};
      state.loaded=true; state.activeTab='nonMutual'; state.visibleLimit=100; state.focusKey=null; state.dataDate=Math.max(0,...rows.map(r=>Number(r.timestamp)||0)); document.body.classList.add('has-data'); els.appPanel.classList.remove('hidden'); els.loadStatus.textContent=`${file.name} 분석 완료`; render(); if(window.matchMedia('(max-width:900px)').matches) setTimeout(()=>document.getElementById('results')?.scrollIntoView({behavior:'smooth',block:'start'}),120); toast('분석 완료');
    }catch(err){ console.error(err); setError(err.message||String(err)); els.loadStatus.textContent='파일 분석 실패'; }
  }


  function loadSampleData(){
    setError('');
    const now=Math.floor(Date.now()/1000);
    const sampleFollowing=['bluepen_shop','tokyo_stationery','daily.snap.kr','fountain_life','paper_and_ink','photo_walk_seoul','travel_japan_note','analog_writer','coffee_penclub','minimaldesk','urban_sketch_kr','kyoto_paper','seoul_portrait','penreviewer','ink_archive','desk_setup_daily','museum_note','film_camera_35','local_brand_lab','note_collective','__deleted__account_01','quiet_reader','weekend_gallery','pencil_case_lab','studio_friend'];
    const sampleFollowers=['bluepen_shop','daily.snap.kr','paper_and_ink','photo_walk_seoul','analog_writer','coffee_penclub','urban_sketch_kr','seoul_portrait','ink_archive','museum_note','quiet_reader','new_follower_only','customer_dm_note','stationery_friend'];
    const recently=['old_account_777','lost_follow_sample'];
    const following=new Map(), followers=new Map(), recentUnfollowed=new Map();
    sampleFollowing.forEach((u,i)=>addToMap(following,u,instagramUrl(u),now-(i+1)*86400,'sample-following'));
    sampleFollowers.forEach((u,i)=>addToMap(followers,u,instagramUrl(u),now-(i+1)*172800,'sample-followers'));
    recently.forEach((u,i)=>addToMap(recentUnfollowed,u,instagramUrl(u),now-(i+1)*432000,'sample-recent'));
    const allKeys=new Set([...following.keys(),...followers.keys(),...recentUnfollowed.keys()]); const rows=[];
    for(const key of allKeys){
      const fwing=following.get(key), fwer=followers.get(key), ru=recentUnfollowed.get(key), base=fwing||fwer||ru; const isFollowing=!!fwing, isFollower=!!fwer;
      let type='followersOnly', label='팔로워만';
      if(isFollowing&&isFollower){ type='mutual'; label='맞팔'; }
      else if(isFollowing&&!isFollower){ type='nonMutual'; label='취소 검토'; }
      else if(!isFollowing&&isFollower){ type='followersOnly'; label='팔로워만'; }
      else if(ru){ type='recentlyUnfollow
```

## function parseZipEntries

### Hit 1 at 72210

```js
rkOpened(row){
    if(!row) return;
    const cur = state.progress[row.key]?.status;
    if(!cur || cur === 'new') state.progress[row.key] = {username:row.username, status:'opened', updatedAt:new Date().toISOString()};
    state.sessionOpened += 1;
    saveProgress();
    updateSession();
  }
  function openProfile(row){
    if(!row) return;
    markOpened(row);
    const url = row.href || instagramUrl(row.username);
    if(els.sameTabInput.checked) location.href = url;
    else window.open(url, '_blank', 'noopener,noreferrer');
    state.focusKey = row.key;
    state.awaitingReturnKey = row.key;
    sessionStorage.setItem('matchal_checker_awaiting_return', row.key);
    renderFocus();
  }
  function copyUsername(row){
    if(!row) return;
    navigator.clipboard?.writeText(row.username).then(()=>toast('@'+row.username+' 복사됨')).catch(()=>toast('복사 실패'));
  }

  function u16(dv,o){ return dv.getUint16(o,true); }
  function u32(dv,o){ return dv.getUint32(o,true); }
  function findEOCD(dv){ const min=Math.max(0,dv.byteLength-0xFFFF-22); for(let i=dv.byteLength-22;i>=min;i--){ if(u32(dv,i)===0x06054b50) return i; } throw new Error('ZIP 구조를 읽지 못했습니다. 인스타그램에서 받은 .zip 파일인지 확인해주세요.'); }
  function parseZipEntries(buf){
    const dv=new DataView(buf); const eocd=findEOCD(dv); const total=u16(dv,eocd+10); const cdSize=u32(dv,eocd+12); const cdOffset=u32(dv,eocd+16); const dec=new TextDecoder('utf-8'); let off=cdOffset; const entries=[];
    for(let i=0;i<total && off<cdOffset+cdSize;i++){
      if(u32(dv,off)!==0x02014b50) break;
      const method=u16(dv,off+10), compSize=u32(dv,off+20), uncompSize=u32(dv,off+24), nameLen=u16(dv,off+28), extraLen=u16(dv,off+30), commentLen=u16(dv,off+32), localOffset=u32(dv,off+42);
      const name=dec.decode(new Uint8Array(buf,off+46,nameLen)); entries.push({name,method,compSize,uncompSize,localOffset}); off += 46+nameLen+extraLen+commentLen;
    }
    return {buf, entries};
  }
  async function inflateEntry(zip, entry){
    const buf=zip.buf; const dv=new DataView(buf); const dec=new TextDecoder('utf-8'); const off=entry.localOffset;
    if(u32(dv,off)!==0x04034b50) throw new Error('ZIP 내부 파일 헤더를 읽지 못했습니다: '+entry.name);
    const nameLen=u16(dv,off+26), extraLen=u16(dv,off+28), start=off+30+nameLen+extraLen; const compressed=new Uint8Array(buf.slice(start,start+entry.compSize));
    if(entry.method===0) return dec.decode(compressed);
    if(entry.method!==8) throw new Error(`지원하지 않는 ZIP 압축 방식입니다: ${entry.name} / method ${entry.method}`);
    if(!('DecompressionStream' in window)) throw new Error('이 브라우저는 ZIP 압축 해제를 지원하지 않습니다. Chrome, Edge, Safari 최신 버전에서 열어주세요.');
    const ds=new DecompressionStream('deflate-raw'); const stream=new Blob([compressed]).stream().pipeThrough(ds); const ab=await new Response(stream).arrayBuffer(); return dec.decode(ab);
  }
  function usernameFromHref(href){
    if(!href) return '';
    try{ const u=new URL(href); const parts=u.pathname.split('/').filter(Boolean); if(parts[0]==='_u') return parts[1]||''; return parts[0]||''; }
    catch{ const parts=String(href).split('/').filter(Boolean); return parts[parts.length-1]||''; }
  }
  function looksLikeUsername(v){ return /^[A-Za-z0-9._]{1,80}$/.test(String(v||'')); }
  function addToMap(map, username, href, ts, source){
    username=String(username||'').trim().replace(/^@/,'').replace(/\/$/,'');
    if(!username || !looksLikeUsername(username)) return;
    const key=username.toLowerCase();
    if(!map.has(key)) map.set(key,{key,username,href:href||instagramUrl(username),timestamp:ts||0,source});
    else{ const cur=map.get(key); if(!cur.timestamp && ts) cur.timestamp=ts; if(!cur.href && href) cur.href=href; }
  }
  function extractUsers(data, relKey, source){
    let arr=[]; if(relKey && data && Array.isArray(data[relKey])) arr=data[relKey]; else if(Array.isArray(data)) arr=data; else if(data && typeof data==='object') arr=[data];
    const map=new Map();
    for(const item of arr){
      if(!item || typeof item!=='object') continue;
      let username=item.title||''; let href=''; let ts=item.timestamp||0;
      const sld=Array.isArray(item.string_list_data)?item.string_list_data:[];
      if(sld[0]){ username=sld[0].value||username||usernameFromHref(sld[0].href); href=sld[0].href||href; ts=sld[0].timestamp||ts; }
      const labels=Array.isArray(item.label_values)?item.label_values:[];
      for(const lv of labels){ const val=lv && lv.value; if(looksLikeUsername(val)) username=val; }
      if(!username && href) username=usernameFromHref(href);
      addToMap(map,username,href,ts,source);
    }
    return map;
  }
  function findEntries(zip){
    const jsons=zip.entries.filter(e=>/\.json$/i.test(e.name));
    const followingEntry=jsons.find(e=>/(^|\/)connections\/followers_and_following\/following\.json$/i.test(e.name)) || jsons.find(e=>/(^|\/)following\.json$/i.test(e.name));
    const followerEntries=jsons.filter(e=>/(^|\/)connections\/followers_and_following\/followers_\d+\.json$/i.test(e.name));
    const looseFollowers=jsons.filter(e=>/(^|\/)followers_\d+\.json$/i.test(e.name));
    const recentUnfollowedEntry=jsons.find(e=>/(^|\/)recently_unfollowed_profiles\.json$/i.test(e.name));
    return {followingEntry, followerEntries:followerEntries.length?followerEntries:looseFollowers, recentUnfollowedEntry};
  }
  async function handleZip(file){
    setError(''); els.loadStatus.textContent='ZIP을 읽는 중입니다...'; state.sourceName=file.name;
    try{
      const zip=parseZipEntries(await file.arrayBuffer()); const found=findEntries(zip);
      if(!found.followingEntry || found.followerEntries.length===0){
        throw new Error('필수 파일을 찾지 못했습니다. Instagram 데이터 내보내기에서 “팔로워 및 팔로잉” 데이터를 체크해서 다시 받아주세요.\n필요 파일: following.json, followers_1.json');
      }
      els.loadStatus.textContent='팔로잉 데이터를 분석하는 중입니다...';
      const followingJson=JSON.parse(await inflateEntry(zip, found.followingEntry)); const following=extractUsers(followingJson,'relationships_following','following');
      els.loadStatus.textContent='팔로워 데이터를 분석하는 중입니다...';
      const followers=new Map();
      for(const ent of found.followerEntries){ const json=JSON.parse(await inflateEntry(zip,ent)); for(const [k,v] of extractU
```

## function inflateEntry

### Hit 1 at 72957

```js
n;
    navigator.clipboard?.writeText(row.username).then(()=>toast('@'+row.username+' 복사됨')).catch(()=>toast('복사 실패'));
  }

  function u16(dv,o){ return dv.getUint16(o,true); }
  function u32(dv,o){ return dv.getUint32(o,true); }
  function findEOCD(dv){ const min=Math.max(0,dv.byteLength-0xFFFF-22); for(let i=dv.byteLength-22;i>=min;i--){ if(u32(dv,i)===0x06054b50) return i; } throw new Error('ZIP 구조를 읽지 못했습니다. 인스타그램에서 받은 .zip 파일인지 확인해주세요.'); }
  function parseZipEntries(buf){
    const dv=new DataView(buf); const eocd=findEOCD(dv); const total=u16(dv,eocd+10); const cdSize=u32(dv,eocd+12); const cdOffset=u32(dv,eocd+16); const dec=new TextDecoder('utf-8'); let off=cdOffset; const entries=[];
    for(let i=0;i<total && off<cdOffset+cdSize;i++){
      if(u32(dv,off)!==0x02014b50) break;
      const method=u16(dv,off+10), compSize=u32(dv,off+20), uncompSize=u32(dv,off+24), nameLen=u16(dv,off+28), extraLen=u16(dv,off+30), commentLen=u16(dv,off+32), localOffset=u32(dv,off+42);
      const name=dec.decode(new Uint8Array(buf,off+46,nameLen)); entries.push({name,method,compSize,uncompSize,localOffset}); off += 46+nameLen+extraLen+commentLen;
    }
    return {buf, entries};
  }
  async function inflateEntry(zip, entry){
    const buf=zip.buf; const dv=new DataView(buf); const dec=new TextDecoder('utf-8'); const off=entry.localOffset;
    if(u32(dv,off)!==0x04034b50) throw new Error('ZIP 내부 파일 헤더를 읽지 못했습니다: '+entry.name);
    const nameLen=u16(dv,off+26), extraLen=u16(dv,off+28), start=off+30+nameLen+extraLen; const compressed=new Uint8Array(buf.slice(start,start+entry.compSize));
    if(entry.method===0) return dec.decode(compressed);
    if(entry.method!==8) throw new Error(`지원하지 않는 ZIP 압축 방식입니다: ${entry.name} / method ${entry.method}`);
    if(!('DecompressionStream' in window)) throw new Error('이 브라우저는 ZIP 압축 해제를 지원하지 않습니다. Chrome, Edge, Safari 최신 버전에서 열어주세요.');
    const ds=new DecompressionStream('deflate-raw'); const stream=new Blob([compressed]).stream().pipeThrough(ds); const ab=await new Response(stream).arrayBuffer(); return dec.decode(ab);
  }
  function usernameFromHref(href){
    if(!href) return '';
    try{ const u=new URL(href); const parts=u.pathname.split('/').filter(Boolean); if(parts[0]==='_u') return parts[1]||''; return parts[0]||''; }
    catch{ const parts=String(href).split('/').filter(Boolean); return parts[parts.length-1]||''; }
  }
  function looksLikeUsername(v){ return /^[A-Za-z0-9._]{1,80}$/.test(String(v||'')); }
  function addToMap(map, username, href, ts, source){
    username=String(username||'').trim().replace(/^@/,'').replace(/\/$/,'');
    if(!username || !looksLikeUsername(username)) return;
    const key=username.toLowerCase();
    if(!map.has(key)) map.set(key,{key,username,href:href||instagramUrl(username),timestamp:ts||0,source});
    else{ const cur=map.get(key); if(!cur.timestamp && ts) cur.timestamp=ts; if(!cur.href && href) cur.href=href; }
  }
  function extractUsers(data, relKey, source){
    let arr=[]; if(relKey && data && Array.isArray(data[relKey])) arr=data[relKey]; else if(Array.isArray(data)) arr=data; else if(data && typeof data==='object') arr=[data];
    const map=new Map();
    for(const item of arr){
      if(!item || typeof item!=='object') continue;
      let username=item.title||''; let href=''; let ts=item.timestamp||0;
      const sld=Array.isArray(item.string_list_data)?item.string_list_data:[];
      if(sld[0]){ username=sld[0].value||username||usernameFromHref(sld[0].href); href=sld[0].href||href; ts=sld[0].timestamp||ts; }
      const labels=Array.isArray(item.label_values)?item.label_values:[];
      for(const lv of labels){ const val=lv && lv.value; if(looksLikeUsername(val)) username=val; }
      if(!username && href) username=usernameFromHref(href);
      addToMap(map,username,href,ts,source);
    }
    return map;
  }
  function findEntries(zip){
    const jsons=zip.entries.filter(e=>/\.json$/i.test(e.name));
    const followingEntry=jsons.find(e=>/(^|\/)connections\/followers_and_following\/following\.json$/i.test(e.name)) || jsons.find(e=>/(^|\/)following\.json$/i.test(e.name));
    const followerEntries=jsons.filter(e=>/(^|\/)connections\/followers_and_following\/followers_\d+\.json$/i.test(e.name));
    const looseFollowers=jsons.filter(e=>/(^|\/)followers_\d+\.json$/i.test(e.name));
    const recentUnfollowedEntry=jsons.find(e=>/(^|\/)recently_unfollowed_profiles\.json$/i.test(e.name));
    return {followingEntry, followerEntries:followerEntries.length?followerEntries:looseFollowers, recentUnfollowedEntry};
  }
  async function handleZip(file){
    setError(''); els.loadStatus.textContent='ZIP을 읽는 중입니다...'; state.sourceName=file.name;
    try{
      const zip=parseZipEntries(await file.arrayBuffer()); const found=findEntries(zip);
      if(!found.followingEntry || found.followerEntries.length===0){
        throw new Error('필수 파일을 찾지 못했습니다. Instagram 데이터 내보내기에서 “팔로워 및 팔로잉” 데이터를 체크해서 다시 받아주세요.\n필요 파일: following.json, followers_1.json');
      }
      els.loadStatus.textContent='팔로잉 데이터를 분석하는 중입니다...';
      const followingJson=JSON.parse(await inflateEntry(zip, found.followingEntry)); const following=extractUsers(followingJson,'relationships_following','following');
      els.loadStatus.textContent='팔로워 데이터를 분석하는 중입니다...';
      const followers=new Map();
      for(const ent of found.followerEntries){ const json=JSON.parse(await inflateEntry(zip,ent)); for(const [k,v] of extractUsers(json,null,'followers')) followers.set(k,v); }
      const recentUnfollowed=new Map();
      if(found.recentUnfollowedEntry){ try{ const json=JSON.parse(await inflateEntry(zip,found.recentUnfollowedEntry)); for(const [k,v] of extractUsers(json,null,'recentlyUnfollowed')) recentUnfollowed.set(k,v); }catch(e){ console.warn(e); } }
      const allKeys=new Set([...following.keys(),...followers.keys(),...recentUnfollowed.keys()]); const rows=[];
      for(const key of allKeys){
        const fwing=following.get(key), fwer=followers.get(key), ru=recentUnfollowed.get(key), base=fwing||fwer||ru; const isFollowing=!!fwing, isFollower=!!fwer;
        let type='followersOnly', label='팔로워만';
        if(isFollowing&&isFollower){ type='mutual'; la
```

## function extractUsers

### Hit 1 at 74698

```js
hod ${entry.method}`);
    if(!('DecompressionStream' in window)) throw new Error('이 브라우저는 ZIP 압축 해제를 지원하지 않습니다. Chrome, Edge, Safari 최신 버전에서 열어주세요.');
    const ds=new DecompressionStream('deflate-raw'); const stream=new Blob([compressed]).stream().pipeThrough(ds); const ab=await new Response(stream).arrayBuffer(); return dec.decode(ab);
  }
  function usernameFromHref(href){
    if(!href) return '';
    try{ const u=new URL(href); const parts=u.pathname.split('/').filter(Boolean); if(parts[0]==='_u') return parts[1]||''; return parts[0]||''; }
    catch{ const parts=String(href).split('/').filter(Boolean); return parts[parts.length-1]||''; }
  }
  function looksLikeUsername(v){ return /^[A-Za-z0-9._]{1,80}$/.test(String(v||'')); }
  function addToMap(map, username, href, ts, source){
    username=String(username||'').trim().replace(/^@/,'').replace(/\/$/,'');
    if(!username || !looksLikeUsername(username)) return;
    const key=username.toLowerCase();
    if(!map.has(key)) map.set(key,{key,username,href:href||instagramUrl(username),timestamp:ts||0,source});
    else{ const cur=map.get(key); if(!cur.timestamp && ts) cur.timestamp=ts; if(!cur.href && href) cur.href=href; }
  }
  function extractUsers(data, relKey, source){
    let arr=[]; if(relKey && data && Array.isArray(data[relKey])) arr=data[relKey]; else if(Array.isArray(data)) arr=data; else if(data && typeof data==='object') arr=[data];
    const map=new Map();
    for(const item of arr){
      if(!item || typeof item!=='object') continue;
      let username=item.title||''; let href=''; let ts=item.timestamp||0;
      const sld=Array.isArray(item.string_list_data)?item.string_list_data:[];
      if(sld[0]){ username=sld[0].value||username||usernameFromHref(sld[0].href); href=sld[0].href||href; ts=sld[0].timestamp||ts; }
      const labels=Array.isArray(item.label_values)?item.label_values:[];
      for(const lv of labels){ const val=lv && lv.value; if(looksLikeUsername(val)) username=val; }
      if(!username && href) username=usernameFromHref(href);
      addToMap(map,username,href,ts,source);
    }
    return map;
  }
  function findEntries(zip){
    const jsons=zip.entries.filter(e=>/\.json$/i.test(e.name));
    const followingEntry=jsons.find(e=>/(^|\/)connections\/followers_and_following\/following\.json$/i.test(e.name)) || jsons.find(e=>/(^|\/)following\.json$/i.test(e.name));
    const followerEntries=jsons.filter(e=>/(^|\/)connections\/followers_and_following\/followers_\d+\.json$/i.test(e.name));
    const looseFollowers=jsons.filter(e=>/(^|\/)followers_\d+\.json$/i.test(e.name));
    const recentUnfollowedEntry=jsons.find(e=>/(^|\/)recently_unfollowed_profiles\.json$/i.test(e.name));
    return {followingEntry, followerEntries:followerEntries.length?followerEntries:looseFollowers, recentUnfollowedEntry};
  }
  async function handleZip(file){
    setError(''); els.loadStatus.textContent='ZIP을 읽는 중입니다...'; state.sourceName=file.name;
    try{
      const zip=parseZipEntries(await file.arrayBuffer()); const found=findEntries(zip);
      if(!found.followingEntry || found.followerEntries.length===0){
        throw new Error('필수 파일을 찾지 못했습니다. Instagram 데이터 내보내기에서 “팔로워 및 팔로잉” 데이터를 체크해서 다시 받아주세요.\n필요 파일: following.json, followers_1.json');
      }
      els.loadStatus.textContent='팔로잉 데이터를 분석하는 중입니다...';
      const followingJson=JSON.parse(await inflateEntry(zip, found.followingEntry)); const following=extractUsers(followingJson,'relationships_following','following');
      els.loadStatus.textContent='팔로워 데이터를 분석하는 중입니다...';
      const followers=new Map();
      for(const ent of found.followerEntries){ const json=JSON.parse(await inflateEntry(zip,ent)); for(const [k,v] of extractUsers(json,null,'followers')) followers.set(k,v); }
      const recentUnfollowed=new Map();
      if(found.recentUnfollowedEntry){ try{ const json=JSON.parse(await inflateEntry(zip,found.recentUnfollowedEntry)); for(const [k,v] of extractUsers(json,null,'recentlyUnfollowed')) recentUnfollowed.set(k,v); }catch(e){ console.warn(e); } }
      const allKeys=new Set([...following.keys(),...followers.keys(),...recentUnfollowed.keys()]); const rows=[];
      for(const key of allKeys){
        const fwing=following.get(key), fwer=followers.get(key), ru=recentUnfollowed.get(key), base=fwing||fwer||ru; const isFollowing=!!fwing, isFollower=!!fwer;
        let type='followersOnly', label='팔로워만';
        if(isFollowing&&isFollower){ type='mutual'; label='맞팔'; }
        else if(isFollowing&&!isFollower){ type='nonMutual'; label='취소 검토'; }
        else if(!isFollowing&&isFollower){ type='followersOnly'; label='팔로워만'; }
        else if(ru){ type='recentlyUnfollowed'; label='최근 언팔 기록'; }
        const deleted=/^__deleted__/i.test(base.username)||/deleted/i.test(base.username);
        rows.push({key,username:base.username,href:base.href||instagramUrl(base.username),timestamp:base.timestamp||0,isFollowing,isFollower,type,label,deleted,recentlyUnfollowed:!!ru});
      }
      state.allRows=rows; state.counts={following:following.size,followers:followers.size,mutual:rows.filter(r=>r.isFollowing&&r.isFollower).length,nonMutual:rows.filter(r=>r.isFollowing&&!r.isFollower).length,followersOnly:rows.filter(r=>!r.isFollowing&&r.isFollower).length,deleted:rows.filter(r=>r.deleted).length,recentlyUnfollowed:recentUnfollowed.size};
      state.loaded=true; state.activeTab='nonMutual'; state.visibleLimit=100; state.focusKey=null; state.dataDate=Math.max(0,...rows.map(r=>Number(r.timestamp)||0)); document.body.classList.add('has-data'); els.appPanel.classList.remove('hidden'); els.loadStatus.textContent=`${file.name} 분석 완료`; render(); if(window.matchMedia('(max-width:900px)').matches) setTimeout(()=>document.getElementById('results')?.scrollIntoView({behavior:'smooth',block:'start'}),120); toast('분석 완료');
    }catch(err){ console.error(err); setError(err.message||String(err)); els.loadStatus.textContent='파일 분석 실패'; }
  }


  function loadSampleData(){
    setError('');
    const now=Math.floor(Date.now()/1000);
    const sampleFollowing=['bluepen_shop','tokyo_stationery','daily.snap.kr','fountain_life','paper_and_ink','photo_walk_seoul','travel_japan_note','analog_writer','
```

## function loadProgress

### Hit 1 at 68857

```js
ountMutual: $('#heroCountMutual'), heroCountNonMutual: $('#heroCountNonMutual'), heroCountFollowersOnly: $('#heroCountFollowersOnly'),
    heroSummaryStatus: $('#heroSummaryStatus'), dataDateText: $('#dataDateText'), returnSheet: $('#returnSheet'), returnDoneBtn: $('#returnDoneBtn'), returnKeepBtn: $('#returnKeepBtn'), returnLaterBtn: $('#returnLaterBtn')
  };

  const STORAGE_KEY = 'matchal_checker_v7_progress';
  const SETTINGS_KEY = 'matchal_checker_v7_settings';
  const tabDefs = [
    ['nonMutual','취소 검토','내가 팔로우하지만 나를 팔로우하지 않는 계정입니다. 수동으로 팔로우 취소 여부를 검토하세요.'],
    ['mutual','맞팔','서로 팔로우 중인 계정입니다. 보통 유지 대상입니다.'],
    ['following','팔로잉 전체','내가 팔로우 중인 전체 계정입니다.'],
    ['followersOnly','팔로워만','나를 팔로우하지만 나는 팔로우하지 않는 계정입니다.'],
    ['deleted','삭제/비활성 의심','아이디가 삭제/비활성 형태로 보이는 계정입니다.'],
    ['recentlyUnfollowed','최근 언팔 기록','인스타 데이터에 포함된 최근 언팔 기록입니다. 선택 데이터가 없으면 비어 있습니다.']
  ];
  const statusMap = {new:'미처리', opened:'열어봄', done:'완료', keep:'유지', issue:'문제/보류'};
  let state = {loaded:false, activeTab:'nonMutual', visibleLimit:100, allRows:[], progress:loadProgress(), settings:loadSettings(), counts:{}, sourceName:'', sessionOpened:0, focusKey:null, dataDate:0, awaitingReturnKey:null};

  function loadProgress(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{return {}} }
  function loadSettings(){ try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}catch{return {}} }
  function saveProgress(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); updateProgress(); }
  function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); }
  function fmt(n){ return Number(n||0).toLocaleString('ko-KR'); }
  function escapeHtml(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function setError(msg){ els.errorBox.textContent = msg || ''; els.errorBox.classList.toggle('hidden', !msg); }
  function toast(msg){ const old=$('.toast'); if(old) old.remove(); const el=document.createElement('div'); el.className='toast'; el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.remove(),1800); }
  function instagramUrl(username){ return `https://www.instagram.com/${encodeURIComponent(username)}/`; }
  function dateText(ts){ if(!ts) return '-'; const d=new Date(Number(ts)*1000); if(Number.isNaN(d.getTime())) return '-'; return d.toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}); }
  function rowStatus(row){ return state.progress[row.key]?.status || 'new'; }
  function statusText(row){ return statusMap[rowStatus(row)] || '미처리'; }
  function labelForType(type){ return tabDefs.find(t=>t[0]===type)?.[1] || type; }
  function initials(username){ return String(username||'?').replace(/^_+/, '').slice(0,2).toUpperCase() || '?'; }

  function setStatus(rowOrUsername, status, moveNext=false){
    const row = typeof rowOrUsername === 'string' ? state.allRows.find(r=>r.key===rowOrUsername.toLowerCase() || r.username===rowOrUsername) : rowOrUsername;
    if(!row) return;
    if(status === 'new') delete state.progress[row.key];
    else state.progress[row.key] = {username:row.username, status, updatedAt:new Date().toISOString()};
    saveProgress();
    if(moveNext) state.focusKey = nextWorkRow(row.key)?.key || null;
    render();
  }
  function markOpened(row){
    if(!row) return;
    const cur = state.progress[row.key]?.status;
    if(!cur || cur === 'new') state.progress[row.key] = {username:row.username, status:'opened', updatedAt:new Date().toISOString()};
    state.sessionOpened += 1;
    saveProgress();
    updateSession();
  }
  function openProfile(row){
    if(!row) return;
    markOpened(row);
    const url = row.href || instagramUrl(row.username);
    if(els.sameTabInput.checked) location.href = url;
    else window.open(url, '_blank', 'noopener,noreferrer');
    state.focusKey = row.key;
    state.awaitingReturnKey = row.key;
    sessionStorage.setItem('matchal_checker_awaiting_return', row.key);
    renderFocus();
  }
  function copyUsername(row){
    if(!row) return;
    navigator.clipboard?.writeText(row.username).then(()=>toast('@'+row.username+' 복사됨')).catch(()=>toast('복사 실패'));
  }

  function u16(dv,o){ return dv.getUint16(o,true); }
  function u32(dv,o){ return dv.getUint32(o,true); }
  function findEOCD(dv){ const min=Math.max(0,dv.byteLength-0xFFFF-22); for(let i=dv.byteLength-22;i>=min;i--){ if(u32(dv,i)===0x06054b50) return i; } throw new Error('ZIP 구조를 읽지 못했습니다. 인스타그램에서 받은 .zip 파일인지 확인해주세요.'); }
  function parseZipEntries(buf){
    const dv=new DataView(buf); const eocd=findEOCD(dv); const total=u16(dv,eocd+10); const cdSize=u32(dv,eocd+12); const cdOffset=u32(dv,eocd+16); const dec=new TextDecoder('utf-8'); let off=cdOffset; const entries=[];
    for(let i=0;i<total && off<cdOffset+cdSize;i++){
      if(u32(dv,off)!==0x02014b50) break;
      const method=u16(dv,off+10), compSize=u32(dv,off+20), uncompSize=u32(dv,off+24), nameLen=u16(dv,off+28), extraLen=u16(dv,off+30), commentLen=u16(dv,off+32), localOffset=u32(dv,off+42);
      const name=dec.decode(new Uint8Array(buf,off+46,nameLen)); entries.push({name,method,compSize,uncompSize,localOffset}); off += 46+nameLen+extraLen+commentLen;
    }
    return {buf, entries};
  }
  async function inflateEntry(zip, entry){
    const buf=zip.buf; const dv=new DataView(buf); const dec=new TextDecoder('utf-8'); const off=entry.localOffset;
    if(u32(dv,off)!==0x04034b50) throw new Error('ZIP 내부 파일 헤더를 읽지 못했습니다: '+entry.name);
    const nameLen=u16(dv,off+26), extraLen=u16(dv,off+28), start=off+30+nameLen+extraLen; const compressed=new Uint8Array(buf.slice(start,start+entry.compSize));
    if(entry.method===0) return dec.decode(compressed);
    if(entry.method!==8) throw new Error(`지원하지 않는 ZIP 압축 방식입니다: ${entry.name} / method ${entry.method}`);
    if(!('DecompressionStream' in window)) throw new Error('이 브라우저는 ZIP 압축 해제를 지원하지 않습니다. Chrome, Edge, Safari 최신 버전에서 열어주세요.');
    const ds=new DecompressionStream('deflate-raw'); const stream=new Blob([compressed]).stream().pipeThrough(ds); const ab=await new Response(stream).arrayBuffer(); return dec.decode(ab);
  }
  function use
```

## function saveProgress

### Hit 1 at 69076

```js
turnSheet: $('#returnSheet'), returnDoneBtn: $('#returnDoneBtn'), returnKeepBtn: $('#returnKeepBtn'), returnLaterBtn: $('#returnLaterBtn')
  };

  const STORAGE_KEY = 'matchal_checker_v7_progress';
  const SETTINGS_KEY = 'matchal_checker_v7_settings';
  const tabDefs = [
    ['nonMutual','취소 검토','내가 팔로우하지만 나를 팔로우하지 않는 계정입니다. 수동으로 팔로우 취소 여부를 검토하세요.'],
    ['mutual','맞팔','서로 팔로우 중인 계정입니다. 보통 유지 대상입니다.'],
    ['following','팔로잉 전체','내가 팔로우 중인 전체 계정입니다.'],
    ['followersOnly','팔로워만','나를 팔로우하지만 나는 팔로우하지 않는 계정입니다.'],
    ['deleted','삭제/비활성 의심','아이디가 삭제/비활성 형태로 보이는 계정입니다.'],
    ['recentlyUnfollowed','최근 언팔 기록','인스타 데이터에 포함된 최근 언팔 기록입니다. 선택 데이터가 없으면 비어 있습니다.']
  ];
  const statusMap = {new:'미처리', opened:'열어봄', done:'완료', keep:'유지', issue:'문제/보류'};
  let state = {loaded:false, activeTab:'nonMutual', visibleLimit:100, allRows:[], progress:loadProgress(), settings:loadSettings(), counts:{}, sourceName:'', sessionOpened:0, focusKey:null, dataDate:0, awaitingReturnKey:null};

  function loadProgress(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{return {}} }
  function loadSettings(){ try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}catch{return {}} }
  function saveProgress(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); updateProgress(); }
  function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); }
  function fmt(n){ return Number(n||0).toLocaleString('ko-KR'); }
  function escapeHtml(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function setError(msg){ els.errorBox.textContent = msg || ''; els.errorBox.classList.toggle('hidden', !msg); }
  function toast(msg){ const old=$('.toast'); if(old) old.remove(); const el=document.createElement('div'); el.className='toast'; el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.remove(),1800); }
  function instagramUrl(username){ return `https://www.instagram.com/${encodeURIComponent(username)}/`; }
  function dateText(ts){ if(!ts) return '-'; const d=new Date(Number(ts)*1000); if(Number.isNaN(d.getTime())) return '-'; return d.toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}); }
  function rowStatus(row){ return state.progress[row.key]?.status || 'new'; }
  function statusText(row){ return statusMap[rowStatus(row)] || '미처리'; }
  function labelForType(type){ return tabDefs.find(t=>t[0]===type)?.[1] || type; }
  function initials(username){ return String(username||'?').replace(/^_+/, '').slice(0,2).toUpperCase() || '?'; }

  function setStatus(rowOrUsername, status, moveNext=false){
    const row = typeof rowOrUsername === 'string' ? state.allRows.find(r=>r.key===rowOrUsername.toLowerCase() || r.username===rowOrUsername) : rowOrUsername;
    if(!row) return;
    if(status === 'new') delete state.progress[row.key];
    else state.progress[row.key] = {username:row.username, status, updatedAt:new Date().toISOString()};
    saveProgress();
    if(moveNext) state.focusKey = nextWorkRow(row.key)?.key || null;
    render();
  }
  function markOpened(row){
    if(!row) return;
    const cur = state.progress[row.key]?.status;
    if(!cur || cur === 'new') state.progress[row.key] = {username:row.username, status:'opened', updatedAt:new Date().toISOString()};
    state.sessionOpened += 1;
    saveProgress();
    updateSession();
  }
  function openProfile(row){
    if(!row) return;
    markOpened(row);
    const url = row.href || instagramUrl(row.username);
    if(els.sameTabInput.checked) location.href = url;
    else window.open(url, '_blank', 'noopener,noreferrer');
    state.focusKey = row.key;
    state.awaitingReturnKey = row.key;
    sessionStorage.setItem('matchal_checker_awaiting_return', row.key);
    renderFocus();
  }
  function copyUsername(row){
    if(!row) return;
    navigator.clipboard?.writeText(row.username).then(()=>toast('@'+row.username+' 복사됨')).catch(()=>toast('복사 실패'));
  }

  function u16(dv,o){ return dv.getUint16(o,true); }
  function u32(dv,o){ return dv.getUint32(o,true); }
  function findEOCD(dv){ const min=Math.max(0,dv.byteLength-0xFFFF-22); for(let i=dv.byteLength-22;i>=min;i--){ if(u32(dv,i)===0x06054b50) return i; } throw new Error('ZIP 구조를 읽지 못했습니다. 인스타그램에서 받은 .zip 파일인지 확인해주세요.'); }
  function parseZipEntries(buf){
    const dv=new DataView(buf); const eocd=findEOCD(dv); const total=u16(dv,eocd+10); const cdSize=u32(dv,eocd+12); const cdOffset=u32(dv,eocd+16); const dec=new TextDecoder('utf-8'); let off=cdOffset; const entries=[];
    for(let i=0;i<total && off<cdOffset+cdSize;i++){
      if(u32(dv,off)!==0x02014b50) break;
      const method=u16(dv,off+10), compSize=u32(dv,off+20), uncompSize=u32(dv,off+24), nameLen=u16(dv,off+28), extraLen=u16(dv,off+30), commentLen=u16(dv,off+32), localOffset=u32(dv,off+42);
      const name=dec.decode(new Uint8Array(buf,off+46,nameLen)); entries.push({name,method,compSize,uncompSize,localOffset}); off += 46+nameLen+extraLen+commentLen;
    }
    return {buf, entries};
  }
  async function inflateEntry(zip, entry){
    const buf=zip.buf; const dv=new DataView(buf); const dec=new TextDecoder('utf-8'); const off=entry.localOffset;
    if(u32(dv,off)!==0x04034b50) throw new Error('ZIP 내부 파일 헤더를 읽지 못했습니다: '+entry.name);
    const nameLen=u16(dv,off+26), extraLen=u16(dv,off+28), start=off+30+nameLen+extraLen; const compressed=new Uint8Array(buf.slice(start,start+entry.compSize));
    if(entry.method===0) return dec.decode(compressed);
    if(entry.method!==8) throw new Error(`지원하지 않는 ZIP 압축 방식입니다: ${entry.name} / method ${entry.method}`);
    if(!('DecompressionStream' in window)) throw new Error('이 브라우저는 ZIP 압축 해제를 지원하지 않습니다. Chrome, Edge, Safari 최신 버전에서 열어주세요.');
    const ds=new DecompressionStream('deflate-raw'); const stream=new Blob([compressed]).stream().pipeThrough(ds); const ab=await new Response(stream).arrayBuffer(); return dec.decode(ab);
  }
  function usernameFromHref(href){
    if(!href) return '';
    try{ const u=new URL(href); const parts=u.pathname.split('/').filter(Boolean); if(parts[0]==='_u') return parts[1]||''; return parts[0]||''; }
    catch{ const parts=Str
```

## function setStatus

### Hit 1 at 70491

```js
tion fmt(n){ return Number(n||0).toLocaleString('ko-KR'); }
  function escapeHtml(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function setError(msg){ els.errorBox.textContent = msg || ''; els.errorBox.classList.toggle('hidden', !msg); }
  function toast(msg){ const old=$('.toast'); if(old) old.remove(); const el=document.createElement('div'); el.className='toast'; el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.remove(),1800); }
  function instagramUrl(username){ return `https://www.instagram.com/${encodeURIComponent(username)}/`; }
  function dateText(ts){ if(!ts) return '-'; const d=new Date(Number(ts)*1000); if(Number.isNaN(d.getTime())) return '-'; return d.toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}); }
  function rowStatus(row){ return state.progress[row.key]?.status || 'new'; }
  function statusText(row){ return statusMap[rowStatus(row)] || '미처리'; }
  function labelForType(type){ return tabDefs.find(t=>t[0]===type)?.[1] || type; }
  function initials(username){ return String(username||'?').replace(/^_+/, '').slice(0,2).toUpperCase() || '?'; }

  function setStatus(rowOrUsername, status, moveNext=false){
    const row = typeof rowOrUsername === 'string' ? state.allRows.find(r=>r.key===rowOrUsername.toLowerCase() || r.username===rowOrUsername) : rowOrUsername;
    if(!row) return;
    if(status === 'new') delete state.progress[row.key];
    else state.progress[row.key] = {username:row.username, status, updatedAt:new Date().toISOString()};
    saveProgress();
    if(moveNext) state.focusKey = nextWorkRow(row.key)?.key || null;
    render();
  }
  function markOpened(row){
    if(!row) return;
    const cur = state.progress[row.key]?.status;
    if(!cur || cur === 'new') state.progress[row.key] = {username:row.username, status:'opened', updatedAt:new Date().toISOString()};
    state.sessionOpened += 1;
    saveProgress();
    updateSession();
  }
  function openProfile(row){
    if(!row) return;
    markOpened(row);
    const url = row.href || instagramUrl(row.username);
    if(els.sameTabInput.checked) location.href = url;
    else window.open(url, '_blank', 'noopener,noreferrer');
    state.focusKey = row.key;
    state.awaitingReturnKey = row.key;
    sessionStorage.setItem('matchal_checker_awaiting_return', row.key);
    renderFocus();
  }
  function copyUsername(row){
    if(!row) return;
    navigator.clipboard?.writeText(row.username).then(()=>toast('@'+row.username+' 복사됨')).catch(()=>toast('복사 실패'));
  }

  function u16(dv,o){ return dv.getUint16(o,true); }
  function u32(dv,o){ return dv.getUint32(o,true); }
  function findEOCD(dv){ const min=Math.max(0,dv.byteLength-0xFFFF-22); for(let i=dv.byteLength-22;i>=min;i--){ if(u32(dv,i)===0x06054b50) return i; } throw new Error('ZIP 구조를 읽지 못했습니다. 인스타그램에서 받은 .zip 파일인지 확인해주세요.'); }
  function parseZipEntries(buf){
    const dv=new DataView(buf); const eocd=findEOCD(dv); const total=u16(dv,eocd+10); const cdSize=u32(dv,eocd+12); const cdOffset=u32(dv,eocd+16); const dec=new TextDecoder('utf-8'); let off=cdOffset; const entries=[];
    for(let i=0;i<total && off<cdOffset+cdSize;i++){
      if(u32(dv,off)!==0x02014b50) break;
      const method=u16(dv,off+10), compSize=u32(dv,off+20), uncompSize=u32(dv,off+24), nameLen=u16(dv,off+28), extraLen=u16(dv,off+30), commentLen=u16(dv,off+32), localOffset=u32(dv,off+42);
      const name=dec.decode(new Uint8Array(buf,off+46,nameLen)); entries.push({name,method,compSize,uncompSize,localOffset}); off += 46+nameLen+extraLen+commentLen;
    }
    return {buf, entries};
  }
  async function inflateEntry(zip, entry){
    const buf=zip.buf; const dv=new DataView(buf); const dec=new TextDecoder('utf-8'); const off=entry.localOffset;
    if(u32(dv,off)!==0x04034b50) throw new Error('ZIP 내부 파일 헤더를 읽지 못했습니다: '+entry.name);
    const nameLen=u16(dv,off+26), extraLen=u16(dv,off+28), start=off+30+nameLen+extraLen; const compressed=new Uint8Array(buf.slice(start,start+entry.compSize));
    if(entry.method===0) return dec.decode(compressed);
    if(entry.method!==8) throw new Error(`지원하지 않는 ZIP 압축 방식입니다: ${entry.name} / method ${entry.method}`);
    if(!('DecompressionStream' in window)) throw new Error('이 브라우저는 ZIP 압축 해제를 지원하지 않습니다. Chrome, Edge, Safari 최신 버전에서 열어주세요.');
    const ds=new DecompressionStream('deflate-raw'); const stream=new Blob([compressed]).stream().pipeThrough(ds); const ab=await new Response(stream).arrayBuffer(); return dec.decode(ab);
  }
  function usernameFromHref(href){
    if(!href) return '';
    try{ const u=new URL(href); const parts=u.pathname.split('/').filter(Boolean); if(parts[0]==='_u') return parts[1]||''; return parts[0]||''; }
    catch{ const parts=String(href).split('/').filter(Boolean); return parts[parts.length-1]||''; }
  }
  function looksLikeUsername(v){ return /^[A-Za-z0-9._]{1,80}$/.test(String(v||'')); }
  function addToMap(map, username, href, ts, source){
    username=String(username||'').trim().replace(/^@/,'').replace(/\/$/,'');
    if(!username || !looksLikeUsername(username)) return;
    const key=username.toLowerCase();
    if(!map.has(key)) map.set(key,{key,username,href:href||instagramUrl(username),timestamp:ts||0,source});
    else{ const cur=map.get(key); if(!cur.timestamp && ts) cur.timestamp=ts; if(!cur.href && href) cur.href=href; }
  }
  function extractUsers(data, relKey, source){
    let arr=[]; if(relKey && data && Array.isArray(data[relKey])) arr=data[relKey]; else if(Array.isArray(data)) arr=data; else if(data && typeof data==='object') arr=[data];
    const map=new Map();
    for(const item of arr){
      if(!item || typeof item!=='object') continue;
      let username=item.title||''; let href=''; let ts=item.timestamp||0;
      const sld=Array.isArray(item.string_list_data)?item.string_list_data:[];
      if(sld[0]){ username=sld[0].value||username||usernameFromHref(sld[0].href); href=sld[0].href||href; ts=sld[0].timestamp||ts; }
      const labels=Array.isArray(item.label_values)?item.label_values:[];
      for(const lv of labels){ const val=lv && lv.value; if(looksLikeUsername(val)) username=val; }
      if
```

## function markStatus

_No matches_

## function updateProgress

### Hit 1 at 85324

```js
  function updateStats(){
    els.countFollowing.textContent=fmt(state.counts.following); els.countFollowers.textContent=fmt(state.counts.followers); els.countMutual.textContent=fmt(state.counts.mutual); els.countNonMutual.textContent=fmt(state.counts.nonMutual);
    if(els.heroCountFollowing) els.heroCountFollowing.textContent=fmt(state.counts.following);
    if(els.heroCountMutual) els.heroCountMutual.textContent=fmt(state.counts.mutual);
    if(els.heroCountNonMutual) els.heroCountNonMutual.textContent=fmt(state.counts.nonMutual);
    if(els.heroCountFollowersOnly) els.heroCountFollowersOnly.textContent=fmt(state.counts.followersOnly);
    if(els.heroSummaryStatus) els.heroSummaryStatus.textContent=state.loaded?'분석 완료':'업로드 전';
    if(els.dataDateText) els.dataDateText.textContent=state.dataDate?`데이터 기준 ${dateText(state.dataDate)}`:'ZIP 생성 시점 기준';
    for(const [key] of tabDefs){ const el=document.getElementById('tabCount_'+key); if(!el) continue; const c=state.counts; const val=key==='following'?c.following:key==='mutual'?c.mutual:key==='nonMutual'?c.nonMutual:key==='followersOnly'?c.followersOnly:key==='deleted'?c.deleted:c.recentlyUnfollowed; el.textContent=fmt(val); }
  }
  function updateProgress(){
    if(!state.loaded) return;
    const targets=state.allRows.filter(r=>r.isFollowing&&!r.isFollower); const done=targets.filter(r=>state.progress[r.key]?.status==='done').length; const pct=targets.length?Math.round(done/targets.length*1000)/10:0;
    els.countDone.textContent=fmt(done); els.progressBar.style.width=pct+'%'; els.progressText.textContent=`취소 검토 대상 기준 ${pct}% 완료 · ${fmt(done)} / ${fmt(targets.length)}`;
    const today=new Date().toISOString().slice(0,10); const todayDone=targets.filter(r=>state.progress[r.key]?.status==='done' && String(state.progress[r.key]?.updatedAt||'').slice(0,10)===today).length; const goal=Number(els.dailyGoalInput?.value||state.settings.dailyGoal||50); if(els.todayProgressText) els.todayProgressText.textContent=`오늘 완료 ${fmt(todayDone)}명 · 목표 ${fmt(goal)}명`; if(els.dailyGoalInput && goal) els.dailyGoalInput.value=goal;
  }
  function updateSession(){ els.sessionCount.textContent=fmt(state.sessionOpened); els.sessionText.textContent=`이번 세션 ${fmt(state.sessionOpened)}명 열람`; }
  function buildTabs(){
    els.tabs.innerHTML=tabDefs.map(([key,label])=>`<button class="tab ${key===state.activeTab?'active':''}" data-tab="${key}">${label} <small id="tabCount_${key}"></small></button>`).join('');
    els.tabs.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{ state.activeTab=btn.dataset.tab; state.visibleLimit=100; state.focusKey=null; render(); }));
  }
  function actionButtons(row){
    return `<div class="actions">
      <button class="btn primary" data-action="open" data-key="${escapeHtml(row.key)}">프로필 열기</button>
      <button class="btn ok" data-action="done" data-key="${escapeHtml(row.key)}">완료</button>
      <button class="btn warn" data-action="keep" data-key="${escapeHtml(row.key)}">유지</button>
      <button class="btn danger" data-action="issue" data-key="${escapeHtml(row.key)}">문제</button>
      <button class="btn ghost" data-action="copy" data-key="${escapeHtml(row.key)}">복사</button>
    </div>`;
  }
  function renderRows(){
    const rows=filteredRows(); const show=rows.slice(0,state.visibleLimit);
    if(show.length===0){ els.tbody.innerHTML=`<tr><td colspan="6"><div class="empty"><strong>표시할 계정이 없습니다</strong>검색어나 필터를 조정해보세요.</div></td></tr>`; els.mobileList.innerHTML='<div class="empty"><strong>표시할 계정이 없습니다</strong>검색어나 필터를 조정해보세요.</div>'; }
    else{
      els.tbody.innerHTML=show.map((r,i)=>`<tr>
        <td>${i+1}</td>
        <td><div class="userCell"><div class="avatar">${escapeHtml(initials(r.username))}</div><div><span class="username">@${escapeHtml(r.username)}</span><span class="sub">${r.isFollowing?'팔로잉':''}${r.isFollowing&&r.isFollower?' · ':''}${r.isFollower?'팔로워':''}${r.deleted?' · 삭제/비활성 의심':''}</span></div></div></td>
        <td><span class="pill ${escapeHtml(r.deleted?'deleted':r.type)}">${escapeHtml(r.deleted?'삭제 의심':r.label)}</span></td>
        <td><span class="pill ${escapeHtml(rowStatus(r))}">${escapeHtml(statusText(r))}</span></td>
        <td>${escapeHtml(dateText(r.timestamp))}</td>
        <td>${actionButtons(r)}</td>
      </tr>`).join('');
      els.mobileList.innerHTML=show.map((r,i)=>`<article class="userCard">
        <div class="userCardHead"><div class="userCell"><div class="avatar">${escapeHtml(initials(r.username))}</div><div><span class="username">@${escapeHtml(r.username)}</span><span class="sub">${i+1} · ${escapeHtml(dateText(r.timestamp))}</span></div></div><span class="pill ${escapeHtml(rowStatus(r))}">${escapeHtml(statusText(r))}</span></div>
        <div style="margin-top:10px"><span class="pill ${escapeHtml(r.deleted?'deleted':r.type)}">${escapeHtml(r.deleted?'삭제 의심':r.label)}</span></div>${actionButtons(r)}
      </article>`).join('');
    }
    document.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>{ const row=state.allRows.find(r=>r.key===btn.dataset.key); if(!row) return; const action=btn.dataset.action; if(action==='open') openProfile(row); if(action==='done') setStatus(row,'done'); if(action==='keep') setStatus(row,'keep'); if(action==='issue') setStatus(row,'issue'); if(action==='copy') copyUsername(row); }));
    els.resultInfo.textContent=`${fmt(rows.length)}개 중 ${fmt(show.length)}개 표시`; els.moreBtn.disabled=show.length>=rows.length;
  }
  function renderFocus(){
    const row=currentFocusRow(); const def=tabDefs.find(t=>t[0]===state.activeTab);
    if(!row){ els.focusUsername.textContent='대상 없음'; els.focusType.textContent='-'; els.focusStatus.textContent='-'; els.focusDate.textContent='-'; els.focusFilter.textContent=def?.[1]||'-'; els.focusStatusPill.textContent='완료'; els.focusStatusPill.className='pill done'; [els.focusOpenBtn,els.focusDoneBtn,els.focusKeepBtn,els.focusIssueBtn].forEach(b=>b.disabled=true); return; }
    state.focusKey=row.key; els.focusUsername.textContent='@'+row.username; els.focusType.textContent=row.deleted?'삭제 의심':row.label; els.focusStatus.textContent=statusText(row); els.focusDate.textContent=dateText(
```

## function renderAll

_No matches_

## progressInput.addEventListener

### Hit 1 at 94091

```js
=>x.trim().replace(/^"|"$/g,'')); const [username,status]=cols; if(username&&status) imported[username.toLowerCase()]={username,status,updatedAt:new Date().toISOString()}; }
      state.progress=imported; saveProgress(); render(); toast('CSV 불러오기 완료');
    }catch(e){ setError('진행상황 파일을 읽지 못했습니다: '+e.message); }
  }
  function clearProgress(){ if(confirm('저장된 진행상황을 모두 초기화할까요?')){ state.progress={}; saveProgress(); render(); toast('진행상황 초기화 완료'); } }

  function maybeShowReturnSheet(){
    if(!window.matchMedia('(max-width:900px)').matches || !state.loaded) return;
    const key=sessionStorage.getItem('matchal_checker_awaiting_return') || state.awaitingReturnKey;
    const row=state.allRows.find(r=>r.key===key);
    if(!row || ['done','keep'].includes(rowStatus(row))) return;
    state.focusKey=row.key; renderFocus();
    setTimeout(()=>els.returnSheet?.classList.remove('hidden'),180);
  }
  function closeReturnSheet(){ els.returnSheet?.classList.add('hidden'); sessionStorage.removeItem('matchal_checker_awaiting_return'); state.awaitingReturnKey=null; }

  function bind(){
    els.zipInput.addEventListener('change',e=>{ if(e.target.files[0]) handleZip(e.target.files[0]); });
    els.progressInput.addEventListener('change',e=>{ if(e.target.files[0]) importProgress(e.target.files[0]); });
    ['dragenter','dragover'].forEach(ev=>els.drop.addEventListener(ev,e=>{ e.preventDefault(); els.drop.classList.add('drag'); }));
    ['dragleave','drop'].forEach(ev=>els.drop.addEventListener(ev,e=>{ e.preventDefault(); els.drop.classList.remove('drag'); }));
    els.drop.addEventListener('drop',e=>{ const f=e.dataTransfer.files[0]; if(f) handleZip(f); });
    [els.searchInput,els.sortSelect,els.statusSelect,els.hideDoneInput].forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{ state.visibleLimit=100; state.focusKey=null; if(el===els.hideDoneInput) state.settings.hideDone=els.hideDoneInput.checked; saveSettings(); render(); }));
    els.sameTabInput.addEventListener('change',()=>{ state.settings.sameTab=els.sameTabInput.checked; saveSettings(); });
    els.moreBtn.addEventListener('click',()=>{ state.visibleLimit+=100; renderRows(); });
    els.exportBtn.addEventListener('click',exportProgress); els.sideExportBtn.addEventListener('click',exportProgress); els.sideClearBtn.addEventListener('click',clearProgress); if(els.exportCsvBtn) els.exportCsvBtn.addEventListener('click',exportCsv);
    [els.sampleBtn,els.sampleBtnInline,els.sideSampleBtn,els.modalSampleBtn].filter(Boolean).forEach(btn=>btn.addEventListener('click',loadSampleData));
    els.dailyGoalInput?.addEventListener('input',()=>{ state.settings.dailyGoal=Number(els.dailyGoalInput.value||50); saveSettings(); updateProgress(); });
    els.openNextBtn.addEventListener('click',()=>{ const row=nextWorkRow(); if(row) openProfile(row); else toast('현재 필터에서 미처리 대상이 없습니다'); });
    const openHelp=()=>els.helpModal.classList.remove('hidden'); els.helpBtn.addEventListener('click',openHelp); els.sideHelpBtn.addEventListener('click',openHelp); els.closeHelp.addEventListener('click',()=>els.helpModal.classList.add('hidden')); els.helpModal.addEventListener('click',e=>{ if(e.target===els.helpModal) els.helpModal.classList.add('hidden'); });
    els.focusOpenBtn.addEventListener('click',()=>openProfile(currentFocusRow()));
    els.focusDoneBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'done',true));
    els.focusKeepBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'keep',true));
    els.focusIssueBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'issue',false));
    els.returnDoneBtn?.addEventListener('click',()=>{ const row=currentFocusRow(); closeReturnSheet(); setStatus(row,'done',true); });
    els.returnKeepBtn?.addEventListener('click',()=>{ const row=currentFocusRow(); closeReturnSheet(); setStatus(row,'keep',true); });
    els.returnLaterBtn?.addEventListener('click',closeReturnSheet);
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') maybeShowReturnSheet(); });
    window.addEventListener('pageshow',()=>maybeShowReturnSheet());
    document.addEventListener('keydown',e=>{ if(e.target.matches('input,select,textarea')) return; const key=e.key.toLowerCase(); if(key==='n'){e.preventDefault(); const row=nextWorkRow(); if(row) openProfile(row);} if(key==='d'){e.preventDefault(); setStatus(currentFocusRow(),'done',true);} if(key==='k'){e.preventDefault(); setStatus(currentFocusRow(),'keep',true);} if(key==='/'){e.preventDefault(); els.searchInput.focus();} });
  }
  els.hideDoneInput.checked=!!state.settings.hideDone; els.sameTabInput.checked=!!state.settings.sameTab; if(els.dailyGoalInput) els.dailyGoalInput.value=state.settings.dailyGoal||50;
  bind();
})();</script>
<script>
(() => {
  const saved=localStorage.getItem('matchal_checker_theme');
  if(saved) document.body.dataset.theme=saved;
  const applyIcon=()=>document.querySelectorAll('.themeToggle .iconify').forEach(i=>i.dataset.icon=document.body.dataset.theme==='dark'?'ph:sun':'ph:moon');
  applyIcon();
  document.querySelectorAll('.themeToggle').forEach(btn=>btn.addEventListener('click',()=>{document.body.dataset.theme=document.body.dataset.theme==='dark'?'light':'dark';localStorage.setItem('matchal_checker_theme',document.body.dataset.theme);applyIcon();}));
  document.getElementById('mobileHelpBtn')?.addEventListener('click',()=>document.getElementById('helpModal')?.classList.remove('hidden'));
})();
</script>
<script>(()=>{const links=[...document.querySelectorAll('.bottomNav a')],panel=document.getElementById('appPanel');const setActive=()=>{let hash='#home';if(panel&&!panel.classList.contains('hidden')){const y=scrollY,work=document.getElementById('work'),results=document.getElementById('results'),faq=document.getElementById('faq');if(faq&&y>faq.offsetTop-260)hash='#faq';else if(work&&y>work.offsetTop-260)hash='#work';else if(results&&y>results.offsetTop-260)hash='#results';}links.forEach(a=>a.classList.toggle('isActive',a.getAttribute('href')===hash));};addEventListener('scroll',setActive,{passive:true});new MutationObserver(setActive).observe(panel,{attributes:true,attributeFilter:['c
```

## $('#progressInput')

### Hit 1 at 65983

```js
v class="modalMini"><strong>필수 데이터</strong><div class="tiny">팔로워 및 팔로잉</div></div><div class="modalMini"><strong>추천 형식</strong><div class="tiny">JSON · 전체 기간</div></div><div class="modalMini"><strong>파일 상태</strong><div class="tiny">ZIP 압축 해제 없이 업로드</div></div><div class="modalMini"><strong>작업 방식</strong><div class="tiny">프로필에서 직접 취소</div></div></div><ol><li>Instagram 계정 센터에서 내 정보 다운로드를 엽니다.</li><li>‘일부 정보’에서 ‘팔로워 및 팔로잉’을 선택합니다.</li><li>형식은 JSON, 기간은 전체 기간을 권장합니다.</li><li>완성된 ZIP 파일을 이 화면에 그대로 올립니다.</li></ol><div class="modalWarn">자동 언팔이나 자동 클릭을 제공하지 않습니다. 계정 작업은 사용자가 직접 판단해야 합니다.</div><div class="heroButtons"><button class="btn primary" id="closeHelp">이해했습니다</button></div></div></div>
<div class="returnSheet hidden" id="returnSheet"><div class="returnCard"><h3>Instagram에서 돌아오셨나요?</h3><p>실제 팔로우 취소 여부를 선택하면 자동으로 다음 계정으로 이동합니다.</p><div class="returnActions"><button class="btn ok" id="returnDoneBtn">팔로우 취소 완료 · 다음</button><button class="btn warn" id="returnKeepBtn">이 계정은 유지 · 다음</button><button class="btn ghost" id="returnLaterBtn">나중에 결정</button></div></div></div>
<script>(() => {
  const $ = s => document.querySelector(s);
  const els = {
    zipInput: $('#zipInput'), progressInput: $('#progressInput'), drop: $('#drop'), loadStatus: $('#loadStatus'), errorBox: $('#errorBox'), appPanel: $('#appPanel'),
    countFollowing: $('#countFollowing'), countFollowers: $('#countFollowers'), countMutual: $('#countMutual'), countNonMutual: $('#countNonMutual'), countDone: $('#countDone'),
    progressText: $('#progressText'), progressBar: $('#progressBar'), sessionText: $('#sessionText'), sessionCount: $('#sessionCount'),
    searchInput: $('#searchInput'), sortSelect: $('#sortSelect'), statusSelect: $('#statusSelect'), hideDoneInput: $('#hideDoneInput'), sameTabInput: $('#sameTabInput'),
    tabs: $('#tabs'), filterNote: $('#filterNote'), tbody: $('#tbody'), mobileList: $('#mobileList'), resultInfo: $('#resultInfo'), moreBtn: $('#moreBtn'),
    openNextBtn: $('#openNextBtn'), exportBtn: $('#exportBtn'), sideExportBtn: $('#sideExportBtn'), sideClearBtn: $('#sideClearBtn'),
    helpBtn: $('#helpBtn'), sideHelpBtn: $('#sideHelpBtn'), helpModal: $('#helpModal'), closeHelp: $('#closeHelp'),
    sampleBtn: $('#sampleBtn'), sampleBtnInline: $('#sampleBtnInline'), sideSampleBtn: $('#sideSampleBtn'), modalSampleBtn: $('#modalSampleBtn'),
    dailyGoalInput: $('#dailyGoalInput'), todayProgressText: $('#todayProgressText'), exportCsvBtn: $('#exportCsvBtn'),
    focusUsername: $('#focusUsername'), focusType: $('#focusType'), focusStatus: $('#focusStatus'), focusDate: $('#focusDate'), focusFilter: $('#focusFilter'), focusStatusPill: $('#focusStatusPill'),
    focusOpenBtn: $('#focusOpenBtn'), focusDoneBtn: $('#focusDoneBtn'), focusKeepBtn: $('#focusKeepBtn'), focusIssueBtn: $('#focusIssueBtn'),
    heroCountFollowing: $('#heroCountFollowing'), heroCountMutual: $('#heroCountMutual'), heroCountNonMutual: $('#heroCountNonMutual'), heroCountFollowersOnly: $('#heroCountFollowersOnly'),
    heroSummaryStatus: $('#heroSummaryStatus'), dataDateText: $('#dataDateText'), returnSheet: $('#returnSheet'), returnDoneBtn: $('#returnDoneBtn'), returnKeepBtn: $('#returnKeepBtn'), returnLaterBtn: $('#returnLaterBtn')
  };

  const STORAGE_KEY = 'matchal_checker_v7_progress';
  const SETTINGS_KEY = 'matchal_checker_v7_settings';
  const tabDefs = [
    ['nonMutual','취소 검토','내가 팔로우하지만 나를 팔로우하지 않는 계정입니다. 수동으로 팔로우 취소 여부를 검토하세요.'],
    ['mutual','맞팔','서로 팔로우 중인 계정입니다. 보통 유지 대상입니다.'],
    ['following','팔로잉 전체','내가 팔로우 중인 전체 계정입니다.'],
    ['followersOnly','팔로워만','나를 팔로우하지만 나는 팔로우하지 않는 계정입니다.'],
    ['deleted','삭제/비활성 의심','아이디가 삭제/비활성 형태로 보이는 계정입니다.'],
    ['recentlyUnfollowed','최근 언팔 기록','인스타 데이터에 포함된 최근 언팔 기록입니다. 선택 데이터가 없으면 비어 있습니다.']
  ];
  const statusMap = {new:'미처리', opened:'열어봄', done:'완료', keep:'유지', issue:'문제/보류'};
  let state = {loaded:false, activeTab:'nonMutual', visibleLimit:100, allRows:[], progress:loadProgress(), settings:loadSettings(), counts:{}, sourceName:'', sessionOpened:0, focusKey:null, dataDate:0, awaitingReturnKey:null};

  function loadProgress(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{return {}} }
  function loadSettings(){ try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}catch{return {}} }
  function saveProgress(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); updateProgress(); }
  function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); }
  function fmt(n){ return Number(n||0).toLocaleString('ko-KR'); }
  function escapeHtml(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function setError(msg){ els.errorBox.textContent = msg || ''; els.errorBox.classList.toggle('hidden', !msg); }
  function toast(msg){ const old=$('.toast'); if(old) old.remove(); const el=document.createElement('div'); el.className='toast'; el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.remove(),1800); }
  function instagramUrl(username){ return `https://www.instagram.com/${encodeURIComponent(username)}/`; }
  function dateText(ts){ if(!ts) return '-'; const d=new Date(Number(ts)*1000); if(Number.isNaN(d.getTime())) return '-'; return d.toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}); }
  function rowStatus(row){ return state.progress[row.key]?.status || 'new'; }
  function statusText(row){ return statusMap[rowStatus(row)] || '미처리'; }
  function labelForType(type){ return tabDefs.find(t=>t[0]===type)?.[1] || type; }
  function initials(username){ return String(username||'?').replace(/^_+/, '').slice(0,2).toUpperCase() || '?'; }

  function setStatus(rowOrUsername, status, moveNext=false){
    const row = typeof rowOrUsername === 'string' ? state.allRows.find(r=>r.key===rowOrUsername.toLowerCase() || r.username===rowOrUsername) : rowOrUsername;
    if(!row) return;
    if(status === 'new') delete state.progress[row.key];
    else state.progress[row.key] = {username:row.username, status, updatedAt:new Date().toISOString()};
    saveProgress();
    if(moveNext) state.focusKey = nextWorkRow(row.key)?.key || null;
    
```

## sideExportBtn.addEventListener

### Hit 1 at 95137

```js
tingReturnKey=null; }

  function bind(){
    els.zipInput.addEventListener('change',e=>{ if(e.target.files[0]) handleZip(e.target.files[0]); });
    els.progressInput.addEventListener('change',e=>{ if(e.target.files[0]) importProgress(e.target.files[0]); });
    ['dragenter','dragover'].forEach(ev=>els.drop.addEventListener(ev,e=>{ e.preventDefault(); els.drop.classList.add('drag'); }));
    ['dragleave','drop'].forEach(ev=>els.drop.addEventListener(ev,e=>{ e.preventDefault(); els.drop.classList.remove('drag'); }));
    els.drop.addEventListener('drop',e=>{ const f=e.dataTransfer.files[0]; if(f) handleZip(f); });
    [els.searchInput,els.sortSelect,els.statusSelect,els.hideDoneInput].forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{ state.visibleLimit=100; state.focusKey=null; if(el===els.hideDoneInput) state.settings.hideDone=els.hideDoneInput.checked; saveSettings(); render(); }));
    els.sameTabInput.addEventListener('change',()=>{ state.settings.sameTab=els.sameTabInput.checked; saveSettings(); });
    els.moreBtn.addEventListener('click',()=>{ state.visibleLimit+=100; renderRows(); });
    els.exportBtn.addEventListener('click',exportProgress); els.sideExportBtn.addEventListener('click',exportProgress); els.sideClearBtn.addEventListener('click',clearProgress); if(els.exportCsvBtn) els.exportCsvBtn.addEventListener('click',exportCsv);
    [els.sampleBtn,els.sampleBtnInline,els.sideSampleBtn,els.modalSampleBtn].filter(Boolean).forEach(btn=>btn.addEventListener('click',loadSampleData));
    els.dailyGoalInput?.addEventListener('input',()=>{ state.settings.dailyGoal=Number(els.dailyGoalInput.value||50); saveSettings(); updateProgress(); });
    els.openNextBtn.addEventListener('click',()=>{ const row=nextWorkRow(); if(row) openProfile(row); else toast('현재 필터에서 미처리 대상이 없습니다'); });
    const openHelp=()=>els.helpModal.classList.remove('hidden'); els.helpBtn.addEventListener('click',openHelp); els.sideHelpBtn.addEventListener('click',openHelp); els.closeHelp.addEventListener('click',()=>els.helpModal.classList.add('hidden')); els.helpModal.addEventListener('click',e=>{ if(e.target===els.helpModal) els.helpModal.classList.add('hidden'); });
    els.focusOpenBtn.addEventListener('click',()=>openProfile(currentFocusRow()));
    els.focusDoneBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'done',true));
    els.focusKeepBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'keep',true));
    els.focusIssueBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'issue',false));
    els.returnDoneBtn?.addEventListener('click',()=>{ const row=currentFocusRow(); closeReturnSheet(); setStatus(row,'done',true); });
    els.returnKeepBtn?.addEventListener('click',()=>{ const row=currentFocusRow(); closeReturnSheet(); setStatus(row,'keep',true); });
    els.returnLaterBtn?.addEventListener('click',closeReturnSheet);
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') maybeShowReturnSheet(); });
    window.addEventListener('pageshow',()=>maybeShowReturnSheet());
    document.addEventListener('keydown',e=>{ if(e.target.matches('input,select,textarea')) return; const key=e.key.toLowerCase(); if(key==='n'){e.preventDefault(); const row=nextWorkRow(); if(row) openProfile(row);} if(key==='d'){e.preventDefault(); setStatus(currentFocusRow(),'done',true);} if(key==='k'){e.preventDefault(); setStatus(currentFocusRow(),'keep',true);} if(key==='/'){e.preventDefault(); els.searchInput.focus();} });
  }
  els.hideDoneInput.checked=!!state.settings.hideDone; els.sameTabInput.checked=!!state.settings.sameTab; if(els.dailyGoalInput) els.dailyGoalInput.value=state.settings.dailyGoal||50;
  bind();
})();</script>
<script>
(() => {
  const saved=localStorage.getItem('matchal_checker_theme');
  if(saved) document.body.dataset.theme=saved;
  const applyIcon=()=>document.querySelectorAll('.themeToggle .iconify').forEach(i=>i.dataset.icon=document.body.dataset.theme==='dark'?'ph:sun':'ph:moon');
  applyIcon();
  document.querySelectorAll('.themeToggle').forEach(btn=>btn.addEventListener('click',()=>{document.body.dataset.theme=document.body.dataset.theme==='dark'?'light':'dark';localStorage.setItem('matchal_checker_theme',document.body.dataset.theme);applyIcon();}));
  document.getElementById('mobileHelpBtn')?.addEventListener('click',()=>document.getElementById('helpModal')?.classList.remove('hidden'));
})();
</script>
<script>(()=>{const links=[...document.querySelectorAll('.bottomNav a')],panel=document.getElementById('appPanel');const setActive=()=>{let hash='#home';if(panel&&!panel.classList.contains('hidden')){const y=scrollY,work=document.getElementById('work'),results=document.getElementById('results'),faq=document.getElementById('faq');if(faq&&y>faq.offsetTop-260)hash='#faq';else if(work&&y>work.offsetTop-260)hash='#work';else if(results&&y>results.offsetTop-260)hash='#results';}links.forEach(a=>a.classList.toggle('isActive',a.getAttribute('href')===hash));};addEventListener('scroll',setActive,{passive:true});new MutationObserver(setActive).observe(panel,{attributes:true,attributeFilter:['class']});setActive();})();</script>
<script src="/assets/product-improvements.js?v=10.1" defer></script>
<script src="/assets/work-mode-enhancements.js?v=10.1" defer></script>
<script src="/assets/pwa-enhancements.js?v=10.1" defer></script>
<script src="/assets/business-info.js?v=10.1" defer></script>
<script>if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}</script></body>
</html>
```

## sideClearBtn.addEventListener

### Hit 1 at 95197

```js
ddEventListener('change',e=>{ if(e.target.files[0]) handleZip(e.target.files[0]); });
    els.progressInput.addEventListener('change',e=>{ if(e.target.files[0]) importProgress(e.target.files[0]); });
    ['dragenter','dragover'].forEach(ev=>els.drop.addEventListener(ev,e=>{ e.preventDefault(); els.drop.classList.add('drag'); }));
    ['dragleave','drop'].forEach(ev=>els.drop.addEventListener(ev,e=>{ e.preventDefault(); els.drop.classList.remove('drag'); }));
    els.drop.addEventListener('drop',e=>{ const f=e.dataTransfer.files[0]; if(f) handleZip(f); });
    [els.searchInput,els.sortSelect,els.statusSelect,els.hideDoneInput].forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{ state.visibleLimit=100; state.focusKey=null; if(el===els.hideDoneInput) state.settings.hideDone=els.hideDoneInput.checked; saveSettings(); render(); }));
    els.sameTabInput.addEventListener('change',()=>{ state.settings.sameTab=els.sameTabInput.checked; saveSettings(); });
    els.moreBtn.addEventListener('click',()=>{ state.visibleLimit+=100; renderRows(); });
    els.exportBtn.addEventListener('click',exportProgress); els.sideExportBtn.addEventListener('click',exportProgress); els.sideClearBtn.addEventListener('click',clearProgress); if(els.exportCsvBtn) els.exportCsvBtn.addEventListener('click',exportCsv);
    [els.sampleBtn,els.sampleBtnInline,els.sideSampleBtn,els.modalSampleBtn].filter(Boolean).forEach(btn=>btn.addEventListener('click',loadSampleData));
    els.dailyGoalInput?.addEventListener('input',()=>{ state.settings.dailyGoal=Number(els.dailyGoalInput.value||50); saveSettings(); updateProgress(); });
    els.openNextBtn.addEventListener('click',()=>{ const row=nextWorkRow(); if(row) openProfile(row); else toast('현재 필터에서 미처리 대상이 없습니다'); });
    const openHelp=()=>els.helpModal.classList.remove('hidden'); els.helpBtn.addEventListener('click',openHelp); els.sideHelpBtn.addEventListener('click',openHelp); els.closeHelp.addEventListener('click',()=>els.helpModal.classList.add('hidden')); els.helpModal.addEventListener('click',e=>{ if(e.target===els.helpModal) els.helpModal.classList.add('hidden'); });
    els.focusOpenBtn.addEventListener('click',()=>openProfile(currentFocusRow()));
    els.focusDoneBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'done',true));
    els.focusKeepBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'keep',true));
    els.focusIssueBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'issue',false));
    els.returnDoneBtn?.addEventListener('click',()=>{ const row=currentFocusRow(); closeReturnSheet(); setStatus(row,'done',true); });
    els.returnKeepBtn?.addEventListener('click',()=>{ const row=currentFocusRow(); closeReturnSheet(); setStatus(row,'keep',true); });
    els.returnLaterBtn?.addEventListener('click',closeReturnSheet);
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') maybeShowReturnSheet(); });
    window.addEventListener('pageshow',()=>maybeShowReturnSheet());
    document.addEventListener('keydown',e=>{ if(e.target.matches('input,select,textarea')) return; const key=e.key.toLowerCase(); if(key==='n'){e.preventDefault(); const row=nextWorkRow(); if(row) openProfile(row);} if(key==='d'){e.preventDefault(); setStatus(currentFocusRow(),'done',true);} if(key==='k'){e.preventDefault(); setStatus(currentFocusRow(),'keep',true);} if(key==='/'){e.preventDefault(); els.searchInput.focus();} });
  }
  els.hideDoneInput.checked=!!state.settings.hideDone; els.sameTabInput.checked=!!state.settings.sameTab; if(els.dailyGoalInput) els.dailyGoalInput.value=state.settings.dailyGoal||50;
  bind();
})();</script>
<script>
(() => {
  const saved=localStorage.getItem('matchal_checker_theme');
  if(saved) document.body.dataset.theme=saved;
  const applyIcon=()=>document.querySelectorAll('.themeToggle .iconify').forEach(i=>i.dataset.icon=document.body.dataset.theme==='dark'?'ph:sun':'ph:moon');
  applyIcon();
  document.querySelectorAll('.themeToggle').forEach(btn=>btn.addEventListener('click',()=>{document.body.dataset.theme=document.body.dataset.theme==='dark'?'light':'dark';localStorage.setItem('matchal_checker_theme',document.body.dataset.theme);applyIcon();}));
  document.getElementById('mobileHelpBtn')?.addEventListener('click',()=>document.getElementById('helpModal')?.classList.remove('hidden'));
})();
</script>
<script>(()=>{const links=[...document.querySelectorAll('.bottomNav a')],panel=document.getElementById('appPanel');const setActive=()=>{let hash='#home';if(panel&&!panel.classList.contains('hidden')){const y=scrollY,work=document.getElementById('work'),results=document.getElementById('results'),faq=document.getElementById('faq');if(faq&&y>faq.offsetTop-260)hash='#faq';else if(work&&y>work.offsetTop-260)hash='#work';else if(results&&y>results.offsetTop-260)hash='#results';}links.forEach(a=>a.classList.toggle('isActive',a.getAttribute('href')===hash));};addEventListener('scroll',setActive,{passive:true});new MutationObserver(setActive).observe(panel,{attributes:true,attributeFilter:['class']});setActive();})();</script>
<script src="/assets/product-improvements.js?v=10.1" defer></script>
<script src="/assets/work-mode-enhancements.js?v=10.1" defer></script>
<script src="/assets/pwa-enhancements.js?v=10.1" defer></script>
<script src="/assets/business-info.js?v=10.1" defer></script>
<script>if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}</script></body>
</html>
```

## exportBtn.addEventListener

### Hit 1 at 95081

```js
emoveItem('matchal_checker_awaiting_return'); state.awaitingReturnKey=null; }

  function bind(){
    els.zipInput.addEventListener('change',e=>{ if(e.target.files[0]) handleZip(e.target.files[0]); });
    els.progressInput.addEventListener('change',e=>{ if(e.target.files[0]) importProgress(e.target.files[0]); });
    ['dragenter','dragover'].forEach(ev=>els.drop.addEventListener(ev,e=>{ e.preventDefault(); els.drop.classList.add('drag'); }));
    ['dragleave','drop'].forEach(ev=>els.drop.addEventListener(ev,e=>{ e.preventDefault(); els.drop.classList.remove('drag'); }));
    els.drop.addEventListener('drop',e=>{ const f=e.dataTransfer.files[0]; if(f) handleZip(f); });
    [els.searchInput,els.sortSelect,els.statusSelect,els.hideDoneInput].forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{ state.visibleLimit=100; state.focusKey=null; if(el===els.hideDoneInput) state.settings.hideDone=els.hideDoneInput.checked; saveSettings(); render(); }));
    els.sameTabInput.addEventListener('change',()=>{ state.settings.sameTab=els.sameTabInput.checked; saveSettings(); });
    els.moreBtn.addEventListener('click',()=>{ state.visibleLimit+=100; renderRows(); });
    els.exportBtn.addEventListener('click',exportProgress); els.sideExportBtn.addEventListener('click',exportProgress); els.sideClearBtn.addEventListener('click',clearProgress); if(els.exportCsvBtn) els.exportCsvBtn.addEventListener('click',exportCsv);
    [els.sampleBtn,els.sampleBtnInline,els.sideSampleBtn,els.modalSampleBtn].filter(Boolean).forEach(btn=>btn.addEventListener('click',loadSampleData));
    els.dailyGoalInput?.addEventListener('input',()=>{ state.settings.dailyGoal=Number(els.dailyGoalInput.value||50); saveSettings(); updateProgress(); });
    els.openNextBtn.addEventListener('click',()=>{ const row=nextWorkRow(); if(row) openProfile(row); else toast('현재 필터에서 미처리 대상이 없습니다'); });
    const openHelp=()=>els.helpModal.classList.remove('hidden'); els.helpBtn.addEventListener('click',openHelp); els.sideHelpBtn.addEventListener('click',openHelp); els.closeHelp.addEventListener('click',()=>els.helpModal.classList.add('hidden')); els.helpModal.addEventListener('click',e=>{ if(e.target===els.helpModal) els.helpModal.classList.add('hidden'); });
    els.focusOpenBtn.addEventListener('click',()=>openProfile(currentFocusRow()));
    els.focusDoneBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'done',true));
    els.focusKeepBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'keep',true));
    els.focusIssueBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'issue',false));
    els.returnDoneBtn?.addEventListener('click',()=>{ const row=currentFocusRow(); closeReturnSheet(); setStatus(row,'done',true); });
    els.returnKeepBtn?.addEventListener('click',()=>{ const row=currentFocusRow(); closeReturnSheet(); setStatus(row,'keep',true); });
    els.returnLaterBtn?.addEventListener('click',closeReturnSheet);
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') maybeShowReturnSheet(); });
    window.addEventListener('pageshow',()=>maybeShowReturnSheet());
    document.addEventListener('keydown',e=>{ if(e.target.matches('input,select,textarea')) return; const key=e.key.toLowerCase(); if(key==='n'){e.preventDefault(); const row=nextWorkRow(); if(row) openProfile(row);} if(key==='d'){e.preventDefault(); setStatus(currentFocusRow(),'done',true);} if(key==='k'){e.preventDefault(); setStatus(currentFocusRow(),'keep',true);} if(key==='/'){e.preventDefault(); els.searchInput.focus();} });
  }
  els.hideDoneInput.checked=!!state.settings.hideDone; els.sameTabInput.checked=!!state.settings.sameTab; if(els.dailyGoalInput) els.dailyGoalInput.value=state.settings.dailyGoal||50;
  bind();
})();</script>
<script>
(() => {
  const saved=localStorage.getItem('matchal_checker_theme');
  if(saved) document.body.dataset.theme=saved;
  const applyIcon=()=>document.querySelectorAll('.themeToggle .iconify').forEach(i=>i.dataset.icon=document.body.dataset.theme==='dark'?'ph:sun':'ph:moon');
  applyIcon();
  document.querySelectorAll('.themeToggle').forEach(btn=>btn.addEventListener('click',()=>{document.body.dataset.theme=document.body.dataset.theme==='dark'?'light':'dark';localStorage.setItem('matchal_checker_theme',document.body.dataset.theme);applyIcon();}));
  document.getElementById('mobileHelpBtn')?.addEventListener('click',()=>document.getElementById('helpModal')?.classList.remove('hidden'));
})();
</script>
<script>(()=>{const links=[...document.querySelectorAll('.bottomNav a')],panel=document.getElementById('appPanel');const setActive=()=>{let hash='#home';if(panel&&!panel.classList.contains('hidden')){const y=scrollY,work=document.getElementById('work'),results=document.getElementById('results'),faq=document.getElementById('faq');if(faq&&y>faq.offsetTop-260)hash='#faq';else if(work&&y>work.offsetTop-260)hash='#work';else if(results&&y>results.offsetTop-260)hash='#results';}links.forEach(a=>a.classList.toggle('isActive',a.getAttribute('href')===hash));};addEventListener('scroll',setActive,{passive:true});new MutationObserver(setActive).observe(panel,{attributes:true,attributeFilter:['class']});setActive();})();</script>
<script src="/assets/product-improvements.js?v=10.1" defer></script>
<script src="/assets/work-mode-enhancements.js?v=10.1" defer></script>
<script src="/assets/pwa-enhancements.js?v=10.1" defer></script>
<script src="/assets/business-info.js?v=10.1" defer></script>
<script>if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}</script></body>
</html>
```

## function import

### Hit 1 at 92472

```js
s.push([r.username,r.href,r.label,statusText(r),dateText(r.timestamp),p.updatedAt||''].map(csvEscape).join(',')); }
    const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`matchal_checker_non_mutual_${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); toast('결과 CSV 생성 완료');
  }

  function exportProgress(){
    const payload={exportedAt:new Date().toISOString(),sourceName:state.sourceName,progress:state.progress,settings:{activeTab:state.activeTab,sort:els.sortSelect.value,status:els.statusSelect.value,hideDone:els.hideDoneInput.checked,dailyGoal:Number(els.dailyGoalInput?.value||50)}};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`matchal_checker_progress_${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); toast('진행상황 저장 파일 생성');
  }
  async function importProgress(file){
    const text=await file.text();
    try{
      if(file.name.toLowerCase().endsWith('.json')){ const data=JSON.parse(text); state.progress=data.progress||data||{}; saveProgress(); render(); toast('진행상황 불러오기 완료'); return; }
      const lines=text.split(/\r?\n/).filter(Boolean); const imported={...state.progress};
      for(const line of lines.slice(1)){ const cols=line.split(',').map(x=>x.trim().replace(/^"|"$/g,'')); const [username,status]=cols; if(username&&status) imported[username.toLowerCase()]={username,status,updatedAt:new Date().toISOString()}; }
      state.progress=imported; saveProgress(); render(); toast('CSV 불러오기 완료');
    }catch(e){ setError('진행상황 파일을 읽지 못했습니다: '+e.message); }
  }
  function clearProgress(){ if(confirm('저장된 진행상황을 모두 초기화할까요?')){ state.progress={}; saveProgress(); render(); toast('진행상황 초기화 완료'); } }

  function maybeShowReturnSheet(){
    if(!window.matchMedia('(max-width:900px)').matches || !state.loaded) return;
    const key=sessionStorage.getItem('matchal_checker_awaiting_return') || state.awaitingReturnKey;
    const row=state.allRows.find(r=>r.key===key);
    if(!row || ['done','keep'].includes(rowStatus(row))) return;
    state.focusKey=row.key; renderFocus();
    setTimeout(()=>els.returnSheet?.classList.remove('hidden'),180);
  }
  function closeReturnSheet(){ els.returnSheet?.classList.add('hidden'); sessionStorage.removeItem('matchal_checker_awaiting_return'); state.awaitingReturnKey=null; }

  function bind(){
    els.zipInput.addEventListener('change',e=>{ if(e.target.files[0]) handleZip(e.target.files[0]); });
    els.progressInput.addEventListener('change',e=>{ if(e.target.files[0]) importProgress(e.target.files[0]); });
    ['dragenter','dragover'].forEach(ev=>els.drop.addEventListener(ev,e=>{ e.preventDefault(); els.drop.classList.add('drag'); }));
    ['dragleave','drop'].forEach(ev=>els.drop.addEventListener(ev,e=>{ e.preventDefault(); els.drop.classList.remove('drag'); }));
    els.drop.addEventListener('drop',e=>{ const f=e.dataTransfer.files[0]; if(f) handleZip(f); });
    [els.searchInput,els.sortSelect,els.statusSelect,els.hideDoneInput].forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{ state.visibleLimit=100; state.focusKey=null; if(el===els.hideDoneInput) state.settings.hideDone=els.hideDoneInput.checked; saveSettings(); render(); }));
    els.sameTabInput.addEventListener('change',()=>{ state.settings.sameTab=els.sameTabInput.checked; saveSettings(); });
    els.moreBtn.addEventListener('click',()=>{ state.visibleLimit+=100; renderRows(); });
    els.exportBtn.addEventListener('click',exportProgress); els.sideExportBtn.addEventListener('click',exportProgress); els.sideClearBtn.addEventListener('click',clearProgress); if(els.exportCsvBtn) els.exportCsvBtn.addEventListener('click',exportCsv);
    [els.sampleBtn,els.sampleBtnInline,els.sideSampleBtn,els.modalSampleBtn].filter(Boolean).forEach(btn=>btn.addEventListener('click',loadSampleData));
    els.dailyGoalInput?.addEventListener('input',()=>{ state.settings.dailyGoal=Number(els.dailyGoalInput.value||50); saveSettings(); updateProgress(); });
    els.openNextBtn.addEventListener('click',()=>{ const row=nextWorkRow(); if(row) openProfile(row); else toast('현재 필터에서 미처리 대상이 없습니다'); });
    const openHelp=()=>els.helpModal.classList.remove('hidden'); els.helpBtn.addEventListener('click',openHelp); els.sideHelpBtn.addEventListener('click',openHelp); els.closeHelp.addEventListener('click',()=>els.helpModal.classList.add('hidden')); els.helpModal.addEventListener('click',e=>{ if(e.target===els.helpModal) els.helpModal.classList.add('hidden'); });
    els.focusOpenBtn.addEventListener('click',()=>openProfile(currentFocusRow()));
    els.focusDoneBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'done',true));
    els.focusKeepBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'keep',true));
    els.focusIssueBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'issue',false));
    els.returnDoneBtn?.addEventListener('click',()=>{ const row=currentFocusRow(); closeReturnSheet(); setStatus(row,'done',true); });
    els.returnKeepBtn?.addEventListener('click',()=>{ const row=currentFocusRow(); closeReturnSheet(); setStatus(row,'keep',true); });
    els.returnLaterBtn?.addEventListener('click',closeReturnSheet);
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') maybeShowReturnSheet(); });
    window.addEventListener('pageshow',()=>maybeShowReturnSheet());
    document.addEventListener('keydown',e=>{ if(e.target.matches('input,select,textarea')) return; const key=e.key.toLowerCase(); if(key==='n'){e.preventDefault(); const row=nextWorkRow(); if(row) openProfile(row);} if(key==='d'){e.preventDefault(); setStatus(currentFocusRow(),'done',true);} if(key==='k'){e.preventDefault(); setStatus(currentFocusRow(),'keep',true);} if(key==='/'){e.preventDefault(); els.searchInput.focus();} });
  
```

## JSON 파일

_No matches_

## CSV 불러오기 완료

### Hit 1 at 93129

```js
tiveTab,sort:els.sortSelect.value,status:els.statusSelect.value,hideDone:els.hideDoneInput.checked,dailyGoal:Number(els.dailyGoalInput?.value||50)}};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`matchal_checker_progress_${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); toast('진행상황 저장 파일 생성');
  }
  async function importProgress(file){
    const text=await file.text();
    try{
      if(file.name.toLowerCase().endsWith('.json')){ const data=JSON.parse(text); state.progress=data.progress||data||{}; saveProgress(); render(); toast('진행상황 불러오기 완료'); return; }
      const lines=text.split(/\r?\n/).filter(Boolean); const imported={...state.progress};
      for(const line of lines.slice(1)){ const cols=line.split(',').map(x=>x.trim().replace(/^"|"$/g,'')); const [username,status]=cols; if(username&&status) imported[username.toLowerCase()]={username,status,updatedAt:new Date().toISOString()}; }
      state.progress=imported; saveProgress(); render(); toast('CSV 불러오기 완료');
    }catch(e){ setError('진행상황 파일을 읽지 못했습니다: '+e.message); }
  }
  function clearProgress(){ if(confirm('저장된 진행상황을 모두 초기화할까요?')){ state.progress={}; saveProgress(); render(); toast('진행상황 초기화 완료'); } }

  function maybeShowReturnSheet(){
    if(!window.matchMedia('(max-width:900px)').matches || !state.loaded) return;
    const key=sessionStorage.getItem('matchal_checker_awaiting_return') || state.awaitingReturnKey;
    const row=state.allRows.find(r=>r.key===key);
    if(!row || ['done','keep'].includes(rowStatus(row))) return;
    state.focusKey=row.key; renderFocus();
    setTimeout(()=>els.returnSheet?.classList.remove('hidden'),180);
  }
  function closeReturnSheet(){ els.returnSheet?.classList.add('hidden'); sessionStorage.removeItem('matchal_checker_awaiting_return'); state.awaitingReturnKey=null; }

  function bind(){
    els.zipInput.addEventListener('change',e=>{ if(e.target.files[0]) handleZip(e.target.files[0]); });
    els.progressInput.addEventListener('change',e=>{ if(e.target.files[0]) importProgress(e.target.files[0]); });
    ['dragenter','dragover'].forEach(ev=>els.drop.addEventListener(ev,e=>{ e.preventDefault(); els.drop.classList.add('drag'); }));
    ['dragleave','drop'].forEach(ev=>els.drop.addEventListener(ev,e=>{ e.preventDefault(); els.drop.classList.remove('drag'); }));
    els.drop.addEventListener('drop',e=>{ const f=e.dataTransfer.files[0]; if(f) handleZip(f); });
    [els.searchInput,els.sortSelect,els.statusSelect,els.hideDoneInput].forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{ state.visibleLimit=100; state.focusKey=null; if(el===els.hideDoneInput) state.settings.hideDone=els.hideDoneInput.checked; saveSettings(); render(); }));
    els.sameTabInput.addEventListener('change',()=>{ state.settings.sameTab=els.sameTabInput.checked; saveSettings(); });
    els.moreBtn.addEventListener('click',()=>{ state.visibleLimit+=100; renderRows(); });
    els.exportBtn.addEventListener('click',exportProgress); els.sideExportBtn.addEventListener('click',exportProgress); els.sideClearBtn.addEventListener('click',clearProgress); if(els.exportCsvBtn) els.exportCsvBtn.addEventListener('click',exportCsv);
    [els.sampleBtn,els.sampleBtnInline,els.sideSampleBtn,els.modalSampleBtn].filter(Boolean).forEach(btn=>btn.addEventListener('click',loadSampleData));
    els.dailyGoalInput?.addEventListener('input',()=>{ state.settings.dailyGoal=Number(els.dailyGoalInput.value||50); saveSettings(); updateProgress(); });
    els.openNextBtn.addEventListener('click',()=>{ const row=nextWorkRow(); if(row) openProfile(row); else toast('현재 필터에서 미처리 대상이 없습니다'); });
    const openHelp=()=>els.helpModal.classList.remove('hidden'); els.helpBtn.addEventListener('click',openHelp); els.sideHelpBtn.addEventListener('click',openHelp); els.closeHelp.addEventListener('click',()=>els.helpModal.classList.add('hidden')); els.helpModal.addEventListener('click',e=>{ if(e.target===els.helpModal) els.helpModal.classList.add('hidden'); });
    els.focusOpenBtn.addEventListener('click',()=>openProfile(currentFocusRow()));
    els.focusDoneBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'done',true));
    els.focusKeepBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'keep',true));
    els.focusIssueBtn.addEventListener('click',()=>setStatus(currentFocusRow(),'issue',false));
    els.returnDoneBtn?.addEventListener('click',()=>{ const row=currentFocusRow(); closeReturnSheet(); setStatus(row,'done',true); });
    els.returnKeepBtn?.addEventListener('click',()=>{ const row=currentFocusRow(); closeReturnSheet(); setStatus(row,'keep',true); });
    els.returnLaterBtn?.addEventListener('click',closeReturnSheet);
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') maybeShowReturnSheet(); });
    window.addEventListener('pageshow',()=>maybeShowReturnSheet());
    document.addEventListener('keydown',e=>{ if(e.target.matches('input,select,textarea')) return; const key=e.key.toLowerCase(); if(key==='n'){e.preventDefault(); const row=nextWorkRow(); if(row) openProfile(row);} if(key==='d'){e.preventDefault(); setStatus(currentFocusRow(),'done',true);} if(key==='k'){e.preventDefault(); setStatus(currentFocusRow(),'keep',true);} if(key==='/'){e.preventDefault(); els.searchInput.focus();} });
  }
  els.hideDoneInput.checked=!!state.settings.hideDone; els.sameTabInput.checked=!!state.settings.sameTab; if(els.dailyGoalInput) els.dailyGoalInput.value=state.settings.dailyGoal||50;
  bind();
})();</script>
<script>
(() => {
  const saved=localStorage.getItem('matchal_checker_theme');
  if(saved) document.body.dataset.theme=saved;
  const applyIcon=()=>document.querySelectorAll('.themeToggle .iconify').forEach(i=>i.dataset.icon=document.body.dataset.theme==='dark'?'ph:sun':'ph:moon');
  applyIcon();
  document.querySelectorAll('.themeToggle').forEach(btn=>btn.addEventListener('click',()=>{document.body.dataset.theme=document.body.dataset.theme==
```

## v8-core-b.js

_No matches_

## v8-mobile.js

_No matches_
