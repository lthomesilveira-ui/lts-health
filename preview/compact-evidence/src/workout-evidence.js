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
  if(!raw||normalizedSource==='teste'||normalizedSource.includes('workout log')||normalizedSource.includes('user-reported completed workout')||normalizedSource.includes('registro detalhado fornecido pelo usuario'))return'Registro LTS';
  return raw;
}

export function decorateWorkoutProvenance(workouts=[],evidence=[]){
  const byWorkout=new Map();
  for(const row of confirmedTelemetryEvidence(evidence)){
    const workoutId=row?.workout_source_record_id,sourceName=String(row?.source_name||'').trim();
    if(!workoutId)continue;
    if(!byWorkout.has(workoutId))byWorkout.set(workoutId,{sourceNames:new Set(),fieldNames:new Set()});
    const entry=byWorkout.get(workoutId);
    if(sourceName)entry.sourceNames.add(sourceName);
    for(const field of row?.field_names||[])entry.fieldNames.add(normalized(field));
  }
  return (workouts||[]).map(workout=>{
    const evidenceEntry=byWorkout.get(workout?.source_record_id)||{sourceNames:new Set(),fieldNames:new Set()};
    const sourceNames=[...evidenceEntry.sourceNames].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const fieldNames=evidenceEntry.fieldNames;
    const partialTelemetry=[...fieldNames].some(field=>field.startsWith('partial_'));
    const partialHeartRate=[...fieldNames].some(field=>field.startsWith('partial_heart_rate_'));
    const estimatedEnergy=fieldNames.has('estimated_session_calories_kcal');
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
      telemetry_source_names:sourceNames,
      telemetry_is_partial:partialTelemetry,
      telemetry_heart_rate_is_partial:partialHeartRate,
      telemetry_energy_is_estimated:estimatedEnergy
    };
  });
}
