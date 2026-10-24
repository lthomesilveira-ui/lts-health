import {changesFixture,TODAY} from './dashboard-changes-fixture.mjs';
export {TODAY};
export function evolutionAccessFixture(){
 const f=changesFixture();
 f.data.body=Array.from({length:41},(_,i)=>({source_record_id:'observed-'+i,measured_at:`2026-${String(1+Math.floor(i/5)).padStart(2,'0')}-${String(i%5+1).padStart(2,'0')}`,source:'Synthetic historical report',device_name:null,weight_kg:90-i/10,body_fat_pct:20-i/20}));
 f.data.exercises=f.data.exercises.map(e=>({...e,machine:null}));
 f.data.workouts=f.data.workouts.map(w=>({...w,location:null}));
 f.data.sets=f.data.sets.map(s=>({...s,technique:null,reps_raw:'4 + 1,5 parcial'}));
 return f;
}
