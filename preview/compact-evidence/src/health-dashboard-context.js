// Pure, read-only context for the Health dashboard. Only explicitly recorded
// laboratory observations and canonical workouts are used. No I/O or UI state.
const DAY=86400000;
const text=value=>typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
const norm=value=>text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const known=value=>Boolean(text(value)&&!['unknown','unknown method','not informed','not provided','not available','unreported','nao informado','nao informada','nao disponivel','nao consta','metodo nao informado','metodo desconhecido','desconhecido','desconhecida','n/a','na','null','none','—','-'].includes(norm(value)));
const number=value=>(typeof value==='number'||(typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())))&&Number.isFinite(Number(value))?Number(value):null;
const nonnegative=value=>number(value)!=null&&number(value)>=0?number(value):null;
const unique=values=>[...new Set(values)];
const dateLabel=date=>date?date.split('-').reverse().join('/'):'sem data';
const day=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(value))return null;
  const result=value.slice(0,10),parsed=new Date(`${result}T12:00:00Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===result?result:null;
};
const difference=(end,start)=>Math.round((Date.parse(`${end}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/DAY);
const inside=(date,bounds)=>Boolean(date&&date>=bounds.start&&date<=bounds.end);
const groups=(rows,key)=>{const map=new Map();for(const row of rows){const id=key(row);if(!map.has(id))map.set(id,[]);map.get(id).push(row);}return map;};
const ordered=rows=>rows.slice().sort((a,b)=>a.date.localeCompare(b.date)||String(a.key).localeCompare(String(b.key)));
const sourceState=(status,key)=>status?.[key]==='ready'?'ready':status?.[key]==='error'?'error':status?.[key]==='loading'?'loading':'unavailable';
const state=(status,key,count)=>sourceState(status,key)==='ready'?(count?'ready':'empty'):sourceState(status,key);
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const fingerprint=value=>JSON.stringify(stable(value));

// Exact duplicate observations may be counted once. Conflicting identities are
// excluded; no source row is silently preferred over another one.
function deduplicate(rows,key,shape){
  const result=[],duplicates=[];
  for(const[id,list]of groups(rows,key)){
    const variants=[...groups(list,row=>fingerprint(shape(row))).values()].map(items=>items[0]);
    if(list.length>1)duplicates.push({key:id,count:list.length,conflicting:variants.length>1});
    if(variants.length===1)result.push(variants[0]);
  }
  return {rows:result,duplicates};
}

const decimalPattern='[+-]?(?:\\d+(?:[.,]\\d+)?|[.,]\\d+)';
function decimal(raw){
  // A single separator with three trailing digits can be a thousands separator.
  if(!new RegExp(`^${decimalPattern}$`).test(raw)||/^[+-]?[1-9]\d{0,2}[.,]\d{3}$/.test(raw))return null;
  const value=Number(raw.replace(',','.'));return Number.isFinite(value)?value:null;
}
function referenceInterval(reference,unit){
  if(!known(unit)||!text(reference))return null;
  const input=text(reference),limit=input.match(new RegExp(`^(<=|>=|<|>|≤|≥)\\s*(${decimalPattern})(?:\\s+(.+))?$`));
  if(limit){
    const value=decimal(limit[2]);if(value==null||(limit[3]&&text(limit[3])!==unit))return null;
    const below=['<','<=','≤'].includes(limit[1]),inclusive=['<=','>=','≤','≥'].includes(limit[1]);
    return {lower:below?null:value,upper:below?value:null,lowerInclusive:below?false:inclusive,upperInclusive:below?inclusive:false,reference:input,unit};
  }
  const range=input.match(new RegExp(`^(${decimalPattern})\\s*(?:a|até|to|[-–—])\\s*(${decimalPattern})(?:\\s+(.+))?$`,'i'));
  if(!range)return null;
  const lower=decimal(range[1]),upper=decimal(range[2]);
  if(lower==null||upper==null||lower>=upper||(range[3]&&text(range[3])!==unit))return null;
  return {lower,upper,lowerInclusive:true,upperInclusive:true,reference:input,unit};
}
function referencePosition(value,range){
  if(value==null||!range)return 'unknown';
  if(range.lower!=null&&(value<range.lower||(!range.lowerInclusive&&value===range.lower)))return 'below';
  if(range.upper!=null&&(value>range.upper||(!range.upperInclusive&&value===range.upper)))return 'above';
  return 'within';
}
function distanceToRange(value,range){
  if(value==null||!range)return null;
  if(range.lower!=null&&value<range.lower)return range.lower-value;
  if(range.upper!=null&&value>range.upper)return value-range.upper;
  return 0;
}
const intervalKey=range=>range?JSON.stringify([range.lower,range.upper,range.lowerInclusive,range.upperInclusive,range.unit]):null;
function exactValue(row){
  const value=number(row.result_numeric);if(value==null)return null;
  const raw=text(row.result_raw);if(!raw)return value;
  const match=raw.match(new RegExp(`^(${decimalPattern})(?:\\s+(.+))?$`));
  if(!match||(match[2]&&text(match[2])!==text(row.unit)))return null;
  // result_numeric is authoritative, but contradictory or censored raw results
  // cannot become exact values for comparison or reference classification.
  return decimal(match[1])===value?value:null;
}
function reportedFlag(flag){
  if(flag===true)return true;
  if(!known(flag))return false;
  return !['normal','n','within','within range','dentro da referencia','dentro da faixa','sem alteracao','sem alteracoes','sem flag','false','false flag','0','no','nao'].includes(norm(flag));
}
function laboratoryObservation(row,bounds){
  const date=day(row.collection_date),unit=text(row.unit),value=number(row.result_numeric),exact=exactValue(row),reference=text(row.reference_range)||null;
  const interval=referenceInterval(reference,unit),position=referencePosition(exact,interval),flag=reportedFlag(row.flag);
  return {key:text(row.source_record_id)||fingerprint([date,row.biomarker,row.laboratory,unit,row.method,row.result_raw,row.result_numeric,reference]),
    sourceRecordId:text(row.source_record_id)||null,date,collection_date:date,biomarker:text(row.biomarker)||'Marcador não informado',markerKnown:known(row.biomarker),laboratory:text(row.laboratory)||null,
    value,rawValue:text(row.result_raw)||null,unit:unit||null,reference,method:text(row.method)||null,source:text(row.source)||null,
    exactValue:exact,interval,referencePosition:position,referenceLabel:position==='within'?'dentro da referência':['below','above'].includes(position)?'fora da referência':null,
    flag:typeof row.flag==='string'?text(row.flag):row.flag===true?true:null,reportedFlag:flag,attention:flag||['below','above'].includes(position),
    attentionLabel:flag||['below','above'].includes(position)?'atenção ao laudo':null,inPeriod:inside(date,bounds),
    periodLabel:inside(date,bounds)?'No período selecionado':'Fora do período selecionado'};
}
const labIdentity=row=>JSON.stringify([norm(row.biomarker),text(row.unit),norm(row.laboratory),row.markerKnown?null:row.key]);
function compareLabs(current,previous,ambiguous){
  const sameMethod=Boolean(previous&&known(current.method)&&known(previous.method)&&norm(current.method)===norm(previous.method));
  const sameReference=Boolean(previous&&current.reference&&previous.reference&&(current.reference===previous.reference||(intervalKey(current.interval)&&intervalKey(current.interval)===intervalKey(previous.interval))));
  const reason=ambiguous?'ambiguous_collection':!previous?'no_previous':!known(current.laboratory)||!known(previous.laboratory)?'unknown_laboratory':
    !known(current.unit)||!known(previous.unit)?'unknown_unit':current.exactValue==null||previous.exactValue==null?'non_exact_value':
    !known(current.method)||!known(previous.method)?'unknown_method':!sameMethod?'different_method':!sameReference?'different_or_missing_reference':'comparable';
  const comparable=reason==='comparable',rangeComparable=Boolean(comparable&&current.interval&&previous.interval&&intervalKey(current.interval)===intervalKey(previous.interval));
  let label='sem comparação';
  if(rangeComparable){
    const currentInside=current.referencePosition==='within',previousInside=previous.referencePosition==='within';
    const currentDistance=distanceToRange(current.exactValue,current.interval),previousDistance=distanceToRange(previous.exactValue,previous.interval);
    label=currentInside&&previousInside?'dentro da referência':currentInside&&!previousInside?'aproximou da referência':!currentInside&&previousInside?'afastou da referência':
      currentDistance<previousDistance?'aproximou da referência':currentDistance>previousDistance?'afastou da referência':'fora da referência';
  }
  return {comparable,rangeComparable,sameMethod,sameReference,comparisonReason:reason,label,status:label,
    delta:comparable?Number((current.exactValue-previous.exactValue).toPrecision(12)):null,
    comparisonLabel:comparable?'Mesmo laboratório, unidade, método e referência registrados':'Valores separados; comparação não estabelecida'};
}
function labsContext(data,status,bounds){
  const available=status.labs==='ready',observed=available?(data.labs||[]).filter(row=>day(row?.collection_date)&&day(row.collection_date)<=bounds.end).map(row=>laboratoryObservation(row,bounds)):[];
  const canonical=deduplicate(observed,row=>row.sourceRecordId||row.key,row=>row);
  const unverifiedIds=new Set([...groups(observed.filter(row=>!row.sourceRecordId),row=>row.key)].filter(([,rows])=>rows.length>1).map(([key])=>key));
  canonical.rows=canonical.rows.filter(row=>!unverifiedIds.has(row.key));
  canonical.duplicates=canonical.duplicates.map(row=>unverifiedIds.has(row.key)?{...row,conflicting:true,reason:'unverified_identity'}:row);
  // Keep conflicting laboratory observations readable, including a conflict on
  // the newest collection. Never silently substitute an older value as latest.
  const conflictingIds=new Set(canonical.duplicates.filter(row=>row.conflicting).map(row=>row.key));
  const conflicts=[...groups(observed.filter(row=>conflictingIds.has(row.sourceRecordId||row.key)),fingerprint).values()].map(([row])=>({...row,identityConflict:true}));
  const history=ordered([...canonical.rows,...conflicts]),periodRows=history.filter(row=>row.inPeriod),items=[];
  for(const[key,list]of groups(history,labIdentity)){
    const byDate=groups(list,row=>row.date),latestDate=list.at(-1).date,latest=byDate.get(latestDate),ambiguous=latest.length>1||latest.some(row=>row.identityConflict);
    const previousDate=[...byDate.keys()].filter(date=>date<latestDate).sort().at(-1),prior=previousDate?byDate.get(previousDate):[];
    const previous=prior.length===1&&!prior[0].identityConflict?prior[0]:null,current=latest[0];
    const comparison=compareLabs(current,previous,ambiguous||prior.length>1);
    const item={...current,key,...comparison,previous,previousDate:previous?.date||null,priorOutside:Boolean(previous&&!previous.inPeriod),ambiguous,
      observations:latest,history:list,periodHistory:list.filter(row=>row.inPeriod),ambiguousDates:[...byDate].filter(([,rows])=>rows.length>1||rows.some(row=>row.identityConflict)).map(([date])=>date),
      references:[...(previous?[{date:previous.date,reference:previous.reference,unit:previous.unit,method:previous.method,laboratory:previous.laboratory}]:[]),
        ...latest.map(row=>({date:row.date,reference:row.reference,unit:row.unit,method:row.method,laboratory:row.laboratory}))],
      dates:{previous:previous?.date||null,current:latestDate},selectionNote:'Ordem alfabética; sem classificação de gravidade clínica.'};
    if(ambiguous){
      Object.assign(item,{value:null,rawValue:null,exactValue:null,reference:null,interval:null,referencePosition:'unknown',referenceLabel:null,method:null,
        attention:latest.some(row=>row.attention),attentionLabel:latest.some(row=>row.attention)?'atenção ao laudo':null,
        flag:null,reportedFlag:latest.some(row=>row.reportedFlag),comparisonLabel:'Múltiplos resultados na mesma data; consulte cada observação'});
    }
    items.push(item);
  }
  items.sort((a,b)=>a.biomarker.localeCompare(b.biomarker,'pt-BR')||String(a.laboratory).localeCompare(String(b.laboratory),'pt-BR')||String(a.unit).localeCompare(String(b.unit)));
  return {available,status:state(status,'labs',history.length),items,latestRows:items,rows:periodRows,periodRows,history,
    count:available?periodRows.length:null,knownCount:available?history.length:null,collectionCount:available?unique(periodRows.map(row=>row.date)).length:null,
    latestDate:history.at(-1)?.date||null,inPeriodCount:items.filter(row=>row.inPeriod).length,outsidePeriodCount:items.filter(row=>!row.inPeriod).length,
    duplicates:canonical.duplicates,partial:canonical.duplicates.some(row=>row.conflicting),
    note:'Últimos resultados conhecidos até o fim da janela; datas externas são identificadas. Referências pertencem a cada laudo. Aproximação da faixa e direção numérica não definem melhora clínica, diagnóstico ou meta individual.'};
}

function explicitGroups(value){
  const labels=Array.isArray(value)?value:typeof value==='string'&&!/[,;|+\[\]{}\n]/.test(value)?[value]:[];
  const result=new Map();for(const label of labels)if(known(label)&&!result.has(norm(label)))result.set(norm(label),text(label));
  return [...result.values()];
}
const workoutKey=row=>text(row.source_record_id)||JSON.stringify([day(row.workout_date),text(row.source),text(row.workout_type),text(row.location)]);
const workoutShape=row=>({date:day(row.workout_date),type:text(row.workout_type),location:text(row.location),source:text(row.source),duration:nonnegative(row.duration_minutes),groups:explicitGroups(row.muscle_groups).sort()});
function trainingContext(data,status,bounds,today){
  const available=status.workouts==='ready',detailsAvailable=status.exercises==='ready';
  const observed=available?(data.workouts||[]).filter(row=>row?.is_canonical===true&&norm(row.record_status)!=='quarantined'&&day(row.workout_date)&&day(row.workout_date)<=bounds.end):[];
  const canonical=deduplicate(observed,workoutKey,workoutShape);
  const unverifiedIdentities=new Set([...groups(observed.filter(row=>!text(row.source_record_id)),workoutKey)].filter(([,rows])=>rows.length>1).map(([key])=>key));
  canonical.rows=canonical.rows.filter(row=>!unverifiedIdentities.has(workoutKey(row)));
  canonical.duplicates=canonical.duplicates.map(row=>unverifiedIdentities.has(row.key)?{...row,conflicting:true,reason:'unverified_identity'}:row);
  const byId=new Map(canonical.rows.filter(row=>text(row.source_record_id)).map(row=>[text(row.source_record_id),row]));
  const exerciseRows=available&&detailsAvailable?(data.exercises||[]).filter(row=>byId.has(text(row?.workout_source_record_id))&&(!row.workout_date||day(row.workout_date)===day(byId.get(text(row.workout_source_record_id)).workout_date))):[];
  const exercises=deduplicate(exerciseRows,row=>JSON.stringify([text(row.workout_source_record_id),text(row.source_record_id)||[day(row.workout_date),row.order_index,text(row.exercise),text(row.machine)]]),
    row=>({parent:text(row.workout_source_record_id),date:day(row.workout_date),group:explicitGroups(row.muscle_group),exercise:text(row.exercise),machine:text(row.machine),order:row.order_index??null}));
  const byWorkout=groups(exercises.rows,row=>text(row.workout_source_record_id));
  const history=ordered(canonical.rows.map(row=>{
    const labels=new Map();
    for(const label of [...explicitGroups(row.muscle_groups),...(byWorkout.get(text(row.source_record_id))||[]).flatMap(item=>explicitGroups(item.muscle_group))])if(!labels.has(norm(label)))labels.set(norm(label),label);
    const date=day(row.workout_date),duration=nonnegative(row.duration_minutes),inPeriod=inside(date,bounds);
    return {key:workoutKey(row),sourceRecordId:text(row.source_record_id)||null,source_record_id:text(row.source_record_id)||null,date,workout_date:date,
      type:text(row.workout_type)||'Tipo não informado',workout_type:text(row.workout_type)||null,groups:[...labels.values()].sort((a,b)=>a.localeCompare(b,'pt-BR')),
      duration,duration_minutes:duration,source:text(row.source)||null,location:text(row.location)||null,inPeriod,
      periodLabel:inPeriod?'No período selecionado':'Fora do período selecionado'};
  }));
  const rows=history.filter(row=>row.inPeriod),durationRows=rows.filter(row=>row.duration!=null),recordedDays=unique(rows.map(row=>row.date)).length,latestUnambiguous=history.at(-1)||null;
  const lastObservedDate=observed.map(row=>day(row.workout_date)).sort().at(-1)||null;
  const lastRecordAmbiguous=Boolean(lastObservedDate&&lastObservedDate!==latestUnambiguous?.date),latest=lastRecordAmbiguous?null:latestUnambiguous;
  const conflictingRecords=canonical.duplicates.some(row=>row.conflicting)||exercises.duplicates.some(row=>row.conflicting);
  const lastSessions=rows.slice().reverse().slice(0,3),outside=history.filter(row=>!row.inPeriod),daysSinceLast=latest?difference(bounds.end,latest.date):null;
  const distribution=new Map();
  for(const row of history)for(const label of row.groups){const key=norm(label);if(!distribution.has(key))distribution.set(key,{key,label,rows:[]});distribution.get(key).rows.push(row);}
  const groupRows=[],missingGroups=[];
  for(const group of distribution.values()){
    const current=group.rows.filter(row=>row.inPeriod),last=group.rows.at(-1),prior=group.rows.filter(row=>row.date<bounds.start);
    const item={key:group.key,label:group.label,sessions:current.length,days:unique(current.map(row=>row.date)).length,dates:unique(current.map(row=>row.date)).sort(),
      sessionKeys:current.map(row=>row.key),lastDate:last.date,inPeriod:current.length>0,denominator:rows.length,unit:'sessões registradas',
      note:'Grupos podem compartilhar a mesma sessão; frequência de registros não demonstra frequência real ou aderência.'};
    if(current.length)groupRows.push(item);
    else if(prior.length&&detailsAvailable&&!conflictingRecords)missingGroups.push({...item,daysSinceLast:difference(bounds.end,last.date),
      labelText:`${group.label}: sem registro nesta janela`,note:'Grupo presente no histórico anterior. Ausência de registro não significa que não foi treinado.'});
  }
  const alphabetical=(a,b)=>a.label.localeCompare(b.label,'pt-BR');groupRows.sort(alphabetical);missingGroups.sort(alphabetical);
  const durationCoverage={sessions:available?durationRows.length:null,total:available?rows.length:null,fraction:available&&rows.length?durationRows.length/rows.length:null,
    complete:available&&rows.length>0&&durationRows.length===rows.length,label:available?`${durationRows.length}/${rows.length} sessões com duração registrada`:'Duração indisponível'};
  const partial=available&&(!detailsAvailable||conflictingRecords);
  const gapLabel=latest?`${bounds.end<today?`Em ${dateLabel(bounds.end)}: `:''}${daysSinceLast} dias desde o último treino registrado${!latest.inPeriod?' (registro fora do período selecionado)':''}`:null;
  return {available,status:!available?sourceState(status,'workouts'):partial?'partial':rows.length?'ready':'empty',detailsAvailable:available&&detailsAvailable,
    groupsStatus:!available?sourceState(status,'workouts'):detailsAvailable?'ready':sourceState(status,'exercises'),partial,rows,history,
    sessions:available?rows.length:null,recordedDays:available?recordedDays:null,days:available?recordedDays:null,
    recordedMinutes:durationRows.length?durationRows.reduce((sum,row)=>sum+row.duration,0):null,durationCoverage,
    groups:groupRows,missingGroups,groupCoverage:{sessions:available?rows.filter(row=>row.groups.length).length:null,total:available?rows.length:null,complete:false},
    latestSessions:lastSessions,lastSessions,latest,lastRegistered:latest,latestWorkout:latest,latestUnambiguous,lastObservedDate,lastRecordAmbiguous,historicalSessions:outside.slice().reverse().slice(0,3),
    daysSinceLast,gapLabel,asOf:bounds.end,duplicates:[...canonical.duplicates.map(item=>({...item,domain:'workouts'})),...exercises.duplicates.map(item=>({...item,domain:'exercises'}))],
    coverage:{recordedDays:available?recordedDays:null,calendarDays:difference(bounds.end,bounds.start)+1,firstDate:rows[0]?.date||null,lastDate:rows.at(-1)?.date||null,
      note:'Dias com registro não comprovam cobertura completa. Ausência não significa que não houve treino.'},
    notices:[...(conflictingRecords?['Identidades conflitantes foram excluídas dos totais. Lacunas por grupo não são calculadas com esses registros incompletos.']:[]),
      ...(lastRecordAmbiguous?['A data mais recente contém apenas sessões ambíguas; não é calculado um intervalo desde um treino anterior.']:[]),
      ...(available&&!detailsAvailable?['Exercícios indisponíveis; somente grupos declarados nas sessões estão disponíveis.']:[])],
    note:'Somente sessões canônicas únicas. Minutos somam apenas durações informadas; grupos vêm de campos explícitos e podem compartilhar sessões. Falta de registro não confirma descanso.'};
}

/**
 * dashboardContext(data, status, {bounds, today, mode}) -> {labs, training}.
 * `today` is a supplied local calendar date; defaults to bounds.end, never to a
 * machine clock. Results after bounds.end (or today) are never observed.
 * Latest labs/workout may precede bounds.start and retain inPeriod:false.
 * A missing/failed source yields null totals; a successfully loaded empty
 * source yields zero recorded counts. Inputs are never mutated.
 */
export function dashboardContext(data={},status={},options={}){
  const today=day(options.today||options.bounds?.end),start=day(options.bounds?.start),requestedEnd=day(options.bounds?.end),end=today&&requestedEnd?(requestedEnd<today?requestedEnd:today):null;
  const mode=options.mode||'period';
  if(!today||!start||!end||start>end){
    const emptyBounds={start:'0001-01-01',end:'0001-01-01'},labs=labsContext({}, {},emptyBounds),training=trainingContext({}, {},emptyBounds,'0001-01-01');
    return {valid:false,reason:'invalid_calendar',today,mode,bounds:null,labs:{...labs,status:'invalid_calendar'},training:{...training,status:'invalid_calendar'}};
  }
  const bounds={...options.bounds,start,end,days:difference(end,start)+1};
  return {valid:true,reason:null,today,mode,bounds,labs:labsContext(data,status,bounds),training:trainingContext(data,status,bounds,today)};
}
