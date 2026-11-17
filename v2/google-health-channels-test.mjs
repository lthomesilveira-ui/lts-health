import assert from 'node:assert/strict';
import {test} from 'node:test';
import {inspectGoogleHealthHydrationChannels as inspect,GOOGLE_HEALTH_NUTRITION_SCOPE as scope,GOOGLE_HEALTH_SOURCE_FAMILY as family} from '../supabase/functions/_shared/google-health-reader.mjs';

const options={accessToken:'invented-access-only',grantedScopes:scope,from:'2030-02-05',to:'2030-02-12',expectedHealthUserId:'invented-user'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const point=(amount=456.25)=>({name:'users/invented-user/dataTypes/hydration-log/dataPoints/water-0001',dataSource:{platform:'GOOGLE_WEB_API',application:{googleWebClientId:'invented-source-secret-marker'}},hydrationLog:{interval:{startTime:'2030-02-11T15:00:00Z',endTime:'2030-02-11T15:01:00Z',startUtcOffset:'-10800s',endUtcOffset:'-10800s'},amountConsumed:{milliliters:amount}}});
function transport(stable={},beta={},identity={name:'users/me/identity',healthUserId:'invented-user'}){
  const calls=[];
  return {calls,fetcher:async(url,init)=>{
    const u=new URL(url);calls.push({url:u,init});
    let body;
    if(u.pathname==='/v4/users/me/identity')body=identity;
    else if(u.pathname==='/v4/users/me/dataTypes/hydration-log/dataPoints')body=stable;
    else if(u.pathname==='/v4beta/users/me/dataTypes/hydration-log/dataPoints')body=beta;
    else throw Error('Unexpected route');
    return body instanceof Response?body:json(body);
  }};
}
const rejects=(code,work)=>assert.rejects(work,e=>e.code===code);

test('both channels use the same owner grant, physical dates and fixed host without exposing source values',async()=>{
  const p=point(),t=transport({}, {dataPoints:[p,p],nextPageToken:'invented-next-page'});
  const result=await inspect({...options,fetcher:t.fetcher});
  assert.deepEqual(result.probes.map(p=>[p.channel,p.positive_observations]),[['v4',0],['v4beta',1]]);
  assert.equal(result.probes[1].source_identified_positive_observations,1);assert.equal(result.probes[1].truncated,true);
  assert.equal(t.calls.length,3);
  for(const call of t.calls){assert.equal(call.url.origin,'https://health.googleapis.com');assert.equal(call.init.redirect,'error');assert.equal(call.init.signal,t.calls[0].init.signal);assert.equal(call.init.headers.Authorization,'Bearer invented-access-only');}
  assert.deepEqual([...t.calls[1].url.searchParams],[...t.calls[2].url.searchParams]);
  assert.equal(t.calls[1].url.searchParams.get('filter'),'hydration_log.interval.civil_start_time >= "2030-02-05" AND hydration_log.interval.civil_start_time < "2030-02-12"');
  assert.equal(t.calls[1].url.searchParams.get('dataSourceFamily'),family);assert.equal(t.calls[1].url.searchParams.get('pageSize'),'100');
  assert.equal(result.canonical_updated,false);assert.equal(result.water_received,false);assert.equal(result.experimental_channel_evaluation,true);
  for(const canary of ['456.25','invented-access-only','invented-user','invented-source-secret-marker','hydrationLog','milliliters'])assert.ok(!JSON.stringify(result).includes(canary));
});
test('zero, absent display unit and missing source/date remain distinct',async()=>{
  const a=point(0),b=point();b.name=b.name.replace('0001','0002');delete b.dataSource;
  const c=point();c.name=c.name.replace('0001','0003');delete c.hydrationLog.interval.startUtcOffset;
  const t=transport({dataPoints:[a,b,c]},{}),result=await inspect({...options,fetcher:t.fetcher});
  assert.equal(result.probes[0].observations,3);assert.equal(result.probes[0].zero_observations,1);
  assert.equal(result.probes[0].positive_observations,1);assert.equal(result.probes[0].undated_observations,1);assert.equal(result.probes[0].source_identified_positive_observations,0);
});
test('rejected beta access is unavailable, not an empty successful comparison',async()=>{
  for(const status of [400,403]){
    const t=transport({dataPoints:[point()]},json({error:'invented-private-provider-text'},status));
    const result=await inspect({...options,fetcher:t.fetcher});
    assert.equal(result.probes[0].positive_observations,1);assert.equal(result.probes[1].status,'unavailable');assert.equal(result.probes[1].observations,undefined);
    assert.ok(!JSON.stringify(result).includes('invented-private-provider-text'));
  }
});
test('identity, scopes and seven-day bounds are checked before either channel',async()=>{
  for(const changes of [{to:'2030-02-13'},{to:'2030-02-05'},{from:'2030-02-30'},{grantedScopes:'invented-wrong-scope'}]){
    const t=transport();await assert.rejects(()=>inspect({...options,...changes,fetcher:t.fetcher}));assert.equal(t.calls.length,0);
  }
  const t=transport({}, {},{name:'users/me/identity',healthUserId:'invented-other-user'});
  await rejects('account_changed',()=>inspect({...options,fetcher:t.fetcher}));assert.equal(t.calls.length,1);
});
test('invalid volume, account, interval, shape and conflicting identity never become no-water results',async()=>{
  const cases=[
    [p=>{p.hydrationLog.amountConsumed.milliliters=-1;},'invalid_volume'],
    [p=>{delete p.hydrationLog.amountConsumed.milliliters;},'invalid_volume'],
    [p=>{p.name=p.name.replace('invented-user','other-user');},'record_account_mismatch'],
    [p=>{p.hydrationLog.interval.startTime='2030-02-13T15:00:00Z';p.hydrationLog.interval.endTime='2030-02-13T15:01:00Z';},'record_outside_window'],
    [p=>{p.hydrationLog.interval.endTime='2030-02-10T15:00:00Z';},'invalid_interval']
  ];
  for(const [mutate,code] of cases){const p=point();mutate(p);const t=transport({}, {dataPoints:[p]});await rejects(code,()=>inspect({...options,fetcher:t.fetcher}));}
  const a=point(),b=point(1),duplicate=transport({}, {dataPoints:[a,b]});await rejects('duplicate_identity_conflict',()=>inspect({...options,fetcher:duplicate.fetcher}));
  for(const [body,code] of [[{dataPoints:null},'invalid_response'],[{dataPoints:[],nextPageToken:null},'invalid_pagination'],[{dataPoints:Array.from({length:101},()=>point())},'record_limit']]){
    const t=transport({},body);await rejects(code,()=>inspect({...options,fetcher:t.fetcher}));
  }
  const auth=transport({},json({},401));await rejects('authorization_expired',()=>inspect({...options,fetcher:auth.fetcher}));
});
test('dates retain real Sao Paulo boundaries across the historical daylight-saving transition',async()=>{
  const optionsForDay={...options,from:'2018-11-04',to:'2018-11-05'};
  const p=point();p.hydrationLog.interval={startTime:'2018-11-04T03:00:00Z',endTime:'2018-11-04T03:01:00Z',startUtcOffset:'-7200s',endUtcOffset:'-7200s'};
  const t=transport({dataPoints:[p]});const result=await inspect({...optionsForDay,fetcher:t.fetcher});
  assert.equal(t.calls[1].url.searchParams.get('filter'),'hydration_log.interval.civil_start_time >= "2018-11-04" AND hydration_log.interval.civil_start_time < "2018-11-05"');
  assert.equal(result.probes[0].first_day,'2018-11-04');
  for(const interval of [
    {startTime:'2018-11-04T02:59:00Z',endTime:'2018-11-04T03:00:00Z',startUtcOffset:'-7200s',endUtcOffset:'-7200s'},
    {startTime:'2018-11-05T02:00:00Z',endTime:'2018-11-05T02:01:00Z',startUtcOffset:'-10800s',endUtcOffset:'-10800s'}
  ]){
    const outside=point();outside.hydrationLog.interval=interval;const invalid=transport({dataPoints:[outside]});
    await rejects('record_outside_window',()=>inspect({...optionsForDay,fetcher:invalid.fetcher}));
  }
});
