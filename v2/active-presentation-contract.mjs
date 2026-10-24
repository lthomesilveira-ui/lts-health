import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

// Import-map declarations do not execute modules. Walk actual script roots and
// their resolved static/literal dynamic imports before rejecting DOM patchers.
export function activePresentationGraph(html,read,root){
 const base=new URL(root),map=JSON.parse(html.match(/<script[^>]*type=["']importmap["'][^>]*>\s*([\s\S]*?)\s*<\/script>/)?.[1]||'{"imports":{}}'),mapping=map.imports||{};
 assert.ok(!Object.keys(map.scopes||{}).length,'scoped import maps require explicit audit');
 assert.ok(!Object.keys(mapping).some(key=>key.endsWith('/')),'prefix import maps require explicit audit');
 const specifiers=body=>[...body.matchAll(/\bfrom\s*["']([^"']+)["']|(?<![\w.-])import\s*(?:\(\s*)?["']([^"']+)["']/g)].map(match=>match[1]||match[2]);
 const urlLike=value=>/^(?:\.{1,2}\/|\/|[a-z][a-z0-9+.-]*:)/i.test(value);
 const imports=new Map(Object.entries(mapping).map(([key,value])=>[urlLike(key)?new URL(key,base).href:key,new URL(value,base).href]));
 const resolve=(specifier,parent)=>{
  const key=urlLike(specifier)?new URL(specifier,parent).href:specifier;
  const mapped=imports.get(key);
  assert.ok(mapped||urlLike(specifier),'unmapped bare dependency requires audit: '+specifier);
  return new URL(mapped||key);
 };
 const scripts=new Map(),inline=[];
 const visit=(url,scriptRoot=false)=>{
  if(!url.href.startsWith(base.href)){assert.ok(scriptRoot&&url.href==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','external executable dependency requires audit: '+url.href);return;}
  const file=new URL(url);file.search='';file.hash='';
  if(scripts.has(file.href))return;
  const body=read(file);scripts.set(file.href,body);
  for(const relative of specifiers(body))visit(resolve(relative,file));
 };
 for(const [,attrs,body]of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
  if(/type=["'](?:importmap|application\/json)["']/.test(attrs))continue;
  const src=attrs.match(/\bsrc=["']([^"']+)["']/)?.[1];
  if(src)visit(new URL(src,base),true);else{inline.push(body);for(const relative of specifiers(body))visit(resolve(relative,base));}
 }
 return {scripts,inline};
}
export function assertActivePresentation(html,read,root){
 const graph=activePresentationGraph(html,read,root);
 for(const [,href]of html.matchAll(/<link\b[^>]*href=["']([^"']+)["']/g)){
  for(const old of ['dashboard-parity.css','dashboard-reference-contract.css'])assert.ok(!new URL(href,root).pathname.endsWith('/'+old),'superseded stylesheet is active: '+old);
 }
 for(const [file,body]of graph.scripts){
  for(const old of ['executive-cockpit.js','dashboard-reference-runtime.js','training-reference-runtime.js'])assert.ok(!new URL(file).pathname.endsWith('/'+old),'superseded script is active: '+old);
  assert.doesNotMatch(body,/\bMutationObserver\b/,'active runtime must not replace the accepted renderer: '+file);
  assert.doesNotMatch(body,/\bimport\s*\(\s*[^'"\s]/,'nonliteral dynamic imports require an explicit dependency audit: '+file);
 }
 for(const body of graph.inline){assert.doesNotMatch(body,/\bMutationObserver\b/,'inline DOM patcher is active');assert.doesNotMatch(body,/\bimport\s*\(\s*[^'"\s]/,'nonliteral inline imports require an explicit dependency audit');}
 return graph;
}
function selfTest(){
 const root='file:///synthetic/',html='<script type="importmap">{"imports":{"./old.js":"./executive-cockpit.js","./alias.js":"./safe.js"}}</script><script type="module" src="./main.js"></script>';
 const source=new Map([['main.js',"import './alias.js';"],['safe.js','export const safe=true;'],['executive-cockpit.js','new MutationObserver(()=>{});']]);
 const read=url=>{const name=url.pathname.split('/').at(-1);assert.ok(source.has(name),'unexpected module '+name);return source.get(name);};
 assert.equal(assertActivePresentation(html,read,root).scripts.size,2,'unused aliases do not execute');
 const bare=html.replace('"./old.js":','"old":');source.set('safe.js',"import 'old';");assert.throws(()=>assertActivePresentation(bare,read,root),/superseded script|active runtime/,'bare alias is traversed');
 source.set('safe.js',"import '/synthetic/executive-cockpit.js';");assert.throws(()=>assertActivePresentation(html,read,root),/superseded script|active runtime/,'root-relative dependency is traversed');
 source.set('safe.js',"import 'file:///synthetic/executive-cockpit.js';");assert.throws(()=>assertActivePresentation(html,read,root),/superseded script|active runtime/,'absolute dependency is traversed');
 source.set('safe.js','export const safe=true;');
 assert.throws(()=>assertActivePresentation(html+"<script type='module'>const target='./executive-cockpit.js';import(target);</script>",read,root),/nonliteral inline imports/);
 assert.throws(()=>assertActivePresentation('<script type="importmap">{"imports":{"./executive-cockpit.js":"./safe.js"}}</script><script src="./executive-cockpit.js"></script>',read,root),/superseded script|active runtime/,'script src is never remapped');

 source.set('safe.js',"import('./old.js');");assert.throws(()=>assertActivePresentation(html,read,root),/superseded script|active runtime/,'transitive dynamic import cannot hide a patcher');
 source.set('safe.js','new MutationObserver(()=>{});');assert.throws(()=>assertActivePresentation(html,read,root),/active runtime/);
 source.set('safe.js',"import(variable);");assert.throws(()=>assertActivePresentation(html,read,root),/nonliteral dynamic imports/);
 source.set('safe.js','export const safe=true;');assert.throws(()=>assertActivePresentation(html+"<script type='module'>import './old.js';</script>",read,root),/superseded script|active runtime/);assert.throws(()=>assertActivePresentation(html+'<script>new MutationObserver(()=>{});</script>',read,root),/inline DOM patcher/);
 for(const href of ['dashboard-parity.css','./dashboard-parity.css?v=test','dashboard-parity.css#fragment','./dashboard-reference-contract.css?v=test#fragment'])assert.throws(()=>assertActivePresentation(html+`<link rel="stylesheet" href="${href}">`,read,root),/superseded stylesheet/);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 selfTest();const root=new URL('./',import.meta.url),html=fs.readFileSync(new URL('index.html',root),'utf8');
 const graph=assertActivePresentation(html,url=>fs.readFileSync(url,'utf8'),root);
 assert.ok([...graph.scripts.keys()].some(file=>file.endsWith('/health-dashboard.js')),'accepted dashboard is reachable');
 console.log(`Active presentation: ${graph.scripts.size} reachable modules; dead aliases ignored, active legacy scripts, styles and DOM patchers rejected.`);
}
