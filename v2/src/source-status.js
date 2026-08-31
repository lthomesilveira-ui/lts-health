import {state,norm} from './core.js';

export const stableAppleMetricTypes=new Set(['active_energy_kcal','exercise_minutes','stand_hours']);
const appleNativeFamilies=new Set(['apple_activity_summary','apple_watch','iphone','healthkit_candidate']);
const preservedCandidateStatuses=new Set(['candidate','held']);
const appleSourceTerms=['apple health','healthkit','activitysummary','activity summary','apple watch','apple_watch','iphone'];

const failed=key=>state.domainStatus?.[key]==='error'||!!state.errors?.[key];
const contains=(rows,fields,term)=>{term=norm(term);return(rows||[]).some(row=>fields.some(field=>norm(row?.[field]).includes(term)));};
const matching=(rows,fields,term)=>{term=norm(term);return(rows||[]).filter(row=>fields.some(field=>norm(row?.[field]).includes(term)));};
const isPreservedCandidate=row=>preservedCandidateStatuses.has(norm(row?.canonical_status));
const candidateFromFamily=(rows,family)=>(rows||[]).some(row=>norm(row?.source_family)===norm(family)&&isPreservedCandidate(row));
const appleCandidate=row=>appleNativeFamilies.has(norm(row?.source_family))&&isPreservedCandidate(row);
const anyCandidateMetric=rows=>(rows||[]).some(appleCandidate);
const appleSourceMetric=row=>appleNativeFamilies.has(norm(row?.source_family));
const dateOnly=value=>{const date=String(value??'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(date)?date:null;};
const latestDate=values=>(values||[]).map(dateOnly).filter(Boolean).reduce((latest,date)=>!latest||date>latest?date:latest,null);

export function provenanceText(row){
  return norm([row?.source,row?.source_file,row?.source_name,row?.source_family].filter(Boolean).join(' '));
}

export function isAppleSource(row){
  const family=norm(row?.source_family),text=provenanceText(row);
  return appleNativeFamilies.has(family)||appleSourceTerms.some(term=>text.includes(term));
}

export function isAppleActivitySummarySource(row){
  const family=norm(row?.source_family),text=provenanceText(row);
  return family==='apple_activity_summary'||text.includes('activitysummary')||text.includes('activity summary');
}

export function isMyFitnessPalSource(row){
  return norm(row?.source_family)==='myfitnesspal'||provenanceText(row).includes('myfitnesspal');
}

export function isMyFitnessPalViaApple(row){
  if(!isMyFitnessPalSource(row))return false;
  const text=provenanceText(row);
  return appleSourceTerms.some(term=>text.includes(term));
}

const directMyFitnessPal=row=>isMyFitnessPalSource(row)&&!isMyFitnessPalViaApple(row);

export function uploadBucket(upload){
  const status=String(upload?.status||'').toLowerCase();
  if(status==='uploaded'||status==='processing')return'in_progress';
  if(status==='processed'||status==='imported')return'done';
  if(status==='review_required'||status==='rejected'||status==='failed')return'attention';
  return'other';
}

function latestUploadFor(source){
  if(failed('uploads'))return null;
  return [...(state.data.uploads||[])].filter(u=>norm(u.source_type)===norm(source)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0]||null;
}

function sourceEvidence(source){
  const workouts=state.data.workouts||[],labs=state.data.labs||[],nutrition=state.data.nutrition||[],meals=state.data.meals||[],metrics=state.data.metrics||[],sourceMetrics=state.data.sourceMetrics||[];
  if(source==='apple_health')return{
    dataFound:!failed('metrics')&&metrics.some(m=>stableAppleMetricTypes.has(m.metric_type)&&isAppleSource(m)&&isAppleActivitySummarySource(m)),
    candidateFound:!failed('sourceMetrics')&&anyCandidateMetric(sourceMetrics),
    domainKeys:['metrics','sourceMetrics']
  };
  if(source==='polar_flow')return{
    dataFound:!failed('workouts')&&contains(workouts,['source','source_file'],'polar'),
    candidateFound:!failed('sourceMetrics')&&candidateFromFamily(sourceMetrics,'polar_flow'),
    domainKeys:['workouts','sourceMetrics']
  };
  if(source==='myfitnesspal')return{
    dataFound:(!failed('nutrition')&&nutrition.some(directMyFitnessPal))||(!failed('meals')&&meals.some(directMyFitnessPal)),
    candidateFound:!failed('sourceMetrics')&&candidateFromFamily(sourceMetrics,'myfitnesspal'),
    domainKeys:['nutrition','meals','sourceMetrics']
  };
  if(source==='fleury')return{dataFound:!failed('labs')&&contains(labs,['laboratory','source','source_file'],'fleury'),candidateFound:false,domainKeys:['labs']};
  if(source==='einstein')return{dataFound:!failed('labs')&&contains(labs,['laboratory','source','source_file'],'einstein'),candidateFound:false,domainKeys:['labs']};
  return{dataFound:false,candidateFound:false,domainKeys:[]};
}

export function latestSourceMetricDateFor(source){
  if(failed('sourceMetrics'))return null;
  const rows=(state.data.sourceMetrics||[]).filter(isPreservedCandidate);
  const relevant=source==='polar_flow'?rows.filter(row=>norm(row?.source_family)==='polar_flow'):
    source==='myfitnesspal'?rows.filter(row=>norm(row?.source_family)==='myfitnesspal'):
    source==='apple_health'?rows.filter(appleSourceMetric):[];
  return latestDate(relevant.map(row=>row?.metric_date));
}

export function latestConfirmedSourceDateFor(source){
  const workouts=state.data.workouts||[],labs=state.data.labs||[],nutrition=state.data.nutrition||[],meals=state.data.meals||[],metrics=state.data.metrics||[],directDates=[];
  if(source==='apple_health'){
    if(!failed('metrics'))directDates.push(...metrics.filter(row=>stableAppleMetricTypes.has(row?.metric_type)&&isAppleSource(row)&&isAppleActivitySummarySource(row)).map(row=>row?.measured_at));
  }else if(source==='polar_flow'){
    if(!failed('workouts'))directDates.push(...matching(workouts,['source','source_file'],'polar').map(row=>row?.workout_date));
  }else if(source==='myfitnesspal'){
    if(!failed('nutrition'))directDates.push(...nutrition.filter(directMyFitnessPal).map(row=>row?.nutrition_date));
    if(!failed('meals'))directDates.push(...meals.filter(directMyFitnessPal).map(row=>row?.meal_date));
  }else if(source==='fleury'||source==='einstein'){
    if(!failed('labs')){
      const term=source==='fleury'?'fleury':'einstein';
      directDates.push(...matching(labs,['laboratory','source','source_file'],term).map(row=>dateOnly(row?.collection_date)||dateOnly(row?.report_date)));
    }
  }
  return latestDate(directDates);
}

export function sourceCoverageFor(source){
  const confirmedDate=latestConfirmedSourceDateFor(source),preservedDate=latestSourceMetricDateFor(source);
  return {confirmedDate,preservedDate,latestDate:latestDate([confirmedDate,preservedDate])};
}

export function latestSourceEvidenceDateFor(source){
  return sourceCoverageFor(source).latestDate;
}

export function sourceStatusFor(source){
  const upload=latestUploadFor(source),bucket=uploadBucket(upload),{dataFound,candidateFound,domainKeys}=sourceEvidence(source);
  if(bucket==='attention')return'attention';
  if(bucket==='in_progress')return'processing';
  if(dataFound)return'ready';
  if(domainKeys.some(failed)||failed('uploads'))return'unknown';
  if(candidateFound)return'candidate';
  if(upload)return'received';
  return'missing';
}
