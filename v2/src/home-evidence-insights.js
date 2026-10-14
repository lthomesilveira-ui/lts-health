import {labReferenceStatus} from './labs-layout-v2.js';
import {goalReferenceMeta,documentedWaterBase} from './personal-goals.js';
import {validDay} from './history-tools.js';
import {isSetExtension} from './training-session.js';
const norm=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const number=v=>v==null||typeof v==='boolean'||String(v).trim()===''||!Number.isFinite(Number(v))?null:Number(v);
const day=v=>validDay(v)||null;
const group=(rows,key)=>{const out=new Map();for(const row of rows){const k=key(row);if(!out.has(k))out.set(k,[]);out.get(k).push(row);}return out;};
const distinct=values=>[...new Set(values)];
const validFields=['calories_kcal','protein_g'];
export function nutritionCoverage(m){
 const sources=(m.nutrition.sources||[]).map(s=>({...s,observedDates:distinct(s.closedRows.filter(r=>validFields.some(f=>number(r[f])!=null)).map(r=>r.date)).sort()}));
 const canonical=sources.filter(s=>s.status==='canonical');
 const byMetric=Object.fromEntries(validFields.map(f=>[f,distinct(canonical.flatMap(s=>s.closedRows.filter(r=>number(r[f])!=null).map(r=>r.date))).sort()]));
 const dates=distinct(canonical.flatMap(s=>s.observedDates)).sort(),overlapDates=[...group(canonical.flatMap(s=>s.observedDates.map(date=>({date,key:s.key}))),r=>r.date)].filter(([,rows])=>rows.length>1).map(([date])=>date);
 return {sources,canonical,dates,days:dates.length,byMetric,overlapDates,closedDays:m.bounds.closedDays,pooledMean:null,selectedKey:m.nutrition.source?.key||null};
}
export function observedTraining(m){
 const t=m.training;if(!t.available||!t.detailsAvailable)return {available:false,examples:[],selected:null};
 const workouts=new Map(t.rows.filter(w=>w.source_record_id).map(w=>[w.source_record_id,w]));
 const occurrences=[];
 for(const e of t.exercises||[]){const w=workouts.get(e.workout_source_record_id);if(!w||!norm(e.exercise)||!norm(e.machine)||!norm(w.location))continue;
  for(const s of t.recordedSets||[]){if(s.workout_source_record_id!==w.source_record_id||s.exercise_source_record_id!==e.source_record_id||isSetExtension(s)||['warmup','other'].includes(s.phase))continue;
   const weight=number(s.weight),reps=number(s.reps_numeric),unit=norm(s.weight_unit);if(weight==null||weight<0||reps==null||reps<=0||!unit||unit==='unitless')continue;
   const phase=norm(s.phase)||'unknown',context=[norm(e.exercise),norm(e.machine),norm(w.location),unit,reps,phase,norm(s.technique),s.failure===true?'failure':s.failure===false?'no_failure':'effort_unknown',s.near_failure===true?'near_failure':s.near_failure===false?'not_near_failure':'near_effort_unknown'];
   occurrences.push({key:JSON.stringify(context),exercise:e.exercise,machine:e.machine,location:w.location,unit,reps,phase,technique:s.technique||null,date:w.date||day(w.workout_date),value:weight,exerciseId:e.source_record_id,workoutId:w.source_record_id,setId:s.source_record_id||null});
  }
 }
 const examples=[];
 for(const[key,items]of group(occurrences,r=>r.key)){
  // More than one load under the same date/context is not resolved by taking
  // the largest value. Identical load repetitions may share a plotted point.
  const ambiguousDates=[],points=[];
  for(const[date,rows]of group(items,r=>r.date)){const loads=distinct(rows.map(r=>r.value));if(loads.length!==1||distinct(rows.map(r=>r.workoutId)).length!==1||distinct(rows.map(r=>r.exerciseId)).length!==1){ambiguousDates.push(date);continue;}points.push({...rows[0],setCount:rows.length,cohort:key});}
  points.sort((a,b)=>a.date.localeCompare(b.date));if(points.length<2)continue;
  examples.push({...items[0],points,ambiguousDates,lastDate:points.at(-1).date,firstDate:points[0].date,conditionsConfirmed:false,phaseConfirmedFromOriginal:false,selectionQuality:items[0].phase==='working'?'working_as_recorded':'phase_unknown'});
 }
 examples.sort((a,b)=>Number(b.phase==='working')-Number(a.phase==='working')||b.points.length-a.points.length||b.lastDate.localeCompare(a.lastDate)||a.key.localeCompare(b.key));
 return {available:true,examples,selected:examples[0]||null,latestWorkout:t.latestWorkout,notes:'Mesmo nome, equipamento e local registrados; não confirma a mesma estação física nem ganho de força. Fase preservada como consta no registro.'};
}
export function labEvidence(m){
 const latest=m.labs.latestRows||[];
 const ambiguous=[];const candidates=[];
 for(const[key,rows]of group(latest,r=>JSON.stringify([norm(r.biomarker),norm(r.laboratory||r.source),norm(r.unit),norm(r.method)]))){
  if(rows.length!==1){ambiguous.push(key);continue;}const row=rows[0],range=labReferenceStatus(row);if(!['above','below','within'].includes(range.status))continue;
  candidates.push({row,range,outside:range.status!=='within'});
 }
 // Deterministic display order, not a clinical risk score. Unclassified results
 // remain available in the full laboratory route.
 candidates.sort((a,b)=>Number(b.outside)-Number(a.outside)||String(a.row.biomarker).localeCompare(String(b.row.biomarker),'pt-BR'));
 return {available:m.labs.available,candidates,selected:candidates[0]||null,ambiguous,selectionRule:'Resultado da última coleta com intervalo explícito do laudo; fora da faixa primeiro, depois ordem alfabética. Não é prioridade clínica.'};
}
export function waterGoal(data,status,date){
 if(status.goals!=='ready'||!date)return null;
 const eligible=(data.goals||[]).filter(r=>day(r.effective_from)&&day(r.effective_from)<=date).sort((a,b)=>day(b.effective_from).localeCompare(day(a.effective_from)));
 if(!eligible.length)return null;const latest=eligible.filter(r=>day(r.effective_from)===day(eligible[0].effective_from));if(latest.length!==1||goalReferenceMeta(latest[0])||number(latest[0].water_ml)==null||number(latest[0].water_ml)<=0)return null;
 const doc=documentedWaterBase(latest[0]);
 return {value:number(latest[0].water_ml),effectiveFrom:day(latest[0].effective_from),dateBasis:doc?'document_update':'personal_target',documentedOn:doc?.documented_on||null,notes:doc?`${doc.source}, página ${doc.source_page}. Data de atualização do documento; início clínico não explicitado. ${doc.exercise_addition||''}`:String(latest[0].notes||''),row:latest[0]};
}
export function homeEvidence(data,status,m){
 const water=m.water,last=water.latest,goal=waterGoal(data,status,last?.date);
 return {nutrition:nutritionCoverage(m),training:observedTraining(m),labs:labEvidence(m),water:{goal,date:last?.date||null,delta:goal&&last?number(last.value)-goal.value:null,points:water.points||[],source:water.source}};
}
