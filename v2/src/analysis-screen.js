import {state,esc,day,fmtDate,fmtNum,num,norm,unique,since,workoutRows} from './core.js';
import {buildIntegratedAnalysis,trainingDistributionModel} from './integrated-analysis.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1>${description?`<p>${esc(description)}</p>`:''}</div></div>`;
const failed=key=>state.domainStatus[key]==='error';
const metric=(label,value,sub='')=>`<div class="card metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<em>${esc(sub)}</em>`:''}</div>`;
const deltaText=(value,digits=1,unit='')=>{const n=num(value);return n==null?'—':`${n>0?'+':''}${fmtNum(n,digits)}${unit?` ${unit}`:''}`;};
const periodLabel=period=>period==='30'?'30 dias':period==='90'?'90 dias':period==='365'?'1 ano':'todo o histórico';
const periodStart=period=>period==='all'?null:since(Number(period));
const inPeriod=(value,start)=>!start||day(value)>=start;
const reviewState=(title,body)=>`<div class="empty"><b>${esc(title)}</b><br>${esc(body)}</div>`;
const countDays=(value,label='dia')=>`${value} ${label}${value===1?'':'s'}`;

function nutritionEvidence(rows,start=null,end=null,{afterStart=false}={}){
  const groups=new Map();
  for(const row of rows||[]){
    const date=day(row?.nutrition_date);
    if(!date||start&&(afterStart?date<=start:date<start)||end&&date>end)continue;
    if(!groups.has(date))groups.set(date,[]);
    groups.get(date).push(row);
  }
  let safeDays=0,reviewDays=0;
  for(const items of groups.values())items.length===1?safeDays++:reviewDays++;
  return{safeDays,reviewDays,totalDays:groups.size};
}

function regionCard(region){
  const training=region.training.sessions==null?'treino do intervalo indisponível':`${region.training.sessions} sessão(ões) relacionadas${region.training.sets==null?'':` · ${region.training.sets} séries estruturadas`}`;
  const groups=region.training.groups?.length?region.training.groups.join(', '):'nenhum grupo relacionado estruturado';
  return `<article class="analysisRegion"><div class="analysisRegionHead"><span>${esc(region.label)}</span><b>${deltaText(region.leanDeltaKg,2,'kg')}</b><small>mudança de massa magra segmentar</small></div><div class="analysisRegionFacts"><div><span>Massa de gordura</span><b>${deltaText(region.fatDeltaKg,2,'kg')}</b></div><div><span>Treino no intervalo</span><b>${esc(training)}</b></div></div><p>${esc(groups)}</p></article>`;
}

function distributionPanel(distribution,periodText){
  if(!distribution.available||!distribution.rows.length)return'<div class="empty">Sem grupos musculares estruturados neste período.</div>';
  const rows=distribution.rows.slice(0,12),max=Math.max(1,...rows.map(r=>r.sessions));
  return `<div class="analysisBars">${rows.map(r=>`<div class="analysisBarRow"><span>${esc(r.label)}</span><div><i style="width:${Math.max(5,r.sessions/max*100)}%"></i></div><b>${r.sessions}</b><small>${r.sets==null?'séries indisponíveis':`${r.sets} séries`}</small></div>`).join('')}</div><p class="footerNote">Frequência registrada por grupo em ${esc(periodText)}. A tela descreve a distribuição; não prescreve aumentar volume de treino.</p>`;
}

function performanceRows(model){
  const rows=model.training.performance||[];
  if(!rows.length)return'<div class="empty">Ainda não há dois registros comparáveis do mesmo exercício, máquina e unidade.</div>';
  return `<div class="analysisPerformance">${rows.map(p=>`<div><span>${fmtDate(p.previousDate)} → ${fmtDate(p.date)}</span><b>${esc(p.exercise)}</b><small>${fmtNum(p.previousWeight,Number.isInteger(p.previousWeight)?0:1)} → ${fmtNum(p.weight,Number.isInteger(p.weight)?0:1)} ${esc(p.unit)} · diferença ${deltaText(p.delta,Number.isInteger(p.delta)?0:1,p.unit)}</small></div>`).join('')}</div>`;
}

function nutritionPanel(model,evidence){
  const n=model.nutrition;
  if(!n.available)return n.reason==='unavailable'?'<div class="empty">Os dados de alimentação não carregaram agora; o cruzamento fica indisponível nesta atualização.</div>':'<div class="empty">Não há um intervalo corporal comparável para cruzar com alimentação.</div>';
  if(!n.days&&evidence.reviewDays)return reviewState('Alimentação em revisão',`${countDays(evidence.reviewDays)} tem mais de um registro preservado neste intervalo. Nenhum deles foi somado, escolhido ou usado em médias.`);
  if(!n.days)return'<div class="empty">O intervalo existe, mas não há dias de alimentação registrados nele.</div>';
  const coverage=[n.coveragePct==null?'':`${n.coveragePct}% dos dias do intervalo`,evidence.reviewDays?`${countDays(evidence.reviewDays)} em revisão fora das médias`:'' ].filter(Boolean).join(' · ');
  return `<div class="analysisNutritionGrid">
    ${metric('Dias registrados',String(n.days),coverage)}
    ${metric('Proteína média',n.proteinAvg==null?'—':`${fmtNum(n.proteinAvg,0)} g/dia`,n.proteinDelta==null?'sem período anterior equivalente':`${deltaText(n.proteinDelta,0,'g/dia')} vs período anterior equivalente`)}
    ${metric('Energia média',n.calorieAvg==null?'—':`${fmtNum(n.calorieAvg,0)} kcal/dia`,'valor registrado, sem meta inferida')}
  </div><p class="footerNote">O app pode comparar alimentação e composição no mesmo intervalo, mas não atribui causalidade entre as mudanças observadas.${evidence.reviewDays?' Dias com mais de um total preservado ficam fora das médias até revisão.':''}</p>`;
}

function sleepPanel(model){
  if(!model.sleep.available)return'<div class="empty">Os registros por origem não carregaram agora.</div>';
  if(!model.sleep.days)return'<div class="empty">Nenhum registro de sono preservado foi encontrado.</div>';
  return `<div class="analysisSleep"><b>${model.sleep.days} dia(s) de sono preservado(s)</b><span>Último registro em ${fmtDate(model.sleep.latest)}. As fontes permanecem separadas e esses valores não entram em médias enquanto a regra de consolidação não estiver validada.</span></div>`;
}

function labMetric(model){
  const labs=model.labs;
  if(!labs.available)return metric('Coletas de exames','—','resultados laboratoriais não carregaram agora');
  if(labs.reason==='ambiguous_source')return metric('Coletas de exames','Em revisão',`${labs.collectionDays.length} data(s) preservada(s); origens não foram combinadas`);
  if(labs.collectionDays.length<2)return metric('Coletas de exames',String(labs.collectionDays.length),'ainda sem tendência longitudinal');
  if(labs.reason==='no_prior_same_source')return metric('Coletas de exames',String(labs.collectionDays.length),'histórico existe, mas não há coleta anterior da mesma origem');
  if(!labs.safe)return metric('Coletas de exames',String(labs.collectionDays.length),'sem biomarcadores comparáveis entre coletas da mesma origem');
  return metric('Coletas de exames',String(labs.collectionDays.length),`${labs.comparable} biomarcador(es) comparáveis entre coletas da mesma origem`);
}

function limitations(model,nutritionReview){
  const rows=[];
  if(model.body.reason==='ambiguous')rows.push('Composição global: há mais de uma medição em uma das duas datas recentes; os valores ficam preservados e nenhuma diferença é calculada até a revisão.');
  if(model.segmental.reason==='ambiguous')rows.push('Composição segmentar: há mais de uma medição em uma das duas datas recentes; as regiões ficam preservadas e não entram no cruzamento com treino ou alimentação até a revisão.');
  if(model.labs.available&&model.labs.reason==='ambiguous_source')rows.push('Exames: há mais de uma origem possível na comparação recente; os resultados ficam preservados e a tendência aguarda revisão.');
  else if(model.labs.available&&model.labs.collectionDays.length<2)rows.push('Exames: ainda existe apenas uma data de coleta estruturada; não há série longitudinal laboratorial suficiente para tendência.');
  else if(model.labs.available&&model.labs.reason==='no_prior_same_source')rows.push('Exames: há histórico laboratorial, mas a coleta mais recente ainda não tem outra coleta anterior da mesma origem; fontes diferentes não são tratadas como continuidade.');
  else if(model.labs.available&&!model.labs.safe)rows.push('Exames: as coletas da mesma origem estão preservadas, mas não há correspondência segura de nome, unidade e valor numérico para comparar.');
  if(model.sleep.available&&model.sleep.days)rows.push('Sono: há dados preservados, porém ainda fora das conclusões por sobreposição entre fontes.');
  if(!model.segmental.available&&model.segmental.reason!=='ambiguous')rows.push('Composição segmentar: são necessárias pelo menos duas medições segmentares para cruzar regiões com o treino do intervalo.');
  if(nutritionReview.reviewDays)rows.push(`Alimentação: ${countDays(nutritionReview.reviewDays)} tem mais de um registro preservado no intervalo e fica fora das médias e comparações até revisão.`);
  else if(!model.nutrition.available||!model.nutrition.days)rows.push('Alimentação: o cruzamento corporal fica limitado quando o intervalo não tem registros diários suficientes.');
  return rows;
}

export function renderAnalysisHub(){
  const model=buildIntegratedAnalysis(state.data,state.domainStatus),period=state.ui.analysisPeriod||'365',periodText=periodLabel(period),start=periodStart(period);
  const distribution=trainingDistributionModel(state.data,state.domainStatus,start,model.referenceDay);
  const failures=['body','segmental','workouts','exercises','sets','nutrition','labs','sourceMetrics'].filter(failed);
  const body=model.body,structuredWorkouts=failed('workouts')?[]:workoutRows();
  const periodWorkouts=structuredWorkouts.filter(w=>inPeriod(w.workout_date,start));
  const periodNutrition=failed('nutrition')?[]:(state.data.nutrition||[]).filter(n=>inPeriod(n.nutrition_date,start));
  const periodNutritionEvidence=nutritionEvidence(periodNutrition);
  const intervalNutritionEvidence=model.nutrition.available?nutritionEvidence(state.data.nutrition||[],model.nutrition.start,model.nutrition.end,{afterStart:true}):{safeDays:0,reviewDays:0,totalDays:0};
  const limits=limitations(model,intervalNutritionEvidence);
  const segmentalLead=model.segmental.available?`<div class="analysisInterval"><b>${fmtDate(model.segmental.start)} → ${fmtDate(model.segmental.end)}</b><span>Último intervalo segmentar comparável. Treino e alimentação abaixo usam o mesmo intervalo quando possível.</span></div><div class="analysisRegionGrid">${model.segmental.regions.map(regionCard).join('')}</div>`:model.segmental.reason==='ambiguous'?reviewState('Composição segmentar em revisão','Há mais de uma medição em uma das duas datas recentes. Os registros foram preservados e nenhuma região foi escolhida para o cruzamento.'): '<div class="empty">Ainda não há duas medições segmentares comparáveis para montar esta leitura.</div>';
  const bodyPanel=body.available?`<div class="grid cols2 compact">${metric('Peso',deltaText(body.delta.weightKg,1,'kg'))}${metric('Massa muscular',deltaText(body.delta.muscleKg,1,'kg'))}${metric('Massa de gordura',deltaText(body.delta.fatKg,1,'kg'))}${metric('Gordura corporal',deltaText(body.delta.bodyFatPp,1,'p.p.'))}</div><p class="footerNote">Mudanças observadas entre ${fmtDate(body.previous.measured_at)} e ${fmtDate(body.latest.measured_at)}.</p>`:body.reason==='ambiguous'?reviewState('Composição em revisão','Há mais de uma medição em uma das duas datas recentes. Os valores foram preservados e nenhuma diferença foi calculada.'): '<div class="empty">São necessárias duas medições corporais comparáveis.</div>';
  const periodNutritionValue=failed('nutrition')?'—':periodNutritionEvidence.reviewDays&&!periodNutritionEvidence.safeDays?'Em revisão':String(periodNutritionEvidence.safeDays);
  const periodNutritionSub=failed('nutrition')?'dados de alimentação não carregaram agora':periodNutritionEvidence.reviewDays?`${countDays(periodNutritionEvidence.safeDays)} comparável(is) · ${countDays(periodNutritionEvidence.reviewDays)} em revisão`:'dias com registro diário';

  return `${title('Análise','Relações entre composição, treino, alimentação, sono e exames com a evidência disponível.')}
    <div class="controls"><select id="analysisPeriod"><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="all">Todo histórico</option></select></div>
    ${failures.length?`<div class="errorState sectionGap"><b>Algumas fontes não carregaram.</b><span>As áreas disponíveis continuam visíveis e nenhuma falha é convertida em zero.</span></div>`:''}

    <section class="analysisLead sectionGap">
      <div class="analysisLeadHead"><div><span>Leitura integrada</span><h2>O que mudou e qual era o contexto registrado</h2></div><small>${esc(fmtDate(model.referenceDay))}</small></div>
      ${segmentalLead}
    </section>

    <div class="grid cols2 sectionGap">
      <section class="card"><div class="cardHead"><div><b>Composição global</b><small>Duas últimas medições corporais.</small></div></div>${bodyPanel}</section>
      <section class="card"><div class="cardHead"><div><b>Alimentação no mesmo intervalo</b><small>Sem classificar consumo como alto ou baixo sem uma referência apropriada.</small></div></div>${nutritionPanel(model,intervalNutritionEvidence)}</section>
    </div>

    <div class="grid cols2 sectionGap">
      <section class="card"><div class="cardHead"><div><b>Distribuição dos treinos</b><small>Grupos musculares registrados em ${esc(periodText)}.</small></div></div>${distributionPanel(distribution,periodText)}</section>
      <section class="card"><div class="cardHead"><div><b>Performance comparável</b><small>Mesmo exercício, máquina e unidade; sem estimar 1RM.</small></div></div>${performanceRows(model)}</section>
    </div>

    <div class="grid cols4 sectionGap analysisSecondaryMetrics">
      ${metric(`Treinos · ${periodText}`,failed('workouts')?'—':String(periodWorkouts.length),'contagem de sessões estruturadas')}
      ${metric(`Alimentação · ${periodText}`,periodNutritionValue,periodNutritionSub)}
      ${labMetric(model)}
      ${metric('Sono preservado',model.sleep.available?String(model.sleep.days):'—',model.sleep.available?'fora das conclusões até regra segura':'registros por origem não carregaram agora')}
    </div>

    <div class="grid cols2 sectionGap">
      <section class="card"><div class="cardHead"><div><b>Sono</b><small>Mostra existência e cobertura sem combinar fontes.</small></div></div>${sleepPanel(model)}</section>
      <section class="card"><div class="cardHead"><div><b>O que ainda limita a análise</b><small>Pontos que impedem conclusões mais fortes.</small></div></div><div class="limitationList">${limits.length?limits.map(row=>`<div>${esc(row)}</div>`).join(''):'<div>Nenhuma limitação adicional foi identificada pelos critérios atuais.</div>'}</div></section>
    </div>

    <div class="analysisSafety sectionGap"><b>Como interpretar</b><span>O LTS Health mostra mudanças, exposição registrada e coincidências temporais. Ele não transforma essas relações em diagnóstico, causa ou recomendação automática de aumentar treino ou restringir alimentação.</span></div>`;
}