import {state,esc,fmtDate,fmtNum,num,norm,workoutRows,exercisesFor,setsFor} from './core.js';
import {pageOf,pager,searchField,yearFilter,years,validDay,pointChart,emptyCard,errorCard,failed,valueText} from './history-tools.js';

export function trainingHistoryModel(){
  const all=workoutRows(),q=norm(state.ui.productTrainingQuery),year=state.ui.productTrainingYear||'all';
  const rows=all.filter(w=>{
    if(year!=='all'&&validDay(w.workout_date).slice(0,4)!==year)return false;
    const exerciseNames=failed(state,'exercises')?'':exercisesFor(w).map(e=>e.exercise||'').join(' ');
    return !q||norm([w.workout_type,w.location,fmtDate(w.workout_date),...(Array.isArray(w.muscle_groups)?w.muscle_groups:[]),exerciseNames].join(' ')).includes(q);
  });
  return{all,rows,page:pageOf(rows,state.ui.productTrainingPage,12),year,q};
}
export function renderTrainingHistory(){
  if(failed(state,'workouts'))return errorCard('O histórico de treinos não carregou agora.');
  const m=trainingHistoryModel();
  return `<section class="ltsTrainingHistory"><div class="ltsDepthSummary"><div><strong>${m.all.length}</strong> sessões disponíveis</div><button class="ltsDepthLink" data-depth-clear="training">Limpar filtros</button></div><div class="ltsFilters">${searchField('productTrainingQuery',state.ui.productTrainingQuery,'Treino, exercício ou local')}${yearFilter('productTrainingYear',m.year,years(m.all,'workout_date'))}</div>${failed(state,'exercises')?errorCard('A busca por exercícios está indisponível; as sessões continuam acessíveis.'):''}<div class="ltsWorkoutList" data-training-total="${m.rows.length}">${m.page.rows.map(w=>`<button type="button" data-depth-workout="${esc(w.source_record_id)}"><time>${esc(fmtDate(w.workout_date))}</time><span><b>${esc(w.workout_type||'Treino')}</b><small>${esc(w.location||'Local não informado')}${num(w.duration_minutes)!=null?` · ${fmtNum(w.duration_minutes,0)} min`:''}</small></span><em>›</em></button>`).join('')||emptyCard(m.all.length?'Nenhuma sessão corresponde aos filtros.':'Não há sessões canônicas no histórico carregado.')}</div>${pager(m.page,'productTrainingPage')}</section>`;
}

const loadUnit=value=>String(value||'').trim();
const unitLabel=value=>value==='plate_index'?'placa (sem conversão para kg)':value==='unitless'||!value?'unidade não informada':value;
function equipmentKey(exercise,workout){
  if(!norm(exercise?.machine)||!norm(workout?.location))return null;
  return JSON.stringify([norm(exercise.exercise),norm(exercise.machine),norm(workout.location)]);
}
export function exerciseHistoryModel(exerciseId,requestedUnit){
  const workouts=workoutRows(),ids=new Map(workouts.map(w=>[w.source_record_id,w]));
  const chosen=(state.data.exercises||[]).find(e=>e.source_record_id===exerciseId&&ids.has(e.workout_source_record_id));
  if(!chosen)return null;
  const parent=ids.get(chosen.workout_source_record_id),key=equipmentKey(chosen,parent);
  const occurrences=(state.data.exercises||[]).filter(e=>ids.has(e.workout_source_record_id)&&norm(e.exercise)===norm(chosen.exercise)).map(e=>({exercise:e,workout:ids.get(e.workout_source_record_id),sets:setsFor(e)})).sort((a,b)=>String(b.workout.workout_date).localeCompare(String(a.workout.workout_date)));
  const same=key?occurrences.filter(item=>equipmentKey(item.exercise,item.workout)===key):[];
  const units=[...new Set(same.flatMap(item=>item.sets.map(s=>loadUnit(s.weight_unit))).filter(u=>u&&u!=='unitless'))].sort();
  const selectedUnit=units.includes(requestedUnit)?requestedUnit:units[0]||'';
  const byWorkout=new Map();
  for(const item of same){
    // A curve is descriptive of recorded working sets, never a strength estimate.
    const working=item.sets.filter(s=>s.phase==='working'&&loadUnit(s.weight_unit)===selectedUnit&&num(s.weight)!=null);
    if(!selectedUnit||!working.length)continue;
    const id=item.workout.source_record_id;
    if(!byWorkout.has(id))byWorkout.set(id,{date:item.workout.workout_date,value:-Infinity});
    const point=byWorkout.get(id);point.value=Math.max(point.value,...working.map(s=>Number(s.weight)));
  }
  const raw=[...byWorkout.values()].filter(p=>validDay(p.date));
  const counts=new Map();raw.forEach(p=>counts.set(validDay(p.date),(counts.get(validDay(p.date))||0)+1));
  const points=raw.filter(p=>counts.get(validDay(p.date))===1).sort((a,b)=>validDay(a.date).localeCompare(validDay(b.date)));
  return{chosen,parent,occurrences,same,units,selectedUnit,points,key,ambiguous:raw.length-points.length};
}
export function renderExerciseHistory(){
  if(failed(state,'workouts')||failed(state,'exercises')||failed(state,'sets'))return errorCard('O histórico de exercícios ou séries não carregou por completo.');
  const model=exerciseHistoryModel(state.ui.productExerciseId,state.ui.productExerciseUnit);
  if(!model)return emptyCard('Escolha um exercício dentro de uma sessão para consultar seu histórico.');
  const page=pageOf(model.occurrences,state.ui.productExercisePage,8);
  return `<section class="ltsExerciseHistory"><div class="ltsHistoryContext"><b>${esc(model.chosen.exercise)}</b>${esc(model.chosen.machine||'Equipamento não informado')} · ${esc(model.parent.location||'Local não informado')}<br>${model.occurrences.length} ocorrências no histórico.</div>${model.key?`<p class="ltsDepthNote">O gráfico mantém o mesmo nome de exercício, equipamento e local. Mostra a maior carga das séries registradas como trabalho em cada sessão; as repetições podem variar e não há estimativa de força.</p>${model.units.length?`<label class="ltsField ltsSourceSelect">Unidade da carga<select id="productExerciseUnit" data-depth-field="productExerciseUnit">${model.units.map(u=>`<option value="${esc(u)}" ${model.selectedUnit===u?'selected':''}>${esc(unitLabel(u))}</option>`).join('')}</select></label>`:''}${pointChart(model.points,{unit:unitLabel(model.selectedUnit),label:'Cargas registradas no mesmo equipamento e local',scope:'productExercise',selected:state.ui.productExercisePoint})}`:emptyCard('O equipamento ou o local não está identificado. As ocorrências permanecem abaixo, sem unir cargas em um gráfico.')}${model.ambiguous?'<p class="ltsDepthNote">Sessões na mesma data permanecem no histórico, mas não são escolhidas automaticamente para a curva.</p>':''}<h2 class="ltsDepthHeading">Ocorrências registradas</h2><p class="ltsDepthNote">A lista também preserva outros equipamentos e locais; seus valores não entram na curva acima.</p><div class="ltsExerciseSessions">${page.rows.map(({exercise,workout,sets})=>`<article class="ltsExerciseSession"><header><time>${esc(fmtDate(workout.workout_date))}</time><button class="ltsDepthLink" data-depth-workout="${esc(workout.source_record_id)}">Abrir sessão ›</button></header><small>${esc(exercise.machine||'Equipamento não informado')} · ${esc(workout.location||'Local não informado')}</small><p>${sets.length?sets.map(s=>`${num(s.weight)!=null?`${fmtNum(s.weight,1)} ${esc(unitLabel(s.weight_unit))}`:'Carga não informada'} × ${esc(s.reps_raw??s.reps_numeric??'Repetições não informadas')}`).join('<br>'):esc(exercise.source_text||'Séries detalhadas não informadas.')}</p></article>`).join('')}</div>${pager(page,'productExercisePage')}</section>`;
}
