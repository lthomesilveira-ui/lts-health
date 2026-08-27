(function(){
  const V12={exerciseKey:null,exerciseQuery:'',labQuery:'',labDate:'all',bodyCompare:'previous'};
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
  const dkey=v=>String(v||'').slice(0,10);
  const unique=a=>[...new Set(a.filter(Boolean))];
  const ensure=(id,parent,before=null)=>{let e=q(id);if(e)return e;e=document.createElement('div');e.id=id;if(before)parent.insertBefore(e,before);else parent.appendChild(e);return e};
  const delta=(a,b,unit)=>{const x=n(a),y=n(b);if(x==null||y==null)return 'sem comparação';const z=x-y;return `${z>0?'+':''}${fmtNum(z,1)} ${unit}`};
  function install(){
    const today=q('today');
    const coverage=ensure('v12Coverage',today,today?.querySelector('.hero'));
    coverage.className='v12Panel';

    const evo=q('evolution');
    const evoBefore=evo?.querySelector('.grid2');
    const body=ensure('v12BodyCompare',evo,evoBefore);body.className='v12Panel';
    body.innerHTML=`<div class="v12Head"><div><b>Comparação entre medições</b><small>Diferenças registradas entre pontos reais da série, sem classificar a mudança como melhor ou pior.</small></div><div class="v12Controls"><select id="v12BodyCompare"><option value="previous">Medição anterior</option><option value="first">Primeira medição</option></select></div></div><div id="v12BodyCompareGrid" class="v12CompareGrid"></div><div id="v12BodyCompareFoot" class="v12Foot"></div>`;

    const training=q('training');
    const trainingBefore=training?.querySelector('.grid2');
    const explorer=ensure('v12ExerciseExplorer',training,trainingBefore);explorer.className='v12Panel';
    explorer.innerHTML=`<div class="v12Head"><div><b>Explorador de exercícios</b><small>Histórico estruturado por exercício e sessão. Cargas com unidades diferentes permanecem separadas e nunca são convertidas por inferência.</small></div><div class="v12Controls"><input id="v12ExerciseQuery" type="search" placeholder="Buscar exercício"></div></div><div class="v12Explorer"><div id="v12ExerciseList" class="v12ExerciseList"></div><div id="v12ExerciseDetail" class="v12ExerciseDetail"></div></div>`;

    const health=q('health');
    const healthBefore=health?.querySelector('.grid2');
    const clinical=ensure('v12Clinical',health,healthBefore);clinical.className='v12Panel';
    clinical.innerHTML=`<div class="v12Head"><div><b>Navegador clínico</b><small>Exames e documentos são organizados por data e fonte; o app não transforma um resultado isolado em diagnóstico.</small></div><div class="v12Controls"><select id="v12LabDate"><option value="all">Todas as coletas</option></select><input id="v12LabQuery" type="search" placeholder="Buscar biomarcador"></div></div><div class="v12ClinicalGrid"><div><div class="v12CollectionList" id="v12CollectionList"></div><div id="v12DocumentSummary" class="v12CompareGrid" style="margin-top:10px"></div></div><div id="v12Biomarkers" class="v12Biomarkers"></div></div><div class="v12Foot">Referências são exibidas como vieram da fonte. Interpretação clínica e mudanças de tratamento exigem avaliação profissional e contexto adequado.</div>`;

    q('v12BodyCompare')?.addEventListener('change',e=>{V12.bodyCompare=e.target.value;renderBodyCompare()});
    q('v12ExerciseQuery')?.addEventListener('input',e=>{V12.exerciseQuery=e.target.value;renderExerciseExplorer()});
    q('v12LabQuery')?.addEventListener('input',e=>{V12.labQuery=e.target.value;renderClinical()});
    q('v12LabDate')?.addEventListener('change',e=>{V12.labDate=e.target.value;renderClinical()});
  }
  function coverageCard(label,value,small,status){return `<div class="v12Source ${status}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(small)}</small></div>`}
  function renderCoverage(){
    const w=state.canonicalWorkouts||[],b=state.body||[],l=state.labs||[],m=state.metrics||[];
    const nutritionCount=state.mfp?.dailyCount||state.nutrition?.length||0;
    const labDates=unique(l.map(x=>x.collection_date));
    const activity=m.filter(x=>['steps','active_energy_kcal','exercise_minutes','stand_hours','resting_heart_rate_bpm'].includes(x.metric_type));
    const sleep=m.filter(x=>x.metric_type==='sleep_duration_h');
    const cards=[
      coverageCard('Treino',`${w.length} sessões`,w.length?'histórico canônico disponível':'fonte ainda sem sessões',w.length?'ready':'pending'),
      coverageCard('Composição',`${b.length} medições`,b.length>1?'série longitudinal disponível':'cobertura limitada',b.length>1?'ready':b.length?'partial':'pending'),
      coverageCard('Nutrição',nutritionCount.toLocaleString('pt-BR')+' dias',nutritionCount?'MyFitnessPal preservado':'fonte pendente',nutritionCount?'ready':'pending'),
      coverageCard('Laboratório',`${labDates.length} coleta(s)`,`${l.length} resultados estruturados`,labDates.length>1?'ready':labDates.length?'partial':'pending'),
      coverageCard('Atividade',`${activity.length} registros`,activity.length?'métricas suportadas disponíveis':'Apple Health pendente',activity.length?'ready':'pending'),
      coverageCard('Sono',`${sleep.length} registros`,sleep.length?'duração observada disponível':'Apple Health pendente',sleep.length?'ready':'pending')
    ];
    q('v12Coverage').innerHTML=`<div class="v12Head"><div><b>Cobertura operacional</b><small>O que o LTS Health consegue observar hoje, sem criar score artificial para domínios ausentes.</small></div><div class="v12StatusLine"><i class="ready"></i><small>fonte disponível</small><i class="partial"></i><small>cobertura parcial</small><i class="pending"></i><small>pendente</small></div></div><div class="v12SourceGrid">${cards.join('')}</div>`;
  }
  function metricCard(label,latest,compare,unit){return `<div class="v12Metric"><span>${esc(label)}</span><strong>${latest==null?'—':`${fmtNum(latest,1)} ${esc(unit)}`}</strong><small>${latest==null||compare==null?'comparação indisponível':`diferença registrada: ${delta(latest,compare,unit)}`}</small></div>`}
  function renderBodyCompare(){
    const b=[...(state.body||[])].sort((a,c)=>String(c.measured_at).localeCompare(String(a.measured_at)));
    if(!b.length){q('v12BodyCompareGrid').innerHTML='<div class="v12Empty">Sem medições corporais estruturadas.</div>';q('v12BodyCompareFoot').textContent='';return}
    const latest=b[0],compare=V12.bodyCompare==='first'?b.at(-1):b[1];
    q('v12BodyCompareGrid').innerHTML=[
      metricCard('Peso registrado',n(latest.weight_kg),n(compare?.weight_kg),'kg'),
      metricCard('Massa muscular registrada',n(latest.skeletal_muscle_mass_kg),n(compare?.skeletal_muscle_mass_kg),'kg'),
      metricCard('Gordura corporal registrada',n(latest.body_fat_pct),n(compare?.body_fat_pct),'%')
    ].join('');
    q('v12BodyCompareFoot').textContent=compare?`Comparação: ${fmtDate(latest.measured_at)} versus ${fmtDate(compare.measured_at)}. Valores refletem a fonte de bioimpedância e o contexto de cada medição.`:'Só existe uma medição disponível para esta comparação.';
  }
  function groups(){
    const map=new Map();
    for(const e of state.exercises||[]){const key=norm(e.exercise);if(!key)continue;const g=map.get(key)||{key,label:e.exercise,rows:[]};g.rows.push(e);map.set(key,g)}
    return [...map.values()].sort((a,b)=>String(a.label).localeCompare(String(b.label),'pt-BR'));
  }
  function setLoadSummary(sets){
    const by={};for(const s of sets){const v=n(s.weight);if(v==null)continue;const u=String(s.weight_unit||'unidade não informada');(by[u]??=[]).push(v)}
    const units=Object.keys(by);if(!units.length)return {main:'—',small:'cargas não estruturadas'};
    if(units.length===1){const u=units[0],mx=Math.max(...by[u]);return {main:`${fmtNum(mx,1)} ${u}`,small:'maior carga registrada nesta unidade'}}
    return {main:`${units.length} unidades`,small:units.join(' · ')};
  }
  function renderExerciseExplorer(){
    const all=groups(),qq=norm(V12.exerciseQuery),filtered=all.filter(g=>!qq||norm(g.label).includes(qq));
    if(!filtered.length){q('v12ExerciseList').innerHTML='<div class="v12Empty">Nenhum exercício corresponde à busca.</div>';q('v12ExerciseDetail').innerHTML='<div class="v12Empty">Selecione outro termo.</div>';return}
    if(!V12.exerciseKey||!filtered.some(g=>g.key===V12.exerciseKey))V12.exerciseKey=filtered[0].key;
    q('v12ExerciseList').innerHTML=filtered.map(g=>`<button class="v12ExerciseButton ${g.key===V12.exerciseKey?'active':''}" data-v12-ex="${esc(g.key)}"><b>${esc(g.label)}</b><small>${g.rows.length} sessão(ões) estruturada(s)</small></button>`).join('');
    q('v12ExerciseList').querySelectorAll('[data-v12-ex]').forEach(b=>b.addEventListener('click',()=>{V12.exerciseKey=b.dataset.v12Ex;renderExerciseExplorer()}));
    const g=all.find(x=>x.key===V12.exerciseKey)||filtered[0];
    const rows=[...g.rows].sort((a,b)=>String(b.workout_date).localeCompare(String(a.workout_date)));
    const sets=(state.sets||[]).filter(s=>rows.some(r=>r.source_record_id===s.exercise_source_record_id));
    const load=setLoadSummary(sets),dates=unique(rows.map(r=>dkey(r.workout_date))).sort().reverse();
    const sessions=rows.map(r=>{const ss=(state.sets||[]).filter(s=>s.exercise_source_record_id===r.source_record_id).sort((a,b)=>(a.set_index||0)-(b.set_index||0));return `<div class="v12Session"><div class="v12SessionHead"><div><b>${fmtDate(r.workout_date)} · ${esc(r.exercise)}</b><small>${esc(r.muscle_group||'grupo não informado')}${r.machine?` · ${esc(r.machine)}`:''}</small></div><span class="sourceTag">${ss.length} séries</span></div><div class="v12SetRow">${ss.length?ss.map(s=>`<span class="v12SetTag">#${esc(s.set_index)} · ${s.weight!=null?`${fmtNum(s.weight,1)} ${esc(s.weight_unit||'')}`:'carga —'} · ${esc(s.reps_raw||s.reps_numeric||'reps —')}</span>`).join(''):'<span class="v12SetTag">detalhe de séries não disponível</span>'}</div></div>`}).join('');
    q('v12ExerciseDetail').innerHTML=`<div class="v12Head"><div><b>${esc(g.label)}</b><small>Histórico estruturado encontrado no banco canônico.</small></div></div><div class="v12ExerciseTop"><div class="v12MiniStat"><span>Sessões</span><strong>${dates.length}</strong></div><div class="v12MiniStat"><span>Séries</span><strong>${sets.length}</strong></div><div class="v12MiniStat"><span>Carga registrada</span><strong>${esc(load.main)}</strong></div></div><div class="v12Foot" style="margin-top:0;margin-bottom:8px">${esc(load.small)}. Comparações entre kg, lb por lado, índice de placa ou valores sem unidade não são misturadas.</div>${sessions||'<div class="v12Empty">Sem sessões detalhadas.</div>'}`;
  }
  function renderLabOptions(){
    const sel=q('v12LabDate');if(!sel)return;
    const dates=unique((state.labs||[]).map(x=>x.collection_date)).sort().reverse();
    const current=V12.labDate;
    sel.innerHTML='<option value="all">Todas as coletas</option>'+dates.map(d=>`<option value="${esc(d)}">${fmtDate(d)}</option>`).join('');
    sel.value=dates.includes(current)?current:'all';V12.labDate=sel.value;
  }
  function renderClinical(){
    const labs=state.labs||[],docs=state.docs||[];renderLabOptions();
    const dates=unique(labs.map(x=>x.collection_date)).sort().reverse();
    const groups=dates.map(date=>{const a=labs.filter(x=>x.collection_date===date);return {date,rows:a,lab:unique(a.map(x=>x.laboratory))[0]||'laboratório não informado'}});
    q('v12CollectionList').innerHTML=groups.length?groups.map(g=>`<div class="v12Collection"><b>${fmtDate(g.date)}</b><small>${g.rows.length} biomarcadores · ${esc(g.lab)}</small></div>`).join(''):'<div class="v12Empty">Sem coletas estruturadas.</div>';
    const qq=norm(V12.labQuery),filtered=labs.filter(x=>(V12.labDate==='all'||x.collection_date===V12.labDate)&&(!qq||norm(x.biomarker).includes(qq))).sort((a,b)=>String(b.collection_date).localeCompare(String(a.collection_date))||String(a.biomarker).localeCompare(String(b.biomarker),'pt-BR'));
    q('v12Biomarkers').innerHTML=filtered.length?filtered.map(x=>`<div class="v12BioRow"><div><b>${esc(x.biomarker)}</b><small>${fmtDate(x.collection_date)}${x.laboratory?` · ${esc(x.laboratory)}`:''}</small></div><div class="v12BioVal">${esc(x.result_raw||'—')}${x.reference_range?`<small>ref. ${esc(x.reference_range)}</small>`:''}</div>${x.flag?`<span class="v12Flag">${esc(x.flag)}</span>`:'<span></span>'}</div>`).join(''):'<div class="v12Empty">Nenhum biomarcador corresponde ao filtro.</div>';
    const status=docs.reduce((o,x)=>{const k=String(x.extraction_status||'inventário');o[k]=(o[k]||0)+1;return o},{});
    q('v12DocumentSummary').innerHTML=`<div class="v12Metric"><span>Documentos</span><strong>${docs.length}</strong><small>metadados preservados</small></div><div class="v12Metric"><span>Extraídos/validados</span><strong>${(status.extracted||0)+(status.validated||0)}</strong><small>status registrado na fonte</small></div><div class="v12Metric"><span>Revisão/pendente</span><strong>${(status.review_required||0)+(status.pending||0)}</strong><small>sem completar lacunas automaticamente</small></div>`;
  }
  function renderV12(){renderCoverage();renderBodyCompare();renderExerciseExplorer();renderClinical();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v12 · dedicated GitHub / Supabase · exercise + clinical explorer · provenance first'}
  install();
  const prior=loadAll;
  loadAll=async function(){await prior();renderV12()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(renderV12,1100)});
})();
