import {state,esc,fmtDate,fmtNum,num,workoutRows,day,periodLabel} from './core.js';
import {executiveCockpitModel} from './today-screen.js';

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
  const hour=new Date().getHours();
  const base=hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';
  const name=displayName();
  return name?`${base}, ${name}`:base;
}

function longDate(value=new Date()){
  try{
    return new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(value).replace(/^./,letter=>letter.toUpperCase());
  }catch{return'';}
}

function bodyRows(){
  const rows=[...(state.data.body||[])]
    .filter(row=>row?.measured_at&&num(row.weight_kg)!=null)
    .sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at)));
  const anchor=rows.at(-1);
  if(!anchor)return[];
  const coherent=anchor.source?rows.filter(row=>row.source===anchor.source):rows.length===1?rows:[];
  const output=[];
  const seen=new Set();
  for(const row of coherent){
    const key=dateKey(row.measured_at);
    if(key&&!seen.has(key)){seen.add(key);output.push(row);}
  }
  return output;
}

function leanMass(row){
  const weight=num(row?.weight_kg),fatMass=num(row?.fat_mass_kg);
  return weight==null||fatMass==null?null:weight-fatMass;
}

function deltaFrom(rows,read,unit=''){
  const current=read(rows.at(-1)),previous=read(rows.at(-2));
  if(current==null||previous==null)return{value:'—',label:'sem comparação'};
  const difference=current-previous;
  return{value:`${difference>0?'+':''}${fmtNum(difference,1)}${unit}`,label:'vs. medição anterior'};
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
  const end=new Date(anchor),start=new Date(anchor);
  end.setHours(23,59,59,999);
  start.setDate(start.getDate()-6);
  start.setHours(0,0,0,0);
  const dates=new Set();
  for(const row of rows||[]){
    if(!predicate(row)||!row?.[key])continue;
    const value=new Date(String(row[key]).length===10?`${row[key]}T12:00:00`:row[key]);
    if(!Number.isNaN(value.getTime())&&value>=start&&value<=end)dates.add(dateKey(row[key]));
  }
  return Math.min(7,dates.size);
}

function ring(label,count,kind){
  const progress=Math.max(0,Math.min(100,count/7*100));
  return `<div class="ltsRefProgressItem ${kind}"><div class="ltsRefRing" style="--progress:${progress}%"><span><b>${count}/7</b></span></div><small>${esc(label)}</small></div>`;
}

const trendTabs=[
  ['weight','Peso'],['fat','Gordura'],['muscle','Músculo'],['training','Treinos'],
  ['nutrition','Nutrição'],['sleep','Sono'],['labs','Exames'],['water','Água']
];

function trendDefinition(model,key){
  const definitions={
    weight:{label:'Peso corporal',route:'bio',points:model.weightSeries,unit:' kg',digits:1,description:'Medições consolidadas com a origem preservada.'},
    fat:{label:'Gordura corporal',route:'bio',points:model.bodyFatSeries,unit:'%',digits:1,description:'Medições comparáveis de composição corporal.'},
    muscle:{label:'Massa muscular',route:'bio',points:model.muscleSeries,unit:' kg',digits:1,description:'Massa muscular esquelética registrada nas medições.'},
    training:{label:'Treinos por semana',route:'treinos',points:model.trainingSeries,unit:' sessões',digits:0,bar:true,description:'Ritmo semanal dentro da janela selecionada.'},
    nutrition:{label:'Energia registrada',route:'nutricao',points:model.calorieSeries,unit:' kcal',digits:0,description:'Somente dias com total diário inequívoco.'},
    sleep:{label:'Sono registrado',route:'analise',points:model.sleepSeries,unit:' h',digits:1,description:'Uma origem por vez; fontes diferentes não são misturadas.'},
    labs:{label:'Resultados por coleta',route:'saude',points:model.labSeries,unit:' resultados',digits:0,bar:true,description:'Quantidade de resultados estruturados em cada coleta.'},
    water:{label:'Água registrada',route:'nutricao',points:model.waterSeries,unit:' mL',digits:0,description:'Ingestão diária registrada; água corporal é outra medida.'}
  };
  const selected=definitions[key]||definitions.weight;
  const points=(selected.points||[]).filter(point=>point?.date&&num(point?.value)!=null);
  const first=points[0]||null,last=points.at(-1)||null;
  return{...selected,key,points,first,last,difference:first&&last&&first!==last?last.value-first.value:null};
}

function trendChart(points,{unit='',digits=0,label='',bar=false}={}){
  const rows=(points||[]).filter(point=>point?.date&&num(point?.value)!=null).slice(-36);
  if(rows.length<2)return '<div class="ltsRefTrendEmpty">Sem pontos suficientes nesta janela.</div>';
  const values=rows.map(row=>Number(row.value));
  const low=bar?0:Math.min(...values),high=Math.max(...values),span=Math.max(high-low,1),padding=bar?0:span*.14;
  const min=bar?0:low-padding,max=bar?Math.max(high,1):high+padding;
  const width=640,height=174,left=48,right=14,top=14,bottom=30,plotWidth=width-left-right,plotHeight=height-top-bottom;
  const x=index=>left+index*plotWidth/Math.max(1,rows.length-1);
  const y=value=>top+(max-value)*plotHeight/Math.max(max-min,1e-9);
  const ticks=[max,max-(max-min)/2,min];
  const grid=ticks.map(value=>`<line x1="${left}" y1="${y(value).toFixed(1)}" x2="${width-right}" y2="${y(value).toFixed(1)}"/>`).join('');
  const labels=ticks.map(value=>`<text x="${left-7}" y="${(y(value)+4).toFixed(1)}" text-anchor="end">${esc(fmtNum(value,digits))}</text>`).join('');
  const marks=bar
    ?rows.map((row,index)=>{const barWidth=Math.max(5,Math.min(25,plotWidth/rows.length*.52));return `<rect x="${(x(index)-barWidth/2).toFixed(1)}" y="${y(row.value).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(1,y(min)-y(row.value)).toFixed(1)}" rx="3"><title>${esc(fmtDate(row.date))}: ${esc(fmtNum(row.value,digits))}${esc(unit)}</title></rect>`;}).join('')
    :(()=>{const path=rows.map((row,index)=>`${index?'L':'M'}${x(index).toFixed(1)} ${y(row.value).toFixed(1)}`).join(' ');return `<path class="ltsRefTrendLine" d="${path}"/>${rows.map((row,index)=>`<circle cx="${x(index).toFixed(1)}" cy="${y(row.value).toFixed(1)}" r="3"><title>${esc(fmtDate(row.date))}: ${esc(fmtNum(row.value,digits))}${esc(unit)}</title></circle>`).join('')}`;})();
  return `<div class="ltsRefTrendChart" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><g class="ltsRefTrendGridLines">${grid}</g><g class="ltsRefTrendAxis">${labels}</g><g class="ltsRefTrendMarks">${marks}</g></svg><div><span>${fmtDate(rows[0].date)}</span><span>${fmtDate(rows.at(-1).date)}</span></div></div>`;
}

function periodPicker(period){
  const options=[['30','30 dias'],['90','90 dias'],['365','1 ano'],['all','Histórico']];
  return `<div class="ltsRefPeriod" role="group" aria-label="Janela da evolução">${options.map(([value,label])=>`<button type="button" data-home-period="${value}" class="${period===value?'active':''}" aria-pressed="${period===value?'true':'false'}">${label}</button>`).join('')}</div>`;
}

function trendPanel(model,period){
  const selectedKey=trendTabs.some(([key])=>key===state.ui.homeMetric)?state.ui.homeMetric:'weight';
  const trend=trendDefinition(model,selectedKey);
  const difference=trend.difference==null?'Sem comparação disponível':`${trend.difference>0?'+':''}${fmtNum(trend.difference,trend.digits)}${trend.unit} desde ${fmtDate(trend.first.date)}`;
  return `<section class="ltsRefTrend"><header><div><span>EVOLUÇÃO LONGITUDINAL</span><h2>${esc(trend.label)}</h2><p>${esc(trend.description)}</p></div><button data-route="${esc(trend.route)}">Abrir detalhes ›</button></header>${periodPicker(period)}<div class="ltsRefTrendTabs" role="tablist" aria-label="Métrica da evolução">${trendTabs.map(([key,label])=>`<button type="button" role="tab" data-home-metric="${key}" class="${selectedKey===key?'active':''}" aria-selected="${selectedKey===key?'true':'false'}">${label}</button>`).join('')}</div><div class="ltsRefTrendValue"><b>${trend.last?`${fmtNum(trend.last.value,trend.digits)}${esc(trend.unit)}`:'Sem dados'}</b><span>${trend.last?`${fmtDate(trend.last.date)} · ${difference}`:'Nenhum registro comparável nesta janela.'}</span></div>${trendChart(trend.points,{unit:trend.unit,digits:trend.digits,label:trend.label,bar:trend.bar})}</section>`;
}

function domain(kind,label,value,detail,route,tone){
  return `<button class="ltsRefDomain ${tone}" data-route="${route}"><div class="ltsRefDomainTop">${icon(kind)}<span>${esc(label)}</span><strong>›</strong></div><b>${esc(value)}</b><small>${esc(detail)}</small></button>`;
}

function withinBounds(value,bounds){
  const key=dateKey(value);
  return Boolean(key&&(!bounds?.start||key>=bounds.start)&&(!bounds?.end||key<=bounds.end));
}

function panorama(model){
  const interval=model.nutrition?.intervalDays||model.bounds?.days||30;
  const nutritionDays=model.nutrition?.days||0;
  const nutritionCoverage=model.nutrition?.coveragePct;
  const sleep=model.sleep?.sources?.[0];
  const sleepPoints=sleep?.periodPoints||[];
  const sleepLast=sleepPoints.at(-1)?.date||sleep?.lastDate;
  const water=model.water||[];
  const waterLast=water.at(-1);
  const latestTraining=latest(workoutRows(),'workout_date');
  const treatmentRows=(state.data.treatments||[]).filter(row=>withinBounds(row.event_date,model.bounds));
  const latestTreatment=latest(state.data.treatments,'event_date');
  const nutritionValue=failed('nutrition')?'Indisponível':model.nutrition?.available?`${nutritionDays} de ${interval} dias`:'Sem cobertura';
  const nutritionDetail=failed('nutrition')?'Os dados não carregaram agora':model.nutrition?.latestAmbiguous?'Último dia com totais conflitantes':nutritionCoverage==null?'Totais diários preservados':`${nutritionCoverage}% cobertura${model.nutrition?.latestDate?` · último ${fmtDate(model.nutrition.latestDate)}`:''}`;
  const labsValue=failed('labs')?'Indisponível':model.labs?.windowCollections?plural(model.labs.windowCollections,'coleta','coletas'):`Sem coleta / ${periodLabel(model.period)}`;
  const labsDetail=failed('labs')?'Os dados não carregaram agora':model.labs?.windowLast?`Última ${fmtDate(model.labs.windowLast)} · ${plural(model.labs.windowMarkers,'marcador','marcadores')}`:model.labs?.last?`Última no histórico ${fmtDate(model.labs.last)}`:'Sem exames estruturados';
  const sleepValue=failed('sourceMetrics')?'Indisponível':sleep?`${sleepPoints.length} de ${model.bounds?.days||30} dias`:'Sem cobertura';
  const sleepDetail=failed('sourceMetrics')?'Os dados não carregaram agora':sleepLast?`Último ${fmtDate(sleepLast)} · ${safe(sleep.label,'origem registrada')}`:'Sem série comparável na janela';
  const waterValue=water.length?`${water.length} de ${model.bounds?.days||30} dias`:'Histórico pendente';
  const waterDetail=water.length?`Último ${fmtDate(waterLast?.date)}`:'MyFitnessPal ainda não importado';
  const treatmentValue=failed('treatments')?'Indisponível':treatmentRows.length?plural(treatmentRows.length,'registro','registros'):'Sem registro na janela';
  const treatmentDetail=failed('treatments')?'Os dados não carregaram agora':latestTreatment?.event_date?`Último ${fmtDate(latestTreatment.event_date)}`:'Sem contexto estruturado';
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
  if(latestNutrition)events.push({date:dateKey(latestNutrition.nutrition_date),kind:'nutrition',route:'nutricao',title:'Nutrição',detail:'Dia alimentar estruturado'});
  if(model.labs?.last)events.push({date:model.labs.last,kind:'labs',route:'saude',title:'Exames',detail:`${plural(model.labs.totalResults,'resultado estruturado','resultados estruturados')} no histórico`});
  if(latestTreatment)events.push({date:dateKey(latestTreatment.event_date),kind:'medication',route:'tratamentos',title:'Tratamento & contexto',detail:'Registro preservado no histórico'});
  if(latestSleep?.date)events.push({date:latestSleep.date,kind:'recovery',route:'analise',title:'Sono & recuperação',detail:'Registro preservado por origem'});
  return events.filter(event=>event.date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(event=>`<button class="ltsRefEvent" data-route="${event.route}"><time>${fmtDate(event.date)}</time>${icon(event.kind)}<span><b>${esc(event.title)}</b><small>${esc(event.detail)}</small></span><i>›</i></button>`).join('');
}

function contextItems(model,rows){
  const items=[];
  const body=rows.at(-1);
  if(failed('body'))items.push(['Composição','A carga falhou nesta atualização; o app não converteu a falha em zero.','bio']);
  else if(body)items.push(['Composição',`Última medição ${fmtDate(body.measured_at)} · ${safe(body.source,'origem registrada')}.`,'bio']);
  else items.push(['Composição','Nenhuma medição estruturada disponível.','bio']);
  if(model.water?.length)items.push(['Hidratação',`${model.water.length} dias registrados nesta janela.`,'nutricao']);
  else items.push(['Hidratação','Extrator do MyFitnessPal pronto; execução autenticada permanece pendente.','dados']);
  const domainFailures=Object.values(state.domainStatus||{}).filter(status=>status==='error').length;
  items.push(['Proveniência',domainFailures?`${plural(domainFailures,'domínio','domínios')} não carregaram agora; os demais registros permanecem visíveis.`:'Origens e vínculos preservados nos detalhes.','dados']);
  return items.map(([title,detail,route])=>`<button class="ltsRefContextItem" data-route="${route}"><span><b>${esc(title)}</b><small>${esc(detail)}</small></span><i>›</i></button>`).join('');
}

function changes(model,rows){
  return `<section class="ltsRefChange"><article class="ltsRefEvents"><header><div><span>LINHA DO TEMPO</span><h2>Acontecimentos recentes</h2></div><button data-route="timeline">Abrir Timeline ›</button></header><div>${recentEvents(model)||'<p class="ltsRefEmpty">Nenhum acontecimento estruturado disponível.</p>'}</div></article><aside class="ltsRefContext"><header><div><span>CONTEXTO DOS DADOS</span><h2>Cobertura e origem</h2></div><button data-route="dados">Dados & fontes ›</button></header><div>${contextItems(model,rows)}</div></aside></section>`;
}

export function renderProductHomeReference(){
  const rows=bodyRows(),body=rows.at(-1),bodyUnavailable=failed('body');
  const weight=num(body?.weight_kg),fat=num(body?.body_fat_pct),lean=leanMass(body);
  const period=state.ui.homePeriod||'30';
  const model=executiveCockpitModel(state.data,state.domainStatus,period);
  const workouts=workoutRows(),today=new Date(),todayKey=dateKey(today.toISOString());
  const todayLabel=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit'}).format(today);
  const todayWorkout=workouts.find(row=>dateKey(row.workout_date)===todayKey);
  const todayNutrition=[...(state.data.nutrition||[])].filter(row=>dateKey(row.nutrition_date)===todayKey).at(-1);
  const todayWater=[...(state.data.nutrition||[])].find(row=>dateKey(row.nutrition_date)===todayKey&&num(row.water_ml)>0);
  const todayTreatments=[...(state.data.treatments||[])].filter(row=>dateKey(row.event_date)===todayKey&&row.medication);
  const weeklyTraining=uniqueDays(state.data.workouts,'workout_date',row=>row?.is_canonical===true&&row?.record_status!=='quarantined',today);
  const weeklyNutrition=uniqueDays(state.data.nutrition,'nutrition_date',row=>num(row.calories_kcal)!=null,today);
  const weeklyWater=uniqueDays(state.data.nutrition,'nutrition_date',row=>num(row.water_ml)>0,today);
  const sleepRows=[
    ...(state.data.metrics||[]),
    ...(state.data.sourceMetrics||[]).map(row=>({...row,measured_at:row.metric_date}))
  ];
  const weeklySleep=uniqueDays(sleepRows,'measured_at',row=>String(row?.metric_type||'').includes('sleep')&&num(row?.value)!=null,today);
  const medicationRows=todayTreatments.length
    ?todayTreatments.map(row=>todayRow('medication',row.medication,'Aplicação registrada hoje','tratamentos',{current:true})).join('')
    :todayRow('medication','Medicações','Nenhuma aplicação registrada hoje','tratamentos');
  const workoutSubtitle=todayWorkout
    ?`${num(todayWorkout.duration_minutes)!=null?`${fmtNum(todayWorkout.duration_minutes,0)} min`:safe(todayWorkout.location,'registro')}${num(todayWorkout.calories_kcal)!=null?` · ${fmtNum(todayWorkout.calories_kcal,0)} kcal${todayWorkout.telemetry_energy_is_estimated?' estimadas':''}`:''}`
    :'Nenhum treino registrado hoje';
  const todayCard=`<section class="ltsRefCard ltsRefToday"><header><div><h2>Hoje</h2><span>${esc(todayLabel)}</span></div><button data-route="timeline">Ver dia completo ›</button></header>${todayRow('training',todayWorkout?safe(todayWorkout.workout_type,'Treino'):'Treino',workoutSubtitle,'treinos',{current:Boolean(todayWorkout)})}${medicationRows}${todayRow('water','Água',todayWater?`${fmtNum(num(todayWater.water_ml)/1000,1)} L registrados hoje`:'Nenhuma hidratação estruturada hoje','nutricao',{entry:todayWater?false:'water-import',current:Boolean(todayWater)})}${todayRow('nutrition','Dieta',todayNutrition?`${num(todayNutrition.calories_kcal)!=null?`${fmtNum(todayNutrition.calories_kcal,0)} kcal`:''}${num(todayNutrition.protein_g)!=null?` · ${fmtNum(todayNutrition.protein_g,0)} g proteína`:''}`:'Nenhuma alimentação estruturada hoje','nutricao',{current:Boolean(todayNutrition)})}</section>`;
  const progressCard=`<section class="ltsRefCard ltsRefProgress"><header><div><h2>Progresso semanal</h2><span>cobertura dos últimos 7 dias</span></div><button data-route="analise">Ver mais ›</button></header><div class="ltsRefProgressGrid">${ring('Treinos',weeklyTraining,'training')}${ring('Dieta',weeklyNutrition,'nutrition')}${ring('Hidratação',weeklyWater,'water')}${ring('Sono',weeklySleep,'sleep')}</div></section>`;
  const unavailableValue=bodyUnavailable?'Erro':rows.length?'Sem dado':'Sem medição';
  return `<section class="ltsHomeV2 ltsHomeReference"><header class="ltsRefHeader"><div class="ltsRefBrand"><span class="ltsRefPulse">⌁</span><b>LTS <em>Health</em></b></div><button class="ltsRefAvatar" data-route="dados" aria-label="Abrir dados e fontes">${esc((displayName()||'L')[0].toUpperCase())}</button></header><section class="ltsRefGreeting"><h1>${esc(greeting())}</h1><p>${esc(longDate(today))}</p></section><div class="ltsRefMotto"><span aria-hidden="true">✦</span><b>Disciplina hoje, evolução sempre.</b></div><section class="ltsRefMetrics">${metric('Peso',weight!=null?`${fmtNum(weight,1)} kg`:unavailableValue,delta(rows,'weight_kg',' kg'),{unavailable:bodyUnavailable})}${metric('Gordura',fat!=null?`${fmtNum(fat,1)}%`:unavailableValue,delta(rows,'body_fat_pct',' p.p.'),{unavailable:bodyUnavailable})}${metric('Massa magra',lean!=null?`${fmtNum(lean,1)} kg`:unavailableValue,deltaFrom(rows,leanMass,' kg'),{unavailable:bodyUnavailable})}</section><div class="ltsRefCoreGrid">${todayCard}${progressCard}${trendPanel(model,period)}</div>${panorama(model)}${changes(model,rows)}</section>`;
}
