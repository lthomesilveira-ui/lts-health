import {state,esc,day,fmtDate,fmtNum,num,norm,unique} from './core.js';
import {
  buildIntegratedAnalysis,bodyChangeModel,segmentalContextModel,trainingDistributionModel,
  comparablePerformanceModel,nutritionIntervalModel,nutritionPeriodModel,sleepCoverageModel,periodBounds
} from './integrated-analysis.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1>${description?`<p>${esc(description)}</p>`:''}</div></div>`;
const failed=key=>state.domainStatus?.[key]==='error';
const metric=(label,value,sub='')=>`<div class="card metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<em>${esc(sub)}</em>`:''}</div>`;
const deltaText=(value,digits=1,unit='')=>{const n=num(value);return n==null?'—':`${n>0?'+':''}${fmtNum(n,digits)}${unit?` ${unit}`:''}`;};
const periodLabel=period=>period==='30'?'30 dias':period==='90'?'90 dias':period==='365'?'1 ano':'todo o histórico';
const inBounds=(value,bounds)=>{const d=day(value);return Boolean(d&&(!bounds.start||d>=bounds.start)&&(!bounds.end||d<=bounds.end));};
const reviewState=(heading,body)=>`<div class="empty"><b>${esc(heading)}</b><br>${esc(body)}</div>`;
const countDays=(value,label='dia')=>`${value} ${label}${value===1?'':'s'}`;

const complementarySignalDefs={
  steps:{label:'Passos',digits:0},
  resting_heart_rate_bpm:{label:'Frequência cardíaca em repouso',digits:0},
  hrv_sdnn_ms:{label:'Variabilidade da frequência cardíaca (SDNN)',digits:0},
  respiratory_rate_bpm:{label:'Frequência respiratória',digits:1},
  oxygen_saturation_pct:{label:'Saturação de oxigênio',digits:1}
};
const complementarySourceLabels={apple_watch:'Apple Watch',iphone:'iPhone',polar_flow:'Polar Flow',healthkit_candidate:'Apple Saúde',ringconn:'RingConn'};
const signalUnit=(metricType,unit)=>metricType==='steps'?'passos':unit.endsWith('/min')?'/min':unit||'unidade não informada';
const signalValue=(series,point)=>`${fmtNum(point.value,complementarySignalDefs[series.metric]?.digits??1)}${signalUnit(series.metric,series.unit)==='/min'?' /min':signalUnit(series.metric,series.unit)==='passos'?' passos':` ${signalUnit(series.metric,series.unit)}`}`;

export function complementarySignalSeries(rows,bounds={start:null,end:null}){
  const groups=new Map();
  for(const row of rows||[]){
    if(!['candidate','held'].includes(String(row?.canonical_status||'').toLowerCase()))continue;
    const metricType=String(row?.metric_type||''),definition=complementarySignalDefs[metricType];
    if(!definition||!inBounds(row?.metric_date,bounds))continue;
    const value=num(row?.value),date=day(row?.metric_date),unit=String(row?.unit||'').trim()||'unidade não informada';
    if(value==null||!date)continue;
    const family=String(row?.source_family||'other'),identity=String(row?.source_name||row?.source_family||'Outra origem'),key=`${family}\u0000${identity}\u0000${metricType}\u0000${unit}`;
    if(!groups.has(key))groups.set(key,{family,identity,metric:metricType,unit,rows:[]});
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
  const duplicateBases=new Map();
  for(const item of series){if(!duplicateBases.has(item.baseLabel))duplicateBases.set(item.baseLabel,new Set());duplicateBases.get(item.baseLabel).add(item.identity);}
  const ordinals=new Map();
  for(const [base,identities] of duplicateBases.entries())ordinals.set(base,[...identities].sort((a,b)=>a.localeCompare(b,'pt-BR')));
  for(const item of series){const identities=ordinals.get(item.baseLabel)||[];item.sourceLabel=identities.length>1?`${item.baseLabel} · origem ${identities.indexOf(item.identity)+1}`:item.baseLabel;}
  return series.sort((a,b)=>(complementarySignalDefs[a.metric]?.label||a.metric).localeCompare(complementarySignalDefs[b.metric]?.label||b.metric,'pt-BR')||a.sourceLabel.localeCompare(b.sourceLabel,'pt-BR'));
}

function complementarySignalCard(series){
  const definition=complementarySignalDefs[series.metric],first=series.first,last=series.last,delta=series.points.length>1?last.value-first.value:null;
  const change=delta==null?'Ainda há apenas um dia inequívoco nesta janela.':`Primeiro registro ${signalValue(series,first)} em ${fmtDate(first.date)} · diferença até o último ${deltaText(delta,definition?.digits??1,signalUnit(series.metric,series.unit)==='passos'?'passos':signalUnit(series.metric,series.unit))}.`;
  const review=series.reviewDays?` ${countDays(series.reviewDays)} com mais de um valor da mesma origem ficou fora desta leitura.`:'';
  return `<article class="analysisDigestCard coverage" data-complementary-signal="${esc(series.metric)}"><span>${esc(series.sourceLabel)}</span><h3>${esc(definition?.label||series.metric)}</h3><p><b>${esc(signalValue(series,last))}</b> em ${esc(fmtDate(last.date))}. ${esc(change)}${esc(review)}</p></article>`;
}
function complementarySignalsPanel(rows,bounds,periodText){
  if(failed('sourceMetrics'))return `<section class="card sectionGap"><div class="cardHead"><div><b>Sinais complementares por origem</b><small>Apple, Polar e outras origens permanecem isoladas.</small></div></div><div class="empty">Os registros complementares não carregaram agora.</div></section>`;
  const series=complementarySignalSeries(rows,bounds);
  if(!series.length)return `<section class="card sectionGap"><div class="cardHead"><div><b>Sinais complementares por origem</b><small>Apple, Polar e outras origens permanecem isoladas.</small></div></div><div class="empty">Nenhum sinal complementar comparável em ${esc(periodText)}.</div></section>`;
  return `<section class="card sectionGap"><div class="cardHead"><div><b>Sinais complementares por origem</b><small>Valores preservados que ainda não entram na leitura principal.</small></div></div><div class="analysisDigestGrid" data-complementary-signals>${series.slice(0,12).map(complementarySignalCard).join('')}</div><p class="footerNote">Cada cartão usa somente uma origem, uma métrica e uma unidade. Datas ambíguas da mesma origem ficam de fora; nenhuma média ou comparação entre fontes é calculada.</p></section>`;
}

function nutritionEvidence(rows,start=null,end=null,{afterStart=false}={}){
  const groups=new Map();
  for(const row of rows||[]){
    const date=day(row?.nutrition_date);
    if(!date||start&&(afterStart?date<=start:date<start)||end&&date>end)continue;
    if(!groups.has(date))groups.set(date,[]);groups.get(date).push(row);
  }
  let safeDays=0,reviewDays=0;
  for(const items of groups.values())items.length===1?safeDays++:reviewDays++;
  return{safeDays,reviewDays,totalDays:groups.size};
}

function scopeLine(period,bounds){
  const label=periodLabel(period);
  if(!bounds.end)return label;
  return bounds.start?`${label} · ${fmtDate(bounds.start)} → ${fmtDate(bounds.end)}`:`${label} · até ${fmtDate(bounds.end)}`;
}
function regionCard(region){
  const training=region.training.sessions==null?'treino do intervalo indisponível':`${region.training.sessions} sessão(ões) relacionadas${region.training.sets==null?'':` · ${region.training.sets} séries estruturadas`}`;
  const groups=region.training.groups?.length?region.training.groups.join(', '):'nenhum grupo relacionado estruturado';
  return `<article class="analysisRegion"><div class="analysisRegionHead"><span>${esc(region.label)}</span><b>${deltaText(region.leanDeltaKg,2,'kg')}</b><small>mudança de massa magra segmentar</small></div><div class="analysisRegionFacts"><div><span>Massa de gordura</span><b>${deltaText(region.fatDeltaKg,2,'kg')}</b></div><div><span>Treino entre as medições</span><b>${esc(training)}</b></div></div><p>${esc(groups)}</p></article>`;
}
function distributionPanel(distribution,periodText){
  if(!distribution.available||!distribution.rows.length)return'<div class="empty">Sem grupos musculares estruturados neste período.</div>';
  const rows=distribution.rows.slice(0,12),max=Math.max(1,...rows.map(r=>r.sessions));
  return `<div class="analysisBars">${rows.map(r=>`<div class="analysisBarRow"><span>${esc(r.label)}</span><div><i style="width:${Math.max(5,r.sessions/max*100)}%"></i></div><b>${r.sessions}</b><small>${r.sets==null?'séries indisponíveis':`${r.sets} séries`}</small></div>`).join('')}</div><p class="footerNote">Todas as contagens acima usam a mesma taxonomia e a mesma janela de ${esc(periodText)}.</p>`;
}
function performanceRows(rows){
  if(!rows.length)return'<div class="empty">Ainda não há dois registros comparáveis do mesmo exercício, máquina e unidade neste período.</div>';
  return `<div class="analysisPerformance">${rows.map(p=>`<div><span>${fmtDate(p.previousDate)} → ${fmtDate(p.date)}</span><b>${esc(p.exercise)}</b><small>${fmtNum(p.previousWeight,Number.isInteger(p.previousWeight)?0:1)} → ${fmtNum(p.weight,Number.isInteger(p.weight)?0:1)} ${esc(p.unit)} · diferença ${deltaText(p.delta,Number.isInteger(p.delta)?0:1,p.unit)}</small></div>`).join('')}</div>`;
}

function nutritionMetrics(n,evidence,{showPrevious=false}={}){
  if(!n.available)return n.reason==='unavailable'?'<div class="empty">Os dados de alimentação não carregaram agora.</div>':'<div class="empty">Não há intervalo comparável para alimentação.</div>';
  if(!n.days&&evidence.reviewDays)return reviewState('Alimentação em revisão',`${countDays(evidence.reviewDays)} tem mais de um registro preservado. Nenhum foi somado ou escolhido para as médias.`);
  if(!n.days)return'<div class="empty">Não há dias de alimentação registrados nesta janela.</div>';
  const coverage=[n.coveragePct==null?'':`${n.coveragePct}% dos dias da janela`,evidence.reviewDays?`${countDays(evidence.reviewDays)} em revisão fora das médias`:'' ].filter(Boolean).join(' · ');
  const proteinSub=showPrevious?(n.proteinDelta==null?'sem período anterior equivalente':`${deltaText(n.proteinDelta,0,'g/dia')} vs período anterior equivalente`):`${n.proteinDays||0} dia(s) com proteína`;
  return `<div class="analysisNutritionGrid">
    ${metric('Dias registrados',String(n.days),coverage)}
    ${metric('Energia média',n.calorieAvg==null?'—':`${fmtNum(n.calorieAvg,0)} kcal/dia`,`${n.calorieDays||0} dia(s) com energia`)}
    ${metric('Proteína média',n.proteinAvg==null?'—':`${fmtNum(n.proteinAvg,0)} g/dia`,proteinSub)}
    ${metric('Carboidratos médios',n.carbsAvg==null?'—':`${fmtNum(n.carbsAvg,0)} g/dia`,`${n.carbsDays||0} dia(s) com carboidratos`)}
    ${metric('Gordura média',n.fatAvg==null?'—':`${fmtNum(n.fatAvg,0)} g/dia`,`${n.fatDays||0} dia(s) com gordura`)}
    ${metric('Fibra média',n.fiberAvg==null?'—':`${fmtNum(n.fiberAvg,1)} g/dia`,`${n.fiberDays||0} dia(s) com fibra`)}
    ${metric('Água ingerida',n.waterDays?`${fmtNum(n.waterAvgMl,0)} mL/dia`:'Sem dado',n.waterDays?`${n.waterDays} dia(s) com água registrada`:'nenhum dia com ingestão de água estruturada')}
  </div>`;
}

function sleepPanel(model,periodText){
  if(!model.available)return'<div class="empty">Os registros por origem não carregaram agora.</div>';
  if(!model.days)return`<div class="empty">Nenhum registro de sono preservado em ${esc(periodText)}.</div>`;
  return `<div class="analysisSleep"><b>${model.days} dia(s) de sono preservado(s) em ${esc(periodText)}</b><span>Último registro em ${fmtDate(model.latest)}. As fontes permanecem separadas e esses valores não entram em médias enquanto a regra de consolidação não estiver validada.</span></div>`;
}
function labPeriodPanel(rows,periodText){
  if(failed('labs'))return'<div class="empty">Os exames não carregaram agora.</div>';
  const dates=unique(rows.map(r=>day(r.collection_date))).filter(Boolean).sort(),sources=unique(rows.map(r=>String(r.laboratory||r.source||'').trim()).filter(Boolean));
  if(!dates.length)return`<div class="empty">Nenhuma coleta laboratorial em ${esc(periodText)}.</div>`;
  return `<div class="analysisSleep"><b>${dates.length} data(s) de coleta em ${esc(periodText)}</b><span>${fmtDate(dates[0])} → ${fmtDate(dates.at(-1))}${sources.length?` · ${sources.join(' · ')}`:''}. Tendências automáticas só usam a mesma origem e unidade compatível.</span></div>`;
}
function bodyPanel(body,periodText){
  if(body.available)return`<div class="grid cols2 compact">${metric('Peso',deltaText(body.delta.weightKg,1,'kg'))}${metric('Massa muscular',deltaText(body.delta.muscleKg,1,'kg'))}${metric('Massa de gordura',deltaText(body.delta.fatKg,1,'kg'))}${metric('Gordura corporal',deltaText(body.delta.bodyFatPp,1,'p.p.'))}</div><p class="footerNote">Mudanças observadas entre ${fmtDate(body.previous.measured_at)} e ${fmtDate(body.latest.measured_at)}, ambas dentro de ${esc(periodText)}.</p>`;
  if(body.reason==='ambiguous')return reviewState('Composição em revisão','Há mais de uma medição em uma das duas datas recentes dentro do período. Nenhuma diferença foi calculada.');
  if(body.reason==='source_changed')return reviewState('Composição sem comparação automática','As duas medições recentes no período têm origens diferentes. Os valores permanecem preservados, mas não são tratados como continuidade automática.');
  return `<div class="empty">Não há duas medições corporais comparáveis dentro de ${esc(periodText)}.</div>`;
}
function segmentalPanel(segmental,periodText){
  if(segmental.available)return `<div class="analysisInterval"><b>${fmtDate(segmental.start)} → ${fmtDate(segmental.end)}</b><span>Janela entre as duas últimas medições segmentares dentro de ${esc(periodText)}. As contagens abaixo usam somente esse intervalo, não o período inteiro.</span></div><div class="analysisRegionGrid">${segmental.regions.map(regionCard).join('')}</div>`;
  if(segmental.reason==='ambiguous')return reviewState('Composição segmentar em revisão','Há mais de uma medição em uma das duas datas recentes do período. Nenhuma região foi escolhida para cruzamento.');
  if(segmental.reason==='source_changed')return reviewState('Segmentar sem comparação automática','As medições segmentares recentes têm origens diferentes e não são unidas automaticamente.');
  return `<div class="empty">Não há duas medições segmentares comparáveis dentro de ${esc(periodText)}.</div>`;
}
function limitations({body,segmental,nutritionEvidencePeriod,nutritionEvidenceInterval,sleep,labsInPeriod,periodText,labModel}){
  const rows=[];
  if(!body.available)rows.push(`Composição: não há duas medições globais comparáveis dentro de ${periodText}.`);
  if(!segmental.available)rows.push(`Segmentar: não há duas medições comparáveis dentro de ${periodText}; por isso o cruzamento regional fica limitado.`);
  if(nutritionEvidencePeriod.reviewDays)rows.push(`Alimentação: ${countDays(nutritionEvidencePeriod.reviewDays)} em revisão no período ficam fora das médias.`);
  if(nutritionEvidenceInterval.reviewDays)rows.push(`Alimentação entre medições: ${countDays(nutritionEvidenceInterval.reviewDays)} em revisão ficam fora das médias.`);
  if(sleep.available&&sleep.days)rows.push('Sono: há cobertura preservada por origem, mas ela continua fora de médias e conclusões enquanto existir sobreposição de fontes.');
  if(!labsInPeriod.length)rows.push(`Exames: nenhuma coleta laboratorial dentro de ${periodText}. O histórico completo continua disponível em Saúde & exames.`);
  if(labModel?.available&&labModel.reason==='ambiguous_source')rows.push('Exames: há mais de uma origem possível na comparação recente; os resultados ficam preservados e nenhuma origem é combinada automaticamente.');
  else if(labModel?.available&&labModel.reason==='no_prior_same_source')rows.push('Exames: há histórico laboratorial, mas a coleta mais recente ainda não tem outra coleta anterior da mesma origem; fontes diferentes não são tratadas como continuidade.');
  else if(labModel?.available&&!labModel.safe&&labModel.reason==='no_comparable_markers')rows.push('Exames: as coletas da mesma origem estão preservadas, mas não há correspondência segura de nome, unidade e valor numérico para comparar.');
  return rows;
}
function protocolContext(bounds){
  if(failed('treatments')||failed('regimens'))return{available:false,regimens:0,events:0,eventsInPeriod:0,last:null};
  const events=state.data.treatments||[],regimens=state.data.regimens||[],dates=events.map(r=>day(r.event_date)).filter(Boolean).sort(),periodEvents=events.filter(r=>inBounds(r.event_date,bounds));
  return{available:true,regimens:regimens.length,events:events.length,eventsInPeriod:periodEvents.length,last:dates.at(-1)||null};
}
function digestCard(label,titleText,body,route,tone=''){
  return `<article class="analysisDigestCard ${esc(tone)}"><span>${esc(label)}</span><h3>${esc(titleText)}</h3><p>${esc(body)}</p>${route?`<button data-route="${esc(route)}">Abrir →</button>`:''}</article>`;
}
function insightDigest({body,distribution,performance,nutrition,nutritionEvidencePeriod,sleep,labsInPeriod,protocol,periodText}){
  const cards=[];
  if(body.available)cards.push(digestCard('Composição','Duas medições comparáveis',`${fmtDate(body.previous.measured_at)} → ${fmtDate(body.latest.measured_at)} · massa muscular ${deltaText(body.delta.muscleKg,1,'kg')} · massa de gordura ${deltaText(body.delta.fatKg,1,'kg')}. Leitura descritiva, sem atribuir causa.`,'evolucao','change'));
  else cards.push(digestCard('Composição','Comparação limitada',body.reason==='source_changed'?'As medições recentes têm origens diferentes; a variação não é calculada automaticamente.':'Não há duas medições corporais comparáveis nesta janela.','bio','coverage'));
  cards.push(digestCard('Treino',`${distribution.available?distribution.totalSessions:0} sessão(ões) no período`,performance.length?`${performance.length} comparação(ões) de performance preservadas com mesmo exercício, máquina e unidade.`:`Ainda não há pares de performance comparáveis em ${periodText}.`,'treinos','change'));
  if(nutrition.available&&nutrition.days)cards.push(digestCard('Nutrição',`${nutrition.days} dia(s) comparáveis`,nutrition.waterDays?`${nutrition.waterDays} dia(s) também têm água registrada.`:`Água continua sem cobertura estruturada. ${nutritionEvidencePeriod.reviewDays?`${nutritionEvidencePeriod.reviewDays} dia(s) de nutrição permanecem em revisão.`:'Os demais campos permanecem restritos ao que foi importado.'}`,'nutricao',nutrition.waterDays?'coverage':'attention'));
  else cards.push(digestCard('Nutrição','Cobertura insuficiente','Não há dias comparáveis de alimentação nesta janela.','nutricao','coverage'));
  const labDates=unique(labsInPeriod.map(r=>day(r.collection_date))).filter(Boolean).sort();
  cards.push(digestCard('Exames',labDates.length?`${labDates.length} coleta(s) no período`:'Nenhuma coleta no período',labDates.length?`${labsInPeriod.length} resultado(s) estruturados entre ${fmtDate(labDates[0])} e ${fmtDate(labDates.at(-1))}. Tendências só usam origem e unidade compatíveis.`:'O histórico completo de exames continua disponível fora desta janela.','saude',labDates.length?'change':'coverage'));
  if(protocol.available)cards.push(digestCard('Protocolos',`${protocol.regimens} cadastro(s) de contexto`,`${protocol.events} evento(s) histórico(s) no total${protocol.eventsInPeriod?` · ${protocol.eventsInPeriod} nesta janela`:''}${protocol.last?` · último registro ${fmtDate(protocol.last)}`:''}. Situação atual não inferida.`,'tratamentos','context'));
  if(sleep.available)cards.push(digestCard('Sono',`${sleep.days} dia(s) preservado(s)`,sleep.days?`Último registro em ${fmtDate(sleep.latest)}. Fontes permanecem separadas e não são somadas automaticamente.`:'Nenhum registro de sono preservado nesta janela.','dados','coverage'));
  return cards.slice(0,6).join('');
}

export function renderAnalysisHub(){
  const model=buildIntegratedAnalysis(state.data,state.domainStatus),period=state.ui.analysisPeriod||'365',periodText=periodLabel(period),bounds=periodBounds(period,model.referenceDay),scope=scopeLine(period,bounds);
  const distribution=trainingDistributionModel(state.data,state.domainStatus,bounds.start,bounds.end),performance=comparablePerformanceModel(state.data,state.domainStatus,3,bounds.start,bounds.end),periodNutrition=nutritionPeriodModel(state.data,state.domainStatus,bounds.start,bounds.end),periodSleep=sleepCoverageModel(state.data,state.domainStatus,bounds.start,bounds.end),body=bodyChangeModel(state.data,state.domainStatus,bounds.start,bounds.end),segmental=segmentalContextModel(state.data,state.domainStatus,bounds.start,bounds.end);
  const intervalStart=segmental.available?segmental.start:body.available?day(body.previous.measured_at):null,intervalEnd=segmental.available?segmental.end:body.available?day(body.latest.measured_at):null,intervalNutrition=nutritionIntervalModel(state.data,state.domainStatus,intervalStart,intervalEnd);
  const periodNutritionEvidence=nutritionEvidence(state.data.nutrition||[],bounds.start,bounds.end),intervalNutritionEvidence=intervalNutrition.available?nutritionEvidence(state.data.nutrition||[],intervalNutrition.start,intervalNutrition.end,{afterStart:true}):{safeDays:0,reviewDays:0,totalDays:0},labsInPeriod=failed('labs')?[]:(state.data.labs||[]).filter(r=>inBounds(r.collection_date,bounds)),protocol=protocolContext(bounds);
  const failures=['body','segmental','workouts','exercises','sets','nutrition','labs','sourceMetrics','treatments','regimens'].filter(failed),limits=limitations({body,segmental,nutritionEvidencePeriod:periodNutritionEvidence,nutritionEvidenceInterval:intervalNutritionEvidence,sleep:periodSleep,labsInPeriod,periodText,labModel:model.labs});

  return `${title('Insights','O que mudou, quanto do período está coberto e onde ainda faltam dados — sempre a partir dos registros existentes.')}
    <div class="controls"><select id="analysisPeriod"><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="all">Todo histórico</option></select></div>
    ${failures.length?`<div class="errorState sectionGap"><b>Algumas fontes não carregaram.</b><span>As áreas disponíveis continuam visíveis e nenhuma falha é convertida em zero.</span></div>`:''}

    <section class="analysisDigest sectionGap"><div class="analysisDigestHead"><div><span>Resumo executivo</span><h2>O que merece sua atenção nesta janela</h2></div><small>${esc(scope)}</small></div><div class="analysisDigestGrid">${insightDigest({body,distribution,performance,nutrition:periodNutrition,nutritionEvidencePeriod:periodNutritionEvidence,sleep:periodSleep,labsInPeriod,protocol,periodText})}</div></section>

    <section class="analysisLead sectionGap">
      <div class="analysisLeadHead"><div><span>Período selecionado</span><h2>${esc(scope)}</h2></div><small>referência ${esc(fmtDate(model.referenceDay))}</small></div>
      <div class="analysisInterval"><b>Mesma janela em toda esta seção</b><span>Treinos, alimentação, sono, exames e performance abaixo usam exatamente o período escolhido.</span></div>
      <div class="grid cols4 analysisSecondaryMetrics">
        ${metric('Treinos',distribution.available?String(distribution.totalSessions):'—',periodText)}
        ${metric('Alimentação',periodNutrition.available?String(periodNutrition.days):'—','dias comparáveis no período')}
        ${metric('Sono preservado',periodSleep.available?String(periodSleep.days):'—','dias por origem, sem consolidação automática')}
        ${metric('Coletas de exames',failed('labs')?'—':String(unique(labsInPeriod.map(r=>day(r.collection_date))).length),periodText)}
      </div>
    </section>

    ${complementarySignalsPanel(state.data.sourceMetrics||[],bounds,periodText)}

    <div class="grid cols2 sectionGap">
      <section class="card"><div class="cardHead"><div><b>Distribuição dos treinos</b><small>${esc(scope)}</small></div></div>${distributionPanel(distribution,periodText)}</section>
      <section class="card"><div class="cardHead"><div><b>Performance comparável</b><small>Mesmo exercício, máquina e unidade, dentro da mesma janela.</small></div></div>${performanceRows(performance)}</section>
    </div>

    <section class="card sectionGap"><div class="cardHead"><div><b>Alimentação no período</b><small>Energia, macros, fibra e água somente quando registrados na fonte.</small></div></div>${nutritionMetrics(periodNutrition,periodNutritionEvidence)}</section>

    <div class="grid cols2 sectionGap">
      <section class="card"><div class="cardHead"><div><b>Composição global</b><small>Duas últimas medições comparáveis dentro de ${esc(periodText)}.</small></div></div>${bodyPanel(body,periodText)}</section>
      <section class="card"><div class="cardHead"><div><b>Exames no período</b><small>Laboratórios permanecem separados por origem.</small></div></div>${labPeriodPanel(labsInPeriod,periodText)}</section>
    </div>

    <section class="analysisLead sectionGap">
      <div class="analysisLeadHead"><div><span>Janela entre bioimpedâncias</span><h2>Composição segmentar × treino no mesmo intervalo</h2></div></div>
      ${segmentalPanel(segmental,periodText)}
    </section>

    <section class="card sectionGap"><div class="cardHead"><div><b>Alimentação entre as mesmas medições</b><small>Esta seção usa a janela exata da composição acima, não o período inteiro.</small></div></div>${nutritionMetrics(intervalNutrition,intervalNutritionEvidence,{showPrevious:true})}<p class="footerNote">O app descreve exposição registrada e mudança no mesmo intervalo; não atribui causalidade entre alimentação, treino e composição.</p></section>

    <div class="grid cols2 sectionGap">
      <section class="card"><div class="cardHead"><div><b>Sono no período</b><small>Cobertura por origem, sem somar fontes sobrepostas.</small></div></div>${sleepPanel(periodSleep,periodText)}</section>
      <section class="card"><div class="cardHead"><div><b>O que ainda limita a leitura</b><small>Faltas de cobertura ou comparabilidade ficam explícitas.</small></div></div><div class="limitationList">${limits.length?limits.map(row=>`<div>${esc(row)}</div>`).join(''):'<div>Nenhuma limitação adicional foi identificada pelos critérios atuais.</div>'}</div></section>
    </div>

    <div class="analysisSafety sectionGap"><b>Como interpretar</b><span>O LTS Health mostra mudanças registradas e contexto temporal. Ele não classifica seu corpo como melhor ou pior, não transforma associação em causa e não gera recomendação automática de aumentar treino, restringir alimentação ou alterar protocolos.</span></div>`;
}
