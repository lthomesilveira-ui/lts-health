(function(){
  let baseLoadAll=loadAll;
  async function exactCount(table,filters=[]){
    let x=sb.from(table).select('*',{count:'exact',head:true});
    for(const f of filters)x=x[f.method](...f.args);
    const r=await x; return r.count||0;
  }
  async function loadMfpV8(){
    if(!currentSession?.user)return;
    try{
      const [dailyCount,mealCount,activityCount,weightCount,recentNutrition,recentActivity,recentWeights]=await Promise.all([
        exactCount('health_daily_nutrition'),
        exactCount('health_nutrition_meals'),
        exactCount('health_activity_records'),
        exactCount('health_metrics',[{method:'eq',args:['metric_type','weight_kg']}]),
        sb.from('health_daily_nutrition').select('*').order('nutrition_date',{ascending:false}).limit(21),
        sb.from('health_activity_records').select('*').order('activity_date',{ascending:false}).limit(14),
        sb.from('health_metrics').select('*').eq('metric_type','weight_kg').order('measured_at',{ascending:false}).limit(18)
      ]);
      state.mfp={dailyCount,mealCount,activityCount,weightCount,recentNutrition:recentNutrition.data||[],recentActivity:recentActivity.data||[],recentWeights:recentWeights.data||[]};
      renderMfpV8();
    }catch(e){console.error('mfp-v8',e)}
  }
  function ensureSummary(){
    if(q('mfpSummary'))return q('mfpSummary');
    const el=document.createElement('div');el.id='mfpSummary';el.className='grid4 section';
    const nutrition=q('nutrition');const firstCard=nutrition?.querySelector('.card');
    if(firstCard)nutrition.insertBefore(el,firstCard);else nutrition?.appendChild(el);
    return el;
  }
  function ensureActivity(){
    if(q('mfpActivity'))return q('mfpActivity');
    const el=document.createElement('div');el.id='mfpActivity';el.className='section';
    const metric=q('metricList');metric?.parentElement?.appendChild(el);return el;
  }
  function ensureWeights(){
    if(q('mfpWeightHistory'))return q('mfpWeightHistory');
    const el=document.createElement('div');el.id='mfpWeightHistory';el.className='section';
    const body=q('bodyList');body?.parentElement?.appendChild(el);return el;
  }
  function recentNutritionHtml(rows){
    if(!rows.length)return empty('Nenhum dia nutricional disponível.');
    return rows.map(x=>`<div class="row"><div><b>${fmtDate(x.nutrition_date)}</b><small>Registro MyFitnessPal preservado · ${x.calories_kcal!=null?fmtNum(x.calories_kcal,0)+' kcal':'energia não informada'}${x.protein_g!=null?' · '+fmtNum(x.protein_g,0)+' g proteína':''}</small></div><span class="pill ok">fonte real</span></div>`).join('');
  }
  function recentActivityHtml(rows){
    if(!rows.length)return empty('Nenhum exercício do MyFitnessPal disponível.');
    return rows.map(x=>`<div class="row"><div><b>${fmtDate(x.activity_date)} · ${esc(x.activity_name||x.activity_type||'Exercício')}</b><small>${x.duration_minutes!=null?fmtNum(x.duration_minutes,0)+' min':''}${x.calories_kcal!=null?' · '+fmtNum(x.calories_kcal,0)+' kcal':''} · preservado separadamente do treino canônico</small></div><span class="pill warn">MFP</span></div>`).join('');
  }
  function recentWeightsHtml(rows){
    if(!rows.length)return empty('Nenhum peso histórico do MyFitnessPal disponível.');
    return rows.slice(0,10).map(x=>`<div class="row"><div><b>${fmtDate(x.measured_at)} · ${fmtNum(x.value)} ${esc(x.unit||'kg')}</b><small>MyFitnessPal · série separada da bioimpedância para não misturar contextos de medição.</small></div><span class="pill ok">histórico</span></div>`).join('');
  }
  function renderMfpV8(){
    const m=state.mfp;if(!m)return;
    ensureSummary().innerHTML=`<div class="statusCard"><b>Dias de nutrição</b><div class="statusValue">${m.dailyCount.toLocaleString('pt-BR')}</div><small>04/06/2018 → 26/08/2026</small></div><div class="statusCard"><b>Registros de refeições</b><div class="statusValue">${m.mealCount.toLocaleString('pt-BR')}</div><small>detalhes preservados do export</small></div><div class="statusCard"><b>Exercícios MFP</b><div class="statusValue">${m.activityCount.toLocaleString('pt-BR')}</div><small>arquivo histórico, sem dupla contagem</small></div><div class="statusCard"><b>Pesos MFP</b><div class="statusValue">${m.weightCount.toLocaleString('pt-BR')}</div><small>série independente da bioimpedância</small></div>`;
    q('statusNutrition').innerHTML=`<span class="pill ok">conectado</span><div class="statusValue">${m.dailyCount.toLocaleString('pt-BR')}</div><small>dias nutricionais do MyFitnessPal, de 2018 a 2026. Ausências permanecem ausências; o app não completa dias por estimativa.</small>`;
    q('nutritionTitle').textContent='MyFitnessPal All Time conectado';
    q('nutritionText').textContent=`${m.dailyCount.toLocaleString('pt-BR')} dias de nutrição e ${m.mealCount.toLocaleString('pt-BR')} registros de refeições. Valores são descritivos; não há meta automática de calorias, peso ou composição corporal.`;
    q('nutritionList').innerHTML=recentNutritionHtml(m.recentNutrition);
    ensureActivity().innerHTML=`<div class="title" style="font-size:14px">Exercícios históricos do MyFitnessPal</div><div class="sectionLead">${m.activityCount.toLocaleString('pt-BR')} registros foram preservados, mas não somados aos treinos canônicos até existir reconciliação por data e fonte.</div><div class="list">${recentActivityHtml(m.recentActivity)}</div>`;
    ensureWeights().innerHTML=`<div class="title" style="font-size:14px">Peso histórico · MyFitnessPal</div><div class="sectionLead">${m.weightCount.toLocaleString('pt-BR')} medições entre 2018 e 2026. Esta série permanece separada da bioimpedância para evitar comparação automática entre métodos/contextos diferentes.</div><div class="list">${recentWeightsHtml(m.recentWeights)}</div>`;
    q('statusRecovery').innerHTML=`<span class="pill warn">sono pendente</span><div class="statusValue">0</div><small>O MyFitnessPal trouxe ${m.activityCount.toLocaleString('pt-BR')} registros de exercício, mas recuperação continua sem score até entrar sono/atividade do Apple Health ou fonte equivalente.</small>`;
    const sub=q('subheadline');if(sub&&!sub.textContent.includes('MyFitnessPal'))sub.textContent+=` MyFitnessPal conectado: ${m.dailyCount.toLocaleString('pt-BR')} dias de nutrição.`;
    const pred=q('predictionStatus');if(pred)pred.textContent='Predições de recuperação ou trajetória corporal continuam retidas: a cobertura de nutrição aumentou muito, mas sono/atividade contínua e exames longitudinais ainda são insuficientes para previsões confiáveis.';
    document.querySelector('.footer').textContent='LTS Health · canonical v9 · dedicated GitHub / Supabase · MyFitnessPal All Time conectado · provenance first';
  }
  loadAll=async function(){await baseLoadAll();await loadMfpV8()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(loadMfpV8,350)});
})();
