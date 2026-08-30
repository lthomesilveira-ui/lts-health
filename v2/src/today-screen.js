import {state,esc,day,fmtDate,fmtNum,num} from './core.js';
import {buildHealthIntelligence} from './intelligence-engine.js';

const action=(route,label)=>`<button class="todayAction" data-route="${esc(route)}">${esc(label)}</button>`;
const statusLabel={strong:'Boa cobertura',partial:'Cobertura parcial',limited:'Poucos dados',unavailable:'Indisponível'};
const insightLabel={change:'O que mudou',cross:'Análise cruzada',coverage:'Limitação de cobertura',unavailable:'Indisponível'};

function latest(rows,key){return[...(rows||[])].sort((a,b)=>String(b?.[key]||'').localeCompare(String(a?.[key]||'')))[0]||null;}
function latestMetric(type){return latest((state.data.metrics||[]).filter(m=>m.metric_type===type),'measured_at');}
function currentCard(label,value,detail,route){return`<article class="intelCurrentCard"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(detail)}</small>${route?`<button data-route="${esc(route)}">Ver evidência</button>`:''}</article>`;}
function insightCard(item,index){
  return`<article class="intelInsightCard ${esc(item.kind)}" data-intelligence-insight="${index}">
    <div class="intelInsightMeta"><span>${esc(insightLabel[item.kind]||'Leitura')}</span><i>${String(index+1).padStart(2,'0')}</i></div>
    <h3>${esc(item.title)}</h3>
    <p>${esc(item.summary)}</p>
    <button data-route="${esc(item.route||'analise')}">Abrir evidência <span>→</span></button>
  </article>`;
}
function attentionRow(item){return`<div class="intelAttentionRow"><div><span>${esc(insightLabel[item.kind]||'Cobertura')}</span><b>${esc(item.title)}</b><small>${esc(item.summary)}</small></div><button data-route="${esc(item.route||'dados')}">Revisar</button></div>`;}
function coverageCard(row){return`<button class="intelCoverageCard ${esc(row.state)}" data-route="${esc(row.route)}"><div><span>${esc(row.label)}</span><b>${esc(statusLabel[row.state]||row.state)}</b><small>${esc(row.detail)}</small></div><i aria-hidden="true">→</i></button>`;}
function question(text,route){return`<button class="intelQuestion" data-route="${esc(route)}"><span>${esc(text)}</span><i>→</i></button>`;}
function dateText(value){return value?fmtDate(value):'Sem data';}

function currentSnapshot(model){
  const workout=latest(state.data.workouts||[],'workout_date'),body=latest(state.data.body||[],'measured_at'),nutrition=latest(state.data.nutrition||[],'nutrition_date'),labs=latest(state.data.labs||[],'collection_date');
  const activity=latestMetric('active_energy_kcal')||latestMetric('exercise_minutes')||latestMetric('stand_hours');
  const bodyValue=body?(num(body.weight_kg)!=null?`${fmtNum(body.weight_kg,1)} kg`:'Medição registrada'):'Sem medição';
  const workoutValue=workout?(workout.workout_type||'Treino registrado'):'Sem treino';
  const nutritionValue=nutrition?(num(nutrition.calories_kcal)!=null?`${fmtNum(nutrition.calories_kcal,0)} kcal`:'Dia registrado'):'Sem alimentação';
  const activityValue=activity?`${fmtNum(activity.value,1)} ${activity.unit||''}`:'Sem dado consolidado';
  return[
    currentCard('Último treino',workoutValue,workout?dateText(workout.workout_date):'Nenhuma sessão estruturada','treinos'),
    currentCard('Última composição',bodyValue,body?dateText(body.measured_at):'Nenhuma medição estruturada','evolucao'),
    currentCard('Alimentação mais recente',nutritionValue,nutrition?dateText(nutrition.nutrition_date):'Nenhum dia estruturado','nutricao'),
    currentCard('Atividade consolidada',activityValue,activity?dateText(activity.measured_at):'Ainda sem leitura confirmada','timeline'),
    currentCard('Sono','Em validação','Fontes ainda não consolidadas; registros permanecem preservados por origem','timeline'),
    currentCard('Exames estruturados',labs?dateText(labs.collection_date):'Sem coleta',labs?'Última coleta disponível':'Nenhum resultado estruturado','saude')
  ].join('');
}

export function renderTodayHub(){
  const model=buildHealthIntelligence(state.data,state.domainStatus);
  const primaryInsights=model.insights.slice(0,4);
  const questions=[];
  if((state.data.body||[]).length>=2)questions.push(question('O que mudou entre minhas duas últimas medições?','evolucao'));
  if((state.data.workouts||[]).length>=2)questions.push(question('Como mudou meu ritmo de treino?','analise'));
  questions.push(question('Onde meus dados ainda são insuficientes para concluir algo?','analise'));
  questions.push(question((new Set((state.data.labs||[]).map(l=>day(l.collection_date))).size>=2)?'O que mudou entre minhas coletas de exames?':'O que falta para comparar meus exames?','saude'));

  return `<div class="intelScreen" data-executive-dashboard>
    <section class="intelHero">
      <div class="intelHeroCopy">
        <span class="intelEyebrow">LTS Health</span>
        <h1>${esc(model.headline.title)}</h1>
        <p>${esc(model.headline.subtitle)}</p>
        <div class="intelHeroMeta"><span>Leitura até ${esc(fmtDate(model.referenceDay))}</span><span>${model.comparableDomains}/5 áreas comparáveis</span><span>${model.strongDomains}/5 com boa cobertura</span></div>
      </div>
      <div class="intelHeroActions">${action('analise','Abrir análise completa')}${action('dados','Adicionar dados')}</div>
    </section>

    <section class="intelSection intelNow">
      <div class="intelSectionHead"><div><span>Estado atual</span><h2>O retrato mais recente, com a data sempre explícita.</h2></div><small>Ausência de dado nunca vira zero.</small></div>
      <div class="intelCurrentGrid">${currentSnapshot(model)}</div>
    </section>

    <section class="intelSection intelChanges">
      <div class="intelSectionHead"><div><span>Análise</span><h2>O que merece sua atenção no histórico.</h2></div><small>Conclusões descritivas; relações temporais não são tratadas como causa.</small></div>
      <div class="intelInsightGrid">${primaryInsights.length?primaryInsights.map(insightCard).join(''):'<div class="intelEmpty">Ainda não há mudanças com evidência suficiente para destacar.</div>'}</div>
    </section>

    <section class="intelSplit">
      <div class="intelSection">
        <div class="intelSectionHead"><div><span>Pontos de atenção</span><h2>O que limita uma leitura mais forte.</h2></div></div>
        <div class="intelAttentionList">${model.attention.length?model.attention.map(attentionRow).join(''):'<div class="intelEmpty compact">Nenhuma limitação adicional foi identificada pelos critérios atuais.</div>'}</div>
      </div>
      <div class="intelSection">
        <div class="intelSectionHead"><div><span>Cobertura</span><h2>Quanto cada área sustenta comparações.</h2></div></div>
        <div class="intelCoverageGrid">${model.coverage.map(coverageCard).join('')}</div>
      </div>
    </section>

    <section class="intelSection intelAsk">
      <div class="intelSectionHead"><div><span>Pergunte ao histórico</span><h2>Perguntas que os dados já conseguem orientar.</h2></div><small>Esta versão abre a evidência correspondente.</small></div>
      <div class="intelQuestionGrid">${questions.join('')}</div>
    </section>

    <section class="intelFootnote">
      <b>Como o LTS Health lê seus dados</b>
      <p>O dashboard usa somente registros estruturados e confirmados. Dados conflitantes ou ainda em revisão ficam fora das conclusões. Nenhum gráfico ou frase é usado para preencher lacunas por estimativa.</p>
    </section>
  </div>`;
}
