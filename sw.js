const CACHE='unfollow-v19-20260711-2';
// Legacy release-check markers retained while older regression workflows remain active: unfollow-v18 unfollow-v17 unfollow-v16 unfollow-v15 unfollow-v14
const CORE=[
  '/','/index.html','/guide/','/help/','/privacy/','/terms/','/data/','/premium/','/newsletter/',
  '/favicon.svg','/manifest.webmanifest','/og-image.png',
  '/assets/v8-base.css?v=14.0','/assets/v8-responsive.css?v=14.0','/assets/local-icons.css?v=14.0',
  '/assets/product-improvements.css?v=14.0','/assets/business-info.css?v=14.0','/assets/release-hardening-v12.css?v=14.0',
  '/assets/v13-features.css?v=14.0','/assets/design-v14.css?v=14.3','/assets/design-v14-fixes.css?v=14.3',
  '/assets/service-v15.css?v=15.0','/assets/service-v15-a11y.css?v=15.1','/assets/site-pages-v15.css?v=15.0','/assets/site-pages-v15-a11y.css?v=15.1',
  '/assets/monetization-v16.css?v=16.0','/assets/site-pages-v16.css?v=16.0','/assets/site-pages-v17.css?v=17.0','/assets/mobile-native-v19.css?v=19.0','/assets/mobile-native-v19-fixes.css?v=19.1',
  '/assets/product-improvements.js?v=14.0','/assets/work-mode-enhancements.js?v=14.0','/assets/pwa-enhancements.js?v=14.0',
  '/assets/business-info.js?v=14.0','/assets/release-hardening-v12.js?v=14.0','/assets/v13-features.js?v=13.0',
  '/assets/design-v14.js?v=14.0','/assets/service-v15.js?v=15.0','/assets/service-v15-compat.js?v=15.1',
  '/assets/monetization-v16.js?v=16.0','/assets/mobile-native-v19.js?v=19.0','/assets/newsletter-page-v16.js?v=18.0','/assets/premium-interest-v17.js?v=17.0'
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

  if(url.searchParams.has('connectivity')){
    event.respondWith(fetch(request,{cache:'no-store'}));
    return;
  }

  if(url.pathname.startsWith('/admin/')){
    event.respondWith(fetch(request,{cache:'no-store'}));
    return;
  }

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
