export const PLAN_TODAY='2026-02-02';
export function syntheticTrainingPlan(){
  const source_record_id='synthetic-document-plan',checksum='d'.repeat(64),document_date='2026-01-25';
  const exercise=(id,name)=>({id,name,sets:2,reps:[8,12],rest_seconds:[60,90],per_side:false,alternatives:[],instructions:{text:'Synthetic source instruction.',pages:[1]}});
  return {source_record_id,document_date,document_type:'training_plan',source_file:'Synthetic training document.pdf',source:'Synthetic practice',checksum,training_plan:{schema_version:1,type:'documented_training_plan',source_record_id,source_sha256:checksum,documented_on:document_date,received_on:document_date,page_count:2,clinical_start:null,clinical_start_status:'not_confirmed',verification:{status:'source_verified',pages:[1,2]},author:'Synthetic clinician',weeks:6,sessions_per_week:3,rest_hours:48,musculation_minutes:[40,60],initial_rir:[3,4],initial_cardio:{blocks:3,minutes:[10,15],pages:[2]},sessions:[{id:'A',name:'Ficha A sintética',pages:[1],exercises:[exercise('A1','Movimento Alpha'),exercise('A2','Movimento Beta')]},{id:'B',name:'Ficha B sintética',pages:[2],exercises:[exercise('B1','Movimento Gama')]}],notes:[{text:'Synthetic documented condition.',pages:[2]}],progression:[{text:'Progress only following documented review.',pages:[2]}]}};
}
export function syntheticTreatmentStatus(){
  const source_record_id='synthetic-status-report',checksum='e'.repeat(64),document_date=PLAN_TODAY;
  return {source_record_id,document_date,document_type:'patient_status',source_file:'Synthetic owner statement',source:'Synthetic owner',checksum,treatment_status:{schema_version:1,type:'patient_confirmed_treatment_status',source_record_id,source_sha256:checksum,documented_on:document_date,received_on:document_date,effective_start:null,verification:{status:'owner_statement'},statement:'Synthetic statement.',in_use:['Item Alpha','Item Beta','Item Gama'],other_protocol_medications:'not_started'}};
}
export function syntheticPlanData(){
  const w={source_record_id:'synthetic-session',workout_date:'2026-01-30',workout_type:'Sessão sintética',location:'Synthetic gym',is_canonical:true,record_status:'validated'};
  const ex=(id,name,index)=>({source_record_id:id,workout_source_record_id:w.source_record_id,workout_date:w.workout_date,exercise:name,order_index:index});
  const set=(id,exercise,index,extra={})=>({source_record_id:id,workout_source_record_id:w.source_record_id,exercise_source_record_id:exercise,workout_date:w.workout_date,set_index:index,phase:'working',reps_numeric:10,failure:false,...extra});
  const data={trainingPlans:[syntheticTrainingPlan()],treatmentStatuses:[syntheticTreatmentStatus()],workouts:[w],exercises:[ex('synthetic-ex-a','Movimento Alpha',1),ex('synthetic-ex-b','Movimento Beta',2)],sets:[set('s-warm','synthetic-ex-a',1,{phase:'warmup',reps_numeric:15}),set('s-a1','synthetic-ex-a',2),set('s-a2','synthetic-ex-a',3,{reps_numeric:6,failure:true}),set('s-drop','synthetic-ex-a',4,{phase:'drop',technique:'drop set',reps_numeric:4}),set('s-b1','synthetic-ex-b',1,{phase:'unknown',failure:null})]};
  return {data,status:Object.fromEntries(Object.keys(data).map(k=>[k,'ready']))};
}
