(function(){
  const V15={events:[],regimens:[]};
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const firstLastBody=()=>{const a=[...(state.body||[])].sort((x,y)=>String(x.measured_at).localeCompare(String(y.measured_at)));return{first:a[0],last:a.at(-1)}};
  const delta=(a,b,unit)=>{const x=n(a),y=n(b);if(x==null||y==null)return'—';const d=x-y;return`${d>0?'+':''}${fmtNum(d,1)} ${unit}`};
  const ensure=(id,parent,before=null)=>{let e=q(id);if(e)return e;e=document.createElement('div');e.id=id;if(before)parent.insertBefore(e,before);else parent.appendChild(e);return e};
  function install(){
    const insights=q('insights');const before=q('v11CrossDomain')||q('insightGrid');const analysis=ensure('v15Analysis',insights,before);analysis.className='v15Panel';
    const health=q('health');const beforeHealth=q('v13LabTrend')||q('v12Clinical')||health?.querySelector('.grid2');const treatments=ensure('v15Treatments',health,beforeHealth);treatments.className='v15Panel';
  }
  async function loadV15(){
    if(!currentSession?.user)return;
    try{
      const [events,regimens]=await Promise.all([
        sb.from('health_medication_events').select('event_date,medication,event_type,source,confidence').order('event_date',{ascending:false}).limit(80),
        sb.from('health_medication_regimens').select('medication,source,confidence').limit(40)
      ]);
      V15.events=events.data||[];V15.regimens=regimens.data||[];renderV15();
    }catch(e){console.error('LTS Health v15',e)}
  }
  function renderAnalysis(){
    const {first,last}=firstLastBody(),w=state.canonicalWorkouts||[],labs=state.labs||[];
    const now=new Date();now.setHours(12,0,0,0);const c=new Date(now);c.setDate(c.getDate()-90);const cut=c.toISOString().slice(0,10);const w90=w.filter(x=>String(x.workout_date||'')>=cut);
    const labDates=new Set(labs.map(x=>x.collection_date).filter(Boolean));
    const nutritionCount=state.mfp?.dailyCount||state.nutrition?.length||0;
    q('v15Analysis').innerHTML=`<div class="v15Head"><div><b>Resumo longitudinal</b><small>Leitura consolidada de mudanças registradas e cobertura das fontes, sem classificar aparência ou criar metas automáticas.</small></div></div><div class="v15AnalysisGrid"><div class="v15Metric"><span>Peso · primeiro → último</span><strong>${first&&last?delta(last.weight_kg,first.weight_kg,'kg'):'—'}</strong><small>${first&&last?`${fmtDate(first.measured_at)} → ${fmtDate(last.measured_at)}`:'série insuficiente'}</small></div><div class="v15Metric"><span>Massa muscular registrada</span><strong>${first&&last?delta(last.skeletal_muscle_mass_kg,first.skeletal_muscle_mass_kg,'kg'):'—'}</strong><small>diferença entre pontos registrados</small></div><div class="v15Metric"><span>Gordura registrada</span><strong>${first&&last?delta(last.fat_mass_kg,first.fat_mass_kg,'kg'):'—'}</strong><small>diferença entre pontos registrados</small></div><div class="v15Metric"><span>Treinos · 90 dias</span><strong>${w90.length}</strong><small>${w.length} sessões canônicas no histórico</small></div><div class="v15Metric"><span>Nutrição</span><strong>${Number(nutritionCount).toLocaleString('pt-BR')}</strong><small>dias provenientes de fonte real</small></div><div class="v15Metric"><span>Coletas laboratoriais</span><strong>${labDates.size}</strong><small>${labs.length} resultados estruturados</small></div><div class="v15Metric"><span>Composição corporal</span><strong>${(state.body||[]).length}</strong><small>medições estruturadas</small></div><div class="v15Metric"><span>Segmentar</span><strong>${(state.segmental||[]).length}</strong><small>datas com análise estruturada</small></div></div><div class="v15Context">Dado observado, cálculo e interpretação permanecem separados: os deltas acima são apenas diferenças aritméticas entre registros; não significam diagnóstico, prescrição ou avaliação estética.</div>`;
  }
  function renderTreatments(){
    const names=[...new Set(V15.regimens.map(x=>x.medication).filter(Boolean))];const events=V15.events.filter(x=>x.medication);
    q('v15Treatments').innerHTML=`<div class="v15Head"><div><b>Histórico de tratamentos registrados</b><small>Inventário neutro para contexto longitudinal. Esta tela não mostra doses, ciclos, frequências nem instruções de uso.</small></div><span class="v15Badge">${names.length} item(ns) no inventário</span></div><div class="v15TreatmentList">${events.length?events.slice(0,24).map(x=>`<div class="v15Treatment"><time>${fmtDate(x.event_date)}</time><div><b>${esc(x.medication)}</b><small>${esc(x.source||'fonte registrada')}</small></div><span class="v15Badge">histórico</span></div>`).join(''):'<div class="v13Empty">Nenhum evento de tratamento estruturado.</div>'}</div><div class="v15Foot">Registros históricos são mantidos para correlação temporal com exames e outros dados. Qualquer decisão sobre medicamento ou tratamento deve ser feita com profissional de saúde responsável.</div>`;
  }
  function renderV15(){renderAnalysis();renderTreatments();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v15 · longitudinal analysis + neutral treatment history · dedicated GitHub / Supabase · provenance first'}
  install();
  const prior=loadAll;
  loadAll=async function(){await prior();await loadV15()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(loadV15,1600)});
})();
