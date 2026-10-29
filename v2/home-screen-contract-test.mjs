import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {deployedRuntimeAssets} from './deployed-runtime-assets.mjs';
const root=new URL('./',import.meta.url),read=file=>fs.readFileSync(new URL(file,root),'utf8'),html=read('index.html');
const actual=JSON.parse(read('manifest.webmanifest')),legacy=JSON.parse(read('../manifest.webmanifest'));
const base=new URL('https://synthetic.invalid/lts-health/v2/'),oldBase=new URL('../',base);
assert.equal(new URL(actual.id,base).href,new URL(legacy.id,oldBase).href,'one stable installation identity across entry aliases');
assert.equal(new URL(actual.scope,base).href,base.href);assert.equal(new URL(actual.start_url,base).href,base.href+'#hoje');
assert.equal(new URL(legacy.start_url,oldBase).href,base.href+'#hoje');assert.equal(actual.display,'standalone');assert.equal(actual.name,'LTS Health');
assert.equal(new URL(actual.start_url,base).search,'','installation never pins a build');
assert.match(html,/rel="manifest" href="\.\/manifest.webmanifest"/);assert.match(html,/rel="apple-touch-icon" sizes="180x180"/);
const iconRevision='heart-pulse-20261029',appleIcon=new URL(html.match(/rel="apple-touch-icon"[^>]*href="([^"]+)"/)[1],base);
assert.equal(appleIcon.searchParams.get('v'),iconRevision,'Apple icon has an explicit new asset revision');
for(const [manifest,origin] of [[actual,base],[legacy,oldBase]])for(const icon of manifest.icons)assert.equal(new URL(icon.src,origin).searchParams.get('v'),iconRevision,'all install entry icons use the same revision');
assert.match(html,/name="apple-mobile-web-app-capable" content="yes"/);assert.match(html,/name="apple-mobile-web-app-title" content="LTS Health"/);
assert.equal((html.match(/data-health-install>/g)||[]).length,2,'installation help is reachable from login and More');
assert.doesNotMatch(read('../preview/compact-evidence/index.html'),/apple-mobile-web-app|healthInstallGuide|app-install\.js|rel="manifest"/,'read-only preview is not an install destination');
for(const [size,name] of [[180,'icon-180.png'],[192,'icon-192.png'],[512,'icon-512.png'],[512,'icon-maskable-512.png']]){
 const b=fs.readFileSync(new URL(`app-icons/${name}`,root));assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),size);assert.equal(b.readUInt32BE(20),size);assert.equal(b[25],2,'opaque RGB app icon');
 assert.deepEqual(b,fs.readFileSync(new URL(`../tools/health-home-screen/icons/${name}`,root)),'published bitmap is the exact reviewed source');
}
assert.ok(actual.icons.some(icon=>icon.purpose==='maskable'&&icon.sizes==='512x512'));
const inventory=deployedRuntimeAssets(html,url=>fs.readFileSync(url,'utf8'),root);
for(const file of ['manifest.webmanifest','sw.js','app-install.js','home-screen.css','app-icons/icon-180.png','app-icons/icon-192.png','app-icons/icon-512.png','app-icons/icon-maskable-512.png'])assert.ok(inventory.some(x=>x.file===file),'published inventory includes '+file);
const source=read('../tools/health-home-screen/app-install.js');assert.equal(source,read('app-install.js'));assert.equal(read('../tools/health-home-screen/sw.js'),read('sw.js'));
assert.doesNotMatch(source,/localStorage|sessionStorage|supabase|auth\.(?:getSession|signIn)|Notification\.requestPermission/,'home-screen shell does not copy credentials or request notification access');
const seed=['lts-health-shell-product-v63','lts-wealth-shell-v378','unrelated-cache'];
async function worker(file){
 const events={},deleted=[],fetches=[];let fail=false,unregistered=0,claimed=0;
 const context={self:{registration:{scope:base.href,unregister:async()=>{unregistered++;}},clients:{claim:async()=>{claimed++;}},skipWaiting:async()=>{},addEventListener:(name,fn)=>{events[name]=fn;}},caches:{keys:async()=>seed.slice(),delete:async key=>{deleted.push(key);}},URL,Response,Request:class{constructor(input,init){Object.assign(this,input,init);}},fetch:async request=>{fetches.push(request);if(fail)throw Error('synthetic offline');return new Response('fresh synthetic shell');}};
 vm.runInNewContext(read(file),context);let pending;events.activate({waitUntil:p=>{pending=p;}});await pending;
 assert.deepEqual(deleted,['lts-health-shell-product-v63'],'only obsolete Health shell caches may be removed');
 if(file==='../sw.js'){assert.equal(unregistered,1);assert.equal(events.fetch,undefined,'retired root worker never intercepts another app');return;}
 assert.equal(claimed,1);assert.equal(unregistered,0);
 const request={url:base.href,method:'GET',mode:'navigate'};let response;
 events.fetch({request,respondWith:p=>{response=p;}});assert.equal(await (await response).text(),'fresh synthetic shell');assert.equal(fetches[0].cache,'no-store','cold launches request current HTML');
 for(const changed of [{method:'POST'},{mode:'cors'},{url:'https://synthetic.invalid/lts-wealth/'},{url:'https://synthetic.supabase.co/rest/v1/health_metrics'}]){let caught=false;events.fetch({request:{...request,...changed},respondWith:()=>{caught=true;}});assert.equal(caught,false,'API, writes and other apps bypass the shell worker');}
 fail=true;events.fetch({request,respondWith:p=>{response=p;}});const offline=await response;assert.equal(offline.status,503);assert.equal(offline.headers.get('cache-control'),'no-store');const text=await offline.text();assert.match(text,/Você está sem conexão/);assert.doesNotMatch(text,/healthMetricValue|calorias|proteína|valor.*0|source_record_id/);
}
await worker('sw.js');await worker('../sw.js');
console.log('Home Screen contract passed: stable identity/start, Apple icons, complete public inventory, no session copying, network-only navigation, safe offline state and preserved other-app caches.');
