(function(){
  const V26={days:90,nutrition:[],metrics:[],loading:false,error:null};
  const ensure=(id,parent,before=null)=>{let e=q(id);if(e)return e;e=document.createElement('div');e.id=id;if(before)parent.insertBefore(e,before);else parent.appendChild(e);return e};
  const day=v=>String(v||'').slice(0,10);
  const num=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const avg=(rows,key)=>{const a=rows.map(x=>num(x[key])).filter(x=>x!=null);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null};
  const cutoff=()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-V26.days+1);return d.toISOString().slice(0,10)};
  const unique=a=>[...new Set(a.filter(Boolean))];
  function install(){
    document.body.classList.add('healthV26');
    const insights=q('insights');const before=q('v21Evidence')||q('persistedInsights')||insights?.lastChild;
    const p=ensure('v26Report',insights,before);p.className='v26Panel';
    p.innerHTML=`<div class="v26Head"><div><b>Relatório do período</b><small>Resumo determinístico do que foi registrado. Médias descrevem a fonte disponível e não são metas de alimentação, treino ou corpo.</small></div><div class="v26Controls"><select id="v26Days"><option value="30">30 dias</option><option value="90" selected>90 dias</option><option value="365">1 ano</option></select><button id="v26Reload">Atualizar</button><button id="v26Copy">Copiar resumo</button></div></div><div id="v26Body"></div>`;
    q('v26Days').onchange=e=>{V26.days=Number(e.target.value);load()};q('v26Reload').onclick=load;q('v26Copy').onclick=copySummary;
  }
  async function load(){
    if(V26.loading||!currentSession?.user)return;V26.loading=true;V26.error=null;render();const c=cutoff();
    try{
      const [nut,met]=await Promise.all([
        sb.from('health_daily_nutrition').select('nutrition_date,calories_kcal,protein_g,carbs_g,fat_g,water_ml,source').gte('nutrition_date',c).order('nutrition_date',{ascending:true}).limit(1200),
        sb.from('health_metrics').select('measured_at,metric_type,value,unit,source').gte('measured_at',c).order('measured_at',{ascending:true}).limit(7000)
      ]);if(nut.error)throw nut.error;if(met.error)throw met.error;V26.nutrition=nut.data||[];V26.metrics=met.data||[];
    }catch(e){V26.error=e?.message||String(e);console.error('v26 report',e)}finally{V26.loading=false;render()}
  }
  function snapshot(){
    const c=cutoff(),workouts=(state.canonicalWorkouts||[]).filter(x=>day(x.workout_date)>=c),body=[...(state.body||[])].filter(x=>day(x.measured_at)>=c).sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at))),labs=(state.labs||[]).filter(x=>day(x.collection_date)>=c),nut=V26.nutrition,metrics=V26.metrics;
    const sleep=metrics.filter(x=>x.metric_type==='sleep_duration_h'&&num(x.value)!=null),steps=metrics.filter(x=>x.metric_type==='steps'&&num(x.value)!=null),active=metrics.filter(x=>x.metric_type==='active_energy_kcal'&&num(x.value)!=null),exercise=metrics.filter(x=>x.metric_type==='exercise_minutes'&&num(x.value)!=null);
    const nutDays=unique(nut.map(x=>day(x.nutrition_date))),sleepDays=unique(sleep.map(x=>day(x.measured_at))),stepDays=unique(steps.map(x=>day(x.measured_at))),labDates=unique(labs.map(x=>day(x.collection_date)));
    const first=body[0],last=body.at(-1),delta=(key,unit)=>{const a=num(first?.[key]),b=num(last?.[key]);if(a==null||b==null||first===last)return'—';const d=b-a;return`${d>0?'+':''}${fmtNum(d,1)} ${unit}`};
    return{c,workouts,body,labs,nut,metrics,sleep,steps,active,exercise,nutDays,sleepDays,stepDays,labDates,first,last,delta};
  }
  function coverage(days){const pct=Math.round(days/V26.days*100);return`${days}/${V26.days} dias (${pct}%)`}
  function render(){
    const el=q('v26Body');if(!el)return;if(V26.loading){el.innerHTML='<div class="v26Loading">Carregando dados observados do período…</div>';return}const s=snapshot();
    const workoutDur=avg(s.workouts,'duration_minutes'),cal=avg(s.nut,'calories_kcal'),protein=avg(s.nut,'protein_g'),sleepAvg=avg(s.sleep,'value'),stepsAvg=avg(s.steps,'value'),activeAvg=avg(s.active,'value'),exerciseAvg=avg(s.exercise,'value');
    el.innerHTML=`${V26.error?`<div class="v26Warn">Parte dos dados não carregou: ${esc(V26.error)}. O relatório abaixo usa apenas o que está disponível.</div>`:''}<div class="v26Period"><span>${fmtDate(s.c)} → hoje</span><strong>${V26.days} dias</strong></div><div class="v26Grid">
      <article><span>Treino registrado</span><strong>${s.workouts.length} sessões</strong><small>${unique(s.workouts.map(x=>day(x.workout_date))).length} dias com sessão${workoutDur!=null?` · duração média registrada ${fmtNum(workoutDur,0)} min`:''}</small></article>
      <article><span>Nutrição registrada</span><strong>${coverage(s.nutDays.length)}</strong><small>${cal!=null?`energia média nos dias registrados ${fmtNum(cal,0)} kcal`:''}${protein!=null?`${cal!=null?' · ':''}proteína média registrada ${fmtNum(protein,0)} g`:''}${cal==null&&protein==null?'valores quantitativos não disponíveis':''}</small></article>
      <article><span>Sono</span><strong>${coverage(s.sleepDays.length)}</strong><small>${sleepAvg!=null?`duração média registrada ${fmtNum(sleepAvg,1)} h`:'sem duração de sono suportada'}</small></article>
      <article><span>Passos</span><strong>${coverage(s.stepDays.length)}</strong><small>${stepsAvg!=null?`média nos dias disponíveis ${fmtNum(stepsAvg,0)}`:'sem série diária consolidada'}</small></article>
      <article><span>Atividade</span><strong>${s.active.length||s.exercise.length?'dados disponíveis':'sem série contínua'}</strong><small>${activeAvg!=null?`energia ativa média registrada ${fmtNum(activeAvg,0)} kcal`:''}${exerciseAvg!=null?`${activeAvg!=null?' · ':''}exercício médio registrado ${fmtNum(exerciseAvg,0)} min`:''}</small></article>
      <article><span>Composição corporal</span><strong>${s.body.length} medição(ões)</strong><small>${s.body.length>1?`peso: ${s.delta('weight_kg','kg')} · massa muscular: ${s.delta('skeletal_muscle_mass_kg','kg')} · gordura: ${s.delta('fat_mass_kg','kg')}`:'sem duas medições no período para delta'}</small></article>
      <article><span>Laboratório</span><strong>${s.labDates.length} coleta(s)</strong><small>${s.labs.length} resultado(s) estruturado(s) no período</small></article>
      <article><span>Cobertura multidomínio</span><strong>${[s.workouts.length,s.nutDays.length,s.sleepDays.length,s.body.length,s.labDates.length].filter(Boolean).length}/5 domínios</strong><small>presença de evidência; não é score de saúde ou prontidão</small></article>
    </div><div class="v26Foot">O relatório não interpreta ausência de registro como comportamento real. Por exemplo, um dia sem MyFitnessPal é tratado como dia sem evidência nutricional, nunca como ingestão zero.</div>`;
  }
  function textSummary(){const s=snapshot();return[`LTS Health · relatório descritivo de ${V26.days} dias`,`Período: ${fmtDate(s.c)} → hoje`,`Treinos registrados: ${s.workouts.length} sessões`,`Nutrição com registro: ${s.nutDays.length}/${V26.days} dias`,`Sono com registro: ${s.sleepDays.length}/${V26.days} dias`,`Passos com registro: ${s.stepDays.length}/${V26.days} dias`,`Composição corporal: ${s.body.length} medição(ões)`,`Coletas laboratoriais: ${s.labDates.length}`,`Observação: ausência de registro significa ausência de evidência, não valor zero.`].join('\n')}
  async function copySummary(){const b=q('v26Copy');try{await navigator.clipboard.writeText(textSummary());if(b){b.textContent='Copiado';setTimeout(()=>b.textContent='Copiar resumo',1400)}}catch{if(b)b.textContent='Cópia indisponível'}}
  function renderV26(){render();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v26 · deterministic period report · dedicated GitHub / Supabase · provenance first'}
  install();const prior=loadAll;loadAll=async function(){await prior();renderV26();await load()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(load,4300)});
})();
