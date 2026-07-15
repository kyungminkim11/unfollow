import fs from 'node:fs';
import path from 'node:path';

await import('./build-release.mjs');

const root=process.cwd();
const assetsDir=path.join(root,'dist','assets');
const candidates=fs.readdirSync(assetsDir)
  .filter(name=>/^generated-inline-\d+\.js$/.test(name))
  .map(name=>path.join(assetsDir,name));
const corePath=candidates.find(file=>fs.readFileSync(file,'utf8').includes('function workspaceFromFile'));
if(!corePath) throw new Error('Could not find the generated core script for v13 workspace patching.');

let source=fs.readFileSync(corePath,'utf8');
function replaceRequired(search,replacement,label){
  if(typeof search==='string'){
    if(!source.includes(search)) throw new Error(`V13 patch target missing: ${label}`);
    source=source.replace(search,replacement);
    return;
  }
  if(!search.test(source)) throw new Error(`V13 patch target missing: ${label}`);
  search.lastIndex=0;
  source=source.replace(search,replacement);
}

replaceRequired(
  /  function workspaceFromFile\(file\)\{[\s\S]*?  function assertZipFile\(file\)\{/,
`  const WORKSPACE_SIGNATURE_KEY = 'unfollow_workspace_signatures_v13';
  function workspaceFromFile(file){
    let value=String(file?.name||'').replace(/\\.zip$/i,'').toLowerCase();
    if(/^instagram[-_]lava[-_]demo[-_]/.test(value)) return 'sample';
    value=value.replace(/^instagram[-_]?/,'');
    value=value.replace(/[-_](?:19|20)\\d{2}[-_]\\d{1,2}[-_]\\d{1,2}.*$/,'');
    value=value.replace(/[-_]\\d{8}.*$/,'');
    value=value.replace(/[^a-z0-9._-]+/g,'_').replace(/^[_-]+|[_-]+$/g,'').slice(0,80);
    return value||'default';
  }
  function workspaceHash32(value){
    let hash=2166136261;
    for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return hash>>>0;
  }
  function workspaceSketch(keys){
    return [...keys].map(workspaceHash32).sort((a,b)=>a-b).slice(0,128);
  }
  function workspaceSimilarity(a,b){
    if(!a?.length||!b?.length) return 0;
    const set=new Set(a); let common=0;
    for(const value of b) if(set.has(value)) common++;
    return common/Math.max(a.length,b.length);
  }
  function readWorkspaceSignatures(){
    try{return JSON.parse(localStorage.getItem(WORKSPACE_SIGNATURE_KEY)||'{}')||{};}catch{return {};}
  }
  function meaningfulFilenameWorkspace(file){
    const id=workspaceFromFile(file);
    if(id==='sample') return 'sample';
    const generic=new Set(['default','download','downloads','instagram','data','archive','followers','following','followers_and_following','your_instagram_activity']);
    return generic.has(id)?'':id;
  }
  async function contentWorkspaceId(file,allKeys){
    const filenameId=meaningfulFilenameWorkspace(file);
    if(filenameId) return 'name_'+filenameId;
    const sketch=workspaceSketch(allKeys);
    const signatures=readWorkspaceSignatures();
    let bestId=''; let bestScore=0;
    for(const [id,record] of Object.entries(signatures)){
      const score=workspaceSimilarity(sketch,record?.sketch||[]);
      if(score>bestScore){bestId=id;bestScore=score;}
    }
    if(bestId&&bestScore>=0.34) return bestId;
    const bytes=new TextEncoder().encode(sketch.join(',')+'|'+allKeys.size);
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const hex=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    return 'data_'+hex.slice(0,18);
  }
  function activateWorkspaceById(id,allKeys){
    ACTIVE_WORKSPACE=String(id||'default').replace(/[^a-z0-9._-]+/gi,'_').slice(0,100)||'default';
    STORAGE_KEY=STORAGE_PREFIX+ACTIVE_WORKSPACE;
    sessionStorage.setItem('unfollow_active_progress_key',STORAGE_KEY);
    sessionStorage.setItem('unfollow_active_workspace',ACTIVE_WORKSPACE);
    if(ACTIVE_WORKSPACE==='sample') localStorage.removeItem(STORAGE_KEY);
    if(ACTIVE_WORKSPACE!=='sample'&&!localStorage.getItem(STORAGE_KEY)&&!localStorage.getItem(MIGRATION_KEY)){
      const legacy=localStorage.getItem(LEGACY_STORAGE_KEY);
      if(legacy&&legacy!=='{}') localStorage.setItem(STORAGE_KEY,legacy);
      localStorage.setItem(MIGRATION_KEY,'1');
    }
    if(allKeys&&ACTIVE_WORKSPACE!=='sample'){
      const signatures=readWorkspaceSignatures();
      signatures[ACTIVE_WORKSPACE]={sketch:workspaceSketch(allKeys),count:allKeys.size,updatedAt:new Date().toISOString()};
      localStorage.setItem(WORKSPACE_SIGNATURE_KEY,JSON.stringify(signatures));
    }
    state.progress=loadProgress();
    window.dispatchEvent(new CustomEvent('unfollow:workspace',{detail:{id:ACTIVE_WORKSPACE,key:STORAGE_KEY,matchedBy:ACTIVE_WORKSPACE.startsWith('data_')?'content':'name'}}));
  }
  async function activateWorkspace(file,zip,allKeys){
    if(workspaceFromFile(file)==='sample'){activateWorkspaceById('sample',allKeys);return;}
    activateWorkspaceById(await contentWorkspaceId(file,allKeys),allKeys);
  }
  function assertZipFile(file){`,
  'content-based workspace functions'
);

replaceRequired(
  `      assertZipFile(file); activateWorkspace(file);\n      const zip=parseZipEntries(await file.arrayBuffer());`,
  `      assertZipFile(file);\n      const zip=parseZipEntries(await file.arrayBuffer());`,
  'remove filename-only workspace activation'
);

replaceRequired(
  `      const allKeys=new Set([...following.keys(),...followers.keys(),...recentUnfollowed.keys()]); if(allKeys.size>ZIP_LIMITS.accounts) throw new Error('계정 수가 50,000개를 초과해 브라우저가 느려질 수 있으므로 분석을 중단했습니다.'); const rows=[];`,
  `      const allKeys=new Set([...following.keys(),...followers.keys(),...recentUnfollowed.keys()]); if(allKeys.size>ZIP_LIMITS.accounts) throw new Error('계정 수가 50,000개를 초과해 브라우저가 느려질 수 있으므로 분석을 중단했습니다.'); await activateWorkspace(file,zip,allKeys); const rows=[];`,
  'activate workspace after relationship data is available'
);

replaceRequired(
  `        if(data.sourceName) activateWorkspace({name:data.sourceName,size:0});`,
  `        if(data.workspaceId) activateWorkspaceById(data.workspaceId); else if(data.sourceName) activateWorkspaceById('name_'+workspaceFromFile({name:data.sourceName}));`,
  'restore exported workspace identity'
);

source=source.replace('const payload={version:12,','const payload={version:13,');
fs.writeFileSync(corePath,source);

const indexPath=path.join(root,'dist','index.html');
let html=fs.readFileSync(indexPath,'utf8');
html=html
  .replaceAll('v12.0','v15.0')
  .replaceAll('v13.0','v15.0')
  .replaceAll('취소 검토 계정','나만 팔로우 중인 계정')
  .replaceAll('맞팔과 취소 검토','맞팔과 나만 팔로우 중인 계정');
fs.writeFileSync(indexPath,html);

const pagesSource=path.join(root,'pages');
if(fs.existsSync(pagesSource)){
  for(const entry of fs.readdirSync(pagesSource,{withFileTypes:true})){
    if(!entry.isDirectory()) continue;
    fs.cpSync(path.join(pagesSource,entry.name),path.join(root,'dist',entry.name),{recursive:true});
  }
}

if(!source.includes('WORKSPACE_SIGNATURE_KEY')) throw new Error('v13 workspace signature code missing.');
if(!source.includes('await activateWorkspace(file,zip,allKeys)')) throw new Error('v13 content workspace activation missing.');
if(!source.includes('version:13')) throw new Error('v13 progress export version missing.');
for(const page of ['guide','help','privacy','terms','data','premium','newsletter','contact']){
  if(!fs.existsSync(path.join(root,'dist',page,'index.html'))) throw new Error(`V23 static page missing: ${page}`);
}
for(const asset of ['service-v15.js','service-v15.css','monetization-v16.js','monetization-v16.css','newsletter-page-v16.js','site-pages-v16.css','mobile-native-v19.js','mobile-native-v19.css','contact-v21.js','contact-v21.css','admin-inquiries-v21.js','admin-inquiries-v21.css','automation-v22.js','automation-v22.css','automation-parser-v22.js','relationship-scan-v23.js','relationship-scan-v23.css']){
  if(!fs.existsSync(path.join(assetsDir,asset))) throw new Error(`V23 asset missing: ${asset}`);
}
for(const extensionFile of ['manifest.json','background.js','content-bridge.js','instagram-content.js','instagram-scan.js','sidepanel.html','sidepanel.css','sidepanel.js']){
  if(!fs.existsSync(path.join(root,'extension',extensionFile))) throw new Error(`V23 extension file missing: ${extensionFile}`);
}
const businessInfo=fs.readFileSync(path.join(assetsDir,'business-info.js'),'utf8');
if(!businessInfo.includes('service-v15.js')) throw new Error('V15 loader missing from business-info.js.');
if(!businessInfo.includes('monetization-v16.js')) throw new Error('V16 monetization loader missing from business-info.js.');
if(!businessInfo.includes('mobile-native-v19.js')) throw new Error('V19 mobile loader missing from business-info.js.');
if(!businessInfo.includes('automation-v22.js')) throw new Error('V22 automation UI loader missing from business-info.js.');
if(!businessInfo.includes('automation-parser-v22.js')) throw new Error('V22 automation parser loader missing from business-info.js.');
if(!businessInfo.includes('relationship-scan-v23.js')) throw new Error('V23 relationship scan UI loader missing from business-info.js.');
if(!businessInfo.includes("href:'/contact/'")) throw new Error('V21 contact navigation missing from business-info.js.');
console.log(`V23 relationship scan build ready with content-aware workspaces in ${path.basename(corePath)}.`);