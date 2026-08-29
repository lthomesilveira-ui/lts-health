import {state,esc,day,fmtDate,fmtNum,num,workoutRows,bodyRows,unique,norm,exercisesFor,setsFor} from './core.js';

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
function hasSource(term,rows,fields){return(rows||[]).some(r=>fields.some(f=>norm(r?.[f]).includes(term)));}
function sourceState(found,unknown){return found?'ready':unknown?'unknown':'missing';}
function sourceRow(label,stateValue,missingText){
  if(stateValue==='ready')return'';
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
function metricCard(rows,type){
  const label=metricLabel[type],m=latestMetric(rows,type);if(!m)return`<article class="todayStatusCard"><span>${esc(label)}</span><b>Sem dado importado</b><small>Nenhum registro disponível para esta métrica.</small></article>`;
  const value=num(m.value),unit=m.unit||metricFallbackUnit[type];
  const display=value==null?'Registro disponível':`${fmtNum(value,metricDigits[type]??1)} ${esc(unit)}`;
  return`<article class="todayStatusCard"><span>${esc(label)}</span><b>${display}</b><small>${fmtDate(m.measured_at)}${m.source?` · ${esc(m.source)}`:''}</small></article>`;
}
function existingOtherMetricCards(rows){
  const latestByType=new Map();
  for(const row of [...(rows||[])].filter(r=>otherMetricTypes.has(r.metric_type)).sort((a,b)=>String(b.measured_at).localeCompare(String(a.measured_at))))if(!latestByType.has(row.metric_type))latestByType.set(row.metric_type,row);
  return [...latestByType.entries()].map(([type,row])=>{
    const value=num(row.value),label=type==='steps'?'Passos':'FC de repouso';
    const display=value==null?'Registro disponível':type==='steps'?`${fmtNum(value,0)} passos`:`${fmtNum(value,0)} bpm`;
    return`<article class="todayStatusCard"><span>${esc(label)}</span><b>${display}</b><small>${fmtDate(row.measured_at)}${row.source?` · ${esc(row.source)}`:''}</small></article>`;
  }).join('');
}
function recentRow(label,date,main,sub='',button=''){
  return`<div class="todayRecentRow"><div><span>${esc(label)}</span><b>${esc(main)}</b><small>${esc([date?fmtDate(date):'',sub].filter(Boolean).join(' · '))}</small></div>${button}</div>`;
}
function signed(value,digits=1,unit=''){
  value=num(value);if(value==null)return'—';return`${value>0?'+':''}${fmtNum(value,digits)}${unit?` ${unit}`:''}`;
}
function contextCard(label,headline,detail,route='',ref='',kind=''){
  const button=route?action(route,'Abrir',ref,kind):'';
  return `<article class="todayContextCard"><span>${esc(label)}</span><b>${esc(headline)}</b><p>${esc(detail)}</p>${button?`<div class="todayActions">${button}</div>`:''}</article>`;
}
function workoutProgressCard(workouts){
  if(failed('workouts'))return domainUnavailable('Progressão de treino','As sessões não carregaram agora.');
  if(failed('exercises')||failed('sets'))return domainUnavailable('Progressão de treino','Exercícios ou séries não carregaram agora; as sessões continuam disponíveis.');
  if(workouts.length<2)return contextCard('Progressão de treino','Sem comparação entre sessões','São necessárias pelo menos duas sessões carregadas.');
  const latest=workouts[0],previous=workouts[1];
  const prevMap=new Map(exercisesFor(previous).map(e=>[norm(e.exercise),e]));
  const comparisons=[];
  for(const currentExercise of exercisesFor(latest)){
    const key=norm(currentExercise.exercise),previousExercise=prevMap.get(key);if(!key||!previousExercise)continue;
    const currentSets=setsFor(currentExercise),previousSets=setsFor(previousExercise),units=unique([...currentSets,...previousSets].map(s=>s.weight_unit||'sem unidade'));
    for(const unit of units){
      const currentWeights=currentSets.filter(s=>(s.weight_unit||'sem unidade')===unit).map(s=>num(s.weight)).filter(v=>v!=null);
      const previousWeights=previousSets.filter(s=>(s.weight_unit||'sem unidade')===unit).map(s=>num(s.weight)).filter(v=>v!=null);
      if(!currentWeights.length||!previousWeights.length)continue;
      const now=Math.max(...currentWeights),before=Math.max(...previousWeights),delta=now-before;
      comparisons.push(`${currentExercise.exercise}: ${before} → ${now} ${unit==='plate_index'?'placa':unit}${delta===0?'':` (${delta>0?'+':''}${fmtNum(delta,Number.isInteger(delta)?0:1)})`}`);
    }
  }
  if(!comparisons.length)return contextCard('Progressão de treino','Sem exercício comparável nas duas sessões','A comparação exige a mesma descrição de exercício e a mesma unidade nas duas sessões.','treinos',latest.source_record_id,'workout');
  return contextCard('Progressão de treino',`${fmtDate(previous.workout_date)} → ${fmtDate(latest.workout_date)}`,comparisons.slice(0,3).join(' · '),'treinos',latest.source_record_id,'workout');
}
function recentContext(body,workouts,metrics,lab){
  const cards=[];
  if(failed('body'))cards.push(domainUnavailable('Composição corporal','As medições corporais não carregaram agora.'));
  else if(body.length>=2){
    const last=body.at(-1),prev=body.at(-2),parts=[];
    if(num(last.weight_kg)!=null&&num(prev.weight_kg)!=null)parts.push(`peso ${signed(num(last.weight_kg)-num(prev.weight_kg),1,'kg')}`);
    if(num(last.skeletal_muscle_mass_kg)!=null&&num(prev.skeletal_muscle_mass_kg)!=null)parts.push(`MME ${signed(num(last.skeletal_muscle_mass_kg)-num(prev.skeletal_muscle_mass_kg),1,'kg')}`);
    if(num(last.body_fat_pct)!=null&&num(prev.body_fat_pct)!=null)parts.push(`gordura ${signed(num(last.body_fat_pct)-num(prev.body_fat_pct),1,'p.p.')}`);
    cards.push(contextCard('Composição corporal',`${fmtDate(prev.measured_at)} → ${fmtDate(last.measured_at)}`,parts.length?parts.join(' · '):'Duas medições disponíveis para comparação.','bio',day(last.measured_at),'body'));
  }else cards.push(contextCard('Composição corporal','Sem comparação entre medições','É preciso haver pelo menos duas medições registradas para mostrar diferenças.'));

  if(failed('workouts'))cards.push(domainUnavailable('Treinos','As sessões não carregaram agora.'));
  else if(workouts.length>=2){const last=workouts[0],prev=workouts[1];cards.push(contextCard('Treinos','Duas sessões mais recentes',`${fmtDate(prev.workout_date)} · ${prev.workout_type||'Treino'} → ${fmtDate(last.workout_date)} · ${last.workout_type||'Treino'}`,'treinos',last.source_record_id,'workout'));}
  else if(workouts.length===1){const last=workouts[0];cards.push(contextCard('Treinos','Uma sessão registrada',`${fmtDate(last.workout_date)} · ${last.workout_type||'Treino'}`,'treinos',last.source_record_id,'workout'));}
  else cards.push(contextCard('Treinos','Sem sessão registrada','Nenhuma sessão está disponível no histórico carregado.'));

  if(failed('metrics'))cards.push(domainUnavailable('Atividade e sono','As métricas não carregaram agora.'));
  else{
    const supported=(metrics||[]).filter(m=>metricTypes.has(m.metric_type)&&day(m.measured_at));
    const latestDay=unique(supported.map(m=>day(m.measured_at))).sort().at(-1)||null;
    const types=latestDay?unique(supported.filter(m=>day(m.measured_at)===latestDay).map(m=>m.metric_type)):[];
    cards.push(contextCard('Atividade e sono',latestDay?`${types.length} tipo(s) de métrica em ${fmtDate(latestDay)}`:'Sem métrica importada',latestDay?types.map(t=>metricLabel[t]||t).join(' · '):'As quatro métricas suportadas aparecerão quando houver dados disponíveis.'));
  }

  if(failed('labs'))cards.push(domainUnavailable('Exames','Os resultados laboratoriais não carregaram agora.'));
  else if(lab)cards.push(contextCard('Exames',`${lab.count} resultado(s) na coleta mais recente`,`${fmtDate(lab.date)}${lab.lab?` · ${lab.lab}`:''}`,'saude'));
  else cards.push(contextCard('Exames','Sem resultado estruturado','Nenhuma coleta laboratorial estruturada está disponível.'));
  return cards.join('');
}

export function renderTodayHub(){
  const today=localDay(),workouts=workoutRows(),body=bodyRows(),lastWorkout=workouts[0],lastBody=body.at(-1),nutrition=(state.data.nutrition||[]).find(n=>day(n.nutrition_date)===today),metrics=state.data.metrics||[],lab=latestLab();
  const uploads=state.data.uploads||[],labs=state.data.labs||[];
  const appleFound=uploads.some(u=>norm(u.source_type)==='apple_health')||hasSource('apple',metrics,['source','source_file']);
  const einsteinFound=uploads.some(u=>norm(u.source_type)==='einstein')||hasSource('einstein',labs,['laboratory','source','source_file']);
  const apple=sourceState(appleFound,failed('uploads')||failed('metrics'));
  const einstein=sourceState(einsteinFound,failed('uploads')||failed('labs'));
  const workoutSub=lastWorkout?[fmtDate(lastWorkout.workout_date),lastWorkout.location].filter(Boolean).join(' · '):'';
  const bodySub=lastBody?[`MME ${fmtNum(lastBody.skeletal_muscle_mass_kg)} kg`,fmtDate(lastBody.measured_at)].filter(Boolean).join(' · '):'';
  const nutritionMain=nutrition?(num(nutrition.calories_kcal)!=null?`${fmtNum(nutrition.calories_kcal,0)} kcal`:'Registro disponível'):'Sem registro para hoje';
  const nutritionSub=nutrition&&num(nutrition.protein_g)!=null?`${fmtNum(nutrition.protein_g,0)} g de proteína`:'';
  const metricCards=failed('metrics')?metricOrder.map(type=>domainUnavailable(metricLabel[type],'Esta métrica não carregou agora. Os registros existentes continuam preservados.')).join(''):metricOrder.map(type=>metricCard(metrics,type)).join('');
  const otherMetricCards=failed('metrics')?'':existingOtherMetricCards(metrics);

  return `${title('Hoje',fmtDate(today))}
    <section class="todayLead">
      <div><span>Resumo</span><h2>Seu histórico mais recente, sem preencher lacunas.</h2><p>Treino, composição, alimentação, atividade, sono e exames aparecem conforme os dados disponíveis.</p></div>
      <div class="todayLeadActions">${action('treinos','Ver treinos')}${action('dados','Adicionar dados')}</div>
    </section>

    <div class="todaySummaryGrid">
      ${failed('workouts')?domainUnavailable('Último treino','Os treinos não carregaram. Os demais dados continuam disponíveis.'):lastWorkout?summaryCard('Último treino',lastWorkout.workout_type||'Treino',workoutSub,action('treinos','Abrir treino',lastWorkout.source_record_id,'workout'),'accent'):summaryCard('Último treino','Sem treino registrado')}
      ${failed('body')?domainUnavailable('Última bio','As medições corporais não carregaram. Os demais dados continuam disponíveis.'):lastBody?summaryCard('Última bio',num(lastBody.weight_kg)!=null?`${fmtNum(lastBody.weight_kg)} kg`:'Medição disponível',bodySub,action('bio','Abrir bio',day(lastBody.measured_at),'body')):summaryCard('Última bio','Sem bio registrada')}
      ${failed('nutrition')?domainUnavailable('Alimentação hoje','Os registros de alimentação não carregaram.'):summaryCard('Alimentação hoje',nutritionMain,nutritionSub,nutrition?action('nutricao','Ver dia',today,'nutrition'):action('nutricao','Ver histórico'))}
      ${failed('labs')?domainUnavailable('Exames','Os exames não carregaram.'):lab?summaryCard('Exames mais recentes',`${lab.count} resultado(s)`,`${fmtDate(lab.date)}${lab.lab?` · ${lab.lab}`:''}`,action('saude','Ver exames')):summaryCard('Exames','Sem resultados estruturados')}
    </div>

    <section class="todaySection todayContextSection">
      <div class="cardHead"><div><b>Contexto recente</b><small>Diferenças e registros recentes apresentados de forma descritiva, sem transformar coincidências em causa ou meta.</small></div></div>
      <div class="todayContextGrid">${recentContext(body,workouts,metrics,lab)}${workoutProgressCard(workouts)}</div>
    </section>

    <section class="todaySection">
      <div class="cardHead"><div><b>Atividade e sono</b><small>A importação automática validada mostra energia ativa, minutos de exercício, horas em pé e duração do sono. Outras métricas não são tratadas aqui como importação automática.</small></div></div>
      <div class="todayMetricGrid">${metricCards}</div>
    </section>

    ${otherMetricCards?`<section class="todaySection"><div class="cardHead"><div><b>Outros registros disponíveis</b><small>Estes itens já existem no histórico e podem vir de outras origens. Eles não ampliam o conjunto de importação automática do Apple Saúde.</small></div></div><div class="todayOtherMetricGrid todayMetricGridSecondary">${otherMetricCards}</div></section>`:''}

    <div class="grid cols2 sectionGap">
      <section class="card todayRecent"><div class="cardHead"><div><b>Últimos registros</b><small>Acesso rápido ao que entrou mais recentemente.</small></div></div>
        ${failed('workouts')?recentRow('Treino','', 'Indisponível agora','Os registros existentes não foram substituídos por zero.'):lastWorkout?recentRow('Treino',lastWorkout.workout_date,lastWorkout.workout_type||'Treino',lastWorkout.location||'',action('treinos','Abrir',lastWorkout.source_record_id,'workout')):''}
        ${failed('body')?recentRow('Bio','', 'Indisponível agora','As medições existentes não foram substituídas por zero.'):lastBody?recentRow('Bio',lastBody.measured_at,num(lastBody.weight_kg)!=null?`${fmtNum(lastBody.weight_kg)} kg`:'Medição disponível',num(lastBody.skeletal_muscle_mass_kg)!=null?`MME ${fmtNum(lastBody.skeletal_muscle_mass_kg)} kg`:'',action('bio','Abrir',day(lastBody.measured_at),'body')):''}
        ${failed('labs')?recentRow('Exames','', 'Indisponíveis agora','Tente atualizar para carregar as coletas novamente.'):lab?recentRow('Exames',lab.date,`${lab.count} resultado(s)`,lab.lab||'',action('saude','Abrir')):''}
      </section>
      <section class="card"><div class="cardHead"><div><b>Fontes ainda a trazer</b><small>Uma fonte só aparece como ausente quando foi possível verificar os dados carregados.</small></div></div><div class="quickList">
        ${sourceRow('Apple Saúde',apple,'Export ainda não importado')}
        ${sourceRow('Einstein',einstein,'Exames ainda não importados')}
        ${apple==='ready'&&einstein==='ready'?'<div><b>As fontes principais já têm algum dado relacionado.</b></div>':''}
      </div></section>
    </div>`;
}
