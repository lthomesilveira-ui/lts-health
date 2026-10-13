import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {state}=await import('./src/core.js');
const {renderProductTraining}=await import('./src/training-reference-v2.js');
const {homeCockpitModel,renderHomeCockpit}=await import('./src/home-cockpit.js');
const {trainingSetCounts,hasReportedMeasurementIssue,setStepLabel}=await import('./src/training-session.js');

// Synthetic records only: an extension changes structure, never the source data.
const workout={source_record_id:'synthetic-session',workout_date:'2025-04-29',workout_type:'Synthetic session',location:'Synthetic gym',record_status:'validated',is_canonical:true,source:'Synthetic source',heart_rate_avg:77};
const exercise={source_record_id:'synthetic-exercise',workout_source_record_id:workout.source_record_id,exercise:'Synthetic exercise',machine:'Synthetic machine',muscle_group:'Costas',notes:'Execution note <b>from source</b>'};
const steps=[
 {phase:'warmup',reps_numeric:11},
 {phase:null,reps_numeric:7},
 {phase:'rest_pause',reps_numeric:2.5},
 {phase:'working',reps_numeric:5},
 {phase:'drop',reps_numeric:4},
 {phase:'drop',reps_numeric:9}
].map((row,i)=>({...row,source_record_id:`synthetic-step-${i}`,workout_source_record_id:workout.source_record_id,exercise_source_record_id:exercise.source_record_id,set_index:i+1,weight:17,weight_unit:'kg',notes:i===2?'A preserved pause note':null}));
const evidence={workout_source_record_id:workout.source_record_id,evidence_kind:'telemetry',evidence_status:'confirmed',field_names:['measurement_issue_reported']};
const data={workouts:[workout],exercises:[exercise],sets:steps,workoutEvidence:[evidence]},original=structuredClone(data);
const status=Object.fromEntries(['workouts','exercises','sets','body','segmental','nutrition','sourceMetrics','labs','treatments','polarSessions','goals','meals'].map(key=>[key,'ready']));
state.data=data;state.domainStatus=status;state.ui={openWorkout:workout.source_record_id,productTrainingView:'summary',trainingPeriod:'all'};
let html=renderProductTraining();
assert.match(html,/<strong> 3<\/strong>[\s\S]*?<small>Séries<\/small>/);
assert.match(html,/3 prolongamentos por drop ou rest-pause/);
assert.match(html,/possível mau posicionamento do sensor/);
state.ui.productTrainingView='exercises';html=renderProductTraining();
assert.match(html,/3 séries \+ 3 prolong\./);
assert.match(html,/Rest-pause/);assert.match(html,/× 2.5 reps/);
assert.match(html,/Observações registradas/);assert.match(html,/&lt;b&gt;from source&lt;\/b&gt;/);
assert.deepEqual(steps.map((_,i)=>setStepLabel(steps,i)),['S1','S2','Rest-pause','S3','Drop','Drop']);
const home=homeCockpitModel(data,status,'30',{},'2025-04-30');
assert.equal(home.evo.latestSession.setCount,3);assert.equal(home.evo.latestSession.extensionCount,3);
assert.equal(home.evo.trainingGroups.find(row=>row.label==='Costas').value,3);
assert.match(renderHomeCockpit(home),/3 séries \+ 3 prolongamentos/);
assert.deepEqual(data,original,'rendering preserves fractional repetitions, phases and source notes');
assert.equal(hasReportedMeasurementIssue(workout,[{...evidence,evidence_status:'candidate'}]),false);
assert.equal(hasReportedMeasurementIssue(workout,[{...evidence,workout_source_record_id:'other-session'}]),false);
assert.equal(hasReportedMeasurementIssue(workout,[]),false);
assert.deepEqual(trainingSetCounts([{phase:null},{phase:'other'}]),{primary:2,extensions:0,total:2});
state.ui.productTrainingView='summary';state.domainStatus.sets='error';
assert.doesNotMatch(renderProductTraining(),/3 prolongamentos/,'failed detail loading never presents a fabricated count');
console.log('Training session: primary/extension parity, fractional repetitions, source notes, scoped sensor caveat and loading failure checks passed.');
