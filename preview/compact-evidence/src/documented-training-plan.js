import {trainingSessionSummary} from './training-session-summary.js';
import {isSetExtension} from './training-session.js';

// Documentary references are private records, never a public prescription or
// proof of use. Deliberately exclude raw source payload and clinical lab text.
export const trainingPlanProjection='source_record_id,document_date,document_type,source_file,source,checksum,training_plan:source_payload->training_plan_ui';
export const treatmentStatusProjection='source_record_id,document_date,document_type,source_file,source,checksum,treatment_status:source_payload->treatment_status_ui';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.trim()?v.trim():null;
const positive=v=>Number.isSafeInteger(v)&&v>0;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const planDay=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return null;const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v?v:null;};
const range=v=>Array.isArray(v)&&v.length===2&&v.every(positive)&&v[0]<=v[1];
const pages=(v,n)=>Array.isArray(v)&&v.length>0&&new Set(v).size===v.length&&v.every(p=>positive(p)&&p<=n);
const note=(v,n)=>object(v)&&text(v.text)&&pages(v.pages,n);
const norm=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function bound(row,value,type){
  return object(row)&&row.document_type===type&&text(row.source_record_id)&&text(row.source_file)&&hash(row.checksum)&&object(value)&&value.schema_version===1&&value.source_record_id===row.source_record_id&&value.source_sha256===row.checksum&&planDay(row.document_date)&&value.documented_on===row.document_date&&planDay(value.received_on);
}
export function documentedTrainingPlan(row){
  const p=row?.training_plan,n=p?.page_count;
  if(!bound(row,p,'training_plan')||p.type!=='documented_training_plan'||!positive(n)||p.clinical_start!==null||p.clinical_start_status!=='not_confirmed')return null;
  if(p.verification?.status!=='source_verified'||!pages(p.verification.pages,n)||p.verification.pages.length!==n||!text(p.author)||!positive(p.weeks)||!positive(p.sessions_per_week)||!positive(p.rest_hours)||!range(p.musculation_minutes)||!range(p.initial_rir))return null;
  if(!object(p.initial_cardio)||!positive(p.initial_cardio.blocks)||!range(p.initial_cardio.minutes)||!pages(p.initial_cardio.pages,n))return null;
  if(!Array.isArray(p.sessions)||!p.sessions.length||new Set(p.sessions.map(s=>s.id)).size!==p.sessions.length)return null;
  for(const s of p.sessions){
    if(!text(s.id)||!text(s.name)||!pages(s.pages,n)||!Array.isArray(s.exercises)||!s.exercises.length||new Set(s.exercises.map(e=>e.id)).size!==s.exercises.length)return null;
    for(const e of s.exercises)if(!text(e.id)||!text(e.name)||!positive(e.sets)||!range(e.reps)||!range(e.rest_seconds)||typeof e.per_side!=='boolean'||!Array.isArray(e.alternatives)||!e.alternatives.every(a=>text(a.name)&&text(a.note))||!note(e.instructions,n))return null;
  }
  if(!Array.isArray(p.notes)||!p.notes.every(v=>note(v,n))||!Array.isArray(p.progression)||!p.progression.every(v=>note(v,n)))return null;
  const fields=['schema_version','type','source_record_id','source_sha256','documented_on','received_on','page_count','clinical_start','clinical_start_status','verification','author','weeks','sessions_per_week','rest_hours','musculation_minutes','initial_rir','initial_cardio','notes','progression'];
  const copy=Object.fromEntries(fields.map(key=>[key,structuredClone(p[key])]));
  copy.sessions=p.sessions.map(s=>({id:s.id,name:s.name,pages:[...s.pages],exercises:s.exercises.map(e=>({id:e.id,name:e.name,sets:e.sets,reps:[...e.reps],rest_seconds:[...e.rest_seconds],per_side:e.per_side,instructions:{text:e.instructions.text,pages:[...e.instructions.pages]},alternatives:e.alternatives.map(a=>({name:a.name,note:a.note}))}))}));
  return {...copy,source_file:row.source_file,source:row.source||row.source_file};
}
export function documentedTreatmentStatus(row){
  const p=row?.treatment_status;
  if(!bound(row,p,'patient_status')||p.type!=='patient_confirmed_treatment_status'||!Array.isArray(p.in_use)||!p.in_use.length||!p.in_use.every(text)||new Set(p.in_use.map(norm)).size!==p.in_use.length||p.other_protocol_medications!=='not_started'||p.effective_start!==null||!text(p.statement)||p.verification?.status!=='owner_statement')return null;
  return {documented_on:p.documented_on,in_use:[...p.in_use],other_protocol_medications:'not_started',statement:p.statement,effective_start:null,source:row.source||'Confirmação pessoal'};
}
export function selectPlanRecord(rows,status,today,type,validator){
  if(status!=='ready')return {state:status==='error'?'error':'loading',value:null};
  if(!Array.isArray(rows)||!planDay(today))return {state:'invalid',value:null};
  const all=rows.filter(r=>r?.document_type===type);
  if(all.some(r=>!planDay(r.document_date)))return {state:'invalid',value:null};
  const eligible=all.filter(r=>r.document_date<=today);
  if(!eligible.length)return {state:'empty',value:null};
  const latest=eligible.map(r=>r.document_date).sort().at(-1),matches=eligible.filter(r=>r.document_date===latest);
  if(matches.length!==1)return {state:'invalid',value:null};
  const value=validator(matches[0]);
  if(!value||value.received_on&&value.received_on>today)return {state:'invalid',value:null};
  return {state:'ready',value};
}
export function planMonday(v){const d=planDay(v);if(!d)return null;const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()-(t.getUTCDay()+6)%7);return t.toISOString().slice(0,10);}
const shift=(v,n)=>new Date(Date.parse(v+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);

/** Exact names or an explicit temporary user link; no anatomy/synonym inference.
 * Existing canonical-session validation owns duplicates, phases and extensions. */
export function trainingPlanComparison(data={},status={},ui={},today){
  const selected=selectPlanRecord(data.trainingPlans,status.trainingPlans,today,'training_plan',documentedTrainingPlan);
  if(!selected.value)return {...selected,plan:null};
  const plan=selected.value,template=plan.sessions.find(s=>s.id===ui.trainingPlanTemplate)||plan.sessions[0];
  const sessions=status.workouts==='ready'&&Array.isArray(data.workouts)?data.workouts.filter(w=>w.is_canonical===true&&w.record_status!=='quarantined'&&planDay(w.workout_date)&&w.workout_date<=today).filter(w=>trainingSessionSummary(w,data,status).sessionAvailable).sort((a,b)=>b.workout_date.localeCompare(a.workout_date)||a.source_record_id.localeCompare(b.source_record_id)):[];
  const week=planMonday(ui.trainingPlanWeek)||planMonday(today),end=shift(week,6);
  const weeks=[...new Set([planMonday(today),...sessions.map(w=>planMonday(w.workout_date))])].filter(Boolean).sort().reverse().slice(0,16);
  if(!weeks.includes(week))weeks.unshift(week);
  const weekly=[...new Map(sessions.filter(w=>w.workout_date>=week&&w.workout_date<=end).map(w=>[w.source_record_id,w])).values()];
  const workout=ui.trainingPlanWorkout?sessions.find(w=>w.source_record_id===ui.trainingPlanWorkout)||null:sessions[0]||null;
  const summary=workout?trainingSessionSummary(workout,data,status):null,links=ui.trainingPlanLinks||{},exercises=summary?.acceptedExercises||[];
  const matches=template.exercises.map(e=>{
    if(Object.hasOwn(links,e.id))return {e,matches:exercises.filter(x=>x.source_record_id===links[e.id]),explicit:true};
    const names=[e.name,...e.alternatives.map(a=>a.name)].map(norm);
    return {e,matches:exercises.filter(x=>names.includes(norm(x.exercise))),explicit:false};
  });
  const ids=matches.flatMap(m=>m.matches.length===1?[m.matches[0].source_record_id]:[]);
  const rows=matches.map(({e,matches,explicit})=>{
    const exercise=matches.length===1&&ids.filter(id=>id===matches[0].source_record_id).length===1?matches[0]:null;
    const sets=exercise&&summary.setsAvailable?summary.acceptedSets.filter(s=>s.exercise_source_record_id===exercise.source_record_id):[];
    const primary=sets.filter(s=>!isSetExtension(s)),working=primary.filter(s=>s.phase==='working'),unknown=primary.filter(s=>!['working','warmup','other'].includes(s.phase));
    const phaseComplete=sets.length>0&&unknown.length===0;
    const measured=working.map(s=>s.reps_numeric).filter(v=>typeof v==='number'&&Number.isFinite(v));
    return {reference:e,exercise,explicit,ambiguous:matches.length>1||matches.length===1&&!exercise,sets:summary?.setsAvailable&&exercise?sets:null,
      working:phaseComplete?working.length:null,knownWorking:working.length,unknownPhases:unknown.length,reps:measured,
      outsideRange:working.length&&measured.length===working.length?measured.filter(n=>n<e.reps[0]||n>e.reps[1]).length:null};
  });
  const failure=summary?.setsAvailable?summary.effort.failure:null,extensions=summary?.setsAvailable?summary.counts.extensions:null;
  const gaps=weekly.length>1?weekly.slice().sort((a,b)=>a.workout_date.localeCompare(b.workout_date)).slice(1).map((w,i)=>({days:(Date.parse(w.workout_date)-Date.parse(weekly.slice().sort((a,b)=>a.workout_date.localeCompare(b.workout_date))[i].workout_date))/86400000})):[];
  return {state:'ready',plan,template,week,end,weeks,weekInProgress:end>=today,sessions,workout,summary,rows,
    weeklyCount:status.workouts==='ready'&&Array.isArray(data.workouts)?weekly.length:null,shortDateGaps:gaps.filter(g=>g.days<2).length,
    historical:week<plan.received_on||Boolean(workout&&workout.workout_date<plan.received_on),failure,extensions,
    observationNote:'O início do plano não foi confirmado. A referência inicial não avança pelo calendário; diferenças descrevem registros e não comprovam adesão, segurança ou treino completo.'};
}
