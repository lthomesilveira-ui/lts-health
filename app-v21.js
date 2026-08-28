(function(){
  const V21={nutrition:[],metrics:[],loading:false,loaded:false};
  const ensure=(id,parent,before=null)=>{let e=q(id);if(e)return e;e=document.createElement('div');e.id=id;if(before)parent.insertBefore(e,before);else parent.appendChild(e);return e};
  const day=v=>String(v||'').slice(0,10);
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const unique=a=>[...new Set(a.filter(Boolean))];
  const mean=a=>{const v=a.map(n).filter(x=>x!=null);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null};
  const daysBetween=(a,b)=>{const x=Date.parse(day(a)+'T12:00:00Z'),y=Date.parse(day(b)+'T12:00:00Z');return Number.isFinite(x)&&Number.isFinite(y)?Math.round((y-x)/86400000):null};
  function install(){
    document.body.classList.add('healthV21');
    const insights=q('insights');const panel=ensure('v21Evidence',insights,q('persistedInsights')||insights?.lastChild);panel.className='v21Panel';
  }
  async function fetchPaged(table,select,order,max=6000){const out=[];let from=0,size=900;while(from<max){let x=sb.from(table).select(select).order(order,{ascending:true}).range(from,Math.min(from+size-1,max-1));const r=await x;if(r.error)throw new Error(`${table}: ${r.error.message}`);out.push(...(r.data||[]));if(!r.data||r.data.length<size)break;from+=size}return out}
  async function loadEvidence(){
    if(V21.loading||!currentSession?.user)return;V21.loading=true;render();
    try{
      const [nutrition,metrics]=await Promise.all([
        fetchPaged('health_daily_nutrition','nutrition_date,calories_kcal,protein_g,source,confidence','nutrition_date',4000),
        fetchPaged('health_metrics','measured_at,metric_type,value,unit,source,confidence','measured_at',6000)
      ]);
      V21.nutrition=nutrition;V21.metrics=metrics;V21.loaded=true;
    }catch(e){console.error('v21 evidence load',e);V21.error=e?.message||String(e)}finally{V21.loading=false;render()}
  }
  function coverageLabel(count){if(count>=30)return{label:'ampla',cls:'good'};if(count>=10)return{label:'moderada',cls:'mid'};return{label:'limitada',cls:'low'}}
  function render(){
    const el=q('v21Evidence');if(!el)return;
    const workouts=state.canonicalWorkouts||[],body=state.body||[],labs=state.labs||[];
    if(V21.loading&&!V21.loaded){el.innerHTML='<div class="v21Head"><div><b>Laboratório de evidência cruzada</b><small>Carregando cobertura longitudinal completa…</small></div></div>';return}
    const nutrition=V21.nutrition.length?V21.nutrition:(state.nutrition||[]),metrics=V21.metrics.length?V21.metrics:(state.metrics||[]);
    const nutDays=new Set(nutrition.map(x=>day(x.nutrition_date)).filter(Boolean));
    const workoutDays=unique(workouts.map(x=>day(x.workout_date)));
    const workoutNut=workoutDays.filter(d=>nutDays.has(d));
    const nc=coverageLabel(workoutNut.length);

    const sleep=metrics.filter(x=>x.metric_type==='sleep_duration_h'&&n(x.value)!=null);
    const sleepByDay=new Map();sleep.forEach(x=>sleepByDay.set(day(x.measured_at),n(x.value)));
    const priorSleep=[];for(const d of workoutDays){const dt=new Date(d+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()-1);const v=sleepByDay.get(dt.toISOString().slice(0,10));if(v!=null)priorSleep.push(v)}
    const nonWorkoutSleep=sleep.filter(x=>!workoutDays.includes(day(x.measured_at))).map(x=>n(x.value)).filter(x=>x!=null);
    const sc=coverageLabel(priorSleep.length);

    const bodySorted=[...body].filter(x=>x.measured_at).sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at)));
    const bodyContext=bodySorted.map(x=>{const end=day(x.measured_at);const start=new Date(end+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-29);const s=start.toISOString().slice(0,10);return{date:end,workouts:workoutDays.filter(d=>d>=s&&d<=end).length}});
    const bc=coverageLabel(bodyContext.length);

    const types=['steps','active_energy_kcal','exercise_minutes','resting_heart_rate_bpm','sleep_duration_h'];
    const appleStats=types.map(t=>{const rows=metrics.filter(x=>x.metric_type===t);return{type:t,count:unique(rows.map(x=>day(x.measured_at))).length,last:[...rows].sort((a,b)=>String(b.measured_at).localeCompare(String(a.measured_at)))[0]?.measured_at||null}});
    const labels={steps:'Passos',active_energy_kcal:'Energia ativa',exercise_minutes:'Minutos de exercício',resting_heart_rate_bpm:'FC de repouso',sleep_duration_h:'Sono'};
    const nutDates=[...nutDays].sort(),metricDates=metrics.map(x=>day(x.measured_at)).filter(Boolean).sort();
    const labDates=unique(labs.map(x=>day(x.collection_date))).sort();
    const span=(a)=>a.length?`${fmtDate(a[0])} → ${fmtDate(a.at(-1))}`:'sem intervalo';
    const sleepDiff=priorSleep.length&&nonWorkoutSleep.length&&mean(priorSleep)!=null&&mean(nonWorkoutSleep)!=null?mean(priorSleep)-mean(nonWorkoutSleep):null;

    el.innerHTML=`<div class="v21Head"><div><b>Laboratório de evidência cruzada</b><small>Relações determinísticas entre domínios registrados. Cobertura descreve quantidade de observações, não certeza clínica; nenhuma associação é tratada como causal.</small></div><button id="v21Reload">Atualizar</button></div>
    ${V21.error?`<div class="v21Warn">Parte da cobertura completa não carregou: ${esc(V21.error)}. A tela usa apenas o conjunto já disponível.</div>`:''}
    <div class="v21Estate">
      <div><span>Nutrição estruturada</span><strong>${nutDays.size.toLocaleString('pt-BR')} dias</strong><small>${span(nutDates)}</small></div>
      <div><span>Métricas longitudinais</span><strong>${metrics.length.toLocaleString('pt-BR')} registros</strong><small>${span(metricDates)}</small></div>
      <div><span>Treinos canônicos</span><strong>${workouts.length}</strong><small>${span(workoutDays.slice().sort())}</small></div>
      <div><span>Coletas laboratoriais</span><strong>${labDates.length}</strong><small>${span(labDates)}</small></div>
    </div>
    <div class="v21InsightGrid">
      <article><div class="v21Title"><b>Treino × nutrição registrada</b><span class="${nc.cls}">cobertura ${nc.label}</span></div><strong>${workoutNut.length}/${workoutDays.length||0}</strong><p>dia(s) de treino têm registro nutricional no mesmo dia.</p><small>Incerteza: dias sem registro não significam ausência de alimentação; portanto esta leitura mede sobreposição de evidência, não aderência.</small></article>
      <article><div class="v21Title"><b>Sono anterior a treino</b><span class="${sc.cls}">cobertura ${sc.label}</span></div><strong>${priorSleep.length?fmtNum(mean(priorSleep),1)+' h':'—'}</strong><p>${priorSleep.length?'média registrada de sono no dia anterior a '+priorSleep.length+' treino(s).':'Ainda não há pares suficientes de sono + treino.'}</p><small>${sleepDiff==null?'Sem comparação observacional disponível.':`Diferença observada versus dias de sono sem treino no dia seguinte: ${sleepDiff>0?'+':''}${fmtNum(sleepDiff,1)} h. Não implica efeito ou causalidade.`}</small></article>
      <article><div class="v21Title"><b>Composição × contexto de treino</b><span class="${bc.cls}">cobertura ${bc.label}</span></div><strong>${bodyContext.length}</strong><p>medição(ões) corporal(is) com janela descritiva de 30 dias anteriores.</p><small>${bodyContext.length?`Na medição mais recente havia ${bodyContext.at(-1).workouts} treino(s) registrado(s) nos 30 dias anteriores.`:'Sem medições corporais suficientes.'} Isso contextualiza a série; não classifica o corpo nem atribui causa.</small></article>
    </div>
    <div class="v21Apple"><div><b>Cobertura de atividade / sono suportada</b><small>Somente métricas não sobrepostas aceitas pelo pipeline conservador.</small></div><div class="v21MetricGrid">${appleStats.map(x=>`<div><span>${labels[x.type]}</span><strong>${x.count}</strong><small>${x.last?'último '+fmtDate(x.last):'sem dado'}</small></div>`).join('')}</div></div>`;
    q('v21Reload')?.addEventListener('click',()=>{V21.loaded=false;V21.error=null;loadEvidence()});
  }
  function renderV21(){render();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v21 · deterministic cross-domain evidence lab · dedicated GitHub / Supabase · provenance first'}
  install();
  const prior=loadAll;
  loadAll=async function(){await prior();renderV21();await loadEvidence()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(async()=>{renderV21();await loadEvidence()},3100)});
})();
