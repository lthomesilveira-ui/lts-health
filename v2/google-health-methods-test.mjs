import assert from 'node:assert/strict';
import {test} from 'node:test';
import {inspectGoogleHealthHydrationMethods as inspect,GOOGLE_HEALTH_NUTRITION_SCOPE as scope,GOOGLE_HEALTH_SOURCE_FAMILY as family} from '../supabase/functions/_shared/google-health-reader.mjs';

const options={accessToken:'invented-access-only',grantedScopes:scope,from:'2030-02-05',to:'2030-02-12',expectedHealthUserId:'invented-user'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const civil=day=>({date:{year:2030,month:2,day},time:{hours:0}});
const water=()=>({dataPointName:'users/invented-user/dataTypes/hydration-log/dataPoints/water-0001',hydrationLog:{interval:{startTime:'2030-02-11T15:00:00Z',endTime:'2030-02-11T15:00:00Z',startUtcOffset:'-10800s',endUtcOffset:'-10800s'},amountConsumed:{milliliters:456}}});
const bucket=(hydration=true)=>({civilStartTime:civil(11),civilEndTime:civil(12),...(hydration?{hydrationLog:{amountConsumed:{millilitersSum:789}}}:{})});
function transport(reconciled={},daily={}){
  const calls=[];
  return {calls,fetcher:async(url,init)=>{
    calls.push({url:new URL(url),init});
    const value=calls.length===1?{name:'users/me/identity',healthUserId:'invented-user'}:calls.length===2?reconciled:daily;
    if(calls.length>3)throw Error('Unexpected provider request');
    return value instanceof Response?value:json(value);
  }};
}
const rejects=(code,work)=>assert.rejects(work,e=>e.code===code);

test('alternative reads use documented GET reconciliation and POST daily rollup with bounded civil dates and all-sources',async()=>{
  const point=water(),t=transport({dataPoints:[point,point],nextPageToken:'not-followed'},{rollupDataPoints:[bucket()]});
  const out=await inspect({...options,fetcher:t.fetcher});
  assert.equal(t.calls.length,3);assert.deepEqual(out.probes.map(p=>p.observations),[1,1]);
  assert.deepEqual(out.probes.map(p=>p.recent_observations),[1,1]);assert.equal(out.probes[0].truncated,true);
  assert.equal(t.calls[1].url.pathname,'/v4/users/me/dataTypes/hydration-log/dataPoints:reconcile');
  assert.equal(t.calls[1].init.method,'GET');assert.equal(t.calls[1].url.searchParams.get('pageSize'),'25');
  assert.equal(t.calls[1].url.searchParams.get('dataSourceFamily'),family);
  assert.equal(t.calls[2].url.pathname,'/v4/users/me/dataTypes/hydration-log/dataPoints:dailyRollUp');
  assert.equal(t.calls[2].init.method,'POST');assert.equal(t.calls[2].init.headers['Content-Type'],'application/json');
  assert.deepEqual(JSON.parse(t.calls[2].init.body),{range:{start:{date:{year:2030,month:2,day:5},time:{hours:0,minutes:0,seconds:0,nanos:0}},end:{date:{year:2030,month:2,day:12},time:{hours:0,minutes:0,seconds:0,nanos:0}}},windowSizeDays:1,pageSize:7,dataSourceFamily:family});
  assert.ok(t.calls.every(c=>c.init.signal===t.calls[0].init.signal&&c.init.redirect==='error'));
  assert.equal(out.canonical_updated,false);assert.equal(out.water_received,false);
  for(const privateValue of ['456','789','water-0001','invented-user','invented-access-only','milliliters','hydrationLog'])assert.ok(!JSON.stringify(out).includes(privateValue));
});

test('daily buckets with no water payload remain absent and zero-valued payloads remain distinct',async()=>{
  const empty=bucket(false),zero=bucket();zero.hydrationLog.amountConsumed.millilitersSum=0;
  for(const [payload,observations,emptyIntervals] of [[{},0,0],[{rollupDataPoints:[empty]},0,1],[{rollupDataPoints:[zero]},1,0]]){
    const t=transport({},payload),out=await inspect({...options,fetcher:t.fetcher});
    assert.equal(out.probes[1].observations,observations);assert.equal(out.probes[1].empty_intervals,emptyIntervals);
  }
  const anonymous=water();delete anonymous.dataPointName;delete anonymous.hydrationLog.interval.startUtcOffset;
  const t=transport({dataPoints:[anonymous]},{}),out=await inspect({...options,fetcher:t.fetcher});
  assert.equal(out.probes[0].undated_observations,1);assert.equal(out.probes[0].recent_observations,0);
});

test('a rejected method is unavailable rather than empty and does not hide the other method',async()=>{
  for(const status of [400,403]){
    const t=transport(json({error:{message:'invented-private-provider-text'}},status),{rollupDataPoints:[bucket()]});
    const out=await inspect({...options,fetcher:t.fetcher});
    assert.equal(out.probes[0].status,'unavailable');assert.equal(out.probes[0].observations,undefined);
    assert.equal(out.probes[1].observations,1);assert.ok(!JSON.stringify(out).includes('invented-private-provider-text'));
  }
});

test('account and grant mismatches stop before alternative methods and a foreign point cannot be counted',async()=>{
  for(const override of [{expectedHealthUserId:'foreign-user'},{grantedScopes:''}]){
    const t=transport();await rejects(override.grantedScopes===''?'read_scope_required':'account_changed',()=>inspect({...options,...override,fetcher:t.fetcher}));
    assert.ok(t.calls.length<=1);
  }
  const foreign=water();foreign.dataPointName=foreign.dataPointName.replace('invented-user','foreign-user');
  const t=transport({dataPoints:[foreign]},{});await rejects('record_account_mismatch',()=>inspect({...options,fetcher:t.fetcher}));assert.equal(t.calls.length,2);
  let calls=0;await rejects('invalid_date_window',()=>inspect({...options,from:'2030-02-01',fetcher:async()=>{calls++;}}));assert.equal(calls,0);
});

test('malformed, conflicting, out-of-range and excessive rollups cannot masquerade as missing or current water',async()=>{
  const conflict=bucket();conflict.hydrationLog.amountConsumed.millilitersSum=790;
  const cases=[
    [{rollupDataPoints:[{...bucket(),civilEndTime:civil(11)}]},'invalid_interval'],
    [{rollupDataPoints:[{...bucket(),civilStartTime:{date:{year:2030,month:2,day:11},time:{hours:1}}}]},'invalid_interval'],
    [{rollupDataPoints:[{...bucket(),civilStartTime:civil(4),civilEndTime:civil(5)}]},'record_outside_window'],
    [{rollupDataPoints:[{...bucket(),hydrationLog:{amountConsumed:{millilitersSum:-1}}}]},'invalid_volume'],
    [{rollupDataPoints:[bucket(),conflict]},'duplicate_identity_conflict'],
    [{rollupDataPoints:Array(8).fill(bucket())},'record_limit'],
    [{rollupDataPoints:null},'invalid_response'],
    [{rollupDataPoints:[{...bucket(false),steps:{countSum:'99'}}]},'invalid_response'],
    [{error:{message:'invented-private-text'}},'invalid_response'],
    [{rollupDataPoints:[],nextPageToken:null},'invalid_pagination']
  ];
  for(const [body,code] of cases){const t=transport({},body);await rejects(code,()=>inspect({...options,fetcher:t.fetcher}));}
  const t=transport(json({},401),{});await rejects('authorization_expired',()=>inspect({...options,fetcher:t.fetcher}));assert.equal(t.calls.length,2);
});
