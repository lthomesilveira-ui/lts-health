import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertActivePresentation} from './active-presentation-contract.mjs';

// Deployment inventory follows executable import-map resolution, not dormant aliases.
export function deployedRuntimeAssets(html,read,root){
 const base=new URL(root),graph=assertActivePresentation(html,read,base),files=new Set(),requests=new Map();
 const add=(reference,parent=base)=>{
  if(reference.startsWith('data:'))return;
  const url=new URL(reference,parent);url.hash='';
  const request=url.href.slice(base.href.length);
  assert.ok(!/[\r\n\t]/.test(request),'runtime URL must be line-safe');
  url.search='';
  assert.ok(url.href.startsWith(base.href),'runtime asset must remain inside v2: '+url.href);
  const relative=decodeURIComponent(url.href.slice(base.href.length));
  assert.match(relative,/^[a-zA-Z0-9_./-]+$/,'runtime path must be shell-safe');
  requests.set(request,{file:relative,request});
  if(files.has(relative))return;files.add(relative);
  const body=read(url);
  if(relative.endsWith('.css')){
   for(const [,asset]of body.matchAll(/@import\s*["']([^"']+)["']/g))add(asset,url);
   for(const [,asset]of body.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g))add(asset.trim(),url);
  }
 };
 for(const request of graph.requests)add(request);
 for(const [,href]of html.matchAll(/<link\b[^>]*href=["']([^"']+)["']/g))add(href);
 return [...requests.values()].sort((a,b)=>a.request.localeCompare(b.request));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=new URL('./',import.meta.url),html=fs.readFileSync(new URL('index.html',root),'utf8');
 const files=deployedRuntimeAssets(html,url=>fs.readFileSync(url,'utf8'),root);
 for(const required of ['src/health-dashboard.js','src/dashboard-changes.js','src/health-dashboard-model.js','src/steps-evidence.js','src/core.js','src/data-layer.js','health-dashboard.css'])assert.ok(files.some(item=>item.file===required),'current deployed graph missing '+required);
 assert.match(html,/name="lts-build" content="health-integrated-/);
 assert.doesNotMatch(html,/preview-readonly|lts-preview/);
 if(process.argv.includes('--list'))console.log(files.map(item=>item.file+'\t'+item.request).join('\n'));
 else{
  const fakeRoot='file:///synthetic/',sources=new Map([['main.js',"import './alias.js';"],['current.js','export const x=1;'],['style.css','a{background:url("icon.svg?v=1#mark")}'],['icon.svg','<svg/>']]);
  const read=url=>{const file=url.pathname.split('/').at(-1);assert.ok(sources.has(file));return sources.get(file);};
  const fixture='<script type="importmap">{"imports":{"./alias.js":"./current.js?v=review","./unused.js":"./unused.js"}}</script><script type="module" src="./main.js?v=1"></script><link rel="stylesheet" href="style.css?v=1#x">';
  assert.deepEqual(deployedRuntimeAssets(fixture,read,fakeRoot).map(item=>item.request),['current.js?v=review','icon.svg?v=1','main.js?v=1','style.css?v=1']);
  assert.throws(()=>deployedRuntimeAssets(fixture+'<link href="../outside.css">',read,fakeRoot),/inside v2/);
  sources.set('style.css','@import "nested.css";');sources.set('nested.css','a{}');assert.ok(deployedRuntimeAssets(fixture,read,fakeRoot).some(item=>item.file==='nested.css'),'quoted CSS imports are inventoried');
  sources.set('nested.css','@import url("../outside.css");');assert.throws(()=>deployedRuntimeAssets(fixture,read,fakeRoot),/inside v2/);
  console.log(`Deployed runtime inventory: ${files.length} actual active module/style/asset URLs; alias, nested asset and escape tests passed.`);
 }
}
