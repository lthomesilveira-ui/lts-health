import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {GOOGLE_HEALTH_NUTRITION_SCOPE as scope,GOOGLE_HEALTH_SOURCE_FAMILY as family,
  readGoogleHealthHydration as read,hydrationReadParameters,GoogleHealthReadError} from '../supabase/functions/_shared/google-health-reader.mjs';

// Entirely invented fixtures. No account credentials, live Google calls or storage.
const options={accessToken:'synthetic-token-only',grantedScopes:scope,from:'2030-02-11',to:'2030-02-12'};
const identity={name:'users/me/identity',healthUserId:'synthetic-user'};
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json',...headers}});
const point=(id='water-0001',ml=321)=>({
  name:`users/synthetic-user/dataTypes/hydration-log/dataPoints/${id}`,
  dataSource:{platform:'GOOGLE_WEB_API',application:{googleWebClientId:'synthetic-client.apps.googleusercontent.com'}},
  hydrationLog:{interval:{startTime:'2030-02-11T15:00:00Z',endTime:'2030-02-11T15:00:00Z',startUtcOffset:'-10800s',endUtcOffset:'-10800s'},amountConsumed:{milliliters:ml,userProvidedUnit:'MILLILITER'}}
});
function transport(pages,{identityResponse=identity}={}){
  const calls=[];
  const fetcher=async(url,request)=>{
    calls.push({url:new URL(url),request});
    if(calls.length===1)return identityResponse instanceof Response?identityResponse:json(identityResponse);
    const p=pages.shift();if(p===undefined)throw Error('unexpected synthetic request');
    return p instanceof Response?p:json(p);
  };
  return {fetcher,calls};
}
async function errorCode(code,run){
  await assert.rejects(run,error=>error instanceof GoogleHealthReadError&&error.code===code&&error.message===code);
}

test('complete pagination preserves identities, raw volume, interval and source without aggregation',async()=>{
  const a=point(),b=point('water-0002'),c=point('water-0003',0),raw=structuredClone(a);
  b.dataSource.application.googleWebClientId='another-synthetic-client.apps.googleusercontent.com';
  const t=transport([{dataPoints:[a],nextPageToken:'page/2?opaque=1'},{dataPoints:[a,b],nextPageToken:'third'},{dataPoints:[c]}]);
  const out=await read({...options,fetcher:t.fetcher});
  assert.equal(out.complete,true);assert.equal(out.pages,3);assert.equal(out.received_count,4);assert.equal(out.unique_count,3);
  assert.equal(out.source_family,family);assert.equal(out.canonical_eligible,false);
  assert.deepEqual(out.records[0].raw,raw);assert.deepEqual(a,raw);
  assert.equal(out.records[0].local_day,'2030-02-11');assert.equal(out.records[2].milliliters,0);
  assert.equal(out.records[2].unit,'mL');assert.ok(out.records.every(p=>p.canonical_eligible===false));
  assert.ok(out.records.every(p=>p.held_reasons.includes('source_mapping_unverified')));
  assert.equal(Object.hasOwn(out,'water_ml_total'),false);assert.equal(Object.hasOwn(out,'daily_total'),false);
  for(const {url,request} of t.calls){
    assert.equal(url.origin,'https://health.googleapis.com');assert.equal(request.method,'GET');assert.equal(request.redirect,'error');
    assert.equal(request.headers.Authorization,'Bearer synthetic-token-only');assert.equal(request.body,undefined);assert.ok(request.signal instanceof AbortSignal);
    assert.equal(url.searchParams.has('access_token'),false);
  }
  assert.equal(t.calls[0].url.pathname,'/v4/users/me/identity');
  assert.equal(t.calls[1].url.searchParams.get('filter'),'hydration_log.interval.civil_start_time >= "2030-02-11" AND hydration_log.interval.civil_start_time < "2030-02-12"');
  for(const call of t.calls.slice(1))assert.equal(call.url.searchParams.get('dataSourceFamily'),family);
  assert.equal(t.calls[2].url.searchParams.get('pageToken'),'page/2?opaque=1');
});

test('stable repeated identity ignores JSON key order but not a changed observation',async()=>{
  const p=point(),reordered={hydrationLog:p.hydrationLog,dataSource:p.dataSource,name:p.name};
  const good=transport([{dataPoints:[p],nextPageToken:'two'},{dataPoints:[reordered]}]);
  assert.equal((await read({...options,fetcher:good.fetcher})).unique_count,1);
  const bad=transport([{dataPoints:[p],nextPageToken:'two'},{dataPoints:[point('water-0001',322)]}]);
  await errorCode('duplicate_identity_conflict',()=>read({...options,fetcher:bad.fetcher}));
});

for(const grantedScopes of ['',scope.replace('googlehealth.','health.'),scope.replace('.readonly','.writeonly')]){
  test(`missing real Google Health read scope is refused before network (${grantedScopes||'empty'})`,async()=>{
    let calls=0;await errorCode('read_scope_required',()=>read({...options,grantedScopes,fetcher:async()=>{calls++;}}));assert.equal(calls,0);
  });
}
for(const [from,to] of [['2030-02-30','2030-03-01'],['2030-02-11','2030-02-11'],['2030-02-12','2030-02-11'],['2030-02-11','2030-03-15'],['2030-02-11" OR true','2030-02-12']]){
  test(`invalid civil date window is refused (${from},${to})`,async()=>{
    let calls=0;await errorCode('invalid_date_window',()=>read({...options,from,to,fetcher:async()=>{calls++;}}));assert.equal(calls,0);
  });
}
test('a 31-day boundary is accepted and a partial or invalid access token never reaches a transport',async()=>{
  assert.equal(hydrationReadParameters('2030-01-01','2030-02-01').pageSize,'1000');
  for(const accessToken of ['',null,'contains whitespace','token\r\ninjected','x'.repeat(8193)]){
    await errorCode('invalid_access_token',()=>read({...options,accessToken,fetcher:async()=>assert.fail('network not allowed')}));
  }
});

test('Google profile verification precedes hydration and account change fails closed',async()=>{
  for(const identityResponse of [{}, {name:'users/me/identity',healthUserId:''}, {name:'users/wrong/identity',healthUserId:'synthetic-user'}]){
    const t=transport([],{identityResponse});await errorCode('identity_not_verified',()=>read({...options,fetcher:t.fetcher}));assert.equal(t.calls.length,1);
  }
  const t=transport([]);await errorCode('account_changed',()=>read({...options,expectedHealthUserId:'another-user',fetcher:t.fetcher}));assert.equal(t.calls.length,1);
});
test('a returned resource from another account is refused',async()=>{
  const p=point();p.name=p.name.replace('synthetic-user','another-user');const t=transport([{dataPoints:[p]}]);
  await errorCode('record_account_mismatch',()=>read({...options,fetcher:t.fetcher}));
});
test('missing source and missing offsets are held; an origin is never inferred from matching values',async()=>{
  const p=point();delete p.dataSource;delete p.hydrationLog.interval.startUtcOffset;
  const t=transport([{dataPoints:[p]}]),out=await read({...options,fetcher:t.fetcher}),row=out.records[0];
  assert.equal(row.local_day,null);assert.equal(row.source,null);assert.equal(row.milliliters,321);
  assert.deepEqual(row.held_reasons,['missing_offset','source_identity_missing','source_mapping_unverified']);
  assert.ok(!JSON.stringify(out).includes('MyFitnessPal'));
});
test('physical UTC midnight is assigned only using its original offset, retaining nanosecond precision',async()=>{
  const p=point();p.hydrationLog.interval.startTime='2030-02-12T02:59:59.999999999Z';p.hydrationLog.interval.endTime=p.hydrationLog.interval.startTime;
  const t=transport([{dataPoints:[p]}]);assert.equal((await read({...options,fetcher:t.fetcher})).records[0].local_day,'2030-02-11');
});
test('original civil dates must agree with physical time and the source offset',async()=>{
  const p=point();p.hydrationLog.interval.civilStartTime={date:{year:2030,month:2,day:12}};
  const t=transport([{dataPoints:[p]}]);await errorCode('inconsistent_civil_date',()=>read({...options,fetcher:t.fetcher}));
});
test('records outside the requested exclusive end are not silently imported',async()=>{
  const p=point();p.hydrationLog.interval.startTime=p.hydrationLog.interval.endTime='2030-02-12T15:00:00Z';
  const t=transport([{dataPoints:[p]}]);await errorCode('record_outside_window',()=>read({...options,fetcher:t.fetcher}));
});
for(const [start,end] of [['invalid','2030-02-11T15:00:00Z'],['2030-02-30T15:00:00Z','2030-03-01T15:00:00Z'],['2030-02-11T25:00:00Z','2030-02-12T15:00:00Z'],['2030-02-11T15:00:00.000000002Z','2030-02-11T15:00:00.000000001Z']]){
  test('invalid or reversed source interval is refused: '+start,async()=>{
    const p=point();p.hydrationLog.interval.startTime=start;p.hydrationLog.interval.endTime=end;
    const t=transport([{dataPoints:[p]}]);await errorCode('invalid_interval',()=>read({...options,fetcher:t.fetcher}));
  });
}
for(const milliliters of [null,'321',-1,100001,Infinity]){
  test('invalid or absent volume is never converted to zero: '+milliliters,async()=>{
    const t=transport([{dataPoints:[point('water-0001',milliliters)]}]);await errorCode('invalid_volume',()=>read({...options,fetcher:t.fetcher}));
  });
}
test('empty result is distinct from explicit zero and from a malformed response',async()=>{
  const t=transport([{dataPoints:[]}]),out=await read({...options,fetcher:t.fetcher});
  assert.equal(out.status,'empty');assert.equal(out.complete,true);assert.deepEqual(out.records,[]);assert.equal(out.unique_count,0);
  for(const payload of [{},{dataPoints:null},[],{dataPoints:{}}]){
    const broken=transport([json(payload)]);await errorCode('invalid_response',()=>read({...options,fetcher:broken.fetcher}));
  }
});
test('HTML, malformed JSON and invalid UTF-8 never appear as a successful empty read',async()=>{
  for(const response of [new Response('<html>error</html>'),new Response('{',{headers:{'Content-Type':'application/json'}}),new Response(Uint8Array.from([255]),{headers:{'Content-Type':'application/json'}})]){
    const t=transport([response]);await errorCode('invalid_response',()=>read({...options,fetcher:t.fetcher}));
  }
});
test('repeated and unsafe pagination tokens stop the complete read without a partial result',async()=>{
  for(const token of ['again','line\nbreak','x'.repeat(4097),2,null]){
    const pages=token==='again'?[{dataPoints:[],nextPageToken:token},{dataPoints:[],nextPageToken:token}]:[{dataPoints:[],nextPageToken:token}];
    const t=transport(pages);await errorCode('invalid_pagination',()=>read({...options,fetcher:t.fetcher}));
  }
});
test('page and record budgets terminate unbounded source results',async()=>{
  const t=transport(Array.from({length:32},(_,i)=>({dataPoints:[],nextPageToken:'page-'+i})));
  await errorCode('pagination_limit',()=>read({...options,fetcher:t.fetcher}));assert.equal(t.calls.length,33);
  const many=transport([{dataPoints:Array(10001).fill({})}]);await errorCode('record_limit',()=>read({...options,fetcher:many.fetcher}));
});
test('streaming per-page size limit cancels an oversized body',async()=>{
  let cancelled=false;
  const body=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(700000));},cancel(){cancelled=true;}});
  const t=transport([new Response(body,{headers:{'Content-Type':'application/json'}})]);
  await errorCode('response_too_large',()=>read({...options,fetcher:t.fetcher}));assert.equal(cancelled,true);
});
test('total response byte budget applies across pages, including unused response fields',async()=>{
  const t=transport(Array.from({length:6},(_,i)=>({dataPoints:[],padding:'x'.repeat(1800000),nextPageToken:'page-'+i})));
  await errorCode('response_too_large',()=>read({...options,fetcher:t.fetcher}));assert.equal(t.calls.length,7);
});
test('provider failures and rate limits expose only fixed safe codes',async()=>{
  const cases=[[401,'authorization_expired'],[403,'permission_denied'],[429,'rate_limited'],[400,'provider_request_rejected'],[503,'provider_unavailable']];
  for(const [status,code] of cases){
    const t=transport([json({message:'sensitive synthetic body and token MUST NOT escape'},status,{'Retry-After':'9999'})]);
    await assert.rejects(()=>read({...options,fetcher:t.fetcher}),e=>{
      assert.equal(e.code,code);assert.equal(e.message,code);assert.ok(!JSON.stringify(e).includes('MUST NOT escape'));
      if(status===429)assert.equal(e.retryAfterSeconds,3600);return true;
    });
  }
  await errorCode('network_error',()=>read({...options,fetcher:async()=>{throw Error('untrusted token body');}}));
});

async function server(handler){
  const s=createServer(handler);s.listen(0,'127.0.0.1');await once(s,'listening');
  return {origin:`http://127.0.0.1:${s.address().port}`,close:()=>new Promise(resolve=>s.close(resolve))};
}
test('real HTTP transport exercises JSON streaming and opaque page tokens with GET only',async()=>{
  const received=[];
  const s=await server((req,res)=>{
    const url=new URL(req.url,'http://synthetic.test');received.push({method:req.method,path:url.pathname,token:url.searchParams.get('pageToken')});
    assert.equal(req.headers.authorization,'Bearer synthetic-token-only');res.setHeader('Content-Type','application/json');
    const body=url.pathname.endsWith('/identity')?identity:{dataPoints:[point(url.searchParams.has('pageToken')?'water-0002':'water-0001')],...(url.searchParams.has('pageToken')?{}:{nextPageToken:'opaque/?&=two'})};
    const text=JSON.stringify(body);res.write(text.slice(0,17));res.end(text.slice(17));
  });
  try{
    const fetcher=(url,init)=>fetch(new URL(new URL(url).pathname+new URL(url).search,s.origin),init);
    const out=await read({...options,fetcher});assert.equal(out.unique_count,2);assert.equal(out.pages,2);
    assert.ok(received.every(x=>x.method==='GET'));assert.equal(received[2].token,'opaque/?&=two');
  }finally{await s.close();}
});
test('real HTTP redirects cannot send the authorization token to another destination',async()=>{
  let destinationCalls=0;
  const target=await server((req,res)=>{destinationCalls++;res.end('{}');});
  const redirect=await server((req,res)=>{res.writeHead(302,{Location:target.origin+'/capture'});res.end();});
  try{
    await errorCode('network_error',()=>read({...options,fetcher:(url,init)=>fetch(redirect.origin,init)}));
    assert.equal(destinationCalls,0);
  }finally{await redirect.close();await target.close();}
});
