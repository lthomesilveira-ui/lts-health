import assert from 'node:assert/strict';
import {normalizeActivitySamples,receiveActivitySamples,projectActivityRows,hasActivityScope} from '../supabase/functions/_shared/polar-activity.mjs';
import {healthDashboardModel} from './src/health-dashboard-model.js';

const date='2001-04-03',owner='synthetic-owner',revision='synthetic-revision';
const device=(steps=[2,4],id='synthetic-device',startTime='10:00:00',interval='60000')=>({deviceReference:{deviceId:id},activitySamples:[{stepSamples:{startTime,interval,steps}}]});
const payload=(devices=[device()],day=date)=>({activities:{activityDays:[{date:day,activitiesPerDevice:devices}]}});
const copy=value=>structuredClone(value);
const original=payload(),before=JSON.stringify(original),rows=await normalizeActivitySamples(original,owner,date);
assert.deepEqual(await normalizeActivitySamples(original.activities,owner,date),rows,'the observed direct envelope and documented wrapped envelope preserve identical source observations');
assert.deepEqual(await normalizeActivitySamples({activityDays:[]},owner,date),[]);
const boundary=copy(original);boundary.activities.activityDays.push({...copy(boundary.activities.activityDays[0]),date:'2001-04-04'});
assert.deepEqual(await normalizeActivitySamples(boundary,owner,date),rows,'an additional following boundary date must not leak into the requested day or double observations');
for(const extraDate of ['2001-04-02','2001-04-05',date]){
 const invalid=copy(original);invalid.activities.activityDays.push({...copy(invalid.activities.activityDays[0]),date:extraDate});
 await assert.rejects(normalizeActivitySamples(invalid,owner,date),/provider_activity_schema/);
}
await assert.rejects(normalizeActivitySamples({...original,activityDays:original.activities.activityDays},owner,date),/provider_activity_schema/,'two competing envelopes must not be selected silently');
assert.equal(JSON.stringify(original),before,'original provider payload is not modified');
assert.equal(rows.length,1);assert.equal(rows[0].value,6);assert.equal(rows[0].unit,'count');
assert.equal(rows[0].canonical_status,'held');assert.equal(rows[0].source_payload.coverage_verified,false);
const model=healthDashboardModel({sourceMetrics:rows},{sourceMetrics:'ready',metrics:'ready'},{dashboardPeriod:'7'},'2001-04-04');
assert.equal(model.metricsByKey.steps.value,null,'an observed sample sum cannot enter daily step values or means');
assert.equal(model.metricsByKey.steps.count,0);
assert.deepEqual(rows[0].source_payload.original_samples[0].steps,[2,4]);
assert.equal(rows[0].source_payload.original_device_id,'synthetic-device');
assert.doesNotMatch(rows[0].source_name,/synthetic-device/,'display origin uses a stable device alias');
assert.equal((await normalizeActivitySamples(payload([device([0])]),owner,date))[0].value,0,'explicit observed zero is retained');
for(const p of [{activities:{activityDays:[]}},payload([device([])]),payload([device(undefined)])]){
 if(p.activities.activityDays[0]?.activitiesPerDevice[0]?.activitySamples[0]?.stepSamples?.steps?.length)continue;
 assert.equal((await normalizeActivitySamples(p,owner,date)).length,0,'absence cannot create a zero record');
}
const missing=payload();delete missing.activities.activityDays[0].activitiesPerDevice[0].activitySamples[0].stepSamples.steps;
assert.equal((await normalizeActivitySamples(missing,owner,date)).length,0);
const repeated=payload();repeated.activities.activityDays[0].activitiesPerDevice[0].activitySamples.push(copy(repeated.activities.activityDays[0].activitiesPerDevice[0].activitySamples[0]));
assert.equal((await normalizeActivitySamples(repeated,owner,date))[0].value,6,'identical repeated buckets cannot double the observed count');
const two=await normalizeActivitySamples(payload([device([2]),device([9],'another-device')]),owner,date);
assert.equal(two.length,2);assert.deepEqual(two.map(row=>row.value),[2,9],'devices remain separate');
assert.deepEqual(await normalizeActivitySamples(payload([device([],''),device([2])]),owner,date),await normalizeActivitySamples(payload([device([2])]),owner,date),'an activity-only empty device reference cannot discard attributable step observations');
assert.deepEqual(await normalizeActivitySamples(payload([device([], '')]),owner,date),[]);
await assert.rejects(normalizeActivitySamples(payload([device([0],'')]),owner,date),/provider_activity_schema/,'even explicit zero buckets require a genuine device reference');
const badPayloads=[{},payload([device([1.5])]),payload([device([null])]),payload([device([-1])]),payload([device([1], '', '10:00:00')]),payload([device([1],'synthetic-device','24:00:00')]),payload([device([1],'synthetic-device','23:59:30','60000')]),payload([device([1],'synthetic-device','10:00:00','0')]),payload([device([1])],'2001-04-04')];
for(const p of badPayloads)await assert.rejects(normalizeActivitySamples(p,owner,date));
const conflict=payload();conflict.activities.activityDays[0].activitiesPerDevice[0].activitySamples.push({stepSamples:{startTime:'10:00:30',interval:'60000',steps:[7]}});
await assert.rejects(normalizeActivitySamples(conflict,owner,date),/conflicting_samples/);
assert.equal(projectActivityRows([{...rows[0],value:null}]).length,0);
assert.doesNotMatch(JSON.stringify(projectActivityRows(rows)),/original_samples|original_device_id|synthetic-device/);
assert.equal(hasActivityScope({scopes:['training_sessions:read','sleep:read']}),false);
assert.equal(hasActivityScope({scopes:['training_sessions:read','sleep:read','activity:read']}),true);

const privateMarker='private-provider-value-must-never-be-logged',schemaLogs=[],savedInfo=console.info;
console.info=(...args)=>schemaLogs.push(args.join(' '));
try{
 for(const broken of [{[privateMarker]:privateMarker},{data:{items:[{date:privateMarker,[privateMarker]:privateMarker}]}},{activities:{activityDays:privateMarker}},payload([device([privateMarker],privateMarker)]),payload([device([1],privateMarker,privateMarker)])])await assert.rejects(normalizeActivitySamples(broken,owner,date),/provider_activity_schema/);
}finally{console.info=savedInfo;}
assert.ok(schemaLogs.some(line=>line.includes('activity_days')||line.includes('activity_envelope')));
assert.ok(schemaLogs.some(line=>line.includes('sample_value')));
assert.ok(schemaLogs.some(line=>line.includes('start_time')));
assert.doesNotMatch(schemaLogs.join(' '),new RegExp(privateMarker+'|synthetic-owner|synthetic-device|original_samples|access_token'));

function database({rev=revision,existing=[],failWrite=false}={}){
 const stored=new Map(existing.map(row=>[row.source_record_id,copy(row)])),writes=[];
 return {stored,writes,from(table){
   assert.ok(['health_polar_connections','health_source_daily_metrics'].includes(table),'canonical clinical and training tables are never used');
   const filters=[];let ids=null;const q={
    select(){return q;},eq(key,value){filters.push([key,value]);return q;},in(key,values){assert.equal(key,'source_record_id');ids=values;return q;},
    async maybeSingle(){assert.equal(table,'health_polar_connections');assert.deepEqual(filters,[['user_id',owner]]);return{data:rev?{revision:rev}:null,error:null};},
    async upsert(values,options){assert.equal(table,'health_source_daily_metrics');assert.equal(options.onConflict,'user_id,source_record_id');if(failWrite)return{error:new Error('private write detail')};for(const row of values){assert.equal(row.user_id,owner);assert.equal(row.canonical_status,'held');stored.set(row.source_record_id,copy(row));writes.push(copy(row));}return{error:null};},
    then(resolve,reject){assert.deepEqual(filters,[['user_id',owner]]);return Promise.resolve({data:[...stored.values()].filter(row=>!ids||ids.includes(row.source_record_id)),error:null}).then(resolve,reject);}
   };return q;
 }};
}
const calls=[],read=async(token,path,params)=>{assert.equal(token,'synthetic-access');assert.equal(path,'activity/list');calls.push(copy(params));return params.features?payload():{activities:{activityDays:[{date}]}};};
const opts={userId:owner,revision,accessToken:'synthetic-access',from:date,to:'2001-04-04',read,now:()=> '2001-04-04T08:00:00Z'};
const db=database(),info=console.info,logs=[];console.info=(...args)=>logs.push(args.join(' '));
try{
 const first=await receiveActivitySamples(db,{...opts,trigger:'manual'});assert.equal(first.written,1);assert.equal(first.read,true);
 assert.deepEqual(calls,[{from:date,to:'2001-04-04'},{from:date,to:'2001-04-04',features:'samples'}]);
 const receivedAt=db.writes[0].updated_at;
 const replay=await receiveActivitySamples(db,{...opts,trigger:'scheduled',now:()=> '2001-04-05T08:00:00Z'});
 assert.equal(replay.written,0);assert.equal(replay.unchanged,1);assert.equal(db.writes.length,1);assert.equal([...db.stored.values()][0].updated_at,receivedAt,'unchanged data cannot become a new automatic receipt');
 const revoked=database({rev:'another-revision'});assert.equal((await receiveActivitySamples(revoked,opts)).superseded,true);assert.equal(revoked.writes.length,0);
 const canonical=copy(rows[0]);canonical.canonical_status='canonical';const protectedDb=database({existing:[canonical]});await assert.rejects(receiveActivitySamples(protectedDb,opts),/write_failed/);assert.equal(protectedDb.writes.length,0);
 const emptyDb=database();const empty=await receiveActivitySamples(emptyDb,{...opts,read:async()=>({activities:{activityDays:[]}})});assert.equal(empty.status,'empty');assert.equal(emptyDb.writes.length,0);
 const unavailableDb=database();await assert.rejects(receiveActivitySamples(unavailableDb,{...opts,read:async()=>{throw Error('provider_activity_http_503');}}));assert.equal(unavailableDb.writes.length,0);
 assert.doesNotMatch(logs.join(' '),/synthetic-access|synthetic-device|synthetic-owner|original_samples|original_device/);
}finally{console.info=info;}
console.log('Polar activity: genuine sample/zero/absence distinction, per-device separation, overlap rejection, held-only writes, owner revision, original units, replay preservation and private diagnostics passed.');
