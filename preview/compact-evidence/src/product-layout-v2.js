import {state,esc,fmtDate,fmtNum,num,workoutRows,exercisesFor,setsFor} from './core.js';
import {renderTrainingHistory,renderExerciseHistory} from './training-history.js';
import {failed,errorCard} from './history-tools.js';

const latest=(rows,key)=>[...(rows||[])].filter(r=>r?.[key]).sort((a,b)=>String(a[key]).localeCompare(String(b[key]))).at(-1)||null;
const safe=(value,fallback='—')=>value==null||value===''?fallback:value;
const stat=(label,value,sub='')=>`<div class="ltsStat"><span>${esc(label)}</span><b>${esc(value)}</b>${sub?`<small>${esc(sub)}</small>`:''}</div>`;
const signed=(value,digits=1,unit='')=>num(value)==null?'':`${Number(value)>0?'+':''}${fmtNum(value,digits)}${unit?` ${unit}`:''}`;

function bodySeries(){
  const rows=[...(state.data.body||[])].filter(r=>r?.measured_at&&num(r.weight_kg)!=null).sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at)));
  const anchor=rows.at(-1)||null;
  if(!anchor)return[];
  const source=anchor.source||null;
  const coherent=source?rows.filter(r=>r.source===source):rows.length===1?rows:[];
  return coherent.slice(-12);
}

function sparkline(rows){
  if(rows.length<2)return '<div class="ltsTrendEmpty">Histórico comparável ainda insuficiente</div>';
  const values=rows.map(r=>num(r.weight_kg)).filter(v=>v!=null);
  const min=Math.min(...values),max=Math.max(...values),span=Math.max(max-min,.5);
  const w=320,h=76,pad=6;
  const pts=values.map((v,i)=>{
    const x=pad+(i*(w-pad*2))/Math.max(values.length-1,1);
    const y=pad+((max-v)*(h-pad*2))/span;
    return{x,y};
  });
  const path=pts.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const dots=pts.map((p,i)=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${i===pts.length-1?4:2.5}"/>`).join('');
  return `<svg class="ltsWeightSpark" viewBox="0 0 ${w} ${h}" role="img" aria-label="Tendência recente de peso"><path d="${path}"/>${dots}</svg>`;
}

function homeData(){
  const body=latest(state.data.body,'measured_at');
  const series=bodySeries();
  const workout=workoutRows()[0]||null;
  const nutrition=latest(state.data.nutrition,'nutrition_date');
  const lab=latest(state.data.labs,'collection_date');
  const weight=num(body?.weight_kg);
  const fat=num(body?.body_fat_pct);
  const muscle=num(body?.skeletal_muscle_mass_kg);
  const firstWeight=series.length>1?num(series[0].weight_kg):null;
  const weightDelta=weight!=null&&firstWeight!=null?weight-firstWeight:null;
  return {body,series,workout,nutrition,lab,weight,fat,muscle,weightDelta};
}

function workoutMetric(value,unit,label){
  return `<div class="ltsWorkoutMetric"><b>${esc(value)}</b><span>${esc(unit)}</span><small>${esc(label)}</small></div>`;
}

export function renderProductHome(){
  const d=homeData();
  const workout=d.workout;
  const nutritionValue=d.nutrition&&num(d.nutrition.calories_kcal)!=null?`${fmtNum(d.nutrition.calories_kcal,0)} kcal`:'Sem total recente';
  const labValue=d.lab?safe(d.lab.biomarker,'Exame registrado'):'Sem exame recente';
  const bodyDate=d.body?fmtDate(d.body.measured_at):'Sem medição';
  const weightValue=d.weight!=null?`${fmtNum(d.weight,1)} kg`:'Sem leitura recente';
  return `<section class="ltsHomeV2">
    <header class="ltsHero ltsHeroCompact">
      <div><span class="ltsEyebrow">Hoje</span><h1>Seu panorama</h1><p>Corpo, treino e sinais recentes em uma leitura.</p></div>
      <button class="ltsAvatar" data-route="dados" aria-label="Dados e fontes">L</button>
    </header>

    <section class="ltsPrimaryCard ltsBodyHero">
      <div class="ltsBodyHeroTop">
        <div><span class="ltsCardLabel">Composição atual</span><strong>${esc(weightValue)}</strong><div class="ltsBodyMeta">${d.fat!=null?`<b>${fmtNum(d.fat,1)}%</b> gordura`:''}${d.muscle!=null?`<b>${fmtNum(d.muscle,1)} kg</b> músculo`:''}</div></div>
        <button data-route="bio" aria-label="Abrir composição">›</button>
      </div>
      <div class="ltsTrendWrap">${sparkline(d.series)}<div class="ltsTrendCaption"><span>${esc(bodyDate)}</span>${d.weightDelta!=null?`<b>${esc(signed(d.weightDelta,1,'kg'))} no período comparável</b>`:'<b>Histórico por origem preservado</b>'}</div></div>
    </section>

    <section class="ltsSection ltsHomeSection">
      <div class="ltsSectionHead"><div><span>Mais recente</span><h2>Último treino</h2></div><button data-route="treinos" data-depth-training-view="history">Ver treinos</button></div>
      ${workout?`<button class="ltsHealthTile training ltsWorkoutFeature" data-route="treinos" data-depth-workout="${esc(workout.source_record_id)}">
        <div class="ltsWorkoutFeatureHead"><div><span class="ltsActivityIcon">↗</span><div><small>${fmtDate(workout.workout_date)}</small><b>${esc(safe(workout.workout_type,'Treino'))}</b><em>${esc(workout.location||'')}</em></div></div><span class="ltsChevron">›</span></div>
        <div class="ltsWorkoutMetrics">
          ${workoutMetric(num(workout.duration_minutes)!=null?fmtNum(workout.duration_minutes,0):'—','min','duração')}
          ${workoutMetric(num(workout.calories_kcal)!=null?fmtNum(workout.calories_kcal,0):'—','kcal',workout.telemetry_energy_is_estimated?'energia estimada':'energia')}
          ${workoutMetric(num(workout.heart_rate_avg)!=null?fmtNum(workout.heart_rate_avg,0):'—','bpm',workout.telemetry_heart_rate_is_partial?'FC média · trecho':'FC média')}
        </div>
      </button>`:'<div class="ltsEmptyCard">Nenhum treino recente estruturado.</div>'}
    </section>

    <section class="ltsSection ltsSignalsSection">
      <div class="ltsSectionHead"><div><span>Sinais recentes</span><h2>Outros registros</h2></div><button data-route="timeline">Timeline</button></div>
      <div class="ltsSignalGrid">
        <button class="ltsSignalCard nutrition" data-route="nutricao"><span class="ltsSignalIcon">◒</span><small>Nutrição</small><b>${esc(nutritionValue)}</b><em>${d.nutrition?fmtDate(d.nutrition.nutrition_date):'Sem total recente'}</em></button>
        <button class="ltsSignalCard labs" data-route="saude"><span class="ltsSignalIcon">✦</span><small>Exames</small><b>${esc(labValue)}</b><em>${d.lab?fmtDate(d.lab.collection_date):'Sem exame recente'}</em></button>
      </div>
    </section>

    <section class="ltsInsightStrip">
      <span class="ltsInsightIcon">◎</span><div><small>Próxima leitura</small><b>${workout?'Seu treino mais recente está estruturado até as séries.':'Continue alimentando a linha do tempo longitudinal.'}</b></div><button data-route="${workout?'treinos':'timeline'}">Abrir</button>
    </section>
  </section>`;
}

function normalizeSetFlag(value){
  const text=String(value||'').trim();
  if(!text)return '';
  const lower=text.toLowerCase();
  if(lower.includes('aquec'))return 'aquec.';
  if(lower==='drop set'||lower==='dropset')return 'drop';
  if(lower==='near failure'||lower==='near-failure')return 'quase falha';
  return text;
}

function setText(set){
  const weight=num(set.weight);
  const repsValue=set.reps_raw??set.reps_numeric??null;
  const load=weight!=null?`${fmtNum(weight,Number.isInteger(weight)?0:1)} ${set.weight_unit==='kg'?'kg':esc(set.weight_unit||'')}`:'—';
  const reps=repsValue==null||repsValue===''?'—':String(repsValue);
  const rawFlags=[set.phase==='warmup'?'aquec.':'',set.phase==='drop'?'drop':'',set.failure?'falha':'',set.near_failure?'quase falha':'',set.technique||''];
  const flags=[...new Set(rawFlags.map(normalizeSetFlag).filter(Boolean))];
  return {load,reps,flags,missing:load==='—'&&reps==='—'};
}

function workoutDetail(workout){
  const exercises=failed(state,'exercises')?[]:exercisesFor(workout);
  const setCount=failed(state,'sets')?null:exercises.reduce((sum,e)=>sum+setsFor(e).length,0);
  return `<div class="ltsWorkoutDetail">
    <div class="ltsWorkoutStats">
      ${stat('Duração',num(workout.duration_minutes)!=null?`${fmtNum(workout.duration_minutes,0)} min`:'—')}
      ${stat(workout.telemetry_energy_is_estimated?'Energia estimada':'Energia',num(workout.calories_kcal)!=null?`${fmtNum(workout.calories_kcal,0)} kcal`:'—')}
      ${stat(workout.telemetry_heart_rate_is_partial?'FC média · trecho':'FC média',num(workout.heart_rate_avg)!=null?`${fmtNum(workout.heart_rate_avg,0)} bpm`:'—')}
      ${stat('Séries',setCount==null?'Indisponível':String(setCount))}
    </div>
    ${num(workout.heart_rate_min)!=null||num(workout.heart_rate_max)!=null?`<p class="ltsDepthNote">${workout.telemetry_heart_rate_is_partial?'Trecho Polar: ':'FC da sessão: '}mínima ${num(workout.heart_rate_min)!=null?`${fmtNum(workout.heart_rate_min,0)} bpm`:'não informada'} · máxima ${num(workout.heart_rate_max)!=null?`${fmtNum(workout.heart_rate_max,0)} bpm`:'não informada'} · Origem: ${esc(workout.source||'não informada')}</p>`:''}
    <div class="ltsExerciseList">${failed(state,'exercises')?errorCard('Os exercícios não carregaram agora.'):exercises.length?exercises.map((e,index)=>{
      const sets=failed(state,'sets')?[]:setsFor(e);
      return `<article class="ltsExerciseCard"><div class="ltsExerciseIndex">${String(index+1).padStart(2,'0')}</div><div class="ltsExerciseContent"><header><div><b>${esc(e.exercise||'Exercício')}</b><small>${esc([e.machine,e.muscle_group].filter(Boolean).join(' · ')||'')}</small></div><span>${failed(state,'sets')?'Séries indisponíveis':`${sets.length} séries`}</span></header><button type="button" class="ltsDepthLink" data-depth-exercise="${esc(e.source_record_id)}" aria-label="Histórico de ${esc(e.exercise||'exercício')}">Histórico deste exercício ›</button><div class="ltsSetList">${sets.length?sets.map((s,i)=>{const t=setText(s);return `<div><span>S${i+1}</span><b>${t.missing?'<strong class="ltsSetMissing">Dados não informados</strong>':`<strong>${esc(t.load)}</strong><i>×</i><strong>${esc(t.reps)}</strong><small> reps</small>`}${t.flags.length?`<em>${esc(t.flags.join(' · '))}</em>`:''}</b></div>`;}).join(''):`<div class="ltsMuted">${failed(state,'sets')?'As séries não carregaram agora.':esc(e.source_text||'Séries ainda não estruturadas.')}</div>`}</div></div></article>`;
    }).join(''):`<div class="ltsEmptyCard">${esc(workout.raw_exercises||'Exercícios ainda não estruturados para esta sessão.')}</div>`}</div>
  </div>`;
}

export function renderProductTraining(){
  const rows=workoutRows();
  const selected=rows.find(w=>w.source_record_id===state.ui.openWorkout)||rows[0]||null;
  const view=['history','exercise'].includes(state.ui.productTrainingView)?state.ui.productTrainingView:'session';
  const tabs=`<div class="ltsDepthTabs" role="group" aria-label="Explorar treinos"><button type="button" data-depth-training-view="session" class="${view==='session'?'active':''}" aria-pressed="${view==='session'}">Resumo e séries</button><button type="button" data-depth-training-view="history" class="${view==='history'?'active':''}" aria-pressed="${view==='history'}">Histórico completo</button></div>`;
  const heading=view==='history'?'Treinos':view==='exercise'?'Histórico do exercício':selected?safe(selected.workout_type,'Sessão'):'Histórico de treinos';
  const subtitle=view==='history'?'Encontre qualquer sessão por ano, exercício ou local.':view==='exercise'?'Ocorrências, equipamento e cargas registradas.':selected?`${fmtDate(selected.workout_date)}${selected.location?` · ${selected.location}`:''}`:'Selecione uma sessão para abrir o detalhe.';
  return `<section class="ltsTrainingV2" data-training-view="${view}" data-workout-id="${esc(selected?.source_record_id||'')}">
    <header class="ltsPageHeader"><button class="ltsBack" ${view==='exercise'?'data-depth-training-view="session"':'data-route="hoje"'} aria-label="Voltar">‹</button><div><span class="ltsEyebrow">Treinos</span><h1 tabindex="-1" id="productTrainingTitle">${esc(heading)}</h1><p>${esc(subtitle)}</p></div><button class="ltsRoundAction" data-entry="workout" aria-label="Registrar treino">+</button></header>
    ${tabs}
    ${failed(state,'workouts')?errorCard('Os treinos não carregaram agora.'):view==='history'?renderTrainingHistory():view==='exercise'?renderExerciseHistory():selected?`
    <section class="ltsWorkoutHero"><div class="ltsWorkoutHeroCopy"><span>Sessão registrada</span><strong>${esc(safe(selected.workout_type,'Treino'))}</strong><small>${fmtDate(selected.workout_date)}${selected.location?` · ${esc(selected.location)}`:''}</small></div><div class="ltsPulse" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div></section>${workoutDetail(selected)}
    <button type="button" class="ltsDepthLink" data-depth-training-view="history">Abrir as ${rows.length} sessões do histórico ›</button>`:'<div class="ltsEmptyCard">Nenhum treino estruturado disponível.</div>'}
  </section>`;
}
