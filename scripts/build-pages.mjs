import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const root = process.cwd();
const dist = path.join(root, 'dist');
const VERSION = '12.0';
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

function replaceRequired(source, search, replacement, label) {
  if (typeof search === 'string') {
    if (!source.includes(search)) throw new Error(`Required build patch not found: ${label}`);
    return source.replace(search, replacement);
  }
  if (!search.test(source)) throw new Error(`Required build patch not found: ${label}`);
  search.lastIndex = 0;
  return source.replace(search, replacement);
}

const payload = ['v9/part1.txt', 'v9/part2.txt', 'v9/part3.txt']
  .map(read)
  .join('')
  .replace(/\s+/g, '');

let html = gunzipSync(Buffer.from(payload, 'base64')).toString('utf8');

html = html
  .replaceAll('https://kyungminkim11.github.io/matchal-checker/', '/')
  .replaceAll('https://kyungminkim11.github.io/unfollow/', '/')
  .replaceAll('https://github.com/kyungminkim11/matchal-checker', 'https://github.com/kyungminkim11/unfollow')
  .replaceAll('/matchal-checker/', '/')
  .replaceAll('/unfollow/', '/')
  .replace(/<base[^>]*>/gi, '')
  .replace(/<script[^>]+src=["']https:\/\/code\.iconify\.design[^>]*><\/script>/gi, '')
  .replace(/<link[^>]+href=["']https:\/\/cdn\.jsdelivr\.net\/[^"']*pretendard[^"']*["'][^>]*>/gi, '')
  .replace(/@import\s+url\((?:["'])?https:\/\/cdn\.jsdelivr\.net\/[^)]*pretendard[^)]*(?:["'])?\)\s*;?/gi, '')
  .replace(/<title>.*?<\/title>/i, '<title>인스타 맞팔 확인 · 언팔 체크 | 맞팔체커</title>')
  .replace(/<meta\s+name=["']description["'][^>]*>/i, '<meta name="description" content="Instagram 데이터 ZIP을 브라우저에서만 분석해 맞팔, 취소 검토 계정과 팔로워만 있는 계정을 확인하세요. 로그인과 자동 언팔 없이 무료로 사용할 수 있습니다.">')
  .replaceAll('Matchal Checker', '맞팔체커')
  .replaceAll('v9.2', `v${VERSION}`);

const storagePatchOld = `  const STORAGE_KEY = 'matchal_checker_v7_progress';
  const SETTINGS_KEY = 'matchal_checker_v7_settings';`;
const storagePatchNew = `  let STORAGE_KEY = 'unfollow_progress_v12_default';
  const LEGACY_STORAGE_KEY = 'matchal_checker_v7_progress';
  const STORAGE_PREFIX = 'unfollow_progress_v12_';
  const MIGRATION_KEY = 'unfollow_progress_v12_migrated';
  const SETTINGS_KEY = 'matchal_checker_v7_settings';
  const ZIP_LIMITS = {fileBytes:80*1024*1024,jsonEntryBytes:25*1024*1024,jsonTotalBytes:50*1024*1024,entries:10000,accounts:50000,ratio:300};
  let ACTIVE_WORKSPACE = 'default';

  function workspaceFromFile(file){
    let value=String(file?.name||'').replace(/\\.zip$/i,'').toLowerCase();
    if(/^instagram[-_]lava[-_]demo[-_]/.test(value)) return 'sample';
    value=value.replace(/^instagram[-_]?/,'');
    value=value.replace(/[-_](?:19|20)\\d{2}[-_]\\d{1,2}[-_]\\d{1,2}.*$/,'');
    value=value.replace(/[-_]\\d{8}.*$/,'');
    value=value.replace(/[^a-z0-9._-]+/g,'_').replace(/^[_-]+|[_-]+$/g,'').slice(0,80);
    return value||'default';
  }
  function activateWorkspace(file){
    ACTIVE_WORKSPACE=workspaceFromFile(file);
    STORAGE_KEY=STORAGE_PREFIX+ACTIVE_WORKSPACE;
    sessionStorage.setItem('unfollow_active_progress_key',STORAGE_KEY);
    sessionStorage.setItem('unfollow_active_workspace',ACTIVE_WORKSPACE);
    if(ACTIVE_WORKSPACE==='sample') localStorage.removeItem(STORAGE_KEY);
    if(ACTIVE_WORKSPACE!=='sample' && !localStorage.getItem(STORAGE_KEY) && !localStorage.getItem(MIGRATION_KEY)){
      const legacy=localStorage.getItem(LEGACY_STORAGE_KEY);
      if(legacy && legacy!=='{}') localStorage.setItem(STORAGE_KEY,legacy);
      localStorage.setItem(MIGRATION_KEY,'1');
    }
    state.progress=loadProgress();
    window.dispatchEvent(new CustomEvent('unfollow:workspace',{detail:{id:ACTIVE_WORKSPACE,key:STORAGE_KEY}}));
  }
  function assertZipFile(file){
    if(!file) throw new Error('ZIP 파일을 선택해 주세요.');
    if(!/\\.zip$/i.test(file.name||'')) throw new Error('ZIP 파일만 분석할 수 있습니다. Instagram 다운로드 형식을 JSON으로 설정해 주세요.');
    if(file.size>ZIP_LIMITS.fileBytes) throw new Error('ZIP 파일이 80MB를 초과합니다. Instagram에서 “팔로워 및 팔로잉” 항목만 선택해 다시 내려받아 주세요.');
  }
  function friendlyFileError(error){
    const message=String(error?.message||error||'알 수 없는 오류');
    if(/JSON|Unexpected token|Expected property|position \\d+/i.test(message)) return 'JSON 파일을 읽지 못했습니다. Instagram 데이터 다운로드 형식이 JSON인지 확인하고 다시 받아주세요.';
    if(/memory|allocation|Array buffer|out of memory/i.test(message)) return '파일이 너무 커서 브라우저에서 처리할 수 없습니다. “팔로워 및 팔로잉” 데이터만 다시 내려받아 주세요.';
    return message;
  }
  function normalizeImportedProgress(data){
    const raw=data && typeof data==='object' && data.progress && typeof data.progress==='object' ? data.progress : data;
    if(!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error('지원하지 않는 작업 기록 형식입니다.');
    const allowed=new Set(['opened','done','keep','issue']); const out={};
    for(const [key,value] of Object.entries(raw)){
      if(!value || typeof value!=='object') continue;
      const username=String(value.username||key||'').trim().replace(/^@/,'');
      const status=String(value.status||'').trim();
      if(!username || !allowed.has(status)) continue;
      out[username.toLowerCase()]={username,status,updatedAt:value.updatedAt||new Date().toISOString()};
    }
    return out;
  }
  function parseCsvLine(line){
    const values=[]; let value=''; let quoted=false;
    for(let i=0;i<line.length;i++){
      const char=line[i];
      if(char==='"' && quoted && line[i+1]==='"'){ value+='"'; i++; }
      else if(char==='"') quoted=!quoted;
      else if(char===',' && !quoted){ values.push(value.trim()); value=''; }
      else value+=char;
    }
    values.push(value.trim()); return values;
  }
  function importedStatus(value){
    const normalized=String(value||'').trim().toLowerCase();
    const map={done:'done','완료':'done',keep:'keep','유지':'keep',opened:'opened','열어봄':'opened',issue:'issue','문제':'issue','문제/보류':'issue','보류':'issue'};
    return map[normalized]||'';
  }`;
html = replaceRequired(html, storagePatchOld, storagePatchNew, 'workspace storage and ZIP limits');

const parseZipOld = `  function parseZipEntries(buf){
    const dv=new DataView(buf); const eocd=findEOCD(dv); const total=u16(dv,eocd+10); const cdSize=u32(dv,eocd+12); const cdOffset=u32(dv,eocd+16); const dec=new TextDecoder('utf-8'); let off=cdOffset; const entries=[];
    for(let i=0;i<total && off<cdOffset+cdSize;i++){
      if(u32(dv,off)!==0x02014b50) break;
      const method=u16(dv,off+10), compSize=u32(dv,off+20), uncompSize=u32(dv,off+24), nameLen=u16(dv,off+28), extraLen=u16(dv,off+30), commentLen=u16(dv,off+32), localOffset=u32(dv,off+42);
      const name=dec.decode(new Uint8Array(buf,off+46,nameLen)); entries.push({name,method,compSize,uncompSize,localOffset}); off += 46+nameLen+extraLen+commentLen;
    }
    return {buf, entries};
  }`;
const parseZipNew = `  function parseZipEntries(buf){
    if(!(buf instanceof ArrayBuffer) || buf.byteLength<22) throw new Error('ZIP 구조를 읽지 못했습니다. Instagram에서 받은 ZIP 파일인지 확인해 주세요.');
    const dv=new DataView(buf); const eocd=findEOCD(dv); const total=u16(dv,eocd+10); const cdSize=u32(dv,eocd+12); const cdOffset=u32(dv,eocd+16); const dec=new TextDecoder('utf-8'); let off=cdOffset; const entries=[]; let totalJsonBytes=0;
    if(total>ZIP_LIMITS.entries) throw new Error('ZIP 내부 파일 수가 너무 많습니다. “팔로워 및 팔로잉” 데이터만 다시 내려받아 주세요.');
    if(cdOffset+cdSize>dv.byteLength) throw new Error('ZIP 중앙 디렉터리가 손상되었습니다. 파일을 다시 내려받아 주세요.');
    for(let i=0;i<total && off<cdOffset+cdSize;i++){
      if(off+46>dv.byteLength || u32(dv,off)!==0x02014b50) throw new Error('ZIP 내부 파일 목록이 손상되었습니다.');
      const method=u16(dv,off+10), compSize=u32(dv,off+20), uncompSize=u32(dv,off+24), nameLen=u16(dv,off+28), extraLen=u16(dv,off+30), commentLen=u16(dv,off+32), localOffset=u32(dv,off+42);
      const next=off+46+nameLen+extraLen+commentLen;
      if(next>dv.byteLength || localOffset+30>dv.byteLength) throw new Error('ZIP 내부 파일 위치가 올바르지 않습니다.');
      const name=dec.decode(new Uint8Array(buf,off+46,nameLen));
      if(/\\.json$/i.test(name)){
        if(uncompSize>ZIP_LIMITS.jsonEntryBytes) throw new Error('ZIP 안의 JSON 파일 하나가 25MB를 초과합니다. 필요한 데이터만 다시 내려받아 주세요.');
        totalJsonBytes+=uncompSize;
        if(totalJsonBytes>ZIP_LIMITS.jsonTotalBytes) throw new Error('ZIP 안의 JSON 전체 크기가 50MB를 초과합니다. 필요한 데이터만 다시 내려받아 주세요.');
        if(uncompSize>1024 && (!compSize || uncompSize/compSize>ZIP_LIMITS.ratio)) throw new Error('비정상적으로 압축률이 높은 ZIP 파일은 안전을 위해 분석하지 않습니다.');
      }
      entries.push({name,method,compSize,uncompSize,localOffset}); off=next;
    }
    if(entries.length!==total) throw new Error('ZIP 내부 파일 목록을 모두 읽지 못했습니다. 파일을 다시 내려받아 주세요.');
    return {buf, entries};
  }`;
html = replaceRequired(html, parseZipOld, parseZipNew, 'ZIP central directory validation');

const inflateOld = `  async function inflateEntry(zip, entry){
    const buf=zip.buf; const dv=new DataView(buf); const dec=new TextDecoder('utf-8'); const off=entry.localOffset;
    if(u32(dv,off)!==0x04034b50) throw new Error('ZIP 내부 파일 헤더를 읽지 못했습니다: '+entry.name);
    const nameLen=u16(dv,off+26), extraLen=u16(dv,off+28), start=off+30+nameLen+extraLen; const compressed=new Uint8Array(buf.slice(start,start+entry.compSize));
    if(entry.method===0) return dec.decode(compressed);
    if(entry.method!==8) throw new Error(\`지원하지 않는 ZIP 압축 방식입니다: \${entry.name} / method \${entry.method}\`);
    if(!('DecompressionStream' in window)) throw new Error('이 브라우저는 ZIP 압축 해제를 지원하지 않습니다. Chrome, Edge, Safari 최신 버전에서 열어주세요.');
    const ds=new DecompressionStream('deflate-raw'); const stream=new Blob([compressed]).stream().pipeThrough(ds); const ab=await new Response(stream).arrayBuffer(); return dec.decode(ab);
  }`;
const inflateNew = `  async function inflateEntry(zip, entry){
    const buf=zip.buf; const dv=new DataView(buf); const dec=new TextDecoder('utf-8'); const off=entry.localOffset;
    if(entry.uncompSize>ZIP_LIMITS.jsonEntryBytes) throw new Error('JSON 파일이 안전 처리 용량을 초과합니다.');
    if(u32(dv,off)!==0x04034b50) throw new Error('ZIP 내부 파일 헤더를 읽지 못했습니다: '+entry.name);
    const nameLen=u16(dv,off+26), extraLen=u16(dv,off+28), start=off+30+nameLen+extraLen;
    if(start+entry.compSize>buf.byteLength) throw new Error('ZIP 내부 압축 데이터가 손상되었습니다: '+entry.name);
    const compressed=new Uint8Array(buf.slice(start,start+entry.compSize));
    if(entry.method===0) return dec.decode(compressed);
    if(entry.method!==8) throw new Error(\`지원하지 않는 ZIP 압축 방식입니다: \${entry.name} / method \${entry.method}\`);
    if(!('DecompressionStream' in window)) throw new Error('이 브라우저는 ZIP 압축 해제를 지원하지 않습니다. Chrome, Edge, Safari 최신 버전에서 열어주세요.');
    const ds=new DecompressionStream('deflate-raw'); const stream=new Blob([compressed]).stream().pipeThrough(ds); const ab=await new Response(stream).arrayBuffer();
    if(ab.byteLength>ZIP_LIMITS.jsonEntryBytes || (entry.uncompSize && ab.byteLength>entry.uncompSize+1024)) throw new Error('압축 해제된 JSON 크기가 ZIP 정보와 일치하지 않아 분석을 중단했습니다.');
    return dec.decode(ab);
  }`;
html = replaceRequired(html, inflateOld, inflateNew, 'ZIP entry decompression validation');

const handleStartOld = `  async function handleZip(file){
    setError(''); els.loadStatus.textContent='ZIP을 읽는 중입니다...'; state.sourceName=file.name;
    try{
      const zip=parseZipEntries(await file.arrayBuffer()); const found=findEntries(zip);`;
const handleStartNew = `  async function handleZip(file){
    document.querySelector('.toast')?.remove(); setError(''); els.loadStatus.textContent='ZIP을 읽는 중입니다...'; state.sourceName=file.name;
    try{
      assertZipFile(file); activateWorkspace(file);
      const zip=parseZipEntries(await file.arrayBuffer());
      if(zip.entries.some(e=>/(^|\\/)(?:following|followers_\\d+)\\.html$/i.test(e.name))) throw new Error('HTML 형식의 Instagram 데이터는 지원하지 않습니다. 다운로드 형식을 JSON으로 선택해 다시 받아주세요.');
      const found=findEntries(zip);`;
html = replaceRequired(html, handleStartOld, handleStartNew, 'ZIP preflight and workspace activation');

html = replaceRequired(
  html,
  `      const allKeys=new Set([...following.keys(),...followers.keys(),...recentUnfollowed.keys()]); const rows=[];`,
  `      const allKeys=new Set([...following.keys(),...followers.keys(),...recentUnfollowed.keys()]); if(allKeys.size>ZIP_LIMITS.accounts) throw new Error('계정 수가 50,000개를 초과해 브라우저가 느려질 수 있으므로 분석을 중단했습니다.'); const rows=[];`,
  'account count limit'
);

html = replaceRequired(
  html,
  `    }catch(err){ console.error(err); setError(err.message||String(err)); els.loadStatus.textContent='파일 분석 실패'; }`,
  `    }catch(err){ console.error(err); setError(friendlyFileError(err)); els.loadStatus.textContent='파일 분석 실패'; }`,
  'friendly ZIP errors'
);

const importOld = `  async function importProgress(file){
    const text=await file.text();
    try{
      if(file.name.toLowerCase().endsWith('.json')){ const data=JSON.parse(text); state.progress=data.progress||data||{}; saveProgress(); render(); toast('진행상황 불러오기 완료'); return; }
      const lines=text.split(/\\r?\\n/).filter(Boolean); const imported={...state.progress};
      for(const line of lines.slice(1)){ const cols=line.split(',').map(x=>x.trim().replace(/^"|"$/g,'')); const [username,status]=cols; if(username&&status) imported[username.toLowerCase()]={username,status,updatedAt:new Date().toISOString()}; }
      state.progress=imported; saveProgress(); render(); toast('CSV 불러오기 완료');
    }catch(e){ setError('진행상황 파일을 읽지 못했습니다: '+e.message); }
  }`;
const importNew = `  async function importProgress(file){
    const text=await file.text();
    try{
      const trimmed=text.trim(); if(!trimmed) throw new Error('파일 내용이 비어 있습니다.');
      if(file.name.toLowerCase().endsWith('.json') || /^[{[]/.test(trimmed)){
        const data=JSON.parse(trimmed);
        if(data.sourceName) activateWorkspace({name:data.sourceName,size:0});
        state.progress=normalizeImportedProgress(data);
        if(data.settings && typeof data.settings==='object') state.settings={...state.settings,...data.settings};
        saveProgress(); saveSettings(); render(); toast('진행상황 불러오기 완료'); return;
      }
      const lines=trimmed.split(/\\r?\\n/).filter(Boolean); if(lines.length<2) throw new Error('CSV 데이터가 비어 있습니다.');
      const header=parseCsvLine(lines[0]).map(value=>value.replace(/^\\uFEFF/,'').trim().toLowerCase());
      const usernameIndex=header.findIndex(value=>/아이디|계정|username/.test(value));
      const statusIndex=header.findIndex(value=>/상태|status/.test(value));
      if(usernameIndex<0 || statusIndex<0) throw new Error('CSV에서 아이디와 상태 열을 찾지 못했습니다.');
      const imported={...state.progress};
      for(const line of lines.slice(1)){
        const cols=parseCsvLine(line); const username=String(cols[usernameIndex]||'').trim().replace(/^@/,''); const status=importedStatus(cols[statusIndex]);
        if(username&&status) imported[username.toLowerCase()]={username,status,updatedAt:new Date().toISOString()};
      }
      state.progress=imported; saveProgress(); render(); toast('CSV 작업 기록 불러오기 완료');
    }catch(e){ setError('작업 기록을 불러오지 못했습니다. '+friendlyFileError(e)); }
  }`;
html = replaceRequired(html, importOld, importNew, 'progress JSON and CSV import');

html = replaceRequired(
  html,
  `const payload={exportedAt:new Date().toISOString(),sourceName:state.sourceName,progress:state.progress,settings:`,
  `const payload={version:12,exportedAt:new Date().toISOString(),workspaceId:ACTIVE_WORKSPACE,sourceName:state.sourceName,progress:state.progress,settings:`,
  'progress export workspace metadata'
);

html = replaceRequired(
  html,
  /const sampleFollowing=\[[\s\S]*?\];\s*const sampleFollowers=\[[\s\S]*?\];\s*const recently=\[[\s\S]*?\];/,
  `const sampleFollowing=Array.from({length:13},(_,i)=>'lava_demo_following_'+String(i+1).padStart(2,'0'));\n    const sampleFollowers=[...sampleFollowing.slice(0,6),...Array.from({length:4},(_,i)=>'lava_demo_follower_'+String(i+1).padStart(2,'0'))];\n    const recently=[];`,
  'remove legacy sample account names'
);

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: '맞팔체커',
  url: 'https://unfollow.lavalabs.co.kr/',
  applicationCategory: 'UtilityApplication',
  operatingSystem: 'Any',
  isAccessibleForFree: true,
  description: 'Instagram 데이터 ZIP을 브라우저에서만 분석해 맞팔과 취소 검토 계정을 확인하는 로컬 분석 도구',
  creator: {
    '@type': 'Organization',
    name: '라바랩스(LavaLabs)',
    legalName: '라바랩스(LavaLabs)',
    url: 'https://lavalabs.co.kr/',
    email: 'unfollow@lavalabs.co.kr',
    vatID: '455-23-01867',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'KR',
      addressRegion: '경기도',
      addressLocality: '고양시 일산서구',
      streetAddress: '일현로 47, 2층 204호 1308호실(탄현동, 예일 큰프라자)'
    },
    identifier: [
      {'@type':'PropertyValue','name':'사업자등록번호','value':'455-23-01867'},
      {'@type':'PropertyValue','name':'통신판매업 신고번호','value':'2025-고양일산서-1352'}
    ]
  }
};

const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'none'; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests";
const headAdditions = `
<base href="/">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#6557ff">
<link rel="canonical" href="https://unfollow.lavalabs.co.kr/">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="application-name" content="맞팔체커">
<meta name="apple-mobile-web-app-title" content="맞팔체커">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta property="og:type" content="website">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="맞팔체커 by Lava Labs">
<meta property="og:title" content="인스타 맞팔 확인 · 언팔 체크 | 맞팔체커">
<meta property="og:description" content="Instagram 데이터 ZIP을 브라우저에서만 분석해 맞팔과 취소 검토 계정을 확인하세요. 로그인과 자동 언팔은 필요하지 않습니다.">
<meta property="og:url" content="https://unfollow.lavalabs.co.kr/">
<meta property="og:image" content="https://unfollow.lavalabs.co.kr/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="인스타 맞팔 확인 · 언팔 체크 | 맞팔체커">
<meta name="twitter:description" content="로그인 없이 Instagram ZIP을 브라우저에서만 분석합니다.">
<meta name="twitter:image" content="https://unfollow.lavalabs.co.kr/og-image.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="/assets/v8-base.css?v=${VERSION}">
<link rel="stylesheet" href="/assets/v8-responsive.css?v=${VERSION}">
<link rel="stylesheet" href="/assets/local-icons.css?v=${VERSION}">
<link rel="stylesheet" href="/assets/product-improvements.css?v=${VERSION}">
<link rel="stylesheet" href="/assets/business-info.css?v=${VERSION}">
<link rel="stylesheet" href="/assets/release-hardening-v12.css?v=${VERSION}">
<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`;

html = html.replace(/<head([^>]*)>/i, `<head$1>${headAdditions}`);

const bodyAdditions = `
<script src="/assets/product-improvements.js?v=${VERSION}" defer></script>
<script src="/assets/work-mode-enhancements.js?v=${VERSION}" defer></script>
<script src="/assets/pwa-enhancements.js?v=${VERSION}" defer></script>
<script src="/assets/business-info.js?v=${VERSION}" defer></script>
<script src="/assets/release-hardening-v12.js?v=${VERSION}" defer></script>
<script>if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}</script>`;
html = html.replace(/<\/body>/i, `${bodyAdditions}</body>`);

const generatedAssets = new Map();
let scriptIndex = 0;
let styleIndex = 0;
html = html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, code) => {
  if (/\bsrc\s*=/.test(attrs) || /application\/ld\+json/i.test(attrs)) return full;
  if (!code.trim()) return '';
  const filename = `generated-inline-${++scriptIndex}.js`;
  generatedAssets.set(filename, code.trim() + '\n');
  return `<script${attrs} src="/assets/${filename}?v=${VERSION}"></script>`;
});
html = html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs, css) => {
  if (!css.trim()) return '';
  const filename = `generated-inline-${++styleIndex}.css`;
  generatedAssets.set(filename, css.trim() + '\n');
  return `<link rel="stylesheet" href="/assets/${filename}?v=${VERSION}">`;
});

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);

for (const file of ['CNAME', 'robots.txt', 'sitemap.xml', 'manifest.webmanifest', 'favicon.svg', 'sw.js']) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dist, file));
}

fs.cpSync(path.join(root, 'assets'), path.join(dist, 'assets'), { recursive: true });
for (const [filename, content] of generatedAssets) fs.writeFileSync(path.join(dist, 'assets', filename), content);
fs.writeFileSync(path.join(dist, '404.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/"><script src="/assets/redirect-home.js"></script>');
fs.writeFileSync(path.join(dist, 'assets', 'redirect-home.js'), 'location.replace("/");\n');
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

if (!/<title>인스타 맞팔 확인/.test(html)) throw new Error('SEO title injection failed');
if (html.includes('/matchal-checker/')) throw new Error('Legacy path remains in generated HTML');
if (html.includes('kyungminkim11/matchal-checker')) throw new Error('Legacy repository link remains in generated HTML');
if (html.includes('code.iconify.design')) throw new Error('External icon CDN remains in generated HTML');
if (html.includes('cdn.jsdelivr.net')) throw new Error('External font CDN remains in generated HTML');
if (!html.includes('release-hardening-v12.js')) throw new Error('v12 hardening script injection failed');
if (!html.includes('release-hardening-v12.css')) throw new Error('v12 hardening style injection failed');
if (!html.includes('Content-Security-Policy')) throw new Error('CSP injection failed');
if (!html.includes('unfollow_progress_v12_')) throw new Error('Workspace progress patch missing');
if (!html.includes('ZIP_LIMITS')) throw new Error('ZIP safety limits missing');
if (html.includes('bluepen_shop') || html.includes('tokyo_stationery')) throw new Error('Legacy sample accounts remain in generated HTML');
if (/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/i.test(html)) throw new Error('Executable inline script remains after CSP externalization');
if (!html.includes('business-info.js')) throw new Error('Business information injection failed');
if (!html.includes('455-23-01867')) throw new Error('Business registration data missing');
if (html.includes('031-900-9228') || html.includes('+82-31-900-9228')) throw new Error('Unverified phone number remains in generated HTML');

console.log(`Built ${path.relative(root, dist)} with ${html.length.toLocaleString()} characters and ${generatedAssets.size} generated assets.`);
