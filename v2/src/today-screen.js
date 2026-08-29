import {state,esc,day,fmtDate,fmtNum,num,workoutRows,bodyRows,unique,norm} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1>${description?`<p>${esc(description)}</p>`:''}</div></div>`;
const localDay=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;};
const failed=key=>state.domainStatus[key]==='error';
const metricTypes=new Set(['active_energy_kcal','exercise_minutes','stand_hours','sleep_duration_h']);
const metricLabel={active_energy_kcal:'Energia ativa',exercise_minutes:'Exercício',stand_hours:'Horas em pé',sleep_duration_h:'Sono'};
const metricFallbackUnit={active_energy_kcal:'kcal',exercise_minutes:'min',stand_hours:'h',sleep_duration_h:'h'};

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
  if(kind&&ref)return`<button class="todayAction" data-timeline-jump data-timeline-route="${esc(route)}" data-timeline-kind="${esc(kind)}" data-timeline-ref="${esc(ref)}">${esc(label)}</button>`;
  if(kind==='nutrition'&&ref)return`<button class="todayAction" data-timeline-jump data-timeline-route="${esc(route)}" data-timeline-kind="nutrition" data-timeline-date="${esc(ref)}">${esc(label)}</button>`;
  return`<button class="todayAction" data-route="${esc(route)}">${esc(label)}</button>`;
}
function summaryCard(label,main,sub='',actionHtml='',kind=''){
  return`<article class="todaySummaryCard ${kind}"><span>${esc(label)}</span><b>${esc(main)}</b>${sub?`<small>${esc(sub)}</small>`:''}${actionHtml?`<div class="todayActions">${actionHtml}</div>`:''}</article>`;
}
function domainUnavailable(label,detail){return`<article class="todayStatusCard unavailable"><span>${esc(label)}</span><b>Indisponível agora</b><small>${esc(detail)}</small></article>`;}
function latestMetric(rows,type){return[...(rows||[])].filter(m=>m.metric_type===type&&metricTypes.has(m.metric_type)).sort((a,b)=>String(b.measured_at).localeCompare(String(a.measured_at)))[0]||null;}
function metricCard(rows,type){
  const label=metricLabel[type],m=latestMetric(rows,type);if(!m)return`<article class="todayStatusCard"><span>${esc(label)}</span><b>Sem dado importado</b><small>Nenhum registro disponível para esta métrica.</small></article>`;
  const value=num(m.value),display=value==null?'Registro disponível':`${fmtNum(value,type==='active_energy_kcal'||type==='exercise_minutes'||type==='stand_hours'?0:1)} ${esc(m.unit||metricFallbackUnit[type])}`;
  return`<article class="todayStatusCard"><span>${esc(label)}</span><b>${display}</b><small>${fmtDate(m.measured_at)}${m.source?` · ${esc(m.source)}`:''}</small></article>`;
}
function recentRow(label,date,main,sub='',button=''){
  return`<div class="todayRecentRow"><div><span>${esc(label)}</span><b>${esc(main)}</b><small>${esc([date?fmtDate(date):'',sub].filter(Boolean).join(' · '))}</small></div>${button}</div>`;
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

  return `${title('Hoje',fmtDate(today))}
    <section class="todayLead">
      <div><span>Resumo</span><h2>Seu histórico mais recente, sem preencher lacunas.</h2><p>Treino, composição, alimentação, atividade, sono e exames aparecem conforme os registros disponíveis.</p></div>
      <div class="todayLeadActions">${action('treinos','Ver treinos')}${action('dados','Adicionar dados')}</div>
    </section>

    <div class="todaySummaryGrid">
      ${failed('workouts')?domainUnavailable('Último treino','Os treinos não carregaram. Os demais dados continuam disponíveis.'):lastWorkout?summaryCard('Último treino',lastWorkout.workout_type||'Treino',workoutSub,action('treinos','Abrir treino',lastWorkout.source_record_id,'workout'),'accent'):summaryCard('Último treino','Sem treino registrado')}
      ${failed('body')?domainUnavailable('Última bio','As medições corporais não carregaram. Os demais dados continuam disponíveis.'):lastBody?summaryCard('Última bio',num(lastBody.weight_kg)!=null?`${fmtNum(lastBody.weight_kg)} kg`:'Medição disponível',bodySub,action('bio','Abrir bio',day(lastBody.measured_at),'body')):summaryCard('Última bio','Sem bio registrada')}
      ${failed('nutrition')?domainUnavailable('Alimentação hoje','Os registros de alimentação não carregaram.'):summaryCard('Alimentação hoje',nutritionMain,nutritionSub,nutrition?action('nutricao','Ver dia',today,'nutrition'):action('nutricao','Ver histórico'))}
      ${failed('labs')?domainUnavailable('Exames','Os exames não carregaram.'):lab?summaryCard('Exames mais recentes',`${lab.count} resultado(s)`,`${fmtDate(lab.date)}${lab.lab?` · ${lab.lab}`:''}`,action('saude','Ver exames')):summaryCard('Exames','Sem resultados estruturados')}
    </div>

    <section class="todaySection">
      <div class="cardHead"><div><b>Atividade e sono</b><small>Somente métricas com importação automática já validada são exibidas aqui.</small></div></div>
      <div class="todayMetricGrid">
        ${failed('metrics')?domainUnavailable('Métricas','Atividade e sono não carregaram agora.'):['active_energy_kcal','exercise_minutes','stand_hours','sleep_duration_h'].map(type=>metricCard(metrics,type)).join('')}
      </div>
    </section>

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
