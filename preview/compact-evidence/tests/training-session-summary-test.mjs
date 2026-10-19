import assert from 'node:assert/strict';
import {trainingSessionSummary} from '../src/training-session-summary.js';

// Synthetic fixtures only. No service, private record, document or clock access.
const ready={workouts:'ready',exercises:'ready',sets:'ready'};
const workout=(extra={})=>({source_record_id:'synthetic-session',workout_date:'2025-05-04',is_canonical:true,record_status:'validated',muscle_groups:['Session-only label'],sets_by_group:{'Session-only label':99},...extra});
const exercise=(id='one',extra={})=>({source_record_id:`synthetic-exercise-${id}`,workout_source_record_id:'synthetic-session',workout_date:'2025-05-04',exercise:'Synthetic exercise',muscle_group:'Group A',order_index:1,...extra});
const set=(id='one',ex='one',extra={})=>({source_record_id:`synthetic-set-${id}`,workout_source_record_id:'synthetic-session',exercise_source_record_id:`synthetic-exercise-${ex}`,workout_date:'2025-05-04',set_index:1,phase:'working',...extra});
const summarize=(data={},status=ready,w=workout())=>trainingSessionSummary(w,{workouts:[w],exercises:[],sets:[],...data},status);
const sum=(model,key)=>model.muscleGroups.reduce((total,row)=>total+row[key],model.unknownMuscleGroup[key]);
let checks=0;const test=(name,fn)=>{fn();console.log(`ok ${++checks} - ${name}`);};

test('multiple muscle labels receive only their own exercises and sets',()=>{
  const t=summarize({exercises:[exercise('one'),exercise('two',{muscle_group:'Group B'}),exercise('three',{muscle_group:'Group A'})],sets:[set('one'),set('two','two'),set('three','three'),set('four','three')]});
  assert.deepEqual(t.counts,{exercises:3,primary:4,extensions:0,total:4});
  assert.deepEqual(t.muscleGroups,[{label:'Group A',exercises:2,primary:3,extensions:0,total:3},{label:'Group B',exercises:1,primary:1,extensions:0,total:1}]);
  assert.equal(sum(t,'primary'),t.counts.primary);assert.equal(sum(t,'total'),t.counts.total);
  assert.equal(t.muscleGroups.some(row=>row.label==='Session-only label'),false);
  assert.equal(t.coverage.complete,false);assert.equal(t.partial,false);
});

test('compound and differently written real labels remain literal and separate',()=>{
  const t=summarize({exercises:[exercise('one',{muscle_group:'Group A + Group B'}),exercise('two',{muscle_group:'group a'}),exercise('three',{muscle_group:' Group A '})],sets:[set('one'),set('two','two'),set('three','three')]});
  assert.deepEqual(new Set(t.muscleGroups.map(row=>row.label)),new Set(['Group A + Group B','group a',' Group A ']));
  assert.equal(t.muscleGroups.length,3);assert.equal(sum(t,'primary'),3);
});

test('missing, blank and explicitly unknown groups stay in a separate bucket',()=>{
  const unknown=[null,undefined,'','  ','unknown','Desconhecido','Não informado',false];
  const t=summarize({exercises:unknown.map((muscle_group,i)=>exercise(String(i),{muscle_group,exercise:'Name cannot supply anatomy'})),sets:unknown.map((_,i)=>set(String(i),String(i)))});
  assert.deepEqual(t.muscleGroups,[]);assert.deepEqual(t.unknownMuscleGroup,{label:null,exercises:8,primary:8,extensions:0,total:8});
  assert.equal(t.coverage.groupKnownExercises,0);assert.equal(t.coverage.groupUnknownExercises,8);assert.equal(t.coverage.groupsComplete,false);
});

test('drop and rest-pause remain separate from primary sets in every group',()=>{
  const t=summarize({exercises:[exercise(),exercise('two',{muscle_group:null})],sets:[set('one'),set('drop','one',{phase:'drop'}),set('rest','one',{phase:'rest_pause'}),set('unknown','two',{phase:null}),set('unknown-drop','two',{phase:'drop'})]});
  assert.deepEqual(t.counts,{exercises:2,primary:2,extensions:3,total:5});
  assert.deepEqual(t.muscleGroups[0],{label:'Group A',exercises:1,primary:1,extensions:2,total:3});
  assert.deepEqual(t.unknownMuscleGroup,{label:null,exercises:1,primary:1,extensions:1,total:2});
  for(const key of ['primary','extensions','total'])assert.equal(sum(t,key),t.counts[key]);
});

test('phase counts use exact recorded primary phases without assigning missing ones',()=>{
  const phases=['working','warmup','other',null,undefined,'unknown','Working','unrecognized','drop','rest_pause'];
  const t=summarize({exercises:[exercise()],sets:phases.map((phase,i)=>set(String(i),'one',{phase,notes:'This sentence does not assign a phase.'}))});
  assert.deepEqual(t.phases,{working:1,warmup:1,other:1,unknown:5});assert.equal(t.counts.primary,8);assert.equal(t.counts.extensions,2);
  assert.equal(Object.values(t.phases).reduce((a,b)=>a+b,0),t.counts.primary);assert.equal(t.coverage.phasesComplete,false);
});

test('true alone counts failure and near-failure; other values remain unknown',()=>{
  const flags=[true,false,null,undefined,'true',1];
  const t=summarize({exercises:[exercise()],sets:flags.map((failure,i)=>set(String(i),'one',{failure,near_failure:failure}))});
  assert.equal(t.effort.failure,1);assert.equal(t.effort.nearFailure,1);assert.equal(t.effort.failureRecorded,2);assert.equal(t.effort.failureUnknown,4);
  assert.equal(t.effort.nearFailureRecorded,2);assert.equal(t.effort.nearFailureUnknown,4);assert.equal(t.coverage.failureComplete,false);
});

test('unrecorded effort stays null and never asserts zero failures',()=>{
  let t=summarize({exercises:[exercise()],sets:[set()]});
  assert.equal(t.effort.failure,null);assert.equal(t.effort.nearFailure,null);assert.equal(t.effort.failureUnknown,1);assert.equal(t.effort.failureRecorded,0);
  t=summarize({exercises:[exercise()],sets:[set('one','one',{failure:false,near_failure:false})]});
  assert.equal(t.effort.failure,0);assert.equal(t.effort.failureRecorded,1);assert.equal(t.coverage.failureComplete,true);
});

test('extension effort never increases primary failure counts',()=>{
  const t=summarize({exercises:[exercise()],sets:[set('one','one',{failure:false,near_failure:false}),set('drop','one',{phase:'drop',failure:true,near_failure:false}),set('rest','one',{phase:'rest_pause',failure:null,near_failure:true})]});
  assert.equal(t.effort.failure,0);assert.equal(t.effort.nearFailure,0);assert.equal(t.effort.extensionFailure,1);assert.equal(t.effort.extensionNearFailure,1);
  assert.equal(t.effort.extensionFailureRecorded,1);assert.equal(t.effort.extensionFailureUnknown,1);assert.equal(t.effort.extensionNearFailureRecorded,2);
});

test('identical duplicate IDs collapse despite different property order',()=>{
  const e=exercise(),s=set(),w=workout();
  const reversed=row=>Object.fromEntries(Object.entries(row).reverse());
  const t=summarize({workouts:[w,reversed(w)],exercises:[e,reversed(e)],sets:[s,reversed(s)]},ready,w);
  assert.deepEqual(t.counts,{exercises:1,primary:1,extensions:0,total:1});assert.equal(t.coverage.exercises.duplicates,1);assert.equal(t.coverage.sets.duplicates,1);assert.equal(t.partial,false);
});

test('conflicting exercise IDs exclude every variant and their child sets',()=>{
  const e=exercise(),t=summarize({exercises:[e,{...e,muscle_group:'Group B'}],sets:[set()]});
  assert.deepEqual(t.counts,{exercises:0,primary:0,extensions:0,total:0});assert.equal(t.coverage.exercises.excluded,2);assert.equal(t.coverage.sets.excluded,1);
  assert.equal(t.partial,true);assert.ok(t.reasons.includes('exercise_identity_conflict'));assert.ok(t.reasons.includes('set_exercise_missing'));
});

test('conflicting set IDs exclude every variant even when counts alone match',()=>{
  const s=set(),t=summarize({exercises:[exercise()],sets:[s,{...s,weight:20}]});
  assert.equal(t.counts.primary,0);assert.equal(t.coverage.sets.excluded,2);assert.equal(t.partial,true);assert.ok(t.reasons.includes('set_identity_conflict'));
});

test('identity conflicts across different sessions cannot pass a local filter',()=>{
  const e=exercise(),s=set();
  let t=summarize({exercises:[e,{...e,workout_source_record_id:'another-synthetic-session'}],sets:[s]});
  assert.equal(t.counts.exercises,0);assert.equal(t.counts.primary,0);assert.equal(t.partial,true);
  t=summarize({exercises:[e],sets:[s,{...s,workout_source_record_id:'another-synthetic-session'}]});
  assert.equal(t.counts.primary,0);assert.ok(t.reasons.includes('set_identity_conflict'));
});

test('missing stable IDs are excluded instead of inventing fallback identities',()=>{
  const t=summarize({exercises:[exercise(),exercise('missing',{source_record_id:null})],sets:[set('one','one',{source_record_id:null}),set('blank','one',{source_record_id:' '})]});
  assert.equal(t.counts.exercises,1);assert.equal(t.counts.primary,0);assert.equal(t.coverage.exercises.excluded,1);assert.equal(t.coverage.sets.excluded,2);assert.equal(t.partial,true);
});

test('orphans, missing parent links and parent mismatches cannot contribute',()=>{
  const t=summarize({exercises:[exercise()],sets:[set(),set('orphan','missing'),set('wrong','one',{workout_source_record_id:'another-synthetic-session'}),set('missing','one',{workout_source_record_id:null}),set('missing-exercise','one',{exercise_source_record_id:null})]});
  assert.equal(t.counts.primary,1);assert.equal(t.coverage.sets.excluded,4);assert.equal(t.partial,true);
  assert.ok(t.reasons.includes('set_parent_mismatch'));assert.ok(t.reasons.includes('set_exercise_missing'));
});

test('incompatible and invalid child dates are excluded; missing dates use exact parent links',()=>{
  const t=summarize({exercises:[exercise('one',{workout_date:null}),exercise('wrong',{workout_date:'2025-05-05'}),exercise('invalid',{workout_date:'2025-02-30'})],sets:[set('one','one',{workout_date:undefined}),set('date','one',{workout_date:'2025-05-05'}),set('invalid','one',{workout_date:'2025-02-30'}),set('blank','one',{workout_date:''}),set('wrong','wrong'),set('timestamp','one',{workout_date:'2025-05-04T12:00:00Z'})]});
  assert.equal(t.counts.exercises,1);assert.equal(t.counts.primary,2);assert.equal(t.coverage.exercises.excluded,2);assert.equal(t.coverage.sets.excluded,4);assert.equal(t.partial,true);
});

test('valid unrelated sessions do not enter this summary or mark it partial',()=>{
  const t=summarize({exercises:[exercise(),exercise('other',{workout_source_record_id:'another-synthetic-session'})],sets:[set(),set('other','other',{workout_source_record_id:'another-synthetic-session'})]});
  assert.equal(t.counts.exercises,1);assert.equal(t.counts.primary,1);assert.equal(t.partial,false);
});

test('canonical, identity and date requirements apply to the selected session',()=>{
  for(const change of [{is_canonical:false},{is_canonical:null},{record_status:'quarantined'},{source_record_id:null},{workout_date:'2025-02-30'}]){
    const t=summarize({exercises:[exercise()],sets:[set()]},ready,workout(change));
    assert.equal(t.sessionAvailable,false);assert.equal(t.counts.exercises,null);assert.equal(t.counts.primary,null);assert.equal(t.coverage.exercises.status,'unavailable');assert.equal(t.partial,true);
  }
});

test('a conflicting or missing selected workout does not yield zero detail counts',()=>{
  const w=workout();
  for(const rows of [[w,{...w,workout_date:'2025-05-05'}],[]]){
    const t=summarize({workouts:rows,exercises:[exercise()],sets:[set()]},ready,w);
    assert.equal(t.counts.exercises,null);assert.equal(t.counts.total,null);assert.equal(t.sessionAvailable,false);
  }
});

test('errors and loading keep counts unavailable even if previous rows remain',()=>{
  const data={exercises:[exercise()],sets:[set()]};
  for(const state of ['error','loading',null,undefined]){
    let t=summarize(data,{...ready,sets:state});
    assert.equal(t.counts.exercises,1);assert.equal(t.counts.primary,null);assert.equal(t.phases.working,null);assert.equal(t.effort.failure,null);assert.equal(t.muscleGroups[0].primary,null);assert.equal(t.partial,true);
    t=summarize(data,{...ready,exercises:state});assert.equal(t.counts.exercises,null);assert.equal(t.counts.primary,null);assert.deepEqual(t.muscleGroups,[]);
    t=summarize(data,{...ready,workouts:state});assert.equal(t.counts.exercises,null);assert.equal(t.counts.primary,null);assert.equal(t.sessionAvailable,false);
  }
});

test('null or absent datasets cannot turn ready status into a successful empty read',()=>{
  for(const value of [null,undefined,{},'']){
    let t=summarize({sets:value});assert.equal(t.counts.total,null);assert.equal(t.coverage.sets.status,'unavailable');
    t=summarize({exercises:value});assert.equal(t.counts.exercises,null);assert.equal(t.counts.total,null);
    t=summarize({workouts:value});assert.equal(t.sessionAvailable,false);assert.equal(t.counts.total,null);
  }
  const t=trainingSessionSummary(workout());assert.equal(t.counts.exercises,null);assert.equal(t.counts.total,null);
});

test('successful empty arrays may report zero but never complete logging',()=>{
  const t=summarize();assert.deepEqual(t.counts,{exercises:0,primary:0,extensions:0,total:0});assert.deepEqual(t.phases,{working:0,warmup:0,other:0,unknown:0});
  assert.equal(t.effort.failure,0);assert.equal(t.effort.failureRecorded,0);assert.equal(t.status,'empty');assert.equal(t.coverage.complete,false);
});

test('exercise declarations do not manufacture detailed sets or muscle totals',()=>{
  const t=summarize({exercises:[exercise('one',{sets:99,weight_kg:500,reps:'100'})]});
  assert.equal(t.counts.exercises,1);assert.equal(t.counts.primary,0);assert.equal(t.coverage.exercisesWithSets,0);assert.equal(t.coverage.exercisesWithoutSets,1);assert.equal(t.muscleGroups[0].primary,0);
  assert.equal(Object.hasOwn(t,'load'),false);assert.equal(Object.hasOwn(t,'progression'),false);assert.equal(Object.hasOwn(t,'recommendation'),false);
});

test('session comment and original report remain distinct raw strings for view escaping',()=>{
  const comment='  Explicit comment <script>synthetic</script>\nSecond line  ',report='Recorded report <b>synthetic</b> & details';
  let t=summarize({},ready,workout({session_comment:comment,raw_exercises:report,notes:'Technical ingestion note'}));
  assert.equal(t.sessionComment,comment);assert.equal(t.originalReport,report);
  t=summarize({},ready,workout({notes:'Never a user comment',source_payload:{session_comment:'Not explicitly projected'}}));
  assert.equal(t.sessionComment,null);assert.equal(t.originalReport,null);
  for(const value of [false,12,{},['text']]){t=summarize({},ready,workout({session_comment:value,raw_exercises:value}));assert.equal(t.sessionComment,null);assert.equal(t.originalReport,null);}
});

test('accepted records are ordered copies and cannot mutate input or nested fields',()=>{
  const w=workout(),data={workouts:[w],exercises:[exercise('two',{order_index:2}),exercise('one',{order_index:1,source_payload:{synthetic:true}})],sets:[set('two','one',{set_index:2}),set('one','one',{set_index:1})]};
  const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}};
  freeze(data);freeze(ready);const snapshot=JSON.stringify(data),t=trainingSessionSummary(w,data,ready);
  assert.deepEqual(t,trainingSessionSummary(w,data,ready));assert.equal(JSON.stringify(data),snapshot);
  assert.deepEqual(t.acceptedExercises.map(row=>row.order_index),[1,2]);assert.deepEqual(t.acceptedSets.map(row=>row.set_index),[1,2]);
  t.acceptedExercises[0].source_payload.synthetic=false;t.acceptedSets[0].phase='warmup';
  assert.equal(JSON.stringify(data),snapshot);assert.equal(data.exercises[1].source_payload.synthetic,true);
});

console.log(`Training session summary: ${checks} synthetic checks passed.`);
