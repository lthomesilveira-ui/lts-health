// Descriptive ranges of the same accepted daily observations used by each
// report card. No target, score, source pooling or inference about intake.
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const nutritionKeys=['energy','protein','fiber'];
function rangeFor(metric,calendar){
  if(!metric?.readComplete||metric.source?.status!=='canonical'||metric.unresolvedOverlap||!finite(metric.value)||metric.count<2)return null;
  const points=(metric.points||[]).filter(point=>point.eligible===true&&finite(point.value)&&point.value>=0&&point.date>=calendar.bounds.start&&point.date<=calendar.bounds.closedEnd&&point.date<calendar.today&&point.source===metric.source.key&&!point.open&&!point.ambiguous&&!point.knownPartial&&!point.excludeFromClosedMeans&&!point.reviewInvalid);
  // Reject an inconsistent projection instead of describing a different sample
  // from the mean. The calendar model already resolves repeated identities.
  if(points.length!==metric.count||new Set(points.map(point=>point.date)).size!==points.length)return null;
  const minimum=Math.min(...points.map(point=>point.value)),maximum=Math.max(...points.map(point=>point.value));
  return {key:metric.key,label:metric.label,unit:metric.unit,source:metric.source,sources:metric.sources,
    count:points.length,expectedDays:metric.expectedDays,
    minimum:{value:minimum,dates:points.filter(point=>point.value===minimum).map(point=>point.date).sort()},
    maximum:{value:maximum,dates:points.filter(point=>point.value===maximum).map(point=>point.date).sort()},
    dates:points.map(point=>point.date).sort()};
}
export function calendarReportHighlights(metrics=[],calendar){
  const ranges=nutritionKeys.map(key=>rangeFor(metrics.find(metric=>metric.key===key),calendar)).filter(Boolean);
  const energy=ranges.find(item=>item.key==='energy'),fiber=ranges.find(item=>item.key==='fiber');
  // Coincidence is stated only for the same origin and exactly the same dated
  // sample, with unique extremes. It is not a correlation or causal finding.
  const sameSample=energy&&fiber&&energy.source.key===fiber.source.key&&energy.dates.join('|')===fiber.dates.join('|');
  const coincidence=sameSample&&energy.minimum.value<energy.maximum.value&&fiber.minimum.value<fiber.maximum.value&&energy.maximum.dates.length===1&&fiber.minimum.dates.length===1&&energy.maximum.dates[0]===fiber.minimum.dates[0]?
    {date:energy.maximum.dates[0],energy:energy.maximum.value,fiber:fiber.minimum.value}:null;
  return {ranges,coincidence};
}
