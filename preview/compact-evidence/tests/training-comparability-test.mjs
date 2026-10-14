import assert from 'node:assert/strict';
import {trainingComparability} from '../src/training-comparability.js';
const base={workouts:[1,2].map(i=>({source_record_id:`w${i}`,workout_date:`2025-01-0${i}`,is_canonical:true,location:'Synthetic gym',source:'Synthetic source'})),exercises:[1,2].map(i=>({source_record_id:`e${i}`,workout_source_record_id:`w${i}`,exercise:'Synthetic press',machine:'Synthetic machine',source:'Synthetic source'})),sets:[1,2].map(i=>({source_record_id:`s${i}`,workout_source_record_id:`w${i}`,exercise_source_record_id:`e${i}`,phase:'working',weight:20+10*(i-1),weight_unit:'kg',reps_numeric:8,source:'Synthetic source',failure:false,near_failure:false,technique:'Recorded standard technique'}))};
const clone=()=>structuredClone(base),run=(data,extra={})=>trainingComparability(data,{today:'2025-02-01',...extra});
const snapshot=JSON.stringify(base);
let result=run(base);assert.equal(result.observed.length,1);assert.equal(result.comparable.length,1);assert.equal(result.observed[0].delta,null);assert.equal(result.observed[0].recordedDelta,10);assert.equal(result.observed[0].conditionsConfirmed,false);assert.equal(result.history.length,2);assert.equal(result.comparable[0].conditionsConfirmed,false);assert.equal(result.comparable[0].phaseConfirmedFromOriginal,false);
result=run(base,{});assert.equal(result.comparable.length,1);assert.equal(result.comparable[0].delta,10);
let d=clone();d.sets[1].failure=true;assert.equal(run(d,{}).observed.length,0);assert.equal(run(d,{}).comparable.length,0);
d=clone();d.sets[1].near_failure=true;assert.equal(run(d).observed.length,0);
d=clone();d.sets[1].failure=null;assert.equal(run(d).observed.length,0);
d=clone();d.sets=d.sets.map(row=>({...row,phase:null,failure:null,near_failure:null}));result=run(d,{});assert.equal(result.observed.length,1);assert.equal(result.comparable.length,0);assert.ok(result.observed[0].warnings.includes('phase_unknown'));assert.ok(result.observed[0].warnings.includes('effort_incomplete'));
d=clone();d.sets[1].phase=null;assert.equal(run(d).observed.length,0);
d=clone();d.sets.push({...d.sets[1],source_record_id:'s-extra',weight:45});result=run(d,{});assert.equal(result.observed.length,0);assert.equal(result.comparable.length,0);assert.equal(result.history.length,3);assert.ok(result.indeterminate.some(row=>row.reasons.includes('multiple_loads_same_context')));
d=clone();d.sets.push({...d.sets[1],source_record_id:'s-other-source',weight:45,source:'Other parser'});result=run(d);assert.equal(result.comparable.length,0,'provenance splitting cannot bypass an ambiguous observed day');
d=clone();d.sets.push({...d.sets[1],source_record_id:'s-repeat'});result=run(d);assert.equal(result.observed.length,1);assert.equal(result.observed[0].points[1].setCount,2);assert.deepEqual(result.observed[0].points[1].setIds,['s2','s-repeat']);
d=clone();d.workouts.push({...d.workouts[1],source_record_id:'w-extra'});d.exercises.push({...d.exercises[1],source_record_id:'e-extra',workout_source_record_id:'w-extra'});d.sets.push({...d.sets[1],source_record_id:'s-extra',workout_source_record_id:'w-extra',exercise_source_record_id:'e-extra'});result=run(d);assert.equal(result.observed.length,0);assert.ok(result.indeterminate.some(row=>row.reasons.includes('multiple_sessions_same_day')));
d=clone();d.exercises.push({...d.exercises[1],source_record_id:'e-extra'});d.sets.push({...d.sets[1],source_record_id:'s-extra',exercise_source_record_id:'e-extra'});assert.equal(run(d).observed.length,0);
for(const phase of ['warmup','other','drop','rest_pause',' DROP ','made-up-phase']){d=clone();d.sets=d.sets.map(row=>({...row,phase}));result=run(d);assert.equal(result.observed.length,0,phase);assert.equal(result.history.length,2);}
d=clone();d.sets=d.sets.map(row=>({...row,weight_unit:'source_value'}));assert.equal(run(d).observed.length,0);
d=clone();d.sets=d.sets.map(row=>({...row,reps_numeric:3.5}));result=run(d,{});assert.equal(result.observed.length,1);assert.equal(result.comparable.length,0);
d=clone();d.sets[1].technique='partial';assert.equal(run(d).observed.length,0);
d=clone();d.sets[1].source='Another parser';result=run(d);assert.equal(result.observed.length,1);assert.ok(result.observed[0].warnings.includes('provenance_labels_differ'));result=run(d);assert.equal(result.comparable.length,0);
d=clone();d.exercises[1].exercise='Synthetic  press';assert.equal(run(d).observed.length,1,'mechanical whitespace only');d.exercises[1].exercise='Alternate press name';assert.equal(run(d).observed.length,0,'no semantic aliases');
d=clone();d.sets.push({...d.sets[1]});result=run(d);assert.equal(result.observed.length,0);assert.equal(result.history.length,3);
d=clone();d.exercises.push({...d.exercises[1]});assert.equal(run(d).observed.length,0);
d=clone();d.workouts.push({...d.workouts[1]});assert.equal(run(d).observed.length,0);
for(const missingId of [null,undefined,'','  ',false,0]){
 d=clone();d.exercises[0].source_record_id=missingId;d.sets[0].exercise_source_record_id=missingId;
 const before=JSON.stringify(d);result=run(d);assert.equal(result.observed.length,0,'anonymous exercise cannot join a set through a missing ID');assert.equal(result.comparable.length,0);assert.equal(result.history.length,2);assert.equal(result.history[0].exercise,null);assert.ok(result.history[0].reasons.includes('missing_exercise_identity'));assert.equal(JSON.stringify(d),before);
 d=clone();d.workouts[0].source_record_id=missingId;d.exercises[0].workout_source_record_id=missingId;d.sets[0].workout_source_record_id=missingId;
 result=run(d);assert.equal(result.observed.length,0,'anonymous workout cannot join through a missing ID');assert.equal(result.comparable.length,0);assert.equal(result.history.length,2);assert.equal(result.history[0].workout,null);assert.equal(result.history[0].exercise,null);assert.ok(result.history[0].reasons.includes('missing_workout_identity'));
}
d=clone();d.exercises[0].source_record_id=null;delete d.sets[0].exercise_source_record_id;result=run(d);assert.equal(result.observed.length,0,'null and absent exercise IDs cannot collapse into one JSON key');assert.equal(result.history.length,2);
d=clone();delete d.workouts[0].source_record_id;delete d.exercises[0].workout_source_record_id;delete d.sets[0].workout_source_record_id;result=run(d);assert.equal(result.observed.length,0,'absent workout IDs cannot be Map keys');assert.ok(result.history[0].reasons.includes('missing_workout_identity'));
d=clone();d.sets[1].workout_date='2025-01-03';assert.equal(run(d).observed.length,0);
d=clone();d.workouts[1].workout_date='2025-01-02invalid';assert.equal(run(d).observed.length,0);
d=clone();d.workouts[1].workout_date='2025-02-30';assert.equal(run(d).observed.length,0);
d=clone();d.sets[1].workout_source_record_id='w1';assert.equal(run(d).observed.length,0);
d=clone();d.workouts[1].is_canonical=false;assert.equal(run(d).observed.length,0);
d=clone();d.workouts[1].record_status='quarantined';assert.equal(run(d).observed.length,0);
assert.equal(run(base,{today:'2025-01-02',closedOnly:true}).observed.length,0);assert.equal(run(base,{today:'2025-01-02',closedOnly:false}).observed.length,1);assert.equal(run(base,{bounds:{start:'2025-01-02',end:'2025-01-31'}}).observed.length,0);
for(const key of ['technique','failure','near_failure','source']){d=clone();d.sets=d.sets.map(row=>({...row,[key]:null}));result=run(d);assert.equal(result.comparable.length,0,key);assert.equal(result.observed.length,1,key);}
assert.equal(JSON.stringify(base),snapshot);
console.log('Training comparability: observed/recorded-comparable/indeterminate states, explicit recorded fields, preserved unknowns and source changes, ambiguity without maxima, history retention, identity/date integrity, exclusions, fractional reps and no mutation passed.');
