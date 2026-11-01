import assert from 'node:assert/strict';
// Exercise the real transport with a disposable in-memory client. No browser,
// server, health record or external service is used.
globalThis.location={search:''};
let mode='review',authCallback,session={user:{id:'synthetic-owner'}};
const calls=[];
const client={
 auth:{getSession:async()=>({data:{session}}),onAuthStateChange(cb){authCallback=cb;return{data:{subscription:{unsubscribe(){}}}}}},
 storage:{from(bucket){return{async upload(path,file,options){calls.push({kind:'storage',bucket,path,file:file.name,options});return{error:mode==='storage-failure'?new Error('Invented storage failure'):null}}}}},
 functions:{async invoke(name,args){calls.push({kind:'inspect',name,args});return mode==='inspect-failure'||mode==='status-failure'?{error:new Error('Invented inspection failure')}:{data:{upload_status:'review_required',preview:{status:'needs_specialized_parser',detected_format:'pdf',sample:{mustNotPersist:'invented sample'}},raw:'invented internal response'},error:null}}},
 from(table){return{
  insert(payload){calls.push({kind:'metadata',table,payload});return{select(){return{async single(){return mode==='metadata-failure'?{data:null,error:new Error('Invented metadata failure')}:{data:{id:'synthetic-upload'},error:null}}}}}},
  update(payload){calls.push({kind:'status',table,payload});return{async eq(key,value){calls.push({kind:'filter',key,value});return{error:mode==='status-failure'?new Error('Invented status failure'):null}}}}
 }}
};
globalThis.window={supabase:{createClient:()=>client}};
const {state,uploadFile,subscribeAuth}=await import('./src/core.js');
const file={name:'arquivo-sintetico.pdf',type:'application/pdf',size:32};
state.session=session;
const received=await uploadFile(file,'fleury');
assert.equal(received.upload_status,'review_required');
assert.deepEqual(received.preview,{status:'needs_specialized_parser',detected_format:'pdf'});
assert.equal(Object.hasOwn(received,'raw'),false,'raw response is not retained in UI state');
assert.deepEqual(calls.map(c=>c.kind),['storage','metadata','inspect']);
assert.equal(calls[0].bucket,'health-inbox');assert.ok(calls[0].path.startsWith('synthetic-owner/'));
assert.equal(calls[1].payload.user_id,'synthetic-owner');assert.equal(calls[2].name,'health-inspect-upload');
for(const scenario of ['storage-failure','metadata-failure','inspect-failure','status-failure']){
 mode=scenario;calls.length=0;
 if(mode==='storage-failure'){await assert.rejects(()=>uploadFile(file,'fleury'),/Invented storage failure/);assert.equal(calls.length,1)}
 else if(mode==='metadata-failure'){
  await assert.rejects(()=>uploadFile(file,'fleury'),error=>error.originalPreserved===true&&error.storagePath.startsWith('synthetic-owner/'));
  assert.deepEqual(calls.map(c=>c.kind),['storage','metadata']);
 }else{
  const result=await uploadFile(file,'fleury');
  assert.equal(result.received,true);assert.equal(result.processing,mode==='status-failure'?'status_unknown':'review_required');
  assert.equal(calls.find(c=>c.kind==='status').payload.status,'review_required');
  assert.deepEqual(calls.find(c=>c.kind==='filter'),{kind:'filter',key:'id',value:'synthetic-upload'});
 }
}
subscribeAuth(()=>{});
state.ui.uploadFeedback={filename:file.name,message:'invented receipt'};
authCallback('TOKEN_REFRESHED',session);assert.ok(state.ui.uploadFeedback,'same owner refresh retains receipt');
authCallback('SIGNED_IN',{user:{id:'other-synthetic-owner'}});assert.equal(state.ui.uploadFeedback,null,'owner switch clears previous receipt');
state.ui.uploadFeedback={filename:file.name};authCallback('SIGNED_OUT',null);assert.equal(state.ui.uploadFeedback,null);
calls.length=0;session=null;state.session=null;
await assert.rejects(()=>uploadFile(file,'fleury'),/Sessão expirada/);assert.equal(calls.length,0);
console.log('Upload transport: original preservation, bounded receipt, owner/auth guards and failure recovery passed in memory.');
