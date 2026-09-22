const VERSION="football-v4.7.3-enhancements";
self.addEventListener("install",e=>self.skipWaiting());
self.addEventListener("activate",e=>{e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)));await self.clients.claim();})());});
self.addEventListener("fetch",e=>{
  const r=e.request,u=new URL(r.url);
  if(r.mode==='navigate'&&u.origin===self.location.origin){
    e.respondWith((async()=>{try{const res=await fetch(r);if(!res.ok)return res;let html=await res.text();if(!html.includes('enhancements.js'))html=html.replace('</body>','<script src="/enhancements.js?v=4.7.3"></script></body>');return new Response(html,{status:res.status,statusText:res.statusText,headers:res.headers});}catch(err){return caches.match(r)}})());return;
  }
  e.respondWith(fetch(r).catch(()=>caches.match(r)));
});
