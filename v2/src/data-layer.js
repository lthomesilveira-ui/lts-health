import {sb,state,fixtureMode,fixtureError,fixtureData,norm} from './core.js';
import {stableAppleMetricTypes} from './source-status.js';

const initialKeys=['body','segmental','workouts','exercises','sets'];
const routeDomains={
  bio:[],
  treinos:[],
  evolucao:[],
  analise:['nutrition','metrics','labs'],
  tratamentos:['treatments'],
  hoje:['nutrition','metrics','sourceMetrics','labs','uploads'],
  timeline:['nutrition','activity','metrics','labs','docs','treatments'],
  saude:['labs','docs'],
  nutricao:['nutrition','meals'],
  dados:['nutrition','meals','activity','metrics','sourceMetrics','labs','docs','uploads','previews','quality']
};

export async function fetchAll(table,select='*',orderColumn=null,ascending=false,tieBreaker='source_record_id',client=sb){
  const pageSize=1000,rows=[];
  for(let from=0;;from+=pageSize){
    let q=client.from(table).select(select).range(from,from+pageSize-1);
    if(orderColumn)q=q.order(orderColumn,{ascending});
    if(tieBreaker&&tieBreaker!==orderColumn)q=q.order(tieBreaker,{ascending:true});
    const{data,error}=await q;
    if(error)throw error;
    const page=data||[];
    rows.push(...page);
    if(page.length<pageSize)break;
  }
  return rows;
}

const loaders={
  body:()=>fetchAll('health_body_composition','source_record_id,measured_at,weight_kg,skeletal_muscle_mass_kg,fat_mass_kg,body_fat_pct,body_water_l,visceral_fat_level,score,waist_hip_ratio,bmr_kcal,source,source_file,confidence,notes','measured_at',true),
  segmental:()=>fetchAll('health_segmental_composition','source_record_id,measured_at,lean_right_arm_kg,lean_left_arm_kg,lean_trunk_kg,lean_right_leg_kg,lean_left_leg_kg,fat_right_arm_kg,fat_left_arm_kg,fat_trunk_kg,fat_right_leg_kg,fat_left_leg_kg,source,source_file,confidence,notes','measured_at',true),
  workouts:()=>fetchAll('health_workouts','source_record_id,workout_date,workout_type,location,duration_minutes,calories_kcal,heart_rate_avg,heart_rate_min,heart_rate_max,muscle_groups,sets_by_group,raw_exercises,source,source_file,confidence,notes,record_status,is_canonical','workout_date',false),
  exercises:()=>fetchAll('health_workout_exercises','source_record_id,workout_source_record_id,workout_date,order_index,exercise,machine,muscle_group,sets,reps,weight_kg,source_text,source,confidence,notes','workout_date',false),
  sets:()=>fetchAll('health_workout_sets','source_record_id,workout_source_record_id,exercise_source_record_id,workout_date,exercise_name,exercise_order,set_index,phase,weight,weight_unit,reps_numeric,reps_raw,failure,near_failure,technique,source,confidence,notes','workout_date',false),
  labs:()=>fetchAll('health_lab_results','source_record_id,collection_date,report_date,laboratory,biomarker,result_raw,result_numeric,unit,reference_range,flag,method,source,source_file,confidence,notes','collection_date',false),
  docs:()=>fetchAll('health_documents','source_record_id,document_date,title,document_type,source_file,source,extraction_status,confidence,notes','document_date',false),
  treatments:()=>fetchAll('health_medication_events','source_record_id,event_date,medication,event_type,source,confidence','event_date',false),
  uploads:()=>fetchAll('health_uploads','id,source_type,original_filename,mime_type,size_bytes,status,created_at,processed_at,notes','created_at',false,'id'),
  previews:()=>fetchAll('health_ingestion_previews','upload_id,source_type,parser_version,detected_format,detected_schema,row_count,date_min,date_max,status,warnings,error_message,updated_at','updated_at',false,'upload_id'),
  quality:()=>fetchAll('health_data_quality_issues','source_record_id,issue_code,category,severity,status,entity_name,record_ref,description,detected_at,resolution_notes','detected_at',false,'issue_code'),
  nutrition:()=>fetchAll('health_daily_nutrition','source_record_id,nutrition_date,calories_kcal,protein_g,carbs_g,fat_g,fiber_g,water_ml,source,source_file,confidence','nutrition_date',false),
  meals:()=>fetchAll('health_nutrition_meals','source_record_id,meal_date,meal_name,calories_kcal,protein_g,carbs_g,fat_g,source,source_file,confidence,record_status','meal_date',false),
  activity:()=>fetchAll('health_activity_records','source_record_id,activity_date,activity_name,activity_type,calories_kcal,duration_minutes,steps,source,source_file,confidence,record_status,is_adjustment','activity_date',false),
  metrics:()=>fetchAll('health_metrics','source_record_id,measured_at,metric_type,value,unit,source,source_file,confidence,notes','measured_at',false),
  sourceMetrics:()=>fetchAll('health_source_daily_metrics','source_record_id,metric_date,metric_type,value,unit,source_name,source_family,canonical_status,confidence,source_file','metric_date',false)
};

const backupLoaders={...loaders};
const fixtureSourceMetrics=[{
  source_record_id:'source-metric-candidate-1',metric_date:'2026-02-02',metric_type:'steps',value:7100,unit:'count',
  source_name:'Dispositivo de teste',source_family:'test_device',canonical_status:'candidate',confidence:'high',source_file:'fixture-source'
}];

function appleMetricSource(row){return norm([row?.source,row?.source_file].filter(Boolean).join(' '));}
function isAppleMetric(row){
  const source=appleMetricSource(row);
  return ['apple health','healthkit','activitysummary','activity summary','apple watch','apple_watch','iphone'].some(term=>source.includes(term));
}
function isAppleActivitySummary(row){
  const source=appleMetricSource(row);
  return source.includes('activitysummary')||source.includes('activity summary');
}

export function visibleRowsForDomain(key,rows=[]){
  if(key==='metrics')return rows.filter(row=>{
    if(!isAppleMetric(row))return true;
    return isAppleActivitySummary(row)&&stableAppleMetricTypes.has(row?.metric_type);
  });
  if(key==='nutrition')return rows.filter(row=>{
    const source=norm(row?.source);
    return !(source.includes('myfitnesspal')&&source.includes('apple health'));
  });
  if(key==='workouts')return rows.filter(row=>row?.is_canonical===true&&row?.record_status!=='quarantined');
  return rows;
}

export function visibleWorkoutChildren(workouts=[],exercises=[],sets=[]){
  const workoutIds=new Set((workouts||[]).map(row=>row?.source_record_id).filter(Boolean));
  return {
    exercises:(exercises||[]).filter(row=>workoutIds.has(row?.workout_source_record_id)),
    sets:(sets||[]).filter(row=>workoutIds.has(row?.workout_source_record_id))
  };
}

function enforceStructuredWorkoutBoundary(){
  if(state.domainStatus.workouts!=='ready')return;
  const {exercises,sets}=visibleWorkoutChildren(state.data.workouts||[],state.data.exercises||[],state.data.sets||[]);
  if(state.domainStatus.exercises==='ready')state.data.exercises=exercises;
  if(state.domainStatus.sets==='ready')state.data.sets=sets;
}

function setFixture(){
  state.data={...fixtureData(),sourceMetrics:fixtureSourceMetrics};state.errors={};state.domainStatus={};
  Object.keys(loaders).forEach(k=>state.domainStatus[k]='ready');
  if(fixtureError&&Object.hasOwn(loaders,fixtureError)){
    state.data[fixtureError]=[];
    state.errors[fixtureError]='Falha simulada de carregamento.';
    state.domainStatus[fixtureError]='error';
  }
  state.loaded=true;state.loading=false;
}

export function refreshFailureMessage(error,hadPrevious=false){
  const base=error?.message||String(error||'Falha ao atualizar dados.');
  return hadPrevious?`${base} Dados anteriores mantidos.`:base;
}

async function loadKey(key,force=false){
  if(fixtureMode)return;
  if(!force&&state.domainStatus[key]==='ready')return;
  if(state.domainStatus[key]==='loading')return;
  const hadPrevious=Object.hasOwn(state.data,key);
  state.domainStatus[key]='loading';
  try{
    const rows=await loaders[key](),visibleRows=visibleRowsForDomain(key,rows);
    state.data[key]=visibleRows;
    delete state.errors[key];state.domainStatus[key]='ready';
  }catch(error){
    if(!hadPrevious)state.data[key]=[];
    state.errors[key]=refreshFailureMessage(error,hadPrevious);
    state.domainStatus[key]='error';
  }
}

export async function loadInitialData(onProgress=()=>{}){
  state.loading=true;state.errors={};onProgress('Atualizando…');
  if(fixtureMode){setFixture();onProgress(fixtureError?'Alguns dados não carregaram':'Atualizado');return;}
  await Promise.all(initialKeys.map(k=>loadKey(k,true)));
  enforceStructuredWorkoutBoundary();
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
  state.domainStatus={};state.errors={};
  await loadInitialData(onProgress);
  await ensureRouteData(route,onProgress);
  const refreshed=[...new Set([...initialKeys,...(routeDomains[route]||[])])];
  if(refreshed.some(k=>state.domainStatus[k]==='error'))onProgress('Atualização parcial; dados anteriores foram mantidos onde houve falha.');
}

export function localBackupDate(value=new Date()){
  const d=value instanceof Date?value:new Date(value);
  const year=d.getFullYear(),month=String(d.getMonth()+1).padStart(2,'0'),localDay=String(d.getDate()).padStart(2,'0');
  return `${year}-${month}-${localDay}`;
}

export async function buildStructuredBackup(onProgress=()=>{}){
  onProgress('Preparando backup…');
  let data;
  if(fixtureMode)data={...fixtureData(),sourceMetrics:fixtureSourceMetrics};
  else{
    const entries=Object.entries(backupLoaders),results=await Promise.allSettled(entries.map(([,loader])=>loader()));
    const failures=results.map((result,index)=>result.status==='rejected'?{domain:entries[index][0],message:result.reason?.message||String(result.reason)}:null).filter(Boolean);
    if(failures.length){
      const error=new Error(`backup_incomplete:${failures.map(f=>f.domain).join(',')}`);
      error.domains=failures.map(f=>f.domain);error.failures=failures;
      onProgress('Backup não criado');throw error;
    }
    data=Object.fromEntries(results.map((result,index)=>[entries[index][0],result.value]));
  }
  const counts=Object.fromEntries(Object.entries(data).map(([key,rows])=>[key,Array.isArray(rows)?rows.length:0]));
  const domains=Object.keys(backupLoaders),missingDomains=domains.filter(key=>!Object.hasOwn(data,key));
  if(missingDomains.length){const error=new Error(`backup_incomplete:${missingDomains.join(',')}`);error.domains=missingDomains;onProgress('Backup não criado');throw error;}
  const backup={
    format:'lts-health-structured-backup',
    schema_version:2,
    exported_at:new Date().toISOString(),
    scope:'structured_records_only',
    complete:true,
    structured_complete:true,
    includes_private_files:false,
    includes_credentials:false,
    components:{structured_records:'included',private_original_files:'not_included',credentials_and_tokens:'not_included'},
    domain_count:domains.length,
    domains,
    counts,
    notes:[
      'Backup estruturado completo dos domínios suportados e acessíveis à sessão atual no momento da exportação.',
      'O campo complete se refere somente ao escopo structured_records_only; não significa cópia dos arquivos privados originais.',
      'Métricas por origem são preservadas separadamente em sourceMetrics para manter proveniência e candidatos ainda não promovidos a métricas canônicas.',
      'O backup de sourceMetrics preserva apenas campos estruturados de proveniência; payloads brutos de origem ficam de fora.',
      'Se qualquer domínio falhar durante a leitura, nenhum arquivo de backup é baixado.',
      'Arquivos originais armazenados na área privada não são incorporados neste JSON.',
      'Credenciais, tokens e segredos de autenticação não são exportados.',
      'Campos ausentes permanecem ausentes; nenhum valor é reconstruído por estimativa.'
    ],
    data
  };
  onProgress('Backup pronto');
  return backup;
}

export async function downloadStructuredBackup(onProgress=()=>{}){
  const backup=await buildStructuredBackup(onProgress),date=localBackupDate(),filename=`lts-health-backup-${date}.json`;
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;link.style.display='none';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  return{filename,counts:backup.counts,complete:backup.complete,structuredComplete:backup.structured_complete,domainCount:backup.domain_count};
}
