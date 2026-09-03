const telemetryFields=['duration_minutes','calories_kcal','heart_rate_avg','heart_rate_min','heart_rate_max'];
const normalized=value=>String(value??'').trim().toLowerCase();

export const workoutTelemetryFields=Object.freeze([...telemetryFields]);

export function hasWorkoutTelemetry(workout){
  return telemetryFields.some(field=>workout?.[field]!=null&&String(workout[field]).trim()!=='');
}

export function confirmedTelemetryEvidence(rows=[],workoutSourceRecordId=null){
  return (rows||[]).filter(row=>
    (!workoutSourceRecordId||row?.workout_source_record_id===workoutSourceRecordId)&&
    normalized(row?.evidence_kind)==='telemetry'&&
    normalized(row?.evidence_status)==='confirmed'
  );
}

export function visibleWorkoutEvidence(workouts=[],evidence=[]){
  const workoutIds=new Set((workouts||[]).map(row=>row?.source_record_id).filter(Boolean));
  return (evidence||[]).filter(row=>workoutIds.has(row?.workout_source_record_id));
}

function baseSourceLabel(workout){
  const raw=String(workout?.source||'').trim();
  const normalizedSource=normalized(raw);
  if(!raw||normalizedSource.includes('workout log')||normalizedSource.includes('user-reported completed workout'))return'Registro LTS';
  return raw;
}

export function decorateWorkoutProvenance(workouts=[],evidence=[]){
  const byWorkout=new Map();
  for(const row of confirmedTelemetryEvidence(evidence)){
    const workoutId=row?.workout_source_record_id,sourceName=String(row?.source_name||'').trim();
    if(!workoutId||!sourceName)continue;
    if(!byWorkout.has(workoutId))byWorkout.set(workoutId,new Set());
    byWorkout.get(workoutId).add(sourceName);
  }
  return (workouts||[]).map(workout=>{
    const sourceNames=[...(byWorkout.get(workout?.source_record_id)||new Set())].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const hasTelemetry=hasWorkoutTelemetry(workout),base=baseSourceLabel(workout);
    const source=sourceNames.length
      ? `${base} · telemetria: ${sourceNames.join(' + ')}`
      : hasTelemetry
        ? `${base} · telemetria: origem não explicitada no registro histórico`
        : base;
    return {
      ...workout,
      source_recorded:workout?.source??null,
      source,
      telemetry_provenance_status:sourceNames.length?'confirmed':hasTelemetry?'unknown':'not_applicable',
      telemetry_source_names:sourceNames
    };
  });
}
