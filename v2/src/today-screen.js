import {state,esc,day,fmtDate,fmtNum,num,unique,norm} from './core.js';
import {
  addDays,buildIntegratedAnalysis,bodyChangeModel,trainingDistributionModel,
  comparablePerformanceModel,nutritionPeriodModel,sleepCoverageModel,periodBounds
} from './integrated-analysis.js';
import {stableAppleMetricTypes,isAppleSource,isAppleActivitySummarySource} from './source-status.js';
import {hydrationRows} from './hydration.js';

const failed=key=>state.domainStatus?.[key]==='error'||!!state.errors?.[key];
const periodLabel=period=>period==='30'?'30 dias':period==='90'?'90 dias':period==='365'?'1 ano':'todo o histórico';
const action=(route,label,kind='')=>`<button class="cockpitButton ${kind}" data-route="${esc(route)}">${esc(label)}</button>`;
const statusTone=coverage=>coverage==null?'neutral':coverage>=70?'ok':coverage>0?'partial':'missing';
const signed=(value,digits=0,unit='')=>{const n=num(value);return n==null?'—':`${n>0?'+':''}${fmtNum(n,digits)}${unit?` ${unit}`:''}`;};

function dateRows(rows,dateKey){
  const map=new Map();
  for(const row of rows||[]){const d=day(row?.[dateKey]);if(!d)continue;if(!map.has(d))map.set(d,[]);map.get(d).push(row);}
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}
function latestSingle(rows,dateKey){
  const groups=dateRows(rows,dateKey);if(!groups.length)return{date:null,row:null,ambiguous:false};
  const [date,items]=groups.at(-1);return{date,row:items.length===1?items[0]:null,ambiguous:items.length>1};
}
function canonicalWorkouts(data=state.data){return(data.workouts||[]).filter(r=>r?.is_canonical===true&&r?.record_status!=='quarantined');}
function inBounds(value,bounds){const d=day(value);return Boolean(d&&(!bounds.start||d>=bounds.start)&&(!bounds.end||d<=bounds.end));}
function previousBounds(bounds){
  if(!bounds?.start||!bounds?.end||!bounds?.days)return null;
  const end=addDays(bounds.start,-1),start=addDays(end,-(bounds.days-1));return{start,end,days:bounds.days};
}
function pctDelta(current,previous){return previous>0?((current-previous)/previous)*100:null;}

function latestUnambiguousMetric(rows,type){
  const matching=(rows||[]).filter(r=>r?.metric_type===type&&num(r?.value)!=null),groups=dateRows(matching,'measured_at');
  if(!groups.length)return{date:null,row:null,ambiguous:false};
  const [date,items]=groups.at(-1);return{date,row:items.length===1?items[0]:null,ambiguous:items.length>1};
}
function sleepSourceLabel(row){return String(row?.source_name||row?.source_family||'Origem não informada').trim();}
export function activitySleepSnapshot(data={},status={}){
  const metricsReady=status?.metrics==='ready',sourceReady=status?.sourceMetrics==='ready';
  const activityRows=metricsReady?(data.metrics||[]).filter(r=>stableAppleMetricTypes.has(r?.metric_type)&&isAppleSource(r)&&isAppleActivitySummarySource(r)&&num(r?.value)!=null):[];
  const activeEnergy=latestUnambiguousMetric(activityRows,'active_energy_kcal'),exercise=latestUnambiguousMetric(activityRows,'exercise_minutes'),stand=latestUnambiguousMetric(activityRows,'stand_hours');
  const activityDates=unique([activeEnergy.date,exercise.date,stand.date].filter(Boolean)).sort(),activityLatest=activityDates.at(-1)||null;
  const energySeries=dateRows(activityRows.filter(r=>r.metric_type==='active_energy_kcal'),'measured_at').filter(([,items])=>items.length===1).map(([date,items])=>({date,value:num(items[0].value)})).filter(r=>r.value!=null);
  const sleepRows=sourceReady?(data.sourceMetrics||[]).filter(r=>r?.metric_type==='sleep_duration_h'&&['candidate','held'].includes(norm(r?.canonical_status))&&num(r?.value)!=null):[];
  const sourceMap=new Map();
  for(const row of sleepRows){const label=sleepSourceLabel(row),key=`${norm(row?.source_family)}__${norm(label)}`;if(!sourceMap.has(key))sourceMap.set(key,{key,label,family:String(row?.source_family||'').trim(),rows:[]});sourceMap.get(key).rows.push(row);}
  const sleepSources=[...sourceMap.values()].map(source=>{
    const safe=dateRows(source.rows,'metric_date').filter(([,items])=>items.length===1).map(([date,items])=>({date,row:items[0]}));
    const latest=safe.at(-1)||null;
    return{key:source.key,label:source.label,family:source.family,days:safe.length,lastDate:latest?.date||null,lastValue:num(latest?.row?.value),unit:String(latest?.row?.unit||'h').trim()||'h',points:safe.map(x=>({date:x.date,value:num(x.row.value)}))};
  }).filter(source=>source.days>0).sort((a,b)=>String(b.lastDate).localeCompare(String(a.lastDate))||b.days-a.days||a.label.localeCompare(b.label,'pt-BR'));
  const sleepLatest=unique(sleepSources.map(s=>s.lastDate).filter(Boolean)).sort().at(-1)||null;
  return{metricsReady,sourceReady,activityRows,activeEnergy,exercise,stand,activityLatest,energySeries,sleepSources,sleepLatest,latestDate:unique([activityLatest,sleepLatest].filter(Boolean)).sort().at(-1)||null};
}

function periodSeries(rows,dateKey,valueKey,bounds){
  return dateRows((rows||[]).filter(r=>inBounds(r?.[dateKey],bounds)),dateKey).filter(([,items])=>items.length===1).map(([date,items])=>({date,value:num(items[0]?.[valueKey])})).filter(r=>r.value!=null);
}
function historySeries(rows,dateKey,valueKey,limit=12){
  return dateRows(rows||[],dateKey).filter(([,items])=>items.length===1).slice(-limit).map(([date,items])=>({date,value:num(items[0]?.[valueKey])})).filter(r=>r.value!=null);
}
function weeklySeries(data,bounds){
  const workouts=canonicalWorkouts(data).filter(w=>inBounds(w.workout_date,bounds));
  if(!bounds?.start||!bounds?.end)return[];
  const points=[];let cursor=bounds.start;
  while(cursor<=bounds.end){const end=[addDays(cursor,6),bounds.end].sort()[0];points.push({date:end,value:workouts.filter(w=>{const d=day(w.workout_date);return d>=cursor&&d<=end;}).length});cursor=addDays(end,1);if(points.length>54)break;}
  return points;
}
function labSnapshot(data,bounds=null){
  const rows=(data.labs||[]).filter(r=>!bounds||inBounds(r.collection_date,bounds)),dates=unique(rows.map(r=>day(r.collection_date)).filter(Boolean)).sort();
  return{rows,dates,collections:dates.length,last:dates.at(-1)||null,markers:unique(rows.map(r=>String(r.biomarker||'').trim()).filter(Boolean)).length,totalResults:rows.length};
}

export function executiveCockpitModel(data={},status={},period='30'){
  const integrated=buildIntegratedAnalysis(data,status),bounds=periodBounds(period,integrated.referenceDay),previous=previousBounds(bounds);
  const training=trainingDistributionModel(data,status,bounds.start,bounds.end),trainingPrevious=previous?trainingDistributionModel(data,status,previous.start,previous.end):null;
  const performance=comparablePerformanceModel(data,status,4,bounds.start,bounds.end);
  const nutrition=nutritionPeriodModel(data,status,bounds.start,bounds.end),nutritionPrevious=previous?nutritionPeriodModel(data,status,previous.start,previous.end):null;
  const body=bodyChangeModel(data,status,null,null),bodyWindow=bodyChangeModel(data,status,bounds.start,bounds.end),latestBody=latestSingle(data.body||[],'measured_at');
  const sleep=sleepCoverageModel(data,status,bounds.start,bounds.end),sleepPrevious=previous?sleepCoverageModel(data,status,previous.start,previous.end):null;
  const activitySleep=activitySleepSnapshot(data,status);
  const labs=labSnapshot(data),labsWindow=labSnapshot(data,bounds);
  const water=hydrationRows(data).filter(r=>inBounds(r.date,bounds));
  const nutritionCoverage=nutrition?.available&&nutrition.intervalDays?Math.round(nutrition.days/nutrition.intervalDays*100):null;
  const prevNutritionCoverage=nutritionPrevious?.available&&nutritionPrevious.intervalDays?Math.round(nutritionPrevious.days/nutritionPrevious.intervalDays*100):null;
  const sleepSources=activitySleep.sleepSources.map(source=>({...source,periodPoints:source.points.filter(p=>inBounds(p.date,bounds))})).filter(s=>s.periodPoints.length);
  const topGroups=(training.rows||[]).slice(0,4);
  return{
    period,bounds,previous,referenceDay:integrated.referenceDay,
    training:{...training,previousSessions:trainingPrevious?.totalSessions??null,deltaPct:trainingPrevious?pctDelta(training.totalSessions,trainingPrevious.totalSessions):null,topGroups,performance},
    nutrition:{...nutrition,latestDate:integrated.lastNutritionDate,latestAmbiguous:integrated.nutritionLatestAmbiguous,coveragePct:nutritionCoverage,previousCoveragePct:prevNutritionCoverage,coverageDelta:prevNutritionCoverage==null||nutritionCoverage==null?null:nutritionCoverage-prevNutritionCoverage},
    body:{...body,latestOverall:latestBody,window:bodyWindow},
    sleep:{...sleep,previousDays:sleepPrevious?.days??null,sources:sleepSources},
    activitySleep,
    labs:{...labs,windowCollections:labsWindow.collections,windowMarkers:labsWindow.markers,windowLast:labsWindow.last},
    water,
    bodyFatSeries:historySeries(data.body||[],'measured_at','body_fat_pct',12),
    calorieSeries:periodSeries(data.nutrition||[],'nutrition_date','calories_kcal',bounds),
    trainingSeries:weeklySeries(data,bounds)
  };
}

function chart(points,{unit='',digits=0,label='',bar=false}={}){
  const rows=(points||[]).filter(p=>p?.date&&num(p?.value)!=null).slice(-36);
  if(rows.length<2)return`<div class="cockpitEmpty">Sem pontos suficientes para este gráfico.</div>`;
  const values=rows.map(r=>r.value),lo=bar?0:Math.min(...values),hi=Math.max(...values),span=Math.max(hi-lo,1),pad=bar?0:span*.14,min=bar?0:lo-pad,max=bar?Math.max(hi,1):hi+pad,w=640,h=176,left=48,right=14,top=14,bottom=28,plotW=w-left-right,plotH=h-top-bottom;
  const x=i=>left+i*plotW/Math.max(1,rows.length-1),y=v=>top+(max-v)*plotH/Math.max(max-min,1e-9),ticks=[max,max-(max-min)/2,min];
  const grid=ticks.map(v=>`<line x1="${left}" y1="${y(v).toFixed(1)}" x2="${w-right}" y2="${y(v).toFixed(1)}"/>`).join(''),labels=ticks.map(v=>`<text x="${left-7}" y="${(y(v)+3).toFixed(1)}" text-anchor="end">${esc(fmtNum(v,digits))}</text>`).join('');
  const marks=bar?rows.map((r,i)=>{const bw=Math.max(5,Math.min(24,plotW/rows.length*.52));return`<rect x="${(x(i)-bw/2).toFixed(1)}" y="${y(r.value).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1,y(min)-y(r.value)).toFixed(1)}" rx="3"><title>${esc(fmtDate(r.date))}: ${esc(fmtNum(r.value,digits))}${esc(unit)}</title></rect>`;}).join(''):(()=>{const path=rows.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(r.value).toFixed(1)}`).join(' ');return`<path class="cockpitLine" d="${path}"/>${rows.map((r,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(r.value).toFixed(1)}" r="3"><title>${esc(fmtDate(r.date))}: ${esc(fmtNum(r.value,digits))}${esc(unit)}</title></circle>`).join('')}`;})();
  return`<div class="cockpitChart" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><g class="cockpitGrid">${grid}</g><g class="cockpitAxisLabels">${labels}</g><g class="cockpitMarks">${marks}</g></svg><div class="cockpitXAxis"><span>${fmtDate(rows[0].date)}</span><span>${fmtDate(rows.at(-1).date)}</span></div></div>`;
}
function deltaLine(current,previous,{unit='sessões',digits=0}={}){if(previous==null)return'período anterior indisponível';const diff=current-previous;return`${diff>=0?'+':''}${fmtNum(diff,digits)} ${unit} vs. período anterior`;}
const iconPaths={
  body:'<circle cx="12" cy="5" r="2.2"/><path d="M9.2 8.5c1.9-1.1 3.7-1.1 5.6 0l1.9 2.9-1.8 1.1-1.2-1.9v3.2l2.1 5.4-2.1.8-1.7-4.1-1.7 4.1-2.1-.8 2.1-5.4v-3.2l-1.2 1.9-1.8-1.1 1.9-2.9z"/>',
  training:'<rect x="3" y="9" width="3" height="6" rx="1"/><rect x="18" y="9" width="3" height="6" rx="1"/><rect x="7" y="7" width="3" height="10" rx="1"/><rect x="14" y="7" width="3" height="10" rx="1"/><rect x="10" y="11" width="4" height="2" rx="1"/>',
  nutrition:'<path d="M12.8 6.1c1.1-2.1 2.4-3.1 4.1-3.1-.1 2.1-1.2 3.4-3.2 4.1"/><path d="M12 8.2c2.1-2.2 6-1.7 7.2 1.4 1.7 4.4-1.3 10.1-4.5 10.1-1.2 0-1.6-.6-2.7-.6s-1.5.6-2.7.6c-3.2 0-6.2-5.7-4.5-10.1C6 6.5 9.9 6 12 8.2z"/>',
  recovery:'<path d="M18.8 15.9A8.2 8.2 0 0 1 8.1 5.2a8.5 8.5 0 1 0 10.7 10.7z"/>',
  labs:'<path d="M9 3h6v2l-1.2 1.8v2.5l4.4 7.7A2.7 2.7 0 0 1 15.9 21H8.1a2.7 2.7 0 0 1-2.3-4l4.4-7.7V6.8L9 5V3zm1.8 9-2.7 4.8c-.4.7.1 1.6.9 1.6h6c.8 0 1.3-.9.9-1.6L13.2 12h-2.4z"/>'
};
function icon(name){return`<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name]||''}</svg>`;}
function domainCard({route,iconName,label,value,sub,detail,tone='neutral'}){return`<button class="cockpitStatus ${tone}" data-route="${esc(route)}" aria-label="Abrir ${esc(label)}"><span class="cockpitIcon">${icon(iconName)}</span><span class="cockpitStatusText"><small>${esc(label)}</small><b>${esc(value)}</b><em>${esc(sub)}</em><i>${esc(detail)}</i></span><span class="cockpitArrow" aria-hidden="true">→</span></button>`;}
function keyInsight(model){
  const rows=[];
  if(model.body.available)rows.push(`Composição: entre ${fmtDate(model.body.previous.measured_at)} e ${fmtDate(model.body.latest.measured_at)}, massa muscular ${signed(model.body.delta.muscleKg,1,'kg')} e massa de gordura ${signed(model.body.delta.fatKg,1,'kg')}.`);
  if(model.training.available)rows.push(`Treino: ${model.training.totalSessions} sessão(ões) em ${periodLabel(model.period)}${model.training.previousSessions!=null?`, versus ${model.training.previousSessions} no período anterior equivalente`:''}.`);
  if(model.nutrition.available)rows.push(`Nutrição: ${model.nutrition.days} dia(s) têm total diário inequívoco${model.nutrition.intervalDays?` em ${model.nutrition.intervalDays} dias possíveis`:''}${model.nutrition.coveragePct!=null?` (${model.nutrition.coveragePct}% de cobertura)`:''}.`);
  if(model.water.length===0)rows.push('Hidratação: não existe ingestão de água estruturada nesta janela; nenhum valor é estimado.');
  return rows.slice(0,3).join(' ');
}
function summaryList(model){
  const rows=[];
  if(model.training.topGroups.length){const top=model.training.topGroups[0];rows.push(`<li><b>Treino</b><span>${esc(top.label)} aparece em ${top.sessions} sessão(ões), maior presença entre os grupos estruturados desta janela.</span></li>`);}
  if(model.training.performance.length){const p=model.training.performance[0];rows.push(`<li><b>Performance</b><span>${esc(p.exercise)}: ${fmtNum(p.previousWeight,1)} → ${fmtNum(p.weight,1)} ${esc(p.unit)} entre ${fmtDate(p.previousDate)} e ${fmtDate(p.date)}.</span></li>`);}
  if(model.nutrition.available&&model.nutrition.days)rows.push(`<li><b>Nutrição</b><span>${model.nutrition.coveragePct==null?`${model.nutrition.days} dia(s) registrados no histórico`:`${model.nutrition.coveragePct}% da janela registrada`} · média ${model.nutrition.calorieAvg==null?'sem energia':`${fmtNum(model.nutrition.calorieAvg,0)} kcal/dia`} · ${model.nutrition.proteinAvg==null?'proteína sem cobertura':`${fmtNum(model.nutrition.proteinAvg,0)} g proteína/dia`}.</span></li>`);
  if(model.sleep.available&&model.sleep.days)rows.push(`<li><b>Recuperação</b><span>${model.sleep.days} dia(s) com sono preservado; valores permanecem separados por origem e não são promediados entre dispositivos.</span></li>`);
  if(model.labs.totalResults)rows.push(`<li><b>Exames</b><span>${model.labs.totalResults} resultado(s) estruturado(s) em ${model.labs.collections} data(s) de coleta; última coleta ${fmtDate(model.labs.last)}.</span></li>`);
  if(!model.water.length)rows.push('<li class="missing"><b>Hidratação</b><span>Sem dado de ingestão de água. Água corporal da bioimpedância é outra medida e não entra como consumo.</span></li>');
  return rows.join('');
}
function reviewItems(model){
  const items=[];
  if(failed('nutrition'))items.push(['Nutrição','Os dados não carregaram agora.','nutricao']);
  else if(model.nutrition.latestAmbiguous)items.push(['Nutrição',`O dia mais recente (${fmtDate(model.nutrition.latestDate)}) tem totais conflitantes e nenhum foi escolhido como atual.`,'nutricao']);
  else if(model.nutrition.coveragePct!=null&&model.nutrition.coveragePct<70)items.push(['Nutrição',`Cobertura de ${model.nutrition.coveragePct}% da janela.`,'nutricao']);
  else if(!model.nutrition.days)items.push(['Nutrição','Sem cobertura comparável nesta janela.','nutricao']);
  if(!model.water.length)items.push(['Hidratação','Ingestão de água ainda não está estruturada; nenhum zero foi inferido.','dados']);
  if(!model.body.available)items.push(['Composição',model.body.reason==='source_changed'?'Sem comparação entre origens diferentes.':'Ainda não há duas medições comparáveis no histórico.','bio']);
  if(failed('labs'))items.push(['Exames','Os dados não carregaram agora.','saude']);
  else if(!model.labs.totalResults)items.push(['Exames','Nenhum resultado estruturado foi encontrado no histórico.','saude']);
  if(!items.length)items.push(['Dados','Cobertura suficiente para os resumos atuais; abra Análises para aprofundar.','analise']);
  return items.slice(0,3);
}
function nextReview(model){return reviewItems(model).map(([title,body,route])=>`<button class="cockpitReviewItem" data-route="${route}"><b>${esc(title)}</b><span>${esc(body)}</span><i aria-hidden="true">→</i></button>`).join('');}
function periodPicker(period){const options=[['30','30 dias'],['90','90 dias'],['365','1 ano'],['all','Histórico']];return`<div class="cockpitPeriod" role="group" aria-label="Janela da visão geral"><span>Janela analisada</span><div class="cockpitPeriodTabs">${options.map(([value,label])=>`<button type="button" data-period="${value}" class="${period===value?'active':''}" aria-pressed="${period===value?'true':'false'}">${label}</button>`).join('')}</div><label class="cockpitPeriodSelectLabel">Selecionar janela<select id="analysisPeriod">${options.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label></div>`;}
function sleepPanel(model){
  if(failed('sourceMetrics'))return`<div class="cockpitEmpty">Os registros de sono não carregaram agora.</div>`;
  if(!model.sleep.sources.length)return`<div class="cockpitEmpty">Sem sono estruturado por origem em ${esc(periodLabel(model.period))}.</div>`;
  return`<div class="cockpitSleepSources"><div class="cockpitSleepTitle"><b>Sono preservado por origem</b><small>${model.sleep.sources.length} origem(ns) · sem média entre fontes</small></div>${model.sleep.sources.slice(0,4).map(source=>{const last=source.periodPoints.at(-1);return`<div class="cockpitSleepRow"><div><b>${esc(source.label)}</b><small>${source.periodPoints.length} dia(s) na janela</small></div><span>${last?`${fmtNum(last.value,1)} ${esc(source.unit)}`:'—'}<small>${last?fmtDate(last.date):'—'}</small></span></div>`;}).join('')}<p>Fontes permanecem separadas; o app não calcula média entre dispositivos.</p></div>`;
}

export function renderTodayHub(){
  const period=state.ui.analysisPeriod||'365',model=executiveCockpitModel(state.data,state.domainStatus,period),latestBody=model.body.latestOverall,bodyRow=latestBody.row;
  const bodyValue=failed('body')?'Indisponível':latestBody.ambiguous?'Em revisão':bodyRow&&num(bodyRow.weight_kg)!=null?`${fmtNum(bodyRow.weight_kg,1)} kg`:'Sem medição';
  const bodySub=bodyRow&&num(bodyRow.body_fat_pct)!=null?`${fmtDate(latestBody.date)} · ${fmtNum(bodyRow.body_fat_pct,1)}% gordura · ${num(bodyRow.skeletal_muscle_mass_kg)!=null?`${fmtNum(bodyRow.skeletal_muscle_mass_kg,1)} kg músculo`:''}`:'Última composição disponível';
  const bodyDetail=model.body.available?`vs. ${fmtDate(model.body.previous.measured_at)} · Δ músculo ${signed(model.body.delta.muscleKg,1,'kg')} · Δ gordura ${signed(model.body.delta.fatKg,1,'kg')}`:model.body.reason==='source_changed'?'Sem comparação entre origens diferentes.':'sem duas medições comparáveis no histórico';
  const nutritionFailed=failed('nutrition'),labsFailed=failed('labs');
  const nutritionTone=nutritionFailed||model.nutrition.latestAmbiguous?'partial':statusTone(model.nutrition.coveragePct),sleepTone=model.sleep.days?'neutral':'missing';
  const activity=model.activitySleep,activityLatest=activity.activityLatest?`atividade até ${fmtDate(activity.activityLatest)}`:'atividade sem ponto confirmado';
  const nutritionValue=nutritionFailed?'Indisponível agora':model.nutrition.latestAmbiguous?'Revisão necessária':model.nutrition.available?(model.nutrition.coveragePct==null?`${model.nutrition.days||0} dias registrados`:`${model.nutrition.coveragePct}% cobertura`):'Sem cobertura';
  const nutritionSub=nutritionFailed?'os dados não carregaram':model.nutrition.latestAmbiguous?`${fmtDate(model.nutrition.latestDate)} · totais conflitantes`:model.nutrition.available?(model.nutrition.intervalDays?`${model.nutrition.days} de ${model.nutrition.intervalDays} dias registrados`:`${model.nutrition.days||0} dias inequívocos no histórico`):'dados indisponíveis';
  const labsValue=labsFailed?'Indisponível agora':model.labs.last?fmtDate(model.labs.last):'Sem exames';
  const labsSub=labsFailed?'os dados não carregaram':model.labs.totalResults?`${model.labs.totalResults} resultados · ${model.labs.collections} coleta(s) no histórico`:'nenhum resultado estruturado';
  const labsDetail=labsFailed?'tente novamente depois':model.labs.windowCollections?`${model.labs.windowCollections} coleta(s) em ${periodLabel(period)}`:`nenhuma coleta em ${periodLabel(period)} · último histórico acima`;
  return`<div class="dashboardScreen cockpitScreen cockpitV3" data-executive-dashboard data-period="${esc(period)}">
    <section class="cockpitWelcome">
      <div><span class="cockpitKicker">LTS Health · assistente longitudinal</span><h1>Visão geral da sua saúde</h1><p>Uma leitura do histórico conhecido: o que mudou, quanta cobertura existe e onde vale aprofundar.</p></div>
      ${periodPicker(period)}
    </section>

    <section class="cockpitStatusGrid" aria-label="Estado atual por domínio">
      ${domainCard({route:'bio',iconName:'body',label:'Composição corporal',value:bodyValue,sub:bodySub,detail:bodyDetail,tone:model.body.available?'ok':'partial'})}
      ${domainCard({route:'treinos',iconName:'training',label:'Treinos',value:model.training.available?`${model.training.totalSessions} sessões`:'Indisponível',sub:periodLabel(period),detail:model.training.available?deltaLine(model.training.totalSessions,model.training.previousSessions):'histórico não carregado',tone:model.training.totalSessions?'ok':'missing'})}
      ${domainCard({route:'nutricao',iconName:'nutrition',label:'Nutrição',value:nutritionValue,sub:nutritionSub,detail:nutritionFailed?'tente novamente depois':model.nutrition.latestAmbiguous?'nenhum foi escolhido como atual':model.water.length?'há ingestão de água registrada':'água: sem dado de ingestão',tone:nutritionTone})}
      ${domainCard({route:'analise',iconName:'recovery',label:'Recuperação',value:model.sleep.available?`${model.sleep.days} dias de sono`:'Sem cobertura recente',sub:`${model.sleep.sources.length} origem(ns) na janela`,detail:activityLatest,tone:sleepTone})}
      ${domainCard({route:'saude',iconName:'labs',label:'Exames',value:labsValue,sub:labsSub,detail:labsDetail,tone:labsFailed?'partial':model.labs.totalResults?'neutral':'missing'})}
    </section>

    <section class="cockpitDecisionGrid" aria-label="Leitura e prioridades da janela">
      <article class="cockpitSummary">
        <div class="cockpitInsightHero"><div class="cockpitInsightIcon">✦</div><div><span>Resumo executivo</span><h2>Leitura principal</h2><p>${esc(keyInsight(model)||'Ainda não há cobertura suficiente para uma leitura integrada.')}</p></div></div>
        <ul class="cockpitSummaryList">${summaryList(model)||'<li><span>Sem cobertura suficiente para resumo nesta janela.</span></li>'}</ul>
        ${action('analise','Abrir análise integrada','primary')}
      </article>
      <article class="cockpitReview"><div class="cockpitModuleHead"><div><span>Prioridades</span><h2>Pontos a revisar</h2><p>As lacunas que mais limitam a leitura desta janela.</p></div></div><div class="cockpitReviewList">${nextReview(model)}</div></article>
    </section>

    <div class="cockpitSectionHeading"><div><span>Evidência por domínio</span><h2>Explore o histórico</h2></div><p>Os gráficos abaixo explicam a síntese. Abra uma área para chegar ao registro e à origem.</p></div>

    <section class="cockpitAnalyticsGrid">
      <article class="cockpitModule training"><div class="cockpitModuleHead"><div><span>Treino</span><h2>Ritmo e distribuição</h2></div>${action('treinos','Abrir treinos')}</div><div class="cockpitModuleFacts"><b>${model.training.totalSessions||0} sessões</b><span>${model.training.previousSessions==null?'sem período anterior comparável':`${model.training.previousSessions} no período anterior`}</span></div>${chart(model.trainingSeries,{digits:0,label:'Sessões de treino por semana',bar:true})}<div class="cockpitGroupBars">${model.training.topGroups.map(g=>`<div><span>${esc(g.label)}</span><i><u style="width:${Math.max(8,g.sessions/Math.max(1,model.training.topGroups[0]?.sessions||1)*100)}%"></u></i><b>${g.sessions}</b></div>`).join('')||'<p>Sem grupos estruturados nesta janela.</p>'}</div></article>
      <article class="cockpitModule nutrition"><div class="cockpitModuleHead"><div><span>Nutrição</span><h2>Registro e médias</h2></div>${action('nutricao','Abrir nutrição')}</div>${nutritionFailed?'<div class="cockpitEmpty">Os dados de nutrição não carregaram agora.</div>':`<div class="cockpitModuleFacts"><b>${model.nutrition.coveragePct==null?`${model.nutrition.days||0} dias`:`${model.nutrition.coveragePct}% da janela`}</b><span>${model.nutrition.days||0} dia(s) com total inequívoco</span></div>${chart(model.calorieSeries,{unit:' kcal',digits:0,label:'Energia registrada por dia'})}<div class="cockpitMiniMetrics"><div><b>${model.nutrition.calorieAvg==null?'—':`${fmtNum(model.nutrition.calorieAvg,0)} kcal`}</b><span>média registrada</span></div><div><b>${model.nutrition.proteinAvg==null?'—':`${fmtNum(model.nutrition.proteinAvg,0)} g`}</b><span>proteína registrada</span></div><div><b>${model.water.length?model.water.length:'—'}</b><span>${model.water.length?'dias com ingestão de água':'ingestão sem dado'}</span></div></div>`}</article>
      <article class="cockpitModule body"><div class="cockpitModuleHead"><div><span>Composição</span><h2>Histórico corporal</h2></div>${action('bio','Abrir composição')}</div><div class="cockpitModuleFacts"><b>${bodyRow&&num(bodyRow.body_fat_pct)!=null?`${fmtNum(bodyRow.body_fat_pct,1)}%`:'—'}</b><span>${latestBody.date?`última medição ${fmtDate(latestBody.date)}`:'sem medição'}</span></div>${chart(model.bodyFatSeries,{unit:'%',digits:1,label:'Últimas medições de composição corporal'})}<div class="cockpitMiniMetrics"><div><b>${bodyRow&&num(bodyRow.weight_kg)!=null?`${fmtNum(bodyRow.weight_kg,1)} kg`:'—'}</b><span>peso registrado</span></div><div><b>${bodyRow&&num(bodyRow.skeletal_muscle_mass_kg)!=null?`${fmtNum(bodyRow.skeletal_muscle_mass_kg,1)} kg`:'—'}</b><span>massa muscular registrada</span></div><div><b>${model.body.available?signed(model.body.delta.fatKg,1,'kg'):'—'}</b><span>${model.body.available?`mudança vs. ${fmtDate(model.body.previous.measured_at)}`:'comparação indisponível'}</span></div></div></article>
    </section>

    <section class="cockpitSecondaryGrid">
      <article class="cockpitModule recovery"><div class="cockpitModuleHead"><div><span>Recuperação</span><h2>Sono por origem</h2></div>${action('analise','Abrir recuperação')}</div>${sleepPanel(model)}</article>
      <article class="cockpitModule labs"><div class="cockpitModuleHead"><div><span>Exames</span><h2>Histórico laboratorial</h2></div>${action('saude','Abrir exames')}</div>${labsFailed?'<div class="cockpitEmpty">Os dados de exames não carregaram agora.</div>':model.labs.totalResults?`<div class="cockpitLabFacts"><div><b>${model.labs.totalResults}</b><span>resultados estruturados</span></div><div><b>${model.labs.collections}</b><span>datas de coleta</span></div><div><b>${fmtDate(model.labs.last)}</b><span>última coleta</span></div></div><p class="cockpitNote">Na janela recente: ${model.labs.windowCollections} coleta(s). O último histórico permanece visível quando a janela curta não contém exame.</p>`:`<div class="cockpitEmpty">Nenhum resultado estruturado foi encontrado no histórico.</div>`}</article>
      <article class="cockpitModule hydration ${model.water.length?'':'missing'}"><div class="cockpitModuleHead"><div><span>Hidratação</span><h2>Ingestão de água</h2></div><button class="cockpitButton" data-entry="water-import">${model.water.length?'Atualizar água do MFP':'Trazer do MFP'}</button></div>${model.water.length?`<div class="cockpitHydrationValue"><b>${fmtNum(model.water.at(-1).value,0)} mL</b><span>último registro em ${fmtDate(model.water.at(-1).date)} · ${esc(model.water.at(-1).source||'MyFitnessPal')}</span></div>`:`<div class="cockpitHydrationMissing"><span aria-hidden="true">◇</span><b>Sem dado de ingestão de água</b><p>A importação histórica do MyFitnessPal traz o período em lote, sem digitar dia a dia. Água corporal da bioimpedância é outra medida e aparece em Composição.</p></div>`}</article>
    </section>

    <section class="cockpitTrustGrid">
      <article class="cockpitSources"><div class="cockpitModuleHead"><div><span>Cobertura</span><h2>Dados conectados</h2></div>${action('dados','Gerenciar fontes')}</div><div class="cockpitSourceList"><span>Apple Saúde / Watch <i>atividade e sinais</i></span><span>Polar <i>evidência de treino</i></span><span>MyFitnessPal <i>nutrição e água</i></span><span>Bioimpedância <i>composição</i></span><span>Exames <i>laboratório</i></span></div></article>
      <article class="cockpitMethod"><span>Como ler esta tela</span><h2>Limites preservados</h2><p>Composição e exames mostram o último registro disponível. Treino, nutrição e recuperação seguem a janela selecionada. Origens incompatíveis permanecem separadas e nenhuma proximidade temporal é tratada como causa.</p>${action('timeline','Abrir Timeline')}</article>
    </section>
    <p class="cockpitFooter">Janela analisada: ${periodLabel(period)} · leitura descritiva baseada apenas em registros disponíveis.</p>
  </div>`;
}
