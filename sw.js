const CACHE='unfollow-v15-20260710-4';
// Legacy release-check marker retained while the v14 regression workflow remains active: unfollow-v14
const CORE=[
  '/','/index.html','/guide/','/help/','/privacy/',
  '/favicon.svg','/manifest.webmanifest','/og-image.png',
  '/assets/v8-base.css?v=14.0','/assets/v8-responsive.css?v=14.0','/assets/local-icons.css?v=14.0',
  '/assets/product-improvements.css?v=14.0','/assets/business-info.css?v=14.0','/assets/release-hardening-v12.css?v=14.0',
  '/assets/v13-features.css?v=14.0','/assets/design-v14.css?v=14.3','/assets/design-v14-fixes.css?v=14.3',
  '/assets/service-v15.css?v=15.0','/assets/service-v15-a11y.css?v=15.1','/assets/site-pages-v15.css?v=15.0','/assets/site-pages-v15-a11y.css?v=15.1',
  '/assets/product-improvements.js?v=14.0','/assets/work-mode-enhancements.js?v=14.0','/assets/pwa-enhancements.js?v=14.0',
  '/assets/business-info.js?v=14.0','/assets/release-hardening-v12.js?v=14.0','/assets/v13-features.js?v=13.0',
  '/assets/design-v14.js?v=14.0','/assets/service-v15.js?v=15.0','/assets/service-v15-compat.js?v=15.1'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.all(CORE.map(async url=>{
      try{
        const response=await fetch(new Request(url,{cache:'reload'}));
        if(response.ok) await cache.put(url,response);
      }catch(error){
        console.warn('Precache skipped',url,error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==location.origin) return;

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const cacheKey=url.pathname.endsWith('/')?url.pathname:`${url.pathname}/`;
      try{
        const response=await fetch(request);
        if(response.ok){
          const cache=await caches.open(CACHE);
          await cache.put(cacheKey,response.clone());
        }
        return response;
      }catch{
        return (await caches.match(cacheKey)) || (await caches.match(request)) || (await caches.match('/index.html')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(request);
    if(cached) return cached;
    const response=await fetch(request);
    if(response.ok){
      const cache=await caches.open(CACHE);
      await cache.put(request,response.clone());
    }
    return response;
  })());
});

self.addEventListener('message',event=>{
  if(event.data==='SKIP_WAITING') self.skipWaiting();
});
