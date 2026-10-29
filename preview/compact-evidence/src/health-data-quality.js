// Inspect received daily fields without joining origins or changing any mean.
// A date seen in two origins is one received date, never two coverage days.
const received=point=>Boolean(point?.hasReceivedValue||point?.observations?.some(row=>row.hasReceivedValue||row.receivedRaw!=null||row.receivedValue!=null)||point?.value!=null);
export function dailyCoverageAudit(metric,{mode='period',today,domains=[],status={}}={}){
  const complete=domains.every(domain=>status[domain]==='ready')&&!metric.unknownRows&&!metric.invalidRows;
  const bySource=(metric.sources||[]).map(source=>({source,dates:new Map(source.points.map(point=>[point.date,point]))}));
  const rows=(metric.points||[]).filter(point=>mode==='day'||point.date<today).map(point=>{
    const sources=bySource.filter(item=>received(item.dates.get(point.date))).map(item=>item.source.key);
    const selectedReceived=received(point),hasOtherSource=sources.some(key=>key!==metric.source?.key);
    let reason;
    if(selectedReceived&&point.ambiguous)reason='multiple_values';
    else if(selectedReceived&&point.reviewInvalid)reason='review';
    else if(selectedReceived&&(point.knownPartial||point.excludeFromClosedMeans)&&mode!=='day')reason='partial';
    else if(selectedReceived&&(point.stepReviewReason||point.value==null))reason='invalid_value';
    else if(mode==='day'&&point.value!=null)reason=point.date===today?'in_progress':'day_value';
    else if(point.eligible)reason='used';
    else if(hasOtherSource)reason='other_source';
    else reason=complete?'not_received':'not_verified';
    return {date:point.date,reason,received:sources.length>0||selectedReceived,selectedReceived,hasOtherSource,sources};
  });
  return {complete,expectedDays:metric.expectedDays,usedDays:metric.count,receivedDays:rows.filter(row=>row.received).length,
    otherSourceDays:rows.filter(row=>row.reason==='other_source').length,
    excludedDays:rows.filter(row=>['multiple_values','review','partial','invalid_value'].includes(row.reason)).length,
    notReceivedDays:rows.filter(row=>row.reason==='not_received').length,
    unverifiedDays:rows.filter(row=>row.reason==='not_verified').length,
    multipleSourceDays:rows.filter(row=>row.sources.length>1).length,rows};
}
