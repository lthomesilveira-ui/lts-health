import assert from 'node:assert/strict';
globalThis.location={search:'',assign(){throw new Error('No navigation expected');}};
let calls=[],response={configured:true,connected:true,last_attempt_at:new Date().toISOString()};
const client={functions:{async invoke(name,args){calls.push({name,...args.body});return {data:args.body.action==='sync'?{synced:true}:response,error:null};}}};
globalThis.window={supabase:{createClient:()=>client}};
const {state}=await import('./src/core.js');
const {checkPolarConnection,resetPolarConnection}=await import('./src/polar-connection.js');
const {checkAutoExportConnection,resetAutoExportConnection}=await import('./src/health-auto-export-connection.js');
const {actOnGoogleHealth,checkGoogleHealthConnection,renderGoogleHealthConnection,resetGoogleHealthConnection,googleHealthReadWindow}=await import('./src/google-health-connection.js');
await checkPolarConnection({syncOnOpen:true});await checkAutoExportConnection();assert.equal(calls.length,0,'absent owner does not call integrations');
state.session={user:{id:'synthetic-owner'}};
await checkPolarConnection();assert.deepEqual(calls.map(c=>c.action),['status'],'manual check is read-only');
calls=[];await checkPolarConnection({syncOnOpen:true});assert.deepEqual(calls.map(c=>c.action),['status'],'recent connection does not sync again');
calls=[];response={configured:true,connected:false};await checkPolarConnection({syncOnOpen:true});assert.deepEqual(calls.map(c=>c.action),['status'],'disconnected account never initiates access or sync');
calls=[];response={configured:true,connected:true,last_attempt_at:'2000-01-01T00:00:00Z'};await checkPolarConnection({syncOnOpen:true});assert.deepEqual(calls.map(c=>c.action),['status','sync','status']);assert.equal(calls[1].trigger,'app_open','existing production refresh behavior retained, not expanded');
calls=[];response={configured:false,received:false};await checkAutoExportConnection();assert.deepEqual(calls.map(c=>c.action),['status'],'receiver check never creates or rotates a credential');
resetPolarConnection();resetAutoExportConnection();state.session=null;calls=[];await checkPolarConnection({syncOnOpen:true});await checkAutoExportConnection();assert.equal(calls.length,0);
console.log('Production integration status reads, absent-owner and disconnected boundaries, existing bounded Polar refresh and no implicit credential creation passed.');

const googleCalls=[];
const redirects=[];
globalThis.location.assign=url=>redirects.push(url);
const sessionValues=new Map();
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{
  setItem:(key,value)=>sessionValues.set(key,value),
  getItem:key=>sessionValues.get(key)??null,
  removeItem:key=>sessionValues.delete(key)
}});
let status={configured:false,connected:false};
let authorizationUrl;
let afterStatus=null;
client.functions.invoke=async(name,{body})=>{
  assert.equal(name,'health-google-connection');
  googleCalls.push(body);
  if(body.action==='status'){
    if(afterStatus)await afterStatus;
    return {data:{...status},error:null};
  }
  if(body.action==='authorize')return {data:{authorization_url:authorizationUrl},error:null};
  if(body.action==='read'){
    assert.equal((Date.parse(body.to)-Date.parse(body.from))/86400000,30);
    status={...status,last_attempt_at:'2001-05-04T19:00:00Z',last_read_at:'2001-05-04T19:00:01Z'};
    return {data:{read:true,observations:1,empty:false,canonical_updated:false},error:null};
  }
  throw Error('Unexpected Google action');
};
await checkGoogleHealthConnection({initialRead:true});
assert.deepEqual(googleCalls,[]);
assert.equal(renderGoogleHealthConnection(),'');
state.session={user:{id:'synthetic-owner'}};
await checkGoogleHealthConnection({initialRead:true});
assert.doesNotMatch(renderGoogleHealthConnection(),/Conectar Google Health/);
status={configured:true,connected:false};
await checkGoogleHealthConnection({initialRead:true});
assert.match(renderGoogleHealthConnection(),/Conectar Google Health/);
assert.deepEqual(googleCalls.map(c=>c.action),['status','status']);
status={configured:true,connected:true};
await checkGoogleHealthConnection({initialRead:true});
assert.deepEqual(googleCalls.map(c=>c.action),['status','status','status'],'a connected account cannot read on ordinary navigation');
status={configured:true,connected:false};
await checkGoogleHealthConnection();
const legitimateUrl=new URL('https://accounts.google.com/o/oauth2/v2/auth');
legitimateUrl.search=new URLSearchParams({
  redirect_uri:'https://plztdqyuqcjohiimudnr.supabase.co/functions/v1/health-google-callback',
  scope:'https://www.googleapis.com/auth/googlehealth.nutrition.readonly',
  code_challenge_method:'S256',response_type:'code'
});
authorizationUrl=legitimateUrl.href.replace('accounts.google.com','accounts.example.invalid');
await actOnGoogleHealth('authorize');
assert.deepEqual(redirects,[]);
authorizationUrl=legitimateUrl.href+'&scope=additional-access';
await actOnGoogleHealth('authorize');
assert.deepEqual(redirects,[]);
authorizationUrl=legitimateUrl.href;
await actOnGoogleHealth('authorize');
assert.deepEqual(redirects,[legitimateUrl.href]);
status={configured:true,connected:true};
googleCalls.length=0;
await Promise.all([checkGoogleHealthConnection({initialRead:true}),checkGoogleHealthConnection({initialRead:true})]);
assert.deepEqual(googleCalls.map(c=>c.action),['status','read','status']);
assert.match(renderGoogleHealthConnection(),/1 registro de água para conferência de origem/);
await checkGoogleHealthConnection({initialRead:true});
assert.deepEqual(googleCalls.map(c=>c.action),['status','read','status','status']);
assert.equal(sessionValues.size,0,'only the tab that initiated authorization can make a first read on return');

status={configured:true,connected:true};
let resolveStatus;
afterStatus=new Promise(resolve=>{resolveStatus=resolve;});
const staleCheck=checkGoogleHealthConnection({initialRead:true});
await Promise.resolve();
resetGoogleHealthConnection();
state.session=null;
resolveStatus();
await staleCheck;
assert.equal(renderGoogleHealthConnection(),'');
assert.deepEqual(googleCalls.map(c=>c.action),['status','read','status','status','status']);
console.log('Google onboarding: private status, official read-only redirect, one bounded initial water check, and stale session isolation passed.');

// Independent calendar expectations exercise São Paulo midnight, the year
// boundary and leap day. The provider's upper bound is exclusive.
for (const [instant, expected] of [
  ['2030-02-11T16:00:00Z', {from:'2030-01-13',to:'2030-02-12',lastDay:'2030-02-11'}],
  ['2027-01-01T02:30:00Z', {from:'2026-12-02',to:'2027-01-01',lastDay:'2026-12-31'}],
  ['2027-01-01T03:00:00Z', {from:'2026-12-03',to:'2027-01-02',lastDay:'2027-01-01'}],
  ['2028-03-01T02:00:00Z', {from:'2028-01-31',to:'2028-03-01',lastDay:'2028-02-29'}]
]) assert.deepEqual(googleHealthReadWindow(new Date(instant)), expected);
const {readGoogleHealthHydration,GOOGLE_HEALTH_NUTRITION_SCOPE}=await import('../supabase/functions/_shared/google-health-reader.mjs');
const window=googleHealthReadWindow(new Date('2030-02-11T16:00:00Z'));
const todayRecord={name:'users/synthetic-user/dataTypes/hydration-log/dataPoints/water-today',dataSource:{application:{googleWebClientId:'synthetic-source.apps.googleusercontent.com'}},hydrationLog:{interval:{startTime:'2030-02-11T15:00:00Z',endTime:'2030-02-11T15:00:00Z',startUtcOffset:'-10800s',endUtcOffset:'-10800s'},amountConsumed:{milliliters:321}}};
const readToday=async to=>readGoogleHealthHydration({...window,to,accessToken:'synthetic-read-only',grantedScopes:GOOGLE_HEALTH_NUTRITION_SCOPE,fetcher:async url=>new Response(JSON.stringify(new URL(url).pathname.endsWith('/identity')?{name:'users/me/identity',healthUserId:'synthetic-user'}:{dataPoints:[todayRecord]}),{headers:{'Content-Type':'application/json'}})});
assert.equal((await readToday(window.to)).unique_count,1,'a current-day provider record is accepted by the actual reader');
await assert.rejects(()=>readToday(window.lastDay),e=>e.code==='record_outside_window','the former request excluded precisely this current-day record');
console.log('Manual Google water read includes today in 30 São Paulo civil days, including midnight/year/leap boundaries; previous exclusion reproduced.');
