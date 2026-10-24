// Read-only findings for the isolated study. Inputs are a selected Home snapshot
// and its source records. No UI mutation, I/O, goals, clinical ranking or causes.
import {homeUsefulContent} from './home-useful-content.js';
import {bodyIntervalModel} from './body-interval-model.js';
import {homeLabHistory} from './home-lab-history.js';
import {trainingComparability} from './training-comparability.js';

const DAY=86400000;
const norm=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
const number=value=>value==null||typeof value==='boolean'||String(value).trim()===''||!Number.isFinite(Number(value))?null:Number(value);
const nonnegative=value=>number(value)!=null&&number(value)>=0?number(value):null;
const day=value=>{const text=String(value??'');if(!/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(text))return null;const date=text.slice(0,10),parsed=new Date(`${date}T12:00:00Z`);return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:null;};
const addDays=(date,count)=>new Date(Date.parse(`${date}T12:00:00Z`)+count*DAY).toISOString().slice(0,10);
const dateLabel=date=>date?date.split('-').reverse().join('/'):'sem data';
const format=(value,digits=10)=>number(value)==null?'Sem valor':number(value).toLocaleString('pt-BR',{maximumFractionDigits:digits});
const delta=(first,last)=>number(first)==null||number(last)==null?null:Number((number(last)-number(first)).toFixed(10));
const unique=values=>[...new Set(values)];
const inside=(date,bounds)=>Boolean(date&&bounds?.start&&bounds?.end&&date>=bounds.start&&date<=bounds.end);
const dates=(start,end)=>({start,end,label:start===end?dateLabel(start):`${dateLabel(start)} a ${dateLabel(end)}`});
const foodFields=['calories_kcal','protein_g','carbs_g','fat_g','fiber_g'];
const sourceKey=row=>JSON.stringify([norm(row.source),norm(row.device_name)]);
const knownLabel=value=>Boolean(norm(value)&&!['unknown','not informed','nao informado','desconhecido','n/a','na','—','-'].includes(norm(value)));
export const labComparable=candidate=>Boolean(candidate?.comparable&&knownLabel(candidate.previous?.laboratory)&&norm(candidate.previous.laboratory)===norm(candidate.row.laboratory)&&String(candidate.previous.unit).trim()===String(candidate.row.unit).trim()&&knownLabel(candidate.previous.method)&&knownLabel(candidate.row.method)&&norm(candidate.previous.method)===norm(candidate.row.method));
const carryKeys=['homeBodySource','reportBodySource','homeNutritionSource','reportNutritionSource','homeTrainingContext','homeLabKey'];

function actionContext(m,ui){
 const context={homePeriod:m.period};
 for(const key of carryKeys)if(ui[key]!=null&&ui[key]!=='')context[key]=ui[key];
 // The selected source may be the initial deterministic choice, rather than an
 // explicit UI value. Carry its exact identity; never replace it by its label.
 if(m.nutrition?.source?.key&&!context.homeNutritionSource&&!context.reportNutritionSource)context.reportNutritionSource=m.nutrition.source.key;
 return context;
}
function bodyAction(m,ui,b,label){
 return {kind:b.pair?'body_interval':'route',label,route:b.pair?'analise':'bio',start:b.first?.date||b.latest?.date||null,end:b.latest?.date||null,
  context:{...actionContext(m,ui),...(b.pair?{bodyIntervalStart:b.first.date,bodyIntervalEnd:b.latest.date}:{})}};
}
function bodyFinding(b,m,ui){
 if(!b?.available||!b.latest)return null;
 const metrics=Object.values(b.metrics||{}),pairMetrics=b.pair?metrics.filter(metric=>metric.hasPair&&nonnegative(metric.first)!=null&&nonnegative(metric.latest)!=null&&metric.firstDate===b.first.date&&metric.lastDate===b.latest.date):[];
 const latestMetrics=metrics.filter(metric=>nonnegative(metric.latest)!=null&&metric.lastDate===b.latest.date);
 if(!pairMetrics.length&&!latestMetrics.length)return null;
 const reading=metric=>{const change=delta(metric.first,metric.latest);return change===0?`${metric.label} se manteve em ${format(metric.latest)} ${metric.unit}`:`${metric.label} ${change<0?'caiu':'subiu'} ${format(Math.abs(change))} ${metric.unit}`;};
 const text=pairMetrics.length?pairMetrics.map(reading).join('; ')+'.':`Em ${dateLabel(b.latest.date)}: ${latestMetrics.map(metric=>`${metric.label.toLowerCase()} ${format(metric.latest)} ${metric.unit}`).join('; ')}.`;
 const limits=['Condições das avaliações não confirmadas. Estimativas de composição não comprovam mudança de tecido.'];
 if(b.ambiguousDates?.length)limits.push(`${b.ambiguousDates.length} data(s) com avaliações ambíguas ficaram fora da comparação.`);
 if(b.pair&&!pairMetrics.length)limits.push('Não há variável com valores nas duas avaliações; apenas o registro final é descrito.');
 return {id:'body',family:'body',title:pairMetrics.length>1?'Peso e composição no mesmo intervalo':pairMetrics.length?'Entre as avaliações':'Avaliação disponível',text,
  dates:dates(pairMetrics.length?b.first.date:b.latest.date,b.latest.date),action:bodyAction(m,ui,b,b.pair?'Conferir avaliações e rotina':'Conferir avaliação'),limits,
  evidence:{kind:pairMetrics.length?'recorded_body_difference':'single_body_observation',metrics:pairMetrics.length?pairMetrics:latestMetrics,first:b.first,latest:b.latest,
   sourceRecordIds:b.sourceRecordIds||[],sourceContext:b.context,ambiguousDates:b.ambiguousDates||[],conditionsConfirmed:false,jointMetrics:pairMetrics.length>1}};
}
function intervalFor(data,status,m,ui,b){
 if(!b?.pair||!b.first?.date||!b.latest?.date)return null;
 const selectedSource=ui.homeBodySource||ui.reportBodySource;
 const rows=(m.body?.rows||data.body||[]).filter(row=>inside(day(row.date||row.measured_at),m.bounds)&&(!selectedSource||selectedSource==='all'||sourceKey(row)===selectedSource)).map(row=>({...row,measured_at:row.measured_at||row.date}));
 const interval=bodyIntervalModel({...data,body:rows},status,{...ui,bodyIntervalStart:b.first.date,bodyIntervalEnd:b.latest.date},m.today);
 return interval.available?interval:null;
}
function sourceNutrition(source,today){
 const rows=(source.rows||[]).filter(row=>day(row.date)&&row.date<today&&!row.open&&!row.knownPartial&&!row.excludeFromClosedMeans);
 const byDate=new Map();for(const row of rows){if(!byDate.has(row.date))byDate.set(row.date,[]);byDate.get(row.date).push(row);}
 const eligible=[...byDate.values()].filter(list=>list.length===1).map(([row])=>row);
 const metrics=Object.fromEntries(foodFields.map(field=>{const samples=eligible.filter(row=>nonnegative(row[field])!=null).map(row=>({date:row.date,value:nonnegative(row[field])})).sort((a,b)=>a.date.localeCompare(b.date));return [field,{count:samples.length,mean:samples.length?samples.reduce((sum,row)=>sum+row.value,0)/samples.length:null,samples}];}));
 const observedDates=unique(eligible.filter(row=>foodFields.some(field=>nonnegative(row[field])!=null)).map(row=>row.date)).sort();
 return {key:source.key,label:source.label,status:source.status,reviewVerified:Boolean(source.reviewVerified),metrics,dates:observedDates,days:observedDates.length,
  firstDate:observedDates[0]||null,lastDate:observedDates.at(-1)||null,receivedDays:source.recordedDays,openDays:source.openDays,
  partialDays:(source.rows||[]).filter(row=>row.knownPartial||row.excludeFromClosedMeans).length,ambiguousDays:source.ambiguousDays||0,pooledMean:null};
}
function trainingWindows(training,bounds){
 const size=Math.floor(bounds.days/2);
 if(!training.available||size<1)return null;
 const earlier={start:bounds.start,end:addDays(bounds.start,size-1),days:size},later={start:addDays(bounds.end,1-size),end:bounds.end,days:size};
 const summarize=window=>{const rows=training.rows.filter(row=>inside(day(row.workout_date),window)),ids=new Set(rows.map(row=>row.source_record_id).filter(Boolean));
  return {...window,sessions:rows.length,recordedDays:unique(rows.map(row=>day(row.workout_date))).length,
   groups:(training.groupRows||[]).map(group=>({label:group.label,sessions:new Set((group.rows||[]).filter(row=>ids.has(row.workout_source_record_id)).map(row=>row.workout_source_record_id)).size,denominator:rows.length})).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'))};};
 return {earlier:summarize(earlier),later:summarize(later),omittedMiddleDays:bounds.days-2*size,denominator:'recorded_sessions_in_each_equal_calendar_window',coverageEstablished:false,
  note:'Janelas com igual número de dias. Grupos podem compartilhar a mesma sessão; contagens não demonstram frequência real ou aderência.'};
}
function trainingSupport(data,status,interval,today){
 if(!interval.training.detailsAvailable)return {available:false,exercises:[],pairs:[],allPairs:[],history:[],strictDocumentaryPairs:0};
 const comparison=trainingComparability(data,{bounds:interval.interval,today});
 const pairs=comparison.observed.map(cohort=>{const first=cohort.points[0],latest=cohort.points.at(-1),strict=comparison.comparable.find(candidate=>candidate.records.some(record=>cohort.records.includes(record))&&candidate.firstDate===first.date&&candidate.lastDate===latest.date);
  return {key:cohort.key,exercise:cohort.exercise,machine:cohort.machine,location:cohort.location,unit:cohort.unit,reps:cohort.reps,first,latest,delta:delta(first.value,latest.value),dates:cohort.points.map(point=>point.date),
   recordedConditionsEquivalent:Boolean(strict),conditionsConfirmed:false,classification:'descriptive',warnings:cohort.warnings,history:cohort.records,
   text:`${cohort.exercise}: ${format(first.value)} → ${format(latest.value)} ${cohort.unit} × ${format(cohort.reps)} (${dateLabel(first.date)} → ${dateLabel(latest.date)})`};
 }).sort((a,b)=>Number(b.recordedConditionsEquivalent)-Number(a.recordedConditionsEquivalent)||b.dates.length-a.dates.length||b.latest.date.localeCompare(a.latest.date)||a.key.localeCompare(b.key));
 const selected=[],used=new Set();for(const pair of pairs)if(!used.has(norm(pair.exercise))){selected.push(pair);used.add(norm(pair.exercise));if(selected.length===3)break;}
 return {available:true,exercises:unique(pairs.map(pair=>pair.exercise)),pairs:selected,allPairs:pairs,history:comparison.history,strictDocumentaryPairs:0,
  recordedCompatiblePairs:comparison.comparable.length,selectionRule:'Condições registradas mais completas, recorrência, data e identidade estável; nunca a maior carga ou variação.',
  note:'Comparação descritiva. Fase e esforço ausentes continuam desconhecidos; identidade física e confirmação documental não estabelecidas. Não estima força.'};
}
function routineFinding(data,status,interval,m,ui,b){
 if(!interval)return null;
 const bounds=interval.interval,t=interval.training,sources=interval.nutrition.sources.map(source=>sourceNutrition(source,m.today));
 const receivedSources=sources.filter(source=>source.receivedDays>0);
 if(!(t.available&&t.sessions>0)&&!receivedSources.length)return null;
 const comparisons=trainingSupport(data,status,interval,m.today),windows=trainingWindows(t,bounds),clauses=[];
 if(comparisons.allPairs.length){
  // Name at most two exercises, using the existing evidence-quality order.
  // Each sentence identifies one repetition cohort and its own endpoint dates;
  // other cohorts, including divergent directions, stay in the detail.
  for(const pair of comparisons.pairs.slice(0,2)){
   const values=pair.delta===0?`${format(pair.first.value)} ${pair.unit}`:`${format(pair.first.value)} → ${format(pair.latest.value)} ${pair.unit}`;
   const conclusion=pair.delta===0?'manteve a carga registrada':`teve carga registrada ${pair.delta>0?'maior':'menor'}`;
   clauses.push(`${pair.exercise} ${conclusion}: ${values} × ${format(pair.reps)} repetições (${dateLabel(pair.first.date)} e ${dateLabel(pair.latest.date)})`);
  }
 }else if(windows?.earlier.sessions>0&&windows?.later.sessions>0){
  const changed=windows.earlier.groups.map(group=>({label:group.label,first:group.sessions,last:windows.later.groups.find(other=>other.label===group.label)?.sessions||0})).filter(group=>group.first*windows.later.sessions!==group.last*windows.earlier.sessions).slice(0,2);
  if(changed.length)clauses.push(`A distribuição dos registros por grupo mudou em duas janelas de ${windows.earlier.days} dias (${dateLabel(windows.earlier.start)} a ${dateLabel(windows.earlier.end)} / ${dateLabel(windows.later.start)} a ${dateLabel(windows.later.end)}): ${changed.map(group=>`${group.label}, ${group.first}/${windows.earlier.sessions} → ${group.last}/${windows.later.sessions} sessões`).join('; ')}`);
 }
 const hasSupportedConclusion=clauses.length>0;
 const limits=['Registros recebidos não demonstram frequência real, aderência ou causa da mudança corporal.','Alimentação permanece separada por origem; dias sobrepostos não são somados.'];
 if(!t.available)limits.push('Treinos não carregaram; ausência de leitura não significa ausência de treino.');
 else if(!t.detailsAvailable)limits.push('Séries ou exercícios indisponíveis; distribuição e comparação de carga podem estar incompletas.');
 if(comparisons.allPairs.length)limits.push(comparisons.note);
 if(t.duplicates?.length)limits.push('Identidades ambíguas ficaram fora dos totais; nenhuma duplicata foi escolhida automaticamente.');
 if(interval.nutrition.partial)limits.push('Uma integração alimentar está indisponível; a cobertura recebida é parcial.');
 if(bounds.openToday)limits.push('Hoje está parcial e fica fora das médias diárias.');
 if(Object.values(interval.endDayEvents||{}).some(count=>count>0))limits.push('Há eventos na data final; não está confirmado se ocorreram antes da avaliação.');
 const selectedSourceKey=ui.homeNutritionSource||ui.reportNutritionSource||m.nutrition?.source?.key||null;
 return {id:'routine',family:'routine',title:'Rotina entre as avaliações',hasSupportedConclusion,text:hasSupportedConclusion?clauses.join('; ')+'.':'Os registros disponíveis não explicam a mudança corporal.',dates:dates(bounds.start,bounds.end),
  action:bodyAction(m,ui,b,'Ver rotina entre as avaliações'),limits,
  evidence:{kind:'recorded_interval_context',interval:bounds,training:{...t,comparisons,windows},nutrition:{sources,overlaps:interval.nutrition.overlaps,
   selectedSourceKey,selectedSourceMissing:Boolean(selectedSourceKey&&!sources.some(source=>source.key===selectedSourceKey)),pooledMean:null,closedIntervalDays:bounds.closedDays,available:interval.nutrition.available,partial:interval.nutrition.partial}}};
}
function laboratoryFindings(data,status,m,ui){
 const history=m.labsHistory||homeLabHistory(data,status,m,ui);
 // A marker with one collection is retained in candidates/observations, never
 // described as a trajectory. Different laboratory/unit identities stay apart.
 const eligible=(history.candidates||[]).filter(candidate=>candidate.previous&&inside(day(candidate.row.collection_date),m.bounds));
 eligible.sort((a,b)=>Number(Boolean(b.document))-Number(Boolean(a.document))||Number(labComparable(b))-Number(labComparable(a))||b.row.collection_date.localeCompare(a.row.collection_date)||String(a.row.biomarker).localeCompare(String(b.row.biomarker),'pt-BR')||a.key.localeCompare(b.key));
 const trajectories=eligible.slice(0,3).map(candidate=>{const prior=candidate.previous,row=candidate.row,comparable=labComparable(candidate);
  const comparisonDelta=comparable?delta(prior.result_numeric,row.result_numeric):null;
  const values=comparable?`${format(prior.result_numeric)} ${prior.unit} → ${format(row.result_numeric)} ${row.unit} (${dateLabel(prior.collection_date)} → ${dateLabel(row.collection_date)})`:`${dateLabel(prior.collection_date)}: ${format(prior.result_numeric)} ${prior.unit}; ${dateLabel(row.collection_date)}: ${format(row.result_numeric)} ${row.unit}`;
  return {...candidate,comparable,delta:comparisonDelta,dates:dates(prior.collection_date,row.collection_date),
   presentation:comparable?'comparable_pair':'separate_observations',text:`${row.biomarker}: ${values}${candidate.priorOutside?'; coleta anterior fora do período selecionado':''}${comparable?'':'; valores separados, método não comparável ou não informado'}.`,
   references:[{date:prior.collection_date,value:prior.reference_range||null,laboratory:prior.laboratory||null,method:prior.method||null,unit:prior.unit},{date:row.collection_date,value:row.reference_range||null,laboratory:row.laboratory||null,method:row.method||null,unit:row.unit}],
   deltaUnit:row.unit==='%'?'p.p.':row.unit,meaning:'documented_observations_only'};
 });
 const observations=status.labs==='ready'?(data.labs||[]).filter(row=>day(row.collection_date)&&row.collection_date<=m.today).slice().sort((a,b)=>a.collection_date.localeCompare(b.collection_date)||String(a.biomarker).localeCompare(String(b.biomarker),'pt-BR')):[];
 const promoted=trajectories.filter(candidate=>candidate.comparable||candidate.document);
 const primary=promoted[0],finding=primary?{id:'labs',family:'labs',title:!primary.comparable?'Observações documentadas':promoted.length>1?'Trajetórias para a consulta':'Trajetória para a consulta',presentation:primary.presentation,text:primary.text,dates:primary.dates,
  action:{kind:'labs',label:primary.comparable?'Ver trajetórias e laudos':'Conferir observações e laudo',route:'saude',markerKey:primary.key,context:{...actionContext(m,ui),homeLabKey:primary.key}},
  limits:['A diferença isolada não define melhora, piora clínica ou urgência. Cada resultado mantém a referência do próprio laudo.',...(promoted.some(item=>item.priorOutside)?['A coleta anterior indicada está fora do período selecionado; não são duas coletas dentro do filtro.']:[])],
  evidence:{kind:primary.comparable?'laboratory_trajectories':'laboratory_documented_observations',trajectories:promoted,available:history.available,selectionRule:'Prioridade documental explícita, depois pares comparáveis recentes e nome; sem ranking de gravidade.'}}:null;
 return {finding,trajectories,observations,history};
}

/**
 * studyFindings(data, status, selectedHomeModel, ui)
 * Returns at most one finding per family, never placeholder findings. All dates
 * come from the selected model and source events. Renderers must escape strings.
 */
export function studyFindings(data={},status={},m={},ui={}){
 const selectionRule='Corpo conjunto, rotina do mesmo intervalo e trajetórias documentais; no máximo três achados sustentados pelos registros.';
 if(!day(m.today)||!day(m.bounds?.start)||!day(m.bounds?.end)||m.bounds.start>m.bounds.end)return {findings:[],interval:null,labTrajectories:[],labObservations:[],period:m.period||null,selectionRule,reason:'invalid_calendar'};
 const useful=m.useful||homeUsefulContent(data,status,m,ui),b=useful.body;
 const interval=intervalFor(data,status,m,ui,b),laboratory=laboratoryFindings(data,status,m,ui);
 const body=bodyFinding(b,m,ui),routineContext=routineFinding(data,status,interval,m,ui,b);
 if(body&&routineContext)body.evidence.routine={...routineContext.evidence,limits:routineContext.limits};
 const findings=[body,routineContext?.hasSupportedConclusion?routineContext:null,laboratory.finding].filter(Boolean).slice(0,3);
 return {findings,interval,routineContext,labTrajectories:laboratory.trajectories,labObservations:laboratory.observations,labHistory:laboratory.history,period:m.period,bounds:{...m.bounds},today:m.today,selectionRule,reason:findings.length?'supported_findings':'insufficient_evidence'};
}
