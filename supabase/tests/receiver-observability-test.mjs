import assert from 'node:assert/strict';
import {receiveHealthExport} from '../functions/_shared/health-auto-export-handler.mjs';
import {randomToken,KEY_HEADER} from '../functions/_shared/health-auto-export-contract.mjs';
const token=randomToken(),events=[];let calls=0,result={data:{received:true,accepted_metrics:1}};
const db={from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{active:true}})})})})}),rpc:async()=>{calls++;return result;}};
const metric=(name='protein',qty=234.5)=>({name,units:name==='step_count'?'count':'g',data:[{qty,date:'2026-09-01',source:'PRIVATE_SOURCE'}]});
const request=(metrics,key=token)=>new Request('https://example.test',{method:'POST',headers:{'content-type':'application/json',[KEY_HEADER]:key,'automation-aggregation':'Day','automation-period':'PRIVATE_HEADER'},body:JSON.stringify({data:{metrics}})});
const run=async metrics=>{const response=await receiveHealthExport(request(metrics),db,{emit:x=>events.push(x)});return [response.status,await response.json(),events.at(-1)];};
assert.equal((await receiveHealthExport(request([], 'bad'),db,{emit:x=>events.push(x)})).status,401);assert.equal(events.length,0);
let [status,body,event]=await run([]);assert.equal(status,200);assert.equal(event.outcome,'no_supported_data');assert.equal(calls,0);
[status,body,event]=await run([metric('step_count')]);assert.equal(status,200);assert.equal(event.outcome,'accepted_without_nutrition');
[status,body,event]=await run([metric()]);assert.equal(event.nutrition_dates_observed,1);assert.equal(event.nutrition_first_date_observed,'2026-09-01');assert.equal(event.accepted_metrics,1);assert.equal(event.requested_interval,'unknown');assert.equal(event.coverage_verified,false);
result={data:{error:'rate_limited'}};[status,body,event]=await run([metric()]);assert.equal(status,429);assert.equal(event.outcome,'rate_limited');assert.equal(body.correlation_id,event.correlation_id);assert.equal(event.accepted_metrics,0);
result={error:{message:'PRIVATE_DB_ERROR'}};[status,body,event]=await run([metric()]);assert.equal(status,503);assert.equal(event.outcome,'ingestion_failed');assert.equal(body.correlation_id,event.correlation_id);
[status,body,event]=await run([metric('protein',-1)]);assert.equal(status,422);assert.equal(event.outcome,'validation_rejected');assert.equal(body.correlation_id,event.correlation_id);
const text=JSON.stringify(events);for(const secret of [token,'PRIVATE_SOURCE','PRIVATE_HEADER','PRIVATE_DB_ERROR','234.5'])assert.ok(!text.includes(secret));
result={data:{received:true,accepted_metrics:1}};assert.equal((await receiveHealthExport(request([metric()]),db,{emit:()=>{throw Error('logging unavailable');}})).status,200);
console.log('Receiver candidate: authenticated summaries, zero nutrition versus accepted payload, failure classification, no secret/value/source logging and logger failure isolation passed.');
const wrongType=new Request('https://example.test',{method:'POST',headers:{[KEY_HEADER]:token,'content-type':'text/plain'},body:'{}'});
const wrongResponse=await receiveHealthExport(wrongType,db,{emit:x=>events.push(x)});assert.equal(wrongResponse.status,415);assert.equal(events.at(-1).outcome,'validation_rejected');assert.ok((await wrongResponse.json()).correlation_id);
[status,body,event]=await run([metric()]);assert.equal(body.correlation_id,event.correlation_id);assert.equal(body.nutrition_dates_observed,1);assert.equal(body.coverage_verified,false);assert.ok(!Object.hasOwn(event,'received_points'));
// Transport acknowledgement and observed nutrients do not prove persisted nutrition.
result={data:{received:true,accepted_metrics:0}};
[status,body,event]=await run([metric()]);
assert.equal(status,200);assert.equal(body.outcome,'accepted_without_writes');assert.equal(event.outcome,body.outcome);assert.equal(body.nutrition_metrics_observed,1);assert.equal(body.coverage_verified,false);
result={data:{received:true,accepted_metrics:1}};
[status,body,event]=await run([metric(),metric('step_count')]);
assert.equal(body.outcome,'accepted');assert.equal(body.nutrition_metrics_observed,1);assert.equal(body.coverage_verified,false);assert.ok(!Object.hasOwn(body,'nutrition_metrics_persisted'));
const originalWarn=console.warn; console.warn=()=>{throw Error('logging unavailable');};
try{const invalid=metric();invalid.units='unsupported';const response=await receiveHealthExport(request([invalid]),db,{emit:()=>{throw Error('logging unavailable');}});assert.equal(response.status,422);assert.equal((await response.json()).error,'unsupported_unit');}finally{console.warn=originalWarn;}
console.log('Zero writes, mixed batches and warning failure remain honest and response-safe.');
// Unsupported basal content stays ignored. Only fixed-name block/point counts reach logs.
const captured=[];const auditEvents=[];
const auditDb={...db,rpc:async(name,args)=>{captured.push({name,args});return {data:{received:true,accepted_metrics:args.p_metrics.length}};}};
const audited=async(metrics,{key=token,emit=x=>auditEvents.push(x)}={})=>{
 const response=await receiveHealthExport(request(metrics,key),auditDb,{emit});
 return {status:response.status,body:await response.json(),event:auditEvents.at(-1)};
};
const unsupported=(name='basal_energy_burned',data=[{qty:7654321,source:'PRIVATE_BASAL_SOURCE',date:'PRIVATE_BASAL_DATE',device:'PRIVATE_DEVICE'}])=>({name,units:'PRIVATE_BASAL_UNIT',data});
const withoutCorrelation=body=>{const {correlation_id,...rest}=body;return rest;};
const plain=await audited([metric()]);const originalCall=structuredClone(captured.at(-1));
assert.equal(plain.event.ignored_basal_blocks,0);assert.equal(plain.event.ignored_basal_points,0);
const mixed=await audited([metric(),unsupported(),unsupported('UNRELATED_PRIVATE_METRIC',[null,null])]);
assert.equal(mixed.status,200);assert.deepEqual(captured.at(-1),originalCall);
assert.equal(mixed.event.ignored_basal_blocks,1);assert.equal(mixed.event.ignored_basal_points,1);assert.equal(mixed.event.ignored_points,3);
assert.deepEqual(withoutCorrelation(mixed.body),{...withoutCorrelation(plain.body),ignored_points:3});
assert.ok(!Object.hasOwn(mixed.body,'ignored_basal_blocks'));assert.ok(!Object.hasOwn(mixed.body,'ignored_basal_points'));
const emptyBasal=await audited([metric(),unsupported('basal_energy_burned',[])]);
assert.equal(emptyBasal.event.ignored_basal_blocks,1);assert.equal(emptyBasal.event.ignored_basal_points,0);assert.deepEqual(withoutCorrelation(emptyBasal.body),withoutCorrelation(plain.body));
const several=await audited([metric(),unsupported(),unsupported('basal_energy_burned',[null,{}])]);
assert.equal(several.event.ignored_basal_blocks,2);assert.equal(several.event.ignored_basal_points,3);assert.deepEqual(captured.at(-1),originalCall);
for(const name of ['basal_energy','Basal_energy_burned','basal_energy_burned_PRIVATE']){
 const ignored=await audited([metric(),unsupported(name)]);assert.equal(ignored.event.ignored_basal_blocks,0);assert.equal(ignored.event.ignored_basal_points,0);assert.deepEqual(captured.at(-1),originalCall);
}
const beforeNoData=captured.length;const onlyBasal=await audited([unsupported()]);
assert.equal(onlyBasal.status,200);assert.equal(onlyBasal.body.message,'no_supported_data');assert.equal(onlyBasal.event.ignored_basal_points,1);assert.equal(captured.length,beforeNoData);
const rejected=await audited([unsupported(),metric('protein',-1)]);
assert.equal(rejected.status,422);assert.ok(!Object.hasOwn(rejected.event,'ignored_basal_blocks'));assert.equal(captured.length,beforeNoData);
const tooLarge=await audited([unsupported('basal_energy_burned',Array(2501).fill(null))]);
assert.equal(tooLarge.status,422);assert.equal(tooLarge.body.error,'too_many_points');assert.ok(!Object.hasOwn(tooLarge.event,'ignored_basal_points'));
const eventCount=auditEvents.length;assert.equal((await audited([unsupported()],{key:'bad'})).status,401);assert.equal(auditEvents.length,eventCount);
const brokenLog=await audited([metric(),unsupported()],{emit:()=>{throw Error('logging unavailable');}});
assert.equal(brokenLog.status,200);assert.deepEqual(captured.at(-1),originalCall);
const logged=JSON.stringify(auditEvents);
for(const secret of [token,'7654321','PRIVATE_BASAL_SOURCE','PRIVATE_BASAL_DATE','PRIVATE_DEVICE','PRIVATE_BASAL_UNIT','UNRELATED_PRIVATE_METRIC'])assert.ok(!logged.includes(secret));
console.log('Private basal diagnostics: absent/empty/present/unknown/mixed/rejected/unauthenticated counts; unchanged writes and public responses; logger isolation.');
