export const CONFIG = Object.freeze({
  url: 'https://plztdqyuqcjohiimudnr.supabase.co',
  key: 'sb_publishable_7SdlV1H52wVVbPEsN7i7hg_jbluJ8aI',
  bucket: 'health-inbox',
  inspectFunction: 'health-inspect-upload'
});

export const fixtureMode = new URLSearchParams(location.search).has('fixture');
export const sb = fixtureMode ? null : window.supabase.createClient(CONFIG.url, CONFIG.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export const state = {
  session: null,
  route: 'bio',
  loading: false,
  loaded: false,
  errors: {},
  data: {},
  ui: {
    bioMetric: 'weight_kg',
    compareA: null,
    compareB: null,
    trainingPeriod: '90',
    trainingQuery: '',
    openWorkout: null,
    exerciseQuery: '',
    selectedExercise: null,
    timelineDomain: 'all',
    timelineQuery: '',
    nutritionPeriod: '90',
    labQuery: '',
    selectedBiomarker: null,
    selectedCollection: null
  }
};

export const routes = new Set(['bio','treinos','evolucao','analise','tratamentos','hoje','timeline','saude','nutricao','dados']);

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const day = value => String(value ?? '').slice(0,10);
export const num = value => { const n = Number(value); return Number.isFinite(n) ? n : null; };
export const fmtNum = (value, digits=1) => num(value) == null ? '—' : Number(value).toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits});
export const fmtDate = value => { const s=day(value); if(!s) return '—'; const [y,m,d]=s.split('-'); return y&&m&&d?`${d}/${m}/${y}`:s; };
export const unique = values => [...new Set((values||[]).filter(Boolean))];
export const latest = (rows,key) => [...(rows||[])].filter(x=>x?.[key]).sort((a,b)=>String(b[key]).localeCompare(String(a[key])))[0] || null;
export const norm = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const since = days => { const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-Number(days)+1); return d.toISOString().slice(0,10); };
export const within = (value,days) => day(value) >= since(days);
export const neutralDelta = (a,b,digits=1,unit='') => { a=num(a); b=num(b); if(a==null||b==null) return '—'; const x=a-b; return `${x>0?'+':''}${fmtNum(x,digits)}${unit?` ${unit}`:''}`; };
export const bodyRows = () => [...(state.data.body||[])].sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at)));
export const workoutRows = () => [...(state.data.workouts||[])].sort((a,b)=>String(b.workout_date).localeCompare(String(a.workout_date)));
export const exercisesFor = workout => (state.data.exercises||[]).filter(e=>e.workout_source_record_id===workout.source_record_id).sort((a,b)=>(a.order_index??999)-(b.order_index??999));
export const setsFor = exercise => (state.data.sets||[]).filter(s=>s.exercise_source_record_id===exercise.source_record_id).sort((a,b)=>(a.set_index??999)-(b.set_index??999));

function fixtureData(){
  return {
    body:[
      {source_record_id:'body-1',measured_at:'2026-01-01',weight_kg:90,skeletal_muscle_mass_kg:45,fat_mass_kg:15,body_fat_pct:16.7,visceral_fat_level:7,score:82,source:'Teste'},
      {source_record_id:'body-2',measured_at:'2026-02-01',weight_kg:91,skeletal_muscle_mass_kg:46,fat_mass_kg:14,body_fat_pct:15.4,visceral_fat_level:6,score:84,source:'Teste'}
    ],
    segmental:[
      {source_record_id:'seg-1',measured_at:'2026-01-01',lean_right_arm_kg:4.2,lean_left_arm_kg:4.1,lean_trunk_kg:33.4,lean_right_leg_kg:10.8,lean_left_leg_kg:10.7,fat_right_arm_kg:1.1,fat_left_arm_kg:1.1,fat_trunk_kg:7.4,fat_right_leg_kg:2.2,fat_left_leg_kg:2.1,source:'Teste'},
      {source_record_id:'seg-2',measured_at:'2026-02-01',lean_right_arm_kg:4.4,lean_left_arm_kg:4.3,lean_trunk_kg:34,lean_right_leg_kg:11,lean_left_leg_kg:10.9,fat_right_arm_kg:1.0,fat_left_arm_kg:1.0,fat_trunk_kg:7,fat_right_leg_kg:2.1,fat_left_leg_kg:2.0,source:'Teste'}
    ],
    workouts:[
      {source_record_id:'workout-2',workout_date:'2026-02-02',workout_type:'Peito + ombros',location:'Academia de teste',duration_minutes:52,calories_kcal:430,heart_rate_avg:121,heart_rate_max:148,muscle_groups:['Peito','Ombros'],record_status:'validated',is_canonical:true,source:'Teste'},
      {source_record_id:'workout-1',workout_date:'2026-01-28',workout_type:'Costas + braços',location:'Academia de teste',duration_minutes:48,calories_kcal:390,heart_rate_avg:117,heart_rate_max:143,muscle_groups:['Costas','Bíceps','Tríceps'],record_status:'validated',is_canonical:true,source:'Teste'}
    ],
    exercises:[
      {source_record_id:'ex-1',workout_source_record_id:'workout-2',workout_date:'2026-02-02',order_index:1,exercise:'Supino máquina',machine:'Máquina de teste',muscle_group:'Peito',source:'Teste'},
      {source_record_id:'ex-2',workout_source_record_id:'workout-2',workout_date:'2026-02-02',order_index:2,exercise:'Voador',machine:'Máquina de teste',muscle_group:'Peito',source:'Teste'},
      {source_record_id:'ex-3',workout_source_record_id:'workout-1',workout_date:'2026-01-28',order_index:1,exercise:'Puxada alta',machine:'Máquina de teste',muscle_group:'Costas',source:'Teste'}
    ],
    sets:[
      {source_record_id:'set-1',exercise_source_record_id:'ex-1',workout_source_record_id:'workout-2',workout_date:'2026-02-02',set_index:1,phase:'working',weight:80,weight_unit:'kg',reps_numeric:10,reps_raw:'10',source:'Teste'},
      {source_record_id:'set-2',exercise_source_record_id:'ex-1',workout_source_record_id:'workout-2',workout_date:'2026-02-02',set_index:2,phase:'working',weight:90,weight_unit:'kg',reps_numeric:8,reps_raw:'8',source:'Teste'},
      {source_record_id:'set-3',exercise_source_record_id:'ex-2',workout_source_record_id:'workout-2',workout_date:'2026-02-02',set_index:1,phase:'working',weight:60,weight_unit:'kg',reps_numeric:12,reps_raw:'12',source:'Teste'},
      {source_record_id:'set-4',exercise_source_record_id:'ex-3',workout_source_record_id:'workout-1',workout_date:'2026-01-28',set_index:1,phase:'working',weight:55,weight_unit:'kg',reps_numeric:10,reps_raw:'10',source:'Teste'}
    ],
    labs:[
      {source_record_id:'lab-1',collection_date:'2026-02-03',report_date:'2026-02-03',laboratory:'Laboratório de teste',biomarker:'Marcador A',result_raw:'10',result_numeric:10,unit:'u',reference_range:'5–15',source:'Teste'},
      {source_record_id:'lab-2',collection_date:'2026-02-03',report_date:'2026-02-03',laboratory:'Laboratório de teste',biomarker:'Marcador B',result_raw:'20',result_numeric:20,unit:'mg/dL',reference_range:'10–30',source:'Teste'}
    ],
    docs:[{source_record_id:'doc-1',document_date:'2026-02-03',title:'Painel laboratorial',document_type:'Exame',source:'Teste',extraction_status:'structured'}],
    nutrition:[
      {source_record_id:'nut-1',nutrition_date:'2026-02-02',calories_kcal:2200,protein_g:150,carbs_g:240,fat_g:70,source:'Teste'},
      {source_record_id:'nut-2',nutrition_date:'2026-02-01',calories_kcal:2100,protein_g:145,carbs_g:225,fat_g:68,source:'Teste'}
    ],
    meals:[
      {source_record_id:'meal-1',meal_date:'2026-02-02',meal_name:'Almoço',calories_kcal:650,protein_g:45,carbs_g:70,fat_g:20,source:'Teste'},
      {source_record_id:'meal-2',meal_date:'2026-02-02',meal_name:'Jantar',calories_kcal:550,protein_g:40,carbs_g:55,fat_g:18,source:'Teste'}
    ],
    activity:[],
    metrics:[{source_record_id:'metric-1',measured_at:'2026-02-02T12:00:00Z',metric_type:'sleep_duration_h',value:7.4,unit:'h',source:'Teste'}],
    treatments:[{source_record_id:'treat-1',event_date:'2026-02-02',medication:'Tratamento registrado',event_type:'taken',source:'Teste',confidence:'high'}],
    uploads:[], quality:[]
  };
}

async function fetchAll(table, select='*', orderColumn=null, ascending=false, maxRows=5000){
  const pageSize=1000, rows=[];
  for(let from=0; from<maxRows; from+=pageSize){
    let q=sb.from(table).select(select).range(from,from+pageSize-1);
    if(orderColumn) q=q.order(orderColumn,{ascending});
    const {data,error}=await q;
    if(error) throw error;
    rows.push(...(data||[]));
    if(!data || data.length<pageSize) break;
  }
  return rows;
}

const jobs = () => ({
  body: () => fetchAll('health_body_composition','source_record_id,measured_at,weight_kg,skeletal_muscle_mass_kg,fat_mass_kg,body_fat_pct,body_water_l,visceral_fat_level,score,waist_hip_ratio,bmr_kcal,source,source_file,confidence,notes','measured_at',true,1000),
  segmental: () => fetchAll('health_segmental_composition','source_record_id,measured_at,lean_right_arm_kg,lean_left_arm_kg,lean_trunk_kg,lean_right_leg_kg,lean_left_leg_kg,fat_right_arm_kg,fat_left_arm_kg,fat_trunk_kg,fat_right_leg_kg,fat_left_leg_kg,source,source_file,confidence,notes','measured_at',true,1000),
  workouts: () => fetchAll('health_workouts','source_record_id,workout_date,workout_type,location,duration_minutes,calories_kcal,heart_rate_avg,heart_rate_min,heart_rate_max,muscle_groups,sets_by_group,source,source_file,confidence,notes,record_status,is_canonical','workout_date',false,1000),
  exercises: () => fetchAll('health_workout_exercises','source_record_id,workout_source_record_id,workout_date,order_index,exercise,machine,muscle_group,sets,reps,weight_kg,source,confidence,notes','workout_date',false,3000),
  sets: () => fetchAll('health_workout_sets','source_record_id,workout_source_record_id,exercise_source_record_id,workout_date,exercise_name,exercise_order,set_index,phase,weight,weight_unit,reps_numeric,reps_raw,failure,near_failure,technique,source,confidence,notes','workout_date',false,8000),
  labs: () => fetchAll('health_lab_results','source_record_id,collection_date,report_date,laboratory,biomarker,result_raw,result_numeric,unit,reference_range,flag,method,source,source_file,confidence,notes','collection_date',false,3000),
  docs: () => fetchAll('health_documents','source_record_id,document_date,title,document_type,source_file,source,extraction_status,confidence,notes','document_date',false,1500),
  nutrition: () => fetchAll('health_daily_nutrition','source_record_id,nutrition_date,calories_kcal,protein_g,carbs_g,fat_g,fiber_g,water_ml,source,source_file,confidence','nutrition_date',false,5000),
  meals: () => fetchAll('health_nutrition_meals','source_record_id,meal_date,meal_name,calories_kcal,protein_g,carbs_g,fat_g,source,source_file,confidence,record_status','meal_date',false,7000),
  activity: () => fetchAll('health_activity_records','source_record_id,activity_date,activity_name,activity_type,calories_kcal,duration_minutes,steps,source,source_file,confidence,record_status,is_adjustment','activity_date',false,6000),
  metrics: () => fetchAll('health_metrics','source_record_id,measured_at,metric_type,value,unit,source,source_file,confidence,notes','measured_at',false,6000),
  treatments: () => fetchAll('health_medication_events','source_record_id,event_date,medication,event_type,source,confidence','event_date',false,1500),
  uploads: () => fetchAll('health_uploads','id,source_type,original_filename,mime_type,size_bytes,status,created_at,processed_at,notes','created_at',false,1000),
  quality: () => fetchAll('health_data_quality_issues','source_record_id,issue_code,category,severity,status,entity_name,record_ref,description,detected_at,resolution_notes','detected_at',false,1500)
});

export async function loadData(onProgress=()=>{}){
  if(state.loading) return;
  state.loading=true; state.errors={}; onProgress('Atualizando…');
  if(fixtureMode){ state.data=fixtureData(); state.loaded=true; state.loading=false; onProgress('Atualizado'); return; }
  const result={};
  await Promise.all(Object.entries(jobs()).map(async ([key,job])=>{
    try { result[key]=await job(); }
    catch(error){ result[key]=[]; state.errors[key]=error?.message||String(error); }
  }));
  result.workouts=(result.workouts||[]).filter(w=>w.is_canonical!==false && w.record_status!=='quarantined');
  state.data=result; state.loaded=true; state.loading=false;
  onProgress(Object.keys(state.errors).length?'Alguns dados não carregaram':'Atualizado');
}

export async function signIn(email,password){
  if(fixtureMode){ state.session={user:{email:'fixture@example.com'}}; return state.session; }
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error) throw error;
  state.session=data.session; return data.session;
}

export async function signOut(){
  if(fixtureMode){ state.session=null; return; }
  await sb.auth.signOut(); state.session=null;
}

export async function restoreSession(){
  if(fixtureMode){ state.session={user:{email:'fixture@example.com'}}; return state.session; }
  const {data}=await sb.auth.getSession(); state.session=data.session; return data.session;
}

export function subscribeAuth(callback){
  if(fixtureMode) return {unsubscribe(){}};
  const {data}=sb.auth.onAuthStateChange((_event,session)=>{ state.session=session; callback(session); });
  return data.subscription;
}

export async function uploadFile(file,sourceType){
  if(fixtureMode) throw new Error('Upload indisponível no modo de teste.');
  const session=state.session || (await sb.auth.getSession()).data.session;
  if(!session?.user) throw new Error('Sessão expirada. Entre novamente.');
  if(!file) throw new Error('Escolha um arquivo.');
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_');
  const path=`${session.user.id}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${safeName}`;
  const {error:storageError}=await sb.storage.from(CONFIG.bucket).upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
  if(storageError) throw storageError;
  const payload={user_id:session.user.id,source_type:sourceType||'other',original_filename:file.name,storage_path:path,mime_type:file.type||null,size_bytes:file.size,status:'uploaded'};
  const {data:row,error:dbError}=await sb.from('health_uploads').insert(payload).select('id').single();
  if(dbError) throw dbError;
  const {error:fnError}=await sb.functions.invoke(CONFIG.inspectFunction,{body:{upload_id:row.id}});
  if(fnError) throw fnError;
  return row.id;
}
