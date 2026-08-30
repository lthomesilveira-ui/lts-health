import {state,norm} from './core.js';

export const stableAppleMetricTypes=new Set(['active_energy_kcal','exercise_minutes','stand_hours']);

const failed=key=>state.domainStatus[key]==='error';
const contains=(rows,fields,term)=>{term=norm(term);return(rows||[]).some(row=>fields.some(field=>norm(row?.[field]).includes(term)));};

export function uploadBucket(upload){
  const status=String(upload?.status||'').toLowerCase();
  if(status==='uploaded'||status==='processing')return'in_progress';
  if(status==='processed'||status==='imported')return'done';
  if(status==='review_required'||status==='rejected'||status==='failed')return'attention';
  return'other';
}

function latestUploadFor(source){
  return [...(state.data.uploads||[])].filter(u=>norm(u.source_type)===norm(source)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0]||null;
}

function sourceEvidence(source){
  const workouts=state.data.workouts||[],labs=state.data.labs||[],nutrition=state.data.nutrition||[],meals=state.data.meals||[],metrics=state.data.metrics||[],sourceMetrics=state.data.sourceMetrics||[];
  if(source==='apple_health')return{dataFound:metrics.some(m=>stableAppleMetricTypes.has(m.metric_type)&&contains([m],['source','source_file'],'apple')),candidateFound:false,domainKeys:['metrics']};
  if(source==='polar_flow')return{dataFound:contains(workouts,['source','source_file'],'polar'),candidateFound:false,domainKeys:['workouts']};
  if(source==='myfitnesspal')return{
    dataFound:contains(nutrition,['source','source_file'],'myfitnesspal')||contains(meals,['source','source_file'],'myfitnesspal'),
    candidateFound:sourceMetrics.some(m=>norm(m.source_family)==='myfitnesspal'&&norm(m.canonical_status||'candidate')==='candidate'),
    domainKeys:['nutrition','meals','sourceMetrics']
  };
  if(source==='fleury')return{dataFound:contains(labs,['laboratory','source','source_file'],'fleury'),candidateFound:false,domainKeys:['labs']};
  if(source==='einstein')return{dataFound:contains(labs,['laboratory','source','source_file'],'einstein'),candidateFound:false,domainKeys:['labs']};
  return{dataFound:false,candidateFound:false,domainKeys:[]};
}

export function sourceStatusFor(source){
  const upload=latestUploadFor(source),bucket=uploadBucket(upload),{dataFound,candidateFound,domainKeys}=sourceEvidence(source);
  if(bucket==='attention')return'attention';
  if(bucket==='in_progress')return'processing';
  if(dataFound)return'ready';
  if(candidateFound)return'candidate';
  if(domainKeys.some(failed)||failed('uploads'))return'unknown';
  if(upload)return'received';
  return'missing';
}
