import {state,esc,day,num,fmtNum,fmtDate,unique,norm,since,workoutRows,exercisesFor,setsFor} from './core.js';

const empty=text=>`<div class="empty">${esc(text)}</div>`;
const pill=(text,kind='')=>`<span class="pill ${kind}">${esc(text)}</span>`;
const metric=(label,value,sub='')=>`<div class="card metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<em>${esc(sub)}</em>`:''}</div>`;
const title=()=>`<div class="screenTitle"><div><h1>Treinos</h1><p>Sessões, exercícios, séries e evolução por exercício.</p></div></div>`;
const failed=key=>state.domainStatus[key]==='error';
const domainError=text=>`<div class="errorState"><b>${esc(text)}</b><span>Os demais dados continuam disponíveis. Tente atualizar para carregar esta parte novamente.</span></div>`;
const monthKey=value=>day(value).slice(0,7);
const monthLabel=value=>{const[y,m]=String(value||'').split('-');if(!y||!m)return'—';return new Date(Number(y),Number(m)-1,1).toLocaleDateString('pt-BR',{month:'short',year:'numeric'}).replace('.','');};
const displayUnit=unit=>unit==='plate_index'?'placa':unit==='unitless'?'sem unidade':unit||'sem unidade';
const comparableLoadUnit=unit=>Boolean(unit&&unit!=='unitless');

function setSummary(exercise){
  if(failed('sets')) return '<span class="set muted">Detalhes das séries indisponíveis agora.</span>';
  const rows=setsFor(exercise);
  if(!rows.length){
    const preserved=String(exercise.source_text||'').trim();
    return preserved
      ? `<span class="set muted">Séries detalhadas não disponíveis.</span><span class="set"><b>Registro da fonte</b>${esc(preserved)}</span>`
      : '<span class="set muted">Séries detalhadas não disponíveis.</span>';
  }
  return rows.map(s=>`<span class="set"><b>S${s.set_index??'—'}</b>${num(s.weight)!=null?`${fmtNum(s.weight,Number.isInteger(num(s.weight))?0:1)} ${esc(displayUnit(s.weight_unit))}`:'carga não informada'} · ${esc(s.reps_raw??s.reps_numeric??'—')} reps${s.phase==='warmup'?' · aquecimento':''}${s.phase==='drop'?' · sequência registrada':''}</span>`).join('');
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

function sessionCard(workout,isLatest=false){
  const exerciseUnavailable=failed('exercises');
  const setUnavailable=failed('sets');
  const exercises=exerciseUnavailable?[]:exercisesFor(workout);
  const setCount=setUnavailable?null:exercises.reduce((total,e)=>total+setsFor(e).length,0);
  const open=state.ui.openWorkout===workout.source_record_id;
  const partial=workout.record_status==='review_required';
  const preservedSession=String(workout.raw_exercises||'').trim();
  const hasPreservedExerciseEvidence=exercises.some(e=>String(e.source_text||'').trim());
  const detail=exerciseUnavailable
    ? domainError('Os exercícios desta sessão não puderam ser carregados.')
    : exercises.map(e=>`<section class="exercise"><div><b>${esc(e.exercise||'Exercício')}</b><small>${[e.machine,e.muscle_group].filter(Boolean).map(esc).join(' · ')}</small></div><div class="sets">${setSummary(e)}</div></section>`).join('')||(preservedSession?`<div class="note"><b>Registro histórico da fonte</b><span>${esc(preservedSession)}</span><small>O texto foi preservado sem criar exercícios ou séries que a fonte não detalha.</small></div>`:empty('Sessão sem exercícios estruturados.'));
  const counts=exerciseUnavailable
    ? 'detalhes indisponíveis'
    : !exercises.length&&preservedSession
      ? 'detalhes preservados na fonte'
      : exercises.length&&setCount===0&&hasPreservedExerciseEvidence
        ? `${exercises.length} exercício(s) · séries preservadas na fonte`
        : `${exercises.length} exercício(s) · ${setCount==null?'séries indisponíveis':`${setCount} série(s)`}`;
  const source=workout.source?`<div class="trainingSource">Origem: ${esc(workout.source)}</div>`:'';
  const status=partial?'incompleto':isLatest?'mais recente':'registrado';
  const statusKind=partial?'warn':isLatest?'accent':'ok';
  return `<article class="session ${open?'open':''} ${isLatest?'latest':''}"><button class="sessionHead" data-workout="${esc(workout.source_record_id)}" aria-expanded="${open?'true':'false'}"><time>${fmtDate(workout.workout_date)}</time><div><b>${esc(workout.workout_type||'Treino')}</b><small>${esc(workout.location||'Local não informado')} · ${counts}</small></div>${pill(status,statusKind)}</button><div class="sessionBody">${partial?'<div class="note warn">Há campos faltando neste treino. Eles permanecem em branco.</div>':''}${sessionTelemetry(workout)}${source}${detail}</div></article>`;
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

function mondayOf(value){
  const d=day(value);if(!d)return'';
  const date=new Date(`${d}T12:00:00`);if(Number.isNaN(date.getTime()))return'';
  const shift=(date.getDay()+6)%7;date.setDate(date.getDate()-shift);
  return date.toISOString().slice(0,10);
}

function trainingRhythm(rows){
  if(!rows.length)return empty('Sem sessões registradas para mostrar o ritmo semanal.');
  const weeks=new Map();
  for(const workout of rows){
    const key=mondayOf(workout.workout_date);if(!key)continue;
    if(!weeks.has(key))weeks.set(key,{sessions:0,days:new Set(),types:new Set()});
    const bucket=weeks.get(key);bucket.sessions+=1;bucket.days.add(day(workout.workout_date));if(workout.workout_type)bucket.types.add(workout.workout_type);
  }
  const entries=[...weeks.entries()].sort((a,b)=>b[0].localeCompare(a[0])).slice(0,12);
  if(!entries.length)return empty('Sem semanas comparáveis no período.');
  const max=Math.max(1,...entries.map(([,v])=>v.sessions));
  return `<div class="barList">${entries.map(([start,info])=>{
    const end=new Date(`${start}T12:00:00`);end.setDate(end.getDate()+6);
    const endDay=end.toISOString().slice(0,10);
    const typeText=info.types.size?`${info.types.size} tipo(s) de treino`:'tipo não informado';
    return `<div class="barRow"><span>${fmtDate(start)}–${fmtDate(endDay)}</span><div><i style="width:${Math.max(6,info.sessions/max*100)}%"></i></div><b>${info.sessions}</b><small>${info.days.size} dia(s) com sessão · ${esc(typeText)}</small></div>`;
  }).join('')}</div><p class="footerNote">Mostra somente sessões estruturadas registradas. Semanas sem registro não são interpretadas como ausência de atividade física.</p>`;
}

function exerciseGroups(sourceRows=state.data.exercises||[]){
  if(failed('exercises')) return [];
  const map=new Map();
  for(const e of sourceRows){
    const exerciseKey=norm(e.exercise);if(!exerciseKey)continue;
    const machineKey=norm(e.machine)||'sem-maquina-informada';
    const key=`${exerciseKey}__${machineKey}`;
    if(!map.has(key))map.set(key,{key,label:e.exercise,machine:e.machine||'',rows:[]});
    map.get(key).rows.push(e);
  }
  return [...map.values()].sort((a,b)=>String(a.label).localeCompare(String(b.label),'pt-BR')||String(a.machine).localeCompare(String(b.machine),'pt-BR'));
}

function exerciseSessionKey(exercise){
  const date=day(exercise?.workout_date);
  return `${date}::${String(exercise?.workout_source_record_id||exercise?.source_record_id||'sem-id')}`;
}

function exerciseSessions(group){
  if(!group)return[];
  const map=new Map();
  for(const exercise of group.rows){
    const date=day(exercise.workout_date);if(!date)continue;
    const key=exerciseSessionKey(exercise);
    if(!map.has(key))map.set(key,{key,date,rows:[]});
    map.get(key).rows.push(exercise);
  }
  return [...map.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.key.localeCompare(b.key));
}

function comparableExerciseSessions(group){
  const sessions=exerciseSessions(group),counts=new Map();
  for(const session of sessions)counts.set(session.date,(counts.get(session.date)||0)+1);
  return {sessions,comparable:sessions.filter(session=>counts.get(session.date)===1),ambiguousDates:new Set([...counts].filter(([,count])=>count>1).map(([date])=>date))};
}

function comparisonSnapshot(session){
  const exercises=session?.rows||[];
  const sets=exercises.flatMap(setsFor);
  const byUnit=new Map();
  for(const set of sets){
    const weight=num(set.weight),unit=set.weight_unit;
    if(weight==null||!comparableLoadUnit(unit))continue;
    const reps=num(set.reps_numeric);
    const current=byUnit.get(unit);
    if(!current||weight>current.weight){byUnit.set(unit,{weight,reps});continue;}
    if(weight===current.weight&&reps!=null&&(current.reps==null||reps>current.reps))current.reps=reps;
  }
  return {date:session?.date||'',key:session?.key||'',sets,byUnit};
}

function exerciseProgressionSeries(group){
  if(!group||failed('sets'))return[];
  const {comparable}=comparableExerciseSessions(group),byUnit=new Map();
  for(const session of [...comparable].sort((a,b)=>a.date.localeCompare(b.date))){
    const snapshot=comparisonSnapshot(session);
    for(const [unit,peak] of snapshot.byUnit){
      if(!byUnit.has(unit))byUnit.set(unit,[]);
      byUnit.get(unit).push({date:snapshot.date,value:peak.weight,key:snapshot.key});
    }
  }
  return [...byUnit.entries()].map(([unit,points])=>({unit,points})).filter(s=>s.points.length).sort((a,b)=>b.points.length-a.points.length||String(a.unit).localeCompare(String(b.unit)));
}

function progressionSvg(points){
  if(points.length<2)return'';
  const w=520,h=132,p=18,values=points.map(x=>x.value),lo=Math.min(...values),hi=Math.max(...values),span=hi-lo||1,pad=span*.12,min=lo-pad,max=hi+pad;
  const x=i=>p+i*(w-p*2)/Math.max(1,points.length-1),y=v=>p+(max-v)*(h-p*2)/(max-min||1);
  const path=points.map((pt,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(pt.value).toFixed(1)}`).join(' ');
  const dots=points.map((pt,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(pt.value).toFixed(1)}" r="3.5"><title>${esc(fmtDate(pt.date))}: ${esc(fmtNum(pt.value,Number.isInteger(pt.value)?0:1))}</title></circle>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Evolução descritiva da maior carga registrada por sessão"><path class="exerciseProgressGrid" d="M18 44H502 M18 88H502"/><path class="exerciseProgressLine" d="${path}"/>${dots}</svg>`;
}

function exerciseProgression(group){
  if(failed('exercises'))return domainError('O histórico de exercícios não pôde ser carregado.');
  if(failed('sets'))return domainError('As séries necessárias para comparar cargas não puderam ser carregadas.');
  if(!group)return empty('Selecione um exercício.');
  const {ambiguousDates}=comparableExerciseSessions(group),series=exerciseProgressionSeries(group);
  if(!series.length)return empty(ambiguousDates.size?'As sessões estão preservadas, mas não há datas inequívocas com carga comparável.':'Não há cargas com unidade registrada para comparar neste exercício.');
  const ambiguityNote=ambiguousDates.size?`<div class="note warn">${ambiguousDates.size} data(s) têm mais de uma sessão deste exercício. Elas ficam fora da evolução até haver ordem inequívoca.</div>`:'';
  return `${ambiguityNote}<div class="exerciseProgression">${series.map(s=>{
    const points=s.points.slice(-24),first=points[0],last=points.at(-1),delta=last.value-first.value,unit=displayUnit(s.unit),digits=points.some(p=>!Number.isInteger(p.value))?1:0;
    return `<section class="exerciseProgressUnit"><div class="exerciseProgressHead"><div><b>${esc(unit)}</b><small>${points.length} sessão(ões) com carga estruturada${s.points.length>points.length?' · últimas 24':''}</small></div><div><span>${fmtNum(first.value,digits)} → ${fmtNum(last.value,digits)} ${esc(unit)}</span><small>diferença ${delta>0?'+':''}${fmtNum(delta,digits)} ${esc(unit)}</small></div></div>${progressionSvg(points)}<div class="exerciseProgressAxis"><span>${fmtDate(first.date)}</span><span>${fmtDate(last.date)}</span></div></section>`;
  }).join('')}<p class="footerNote">O gráfico usa somente a maior carga explicitamente registrada em cada sessão e mantém cada unidade separada. Cargas sem unidade ficam preservadas no histórico, mas não geram evolução. Duas sessões na mesma data não são ordenadas por suposição.</p></div>`;
}

function comparisonChange(previous,latest,unit,digits){
  if(!previous||!latest)return'sem comparação direta';
  const loadDelta=latest.weight-previous.weight;
  if(loadDelta!==0)return `carga ${loadDelta>0?'+':''}${fmtNum(loadDelta,digits)} ${displayUnit(unit)}`;
  if(previous.reps!=null&&latest.reps!=null){
    const repsDelta=latest.reps-previous.reps;
    if(repsDelta!==0)return `mesma carga · ${repsDelta>0?'+':''}${fmtNum(repsDelta,0)} reps`;
    return'mesma carga e mesmas reps registradas';
  }
  return'mesma carga · reps sem comparação completa';
}

function sessionComparison(group){
  if(failed('exercises'))return domainError('O histórico de exercícios não pôde ser carregado.');
  if(failed('sets'))return domainError('As séries necessárias para comparar sessões não puderam ser carregadas.');
  if(!group)return empty('Selecione um exercício.');
  const {comparable,ambiguousDates}=comparableExerciseSessions(group),recent=comparable.slice(0,2);
  if(recent.length<2)return `<div class="trainingComparisonEmpty"><b>Comparação entre sessões</b><span>${ambiguousDates.size?'Sessões do mesmo dia estão preservadas, mas ficam fora da comparação porque a ordem entre elas não está registrada.':'É preciso ter o mesmo exercício registrado na mesma máquina em pelo menos duas sessões para comparar.'}</span></div>`;
  const latest=comparisonSnapshot(recent[0]),previous=comparisonSnapshot(recent[1]);
  const units=unique([...latest.byUnit.keys(),...previous.byUnit.keys()]);
  const rows=units.map(unit=>{
    const a=previous.byUnit.get(unit),b=latest.byUnit.get(unit),digits=[a?.weight,b?.weight].some(v=>v!=null&&!Number.isInteger(v))?1:0;
    const av=a?`${fmtNum(a.weight,digits)} ${displayUnit(unit)}${a.reps!=null?` · ${fmtNum(a.reps,0)} reps`:''}`:'—';
    const bv=b?`${fmtNum(b.weight,digits)} ${displayUnit(unit)}${b.reps!=null?` · ${fmtNum(b.reps,0)} reps`:''}`:'—';
    const change=comparisonChange(a,b,unit,digits);
    return `<div class="trainingComparisonRow"><b>${esc(displayUnit(unit))}</b><span>${esc(av)}</span><span>${esc(bv)}</span><small>${esc(change)}</small></div>`;
  }).join('');
  const ambiguityNote=ambiguousDates.size?`<div class="note warn">Sessões na mesma data ficam fora desta comparação.</div>`:'';
  return `${ambiguityNote}<section class="trainingComparison"><div class="trainingComparisonTitle"><div><b>Comparação entre sessões</b><small>Mesmo exercício, mesma máquina e mesma unidade registrada, sem conversão.</small></div><div><span>${fmtDate(previous.date)}</span><span>${fmtDate(latest.date)}</span></div></div>${rows||empty('Não há cargas com unidade registrada comparáveis entre as duas sessões.')}<div class="trainingComparisonSets"><span>${fmtDate(previous.date)} · ${previous.sets.length} série(s)</span><span>${fmtDate(latest.date)} · ${latest.sets.length} série(s)</span></div></section>`;
}

function exerciseSessionTrend(group){
  if(failed('exercises'))return domainError('O histórico de exercícios não pôde ser carregado.');
  if(failed('sets'))return domainError('As séries necessárias para resumir as sessões não puderam ser carregadas.');
  if(!group)return empty('Selecione um exercício.');
  const {comparable,ambiguousDates}=comparableExerciseSessions(group),sessions=comparable.slice(0,8);
  if(!sessions.length)return empty(ambiguousDates.size?'As sessões estão preservadas, mas as datas recentes têm mais de uma sessão sem ordem registrada.':'Sem sessões estruturadas para este exercício.');
  const snapshots=sessions.map(comparisonSnapshot);
  const units=unique(snapshots.flatMap(s=>[...s.byUnit.keys()]));
  if(!units.length)return empty('Não há cargas com unidade registrada nas sessões recentes deste exercício.');
  return `<section class="trainingRecent"><div class="trainingRecentHead"><div><b>Sessões recentes</b><small>Carga máxima registrada, repetições nessa carga e séries detalhadas.</small></div><span>${sessions.length} sessão(ões)</span></div>${units.map(unit=>{
    const rows=snapshots.map(snapshot=>{
      const peak=snapshot.byUnit.get(unit);if(!peak)return'';
      const digits=Number.isInteger(peak.weight)?0:1;
      const reps=peak.reps==null?'reps não informadas':`${fmtNum(peak.reps,0)} reps`;
      const unitSets=snapshot.sets.filter(s=>s.weight_unit===unit);
      return `<div class="trainingRecentRow"><time>${fmtDate(snapshot.date)}</time><b>${fmtNum(peak.weight,digits)} ${esc(displayUnit(unit))}</b><span>${esc(reps)}</span><small>${unitSets.length} série(s) nesta unidade</small></div>`;
    }).filter(Boolean).join('');
    return `<div class="trainingRecentUnit"><div class="trainingRecentUnitTitle">${esc(displayUnit(unit))}</div>${rows}</div>`;
  }).join('')}<p class="footerNote">Repetições são mostradas apenas quando registradas na série de maior carga daquela sessão. Unidades diferentes permanecem separadas; cargas sem unidade e sessões sem ordem inequívoca não entram na comparação.</p></section>`;
}

function exerciseHistory(group){
  if(failed('exercises')) return domainError('O histórico de exercícios não pôde ser carregado.');
  if(failed('sets')) return domainError('As séries necessárias para comparar cargas não puderam ser carregadas.');
  if(!group)return empty('Selecione um exercício.');
  const {sessions,ambiguousDates}=comparableExerciseSessions(group),recent=sessions.slice(0,20);
  const machineNote=group.machine?` · ${esc(group.machine)}`:' · máquina não informada';
  const ambiguityNote=ambiguousDates.size?`<div class="note warn">Há ${ambiguousDates.size} data(s) com mais de uma sessão deste exercício. As sessões permanecem separadas no histórico e não são ordenadas entre si.</div>`:'';
  return `<div class="exerciseHistoryHead"><b>${esc(group.label)}${machineNote}</b><small>Máquinas e unidades diferentes permanecem separadas para evitar comparações indevidas.</small></div>${ambiguityNote}${sessionComparison(group)}${exerciseSessionTrend(group)}${exerciseProgression(group)}<div class="exerciseHistoryRows list">${recent.map(session=>{
    const sets=session.rows.flatMap(setsFor),units=unique(sets.map(s=>s.weight_unit||'sem unidade'));
    const tops=units.map(unit=>{const values=sets.filter(s=>(s.weight_unit||'sem unidade')===unit).map(s=>num(s.weight)).filter(v=>v!=null);if(!values.length)return null;const top=Math.max(...values);return`${fmtNum(top,Number.isInteger(top)?0:1)} ${esc(displayUnit(unit))}`;}).filter(Boolean).join(' · ');
    const numericReps=sets.map(s=>num(s.reps_numeric)).filter(v=>v!=null);
    const repSummary=numericReps.length===sets.length&&sets.length?`${Math.min(...numericReps)}–${Math.max(...numericReps)} reps`:`${numericReps.length}/${sets.length} séries com reps numéricas`;
    const sameDay=ambiguousDates.has(session.date)?' · sessão mantida separada':'';
    return `<div class="row"><time>${fmtDate(session.date)}</time><div><b>${tops||'carga não estruturada'}</b><small>${sets.length} série(s) registradas · ${esc(repSummary)}${sameDay}</small></div></div>`;
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
  const groups=exerciseGroups(exercises).filter(g=>!state.ui.exerciseQuery||norm(`${g.label} ${g.machine}`).includes(norm(state.ui.exerciseQuery)));
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
    <div class="grid split sectionGap">
      <div class="card"><div class="cardHead"><div><b>Calendário de treinos</b><small>Dias com sessões registradas no período. A ausência de marca não significa inatividade.</small></div></div>${trainingCalendar(periodRows)}</div>
      <div class="card"><div class="cardHead"><div><b>Ritmo semanal</b><small>Sessões estruturadas por semana, sem inferir atividade nos dias sem registro.</small></div></div>${trainingRhythm(periodRows)}</div>
    </div>
    <div class="grid split sectionGap">
      <div class="card"><div class="cardHead"><div><b>Sessões</b><small>Abra uma sessão para ver exercícios, séries e dados registrados da sessão.</small></div></div><div class="list sessions">${rows.map((workout,index)=>sessionCard(workout,index===0)).join('')||empty('Nenhum treino encontrado.')}</div></div>
      <div class="stack">
        <div class="card"><div class="cardHead"><div><b>Séries por grupo</b><small>Contagem no período selecionado.</small></div></div><div class="barList">${volumeHtml}</div></div>
        <div class="card"><div class="cardHead"><div><b>Evolução por exercício</b><small>Histórico do período selecionado, mantendo máquina e unidade separadas.</small></div></div><input id="exerciseQuery" class="fullInput" type="search" placeholder="Buscar exercício ou máquina" value="${esc(state.ui.exerciseQuery)}"><div class="exerciseExplorer"><div class="exerciseList">${exercisesFailed?domainError('Os exercícios não puderam ser carregados.'):groups.slice(0,120).map(g=>`<button data-exercise="${esc(g.key)}" class="${g.key===state.ui.selectedExercise?'active':''}"><b>${esc(g.label)}</b><small>${g.machine?`${esc(g.machine)} · `:''}${exerciseSessions(g).length} sessão(ões)</small></button>`).join('')||empty('Nenhum exercício encontrado no período.')}</div><div class="exerciseDetail">${exerciseHistory(selected)}</div></div></div>
      </div>
    </div>`;
}
