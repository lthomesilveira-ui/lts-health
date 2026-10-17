import assert from 'node:assert/strict';
import {dashboardContext} from '../src/health-dashboard-context.js';

// Synthetic only. These checks need no database, browser, secrets or clock.
const status={workouts:'ready',exercises:'ready',sets:'ready',workoutEvidence:'ready',polarSessions:'ready'};
const options={today:'2025-05-10',bounds:{start:'2025-05-01',end:'2025-05-09'}};
const workout=(id,date='2025-05-04',extra={})=>({source_record_id:`synthetic-w-${id}`,workout_date:date,is_canonical:true,record_status:'validated',workout_type:'Synthetic session',muscle_groups:['Explicit group'],...extra});
const exercise=(id,parent='a',extra={})=>({source_record_id:`synthetic-e-${id}`,workout_source_record_id:`synthetic-w-${parent}`,workout_date:'2025-05-04',exercise:'Synthetic exercise',machine:'Synthetic machine',order_index:1,muscle_group:'Explicit group',...extra});
const set=(id,ex='a',parent='a',extra={})=>({source_record_id:`synthetic-s-${id}`,exercise_source_record_id:`synthetic-e-${ex}`,workout_source_record_id:`synthetic-w-${parent}`,workout_date:'2025-05-04',set_index:1,phase:'working',weight:10,weight_unit:'kg',reps_numeric:8,...extra});
const polar=(id,date='2025-05-04',extra={})=>({source_record_id:`synthetic-p-${id}`,workout_date:date,recorded_start:`${date}T12:00:00`,session_name:'Synthetic Polar record',source_name:'Synthetic device',duration_minutes:20,...extra});
const evidence=(id,parent='a',extra={})=>({source_record_id:`synthetic-ev-${id}`,workout_source_record_id:`synthetic-w-${parent}`,workout_date:'2025-05-04',source_family:'polar_flow',source_name:'Synthetic Polar telemetry',evidence_status:'confirmed',evidence_kind:'telemetry',field_names:['duration_minutes'],...extra});
const model=(data={},states=status,opts=options)=>dashboardContext(data,states,opts).training;
let checks=0;const test=(name,fn)=>{fn();console.log(`ok ${++checks} - ${name}`);};

test('canonical session, exercise and set counts have separate denominators',()=>{
  const t=model({workouts:[workout('a')],exercises:[exercise('a'),exercise('b')],sets:[set('a'),set('b','b'),set('drop','b','a',{phase:'drop'}),set('rest','b','a',{phase:'rest_pause'}),set('unknown','a','a',{phase:null})],polarSessions:[polar('a'),polar('b')]});
  assert.equal(t.sessions,1);assert.equal(t.exerciseCount,2);assert.equal(t.setCount,3);assert.equal(t.extensionCount,2);assert.equal(t.setRecordCount,5);assert.equal(t.unknownPhaseCount,1);assert.equal(t.setCounts.workingCount,2);
  assert.equal(t.polar.sessions,2);assert.equal(t.polar.recordedDays,1);assert.equal(t.recentSessions[0].exerciseCount,2);assert.equal(t.recentSessions[0].setCount,3);
});
test('quarantine, noncanonical parents and unmatched children cannot contribute',()=>{
  const t=model({workouts:[workout('a'),workout('held','2025-05-04',{record_status:'quarantined'}),workout('candidate','2025-05-04',{is_canonical:false})],
    exercises:[exercise('a'),exercise('held','held'),exercise('candidate','candidate'),exercise('orphan','missing')],
    sets:[set('a'),set('held','held','held'),set('candidate','candidate','candidate'),set('orphan','missing'),set('wrong-parent','a','held')]});
  assert.equal(t.sessions,1);assert.equal(t.exerciseCount,1);assert.equal(t.setRecordCount,1);
});
test('parent/date mismatches, invalid dates and future records are excluded',()=>{
  const t=model({workouts:[workout('a'),workout('future','2025-05-11')],exercises:[exercise('a'),exercise('bad-date','a',{workout_date:'2025-05-05'}),exercise('future','future',{workout_date:'2025-05-11'})],
    sets:[set('a'),set('bad-date','a','a',{workout_date:'2025-05-05'}),set('future','future','future',{workout_date:'2025-05-11'})],polarSessions:[polar('a'),polar('future','2025-05-11'),polar('invalid','2025-02-30')]});
  assert.equal(t.exerciseCount,1);assert.equal(t.setCount,1);assert.equal(t.polar.sessions,1);assert.equal(t.history.length,1);
});
test('exact identities collapse; conflicting exercise/set identities are excluded',()=>{
  const e=exercise('a'),s=set('a');let t=model({workouts:[workout('a')],exercises:[e,{...e}],sets:[s,{...s}]});
  assert.equal(t.exerciseCount,1);assert.equal(t.setCount,1);assert.equal(t.detailDuplicates.length,2);
  t=model({workouts:[workout('a')],exercises:[e,{...e,machine:'Other machine'}],sets:[s]});assert.equal(t.exerciseCount,0);assert.equal(t.setCount,0);assert.equal(t.detailsPartial,true);
  t=model({workouts:[workout('a')],exercises:[e],sets:[s,{...s,weight:20}]});assert.equal(t.exerciseCount,1);assert.equal(t.setCount,0);assert.equal(t.detailsPartial,true);
});
test('unidentified rows do not silently manufacture repeat identities',()=>{
  const e=exercise('a',{},{source_record_id:null,workout_source_record_id:'synthetic-w-a'});
  let t=model({workouts:[workout('a')],exercises:[e,{...e}]});assert.equal(t.exerciseCount,0);assert.equal(t.detailsPartial,true);
  t=model({workouts:[workout('a')],exercises:[exercise('a')],sets:[set('a','a','a',{source_record_id:null,set_index:null})]});assert.equal(t.setCount,0);assert.equal(t.unidentifiedDetails.sets,1);
});
test('source outages produce null detail counts while preserving known session totals',()=>{
  const data={workouts:[workout('a')],exercises:[exercise('a')],sets:[set('a')],polarSessions:[polar('a')]};
  let t=model(data,{...status,sets:'error'});assert.equal(t.sessions,1);assert.equal(t.exerciseCount,1);assert.equal(t.setCount,null);assert.equal(t.detailsCoverage.sets.status,'error');assert.equal(t.detailsStatus,'partial');
  t=model(data,{...status,exercises:'loading'});assert.equal(t.exerciseCount,null);assert.equal(t.setCount,null);assert.equal(t.detailsCoverage.exercises.status,'loading');
  t=model(data,{...status,workouts:'error'});assert.equal(t.sessions,null);assert.equal(t.exerciseCount,null);assert.equal(t.setCount,null);assert.equal(t.polar.sessions,1);
  t=model(data,{...status,polarSessions:'error'});assert.equal(t.polar.sessions,null);assert.deepEqual(t.polar.history,[]);assert.equal(t.polar.status,'error');
});
test('zero rows after successful reads are distinct from missing source data',()=>{
  const t=model();assert.equal(t.exerciseCount,0);assert.equal(t.setCount,0);assert.equal(t.polar.sessions,0);assert.equal(t.polar.status,'empty');assert.equal(t.polar.recordedMinutes,null);
  assert.equal(t.detailsCoverage.sets.complete,false);assert.equal(t.detailsCoverage.sets.allSessionsHaveRecords,false);
});
test('latest known sessions outside a blank window remain visible without entering totals',()=>{
  const t=model({workouts:[workout('a','2025-04-04')],exercises:[exercise('a','a',{workout_date:'2025-04-04'})],sets:[set('a','a','a',{workout_date:'2025-04-04'})],polarSessions:[polar('a','2025-04-05')]});
  assert.equal(t.sessions,0);assert.equal(t.exerciseCount,0);assert.equal(t.latestSessions.length,0);assert.equal(t.recentSessions.length,1);assert.equal(t.recentSessions[0].inPeriod,false);assert.equal(t.recentSessions[0].exerciseCount,1);
  assert.equal(t.polar.sessions,0);assert.equal(t.polar.latestSessions.length,0);assert.equal(t.polar.recentSessions[0].inPeriod,false);assert.equal(t.polar.recentSessions[0].date,'2025-04-05');
});
test('current recent lists are limited to three and do not append older sessions',()=>{
  const t=model({workouts:[workout('a','2025-05-01'),workout('b','2025-05-02'),workout('c','2025-05-03'),workout('d','2025-05-04'),workout('old','2025-04-01')],polarSessions:[polar('a','2025-05-01'),polar('b','2025-05-02'),polar('c','2025-05-03'),polar('d','2025-05-04'),polar('old','2025-04-01')]});
  assert.deepEqual(t.recentSessions.map(row=>row.date),['2025-05-04','2025-05-03','2025-05-02']);assert.deepEqual(t.polar.recentSessions.map(row=>row.date),['2025-05-04','2025-05-03','2025-05-02']);
});
test('coverage counts sessions with records, without claiming complete logging',()=>{
  const t=model({workouts:[workout('a'),workout('b')],exercises:[exercise('a'),exercise('b')],sets:[set('a')]});
  assert.equal(t.detailsCoverage.exercises.count,2);assert.equal(t.detailsCoverage.exercises.sessions,1);assert.equal(t.detailsCoverage.exercises.total,2);assert.equal(t.detailsCoverage.exercises.fraction,.5);
  assert.equal(t.detailsCoverage.sets.sessions,1);assert.equal(t.detailsCoverage.sets.complete,false);
});
test('unknown groups and phase are not inferred from exercise names or device names',()=>{
  const t=model({workouts:[workout('a','2025-05-04',{muscle_groups:null,workout_type:'Peito'})],exercises:[exercise('a','a',{muscle_group:'desconhecido',exercise:'Supino'})],sets:[set('a','a','a',{phase:null})],polarSessions:[polar('a','2025-05-04',{session_name:'Leg day'})]});
  assert.deepEqual(t.groups,[]);assert.deepEqual(t.polar.rows[0].groups,[]);assert.equal(t.setCounts.workingCount,0);assert.equal(t.unknownPhaseCount,1);assert.equal(t.setCount,1);
});
test('explicit evidence attaches by parent ID, preserving partial telemetry and sensor limitations',()=>{
  const t=model({workouts:[workout('a'),workout('b')],workoutEvidence:[evidence('a','a',{field_names:['partial_heart_rate_avg','estimated_session_calories_kcal','measurement_issue_reported']}),evidence('orphan','missing'),evidence('candidate','b',{evidence_status:'candidate'})],polarSessions:[polar('a')]});
  const a=t.history.find(row=>row.sourceRecordId==='synthetic-w-a'),b=t.history.find(row=>row.sourceRecordId==='synthetic-w-b');
  assert.equal(a.telemetryEvidence.confirmedCount,1);assert.equal(a.telemetryEvidence.heartRatePartial,true);assert.equal(a.telemetryEvidence.energyEstimated,true);assert.equal(a.telemetryEvidence.measurementIssueReported,true);
  assert.equal(b.telemetryEvidence.confirmedCount,0);assert.equal(t.evidence.confirmedTelemetrySessions,1);assert.equal(t.polar.rows[0].canonicalWorkoutId,null);
});
test('Polar duplicates and conflicts cannot be pooled with canonical sessions',()=>{
  const p=polar('a');let t=model({workouts:[workout('a')],polarSessions:[p,{...p}]});assert.equal(t.polar.sessions,1);assert.equal(t.sessions,1);
  t=model({workouts:[workout('a')],polarSessions:[polar('old','2025-04-01'),p,{...p,duration_minutes:21}]});assert.equal(t.polar.sessions,0);assert.equal(t.polar.status,'partial');assert.equal(t.polar.latest,null);assert.equal(t.polar.lastRecordAmbiguous,true);assert.deepEqual(t.polar.recentSessions,[]);
});
test('Polar duration coverage retains zero and does not fill missing values',()=>{
  const t=model({polarSessions:[polar('a','2025-05-04',{duration_minutes:0}),polar('b','2025-05-04',{duration_minutes:null}),polar('c','2025-05-05',{duration_minutes:false})]});
  assert.equal(t.polar.sessions,3);assert.equal(t.polar.recordedDays,2);assert.equal(t.polar.recordedMinutes,0);assert.equal(t.polar.durationCoverage.sessions,1);assert.equal(t.polar.durationCoverage.total,3);assert.equal(t.polar.durationCoverage.complete,false);
});
test('a later conflicted Polar identity on the same date blocks misleading latest fallback',()=>{
  const safe=polar('safe','2025-05-04',{recorded_start:'2025-05-04T09:00:00'}),ambiguous=polar('ambiguous','2025-05-04',{recorded_start:'2025-05-04T18:00:00',duration_minutes:30});
  const data={polarSessions:[safe,ambiguous,{...ambiguous,duration_minutes:31}]};
  let t=model(data);assert.equal(t.polar.sessions,1);assert.equal(t.polar.latestSessions.length,1);assert.equal(t.polar.latest,null);assert.equal(t.polar.lastRecordAmbiguous,true);
  t=model(data,status,{...options,bounds:{start:'2025-05-05',end:'2025-05-09'}});
  assert.equal(t.polar.sessions,0);assert.equal(t.polar.latest,null);assert.equal(t.polar.lastRegistered,null);assert.equal(t.polar.lastRecordAmbiguous,true);assert.deepEqual(t.polar.recentSessions,[]);
  assert.equal(t.polar.latestUnambiguous.recordedStart,'2025-05-04T09:00:00');
});
test('a conflicted canonical identity on the latest date blocks latest and gap fallback',()=>{
  const safe=workout('safe','2025-05-04'),ambiguous=workout('ambiguous','2025-05-04',{duration_minutes:30});
  const data={workouts:[safe,ambiguous,{...ambiguous,duration_minutes:31}]};
  let t=model(data);assert.equal(t.sessions,1);assert.equal(t.latestSessions.length,1);assert.equal(t.latest,null);assert.equal(t.lastRecordAmbiguous,true);assert.equal(t.daysSinceLast,null);assert.equal(t.gapLabel,null);
  t=model(data,status,{...options,bounds:{start:'2025-05-05',end:'2025-05-09'}});
  assert.equal(t.sessions,0);assert.equal(t.latest,null);assert.equal(t.lastRegistered,null);assert.equal(t.lastRecordAmbiguous,true);assert.deepEqual(t.recentSessions,[]);
  assert.equal(t.latestUnambiguous.sourceRecordId,'synthetic-w-safe');assert.equal(t.daysSinceLast,null);assert.equal(t.gapLabel,null);
});
test('exercise and set details retain order, units, raw repetitions and extensions',()=>{
  const t=model({workouts:[workout('a')],exercises:[exercise('b','a',{order_index:2}),exercise('a','a',{order_index:1})],sets:[set('drop','a','a',{set_index:2,phase:'drop',weight_unit:'plate_index',reps_raw:'8 + 2'}),set('a','a','a',{set_index:1})]});
  const list=t.latest.exercises;assert.equal(list[0].sourceRecordId,'synthetic-e-a');assert.equal(list[0].primarySets,1);assert.equal(list[0].extensions,1);assert.equal(list[0].recordedSets[1].phase,'drop');assert.equal(list[0].recordedSets[1].weight_unit,'plate_index');assert.equal(list[0].recordedSets[1].reps_raw,'8 + 2');
});
test('historical end and today cap both canonical and device observations',()=>{
  const t=model({workouts:[workout('a','2025-05-03'),workout('later','2025-05-05')],polarSessions:[polar('a','2025-05-03'),polar('later','2025-05-05')]},status,{today:'2025-05-03',bounds:{start:'2025-05-01',end:'2025-05-09'}});
  assert.equal(t.sessions,1);assert.equal(t.polar.sessions,1);assert.equal(t.latest.date,'2025-05-03');assert.equal(t.polar.latest.date,'2025-05-03');
});
test('pure enrichment never mutates source rows or depends on wall clock',()=>{
  const data={workouts:[workout('a')],exercises:[exercise('a')],sets:[set('a')],polarSessions:[polar('a')],workoutEvidence:[evidence('a')]};
  const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}};freeze(data);
  const before=JSON.stringify(data),a=model(data);assert.deepEqual(a,model(data));assert.equal(JSON.stringify(data),before);
});
console.log(`Health dashboard training: ${checks} synthetic checks passed.`);
