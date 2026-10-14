const extensionPhases=new Set(['drop','rest_pause']);

export function isSetExtension(set){
  return extensionPhases.has(set?.phase);
}

export function trainingSetCounts(sets=[]){
  const extensions=sets.filter(isSetExtension).length;
  return {primary:sets.length-extensions,extensions,total:sets.length};
}

export function hasReportedMeasurementIssue(workout,evidence=[]){
  return evidence.some(row=>row?.workout_source_record_id===workout?.source_record_id&&
    row.evidence_kind==='telemetry'&&row.evidence_status==='confirmed'&&
    (row.field_names||[]).includes('measurement_issue_reported'));
}

export function setStepLabel(sets,index){
  const set=sets[index];
  if(set?.phase==='drop')return 'Drop';
  if(set?.phase==='rest_pause')return 'Rest-pause';
  return `S${sets.slice(0,index+1).filter(row=>!isSetExtension(row)).length}`;
}
