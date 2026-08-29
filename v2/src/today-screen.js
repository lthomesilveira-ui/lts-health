import {state,esc,day,fmtDate,fmtNum,num,workoutRows,bodyRows,unique,norm,exercisesFor,setsFor} from './core.js';
import {sourceStatusFor} from './source-status.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1>${description?`<p>${esc(description)}</p>`:''}</div></div>`;
const localDay=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;};
const failed=key=>state.domainStatus[key]==='error';
const metricTypes=new Set(['active_energy_kcal','exercise_minutes','stand_hours','sleep_duration_h']);
const metricLabel={active_energy_kcal:'Energia ativa',exercise_minutes:'Exercício',stand_hours:'Horas em pé',sleep_duration_h:'Sono'};
const metricFallbackUnit={active_energy_kcal:'kcal',exercise_minutes:'min',stand_hours:'h',sleep_duration_h:'h'};
const metricDigits={active_energy_kcal:0,exercise_minutes:0,stand_hours:0,sleep_duration_h:1};
const metricOrder=['active_energy_kcal','exercise_minutes','stand_hours','sleep_duration_h'];
const otherMetricTypes=new Set(['steps','resting_heart_rate_bpm']);

function latestLab(){
  const rows=state.data.labs||[];if(!rows.length)return null;const date=[...rows].map(r=>r.collection_date).filter(Boolean).sort().at(-1),same=rows.filter(r=>r.collection_date===date);return{date,count:same.length,lab:unique(same.map(r=>r.laboratory)).join(', ')};
}
function sourceRow(label,stateValue,missingText){
  if(stateValue==='ready')return'';
  if(stateValue==='processing')return`<div><span>${esc(label)}</span><b>Arquivo em processamento</b><small>Os dados só serão considerados quando a leitura estiver concluída.</small></div>`;
  if(stateValue==='attention')return`<div><span>${esc(label)}</span><b>Arquivo precisa de revisão</b><small>O original está preservado. Confira a área Dados.</small></div>`;
  if(stateValue==='received')return`<div><span>${esc(label)}</span><b>Arquivo recebido; dados ainda não confirmados</b><small>Ter o arquivo não significa que os dados foram estruturados.</small></div>`;
  if(stateValue==='unknown')return`<div><span>${esc(label)}</span><b>Não foi possível confirmar agora</b><small>Atualize para tentar carregar essa fonte novamente.</small></div>`;
  return`<div><span>${esc(label)}</span><b>${esc(missingText)}</b><small>Use a área Dados para trazer essa fonte.</small></div>`;
}
function action(route,label,ref='',kind=''){
  if(kind==='nutrition'&&ref)return`<button class="todayAction" data-timeline-jump data-timeline-route="${esc(route)}" data-timeline-kind="nutrition" data-timeline-date="${esc(ref)}">${esc(label)}</button>`;
  if(kind&&ref)return`<button class="todayAction" data-timeline-jump data-timeline-route="${esc(route)}" data-timeline-kind="${esc(kind)}" data-timeline-ref="${esc(ref)}">${esc(label)}</button>`;
  return`<button class="todayAction" data-route="${esc(route)}">${esc(label)}</button>`;
}
function summaryCard(label,main,sub='',actionHtml='',kind=''){
  return`<article class="todaySummaryCard ${kind}"><span>${esc(label)}</span><b>${esc(main)}</b>${sub?`<small>${esc(sub)}</small>`:''}${actionHtml?`<div class="todayActions">${actionHtml}</div>`:''}</article>`;
}
function domainUnavailable(label,detail){return`<article class="todayStatusCard unavailable"><span>${esc(label)}</span><b>Indisponível agora</b><small>${esc(detail)}</small></article>`;}
function latestMetric(rows,type){return[...(rows||[])].filter(m=>m.metric_type===type&&metricTypes.has(m.metric_type)).sort((a,b)=>String(b.measured_at).localeCompare(String(a.measured_at)))[0]||null;}
function availabilityLabel(value,today){const d=day(value);return d&&d===today?'Hoje':d?`Último disponível em ${fmtDate(d)}`:'Último disponível';}
function metricCard(metrics,type,today){
  const row=latestMetric(metrics,type),label=metricLabel[type];
  if(!row)return`<article class="todayStatusCard"><span>${esc(label)}</span><b>Sem dado importado</b><small>Nenhum registro disponível.</small></article>`;
  return`<article class="todayStatusCard"><span>${esc(label)}</span><b>${fmtNum(row.value,metricDigits[type])} ${esc(row.unit||metricFallbackUnit[type])}</b><small>${esc(availabilityLabel(row.measured_at,today))}</small></article>`;
}
function existingOtherMetricCards(metrics,today){
  return [...otherMetricTypes].map(type=>latestMetricByType(metrics,type)).filter(Boolean).map(row=>`<article class="todayStatusCard secondary"><span>${esc(otherMetricLabel(row.metric_type))}</span><b>${fmtNum(row.value,otherMetricDigits(row.metric_type))} ${esc(row.unit||otherMetricUnit(row.metric_type))}</b><small>${esc(availabilityLabel(row.measured_at,today))}</small></article>`).join('');
}
function latestMetricByType(rows,type){return[...(rows||[])].filter(m=>m.metric_type===type).sort((a,b)=>String(b.measured_at).localeCompare(String(a.measured_at)))[0]||null;}
function otherMetricLabel(type){return type==='steps'?'Passos':type==='resting_heart_rate_bpm'?'FC de repouso':String(type||'Métrica').replaceAll('_',' ');}
function otherMetricDigits(type){return type==='steps'?0:0;}
function otherMetricUnit(type){return type==='steps'?'passos':type==='resting_heart_rate_bpm'?'bpm':'';}
function contextCard(label,main,sub='',route=''){
  return`<article class="todayContextCard"><span>${esc(label)}</span><b>${esc(main)}</b>${sub?`<small>${esc(sub)}</small>`:''}${route?`<button class="todayContextAction" data-route="${esc(route)}">Abrir</button>`:''}</article>`;
}
function recentRow(label,date,main,sub='',actionHtml=''){
  return`<div class="todayRecentRow"><div><span>${esc(label)}</span><b>${esc(main)}</b>${sub?`<small>${esc(sub)}</small>`:''}</div><div>${date?`<time>${esc(fmtDate(date))}</time>`:''}${actionHtml||''}</div></div>`;
}
function bodyDelta(rows,key,digits=1,unit=''){
  const available=rows.filter(r=>num(r?.[key])!=null);if(available.length<2)return null;
  const first=available.at(-2),last=available.at(-1),delta=num(last[key])-num(first[key]);
  return{delta,text:`${delta>0?'+':''}${fmtNum(delta,digits)}${unit?` ${unit}`:''}`,from:first.measured_at,to:last.measured_at};
}
function latestMetricCount(metrics){
  const dates=unique(metrics.map(m=>day(m.measured_at)).filter(Boolean)).sort();const latest=dates.at(-1);return latest?{date:latest,count:new Set(metrics.filter(m=>day(m.measured_at)===latest).map(m=>m.metric_type)).size}:null;
}
function latestWorkoutPair(workouts){return workouts.length>=2?[workouts[1],workouts[0]]:null;}
function comparableExerciseKey(exercise){return`${norm(exercise?.exercise)}|${norm(exercise?.machine)}`;}
function bestLoad(exercise){
  const rows=setsFor(exercise).filter(s=>num(s.weight)!=null&&s.weight_unit);if(!rows.length)return null;
  const units=unique(rows.map(s=>norm(s.weight_unit)));if(units.length!==1)return null;
  return{value:Math.max(...rows.map(s=>num(s.weight))),unit:rows.find(s=>norm(s.weight_unit)===units[0])?.weight_unit||units[0]};
}
function workoutProgressCard(workouts){
  const pair=latestWorkoutPair(workouts);if(!pair)return contextCard('Progressão de treino','Histórico insuficiente','São necessárias duas sessões recentes.');
  const [older,newer]=pair,olderExercises=exercisesFor(older),newerExercises=exercisesFor(newer),olderMap=new Map(olderExercises.map(e=>[comparableExerciseKey(e),e]));
  for(const exercise of newerExercises){
    const previous=olderMap.get(comparableExerciseKey(exercise));if(!previous)continue;
    const a=bestLoad(previous),b=bestLoad(exercise);if(!a||!b||norm(a.unit)!==norm(b.unit))continue;
    return contextCard('Progressão de treino',`${exercise.exercise}: ${fmtNum(a.value,0)} → ${fmtNum(b.value,0)} ${b.unit}`,`Comparação entre ${fmtDate(older.workout_date)} e ${fmtDate(newer.workout_date)} com o mesmo exercício, a mesma máquina e a mesma unidade.`,'treinos');
  }
  return contextCard('Progressão de treino','Sem exercício comparável nas duas sessões','A comparação só usa o mesmo exercício, a mesma máquina e a mesma unidade.');
}
function recentContext(body,workouts,metrics,lab){
  const cards=[];
  if(failed('body'))cards.push(domainUnavailable('Composição corporal','A comparação corporal não carregou agora.'));
  else{
    const weight=bodyDelta(body,'weight_kg',1,'kg'),muscle=bodyDelta(body,'skeletal_muscle_mass_kg',1,'kg'),fat=bodyDelta(body,'body_fat_pct',1,'p.p.');
    const facts=[weight?`peso ${weight.text}`:null,muscle?`MME ${muscle.text}`:null,fat?`gordura ${fat.text}`:null].filter(Boolean);
    cards.push(contextCard('Composição corporal',facts.length?facts.join(' · '):'Sem duas medições comparáveis',facts.length?`Entre ${fmtDate((weight||muscle||fat)?.from)} e ${fmtDate((weight||muscle||fat)?.to)}.`:'Não há dois pontos compatíveis para calcular diferenças.','evolucao'));
  }
  if(failed('workouts'))cards.push(domainUnavailable('Treinos','O histórico de treinos não carregou agora.'));
  else if(workouts.length)cards.push(contextCard('Treinos',`${Math.min(2,workouts.length)} sessão(ões) mais recente(s)`,workouts.slice(0,2).map(w=>`${fmtDate(w.workout_date)} · ${w.workout_type||'Treino'}`).join(' | '),'treinos'));
  else cards.push(contextCard('Treinos','Sem sessão registrada','Nenhum treino estruturado está disponível.'));
  if(failed('metrics'))cards.push(domainUnavailable('Métricas','As métricas não carregaram agora.'));
  else{
    const latest=latestMetricCount(metrics);cards.push(contextCard('Métricas',latest?`${latest.count} tipo(s) de métrica em ${fmtDate(latest.date)}`:'Sem métrica estruturada',latest?'Contagem por tipos disponíveis na data mais recente.':'Nenhuma métrica estruturada está disponível.','timeline'));
  }
  if(failed('labs'))cards.push(domainUnavailable('Exames','Os resultados laboratoriais não carregaram agora.'));
  else if(lab)cards.push(contextCard('Exames',`${lab.count} resultado(s) na coleta mais recente`,`${fmtDate(lab.date)}${lab.lab?` · ${lab.lab}`:''}`,'saude'));
  else cards.push(contextCard('Exames','Sem resultado estruturado','Nenhuma coleta laboratorial estruturada está disponível.'));
  return cards.join('');
}

export function renderTodayHub(){
  const today=localDay(),workouts=workoutRows(),body=bodyRows(),lastWorkout=workouts[0],lastBody=body.at(-1),nutrition=(state.data.nutrition||[]).find(n=>day(n.nutrition_date)===today),metrics=state.data.metrics||[],lab=latestLab();
  const apple=sourceStatusFor('apple_health'),einstein=sourceStatusFor('einstein');
  const workoutSub=lastWorkout?[availabilityLabel(lastWorkout.workout_date,today),lastWorkout.location].filter(Boolean).join(' · '):'';
  const bodySub=lastBody?[availabilityLabel(lastBody.measured_at,today),num(lastBody.skeletal_muscle_mass_kg)!=null?`MME ${fmtNum(lastBody.skeletal_muscle_mass_kg)} kg`:null].filter(Boolean).join(' · '):'';
  const nutritionMain=nutrition?(num(nutrition.calories_kcal)!=null?`${fmtNum(nutrition.calories_kcal,0)} kcal`:'Registro disponível'):'Sem registro para hoje';
  const nutritionSub=nutrition&&num(nutrition.protein_g)!=null?`${fmtNum(nutrition.protein_g,0)} g de proteína`:'';
  const metricCards=failed('metrics')?metricOrder.map(type=>domainUnavailable(metricLabel[type],'Esta métrica não carregou agora. Os registros existentes continuam preservados.')).join(''):metricOrder.map(type=>metricCard(metrics,type,today)).join('');
  const otherMetricCards=failed('metrics')?'':existingOtherMetricCards(metrics,today);

  return `${title('Hoje',fmtDate(today))}
    <section class="todayLead">
      <div><span>Resumo</span><h2>O que é de hoje e o último dado disponível.</h2><p>Quando um registro não é de hoje, a data mais recente fica explícita. Nenhuma lacuna é preenchida.</p></div>
      <div class="todayLeadActions">${action('treinos','Ver treinos')}${action('dados','Adicionar dados')}</div>
    </section>

    <div class="todaySummaryGrid">
      ${failed('workouts')?domainUnavailable('Último treino','Os treinos não carregaram. Os demais dados continuam disponíveis.'):lastWorkout?summaryCard('Último treino',lastWorkout.workout_type||'Treino',workoutSub,action('treinos','Abrir treino',lastWorkout.source_record_id,'workout'),'accent'):summaryCard('Último treino','Sem treino registrado')}
      ${failed('body')?domainUnavailable('Última bio','As medições corporais não carregaram. Os demais dados continuam disponíveis.'):lastBody?summaryCard('Última bio',num(lastBody.weight_kg)!=null?`${fmtNum(lastBody.weight_kg)} kg`:'Medição disponível',bodySub,action('bio','Abrir bio',day(lastBody.measured_at),'body')):summaryCard('Última bio','Sem bio registrada')}
      ${failed('nutrition')?domainUnavailable('Alimentação hoje','Os registros de alimentação não carregaram.'):summaryCard('Alimentação hoje',nutritionMain,nutritionSub,nutrition?action('nutricao','Ver dia',today,'nutrition'):action('nutricao','Ver histórico'))}
      ${failed('labs')?domainUnavailable('Exames','Os exames não carregaram.'):lab?summaryCard('Exames mais recentes',`${lab.count} resultado(s)`,`${availabilityLabel(lab.date,today)}${lab.lab?` · ${lab.lab}`:''}`,action('saude','Ver exames')):summaryCard('Exames','Sem resultados estruturados')}
    </div>

    <section class="todaySection todayContextSection">
      <div class="cardHead"><div><b>Contexto recente</b><small>Diferenças e registros recentes apresentados de forma descritiva, sem transformar coincidências em causa ou meta.</small></div></div>
      <div class="todayContextGrid">${recentContext(body,workouts,metrics,lab)}${workoutProgressCard(workouts)}</div>
    </section>

    <section class="todaySection">
      <div class="cardHead"><div><b>Atividade e sono</b><small>Energia ativa, minutos de exercício e horas em pé têm sincronização automática validada. Sono pode ser exibido quando já existe como métrica estruturada, mas permanece fora da sincronização automática até existir uma regra validada de deduplicação por origem. Cada cartão indica se o dado é de hoje ou apenas o último disponível.</small></div></div>
      <div class="todayMetricGrid">${metricCards}</div>
    </section>

    ${otherMetricCards?`<section class="todaySection"><div class="cardHead"><div><b>Outros registros disponíveis</b><small>Estes itens já existem no histórico e podem vir de outras origens. Eles não ampliam o conjunto canônico automático do Apple Saúde.</small></div></div><div class="todayOtherMetricGrid todayMetricGridSecondary">${otherMetricCards}</div></section>`:''}

    <div class="grid cols2 sectionGap">
      <section class="card todayRecent"><div class="cardHead"><div><b>Últimos registros</b><small>Acesso rápido ao que entrou mais recentemente.</small></div></div>
        ${failed('workouts')?recentRow('Treino','', 'Indisponível agora','Os registros existentes não foram substituídos por zero.'):lastWorkout?recentRow('Treino',lastWorkout.workout_date,lastWorkout.workout_type||'Treino',lastWorkout.location||'',action('treinos','Abrir',lastWorkout.source_record_id,'workout')):''}
        ${failed('body')?recentRow('Bio','', 'Indisponível agora','As medições existentes não foram substituídas por zero.'):lastBody?recentRow('Bio',lastBody.measured_at,num(lastBody.weight_kg)!=null?`${fmtNum(lastBody.weight_kg)} kg`:'Medição disponível',num(lastBody.skeletal_muscle_mass_kg)!=null?`MME ${fmtNum(lastBody.skeletal_muscle_mass_kg)} kg`:'',action('bio','Abrir',day(lastBody.measured_at),'body')):''}
        ${failed('labs')?recentRow('Exames','', 'Indisponíveis agora','Tente atualizar para carregar as coletas novamente.'):lab?recentRow('Exames',lab.date,`${lab.count} resultado(s)`,lab.lab||'',action('saude','Abrir')):''}
      </section>
      <section class="card"><div class="cardHead"><div><b>Fontes e pendências</b><small>Arquivo recebido e dado estruturado são estados diferentes.</small></div></div><div class="quickList">
        ${sourceRow('Apple Saúde',apple,'Export ainda não importado')}
        ${sourceRow('Einstein',einstein,'Exames ainda não importados')}
        ${apple==='ready'&&einstein==='ready'?'<div><b>As fontes principais têm dados estruturados confirmados.</b></div>':''}
      </div></section>
    </div>`;
}
