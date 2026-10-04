import {num,norm,day} from './core.js';
import {validDay} from './history-tools.js';
import {localHealthDay,bodySourceLabel,bodyMetricSeries,labHighlights} from './health-context.js';
import {labGroups,labCohorts} from './labs-layout-v2.js';
import {addDays,normalizeMuscleGroup} from './integrated-analysis.js';
import {hydrationModel} from './hydration.js';

const ready=(status,key)=>status?.[key]==='ready';
const ordered=(rows,key)=>rows.filter(r=>validDay(r[key])).slice().sort((a,b)=>day(a[key]).localeCompare(day(b[key])));
const inside=(date,b)=>Boolean(validDay(date)&&(!b.start||day(date)>=b.start)&&day(date)<=b.end);
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const difference=(a,b)=>num(a)==null||num(b)==null?null:num(a)-num(b);
const days=(start,end)=>start?Math.round((Date.parse(`${end}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/86400000)+1:null;
function uniqueDates(rows,key){
  const map=new Map();for(const row of rows){const d=validDay(row[key]);if(!d)continue;if(!map.has(d))map.set(d,[]);map.get(d).push(row);}
  return [...map].filter(([,r])=>r.length===1).map(([,r])=>r[0]);
}
export function reportBounds(period='90',end=localHealthDay()){
  const size=['30','90','365'].includes(String(period))?Number(period):null;
  const current={start:size?addDays(end,1-size):null,end,days:size};
  const previous=size?{start:addDays(current.start,-size),end:addDays(current.start,-1),days:size}:null;
  return {current,previous};
}
export const bodyCohort=row=>norm(row?.source)?JSON.stringify([norm(row.source),norm(row.device_name)]):null;
export const segments=[['right_arm','Braço direito','arms'],['left_arm','Braço esquerdo','arms'],['trunk','Tronco','trunk'],['right_leg','Perna direita','legs'],['left_leg','Perna esquerda','legs']];
function friendlyPolarSources(data){
  const names=[...new Set([...(data.sourceMetrics||[]),...(data.polarSessions||[])].map(r=>r.source_name).filter(n=>/^Polar Flow · aparelho [a-f0-9]{10}$/.test(n||'')))].sort();
  return new Map(names.map((n,i)=>[n,`Polar Flow · aparelho ${i+1}`]));
}
export function segmentIdentity(row,body=[]){
  // Only the original file plus date can carry device identity across domains.
  const linked=row.source_file?body.filter(b=>day(b.measured_at)===day(row.measured_at)&&b.source_file===row.source_file):[];
  const device=String(row.device_name||((linked.length===1)?linked[0].device_name:'')||'').trim();
  return {key:norm(row.source)&&(row.device_name||linked.length<2)?JSON.stringify([norm(row.source),norm(device)]):null,label:device||`${String(row.source||'Bioimpedância')} · modelo não informado`,device};
}
function measurementPair(rows,cohort,key='measured_at'){
  const sorted=ordered(rows,key),latestDate=day(sorted.at(-1)?.[key]);
  const onLatest=sorted.filter(r=>day(r[key])===latestDate);
  if(!sorted.length)return {available:false,reason:'empty',rows:[]};
  if(onLatest.length!==1)return {available:false,reason:'ambiguous',rows:sorted,latest:null};
  const latest=onLatest[0],identity=cohort(latest),prior=sorted.filter(r=>day(r[key])<latestDate).at(-1);
  if(!prior)return {available:false,reason:'single',rows:sorted,latest};
  if(sorted.filter(r=>day(r[key])===day(prior[key])).length!==1)return {available:false,reason:'ambiguous',rows:sorted,latest};
  if(!identity||identity!==cohort(prior))return {available:false,reason:'source_changed',rows:sorted,latest,previous:prior};
  return {available:true,rows:sorted,latest,previous:prior,start:day(prior[key]),end:latestDate};
}
export function compositionReport(data,status,bounds,source='all'){
  if(!ready(status,'body'))return {available:false,reason:'unavailable',rows:[],origins:[],series:{}};
  const rows=ordered((data.body||[]).filter(r=>inside(r.measured_at,bounds)),'measured_at');
  const origins=[...new Map(rows.map(r=>[bodyCohort(r),bodySourceLabel(r)])).entries()].filter(([k])=>k);
  const selection=origins.some(([k])=>k===source)?source:'all';
  const selected=selection==='all'?rows:rows.filter(r=>bodyCohort(r)===selection);
  const pair=measurementPair(selected,bodyCohort);
  const changes=pair.available?Object.fromEntries(['weight_kg','skeletal_muscle_mass_kg','fat_mass_kg','body_fat_pct','body_water_l'].map(k=>[k,difference(pair.latest[k],pair.previous[k])])):{};
  return {...pair,origins,selection,changes,series:Object.fromEntries(['weight_kg','skeletal_muscle_mass_kg','fat_mass_kg','body_fat_pct'].map(k=>[k,bodyMetricSeries(selected,k,bounds)]))};
}
const regionFor=value=>{
  const group=normalizeMuscleGroup(value);
  if(['Bíceps','Tríceps','Ombros'].includes(group))return 'arms';
  if(['Peito','Costas','Abdômen'].includes(group))return 'trunk';
  if(['Quadríceps','Posteriores','Panturrilhas','Adutores/abdutores','Pernas'].includes(group))return 'legs';
  return null;
};
export function trainingSummary(data,status,bounds,region=null){
  if(!ready(status,'workouts'))return {available:false,sessions:null,minutes:null,recordedMinutes:null,durationCoverage:null,durationTotal:null,durationComplete:false,sets:null,points:[]};
  const workouts=(data.workouts||[]).filter(r=>r.is_canonical===true&&r.record_status!=='quarantined'&&inside(r.workout_date,bounds));
  const ids=new Set(workouts.map(r=>r.source_record_id)),exercises=ready(status,'exercises')?(data.exercises||[]).filter(r=>ids.has(r.workout_source_record_id)&&(!region||regionFor(r.muscle_group)===region)):[];
  const exIds=new Set(exercises.map(r=>r.source_record_id));
  const sets=ready(status,'sets')&&ready(status,'exercises')?(data.sets||[]).filter(r=>exIds.has(r.exercise_source_record_id)&&ids.has(r.workout_source_record_id)):null;
  const sessions=region?ready(status,'exercises')?new Set(exercises.map(r=>r.workout_source_record_id)).size:null:workouts.length;
  const selected=region?workouts.filter(r=>exercises.some(e=>e.workout_source_record_id===r.source_record_id)):workouts;
  const knownDuration=selected.filter(r=>num(r.duration_minutes)!=null),groups=new Map();
  for(const row of selected){const date=day(row.workout_date);if(!groups.has(date))groups.set(date,[]);groups.get(date).push(row);}
  const points=[...groups].filter(([,list])=>list.every(r=>num(r.duration_minutes)!=null)).map(([date,list])=>({date,value:list.reduce((s,r)=>s+num(r.duration_minutes),0),cohort:'recorded-duration'})).sort((a,b)=>a.date.localeCompare(b.date));
  const recordedMinutes=knownDuration.length?knownDuration.reduce((s,r)=>s+num(r.duration_minutes),0):null;
  const durationComplete=selected.length>0&&knownDuration.length===selected.length;
  return {available:true,sessions,sets:sets?.length??null,minutes:durationComplete?recordedMinutes:null,recordedMinutes,durationCoverage:knownDuration.length,durationTotal:selected.length,durationComplete,points,groups:[...new Set(exercises.map(e=>normalizeMuscleGroup(e.muscle_group)))],rows:selected};
}
export function hydrationSummary(data,status,bounds){
  // A failed overlapping source can hide a conflict; do not select the surviving one.
  if(!ready(status,'nutrition')||!ready(status,'sourceMetrics'))return {available:false,mean:null,days:null,rows:[],conflicts:[],origins:[]};
  const timeline=hydrationModel(data),rows=timeline.rows.filter(r=>inside(r.date,bounds));
  const rowDates=new Set(rows.map(r=>r.date)),origins=[...new Set(rows.map(r=>norm(r.source)))];
  if((data.nutrition||[]).some(r=>rowDates.has(day(r.nutrition_date))&&num(r.water_ml)>0&&!norm(r.source)))origins.push(null);
  return {available:true,mean:mean(rows.map(r=>r.value)),days:rows.length,intervalDays:days(bounds.start,bounds.end),rows,conflicts:timeline.conflicts.filter(r=>inside(r.date,bounds)),origins};
}
export function nutritionSummary(data,status,bounds){
  if(!ready(status,'nutrition'))return {available:false,days:null,means:{},counts:{},rows:[],origins:[]};
  const rows=uniqueDates((data.nutrition||[]).filter(r=>inside(r.nutrition_date,bounds)),'nutrition_date');
  const fields=['calories_kcal','protein_g','carbs_g','fat_g','fiber_g','water_ml'],means={},counts={};
  for(const k of fields){const values=rows.map(r=>num(r[k])).filter(v=>v!=null);means[k]=mean(values);counts[k]=values.length;}
  return {available:true,days:rows.length,intervalDays:days(bounds.start,bounds.end),means,counts,rows,origins:[...new Set(rows.map(r=>norm(r.source)))]};
}
export function polarTrainingSummary(data,status,bounds){
  if(!ready(status,'polarSessions'))return {available:false,rows:[],points:[]};
  const rows=ordered((data.polarSessions||[]).filter(r=>inside(r.workout_date,bounds)),'workout_date'),dates=new Map();
  for(const r of rows){const d=day(r.workout_date);if(!dates.has(d))dates.set(d,[]);dates.get(d).push(r);}
  const points=[...dates].filter(([,list])=>list.every(r=>num(r.duration_minutes)!=null)).map(([date,list])=>({date,value:list.reduce((s,r)=>s+num(r.duration_minutes),0),cohort:'polar-recorded-duration'}));
  const labels=friendlyPolarSources(data);
  return {available:true,rows:rows.map(r=>({...r,displaySource:labels.get(r.source_name)||r.source_name})),points};
}
export function segmentalReport(data,status,bounds,source='all',selectedRegion='right_arm',kind='lean'){
  if(!ready(status,'segmental'))return {available:false,reason:'unavailable',origins:[],rows:[],parts:[],points:[]};
  const rows=ordered((data.segmental||[]).filter(r=>inside(r.measured_at,bounds)),'measured_at');
  const identity=r=>segmentIdentity(r,ready(status,'body')?data.body||[]:[]);
  const origins=[...new Map(rows.map(r=>[identity(r).key,identity(r).label])).entries()].filter(([k])=>k);
  const selection=origins.some(([k])=>k===source)?source:'all',selected=selection==='all'?rows:rows.filter(r=>identity(r).key===selection);
  const pair=measurementPair(selected,r=>identity(r).key);
  if(pair.available&&!ready(status,'body')&&(!pair.latest.device_name||!pair.previous.device_name)){pair.available=false;pair.reason='unavailable_context';}
  const region=segments.some(([k])=>k===selectedRegion)?selectedRegion:'right_arm',metric=['lean','fat'].includes(kind)?kind:'lean',field=`${metric}_${region}_kg`;
  const parts=segments.map(([key,label,trainingRegion])=>({key,label,trainingRegion,current:num(pair.latest?.[`lean_${key}_kg`]),fat:num(pair.latest?.[`fat_${key}_kg`]),delta:pair.available?difference(pair.latest[`lean_${key}_kg`],pair.previous[`lean_${key}_kg`]):null,fatDelta:pair.available?difference(pair.latest[`fat_${key}_kg`],pair.previous[`fat_${key}_kg`]):null}));
  const regionKey=segments.find(([k])=>k===region)?.[2];
  const interval=pair.available?{start:addDays(pair.start,1),end:pair.end}:null;
  const intervalDays=interval?days(interval.start,interval.end):null;
  const previousInterval=intervalDays?{start:addDays(interval.start,-intervalDays),end:addDays(interval.start,-1)}:null;
  return {...pair,origins,selection,region,metric,parts,interval,previousInterval,training:interval?trainingSummary(data,status,interval,regionKey):null,previousTraining:previousInterval?trainingSummary(data,status,previousInterval,regionKey):null,nutrition:interval?nutritionSummary(data,status,interval):null,points:ordered(uniqueDates(selected,'measured_at'),'measured_at').filter(r=>num(r[field])!=null).map(r=>({date:day(r.measured_at),value:num(r[field]),cohort:identity(r).key,context:identity(r).label}))};
}
export function laboratoryReport(data,status,bounds,requested=null){
  if(!ready(status,'labs'))return {available:false,groups:[],rows:[],points:[],comparisons:[]};
  const groups=labGroups((data.labs||[]).filter(r=>inside(r.collection_date,bounds)));
  const preferred=labHighlights.map(label=>groups.find(g=>g.key===norm(label))).filter(Boolean);
  const group=groups.find(g=>g.key===requested)||preferred[0]||groups[0];
  function comparison(g){
    const date=day(g.rows.at(-1)?.collection_date),latest=g.rows.filter(r=>day(r.collection_date)===date);
    if(latest.length!==1)return {group:g,current:null,reason:'ambiguous'};
    const current=latest[0],cohorts=labCohorts(g),c=cohorts.find(c=>c.all.includes(current));
    const exact=c?.rows.includes(current),previous=exact&&c.method?c.rows.filter(r=>day(r.collection_date)<date).at(-1):null;
    // Values remain readable when methods are unknown; a numerical delta does not.
    const prior=g.rows.filter(r=>day(r.collection_date)<date).at(-1),priorDate=day(prior?.collection_date),contextPrior=prior&&g.rows.filter(r=>day(r.collection_date)===priorDate).length===1?prior:null;
    return {group:g,current,previous:previous||contextPrior,comparable:Boolean(previous),delta:previous?difference(current.result_numeric,previous.result_numeric):null,reason:previous?'comparable':!exact?'non_exact':!c?.method?'unknown_method':contextPrior?'incompatible':'single'};
  }
  const selected=group?comparison(group):null,cohorts=group?labCohorts(group):[],unit=String(selected?.current?.unit||cohorts[0]?.unit||'');
  const points=cohorts.filter(c=>c.unit===unit).flatMap(c=>c.rows.map(r=>({date:day(r.collection_date),value:num(r.result_numeric),cohort:c.method?c.key:null,context:`${c.origin} · ${c.method||'método não informado'}`,row:r}))).sort((a,b)=>a.date.localeCompare(b.date));
  const display=[...preferred,...groups.filter(g=>!preferred.includes(g))];
  return {available:true,groups,selected,unit,points,rows:group?.rows||[],comparisons:display.map(comparison)};
}
export function recoveryReport(data,status,bounds,requested=null){
  if(!ready(status,'sourceMetrics'))return {available:false,series:[],points:[]};
  const buckets=new Map(),labels=friendlyPolarSources(data);
  const supported=new Set(['sleep_duration_h','resting_heart_rate_bpm','hrv_sdnn_ms','steps']);
  for(const row of data.sourceMetrics||[]){
    if(!supported.has(row.metric_type)||!['candidate','held'].includes(norm(row.canonical_status))||num(row.value)==null||!inside(row.metric_date,bounds)||!row.unit||!row.source_name)continue;
    const key=JSON.stringify([row.metric_type,row.source_family,row.source_name,row.unit]);
    if(!buckets.has(key))buckets.set(key,{key,metric:row.metric_type,label:labels.get(row.source_name)||row.source_name,unit:row.unit,rows:[]});buckets.get(key).rows.push(row);
  }
  const series=[...buckets.values()].map(s=>({...s,points:ordered(uniqueDates(s.rows,'metric_date'),'metric_date').map(r=>({date:day(r.metric_date),value:num(r.value),cohort:s.key,context:s.label}))})).sort((a,b)=>(a.metric==='sleep_duration_h'?-1:0)-(b.metric==='sleep_duration_h'?-1:0)||a.key.localeCompare(b.key));
  const selected=series.find(s=>s.key===requested)||series[0];
  return {available:true,series,selected,points:selected?.points||[]};
}
export function usefulReports(data={},status={},ui={},today=localHealthDay()){
  const period=['30','90','365','all'].includes(ui.analysisPeriod)?ui.analysisPeriod:'90',windows=reportBounds(period,today);
  if(period==='all'){
    const dates=[['body','measured_at'],['segmental','measured_at'],['labs','collection_date'],['workouts','workout_date'],['polarSessions','workout_date'],['nutrition','nutrition_date'],['sourceMetrics','metric_date']].flatMap(([key,dateKey])=>ready(status,key)?(data[key]||[]).map(r=>validDay(r[dateKey])).filter(d=>d&&d<=today):[]).sort();
    windows.current.start=dates[0]||today;
  }
  const bounds=windows.current,body=compositionReport(data,status,bounds,ui.reportBodySource),segmental=segmentalReport(data,status,bounds,ui.reportSegmentSource,ui.reportRegion,ui.reportSegmentMetric),labs=laboratoryReport(data,status,bounds,ui.reportLabMarker),training=trainingSummary(data,status,bounds),nutrition=nutritionSummary(data,status,bounds),recovery=recoveryReport(data,status,bounds,ui.reportRecoverySource);
  const hydration=hydrationSummary(data,status,bounds);
  const prior=windows.previous?{training:trainingSummary(data,status,windows.previous),nutrition:nutritionSummary(data,status,windows.previous),hydration:hydrationSummary(data,status,windows.previous),recovery:recoveryReport(data,status,windows.previous,recovery.selected?.key)}:null;
  // A prior device is never substituted for the selected current device.
  if(prior?.recovery.selected?.key!==recovery.selected?.key&&prior?.recovery)prior.recovery={...prior.recovery,selected:null,points:[]};
  const sourcesMatch=nutrition.origins.length===1&&nutrition.origins[0]&&prior?.nutrition.origins.length===1&&nutrition.origins[0]===prior.nutrition.origins[0];
  const waterSourcesMatch=hydration.origins.length===1&&hydration.origins[0]&&prior?.hydration.origins.length===1&&hydration.origins[0]===prior.hydration.origins[0];
  return {period,today,...windows,body,segmental,labs,training,polar:polarTrainingSummary(data,status,bounds),nutrition,hydration,recovery,prior,nutritionComparable:Boolean(sourcesMatch),hydrationComparable:Boolean(waterSourcesMatch),lastNutrition:ordered(ready(status,'nutrition')?data.nutrition||[]:[],'nutrition_date').at(-1)?.nutrition_date||null,lastWorkout:ordered(ready(status,'workouts')?(data.workouts||[]).filter(r=>r.is_canonical===true&&r.record_status!=='quarantined'):[],'workout_date').at(-1)?.workout_date||null};
}
