// Entirely synthetic records. No accounts, health records or remote requests.
export const TODAY='2026-10-17';
export function changesFixture(){
 const data=Object.fromEntries(['body','labs','workouts','exercises','sets','nutrition','sourceMetrics','metrics','docs','regimens','treatments','goals','waterReferences','polarSessions','workoutEvidence','segmental','meals','uploads'].map(k=>[k,[]]));
 const status=Object.fromEntries(Object.keys(data).map(k=>[k,'ready']));
 for(const [i,date] of ['2026-10-11','2026-10-15'].entries()){
  data.body.push({source_record_id:'body-'+i,measured_at:date,source:'Synthetic body report',device_name:'Synthetic model',weight_kg:80-i,fat_mass_kg:16-i*.2,skeletal_muscle_mass_kg:34+i*.1});
  data.labs.push({source_record_id:'lab-'+i,collection_date:date,biomarker:'Synthetic marker',result_numeric:12+i,result_raw:String(12+i),unit:'u',laboratory:'Synthetic laboratory',method:'Synthetic method',reference_range:'10 a 18 u',source:'Synthetic report'});
  data.workouts.push({source_record_id:'workout-'+i,workout_date:date,is_canonical:true,record_status:'validated',source:'Synthetic notes',location:'Synthetic gym',workout_type:'Synthetic session'});
  data.exercises.push({source_record_id:'exercise-'+i,workout_source_record_id:'workout-'+i,workout_date:date,exercise:'Synthetic press',machine:'Synthetic machine',source:'Synthetic notes'});
  data.sets.push({source_record_id:'set-'+i,exercise_source_record_id:'exercise-'+i,workout_source_record_id:'workout-'+i,workout_date:date,phase:'working',weight:20+i*5,weight_unit:'kg',reps_numeric:8,source:'Synthetic notes',technique:'Recorded standard technique',failure:false,near_failure:false});
 }
 data.nutrition.push({nutrition_date:'2026-10-15',source:'Synthetic food',protein_g:60,water_ml:500});
 data.goals.push({effective_from:'2026-01-01',water_ml:2000,protein_g:100});
 data.docs.push({source_record_id:'synthetic-care',document_date:'2026-10-15',document_type:'care_followup',source:'Synthetic document',care_context:{schema_version:1,title:'Synthetic context',followups:[{key:'synthetic-followup',label:'Synthetic documented follow-up',resolved:false}]}});
 return {data,status,ui:{dashboardMode:'period',dashboardPeriod:'7',homePeriod:'7'},today:TODAY};
}
