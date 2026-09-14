import {state,esc,fmtDate,fmtNum,num,workoutRows,exercisesFor,setsFor} from './core.js';
import {renderTrainingHistory,renderExerciseHistory} from './training-history.js';
import {failed,errorCard} from './history-tools.js';

const safe=(value,fallback='—')=>value==null||value===''?fallback:value;

function normalizedFlag(value){
  const text=String(value||'').trim();
  if(!text)return'';
  const lower=text.toLowerCase();
  if(lower.includes('aquec'))return'aquec.';
  if(lower==='drop set'||lower==='dropset')return'drop';
  if(lower==='near failure'||lower==='near-failure')return'quase falha';
  return text;
}

function setText(set){
  const weight=num(set.weight),repsValue=set.reps_raw??set.reps_numeric??null;
  const load=weight!=null?`${fmtNum(weight,Number.isInteger(weight)?0:1)} ${set.weight_unit==='kg'?'kg':esc(set.weight_unit||'')}`:'—';
  const reps=repsValue==null||repsValue===''?'—':String(repsValue);
  const flags=[...new Set([
    set.phase==='warmup'?'aquec.':'',set.phase==='drop'?'drop':'',set.failure?'falha':'',set.near_failure?'quase falha':'',set.technique||''
  ].map(normalizedFlag).filter(Boolean))];
  return{load,reps,flags,missing:load==='—'&&reps==='—'};
}

function workoutCounts(workout){
  const exercises=failed(state,'exercises')?[]:exercisesFor(workout);
  const setCount=failed(state,'sets')?null:exercises.reduce((sum,e)=>sum+setsFor(e).length,0);
  return{exercises,setCount};
}

function metric(value,unit,label){
  return `<div class="ltsRefTrainMetric"><strong>${esc(value)}</strong>${unit?`<span>${esc(unit)}</span>`:''}<small>${esc(label)}</small></div>`;
}

function sessionHero(workout){
  return `<section class="ltsRefTrainHero">
    <div><span>Sessão</span><strong>${esc(safe(workout.workout_type,'Treino'))}</strong><small>${fmtDate(workout.workout_date)}${workout.location?` · ${esc(workout.location)}`:''}</small></div>
    <div class="ltsRefTrainPulse" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
  </section>`;
}

function hrPanel(workout){
  const min=num(workout.heart_rate_min),avg=num(workout.heart_rate_avg),max=num(workout.heart_rate_max);
  if(min==null&&avg==null&&max==null)return `<section class="ltsRefTrainPanel"><header><div><span>Telemetria</span><h2>Frequência cardíaca</h2></div></header><div class="ltsRefTrainEmpty">Sem telemetria de frequência cardíaca registrada para esta sessão.</div></section>`;
  const values=[min,avg,max].filter(v=>v!=null),lo=Math.min(...values),hi=Math.max(...values),span=Math.max(hi-lo,1);
  const avgPos=avg==null?null:Math.max(0,Math.min(100,((avg-lo)/span)*100));
  return `<section class="ltsRefTrainPanel ltsRefHrPanel">
    <header><div><span>Telemetria</span><h2>Frequência cardíaca</h2></div><small>${esc(workout.telemetry_source_names?.join(' + ')||workout.source||'Origem não informada')}</small></header>
    <div class="ltsRefHrNumbers">
      <div><small>Mín.</small><b>${min!=null?fmtNum(min,0):'—'}</b><span>bpm</span></div>
      <div><small>Média</small><b>${avg!=null?fmtNum(avg,0):'—'}</b><span>bpm</span></div>
      <div><small>Máx.</small><b>${max!=null?fmtNum(max,0):'—'}</b><span>bpm</span></div>
    </div>
    <div class="ltsRefHrTrack" aria-label="Faixa registrada de frequência cardíaca"><span></span>${avgPos!=null?`<i style="left:${avgPos.toFixed(1)}%"></i>`:''}</div>
    <p>Faixa descritiva da sessão registrada. Não representa distribuição por zonas nem série temporal.</p>
  </section>`;
}

function summaryExercisePreview(exercises){
  if(!exercises.length)return'';
  const exercise=exercises[0],sets=failed(state,'sets')?[]:setsFor(exercise);
  return `<article class="ltsExerciseCard ltsRefExercisePreview"><div><span>Primeiro exercício</span><b>${esc(exercise.exercise||'Exercício')}</b><small>${sets.length?`${sets.length} séries registradas`:'Séries ainda não estruturadas'}</small></div><button type="button" data-depth-training-view="exercises">Ver todos ›</button></article>`;
}

function summaryView(workout){
  const{exercises,setCount}=workoutCounts(workout);
  return `${sessionHero(workout)}
    <section class="ltsRefTrainMetrics">
      ${metric(num(workout.duration_minutes)!=null?fmtNum(workout.duration_minutes,0):'—','min','Duração')}
      ${metric(num(workout.calories_kcal)!=null?fmtNum(workout.calories_kcal,0):'—','kcal','Energia')}
      ${metric(num(workout.heart_rate_avg)!=null?fmtNum(workout.heart_rate_avg,0):'—','bpm','FC média')}
      ${metric(setCount==null?'—':' '+setCount,'','Séries')}
    </section>
    ${hrPanel(workout)}
    <section class="ltsRefTrainPanel ltsRefSessionOverview">
      <header><div><span>Estrutura</span><h2>Exercícios da sessão</h2></div><button type="button" data-depth-training-view="exercises">Abrir exercícios ›</button></header>
      <div class="ltsRefOverviewGrid"><div><b>${exercises.length}</b><span>exercícios estruturados</span></div><div><b>${setCount==null?'—':setCount}</b><span>séries registradas</span></div></div>
      ${summaryExercisePreview(exercises)}
    </section>`;
}

function exerciseCards(workout){
  if(failed(state,'exercises'))return errorCard('Os exercícios não carregaram agora.');
  const exercises=exercisesFor(workout);
  if(!exercises.length)return `<div class="ltsRefTrainEmpty">Exercícios ainda não estruturados para esta sessão.</div>`;
  return `<div class="ltsRefExerciseList">${exercises.map((exercise,index)=>{
    const sets=failed(state,'sets')?[]:setsFor(exercise);
    return `<article class="ltsExerciseCard ltsRefExerciseCard">
      <header><div class="ltsRefExerciseNumber">${String(index+1).padStart(2,'0')}</div><div><b>${esc(exercise.exercise||'Exercício')}</b><small>${esc([exercise.machine,exercise.muscle_group].filter(Boolean).join(' · ')||'')}</small></div><span>${failed(state,'sets')?'—':`${sets.length} séries`}</span></header>
      <div class="ltsRefSetTable">${sets.length?sets.map((set,setIndex)=>{const t=setText(set);return `<div><span>S${setIndex+1}</span><b>${t.missing?'Dados não informados':esc(t.load)}</b><i>${t.missing?'':`× ${esc(t.reps)} reps`}</i>${t.flags.length?`<em>${esc(t.flags.join(' · '))}</em>`:''}</div>`;}).join(''):`<div class="ltsRefSetEmpty">${failed(state,'sets')?'As séries não carregaram agora.':esc(exercise.source_text||'Séries ainda não estruturadas.')}</div>`}</div>
      <button type="button" class="ltsRefExerciseHistory" data-depth-exercise="${esc(exercise.source_record_id)}">Histórico deste exercício ›</button>
    </article>`;
  }).join('')}</div>`;
}

function exercisesView(workout){
  return `${sessionHero(workout)}<section class="ltsRefTrainPanel ltsRefExercisesPanel"><header><div><span>Detalhe</span><h2>Exercícios e séries</h2></div></header>${exerciseCards(workout)}</section>`;
}

function tabs(view){
  const options=[['summary','Resumo'],['exercises','Exercícios'],['history','Histórico']];
  return `<div class="ltsRefTrainTabs" role="tablist" aria-label="Detalhes do treino">${options.map(([key,label])=>`<button type="button" data-depth-training-view="${key}" role="tab" aria-selected="${view===key}" class="${view===key?'active':''}">${label}</button>`).join('')}</div>`;
}

export function renderProductTraining(){
  const rows=workoutRows();
  const selected=rows.find(w=>w.source_record_id===state.ui.openWorkout)||rows[0]||null;
  const requested=state.ui.productTrainingView;
  const view=['summary','exercises','history','exercise'].includes(requested)?requested:(requested==='session'?'summary':'summary');
  const heading=view==='history'?'Treinos':view==='exercise'?'Histórico do exercício':selected?safe(selected.workout_type,'Sessão'):'Treinos';
  const subtitle=view==='history'?'Busque qualquer sessão por ano, exercício ou local.':view==='exercise'?'Ocorrências e cargas preservadas por contexto comparável.':selected?`${fmtDate(selected.workout_date)}${selected.location?` · ${selected.location}`:''}`:'Selecione uma sessão.';
  return `<section class="ltsTrainingV2 ltsTrainingReference" data-training-view="${view}" data-workout-id="${esc(selected?.source_record_id||'')}">
    <header class="ltsRefTrainHeader"><button class="ltsRefTrainBack" ${view==='exercise'?'data-depth-training-view="exercises"':'data-route="hoje"'} aria-label="Voltar">‹</button><div><span>Treinos</span><h1 tabindex="-1" id="productTrainingTitle">${esc(heading)}</h1><p>${esc(subtitle)}</p></div><button class="ltsRefTrainAdd" data-entry="workout" aria-label="Registrar treino">+</button></header>
    ${view==='exercise'?'':tabs(view)}
    ${failed(state,'workouts')?errorCard('Os treinos não carregaram agora.'):view==='history'?renderTrainingHistory():view==='exercise'?renderExerciseHistory():selected?(view==='exercises'?exercisesView(selected):summaryView(selected)):'<div class="ltsRefTrainEmpty">Nenhum treino estruturado disponível.</div>'}
  </section>`;
}
