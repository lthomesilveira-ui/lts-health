import {state,esc,fmtDate,fmtNum,num,workoutRows,exercisesFor,setsFor} from './core.js';
import {renderTrainingHistory,renderExerciseHistory,renderExerciseDirectory} from './training-history.js';
import {failed,errorCard} from './history-tools.js';
import {trainingSetCounts,hasReportedMeasurementIssue,setStepLabel} from './training-session.js';
import {trainingSessionSummary} from './training-session-summary.js';

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
    set.phase==='warmup'?'aquec.':set.phase==='working'?'série de trabalho':set.phase==='other'?'outra fase informada':!set.phase||set.phase==='unknown'?'fase desconhecida':'',set.phase==='drop'?'drop':'',set.failure?'falha':'',set.near_failure?'quase falha':'',set.technique||''
  ].map(normalizedFlag).filter(Boolean))];
  return{load,reps,flags,missing:load==='—'&&reps==='—'};
}

function workoutCounts(workout){
  const summary=trainingSessionSummary(workout,state.data,state.domainStatus);
  return{exercises:summary.acceptedExercises||[],acceptedSets:summary.acceptedSets||[],setsAvailable:summary.setsAvailable,exerciseCount:summary.counts?.exercises??null,setCount:summary.counts?.primary??null,extensionCount:summary.counts?.extensions??null};
}

function measurementNote(workout){
  if(!hasReportedMeasurementIssue(workout,state.data.workoutEvidence||[]))return '';
  return '<p class="ltsRefMeasurementNote">Você relatou possível mau posicionamento do sensor. A frequência cardíaca e as calorias foram preservadas como medidas pelo Polar, com confiabilidade limitada; não confirmam a intensidade real do treino.</p>';
}

function exerciseNotes(exercise,sets){
  const notes=[...new Set([exercise.notes,...sets.map(set=>set.notes)].filter(Boolean))];
  return notes.length?`<details class="ltsRefExerciseNotes"><summary>Observações registradas</summary>${notes.map(note=>`<p>${esc(note)}</p>`).join('')}</details>`:'';
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
  if(min==null&&avg==null&&max==null)return `<section class="ltsRefTrainPanel"><header><div><span>Medidas do aparelho</span><h2>Frequência cardíaca</h2></div></header><div class="ltsRefTrainEmpty">Ainda não há frequência cardíaca registrada para esta sessão.</div></section>`;
  const values=[min,avg,max].filter(v=>v!=null),lo=Math.min(...values),hi=Math.max(...values),span=Math.max(hi-lo,1);
  const avgPos=avg==null?null:Math.max(0,Math.min(100,((avg-lo)/span)*100));
  const sourceLabel=workout.telemetry_source_names?.join(' + ')||workout.source||'Origem não informada';
  const telemetryLabel=workout.telemetry_heart_rate_is_partial?`Trecho parcial · ${sourceLabel}`:sourceLabel;
  return `<section class="ltsRefTrainPanel ltsRefHrPanel">
    <header><div><span>Medidas do aparelho</span><h2>Frequência cardíaca</h2></div><small>${esc(telemetryLabel)}</small></header>
    <div class="ltsRefHrNumbers">
      <div><small>Mín.</small><b>${min!=null?fmtNum(min,0):'—'}</b><span>bpm</span></div>
      <div><small>Média</small><b>${avg!=null?fmtNum(avg,0):'—'}</b><span>bpm</span></div>
      <div><small>Máx.</small><b>${max!=null?fmtNum(max,0):'—'}</b><span>bpm</span></div>
    </div>
    <div class="ltsRefHrTrack" aria-label="Faixa registrada de frequência cardíaca"><span></span>${avgPos!=null?`<i style="left:${avgPos.toFixed(1)}%"></i>`:''}</div>
    <p>${workout.telemetry_heart_rate_is_partial?'Valores medidos somente no trecho registrado; não representam a sessão inteira.':'Faixa descritiva da sessão registrada.'} Não representa distribuição por zonas nem série temporal.</p>
  </section>`;
}

function summaryExercisePreview(exercises,acceptedSets=[],setsAvailable=false){
  if(!exercises.length)return'';
  const exercise=exercises[0],sets=acceptedSets.filter(set=>set.exercise_source_record_id===exercise.source_record_id),counts=trainingSetCounts(sets);
  return `<article class="ltsExerciseCard ltsRefExercisePreview"><div><span>Primeiro exercício</span><b>${esc(exercise.exercise||'Exercício')}</b><small>${!setsAvailable?'Séries indisponíveis agora':sets.length?`${counts.primary} séries registradas${counts.extensions?` + ${counts.extensions} prolong.`:''}`:'Ainda não há séries detalhadas'}</small></div><button type="button" data-depth-training-view="exercises">Ver todos ›</button></article>`;
}

function recordedSessionContext(workout){
  const model=trainingSessionSummary(workout,state.data,state.domainStatus);
  if(!model.sessionAvailable)return '';
  const comment=model.sessionComment?`<div class="ltsRefSessionComment"><b>Como você terminou</b><p>${esc(model.sessionComment)}</p></div>`:'';
  const groupRows=[...(model.muscleGroups||[]),...(model.unknownMuscleGroup?.exercises?[{...model.unknownMuscleGroup,label:'Grupo não informado'}]:[])];
  const countText=row=>row.primary==null?'Séries indisponíveis agora':row.total===0?'Sem séries detalhadas':`${row.primary} ${row.primary===1?'série registrada':'séries registradas'}${row.extensions?` + ${row.extensions} prolong.`:''}`;
  const phases=model.phases||{},effort=model.effort||{};
  const qualifiers=[
    phases.working>0?`${phases.working} séries identificadas como trabalho`:null,
    phases.warmup>0?`${phases.warmup} de aquecimento`:null,
    phases.other>0?`${phases.other} com outro tipo informado`:null,
    phases.unknown>0?`${phases.unknown} sem tipo informado`:null
  ].filter(Boolean);
  const failure=effort.failure>0?`<p class="ltsRefSessionContextNote">Falha relatada em ${effort.failure} ${effort.failure===1?'série principal':'séries principais'}. É uma observação registrada, sem avaliação de intensidade ou recuperação.</p>`:'';
  const distribution=`<details class="ltsRefSessionContext" data-disclosure="training-distribution-${esc(workout.source_record_id)}"><summary>Distribuição das séries desta sessão</summary>${model.partial?'<p class="ltsRefSessionContextNote">Parte dos detalhes desta sessão não está disponível. A distribuição mostra somente os detalhes disponíveis.</p>':''}${groupRows.length?`<ul class="ltsRefSessionGroups">${groupRows.map(row=>`<li><b>${esc(row.label)}</b><span>${esc(countText(row))}</span><small>${row.exercises} ${row.exercises===1?'exercício':'exercícios'}</small></li>`).join('')}</ul>`:`<p class="ltsRefSessionContextNote">${model.counts?.exercises==null?'Os exercícios não carregaram nesta atualização.':'Ainda não há exercícios com séries detalhadas para distribuir.'}</p>`}${qualifiers.length?`<p class="ltsRefSessionContextNote">${esc(qualifiers.join(' · '))}. Séries sem tipo informado não são classificadas como séries de trabalho.</p>`:''}${failure}<p class="ltsRefSessionContextNote">Cada série aparece uma vez, no grupo informado para seu exercício. O registro não distingue a participação principal e secundária dos músculos. A distribuição não indica, sozinha, necessidade de aumentar ou reduzir o treino.</p></details>`;
  const original=model.originalReport?`<details class="ltsRefSessionContext" data-disclosure="training-original-${esc(workout.source_record_id)}"><summary>Relato original deste treino</summary><p class="ltsRefSessionOriginal">${esc(model.originalReport)}</p></details>`:'';
  return `${comment}${distribution}${original}`;
}

function summaryView(workout){
  const{exercises,acceptedSets,setsAvailable,exerciseCount,setCount,extensionCount}=workoutCounts(workout);
  return `${sessionHero(workout)}
    <section class="ltsRefTrainMetrics">
      ${metric(num(workout.duration_minutes)!=null?fmtNum(workout.duration_minutes,0):'—','min','Duração')}
      ${metric(num(workout.calories_kcal)!=null?fmtNum(workout.calories_kcal,0):'—','kcal',workout.telemetry_energy_is_estimated?'Energia estimada':'Energia')}
      ${metric(num(workout.heart_rate_avg)!=null?fmtNum(workout.heart_rate_avg,0):'—','bpm',workout.telemetry_heart_rate_is_partial?'FC média · trecho':'FC média')}
      ${metric(setCount==null?'—':' '+setCount,'','Séries')}
    </section>
    ${measurementNote(workout)}
    ${hrPanel(workout)}
    <section class="ltsRefTrainPanel ltsRefSessionOverview">
      <header><div><span>Seu treino</span><h2>Exercícios da sessão</h2></div><button type="button" data-depth-training-view="exercises">Abrir exercícios ›</button></header>
      <div class="ltsRefOverviewGrid"><div><b>${exerciseCount==null?'—':exerciseCount}</b><span>exercícios registrados</span></div><div><b>${setCount==null?'—':setCount}</b><span>séries registradas</span></div></div>
      ${extensionCount?`<p class="ltsRefExtensionNote">${extensionCount} prolongamento${extensionCount===1?'':'s'} por drop ou rest-pause, separado${extensionCount===1?'':'s'} das séries. Aquecimentos e ajustes informados entram na contagem das séries.</p>`:''}
      ${recordedSessionContext(workout)}
      ${summaryExercisePreview(exercises,acceptedSets,setsAvailable)}
    </section>`;
}

function exerciseCards(workout){
  if(failed(state,'exercises'))return errorCard('Os exercícios não carregaram agora.');
  const exercises=exercisesFor(workout);
  if(!exercises.length)return `<div class="ltsRefTrainEmpty">Ainda não há exercícios detalhados para esta sessão.</div>`;
  return `<div class="ltsRefExerciseList">${exercises.map((exercise,index)=>{
    const sets=failed(state,'sets')?[]:setsFor(exercise);
    const counts=trainingSetCounts(sets);
    return `<article class="ltsExerciseCard ltsRefExerciseCard">
      <header><div class="ltsRefExerciseNumber">${String(index+1).padStart(2,'0')}</div><div><b>${esc(exercise.exercise||'Exercício')}</b><small>${esc([exercise.machine,exercise.muscle_group].filter(Boolean).join(' · ')||'')}</small></div><span>${failed(state,'sets')?'—':`${counts.primary} séries${counts.extensions?` + ${counts.extensions} prolong.`:''}`}</span></header>
      <div class="ltsRefSetTable">${sets.length?sets.map((set,setIndex)=>{const t=setText(set);return `<div><span>${esc(setStepLabel(sets,setIndex))}</span><b>${t.missing?'Dados não informados':esc(t.load)}</b><i>${t.missing?'':`× ${esc(t.reps)} reps`}</i>${t.flags.length?`<em>${esc(t.flags.join(' · '))}</em>`:''}</div>`;}).join(''):`<div class="ltsRefSetEmpty">${failed(state,'sets')?'As séries não carregaram agora.':esc(exercise.source_text||'Ainda não há séries detalhadas.')}</div>`}</div>
      ${exerciseNotes(exercise,sets)}
      <button type="button" class="ltsRefExerciseHistory" data-depth-exercise="${esc(exercise.source_record_id)}">Histórico deste exercício ›</button>
    </article>`;
  }).join('')}</div>`;
}

function exercisesView(workout){
  return `${sessionHero(workout)}<section class="ltsRefTrainPanel ltsRefExercisesPanel"><header><div><span>Detalhe</span><h2>Exercícios e séries</h2></div></header>${exerciseCards(workout)}</section>`;
}

function tabs(view){
  const options=[['summary','Resumo'],['exercises','Exercícios'],['history','Sessões'],['progress','Por exercício']];
  return `<div class="ltsRefTrainTabs ltsRefTrainPrimaryTabs" role="tablist" aria-label="Detalhes do treino">${options.map(([key,label])=>`<button type="button" data-depth-training-view="${key}" role="tab" aria-selected="${view===key}" class="${view===key?'active':''}">${label}</button>`).join('')}</div>`;
}

function exerciseNav(){return `<div class="ltsRefTrainTabs ltsRefExerciseNav" role="navigation" aria-label="Retorno do histórico do exercício"><button type="button" data-depth-training-view="exercises">Exercícios</button><button type="button" data-depth-training-view="progress">Todos os exercícios</button><button type="button" data-depth-training-view="history">Sessões</button></div>`;}

export function renderProductTraining(){
  const rows=workoutRows();
  const selected=rows.find(w=>w.source_record_id===state.ui.openWorkout)||rows[0]||null;
  const requested=state.ui.productTrainingView;
  const view=['summary','exercises','history','exercise','progress'].includes(requested)?requested:(requested==='session'?'summary':'summary');
  const heading=view==='progress'?'Histórico por exercício':view==='history'?'Treinos':view==='exercise'?'Histórico do exercício':selected?safe(selected.workout_type,'Sessão'):'Treinos';
  const subtitle=view==='progress'?'Escolha um exercício para ver datas, cargas e repetições registradas.':view==='history'?'Busque qualquer sessão por ano, exercício ou local.':view==='exercise'?'Cargas e repetições no mesmo exercício e aparelho.':selected?`${fmtDate(selected.workout_date)}${selected.location?` · ${selected.location}`:''}`:'Selecione uma sessão.';
  return `<section class="ltsTrainingV2 ltsTrainingReference" data-training-view="${view}" data-workout-id="${esc(selected?.source_record_id||'')}">
    <header class="ltsRefTrainHeader"><button class="ltsRefTrainBack" ${view==='exercise'?'data-depth-training-view="exercises"':'data-route="hoje"'} aria-label="Voltar">‹</button><div><span>Treinos</span><h1 tabindex="-1" id="productTrainingTitle">${esc(heading)}</h1><p>${esc(subtitle)}</p></div><button class="ltsRefTrainAdd" data-entry="workout" aria-label="Registrar treino">+</button></header>
    ${view==='exercise'?exerciseNav():tabs(view)}
    ${failed(state,'workouts')?errorCard('Os treinos não carregaram agora.'):view==='progress'?renderExerciseDirectory():view==='history'?renderTrainingHistory():view==='exercise'?renderExerciseHistory():selected?(view==='exercises'?exercisesView(selected):summaryView(selected)):'<div class="ltsRefTrainEmpty">Ainda não há treinos registrados.</div>'}
  </section>`;
}

