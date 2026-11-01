import {state,esc,fmtDate,fmtNum,num,norm,workoutRows,exercisesFor,setsFor} from './core.js';
import {pageOf,pager,searchField,yearFilter,years,validDay,pointChart,emptyCard,errorCard,failed} from './history-tools.js';
import {trainingSetCounts,setStepLabel} from './training-session.js';

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
  return `<section class="ltsTrainingHistory"><div class="ltsDepthSummary"><div><strong>${m.all.length}</strong> sessões disponíveis</div><button class="ltsDepthLink" data-depth-clear="training">Limpar filtros</button></div><div class="ltsFilters">${searchField('productTrainingQuery',state.ui.productTrainingQuery,'Treino, exercício ou local')}${yearFilter('productTrainingYear',m.year,years(m.all,'workout_date'))}</div>${failed(state,'exercises')?errorCard('A busca por exercícios está indisponível; as sessões continuam acessíveis.'):''}<div class="ltsWorkoutList" data-training-total="${m.rows.length}">${m.page.rows.map(w=>`<button type="button" data-depth-workout="${esc(w.source_record_id)}"><time>${esc(fmtDate(w.workout_date))}</time><span><b>${esc(w.workout_type||'Treino')}</b><small>${esc(w.location||'Local não informado')}${num(w.duration_minutes)!=null?` · ${fmtNum(w.duration_minutes,0)} min`:''}</small></span><em>›</em></button>`).join('')||emptyCard(m.all.length?'Nenhuma sessão corresponde aos filtros.':'Ainda não há treinos registrados no histórico.')}</div>${pager(m.page,'productTrainingPage')}</section>`;
}

export function exerciseDirectoryModel(){
  const parents=new Map();for(const w of workoutRows()){if(!parents.has(w.source_record_id))parents.set(w.source_record_id,[]);parents.get(w.source_record_id).push(w);}
  const groups=new Map(),ids=new Map();
  for(const e of state.data.exercises||[])ids.set(e.source_record_id,(ids.get(e.source_record_id)||0)+1);
  for(const e of state.data.exercises||[]){
    const candidates=parents.get(e.workout_source_record_id)||[],key=norm(e.exercise);
    if(!candidates.length||!key)continue;
    const ambiguous=candidates.length!==1,w=ambiguous?{workout_date:e.workout_date||null}:candidates[0];
    if(!groups.has(key))groups.set(key,{key,label:e.exercise,occurrences:[]});
    groups.get(key).occurrences.push({exercise:e,workout:w,ambiguous,sets:ambiguous||ids.get(e.source_record_id)!==1?[]:setsFor(e)});
  }
  return [...groups.values()].map(g=>{g.occurrences.sort((a,b)=>String(b.workout.workout_date).localeCompare(String(a.workout.workout_date)));return {...g,entry:g.occurrences.find(o=>!o.ambiguous&&o.exercise.source_record_id&&ids.get(o.exercise.source_record_id)===1),setCount:g.occurrences.reduce((n,o)=>n+o.sets.length,0)};}).sort((a,b)=>b.occurrences.length-a.occurrences.length||a.label.localeCompare(b.label,'pt-BR'));
}
export function renderExerciseDirectory(){
  if(['workouts','exercises','sets'].some(key=>failed(state,key)))return errorCard('O histórico por exercício não carregou por completo. As sessões continuam disponíveis na outra aba.');
  const groups=exerciseDirectoryModel(),query=norm(state.ui.productExerciseQuery),matching=groups.filter(g=>!query||norm(g.label).includes(query));
  return `<section class="ltsTrainingHistory ltsExerciseDirectory"><div class="ltsDepthSummary"><div><strong>${groups.length}</strong> exercícios no histórico</div></div><p class="ltsDepthNote">Consulte cargas, repetições e datas observadas, mesmo sem metadados suficientes para comparar desempenho. Equipamentos, locais e unidades permanecem separados; não há estimativa de força.</p>${searchField('productExerciseQuery',state.ui.productExerciseQuery,'Nome do exercício')}<div class="ltsWorkoutList">${matching.map(g=>`<button type="button" data-depth-exercise="${esc(g.entry?.exercise.source_record_id||'')}" ${g.entry?'':'disabled'}><span><b>${esc(g.label)}</b><small>${g.occurrences.length} ocorrências · ${g.setCount} séries vinculadas${g.occurrences.some(o=>o.ambiguous)?' · há sessões com identidade ambígua':''}</small><small>${esc(fmtDate(g.occurrences.at(-1)?.workout.workout_date))}–${esc(fmtDate(g.occurrences[0]?.workout.workout_date))}</small></span><em>Ver histórico ›</em></button>`).join('')||emptyCard(groups.length?'Nenhum exercício corresponde à busca.':'Nenhum exercício nomeado foi encontrado nas sessões carregadas.')}</div></section>`;
}

const knownMetadata=value=>{const v=norm(value);return Boolean(v&&!['n/a','na','null','none','—','-','desconhecido','desconhecida','modelo nao informado','origem nao informada','not informed','not provided','not available','not recorded','unspecified','não especificado','nao especificado'].includes(v)&&!/^(unknown(?: |$)|nao (?:informad|identificad|registrad)|sem informacao|unreported$|not documented$)/.test(v));};
const loadUnit=value=>String(value||'').trim();
const unitLabel=value=>value==='plate_index'?'placa (sem conversão para kg)':value==='unitless'||!value?'unidade não informada':value;
function equipmentKey(exercise,workout){
  if(!knownMetadata(exercise?.machine)||!knownMetadata(workout?.location))return null;
  return JSON.stringify([norm(exercise.exercise),norm(exercise.machine),norm(workout.location)]);
}
const hasIdentity=value=>typeof value==='string'&&Boolean(value.trim());
const recordedNumber=value=>(typeof value==='number'||typeof value==='string'&&value.trim())&&num(value)!=null?Number(value):null;
const recordedText=value=>typeof value==='string'&&value.trim()?value:null;
const recordDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(value)?validDay(value):'';
const missingField=value=>value==null||typeof value==='string'&&!value.trim();
const compatibleDay=(value,parent)=>missingField(value)||Boolean(recordDay(value))&&recordDay(value)===recordDay(parent);

// These points describe the literal loads of one occurrence only. They never
// join sessions, convert units, infer a working phase, or estimate strength.
export function recordedExerciseSeries(sets=[],originalSets=sets){
  const groups=new Map();
  sets.forEach(set=>{
    const index=originalSets.indexOf(set),value=recordedNumber(set.weight),unit=loadUnit(set.weight_unit);
    if(value==null||value<0)return;
    if(!groups.has(unit))groups.set(unit,{unit,points:[]});
    groups.get(unit).points.push({value,index,step:setStepLabel(originalSets,index),set});
  });
  return [...groups.values()];
}

export function exerciseHistoryTitle(){
  if(failed(state,'workouts')||failed(state,'exercises'))return 'Histórico do exercício';
  return exerciseHistoryModel(state.ui.productExerciseId,state.ui.productExerciseUnit)?.chosen.exercise||'Histórico do exercício';
}

export function exerciseHistoryModel(exerciseId,requestedUnit){
  const workouts=workoutRows(),counts=new Map();for(const w of workouts)counts.set(w.source_record_id,(counts.get(w.source_record_id)||0)+1);
  const ids=new Map(workouts.filter(w=>hasIdentity(w.source_record_id)&&counts.get(w.source_record_id)===1).map(w=>[w.source_record_id,w]));
  const matches=(state.data.exercises||[]).filter(e=>e.source_record_id===exerciseId&&ids.has(e.workout_source_record_id)),chosen=matches.length===1?matches[0]:null;
  if(!chosen||!hasIdentity(exerciseId))return null;
  const parent=ids.get(chosen.workout_source_record_id),key=equipmentKey(chosen,parent),exerciseCounts=new Map();for(const e of state.data.exercises||[])exerciseCounts.set(e.source_record_id,(exerciseCounts.get(e.source_record_id)||0)+1);
  const setCounts=new Map();for(const s of state.data.sets||[])setCounts.set(s.source_record_id,(setCounts.get(s.source_record_id)||0)+1);
  const occurrences=(state.data.exercises||[]).filter(e=>ids.has(e.workout_source_record_id)&&norm(e.exercise)===norm(chosen.exercise)).map(exercise=>{
    const workout=ids.get(exercise.workout_source_record_id),ambiguousIdentity=!hasIdentity(exercise.source_record_id)||exerciseCounts.get(exercise.source_record_id)!==1;
    const linked=ambiguousIdentity?[]:setsFor(exercise),validDate=Boolean(recordDay(workout.workout_date))&&compatibleDay(exercise.workout_date,workout.workout_date);
    // A missing redundant parent/date is not a contradiction: the unique
    // exercise link still preserves the original set. Conflicting originals
    // remain readable separately, without contributing counts or plot points.
    const unassignedSets=[],sets=[];
    for(const set of linked){
      const reason=!validDate?'Data do exercício ou da sessão inconsistente.'
        :!missingField(set.workout_source_record_id)&&set.workout_source_record_id!==workout.source_record_id?'A sessão informada nesta série diverge do exercício.'
        :!compatibleDay(set.workout_date,workout.workout_date)?'A data informada nesta série diverge da sessão.'
        :hasIdentity(set.source_record_id)&&setCounts.get(set.source_record_id)!==1?'A identidade desta série aparece em mais de um registro.':'';
      if(reason)unassignedSets.push({set,reason});else sets.push(set);
    }
    return {exercise,workout,ambiguousIdentity,sets,originalSets:linked,unassignedSets,excludedSets:unassignedSets.length,invalidDate:!validDate,series:recordedExerciseSeries(sets,linked)};
  }).sort((a,b)=>String(b.workout.workout_date).localeCompare(String(a.workout.workout_date)));
  const same=key?occurrences.filter(item=>!item.ambiguousIdentity&&equipmentKey(item.exercise,item.workout)===key):[];
  const units=[...new Set(same.flatMap(item=>item.sets.filter(s=>s.phase==='working'&&recordedNumber(s.weight)!=null&&recordedNumber(s.weight)>=0).map(s=>loadUnit(s.weight_unit))).filter(u=>u&&u!=='unitless'))].sort();
  const selectedUnit=units.includes(requestedUnit)?requestedUnit:units[0]||'';
  const byWorkout=new Map();
  for(const item of same){
    // A curve is descriptive of recorded working sets, never a strength estimate.
    const working=item.sets.filter(s=>s.phase==='working'&&loadUnit(s.weight_unit)===selectedUnit&&recordedNumber(s.weight)!=null&&recordedNumber(s.weight)>=0);
    if(!selectedUnit||!working.length)continue;
    const id=item.workout.source_record_id;
    if(!byWorkout.has(id))byWorkout.set(id,{date:item.workout.workout_date,value:-Infinity});
    const point=byWorkout.get(id);point.value=Math.max(point.value,...working.map(s=>Number(s.weight)));
  }
  const raw=[...byWorkout.values()].filter(p=>validDay(p.date));
  const dateCounts=new Map();raw.forEach(p=>dateCounts.set(validDay(p.date),(dateCounts.get(validDay(p.date))||0)+1));
  const points=raw.filter(p=>dateCounts.get(validDay(p.date))===1).sort((a,b)=>validDay(a.date).localeCompare(validDay(b.date)));
  return{chosen,parent,occurrences,same,units,selectedUnit,points,key,ambiguous:raw.length-points.length};
}
function loadText(set){
  const value=recordedNumber(set.weight);
  // Preserve all recorded decimal places instead of rounding original loads.
  return value==null?recordedText(set.weight)||'Carga não informada':`${value.toLocaleString('pt-BR',{maximumFractionDigits:20})} ${unitLabel(loadUnit(set.weight_unit))}`;
}
function setFlags(set){
  const phase={warmup:'aquecimento',working:'trabalho',other:'outra fase informada',drop:'prolongamento',rest_pause:'prolongamento'}[set.phase]||'fase não informada';
  return [...new Set([phase,set.failure===true?'falha relatada':'',set.near_failure===true?'quase falha relatada':'',recordedText(set.technique)||''].filter(Boolean))];
}
function renderSessionSeries(item){
  const series=item.series.filter(group=>group.points.length>=2);
  if(!series.length)return '';
  // Each strip owns its scale. Dots are isolated and never form a trend line.
  // Long sessions wrap into short strips so labels remain legible on mobile.
  return `<div class="ltsExerciseRecordedPlots">${series.map(group=>{
    const values=group.points.map(p=>p.value),low=Math.min(...values),high=Math.max(...values),span=high-low||1;
    const chunks=[];for(let i=0;i<group.points.length;i+=6)chunks.push(group.points.slice(i,i+6));
    return `<figure class="ltsExerciseRecordedPlot"><figcaption>Cargas desta sessão · ${esc(unitLabel(group.unit))}<span>Escala própria · pontos sem ligação</span></figcaption>${chunks.map(points=>`<svg viewBox="0 0 300 76" role="img" aria-label="${esc(`Cargas registradas nesta sessão em ${unitLabel(group.unit)}; pontos isolados, sem comparação entre sessões`)}">${points.map((point,index)=>{
      const x=points.length===1?150:26+index*248/(points.length-1),y=24+(high-point.value)/span*20,label=point.value.toLocaleString('pt-BR',{maximumFractionDigits:20}),step=point.step==='Rest-pause'?'RP':point.step;
      return `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"><title>${esc(`${point.step}: ${loadText(point.set)} × ${point.set.reps_raw??point.set.reps_numeric??'repetições não informadas'}`)}</title></circle><text x="${x.toFixed(1)}" y="${(y-9).toFixed(1)}" text-anchor="middle">${label.length<=7?esc(label):''}</text><text class="ltsExercisePointStep" x="${x.toFixed(1)}" y="69" text-anchor="middle">${esc(step)}</text></g>`;
    }).join('')}</svg>`).join('')}</figure>`;
  }).join('')}</div>`;
}
// Exact presentation aliases only. Original source identities are never
// changed, combined, or treated as proof of import, authorship or verification.
const exerciseSourceLabels=new Map([['user_detail','Registro de treino'],['lucas_app.jsx (SEED_TREINOS)','Registro de treino']]);
const originalTrainingSource=row=>String(row?.source_name||row?.source||row?.laboratory||'Origem não informada');
function exerciseSourceName(original,sources=[]){
  const label=exerciseSourceLabels.get(original)||original.trim();
  const peers=sources.filter(source=>(exerciseSourceLabels.get(source)||source.trim())===label);
  return peers.length>1?`${label} ${peers.indexOf(original)+1}`:label;
}
function renderOriginalSources(sources){
  if(!sources.some(source=>exerciseSourceLabels.has(source)))return '';
  return `<p>Identificação original das origens:</p><ul>${sources.map(source=>`<li><b>${esc(exerciseSourceName(source,sources))}</b>: ${esc(source)}</li>`).join('')}</ul>`;
}
function renderRecordedSets(sets,allSets,sources){
  return `<ol class="ltsExerciseRecordedSets">${sets.map(set=>`<li><span class="ltsExerciseSetStep">${esc(setStepLabel(allSets,allSets.indexOf(set)))}</span><div><b>${esc(loadText(set))}</b><span class="ltsExerciseSetReps"> × ${esc(set.reps_raw??set.reps_numeric??'Repetições não informadas')}</span><small>${esc(setFlags(set).join(' · '))}</small>${recordedText(set.source)&&sources.length>1?`<small>Origem: ${esc(exerciseSourceName(originalTrainingSource(set),sources))}</small>`:''}</div></li>`).join('')}</ol>`;
}
function renderUnassignedSets(item,sources){
  if(!item.unassignedSets.length)return '';
  return `<section class="ltsExerciseUnassigned"><h3>Registros originais não atribuídos</h3><p class="ltsExerciseCaution">Estes registros foram preservados, mas não entram nas contagens nem nos gráficos desta sessão.</p>${item.unassignedSets.map(({set,reason})=>`<div>${renderRecordedSets([set],item.originalSets,[])}<p class="ltsExerciseCaution">${esc(reason)} Origem: ${esc(exerciseSourceName(originalTrainingSource(set),sources))}</p>${recordedText(set.notes)?`<p class="ltsPreservedText">${esc(set.notes)}</p>`:''}</div>`).join('')}</section>`;
}
function renderOccurrence(item,index,page){
  const {exercise,workout,sets,ambiguousIdentity}=item,counts=trainingSetCounts(sets),latest=index===0&&page.page===1;
  const sources=[...new Set([originalTrainingSource(exercise),...sets.map(originalTrainingSource)].filter(value=>value.trim()&&value.trim()!=='Origem não informada'))];
  if(!sources.length)sources.push(originalTrainingSource(workout));
  const allSources=[...new Set([...sources,...item.unassignedSets.map(({set})=>originalTrainingSource(set))])],sourceDetails=renderOriginalSources(allSources);
  const notes=[...new Set([recordedText(exercise.notes),...sets.map(set=>recordedText(set.notes))].filter(Boolean))];
  const original=recordedText(exercise.source_text);
  return `<article class="ltsExerciseSession${latest?' ltsExerciseSessionLatest':''}"><header><div>${latest?'<span class="ltsExerciseLatestLabel">Último registro</span>':''}<time>${esc(fmtDate(workout.workout_date))}</time></div><button class="ltsDepthLink" data-depth-workout="${esc(workout.source_record_id)}">Abrir sessão ›</button></header>
    <div class="ltsExerciseSessionMeta"><span>${esc(exercise.machine||'Equipamento não informado')} · ${esc(workout.location||'Local não informado')}</span><span>Origem: ${esc(sources.map(source=>exerciseSourceName(source,allSources)).join(' · '))}</span></div>
    ${sets.length?`<div class="ltsExerciseSetHeading"><b>${counts.primary} ${counts.primary===1?'série registrada':'séries registradas'}${counts.extensions?` + ${counts.extensions} prolong.`:''}</b><span>Carga × repetições</span></div>${renderRecordedSets(sets,item.originalSets,allSources)}${renderSessionSeries(item)}`:`<p class="ltsExerciseDetailsMissing">${ambiguousIdentity?'Identidade do exercício ambígua; séries não atribuídas automaticamente.':item.invalidDate?'A data deste registro não permite vincular as séries com segurança.':original?esc(original):'Séries detalhadas não informadas.'}</p>`}
    ${renderUnassignedSets(item,allSources)}
    ${notes.length||original&&sets.length||sourceDetails?`<details class="ltsExerciseOriginal" data-disclosure="exercise-original-${esc(exercise.source_record_id)}-${page.start+index}"><summary>Observações e registro original</summary>${sourceDetails}${notes.map(note=>`<p>${esc(note)}</p>`).join('')}${original?`<p class="ltsPreservedText">${esc(original)}</p>`:''}</details>`:''}
  </article>`;
}
function renderWorkingComparison(model){
  if(!model.key)return '<p class="ltsExerciseCaution">Equipamento ou local não identificado: cargas preservadas por sessão, sem comparação entre sessões.</p>';
  if(!model.points.length)return `<p class="ltsExerciseCaution">${model.ambiguous?'Há sessões na mesma data. As cargas estão nos registros, sem escolher uma delas para representar o dia.':'Cargas preservadas como registradas. As fases ou unidades informadas não permitem uma curva de séries de trabalho.'}</p>`;
  return `<details class="ltsExerciseComparison" data-disclosure="exercise-working-history"><summary>Cargas de trabalho · mesmo equipamento e local</summary><p class="ltsDepthNote">Maior carga registrada como trabalho em cada sessão. Repetições e esforço podem variar; não é uma comparação de força. ${esc(model.chosen.machine)} · ${esc(model.parent.location)}.</p>${model.units.length>1?`<label class="ltsField ltsSourceSelect">Unidade da carga<select id="productExerciseUnit" data-depth-field="productExerciseUnit">${model.units.map(u=>`<option value="${esc(u)}" ${model.selectedUnit===u?'selected':''}>${esc(unitLabel(u))}</option>`).join('')}</select></label>`:''}${pointChart(model.points,{unit:unitLabel(model.selectedUnit),label:'Cargas registradas no mesmo equipamento e local',scope:'productExercise',selected:state.ui.productExercisePoint})}${model.ambiguous?'<p class="ltsDepthNote">Sessões na mesma data permanecem no histórico, sem escolha automática para a curva.</p>':''}</details>`;
}
export function renderExerciseHistory(){
  if(failed(state,'workouts')||failed(state,'exercises')||failed(state,'sets'))return errorCard('O histórico de exercícios ou séries não carregou por completo.');
  const model=exerciseHistoryModel(state.ui.productExerciseId,state.ui.productExerciseUnit);
  if(!model)return emptyCard('Escolha um exercício dentro de uma sessão para consultar seu histórico.');
  const page=pageOf(model.occurrences,state.ui.productExercisePage,8);
  return `<section class="ltsExerciseHistory"><div class="ltsExerciseHistoryOverview"><h2>Registros por sessão</h2><span>${model.occurrences.length} ocorrências no histórico</span></div><div class="ltsExerciseSessions">${page.rows.map((item,index)=>renderOccurrence(item,index,page)).join('')}</div>${pager(page,'productExercisePage')}${renderWorkingComparison(model)}</section>`;
}
