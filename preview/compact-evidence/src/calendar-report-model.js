import {healthDashboardModel,healthDashboardComparisonRule} from './health-dashboard-model.js';
import {dashboardContext} from './health-dashboard-context.js';
import {trainingSessionSummary} from './training-session-summary.js';
import {trainingComparability} from './training-comparability.js';
import {laboratoryReport} from './reports-model.js';
import {nutritionPlanComparison} from './nutrition-plan-comparison.js';

// Read-only calendar reports. No database writes, recommendations, clinical
// targets, inferred activity, causal scores, or aggregation across origins.
const DAY=86400000;
const keys=['water','protein','energy','steps','activeEnergy'];
const date=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const parsed=new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value?value:null;
};
const recordedDay=value=>typeof value==='string'?date(value.slice(0,10)):null;
const add=(day,amount)=>new Date(Date.parse(`${day}T12:00:00Z`)+amount*DAY).toISOString().slice(0,10);
const count=(start,end)=>start>end?0:Math.round((Date.parse(`${end}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/DAY)+1;
const inside=(day,bounds)=>Boolean(day&&bounds&&day>=bounds.start&&day<=bounds.end);
const display=day=>day.split('-').reverse().join('/');
const text=value=>typeof value==='string'?value.trim():'';
const unique=values=>[...new Set(values)];
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const fingerprint=value=>JSON.stringify(stable(value));
const state=(status,key)=>['ready','loading','error'].includes(status?.[key])?status[key]:'unavailable';
function localDay(value=new Date()){
  if(date(value))return value;
  if(!(value instanceof Date)&&!(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&date(value.slice(0,10))))throw new RangeError('today must be a valid calendar date or an instant with timezone');
  const instant=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(instant.getTime()))throw new RangeError('today must be valid');
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant);
  return ['year','month','day'].map(type=>parts.find(part=>part.type===type).value).join('-');
}
function bounds(start,end,today){
  const closedEnd=end<today?end:add(today,-1);
  return {start,end,days:count(start,end),closedEnd,closedDays:count(start,closedEnd),includesToday:inside(today,{start,end})};
}
function monthEnd(start){
  const [year,month]=start.split('-').map(Number),next=new Date(`${start.slice(0,7)}-01T12:00:00Z`);
  next.setUTCFullYear(year,month,0);return next.toISOString().slice(0,10);
}
function nominal(mode,anchor){
  if(mode==='month'){const start=`${anchor.slice(0,7)}-01`;return {start,end:monthEnd(start)};}
  const weekday=new Date(`${anchor}T12:00:00Z`).getUTCDay(),start=add(anchor,-((weekday+6)%7));
  return {start,end:add(start,6)};
}

/** Calendar dates are interpreted in São Paulo, never the browser timezone.
 * `last` means the previous complete Monday–Sunday week / calendar month.
 * `date` selects the containing week/month; future and malformed selections
 * fall back explicitly to `last`. Current periods stop at today; means stop
 * yesterday. Month comparisons use only the common closed-day prefix. */
export function calendarReportCalendar(ui={},today){
  today=localDay(today);
  const mode=ui.calendarReportMode==='month'?'month':'week';
  const requestedSelection=ui.calendarReportSelection||'last';
  let selection=['last','current','date'].includes(requestedSelection)?requestedSelection:'last';
  const rawDate=ui.calendarReportDate,requestedDate=date(mode==='month'&&typeof rawDate==='string'&&/^\d{4}-\d{2}$/.test(rawDate)?`${rawDate}-01`:rawDate);
  const current=nominal(mode,today),selectionAdjusted=selection!==requestedSelection||selection==='date'&&(!requestedDate||requestedDate>today);
  if(selectionAdjusted)selection='last';
  const anchor=selection==='last'?add(current.start,-1):selection==='current'?today:requestedDate;
  const whole=nominal(mode,anchor),previous=nominal(mode,add(whole.start,-1));
  const nominalBounds=bounds(whole.start,whole.end,today),currentBounds=bounds(whole.start,whole.end<today?whole.end:today,today);
  const previousBounds=bounds(previous.start,previous.end,today),comparisonDays=Math.min(currentBounds.closedDays,previousBounds.closedDays);
  const comparisonBounds=comparisonDays?bounds(currentBounds.start,add(currentBounds.start,comparisonDays-1),today):null;
  const previousComparisonBounds=comparisonDays?bounds(previousBounds.start,add(previousBounds.start,comparisonDays-1),today):null;
  const partial=whole.end>=today,unequalMonths=mode==='month'&&nominalBounds.days!==previousBounds.days;
  const comparisonTruncated=comparisonDays!==currentBounds.closedDays||comparisonDays!==previousBounds.closedDays;
  const name=mode==='week'?'Semana':'Mês',label=mode==='week'?`Semana de ${display(whole.start)} a ${display(whole.end)}`:new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${whole.start}T12:00:00Z`));
  const comparisonNote=!comparisonDays?'Ainda não há dia encerrado neste período. Hoje aparece separado, sem média nem diferença.':
    `${comparisonTruncated||unequalMonths?'Somente os primeiros dias de cada período: ':''}${comparisonDays} dias encerrados, ${display(comparisonBounds.start)} a ${display(comparisonBounds.end)} versus ${display(previousComparisonBounds.start)} a ${display(previousComparisonBounds.end)}.${unequalMonths?' Os meses têm durações diferentes; os dias adicionais ficam na média do mês, fora da diferença.':''}${partial?' O período atual é parcial; os dias futuros não entram na cobertura.':''} A média do período inteiro e a média usada na diferença podem ser distintas.`;
  return {mode,selection,date:anchor,today,timezone:'America/Sao_Paulo',label,name,partial,temporalStatus:partial?'partial':'complete',selectionAdjusted,
    selectionNotice:selectionAdjusted?'Data ou seleção inválida/futura; exibido o último período completo.':null,
    nominalBounds,bounds:currentBounds,previousBounds,comparisonBounds,previousComparisonBounds,comparisonDays,comparisonTruncated,unequalMonths,comparisonNote,
    labelWithStatus:`${label} · ${partial?'parcial até '+display(today):'encerrado'}`};
}
function explicitUI(ui,current,previous=null){return {...ui,dashboardSources:{...ui.dashboardSources,...ui.calendarReportSources},dashboardCalendar:{bounds:current,previousBounds:previous}};}
function sum(items,key){return items.every(item=>item[key]!=null)?items.reduce((total,item)=>total+item[key],0):null;}
function trainingReport(data,status,calendar){
  const received=dashboardContext(data,status,{bounds:calendar.bounds,today:calendar.today}).training;
  const reviewed=received.history.map(row=>{
    const original=(data.workouts||[]).find(workout=>workout.source_record_id===row.sourceRecordId);
    return {original,date:row.date,summary:trainingSessionSummary(original,data,status)};
  });
  // Session .71 validates whole identities, including source text and child
  // identities reused under another parent. Reduced dashboard projections must
  // not reinstate a session or detail that the stricter summary rejected.
  const accepted=reviewed.filter(item=>item.summary.sessionAvailable);
  const acceptedExercises=accepted.flatMap(item=>item.summary.acceptedExercises),acceptedSets=accepted.flatMap(item=>item.summary.acceptedSets);
  const strictData={...data,workouts:accepted.map(item=>item.original),exercises:acceptedExercises,sets:acceptedSets};
  const base=dashboardContext(strictData,status,{bounds:calendar.bounds,today:calendar.today}).training;
  const previous=dashboardContext(strictData,status,{bounds:calendar.previousBounds,today:calendar.today}).training;
  const sessionSummaries=accepted.map(item=>item.summary).filter(summary=>inside(summary.date,calendar.bounds));
  const rejectedSessions=reviewed.filter(item=>!item.summary.sessionAvailable&&inside(item.date,calendar.bounds));
  const detailPartial=sessionSummaries.some(summary=>summary.partial);
  const latestAmbiguous=received.lastRecordAmbiguous||Boolean(received.lastObservedDate&&(received.lastObservedDate!==base.lastObservedDate||reviewed.some(item=>!item.summary.sessionAvailable&&item.date===received.lastObservedDate)));
  const workoutIds=new Set(accepted.map(item=>item.original.source_record_id)),exerciseIds=new Set(acceptedExercises.map(row=>row.source_record_id)),setIds=new Set(acceptedSets.map(row=>row.source_record_id));
  const progressionData={...data,workouts:(data.workouts||[]).filter(row=>workoutIds.has(row.source_record_id)),exercises:(data.exercises||[]).filter(row=>exerciseIds.has(row.source_record_id)),sets:(data.sets||[]).filter(row=>setIds.has(row.source_record_id))};
  const labels=unique(sessionSummaries.flatMap(summary=>summary.muscleGroups.map(group=>group.label)));
  const recordedGroups=labels.map(label=>{
    const items=sessionSummaries.flatMap(summary=>summary.muscleGroups.filter(group=>group.label===label));
    return {label,sessions:items.length,exercises:sum(items,'exercises'),primary:sum(items,'primary'),extensions:sum(items,'extensions'),total:sum(items,'total')};
  }).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
  const available=['workouts','exercises','sets'].every(key=>status[key]==='ready'&&Array.isArray(data[key]));
  const progression=trainingComparability(available?progressionData:{},{bounds:{start:calendar.previousBounds.start,end:calendar.bounds.closedEnd},today:calendar.today,closedOnly:true});
  // A change must end inside this report. Prior-only evolution is historical
  // context, not a change that happened in the selected week/month.
  const inReport=cohort=>inside(cohort.latest?.date,{start:calendar.bounds.start,end:calendar.bounds.closedEnd});
  progression.comparable=progression.comparable.filter(inReport);
  progression.observed=progression.observed.filter(inReport);
  const unknown=sessionSummaries.map(summary=>summary.unknownMuscleGroup);
  return {...base,previous,sessionSummaries,recordedGroups,
    lastObservedDate:received.lastObservedDate,lastRecordAmbiguous:latestAmbiguous,
    latest:latestAmbiguous?null:base.latest,lastRegistered:latestAmbiguous?null:base.lastRegistered,latestWorkout:latestAmbiguous?null:base.latestWorkout,
    daysSinceLast:latestAmbiguous?null:base.daysSinceLast,gapLabel:latestAmbiguous?null:base.gapLabel,
    recentSessions:base.latestSessions.length?base.latestSessions:latestAmbiguous?[]:base.recentSessions,
    unknownGroup:{exercises:base.detailsAvailable?sum(unknown,'exercises'):null,primary:base.setsAvailable?sum(unknown,'primary'):null,extensions:base.setsAvailable?sum(unknown,'extensions'):null},
    groupRoles:{primary:null,secondary:null,note:'Grupos principais e secundários não foram informados de forma explícita. Os rótulos dos exercícios são preservados; não inferimos participação muscular.'},
    groupNote:'Séries principais e prolongamentos são contagens de séries, não papéis musculares. Grupos são os rótulos registrados nos exercícios; não representam volume fisiológico.',
    progression:{...progression,available,note:available?'Diferenças somente entre condições registradas comparáveis, até ontem. Não confirmam ganho de força, execução ou identidade física do aparelho.':'Detalhes de treino indisponíveis; nenhuma evolução numérica foi calculada.'},
    sessionComparison:{comparable:false,delta:null,note:'Contagens de sessões registradas em cada período. Não comprovam frequência real ou cobertura completa e não recebem uma diferença de desempenho.'},
    todaySessions:base.rows.filter(row=>row.date===calendar.today),
    todayNote:'Sessões registradas hoje podem aparecer na contagem parcial; hoje fica fora da evolução de cargas.',
    missingGroups:received.partial||detailPartial||rejectedSessions.length?[]:base.missingGroups,
    excludedSessions:rejectedSessions.map(item=>({date:item.date,workoutId:item.summary.workoutId,reasons:item.summary.reasons})),
    partial:received.partial||base.partial||detailPartial||rejectedSessions.length>0,
    status:base.available&&(received.partial||detailPartial||rejectedSessions.length)?'partial':base.status,
    notices:[...received.notices,...base.notices,...(latestAmbiguous?['O registro mais recente tem uma identidade ambígua; um treino anterior não é apresentado como o último.']:[]),...(rejectedSessions.length?['Sessões com identidade conflitante ficaram fora das contagens e dos detalhes.']:[]),...(detailPartial?['Detalhes ambíguos ficaram fora das contagens por grupo e da evolução.']:[])]};
}
function collectionsFor(rows){
  const dates=unique(rows.map(row=>recordedDay(row.collection_date))).filter(Boolean).sort();
  return dates.map(date=>({date,rows:rows.filter(row=>recordedDay(row.collection_date)===date)}));
}
function labsReport(data,status,ui,calendar){
  const selectedBounds=calendar.bounds;
  const result=laboratoryReport(data,status,selectedBounds,ui.reportLabMarker);
  const loaded=status.labs==='ready',rows=loaded?(data.labs||[]).filter(row=>inside(recordedDay(row.collection_date),selectedBounds)):[];
  const todayRows=loaded&&calendar.bounds.includesToday?rows.filter(row=>recordedDay(row.collection_date)===calendar.today):[];
  const collections=collectionsFor(rows),todayCollections=collectionsFor(todayRows);
  return {...result,status:loaded?(rows.length?'ready':'empty'):state(status,'labs'),count:loaded?rows.length:null,collectionCount:loaded?collections.length:null,collections,todayCollections,
    bounds:selectedBounds,note:'Exames seguem suas datas de coleta, sem meta de frequência semanal ou mensal. Não ter coleta no período não significa falta de cuidado. Comparações usam somente a coleta imediatamente anterior compatível, que pode estar fora do período. Coletas de hoje são resultados pontuais, com suas próprias datas; não são médias diárias nem mudanças da semana.'};
}
function protocolReport(data,status,calendar){
  const available=status.treatments==='ready',received=available?(data.treatments||[]).filter(row=>recordedDay(row.event_date)&&recordedDay(row.event_date)<=calendar.today):[],groups=new Map();
  for(const row of received){
    const key=text(row.source_record_id)||fingerprint([recordedDay(row.event_date),row.medication,row.source,row.local_time]);
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
  }
  const rows=[],ambiguous=[];
  for(const [key,list] of groups){
    const local=list.filter(row=>inside(recordedDay(row.event_date),calendar.bounds));
    if(!local.length)continue;
    if(new Set(list.map(fingerprint)).size>1||list.length>1&&!text(list[0].source_record_id)){ambiguous.push({key,count:local.length});continue;}
    rows.push({...local[0],date:recordedDay(local[0].event_date)});
  }
  rows.sort((a,b)=>a.date.localeCompare(b.date));
  return {available,status:!available?state(status,'treatments'):ambiguous.length?'partial':rows.length?'ready':'empty',rows,count:available?rows.length:null,ambiguousCount:available?ambiguous.reduce((sum,row)=>sum+row.count,0):null,
    note:'Eventos documentados apenas como contexto temporal. Não confirmam uso atual ou adesão, não orientam dose e não explicam causalmente mudanças em alimentação, treino ou exames.'};
}
function summaryFor(calendar,metrics,training,labs){
  const observed=metrics.filter(metric=>metric.count>0),comparable=metrics.filter(metric=>metric.comparison.comparable);
  const items=[calendar.partial?'Período ainda aberto: médias só dos dias encerrados. Os valores de hoje aparecem separados.':'Período de calendário encerrado. As médias descrevem somente os dias que têm valores válidos.'];
  items.push(training.sessions==null?'Treinos indisponíveis nesta atualização.':`${training.sessions} ${training.sessions===1?'sessão registrada':'sessões registradas'} no período; ausência de registro não comprova descanso.`);
  const changed=comparable.filter(metric=>metric.comparison.delta!==0),highlights=(changed.length?changed:comparable).slice(0,2);
  const format=(value,unit)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:unit==='passos'?0:1}).format(value);
  if(highlights.length)items.push(`${highlights.map(metric=>`${metric.label}: média registrada de ${format(metric.comparison.previous,metric.unit)} para ${format(metric.comparison.current,metric.unit)} ${metric.unit}`).join('; ')} nos dias equivalentes dos dois períodos. São diferenças descritivas, sem classificação de melhora ou piora.`);
  else items.push('Ainda não há base suficiente para comparar as médias diárias: são necessários a mesma origem, dias equivalentes e registros suficientes nos dois períodos.');
  const limited=metrics.filter(metric=>metric.expectedDays>0&&metric.count<metric.expectedDays).sort((a,b)=>a.count/a.expectedDays-b.count/b.expectedDays)[0];
  if(!observed.length)items.push('Não há valores diários válidos nas origens selecionadas para este período.');
  else if(limited)items.push(`${limited.label}: ${limited.count}/${limited.expectedDays} dias encerrados com valor. A falta de registro limita a leitura e não significa zero.`);
  if(labs.available)items.push(labs.collectionCount?`${labs.collectionCount} ${labs.collectionCount===1?'data de coleta no período':'datas de coleta no período'}. Exames são lidos pela data e pelo contexto de cada laudo.`:'Sem coleta neste período; exames não precisam seguir uma cadência semanal ou mensal.');
  return {headline:`Como foi ${calendar.mode==='week'?'sua semana':'seu mês'}${calendar.partial?' até agora':''}`,items};
}

/** Same inputs as healthDashboardModel, with independent calendarReport* UI.
 * Full-period means stay intact. Only .comparison uses equal closed prefixes.
 * Existing origin, duplicate, reviewed-source and 5-day/70% rules are reused.
 * This model never writes to or substitutes the user's dashboard selection. */
export function calendarReport(data={},status={},ui={},today){
  const calendar=calendarReportCalendar(ui,today),fullUI=explicitUI(ui,calendar.bounds);
  const dashboard=healthDashboardModel(data,status,fullUI,calendar.today);
  const comparison=calendar.comparisonDays?healthDashboardModel(data,status,explicitUI(ui,calendar.comparisonBounds,calendar.previousComparisonBounds),calendar.today):null;
  const metrics=keys.map(key=>{
    const metric=dashboard.metricsByKey[key],compared=comparison?.metricsByKey[key].comparison||{...metric.comparison,reason:'no_closed_days'};
    return {...metric,comparison:{...compared,note:calendar.comparisonNote,fullPeriodMean:metric.value,fullPeriodDays:metric.count,commonPrefixDays:calendar.comparisonDays},
      coverage:metric.expectedDays?metric.count/metric.expectedDays:null,
      lastObservedOutsidePeriod:Boolean(metric.lastObservedDate&&!inside(metric.lastObservedDate,calendar.bounds))};
  });
  const todayMetrics=calendar.bounds.includesToday?keys.map(key=>dashboard.todayMetrics.find(metric=>metric.key===key)):[];
  const training=trainingReport(data,status,calendar),labs=labsReport(data,status,ui,calendar),protocol=protocolReport(data,status,calendar);
  const nutritionPlan=nutritionPlanComparison(data,status,fullUI,calendar.today);
  const notes=[calendar.comparisonNote,'Diferenças só aparecem com a mesma medida, origem e unidade, nos mesmos dias relativos dos dois períodos: pelo menos 5 dias e 70% dos dias em cada um. Hoje, registros incompletos e dias com valores conflitantes ficam fora.',
    'Ausência não significa zero. Dias com registros não comprovam diário completo. Duplicatas ambíguas e dias sabidamente parciais ficam fora das médias.',
    'A origem escolhida é mantida entre períodos; origens e dispositivos não são somados. Quando a origem ainda precisa de revisão, essa informação permanece visível.',
    'Somente referências alimentares documentadas são exibidas. Data de recebimento não confirma vigência, início de uso ou adesão. Retrospectivas exigem escolha explícita e ficam rotuladas.',
    'Energia ativa não é gasto total. Não calculamos balanço energético a partir dela.',protocol.note];
  if(calendar.selectionNotice)notes.unshift(calendar.selectionNotice);
  return {schemaVersion:1,calendar,today:calendar.today,bounds:calendar.bounds,previousBounds:calendar.previousBounds,metrics,metricsByKey:Object.fromEntries(metrics.map(metric=>[metric.key,metric])),todayMetrics,
    training,labs,protocol,nutritionPlan,summary:summaryFor(calendar,metrics,training,labs),notes,comparisonRule:healthDashboardComparisonRule,
    sourceSelectionRule:dashboard.sourceSelectionRule};
}
