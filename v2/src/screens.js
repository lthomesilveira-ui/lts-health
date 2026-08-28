import {state,esc,day,num,fmtNum,fmtDate,unique,norm,since,within,neutralDelta,bodyRows,workoutRows,exercisesFor,setsFor} from './core.js';

const metric=(label,value,unit='',sub='')=>`<div class="card metric"><span>${esc(label)}</span><strong>${esc(value)}${unit?` <small>${esc(unit)}</small>`:''}</strong>${sub?`<em>${esc(sub)}</em>`:''}</div>`;
const empty=text=>`<div class="empty">${esc(text)}</div>`;
const errorFor=key=>state.errors[key]?'<div class="errorState">Não foi possível carregar esta parte agora. Tente atualizar.</div>':'';
const title=(name,description='',actions='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1>${description?`<p>${esc(description)}</p>`:''}</div>${actions}</div>`;
const pill=(text,kind='')=>`<span class="pill ${kind}">${esc(text)}</span>`;

function chart(rows,series){
  const points=rows.filter(r=>series.some(s=>num(r[s.key])!=null));
  if(points.length<2) return empty('Ainda não há pontos suficientes para este gráfico.');
  const values=points.flatMap(r=>series.map(s=>num(r[s.key])).filter(v=>v!=null));
  const min0=Math.min(...values),max0=Math.max(...values),span=max0-min0||1,pad=span*.1,min=min0-pad,max=max0+pad,w=960,h=240,p=24;
  const x=i=>p+i*(w-p*2)/Math.max(1,points.length-1),y=v=>p+(max-v)*(h-p*2)/(max-min||1);
  const path=s=>points.map((r,i)=>num(r[s.key])==null?'':`${i?'L':'M'}${x(i).toFixed(1)} ${y(num(r[s.key])).toFixed(1)}`).filter(Boolean).join(' ');
  return `<div class="chart"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path class="gridline" d="M24 60H936 M24 120H936 M24 180H936"/>${series.map((s,i)=>`<path class="line line${i+1}" d="${path(s)}"/>`).join('')}</svg></div><div class="legend">${series.map((s,i)=>`<span><i class="l${i+1}"></i>${esc(s.label)}</span>`).join('')}</div>`;
}

function latestCard(label,row,dateKey,body){
  return `<div class="card recentCard"><div class="cardHead"><div><b>${esc(label)}</b><small>${row?fmtDate(row[dateKey]):'sem registro'}</small></div></div>${row?body(row):empty('Nenhum registro disponível.')}</div>`;
}

export function renderBio(){
  const rows=bodyRows(),last=rows.at(-1),prev=rows.at(-2),first=rows[0];
  if(!rows.length) return title('Bio','Composição corporal e histórico de bioimpedância.')+errorFor('body')+empty('Nenhuma bioimpedância encontrada.');
  if(!state.ui.compareA) state.ui.compareA=rows.at(-2)?.measured_at||rows[0].measured_at;
  if(!state.ui.compareB) state.ui.compareB=rows.at(-1).measured_at;
  const a=rows.find(x=>x.measured_at===state.ui.compareA),b=rows.find(x=>x.measured_at===state.ui.compareB);
  const opts=rows.map(r=>`<option value="${esc(r.measured_at)}">${fmtDate(r.measured_at)}</option>`).join('');
  const metrics={weight_kg:['Peso','kg'],skeletal_muscle_mass_kg:['MME','kg'],fat_mass_kg:['Gordura','kg'],body_fat_pct:['Gordura registrada','%']};
  const [metricLabel,metricUnit]=metrics[state.ui.bioMetric]||metrics.weight_kg;
  const history=[...rows].reverse().map(r=>`<button class="historyRow" data-bio-date="${esc(r.measured_at)}"><time>${fmtDate(r.measured_at)}</time><div><b>${fmtNum(r.weight_kg)} kg</b><small>MME ${fmtNum(r.skeletal_muscle_mass_kg)} kg · gordura ${fmtNum(r.body_fat_pct)}%</small></div><span>${esc(r.source||'origem registrada')}</span></button>`).join('');
  return `${title('Bio','Sua composição corporal, comparação entre datas e histórico completo.')}
    <div class="grid cols4">
      ${metric('Peso',fmtNum(last.weight_kg),'kg',prev?`anterior ${neutralDelta(last.weight_kg,prev.weight_kg,1,'kg')}`:`primeiro registro ${fmtDate(first.measured_at)}`)}
      ${metric('MME',fmtNum(last.skeletal_muscle_mass_kg),'kg',prev?`anterior ${neutralDelta(last.skeletal_muscle_mass_kg,prev.skeletal_muscle_mass_kg,1,'kg')}`:'')}
      ${metric('Gordura',fmtNum(last.body_fat_pct),'%',prev?`anterior ${neutralDelta(last.body_fat_pct,prev.body_fat_pct,1,'%')}`:'')}
      ${metric('Visceral',fmtNum(last.visceral_fat_level,0),'nível',`medição de ${fmtDate(last.measured_at)}`)}
    </div>
    <div class="card sectionGap">
      <div class="cardHead"><div><b>Evolução corporal</b><small>Escolha uma medida para acompanhar ao longo do tempo.</small></div><div class="segmented">${Object.entries(metrics).map(([k,[l]])=>`<button data-bio-metric="${k}" class="${state.ui.bioMetric===k?'active':''}">${esc(l)}</button>`).join('')}</div></div>
      ${chart(rows,[{key:state.ui.bioMetric,label:`${metricLabel} (${metricUnit})`}])}
    </div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Comparar duas medições</b><small>Diferenças observadas entre as datas escolhidas.</small></div></div>
        <div class="compareSelectors"><label>De<select id="compareA">${opts}</select></label><label>Até<select id="compareB">${opts}</select></label></div>
        <div class="grid cols2 compact">${metric('Peso',neutralDelta(b?.weight_kg,a?.weight_kg,1,'kg'))}${metric('MME',neutralDelta(b?.skeletal_muscle_mass_kg,a?.skeletal_muscle_mass_kg,1,'kg'))}${metric('Gordura',neutralDelta(b?.body_fat_pct,a?.body_fat_pct,1,'%'))}${metric('InBody',neutralDelta(b?.score,a?.score,0,''))}</div>
      </div>
      <div class="card"><div class="cardHead"><div><b>Do primeiro ao último registro</b><small>Leitura descritiva do período completo.</small></div></div>
        <div class="summaryPair"><div><span>${fmtDate(first.measured_at)}</span><b>${fmtNum(first.weight_kg)} kg</b><small>MME ${fmtNum(first.skeletal_muscle_mass_kg)} kg</small></div><div class="arrow">→</div><div><span>${fmtDate(last.measured_at)}</span><b>${fmtNum(last.weight_kg)} kg</b><small>MME ${fmtNum(last.skeletal_muscle_mass_kg)} kg</small></div></div>
      </div>
    </div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Histórico</b><small>Mais recente primeiro.</small></div>${pill(`${rows.length} medições`)}</div><div class="list">${history}</div></div>`;
}

function sessionCard(w){
  const ex=exercisesFor(w),setCount=ex.reduce((n,e)=>n+setsFor(e).length,0),open=state.ui.openWorkout===w.source_record_id,partial=w.record_status==='review_required';
  return `<article class="session ${open?'open':''}"><button class="sessionHead" data-workout="${esc(w.source_record_id)}"><time>${fmtDate(w.workout_date)}</time><div><b>${esc(w.workout_type||'Treino')}</b><small>${esc(w.location||'Local não informado')} · ${ex.length} exercício(s) · ${setCount} série(s)</small></div>${pill(partial?'incompleto':'registrado',partial?'warn':'ok')}</button><div class="sessionBody">${partial?'<div class="note warn">Há campos faltando neste treino. Eles permanecem em branco.</div>':''}${ex.map(e=>{const ss=setsFor(e);return `<section class="exercise"><div><b>${esc(e.exercise||'Exercício')}</b><small>${[e.machine,e.muscle_group].filter(Boolean).map(esc).join(' · ')}</small></div><div class="sets">${ss.length?ss.map(s=>`<span class="set"><b>S${s.set_index??'—'}</b>${num(s.weight)!=null?`${fmtNum(s.weight,Number.isInteger(num(s.weight))?0:1)} ${esc(s.weight_unit||'')}`:'carga não informada'} · ${esc(s.reps_raw??s.reps_numeric??'—')} reps${s.phase==='warmup'?' · aquecimento':''}${s.phase==='drop'?' · drop registrado':''}</span>`).join(''):'<span class="set muted">Séries detalhadas não disponíveis</span>'}</div></section>`}).join('')||empty('Sessão sem exercícios estruturados.')}</div></article>`;
}

function exerciseGroups(){
  const map=new Map();
  for(const e of state.data.exercises||[]){ const key=norm(e.exercise); if(!key) continue; if(!map.has(key)) map.set(key,{key,label:e.exercise,rows:[]}); map.get(key).rows.push(e); }
  return [...map.values()].sort((a,b)=>String(a.label).localeCompare(String(b.label),'pt-BR'));
}

function exerciseHistory(group){
  if(!group) return empty('Selecione um exercício.');
  const rows=[...group.rows].sort((a,b)=>String(b.workout_date).localeCompare(String(a.workout_date)));
  return `<div class="exerciseHistoryHead"><b>${esc(group.label)}</b><small>Cargas de unidades diferentes não são misturadas.</small></div><div class="list">${unique(rows.map(r=>r.workout_date)).slice(0,20).map(d=>{const es=rows.filter(r=>r.workout_date===d),ss=es.flatMap(setsFor),units=unique(ss.map(s=>s.weight_unit||'sem unidade'));const top=units.map(u=>{const vals=ss.filter(s=>(s.weight_unit||'sem unidade')===u).map(s=>num(s.weight)).filter(v=>v!=null);return vals.length?`${fmtNum(Math.max(...vals),Number.isInteger(Math.max(...vals))?0:1)} ${esc(u)}`:null}).filter(Boolean).join(' · ');return `<div class="row"><time>${fmtDate(d)}</time><div><b>${top||'carga não estruturada'}</b><small>${ss.length} série(s) registradas</small></div></div>`}).join('')||empty('Sem histórico estruturado.')}</div>`;
}

export function renderTraining(){
  const all=workoutRows(),period=state.ui.trainingPeriod,cut=period==='all'?null:since(Number(period)),q=norm(state.ui.trainingQuery);
  const rows=all.filter(w=>(!cut||day(w.workout_date)>=cut)&&(!q||norm(`${w.workout_type} ${w.location} ${(w.muscle_groups||[]).join(' ')}`).includes(q)));
  const exPeriod=(state.data.exercises||[]).filter(e=>!cut||day(e.workout_date)>=cut),setPeriod=(state.data.sets||[]).filter(s=>!cut||day(s.workout_date)>=cut);
  const volume={}; for(const e of exPeriod){ const n=setsFor(e).length; if(e.muscle_group&&n) volume[e.muscle_group]=(volume[e.muscle_group]||0)+n; }
  const groups=exerciseGroups().filter(g=>!state.ui.exerciseQuery||norm(g.label).includes(norm(state.ui.exerciseQuery)));
  if(!state.ui.selectedExercise||!groups.some(g=>g.key===state.ui.selectedExercise)) state.ui.selectedExercise=groups[0]?.key||null;
  const selected=groups.find(g=>g.key===state.ui.selectedExercise);
  return `${title('Treinos','Sessões, exercícios, séries e evolução por exercício.')}
    <div class="controls"><select id="trainingPeriod"><option value="28">28 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="all">Todo histórico</option></select><input id="trainingQuery" type="search" placeholder="Buscar treino, local ou grupo" value="${esc(state.ui.trainingQuery)}"></div>
    <div class="grid cols4 sectionGap">${metric('Sessões',rows.length,'',period==='all'?'todo histórico':`${period} dias`)}${metric('Exercícios',exPeriod.length,'','registros estruturados')}${metric('Séries',setPeriod.length,'','séries detalhadas')}${metric('Último treino',rows[0]?fmtDate(rows[0].workout_date):'—','','')}</div>
    <div class="grid split sectionGap">
      <div class="card"><div class="cardHead"><div><b>Sessões</b><small>Abra uma sessão para ver exercícios e séries.</small></div></div><div class="list sessions">${rows.map(sessionCard).join('')||empty('Nenhum treino encontrado.')}</div></div>
      <div class="stack">
        <div class="card"><div class="cardHead"><div><b>Séries por grupo</b><small>Contagem no período selecionado.</small></div></div><div class="barList">${Object.entries(volume).sort((a,b)=>b[1]-a[1]).map(([g,n])=>`<div class="barRow"><span>${esc(g)}</span><div><i style="width:${Math.min(100,n/Math.max(1,...Object.values(volume))*100)}%"></i></div><b>${n}</b></div>`).join('')||empty('Sem séries estruturadas no período.')}</div></div>
        <div class="card"><div class="cardHead"><div><b>Evolução por exercício</b><small>Histórico das sessões em que o exercício aparece.</small></div></div><input id="exerciseQuery" class="fullInput" type="search" placeholder="Buscar exercício" value="${esc(state.ui.exerciseQuery)}"><div class="exerciseExplorer"><div class="exerciseList">${groups.slice(0,120).map(g=>`<button data-exercise="${esc(g.key)}" class="${g.key===state.ui.selectedExercise?'active':''}"><b>${esc(g.label)}</b><small>${unique(g.rows.map(r=>r.workout_date)).length} sessão(ões)</small></button>`).join('')||empty('Nenhum exercício encontrado.')}</div><div class="exerciseDetail">${exerciseHistory(selected)}</div></div></div>
      </div>
    </div>`;
}

function weeklyWorkoutCounts(weeks=12){
  const rows=workoutRows(),now=new Date();now.setHours(12,0,0,0);const out=[];
  for(let i=weeks-1;i>=0;i--){ const end=new Date(now);end.setDate(end.getDate()-i*7);const start=new Date(end);start.setDate(start.getDate()-6);const a=start.toISOString().slice(0,10),b=end.toISOString().slice(0,10);out.push({label:a.slice(5).replace('-','/'),count:rows.filter(w=>day(w.workout_date)>=a&&day(w.workout_date)<=b).length}); }
  return out;
}

export function renderEvolution(){
  const body=bodyRows(),seg=[...(state.data.segmental||[])].sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at))),weeks=weeklyWorkoutCounts();
  const max=Math.max(1,...weeks.map(w=>w.count));
  return `${title('Evolução','Composição corporal, análise segmentar e ritmo de treinos ao longo do tempo.')}
    <div class="card"><div class="cardHead"><div><b>Composição corporal</b><small>Peso, MME e gordura em kg.</small></div></div>${chart(body,[{key:'weight_kg',label:'Peso'},{key:'skeletal_muscle_mass_kg',label:'MME'},{key:'fat_mass_kg',label:'Gordura kg'}])}</div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Análise segmentar</b><small>Histórico das medições disponíveis.</small></div>${pill(`${seg.length} datas`)}</div><div class="list">${[...seg].reverse().map(s=>`<div class="row"><time>${fmtDate(s.measured_at)}</time><div><b>Braços ${fmtNum(s.lean_right_arm_kg)} / ${fmtNum(s.lean_left_arm_kg)} kg</b><small>Pernas ${fmtNum(s.lean_right_leg_kg)} / ${fmtNum(s.lean_left_leg_kg)} kg · tronco ${fmtNum(s.lean_trunk_kg)} kg</small></div></div>`).join('')||empty('Ainda não há dados segmentares.')}</div></div>
      <div class="card"><div class="cardHead"><div><b>Treinos por semana</b><small>Contagem observada das últimas semanas.</small></div></div><div class="weekBars">${weeks.map(w=>`<div><b>${w.count}</b><i style="height:${Math.max(6,w.count/max*82)}%"></i><span>${w.label}</span></div>`).join('')}</div></div>
    </div>`;
}

export function renderAnalysis(){
  const workouts=workoutRows(),body=bodyRows(),nutrition=state.data.nutrition||[],labs=state.data.labs||[],metrics=state.data.metrics||[];
  const w90=workouts.filter(w=>within(w.workout_date,90)),n90=unique(nutrition.filter(n=>within(n.nutrition_date,90)).map(n=>n.nutrition_date)),sleep=metrics.filter(m=>m.metric_type==='sleep_duration_h'&&within(m.measured_at,90)),last=body.at(-1),prev=body.at(-2),overlap=unique(w90.map(w=>w.workout_date).filter(d=>nutrition.some(n=>day(n.nutrition_date)===day(d)))),labDates=unique(labs.map(l=>l.collection_date));
  const volume={}; for(const e of state.data.exercises||[]){ if(!within(e.workout_date,90)||!e.muscle_group) continue; const n=setsFor(e).length; if(n) volume[e.muscle_group]=(volume[e.muscle_group]||0)+n; }
  return `${title('Análise','Uma leitura conjunta dos registros disponíveis, sem transformar coincidência em causa e efeito.')}
    <div class="grid cols4">${metric('Treinos · 90 dias',w90.length)}${metric('Nutrição · 90 dias',n90.length,'dias')}${metric('Sono · 90 dias',sleep.length,'dias')}${metric('Coletas laboratoriais',labDates.length)}</div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Mudança mais recente</b><small>Entre as duas últimas medições corporais.</small></div></div>${last&&prev?`<div class="grid cols2 compact">${metric('Peso',neutralDelta(last.weight_kg,prev.weight_kg,1,'kg'))}${metric('MME',neutralDelta(last.skeletal_muscle_mass_kg,prev.skeletal_muscle_mass_kg,1,'kg'))}${metric('Gordura',neutralDelta(last.body_fat_pct,prev.body_fat_pct,1,'%'))}${metric('Intervalo',`${Math.round((new Date(last.measured_at)-new Date(prev.measured_at))/86400000)} dias`)}</div>`:empty('São necessárias duas medições para comparar.')}</div>
      <div class="card"><div class="cardHead"><div><b>Treino × alimentação</b><small>Dias em que os dois registros existem.</small></div></div><div class="grid cols2 compact">${metric('Dias em comum',overlap.length)}${metric('Treinos no período',w90.length)}</div><p class="footerNote">Esses dados descrevem coincidência de datas; não demonstram efeito de um registro sobre o outro.</p></div>
    </div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Volume por grupo · 90 dias</b><small>Séries estruturadas por grupo muscular.</small></div></div><div class="barList">${Object.entries(volume).sort((a,b)=>b[1]-a[1]).map(([g,n])=>`<div class="barRow"><span>${esc(g)}</span><div><i style="width:${Math.min(100,n/Math.max(1,...Object.values(volume))*100)}%"></i></div><b>${n}</b></div>`).join('')||empty('Sem séries estruturadas no período.')}</div></div>
      <div class="card"><div class="cardHead"><div><b>Cobertura disponível</b><small>Quanto histórico existe em cada área.</small></div></div><div class="sourceGrid">${[['Composição',body.length],['Treinos',workouts.length],['Nutrição',nutrition.length],['Sono',metrics.filter(m=>m.metric_type==='sleep_duration_h').length],['Exames',labs.length],['Documentos',(state.data.docs||[]).length]].map(([l,n])=>`<div class="sourceCard"><b>${esc(l)}</b><span>${n}</span></div>`).join('')}</div></div>
    </div>`;
}

export function renderTreatments(){
  const rows=[...(state.data.treatments||[])].sort((a,b)=>String(b.event_date).localeCompare(String(a.event_date)));
  return `${title('Tratamentos','Histórico de confirmações registradas para dar contexto à linha do tempo.')}${errorFor('treatments')}<div class="card"><div class="cardHead"><div><b>Histórico</b><small>Data, nome registrado e origem. Sem instruções de dose ou aplicação.</small></div>${pill(`${rows.length} registros`)}</div><div class="list">${rows.map(r=>`<div class="row"><time>${fmtDate(r.event_date)}</time><div><b>${esc(r.medication||'Tratamento registrado')}</b><small>${esc(r.source||'origem registrada')}</small></div></div>`).join('')||empty('Nenhum tratamento registrado.')}</div></div>`;
}

export function renderToday(){
  const body=bodyRows(),workouts=workoutRows(),nutrition=[...(state.data.nutrition||[])].sort((a,b)=>String(b.nutrition_date).localeCompare(String(a.nutrition_date))),labs=[...(state.data.labs||[])].sort((a,b)=>String(b.collection_date).localeCompare(String(a.collection_date))),sleep=(state.data.metrics||[]).filter(m=>m.metric_type==='sleep_duration_h').sort((a,b)=>String(b.measured_at).localeCompare(String(a.measured_at)));
  const b=body.at(-1),w=workouts[0],n=nutrition[0],l=labs[0],s=sleep[0];
  return `${title('Hoje','O que está mais recente em cada área do seu histórico.')}
    <div class="grid cols2">
      ${latestCard('Último treino',w,'workout_date',r=>`<div class="recentMain"><b>${esc(r.workout_type||'Treino')}</b><span>${esc(r.location||'Local não informado')}</span><small>${r.duration_minutes?`${fmtNum(r.duration_minutes,0)} min`:''}${r.heart_rate_avg?` · FC média ${fmtNum(r.heart_rate_avg,0)}`:''}</small></div>`)}
      ${latestCard('Última bio',b,'measured_at',r=>`<div class="recentMetrics"><span><b>${fmtNum(r.weight_kg)}</b> kg</span><span><b>${fmtNum(r.skeletal_muscle_mass_kg)}</b> MME</span><span><b>${fmtNum(r.body_fat_pct)}</b>% gordura</span></div>`)}
      ${latestCard('Último dia de alimentação',n,'nutrition_date',r=>`<div class="recentMetrics"><span><b>${fmtNum(r.calories_kcal,0)}</b> kcal</span><span><b>${fmtNum(r.protein_g,0)}</b> g proteína</span><span><b>${fmtNum(r.carbs_g,0)}</b> g carbo</span></div>`)}
      ${latestCard('Última coleta',l,'collection_date',r=>`<div class="recentMain"><b>${esc(r.laboratory||'Laboratório')}</b><span>${unique((state.data.labs||[]).filter(x=>x.collection_date===r.collection_date).map(x=>x.biomarker)).length} biomarcador(es)</span></div>`)}
    </div>
    <div class="grid cols2 sectionGap">${s?metric('Sono mais recente',fmtNum(s.value,1),s.unit||'h',fmtDate(s.measured_at)):metric('Sono','—','','sem dado recente')} ${metric('Pendências de dados',(state.data.quality||[]).filter(q=>String(q.status).toLowerCase()==='open').length,'','questões abertas')}</div>`;
}

function timelineEvents(){
  const out=[];
  workoutRows().forEach(w=>out.push({date:w.workout_date,domain:'Treino',title:w.workout_type||'Treino',sub:w.location||''}));
  bodyRows().forEach(b=>out.push({date:b.measured_at,domain:'Bio',title:`${fmtNum(b.weight_kg)} kg · MME ${fmtNum(b.skeletal_muscle_mass_kg)} kg`,sub:b.source||''}));
  unique((state.data.labs||[]).map(l=>l.collection_date)).forEach(d=>out.push({date:d,domain:'Exames',title:'Coleta laboratorial',sub:`${(state.data.labs||[]).filter(l=>l.collection_date===d).length} resultado(s)`}));
  (state.data.docs||[]).forEach(d=>out.push({date:d.document_date,domain:'Documento',title:d.title||d.document_type||'Documento',sub:d.source||''}));
  (state.data.nutrition||[]).forEach(n=>out.push({date:n.nutrition_date,domain:'Nutrição',title:`${fmtNum(n.calories_kcal,0)} kcal`,sub:n.protein_g?`${fmtNum(n.protein_g,0)} g proteína`:''}));
  (state.data.treatments||[]).forEach(t=>out.push({date:t.event_date,domain:'Tratamentos',title:t.medication||'Tratamento registrado',sub:t.source||''}));
  return out.filter(e=>e.date).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}

export function renderTimeline(){
  const q=norm(state.ui.timelineQuery),domain=state.ui.timelineDomain,events=timelineEvents().filter(e=>(domain==='all'||e.domain===domain)&&(!q||norm(`${e.title} ${e.sub} ${e.domain}`).includes(q))).slice(0,500);
  const domains=['all','Treino','Bio','Exames','Documento','Nutrição','Tratamentos'];
  return `${title('Timeline','Treinos, composição, alimentação, exames, documentos e tratamentos em ordem de data.')}
    <div class="controls"><select id="timelineDomain">${domains.map(d=>`<option value="${esc(d)}">${d==='all'?'Todas as áreas':esc(d)}</option>`).join('')}</select><input id="timelineQuery" type="search" placeholder="Buscar no histórico" value="${esc(state.ui.timelineQuery)}"></div>
    <div class="card sectionGap"><div class="timeline">${events.map(e=>`<div class="timelineItem"><time>${fmtDate(e.date)}</time><span>${esc(e.domain)}</span><div><b>${esc(e.title)}</b>${e.sub?`<small>${esc(e.sub)}</small>`:''}</div></div>`).join('')||empty('Nenhum registro corresponde aos filtros.')}</div></div>`;
}

export function renderHealth(){
  const labs=state.data.labs||[],docs=state.data.docs||[],markers=new Map();
  for(const l of labs){ const key=norm(l.biomarker); if(!key) continue; if(!markers.has(key)) markers.set(key,{key,label:l.biomarker,rows:[]}); markers.get(key).rows.push(l); }
  const groups=[...markers.values()].filter(g=>!state.ui.labQuery||norm(g.label).includes(norm(state.ui.labQuery))).sort((a,b)=>String(a.label).localeCompare(String(b.label),'pt-BR'));
  if(!state.ui.selectedBiomarker||!groups.some(g=>g.key===state.ui.selectedBiomarker)) state.ui.selectedBiomarker=groups[0]?.key||null;
  const selected=groups.find(g=>g.key===state.ui.selectedBiomarker),dates=unique(labs.map(l=>l.collection_date)).sort().reverse();
  if(!state.ui.selectedCollection||!dates.includes(state.ui.selectedCollection)) state.ui.selectedCollection=dates[0]||null;
  const collection=labs.filter(l=>l.collection_date===state.ui.selectedCollection);
  return `${title('Saúde & exames','Resultados laboratoriais e documentos organizados por data e biomarcador.')}${errorFor('labs')}
    <div class="grid cols3">${metric('Resultados',labs.length)}${metric('Coletas',dates.length)}${metric('Documentos',docs.length)}</div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Biomarcadores</b><small>Busque e acompanhe os resultados disponíveis.</small></div></div><input id="labQuery" class="fullInput" type="search" placeholder="Buscar biomarcador" value="${esc(state.ui.labQuery)}"><div class="labExplorer"><div class="exerciseList">${groups.slice(0,200).map(g=>`<button data-marker="${esc(g.key)}" class="${g.key===state.ui.selectedBiomarker?'active':''}"><b>${esc(g.label)}</b><small>${g.rows.length} resultado(s)</small></button>`).join('')||empty('Nenhum biomarcador encontrado.')}</div><div class="exerciseDetail">${selected?`<div class="exerciseHistoryHead"><b>${esc(selected.label)}</b><small>Resultados disponíveis</small></div><div class="list">${[...selected.rows].sort((a,b)=>String(b.collection_date).localeCompare(String(a.collection_date))).map(r=>`<div class="row"><time>${fmtDate(r.collection_date)}</time><div><b>${esc(r.result_raw??r.result_numeric??'—')} ${esc(r.unit||'')}</b><small>Referência: ${esc(r.reference_range||'não informada')} · ${esc(r.laboratory||'laboratório não informado')}</small></div></div>`).join('')}</div>`:empty('Selecione um biomarcador.')}</div></div></div>
      <div class="card"><div class="cardHead"><div><b>Coleta</b><small>Veja todos os resultados de uma mesma data.</small></div><select id="collectionSelect">${dates.map(d=>`<option value="${esc(d)}">${fmtDate(d)}</option>`).join('')}</select></div><div class="list">${collection.map(r=>`<div class="row"><div style="grid-column:1/3"><b>${esc(r.biomarker)}</b><small>${esc(r.result_raw??r.result_numeric??'—')} ${esc(r.unit||'')} · ref. ${esc(r.reference_range||'não informada')}</small></div></div>`).join('')||empty('Nenhuma coleta estruturada.')}</div></div>
    </div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Documentos</b><small>Laudos e arquivos registrados.</small></div></div><div class="list">${[...docs].sort((a,b)=>String(b.document_date).localeCompare(String(a.document_date))).map(d=>`<div class="row"><time>${fmtDate(d.document_date)}</time><div><b>${esc(d.title||d.document_type||'Documento')}</b><small>${esc(d.source||'origem registrada')}</small></div></div>`).join('')||empty('Nenhum documento registrado.')}</div></div>`;
}

export function renderNutrition(){
  const period=state.ui.nutritionPeriod,cut=period==='all'?null:since(Number(period)),rows=(state.data.nutrition||[]).filter(n=>!cut||day(n.nutrition_date)>=cut),meals=(state.data.meals||[]).filter(m=>!cut||day(m.meal_date)>=cut),withCalories=rows.filter(r=>num(r.calories_kcal)!=null),avg=key=>{const vals=rows.map(r=>num(r[key])).filter(v=>v!=null);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null};
  const monthMap={}; for(const r of state.data.nutrition||[]){const m=day(r.nutrition_date).slice(0,7); if(m) monthMap[m]=(monthMap[m]||0)+1;}
  return `${title('Nutrição','Histórico de alimentação registrado no MyFitnessPal e outras fontes importadas.')}
    <div class="controls"><select id="nutritionPeriod"><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="all">Todo histórico</option></select></div>
    <div class="grid cols4 sectionGap">${metric('Dias registrados',rows.length)}${metric('Calorias médias',fmtNum(avg('calories_kcal'),0),'kcal','somente dias com valor')}${metric('Proteína média',fmtNum(avg('protein_g'),0),'g','somente dias com valor')}${metric('Refeições',meals.length)}</div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Cobertura por mês</b><small>Dias com registro; ausência não significa consumo zero.</small></div></div><div class="list">${Object.entries(monthMap).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,24).map(([m,n])=>`<div class="row"><time>${m}</time><div><b>${n} dia(s)</b><small>com alimentação registrada</small></div></div>`).join('')}</div></div>
      <div class="card"><div class="cardHead"><div><b>Refeições recentes</b><small>Itens mais recentes do período escolhido.</small></div></div><div class="list">${[...meals].sort((a,b)=>String(b.meal_date).localeCompare(String(a.meal_date))).slice(0,60).map(m=>`<div class="row"><time>${fmtDate(m.meal_date)}</time><div><b>${esc(m.meal_name||'Refeição')}</b><small>${num(m.calories_kcal)!=null?`${fmtNum(m.calories_kcal,0)} kcal`:''}${num(m.protein_g)!=null?` · ${fmtNum(m.protein_g,0)} g proteína`:''}</small></div></div>`).join('')||empty('Nenhuma refeição encontrada.')}</div></div>
    </div>`;
}

export function renderData(){
  const uploads=[...(state.data.uploads||[])].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))),issues=(state.data.quality||[]).filter(q=>String(q.status).toLowerCase()==='open');
  return `${title('Dados','Importe seus arquivos e acompanhe o que entrou no seu histórico.')}
    <div class="grid cols2">
      <div class="card"><div class="cardHead"><div><b>Importar arquivo</b><small>Apple Saúde, Polar Flow, MyFitnessPal e exames em PDF, imagem, CSV, XML ou ZIP.</small></div></div><form id="uploadForm" class="uploadForm"><label>Tipo<select id="uploadType"><option value="apple_health">Apple Saúde</option><option value="polar_flow">Polar Flow</option><option value="myfitnesspal">MyFitnessPal</option><option value="fleury">Fleury</option><option value="einstein">Einstein</option><option value="other">Outro</option></select></label><label>Arquivo<input id="uploadFile" type="file" accept=".zip,.csv,.xml,.json,.pdf,image/*"></label><button class="primary" type="submit">Enviar</button><div id="uploadMsg" class="msg"></div></form></div>
      <div class="card"><div class="cardHead"><div><b>O que já existe</b><small>Quantidade de registros carregados em cada área.</small></div></div><div class="sourceGrid">${[['Bio',(state.data.body||[]).length],['Treinos',(state.data.workouts||[]).length],['Alimentação',(state.data.nutrition||[]).length],['Refeições',(state.data.meals||[]).length],['Exames',(state.data.labs||[]).length],['Documentos',(state.data.docs||[]).length],['Atividade',(state.data.activity||[]).length],['Métricas',(state.data.metrics||[]).length]].map(([l,n])=>`<div class="sourceCard"><b>${esc(l)}</b><span>${n}</span></div>`).join('')}</div></div>
    </div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Arquivos recebidos</b><small>Últimos envios.</small></div>${pill(`${uploads.length}`)}</div><div class="list">${uploads.slice(0,40).map(u=>`<div class="row"><time>${fmtDate(u.created_at)}</time><div><b>${esc(u.original_filename||'Arquivo')}</b><small>${esc(u.source_type||'tipo não informado')} · ${esc(u.status||'status não informado')}</small></div></div>`).join('')||empty('Nenhum arquivo enviado pelo Inbox ainda.')}</div></div>
      <div class="card"><div class="cardHead"><div><b>Pendências</b><small>Registros que precisam de revisão ou de uma fonte melhor.</small></div>${pill(`${issues.length}`)}</div><div class="list">${issues.slice(0,40).map(i=>`<div class="row"><div style="grid-column:1/3"><b>${esc(i.entity_name||i.category||'Pendência')}</b><small>${esc(i.description||'Revisão necessária.')}</small></div></div>`).join('')||empty('Nenhuma pendência aberta.')}</div></div>
    </div>`;
}

export const screenRenderers={bio:renderBio,treinos:renderTraining,evolucao:renderEvolution,analise:renderAnalysis,tratamentos:renderTreatments,hoje:renderToday,timeline:renderTimeline,saude:renderHealth,nutricao:renderNutrition,dados:renderData};
