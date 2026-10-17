import {trainingSetCounts} from './training-session.js';

// Read-only enrichment of the canonical session model. Device records remain
// their own observations; date proximity never establishes a session link.
const text=value=>typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
const norm=value=>text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const unique=values=>[...new Set(values)];
const number=value=>(typeof value==='number'||typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim()))&&Number.isFinite(Number(value))?Number(value):null;
const nonnegative=value=>number(value)!=null&&number(value)>=0?number(value):null;
const day=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(value))return null;
  const date=value.slice(0,10),parsed=new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:null;
};
const inside=(date,bounds)=>date>=bounds.start&&date<=bounds.end;
const sourceState=(status,key)=>['ready','error','loading'].includes(status?.[key])?status[key]:'unavailable';
const sortRows=rows=>rows.slice().sort((a,b)=>a.date.localeCompare(b.date)||text(a.recordedStart).localeCompare(text(b.recordedStart))||a.key.localeCompare(b.key));
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const fingerprint=value=>JSON.stringify(stable(value));
const project=(row,fields)=>Object.fromEntries(fields.map(key=>[key,row[key]??null]));
const index=(rows,key)=>{const map=new Map();for(const row of rows){const id=key(row);if(!map.has(id))map.set(id,[]);map.get(id).push(row);}return map;};

function deduplicate(rows,identity,shape,domain){
  const accepted=[],duplicates=[],unidentified=[];
  for(const row of rows)if(!identity(row))unidentified.push(row);
  for(const [key,list] of index(rows.filter(row=>identity(row)),identity)){
    const variants=unique(list.map(row=>fingerprint(shape(row))));
    const noStableId=!text(list[0].source_record_id),conflicting=variants.length>1||noStableId&&list.length>1;
    if(list.length>1)duplicates.push({domain,key,count:list.length,conflicting,...(noStableId?{reason:'unverified_identity'}:{})});
    if(!conflicting)accepted.push(list[0]);
  }
  return {rows:accepted,duplicates,unidentified:unidentified.length};
}
const conflicting=result=>result.duplicates.some(row=>row.conflicting)||result.unidentified>0;
const order=value=>Number.isInteger(number(value))&&number(value)>=0?number(value):null;
const exerciseIdentity=row=>text(row.source_record_id)||
  (text(row.workout_source_record_id)&&order(row.order_index)!=null&&text(row.exercise)?JSON.stringify([row.workout_source_record_id,row.order_index,text(row.exercise),text(row.machine)]):null);
const setIdentity=row=>text(row.source_record_id)||
  (text(row.exercise_source_record_id)&&order(row.set_index)!=null?JSON.stringify([row.workout_source_record_id,row.exercise_source_record_id,row.set_index,text(row.phase)]):null);
const exerciseFields=['workout_source_record_id','workout_date','order_index','exercise','machine','muscle_group','sets','reps','weight_kg'];
const setFields=['workout_source_record_id','exercise_source_record_id','workout_date','exercise_name','exercise_order','set_index','phase','weight','weight_unit','reps_numeric','reps_raw','failure','near_failure','technique'];
const evidenceFields=['workout_source_record_id','workout_date','source_family','source_name','evidence_kind','evidence_status','field_names'];
const polarFields=['workout_date','recorded_start','session_name','duration_minutes','heart_rate_avg','heart_rate_max','source_name'];

function setSummary(rows,available){
  const counts=available?trainingSetCounts(rows):{primary:null,extensions:null,total:null};
  return {...counts,unknownPhaseCount:available?rows.filter(row=>!text(row.phase)||norm(row.phase)==='unknown').length:null,
    workingCount:available?rows.filter(row=>norm(row.phase)==='working').length:null};
}
function coverage(available,sourceStatus,rows,sessions,total){
  return {available,status:available?(rows.length?'ready':'empty'):sourceStatus,count:available?rows.length:null,sessions:available?sessions:null,total:available?total:null,
    fraction:available&&total?sessions/total:null,allSessionsHaveRecords:available&&total>0&&sessions===total,complete:false,
    note:'Cobertura dos registros recebidos; não confirma que todos os exercícios ou séries tenham sido registrados.'};
}
function telemetryEvidence(rows,available,sourceStatus){
  const confirmed=rows.filter(row=>norm(row.evidence_status)==='confirmed'&&norm(row.evidence_kind)==='telemetry');
  const fieldNames=unique(confirmed.flatMap(row=>Array.isArray(row.field_names)?row.field_names.filter(value=>text(value)):[])).sort();
  return {available,status:available?(confirmed.length?'ready':'empty'):sourceStatus,confirmedCount:available?confirmed.length:null,
    sourceNames:unique(confirmed.map(row=>text(row.source_name)).filter(Boolean)).sort(),fieldNames,
    partial:fieldNames.some(field=>field.startsWith('partial_')),heartRatePartial:fieldNames.some(field=>field.startsWith('partial_heart_rate_')),
    energyEstimated:fieldNames.includes('estimated_session_calories_kcal'),measurementIssueReported:fieldNames.includes('measurement_issue_reported'),
    note:'Vínculo explícito à sessão detalhada. Não identifica automaticamente um registro da tabela Polar.'};
}
function polarContext(data,status,bounds){
  const available=status.polarSessions==='ready';
  const observed=available?(data.polarSessions||[]).filter(row=>day(row.workout_date)&&day(row.workout_date)<=bounds.end):[];
  const identity=row=>text(row.source_record_id)||(text(row.recorded_start)&&text(row.source_name)?JSON.stringify([day(row.workout_date),text(row.recorded_start),text(row.source_name)]):null);
  const result=deduplicate(observed,identity,row=>project(row,polarFields),'polarSessions');
  const history=sortRows(result.rows.map(row=>{
    const date=day(row.workout_date),inPeriod=inside(date,bounds);
    return {key:identity(row),sourceRecordId:text(row.source_record_id)||null,date,workout_date:date,recordedStart:text(row.recorded_start)||null,
      name:text(row.session_name)||'Registro Polar',type:text(row.session_name)||'Registro Polar',source:text(row.source_name)||'Origem Polar não informada',
      duration:nonnegative(row.duration_minutes),duration_minutes:nonnegative(row.duration_minutes),heartRateAvg:nonnegative(row.heart_rate_avg),heartRateMax:nonnegative(row.heart_rate_max),
      inPeriod,periodLabel:inPeriod?'No período selecionado':'Fora do período selecionado',groups:[],classification:'device_record',canonicalWorkoutId:null};
  }));
  const rows=history.filter(row=>row.inPeriod),durations=rows.filter(row=>row.duration!=null),lastObservedDate=observed.map(row=>day(row.workout_date)).sort().at(-1)||null;
  const conflictingKeys=new Set(result.duplicates.filter(row=>row.conflicting).map(row=>row.key));
  // A valid record earlier on the same date cannot become the claimed latest
  // when another identity that day is conflicted or cannot be identified.
  const latestDateAmbiguous=observed.some(row=>day(row.workout_date)===lastObservedDate&&(!identity(row)||conflictingKeys.has(identity(row))));
  const latestUnambiguous=history.at(-1)||null,lastRecordAmbiguous=Boolean(lastObservedDate&&(lastObservedDate!==latestUnambiguous?.date||latestDateAmbiguous)),latest=lastRecordAmbiguous?null:latestUnambiguous;
  const latestSessions=rows.slice().reverse().slice(0,3),recentSessions=latestSessions.length?latestSessions:latest?[latest]:[];
  return {available,status:!available?sourceState(status,'polarSessions'):conflicting(result)?'partial':rows.length?'ready':'empty',partial:available&&conflicting(result),
    rows,history,sessions:available?rows.length:null,recordedDays:available?unique(rows.map(row=>row.date)).length:null,
    historicalCount:available?history.length:null,recordedMinutes:durations.length?durations.reduce((sum,row)=>sum+row.duration,0):null,
    durationCoverage:{sessions:available?durations.length:null,total:available?rows.length:null,fraction:available&&rows.length?durations.length/rows.length:null,
      complete:available&&rows.length>0&&durations.length===rows.length},latest,latestUnambiguous,lastRegistered:latest,lastDate:latest?.date||null,lastObservedDate,lastRecordAmbiguous,
    latestSessions,recentSessions,historicalSessions:history.filter(row=>!row.inPeriod).reverse().slice(0,3),duplicates:result.duplicates,unidentifiedCount:result.unidentified,
    sources:[...index(rows,row=>row.source)].map(([label,list])=>({label,records:list.length,days:unique(list.map(row=>row.date)).length})),
    note:'Registros Polar apresentados separadamente; não são somados às sessões detalhadas. Data, duração ou nome semelhantes não comprovam equivalência. Grupos musculares não são inferidos da telemetria.'};
}

export function enrichDashboardTraining(base,data={},status={},bounds={}){
  const parents=new Map((base.history||[]).filter(row=>row.sourceRecordId).map(row=>[row.sourceRecordId,row]));
  const exercisesAvailable=base.available&&status.exercises==='ready',setsAvailable=exercisesAvailable&&status.sets==='ready',evidenceAvailable=base.available&&status.workoutEvidence==='ready';
  const eligible=(row)=>parents.has(text(row.workout_source_record_id))&&(!row.workout_date||day(row.workout_date)===parents.get(text(row.workout_source_record_id)).date);
  const exerciseCandidates=exercisesAvailable?(data.exercises||[]).filter(eligible):[];
  const exercises=deduplicate(exerciseCandidates,exerciseIdentity,row=>project(row,exerciseFields),'exerciseDetails');
  const exerciseIds=new Map(exercises.rows.filter(row=>text(row.source_record_id)).map(row=>[text(row.source_record_id),row]));
  const setCandidates=setsAvailable?(data.sets||[]).filter(row=>eligible(row)&&exerciseIds.has(text(row.exercise_source_record_id))&&
    exerciseIds.get(text(row.exercise_source_record_id)).workout_source_record_id===row.workout_source_record_id):[];
  const sets=deduplicate(setCandidates,setIdentity,row=>project(row,setFields),'sets');
  const evidenceCandidates=evidenceAvailable?(data.workoutEvidence||[]).filter(eligible):[];
  const evidence=deduplicate(evidenceCandidates,row=>text(row.source_record_id)||JSON.stringify([row.workout_source_record_id,row.source_family,row.source_name,row.evidence_kind,row.evidence_status]),row=>project(row,evidenceFields),'workoutEvidence');
  const byWorkout=index(exercises.rows,row=>text(row.workout_source_record_id)),setsByWorkout=index(sets.rows,row=>text(row.workout_source_record_id)),evidenceByWorkout=index(evidence.rows,row=>text(row.workout_source_record_id));
  const setsByExercise=index(sets.rows,row=>text(row.exercise_source_record_id));
  const history=(base.history||[]).map(row=>{
    const exerciseRows=byWorkout.get(row.sourceRecordId)||[],setRows=setsByWorkout.get(row.sourceRecordId)||[],counts=setSummary(setRows,setsAvailable);
    const exerciseDetails=exerciseRows.slice().sort((a,b)=>(order(a.order_index)??Infinity)-(order(b.order_index)??Infinity)||exerciseIdentity(a).localeCompare(exerciseIdentity(b))).map(exercise=>{
      const recordedSets=(setsByExercise.get(text(exercise.source_record_id))||[]).slice().sort((a,b)=>(order(a.set_index)??Infinity)-(order(b.set_index)??Infinity)||setIdentity(a).localeCompare(setIdentity(b))).map(set=>({
        ...project(set,['set_index','phase','weight','weight_unit','reps_numeric','reps_raw','failure','near_failure','technique','notes']),key:setIdentity(set),sourceRecordId:text(set.source_record_id)||null
      }));
      const summary=setSummary(recordedSets,setsAvailable);
      return {key:exerciseIdentity(exercise),sourceRecordId:text(exercise.source_record_id)||null,name:text(exercise.exercise)||'Exercício sem nome',exercise:text(exercise.exercise)||null,
        machine:text(exercise.machine)||null,group:text(exercise.muscle_group)||null,muscle_group:text(exercise.muscle_group)||null,orderIndex:order(exercise.order_index),
        primarySets:summary.primary,extensions:summary.extensions,unknownPhaseCount:summary.unknownPhaseCount,recordedSets,setsAvailable,
        sourceText:text(exercise.source_text)||null,notes:text(exercise.notes)||null,declaredSets:nonnegative(exercise.sets),declaredReps:text(exercise.reps)||null,declaredWeightKg:nonnegative(exercise.weight_kg)};
    });
    return {...row,exerciseCount:exercisesAvailable?exerciseRows.length:null,setCount:counts.primary,extensionCount:counts.extensions,setRecordCount:counts.total,
      unknownPhaseCount:counts.unknownPhaseCount,setCounts:counts,exercises:exerciseDetails,telemetryEvidence:telemetryEvidence(evidenceByWorkout.get(row.sourceRecordId)||[],evidenceAvailable,sourceState(status,'workoutEvidence'))};
  });
  const byKey=new Map(history.map(row=>[row.key,row])),mapped=row=>row?byKey.get(row.key)||row:null,rows=history.filter(row=>row.inPeriod);
  const periodIds=new Set(rows.map(row=>row.sourceRecordId).filter(Boolean)),periodExercises=exercises.rows.filter(row=>periodIds.has(row.workout_source_record_id)),periodSets=sets.rows.filter(row=>periodIds.has(row.workout_source_record_id));
  const canonicalConflicts=new Set((base.duplicates||[]).filter(row=>row.domain==='workouts'&&row.conflicting).map(row=>row.key));
  const canonicalKey=row=>text(row.source_record_id)||JSON.stringify([day(row.workout_date),text(row.source),text(row.workout_type),text(row.location)]);
  const latestDateAmbiguous=Boolean(base.available&&(data.workouts||[]).some(row=>row?.is_canonical===true&&norm(row.record_status)!=='quarantined'&&
    day(row.workout_date)===base.lastObservedDate&&canonicalConflicts.has(canonicalKey(row))));
  const lastRecordAmbiguous=base.lastRecordAmbiguous||latestDateAmbiguous;
  const counts=setSummary(periodSets,setsAvailable),latest=lastRecordAmbiguous?null:mapped(base.latest),latestSessions=(base.latestSessions||[]).map(mapped),recentSessions=latestSessions.length?latestSessions:latest?[latest]:[];
  const detailsPartial=Boolean(base.available&&(!exercisesAvailable||!setsAvailable||conflicting(exercises)||conflicting(sets)));
  const detailsCoverage={exercises:coverage(exercisesAvailable,base.available?sourceState(status,'exercises'):base.status,periodExercises,rows.filter(row=>row.exerciseCount>0).length,rows.length),
    sets:coverage(setsAvailable,!base.available?base.status:!exercisesAvailable?sourceState(status,'exercises'):sourceState(status,'sets'),periodSets,rows.filter(row=>row.setRecordCount>0).length,rows.length)};
  return {...base,rows,history,latest,lastRegistered:latest,latestWorkout:latest,latestUnambiguous:mapped(base.latestUnambiguous),lastRecordAmbiguous,
    daysSinceLast:lastRecordAmbiguous?null:base.daysSinceLast,gapLabel:lastRecordAmbiguous?null:base.gapLabel,
    notices:[...(base.notices||[]),...(latestDateAmbiguous&&!base.lastRecordAmbiguous?['A data mais recente inclui uma sessão com identidade conflitante; o último treino e seu intervalo não são escolhidos automaticamente.']:[])],
    latestSessions,lastSessions:latestSessions,recentSessions,
    historicalSessions:(base.historicalSessions||[]).map(mapped),historicalCount:base.available?history.length:null,
    exerciseCount:exercisesAvailable?periodExercises.length:null,setCount:counts.primary,extensionCount:counts.extensions,setRecordCount:counts.total,unknownPhaseCount:counts.unknownPhaseCount,setCounts:counts,
    detailsAvailable:exercisesAvailable,setsAvailable,detailsStatus:!base.available?base.status:detailsPartial?'partial':periodExercises.length||periodSets.length?'ready':'empty',detailsPartial,detailsCoverage,
    detailDuplicates:[...exercises.duplicates,...sets.duplicates],unidentifiedDetails:{exercises:exercises.unidentified,sets:sets.unidentified},
    detailNotices:[...(!exercisesAvailable&&base.available?['Exercícios indisponíveis nesta atualização.']:[]),...(!setsAvailable&&exercisesAvailable?['Séries indisponíveis nesta atualização.']:[]),
      ...(conflicting(exercises)||conflicting(sets)?['Detalhes com identidade ausente ou conflitante foram excluídos das contagens.']:[])],
    evidence:{available:evidenceAvailable,status:!evidenceAvailable?sourceState(status,'workoutEvidence'):conflicting(evidence)?'partial':evidence.rows.length?'ready':'empty',
      confirmedTelemetrySessions:evidenceAvailable?rows.filter(row=>row.telemetryEvidence.confirmedCount>0).length:null,duplicates:evidence.duplicates},
    polar:polarContext(data,status,bounds)};
}
