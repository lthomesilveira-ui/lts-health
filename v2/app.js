(() => {
  'use strict';

  const CONFIG = Object.freeze({
    url: 'https://plztdqyuqcjohiimudnr.supabase.co',
    key: 'sb_publishable_7SdlV1H52wVVbPEsN7i7hg_jbluJ8aI',
    bucket: 'health-inbox',
    inspectFunction: 'health-inspect-upload-v2'
  });

  const fixtureMode = new URLSearchParams(location.search).has('fixture');
  const sb = fixtureMode ? null : supabase.createClient(CONFIG.url, CONFIG.key, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const day = value => String(value ?? '').slice(0, 10);
  const fmtDate = value => { const s = day(value); if (!s) return '—'; const [y,m,d] = s.split('-'); return y && m && d ? `${d}/${m}/${y}` : s; };
  const num = value => { const n = Number(value); return Number.isFinite(n) ? n : null; };
  const fmtNum = (value, digits=1) => num(value) == null ? '—' : Number(value).toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const unique = values => [...new Set(values.filter(Boolean))];
  const latest = (rows, key) => [...(rows || [])].filter(x => x?.[key]).sort((a,b) => String(b[key]).localeCompare(String(a[key])))[0] || null;
  const since = days => { const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate() - days + 1); return d.toISOString().slice(0,10); };
  const within = (value, days) => day(value) >= since(days);

  const state = {
    session: null,
    route: 'bio',
    loading: false,
    loaded: false,
    errors: {},
    data: {},
    ui: { trainingPeriod:'90', trainingQuery:'', openWorkout:null, compareA:null, compareB:null, timelineFilter:'all' }
  };

  const routes = new Set(['bio','treinos','evolucao','analise','tratamentos','hoje','timeline','saude','nutricao','dados']);

  function fixtureData(){
    return {
      body:[
        {measured_at:'2026-01-01',weight_kg:90,skeletal_muscle_mass_kg:45,fat_mass_kg:15,body_fat_pct:16.7,visceral_fat_level:7,score:82,source:'Teste'},
        {measured_at:'2026-02-01',weight_kg:91,skeletal_muscle_mass_kg:46,fat_mass_kg:14,body_fat_pct:15.4,visceral_fat_level:6,score:84,source:'Teste'}
      ],
      segmental:[{measured_at:'2026-02-01',lean_right_arm_kg:4.4,lean_left_arm_kg:4.3,lean_trunk_kg:34,lean_right_leg_kg:11,lean_left_leg_kg:10.9,fat_right_arm_kg:1.0,fat_left_arm_kg:1.0,fat_trunk_kg:7,fat_right_leg_kg:2.1,fat_left_leg_kg:2.0,source:'Teste'}],
      workouts:[{source_record_id:'fixture-workout',workout_date:'2026-02-02',workout_type:'Treino de teste',location:'Local de teste',duration_minutes:50,calories_kcal:400,heart_rate_avg:120,muscle_groups:['Peito'],record_status:'validated',is_canonical:true,source:'Teste'}],
      exercises:[{source_record_id:'fixture-ex',workout_source_record_id:'fixture-workout',workout_date:'2026-02-02',order_index:1,exercise:'Exercício de teste',muscle_group:'Peito',machine:'Máquina de teste',source:'Teste'}],
      sets:[{exercise_source_record_id:'fixture-ex',workout_source_record_id:'fixture-workout',workout_date:'2026-02-02',set_index:1,weight:40,weight_unit:'kg',reps_numeric:10,reps_raw:'10',source:'Teste'}],
      labs:[{collection_date:'2026-02-03',laboratory:'Laboratório de teste',biomarker:'Marcador de teste',result_raw:'10',result_numeric:10,unit:'u',reference_range:'5–15',source:'Teste'}],
      docs:[{document_date:'2026-02-03',title:'Documento de teste',document_type:'Exame',source:'Teste'}],
      nutrition:[{nutrition_date:'2026-02-02',calories_kcal:2200,protein_g:150,carbs_g:240,fat_g:70,source:'Teste'}],
      meals:[{meal_date:'2026-02-02',meal_name:'Refeição de teste',calories_kcal:500,protein_g:35,carbs_g:50,fat_g:15,source:'Teste'}],
      activity:[], metrics:[], treatments:[{event_date:'2026-02-02',medication:'Tratamento de teste',source:'Teste',confidence:'high'}], uploads:[], quality:[]
    };
  }

  async function fetchAll(table, select='*', orderColumn=null, ascending=false, maxRows=5000){
    const pageSize = 1000; const rows = [];
    for (let from=0; from<maxRows; from+=pageSize){
      let q = sb.from(table).select(select).range(from, from + pageSize - 1);
      if (orderColumn) q = q.order(orderColumn,{ascending});
      const {data,error} = await q;
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    return rows;
  }

  async function loadData(){
    if (state.loading) return;
    state.loading = true; state.errors = {}; setSync('Atualizando…'); render();
    if (fixtureMode){ state.data = fixtureData(); state.loaded = true; state.loading = false; setSync('Atualizado'); render(); return; }
    const jobs = {
      body: () => fetchAll('health_body_composition','source_record_id,measured_at,weight_kg,skeletal_muscle_mass_kg,fat_mass_kg,body_fat_pct,body_water_l,visceral_fat_level,score,waist_hip_ratio,bmr_kcal,source,source_file,confidence,notes','measured_at',true,1000),
      segmental: () => fetchAll('health_segmental_composition','source_record_id,measured_at,lean_right_arm_kg,lean_left_arm_kg,lean_trunk_kg,lean_right_leg_kg,lean_left_leg_kg,fat_right_arm_kg,fat_left_arm_kg,fat_trunk_kg,fat_right_leg_kg,fat_left_leg_kg,source,source_file,confidence','measured_at',true,1000),
      workouts: () => fetchAll('health_workouts','source_record_id,workout_date,workout_type,location,duration_minutes,calories_kcal,heart_rate_avg,heart_rate_min,heart_rate_max,muscle_groups,sets_by_group,source,source_file,confidence,notes,record_status,is_canonical','workout_date',false,1000),
      exercises: () => fetchAll('health_workout_exercises','source_record_id,workout_source_record_id,workout_date,order_index,exercise,machine,muscle_group,sets,reps,weight_kg,source,confidence,notes','workout_date',false,2000),
      sets: () => fetchAll('health_workout_sets','source_record_id,workout_source_record_id,exercise_source_record_id,workout_date,exercise_name,exercise_order,set_index,phase,weight,weight_unit,reps_numeric,reps_raw,failure,near_failure,technique,source,confidence,notes','workout_date',false,5000),
      labs: () => fetchAll('health_lab_results','source_record_id,collection_date,report_date,laboratory,biomarker,result_raw,result_numeric,unit,reference_range,flag,method,source,source_file,confidence,notes','collection_date',false,2000),
      docs: () => fetchAll('health_documents','source_record_id,document_date,title,document_type,source_file,source,extraction_status,confidence,notes','document_date',false,1000),
      nutrition: () => fetchAll('health_daily_nutrition','source_record_id,nutrition_date,calories_kcal,protein_g,carbs_g,fat_g,fiber_g,water_ml,source,source_file,confidence','nutrition_date',false,5000),
      meals: () => fetchAll('health_nutrition_meals','source_record_id,meal_date,meal_name,calories_kcal,protein_g,carbs_g,fat_g,source,source_file,confidence,record_status','meal_date',false,5000),
      activity: () => fetchAll('health_activity_records','source_record_id,activity_date,activity_name,activity_type,calories_kcal,duration_minutes,steps,source,source_file,confidence,record_status,is_adjustment','activity_date',false,5000),
      metrics: () => fetchAll('health_metrics','source_record_id,measured_at,metric_type,value,unit,source,source_file,confidence,notes','measured_at',false,5000),
      treatments: () => fetchAll('health_medication_events','source_record_id,event_date,medication,event_type,source,confidence','event_date',false,1000),
      uploads: () => fetchAll('health_uploads','id,source_type,original_filename,mime_type,size_bytes,status,created_at,processed_at,notes','created_at',false,500),
      quality: () => fetchAll('health_data_quality_issues','source_record_id,issue_code,category,severity,status,entity_name,record_ref,description,detected_at,resolution_notes','detected_at',false,1000)
    };
    const result = {};
    await Promise.all(Object.entries(jobs).map(async ([key,job]) => {
      try { result[key] = await job(); }
      catch (error) { result[key] = []; state.errors[key] = error.message || String(error); }
    }));
    result.workouts = (result.workouts || []).filter(w => w.is_canonical !== false && w.record_status !== 'quarantined');
    state.data = result; state.loaded = true; state.loading = false; setSync(Object.keys(state.errors).length ? 'Alguns dados não carregaram' : 'Atualizado'); render();
  }

  function setSync(text){ $('syncText').textContent = text; }

  function setRoute(route){
    if (route === 'mais'){ $('moreSheet').classList.remove('hidden'); return; }
    if (!routes.has(route)) route = 'bio';
    state.route = route; $('moreSheet').classList.add('hidden');
    try { localStorage.setItem('lts-health-v2-route', route); } catch {}
    history.replaceState(null,'',`#${route}`);
    document.querySelectorAll('[data-route]').forEach(b => b.classList.toggle('active', b.dataset.route === route));
    render(); window.scrollTo({top:0,behavior:'instant'});
  }

  function title(name, description, actions=''){ return `<div class="screenTitle"><div><h1>${esc(name)}</h1>${description ? `<p>${esc(description)}</p>` : ''}</div>${actions}</div>`; }
  function metric(label, value, unit='', sub=''){ return `<div class="card metric"><span>${esc(label)}</span><strong>${esc(value)}${unit ? ` <small style="display:inline;font-size:10px">${esc(unit)}</small>` : ''}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`; }
  function empty(text){ return `<div class="empty">${esc(text)}</div>`; }
  function errorFor(key){ return state.errors[key] ? `<div class="errorState">Não foi possível carregar esta parte agora. Tente atualizar.</div>` : ''; }
  function neutralDelta(a,b,digits=1,unit=''){ a=num(a); b=num(b); if(a==null||b==null)return '—'; const x=a-b; return `${x>0?'+':''}${fmtNum(x,digits)}${unit?` ${unit}`:''}`; }

  function bodyRows(){ return [...(state.data.body || [])].sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at))); }
  function workoutRows(){ return [...(state.data.workouts || [])].sort((a,b)=>String(b.workout_date).localeCompare(String(a.workout_date))); }
  function exercisesFor(workout){ const all=state.data.exercises||[]; const direct=all.filter(e=>e.workout_source_record_id===workout.source_record_id); return direct.sort((a,b)=>(a.order_index??999)-(b.order_index??999)); }
  function setsFor(exercise){ return (state.data.sets||[]).filter(s=>s.exercise_source_record_id===exercise.source_record_id).sort((a,b)=>(a.set_index??999)-(b.set_index??999)); }

  function lineChart(rows, series){
    const points = rows.filter(r => series.some(s => num(r[s.key]) != null)); if(points.length < 2) return empty('Ainda não há pontos suficientes para este gráfico.');
    const values = points.flatMap(r => series.map(s=>num(r[s.key])).filter(v=>v!=null)); const min0=Math.min(...values),max0=Math.max(...values),span=max0-min0||1,pad=span*.08,min=min0-pad,max=max0+pad,w=960,h=220,p=20;
    const x=i=>p+i*(w-p*2)/Math.max(1,points.length-1), y=v=>p+(max-v)*(h-p*2)/(max-min||1);
    const path=s=>points.map((r,i)=>num(r[s.key])==null?'':`${i?'L':'M'}${x(i).toFixed(1)} ${y(num(r[s.key])).toFixed(1)}`).filter(Boolean).join(' ');
    return `<div class="chart"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path class="gridline" d="M20 55H940 M20 110H940 M20 165H940"/>${series.map((s,i)=>`<path class="line${i+1}" d="${path(s)}"/>`).join('')}</svg></div><div class="legend">${series.map((s,i)=>`<span><i class="${i===1?'b':i===2?'c':''}"></i>${esc(s.label)}</span>`).join('')}</div>`;
  }

  function renderBio(){
    const rows=bodyRows(), last=rows.at(-1), prev=rows.at(-2), first=rows[0];
    if(!rows.length) return title('Bio','Composição corporal e histórico de bioimpedância.') + errorFor('body') + empty('Nenhuma bioimpedância encontrada.');
    if(!state.ui.compareA) state.ui.compareA=rows.at(-2)?.measured_at||rows[0].measured_at;
    if(!state.ui.compareB) state.ui.compareB=rows.at(-1).measured_at;
    const a=rows.find(x=>x.measured_at===state.ui.compareA), b=rows.find(x=>x.measured_at===state.ui.compareB);
    const opts=rows.map(r=>`<option value="${esc(r.measured_at)}">${fmtDate(r.measured_at)}</option>`).join('');
    const history=[...rows].reverse().map(r=>`<div class="row"><time>${fmtDate(r.measured_at)}</time><div><b>${fmtNum(r.weight_kg)} kg · MME ${fmtNum(r.skeletal_muscle_mass_kg)} kg</b><small>Gordura ${fmtNum(r.body_fat_pct)}% · ${esc(r.source||'fonte registrada')}</small></div></div>`).join('');
    return `${title('Bio','Composição corporal, comparação entre medições e histórico completo.')}
      <div class="grid cols4">
        ${metric('Peso',fmtNum(last.weight_kg),'kg',prev?`vs. anterior ${neutralDelta(last.weight_kg,prev.weight_kg,1,'kg')}`:'')}
        ${metric('MME',fmtNum(last.skeletal_muscle_mass_kg),'kg',prev?`vs. anterior ${neutralDelta(last.skeletal_muscle_mass_kg,prev.skeletal_muscle_mass_kg,1,'kg')}`:'')}
        ${metric('Gordura registrada',fmtNum(last.body_fat_pct),'%',prev?`vs. anterior ${neutralDelta(last.body_fat_pct,prev.body_fat_pct,1,'%')}`:'')}
        ${metric('Visceral',fmtNum(last.visceral_fat_level,0),'nível',`Última medição ${fmtDate(last.measured_at)}`)}
      </div>
      <div class="card sectionGap"><div class="cardHead"><div><b>Peso · MME · gordura</b><small>Série histórica registrada. As variações são descritivas, sem classificação estética.</small></div><span class="pill">${rows.length} medições</span></div>${lineChart(rows,[{key:'weight_kg',label:'Peso'},{key:'skeletal_muscle_mass_kg',label:'MME'},{key:'fat_mass_kg',label:'Gordura kg'}])}</div>
      <div class="grid cols2 sectionGap"><div class="card"><div class="cardHead"><div><b>Comparar duas medições</b><small>Diferença observada entre as datas escolhidas.</small></div></div><div class="compare"><select id="compareA">${opts}</select><select id="compareB">${opts}</select><div class="compareResults">${[['Peso','weight_kg','kg'],['MME','skeletal_muscle_mass_kg','kg'],['Gordura','body_fat_pct','%'],['InBody','score','']].map(([l,k,u])=>`<div class="compareMetric"><span>${l}</span><strong>${neutralDelta(b?.[k],a?.[k],k==='score'?0:1,u)}</strong></div>`).join('')}</div></div></div><div class="card"><div class="cardHead"><div><b>Trajetória registrada</b><small>Primeira → última medição disponível.</small></div></div><div class="list"><div class="row"><time>${fmtDate(first.measured_at)}</time><div><b>${fmtNum(first.weight_kg)} kg</b><small>Primeiro registro disponível</small></div></div><div class="row"><time>${fmtDate(last.measured_at)}</time><div><b>${fmtNum(last.weight_kg)} kg</b><small>Peso ${neutralDelta(last.weight_kg,first.weight_kg,1,'kg')} · MME ${neutralDelta(last.skeletal_muscle_mass_kg,first.skeletal_muscle_mass_kg,1,'kg')}</small></div></div></div></div></div>
      <div class="card sectionGap"><div class="cardHead"><div><b>Histórico</b><small>Da medição mais recente à mais antiga.</small></div></div><div class="list">${history}</div></div>`;
  }

  function renderTraining(){
    const all=workoutRows(); const period=state.ui.trainingPeriod; const cut=period==='all'?null:since(Number(period)); const query=state.ui.trainingQuery.toLowerCase().trim();
    const rows=all.filter(w=>(!cut||day(w.workout_date)>=cut)&&(!query||`${w.workout_type||''} ${w.location||''} ${(w.muscle_groups||[]).join(' ')}`.toLowerCase().includes(query)));
    const sessions=rows.map(w=>{ const ex=exercisesFor(w); const count=ex.reduce((n,e)=>n+setsFor(e).length,0); const partial=w.record_status==='review_required'; const open=state.ui.openWorkout===w.source_record_id; return `<article class="session ${open?'open':''}" data-workout="${esc(w.source_record_id)}"><button class="sessionHead" data-open-workout="${esc(w.source_record_id)}"><time>${fmtDate(w.workout_date)}</time><div><b>${esc(w.workout_type||'Treino')}</b><small>${esc(w.location||'Local não informado')} · ${ex.length} exercício(s) · ${count} série(s)</small></div><span class="pill ${partial?'warn':'ok'}">${partial?'incompleto':'registrado'}</span></button><div class="sessionBody">${partial?`<div class="empty" style="text-align:left">Há campos faltando neste treino. Eles permanecem em branco em vez de serem completados por estimativa.</div>`:''}${ex.map(e=>{const ss=setsFor(e);return `<div class="exercise"><b>${esc(e.exercise||'Exercício')}</b><small>${[e.machine,e.muscle_group].filter(Boolean).map(esc).join(' · ')}</small><div class="sets">${ss.length?ss.map(s=>`<span class="set">S${s.set_index??'—'} · ${num(s.weight)!=null?`${fmtNum(s.weight,Number.isInteger(num(s.weight))?0:1)} ${esc(s.weight_unit||'')}`:'carga não informada'} · ${esc(s.reps_raw??s.reps_numeric??'—')} reps</span>`).join(''):'<span class="set">Séries detalhadas não disponíveis</span>'}</div></div>`}).join('')||empty('Sessão sem exercícios estruturados.')}</div></article>`; }).join('');
    const volume={}; (state.data.exercises||[]).filter(e=>!cut||day(e.workout_date)>=cut).forEach(e=>{const n=setsFor(e).length;if(e.muscle_group&&n)volume[e.muscle_group]=(volume[e.muscle_group]||0)+n});
    return `${title('Treinos','Histórico de sessões, exercícios e séries. O app mostra o que foi registrado, sem prescrever intensidade.')}
      <div class="controls"><select id="trainingPeriod"><option value="28">28 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="all">Todo histórico</option></select><input id="trainingQuery" type="search" placeholder="Buscar treino, local ou grupo" value="${esc(state.ui.trainingQuery)}"></div>
      <div class="grid cols3 sectionGap">${metric('Sessões',rows.length,'',period==='all'?'todo histórico':`${period} dias`)}${metric('Exercícios',(state.data.exercises||[]).filter(e=>!cut||day(e.workout_date)>=cut).length,'','registros estruturados')}${metric('Séries',(state.data.sets||[]).filter(s=>!cut||day(s.workout_date)>=cut).length,'','séries detalhadas')}</div>
      <div class="grid cols2 sectionGap"><div class="card"><div class="cardHead"><div><b>Sessões</b><small>Toque para abrir exercícios e séries.</small></div></div><div class="list">${sessions||empty('Nenhum treino encontrado.')}</div></div><div class="card"><div class="cardHead"><div><b>Séries por grupo</b><small>Contagem do período selecionado, apenas com séries estruturadas.</small></div></div><div class="list">${Object.entries(volume).sort((a,b)=>b[1]-a[1]).map(([g,n])=>`<div class="row"><div style="grid-column:1/3"><b>${esc(g)}</b><small>${n} série(s) registradas</small></div></div>`).join('')||empty('Sem séries por grupo neste período.')}</div></div></div>`;
  }

  function weeklyWorkoutCounts(){
    const rows=workoutRows(), now=new Date(); now.setHours(12,0,0,0); const out=[];
    for(let i=7;i>=0;i--){const end=new Date(now);end.setDate(end.getDate()-i*7);const start=new Date(end);start.setDate(start.getDate()-6);const a=start.toISOString().slice(0,10),b=end.toISOString().slice(0,10);out.push({label:a.slice(5).replace('-','/'),count:rows.filter(w=>day(w.workout_date)>=a&&day(w.workout_date)<=b).length})}
    return out;
  }

  function renderEvolution(){
    const body=bodyRows(), seg=[...(state.data.segmental||[])].sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at))), weeks=weeklyWorkoutCounts();
    const segRows=seg.map(s=>`<div class="row"><time>${fmtDate(s.measured_at)}</time><div><b>Massa magra: braços ${fmtNum(s.lean_right_arm_kg)} / ${fmtNum(s.lean_left_arm_kg)} kg</b><small>Pernas ${fmtNum(s.lean_right_leg_kg)} / ${fmtNum(s.lean_left_leg_kg)} kg · tronco ${fmtNum(s.lean_trunk_kg)} kg</small></div></div>`).reverse().join('');
    const weekHtml=weeks.map(w=>`<div class="row"><time>${w.label}</time><div><b>${w.count} sessão(ões)</b><small>Semana registrada</small></div></div>`).join('');
    return `${title('Evolução','Composição corporal, análise segmentar e ritmo de treinos ao longo do tempo.')}
      <div class="card"><div class="cardHead"><div><b>Composição corporal</b><small>Peso, massa muscular esquelética e gordura em kg.</small></div></div>${lineChart(body,[{key:'weight_kg',label:'Peso'},{key:'skeletal_muscle_mass_kg',label:'MME'},{key:'fat_mass_kg',label:'Gordura kg'}])}</div>
      <div class="grid cols2 sectionGap"><div class="card"><div class="cardHead"><div><b>Análise segmentar</b><small>Medições registradas por segmento.</small></div><span class="pill">${seg.length} datas</span></div><div class="list">${segRows||empty('Ainda não há análise segmentar estruturada.')}</div></div><div class="card"><div class="cardHead"><div><b>Treinos por semana</b><small>Frequência observada nas últimas oito semanas.</small></div></div><div class="list">${weekHtml}</div></div></div>`;
  }

  function renderAnalysis(){
    const workouts=workoutRows(), body=bodyRows(), nutrition=state.data.nutrition||[], labs=state.data.labs||[], metrics=state.data.metrics||[];
    const w90=workouts.filter(w=>within(w.workout_date,90)), n90=unique(nutrition.filter(n=>within(n.nutrition_date,90)).map(n=>n.nutrition_date)), sleep90=metrics.filter(m=>m.metric_type==='sleep_duration_h'&&within(m.measured_at,90));
    const last=body.at(-1), prev=body.at(-2); const overlap=unique(w90.map(w=>w.workout_date).filter(d=>nutrition.some(n=>day(n.nutrition_date)===day(d))));
    const labDates=unique(labs.map(l=>l.collection_date));
    return `${title('Análise','Uma leitura conjunta do histórico registrado. Relações temporais não são tratadas como causa e efeito.')}
      <div class="grid cols4">${metric('Treinos · 90 dias',w90.length,'','sessões registradas')}${metric('Nutrição · 90 dias',n90.length,'dias','dias com registro')}${metric('Sono · 90 dias',sleep90.length,'dias','dias disponíveis')}${metric('Coletas laboratoriais',labDates.length,'','datas estruturadas')}</div>
      <div class="grid cols2 sectionGap"><div class="card"><div class="cardHead"><div><b>Composição recente</b><small>Diferença entre as duas últimas medições.</small></div></div>${last&&prev?`<div class="grid cols2">${metric('Peso',neutralDelta(last.weight_kg,prev.weight_kg,1,'kg'))}${metric('MME',neutralDelta(last.skeletal_muscle_mass_kg,prev.skeletal_muscle_mass_kg,1,'kg'))}${metric('Gordura',neutralDelta(last.body_fat_pct,prev.body_fat_pct,1,'%'))}${metric('Intervalo',`${Math.round((new Date(last.measured_at)-new Date(prev.measured_at))/86400000)} dias`)}</div>`:empty('São necessárias pelo menos duas medições para comparar.')}</div><div class="card"><div class="cardHead"><div><b>Treino × nutrição</b><small>Quantos dias têm registros das duas fontes no mesmo dia.</small></div></div><div class="grid cols2">${metric('Dias em comum',overlap.length,'','nos últimos 90 dias')}${metric('Treinos no período',w90.length,'','sessões registradas')}</div><p class="footerNote">Coincidência de datas não demonstra efeito de um domínio sobre o outro.</p></div></div>
      <div class="card sectionGap"><div class="cardHead"><div><b>O que já pode ser comparado</b><small>Cobertura disponível para análises longitudinais.</small></div></div><div class="sourceGrid">${[['Composição',body.length],['Treinos',workouts.length],['Nutrição',nutrition.length],['Sono',metrics.filter(m=>m.metric_type==='sleep_duration_h').length],['Exames',labs.length]].map(([l,n])=>`<div class="sourceCard"><b>${l}</b><small>${n} registro(s) disponíveis</small></div>`).join('')}</div></div>`;
  }

  function renderTreatments(){
    const rows=state.data.treatments||[];
    return `${title('Tratamentos','Histórico por data para contexto junto a exames e outras medições.')}
      <div class="card"><div class="cardHead"><div><b>Eventos registrados</b><small>Esta tela mostra somente data, nome e fonte. Alterações de tratamento devem ser discutidas com o profissional responsável.</small></div><span class="pill">${rows.length} eventos</span></div><div class="list">${rows.map(r=>`<div class="row"><time>${fmtDate(r.event_date)}</time><div><b>${esc(r.medication||'Tratamento')}</b><small>${esc(r.source||'fonte registrada')}</small></div></div>`).join('')||empty('Nenhum tratamento estruturado.')}</div></div>`;
  }

  function renderToday(){
    const workout=workoutRows()[0], body=bodyRows().at(-1), nut=latest(state.data.nutrition,'nutrition_date'), lab=latest(state.data.labs,'collection_date'), issues=(state.data.quality||[]).filter(q=>String(q.status).toLowerCase()==='open');
    return `${title('Hoje','Um resumo curto dos registros mais recentes.')}
      <div class="grid cols4">${metric('Último treino',workout?fmtDate(workout.workout_date):'—','',workout?.workout_type||'sem sessão')}${metric('Última bio',body?fmtDate(body.measured_at):'—','',body?`${fmtNum(body.weight_kg)} kg registrados`:'sem medição')}${metric('Última nutrição',nut?fmtDate(nut.nutrition_date):'—','',nut?'dia registrado':'sem registro')}${metric('Último exame',lab?fmtDate(lab.collection_date):'—','',lab?.laboratory||'sem coleta')}</div>
      <div class="grid cols2 sectionGap"><div class="card"><div class="cardHead"><div><b>Treino mais recente</b><small>Resumo da última sessão registrada.</small></div></div>${workout?`<div class="list"><div class="row"><time>${fmtDate(workout.workout_date)}</time><div><b>${esc(workout.workout_type||'Treino')}</b><small>${esc(workout.location||'Local não informado')}</small></div></div></div>`:empty('Sem treino registrado.')}</div><div class="card"><div class="cardHead"><div><b>Pendências de dados</b><small>Itens que ainda precisam de informação ou revisão.</small></div><span class="pill ${issues.length?'warn':'ok'}">${issues.length}</span></div><div class="list">${issues.slice(0,6).map(i=>`<div class="row"><div style="grid-column:1/3"><b>${esc(i.entity_name||i.category||'Dados')}</b><small>${esc(i.description||'Revisão pendente')}</small></div></div>`).join('')||empty('Nenhuma pendência aberta.')}</div></div></div>`;
  }

  function renderTimeline(){
    const events=[];
    workoutRows().forEach(w=>events.push({date:w.workout_date,type:'Treino',title:w.workout_type||'Treino',sub:w.location||''}));
    (state.data.body||[]).forEach(b=>events.push({date:b.measured_at,type:'Bio',title:'Composição corporal',sub:`${fmtNum(b.weight_kg)} kg`}));
    const labGroups={}; (state.data.labs||[]).forEach(l=>{const d=day(l.collection_date);labGroups[d]=(labGroups[d]||0)+1}); Object.entries(labGroups).forEach(([d,n])=>events.push({date:d,type:'Exames',title:'Coleta laboratorial',sub:`${n} resultado(s)`}));
    (state.data.nutrition||[]).slice(0,120).forEach(n=>events.push({date:n.nutrition_date,type:'Nutrição',title:'Registro alimentar',sub:num(n.calories_kcal)!=null?`${fmtNum(n.calories_kcal,0)} kcal registradas`:''}));
    const filter=state.ui.timelineFilter; const rows=events.filter(e=>filter==='all'||e.type===filter).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,250);
    return `${title('Timeline','Treinos, bioimpedância, exames e nutrição em ordem de data.')}
      <div class="controls"><select id="timelineFilter"><option value="all">Tudo</option><option>Treino</option><option>Bio</option><option>Exames</option><option>Nutrição</option></select></div><div class="card sectionGap"><div class="list">${rows.map(e=>`<div class="row"><time>${fmtDate(e.date)}</time><div><b>${esc(e.title)}</b><small>${esc(e.type)}${e.sub?' · '+esc(e.sub):''}</small></div></div>`).join('')||empty('Nenhum evento encontrado.')}</div></div>`;
  }

  function renderHealth(){
    const labs=state.data.labs||[], docs=state.data.docs||[], labDates=unique(labs.map(l=>l.collection_date)); const latestDate=[...labDates].sort().reverse()[0];
    const latestLabs=labs.filter(l=>l.collection_date===latestDate);
    return `${title('Saúde & exames','Resultados laboratoriais e documentos organizados por data e fonte.')}
      <div class="grid cols3">${metric('Resultados',labs.length,'','estruturados')}${metric('Coletas',labDates.length,'datas','disponíveis')}${metric('Documentos',docs.length,'','registrados')}</div>
      <div class="grid cols2 sectionGap"><div class="card"><div class="cardHead"><div><b>${latestDate?'Coleta de '+fmtDate(latestDate):'Resultados laboratoriais'}</b><small>${latestDate?esc(latestLabs[0]?.laboratory||'Laboratório registrado'):''}</small></div></div><div class="list">${latestLabs.map(l=>`<div class="row"><div style="grid-column:1/3"><b>${esc(l.biomarker||'Biomarcador')} · ${esc(l.result_raw??l.result_numeric??'—')} ${esc(l.unit||'')}</b><small>${l.reference_range?'Referência: '+esc(l.reference_range):'Referência não informada'}${l.flag?' · '+esc(l.flag):''}</small></div></div>`).join('')||errorFor('labs')||empty('Nenhum resultado estruturado.')}</div></div><div class="card"><div class="cardHead"><div><b>Documentos</b><small>Arquivos e registros de saúde disponíveis.</small></div></div><div class="list">${docs.slice(0,40).map(d=>`<div class="row"><time>${fmtDate(d.document_date)}</time><div><b>${esc(d.title||d.document_type||'Documento')}</b><small>${esc(d.source||d.document_type||'fonte registrada')}</small></div></div>`).join('')||errorFor('docs')||empty('Nenhum documento registrado.')}</div></div></div>`;
  }

  function average(rows,key){const vals=rows.map(r=>num(r[key])).filter(v=>v!=null);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null}
  function renderNutrition(){
    const rows=state.data.nutrition||[], cut=since(90), recent=rows.filter(r=>day(r.nutrition_date)>=cut), meals=state.data.meals||[];
    return `${title('Nutrição','Histórico do MyFitnessPal e outros registros alimentares. Médias descrevem o que foi registrado e não são metas.')}
      <div class="grid cols4">${metric('Dias registrados',rows.length,'','histórico disponível')}${metric('90 dias',unique(recent.map(r=>r.nutrition_date)).length,'dias','com algum registro')}${metric('Energia média',average(recent,'calories_kcal')!=null?fmtNum(average(recent,'calories_kcal'),0):'—','kcal','dias com valor')}${metric('Proteína média',average(recent,'protein_g')!=null?fmtNum(average(recent,'protein_g'),0):'—','g','dias com valor')}</div>
      <div class="grid cols2 sectionGap"><div class="card"><div class="cardHead"><div><b>Dias recentes</b><small>Ausência de um dia significa ausência de registro, não zero consumo.</small></div></div><div class="list">${rows.slice(0,40).map(r=>`<div class="row"><time>${fmtDate(r.nutrition_date)}</time><div><b>${num(r.calories_kcal)!=null?fmtNum(r.calories_kcal,0)+' kcal':'Energia não informada'}</b><small>${num(r.protein_g)!=null?'Proteína '+fmtNum(r.protein_g,0)+' g':''}${num(r.carbs_g)!=null?' · Carbo '+fmtNum(r.carbs_g,0)+' g':''}${num(r.fat_g)!=null?' · Gordura '+fmtNum(r.fat_g,0)+' g':''}</small></div></div>`).join('')||errorFor('nutrition')||empty('Nenhum dia nutricional carregado.')}</div></div><div class="card"><div class="cardHead"><div><b>Refeições recentes</b><small>Registros preservados do histórico.</small></div></div><div class="list">${meals.slice(0,40).map(m=>`<div class="row"><time>${fmtDate(m.meal_date)}</time><div><b>${esc(m.meal_name||'Refeição')}</b><small>${num(m.calories_kcal)!=null?fmtNum(m.calories_kcal,0)+' kcal':''}${num(m.protein_g)!=null?' · proteína '+fmtNum(m.protein_g,0)+' g':''}</small></div></div>`).join('')||errorFor('meals')||empty('Nenhuma refeição carregada.')}</div></div></div>`;
  }

  function renderData(){
    const d=state.data, uploads=d.uploads||[];
    return `${title('Dados','Importe novas fontes e acompanhe o que já está conectado.')}
      <div class="sourceGrid">${[['Apple Saúde',(d.metrics||[]).length,'Atividade, sono e outras métricas quando disponíveis.'],['Polar Flow',(d.workouts||[]).filter(w=>String(w.source||'').toLowerCase().includes('polar')).length,'Treinos e frequência cardíaca quando a fonte acrescenta detalhe.'],['Fleury / Einstein',(d.labs||[]).length,'Exames e documentos estruturados.'],['MyFitnessPal',(d.nutrition||[]).length,'Nutrição e refeições históricas.'],['Bioimpedância',(d.body||[]).length,'Composição corporal e segmentar.']].map(([l,n,s])=>`<div class="sourceCard"><b>${esc(l)}</b><small>${n} registro(s) carregados</small><small>${esc(s)}</small></div>`).join('')}</div>
      <div class="grid cols2 sectionGap"><div class="card"><div class="cardHead"><div><b>Adicionar arquivo</b><small>O arquivo é enviado ao armazenamento privado antes do processamento.</small></div></div><div class="controls"><select id="uploadType"><option value="apple_health">Apple Saúde</option><option value="polar">Polar Flow</option><option value="lab">Exames</option><option value="myfitnesspal">MyFitnessPal</option><option value="body_composition">Bioimpedância</option><option value="training">Treino</option><option value="document">Outro documento</option></select><input id="uploadFile" type="file"><button id="uploadBtn" class="primary">Enviar</button></div><div id="uploadMsg" class="footerNote"></div></div><div class="card"><div class="cardHead"><div><b>Arquivos recentes</b><small>Status do processamento.</small></div></div><div class="list">${uploads.slice(0,30).map(u=>`<div class="row"><time>${fmtDate(u.created_at)}</time><div><b>${esc(u.original_filename||u.source_type||'Arquivo')}</b><small>${esc(u.source_type||'')} · ${esc(u.status||'recebido')}</small></div></div>`).join('')||empty('Nenhum arquivo enviado por esta área ainda.')}</div></div></div>`;
  }

  function render(){
    if (!$('app') || $('app').classList.contains('hidden')) return;
    if (state.loading && !state.loaded){ $('screenHost').innerHTML = title(routeLabel(state.route),'') + `<div class="loading">Carregando seus dados…</div>`; return; }
    if (!state.loaded){ $('screenHost').innerHTML = `<div class="loading">Preparando seus dados…</div>`; return; }
    const renderer = {bio:renderBio,treinos:renderTraining,evolucao:renderEvolution,analise:renderAnalysis,tratamentos:renderTreatments,hoje:renderToday,timeline:renderTimeline,saude:renderHealth,nutricao:renderNutrition,dados:renderData}[state.route] || renderBio;
    $('screenHost').innerHTML = renderer(); bindScreen();
  }

  function routeLabel(route){return ({bio:'Bio',treinos:'Treinos',evolucao:'Evolução',analise:'Análise',tratamentos:'Tratamentos',hoje:'Hoje',timeline:'Timeline',saude:'Saúde & exames',nutricao:'Nutrição',dados:'Dados'})[route]||'LTS Health'}

  function bindScreen(){
    if(state.route==='bio'){
      const a=$('compareA'),b=$('compareB'); if(a){a.value=state.ui.compareA;a.onchange=e=>{state.ui.compareA=e.target.value;render()}} if(b){b.value=state.ui.compareB;b.onchange=e=>{state.ui.compareB=e.target.value;render()}}
    }
    if(state.route==='treinos'){
      const p=$('trainingPeriod'),q=$('trainingQuery'); if(p){p.value=state.ui.trainingPeriod;p.onchange=e=>{state.ui.trainingPeriod=e.target.value;render()}} if(q){q.oninput=e=>{state.ui.trainingQuery=e.target.value;render()}}
      document.querySelectorAll('[data-open-workout]').forEach(b=>b.onclick=()=>{state.ui.openWorkout=state.ui.openWorkout===b.dataset.openWorkout?null:b.dataset.openWorkout;render()});
    }
    if(state.route==='timeline'){const f=$('timelineFilter');if(f){f.value=state.ui.timelineFilter;f.onchange=e=>{state.ui.timelineFilter=e.target.value;render()}}}
    if(state.route==='dados') $('uploadBtn')?.addEventListener('click', uploadFile);
  }

  async function uploadFile(){
    if(fixtureMode){$('uploadMsg').textContent='Envio desativado no modo de teste.';return}
    const input=$('uploadFile'), file=input?.files?.[0]; if(!file){$('uploadMsg').textContent='Selecione um arquivo.';return} if(file.size>50*1024*1024){$('uploadMsg').textContent='O arquivo excede 50 MB.';return}
    const type=$('uploadType').value, safeName=String(file.name||'arquivo').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-120), path=`${state.session.user.id}/${Date.now()}-${safeName}`;
    $('uploadBtn').disabled=true; $('uploadMsg').textContent='Enviando…';
    const up=await sb.storage.from(CONFIG.bucket).upload(path,file,{upsert:false,contentType:file.type||undefined});
    if(up.error){$('uploadMsg').textContent='Falha no envio: '+up.error.message;$('uploadBtn').disabled=false;return}
    const meta=await sb.from('health_uploads').insert({user_id:state.session.user.id,source_type:type,original_filename:file.name,storage_path:path,mime_type:file.type||null,size_bytes:file.size,status:'uploaded',notes:'Recebido pelo LTS Health v2'}).select().single();
    if(meta.error){await sb.storage.from(CONFIG.bucket).remove([path]);$('uploadMsg').textContent='Falha ao registrar o arquivo.';$('uploadBtn').disabled=false;return}
    const inspect=await sb.functions.invoke(CONFIG.inspectFunction,{body:{upload_id:meta.data.id}}); $('uploadBtn').disabled=false; input.value=''; $('uploadMsg').textContent=inspect.error?'Arquivo salvo, mas o processamento precisa ser revisto.':'Arquivo recebido e processado conforme o formato disponível.'; await loadData();
  }

  function bindGlobal(){
    document.addEventListener('click',e=>{const b=e.target.closest('[data-route]'); if(!b)return; e.preventDefault(); setRoute(b.dataset.route)});
    $('closeMore').onclick=()=>$('moreSheet').classList.add('hidden'); $('moreSheet').onclick=e=>{if(e.target===$('moreSheet'))$('moreSheet').classList.add('hidden')};
    $('refreshBtn').onclick=loadData; $('logoutBtn').onclick=async()=>{if(fixtureMode)return;await sb.auth.signOut()};
    $('loginBtn').onclick=signIn; $('password').onkeydown=e=>{if(e.key==='Enter')signIn()};
  }

  async function signIn(){
    const email=$('email').value.trim(),password=$('password').value; $('loginMsg').textContent='Entrando…';
    const {error}=await sb.auth.signInWithPassword({email,password}); $('loginMsg').textContent=error?error.message:'';
  }

  function showSession(session){
    state.session=session; $('login').classList.toggle('hidden',!!session); $('app').classList.toggle('hidden',!session);
    if(session){ let r=location.hash.slice(1); if(!routes.has(r)){try{r=localStorage.getItem('lts-health-v2-route')||'bio'}catch{r='bio'}} state.route=routes.has(r)?r:'bio'; document.querySelectorAll('[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===state.route)); loadData(); }
  }

  bindGlobal();
  if(fixtureMode){ showSession({user:{id:'fixture'}}); }
  else {
    sb.auth.onAuthStateChange((_event,session)=>showSession(session));
    sb.auth.getSession().then(({data})=>showSession(data.session));
  }
})();
