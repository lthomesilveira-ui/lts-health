import {labReferenceStatus} from './labs-layout-v2.js';
import {waterReferenceContext} from './water-reference-context.js';
import {validDay} from './history-tools.js';
import {trainingComparability} from './training-comparability.js';
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
 const comparison=trainingComparability({workouts:t.rows||[],exercises:t.exercises||[],sets:t.recordedSets||[]},{bounds:m.bounds||{},today:m.today||null});
 const examples=comparison.observed.map(cohort=>{const first=cohort.records[0];return {...cohort,date:first.date,value:first.value,exerciseId:first.exerciseId,workoutId:first.workoutId,setId:first.setId,
  points:cohort.points.map(point=>({...point,key:cohort.key,exercise:cohort.exercise,machine:cohort.machine,location:cohort.location,technique:cohort.technique})),selectionQuality:cohort.phase==='working'?'working_as_recorded':'phase_unknown'};});
 return {available:true,examples,selected:examples[0]||null,latestWorkout:t.latestWorkout,notes:comparison.notes,
  history:comparison.history,indeterminate:comparison.indeterminate,comparable:comparison.comparable,comparisonPending:comparison.comparisonPending};
}
export function labEvidence(m,selectedKey=null){
 const latest=m.labs.latestRows||[];
 const ambiguous=[];const candidates=[];
 for(const[key,rows]of group(latest,r=>JSON.stringify([norm(r.biomarker),norm(r.laboratory||r.source),norm(r.unit),norm(r.method)]))){
  if(rows.length!==1){ambiguous.push(key);continue;}const row=rows[0],range=labReferenceStatus(row);if(!['above','below','within'].includes(range.status))continue;
  candidates.push({key,row,range,outside:range.status!=='within'});
 }
 // Deterministic display order, not a clinical risk score. Unclassified results
 // remain available in the full laboratory route.
 candidates.sort((a,b)=>Number(b.outside)-Number(a.outside)||String(a.row.biomarker).localeCompare(String(b.row.biomarker),'pt-BR'));
 return {available:m.labs.available,candidates,selected:candidates.find(c=>c.key===selectedKey)||candidates[0]||null,selectedByUser:candidates.some(c=>c.key===selectedKey),total:latest.length,withReference:candidates.length,outsideCount:candidates.filter(c=>c.outside).length,unclassified:latest.length-candidates.length,ambiguous,selectionRule:'Resultado da última coleta com intervalo explícito do laudo; fora da faixa primeiro, depois ordem alfabética. Não é prioridade clínica.'};
}
export function waterGoal(data,status,date){return waterReferenceContext(data,status,date).selected;}
export function homeEvidence(data,status,m,ui={}){
 const water=m.water,last=water.latest,goal=waterGoal(data,status,last?.date)||(waterReferenceContext(data,status,m.today).documented);
 return {nutrition:nutritionCoverage(m),training:observedTraining(m),labs:labEvidence(m,ui.homeLabKey),water:{goal,date:last?.date||null,delta:goal&&last&&(!goal.documentedOn||last.date>=goal.documentedOn)?number(last.value)-goal.value:null,points:water.points||[],source:water.source}};
}
