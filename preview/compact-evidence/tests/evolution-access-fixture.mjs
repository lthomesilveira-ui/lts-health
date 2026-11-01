import {changesFixture,TODAY} from './dashboard-changes-fixture.mjs';
export {TODAY};
export function evolutionAccessFixture(){
 const f=changesFixture();
 f.data.body=Array.from({length:41},(_,i)=>({source_record_id:'observed-'+i,measured_at:`2026-${String(1+Math.floor(i/5)).padStart(2,'0')}-${String(i%5+1).padStart(2,'0')}`,source:'Synthetic historical report',device_name:null,weight_kg:90-i/10,body_fat_pct:20-i/20}));
 f.data.body[0].measured_at='2021-03-20';
 f.data.body[5].source='Synthetic alternate report';
 f.data.exercises=f.data.exercises.map(e=>({...e,machine:null}));
 f.data.workouts=f.data.workouts.map(w=>({...w,location:null}));
 // Invented dense history: missing phases stay unknown; the fourth record is
 // an explicit rest-pause extension. None of these loads are personal data.
 f.data.sets=f.data.sets.flatMap(set=>[17,23,31,39].map((weight,index)=>({...set,source_record_id:`${set.source_record_id}-dense-${index}`,set_index:index+1,weight,phase:index===3?'rest_pause':null,technique:null,reps_numeric:null,reps_raw:['11','9','4 + 1,5 parcial','3'][index],failure:index===3,near_failure:index===2})));
 const single={...f.data.exercises[1],source_record_id:'single-session-exercise',exercise:'Synthetic single-session press'};
 f.data.exercises.push(single);
 f.data.sets.push(...f.data.sets.filter(set=>set.exercise_source_record_id==='exercise-1').map((set,index)=>({...set,source_record_id:`single-session-set-${index}`,exercise_source_record_id:single.source_record_id})));
 return f;
}
