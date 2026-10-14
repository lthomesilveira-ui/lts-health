import {nutritionSourceReview} from './nutrition-source-review.js';
import {trainingSetCounts,isSetExtension} from './training-session.js';

// A read-only calendar contract for the Home. This module intentionally has no
// browser, database, UI state or evolutionModel dependency.
const DAY=86400000;
const norm=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const numeric=value=>value==null||typeof value==='boolean'||String(value).trim()===''||!Number.isFinite(Number(value))?null:Number(value);
const nonnegative=value=>numeric(value)!=null&&numeric(value)>=0?numeric(value):null;
const ready=(status,key)=>status?.[key]==='ready';
const average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const unique=values=>[...new Set(values)];
const ordered=rows=>rows.slice().sort((a,b)=>a.date.localeCompare(b.date));
const groups=(rows,key)=>{const map=new Map();for(const row of rows){const k=key(row);if(!map.has(k))map.set(k,[]);map.get(k).push(row);}return map;};
const displayDate=value=>value?value.split('-').reverse().join('/'):'sem data';
const format=(value,digits=0)=>value==null?'—':value.toLocaleString('pt-BR',{maximumFractionDigits:digits});
const dayOf=value=>{
  const text=String(value??'');if(!/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(text))return null;
  const date=text.slice(0,10),parsed=new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:null;
};
const localToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const addDays=(date,amount)=>new Date(Date.parse(`${date}T12:00:00Z`)+amount*DAY).toISOString().slice(0,10);
const dayCount=(start,end)=>start>end?0:Math.round((Date.parse(`${end}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/DAY)+1;
const inside=(value,bounds)=>{const date=dayOf(value);return Boolean(date&&date>=bounds.start&&date<=bounds.end);};
const sourceStatus=row=>norm(row.canonical_status);
const accepted=row=>['canonical','candidate','held'].includes(sourceStatus(row));
const foodFields=['calories_kcal','protein_g','carbs_g','fat_g','fiber_g'];
const candidateFood={dietary_energy_kcal:['calories_kcal','kcal'],dietary_protein_g:['protein_g','g'],dietary_carbohydrates_g:['carbs_g','g'],dietary_carbs_g:['carbs_g','g'],dietary_fat_g:['fat_g','g'],dietary_fiber_g:['fiber_g','g']};
const bodyFields=['fat_mass_kg','skeletal_muscle_mass_kg','weight_kg','body_fat_pct'];
const comparisonRule=Object.freeze({minimumDays:5,minimumCoverage:.7,description:'Critério descritivo: ao menos 5 dias com valor e 70% dos dias encerrados em cada janela, na mesma variável, unidade e origem. Não é teste estatístico nem prova de diário completo.'});

function makeBounds(start,end,today){
  const closedEnd=end<today?end:addDays(today,-1);
  return {start,end,days:dayCount(start,end),closedEnd,closedDays:dayCount(start,closedEnd),includesToday:start<=today&&end>=today};
}
function statusOf(status,keys,count){
  const loaded=keys.filter(key=>ready(status,key));
  if(!loaded.length)return keys.some(key=>status?.[key]==='error')?'error':'unavailable';
  if(loaded.length!==keys.length)return 'partial';
  return count?'ready':'empty';
}
function coverage(rows,bounds,today,available=true){
  const dates=unique(rows.map(row=>row.date).filter(Boolean)).sort(),closed=unique(rows.filter(row=>row.date<today&&!row.excludeFromClosedMeans).map(row=>row.date)).sort();
  return {recordedDays:available?dates.length:null,closedDays:available?closed.length:null,days:available?closed.length:null,
    expectedDays:bounds.closedDays,calendarDays:bounds.days,openDays:available?dates.filter(date=>date===today).length:null,
    fraction:available&&bounds.closedDays?closed.length/bounds.closedDays:null,firstDate:dates[0]||null,lastDate:dates.at(-1)||null,
    label:available?`${closed.length}/${bounds.closedDays} dias encerrados com registro`:'Leitura indisponível',
    note:'Dias com registro não comprovam diário completo. Ausência não significa zero.'};
}
function pickSource(sources,requested){
  if(requested){
    const exact=sources.find(source=>source.key===requested);if(exact)return exact;
    try{if(Array.isArray(JSON.parse(requested)))return null;}catch{}
    // Legacy labels are accepted only when they identify exactly one source.
    // Never choose among domains/statuses sharing the same display label.
    const legacy=sources.filter(source=>norm(source.label)===norm(requested));
    return legacy.length===1?legacy[0]:null;
  }
  return sources.slice().sort((a,b)=>(b.rows.at(-1)?.date||'').localeCompare(a.rows.at(-1)?.date||'')||b.coverage.closedDays-a.coverage.closedDays||a.key.localeCompare(b.key))[0]||null;
}
function sourceStats(key,items,fields,bounds,today){
  const dates=groups(items,row=>row.date),rows=[],duplicates=[];
  for(const[date,list]of dates){
    const reviews=list.map(item=>item.review).filter(Boolean);const knownPartial=reviews.some(r=>r.partial),reviewInvalid=reviews.some(r=>r.state==='review_invalid');
    const row={date,open:date===today,knownPartial,excludeFromClosedMeans:knownPartial||reviewInvalid,reviewVerified:reviews.length===list.length&&reviews.length>0&&reviews.every(r=>r.verified),exportedAt:reviews.find(r=>r.exportedAt)?.exportedAt||null,source:key,context:items[0].label,cohort:key};
    for(const field of fields){
      const observations=list.filter(item=>Object.hasOwn(item.values,field));
      row[field]=observations.length===1?observations[0].values[field]:null;
      if(observations.length>1)duplicates.push({date,metric:field,source:key,count:observations.length,conflicting:unique(observations.map(item=>item.values[field])).length>1});
    }
    if(fields.some(field=>row[field]!=null))rows.push(row);
  }
  const sorted=ordered(rows),closedRows=sorted.filter(row=>!row.open&&!row.excludeFromClosedMeans),means={},counts={},series={},metricCoverage={};
  for(const field of fields){
    const closed=closedRows.filter(row=>row[field]!=null);
    counts[field]=closed.length;means[field]=average(closed.map(row=>row[field]));
    series[field]=sorted.filter(row=>row[field]!=null).map(row=>({...row,value:row[field]}));
    metricCoverage[field]=coverage(closed,bounds,today);
  }
  const first=items[0];
  return {key,label:first.label,status:first.status,unit:first.unit||null,domain:first.domain,sourceFamily:first.sourceFamily||null,
    receivedDates:unique(items.filter(item=>fields.some(field=>item.values[field]!=null)).map(item=>item.date)).sort(),rows:sorted,closedRows,knownPartialRows:sorted.filter(r=>r.knownPartial),reviewVerified:sorted.length>0&&sorted.every(r=>r.reviewVerified),openRows:sorted.filter(row=>row.open),means,counts,series,duplicates,ambiguousDays:unique(duplicates.map(row=>row.date)).length,
    coverage:coverage(sorted,bounds,today),metricCoverage,mean:means.value??null,count:counts.value??closedRows.length,
    points:series.value||[],latest:sorted.at(-1)||null};
}
function domainSources(observed,fields,status,keys,bounds,today,requested){
  const sources=[...groups(observed,row=>row.key)].map(([key,items])=>sourceStats(key,items,fields,bounds,today)).sort((a,b)=>a.key.localeCompare(b.key));
  const available=keys.some(key=>ready(status,key)),source=pickSource(sources,requested),empty=Object.fromEntries(fields.map(field=>[field,null]));
  return {available,status:statusOf(status,keys,sources.some(item=>item.rows.length)),partial:keys.some(key=>!ready(status,key)),sources,source,
    rows:source?.rows||[],closedRows:source?.closedRows||[],means:source?.means||empty,counts:source?.counts||Object.fromEntries(fields.map(field=>[field,0])),
    mean:source?.mean??null,count:source?.count??0,points:source?.points||[],latest:source?.latest||null,
    coverage:source?.coverage||coverage([],bounds,today,available),duplicates:sources.flatMap(item=>item.duplicates),
    requestedSource:requested||null,requestedSourceMissing:Boolean(requested&&!source),
    selectionMessage:requested&&!source?'Origem escolhida sem dados disponíveis nesta janela. Amplie o período ou escolha outra origem; nenhuma substituição foi feita.':null,comparison:null};
}
function metricObservation(row,domain,field,value){
  const label=String(row.source_name||row.source||'').trim(),status=domain==='metrics'?'canonical':sourceStatus(row),unit=norm(row.unit);
  return {date:dayOf(domain==='metrics'?row.measured_at:row.metric_date),label,status,unit,sourceFamily:row.source_family||null,domain,
    key:JSON.stringify([domain,norm(row.source_family),norm(label),status,unit]),values:{[field]:value}};
}
// Shared source contract for Home, integrated review and consultation/export.
// It retains source domain/status, per-variable counts and today's open rows.
export function nutritionPeriodModel(data={},status={},bounds={},ui={},today=localToday()){
  bounds=makeBounds(bounds.start||selectedCalendar(data,status,'all',today).bounds.start,bounds.end&&bounds.end<today?bounds.end:today,today);
  const observed=[];let unknownRows=0,invalidRows=0;
  if(ready(status,'nutrition'))for(const row of data.nutrition||[]){
    if(!inside(row.nutrition_date,bounds))continue;
    const label=String(row.source||'').trim();if(!label){unknownRows++;continue;}
    const values=Object.fromEntries(foodFields.map(field=>[field,nonnegative(row[field])]));
    observed.push({date:dayOf(row.nutrition_date),label,status:'canonical',domain:'nutrition',key:JSON.stringify(['nutrition',norm(label),'canonical']),values});
  }
  if(ready(status,'sourceMetrics'))for(const row of data.sourceMetrics||[]){
    if(!accepted(row)||!candidateFood[row.metric_type]||!inside(row.metric_date,bounds))continue;
    const[field,unit]=candidateFood[row.metric_type],point=metricObservation(row,'sourceMetrics',field,nonnegative(row.value));point.review=nutritionSourceReview(row);
    if(!point.label){unknownRows++;continue;}if(norm(row.unit)!==unit){invalidRows++;continue;}
    // Units belong to the individual nutrient, not the source identity: protein
    // and energy from one origin must remain selectable together, without pooling.
    point.key=JSON.stringify(['sourceMetrics',norm(row.source_family),norm(point.label),point.status,...(point.review.verified?[point.review.sourceHash]:[])]);point.unit=null;observed.push(point);
  }
  const result=domainSources(observed,foodFields,status,['nutrition','sourceMetrics'],bounds,today,ui.homeNutritionSource||ui.reportNutritionSource);
  for(const source of result.sources){source.caloriesPoints=source.series.calories_kcal;source.proteinPoints=source.series.protein_g;}
  return {...result,unknownRows,invalidRows,caloriesPoints:result.source?.caloriesPoints||[],proteinPoints:result.source?.proteinPoints||[],
    note:'Médias dos dias encerrados com valor, por variável e origem. Fontes candidatas permanecem identificadas; não são somadas.'};
}
function sleepModel(data,status,bounds,ui,today){
  const observed=[];let invalidRows=0,unknownRows=0;
  for(const domain of ['metrics','sourceMetrics'])if(ready(status,domain))for(const row of data[domain]||[]){
    if(row.metric_type!=='sleep_duration_h'||(domain==='sourceMetrics'&&!accepted(row))||!inside(domain==='metrics'?row.measured_at:row.metric_date,bounds))continue;
    const value=nonnegative(row.value),point=metricObservation(row,domain,'value',value!=null&&value<=24?value:null);
    if(!point.label){unknownRows++;continue;}if(point.unit!=='h'){invalidRows++;continue;}if(point.values.value==null)invalidRows++;observed.push(point);
  }
  return {...domainSources(observed,['value'],status,['metrics','sourceMetrics'],bounds,today,ui.homeSleepSource||ui.reviewSleepSource),invalidRows,unknownRows,
    note:'Cada origem é uma série separada. Usa a data informada pela fonte; não infere a noite anterior ou posterior nem qualidade do sono.'};
}
function waterModel(data,status,bounds,ui,today){
  const observed=[];let unknownRows=0,invalidRows=0;
  if(ready(status,'nutrition'))for(const row of data.nutrition||[]){
    if(!inside(row.nutrition_date,bounds)||row.water_ml==null)continue;
    const label=String(row.source||'').trim();if(!label){unknownRows++;continue;}
    observed.push({date:dayOf(row.nutrition_date),label,status:'canonical',unit:'ml',domain:'nutrition',key:JSON.stringify(['nutrition',norm(label),'canonical','ml']),values:{value:nonnegative(row.water_ml)}});
  }
  if(ready(status,'sourceMetrics'))for(const row of data.sourceMetrics||[]){
    if(row.metric_type!=='dietary_water_ml'||!accepted(row)||!inside(row.metric_date,bounds))continue;
    const point=metricObservation(row,'sourceMetrics','value',nonnegative(row.value));
    if(!point.label){unknownRows++;continue;}if(point.unit!=='ml'){invalidRows++;continue;}if(point.values.value==null)invalidRows++;observed.push(point);
  }
  return {...domainSources(observed,['value'],status,['nutrition','sourceMetrics'],bounds,today,ui.homeWaterSource||ui.reviewWaterSource),unknownRows,invalidRows,
    note:'Água registrada por origem, sem soma entre fontes. Zero explícito é preservado; ausência não vira zero nem consumo completo.'};
}

function bodyModel(data,status,bounds,ui,today){
  const available=ready(status,'body'),all=available?(data.body||[]).filter(row=>inside(row.measured_at,bounds)).map(row=>({...row,...Object.fromEntries(bodyFields.map(field=>[field,nonnegative(row[field])])),date:dayOf(row.measured_at)})):[];
  const sourceKey=row=>JSON.stringify([norm(row.source),norm(row.device_name)]);
  const origins=[...groups(all,sourceKey)].map(([key,rows])=>({key,label:[rows[0].source||'Origem não informada',rows[0].device_name||'Modelo não informado'].join(' · ')}));
  const requested=ui.homeBodySource||ui.reportBodySource,rows=ordered(requested&&requested!=='all'?all.filter(row=>sourceKey(row)===requested):all);
  const byDate=groups(rows,row=>row.date),ambiguousDates=[...byDate].filter(([,items])=>items.length>1).map(([date])=>date),unambiguous=rows.filter(row=>byDate.get(row.date).length===1);
  const first=unambiguous[0]||null,latest=rows.length&&byDate.get(rows.at(-1).date).length===1?rows.at(-1):null;
  const selectedDate=unambiguous.some(row=>row.date===ui.overviewBodyDate)?ui.overviewBodyDate:latest?.date||null;
  const selected=unambiguous.find(row=>row.date===selectedDate)||null,series={};
  for(const field of bodyFields){
    series[field]=[...groups(rows,row=>JSON.stringify([row.date,sourceKey(row)]))].filter(([,items])=>items.length===1).map(([,items])=>items[0])
      .filter(row=>nonnegative(row[field])!=null).map(row=>({date:row.date,value:nonnegative(row[field]),cohort:row.device_name?sourceKey(row):null,context:[row.source,row.device_name||'Modelo não informado'].filter(Boolean).join(' · ')}));
  }
  const pair=Boolean(first&&latest&&first.date!==latest.date),knownModels=pair&&Boolean(norm(first.device_name)&&norm(latest.device_name));
  const sameModel=Boolean(knownModels&&norm(first.device_name)===norm(latest.device_name));
  const comparability={sameModel,deviceComparable:sameModel,conditionsConfirmed:false,confirmed:false,
    reason:!pair?'insufficient_measurements':!knownModels?'unknown_model':!sameModel?'different_model':'conditions_unconfirmed',
    note:'Diferenças aritméticas entre registros. Bioimpedância estima composição; aparelho e condições não confirmam mudança de tecido.'};
  const changes=Object.fromEntries(bodyFields.map(field=>[field,pair&&nonnegative(first[field])!=null&&nonnegative(latest[field])!=null?nonnegative(latest[field])-nonnegative(first[field]):null]));
  return {available,status:statusOf(status,['body'],rows.length),rows,origins,first,latest,selectedDate,selected,ambiguousDates,changes,comparability,
    series:{...series,fat:series.fat_mass_kg,muscle:series.skeletal_muscle_mass_kg,weight:series.weight_kg,bodyFatPct:series.body_fat_pct},
    coverage:coverage(rows,bounds,today,available),count:rows.length};
}
function unambiguousRecords(rows,key){
  const grouped=groups(rows,key),duplicates=[...grouped].filter(([,list])=>list.length>1).map(([key,list])=>({key,count:list.length}));
  return {rows:[...grouped.values()].filter(list=>list.length===1).map(([row])=>row),duplicates};
}
function trainingModel(data,status,bounds,today){
  const available=ready(status,'workouts'),detailsAvailable=available&&ready(status,'exercises')&&ready(status,'sets');
  const observed=available?(data.workouts||[]).filter(row=>row.is_canonical===true&&row.record_status!=='quarantined'&&inside(row.workout_date,bounds)).map(row=>({...row,date:dayOf(row.workout_date)})):[];
  const sessions=unambiguousRecords(observed,row=>row.source_record_id||JSON.stringify([row.date,row.source,row.workout_type,row.location]));
  const rows=ordered(sessions.rows),workoutMap=new Map(rows.filter(row=>row.source_record_id).map(row=>[row.source_record_id,row]));
  const exerciseRecords=ready(status,'exercises')?unambiguousRecords((data.exercises||[]).filter(row=>row.source_record_id&&workoutMap.has(row.workout_source_record_id)&&(!row.workout_date||dayOf(row.workout_date)===workoutMap.get(row.workout_source_record_id).date)),row=>JSON.stringify([row.workout_source_record_id,row.source_record_id])):{rows:[],duplicates:[]};
  const exercises=exerciseRecords.rows,exerciseMap=new Map(exercises.map(row=>[JSON.stringify([row.workout_source_record_id,row.source_record_id]),row]));
  const setRecords=detailsAvailable?unambiguousRecords((data.sets||[]).filter(row=>exerciseMap.has(JSON.stringify([row.workout_source_record_id,row.exercise_source_record_id]))&&workoutMap.has(row.workout_source_record_id)&&(!row.workout_date||dayOf(row.workout_date)===workoutMap.get(row.workout_source_record_id).date)),row=>row.source_record_id||JSON.stringify([row.workout_source_record_id,row.exercise_source_record_id,row.set_index,row.phase,row.weight,row.reps_numeric,row.reps_raw])):{rows:[],duplicates:[]};
  const sets=setRecords.rows,counts=detailsAvailable?trainingSetCounts(sets):null;
  const points=[...groups(rows,row=>row.date)].map(([date,list])=>({date,value:list.length,cohort:'recorded-sessions',context:'Sessões registradas',unit:'sessões'}));
  const setPoints=detailsAvailable?[...groups(sets,row=>workoutMap.get(row.workout_source_record_id).date)].map(([date,list])=>({date,value:trainingSetCounts(list).primary,extensions:trainingSetCounts(list).extensions,cohort:'recorded-primary-sets',context:'Séries principais registradas',unit:'séries'})).sort((a,b)=>a.date.localeCompare(b.date)):[];
  const groupRows=[...groups(exercises,row=>String(row.muscle_group||'Não informado').trim())].map(([label,items])=>{
    const ids=new Set(items.map(row=>JSON.stringify([row.workout_source_record_id,row.source_record_id]))),recorded=sets.filter(row=>ids.has(JSON.stringify([row.workout_source_record_id,row.exercise_source_record_id]))),c=trainingSetCounts(recorded);
    return {label,value:detailsAvailable?c.primary:null,primary:detailsAvailable?c.primary:null,sets:detailsAvailable?c.primary:null,extensions:detailsAvailable?c.extensions:null,sessions:unique(items.map(row=>row.workout_source_record_id)).length};
  }).sort((a,b)=>(b.value??0)-(a.value??0)||a.label.localeCompare(b.label));
  const latestRow=rows.at(-1)||null,latestCounts=latestRow&&detailsAvailable?trainingSetCounts(sets.filter(row=>row.workout_source_record_id===latestRow.source_record_id)):null;
  const latestWorkout=latestRow?{...latestRow,exerciseCount:ready(status,'exercises')?exercises.filter(row=>row.workout_source_record_id===latestRow.source_record_id).length:null,setCount:latestCounts?.primary??null,extensionCount:latestCounts?.extensions??null}:null;
  const latestExercises=latestWorkout?exercises.filter(row=>row.workout_source_record_id===latestWorkout.source_record_id).sort((a,b)=>(numeric(a.order_index)??999)-(numeric(b.order_index)??999)).map(row=>({...row,recordedSets:sets.filter(set=>set.workout_source_record_id===row.workout_source_record_id&&set.exercise_source_record_id===row.source_record_id).sort((a,b)=>(numeric(a.set_index)??999)-(numeric(b.set_index)??999))})):[];
  const durationRows=rows.filter(row=>nonnegative(row.duration_minutes)!=null),duplicates=[...sessions.duplicates,...exerciseRecords.duplicates,...setRecords.duplicates];
  return {available,status:statusOf(status,available?['workouts','exercises','sets']:['workouts'],rows.length),detailsAvailable,rows,sessions:available?rows.length:null,
    sets:counts?.primary??null,primarySets:counts?.primary??null,extensions:counts?.extensions??null,totalSets:counts?.total??null,
    points,setPoints,pointUnit:'sessões registradas/dia',groups:groupRows,exercises,recordedSets:sets,duplicates,
    recordedMinutes:durationRows.length?durationRows.reduce((sum,row)=>sum+nonnegative(row.duration_minutes),0):null,durationCoverage:durationRows.length,
    latestWorkout,latest:latestWorkout,latestExercises,coverage:coverage(rows,bounds,today,available),
    extensionPhases:detailsAvailable?{drop:sets.filter(row=>row.phase==='drop').length,rest_pause:sets.filter(row=>row.phase==='rest_pause').length}:null,
    primaryPhases:detailsAvailable?Object.fromEntries([...groups(sets.filter(row=>!isSetExtension(row)),row=>row.phase||'unknown')].map(([phase,list])=>[phase,list.length])):null,
    note:'Sessões e séries registradas, sem carga agregada entre aparelhos. Prolongamentos separados; fases antigas podem ser inferidas. Falta de registro não confirma descanso.'};
}

function labsModel(data,status,bounds,today){
  const available=ready(status,'labs'),rows=available?ordered((data.labs||[]).filter(row=>inside(row.collection_date,bounds)).map(row=>({...row,date:dayOf(row.collection_date)}))):[];
  const collections=[...groups(rows,row=>row.date)].map(([date,items])=>({date,count:items.length,rows:items}));
  const latestDate=collections.at(-1)?.date||null,latestRows=collections.at(-1)?.rows||[];
  const references=rows.map(row=>({date:row.date,biomarker:row.biomarker||'Marcador não informado',reference:row.reference_range||null,unit:row.unit||null,row}));
  return {available,status:statusOf(status,['labs'],rows.length),rows,collections,count:available?rows.length:null,collectionCount:available?collections.length:null,latestDate,latestRows,references,
    coverage:coverage(rows,bounds,today,available),note:'Resultados e referências transcritos do laudo, apenas de coletas na janela. Não são metas individuais nem diagnóstico.'};
}
function simpleRows(data,status,key,dateKey,bounds,today){
  const available=ready(status,key),rows=available?ordered((data[key]||[]).filter(row=>inside(row[dateKey],bounds)).map(row=>({...row,date:dayOf(row[dateKey])}))):[];
  return {available,status:statusOf(status,[key],rows.length),rows,coverage:coverage(rows,bounds,today,available)};
}
function snapshot(data,status,bounds,ui,today){
  const body=bodyModel(data,status,bounds,ui,today),training=trainingModel(data,status,bounds,today),nutrition=nutritionPeriodModel(data,status,bounds,ui,today),sleep=sleepModel(data,status,bounds,ui,today),water=waterModel(data,status,bounds,ui,today),labs=labsModel(data,status,bounds,today);
  const treatments=simpleRows(data,status,'treatments','event_date',bounds,today),polar=simpleRows(data,status,'polarSessions','workout_date',bounds,today);
  const domains={body,training,nutrition,sleep,water,labs,treatments,polar};
  const dates=unique(Object.values(domains).flatMap(domain=>domain.sources?domain.sources.flatMap(source=>source.rows.map(row=>row.date)):domain.rows.map(row=>row.date))).sort();
  const requested=ui.overviewBodyDate||ui.homeDate||ui.reviewDate,selectedDate=dates.includes(requested)?requested:body.selectedDate||dates.at(-1)||null;
  const selected={date:selectedDate,open:selectedDate===today,...Object.fromEntries(Object.entries(domains).map(([key,domain])=>[key,domain.rows.filter(row=>row.date===selectedDate)]))};
  const currentMetrics=[];
  for(const[key,label,unit]of [['fat_mass_kg','Gordura estimada','kg'],['skeletal_muscle_mass_kg','Músculo esquelético estimado','kg'],['weight_kg','Peso','kg'],['body_fat_pct','Gordura corporal estimada','%']]){
    if(body.latest&&nonnegative(body.latest[key])!=null)currentMetrics.push({key,label,unit,value:nonnegative(body.latest[key]),date:body.latest.date,source:[body.latest.source,body.latest.device_name].filter(Boolean).join(' · ')});
  }
  for(const[domain,key,label,unit]of [[nutrition,'protein_g','Proteína registrada','g'],[nutrition,'calories_kcal','Energia registrada','kcal'],[sleep,'value','Sono registrado','h'],[water,'value','Água registrada','mL']]){
    const row=domain.rows.filter(row=>row[key]!=null).at(-1);if(row)currentMetrics.push({key:key==='value'?(domain===sleep?'sleep':'water'):key,label,unit,value:row[key],date:row.date,source:domain.source?.label||null});
  }
  return {bounds,current:bounds,...domains,coverage:Object.fromEntries(Object.entries(domains).map(([key,domain])=>[key,domain.coverage])),dates,selectedDate,selected,currentMetrics,latestWorkout:training.latestWorkout};
}
function compareMetric(current,previous,field,bounds,previousBounds){
  const source=current.source,prior=source&&previous?.sources.find(item=>item.key===source.key),currentDays=source?.counts[field]||0,previousDays=prior?.counts[field]||0;
  const currentValue=source?.means[field]??null,previousValue=prior?.means[field]??null;
  const enough=(n,total)=>n>=comparisonRule.minimumDays&&total>0&&n/total>=comparisonRule.minimumCoverage;
  const reason=!previousBounds?'history_has_no_previous':!current.available||!previous?.available?'unavailable':current.partial||previous.partial?'partial_sources':!source?'no_current_source':!prior?'source_not_observed':!enough(currentDays,bounds.closedDays)||!enough(previousDays,previousBounds.closedDays)?'insufficient_coverage':'comparable';
  return {comparable:reason==='comparable',reason,source:source?.key||null,sourceLabel:source?.label||null,metric:field,current:currentValue,previous:previousValue,
    delta:reason==='comparable'?currentValue-previousValue:null,currentDays,previousDays,currentBounds:bounds,previousBounds,
    currentCoverage:bounds.closedDays?currentDays/bounds.closedDays:null,previousCoverage:previousBounds?.closedDays?previousDays/previousBounds.closedDays:null,rule:comparisonRule};
}
function describe(model){
  const {bounds,body,training,nutrition,sleep,water,labs}=model,range=`${displayDate(bounds.start)} a ${displayDate(bounds.end)}`,insights=[];
  const add=(kind,title,text,evidence,attention='')=>insights.push({kind,title,text,evidence,attention,isAttention:Boolean(attention)});
  if(body.rows.length){
    const pair=body.first&&body.latest&&body.first.date!==body.latest.date;
    add('body',`${body.rows.length} avaliações no período`,pair?`Gordura estimada: ${format(body.first.fat_mass_kg,1)} → ${format(body.latest.fat_mass_kg,1)} kg; músculo estimado: ${format(body.first.skeletal_muscle_mass_kg,1)} → ${format(body.latest.skeletal_muscle_mass_kg,1)} kg.`:`Última avaliação inequívoca: ${displayDate(body.latest?.date)}.`,pair?`${displayDate(body.first.date)} → ${displayDate(body.latest.date)}. ${body.comparability.note}`:body.comparability.note);
  }
  if(training.available&&training.sessions)add('training',`${training.sessions} sessões registradas`,training.primarySets==null?'Detalhes das séries indisponíveis.':`${training.primarySets} séries principais e ${training.extensions} prolongamentos registrados.`,`${range}. ${training.note}`);
  for(const[domain,field,label,unit,digits,kind]of [[nutrition,'protein_g','Proteína','g',0,'nutrition'],[nutrition,'calories_kcal','Energia','kcal',0,'nutrition'],[sleep,'value','Sono','h',1,'sleep'],[water,'value','Água','mL',0,'water']]){
    const value=domain.means[field],count=domain.counts[field];if(value==null)continue;
    const comparison=kind==='nutrition'?domain.comparison[field]:domain.comparison;
    const text=comparison?.comparable?`${format(comparison.previous,digits)} → ${format(value,digits)} ${unit} por dia com valor.`:`Média observada: ${format(value,digits)} ${unit} em ${count}/${bounds.closedDays} dias encerrados.`;
    add(kind,`${label} registrada no período`,text,`${domain.source.label}. ${range}.${comparison?.comparable?` Anterior: ${displayDate(comparison.previousBounds.start)} a ${displayDate(comparison.previousBounds.end)}, ${comparison.previousDays} dias com valor. ${comparison.rule.description}`:' Sem base equivalente suficiente para afirmar tendência.'} Dias registrados podem ser parciais.`);
  }
  if(labs.rows.length)add('labs',`${labs.collectionCount} coletas no período`,`${labs.count} resultados registrados; última coleta em ${displayDate(labs.latestDate)}.`,labs.note);
  const errors=Object.entries(model.coverage).filter(([key])=>['error','unavailable','partial'].includes(model[key].status)).map(([key])=>({body:'composição',training:'treino',nutrition:'alimentação',sleep:'sono',water:'água',labs:'exames',treatments:'tratamentos',polar:'Polar'}[key]));
  const pieces=[body.rows.length?`${body.rows.length} registros corporais`:null,training.available?`${training.sessions} sessões registradas`:null,
    nutrition.means.protein_g!=null?`proteína média ${format(nutrition.means.protein_g)} g em ${nutrition.counts.protein_g}/${bounds.closedDays} dias`:null,
    nutrition.means.calories_kcal!=null?`energia média ${format(nutrition.means.calories_kcal)} kcal em ${nutrition.counts.calories_kcal}/${bounds.closedDays} dias`:null,
    sleep.mean!=null?`sono médio ${format(sleep.mean,1)} h em ${sleep.count}/${bounds.closedDays} dias`:null,
    water.mean!=null?`água média ${format(water.mean)} mL em ${water.count}/${bounds.closedDays} dias`:null,
    labs.collectionCount?`${labs.collectionCount} coletas`:null].filter(Boolean);
  const summary=pieces.length?`${pieces.join(' · ')}.`:`Sem observações disponíveis entre ${range}.`;
  const bodyPair=body.first&&body.latest&&body.first.date!==body.latest.date;
  const bodyChanges=bodyPair?[
    ['fat_mass_kg','gordura estimada'],['skeletal_muscle_mass_kg','músculo estimado']
  ].filter(([field])=>nonnegative(body.first[field])!=null&&nonnegative(body.latest[field])!=null)
    .map(([field,label])=>`${label} ${format(nonnegative(body.first[field]),1)} → ${format(nonnegative(body.latest[field]),1)} kg`):[];
  const comparison=nutrition.comparison.protein_g?.comparable?nutrition.comparison.protein_g:nutrition.comparison.calories_kcal?.comparable?nutrition.comparison.calories_kcal:null;
  const primary=bodyChanges.length?{
    title:'Entre as avaliações do período',text:`As avaliações registraram ${bodyChanges.join(' e ')}.`,
    evidence:`${displayDate(body.first.date)} → ${displayDate(body.latest.date)}. ${summary}`,
    attention:body.comparability.sameModel?'Condições da medição não confirmadas; diferenças não comprovam mudança de tecido.':body.comparability.reason==='different_model'?'Aparelhos diferentes; comparação corporal não confirmada.':'Modelo não informado; comparação corporal não confirmada.'
  }:comparison?{
    title:comparison.delta===0?'A média alimentar registrada ficou estável':'A média alimentar registrada mudou',text:`${comparison.metric==='protein_g'?'Proteína':'Energia'}: ${format(comparison.previous)} → ${format(comparison.current)} ${comparison.metric==='protein_g'?'g':'kcal'} por dia com valor, frente à janela anterior de mesma duração.`,
    evidence:`${range}; anterior ${displayDate(comparison.previousBounds.start)} a ${displayDate(comparison.previousBounds.end)}. ${comparison.sourceLabel}: ${comparison.currentDays}/${bounds.closedDays} e ${comparison.previousDays}/${comparison.previousBounds.closedDays} dias.`,
    attention:'Comparação descritiva; dias registrados podem estar incompletos.'
  }:{title:insights.find(item=>['nutrition','sleep','water'].includes(item.kind))?.title||'O que foi registrado no período',text:insights.find(item=>['nutrition','sleep','water'].includes(item.kind))?.text||summary,evidence:range,attention:'Médias excluem hoje. Dias sem registro não significam zero.'};
  return {title:model.period==='all'?'Seu histórico registrado':`Seus últimos ${model.period} dias`,summary,insights,
    insight:{...primary,isAttention:Boolean(errors.length)||Boolean(bodyChanges.length&&!body.comparability.sameModel)},
    notices:errors.length?[`Leitura ausente ou parcial: ${errors.join(', ')}.`]:[]};
}

/** Same selected calendar for every observation and every descriptive claim.
 * `today` is an explicit local calendar date; omitted = America/Sao_Paulo today.
 * Date columns retain their source's calendar date; import timestamps never win.
 * Previous windows have equal calendar duration. Today's open records are shown
 * but excluded from means. History has no invented previous period.
 */
export function selectedCalendar(data={},status={},period='90',today=localToday()){
  today=dayOf(today);if(!today)throw new RangeError('today must be a valid local calendar date');
  period=['30','90','365','all'].includes(String(period))?String(period):'90';
  const keys=[['body','measured_at'],['nutrition','nutrition_date'],['sourceMetrics','metric_date'],['metrics','measured_at'],['workouts','workout_date'],['labs','collection_date'],['treatments','event_date'],['polarSessions','workout_date']];
  const dates=keys.flatMap(([key,dateKey])=>ready(status,key)?(data[key]||[]).map(row=>dayOf(row[dateKey])).filter(date=>date&&date<=today):[]).sort();
  const bounds=makeBounds(period==='all'?dates[0]||today:addDays(today,1-Number(period)),today,today);
  return {period,today,bounds};
}

export function homePeriodModel(data={},status={},period='90',ui={},today=localToday()){
  const calendar=selectedCalendar(data,status,period,today);
  ({period,today}=calendar);
  const {bounds}=calendar;
  const previousBounds=period==='all'?null:makeBounds(addDays(bounds.start,-Number(period)),addDays(bounds.start,-1),today);
  const model=snapshot(data,status,bounds,ui,today);
  const previous=previousBounds?{period,today,label:`Anterior · ${period} dias`,...snapshot(data,status,previousBounds,{...ui,homeNutritionSource:model.nutrition.source?.key||ui.homeNutritionSource,homeSleepSource:model.sleep.source?.key||ui.homeSleepSource,homeWaterSource:model.water.source?.key||ui.homeWaterSource},today)}:null;
  model.nutrition.comparison=Object.fromEntries(foodFields.map(field=>[field,compareMetric(model.nutrition,previous?.nutrition,field,bounds,previousBounds)]));
  model.sleep.comparison=compareMetric(model.sleep,previous?.sleep,'value',bounds,previousBounds);
  model.water.comparison=compareMetric(model.water,previous?.water,'value',bounds,previousBounds);
  const result={period,today,label:period==='all'?'Histórico':`${period} dias`,...model,previousBounds,previous,comparisonRule};
  return {...result,...describe(result)};
}
