import {num,norm} from './core.js';
import {validDay} from './history-tools.js';
import {localHealthDay} from './health-context.js';
import {addDays,normalizeMuscleGroup} from './integrated-analysis.js';
import {trainingSummary,nutritionSummary,segments} from './reports-model.js';
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
const foodFields=['calories_kcal','protein_g'];
const candidateFoodFields={dietary_energy_kcal:['calories_kcal','kcal'],dietary_protein_g:['protein_g','g']};
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

function trainingContext(data,status,bounds){
  const workouts=ready(status,'workouts')?(data.workouts||[]).filter(row=>row.is_canonical===true&&row.record_status!=='quarantined'&&inside(row.workout_date,bounds)).map(row=>({...row,duration_minutes:numeric(row.duration_minutes)})):[];
  const workoutById=groupBy(workouts,row=>row.source_record_id);
  const exercises=ready(status,'exercises')?(data.exercises||[]).filter(row=>{
    const parent=workoutById.get(row.workout_source_record_id);
    return Boolean(row.source_record_id&&parent?.length===1&&(!row.workout_date||validDay(row.workout_date)===validDay(parent[0].workout_date)));
  }):[];
  const exerciseById=groupBy(exercises,row=>JSON.stringify([row.workout_source_record_id,row.source_record_id]));
  const sets=ready(status,'sets')?(data.sets||[]).filter(row=>{
    const parent=exerciseById.get(JSON.stringify([row.workout_source_record_id,row.exercise_source_record_id]));
    const workout=workoutById.get(row.workout_source_record_id);
    return Boolean(parent?.length===1&&workout?.length===1&&(!row.workout_date||validDay(row.workout_date)===validDay(workout[0].workout_date)));
  }):[];
  const summary=trainingSummary({...data,workouts,exercises,sets},status,bounds);
  const detailsAvailable=ready(status,'workouts')&&ready(status,'exercises')&&ready(status,'sets');
  const groupRows=ready(status,'workouts')&&ready(status,'exercises')?[...groupBy(exercises,row=>normalizeMuscleGroup(row.muscle_group))].map(([label,rows])=>{
    const keys=new Set(rows.map(row=>JSON.stringify([row.workout_source_record_id,row.source_record_id])));
    const recorded=sets.filter(row=>keys.has(JSON.stringify([row.workout_source_record_id,row.exercise_source_record_id]))),counts=trainingSetCounts(recorded);
    return {key:norm(label),label,sessions:new Set(rows.map(row=>row.workout_source_record_id)).size,exercises:rows.length,
      primary:detailsAvailable?counts.primary:null,sets:detailsAvailable?counts.primary:null,extensions:detailsAvailable?counts.extensions:null,totalSets:detailsAvailable?counts.total:null,
      phases:detailsAvailable?phaseCounts(recorded):null,rows};
  }).sort((a,b)=>(b.primary??0)-(a.primary??0)||a.label.localeCompare(b.label,'pt-BR')):[];
  return {...summary,detailsAvailable,groupRows,phases:detailsAvailable?phaseCounts(sets):null,
    exercises:ready(status,'workouts')&&ready(status,'exercises')?exercises.length:null,
    extensionPhases:detailsAvailable?{drop:sets.filter(row=>row.phase==='drop').length,rest_pause:sets.filter(row=>row.phase==='rest_pause').length}:null,
    recordedDays:ready(status,'workouts')?new Set(workouts.map(row=>validDay(row.workout_date))).size:null,
    note:'Contagem por grupo principal e fase registrada. Prolongamentos ficam separados; as contagens não medem eficácia, estímulo indireto ou dose fisiológica.'};
}

function canonicalFood(data,status,bounds,today){
  const all=nutritionSummary(data,status,bounds);
  if(!all.available)return {...all,status:'canonical',closedIntervalDays:null,openRows:[],openDays:null};
  const closedBounds={...bounds,end:bounds.end===today?addDays(today,-1):bounds.end};
  const closed=nutritionSummary(data,status,closedBounds);
  const sources=all.sources.map(source=>{
    const closedSource=closed.sources.find(item=>item.key===source.key);
    const openRows=source.rows.filter(row=>validDay(row.nutrition_date)===today);
    return {...source,status:'canonical',rows:source.rows.map(row=>({...row,date:validDay(row.nutrition_date),open:validDay(row.nutrition_date)===today})),
      means:closedSource?.means||Object.fromEntries(foodFields.map(key=>[key,null])),counts:closedSource?.counts||Object.fromEntries(foodFields.map(key=>[key,0])),
      days:closedSource?.days||0,closedIntervalDays:countDays(bounds.start,closedBounds.end),openRows,openDays:openRows.length};
  });
  return {...all,sources,source:all.source?sources.find(source=>source.key===all.source.key)||null:null,status:'canonical',means:closed.means,counts:closed.counts,days:closed.days,
    closedIntervalDays:countDays(bounds.start,closedBounds.end),openRows:all.rows.filter(row=>validDay(row.nutrition_date)===today),openDays:all.rows.filter(row=>validDay(row.nutrition_date)===today).length};
}

function candidateNutrition(data,status,bounds,today){
  if(!ready(status,'sourceMetrics'))return {available:false,reason:'unavailable',sources:[],duplicates:[],unknownRows:null};
  const observed=(data.sourceMetrics||[]).filter(row=>Object.hasOwn(candidateFoodFields,row.metric_type)&&['candidate','held'].includes(norm(row.canonical_status))&&inside(row.metric_date,bounds));
  const identified=observed.filter(row=>norm(row.source_name));
  const duplicates=[];
  const sources=[...groupBy(identified,row=>JSON.stringify([norm(row.source_family),norm(row.source_name),norm(row.canonical_status)]))].map(([key,items])=>{
    const sourceDuplicates=[],rows=[];
    for(const[date,dayRows]of groupBy(items,row=>validDay(row.metric_date))){
      const point={date,open:date===today,calories_kcal:null,protein_g:null,records:dayRows};
      for(const[type,[field,unit]]of Object.entries(candidateFoodFields)){
        const matches=dayRows.filter(row=>row.metric_type===type);
        if(matches.length>1){const duplicate={date,metric:field,rows:matches,conflicting:new Set(matches.map(row=>JSON.stringify([num(row.value),norm(row.unit)]))).size>1};sourceDuplicates.push(duplicate);duplicates.push({...duplicate,source:key});}
        else if(matches.length===1&&norm(matches[0].unit)===unit)point[field]=numeric(matches[0].value);
      }
      rows.push(point);
    }
    rows.sort((a,b)=>a.date.localeCompare(b.date));
    const closed=rows.filter(row=>!row.open),counts={},means={};
    for(const field of foodFields){const values=closed.map(row=>row[field]).filter(value=>value!=null);counts[field]=values.length;means[field]=mean(values);}
    const openRows=rows.filter(row=>row.open);
    return {key,label:String(items[0].source_name).trim(),status:norm(items[0].canonical_status),sourceFamily:items[0].source_family||null,
      rows,counts,means,days:closed.filter(row=>foodFields.some(field=>row[field]!=null)).length,intervalDays:bounds.days,
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
  const observed=canonical.rows.filter(row=>numeric(row.water_ml)!=null).map(row=>({date:validDay(row.nutrition_date),value:numeric(row.water_ml),unit:'ml',label:String(row.source).trim(),status:'canonical',sourceFamily:null,
    source_file:row.source_file||null,domain:'nutrition',row,originKey:JSON.stringify(['nutrition',norm(row.source),'canonical','ml'])}));
  const sourceRows=sourceMetricsAvailable?(data.sourceMetrics||[]).filter(row=>row.metric_type==='dietary_water_ml'&&acceptedStatus(row)&&inside(row.metric_date,bounds)).map(row=>sourceMetricObservation(row)):[];
  const identified=sourceRows.filter(row=>row.label&&row.unit==='ml'),valid=identified.filter(row=>row.value!=null);
  observed.push(...identified);
  const sources=scalarSources(observed,bounds,today);
  return {available:true,partial,reason:partial?'partial':sources.length?'recorded':'empty',sources,recordedDays:new Set(sources.flatMap(source=>source.rows.map(row=>row.date))).size,canonicalAvailable,sourceMetricsAvailable,
    invalidRows:sourceRows.length-valid.length,duplicates:canonical.duplicates,
    note:'Água fica separada por origem e situação. Ausência de registro não significa consumo zero; não há soma ou média entre fontes.'};
}

function labContext(data,status,bounds){
  if(!ready(status,'labs'))return {available:false,reason:'unavailable',rows:[],count:null,numericCount:null,collectionDates:[]};
  const rows=ordered((data.labs||[]).filter(row=>inside(row.collection_date,bounds)),'collection_date');
  return {available:true,reason:rows.length?'recorded':'empty',rows,count:rows.length,numericCount:rows.filter(row=>num(row.result_numeric)!=null).length,
    collectionDates:[...new Set(rows.map(row=>validDay(row.collection_date)))],
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
  const training=trainingContext(data,status,interval),canonical=canonicalFood(data,status,interval,today),candidates=candidateNutrition(data,status,interval,today);
  const nutrition={available:canonical.available||candidates.available,partial:canonical.available!==candidates.available,canonical,candidates,sources:[...canonical.sources,...candidates.sources],intervalDays,closedIntervalDays:interval.closedDays,
    note:'Médias apenas nos dias encerrados com valor, por variável e origem. Cobertura parcial não representa a média do intervalo inteiro. Candidatos não foram promovidos.'};
  const sleep=sleepContext(data,status,interval,today),water=waterContext(data,status,interval,today,canonical),labs=labContext(data,status,interval);
  const endDayEvents=Object.fromEntries([['workouts','workout_date'],['nutrition','nutrition_date'],['sourceMetrics','metric_date'],['metrics','measured_at'],['labs','collection_date']].map(([key,dateKey])=>[key,ready(status,key)?(data[key]||[]).filter(row=>validDay(row[dateKey])===end&&(key!=='workouts'||row.is_canonical===true&&row.record_status!=='quarantined')).length:null]));
  const warnings=['Diferenças descritivas entre avaliações não confirmam perda ou ganho de tecido nem causa e efeito.'];
  if(body.comparability.reason==='unknown_model')warnings.push('O modelo de pelo menos uma avaliação não foi informado.');
  if(body.comparability.reason==='different_model')warnings.push('As avaliações identificam modelos diferentes.');
  if(ambiguousDates.length)warnings.push('Datas com mais de uma avaliação foram excluídas das opções; nenhuma delas foi escolhida automaticamente.');
  if(openToday)warnings.push('O dia de hoje está aberto. Os registros aparecem, mas não entram nas médias diárias dos dias encerrados.');
  if(Object.values(endDayEvents).some(count=>count>0))warnings.push('Há registros no dia da avaliação final. O horário relativo não está comprovado; não se presume que ocorreram antes da medição.');
  return {...selected,available:true,reason:'selected_pair',previous,latest,body,segmental:segmentalContext(data,status,previous,latest),interval,training,nutrition,sleep,water,labs,endDayEvents,endDayOrderingConfirmed:false,warnings};
}
