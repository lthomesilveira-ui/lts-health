// Pure, read-only context for the Health dashboard. Only explicitly recorded
// laboratory observations and canonical workouts are used. No I/O or UI state.
import {enrichDashboardTraining} from './health-dashboard-training.js';
import {dashboardLabs} from './health-dashboard-labs.js';
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
    notices:[...(conflictingRecords?['Registros com informações diferentes para a mesma sessão ficaram fora dos totais. Lacunas por grupo não são calculadas com esses registros incompletos.']:[]),
      ...(lastRecordAmbiguous?['A data mais recente contém apenas sessões ambíguas; não é calculado um intervalo desde um treino anterior.']:[]),
      ...(available&&!detailsAvailable?['Exercícios indisponíveis; somente grupos declarados nas sessões estão disponíveis.']:[])],
    note:'Somente sessões registradas sem conflito. Minutos somam apenas durações informadas; grupos vêm de campos explícitos e podem compartilhar sessões. Falta de registro não confirma descanso.'};
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
    const emptyBounds={start:'0001-01-01',end:'0001-01-01'},labs=dashboardLabs({}, {},emptyBounds),training=enrichDashboardTraining(trainingContext({}, {},emptyBounds,'0001-01-01'),{}, {},emptyBounds);
    return {valid:false,reason:'invalid_calendar',today,mode,bounds:null,labs:{...labs,status:'invalid_calendar'},training:{...training,status:'invalid_calendar'}};
  }
  const bounds={...options.bounds,start,end,days:difference(end,start)+1};
  return {valid:true,reason:null,today,mode,bounds,labs:dashboardLabs(data,status,bounds),training:enrichDashboardTraining(trainingContext(data,status,bounds,today),data,status,bounds)};
}
