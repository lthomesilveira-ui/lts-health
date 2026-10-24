import {homePeriodSnapshot} from './home-period-model.js';
import {nutritionSourceReview} from './nutrition-source-review.js';
import {stepCountReview,stepEvidence} from './steps-evidence.js';

// Pure presentation model. No ingestion, database, browser or global UI state.
const DAY=86400000;
const norm=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const scalar=value=>value==null||!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0?null:Number(value);
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const dayOf=value=>{
  const text=String(value??'');
  if(!/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(text))return null;
  const date=text.slice(0,10),parsed=new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:null;
};
const todayInSaoPaulo=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const addDays=(date,amount)=>new Date(Date.parse(`${date}T12:00:00Z`)+amount*DAY).toISOString().slice(0,10);
const dayCount=(start,end)=>start>end?0:Math.round((Date.parse(`${end}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/DAY)+1;
const datesIn=bounds=>Array.from({length:bounds.days},(_,index)=>addDays(bounds.start,index));
const inside=(date,bounds)=>date>=bounds.start&&date<=bounds.end;
const ready=(status,domain)=>status?.[domain]==='ready';
const group=(rows,key)=>{const map=new Map();for(const row of rows){const id=key(row);if(!map.has(id))map.set(id,[]);map.get(id).push(row);}return map;};
const boundsFor=(start,end,today)=>({start,end,days:dayCount(start,end),closedEnd:end<today?end:addDays(today,-1),closedDays:dayCount(start,end<today?end:addDays(today,-1)),includesToday:start<=today&&end>=today});
const definitions=Object.freeze([
  {key:'water',label:'Água',unit:'mL',domains:['nutrition','sourceMetrics'],field:'water_ml',types:['dietary_water_ml'],units:['ml']},
  {key:'protein',label:'Proteína',unit:'g',domains:['nutrition','sourceMetrics'],field:'protein_g',types:['dietary_protein_g'],units:['g']},
  {key:'energy',label:'Energia ingerida',unit:'kcal',domains:['nutrition','sourceMetrics'],field:'calories_kcal',types:['dietary_energy_kcal'],units:['kcal']},
  {key:'activeEnergy',label:'Calorias ativas gastas',unit:'kcal',domains:['metrics','sourceMetrics'],types:['active_energy_kcal'],units:['kcal']},
  {key:'totalEnergy',label:'Calorias totais gastas',unit:'kcal',domains:['metrics','sourceMetrics'],types:['total_energy_kcal','total_energy_burned_kcal'],units:['kcal']},
  {key:'steps',label:'Passos',unit:'passos',domains:['metrics','sourceMetrics'],types:['steps','step_count'],units:['count','steps','passos']},
  {key:'sleep',label:'Sono',unit:'h',domains:['metrics','sourceMetrics'],types:['sleep_duration_h'],units:['h'],maximum:24}
]);
export const healthDashboardComparisonRule=Object.freeze({
  minimumDays:5,minimumCoverage:.7,matchingPositions:true,
  description:'Médias observadas da mesma variável, origem e unidade, com valores elegíveis nas mesmas posições relativas das duas janelas, ao menos 5 dias e 70% de cobertura em cada janela. Hoje, dias sabidamente parciais e duplicatas ambíguas são excluídos. Comparação descritiva; não comprova diário completo.'
});

function subtractMonths(date,months){
  const [year,month,day]=date.split('-').map(Number),first=new Date(Date.UTC(year,month-1-months,1,12));
  const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0,12)).getUTCDate();
  first.setUTCDate(Math.min(day,last));return first.toISOString().slice(0,10);
}
function allDates(data,status,today){
  return [['body','measured_at'],['nutrition','nutrition_date'],['metrics','measured_at'],['sourceMetrics','metric_date'],['workouts','workout_date'],['labs','collection_date'],['treatments','event_date'],['polarSessions','workout_date']]
    .flatMap(([domain,field])=>ready(status,domain)?(data[domain]||[]).map(row=>dayOf(row[field])).filter(date=>date&&date<today):[]).sort();
}
/** N complete days end yesterday. Calendar-month windows start on the clamped
 * anniversary of today; preceding windows have equal actual day counts. */
export function healthDashboardCalendar(data={},status={},ui={},today=todayInSaoPaulo()){
  today=dayOf(today);if(!today)throw new RangeError('today must be a valid local calendar date');
  // Calendar reports supply their own bounded, explicit calendar. Recompute
  // all derived counts; caller-provided coverage or flags are never trusted.
  // This branch is opt-in and leaves every existing dashboard window unchanged.
  if(ui.dashboardCalendar!==undefined){
    const explicit=ui.dashboardCalendar;
    const validate=(value,name)=>{
      const start=typeof value?.start==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.start)?dayOf(value.start):null;
      const end=typeof value?.end==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.end)?dayOf(value.end):null;
      if(!start||!end||start>end||end>today)throw new RangeError(`Invalid explicit ${name} calendar bounds`);
      return boundsFor(start,end,today);
    };
    const bounds=validate(explicit?.bounds,'current');
    const previousBounds=explicit.previousBounds==null?null:validate(explicit.previousBounds,'previous');
    if(previousBounds&&(previousBounds.end>=bounds.start||previousBounds.closedDays!==bounds.closedDays))throw new RangeError('Explicit comparison windows must be disjoint and have equal closed day counts');
    return {mode:'period',period:'calendar',date:today,today,emptyHistory:false,bounds,previousBounds,periodBounds:bounds,periodPreviousBounds:previousBounds};
  }
  const mode=ui.dashboardMode==='day'?'day':'period';
  const period=['7','30','60','90','6m','1y','all'].includes(String(ui.dashboardPeriod))?String(ui.dashboardPeriod):'7';
  const requestedDate=dayOf(ui.dashboardDate),date=requestedDate&&requestedDate<=today?requestedDate:today;
  const end=addDays(today,-1),history=period==='all'?allDates(data,status,today):[];
  // Keep an empty history renderable without inventing an observed date.
  // Yesterday is only a valid placeholder boundary, explicitly flagged below.
  const emptyHistory=period==='all'&&history.length===0;
  const start=period==='all'?history[0]||end:period==='6m'?subtractMonths(today,6):period==='1y'?subtractMonths(today,12):addDays(today,-Number(period));
  const periodBounds={...boundsFor(start,end,today),...(emptyHistory?{emptyHistory:true}:{})};
  const periodPreviousBounds=period==='all'?null:boundsFor(addDays(start,-periodBounds.days),addDays(start,-1),today);
  return {mode,period,date,today,emptyHistory,bounds:mode==='day'?boundsFor(date,date,today):periodBounds,previousBounds:mode==='day'?null:periodPreviousBounds,periodBounds,periodPreviousBounds};
}
function partialFlag(row){
  return row?.partial===true||row?.knownPartial===true||row?.known_partial===true||row?.is_partial===true||row?.excludeFromClosedMeans===true||row?.source_payload?.partial===true||row?.source_payload?.knownPartial===true;
}
function observationsFor(definition,data,status,today){
  const observations=[];let invalidRows=0,unknownRows=0;
  for(const domain of definition.domains){
    if(!ready(status,domain))continue;
    for(const row of data[domain]||[]){
      const date=dayOf(domain==='nutrition'?row.nutrition_date:domain==='metrics'?row.measured_at:row.metric_date);
      if(!date||date>today)continue;
      if(domain!=='nutrition'&&!definition.types.includes(row.metric_type))continue;
      if(domain==='nutrition'&&!Object.hasOwn(row,definition.field))continue;
      const statusName=domain==='sourceMetrics'?norm(row.canonical_status):'canonical';
      if(!['canonical','candidate','held'].includes(statusName))continue;
      const label=String((domain==='nutrition'?row.source:row.source_name||row.source)||'').trim();
      if(!label){unknownRows++;continue;}
      const unit=domain==='nutrition'?definition.units[0]:norm(row.unit);
      if(!definition.units.includes(unit)){invalidRows++;continue;}
      const raw=domain==='nutrition'?row[definition.field]:row.value;
      const steps=definition.key==='steps'?stepCountReview(raw):null;
      let value=steps?steps.value:scalar(raw);if(definition.maximum!=null&&value>definition.maximum)value=null;
      if(raw!=null&&value==null)invalidRows++;
      const review=domain==='sourceMetrics'&&['protein','energy'].includes(definition.key)?nutritionSourceReview(row):null;
      const family=row.source_family||null;
      const key=domain==='nutrition'?JSON.stringify(['nutrition',norm(label),'canonical',...(definition.key==='water'?['ml']:[])]):
        ['protein','energy'].includes(definition.key)?JSON.stringify([domain,norm(family),norm(label),statusName,...(review?.verified?[review.sourceHash]:[])]):
          JSON.stringify([domain,norm(family),norm(label),statusName,unit]);
      const knownPartial=partialFlag(row)||Boolean(review?.partial);
      observations.push({date,value,key,label,domain,status:statusName,unit,displayUnit:definition.unit,sourceFamily:family,
        receivedValue:steps?.receivedValue??value,receivedRaw:steps?.receivedRaw??value,stepReviewReason:steps?.reason||null,receivedAt:row.updated_at||null,
        unresolvedOverlap:definition.key==='steps'&&label.includes('|'),partial:knownPartial||date===today,knownPartial,excludeFromClosedMeans:knownPartial||Boolean(review?.excludeFromClosedMeans),
        reviewVerified:Boolean(review?.verified),reviewInvalid:review?.state==='review_invalid',exportedAt:review?.exportedAt||null});
    }
  }
  return {observations,invalidRows,unknownRows};
}
function sourceCatalog(observations,today){
  return [...group(observations,row=>row.key)].map(([key,items])=>{
    const first=items[0];
    const rows=[...group(items,row=>row.date)].map(([date,list])=>{
      const numeric=list.filter(row=>row.value!=null),ambiguous=list.length>1;
      // Even identical same-day repeats are withheld: these could be repeated
      // imports or different device totals, never additive samples.
      const unresolvedOverlap=list.some(row=>row.unresolvedOverlap),rawValue=ambiguous?null:numeric[0]?.value??null;
      // The received daily quantity is displayed as a candidate observation.
      // Unknown upstream device overlap blocks comparisons, not the raw value.
      const value=rawValue;
      const knownPartial=list.some(row=>row.knownPartial),reviewInvalid=list.some(row=>row.reviewInvalid);
      // Preserve every received observation for inspection, including equal or
      // conflicting duplicates. A withheld aggregate never destroys evidence.
      const observations=list.map(row=>({date:row.date,value:row.value,receivedValue:row.receivedValue,receivedRaw:row.receivedRaw,stepReviewReason:row.stepReviewReason,receivedAt:row.receivedAt,source:key,label:row.label,sourceLabel:row.label,unit:row.unit,displayUnit:row.displayUnit,
        sourceStatus:row.status,sourceFamily:row.sourceFamily,partial:row.partial,knownPartial:row.knownPartial,ambiguous,reviewInvalid:row.reviewInvalid,
        eligible:!ambiguous&&row.value!=null&&row.date<today&&!row.excludeFromClosedMeans}));
      return {date,value,rawValue,rawValues:observations.map(row=>row.value),observations,unresolvedOverlap,unit:first.unit,displayUnit:first.displayUnit,source:key,sourceLabel:first.label,sourceStatus:first.status,sourceFamily:first.sourceFamily,
        cohort:key,context:first.label,open:date===today,partial:knownPartial||date===today,knownPartial,ambiguous,duplicateCount:ambiguous?list.length:0,extraDuplicateCount:ambiguous?list.length-1:0,
        stepReviewReason:list.find(row=>row.stepReviewReason)?.stepReviewReason||null,receivedAt:list.find(row=>row.receivedAt)?.receivedAt||null,
        reviewInvalid,reviewVerified:list.every(row=>row.reviewVerified),exportedAt:list.find(row=>row.exportedAt)?.exportedAt||null,
        excludeFromClosedMeans:list.some(row=>row.excludeFromClosedMeans),eligible:value!=null&&date<today&&!list.some(row=>row.excludeFromClosedMeans)};
    }).sort((a,b)=>a.date.localeCompare(b.date));
    return {key,label:first.label,domain:first.domain,status:first.status,unit:first.unit,displayUnit:first.displayUnit,sourceFamily:first.sourceFamily,rows,
      latest:rows.filter(row=>row.value!=null).at(-1)||null,lastDate:rows.filter(row=>row.value!=null).at(-1)?.date||null,lastReceivedDate:rows.at(-1)?.date||null,
      lastReportedDate:rows.filter(row=>row.rawValue!=null||row.stepReviewReason&&row.observations.some(observation=>observation.receivedValue!=null)).at(-1)?.date||null,unresolvedOverlap:rows.some(row=>row.unresolvedOverlap)};
  }).sort((a,b)=>a.key.localeCompare(b.key));
}
function requestedSource(definition,ui){
  const requested=ui.dashboardSources?.[definition.key];if(requested)return typeof requested==='object'?requested.key:requested;
  if(['protein','energy'].includes(definition.key))return ui.homeNutritionSource||ui.reportNutritionSource||null;
  if(definition.key==='water')return ui.homeWaterSource||ui.reviewWaterSource||null;
  if(definition.key==='sleep')return ui.homeSleepSource||ui.reviewSleepSource||null;
  return null;
}
function selectSource(sources,requested){
  if(requested){
    const exact=sources.find(source=>source.key===requested);if(exact)return exact;
    const labelMatches=sources.filter(source=>norm(source.label)===norm(requested));return labelMatches.length===1?labelMatches[0]:null;
  }
  // Stable over all loaded history, not the selected interval. Prefer the most
  // recently observed origin, retaining candidate/held status. Never pool devices.
  const rank={canonical:0,candidate:1,held:2};
  return sources.slice().sort((a,b)=>(b.lastReportedDate||'').localeCompare(a.lastReportedDate||'')||rank[a.status]-rank[b.status]||b.rows.filter(row=>row.eligible).length-a.rows.filter(row=>row.eligible).length||a.key.localeCompare(b.key))[0]||null;
}
function pointsFor(source,bounds,today){
  const byDate=new Map((source?.rows||[]).map(row=>[row.date,row]));
  return datesIn(bounds).map(date=>byDate.get(date)||{date,value:null,rawValue:null,rawValues:[],observations:[],unit:source?.unit||null,displayUnit:source?.displayUnit||null,source:source?.key||null,sourceLabel:source?.label||null,
    sourceStatus:source?.status||null,sourceFamily:source?.sourceFamily||null,cohort:source?.key||null,context:source?.label||null,
    open:date===today,partial:date===today,knownPartial:false,ambiguous:false,duplicateCount:0,extraDuplicateCount:0,eligible:false,missing:true});
}
function duplicateStats(points){
  return {ambiguousDays:points.filter(point=>point.ambiguous).length,duplicateCount:points.reduce((sum,point)=>sum+(point.duplicateCount||0),0),extraDuplicateCount:points.reduce((sum,point)=>sum+(point.extraDuplicateCount||0),0)};
}
function availabilityFor(definition,status,count,points){
  const available=definition.domains.filter(domain=>ready(status,domain));
  if(!available.length)return definition.domains.some(domain=>status?.[domain]==='error')?'error':'unavailable';
  if(available.length<definition.domains.length||points.some(point=>point.knownPartial||point.ambiguous||point.reviewInvalid||point.stepReviewReason||point.unresolvedOverlap))return 'partial';
  return count?'ready':'empty';
}
function compare(source,points,previousBounds,bounds,status,definition,today,mode){
  const currentPoints=points.filter(point=>point.eligible),previousPoints=previousBounds?pointsFor(source,previousBounds,today).filter(point=>point.eligible):[];
  const current=mean(currentPoints.map(point=>point.value)),previous=mean(previousPoints.map(point=>point.value));
  const offsets=(rows,b)=>rows.map(row=>dayCount(b.start,row.date)-1).join(',');
  const samePositions=Boolean(previousBounds)&&offsets(currentPoints,bounds)===offsets(previousPoints,previousBounds);
  const currentCoverage=bounds.closedDays?currentPoints.length/bounds.closedDays:null,previousCoverage=previousBounds?.closedDays?previousPoints.length/previousBounds.closedDays:null;
  const enough=currentPoints.length>=healthDashboardComparisonRule.minimumDays&&previousPoints.length>=healthDashboardComparisonRule.minimumDays&&currentCoverage>=healthDashboardComparisonRule.minimumCoverage&&previousCoverage>=healthDashboardComparisonRule.minimumCoverage;
  const reason=mode==='day'?'day_view':!previousBounds?'history_has_no_previous':!source?'no_source':source.unresolvedOverlap?'overlap_unresolved':!definition.domains.every(domain=>ready(status,domain))?'partial_sources':!currentPoints.length||!previousPoints.length?'missing_observations':!samePositions?'different_coverage_positions':!enough?'insufficient_coverage':'comparable';
  const comparable=reason==='comparable';
  return {comparable,reason,source:source?.key||null,sourceLabel:source?.label||null,unit:source?.unit||definition.unit,aggregation:'observed_mean',current,previous,
    delta:comparable?current-previous:null,percentChange:comparable&&previous!==0?(current-previous)/previous*100:null,
    currentDays:currentPoints.length,previousDays:previousPoints.length,currentCoverage,previousCoverage,samePositions,
    currentBounds:bounds,previousBounds,rule:healthDashboardComparisonRule};
}
function makeMetric(definition,catalog,status,ui,calendar,bounds=calendar.bounds,mode=calendar.mode){
  const {today}=calendar,{sources,invalidRows,unknownRows}=catalog,requested=requestedSource(definition,ui),source=selectSource(sources,requested);
  const points=pointsFor(source,bounds,today),eligible=points.filter(point=>point.eligible),observed=points.filter(point=>point.value!=null);
  const dayPoint=mode==='day'?points[0]:null,value=mode==='day'?dayPoint?.value??null:mean(eligible.map(point=>point.value));
  const count=mode==='day'?(value!=null?1:0):eligible.length,expectedDays=mode==='day'?1:bounds.closedDays;
  const todayPoint=source?.rows.find(row=>row.date===today)||null;
  return {key:definition.key,label:definition.label,unit:definition.unit,value,count,expectedDays,
    stepEvidence:definition.key==='steps'?stepEvidence(sources,bounds,today):null,aggregation:mode==='day'?'recorded_day':'observed_mean',
    source:source?{key:source.key,label:source.label,domain:source.domain,status:source.status,unit:source.unit,displayUnit:source.displayUnit,sourceFamily:source.sourceFamily}:null,
    sources:sources.map(item=>{const ps=pointsFor(item,bounds,today),good=ps.filter(point=>point.eligible);return {key:item.key,label:item.label,domain:item.domain,status:item.status,unit:item.unit,displayUnit:item.displayUnit,sourceFamily:item.sourceFamily,count:good.length,mean:mean(good.map(point=>point.value)),lastDate:item.lastDate,lastReceivedDate:item.lastReceivedDate,lastReportedDate:item.lastReportedDate,unresolvedOverlap:item.unresolvedOverlap,...duplicateStats(ps),points:ps};}),
    points,...duplicateStats(points),lastDate:observed.at(-1)?.date||null,lastObservedDate:source?.lastDate||null,lastReceivedDate:source?.lastReceivedDate||null,todayValue:todayPoint?.value??null,todayPoint,
    partial:mode==='day'?Boolean(dayPoint?.partial):points.some(point=>point.knownPartial),knownPartial:points.some(point=>point.knownPartial),
    comparison:compare(source,points,mode==='day'?null:calendar.previousBounds,bounds,status,definition,today,mode),
    availability:availabilityFor(definition,status,count,points),available:definition.domains.some(domain=>ready(status,domain)),invalidRows,unknownRows,
    unresolvedOverlap:Boolean(source?.unresolvedOverlap),warning:source?.unresolvedOverlap?'Valor diário recebido; deduplicação entre dispositivos não confirmada. Comparação suspensa.':null,
    requestedSource:requested,requestedSourceMissing:Boolean(requested&&!source),
    coverageLabel:`${count}/${expectedDays} ${mode==='day'?'dia com valor':'dias encerrados com valor'}`,
    note:definition.key==='totalEnergy'?'Somente total diário explicitamente registrado. Energia ativa e basal não são somadas aqui.':definition.key==='activeEnergy'?'Energia ativa registrada; não representa o gasto energético total.':'Ausência não significa zero. Dias registrados não comprovam diário completo.'};
}

/** Main public model: all seven metrics use one explicit calendar, separate
 * source identities, daily gaps and strictly matched descriptive comparisons. */
export function healthDashboardModel(data={},status={},ui={},today=todayInSaoPaulo()){
  const calendar=healthDashboardCalendar(data,status,ui,today);
  const catalogs=new Map(definitions.map(definition=>{const collected=observationsFor(definition,data,status,calendar.today);return [definition.key,{...collected,sources:sourceCatalog(collected.observations,calendar.today)}];}));
  const metrics=definitions.map(definition=>makeMetric(definition,catalogs.get(definition.key),status,ui,calendar));
  const dayBounds=boundsFor(calendar.date,calendar.date,calendar.today),todayBounds=boundsFor(calendar.today,calendar.today,calendar.today);
  const dayMetrics=definitions.map(definition=>makeMetric(definition,catalogs.get(definition.key),status,ui,calendar,dayBounds,'day'));
  const todayMetrics=definitions.map(definition=>makeMetric(definition,catalogs.get(definition.key),status,ui,calendar,todayBounds,'day'));
  const find=key=>metrics.find(metric=>metric.key===key);
  const snapshotUI={...ui,homeNutritionSource:find('protein').source?.key||find('energy').source?.key||requestedSource(definitions[1],ui),homeWaterSource:find('water').source?.key||requestedSource(definitions[0],ui),homeSleepSource:find('sleep').source?.key||requestedSource(definitions[6],ui)};
  const snapshot=homePeriodSnapshot(data,status,calendar.bounds,snapshotUI,calendar.today,calendar.previousBounds);
  // Legacy renderers can consume body/training/labs unchanged. Dashboard metric
  // cards and daily tables consume metrics/day.metrics, including all gaps.
  snapshot.nutrition.comparison.protein_g=find('protein').comparison;
  snapshot.nutrition.comparison.calories_kcal=find('energy').comparison;
  snapshot.sleep.comparison=find('sleep').comparison;snapshot.water.comparison=find('water').comparison;
  return {...calendar,label:calendar.mode==='day'?(calendar.date===calendar.today?'Hoje · parcial':calendar.date):calendar.emptyHistory?'Sem histórico encerrado':calendar.period==='all'?'Todo o histórico':calendar.period==='6m'?'6 meses':calendar.period==='1y'?'1 ano':`${calendar.period} dias`,
    snapshot,metrics,metricsByKey:Object.fromEntries(metrics.map(metric=>[metric.key,metric])),todayMetrics,
    day:{date:calendar.date,today:calendar.today,isToday:calendar.date===calendar.today,partial:calendar.date===calendar.today||dayMetrics.some(metric=>metric.knownPartial),bounds:dayBounds,metrics:dayMetrics},
    comparisonRule:healthDashboardComparisonRule,sourceSelectionRule:'Escolha explícita é preservada. Padrão: origem mais recente em todo o histórico carregado, preservando o status candidato ou em revisão, e desempate estável. Trocar a janela não troca a origem.',
    note:calendar.emptyHistory?'Nenhum registro encerrado recebido. A data de ontem é apenas um limite de calendário para a janela vazia; não representa um dia observado. Hoje, se houver registro, aparece separado.':'Médias observadas de dias encerrados, com n/N por variável. Hoje é parcial e aparece separado. Fontes e dispositivos não são somados; lacunas permanecem sem valor.'};
}
