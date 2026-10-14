import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/preview-readonly.js',import.meta.url),'utf8');
let writes=0,invocations=0,reads=0,signins=0,signouts=0,subscriptions=0;
const result={data:[{value:7}],error:null};
const query={select(){assert.equal(this,query);return this;},eq(){assert.equal(this,query);return this;},is(){return this;},range(){return this;},order(){return this;},maybeSingle(){return Promise.resolve({data:{value:7},error:null});},then(resolve,reject){assert.equal(this,query,'then receiver is preserved');reads++;return Promise.resolve(result).then(resolve,reject);}};
for(const name of ['insert','update','upsert','delete'])query[name]=()=>{writes++;return query;};
const bucket={download(){reads++;return Promise.resolve({data:'synthetic file',error:null});}};
for(const name of ['upload','update','uploadToSignedUrl','createSignedUploadUrl','remove','move','copy'])bucket[name]=()=>{writes++;return Promise.resolve({error:null});};
const storage={from(){return bucket;},listBuckets(){reads++;return Promise.resolve({data:[]});}};
for(const name of ['createBucket','updateBucket','emptyBucket','deleteBucket'])storage[name]=()=>{writes++;};
const auth={getSession:async()=>({data:{session:{user:{id:'synthetic-user'}}}}),signInWithPassword:async()=>{signins++;return {data:{session:{user:{id:'synthetic-user'}}}};},signOut:async()=>{signouts++;return {error:null};},onAuthStateChange(){subscriptions++;return {data:{subscription:{unsubscribe(){}}}};}};
const client={auth,from(){return query;},schema(){return {from(){return query;},rpc(){writes++;}};},storage,rpc(){writes++;},functions:{invoke(){invocations++;return Promise.resolve({data:{configured:true,connected:true,last_attempt_at:null},error:null});}}};
Object.defineProperty(client,'accessToken',{get(){throw new Error('Guard must not inspect credentials');}});
const context=vm.createContext({supabase:{createClient(){return client;}},location:{search:''},URLSearchParams});
vm.runInContext(source,context);
const guarded=context.supabase.createClient('synthetic endpoint','synthetic public config');
assert.equal((await guarded.auth.getSession()).data.session.user.id,'synthetic-user');
await guarded.auth.signInWithPassword({email:'fixture@example.test',password:'synthetic-only'});await guarded.auth.signOut();guarded.auth.onAuthStateChange(()=>{});
assert.deepEqual([signins,signouts,subscriptions],[1,1,1]);
assert.deepEqual(await guarded.from('synthetic').select('*').eq('id',1).range(0,9).order('id'),result);
assert.deepEqual(await guarded.schema('public').from('synthetic').select('*'),result);
assert.equal((await guarded.from('synthetic').select().maybeSingle()).data.value,7);
assert.equal((await guarded.storage.from('synthetic').download('fixture.txt')).data,'synthetic file');
const isBlocked=fn=>assert.throws(fn,error=>error.code==='preview_read_only');
for(const method of ['insert','update','upsert','delete']){isBlocked(()=>guarded.from('synthetic')[method]({}));isBlocked(()=>guarded.from('synthetic').select().eq('id',1)[method]({}));}
isBlocked(()=>guarded.rpc('synthetic'));isBlocked(()=>guarded.schema('public').rpc('synthetic'));
for(const method of ['upload','update','uploadToSignedUrl','createSignedUploadUrl','remove','move','copy'])isBlocked(()=>guarded.storage.from('synthetic')[method]('synthetic',{}));
for(const method of ['createBucket','updateBucket','emptyBucket','deleteBucket'])isBlocked(()=>guarded.storage[method]('synthetic'));
for(const action of ['status','sync','start','disconnect'])isBlocked(()=>guarded.functions.invoke('health-polar-connection',{body:{action}}));
isBlocked(()=>guarded.functions.invoke('health-auto-export-connection',{body:{action:'create'}}));
assert.deepEqual([writes,invocations],[0,0],'blocked operations never reach backend methods');assert.ok(reads>=3);
vm.runInContext(source,context);assert.equal(context.supabase.createClient(),guarded,'guard is idempotent');
// Exercise the app's real automatic-sync entry against the synthetic client.
globalThis.location={search:''};globalThis.window={supabase:context.supabase};
const {state}=await import('../src/core.js');state.session={user:{id:'synthetic-user'}};
const {checkPolarConnection}=await import('../src/polar-connection.js');
assert.equal(await checkPolarConnection({syncOnOpen:true}),false);
assert.equal(invocations,0,'app-open Polar pathway is blocked before its first backend call');
const missingSdk=vm.createContext({location:{search:''},URLSearchParams});vm.runInContext(source,missingSdk);
assert.throws(()=>missingSdk.supabase.createClient(),/Não foi possível carregar a prévia/);
const fixture=vm.createContext({location:{search:'?fixture=1'},URLSearchParams});vm.runInContext(source,fixture);assert.equal(fixture.supabase,undefined,'explicit synthetic mode does not create a real client');


// Small DOM double verifies narrow form scope and capture ordering without a browser.
const listeners=new Map(),filters={disabled:false},login={disabled:false},logout={disabled:false};
const formIds=['bodyEntryForm','workoutEntryForm','waterEntryForm','mfpWaterImportForm','personalGoalsForm','uploadForm'];
const forms=formIds.map(id=>({id,controls:[{disabled:false,title:''},{disabled:false,title:''}],note:null,matches(selector){return selector.includes('form#'+id);},querySelector(){return this.note;},querySelectorAll(){return this.controls;},prepend(note){this.note=note;}}));
const actions=[{disabled:false,title:''}];
const document={readyState:'complete',documentElement:{},querySelectorAll(selector){if(selector.startsWith('form#'))return forms;if(selector.startsWith('button[data-polar'))return actions;if(selector==='.refHeading h1')return [];throw new Error('Unexpected broad DOM selection '+selector);},createElement(){return {dataset:{}};},addEventListener(type,handler,options){listeners.set(type,{handler,options});}};
let observer;
const dom=vm.createContext({supabase:{createClient:()=>client},document,location:{search:''},URLSearchParams,MutationObserver:class{constructor(callback){observer=callback;}observe(){}}});
vm.runInContext(source,dom);
for(const form of forms){assert.ok(form.controls.every(control=>control.disabled));assert.match(form.note.textContent,/Prévia somente leitura/);}
assert.equal(actions[0].disabled,true);assert.equal(filters.disabled,false);assert.equal(login.disabled,false);assert.equal(logout.disabled,false);
let stopped=0;const submit=listeners.get('submit');assert.equal(submit.options,true,'capture precedes application save handlers');
for(const form of forms)submit.handler({target:form,preventDefault(){stopped++;},stopImmediatePropagation(){stopped++;}});
assert.equal(stopped,12);submit.handler({target:{matches:()=>false},preventDefault(){throw new Error('Login or filters must not be blocked');}});
forms[0].controls[0].disabled=false;observer();assert.equal(forms[0].controls[0].disabled,true,'re-render cannot re-enable a mutation control');
assert.deepEqual([writes,invocations],[0,0]);
console.log('Preview read-only guard: login/logout/session and chained reads preserved; writes, RPC, storage changes and Polar/functions blocked before backend; six mutation forms disabled with capture protection; filters unaffected.');
