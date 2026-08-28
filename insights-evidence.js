(function(){
  'use strict';
  const E={nutrition:[],metrics:[],loading:false,loaded:false,error:null};
  const day=v=>String(v||'').slice(0,10);
  const num=v=>{if(v==null||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
  const safe=v=>esc(v??'');
  const median=a=>{const v=a.map(num).filter(x=>x!=null).sort((a,b)=>a-b);if(!v.length)return null;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2};
  const mean=a=>{const v=a.map(num).filter(x=>x!=null);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null};
  const unique=a=>[...new Set(a.filter(Boolean))];
  const addDays=(date,n)=>{const d=new Date(day(date)+'T12:00:00');if(!Number.isFinite(d.getTime()))return'';d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
  const priorDays=(date,n)=>{const end=day(date),start=addDays(end,-n);return{start,end}};
  const fmt=(v,d=1,suffix='')=>num(v)==null?'—':`${fmtNum(num(v),d)}${suffix}`;
  const ratio=(a,b)=>b?`${a}/${b}`:'0/0';
  const coverage=(a,b)=>b?Math.round(a/b*100):0;
  const badge=(label,cls='')=>`<span class="epBadge ${cls}">${safe(label)}</span>`;
  const empty=msg=>`<div class="epEmpty">${safe(msg)}</div>`;

  async function fetchPaged(table,select,order,max=6000){
    const out=[];let from=0,size=900;
    while(from<max){let qy=sb.from(table).select(select);if(order)qy=qy.order(order,{ascending:true});const r=await qy.range(from,Math.min(from+size-1,max-1));if(r.error)throw r.error;out.push(...(r.data||[]));if(!r.data||r.data.length<size)break;from+=size}
    return out;
  }
  async function loadEvidence(){
    if(E.loading||!currentSession?.user)return;
    E.loading=true;E.error=null;
    try{
      const [nutrition,metrics]=await Promise.all([
        fetchPaged('health_daily_nutrition','nutrition_date,calories_kcal,protein_g,carbs_g,fat_g,water_ml,source,confidence','nutrition_date'),
        fetchPaged('health_metrics','measured_at,metric_type,value,unit,source,confidence','measured_at')
      ]);
      E.nutrition=nutrition;E.metrics=metrics;E.loaded=true;
    }catch(err){E.error=err?.message||String(err);console.error('LTS Health evidence product',err)}finally{E.loading=false;renderAll()}
  }
  function workouts(){return [...(state.canonicalWorkouts||[])].filter(w=>w?.workout_date).sort((a,b)=>String(a.workout_date).localeCompare(String(b.workout_date)))}
  function workoutDays(){return new Set(workouts().map(w=>day(w.workout_date)))}
  function nutritionByDay(){const m=new Map();for(const r of E.nutrition||[]){const d=day(r.nutrition_date);if(d)m.set(d,r)}return m}
  function metricByDay(type){const m=new Map();for(const r of (E.metrics||[]).filter(x=>x.metric_type===type)){const d=day(r.measured_at);const v=num(r.value);if(!d||v==null)continue;if(!m.has(d))m.set(d,[]);m.get(d).push(v)}return new Map([...m].map(([d,v])=>[d,mean(v)]))}
  function sleepPairs(){
    const sleep=metricByDay('sleep_duration_h'),ws=workouts(),pairs=[];
    for(const w of ws){const wd=day(w.workout_date),pd=addDays(wd,-1);if(sleep.has(pd))pairs.push({workoutDate:wd,sleepDate:pd,value:sleep.get(pd)})}
    return{pairs,total:ws.length};
  }
  function nutritionSplit(){
    const wb=workoutDays(),rows=E.nutrition.filter(r=>day(r.nutrition_date));
    const train=rows.filter(r=>wb.has(day(r.nutrition_date))),other=rows.filter(r=>!wb.has(day(r.nutrition_date)));
    return{rows,train,other};
  }
  function bodyContexts(){
    const ws=workouts(),body=[...(state.body||[])].filter(x=>x.measured_at).sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at)));
    return body.map(x=>{const d=day(x.measured_at),{start,end}=priorDays(d,30),count=ws.filter(w=>day(w.workout_date)>start&&day(w.workout_date)<=end).length;return{date:d,count,weight:num(x.weight_kg),muscle:num(x.skeletal_muscle_mass_kg),fat:num(x.body_fat_pct),source:x.source||''}});
  }
  function labContexts(){
    const groups=new Map(),ws=workouts(),nut=nutritionByDay();
    for(const r of state.labs||[]){const d=day(r.collection_date);if(!d)continue;groups.set(d,(groups.get(d)||0)+1)}
    return [...groups].map(([d,n])=>{const {start,end}=priorDays(d,30),wd=ws.filter(w=>day(w.workout_date)>start&&day(w.workout_date)<=end).length,nd=[...nut.keys()].filter(x=>x>start&&x<=end).length;return{date:d,results:n,workouts:wd,nutritionDays:nd}}).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  }
  function comparisonCard(){
    const s=nutritionSplit(),trainCal=median(s.train.map(x=>x.calories_kcal)),otherCal=median(s.other.map(x=>x.calories_kcal)),trainPro=median(s.train.map(x=>x.protein_g)),otherPro=median(s.other.map(x=>x.protein_g)),enough=s.train.length>=3&&s.other.length>=3;
    return `<section class="epPanel"><div class="epHead"><div><b>Nutrição × dias com treino</b><small>Comparação descritiva entre dias realmente registrados.</small></div>${badge(`${s.train.length} + ${s.other.length} dias`,'neutral')}</div>${s.rows.length?`<div class="epCompare"><div><span>Dias com treino</span><strong>${s.train.length}</strong><small>mediana energia ${fmt(trainCal,0,' kcal')} · proteína ${fmt(trainPro,0,' g')}</small></div><i>vs</i><div><span>Outros dias registrados</span><strong>${s.other.length}</strong><small>mediana energia ${fmt(otherCal,0,' kcal')} · proteína ${fmt(otherPro,0,' g')}</small></div></div>${enough?`<div class="epNote">Há cobertura mínima dos dois grupos para uma comparação descritiva. A diferença observada não demonstra causalidade e não cria meta alimentar.</div>`:`<div class="epHold"><b>Leitura comparativa retida.</b><span>São necessários pelo menos 3 dias registrados em cada grupo para destacar diferenças; os valores disponíveis continuam preservados.</span></div>`}`:empty('Sem histórico nutricional suficiente para cruzamento.')}</section>`
  }
  function sleepCard(){
    const s=sleepPairs(),vals=s.pairs.map(x=>x.value),cov=coverage(s.pairs.length,s.total);
    return `<section class="epPanel"><div class="epHead"><div><b>Sono anterior × treino</b><small>Associação por data: sono registrado no dia anterior a uma sessão.</small></div>${badge(`${cov}% cobertura`,cov>=70?'ok':cov?'review':'neutral')}</div>${s.pairs.length?`<div class="epMetricRow"><div><span>Sessões com sono anterior</span><strong>${ratio(s.pairs.length,s.total)}</strong></div><div><span>Mediana do sono pareado</span><strong>${fmt(median(vals),1,' h')}</strong></div><div><span>Média do sono pareado</span><strong>${fmt(mean(vals),1,' h')}</strong></div></div><div class="epMiniList">${s.pairs.slice(-6).reverse().map(x=>`<div><time>${fmtDate(x.workoutDate)}</time><b>${fmt(x.value,1,' h')}</b><small>sono de ${fmtDate(x.sleepDate)}</small></div>`).join('')}</div><div class="epNote">Cobertura indica disponibilidade de evidência, não qualidade de recuperação. Nenhum readiness/recovery score é calculado.</div>`:empty('Ainda não há sono validado suficiente para parear com sessões de treino.')}</section>`
  }
  function bodyCard(){
    const rows=bodyContexts(),last=rows.at(-1),prev=rows.at(-2);
    const delta=(a,b,unit)=>a!=null&&b!=null?`${a-b>0?'+':''}${fmtNum(a-b,1)}${unit}`:'—';
    return `<section class="epPanel"><div class="epHead"><div><b>Composição × contexto de treino</b><small>Treinos observados nos 30 dias anteriores a cada medição.</small></div>${badge(`${rows.length} medições`,'neutral')}</div>${last?`<div class="epBodyContext"><div><span>Última medição</span><strong>${fmtDate(last.date)}</strong><small>${last.source?safe(last.source):'fonte preservada'}</small></div><div><span>Treinos · 30 dias antes</span><strong>${last.count}</strong><small>sessões canônicas</small></div><div><span>Δ peso vs anterior</span><strong>${prev?delta(last.weight,prev.weight,' kg'):'—'}</strong><small>diferença registrada</small></div><div><span>Δ massa muscular</span><strong>${prev?delta(last.muscle,prev.muscle,' kg'):'—'}</strong><small>diferença registrada</small></div></div><div class="epNote">O contexto temporal não atribui a mudança corporal ao treino. Sono, nutrição, intervalo entre medições, método e outros fatores podem coexistir.</div>`:empty('Sem composição corporal estruturada para contextualização.')}</section>`
  }
  function labCard(){
    const rows=labContexts(),last=rows[0];
    return `<section class="epPanel"><div class="epHead"><div><b>Coletas × cobertura anterior</b><small>Contexto de 30 dias antes da coleta, sem interpretação clínica automática.</small></div>${badge(`${rows.length} coleta(s)`,'neutral')}</div>${last?`<div class="epMetricRow"><div><span>Última coleta</span><strong>${fmtDate(last.date)}</strong><small>${last.results} resultado(s)</small></div><div><span>Treinos anteriores</span><strong>${last.workouts}</strong><small>30 dias</small></div><div><span>Dias de nutrição</span><strong>${last.nutritionDays}</strong><small>30 dias com registro</small></div></div><div class="epNote">Esse painel organiza evidência temporal. Não interpreta biomarcadores, não substitui faixas de referência e não pressupõe efeito de treino ou alimentação sobre exames.</div>`:empty('Sem coleta laboratorial estruturada.')}</section>`
  }
  function matrix(){
    const ws=workouts(),nut=E.nutrition,sleep=metricByDay('sleep_duration_h'),body=state.body||[],labs=state.labs||[];
    const rows=[
      ['Treino',ws.length,ws.length?day(ws.at(-1).workout_date):null,'Sessões canônicas'],
      ['Nutrição',unique(nut.map(x=>day(x.nutrition_date))).length,nut.length?day(nut.at(-1).nutrition_date):null,'Dias registrados'],
      ['Sono',sleep.size,sleep.size?[...sleep.keys()].sort().at(-1):null,'Dias validados'],
      ['Composição',body.length,body.length?day([...body].sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at))).at(-1).measured_at):null,'Medições'],
      ['Laboratório',unique(labs.map(x=>day(x.collection_date))).length,labs.length?day([...labs].sort((a,b)=>String(a.collection_date).localeCompare(String(b.collection_date))).at(-1).collection_date):null,'Coletas']
    ];
    return `<div class="epMatrix">${rows.map(([label,count,last,unit])=>`<div><span>${safe(label)}</span><strong>${count}</strong><small>${safe(unit)}${last?` · último ${fmtDate(last)}`:''}</small></div>`).join('')}</div>`
  }
  function renderInsights(){
    const root=q('productInsights');if(!root)return;
    if(E.loading&&!E.loaded){root.innerHTML='<div class="epLoading">Carregando evidência cruzada…</div>';return}
    root.innerHTML=`<div class="epTitle"><div><div class="epKicker">EVIDÊNCIA CRUZADA · DETERMINÍSTICA</div><h1>Insights</h1><p>Os cruzamentos abaixo usam somente registros observados e datas compatíveis. Cobertura insuficiente é mostrada como incerteza, não preenchida por estimativa.</p></div>${badge('sem score de readiness','neutral')}</div>${E.error?`<div class="epError">Parte da evidência não pôde ser carregada: ${safe(E.error)}</div>`:''}${matrix()}<div class="epGrid">${comparisonCard()}${sleepCard()}${bodyCard()}${labCard()}</div><div class="epGuard"><b>Como ler estes painéis</b><span>Associação temporal não é causalidade. Diferenças de nutrição, sono, treino, composição e exames são descritivas; o app não cria metas restritivas, julgamento corporal, diagnóstico ou score de recuperação.</span></div>`;
  }
  function renderTodayPulse(){
    const root=q('productToday');if(!root||q('epTodayPulse'))return;
    const sleep=sleepPairs(),nut=nutritionSplit(),body=bodyContexts(),latestBody=body.at(-1),cov=coverage(sleep.pairs.length,sleep.total);
    const el=document.createElement('section');el.id='epTodayPulse';el.className='epTodayPulse';
    el.innerHTML=`<div><span>Evidência cruzada</span><b>${sleep.total?`${cov}% dos treinos com sono anterior`:'sono pareado pendente'}</b><small>${nut.rows.length?`${nut.train.length} dia(s) de nutrição coincidem com treino`:'nutrição sem cobertura suficiente'}${latestBody?` · ${latestBody.count} treino(s) nos 30 dias antes da última composição`:''}</small></div><button type="button">Abrir insights</button>`;
    el.querySelector('button').onclick=()=>activateTab('insights');
    const anchor=root.querySelector('.tdMetrics')||root.children[0];if(anchor?.parentElement)anchor.insertAdjacentElement('afterend',el);else root.appendChild(el);
  }
  function renderAll(){renderInsights();renderTodayPulse()}
  const prior=loadAll;
  loadAll=async function(){const out=await prior();renderAll();if(!E.loaded&&!E.loading)loadEvidence();return out};
  sb.auth.getSession().then(({data})=>{if(data?.session){setTimeout(()=>{renderAll();loadEvidence()},2450)}});
})();
