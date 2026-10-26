import assert from 'node:assert/strict';
import {decorateWorkoutProvenance} from './src/workout-evidence.js';
const row={source_record_id:'invented-workout',workout_date:'2001-04-02',source:'workout log',duration_minutes:42,calories_kcal:321,heart_rate_avg:123,raw_exercises:'Invented original exercise text'};
const original=structuredClone(row);
let [actual]=decorateWorkoutProvenance([row]);
assert.equal(actual.telemetry_energy_is_estimated,false);assert.equal(actual.telemetry_duration_is_approximate,false);
assert.equal(actual.telemetry_provenance_status,'unknown');
const documented={...row,documented_energy_kind:'estimate',documented_duration_kind:'approximate'};
[actual]=decorateWorkoutProvenance([documented]);
assert.equal(actual.telemetry_energy_is_estimated,true);assert.equal(actual.telemetry_duration_is_approximate,true);
assert.equal(actual.telemetry_provenance_status,'unknown','a documented estimate is not confirmed device telemetry');
assert.deepEqual(actual.telemetry_source_names,[]);
for(const key of ['duration_minutes','calories_kcal','heart_rate_avg','raw_exercises'])assert.equal(actual[key],row[key],'qualifiers cannot replace original measurements');
for(const kind of [null,undefined,'','estimated','ESTIMATE','PRIVATE_VALUE',true,{}]){
 const [unsupported]=decorateWorkoutProvenance([{...row,documented_energy_kind:kind,documented_duration_kind:kind,notes:'estimated approximate'}]);
 assert.equal(unsupported.telemetry_energy_is_estimated,false);assert.equal(unsupported.telemetry_duration_is_approximate,false,'raw words do not establish verified qualifiers');
}
const evidence=[{workout_source_record_id:row.source_record_id,evidence_kind:'telemetry',evidence_status:'confirmed',source_name:'Invented device',field_names:['estimated_session_calories_kcal','partial_heart_rate_avg']}];
[actual]=decorateWorkoutProvenance([row],evidence);
assert.equal(actual.telemetry_energy_is_estimated,true);assert.equal(actual.telemetry_heart_rate_is_partial,true);assert.equal(actual.telemetry_provenance_status,'confirmed');
assert.deepEqual(row,original,'source records are never modified by display qualifiers');
console.log('Documented legacy estimates and approximate durations preserve values, unknown origins, strict qualifiers and existing confirmed evidence.');
