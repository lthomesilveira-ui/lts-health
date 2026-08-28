import {state,esc,day,num,fmtNum,fmtDate,unique,norm,since,workoutRows,exercisesFor,setsFor} from './core.js';

const empty=text=>`<div class="empty">${esc(text)}</div>`;
const pill=(text,kind='')=>`<span class="pill ${kind}">${esc(text)}</span>`;
const metric=(label,value,sub='')=>`<div class="card metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<em>${esc(sub)}</em>`:''}</div>`;
const title=()=>`<div class="screenTitle"><div><h1>Treinos</h1><p>Sessões, exercícios, séries e evolução por exercício.</p></div></div>`;
const failed=key=>state.domainStatus[key]==='error';
const domainError=text=>`<div class="errorState"><b>${esc(text)}</b><span>Os demais dados continuam disponíveis. Tente atualizar para carregar esta parte novamente.</span></div>`;
const monthKey=value=>day(value).slice(0,7);
const monthLabel=value=>{const[y,m]=String(value||'').split('-');if(!y||!m)return'—';return new Date(Number(y),Number(m)-1,1).toLocaleDateString('pt-BR',{month:'short',year:'numeric'}).replace('.','');};

function setSummary(exercise){
  if(failed('sets')) return '<span class="set muted">Detalhes das séries indisponíveis agora.</span>';
  const rows=setsFor(exercise);
  if(!rows.length) return '<span class="set muted">Séries detalhadas não disponíveis.</span>';
  return rows.map(s=>`<span class="set"><b>S${s.set_index??'—'}</b>${num(s.weight)!=null?`${fmtNum(s.weight,Number.isInteger(num(s.weight))?0:1)} ${esc(s.weight_unit||'')}`:'carga não informada'} · ${esc(s.reps_raw??s.reps_numeric??'—')} reps${s.phase==='warmup'?' · aquecimento':''}${s.phase==='drop'?' · sequência registrada':''}</span>`).join('');
}

function sessionTelemetry(workout){
  const items=[];
  if(num(workout.duration_minutes)!=null)items.push(`<div><span>Duração</span><b>${fmtNum(workout.duration_minutes,0)} min</b></div>`);
  if(num(workout.calories_kcal)!=null)items.push(`<div><span>Energia</span><b>${fmtNum(workout.calories_kcal,0)} kcal</b></div>`);
  if(num(workout.heart_rate_avg)!=null)items.push(`<div><span>FC média</span><b>${fmtNum(workout.heart_rate_avg,0)} bpm</b></div>`);
  if(num(workout.heart_rate_min)!=null||num(workout.heart_rate_max)!=null){
    const low=num(workout.heart_rate_min)!=null?fmtNum(workout.heart_rate_min,0):'—';
    const high=num(workout.heart_rate_max)!=null?fmtNum(workout.heart_rate_max,0):'—';
    items.push(`<div><span>Faixa de FC</span><b>${low}–${high} bpm</b></div>`);
  }
  if(!items.length)return'';
  return `<div class="trainingTelemetry">${items.join('')}</div>`;
}

function sessionCard(workout){
  const exerciseUnavailable=failed('exercises');
  const setUnavailable=failed('sets');
  const exercises=exerciseUnavailable?[]:exercisesFor(workout);
  const setCount=setUnavailable?null:exercises.reduce((total,e)=>total+setsFor(e).length,0);
  const open=state.ui.openWorkout===workout.source_record_id;
  const partial=workout.record_status==='review_required';
  const detail=exerciseUnavailable
    ? domainError('Os exercícios desta sessão não puderam ser carregados.')
    : exercises.map(e=>`<section class="exercise"><div><b>${esc(e.exercise||'Exercício')}</b><small>${[e.machine,e.muscle_group].filter(Boolean).map(esc).join(' · ')}</small></div><div class="sets">${setSummary(e)}</div></section>`).join('')||empty('Sessão sem exercícios estruturados.');
  const counts=exerciseUnavailable
    ? 'detalhes indisponíveis'
    : `${exercises.length} exercício(s) · ${setCount==null?'séries indisponíveis':`${setCount} série(s)`}`;
  const source=workout.source?`<div class="trainingSource">Origem: ${esc(workout.source)}</div>`:'';
  return `<article class="session ${open?'open':''}"><button class="sessionHead" data-workout="${esc(workout.source_record_id)}"><time>${fmtDate(workout.workout_date)}</time><div><b>${esc(workout.workout_type||'Treino')}</b><small>${esc(workout.location||'Local não informado')} · ${counts}</small></div>${pill(partial?'incompleto':'registrado',partial?'warn':'ok')}</button><div class="sessionBody">${partial?'<div class="note warn">Há campos faltando neste treino. Eles permanecem em branco.</div>':''}${sessionTelemetry(workout)}${source}${detail}</div></article>`;
}

function trainingCalendar(rows){
  if(!rows.length)return empty('Nenhum treino encontrado no período.');
  const months=new Map();
  for(const w of rows){
    const key=monthKey(w.workout_date);if(!key)continue;
    if(!months.has(key))months.set(key,[]);
    months.get(key).push(w);
  }
  const entries=[...months.entries()].sort((a,b)=>b[0].localeCompare(a[0])).slice(0,12);
  return `<div class="trainingCalendar">${entries.map(([key,list])=>{
    const dates=unique(list.map(w=>day(w.workout_date))).sort();
    const days=dates.map(d=>Number(d.slice(8,10))).filter(Number.isFinite);
    return `<section><header><b>${esc(monthLabel(key))}</b><span>${list.length} sessão(ões)</span></header><div class="trainingDayDots">${days.map(d=>`<i title="${d}" aria-label="dia ${d}">${d}</i>`).join('')}</div></section>`;
  }).join('')}</div>`;
}

function exerciseGroups(){
  if(failed('exercises')) return [];
  const map=new Map();
  for(const e of state.data.exercises||[]){
    const key=norm(e.exercise);if(!key)continue;
    if(!map.has(key))map.set(key,{key,label:e.exercise,rows:[]});
    map.get(key).rows.push(e);
  }
  return [...map.values()].sort((a,b)=>String(a.label).localeCompare(String(b.label),'pt-BR'));
}

function exerciseHistory(group){
  if(failed('exercises')) return domainError('O histórico de exercícios não pôde ser carregado.');
  if(failed('sets')) return domainError('As séries necessárias para comparar cargas não puderam ser carregadas.');
  if(!group)return empty('Selecione um exercício.');
  const rows=[...group.rows].sort((a,b)=>String(b.workout_date).localeCompare(String(a.workout_date)));
  const days=unique(rows.map(r=>r.workout_date)).slice(0,20);
  return `<div class="exerciseHistoryHead"><b>${esc(group.label)}</b><small>Cargas de unidades diferentes permanecem separadas.</small></div><div class="list">${days.map(date=>{
    const exercises=rows.filter(r=>r.workout_date===date),sets=exercises.flatMap(setsFor),units=unique(sets.map(s=>s.weight_unit||'sem unidade'));
    const tops=units.map(unit=>{const values=sets.filter(s=>(s.weight_unit||'sem unidade')===unit).map(s=>num(s.weight)).filter(v=>v!=null);if(!values.length)return null;const top=Math.max(...values);return`${fmtNum(top,Number.isInteger(top)?0:1)} ${esc(unit)}`;}).filter(Boolean).join(' · ');
    const numericReps=sets.map(s=>num(s.reps_numeric)).filter(v=>v!=null);
    const repSummary=numericReps.length===sets.length&&sets.length?`${Math.min(...numericReps)}–${Math.max(...numericReps)} reps`:`${numericReps.length}/${sets.length} séries com reps numéricas`;
    return `<div class="row"><time>${fmtDate(date)}</time><div><b>${tops||'carga não estruturada'}</b><small>${sets.length} série(s) registradas · ${esc(repSummary)}</small></div></div>`;
  }).join('')||empty('Sem histórico estruturado.')}</div>`;
}

export function renderTrainingScreen(){
  const all=workoutRows();
  if(failed('workouts')&&!all.length) return title()+domainError('Os treinos não puderam ser carregados.');
  const period=state.ui.trainingPeriod,cut=period==='all'?null:since(Number(period)),query=norm(state.ui.trainingQuery);
  const periodRows=all.filter(w=>!cut||day(w.workout_date)>=cut);
  const rows=periodRows.filter(w=>!query||norm(`${w.workout_type} ${w.location} ${(w.muscle_groups||[]).join(' ')}`).includes(query));
  const exercisesFailed=failed('exercises'),setsFailed=failed('sets');
  const exercises=exercisesFailed?[]:(state.data.exercises||[]).filter(e=>!cut||day(e.workout_date)>=cut);
  const sets=setsFailed?[]:(state.data.sets||[]).filter(s=>!cut||day(s.workout_date)>=cut);
  const volume={};
  if(!exercisesFailed&&!setsFailed){
    for(const e of exercises){const n=setsFor(e).length;if(e.muscle_group&&n)volume[e.muscle_group]=(volume[e.muscle_group]||0)+n;}
  }
  const groups=exerciseGroups().filter(g=>!state.ui.exerciseQuery||norm(g.label).includes(norm(state.ui.exerciseQuery)));
  if(!state.ui.selectedExercise||!groups.some(g=>g.key===state.ui.selectedExercise))state.ui.selectedExercise=groups[0]?.key||null;
  const selected=groups.find(g=>g.key===state.ui.selectedExercise);
  const exerciseMetric=exercisesFailed?'—':String(exercises.length);
  const setMetric=setsFailed?'—':String(sets.length);
  const volumeHtml=setsFailed||exercisesFailed
    ? domainError('O volume por grupo não está disponível porque parte dos detalhes do treino não carregou.')
    : Object.entries(volume).sort((a,b)=>b[1]-a[1]).map(([group,count])=>`<div class="barRow"><span>${esc(group)}</span><div><i style="width:${Math.min(100,count/Math.max(1,...Object.values(volume))*100)}%"></i></div><b>${count}</b></div>`).join('')||empty('Sem séries estruturadas no período.');
  return `${title()}
    <div class="controls"><select id="trainingPeriod"><option value="28">28 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="all">Todo histórico</option></select><input id="trainingQuery" type="search" placeholder="Buscar treino, local ou grupo" value="${esc(state.ui.trainingQuery)}"></div>
    <div class="grid cols4 sectionGap">
      ${metric('Sessões',String(rows.length),period==='all'?'todo histórico':`${period} dias`)}
      ${metric('Exercícios',exerciseMetric,exercisesFailed?'não carregado':'registros estruturados')}
      ${metric('Séries',setMetric,setsFailed?'não carregado':'séries detalhadas')}
      ${metric('Último treino',rows[0]?fmtDate(rows[0].workout_date):'—')}
    </div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Calendário de treinos</b><small>Dias com sessões registradas no período. A ausência de marca não significa inatividade.</small></div></div>${trainingCalendar(periodRows)}</div>
    <div class="grid split sectionGap">
      <div class="card"><div class="cardHead"><div><b>Sessões</b><small>Abra uma sessão para ver exercícios, séries e dados registrados da sessão.</small></div></div><div class="list sessions">${rows.map(sessionCard).join('')||empty('Nenhum treino encontrado.')}</div></div>
      <div class="stack">
        <div class="card"><div class="cardHead"><div><b>Séries por grupo</b><small>Contagem no período selecionado.</small></div></div><div class="barList">${volumeHtml}</div></div>
        <div class="card"><div class="cardHead"><div><b>Evolução por exercício</b><small>Histórico das sessões em que o exercício aparece.</small></div></div><input id="exerciseQuery" class="fullInput" type="search" placeholder="Buscar exercício" value="${esc(state.ui.exerciseQuery)}"><div class="exerciseExplorer"><div class="exerciseList">${exercisesFailed?domainError('Os exercícios não puderam ser carregados.'):groups.slice(0,120).map(g=>`<button data-exercise="${esc(g.key)}" class="${g.key===state.ui.selectedExercise?'active':''}"><b>${esc(g.label)}</b><small>${unique(g.rows.map(r=>r.workout_date)).length} sessão(ões)</small></button>`).join('')||empty('Nenhum exercício encontrado.')}</div><div class="exerciseDetail">${exerciseHistory(selected)}</div></div></div>
      </div>
    </div>`;
}
