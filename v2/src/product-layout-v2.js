import {state,esc,fmtDate,fmtNum,num,workoutRows,exercisesFor,setsFor,day} from './core.js';

const latest=(rows,key)=>[...(rows||[])].filter(r=>r?.[key]).sort((a,b)=>String(a[key]).localeCompare(String(b[key]))).at(-1)||null;
const safe=(value,fallback='—')=>value==null||value===''?fallback:value;
const stat=(label,value,sub='')=>`<div class="ltsStat"><span>${esc(label)}</span><b>${esc(value)}</b>${sub?`<small>${esc(sub)}</small>`:''}</div>`;

function homeCards(){
  const body=latest(state.data.body,'measured_at');
  const workout=workoutRows()[0]||null;
  const nutrition=latest(state.data.nutrition,'nutrition_date');
  const lab=latest(state.data.labs,'collection_date');
  const bodyValue=body&&num(body.weight_kg)!=null?`${fmtNum(body.weight_kg,1)} kg`:'Sem leitura recente';
  const fatValue=body&&num(body.body_fat_pct)!=null?`${fmtNum(body.body_fat_pct,1)}% gordura`:'Composição pendente';
  const workoutValue=workout?safe(workout.workout_type,'Treino registrado'):'Sem treino recente';
  const workoutSub=workout?`${fmtDate(workout.workout_date)}${num(workout.duration_minutes)!=null?` · ${fmtNum(workout.duration_minutes,0)} min`:''}`:'Abrir histórico de treinos';
  const nutritionValue=nutrition&&num(nutrition.calories_kcal)!=null?`${fmtNum(nutrition.calories_kcal,0)} kcal`:'Sem total recente';
  const nutritionSub=nutrition?fmtDate(nutrition.nutrition_date):'Nutrição';
  const labValue=lab?safe(lab.biomarker,'Exame registrado'):'Sem exame recente';
  const labSub=lab?fmtDate(lab.collection_date):'Exames';
  return {bodyValue,fatValue,workoutValue,workoutSub,nutritionValue,nutritionSub,labValue,labSub};
}

export function renderProductHome(){
  const c=homeCards();
  const workout=workoutRows()[0]||null;
  return `<section class="ltsHomeV2">
    <header class="ltsHero">
      <div><span class="ltsEyebrow">LTS Health</span><h1>Seu panorama de saúde</h1><p>O que importa agora, com acesso rápido ao detalhe.</p></div>
      <button class="ltsAvatar" data-route="dados" aria-label="Dados e fontes">L</button>
    </header>

    <section class="ltsPrimaryCard">
      <div class="ltsPrimaryTop"><div><span>Composição atual</span><strong>${esc(c.bodyValue)}</strong><small>${esc(c.fatValue)}</small></div><button data-route="bio">Ver composição</button></div>
      <div class="ltsMiniTrend" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    </section>

    <section class="ltsSection">
      <div class="ltsSectionHead"><div><span>Hoje & recentes</span><h2>Seu histórico em movimento</h2></div><button data-route="timeline">Timeline</button></div>
      <div class="ltsHealthGrid">
        <button class="ltsHealthTile training" data-route="treinos"><span class="ltsTileIcon">●</span><small>Último treino</small><b>${esc(c.workoutValue)}</b><em>${esc(c.workoutSub)}</em></button>
        <button class="ltsHealthTile nutrition" data-route="nutricao"><span class="ltsTileIcon">◒</span><small>Nutrição</small><b>${esc(c.nutritionValue)}</b><em>${esc(c.nutritionSub)}</em></button>
        <button class="ltsHealthTile labs" data-route="saude"><span class="ltsTileIcon">✦</span><small>Exames</small><b>${esc(c.labValue)}</b><em>${esc(c.labSub)}</em></button>
      </div>
    </section>

    <section class="ltsFeatureCard">
      <div class="ltsFeatureIcon">↗</div>
      <div><span>Leitura rápida</span><h2>${workout?'Treino mais recente disponível':'Conecte seus registros ao painel'}</h2><p>${workout?`Abra ${esc(safe(workout.workout_type,'o treino'))} para ver duração, frequência cardíaca, exercícios e séries.`:'O layout já está estruturado; os próximos blocos serão preenchidos com os seus dados reais.'}</p></div>
      <button data-route="${workout?'treinos':'dados'}">Abrir</button>
    </section>
  </section>`;
}

function setText(set){
  const load=num(set.weight)!=null?`${fmtNum(set.weight,Number.isInteger(num(set.weight))?0:1)} ${set.weight_unit==='kg'?'kg':esc(set.weight_unit||'')}`:'carga —';
  const reps=set.reps_raw??set.reps_numeric??'—';
  const flags=[set.phase==='warmup'?'aquec.':'',set.phase==='drop'?'drop':'',set.failure?'falha':'',set.near_failure?'quase falha':'',set.technique||''].filter(Boolean);
  return `${load} · ${esc(reps)} reps${flags.length?` · ${esc(flags.join(' · '))}`:''}`;
}

function workoutDetail(workout){
  const exercises=exercisesFor(workout);
  const setCount=exercises.reduce((sum,e)=>sum+setsFor(e).length,0);
  return `<div class="ltsWorkoutDetail">
    <div class="ltsWorkoutStats">
      ${stat('Duração',num(workout.duration_minutes)!=null?`${fmtNum(workout.duration_minutes,0)} min`:'—')}
      ${stat('Energia',num(workout.calories_kcal)!=null?`${fmtNum(workout.calories_kcal,0)} kcal`:'—')}
      ${stat('FC média',num(workout.heart_rate_avg)!=null?`${fmtNum(workout.heart_rate_avg,0)} bpm`:'—')}
      ${stat('Séries',String(setCount||'—'))}
    </div>
    <div class="ltsExerciseList">${exercises.length?exercises.map((e,index)=>{
      const sets=setsFor(e);
      return `<article class="ltsExerciseCard"><div class="ltsExerciseIndex">${index+1}</div><div class="ltsExerciseContent"><header><div><b>${esc(e.exercise||'Exercício')}</b><small>${esc([e.machine,e.muscle_group].filter(Boolean).join(' · ')||'')}</small></div><span>${sets.length} séries</span></header><div class="ltsSetList">${sets.length?sets.map((s,i)=>`<div><span>S${i+1}</span><b>${setText(s)}</b></div>`).join(''):'<div class="ltsMuted">Séries ainda não estruturadas.</div>'}</div></div></article>`;
    }).join(''):'<div class="ltsEmptyCard">Exercícios ainda não estruturados para esta sessão.</div>'}</div>
  </div>`;
}

export function renderProductTraining(){
  const rows=workoutRows();
  const selected=rows.find(w=>w.source_record_id===state.ui.openWorkout)||rows[0]||null;
  const list=rows.slice(0,18);
  return `<section class="ltsTrainingV2">
    <header class="ltsPageHeader"><button class="ltsBack" data-route="hoje" aria-label="Voltar">‹</button><div><span class="ltsEyebrow">Treinos</span><h1>${selected?esc(safe(selected.workout_type,'Sessão de treino')):'Histórico de treinos'}</h1><p>${selected?`${fmtDate(selected.workout_date)}${selected.location?` · ${esc(selected.location)}`:''}`:'Selecione uma sessão para abrir o detalhe.'}</p></div><button class="ltsRoundAction" data-entry="workout">+</button></header>
    ${selected?`<section class="ltsWorkoutHero"><div><span>Sessão</span><strong>${esc(safe(selected.workout_type,'Treino'))}</strong><small>${fmtDate(selected.workout_date)}</small></div><div class="ltsPulse"><i></i><i></i><i></i><i></i><i></i><i></i></div></section>${workoutDetail(selected)}`:'<div class="ltsEmptyCard">Nenhum treino estruturado disponível.</div>'}
    <section class="ltsSection"><div class="ltsSectionHead"><div><span>Histórico</span><h2>Outras sessões</h2></div></div><div class="ltsWorkoutList">${list.map(w=>`<button data-workout="${esc(w.source_record_id)}" class="${selected?.source_record_id===w.source_record_id?'active':''}"><time>${fmtDate(w.workout_date)}</time><span><b>${esc(safe(w.workout_type,'Treino'))}</b><small>${esc(w.location||'Local não informado')}</small></span><em>›</em></button>`).join('')}</div></section>
  </section>`;
}
