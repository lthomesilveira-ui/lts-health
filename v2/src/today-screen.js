import {state,esc,day,fmtDate,fmtNum,num,norm,unique} from './core.js';
import {buildHealthIntelligence} from './intelligence-engine.js';

const action=(route,label)=>`<button class="todayAction" data-route="${esc(route)}">${esc(label)}</button>`;
const statusLabel={strong:'Boa cobertura',partial:'Cobertura parcial',limited:'Poucos dados',unavailable:'Indisponível'};
const insightLabel={change:'O que mudou',cross:'Análise cruzada',coverage:'Limitação de cobertura',unavailable:'Indisponível'};
const pendingStatuses=new Set(['candidate','held']);
const activityTypes={
  active_energy_kcal:'Energia ativa',
  exercise_minutes:'Exercício',
  stand_hours:'Horas em pé'
};

function latest(rows,key){return[...(rows||[])].sort((a,b)=>String(b?.[key]||'').localeCompare(String(a?.[key]||'')))[0]||null;}
export function latestCanonicalActivityMetric(rows=[]){
  return latest((rows||[]).filter(row=>activityTypes[row?.metric_type]&&day(row?.measured_at)),'measured_at');
}
function domainReady(key){return state.domainStatus?.[key]==='ready';}
function currentCard(label,value,detail,route){return`<article class="intelCurrentCard"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(detail)}</small>${route?`<button data-route="${esc(route)}">Ver detalhes</button>`:''}</article>`;}
function insightCard(item,index){
  return`<article class="intelInsightCard ${esc(item.kind)}" data-intelligence-insight="${index}">
    <div class="intelInsightMeta"><span>${esc(insightLabel[item.kind]||'Leitura')}</span><i>${String(index+1).padStart(2,'0')}</i></div>
    <h3>${esc(item.title)}</h3>
    <p>${esc(item.summary)}</p>
    <button data-route="${esc(item.route||'analise')}">Abrir detalhes <span>→</span></button>
  </article>`;
}
function attentionRow(item){return`<div class="intelAttentionRow"><div><span>${esc(insightLabel[item.kind]||'Cobertura')}</span><b>${esc(item.title)}</b><small>${esc(item.summary)}</small></div><button data-route="${esc(item.route||'dados')}">Revisar</button></div>`;}
function coverageCard(row){return`<button class="intelCoverageCard ${esc(row.state)}" data-route="${esc(row.route)}"><div><span>${esc(row.label)}</span><b>${esc(statusLabel[row.state]||row.state)}</b><small>${esc(row.detail)}</small></div><i aria-hidden="true">→</i></button>`;}
function question(text,route){return`<button class="intelQuestion" data-route="${esc(route)}"><span>${esc(text)}</span><i>→</i></button>`;}
function dateText(value){return value?fmtDate(value):'Sem data';}
function unavailableValue(label){return currentCard(label,'Indisponível agora','Não foi possível carregar esta área. Os demais dados continuam disponíveis.',null);}
function pendingSleepSummary(){
  if(!domainReady('sourceMetrics'))return null;
  const rows=(state.data.sourceMetrics||[]).filter(row=>row.metric_type==='sleep_duration_h'&&pendingStatuses.has(norm(row.canonical_status))&&day(row.metric_date));
  const days=unique(rows.map(row=>day(row.metric_date))).sort();
  return{days:days.length,latest:days.at(-1)||null};
}

function currentSnapshot(){
  const workout=domainReady('workouts')?latest(state.data.workouts||[],'workout_date'):null;
  const body=domainReady('body')?latest(state.data.body||[],'measured_at'):null;
  const nutrition=domainReady('nutrition')?latest(state.data.nutrition||[],'nutrition_date'):null;
  const labs=domainReady('labs')?latest(state.data.labs||[],'collection_date'):null;
  const activity=domainReady('metrics')?latestCanonicalActivityMetric(state.data.metrics||[]):null;
  const sleep=pendingSleepSummary(),cards=[];

  if(domainReady('workouts')){
    const workoutValue=workout?(workout.workout_type||'Treino registrado'):'Nenhum treino registrado';
    cards.push(currentCard('Último treino',workoutValue,workout?dateText(workout.workout_date):'O histórico carregado não tem uma sessão nesta área','treinos'));
  }else cards.push(unavailableValue('Último treino'));

  if(domainReady('body')){
    const bodyValue=body?(num(body.weight_kg)!=null?`${fmtNum(body.weight_kg,1)} kg`:'Medição registrada'):'Nenhuma medição registrada';
    cards.push(currentCard('Última composição corporal',bodyValue,body?dateText(body.measured_at):'O histórico carregado não tem uma medição nesta área','evolucao'));
  }else cards.push(unavailableValue('Última composição corporal'));

  if(domainReady('nutrition')){
    const nutritionValue=nutrition?(num(nutrition.calories_kcal)!=null?`${fmtNum(nutrition.calories_kcal,0)} kcal`:'Dia registrado'):'Nenhuma alimentação registrada';
    cards.push(currentCard('Alimentação mais recente',nutritionValue,nutrition?dateText(nutrition.nutrition_date):'O histórico carregado não tem um dia de alimentação nesta área','nutricao'));
  }else cards.push(unavailableValue('Alimentação mais recente'));

  if(domainReady('metrics')){
    const activityValue=activity?`${fmtNum(activity.value,Number.isInteger(num(activity.value))?0:1)} ${activity.unit||''}`.trim():'Nenhum registro confirmado';
    const activityDetail=activity?`${activityTypes[activity.metric_type]} · ${dateText(activity.measured_at)}`:'Ainda não há energia ativa, minutos de exercício ou horas em pé confirmados nesta área';
    cards.push(currentCard('Atividade confirmada',activityValue,activityDetail,'timeline'));
  }else cards.push(unavailableValue('Atividade confirmada'));

  if(sleep){
    const value=sleep.days?`${sleep.days} dia(s) registrado(s)`:'Nenhum registro encontrado';
    const detail=sleep.days?`Último em ${dateText(sleep.latest)} · aguardando conferência antes de entrar em médias`:'Nenhum registro de duração do sono foi encontrado nas fontes carregadas';
    cards.push(currentCard('Sono',value,detail,'timeline'));
  }else cards.push(unavailableValue('Sono'));

  if(domainReady('labs'))cards.push(currentCard('Exames',labs?dateText(labs.collection_date):'Nenhum resultado registrado',labs?'Última coleta disponível':'O histórico carregado não tem resultados nesta área','saude'));
  else cards.push(unavailableValue('Exames'));

  return cards.join('');
}

export function renderTodayHub(){
  const model=buildHealthIntelligence(state.data,state.domainStatus);
  const primaryInsights=model.insights.slice(0,4);
  const questions=[];
  if((state.data.body||[]).length>=2)questions.push(question('O que mudou entre minhas duas últimas medições?','evolucao'));
  if((state.data.workouts||[]).length>=2)questions.push(question('Como mudou meu ritmo de treino?','analise'));
  questions.push(question('Onde meu histórico ainda é insuficiente para concluir algo?','analise'));
  questions.push(question((new Set((state.data.labs||[]).map(l=>day(l.collection_date))).size>=2)?'O que mudou entre minhas coletas de exames?':'O que falta para comparar meus exames?','saude'));

  return `<div class="intelScreen" data-executive-dashboard>
    <section class="intelHero">
      <div class="intelHeroCopy">
        <span class="intelEyebrow">LTS Health</span>
        <h1>${esc(model.headline.title)}</h1>
        <p>${esc(model.headline.subtitle)}</p>
        <div class="intelHeroMeta"><span>Leitura até ${esc(fmtDate(model.referenceDay))}</span><span>${model.comparableDomains}/5 áreas com histórico comparável</span><span>${model.strongDomains}/5 com boa cobertura</span></div>
      </div>
      <div class="intelHeroActions">${action('analise','Abrir análise completa')}${action('dados','Adicionar dados')}</div>
    </section>

    <section class="intelSection intelNow">
      <div class="intelSectionHead"><div><span>Estado atual</span><h2>O retrato mais recente, com a data sempre explícita.</h2></div><small>Ausência de dado nunca vira zero.</small></div>
      <div class="intelCurrentGrid">${currentSnapshot()}</div>
    </section>

    <section class="intelSection intelChanges">
      <div class="intelSectionHead"><div><span>Análise</span><h2>O que merece sua atenção no histórico.</h2></div><small>As relações entre datas servem como contexto; não são tratadas como causa.</small></div>
      <div class="intelInsightGrid">${primaryInsights.length?primaryInsights.map(insightCard).join(''):'<div class="intelEmpty">Ainda não há mudanças com dados suficientes para destacar.</div>'}</div>
    </section>

    <section class="intelSplit">
      <div class="intelSection">
        <div class="intelSectionHead"><div><span>Pontos de atenção</span><h2>O que limita uma leitura mais completa.</h2></div></div>
        <div class="intelAttentionList">${model.attention.length?model.attention.map(attentionRow).join(''):'<div class="intelEmpty compact">Nenhuma limitação adicional foi identificada pelos critérios atuais.</div>'}</div>
      </div>
      <div class="intelSection">
        <div class="intelSectionHead"><div><span>Cobertura</span><h2>Quanto histórico existe em cada área.</h2></div></div>
        <div class="intelCoverageGrid">${model.coverage.map(coverageCard).join('')}</div>
      </div>
    </section>

    <section class="intelSection intelAsk">
      <div class="intelSectionHead"><div><span>Pergunte ao histórico</span><h2>Perguntas que os dados já conseguem orientar.</h2></div><small>As respostas abrem os registros usados como base.</small></div>
      <div class="intelQuestionGrid">${questions.join('')}</div>
    </section>

    <section class="intelFootnote">
      <b>Como o LTS Health lê seus dados</b>
      <p>O dashboard usa somente registros confirmados nas conclusões. Dados conflitantes ou ainda em conferência continuam preservados e aparecem como existentes, mas ficam fora de médias e comparações. Nenhum valor é inventado para preencher lacunas.</p>
    </section>
  </div>`;
}