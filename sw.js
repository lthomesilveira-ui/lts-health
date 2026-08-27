const CACHE='lts-health-shell-v17';
const SHELL=['./','./index.html','./styles.css','./v10.css','./v11.css','./v12.css','./v13.css','./v14.css','./v15.css','./v16.css','./v17.css','./config.js','./app.js','./app-v8.js','./app-v11.js','./app-v12.js','./app-v13.js','./app-v14.js','./app-v15.js','./app-v16.js','./app-v17.js','./manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);
  if(event.request.method!=='GET'||u.origin!==self.location.origin)return;
  if(u.hostname.includes('supabase.co'))return;
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});return response}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
});
