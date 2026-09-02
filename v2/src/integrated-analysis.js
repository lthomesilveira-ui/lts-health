import {day,num,norm,unique} from './core.js';

const ready=(status,key)=>status?.[key]==='ready';
const sortAsc=(rows,key)=>[...(rows||[])].sort((a,b)=>String(a?.[key]||'').localeCompare(String(b?.[key]||'')));
const average=values=>{const rows=(values||[]).map(num).filter(v=>v!=null);return rows.length?rows.reduce((a,b)=>a+b,0)/rows.length:null;};
const maxDate=values=>values.filter(Boolean).sort().at(-1)||null;
const addDays=(value,delta)=>{const d=new Date(`${day(value)}T12:00:00Z`);if(Number.isNaN(d.getTime()))return'';d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10);};
const daysBetween=(a,b)=>{const x=Date.parse(`${day(a)}T12:00:00Z`),y=Date.parse(`${day(b)}T12:00:00Z`);return Number.isFinite(x)&&Number.isFinite(y)?Math.round((y-x)/86400000):null;};
const inRange=(value,start,end,{afterStart=false}={})=>{const d=day(value);return Boolean(d&&(!start||(afterStart?d>start:d>=start))&&(!end||d<=end));};
const delta=(a,b)=>{a=num(a);b=num(b);return a==null||b==null?null:a-b;};
const canonicalWorkouts=data=>(data.workouts||[]).filter(row=>row?.is_canonical===true&&row?.record_status!=='quarantined');
const comparableLoadUnit=unit=>Boolean(norm(unit)&&norm(unit)!=='unitless');
const sourceIdentity=row=>norm(row?.source_family||row?.source_name||row?.source||'');
const knownSourceMismatch=(a,b)=>{const sa=sourceIdentity(a),sb=sourceIdentity(b);return Boolean(sa&&sb&&sa!==sb);};
const sourceContinuityBreak=(a,b)=>{const sa=sourceIdentity(a),sb=sourceIdentity(b);return Boolean((sa||sb)&&sa!==sb);};
function dailyGroups(rows,key){const groups=new Map();for(const row of rows||[]){const date=day(row?.[key]);if(!date)continue;if(!groups.has(date))groups.set(date,[]);groups.get(date).push(row);}return groups;}
function latestComparablePair(rows,key){const groups=dailyGroups(rows,key),dates=[...groups.keys()].sort();if(dates.length<2)return{available:false,reason:'insufficient',rows};const previousDay=dates.at(-2),latestDay=dates.at(-1),previousRows=groups.get(previousDay)||[],latestRows=groups.get(latestDay)||[];if(previousRows.length!==1||latestRows.length!==1)return{available:false,reason:'ambiguous',rows,previousDay,latestDay};return{available:true,previous:previousRows[0],latest:latestRows[0],previousDay,latestDay};}
function unambiguousDailyRows(rows,key){return [...dailyGroups(rows,key).entries()].filter(([,items])=>items.length===1).sort((a,b)=>a[0].localeCompare(b[0])).map(([,items])=>items[0]);}
function latestSourceContinuousRows(rows){
  const ordered=[...(rows||[])];if(ordered.length<2)return ordered;
  let start=0;
  for(let i=1;i<ordered.length;i++)if(sourceContinuityBreak(ordered[i],ordered[i-1]))start=i;
  return ordered.slice(start);
}

export function normalizeMuscleGroup(value=''){
  const text=norm(value);if(!text)return'Não informado';
  if(text.includes('peito'))return'Peito';if(text.includes('costas')||text.includes('dorsal'))return'Costas';
  if(text.includes('biceps'))return'Bíceps';if(text.includes('triceps'))return'Tríceps';if(text.includes('ombro')||text.includes('delto'))return'Ombros';
  if(text.includes('abd'))return'Abdômen';if(text.includes('quadr'))return'Quadríceps';if(text.includes('posterior'))return'Posteriores';
  if(text.includes('panturr'))return'Panturrilhas';if(text.includes('adutor')||text.includes('abdutor'))return'Adutores/abdutores';if(text.includes('perna'))return'Pernas';
  return String(value).trim();
}
const groupRegion=group=>{const g=normalizeMuscleGroup(group);if(['Bíceps','Tríceps','Ombros'].includes(g))return'arms';if(['Peito','Costas','Abdômen'].includes(g))return'trunk';if(['Quadríceps','Posteriores','Panturrilhas','Adutores/abdutores','Pernas'].includes(g))return'legs';return'other';};

export function referenceDayFor(data={}){return maxDate([maxDate((data.body||[]).map(r=>day(r.measured_at))),maxDate((data.segmental||[]).map(r=>day(r.measured_at))),maxDate(canonicalWorkouts(data).map(r=>day(r.workout_date))),maxDate((data.nutrition||[]).map(r=>day(r.nutrition_date))),maxDate((data.labs||[]).map(r=>day(r.collection_date)))]);}

export function bodyChangeModel(data={},status={}){
  if(!ready(status,'body'))return{available:false,reason:'unavailable'};
  const rows=sortAsc(data.body,'measured_at'),pair=latestComparablePair(rows,'measured_at');
  if(!pair.available)return pair;
  const{previous,latest}=pair;
  if(sourceContinuityBreak(previous,latest))return{available:false,reason:'source_changed',rows,previous,latest,previousDay:pair.previousDay,latestDay:pair.latestDay};
  return{available:true,previous,latest,delta:{weightKg:delta(latest.weight_kg,previous.weight_kg),muscleKg:delta(latest.skeletal_muscle_mass_kg,previous.skeletal_muscle_mass_kg),fatKg:delta(latest.fat_mass_kg,previous.fat_mass_kg),bodyFatPp:delta(latest.body_fat_pct,previous.body_fat_pct)}};
}
export function bodyTrendModel(data={},status={},limit=12){
  if(!ready(status,'body'))return{available:false,points:[],reason:'unavailable'};
  const safe=unambiguousDailyRows(data.body,'measured_at').slice(-limit),rows=latestSourceContinuousRows(safe),sourceChanged=rows.length<safe.length;
  return{available:rows.length>1,reason:rows.length>1?'comparable':sourceChanged?'source_changed':'insufficient',sourceChanged,points:rows.map(r=>({date:day(r.measured_at),weightKg:num(r.weight_kg),muscleKg:num(r.skeletal_muscle_mass_kg),fatKg:num(r.fat_mass_kg),bodyFatPct:num(r.body_fat_pct),source:sourceIdentity(r)}))};
}

export function trainingDistributionModel(data={},status={},start=null,end=null){if(!ready(status,'workouts')||!ready(status,'exercises'))return{available:false,rows:[]};const workouts=canonicalWorkouts(data).filter(w=>inRange(w.workout_date,start,end)),ids=new Set(workouts.map(w=>w.source_record_id)),buckets=new Map();for(const ex of data.exercises||[]){if(!ids.has(ex.workout_source_record_id))continue;const label=normalizeMuscleGroup(ex.muscle_group||'Não informado');if(label==='Não informado')continue;if(!buckets.has(label))buckets.set(label,{label,workoutIds:new Set(),exercises:0,sets:0});const bucket=buckets.get(label);bucket.workoutIds.add(ex.workout_source_record_id);bucket.exercises++;if(ready(status,'sets'))bucket.sets+=(data.sets||[]).filter(s=>s.exercise_source_record_id===ex.source_record_id).length;}const rows=[...buckets.values()].map(b=>({label:b.label,sessions:b.workoutIds.size,exercises:b.exercises,sets:ready(status,'sets')?b.sets:null})).sort((a,b)=>b.sessions-a.sessions||(b.sets??0)-(a.sets??0)||a.label.localeCompare(b.label,'pt-BR'));return{available:true,rows,totalSessions:workouts.length,start,end};}
function regionTraining(data,status,start,end,region){if(!ready(status,'workouts')||!ready(status,'exercises'))return{sessions:null,sets:null,groups:[]};const workouts=canonicalWorkouts(data).filter(w=>inRange(w.workout_date,start,end,{afterStart:true})),ids=new Set(workouts.map(w=>w.source_record_id)),sessions=new Set(),groups=new Set();let sets=0;for(const ex of data.exercises||[]){if(!ids.has(ex.workout_source_record_id)||groupRegion(ex.muscle_group)!==region)continue;sessions.add(ex.workout_source_record_id);groups.add(normalizeMuscleGroup(ex.muscle_group));if(ready(status,'sets'))sets+=(data.sets||[]).filter(s=>s.exercise_source_record_id===ex.source_record_id).length;}return{sessions:sessions.size,sets:ready(status,'sets')?sets:null,groups:[...groups].sort((a,b)=>a.localeCompare(b,'pt-BR'))};}
const sumPair=(a,b)=>{const x=num(a),y=num(b);return x==null||y==null?null:x+y;};
export function segmentalContextModel(data={},status={}){
  if(!ready(status,'segmental'))return{available:false,reason:'unavailable'};
  const rows=sortAsc(data.segmental,'measured_at'),pair=latestComparablePair(rows,'measured_at');
  if(!pair.available)return pair;
  const{previous,latest}=pair;
  if(sourceContinuityBreak(previous,latest))return{available:false,reason:'source_changed',rows,previous,latest,previousDay:pair.previousDay,latestDay:pair.latestDay};
  const start=day(previous.measured_at),end=day(latest.measured_at),region=(key,label,leanNow,leanPrev,fatNow,fatPrev)=>({key,label,leanDeltaKg:delta(leanNow,leanPrev),fatDeltaKg:delta(fatNow,fatPrev),training:regionTraining(data,status,start,end,key)});
  return{available:true,previous,latest,start,end,regions:[region('arms','Braços',sumPair(latest.lean_right_arm_kg,latest.lean_left_arm_kg),sumPair(previous.lean_right_arm_kg,previous.lean_left_arm_kg),sumPair(latest.fat_right_arm_kg,latest.fat_left_arm_kg),sumPair(previous.fat_right_arm_kg,previous.fat_left_arm_kg)),region('trunk','Tronco',latest.lean_trunk_kg,previous.lean_trunk_kg,latest.fat_trunk_kg,previous.fat_trunk_kg),region('legs','Pernas',sumPair(latest.lean_right_leg_kg,latest.lean_left_leg_kg),sumPair(previous.lean_right_leg_kg,previous.lean_left_leg_kg),sumPair(latest.fat_right_leg_kg,latest.fat_left_leg_kg),sumPair(previous.fat_right_leg_kg,previous.fat_left_leg_kg))]};
}

export function nutritionIntervalModel(data={},status={},start=null,end=null){if(!ready(status,'nutrition'))return{available:false,reason:'unavailable'};if(!start||!end)return{available:false,reason:'missing_interval'};const safeRows=unambiguousDailyRows(data.nutrition||[],'nutrition_date'),rows=safeRows.filter(r=>inRange(r.nutrition_date,start,end,{afterStart:true})),days=rows.length,span=daysBetween(start,end),intervalDays=span==null?null:Math.max(0,span),proteinAvg=average(rows.map(r=>r.protein_g)),calorieAvg=average(rows.map(r=>r.calories_kcal)),previousEnd=addDays(start,-1),previousStart=intervalDays?addDays(previousEnd,-Math.max(0,intervalDays-1)):'',previousRows=previousStart?safeRows.filter(r=>inRange(r.nutrition_date,previousStart,previousEnd)):[],previousProteinAvg=average(previousRows.map(r=>r.protein_g));return{available:true,start,end,days,intervalDays,coveragePct:intervalDays?Math.round(days/intervalDays*100):null,proteinAvg,calorieAvg,previousProteinAvg,proteinDelta:proteinAvg!=null&&previousProteinAvg!=null?proteinAvg-previousProteinAvg:null};}
export function trainingRhythmModel(data={},status={},ref=null){if(!ready(status,'workouts'))return{available:false};const rows=canonicalWorkouts(data),reference=ref||maxDate(rows.map(w=>day(w.workout_date)));if(!reference)return{available:false};const recentStart=addDays(reference,-27),previousEnd=addDays(recentStart,-1),previousStart=addDays(previousEnd,-27),recent=rows.filter(w=>inRange(w.workout_date,recentStart,reference)).length,previous=rows.filter(w=>inRange(w.workout_date,previousStart,previousEnd)).length;return{available:true,recent,previous,delta:recent-previous,recentStart,reference,previousStart,previousEnd};}
export function comparablePerformanceModel(data={},status={},limit=3){if(!ready(status,'workouts')||!ready(status,'exercises')||!ready(status,'sets'))return[];const workoutIds=new Set(canonicalWorkouts(data).map(w=>w.source_record_id)),groups=new Map();for(const ex of data.exercises||[]){if(!workoutIds.has(ex.workout_source_record_id)||!norm(ex.exercise))continue;const key=`${norm(ex.exercise)}|${norm(ex.machine)||'sem-maquina'}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(ex);}const results=[];for(const exercises of groups.values()){const dayUnits=new Map();for(const ex of exercises){const date=day(ex.workout_date);if(!date)continue;for(const set of data.sets||[]){if(set.exercise_source_record_id!==ex.source_record_id)continue;const weight=num(set.weight),unit=String(set.weight_unit||'').trim();if(weight==null||!comparableLoadUnit(unit))continue;const key=`${date}|${norm(unit)}`;if(!dayUnits.has(key))dayUnits.set(key,{date,unit,sessionIds:new Set(),weight:null,exercise:ex.exercise,machine:ex.machine||''});const bucket=dayUnits.get(key);bucket.sessionIds.add(ex.workout_source_record_id);if(bucket.weight==null||weight>bucket.weight)bucket.weight=weight;}}const byUnit=new Map();for(const bucket of dayUnits.values()){if(bucket.sessionIds.size!==1||bucket.weight==null)continue;const row={date:bucket.date,unit:bucket.unit,weight:bucket.weight,exercise:bucket.exercise,machine:bucket.machine};const key=norm(row.unit);if(!byUnit.has(key))byUnit.set(key,[]);byUnit.get(key).push(row);}for(const rows of byUnit.values()){rows.sort((a,b)=>a.date.localeCompare(b.date));if(rows.length<2)continue;const previous=rows.at(-2),latest=rows.at(-1);results.push({...latest,previousWeight:previous.weight,previousDate:previous.date,delta:latest.weight-previous.weight});}}return results.sort((a,b)=>b.date.localeCompare(a.date)||Math.abs(b.delta)-Math.abs(a.delta)).slice(0,limit);}

function labCollections(rows){const map=new Map();for(const [index,row] of (rows||[]).entries()){const date=day(row.collection_date),lab=String(row.laboratory||'').trim(),source=String(row.source||'').trim(),origin=lab||source||String(row.source_record_id||row.id||`registro-${index}`),key=`${date||''}__${norm(origin)}`;if(!date)continue;if(!map.has(key))map.set(key,{date,lab,source,origin,rows:[]});map.get(key).rows.push(row);}return[...map.values()];}
function labMarkers(collection){const map=new Map();for(const row of collection?.rows||[]){const key=norm(row.biomarker);if(!key)continue;if(!map.has(key))map.set(key,[]);map.get(key).push(row);}return map;}
function comparableLabCount(current,previous){const a=labMarkers(current),b=labMarkers(previous);let count=0,overlap=0;for(const[key,ar]of a){const br=b.get(key);if(!br)continue;overlap++;if(ar.length!==1||br.length!==1)continue;const left=ar[0],right=br[0],ua=norm(left.unit),ub=norm(right.unit);if(num(left.result_numeric)==null||num(right.result_numeric)==null||!ua||!ub||ua!==ub)continue;count++;}return{count,overlap};}
function collectionSourceKey(collection){return norm(collection?.lab||collection?.source||collection?.origin||'');}
function latestSourceAwareLabPair(collections){
  const dates=unique(collections.map(c=>c.date)).filter(Boolean).sort();
  if(dates.length<2)return{pair:null,reason:'insufficient',latest:dates.at(-1)||null,previous:null};
  const latest=dates.at(-1),currentCollections=collections.filter(c=>c.date===latest);
  if(currentCollections.length!==1)return{pair:null,reason:'ambiguous_source',latest,previous:dates.at(-2)||null};
  const current=currentCollections[0],sourceKey=collectionSourceKey(current);
  if(!sourceKey)return{pair:null,reason:'ambiguous_source',latest,previous:null};
  for(let i=dates.length-2;i>=0;i--){
    const previous=dates[i],sameSource=collections.filter(c=>c.date===previous&&collectionSourceKey(c)===sourceKey);
    if(sameSource.length===1)return{pair:{current,prior:sameSource[0]},reason:'same_source',latest,previous};
    if(sameSource.length>1)return{pair:null,reason:'ambiguous_source',latest,previous};
  }
  return{pair:null,reason:'no_prior_same_source',latest,previous:null};
}
export function labSeriesModel(data={},status={}){if(!ready(status,'labs'))return{available:false,collectionDays:[]};const rows=data.labs||[],collectionDays=unique(rows.map(r=>day(r.collection_date))).filter(Boolean).sort();if(collectionDays.length<2)return{available:true,collectionDays,comparable:0,safe:false,reason:'insufficient'};const collections=labCollections(rows),selection=latestSourceAwareLabPair(collections),latest=selection.latest,previous=selection.previous;if(!selection.pair)return{available:true,collectionDays,previous,latest,comparable:0,safe:false,reason:selection.reason};const{current,prior}=selection.pair,score=comparableLabCount(current,prior);return{available:true,collectionDays,previous,latest,comparable:score.count,safe:Boolean(score.count),reason:score.count?'comparable':'no_comparable_markers',currentLab:current.lab||current.source||'',previousLab:prior.lab||prior.source||''};}
export function sleepCoverageModel(data={},status={}){if(!ready(status,'sourceMetrics'))return{available:false};const rows=(data.sourceMetrics||[]).filter(r=>r.metric_type==='sleep_duration_h'&&['candidate','held'].includes(norm(r.canonical_status))),dates=unique(rows.map(r=>day(r.metric_date))).filter(Boolean).sort(),sources=unique(rows.map(r=>String(r.source_name||r.source_family||'').trim()).filter(Boolean));return{available:true,days:dates.length,latest:dates.at(-1)||null,sources};}

export function buildIntegratedAnalysis(data={},status={},now=new Date()){
  const referenceDay=referenceDayFor(data)||new Date(now).toISOString().slice(0,10),body=bodyChangeModel(data,status),segmental=segmentalContextModel(data,status),rhythm=trainingRhythmModel(data,status,referenceDay),intervalStart=segmental.available?segmental.start:body.available?day(body.previous.measured_at):null,intervalEnd=segmental.available?segmental.end:body.available?day(body.latest.measured_at):null,nutrition=nutritionIntervalModel(data,status,intervalStart,intervalEnd),distribution=trainingDistributionModel(data,status,addDays(referenceDay,-55),referenceDay),performance=comparablePerformanceModel(data,status,3),labs=labSeriesModel(data,status),sleep=sleepCoverageModel(data,status),trend=bodyTrendModel(data,status,12),workouts=ready(status,'workouts')?canonicalWorkouts(data):[],lastWorkout=sortAsc(workouts,'workout_date').at(-1)||null;
  const nutritionGroups=ready(status,'nutrition')?dailyGroups(data.nutrition||[],'nutrition_date'):new Map(),nutritionDates=[...nutritionGroups.keys()].sort(),lastNutritionDate=nutritionDates.at(-1)||null,lastNutritionRows=lastNutritionDate?(nutritionGroups.get(lastNutritionDate)||[]):[],nutritionLatestAmbiguous=lastNutritionRows.length>1,lastNutrition=lastNutritionRows.length===1?lastNutritionRows[0]:null;
  return{referenceDay,body,segmental,nutrition,training:{rhythm,distribution,performance,lastWorkout},labs,sleep,trend,lastNutrition,lastNutritionDate,nutritionLatestAmbiguous};
}
