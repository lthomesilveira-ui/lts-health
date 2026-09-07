import {state,esc,day,fmtDate,fmtNum,num,norm,unique} from './core.js';
import {
  bodyChangeModel,trainingDistributionModel,comparablePerformanceModel,
  nutritionPeriodModel,sleepCoverageModel,periodBounds,referenceDayFor
} from './integrated-analysis.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1>${description?`<p>${esc(description)}</p>`:''}</div></div>`;
const failed=key=>state.domainStatus?.[key]==='error';
const metric=(label,value,sub='')=>`<div class="card metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<em>${esc(sub)}</em>`:''}</div>`;
const deltaText=(value,digits=1,unit='')=>{const n=num(value);return n==null?'—':`${n>0?'+':''}${fmtNum(n,digits)}${unit?` ${unit}`:''}`;};
const periodLabel=period=>period==='30'?'30 dias':period==='90'?'90 dias':period==='365'?'1 ano':'todo o histórico';
const inBounds=(value,bounds)=>{const d=day(value);return Boolean(d&&(!bounds.start||d>=bounds.start)&&(!bounds.end||d<=bounds.end));};
const reviewState=(heading,body)=>`<div class="empty"><b>${esc(heading)}</b><br>${esc(body)}</div>`;

const complementarySignalDefs={
  steps:{label:'Passos',digits:0},
  resting_heart_rate_bpm:{label:'Frequência cardíaca em repouso',digits:0},
  hrv_sdnn_ms:{label:'Variabilidade da frequência cardíaca (SDNN)',digits:0},
  respiratory_rate_bpm:{label:'Frequência respiratória',digits:1},
  oxygen_saturation_pct:{label:'Saturação de oxigênio',digits:1}
};
const complementarySourceLabels={apple_watch:'Apple Watch',iphone:'iPhone',polar_flow:'Polar Flow',healthkit_candidate:'Apple Saúde',ringconn:'RingConn'};

export function complementarySignalSeries(rows,bounds={start:null,end:null}){
  const groups=new Map();
  for(const row of rows||[]){
    if(!['candidate','held'].includes(norm(row?.canonical_status)))continue;
    const metric=String(row?.metric_type||''),definition=complementarySignalDefs[metric];
    if(!definition||!inBounds(row?.metric_date,bounds))continue;
    const value=num(row?.value),date=day(row?.metric_date),unit=String(row?.unit||'').trim()||'unidade não informada';
    if(value==null||!date)continue;
    const family=String(row?.source_family||'other'),identity=String(row?.source_name||row?.source_family||'Outra origem'),key=`${family}\u0000${identity}\u0000${metric}\u0000${unit}`;
    if(!groups.has(key))groups.set(key,{family,identity,metric,unit,rows:[]});
    groups.get(key).rows.push({date,value});
  }
  const series=[];
  for(const group of groups.values()){
    const byDate=new Map();
    for(const row of group.rows){if(!byDate.has(row.date))byDate.set(row.date,[]);byDate.get(row.date).push(row.value);}
    const points=[...byDate.entries()].filter(([,values])=>values.length===1).map(([date,values])=>({date,value:values[0]})).sort((a,b)=>a.date.localeCompare(b.date));
    const reviewDays=[...byDate.values()].filter(values=>values.length!==1).length;
    if(!points.length)continue;
    series.push({...group,points,reviewDays,first:points[0],last:points.at(-1),baseLabel:complementarySourceLabels[group.family]||'Outra origem'});
  }
  return series.sort((a,b)=>a.metric.localeCompare(b.metric)||a.baseLabel.localeCompare(b.baseLabel,'pt-BR'));
}

function labSnapshot(rows,bounds=null){
  const safe=(rows||[]).filter(r=>!bounds||inBounds(r.collection_date,bounds)),dates=unique(safe.map(r=>day(r.collection_date)).filter(Boolean)).sort();
  return{rows:safe,total:safe.length,collections:dates.length,last:dates.at(-1)||null,markers:unique(safe.map(r=>String(r.biomarker||'').trim()).filter(Boolean)).length};
}
function protocolCount(data,bounds){return(data.treatments||[]).filter(r=>inBounds(r.event_date,bounds)).length;}
function hydrationSummary(nutrition){
  if(!nutrition?.available)return{days:0,avg:null};
  return{days:Number(nutrition.waterDays||0),avg:num(nutrition.waterAvgMl)};
}
function bodyCard(body){
  if(failed('body'))return`<div class="card"><div class="cardHead"><div><b>Composição global</b><small>Última comparação disponível no histórico.</small></div></div>${reviewState('Composição indisponível','As medições não carregaram agora.')}</div>`;
  if(!body.available){
    const heading=body.reason==='ambiguous'?'Composição em revisão':'Comparação indisponível';
    const text=body.reason==='source_changed'?'As medições preservadas têm origens diferentes e não foram comparadas.':body.reason==='ambiguous'?'Há mais de uma medição na mesma data. Nenhuma diferença foi calculada.':'Ainda não há duas medições comparáveis no histórico.';
    return`<div class="card"><div class="cardHead"><div><b>Composição global</b><small>Última comparação disponível no histórico.</small></div></div>${reviewState(heading,text)}</div>`;
  }
  return`<div class="card"><div class="cardHead"><div><b>Composição global</b><small>Últimas duas medições comparáveis, independentemente da janela recente.</small></div><span class="pill">${fmtDate(body.previous.measured_at)} → ${fmtDate(body.latest.measured_at)}</span></div><div class="grid cols2 compact sectionGap">${metric('Peso',deltaText(body.delta.weightKg,1,'kg'),'mudança observada')}${metric('Massa muscular',deltaText(body.delta.muscleKg,1,'kg'),'mudança observada')}${metric('Massa de gordura',deltaText(body.delta.fatKg,1,'kg'),'mudança observada')}${metric('Gordura corporal',deltaText(body.delta.bodyFatPp,1,'p.p.'),'mudança observada')}</div><p class="footerNote">Comparação descritiva entre ${fmtDate(body.previous.measured_at)} e ${fmtDate(body.latest.measured_at)}. Nenhuma causa é atribuída automaticamente.</p></div>`;
}
function labsCard(history,window,period){
  if(failed('labs'))return`<div class="card"><div class="cardHead"><div><b>Exames</b><small>Histórico laboratorial conhecido.</small></div></div>${reviewState('Exames indisponíveis','Os resultados não carregaram agora.')}</div>`;
  if(!history.total)return`<div class="card"><div class="cardHead"><div><b>Exames</b><small>Histórico laboratorial conhecido.</small></div></div>${reviewState('Sem exames estruturados','Nenhum resultado foi encontrado no histórico carregado.')}</div>`;
  return`<div class="card"><div class="cardHead"><div><b>Exames</b><small>O histórico não desaparece quando a janela recente não tem coleta.</small></div><span class="pill">última ${fmtDate(history.last)}</span></div><div class="grid cols3 compact sectionGap">${metric('Resultados',String(history.total),'no histórico')}${metric('Datas de coleta',String(history.collections),'no histórico')}${metric('Na janela',String(window.collections),periodLabel(period))}</div><p class="footerNote">${history.markers} marcador(es) estruturado(s) no histórico. Comparações detalhadas continuam em Exames quando nome, origem e unidade permitem.</p></div>`;
}
function windowLead({period,bounds,training,nutrition,sleep,protocols}){
  return`<section class="analysisLead"><div class="analysisLeadHead"><div><span>Janela recente</span><h2>O que aconteceu nos ${esc(periodLabel(period))}</h2></div><small>Treino, nutrição e recuperação seguem esta janela.</small></div><div class="analysisInterval"><b>${bounds.start?fmtDate(bounds.start):'Início do histórico'} → ${bounds.end?fmtDate(bounds.end):'Hoje'}</b><span>Mesma janela para os sinais de maior frequência.</span></div><div class="grid cols4 analysisSecondaryMetrics">${metric('Treinos',training.available?String(training.totalSessions):'—','sessões canônicas')}${metric('Nutrição',nutrition.available?`${nutrition.days} dias`:'—','totais diários inequívocos')}${metric('Sono',sleep.available?`${sleep.days} dias`:'—','evidência preservada')}${metric('Protocolos',String(protocols),'eventos históricos')}</div></section>`;
}
function trainingCard(training,performance){
  if(failed('workouts'))return`<div class="card"><div class="cardHead"><div><b>Treino</b><small>Resumo da janela recente.</small></div></div>${reviewState('Treinos indisponíveis','O histórico não carregou agora.')}</div>`;
  const top=(training.rows||[]).slice(0,5),max=Math.max(1,...top.map(r=>r.sessions||0));
  return`<div class="card"><div class="cardHead"><div><b>Treino</b><small>Distribuição dos treinos na janela recente.</small></div><span class="pill">${training.totalSessions||0} sessões</span></div><div class="analysisBars sectionGap">${top.map(r=>`<div class="analysisBarRow"><span>${esc(r.label)}</span><div><i style="width:${Math.max(6,(r.sessions||0)/max*100)}%"></i></div><b>${r.sessions||0}</b></div>`).join('')||'<p class="footerNote">Sem grupos estruturados nesta janela.</p>'}</div>${performance?.length?`<div class="analysisPerformance sectionGap">${performance.slice(0,2).map(p=>`<div><span>${esc(p.exercise)}</span><b>${fmtNum(p.previousWeight,1)} → ${fmtNum(p.weight,1)} ${esc(p.unit)}</b><small>${fmtDate(p.previousDate)} → ${fmtDate(p.date)} · comparação apenas com carga e unidade compatíveis</small></div>`).join('')}</div>`:''}</div>`;
}
function nutritionCard(nutrition){
  if(failed('nutrition'))return`<div class="card"><div class="cardHead"><div><b>Nutrição e hidratação</b><small>Resumo da janela recente.</small></div></div>${reviewState('Nutrição indisponível','Os totais diários não carregaram agora.')}</div>`;
  if(!nutrition.available)return`<div class="card"><div class="cardHead"><div><b>Nutrição e hidratação</b><small>Resumo da janela recente.</small></div></div>${reviewState('Sem cobertura nutricional','Não há totais diários comparáveis nesta janela.')}</div>`;
  const water=hydrationSummary(nutrition);
  return`<div class="card"><div class="cardHead"><div><b>Nutrição e hidratação</b><small>Médias apenas dos dias estruturados desta janela.</small></div><span class="pill">${nutrition.days} dias</span></div><div class="grid cols3 compact sectionGap">${metric('Calorias médias',nutrition.calorieAvg==null?'Sem dado':`${fmtNum(nutrition.calorieAvg,0)} kcal`)}${metric('Proteína média',nutrition.proteinAvg==null?'Sem dado':`${fmtNum(nutrition.proteinAvg,0)} g`)}${metric('Carboidratos médios',nutrition.carbAvg==null?'Sem dado':`${fmtNum(nutrition.carbAvg,0)} g`)}${metric('Gordura média',nutrition.fatAvg==null?'Sem dado':`${fmtNum(nutrition.fatAvg,0)} g`)}${metric('Fibra média',nutrition.fiberAvg==null?'Sem dado':`${fmtNum(nutrition.fiberAvg,0)} g`)}${metric('Água ingerida',water.days&&water.avg!=null?`${fmtNum(water.avg,0)} mL`:'Sem dado',water.days?`${water.days} dia(s) com volume`:'nenhum zero é inferido')}</div></div>`;
}
function recoveryCard(sleep,signals,bounds){
  if(failed('sourceMetrics'))return`<div class="card"><div class="cardHead"><div><b>Recuperação</b><small>Sono e sinais complementares.</small></div></div>${reviewState('Recuperação indisponível','Os registros complementares não carregaram agora.')}</div>`;
  const sources=unique((sleep.sources||[]).map(s=>s.source).filter(Boolean)).length;
  const signalRows=signals.filter(s=>s.points.length);
  return`<div class="card"><div class="cardHead"><div><b>Recuperação</b><small>Sem média entre aparelhos ou origens diferentes.</small></div><span class="pill">${sleep.days||0} dias de sono</span></div>${sleep.available?`<div class="grid cols2 compact sectionGap">${metric('Sono estruturado',`${sleep.days} dias`,`${sources||sleep.sources?.length||0} origem(ns) preservada(s)`) }${metric('Sinais complementares',String(signalRows.length),'séries candidate/held na janela')}</div>`:reviewState('Sem sono estruturado','Não há evidência de sono nesta janela.')}${signalRows.length?`<p class="footerNote">Também há ${signalRows.length} série(s) complementar(es) preservada(s) em ${fmtDate(bounds.start)}–${fmtDate(bounds.end)}. Elas permanecem separadas por origem.</p>`:''}</div>`;
}
function digest(body,labs,training,nutrition,sleep,period){
  const cards=[];
  if(body.available)cards.push(`<article class="analysisDigestCard change"><span>Composição</span><h3>${fmtDate(body.latest.measured_at)}</h3><p>Última comparação disponível contra ${fmtDate(body.previous.measured_at)}: músculo ${deltaText(body.delta.muscleKg,1,'kg')} e gordura ${deltaText(body.delta.fatKg,1,'kg')}.</p><button data-route="bio">Abrir composição →</button></article>`);
  else cards.push(`<article class="analysisDigestCard attention"><span>Composição</span><h3>Comparação indisponível</h3><p>Os registros permanecem preservados; nenhuma diferença foi inventada.</p><button data-route="bio">Abrir composição →</button></article>`);
  cards.push(`<article class="analysisDigestCard"><span>Janela recente</span><h3>${training.totalSessions||0} treinos</h3><p>${nutrition.days||0} dia(s) de nutrição e ${sleep.days||0} dia(s) de sono em ${periodLabel(period)}.</p><button data-route="treinos">Abrir treinos →</button></article>`);
  cards.push(`<article class="analysisDigestCard context"><span>Exames</span><h3>${labs.last?fmtDate(labs.last):'Sem histórico'}</h3><p>${labs.total||0} resultado(s) estruturado(s) em ${labs.collections||0} data(s) de coleta no histórico.</p><button data-route="saude">Abrir exames →</button></article>`);
  return`<section class="analysisDigest"><div class="analysisDigestHead"><div><span>Resumo executivo</span><h2>Três respostas antes dos detalhes</h2></div><small>Estado conhecido + janela recente, sem misturar cadências.</small></div><div class="analysisDigestGrid">${cards.join('')}</div></section>`;
}
function limitations(body,labs,nutrition,sleep){
  const rows=[];
  if(!body.available)rows.push('Composição: ainda não há duas medições históricas comparáveis com continuidade segura.');
  if(!labs.total)rows.push('Exames: nenhum resultado estruturado está disponível no histórico carregado.');
  if(!nutrition.available)rows.push('Nutrição: a janela selecionada não tem cobertura diária suficiente para médias.');
  if(!nutrition.waterDays)rows.push('Hidratação: ingestão de água não está estruturada; ausência de dado não é tratada como zero.');
  if(!sleep.available)rows.push('Recuperação: não há sono estruturado na janela selecionada.');
  if(!rows.length)rows.push('Os domínios principais têm cobertura para esta leitura. Limitações específicas de origem permanecem nas telas de detalhe.');
  return`<div class="card"><div class="cardHead"><div><b>O que ainda limita a leitura</b><small>Lacunas reais, sem transformar ausência em valor.</small></div></div><div class="limitationList sectionGap">${rows.map(r=>`<div>${esc(r)}</div>`).join('')}</div></div>`;
}

export function renderAnalysisHub(){
  const period=state.ui.analysisPeriod||'365',referenceDay=referenceDayFor(state.data),bounds=periodBounds(period,referenceDay);
  const body=bodyChangeModel(state.data,state.domainStatus,null,null);
  const training=trainingDistributionModel(state.data,state.domainStatus,bounds.start,bounds.end);
  const performance=comparablePerformanceModel(state.data,state.domainStatus,4,bounds.start,bounds.end);
  const nutrition=nutritionPeriodModel(state.data,state.domainStatus,bounds.start,bounds.end);
  const sleep=sleepCoverageModel(state.data,state.domainStatus,bounds.start,bounds.end);
  const labs=labSnapshot(state.data.labs||[]),labsWindow=labSnapshot(state.data.labs||[],bounds);
  const signals=complementarySignalSeries(state.data.sourceMetrics||[],bounds),protocols=protocolCount(state.data,bounds);
  const controls=`<div class="controls sectionGap"><label>Janela recente<select id="analysisPeriod"><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="all">Todo histórico</option></select></label></div>`;
  const failure=['body','workouts','nutrition','labs','sourceMetrics'].filter(failed);
  const failureNote=failure.length?`<div class="note sectionGap"><b>Leitura parcial</b><span>${failure.length} domínio(s) não carregaram agora. Os demais continuam visíveis e nenhum valor ausente foi substituído por zero.</span></div>`:'';
  return`${title('Insights','Uma leitura organizada: o que mudou, o que aconteceu na janela recente e o que ainda falta de dado.')}${controls}${failureNote}
    <div class="note"><b>Como ler esta tela</b><span>Treino, nutrição e recuperação seguem a janela escolhida. Composição e exames usam o último histórico disponível porque têm cadência diferente.</span></div>
    ${digest(body,labs,training,nutrition,sleep,period)}
    ${windowLead({period,bounds,training,nutrition,sleep,protocols})}
    <div class="grid cols2 sectionGap">${bodyCard(body)}${labsCard(labs,labsWindow,period)}</div>
    <div class="grid cols2 sectionGap">${recoveryCard(sleep,signals,bounds)}${nutritionCard(nutrition)}</div>
    <div class="grid cols2 sectionGap">${trainingCard(training,performance)}${limitations(body,labs,nutrition,sleep)}</div>
    <div class="analysisSafety sectionGap"><b>Leitura descritiva</b><span>Associações temporais e mudanças observadas não são tratadas como causa. Origens diferentes permanecem separadas e dados ausentes continuam ausentes.</span></div>`;
}
