import {state,fixtureMode,esc,fmtDate,fmtNum,num,workoutRows,day,periodLabel} from './core.js';
import {executiveCockpitModel} from './today-screen.js';
import {localHealthDay,healthTimeZone,bodySourceLabel,bodyMetricSeries,labTrend,medicationContext,healthContextModel,renderHealthContext,contextChart,highlightedLabs} from './health-context.js';
import {renderHomeEvidenceInsights} from './evidence-insights-view.js';
import {hydrationModel} from './hydration.js';
import {integratedReview} from './integrated-review.js';
import {renderHomeDaySignals} from './integrated-review-view.js';
import {homeCockpitModel,renderHomeCockpit,renderHomeReading} from './home-cockpit.js';

const latest=(rows,key)=>[...(rows||[])].filter(row=>row?.[key]).sort((a,b)=>String(a[key]).localeCompare(String(b[key]))).at(-1)||null;
const dateKey=value=>day(value);
const safe=(value,fallback='—')=>value==null||value===''?fallback:value;
const plural=(count,one,many)=>`${count} ${count===1?one:many}`;
const failed=key=>state.domainStatus?.[key]==='error'||Boolean(state.errors?.[key]);

function displayName(){
  const metadata=state.session?.user?.user_metadata||{};
  const raw=metadata.full_name||metadata.name||metadata.display_name||'';
  return String(raw).trim().split(/\s+/)[0]||'';
}

function greeting(){
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:healthTimeZone,hour:'numeric',hourCycle:'h23'}).format(new Date()));
  const base=hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';
  const name=displayName();
  return name?`${base}, ${name}`:base;
}

function longDate(value=new Date()){
  try{
    return new Intl.DateTimeFormat('pt-BR',{timeZone:healthTimeZone,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(value).replace(/^./,letter=>letter.toUpperCase());
  }catch{return'';}
}

function bodyRows(){
  const rows=[...(state.data.body||[])]
    .filter(row=>row?.measured_at&&num(row.weight_kg)!=null)
    .sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at)));
  const anchor=rows.at(-1);
  if(!anchor)return[];
  if(rows.filter(row=>dateKey(row.measured_at)===dateKey(anchor.measured_at)).length!==1)return[];
  const coherent=anchor.source?rows.filter(row=>row.source===anchor.source&&(row.device_name||'')===(anchor.device_name||'')):rows.length===1?rows:[];
  const grouped=new Map();
  for(const row of coherent){
    const key=dateKey(row.measured_at);
    if(!key)continue;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(row);
  }
  return [...grouped.values()].filter(list=>list.length===1).map(list=>list[0]);
}

function leanMass(row){
  const weight=num(row?.weight_kg),fatMass=num(row?.fat_mass_kg);
  return weight==null||fatMass==null?null:weight-fatMass;
}

function deltaFrom(rows,read,unit=''){
  const current=read(rows.at(-1)),previous=read(rows.at(-2));
  if(current==null||previous==null)return{value:'—',label:'sem comparação'};
  const difference=current-previous;
  return{value:`${difference>0?'+':''}${fmtNum(difference,1)}${unit}`,label:'vs. medição comparável'};
}

function delta(rows,key,unit=''){return deltaFrom(rows,row=>num(row?.[key]),unit);}

function metric(label,value,comparison,{unavailable=false}={}){
  const arrow=comparison.value.startsWith('+')?'↑':comparison.value.startsWith('-')?'↓':'•';
  const footer=unavailable?'<b>Falha temporária</b><small>toque para tentar novamente</small>':`<b>${arrow} ${esc(comparison.value)}</b><small>${esc(comparison.label)}</small>`;
  return `<button class="ltsRefMetric${unavailable?' unavailable':''}" data-route="bio"><span>${esc(label)}</span><strong>${esc(value)}</strong><div>${footer}</div></button>`;
}

function icon(kind){
  const glyph={training:'↔',medication:'✦',water:'◌',nutrition:'⌁',labs:'◇',recovery:'☾',timeline:'◷'}[kind]||'•';
  return `<span class="ltsRefTodayIcon ${kind}" aria-hidden="true">${glyph}</span>`;
}

function todayRow(kind,title,subtitle,route,{entry=false,current=false}={}){
  const attr=entry?`data-entry="${entry}"`:`data-route="${route}"`;
  const tone=entry?'entry':current?'current':'historical';
  const marker=entry?'+':current?'✓':'›';
  return `<button class="ltsRefTodayRow" ${attr}>${icon(kind)}<span class="ltsRefTodayCopy"><b>${esc(title)}</b><small>${esc(subtitle)}</small></span><span class="ltsRefTodayState ${tone}">${marker}</span></button>`;
}

function uniqueDays(rows,key,predicate,anchor){
  const end=new Date(`${localHealthDay(anchor)}T23:59:59.999Z`),start=new Date(`${localHealthDay(anchor)}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate()-6);
  const dates=new Set();
  for(const row of rows||[]){
    if(!predicate(row)||!row?.[key])continue;
    const value=new Date(`${dateKey(row[key])}T12:00:00Z`);
    if(!Number.isNaN(value.getTime())&&value>=start&&value<=end)dates.add(dateKey(row[key]));
  }
  return Math.min(7,dates.size);
}

function ring(label,count,kind){
  const progress=Math.max(0,Math.min(100,count/7*100));
  return `<div class="ltsRefProgressItem ${kind}"><div class="ltsRefRing" style="--progress:${progress}%"><span><b>${count==null?'—':`${count}/7`}</b></span></div><small>${esc(count==null?`${label} indisponível`:label)}</small></div>`;
}

const trendTabs=[
  ['weight','Peso'],['fat','Gordura'],['muscle','Músculo'],['training','Treinos'],
  ['nutrition','Nutrição'],['sleep','Sono'],['labs','Exames'],['water','Água']
];

function trendDefinition(model,key){
  const lab=labTrend(state.data.labs||[],state.ui.homeLabMarker,model.bounds);
  const definitions={
    weight:{label:'Peso corporal',route:'bio',points:bodyMetricSeries(state.data.body||[],'weight_kg',model.bounds),unit:' kg',digits:1,description:'Bioimpedâncias na janela selecionada; origens diferentes não são unidas.'},
    fat:{label:'Gordura corporal',route:'bio',points:bodyMetricSeries(state.data.body||[],'body_fat_pct',model.bounds),unit:'%',digits:1,description:'Medições na janela selecionada; origens diferentes não são unidas.'},
    muscle:{label:'Massa muscular',route:'bio',points:bodyMetricSeries(state.data.body||[],'skeletal_muscle_mass_kg',model.bounds),unit:' kg',digits:1,description:'Massa muscular esquelética registrada nas medições.'},
    training:{label:'Treinos por semana',route:'treinos',points:model.trainingSeries,unit:' sessões',digits:0,bar:true,description:'Ritmo semanal dentro da janela selecionada.'},
    nutrition:{label:'Energia registrada',route:'nutricao',points:model.calorieSeries,unit:' kcal',digits:0,description:'Somente dias com total diário inequívoco.'},
    sleep:{label:'Sono registrado',route:'analise',points:model.sleepSeries,unit:' h',digits:1,description:'Uma origem por vez; fontes diferentes não são misturadas.'},
    labs:{label:lab.label,route:'saude',points:lab.points,unit:` ${lab.unit}`,digits:2,description:'Resultado do marcador escolhido no painel abaixo. Métodos diferentes não são unidos.'},
    water:{label:'Água registrada',route:'nutricao',points:model.waterSeries,unit:' mL',digits:0,description:'Ingestão diária registrada; água corporal é outra medida.'}
  };
  const selected=definitions[key]||definitions.weight;
  const points=(selected.points||[]).filter(point=>point?.date&&num(point?.value)!=null);
  const first=points[0]||null,last=points.at(-1)||null;
  const comparable=!['weight','fat','muscle','labs'].includes(key)||points.every(p=>p.cohort&&p.cohort===first?.cohort);
  return{...selected,key,points,first,last,difference:comparable&&first&&last&&first!==last?last.value-first.value:null};
}

function trendChart(points,options={}){
  return `<div class="ltsRefTrendChart">${contextChart(points.map(p=>({...p,cohort:p.cohort??(options.safeCohort?'single-series':null)})),options)}</div>`;
}

function periodPicker(period){
  const options=[['30','30 dias'],['90','90 dias'],['365','1 ano'],['all','Histórico']];
  return `<div class="ltsRefPeriod" role="group" aria-label="Janela da evolução">${options.map(([value,label])=>`<button type="button" data-home-period="${value}" class="${period===value?'active':''}" aria-pressed="${period===value?'true':'false'}">${label}</button>`).join('')}</div>`;
}

function trendPanel(model,period){
  const selectedKey=trendTabs.some(([key])=>key===state.ui.homeMetric)?state.ui.homeMetric:'weight';
  const trend=trendDefinition(model,selectedKey);
  const difference=trend.difference==null?'Sem comparação disponível':`${trend.difference>0?'+':''}${fmtNum(trend.difference,trend.digits)}${trend.unit} desde ${fmtDate(trend.first.date)}`;
  return `<section class="ltsRefTrend"><header><div><span>EVOLUÇÃO LONGITUDINAL</span><h2>${esc(trend.label)}</h2><p>${esc(trend.description)}</p></div><button data-route="${esc(trend.route)}">Abrir detalhes ›</button></header><div class="ltsRefTrendTabs" role="tablist" aria-label="Métrica da evolução">${trendTabs.map(([key,label])=>`<button type="button" role="tab" data-home-metric="${key}" class="${selectedKey===key?'active':''}" aria-selected="${selectedKey===key?'true':'false'}">${label}</button>`).join('')}</div><div class="ltsRefTrendValue"><b>${trend.last?`${fmtNum(trend.last.value,trend.digits)}${esc(trend.unit)}`:'Sem dados'}</b><span>${trend.last?`${fmtDate(trend.last.date)} · ${difference}`:'Nenhum registro comparável nesta janela.'}</span></div>${trendChart(trend.points,{unit:trend.unit,digits:trend.digits,label:trend.label,bounds:model.bounds,selectedDate:state.ui.healthContextDate,bar:trend.bar,safeCohort:!['weight','fat','muscle','labs'].includes(trend.key)})}</section>`;
}

function domain(kind,label,value,detail,route,tone){
  return `<button class="ltsRefDomain ${tone}" data-route="${route}"><div class="ltsRefDomainTop">${icon(kind)}<span>${esc(label)}</span><strong>›</strong></div><b>${esc(value)}</b><small>${esc(detail)}</small></button>`;
}

function withinBounds(value,bounds){
  const key=dateKey(value);
  return Boolean(key&&(!bounds?.start||key>=bounds.start)&&(!bounds?.end||key<=bounds.end));
}

function panorama(model){
  const interval=model.nutrition?.intervalDays||model.bounds?.days;
  const nutritionDays=model.nutrition?.days||0;
  const nutritionCoverage=interval?`${nutritionDays} de ${interval} dias`:`${plural(nutritionDays,'dia registrado','dias registrados')} no histórico`;
  const sleep=model.sleep?.sources?.[0];
  const sleepPoints=sleep?.periodPoints||[];
  const sleepLast=sleepPoints.at(-1)?.date||sleep?.lastDate;
  const water=model.water||[];
  const waterLast=water.at(-1);
  const latestTraining=latest(workoutRows(),'workout_date');
  const treatmentRows=(state.data.treatments||[]).filter(row=>withinBounds(row.event_date,model.bounds));
  const latestTreatment=latest(state.data.treatments,'event_date');
  const nutritionValue=failed('nutrition')?'Indisponível':num(model.nutrition?.calorieAvg)!=null?`${fmtNum(model.nutrition.calorieAvg,0)} kcal/dia`:'Sem alimentação registrada';
  const nutritionDetail=failed('nutrition')?'Os dados não carregaram agora':`${num(model.nutrition?.proteinAvg)!=null?`${fmtNum(model.nutrition.proteinAvg,0)} g proteína/dia · `:''}${nutritionCoverage}${model.nutrition?.latestDate?` · último ${fmtDate(model.nutrition.latestDate)}`:''}`;
  const lab=highlightedLabs((state.data.labs||[]).filter(row=>withinBounds(row.collection_date,model.bounds)))[0];
  const labsValue=failed('labs')?'Indisponível':lab?`${lab.result_raw||fmtNum(lab.result_numeric,2)} ${lab.unit||''}`:model.labs?.windowCollections?'Coleta disponível':`Sem coleta / ${periodLabel(model.period)}`;
  const labsDetail=failed('labs')?'Os dados não carregaram agora':lab?`${lab.biomarker} · ${fmtDate(lab.collection_date)}`:model.labs?.windowLast?`Última coleta ${fmtDate(model.labs.windowLast)}`:model.labs?.last?`Última no histórico ${fmtDate(model.labs.last)}`:'Sem exames registrados';
  const sleepValue=failed('sourceMetrics')?'Indisponível':sleepPoints.length?`${fmtNum(sleepPoints.reduce((sum,p)=>sum+num(p.value),0)/sleepPoints.length,1)} h/noite`:'Sem cobertura';
  const sleepDetail=failed('sourceMetrics')?'Os dados não carregaram agora':sleepLast?`Último ${fmtDate(sleepLast)} · ${safe(sleep.label,'origem registrada')}`:'Sem série comparável na janela';
  const waterValue=water.length?(model.bounds?.days?`${water.length} de ${model.bounds.days} dias`:`${plural(water.length,'dia registrado','dias registrados')} no histórico`):'Histórico pendente';
  const waterDetail=water.length?`Último ${fmtDate(waterLast?.date)}`:'MyFitnessPal ainda não importado';
  const treatmentValue=failed('treatments')?'Indisponível':treatmentRows.length?`Última ${fmtDate(latestTreatment.event_date)}`:'Sem registro na janela';
  const treatmentDetail=failed('treatments')?'Os dados não carregaram agora':latestTreatment?.event_date?`${latestTreatment.medication} · ${medicationContext(latestTreatment)}`:'Sem aplicação registrada';
  return `<section class="ltsRefIntegrated"><header><div><span>PANORAMA · ${esc(periodLabel(model.period).toUpperCase())}</span><h2>Saúde em contexto</h2><p>Resumo dos domínios; toque em uma área para aprofundar.</p></div><button data-route="analise">Análise completa ›</button></header><div class="ltsRefDomainGrid">${domain('training','Treinos',`${model.training?.totalSessions||0} sessões / ${periodLabel(model.period)}`,latestTraining?.workout_date?`Último ${fmtDate(latestTraining.workout_date)}`:'Sem sessão registrada','treinos','training')}${domain('nutrition','Nutrição',nutritionValue,nutritionDetail,'nutricao','nutrition')}${domain('water','Hidratação',waterValue,waterDetail,'nutricao','water')}${domain('labs','Exames',labsValue,labsDetail,'saude','labs')}${domain('recovery','Sono & recuperação',sleepValue,sleepDetail,'analise','recovery')}${domain('medication','Tratamentos & contexto',treatmentValue,treatmentDetail,'tratamentos','medication')}</div></section>`;
}

function recentEvents(model){
  const events=[];
  const latestBody=latest(state.data.body,'measured_at');
  const latestWorkout=latest(workoutRows(),'workout_date');
  const latestNutrition=latest(state.data.nutrition,'nutrition_date');
  const latestTreatment=latest(state.data.treatments,'event_date');
  const latestSleep=model.sleep?.sources?.[0]?.periodPoints?.at(-1)||model.sleep?.sources?.[0]?.points?.at(-1);
  if(latestWorkout)events.push({date:dateKey(latestWorkout.workout_date),kind:'training',route:'treinos',title:safe(latestWorkout.workout_type,'Treino'),detail:[num(latestWorkout.duration_minutes)!=null?`${fmtNum(latestWorkout.duration_minutes,0)} min`:null,latestWorkout.location].filter(Boolean).join(' · ')||'Sessão registrada'});
  if(latestBody)events.push({date:dateKey(latestBody.measured_at),kind:'timeline',route:'bio',title:'Composição corporal',detail:`Medição · ${safe(latestBody.source,'origem registrada')}`});
  if(latestNutrition)events.push({date:dateKey(latestNutrition.nutrition_date),kind:'nutrition',route:'nutricao',title:'Nutrição',detail:'Alimentação registrada'});
  if(model.labs?.last)events.push({date:model.labs.last,kind:'labs',route:'saude',title:'Coleta de exames',detail:highlightedLabs(state.data.labs||[]).slice(0,2).map(r=>`${r.biomarker}: ${r.result_raw||fmtNum(r.result_numeric,2)} ${r.unit||''}`).join(' · ')||'Resultados e referências disponíveis'});
  if(latestTreatment)events.push({date:dateKey(latestTreatment.event_date),kind:'medication',route:'tratamentos',title:latestTreatment.medication||'Aplicação registrada',detail:medicationContext(latestTreatment)});
  if(latestSleep?.date)events.push({date:latestSleep.date,kind:'recovery',route:'analise',title:'Sono & recuperação',detail:'Registro preservado por origem'});
  return events.filter(event=>event.date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(event=>`<button class="ltsRefEvent" data-route="${event.route}"><time>${fmtDate(event.date)}</time>${icon(event.kind)}<span><b>${esc(event.title)}</b><small>${esc(event.detail)}</small></span><i>›</i></button>`).join('');
}

function contextItems(model,rows){
  const items=[];
  const body=rows.at(-1);
  if(failed('body'))items.push(['Composição','A carga falhou nesta atualização; o app não converteu a falha em zero.','bio']);
  else if(body)items.push(['Composição',`Última medição ${fmtDate(body.measured_at)} · ${safe(body.source,'origem registrada')}.`,'bio']);
  else items.push(['Composição','Nenhuma medição disponível.','bio']);
  if(model.water?.length)items.push(['Hidratação',`${model.water.length} dias registrados nesta janela.`,'nutricao']);
  else items.push(['Hidratação','Ainda não há ingestão de água importada do MyFitnessPal.','dados']);
  const domainFailures=Object.values(state.domainStatus||{}).filter(status=>status==='error').length;
  items.push(['Proveniência',domainFailures?`${plural(domainFailures,'domínio','domínios')} não carregaram agora; os demais registros permanecem visíveis.`:'Origens e vínculos preservados nos detalhes.','dados']);
  return items.map(([title,detail,route])=>`<button class="ltsRefContextItem" data-route="${route}"><span><b>${esc(title)}</b><small>${esc(detail)}</small></span><i>›</i></button>`).join('');
}

function changes(model,rows){
  return `<section class="ltsRefChange"><article class="ltsRefEvents"><header><div><span>LINHA DO TEMPO</span><h2>Acontecimentos recentes</h2></div><button data-route="timeline">Abrir Timeline ›</button></header><div>${recentEvents(model)||'<p class="ltsRefEmpty">Nenhum registro disponível.</p>'}</div></article><aside class="ltsRefContext"><header><div><span>CONTEXTO DOS DADOS</span><h2>Cobertura e origem</h2></div><button data-route="dados">Dados & fontes ›</button></header><div>${contextItems(model,rows)}</div></aside></section>`;
}

export function renderProductHomeReference(){
  const rows=bodyRows(),body=rows.at(-1),bodyUnavailable=failed('body');
  const weight=num(body?.weight_kg),fat=num(body?.body_fat_pct),lean=leanMass(body);
  const period=state.ui.homePeriod||'30';
  const model=executiveCockpitModel(state.data,state.domainStatus,period,fixtureMode?null:localHealthDay());
  const cockpit=homeCockpitModel(state.data,state.domainStatus,period,state.ui,localHealthDay());
  model.bounds=cockpit.m.current;
  const review=cockpit.r;
  // Mobile evolution uses the same selected single-origin series as the cockpit.
  model.calorieSeries=cockpit.foodPoints;model.sleepSeries=cockpit.sleepPoints;model.waterSeries=cockpit.waterPoints;
  const context=healthContextModel(state.data,model.bounds,state.ui.homeLabMarker,state.ui.healthContextDate,review.dates);
  const workouts=workoutRows(),today=new Date(),todayKey=localHealthDay(today);
  const todayLabel=new Intl.DateTimeFormat('pt-BR',{timeZone:healthTimeZone,day:'2-digit',month:'2-digit'}).format(today);
  const todayWorkout=workouts.find(row=>dateKey(row.workout_date)===todayKey);
  const todayNutrition=review.nutrition.rows.find(row=>row.date===todayKey);
  const waterAvailable=state.domainStatus.nutrition==='ready'&&state.domainStatus.sourceMetrics==='ready';
  const hydration=waterAvailable?hydrationModel(state.data):{rows:[],conflicts:[]};
  const todayWater=hydration.rows.find(row=>row.date===todayKey);
  const waterConflict=hydration.conflicts.some(row=>row.date===todayKey);
  const todayTreatments=[...(state.data.treatments||[])].filter(row=>dateKey(row.event_date)===todayKey&&row.medication);
  const weeklyTraining=review.training.available?uniqueDays(state.data.workouts,'workout_date',row=>row?.is_canonical===true&&row?.record_status!=='quarantined',today):null;
  const weeklyNutrition=review.nutrition.available?uniqueDays(review.nutrition.rows,'date',row=>num(row.calories_kcal)!=null,today):null;
  const weeklyWater=waterAvailable?uniqueDays(hydration.rows,'date',row=>num(row.value)>0,today):null;
  const weeklySleep=review.sleep.available?uniqueDays(review.sleep.rows,'date',row=>num(row.value)!=null,today):null;
  const medicationRows=todayTreatments.length
    ?todayTreatments.map(row=>todayRow('medication',row.medication,medicationContext(row),'tratamentos',{current:true})).join('')
    :todayRow('medication','Medicações',failed('treatments')?'Aplicações indisponíveis agora':'Nenhuma aplicação registrada hoje','tratamentos');
  const workoutSubtitle=todayWorkout
    ?`${num(todayWorkout.duration_minutes)!=null?`${fmtNum(todayWorkout.duration_minutes,0)} min`:safe(todayWorkout.location,'registro')}${num(todayWorkout.calories_kcal)!=null?` · ${fmtNum(todayWorkout.calories_kcal,0)} kcal${todayWorkout.telemetry_energy_is_estimated?' estimadas':''}`:''}`
    :review.training.available?'Nenhum treino registrado hoje':'Treinos indisponíveis agora';
  const waterSubtitle=!waterAvailable?'Fontes de água indisponíveis agora':waterConflict?'Totais em conflito; consulte as fontes':todayWater?`${fmtNum(todayWater.value,0)} mL registrados hoje`:'Nenhuma ingestão de água registrada hoje';
  const todayCard=`<section class="ltsRefCard ltsRefToday"><header><div><h2>Hoje</h2><span>${esc(todayLabel)}</span></div><button data-route="timeline">Ver dia completo ›</button></header>${todayRow('training',todayWorkout?safe(todayWorkout.workout_type,'Treino'):'Treino',workoutSubtitle,'treinos',{current:Boolean(todayWorkout)})}${medicationRows}${todayRow('water','Água',waterSubtitle,'nutricao',{entry:waterAvailable&&!waterConflict&&!todayWater?'water-import':false,current:Boolean(todayWater)})}${todayRow('nutrition','Dieta',todayNutrition?`${num(todayNutrition.calories_kcal)!=null?`${fmtNum(todayNutrition.calories_kcal,0)} kcal`:''}${num(todayNutrition.protein_g)!=null?` · ${fmtNum(todayNutrition.protein_g,0)} g proteína`:''}`:review.nutrition.available?'Nenhuma alimentação registrada hoje':'Alimentação indisponível agora','nutricao',{current:Boolean(todayNutrition)})}</section>`;
  const progressCard=`<section class="ltsRefCard ltsRefProgress"><header><div><h2>Registros da semana</h2><span>cobertura dos últimos 7 dias</span></div><button data-route="analise">Ver mais ›</button></header><div class="ltsRefProgressGrid">${ring('Treinos',weeklyTraining,'training')}${ring('Dieta',weeklyNutrition,'nutrition')}${ring('Hidratação',weeklyWater,'water')}${ring('Sono',weeklySleep,'sleep')}</div></section>`;
  const unavailableValue=bodyUnavailable?'Erro':rows.length?'Sem dado':'Sem medição';
  return `<section class="ltsHomeV2 ltsHomeReference ltsProductExperience">${renderHomeCockpit(cockpit)}<div class="ltsMobileHome"><header class="ltsRefHeader"><div class="ltsRefBrand"><span class="ltsRefPulse">⌁</span><b>LTS <em>Health</em></b></div><button class="ltsRefAvatar" data-route="dados" aria-label="Abrir dados e fontes">${esc((displayName()||'L')[0].toUpperCase())}</button></header><section class="ltsRefGreeting"><h1>${esc(greeting())}</h1><p>${esc(longDate(today))}</p></section><div class="ltsRefMotto"><span aria-hidden="true">✦</span><b>Disciplina hoje, evolução sempre.</b></div><p class="ltsBodySnapshotDate">${body?`Última bioimpedância · ${fmtDate(body.measured_at)} · ${esc(bodySourceLabel(body))}`:'Sem bioimpedância inequívoca disponível'}</p><section class="ltsRefMetrics">${metric('Peso',weight!=null?`${fmtNum(weight,1)} kg`:unavailableValue,delta(rows,'weight_kg',' kg'),{unavailable:bodyUnavailable})}${metric('Gordura',fat!=null?`${fmtNum(fat,1)}%`:unavailableValue,delta(rows,'body_fat_pct',' p.p.'),{unavailable:bodyUnavailable})}${metric('Massa magra',lean!=null?`${fmtNum(lean,1)} kg`:unavailableValue,deltaFrom(rows,leanMass,' kg'),{unavailable:bodyUnavailable})}</section><div class="ltsRefCoreGrid">${todayCard}${progressCard}</div>${renderHomeReading(cockpit,'mobile')}</div><div class="ltsCockpitWindow">${periodPicker(period)}</div><div class="ltsMobileHome">${trendPanel(model,period)}${panorama(model)}</div><details class="ltsHomeExplore" data-disclosure="home-history"><summary><span><b>Explorar histórico e contexto</b><small>Calendário cruzado, evidências e acontecimentos recentes</small></span><i aria-hidden="true">＋</i></summary>${renderHealthContext(context,state.domainStatus,renderHomeDaySignals(review,context.selectedDate))}${renderHomeEvidenceInsights(state.data,state.domainStatus,model.bounds)}${changes(model,rows)}</details></section>`;
}
