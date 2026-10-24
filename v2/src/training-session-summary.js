import {isSetExtension,trainingSetCounts} from './training-session.js';

// A descriptive summary of one explicitly canonical session. This module does
// not estimate workload, infer anatomy, or establish historical comparability.
const identity=value=>typeof value==='string'&&value.trim()?value:null;
const string=value=>typeof value==='string'&&value.trim()?value:null;
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const stable=value=>Array.isArray(value)?value.map(stable):record(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const fingerprint=value=>JSON.stringify(stable(value));
const day=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(value))return null;
  const date=value.slice(0,10),parsed=new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:null;
};
const compatibleDate=(row,date)=>row.workout_date==null||day(row.workout_date)===date;
const sourceState=(data,status,key)=>status[key]==='ready'?(Array.isArray(data[key])?'ready':'unavailable'):['error','loading'].includes(status[key])?status[key]:'unavailable';
const nullCounts=()=>({primary:null,extensions:null,total:null});
const order=value=>(typeof value==='number'||typeof value==='string'&&value.trim())&&Number.isFinite(Number(value))?Number(value):Infinity;
const ordered=(rows,field)=>rows.map(stable).sort((a,b)=>order(a[field])-order(b[field])||a.source_record_id.localeCompare(b.source_record_id));
const groupLabel=value=>{
  if(typeof value!=='string'||!value.trim())return null;
  // Only missing-value labels are classified. Real labels are preserved
  // literally, including compound labels; there is no synonym/anatomy map.
  const missing=value.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return ['unknown','desconhecido','nao informado','nao informada','nao especificado','n/a'].includes(missing)?null:value;
};

function deduplicate(rows,relevant,domain,reasons){
  const groups=new Map(),accepted=[];
  let duplicates=0,excluded=0;
  for(const row of rows){
    if(!record(row))continue;
    const id=identity(row.source_record_id);
    if(!id){if(relevant(row)){excluded++;reasons.add(`${domain}_identity_missing`);}continue;}
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push(row);
  }
  // Inspect identities globally before filtering to the selected session, so a
  // conflicting ID under another parent cannot become a valid local record.
  for(const list of groups.values()){
    const local=list.filter(relevant);
    if(!local.length)continue;
    if(new Set(list.map(fingerprint)).size>1){excluded+=local.length;reasons.add(`${domain}_identity_conflict`);continue;}
    duplicates+=list.length-1;
    accepted.push(local[0]);
  }
  return {rows:accepted,duplicates,excluded};
}

function effortCounts(rows,available){
  const result={};
  for(const [key,field] of [['failure','failure'],['nearFailure','near_failure']]){
    const known=rows.filter(row=>typeof row[field]==='boolean').length;
    // Unknown flags never become a claim of zero failures. A successful empty
    // read does permit zero registered events, with a zero denominator.
    result[key]=available&&(known>0||rows.length===0)?rows.filter(row=>row[field]===true).length:null;
    result[`${key}Recorded`]=available?known:null;
    result[`${key}Unknown`]=available?rows.length-known:null;
  }
  return result;
}

/**
 * trainingSessionSummary(workout, {workouts?, exercises, sets}, status)
 *
 * Counts describe only unambiguous linked records, not completeness of logging.
 * `phases` and `effort.failure/nearFailure` use primary sets only. Drop and
 * rest-pause records are extensions, with separate extension effort counts.
 * A successful source read requires status "ready" and an array. The supplied
 * workout may be used without a workouts array, but never without ready status.
 * Missing child dates may use the explicit parent ID; conflicting dates cannot.
 * Text remains raw: the view must escape it. Inputs are never changed.
 */
export function trainingSessionSummary(workout,data={},status={}){
  data=data&&typeof data==='object'?data:{};status=status&&typeof status==='object'?status:{};
  const reasons=new Set(),workoutId=identity(workout?.source_record_id),date=day(workout?.workout_date??workout?.date);
  const states={workouts:['ready','loading','error'].includes(status.workouts)?status.workouts:'unavailable',exercises:sourceState(data,status,'exercises'),sets:sourceState(data,status,'sets')};
  let sessionAvailable=states.workouts==='ready';
  if(!sessionAvailable)reasons.add(`workouts_${states.workouts}`);
  if(!workoutId){sessionAvailable=false;reasons.add('workout_identity_missing');}
  if(!date){sessionAvailable=false;reasons.add('workout_date_invalid');}
  if(workout?.is_canonical!==true||workout?.record_status==='quarantined'){sessionAvailable=false;reasons.add('workout_not_canonical');}
  if(Object.hasOwn(data,'workouts')){
    if(!Array.isArray(data.workouts)){sessionAvailable=false;states.workouts='unavailable';reasons.add('workouts_unavailable');}
    else{
      const matching=data.workouts.filter(row=>record(row)&&row.source_record_id===workoutId);
      if(!matching.length){sessionAvailable=false;reasons.add('workout_missing');}
      else if(new Set(matching.map(fingerprint)).size>1){sessionAvailable=false;reasons.add('workout_identity_conflict');}
      else if(matching.some(row=>day(row.workout_date??row.date)!==date||row.is_canonical!==true||row.record_status==='quarantined')){
        sessionAvailable=false;reasons.add('workout_parent_mismatch');
      }
    }
  }
  const exercisesAvailable=sessionAvailable&&states.exercises==='ready',setsAvailable=exercisesAvailable&&states.sets==='ready';
  if(states.exercises!=='ready')reasons.add(`exercises_${states.exercises}`);
  if(states.sets!=='ready')reasons.add(`sets_${states.sets}`);
  const exercises=exercisesAvailable?deduplicate(data.exercises,row=>row.workout_source_record_id===workoutId,'exercise',reasons):{rows:[],duplicates:0,excluded:0};
  exercises.rows=exercises.rows.filter(row=>{
    if(compatibleDate(row,date))return true;
    exercises.excluded++;reasons.add('exercise_date_mismatch');return false;
  });
  const exerciseMap=new Map(exercises.rows.map(row=>[row.source_record_id,row]));
  const selectedExerciseIds=new Set(exercisesAvailable?data.exercises.filter(row=>record(row)&&row.workout_source_record_id===workoutId).map(row=>identity(row.source_record_id)).filter(Boolean):[]);
  const sets=setsAvailable?deduplicate(data.sets,row=>row.workout_source_record_id===workoutId||selectedExerciseIds.has(row.exercise_source_record_id),'set',reasons):{rows:[],duplicates:0,excluded:0};
  sets.rows=sets.rows.filter(row=>{
    let reason=null;
    if(row.workout_source_record_id!==workoutId)reason='set_parent_mismatch';
    else if(!identity(row.exercise_source_record_id)||!exerciseMap.has(row.exercise_source_record_id))reason='set_exercise_missing';
    else if(!compatibleDate(row,date))reason='set_date_mismatch';
    if(!reason)return true;
    sets.excluded++;reasons.add(reason);return false;
  });
  const primary=sets.rows.filter(row=>!isSetExtension(row)),extensions=sets.rows.filter(isSetExtension);
  const counts={exercises:exercisesAvailable?exercises.rows.length:null,...(setsAvailable?trainingSetCounts(sets.rows):nullCounts())};
  const phases={working:null,warmup:null,other:null,unknown:null};
  if(setsAvailable){
    for(const phase of ['working','warmup','other'])phases[phase]=primary.filter(row=>row.phase===phase).length;
    phases.unknown=primary.filter(row=>!['working','warmup','other'].includes(row.phase)).length;
  }
  const effort=effortCounts(primary,setsAvailable),extensionEffort=effortCounts(extensions,setsAvailable);
  for(const [key,value] of Object.entries(extensionEffort))effort[`extension${key[0].toUpperCase()}${key.slice(1)}`]=value;
  const groups=new Map(),unknownRows=[];
  for(const exercise of exercises.rows){
    const label=groupLabel(exercise.muscle_group);
    if(label===null){unknownRows.push(exercise);continue;}
    if(!groups.has(label))groups.set(label,[]);
    groups.get(label).push(exercise);
  }
  const bucket=(label,rows)=>{
    const ids=new Set(rows.map(row=>row.source_record_id));
    const linkedSets=sets.rows.filter(row=>ids.has(row.exercise_source_record_id));
    return {label,exercises:exercisesAvailable?rows.length:null,...(setsAvailable?trainingSetCounts(linkedSets):nullCounts())};
  };
  const muscleGroups=[...groups].map(([label,rows])=>bucket(label,rows)).sort((a,b)=>(b.primary??0)-(a.primary??0)||a.label.localeCompare(b.label));
  const unknownMuscleGroup=bucket(null,unknownRows);
  const exercisesWithSets=new Set(sets.rows.map(row=>row.exercise_source_record_id)).size;
  const workoutStatus=sessionAvailable?'ready':states.workouts==='ready'?'unavailable':states.workouts;
  const coverage={
    exercises:{available:exercisesAvailable,status:exercisesAvailable?'ready':!sessionAvailable?workoutStatus:states.exercises,count:counts.exercises,duplicates:exercisesAvailable?exercises.duplicates:null,excluded:exercisesAvailable?exercises.excluded:null},
    sets:{available:setsAvailable,status:setsAvailable?'ready':!sessionAvailable?workoutStatus:!exercisesAvailable?states.exercises:states.sets,count:counts.total,duplicates:setsAvailable?sets.duplicates:null,excluded:setsAvailable?sets.excluded:null},
    exercisesWithSets:setsAvailable?exercisesWithSets:null,
    exercisesWithoutSets:setsAvailable?exercises.rows.length-exercisesWithSets:null,
    groupKnownExercises:exercisesAvailable?exercises.rows.length-unknownRows.length:null,
    groupUnknownExercises:exercisesAvailable?unknownRows.length:null,
    groupKnownPrimary:setsAvailable?counts.primary-unknownMuscleGroup.primary:null,
    groupUnknownPrimary:unknownMuscleGroup.primary,
    groupKnownExtensions:setsAvailable?counts.extensions-unknownMuscleGroup.extensions:null,
    groupUnknownExtensions:unknownMuscleGroup.extensions,
    groupsComplete:setsAvailable&&unknownRows.length===0,
    phasesComplete:setsAvailable&&phases.unknown===0,
    failureComplete:setsAvailable&&effort.failureUnknown===0,
    nearFailureComplete:setsAvailable&&effort.nearFailureUnknown===0,
    // Complete logging cannot be proven from the presence of saved records.
    complete:false,
    note:'Contagens dos registros ligados à sessão. Não confirmam que todo o treino foi registrado.',
    groupMeaning:'Rótulos cadastrados em cada exercício. Não representam volume fisiológico nem grupos primários ou secundários.'
  };
  const available=sessionAvailable&&exercisesAvailable&&setsAvailable;
  const partial=!available||exercises.excluded>0||sets.excluded>0;
  return {workoutId,date,available,sessionAvailable,exercisesAvailable,setsAvailable,partial,
    status:!sessionAvailable?(states.workouts==='ready'?'unavailable':states.workouts):partial?'partial':counts.total||counts.exercises?'ready':'empty',
    reasons:[...reasons],counts,phases,effort,muscleGroups,unknownMuscleGroup,coverage,
    acceptedExercises:ordered(exercises.rows,'order_index'),acceptedSets:ordered(sets.rows,'set_index'),
    sessionComment:string(workout?.session_comment),originalReport:string(workout?.raw_exercises)};
}
