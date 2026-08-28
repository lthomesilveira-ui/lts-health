import {sb,state,fixtureMode,fixtureError,fixtureData} from './core.js';

const initialKeys=['body','segmental','workouts','exercises','sets'];
const routeDomains={
  bio:[],
  treinos:[],
  evolucao:[],
  analise:['nutrition','metrics','labs'],
  tratamentos:['treatments'],
  hoje:['nutrition','metrics','labs','uploads'],
  timeline:['nutrition','activity','metrics','labs','docs','treatments'],
  saude:['labs','docs'],
  nutricao:['nutrition','meals'],
  dados:['nutrition','meals','activity','metrics','labs','docs','uploads','quality']
};

async function fetchAll(table,select='*',orderColumn=null,ascending=false,maxRows=5000){
  const pageSize=1000,rows=[];
  for(let from=0;from<maxRows;from+=pageSize){
    let q=sb.from(table).select(select).range(from,from+pageSize-1);
    if(orderColumn)q=q.order(orderColumn,{ascending});
    const{data,error}=await q;if(error)throw error;rows.push(...(data||[]));if(!data||data.length<pageSize)break;
  }
  return rows;
}

const loaders={
  body:()=>fetchAll('health_body_composition','source_record_id,measured_at,weight_kg,skeletal_muscle_mass_kg,fat_mass_kg,body_fat_pct,body_water_l,visceral_fat_level,score,waist_hip_ratio,bmr_kcal,source,source_file,confidence,notes','measured_at',true,1000),
  segmental:()=>fetchAll('health_segmental_composition','source_record_id,measured_at,lean_right_arm_kg,lean_left_arm_kg,lean_trunk_kg,lean_right_leg_kg,lean_left_leg_kg,fat_right_arm_kg,fat_left_arm_kg,fat_trunk_kg,fat_right_leg_kg,fat_left_leg_kg,source,source_file,confidence,notes','measured_at',true,1000),
  workouts:()=>fetchAll('health_workouts','source_record_id,workout_date,workout_type,location,duration_minutes,calories_kcal,heart_rate_avg,heart_rate_min,heart_rate_max,muscle_groups,sets_by_group,source,source_file,confidence,notes,record_status,is_canonical','workout_date',false,1000),
  exercises:()=>fetchAll('health_workout_exercises','source_record_id,workout_source_record_id,workout_date,order_index,exercise,machine,muscle_group,sets,reps,weight_kg,source,confidence,notes','workout_date',false,3000),
  sets:()=>fetchAll('health_workout_sets','source_record_id,workout_source_record_id,exercise_source_record_id,workout_date,exercise_name,exercise_order,set_index,phase,weight,weight_unit,reps_numeric,reps_raw,failure,near_failure,technique,source,confidence,notes','workout_date',false,8000),
  labs:()=>fetchAll('health_lab_results','source_record_id,collection_date,report_date,laboratory,biomarker,result_raw,result_numeric,unit,reference_range,flag,method,source,source_file,confidence,notes','collection_date',false,3000),
  docs:()=>fetchAll('health_documents','source_record_id,document_date,title,document_type,source_file,source,extraction_status,confidence,notes','document_date',false,1500),
  treatments:()=>fetchAll('health_medication_events','source_record_id,event_date,medication,event_type,source,confidence','event_date',false,1500),
  uploads:()=>fetchAll('health_uploads','id,source_type,original_filename,mime_type,size_bytes,status,created_at,processed_at,notes','created_at',false,1000),
  quality:()=>fetchAll('health_data_quality_issues','source_record_id,issue_code,category,severity,status,entity_name,record_ref,description,detected_at,resolution_notes','detected_at',false,1500),
  nutrition:()=>fetchAll('health_daily_nutrition','source_record_id,nutrition_date,calories_kcal,protein_g,carbs_g,fat_g,fiber_g,water_ml,source,source_file,confidence','nutrition_date',false,5000),
  meals:()=>fetchAll('health_nutrition_meals','source_record_id,meal_date,meal_name,calories_kcal,protein_g,carbs_g,fat_g,source,source_file,confidence,record_status','meal_date',false,7000),
  activity:()=>fetchAll('health_activity_records','source_record_id,activity_date,activity_name,activity_type,calories_kcal,duration_minutes,steps,source,source_file,confidence,record_status,is_adjustment','activity_date',false,6000),
  metrics:()=>fetchAll('health_metrics','source_record_id,measured_at,metric_type,value,unit,source,source_file,confidence,notes','measured_at',false,6000)
};

function setFixture(){
  state.data=fixtureData();state.errors={};state.domainStatus={};
  Object.keys(loaders).forEach(k=>state.domainStatus[k]='ready');
  if(fixtureError&&Object.hasOwn(loaders,fixtureError)){
    state.data[fixtureError]=[];
    state.errors[fixtureError]='Falha simulada de carregamento.';
    state.domainStatus[fixtureError]='error';
  }
  state.loaded=true;state.loading=false;
}

async function loadKey(key,force=false){
  if(fixtureMode)return;
  if(!force&&state.domainStatus[key]==='ready')return;
  if(state.domainStatus[key]==='loading')return;
  state.domainStatus[key]='loading';
  try{
    const rows=await loaders[key]();
    state.data[key]=key==='workouts'?rows.filter(w=>w.is_canonical!==false&&w.record_status!=='quarantined'):rows;
    delete state.errors[key];state.domainStatus[key]='ready';
  }catch(error){
    state.data[key]=state.data[key]||[];state.errors[key]=error?.message||String(error);state.domainStatus[key]='error';
  }
}

export async function loadInitialData(onProgress=()=>{}){
  state.loading=true;state.errors={};onProgress('Atualizando…');
  if(fixtureMode){setFixture();onProgress(fixtureError?'Alguns dados não carregaram':'Atualizado');return;}
  await Promise.all(initialKeys.map(k=>loadKey(k,true)));
  state.loaded=true;state.loading=false;
  onProgress(initialKeys.some(k=>state.domainStatus[k]==='error')?'Alguns dados não carregaram':'Atualizado');
}

export function isRouteReady(route){
  if(!state.loaded)return false;
  return(routeDomains[route]||[]).every(k=>state.domainStatus[k]==='ready'||state.domainStatus[k]==='error');
}

export async function ensureRouteData(route,onProgress=()=>{}){
  if(fixtureMode)return;
  const keys=routeDomains[route]||[],missing=keys.filter(k=>state.domainStatus[k]!=='ready'&&state.domainStatus[k]!=='error');
  if(!missing.length)return;
  onProgress('Carregando…');await Promise.all(missing.map(k=>loadKey(k)));
  onProgress(missing.some(k=>state.domainStatus[k]==='error')?'Alguns dados não carregaram':'Atualizado');
}

export async function refreshData(route,onProgress=()=>{}){
  if(fixtureMode){setFixture();onProgress(fixtureError?'Alguns dados não carregaram':'Atualizado');return;}
  state.domainStatus={};state.data={};state.errors={};await loadInitialData(onProgress);await ensureRouteData(route,onProgress);
}
