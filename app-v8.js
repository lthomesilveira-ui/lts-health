(function(){
  const css=document.createElement('link');css.rel='stylesheet';css.href='./v10.css?v=10';document.head.appendChild(css);

  function prepareV10Dom(){
    const today=q('today');
    if(today&&!q('v10Overview')){
      const overview=document.createElement('div');overview.id='v10Overview';overview.className='v10-overview';
      overview.innerHTML=`<div class="v10-command"><div class="v10-kicker">LTS Health · visão integrada</div><div id="v10Title" class="v10-title">Construindo uma visão única do seu histórico.</div><div id="v10Sub" class="v10-sub">Treino, composição, nutrição, exames e novas fontes permanecem ligados à evidência original.</div><div id="v10Sources" class="v10-sourceRow"></div></div><div class="v10-snapshot"><div class="v10-snapshotTitle">Snapshot recente</div><div id="v10Snapshot"></div></div>`;
      const notice=q('systemNotice');notice?.insertAdjacentElement('afterend',overview);
    }
    if(!q('statusQuality')){
      const grid=today?.querySelector('.grid4.section');
      if(grid){const el=document.createElement('div');el.id='statusQuality';el.className='statusCard';grid.appendChild(el)}
    }
    if(!q('v10TrainingSummary')){
      const sec=q('training');const el=document.createElement('div');el.id='v10TrainingSummary';
      sec?.insertBefore(el,sec.querySelector('.grid2'));
    }
    if(!q('v10NutritionSummary')){
      const sec=q('nutrition');const el=document.createElement('div');el.id='v10NutritionSummary';
      sec?.insertBefore(el,sec.querySelector('.card'));
    }
    if(!q('v10EvolutionSummary')){
      const sec=q('evolution');const el=document.createElement('div');el.id='v10EvolutionSummary';
      sec?.insertBefore(el,sec.querySelector('.grid3'));
    }
    if(!q('v10HealthSummary')){
      const sec=q('health');const el=document.createElement('div');el.id='v10HealthSummary';
      sec?.insertBefore(el,sec.querySelector('.grid2'));
    }
    if(!q('v10InsightLead')){
      const sec=q('insights');const el=document.createElement('div');el.id='v10InsightLead';
      sec?.insertBefore(el,sec.querySelector('#insightGrid'));
    }
    if(!q('v10DataMap')){
      const sec=q('inbox');const el=document.createElement('div');el.id='v10DataMap';
      const lead=sec?.querySelector('.sectionLead');lead?.insertAdjacentElement('afterend',el);
    }
    if(!q('v10Sheet')){
      const sheet=document.createElement('div');sheet.id='v10Sheet';sheet.className='v10-sheet';sheet.innerHTML=`<div class="v10-sheetPanel"><div class="v10-sheetGrid"><button class="v10-sheetBtn" data-go="evolution">Evolução<small>Composição e peso</small></button><button class="v10-sheetBtn" data-go="nutrition">Nutrição<small>Histórico MyFitnessPal</small></button><button class="v10-sheetBtn" data-go="insights">Insights<small>Leituras e prontidão</small></button><button class="v10-sheetBtn" data-go="inbox">Dados / Inbox<small>Novas fontes e auditoria</small></button></div><button class="v10-sheetClose">Fechar</button></div>`;document.body.appendChild(sheet);
      sheet.addEventListener('click',e=>{if(e.target===sheet||e.target.closest('.v10-sheetClose'))sheet.classList.remove('open');const b=e.target.closest('[data-go]');if(b){sheet.classList.remove('open');activateTab(b.dataset.go)}});
      const more=q('moreBtn');if(more){more.onclick=e=>{e.preventDefault();sheet.classList.add('open')}}
    }
  }
  prepareV10Dom();

  let baseLoadAll=loadAll;
  async function exactCount(table,filters=[]){let x=sb.from(table).select('*',{count:'exact',head:true});for(const f of filters)x=x[f.method](...f.args);const r=await x;return r.count||0}
  const dateOnly=v=>String(v||'').slice(0,10);
  const asDate=v=>{const s=dateOnly(v);return s?new Date(s+'T12:00:00'):null};
  const avg=(rows,key)=>{const a=rows.map(x=>Number(x[key])).filter(Number.isFinite);return a.length?a.reduce((p,c)=>p+c,0)/a.length:null};
  const daysBetween=(a,b)=>Math.floor((asDate(b)-asDate(a))/86400000);
  const recentWithin=(rows,key,days)=>{const cutoff=new Date();cutoff.setHours(0,0,0,0);cutoff.setDate(cutoff.getDate()-days+1);return rows.filter(x=>{const d=asDate(x[key]);return d&&d>=cutoff})};

  async function loadProductData(){
    if(!currentSession?.user)return;
    try{
      const [dailyCount,mealCount,activityCount,weightCount,recentNutrition,recentActivity,recentWeights,allRecentNutrition]=await Promise.all([
        exactCount('health_daily_nutrition'),exactCount('health_nutrition_meals'),exactCount('health_activity_records'),exactCount('health_metrics',[{method:'eq',args:['metric_type','weight_kg']}]),
        sb.from('health_daily_nutrition').select('*').order('nutrition_date',{ascending:false}).limit(30),
        sb.from('health_activity_records').select('*').order('activity_date',{ascending:false}).limit(14),
        sb.from('health_metrics').select('*').eq('metric_type','weight_kg').order('measured_at',{ascending:false}).limit(18),
        sb.from('health_daily_nutrition').select('*').order('nutrition_date',{ascending:false}).limit(60)
      ]);
      state.mfp={dailyCount,mealCount,activityCount,weightCount,recentNutrition:recentNutrition.data||[],recentActivity:recentActivity.data||[],recentWeights:recentWeights.data||[],trendNutrition:allRecentNutrition.data||[]};
      renderProductV10();
    }catch(e){console.error('product-v10',e)}
  }

  function ensureMfpSummary(){if(q('mfpSummary'))return q('mfpSummary');const el=document.createElement('div');el.id='mfpSummary';el.className='grid4 section';const nutrition=q('nutrition');const firstCard=nutrition?.querySelector('.card');if(firstCard)nutrition.insertBefore(el,firstCard);else nutrition?.appendChild(el);return el}
  function ensureActivity(){if(q('mfpActivity'))return q('mfpActivity');const el=document.createElement('div');el.id='mfpActivity';el.className='section';const metric=q('metricList');metric?.parentElement?.appendChild(el);return el}
  function ensureWeights(){if(q('mfpWeightHistory'))return q('mfpWeightHistory');const el=document.createElement('div');el.id='mfpWeightHistory';el.className='section';const body=q('bodyList');body?.parentElement?.appendChild(el);return el}

  function recentNutritionHtml(rows){if(!rows.length)return empty('Nenhum dia nutricional disponível.');return rows.slice(0,14).map(x=>`<div class="row"><div><b>${fmtDate(x.nutrition_date)}</b><small>${x.calories_kcal!=null?fmtNum(x.calories_kcal,0)+' kcal registradas':'energia não informada'}${x.protein_g!=null?' · proteína '+fmtNum(x.protein_g,0)+' g':''}${x.carbs_g!=null?' · carboidrato '+fmtNum(x.carbs_g,0)+' g':''}</small></div><span class="pill ok">MFP</span></div>`).join('')}
  function recentActivityHtml(rows){if(!rows.length)return empty('Nenhum exercício do MyFitnessPal disponível.');return rows.map(x=>`<div class="row"><div><b>${fmtDate(x.activity_date)} · ${esc(x.activity_name||x.activity_type||'Exercício')}</b><small>${x.duration_minutes!=null?fmtNum(x.duration_minutes,0)+' min':''}${x.calories_kcal!=null?' · '+fmtNum(x.calories_kcal,0)+' kcal':''} · mantido separado do treino canônico</small></div><span class="pill warn">MFP</span></div>`).join('')}
  function recentWeightsHtml(rows){if(!rows.length)return empty('Nenhum peso histórico do MyFitnessPal disponível.');return rows.slice(0,10).map(x=>`<div class="row"><div><b>${fmtDate(x.measured_at)} · ${fmtNum(x.value)} ${esc(x.unit||'kg')}</b><small>MyFitnessPal · série histórica independente da bioimpedância.</small></div><span class="pill ok">histórico</span></div>`).join('')}
  function barChart(rows,key,dateKey){const a=[...rows].slice(0,14).reverse().filter(x=>Number.isFinite(Number(x[key])));if(!a.length)return'<div class="empty">Sem valores suficientes para este gráfico.</div>';const vals=a.map(x=>Number(x[key])),max=Math.max(...vals),min=Math.min(...vals),span=max-min||1;return`<div class="v10-bars">${a.map((x,i)=>{const v=Number(x[key]),h=24+((v-min)/span)*72;return`<i class="v10-bar" style="height:${h}%" data-tip="${fmtDate(x[dateKey])} · ${fmtNum(v,0)}"></i>`}).join('')}</div><div class="v10-chartFoot"><span>${fmtDate(a[0][dateKey])}</span><span>${fmtDate(a[a.length-1][dateKey])}</span></div>`}

  function renderOverview(){
    const w=state.canonicalWorkouts||[],b=state.body||[],l=state.labs||[],m=state.mfp||{},metrics=state.metrics||[];
    const recentW=recentWithin(w,'workout_date',7),recentW30=recentWithin(w,'workout_date',30),latestW=w[0],latestB=b[0],labDates=[...new Set(l.map(x=>dateOnly(x.collection_date)).filter(Boolean))].sort().reverse(),sleep=metrics.filter(x=>x.metric_type==='sleep_duration_h');
    q('v10Title').textContent='Seu histórico está consolidado e pronto para análises progressivamente melhores.';
    q('v10Sub').textContent=`Há ${w.length} treinos canônicos, ${m.dailyCount||0} dias de nutrição, ${b.length} medições corporais e ${l.length} resultados laboratoriais preservados com proveniência. O próximo ganho importante é conectar recuperação e atividade contínua.`;
    q('v10Sources').innerHTML=[['Treino',w.length>0],['MyFitnessPal',(m.dailyCount||0)>0],['Composição',b.length>0],['Exames',l.length>0],['Apple Health',metrics.some(x=>String(x.source||'').toLowerCase().includes('apple'))]].map(([n,ok])=>`<span class="v10-sourceChip">${ok?'✓':'○'} ${n}</span>`).join('');
    const snap=q('v10Snapshot');snap.innerHTML=`<div class="v10-signal"><div><b>Treino</b><small>${latestW?fmtDate(latestW.workout_date)+' · '+esc(latestW.workout_type):'Sem sessão recente'}</small></div><strong>${recentW.length} / 7d</strong></div><div class="v10-signal"><div><b>Nutrição</b><small>${m.recentNutrition?.[0]?fmtDate(m.recentNutrition[0].nutrition_date)+' · último registro':'Aguardando dados'}</small></div><strong>${(m.dailyCount||0).toLocaleString('pt-BR')} dias</strong></div><div class="v10-signal"><div><b>Composição</b><small>${latestB?fmtDate(latestB.measured_at)+' · última medição':'Sem medição'}</small></div><strong>${latestB?.weight_kg!=null?fmtNum(latestB.weight_kg)+' kg':'—'}</strong></div><div class="v10-signal"><div><b>Recuperação</b><small>${sleep.length?'Sono disponível':'Sono ainda não integrado'}</small></div><strong>${sleep.length?'conectado':'pendente'}</strong></div>`;
    q('headline').textContent='Base longitudinal conectada';
    q('subheadline').textContent=`${recentW30.length} treinos nos últimos 30 dias registrados · ${m.dailyCount||0} dias nutricionais históricos · ${b.length} medições corporais · ${labDates.length} data(s) de coleta laboratorial.`;
  }

  function renderTrainingV10(){
    const w=state.canonicalWorkouts||[];if(!w.length)return;
    const last28=recentWithin(w,'workout_date',28),last7=recentWithin(w,'workout_date',7),dur=avg(last28,'duration_minutes'),latest=w[0];
    const weeks=[];const now=new Date();now.setHours(12,0,0,0);for(let i=7;i>=0;i--){const end=new Date(now);end.setDate(end.getDate()-i*7);const start=new Date(end);start.setDate(start.getDate()-6);const count=w.filter(x=>{const d=asDate(x.workout_date);return d&&d>=start&&d<=end}).length;weeks.push({label:`-${i}sem`,count})}const max=Math.max(1,...weeks.map(x=>x.count));
    q('v10TrainingSummary').innerHTML=`<div class="v10-statGrid"><div class="v10-stat"><label>Últimos 7 dias</label><strong>${last7.length}</strong><small>sessões canônicas registradas</small></div><div class="v10-stat"><label>Últimos 28 dias</label><strong>${last28.length}</strong><small>frequência observada no histórico</small></div><div class="v10-stat"><label>Duração média</label><strong>${dur!=null?fmtNum(dur,0)+' min':'—'}</strong><small>somente sessões com duração disponível</small></div><div class="v10-stat"><label>Última sessão</label><strong>${latest?fmtDate(latest.workout_date):'—'}</strong><small>${esc(latest?.workout_type||'')}</small></div></div><div class="v10-chartCard"><div class="v10-chartTitle"><b>Frequência por semana</b><small>últimas 8 janelas semanais</small></div><div class="v10-weekBars">${weeks.map(x=>`<div class="v10-weekCol"><div class="v10-weekBar" style="height:${10+(x.count/max)*62}px"></div><b>${x.count}</b><span>${x.label}</span></div>`).join('')}</div></div>`;
  }

  function renderNutritionV10(){
    const m=state.mfp;if(!m)return;const rows=m.recentNutrition||[],cal=avg(rows,'calories_kcal'),pro=avg(rows,'protein_g'),carb=avg(rows,'carbs_g'),fat=avg(rows,'fat_g');
    q('v10NutritionSummary').innerHTML=`<div class="v10-statGrid"><div class="v10-stat"><label>Cobertura histórica</label><strong>${m.dailyCount.toLocaleString('pt-BR')}</strong><small>dias registrados desde 2018</small></div><div class="v10-stat"><label>Média · 30 registros</label><strong>${cal!=null?fmtNum(cal,0)+' kcal':'—'}</strong><small>descrição, não meta</small></div><div class="v10-stat"><label>Proteína · média</label><strong>${pro!=null?fmtNum(pro,0)+' g':'—'}</strong><small>últimos registros com valor disponível</small></div><div class="v10-stat"><label>Refeições preservadas</label><strong>${m.mealCount.toLocaleString('pt-BR')}</strong><small>linhas do export original</small></div></div><div class="v10-chartCard"><div class="v10-chartTitle"><b>Energia registrada recentemente</b><small>14 registros mais recentes com valor</small></div>${barChart(m.trendNutrition||rows,'calories_kcal','nutrition_date')}</div>`;
    ensureMfpSummary().innerHTML=`<div class="statusCard"><b>Dias de nutrição</b><div class="statusValue">${m.dailyCount.toLocaleString('pt-BR')}</div><small>04/06/2018 → 26/08/2026</small></div><div class="statusCard"><b>Registros de refeições</b><div class="statusValue">${m.mealCount.toLocaleString('pt-BR')}</div><small>detalhes preservados do export</small></div><div class="statusCard"><b>Exercícios MFP</b><div class="statusValue">${m.activityCount.toLocaleString('pt-BR')}</div><small>sem dupla contagem com treinos canônicos</small></div><div class="statusCard"><b>Pesos MFP</b><div class="statusValue">${m.weightCount.toLocaleString('pt-BR')}</div><small>série independente da bioimpedância</small></div>`;
    q('statusNutrition').innerHTML=`<span class="pill ok">conectado</span><div class="statusValue">${m.dailyCount.toLocaleString('pt-BR')}</div><small>dias nutricionais do MyFitnessPal. Ausências permanecem ausências; o app não completa dias por estimativa.</small>`;
    q('nutritionTitle').textContent='MyFitnessPal All Time conectado';q('nutritionText').textContent=`${m.dailyCount.toLocaleString('pt-BR')} dias de nutrição e ${m.mealCount.toLocaleString('pt-BR')} registros de refeições. Médias acima são puramente descritivas e calculadas apenas com valores existentes.`;q('nutritionList').innerHTML=recentNutritionHtml(rows);
    ensureActivity().innerHTML=`<div class="title" style="font-size:14px">Exercícios históricos do MyFitnessPal</div><div class="sectionLead">${m.activityCount.toLocaleString('pt-BR')} registros preservados, sem serem somados automaticamente aos treinos canônicos.</div><div class="list">${recentActivityHtml(m.recentActivity)}</div>`;
    ensureWeights().innerHTML=`<div class="title" style="font-size:14px">Peso histórico · MyFitnessPal</div><div class="sectionLead">${m.weightCount.toLocaleString('pt-BR')} medições históricas, mantidas separadas da bioimpedância para preservar o contexto da fonte.</div><div class="list">${recentWeightsHtml(m.recentWeights)}</div>`;
  }

  function renderEvolutionV10(){
    const b=state.body||[];if(!b.length)return;const latest=b[0],oldest=[...b].sort((a,c)=>String(a.measured_at).localeCompare(String(c.measured_at)))[0];
    q('v10EvolutionSummary').innerHTML=`<div class="v10-statGrid"><div class="v10-stat"><label>Última medição</label><strong>${fmtDate(latest.measured_at)}</strong><small>${esc(latest.source||'fonte preservada')}</small></div><div class="v10-stat"><label>Peso registrado</label><strong>${latest.weight_kg!=null?fmtNum(latest.weight_kg)+' kg':'—'}</strong><small>valor observado na última medição</small></div><div class="v10-stat"><label>Massa muscular</label><strong>${latest.skeletal_muscle_mass_kg!=null?fmtNum(latest.skeletal_muscle_mass_kg)+' kg':'—'}</strong><small>quando disponível na fonte</small></div><div class="v10-stat"><label>Série disponível</label><strong>${b.length}</strong><small>${fmtDate(oldest.measured_at)} → ${fmtDate(latest.measured_at)}</small></div></div><div class="v10-callout"><b>Leitura longitudinal</b><p>Esta tela descreve mudanças registradas ao longo do tempo. O produto não classifica aparência corporal nem transforma variações isoladas em conclusões clínicas.</p></div>`;
  }

  function renderHealthV10(){
    const l=state.labs||[],d=state.docs||[],metrics=state.metrics||[];const dates=[...new Set(l.map(x=>dateOnly(x.collection_date)).filter(Boolean))].sort(),latest=dates.at(-1),sleep=metrics.filter(x=>x.metric_type==='sleep_duration_h'),activity=metrics.filter(x=>['steps','active_energy_kcal','exercise_minutes','stand_hours'].includes(x.metric_type));
    q('v10HealthSummary').innerHTML=`<div class="v10-statGrid"><div class="v10-stat"><label>Biomarcadores</label><strong>${l.length}</strong><small>resultados estruturados</small></div><div class="v10-stat"><label>Coletas</label><strong>${dates.length}</strong><small>${latest?'última '+fmtDate(latest):'sem data disponível'}</small></div><div class="v10-stat"><label>Documentos</label><strong>${d.length}</strong><small>metadados preservados</small></div><div class="v10-stat"><label>Sono / atividade</label><strong>${sleep.length||activity.length?'parcial':'pendente'}</strong><small>${sleep.length} sono · ${activity.length} atividade</small></div></div>`;
  }

  function renderInsightsV10(){
    const w=state.canonicalWorkouts||[],b=state.body||[],l=state.labs||[],m=state.mfp||{},metrics=state.metrics||[],labDates=new Set(l.map(x=>x.collection_date).filter(Boolean)),sleep=metrics.filter(x=>x.metric_type==='sleep_duration_h');
    const statements=[];if(w.length)statements.push(`Treino já tem uma camada estrutural consistente (${w.length} sessões canônicas).`);if(m.dailyCount)statements.push(`Nutrição deixou de ser uma lacuna: ${m.dailyCount.toLocaleString('pt-BR')} dias históricos estão conectados.`);if(b.length)statements.push(`Composição corporal tem ${b.length} medições e já permite descrição longitudinal.`);if(labDates.size<2)statements.push('Exames ainda têm longitudinalidade limitada porque há apenas uma coleta estruturada completa.');if(!sleep.length)statements.push('Recuperação continua sendo o principal vazio: sono ainda não está integrado.');
    q('v10InsightLead').innerHTML=`<div class="v10-callout"><b>O que a base permite dizer agora</b><p>${statements.map(x=>'• '+x).join('<br>')}</p></div>`;
    const pred=q('predictionStatus');if(pred)pred.textContent='Predições ficam retidas até a base ter recuperação/sono e melhor longitudinalidade clínica. O app não preenche domínios ausentes com números artificiais.';
  }

  function renderDataMapV10(){
    const m=state.mfp||{},w=state.canonicalWorkouts||[],b=state.body||[],l=state.labs||[],metrics=state.metrics||[];const apple=metrics.some(x=>String(x.source||'').toLowerCase().includes('apple')),labDates=new Set(l.map(x=>x.collection_date).filter(Boolean));
    const sources=[['Treino',w.length,!!w.length,'sessões canônicas'],['MyFitnessPal',m.dailyCount||0,!!m.dailyCount,'dias nutricionais'],['Composição',b.length,!!b.length,'medições'],['Exames',labDates.size,labDates.size>1,labDates.size>1?'coletas longitudinais':'coleta estruturada'],['Apple Health',apple?'on':'—',apple,'atividade / sono']];
    q('v10DataMap').innerHTML=`<div class="v10-sectionHead"><h2>Mapa de fontes</h2><span>o que já está conectado e o que ainda falta</span></div><div class="v10-dataMap">${sources.map(([n,v,ok,s])=>`<div class="v10-sourceCard"><b><i class="v10-dot ${ok?'ok':'warn'}"></i>${n}</b><strong>${v}</strong><small>${s}</small></div>`).join('')}</div>`;
  }

  function renderProductV10(){
    const m=state.mfp;if(!m)return;renderOverview();renderTrainingV10();renderNutritionV10();renderEvolutionV10();renderHealthV10();renderInsightsV10();renderDataMapV10();
    q('statusRecovery').innerHTML=`<span class="pill warn">sono pendente</span><div class="statusValue">0</div><small>Há ${m.activityCount.toLocaleString('pt-BR')} registros históricos de exercício no MFP, mas recuperação permanece sem score até entrar sono/atividade contínua.</small>`;
    const footer=document.querySelector('.footer');if(footer)footer.textContent='LTS Health · v10 · backend e deploy dedicados · MyFitnessPal All Time conectado · provenance first';
  }

  loadAll=async function(){await baseLoadAll();await loadProductData()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(loadProductData,350)});
})();
