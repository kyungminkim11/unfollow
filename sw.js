const CACHE='unfollow-v14-20260628-2';
const CORE=['/','/index.html','/favicon.svg','/manifest.webmanifest','/og-image.png','/assets/v8-base.css?v=14.0','/assets/v8-responsive.css?v=14.0','/assets/local-icons.css?v=14.0','/assets/product-improvements.css?v=14.0','/assets/business-info.css?v=14.0','/assets/release-hardening-v12.css?v=14.0','/assets/v13-features.css?v=14.0','/assets/design-v14.css?v=14.1','/assets/design-v14-fixes.css?v=14.1','/assets/product-improvements.js?v=14.0','/assets/work-mode-enhancements.js?v=14.0','/assets/pwa-enhancements.js?v=14.0','/assets/business-info.js?v=14.0','/assets/release-hardening-v12.js?v=14.0','/assets/v13-features.js?v=14.0','/assets/design-v14.js?v=14.1'];

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
      try{
        const response=await fetch(request);
        if(response.ok){
          const cache=await caches.open(CACHE);
          await cache.put('/index.html',response.clone());
        }
        return response;
      }catch{
        return (await caches.match('/index.html')) || Response.error();
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
