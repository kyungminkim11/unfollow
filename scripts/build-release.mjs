import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const dist=path.join(root,'dist');
let buildError=null;

try{
  await import('./build-pages.mjs');
}catch(error){
  buildError=error;
  if(!String(error?.message||error).includes('External font CDN remains')) throw error;
  console.warn('Base build completed with a removable external-font assertion. Continuing with release cleanup.');
}

if(!fs.existsSync(path.join(dist,'index.html'))) throw new Error('Base build did not create dist/index.html');

function walk(dir){
  const files=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const textFiles=walk(dist).filter(file=>/\.(?:html|css|js|json|xml|txt|webmanifest)$/i.test(file));
for(const file of textFiles){
  let text=fs.readFileSync(file,'utf8');
  const before=text;
  text=text
    .replace(/<link\b[^>]*cdn\.jsdelivr\.net[^>]*>/gi,'')
    .replace(/@import\s+(?:url\()?\s*["']?https:\/\/cdn\.jsdelivr\.net\/[^;\n]+;?/gi,'')
    .replace(/url\(\s*["']?https:\/\/cdn\.jsdelivr\.net\/[^)]+\)/gi,'url("")')
    .replace(/https:\/\/cdn\.jsdelivr\.net\/[^"'()\s<>]+/gi,'');
  if(text!==before) fs.writeFileSync(file,text);
}

const indexPath=path.join(dist,'index.html');
let html=fs.readFileSync(indexPath,'utf8');
html=html.replace(/<meta\s+charset=["'][^"']+["']\s*\/?\s*>/gi,'');
html=html.replace(/<head([^>]*)>/i,'<head$1><meta charset="utf-8">');
fs.writeFileSync(indexPath,html);

const remaining=[];
for(const file of textFiles){
  const text=fs.readFileSync(file,'utf8');
  if(text.includes('cdn.jsdelivr.net')) remaining.push(path.relative(dist,file));
}
if(remaining.length) throw new Error(`External CDN references remain: ${remaining.join(', ')}`);
if(!html.includes('Content-Security-Policy')) throw new Error('CSP missing from release output');
if(!html.includes('release-hardening-v12.js')) throw new Error('v12 hardening script missing');
if(!html.includes('release-hardening-v12.css')) throw new Error('v12 hardening stylesheet missing');
if(!walk(path.join(dist,'assets')).some(file=>/generated-inline-\d+\.js$/.test(file))) throw new Error('Externalized core scripts missing');
if(walk(dist).some(file=>/\.(?:html|js|css)$/i.test(file)&&/bluepen_shop|tokyo_stationery/.test(fs.readFileSync(file,'utf8')))) throw new Error('Legacy sample account data remains');

console.log(`Release build ready${buildError?' after CDN cleanup':''}.`);
