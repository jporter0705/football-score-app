const VERSION="football-v4.8.0-network-first";
self.addEventListener("install",e=>self.skipWaiting());
self.addEventListener("activate",e=>{e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)));await self.clients.claim();})());});
self.addEventListener("fetch",e=>{
  e.respondWith((async()=>{
    try{
      const r=await fetch(e.request);
      const u=new URL(e.request.url);
      if(e.request.mode==="navigate"&&u.origin===self.location.origin){
        const text=await r.text();
        return new Response(text.replace("</body>","<script src=\"/enhancements.js?v=4.8.0\"></script></body>"),{status:r.status,statusText:r.statusText,headers:r.headers});
      }
      return r;
    }catch(err){return caches.match(e.request)}
  })());
});
