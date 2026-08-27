(function(){
  const V11={days:30,timelineDomain:'all',bodyMetric:'weight_kg',trainingQuery:'',nutrition:[],meals:[],activity:[]};
  const dayKey=v=>String(v||'').slice(0,10);
  const cutoff=days=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-days);return d.toISOString().slice(0,10)};
  const inDays=(v,days)=>days==='all'||(dayKey(v)&&dayKey(v)>=cutoff(Number(days)));
  const numv=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const sum=(a,f)=>a.reduce((t,x)=>t+(numv(f(x))||0),0);
  const avg=(a,f)=>{const x=a.map(f).map(numv).filter(v=>v!=null);return x.length?x.reduce((p,c)=>p+c,0)/x.length:null};
  const uniq=a=>[...new Set(a.filter(Boolean))];
  const pct=(n,d)=>d?Math.round(n/d*100):0;
  const ensure=(id,parent,tag='div',before=null)=>{let e=q(id);if(e)return e;e=document.createElement(tag);e.id=id;if(before)parent.insertBefore(e,before);else parent.appendChild(e);return e};
  const metricMeta={weight_kg:['Peso','kg'],skeletal_muscle_mass_kg:['Massa muscular registrada','kg'],body_fat_pct:['Gordura corporal registrada','%']};
  function fmt(v,d=0){return v==null?'—':Number(v).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d})}
  function lineSvg(rows,key,dateKey){
    const pts=rows.map(x=>({d:dayKey(x[dateKey]),v:numv(x[key])})).filter(x=>x.d&&x.v!=null).sort((a,b)=>a.d.localeCompare(b.d));
    if(pts.length<2)return '<div class="v11Empty">Poucos pontos para desenhar tendência.</div>';
    const min=Math.min(...pts.map(x=>x.v)),max=Math.max(...pts.map(x=>x.v)),span=max-min||1,w=720,h=170,pad=18;
    const xy=pts.map((p,i)=>({x:pad+i*(w-pad*2)/(pts.length-1),y:pad+(max-p.v)*(h-pad*2)/span,...p}));
    const path=xy.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
    const dots=xy.filter((_,i)=>i===0||i===xy.length-1||i%Math.max(1,Math.floor(xy.length/12))===0).map(p=>`<circle cx="${p.x}" cy="${p.y}" r="2.6"><title>${p.d}: ${p.v}</title></circle>`).join('');
    return `<svg class="v11Chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Tendência histórica"><path class="v11Grid" d="M${pad} ${h/2} H${w-pad}"/><path class="v11Line" d="${path}"/>${dots}</svg><div class="v11Axis"><span>${fmtDate(pts[0].d)}</span><span>${fmt(min,1)}–${fmt(max,1)}</span><span>${fmtDate(pts.at(-1).d)}</span></div>`;
  }
  function barSvg(rows,key,dateKey){
    const pts=rows.map(x=>({d:dayKey(x[dateKey]),v:numv(x[key])})).filter(x=>x.d&&x.v!=null).sort((a,b)=>a.d.localeCompare(b.d));
    if(!pts.length)return '<div class="v11Empty">Sem valores registrados neste período.</div>';
    const sample=pts.length>90?pts.filter((_,i)=>i%Math.ceil(pts.length/90)===0):pts,max=Math.max(...sample.map(x=>x.v),1);
    return `<div class="v11Bars">${sample.map(p=>`<i style="height:${Math.max(3,p.v/max*100)}%"><span>${fmt(p.v,0)}</span></i>`).join('')}</div><div class="v11Axis"><span>${fmtDate(sample[0].d)}</span><span>${sample.length} dias exibidos</span><span>${fmtDate(sample.at(-1).d)}</span></div>`;
  }
  function install(){
    document.body.classList.add('healthV11');
    const today=q('today');
    const hero=today?.querySelector('.hero');
    const pulse=ensure('todayPulse',today);pulse.className='v11Pulse section';if(hero?.nextSibling!==pulse)today.insertBefore(pulse,hero?.nextSibling||null);

    const timeline=q('timeline');const tlList=q('timelineList');
    const tl=ensure('timelineLens',timeline,'div',tlList);tl.className='v11Toolbar';
    tl.innerHTML=`<div><b>Explorar timeline</b><small>Filtre sem alterar o histórico canônico.</small></div><div class="v11Controls"><select id="v11TimelineDomain"><option value="all">Todos</option><option value="Treino">Treino</option><option value="Composição">Composição</option><option value="Exames">Exames</option><option value="Nutrição">Nutrição</option><option value="Métrica">Atividade/sono</option><option value="Documento">Documentos</option></select><select id="v11TimelineDays"><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="all">Todo histórico</option></select></div>`;

    const evo=q('evolution');const evoGrid=evo?.querySelector('.grid3');
    const evoLens=ensure('evolutionLens',evo,'div',evoGrid);evoLens.className='v11Panel';
    evoLens.innerHTML=`<div class="v11PanelHead"><div><b>Tendência longitudinal</b><small>Visualização descritiva da série registrada.</small></div><select id="v11BodyMetric"><option value="weight_kg">Peso</option><option value="skeletal_muscle_mass_kg">Massa muscular registrada</option><option value="body_fat_pct">Gordura corporal registrada</option></select></div><div id="v11BodyChart"></div>`;

    const train=q('training');const trainGrid=train?.querySelector('.grid2');
    const tr=ensure('trainingLens',train,'div',trainGrid);tr.className='v11Panel';
    tr.innerHTML=`<div class="v11PanelHead"><div><b>Leitura de consistência</b><small>Frequência e volume de sessões; não é uma meta de treino.</small></div><div class="v11Controls"><select id="v11TrainingDays"><option value="28">28 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="all">Todos</option></select><input id="v11TrainingQuery" type="search" placeholder="Filtrar sessão ou local"></div></div><div id="v11TrainingStats" class="v11StatGrid"></div>`;

    const nutrition=q('nutrition');const first=nutrition?.querySelector('.card');
    const nu=ensure('nutritionLens',nutrition,'div',first);nu.className='v11Panel';
    nu.innerHTML=`<div class="v11PanelHead"><div><b>Leitura nutricional</b><small>Somente dias registrados no MyFitnessPal; dias ausentes não entram na média.</small></div><select id="v11NutritionDays"><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="all">Todo histórico</option></select></div><div id="v11NutritionStats" class="v11StatGrid"></div><div class="v11ChartCard"><div class="v11ChartTitle">Calorias registradas por dia</div><div id="v11NutritionChart"></div></div><div id="v11MealMix" class="v11Split"></div>`;

    const insights=q('insights');const ig=q('insightGrid');
    const cross=ensure('v11CrossDomain',insights,'div',ig);cross.className='v11Panel';

    q('v11TimelineDomain')?.addEventListener('change',e=>{V11.timelineDomain=e.target.value;renderTimelineLens()});
    q('v11TimelineDays')?.addEventListener('change',e=>{V11.days=e.target.value;renderTimelineLens()});
    q('v11BodyMetric')?.addEventListener('change',e=>{V11.bodyMetric=e.target.value;renderBodyLens()});
    q('v11TrainingDays')?.addEventListener('change',renderTrainingLens);
    q('v11TrainingQuery')?.addEventListener('input',renderTrainingLens);
    q('v11NutritionDays')?.addEventListener('change',renderNutritionLens);
  }
  async function fetchPaged(table,select,orderCol,ascending=true,max=5000){
    const out=[];let from=0;const size=900;
    while(from<max){let x=sb.from(table).select(select).order(orderCol,{ascending}).range(from,Math.min(from+size-1,max-1));const r=await x;if(r.error)throw r.error;out.push(...(r.data||[]));if(!r.data||r.data.length<size)break;from+=size}return out;
  }
  async function loadV11(){
    if(!currentSession?.user)return;
    try{
      const [nutrition,meals,activity]=await Promise.all([
        fetchPaged('health_daily_nutrition','nutrition_date,calories_kcal,protein_g,carbs_g,fat_g,fiber_g,water_ml,source','nutrition_date',true,5000),
        fetchPaged('health_nutrition_meals','meal_date,meal_name,calories_kcal,protein_g,carbs_g,fat_g,source','meal_date',false,5000),
        fetchPaged('health_activity_records','activity_date,activity_name,activity_type,duration_minutes,calories_kcal,source','activity_date',false,5000)
      ]);
      V11.nutrition=nutrition;V11.meals=meals;V11.activity=activity;renderV11();
    }catch(e){console.error('LTS Health v11 analytics',e);const p=q('todayPulse');if(p)p.innerHTML='<div class="v11Callout warn"><b>Analytics adicionais indisponíveis</b><span>O histórico principal continua carregado; esta camada não substitui os dados canônicos.</span></div>'}
  }
  function renderV11(){renderTodayPulse();renderBodyLens();renderTrainingLens();renderNutritionLens();renderTimelineLens();renderCrossDomain();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v11 · dedicated GitHub / Supabase · longitudinal lenses · provenance first'}
  function renderTodayPulse(){
    const w=(state.canonicalWorkouts||[]),b=state.body||[],n=V11.nutrition,m=state.metrics||[];
    const lastW=w[0],lastB=b[0],lastN=[...n].sort((a,b)=>dayKey(b.nutrition_date).localeCompare(dayKey(a.nutrition_date)))[0],sleep=m.filter(x=>x.metric_type==='sleep_duration_h').sort((a,b)=>String(b.measured_at).localeCompare(String(a.measured_at)))[0];
    const w28=w.filter(x=>inDays(x.workout_date,28)),n30=n.filter(x=>inDays(x.nutrition_date,30));
    q('todayPulse').innerHTML=`<div class="v11PulseHead"><div><span class="v11Kicker">Visão atual</span><b>Seu histórico em contexto</b></div><span class="v11Meta">atualizado a partir das fontes conectadas</span></div><div class="v11StatGrid four"><div class="v11Stat"><span>Último treino</span><strong>${lastW?fmtDate(lastW.workout_date):'—'}</strong><small>${lastW?esc(lastW.workout_type):'sem sessão registrada'}</small></div><div class="v11Stat"><span>Treinos · 28 dias</span><strong>${w28.length}</strong><small>${w28.length?`${uniq(w28.flatMap(x=>x.muscle_groups||[])).length} grupos registrados`:'sem sessões no período'}</small></div><div class="v11Stat"><span>Nutrição · 30 dias</span><strong>${n30.length}</strong><small>${lastN?`último dia ${fmtDate(lastN.nutrition_date)}`:'sem registro recente'}</small></div><div class="v11Stat"><span>Último sono</span><strong>${sleep?`${fmt(numv(sleep.value),1)} h`:'—'}</strong><small>${sleep?fmtDate(sleep.measured_at):'Apple Health ainda pendente'}</small></div></div>${lastB?`<div class="v11Context"><b>Última composição corporal registrada · ${fmtDate(lastB.measured_at)}</b><span>${lastB.weight_kg!=null?`Peso ${fmt(lastB.weight_kg,1)} kg`:''}${lastB.skeletal_muscle_mass_kg!=null?` · massa muscular ${fmt(lastB.skeletal_muscle_mass_kg,1)} kg`:''}${lastB.body_fat_pct!=null?` · gordura corporal ${fmt(lastB.body_fat_pct,1)}%`:''}</span></div>`:''}`;
  }
  function renderBodyLens(){const b=state.body||[],meta=metricMeta[V11.bodyMetric],usable=b.filter(x=>numv(x[V11.bodyMetric])!=null);q('v11BodyChart').innerHTML=usable.length?`<div class="v11ChartTitle">${meta[0]} · ${usable.length} medições</div>${lineSvg(usable,V11.bodyMetric,'measured_at')}<div class="v11Footnote">Escala ajustada à série disponível; comparação é descritiva e não classifica aparência corporal.</div>`:'<div class="v11Empty">Esta métrica não está disponível na série.</div>'}
  function renderTrainingLens(){
    const days=q('v11TrainingDays')?.value||'28',query=norm(q('v11TrainingQuery')?.value||''),all=state.canonicalWorkouts||[];const w=all.filter(x=>inDays(x.workout_date,days)).filter(x=>!query||norm(`${x.workout_type||''} ${x.location||''}`).includes(query));
    const totalMin=sum(w,x=>x.duration_minutes),avgMin=avg(w,x=>x.duration_minutes),withHr=w.filter(x=>numv(x.heart_rate_avg)!=null),types=Object.entries(w.reduce((o,x)=>{const k=x.workout_type||'Não informado';o[k]=(o[k]||0)+1;return o},{})).sort((a,b)=>b[1]-a[1]);
    q('v11TrainingStats').innerHTML=`<div class="v11Stat"><span>Sessões</span><strong>${w.length}</strong><small>${days==='all'?'todo histórico':`últimos ${days} dias`}</small></div><div class="v11Stat"><span>Tempo registrado</span><strong>${totalMin?fmt(totalMin/60,1)+' h':'—'}</strong><small>${avgMin?`média ${fmt(avgMin,0)} min/sessão`:'duração incompleta'}</small></div><div class="v11Stat"><span>Tipos de sessão</span><strong>${types.length}</strong><small>${types.slice(0,2).map(x=>`${esc(x[0])} ${x[1]}×`).join(' · ')||'—'}</small></div><div class="v11Stat"><span>FC média disponível</span><strong>${withHr.length}</strong><small>sessões com dado cardiovascular</small></div>`;
    const els=[...document.querySelectorAll('#trainingList .workout')];all.forEach((x,i)=>{if(els[i])els[i].style.display=w.includes(x)?'':'none'});
  }
  function renderNutritionLens(){
    const days=q('v11NutritionDays')?.value||'30',n=V11.nutrition.filter(x=>inDays(x.nutrition_date,days)),meals=V11.meals.filter(x=>inDays(x.meal_date,days));
    const c=avg(n,x=>x.calories_kcal),p=avg(n,x=>x.protein_g),carb=avg(n,x=>x.carbs_g),fat=avg(n,x=>x.fat_g);
    q('v11NutritionStats').innerHTML=`<div class="v11Stat"><span>Dias registrados</span><strong>${n.length}</strong><small>${days==='all'?'todo histórico':`últimos ${days} dias`}</small></div><div class="v11Stat"><span>Calorias · média registrada</span><strong>${c!=null?fmt(c,0):'—'}</strong><small>kcal/dia com registro</small></div><div class="v11Stat"><span>Proteína · média registrada</span><strong>${p!=null?fmt(p,0)+' g':'—'}</strong><small>sem meta automática</small></div><div class="v11Stat"><span>Carboidrato / gordura</span><strong>${carb!=null?fmt(carb,0):'—'} / ${fat!=null?fmt(fat,0):'—'}</strong><small>g/dia registrados</small></div>`;
    q('v11NutritionChart').innerHTML=barSvg(n,'calories_kcal','nutrition_date');
    const byMeal=Object.entries(meals.reduce((o,x)=>{const k=(x.meal_name||'Sem nome').trim()||'Sem nome';o[k]=(o[k]||0)+1;return o},{})).sort((a,b)=>b[1]-a[1]).slice(0,6),daysWithCal=n.filter(x=>numv(x.calories_kcal)!=null).length;
    q('v11MealMix').innerHTML=`<div class="v11Mini"><b>Cobertura do período</b><strong>${n.length}</strong><span>dias com algum registro nutricional${days!=='all'?` em ${days} dias de janela`:''}.</span></div><div class="v11Mini"><b>Refeições registradas</b><strong>${meals.length}</strong><span>${byMeal.length?byMeal.map(([k,v])=>`${esc(k)} ${v}×`).join(' · '):'sem detalhes no período'}</span></div><div class="v11Footnote full">As médias usam somente dias presentes no arquivo; ausência de registro não é tratada como zero. ${daysWithCal!==n.length?'Alguns dias não têm calorias preenchidas.':''}</div>`;
  }
  function renderTimelineLens(){
    if(!state.canonicalWorkouts)return;const dom=V11.timelineDomain,days=q('v11TimelineDays')?.value||'30';const ev=timelineEvents(state.canonicalWorkouts||[],state.body||[],state.labs||[],state.docs||[],state.plans||[],V11.nutrition,state.metrics||[]).filter(x=>(dom==='all'||x.type===dom)&&inDays(x.date,days));
    q('timelineList').innerHTML=ev.length?ev.slice(0,400).map(x=>`<div class="timelineItem"><div class="dateBox">${fmtDate(x.date)}</div><div><span class="sourceTag">${esc(x.type)}</span><b>${esc(x.title||'Registro')}</b><small>${esc(x.sub||'')}${x.source?` · fonte: ${esc(x.source)}`:''}</small></div></div>`).join(''):empty('Nenhum evento para os filtros selecionados.')
  }
  function renderCrossDomain(){
    const w=(state.canonicalWorkouts||[]).filter(x=>inDays(x.workout_date,90)),n=V11.nutrition.filter(x=>inDays(x.nutrition_date,90)),b=(state.body||[]).filter(x=>inDays(x.measured_at,90));const nd=new Set(n.map(x=>dayKey(x.nutrition_date))),overlap=w.filter(x=>nd.has(dayKey(x.workout_date))).length;
    const sleep=(state.metrics||[]).filter(x=>x.metric_type==='sleep_duration_h'&&inDays(x.measured_at,90));
    q('v11CrossDomain').innerHTML=`<div class="v11PanelHead"><div><b>Leitura cruzada · últimos 90 dias</b><small>Prontidão real para comparar domínios sem sugerir causalidade.</small></div></div><div class="v11StatGrid four"><div class="v11Stat"><span>Treinos</span><strong>${w.length}</strong></div><div class="v11Stat"><span>Dias nutricionais</span><strong>${n.length}</strong></div><div class="v11Stat"><span>Treino + nutrição no mesmo dia</span><strong>${overlap}</strong><small>${w.length?pct(overlap,w.length)+'% dos treinos com registro nutricional no mesmo dia':'—'}</small></div><div class="v11Stat"><span>Dias de sono</span><strong>${sleep.length}</strong><small>${sleep.length?'comparação futura possível':'fonte ainda pendente'}</small></div></div><div class="v11Callout ${sleep.length?'ok':'info'}"><b>${sleep.length?'Base multidomínio em expansão':'Ainda falta recuperação contínua'}</b><span>${sleep.length?'Há dados observacionais para análises descritivas cruzadas, sempre com limitações explícitas.':'Treino e nutrição já se sobrepõem em parte do histórico, mas sono/atividade contínua ainda são a principal lacuna antes de análises de recuperação.'}</span></div>`
  }
  function norm(s){return String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')}
  install();
  const previousLoadAll=loadAll;
  loadAll=async function(){await previousLoadAll();await loadV11()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(loadV11,700)});
})();
