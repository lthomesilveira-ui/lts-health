import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const code=html.match(/<script id="healthAssetRecovery">([\s\S]*?)<\/script>/)?.[1];
assert.ok(code&&html.indexOf(code)<html.indexOf('<link rel="stylesheet"'),'recovery exists before public styles start loading');
const build=html.match(/name="lts-build" content="([^"]+)"/)[1];
const root='https://synthetic.invalid/lts-health/v2/';
function environment({storage=new Map([['synthetic-auth-sentinel','preserve']]),storageDenied=false,query='',hash='#hoje',inputs=[],meta=build}={}){
  const events={},timers=new Map(),replacements=[];let reloads=0,sequence=0;
  const document={querySelector:()=>({content:meta}),querySelectorAll:()=>inputs};
  const location={href:root+query+hash,search:query,hash,reload(){reloads++;}};
  const context={document,location,URL,URLSearchParams,WeakSet,Set,
    window:{addEventListener(name,listener){events[name]=listener;}},
    sessionStorage:{getItem(key){if(storageDenied)throw Error('denied');return storage.get(key)??null;},setItem(key,value){if(storageDenied)throw Error('denied');storage.set(key,value);},removeItem(key){if(storageDenied)throw Error('denied');storage.delete(key);}},
    setTimeout(callback){const id=++sequence;timers.set(id,callback);return id;},clearTimeout(id){timers.delete(id);}};
  vm.runInNewContext(code,context);
  function asset(file,{style=file.endsWith('.css'),url=root+file+'?v='+build,attributes={}}={}){
    const element={tagName:style?'LINK':'SCRIPT',rel:style?'stylesheet':'',type:style?'':'module',href:style?url:'',src:style?'':url,isConnected:true,ownerDocument:document,...attributes,
      cloneNode(){return asset(file,{style,url:this.href||this.src,attributes});},replaceWith(replacement){this.isConnected=false;replacements.push(replacement);}};
    return element;
  }
  return {storage,inputs,asset,replacements,events,error:target=>events.error?.({target}),ready:()=>events['lts-health-ready']?.(),flush(){for(const [id,callback] of [...timers]){timers.delete(id);callback();}},get reloads(){return reloads;},get pending(){return timers.size;},location};
}

test('a failed application entry gets one clean reload and cannot loop across documents',()=>{
  const e=environment();e.error(e.asset('src/main.js'));e.error(e.asset('src/main.js'));assert.equal(e.pending,1);e.flush();assert.equal(e.reloads,1);
  assert.equal(e.location.href,root+'#hoje');assert.equal(e.storage.get('synthetic-auth-sentinel'),'preserve');
  const next=environment({storage:e.storage});next.error(next.asset('src/main.js'));next.flush();assert.equal(next.reloads,0);
  next.ready();assert.deepEqual([...e.storage],[['synthetic-auth-sentinel','preserve']]);
});
test('finished startup and unfinished form input prevent automatic navigation',()=>{
  for(const when of ['before','after']){
    const e=environment();if(when==='before')e.ready();e.error(e.asset('src/main.js'));if(when==='after')e.ready();e.flush();assert.equal(e.reloads,0);
  }
  const input={value:'invented-unsaved-input'};const e=environment({inputs:[input]});e.error(e.asset('src/main.js'));e.flush();assert.equal(e.reloads,0);assert.equal(input.value,'invented-unsaved-input');
  const later=environment({inputs:[{value:''}]});later.error(later.asset('src/main.js'));later.inputs[0].value='invented-later-input';later.flush();assert.equal(later.reloads,0);
});
test('credential-bearing callbacks and unavailable retry storage keep the manual fallback',()=>{
  for(const name of ['code','state','token','token_hash','access_token','refresh_token','error'])for(const kind of ['query','hash']){
    const e=environment(kind==='query'?{query:'?'+name+'=invented-private-marker'}:{hash:'#'+name+'=invented-private-marker'});
    e.error(e.asset('src/main.js'));e.flush();assert.equal(e.reloads,0);
  }
  const e=environment({storageDenied:true});e.error(e.asset('src/main.js'));e.flush();assert.equal(e.reloads,0);
});
test('a public stylesheet is retried once without navigation, lost input or changed integrity',()=>{
  const e=environment({inputs:[{value:'invented-unsaved-input'}]});e.ready();
  const original=e.asset('model-convergence-shell.css',{url:root+'model-convergence-shell.css?v='+build+'&fix=synthetic',attributes:{integrity:'synthetic-integrity',crossOrigin:'anonymous',nonce:'synthetic-nonce'}});
  e.error(original);e.error(original);e.flush();assert.equal(e.replacements.length,1);assert.equal(e.reloads,0);
  const replacement=e.replacements[0],url=new URL(replacement.href);assert.equal(url.origin,new URL(root).origin);assert.equal(url.pathname,new URL(original.href).pathname);
  assert.equal(url.searchParams.get('v'),build);assert.equal(url.searchParams.get('fix'),'synthetic');assert.equal(url.searchParams.get('health_asset_retry'),'1');
  for(const name of ['integrity','crossOrigin','nonce'])assert.equal(replacement[name],original[name]);
  e.error(replacement);e.flush();assert.equal(e.replacements.length,1);assert.equal(e.inputs[0].value,'invented-unsaved-input');
});
test('optional module recovery is bounded and never reloads an open application',()=>{
  const e=environment();e.ready();
  for(const file of ['src/shell-accessibility.js','src/backup-traceability.js','src/product-layout-runtime.js','app-install.js','styles.css'])e.error(e.asset(file));
  e.flush();assert.equal(e.replacements.length,4);assert.equal(e.reloads,0);
  for(const element of e.replacements)e.error(element);e.flush();assert.equal(e.replacements.length,4);
});
test('other origins, private paths, queries, non-module errors and detached nodes are untouched',()=>{
  for(const [file,options] of [
    ['styles.css',{url:'https://other.invalid/styles.css?v='+build}],
    ['styles.css',{url:root+'private/styles.css?v='+build}],
    ['styles.css',{url:root+'styles.css?v='+build+'&access_token=invented'}],
    ['styles.css',{url:root+'styles.css?v=other-build'}],
    ['src/unknown.js',{}],['src/main.js',{attributes:{type:'text/javascript'}}],
    ['styles.css',{attributes:{isConnected:false}}],['styles.css',{attributes:{rel:'icon'}}]
  ]){
    const e=environment();e.error(e.asset(file,options));e.flush();assert.equal(e.replacements.length,0,file);assert.equal(e.reloads,0,file);
  }
  const e=environment();e.error({tagName:'WINDOW'});e.error(null);e.flush();assert.equal(e.pending,0);
});
