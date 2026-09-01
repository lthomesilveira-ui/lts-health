import {state,esc,day,fmtDate,fmtNum,num} from './core.js';
import {buildIntegratedAnalysis} from './integrated-analysis.js';

const deltaText=(value,digits=1,unit='')=>{
  const n=num(value);if(n==null)return'—';
  return`${n>0?'+':''}${fmtNum(n,digits)}${unit?` ${unit}`:''}`;
};
const action=(route,label)=>`<button class="todayAction" data-route="${esc(route)}">${esc(label)}</button>`;
const currentCard=(label,value,detail,route)=>`<button class="dashboardCurrent" data-route="${esc(route)}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(detail)}</small><i>→</i></button>`;
const infoCard=(eyebrow,title,body,route)=>`<article class="dashboardInsight"><span>${esc(eyebrow)}</span><h3>${esc(title)}</h3><p>${esc(body)}</p>${route?`<button data-route="${esc(route)}">Abrir detalhes →</button>`:''}</article>`;
const domainFailed=key=>state.domainStatus?.[key]==='error';

function miniLine(points,key,unit=''){
  const rows=(points||[]).map(p=>({date:p.date,value:num(p[key])})).filter(p=>p.value!=null);
  if(rows.length<2)return'<div class="dashboardChartEmpty">Sem pontos suficientes.</div>';
  const values=rows.map(r=>r.value),lo=Math.min(...values),hi=Math.max(...values),span=hi-lo||1,pad=span*.12,min=lo-pad,max=hi+pad,w=520,h=116,p=16;
  const x=i=>p+i*(w-p*2)/Math.max(1,rows.length-1),y=v=>p+(max-v)*(h-p*2)/(max-min||1);
  const path=rows.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(r.value).toFixed(1)}`).join(' ');
  const dots=rows.map((r,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(r.value).toFixed(1)}" r="3"><title>${esc(fmtDate(r.date))}: ${esc(fmtNum(r.value,1))}${esc(unit)}</title></circle>`).join('');
  return `<div class="dashboardMiniChart"><div class="dashboardScale"><span>${fmtNum(hi,1)}${esc(unit)}</span><span>${fmtNum((hi+lo)/2,1)}${esc(unit)}</span><span>${fmtNum(lo,1)}${esc(unit)}</span></div><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path class="dashboardGrid" d="M16 30H504 M16 58H504 M16 86H504"/><path class="dashboardLine" d="${path}"/>${dots}</svg></div><div class="dashboardDates"><span>${fmtDate(rows[0].date)}</span><span>${fmtDate(rows.at(-1).date)}</span></div>`;
}

function nutritionReviewDays(model){
  const n=model?.nutrition;
  if(!n?.available||!n.start||!n.end||domainFailed('nutrition'))return 0;
  const groups=new Map();
  for(const row of state.data.nutrition||[]){
    const date=day(row?.nutrition_date);
    if(!date||date<=n.start||date>n.end)continue;
    if(!groups.has(date))groups.set(date,0);
    groups.set(date,groups.get(date)+1);
  }
  return[...groups.values()].filter(count=>count>1).length;
}

function compositionPanel(model){
  if(domainFailed('body'))return`<section class="dashboardPanel"><div class="dashboardPanelHead"><div><span>Composição</span><h2>Evolução corporal</h2></div></div><div class="dashboardChartEmpty">As medições corporais não carregaram nesta atualização.</div></section>`;
  if(!model.trend.available&&model.body.reason==='ambiguous')return`<section class="dashboardPanel"><div class="dashboardPanelHead"><div><span>Composição</span><h2>Evolução corporal</h2></div><button data-route="bio">Ver composição →</button></div><div class="dashboardChartEmpty"><b>Evolução em revisão.</b><br>Há mais de uma medição em uma das duas datas mais recentes. Os valores foram preservados e nenhuma diferença foi calculada até a revisão.</div></section>`;
  if(!model.trend.available)return`<section class="dashboardPanel"><div class="dashboardPanelHead"><div><span>Composição</span><h2>Evolução corporal</h2></div></div><div class="dashboardChartEmpty">Ainda não há duas medições comparáveis.</div></section>`;
  const body=model.body;
  const latest=model.trend.points.at(-1);
  return `<section class="dashboardPanel dashboardComposition">
    <div class="dashboardPanelHead"><div><span>Composição</span><h2>Evolução corporal</h2></div><button data-route="bio">Ver composição →</button></div>
    <div class="dashboardSeriesHead"><b>Massa muscular</b><span>${latest?.muscleKg==null?'—':`${fmtNum(latest.muscleKg,1)} kg`}${body.available?` · ${deltaText(body.delta.muscleKg,1,'kg')} desde a anterior`:''}</span></div>
    ${miniLine(model.trend.points,'muscleKg',' kg')}
    <div class="dashboardSeriesHead second"><b>Gordura corporal</b><span>${latest?.bodyFatPct==null?'—':`${fmtNum(latest.bodyFatPct,1)}%`}${body.available?` · ${deltaText(body.delta.bodyFatPp,1,'p.p.')} desde a anterior`:''}</span></div>
    ${miniLine(model.trend.points,'bodyFatPct','%')}
  </section>`;
}

function trainingPanel(model){
  const dist=model.training.distribution;
  if(domainFailed('workouts')||domainFailed('exercises'))return`<section class="dashboardPanel"><div class="dashboardPanelHead"><div><span>Treinos</span><h2>Distribuição recente</h2></div></div><div class="dashboardChartEmpty">O histórico de treinos não carregou nesta atualização.</div></section>`;
  if(!dist.available||!dist.rows.length)return`<section class="dashboardPanel"><div class="dashboardPanelHead"><div><span>Treinos</span><h2>Distribuição recente</h2></div></div><div class="dashboardChartEmpty">Sem grupos musculares estruturados no período.</div></section>`;
  const rows=dist.rows.slice(0,8),max=Math.max(...rows.map(r=>r.sessions),1);
  return `<section class="dashboardPanel dashboardTraining">
    <div class="dashboardPanelHead"><div><span>Treinos</span><h2>Distribuição nas últimas 8 semanas</h2></div><button data-route="treinos">Ver treinos →</button></div>
    <div class="dashboardBars">${rows.map(r=>`<div class="dashboardBarRow"><span>${esc(r.label)}</span><div><i style="width:${Math.max(6,r.sessions/max*100)}%"></i></div><b>${r.sessions}</b><small>${r.sets==null?'séries não carregadas':`${r.sets} séries estruturadas`}</small></div>`).join('')}</div>
    <p class="dashboardFootnote">Mostra frequência registrada por grupo; não classifica nenhum grupo como “bom” ou “ruim”.</p>
  </section>`;
}

function segmentalInsight(model){
  const seg=model.segmental;if(!seg.available)return null;
  const parts=seg.regions.map(r=>`${r.label.toLowerCase()} ${deltaText(r.leanDeltaKg,2,'kg')}`);
  const training=seg.regions.map(r=>r.training.sessions==null?null:`${r.label.toLowerCase()}: ${r.training.sessions} sessão(ões)`).filter(Boolean);
  return infoCard('Composição × treino','Mudança segmentar com contexto do mesmo intervalo',`Massa magra segmentar: ${parts.join(' · ')}. No mesmo intervalo, registros de treino relacionados: ${training.join(' · ')}. A coincidência temporal não prova causa.`,'analise');
}
function rhythmInsight(model){
  const r=model.training.rhythm;if(!r.available)return null;
  const phrase=r.delta===0?'ficou no mesmo nível':r.delta>0?'teve mais sessões registradas':'teve menos sessões registradas';
  return infoCard('Ritmo de treino',`O bloco mais recente ${phrase}`,`${r.previous} sessão(ões) nos 28 dias anteriores e ${r.recent} nos 28 dias mais recentes.`,'treinos');
}
function nutritionInsight(model){
  const n=model.nutrition;if(!n.available||!n.days)return null;
  const reviewDays=nutritionReviewDays(model);
  const protein=n.proteinAvg==null?'proteína sem média disponível':`proteína média registrada ${fmtNum(n.proteinAvg,0)} g/dia`;
  const comparison=n.proteinDelta==null?'sem período anterior comparável':`diferença frente ao período anterior equivalente ${deltaText(n.proteinDelta,0,'g/dia')}`;
  const review=reviewDays?` · ${reviewDays} dia(s) em revisão fora das médias`:'';
  return infoCard('Composição × alimentação','Alimentação no intervalo entre medições',`${n.days} dia(s) usados no intervalo${review} · ${protein} · ${comparison}. O app não transforma essa associação em causa.`,'analise');
}
function performanceInsight(model){
  const p=model.training.performance?.[0];if(!p)return null;
  return infoCard('Performance comparável','Mesmo exercício, máquina e unidade',`${p.exercise}: ${fmtNum(p.previousWeight,Number.isInteger(p.previousWeight)?0:1)} → ${fmtNum(p.weight,Number.isInteger(p.weight)?0:1)} ${p.unit}, entre ${fmtDate(p.previousDate)} e ${fmtDate(p.date)}.`,'treinos');
}
function limitationCards(model){
  const rows=[];
  if(model.labs.available&&model.labs.reason==='ambiguous_source')rows.push(`<button class="dashboardLimitation" data-route="saude"><b>Exames precisam de revisão antes da comparação</b><span>Há mais de uma origem nas coletas recentes. Os resultados foram preservados, mas nenhuma origem foi combinada automaticamente.</span><i>→</i></button>`);
  else if(model.labs.available&&model.labs.collectionDays.length<2)rows.push(`<button class="dashboardLimitation" data-route="saude"><b>Exames ainda não têm duas coletas comparáveis</b><span>Há resultados estruturados, mas uma série temporal exige outra data de coleta.</span><i>→</i></button>`);
  else if(model.labs.available&&model.labs.reason==='no_comparable_markers')rows.push(`<button class="dashboardLimitation" data-route="saude"><b>Exames ainda não têm marcadores comparáveis</b><span>As coletas recentes foram preservadas, mas os marcadores não têm correspondência segura de nome, unidade e valor numérico.</span><i>→</i></button>`);
  const nutritionReview=nutritionReviewDays(model);
  if(nutritionReview)rows.push(`<button class="dashboardLimitation" data-route="nutricao"><b>Alimentação tem dados em revisão</b><span>${nutritionReview} dia(s) têm mais de um total preservado no mesmo dia. Esses registros ficam fora das médias e comparações até revisão.</span><i>→</i></button>`);
  if(model.sleep.available&&model.sleep.days)rows.push(`<button class="dashboardLimitation" data-route="timeline"><b>Sono está preservado, mas ainda fora das conclusões</b><span>${model.sleep.days} dia(s) registrados por fontes que continuam separados até existir uma regra segura de consolidação.</span><i>→</i></button>`);
  return rows.join('');
}

export function renderTodayHub(){
  const model=buildIntegratedAnalysis(state.data,state.domainStatus);
  const body=model.body.available?model.body.latest:null,lastWorkout=model.training.lastWorkout,lastNutrition=model.lastNutrition;
  const insights=[segmentalInsight(model),nutritionInsight(model),rhythmInsight(model),performanceInsight(model)].filter(Boolean).slice(0,4);
  const labDate=model.labs.collectionDays?.at(-1)||null;
  const bodyCard=domainFailed('body')?currentCard('Composição','Indisponível agora','As medições corporais não carregaram nesta atualização.','bio'):model.body.reason==='ambiguous'?currentCard('Composição','Revisão necessária','Há mais de uma medição corporal na data mais recente; nenhuma foi escolhida como atual.','bio'):currentCard('Composição',body&&num(body.skeletal_muscle_mass_kg)!=null?`${fmtNum(body.skeletal_muscle_mass_kg,1)} kg de massa muscular`:'Sem medição recente',body&&num(body.body_fat_pct)!=null?`${fmtNum(body.body_fat_pct,1)}% de gordura corporal · ${fmtDate(body.measured_at)}`:'Abra a composição para ver o histórico','bio');
  const workoutCard=domainFailed('workouts')?currentCard('Último treino','Indisponível agora','O histórico de treinos não carregou nesta atualização.','treinos'):currentCard('Último treino',lastWorkout?.workout_type||'Sem sessão recente',lastWorkout?`${fmtDate(lastWorkout.workout_date)}${lastWorkout.location?` · ${lastWorkout.location}`:''}`:'Nenhum treino estruturado disponível','treinos');
  const nutritionCard=domainFailed('nutrition')?currentCard('Alimentação','Indisponível agora','Os dados de alimentação não carregaram nesta atualização.','nutricao'):model.nutritionLatestAmbiguous?currentCard('Alimentação','Revisão necessária',`Há mais de um total diário em ${fmtDate(model.lastNutritionDate)}; nenhum foi escolhido como atual.`,'nutricao'):currentCard('Alimentação',lastNutrition?fmtDate(lastNutrition.nutrition_date):'Sem registro recente',lastNutrition&&num(lastNutrition.protein_g)!=null?`${fmtNum(lastNutrition.protein_g,0)} g de proteína registrados no dia`:'Histórico diário disponível em Nutrição','nutricao');
  const labCard=domainFailed('labs')?currentCard('Exames','Indisponível agora','Os resultados laboratoriais não carregaram nesta atualização.','saude'):model.labs.reason==='ambiguous_source'?currentCard('Exames','Revisão necessária','Há mais de uma origem nas coletas recentes; nenhuma foi escolhida para comparação.','saude'):model.labs.reason==='no_comparable_markers'?currentCard('Exames','Sem comparação segura','As duas coletas mais recentes não têm biomarcadores compatíveis para comparar sem suposição.','saude'):currentCard('Exames',labDate?fmtDate(labDate):'Sem coleta estruturada',model.labs.collectionDays?.length>=2?`${model.labs.comparable} biomarcador(es) comparáveis na última dupla de coletas`:'Ainda sem segunda coleta comparável','saude');
  return `<div class="dashboardScreen" data-executive-dashboard>
    <section class="dashboardHeader">
      <div><span class="dashboardEyebrow">Resumo</span><h1>Seu histórico em uma tela</h1><p>Leitura até ${esc(fmtDate(model.referenceDay))}. Primeiro as mudanças e relações; cobertura e pendências ficam em segundo plano.</p></div>
      <div class="dashboardHeaderActions">${action('analise','Análise completa')}${action('dados','Adicionar dados')}</div>
    </section>

    <section class="dashboardCurrentGrid">${bodyCard}${workoutCard}${nutritionCard}${labCard}</section>

    <div class="dashboardMainGrid">${compositionPanel(model)}${trainingPanel(model)}</div>

    <section class="dashboardSection">
      <div class="dashboardSectionHead"><div><span>Leituras integradas</span><h2>O que os dados já permitem relacionar</h2></div><small>Sem transformar coincidência temporal em causalidade.</small></div>
      <div class="dashboardInsightGrid">${insights.length?insights.join(''):'<div class="dashboardChartEmpty">Ainda não há relações suficientes para destacar.</div>'}</div>
    </section>

    ${limitationCards(model)?`<section class="dashboardSection dashboardLimitations"><div class="dashboardSectionHead"><div><span>O que ainda limita</span><h2>Dados que estão presentes, mas ainda não sustentam uma conclusão</h2></div></div><div class="dashboardLimitationGrid">${limitationCards(model)}</div></section>`:''}
  </div>`;
}