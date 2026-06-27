import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const root = process.cwd();
const dist = path.join(root, 'dist');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

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
  .replace(/<title>.*?<\/title>/i, '<title>인스타 맞팔 확인 · 언팔 체크 | 맞팔체커</title>')
  .replace(/<meta\s+name=["']description["'][^>]*>/i, '<meta name="description" content="Instagram 데이터 ZIP을 브라우저에서만 분석해 맞팔, 취소 검토 계정과 팔로워만 있는 계정을 확인하세요. 로그인과 자동 언팔 없이 무료로 사용할 수 있습니다.">')
  .replaceAll('Matchal Checker', '맞팔체커')
  .replaceAll('v9.2', 'v10.1');

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
    email: 'lavalabs.ceo@gmail.com',
    telephone: '+82-31-900-9228',
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

const headAdditions = `
<base href="/">
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
<link rel="stylesheet" href="/assets/v8-base.css?v=10.1">
<link rel="stylesheet" href="/assets/v8-responsive.css?v=10.1">
<link rel="stylesheet" href="/assets/local-icons.css?v=10.1">
<link rel="stylesheet" href="/assets/product-improvements.css?v=10.1">
<link rel="stylesheet" href="/assets/business-info.css?v=10.1">
<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`;

html = html.replace(/<head([^>]*)>/i, `<head$1>${headAdditions}`);

const bodyAdditions = `
<script src="/assets/product-improvements.js?v=10.1" defer></script>
<script src="/assets/work-mode-enhancements.js?v=10.1" defer></script>
<script src="/assets/pwa-enhancements.js?v=10.1" defer></script>
<script src="/assets/business-info.js?v=10.1" defer></script>
<script>if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}</script>`;
html = html.replace(/<\/body>/i, `${bodyAdditions}</body>`);

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);

for (const file of ['CNAME', 'robots.txt', 'sitemap.xml', 'manifest.webmanifest', 'favicon.svg', 'sw.js']) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dist, file));
}

fs.cpSync(path.join(root, 'assets'), path.join(dist, 'assets'), { recursive: true });
fs.writeFileSync(path.join(dist, '404.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/"><script>location.replace("/")</script>');
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

if (!/<title>인스타 맞팔 확인/.test(html)) throw new Error('SEO title injection failed');
if (html.includes('/matchal-checker/')) throw new Error('Legacy path remains in generated HTML');
if (html.includes('kyungminkim11/matchal-checker')) throw new Error('Legacy repository link remains in generated HTML');
if (html.includes('code.iconify.design')) throw new Error('External icon CDN remains in generated HTML');
if (!html.includes('product-improvements.js')) throw new Error('Product enhancement injection failed');
if (!html.includes('business-info.js')) throw new Error('Business information injection failed');
if (!html.includes('455-23-01867')) throw new Error('Business registration data missing');

console.log(`Built ${path.relative(root, dist)} with ${html.length.toLocaleString()} characters.`);
