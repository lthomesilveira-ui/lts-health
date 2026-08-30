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
  const workouts=state.data.workouts||[],labs=state.data.labs||[],nutrition=state.data.nutrition||[],meals=state.data.meals||[],metrics=state.data.metrics||[];
  if(source==='apple_health')return{dataFound:metrics.some(m=>stableAppleMetricTypes.has(m.metric_type)&&contains([m],['source','source_file'],'apple')),domainKeys:['metrics']};
  if(source==='polar_flow')return{dataFound:contains(workouts,['source','source_file'],'polar'),domainKeys:['workouts']};
  if(source==='myfitnesspal')return{dataFound:contains(nutrition,['source','source_file'],'myfitnesspal')||contains(meals,['source','source_file'],'myfitnesspal'),domainKeys:['nutrition','meals']};
  if(source==='fleury')return{dataFound:contains(labs,['laboratory','source','source_file'],'fleury'),domainKeys:['labs']};
  if(source==='einstein')return{dataFound:contains(labs,['laboratory','source','source_file'],'einstein'),domainKeys:['labs']};
  return{dataFound:false,domainKeys:[]};
}

export function sourceStatusFor(source){
  const upload=latestUploadFor(source),bucket=uploadBucket(upload),{dataFound,domainKeys}=sourceEvidence(source);
  if(bucket==='attention')return'attention';
  if(bucket==='in_progress')return'processing';
  if(dataFound)return'ready';
  if(domainKeys.some(failed)||failed('uploads'))return'unknown';
  if(upload)return'received';
  return'missing';
}
