import {nutritionSourceReview} from './nutrition-source-review.js';
import {num,norm} from './core.js';
import {validDay} from './history-tools.js';
import {localHealthDay} from './health-context.js';
import {addDays,normalizeMuscleGroup} from './integrated-analysis.js';
import {isSetExtension,trainingSetCounts} from './training-session.js';

// Read-only, descriptive evidence for one selected pair. No source promotion,
// imputation, clinical score, target, physiological dose or causal attribution.
const ready=(status,key)=>status?.[key]==='ready';
const numeric=value=>typeof value==='boolean'||num(value)==null||num(value)<0?null:num(value);
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const inside=(value,bounds)=>{const date=validDay(value);return Boolean(date&&date>=bounds.start&&date<=bounds.end);};
const ordered=(rows,key)=>rows.slice().sort((a,b)=>validDay(a[key]).localeCompare(validDay(b[key])));
const difference=(current,previous)=>current==null||previous==null?null:current-previous;
const countDays=(start,end)=>start>end?0:Math.round((Date.parse(`${end}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/86400000)+1;
const groupBy=(rows,key)=>{const groups=new Map();for(const row of rows){const value=key(row);if(!groups.has(value))groups.set(value,[]);groups.get(value).push(row);}return groups;};
const phaseCounts=rows=>{
  const phases={working:0,warmup:0,other:0,unknown:0};
  for(const row of rows){if(isSetExtension(row))continue;const phase=norm(row.phase);phases[phase==='working'?'working':phase==='warmup'?'warmup':!phase||phase==='unknown'?'unknown':'other']++;}
  return phases;
};
const bodyFields=[
  ['weight_kg','Peso','kg'],
  ['skeletal_muscle_mass_kg','Músculo esquelético estimado','kg'],
  ['fat_mass_kg','Gordura estimada','kg'],
  ['body_fat_pct','Gordura corporal estimada','%'],
  ['body_water_l','Água corporal estimada','L']
];
const segments=[['right_arm','Braço direito'],['left_arm','Braço esquerdo'],['trunk','Tronco'],['right_leg','Perna direita'],['left_leg','Perna esquerda']];
const foodFields=['calories_kcal','protein_g','carbs_g','fat_g','fiber_g'];
const candidateFoodFields={dietary_energy_kcal:['calories_kcal','kcal'],dietary_protein_g:['protein_g','g'],dietary_carbohydrates_g:['carbs_g','g'],dietary_carbs_g:['carbs_g','g'],dietary_fat_g:['fat_g','g'],dietary_fiber_g:['fiber_g','g']};
// Match the current Home's JSON source identity, without importing its selected
// calendar or changing its state. The interval displays each source independently.
const foodKey=(domain,label,status='canonical',family='')=>domain==='nutrition'?JSON.stringify([domain,norm(label),status]):JSON.stringify([domain,norm(family),norm(label),status]);
const acceptedStatus=row=>['canonical','candidate','held'].includes(norm(row.canonical_status));

function modelComparability(previous,latest){
  const previousDevice=String(previous?.device_name||'').trim(),currentDevice=String(latest?.device_name||'').trim();
  const known=Boolean(previousDevice&&currentDevice),sameModel=known&&norm(previousDevice)===norm(currentDevice);
  const previousSource=String(previous?.source||'').trim(),currentSource=String(latest?.source||'').trim();
  return {previousDevice,currentDevice,previousSource,currentSource,
    previousLabel:[previousSource||'Origem não informada',previousDevice||'Modelo não informado'].join(' · '),
    currentLabel:[currentSource||'Origem não informada',currentDevice||'Modelo não informado'].join(' · '),sameModel,deviceComparable:sameModel,
    deviceStatus:!known?'unknown_model':sameModel?'same_model':'different_model',
    confirmed:false,conditionsConfirmed:false,
    reason:!known?'unknown_model':!sameModel?'different_model':'conditions_unconfirmed',
    note:'A identidade do modelo e as condições de medição são limites separados. As diferenças são aritméticas entre registros, sem confirmar mudança de tecido.'};
}

function segmentLink(record,body,rows){
  const date=validDay(record.measured_at);
  const explicit=record.source_record_id?rows.filter(row=>row.body_source_record_id===record.source_record_id&&validDay(row.measured_at)===date):[];
  if(explicit.length)return {row:explicit.length===1?explicit[0]:null,reason:explicit.length===1?'linked':'ambiguous',linkedBy:'body_source_record_id'};
  const file=String(record.source_file||'').trim();
  if(!file)return {row:null,reason:'unlinked',linkedBy:null};
  const bodyMatches=body.filter(row=>validDay(row.measured_at)===date&&String(row.source_file||'').trim()===file);
  const matches=rows.filter(row=>!row.body_source_record_id&&validDay(row.measured_at)===date&&String(row.source_file||'').trim()===file);
  if(bodyMatches.length!==1||matches.length>1)return {row:null,reason:'ambiguous',linkedBy:'source_file'};
  return {row:matches[0]||null,reason:matches.length?'linked':'unlinked',linkedBy:matches.length?'source_file':null};
}

function segmentalContext(data,status,previous,latest){
  if(!ready(status,'segmental'))return {available:false,reason:'unavailable',previous:null,latest:null,parts:[]};
  const a=segmentLink(previous,data.body||[],data.segmental||[]),b=segmentLink(latest,data.body||[],data.segmental||[]);
  const parts=segments.map(([key,label])=>{
    const prior=numeric(a.row?.[`lean_${key}_kg`]),current=numeric(b.row?.[`lean_${key}_kg`]);
    const previousFat=numeric(a.row?.[`fat_${key}_kg`]),fat=numeric(b.row?.[`fat_${key}_kg`]);
    return {key,label,unit:'kg',previous:prior,current,delta:difference(current,prior),previousFat,fat,fatDelta:difference(fat,previousFat)};
  });
  // A verified link may carry the documented body device, never an inferred name.
  const identity=(link,record)=>({...link.row,device_name:link.row?.device_name||record.device_name||''});
  return {available:true,reason:a.row&&b.row?'linked_pair':a.reason==='ambiguous'||b.reason==='ambiguous'?'ambiguous':'unlinked',
    previous:a,latest:b,parts,comparability:modelComparability(identity(a,previous),identity(b,latest)),
    note:'Massa magra regional inclui água e outros tecidos. O grupo principal de um exercício não representa todo o estímulo de um segmento.'};
}

function unambiguousTrainingRecords(rows,key){
  const groups=groupBy(rows,key);
  return {rows:[...groups.values()].filter(items=>items.length===1).map(([row])=>row),
    duplicates:[...groups].filter(([,items])=>items.length>1).map(([key,items])=>({key,count:items.length}))};
}

function trainingContext(data,status,bounds){
  const detailsAvailable=ready(status,'workouts')&&ready(status,'exercises')&&ready(status,'sets');
  const observed=ready(status,'workouts')?(data.workouts||[]).filter(row=>row.is_canonical===true&&row.record_status!=='quarantined'&&inside(row.workout_date,bounds)).map(row=>({...row,duration_minutes:numeric(row.duration_minutes)})):[];
  // Match the Home's identity boundary: ambiguous records and their children
  // remain outside totals; an identical replay is not permission to pick a row.
  const sessions=unambiguousTrainingRecords(observed,row=>row.source_record_id||JSON.stringify([validDay(row.workout_date),row.source,row.workout_type,row.location]));
  const workouts=sessions.rows,workoutById=new Map(workouts.filter(row=>row.source_record_id).map(row=>[row.source_record_id,row]));
  const exerciseRecords=ready(status,'exercises')?unambiguousTrainingRecords((data.exercises||[]).filter(row=>{
    const parent=workoutById.get(row.workout_source_record_id);
    return Boolean(row.source_record_id&&parent&&(!row.workout_date||validDay(row.workout_date)===validDay(parent.workout_date)));
  }),row=>JSON.stringify([row.workout_source_record_id,row.source_record_id])):{rows:[],duplicates:[]};
  const exercises=exerciseRecords.rows,exerciseById=new Map(exercises.map(row=>[JSON.stringify([row.workout_source_record_id,row.source_record_id]),row]));
  const setRecords=detailsAvailable?unambiguousTrainingRecords((data.sets||[]).filter(row=>{
    const parent=exerciseById.has(JSON.stringify([row.workout_source_record_id,row.exercise_source_record_id]));
    const workout=workoutById.get(row.workout_source_record_id);
    return Boolean(parent&&workout&&(!row.workout_date||validDay(row.workout_date)===validDay(workout.workout_date)));
  }),row=>row.source_record_id||JSON.stringify([row.workout_source_record_id,row.exercise_source_record_id,row.set_index,row.phase,row.weight,row.reps_numeric,row.reps_raw])):{rows:[],duplicates:[]};
  const sets=setRecords.rows;
  // Keep this calculation local: the consultation's legacy helper counts a
  // different set contract and must not be transplanted over the current Home.
  const available=ready(status,'workouts'),counts=detailsAvailable?trainingSetCounts(sets):null;
  const knownDuration=workouts.filter(row=>row.duration_minutes!=null);
  const recordedMinutes=knownDuration.length?knownDuration.reduce((sum,row)=>sum+row.duration_minutes,0):null;
  const durationComplete=workouts.length>0&&knownDuration.length===workouts.length;
  const points=[...groupBy(workouts,row=>validDay(row.workout_date))].filter(([,rows])=>rows.every(row=>row.duration_minutes!=null))
    .map(([date,rows])=>({date,value:rows.reduce((sum,row)=>sum+row.duration_minutes,0),cohort:'recorded-duration'})).sort((a,b)=>a.date.localeCompare(b.date));
  const summary={available,rows:workouts,sessions:available?workouts.length:null,
    sets:counts?.primary??null,extensions:counts?.extensions??null,totalSets:counts?.total??null,
    minutes:durationComplete?recordedMinutes:null,recordedMinutes,durationCoverage:available?knownDuration.length:null,durationTotal:available?workouts.length:null,durationComplete,points,
    groups:[...new Set(exercises.map(row=>normalizeMuscleGroup(row.muscle_group)))]};
  const groupRows=ready(status,'workouts')&&ready(status,'exercises')?[...groupBy(exercises,row=>normalizeMuscleGroup(row.muscle_group))].map(([label,rows])=>{
    const keys=new Set(rows.map(row=>JSON.stringify([row.workout_source_record_id,row.source_record_id])));
    const recorded=sets.filter(row=>keys.has(JSON.stringify([row.workout_source_record_id,row.exercise_source_record_id]))),counts=trainingSetCounts(recorded);
    return {key:norm(label),label,sessions:new Set(rows.map(row=>row.workout_source_record_id)).size,exercises:rows.length,
      primary:detailsAvailable?counts.primary:null,sets:detailsAvailable?counts.primary:null,extensions:detailsAvailable?counts.extensions:null,totalSets:detailsAvailable?counts.total:null,
      phases:detailsAvailable?phaseCounts(recorded):null,rows,
      exerciseDetails:rows.map(row=>({...row,date:validDay(workoutById.get(row.workout_source_record_id)?.workout_date),
        recordedSets:detailsAvailable?recorded.filter(set=>set.workout_source_record_id===row.workout_source_record_id&&set.exercise_source_record_id===row.source_record_id):null}))};
  }).sort((a,b)=>(b.primary??0)-(a.primary??0)||a.label.localeCompare(b.label,'pt-BR')):[];
  return {...summary,detailsAvailable,groupRows,phases:detailsAvailable?phaseCounts(sets):null,
    duplicates:[...sessions.duplicates,...exerciseRecords.duplicates,...setRecords.duplicates],
    identityAmbiguities:{sessions:sessions.duplicates,exercises:exerciseRecords.duplicates,sets:setRecords.duplicates},
    structureCoverage:{sessions:available?workouts.length:null,sessionsWithExercises:available&&ready(status,'exercises')?new Set(exercises.map(row=>row.workout_source_record_id)).size:null,
      sessionsWithSets:detailsAvailable?new Set(sets.map(row=>row.workout_source_record_id)).size:null,
      sessionsWithoutSetRecords:detailsAvailable?workouts.filter(row=>!sets.some(set=>set.workout_source_record_id===row.source_record_id)).length:null},
    exercises:ready(status,'workouts')&&ready(status,'exercises')?exercises.length:null,
    extensionPhases:detailsAvailable?{drop:sets.filter(row=>row.phase==='drop').length,rest_pause:sets.filter(row=>row.phase==='rest_pause').length}:null,
    recordedDays:ready(status,'workouts')?new Set(workouts.map(row=>validDay(row.workout_date))).size:null,
    note:'Contagem por grupo principal e fase registrada. Prolongamentos ficam separados; as contagens não medem eficácia, estímulo indireto ou dose fisiológica.'};
}

function canonicalFood(data,status,bounds,today){
  const empty=Object.fromEntries(foodFields.map(field=>[field,null])),zero=Object.fromEntries(foodFields.map(field=>[field,0]));
  if(!ready(status,'nutrition'))return {available:false,reason:'unavailable',status:'canonical',sources:[],source:null,rows:[],means:empty,counts:zero,days:null,duplicates:[],conflicts:[],unknownDays:null,ambiguousDays:null,recordedDays:null,openRows:[],openDays:null,closedIntervalDays:null};
  const observed=ordered((data.nutrition||[]).filter(row=>inside(row.nutrition_date,bounds)),'nutrition_date');
  const identified=observed.filter(row=>norm(row.source));
  const sources=[...groupBy(identified,row=>foodKey('nutrition',row.source))].map(([key,items])=>{
    const dates=groupBy(items,row=>validDay(row.nutrition_date));
    const duplicates=[...dates].filter(([,rows])=>rows.length>1).map(([date,rows])=>({date,source:key,rows,
      conflicting:new Set(rows.map(row=>JSON.stringify(foodFields.map(field=>numeric(row[field]))))).size>1}));
    const rows=[...dates.values()].filter(rows=>rows.length===1).map(([row])=>({...row,date:validDay(row.nutrition_date),open:validDay(row.nutrition_date)===today,...Object.fromEntries(foodFields.map(field=>[field,numeric(row[field])]))}));
    const closedRows=rows.filter(row=>!row.open),openRows=rows.filter(row=>row.open),means={},counts={};
    for(const field of foodFields){const values=closedRows.map(row=>row[field]).filter(value=>value!=null);means[field]=mean(values);counts[field]=values.length;}
    return {key,label:String(items[0].source).trim(),status:'canonical',domain:'nutrition',sourceFamily:null,rows,closedRows,openRows,
      means,counts,days:closedRows.filter(row=>foodFields.some(field=>row[field]!=null)).length,intervalDays:bounds.days,closedIntervalDays:bounds.closedDays,
      recordedDays:dates.size,openDays:openRows.length,duplicates,ambiguousDays:duplicates.length};
  }).sort((a,b)=>a.key.localeCompare(b.key));
  const rows=sources.flatMap(source=>source.rows),duplicates=sources.flatMap(source=>source.duplicates);
  const unknownDays=new Set(observed.filter(row=>!norm(row.source)).map(row=>validDay(row.nutrition_date))).size;
  const source=sources.length===1&&!unknownDays?sources[0]:null;
  return {available:true,reason:sources.length>1?'mixed_sources':unknownDays?'unknown_source':rows.length?'single_source':duplicates.length?'ambiguous':'empty',status:'canonical',
    sources,source,rows,means:source?.means||empty,counts:source?.counts||zero,
    days:new Set(rows.filter(row=>!row.open&&foodFields.some(field=>row[field]!=null)).map(row=>row.date)).size,
    intervalDays:bounds.days,closedIntervalDays:bounds.closedDays,duplicates,conflicts:duplicates.filter(row=>row.conflicting),
    unknownDays,ambiguousDays:new Set(duplicates.map(row=>row.date)).size,recordedDays:new Set(observed.map(row=>validDay(row.nutrition_date))).size,
    openRows:rows.filter(row=>row.open),openDays:new Set(rows.filter(row=>row.open).map(row=>row.date)).size};
}

function metricNutrition(data,status,bounds,today){
  if(!ready(status,'sourceMetrics'))return {available:false,reason:'unavailable',sources:[],duplicates:[],unknownRows:null};
  const observed=(data.sourceMetrics||[]).filter(row=>Object.hasOwn(candidateFoodFields,row.metric_type)&&acceptedStatus(row)&&inside(row.metric_date,bounds));
  const identified=observed.filter(row=>norm(row.source_name));
  const duplicates=[];
  const sources=[...groupBy(identified,row=>{const review=nutritionSourceReview(row);return JSON.stringify([...JSON.parse(foodKey('sourceMetrics',row.source_name,norm(row.canonical_status),row.source_family)),...(review.verified?[review.sourceHash]:[])]);})].map(([key,items])=>{
    const sourceDuplicates=[],rows=[];
    for(const[date,dayRows]of groupBy(items,row=>validDay(row.metric_date))){
      const reviews=dayRows.map(nutritionSourceReview),knownPartial=reviews.some(r=>r.partial);
      const point={date,open:date===today,knownPartial,excludeFromClosedMeans:knownPartial||reviews.some(r=>r.state==='review_invalid'),reviewVerified:reviews.length>0&&reviews.every(r=>r.verified),exportedAt:reviews.find(r=>r.exportedAt)?.exportedAt||null,...Object.fromEntries(foodFields.map(field=>[field,null])),records:dayRows};
      for(const[type,[field,unit]]of [...new Map(Object.entries(candidateFoodFields).map(([type,[field,unit]])=>[field,[type,[field,unit]]])).values()]){
        const matches=dayRows.filter(row=>candidateFoodFields[row.metric_type]?.[0]===field);
        if(matches.length>1){const duplicate={date,metric:field,rows:matches,conflicting:new Set(matches.map(row=>JSON.stringify([num(row.value),norm(row.unit)]))).size>1};sourceDuplicates.push(duplicate);duplicates.push({...duplicate,source:key});}
        else if(matches.length===1&&norm(matches[0].unit)===unit)point[field]=numeric(matches[0].value);
      }
      rows.push(point);
    }
    rows.sort((a,b)=>a.date.localeCompare(b.date));
    const closed=rows.filter(row=>!row.open&&!row.excludeFromClosedMeans),counts={},means={};
    for(const field of foodFields){const values=closed.map(row=>row[field]).filter(value=>value!=null);counts[field]=values.length;means[field]=mean(values);}
    const openRows=rows.filter(row=>row.open);
    return {key,domain:'sourceMetrics',label:String(items[0].source_name).trim(),status:norm(items[0].canonical_status),sourceFamily:items[0].source_family||null,
      rows,knownPartialRows:rows.filter(r=>r.knownPartial),reviewVerified:rows.length>0&&rows.every(r=>r.reviewVerified),counts,means,days:closed.filter(row=>foodFields.some(field=>row[field]!=null)).length,intervalDays:bounds.days,
      closedIntervalDays:bounds.closedDays,recordedDays:rows.length,ambiguousDays:new Set(sourceDuplicates.map(row=>row.date)).size,duplicates:sourceDuplicates,openRows,openDays:openRows.length};
  }).sort((a,b)=>a.key.localeCompare(b.key));
  return {available:true,reason:sources.length?'recorded':'empty',sources,duplicates,unknownRows:observed.length-identified.length};
}

function scalarSources(observed,bounds,today){
  return [...groupBy(observed,row=>row.originKey)].map(([key,items])=>{
    const groups=groupBy(items,row=>row.date),duplicates=[...groups].filter(([,rows])=>rows.length>1).map(([date,rows])=>({date,rows,conflicting:new Set(rows.map(row=>row.value)).size>1}));
    const rows=[...groups.values()].filter(rows=>rows.length===1&&rows[0].value!=null&&rows[0].eligible!==false).map(([row])=>({...row,open:row.date===today})).sort((a,b)=>a.date.localeCompare(b.date));
    const closedRows=rows.filter(row=>!row.open),openRows=rows.filter(row=>row.open);
    return {key,label:items[0].label,status:items[0].status,unit:items[0].unit,sourceFamily:items[0].sourceFamily,
      rows,closedRows,mean:mean(closedRows.map(row=>row.value)),days:closedRows.length,counts:{value:closedRows.length},means:{value:mean(closedRows.map(row=>row.value))},
      intervalDays:bounds.days,closedIntervalDays:bounds.closedDays,recordedDays:groups.size,ambiguousDays:duplicates.length,duplicates,openRows,openDays:openRows.length};
  }).sort((a,b)=>a.key.localeCompare(b.key));
}

function sourceMetricObservation(row,domain='sourceMetrics'){
  const label=String(row.source_name||row.source||'').trim(),status=domain==='metrics'?'canonical':norm(row.canonical_status),unit=norm(row.unit);
  return {date:validDay(domain==='metrics'?row.measured_at:row.metric_date),value:numeric(row.value),unit,label,status,sourceFamily:row.source_family||null,
    source_file:row.source_file||null,source_record_id:row.source_record_id||null,domain,row,
    originKey:JSON.stringify([domain,norm(row.source_family),norm(label),status,unit])};
}

function sleepContext(data,status,bounds,today){
  const canonicalAvailable=ready(status,'metrics'),sourceMetricsAvailable=ready(status,'sourceMetrics'),partial=canonicalAvailable!==sourceMetricsAvailable;
  if(!canonicalAvailable&&!sourceMetricsAvailable)return {available:false,partial:false,reason:'unavailable',sources:[],mirrors:[],recordedDays:null,uniqueEvidenceCount:null,canonicalAvailable,sourceMetricsAvailable};
  const observed=sourceMetricsAvailable?(data.sourceMetrics||[]).filter(row=>row.metric_type==='sleep_duration_h'&&acceptedStatus(row)&&inside(row.metric_date,bounds)).map(row=>sourceMetricObservation(row)):[];
  if(canonicalAvailable)observed.push(...(data.metrics||[]).filter(row=>row.metric_type==='sleep_duration_h'&&inside(row.measured_at,bounds)).map(row=>sourceMetricObservation(row,'metrics')));
  const identified=observed.filter(row=>row.label&&row.unit==='h').map(row=>({...row,eligible:row.value!=null&&row.value<=24}));
  const valid=identified.filter(row=>row.eligible),sources=scalarSources(identified,bounds,today);
  const points=sources.flatMap(source=>source.rows),mirrorGroups=new Map();
  for(const point of points){
    if(!point.source_file)continue;
    // Equal numbers alone are not independent proof of mirrored provenance.
    const origin=norm(point.label).replace(/\s+via\s+apple health$/,'');
    const key=JSON.stringify([point.source_file,point.date,point.value,point.unit,origin]);
    if(!mirrorGroups.has(key))mirrorGroups.set(key,[]);mirrorGroups.get(key).push(point);
  }
  const mirrors=[...mirrorGroups].filter(([,rows])=>rows.length>1&&new Set(rows.map(row=>row.originKey)).size===rows.length).map(([key,rows])=>({key,date:rows[0].date,value:rows[0].value,unit:rows[0].unit,source_file:rows[0].source_file,sourceKeys:rows.map(row=>row.originKey),labels:rows.map(row=>row.label),rows}));
  return {available:true,partial,reason:partial?'partial':sources.length?'recorded':'empty',sources,mirrors,
    recordedDays:new Set(points.map(row=>row.date)).size,uniqueEvidenceCount:points.length-mirrors.reduce((sum,mirror)=>sum+mirror.rows.length-1,0),
    invalidRows:observed.length-valid.length,canonicalAvailable,sourceMetricsAvailable,
    note:'Fontes separadas, sem média consolidada. Espelhos comprovados não são capturas independentes. Sono segue a data da origem, sem inferir a noite anterior ou posterior.'};
}

function waterContext(data,status,bounds,today,canonical){
  const canonicalAvailable=ready(status,'nutrition'),sourceMetricsAvailable=ready(status,'sourceMetrics'),partial=canonicalAvailable!==sourceMetricsAvailable;
  if(!canonicalAvailable&&!sourceMetricsAvailable)return {available:false,partial:false,reason:'unavailable',sources:[],recordedDays:null,canonicalAvailable,sourceMetricsAvailable};
  // Inspect water independently: missing nutrition variables and other origins
  // cannot erase this source's water values or hide conflicting duplicates.
  const observed=(canonicalAvailable?(data.nutrition||[]).filter(row=>inside(row.nutrition_date,bounds)&&norm(row.source)&&row.water_ml!=null):[]).map(row=>({date:validDay(row.nutrition_date),value:numeric(row.water_ml),unit:'ml',label:String(row.source).trim(),status:'canonical',sourceFamily:null,
    source_file:row.source_file||null,domain:'nutrition',row,originKey:JSON.stringify(['nutrition',norm(row.source),'canonical','ml'])}));
  const sourceRows=sourceMetricsAvailable?(data.sourceMetrics||[]).filter(row=>row.metric_type==='dietary_water_ml'&&acceptedStatus(row)&&inside(row.metric_date,bounds)).map(row=>sourceMetricObservation(row)):[];
  const identified=sourceRows.filter(row=>row.label&&row.unit==='ml'),valid=identified.filter(row=>row.value!=null);
  observed.push(...identified);
  const sources=scalarSources(observed,bounds,today);
  return {available:true,partial,reason:partial?'partial':sources.length?'recorded':'empty',sources,recordedDays:new Set(sources.flatMap(source=>source.rows.map(row=>row.date))).size,canonicalAvailable,sourceMetricsAvailable,
    invalidRows:sourceRows.length-valid.length,duplicates:canonical.duplicates,
    note:'Água fica separada por origem e situação. Ausência de registro não significa consumo zero; não há soma ou média entre fontes.'};
}

function labContext(data,status,bounds,requested){
  if(!ready(status,'labs'))return {available:false,reason:'unavailable',rows:[],count:null,numericCount:null,collectionDates:[],collections:[],markers:[],selected:null};
  const rows=ordered((data.labs||[]).filter(row=>inside(row.collection_date,bounds)),'collection_date');
  const markers=[...groupBy(rows,row=>norm(row.biomarker)||'__unnamed__')].map(([key,items])=>({key,label:String(items[0].biomarker||'Marcador não informado').trim(),rows:items})).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
  const selected=requested?markers.find(marker=>marker.key===requested)||null:markers[0]||null;
  const prior=selected?ordered((data.labs||[]).filter(row=>norm(row.biomarker)===selected.key&&validDay(row.collection_date)&&validDay(row.collection_date)<bounds.start),'collection_date'):[];
  const previousDate=validDay(prior.at(-1)?.collection_date);
  const previousRows=previousDate?prior.filter(row=>validDay(row.collection_date)===previousDate):[];
  return {available:true,reason:rows.length?'recorded':'empty',rows,count:rows.length,numericCount:rows.filter(row=>typeof row.result_numeric!=='boolean'&&num(row.result_numeric)!=null).length,
    collectionDates:[...new Set(rows.map(row=>validDay(row.collection_date)))],
    collections:[...groupBy(rows,row=>validDay(row.collection_date))].map(([date,items])=>({date,rows:items,count:items.length})),
    markers,selected,requestedMarker:requested||null,requestedMarkerMissing:Boolean(requested&&!selected),previousRows,previousOutsideWindow:previousRows.length>0,
    note:'Exames são contexto para consulta. A coleta do mesmo dia não explica a variação corporal, e nem todos os marcadores foram necessariamente repetidos.'};
}

export function bodyIntervalModel(data={},status={},ui={},today=localHealthDay()){
  const base={available:false,reason:'unavailable',today,options:[],ambiguousDates:[],selection:{start:null,end:null,defaulted:false},previous:null,latest:null,body:null,segmental:null,interval:null,training:null,nutrition:null,sleep:null,water:null,labs:null,warnings:[]};
  if(!validDay(today)||validDay(today)!==today)return {...base,reason:'invalid_today'};
  if(!ready(status,'body'))return base;
  const rows=ordered((data.body||[]).filter(row=>validDay(row.measured_at)&&validDay(row.measured_at)<=today),'measured_at');
  const dates=groupBy(rows,row=>validDay(row.measured_at));
  const options=[...dates].filter(([,rows])=>rows.length===1).map(([date,[row]])=>({date,value:date,label:`${date.split('-').reverse().join('/')} · ${String(row.device_name||'Modelo não informado').trim()}`,row,source:String(row.source||'').trim(),device:String(row.device_name||'').trim()}));
  const ambiguousDates=[...dates].filter(([,rows])=>rows.length>1).map(([date,rows])=>({date,count:rows.length}));
  const provided=value=>value!==undefined&&value!==null&&value!=='';
  const explicit=provided(ui.bodyIntervalStart)||provided(ui.bodyIntervalEnd);
  const start=explicit?ui.bodyIntervalStart:options.at(-2)?.date||null,end=explicit?ui.bodyIntervalEnd:options.at(-1)?.date||null;
  const selection={start,end,defaulted:!explicit};
  const selected={...base,options,ambiguousDates,selection};
  if(!explicit&&options.length<2)return {...selected,reason:ambiguousDates.length?'ambiguous':'insufficient'};
  if(!start||!end||validDay(start)!==start||validDay(end)!==end)return {...selected,reason:'invalid_selection'};
  if(start>today||end>today)return {...selected,reason:'future_selection'};
  if(start>=end)return {...selected,reason:'invalid_order'};
  if(dates.get(start)?.length>1||dates.get(end)?.length>1)return {...selected,reason:'ambiguous_selection'};
  if(!dates.has(start)||!dates.has(end))return {...selected,reason:'missing_selection'};
  const previous=dates.get(start)[0],latest=dates.get(end)[0];
  const intervalStart=addDays(start,1),intervalDays=countDays(intervalStart,end),openToday=end===today;
  const interval={start:intervalStart,end,days:intervalDays,closedDays:intervalDays-(openToday?1:0),openToday,startExcluded:true,endIncluded:true,assessmentStart:start,assessmentEnd:end};
  const measurements=bodyFields.map(([key,label,unit])=>{const a=numeric(previous[key]),b=numeric(latest[key]);return {key,label,unit,deltaUnit:unit==='%'?'p.p.':unit,previous:a,current:b,delta:difference(b,a)};});
  const body={measurements,changes:Object.fromEntries(measurements.map(row=>[row.key,row.delta])),comparability:modelComparability(previous,latest)};
  const training=trainingContext(data,status,interval),canonical=canonicalFood(data,status,interval,today),metricSources=metricNutrition(data,status,interval,today);
  const foodSources=[...canonical.sources,...metricSources.sources];
  const sourceDates=groupBy(foodSources.flatMap(source=>source.rows.filter(row=>foodFields.some(field=>row[field]!=null)).map(row=>({date:row.date,key:source.key}))),row=>row.date);
  const overlaps=[...sourceDates].filter(([,rows])=>new Set(rows.map(row=>row.key)).size>1).map(([date,rows])=>({date,sourceKeys:[...new Set(rows.map(row=>row.key))]}));
  const nutrition={overlaps,recordedDays:sourceDates.size,available:canonical.available||metricSources.available,partial:canonical.available!==metricSources.available,canonical,metricSources,sources:foodSources,intervalDays,closedIntervalDays:interval.closedDays,
    note:'Médias apenas nos dias encerrados com valor, por variável e origem. Cobertura parcial não representa a média do intervalo inteiro. Candidatos não foram promovidos.'};
  const sleep=sleepContext(data,status,interval,today),water=waterContext(data,status,interval,today,canonical),labs=labContext(data,status,interval,ui.reportLabMarker);
  const endDayEvents=Object.fromEntries([['workouts','workout_date'],['nutrition','nutrition_date'],['sourceMetrics','metric_date'],['metrics','measured_at'],['labs','collection_date']].map(([key,dateKey])=>[key,ready(status,key)?(data[key]||[]).filter(row=>validDay(row[dateKey])===end&&(key!=='workouts'||row.is_canonical===true&&row.record_status!=='quarantined')).length:null]));
  const warnings=['Diferenças descritivas entre avaliações não confirmam perda ou ganho de tecido nem causa e efeito.'];
  if(body.comparability.reason==='unknown_model')warnings.push('O modelo de pelo menos uma avaliação não foi informado.');
  if(body.comparability.reason==='different_model')warnings.push('As avaliações identificam modelos diferentes.');
  if(ambiguousDates.length)warnings.push('Datas com mais de uma avaliação foram excluídas das opções; nenhuma delas foi escolhida automaticamente.');
  if(openToday)warnings.push('O dia de hoje está aberto. Os registros aparecem, mas não entram nas médias diárias dos dias encerrados.');
  if(Object.values(endDayEvents).some(count=>count>0))warnings.push('Há registros no dia da avaliação final. O horário relativo não está comprovado; não se presume que ocorreram antes da medição.');
  return {...selected,available:true,reason:'selected_pair',previous,latest,body,segmental:segmentalContext(data,status,previous,latest),interval,training,nutrition,sleep,water,labs,endDayEvents,endDayOrderingConfirmed:false,warnings};
}
