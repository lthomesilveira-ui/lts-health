(function(){
  'use strict';
  const day=v=>String(v||'').slice(0,10);
  const safe=v=>esc(v??'');
  const today=()=>{const d=new Date();d.setHours(12,0,0,0);return d.toISOString().slice(0,10)};
  const latestDate=(arr,key)=>[...(arr||[])].map(x=>day(x?.[key])).filter(Boolean).sort().at(-1)||null;
  const latestLabel=d=>d?`último registro ${fmtDate(d)}`:'sem registro disponível';
  const supportedApple=new Map([
    ['steps','passos'],
    ['active_energy_kcal','energia ativa'],
    ['exercise_minutes','minutos de exercício'],
    ['resting_heart_rate_bpm','FC de repouso']
  ]);
  function card({label,present,detail,last,go}){
    return `<button class="tcCard ${present?'observed':'missing'}" type="button" data-tc-go="${safe(go)}"><div class="tcCardTop"><span>${safe(label)}</span><b>${present?'registrado hoje':'sem registro hoje'}</b></div><strong>${safe(detail)}</strong><small>${safe(present?'evidência datada de hoje':latestLabel(last))}</small></button>`;
  }
  function render(){
    const root=q('productToday');if(!root)return;
    const d=today();
    const workouts=(state.canonicalWorkouts||[]).filter(x=>day(x.workout_date)===d);
    const nutrition=(state.nutrition||[]).filter(x=>day(x.nutrition_date)===d);
    const metrics=state.metrics||[];
    const todayMetrics=metrics.filter(x=>day(x.measured_at)===d);
    const appleTypes=[...new Set(todayMetrics.map(x=>String(x.metric_type||'')).filter(x=>supportedApple.has(x)))];
    const sleepToday=todayMetrics.some(x=>String(x.metric_type||'')==='sleep_duration_h');
    const bodyToday=(state.body||[]).filter(x=>day(x.measured_at)===d);
    const labToday=(state.labs||[]).filter(x=>day(x.collection_date)===d);
    const docToday=(state.docs||[]).filter(x=>day(x.document_date)===d);
    const clinicalCount=labToday.length+docToday.length;
    const appleDetail=appleTypes.length?appleTypes.map(x=>supportedApple.get(x)).join(' · '):'nenhuma métrica suportada datada de hoje';
    const workoutDetail=workouts.length?`${workouts.length} sessão(ões) canônica(s)`:'nenhuma sessão canônica datada de hoje';
    const nutritionDetail=nutrition.length?`${nutrition.length} registro(s) diário(s)`:'nenhum dia de nutrição datado de hoje';
    const sleepDetail=sleepToday?'duração de sono estruturada':'nenhuma duração de sono datada de hoje';
    const bodyDetail=bodyToday.length?`${bodyToday.length} medição(ões) corporal(is)`:'nenhuma composição corporal datada de hoje';
    const clinicalDetail=clinicalCount?`${labToday.length} resultado(s) de exame · ${docToday.length} documento(s)`:'nenhum exame ou documento datado de hoje';
    const html=`<section class="tdPanel tcPanel" id="todayCurrentEvidence"><div class="tdPanelHead"><div><b>Hoje · evidência realmente datada de ${safe(fmtDate(d))}</b><small>Se não há registro nesta data, o painel mostra o último registro conhecido em vez de transformar ausência em zero, jejum, inatividade ou qualquer conclusão clínica.</small></div><button class="tcTimeline" id="tcGoTimeline" type="button">Abrir timeline</button></div><div class="tcGrid">${card({label:'Treino',present:workouts.length>0,detail:workoutDetail,last:latestDate(state.canonicalWorkouts,'workout_date'),go:'training'})}${card({label:'Nutrição',present:nutrition.length>0,detail:nutritionDetail,last:latestDate(state.nutrition,'nutrition_date'),go:'nutrition'})}${card({label:'Apple Health suportado',present:appleTypes.length>0,detail:appleDetail,last:latestDate(metrics.filter(x=>supportedApple.has(String(x.metric_type||''))),'measured_at'),go:'timeline'})}${card({label:'Sono',present:sleepToday,detail:sleepDetail,last:latestDate(metrics.filter(x=>String(x.metric_type||'')==='sleep_duration_h'),'measured_at'),go:'timeline'})}${card({label:'Composição',present:bodyToday.length>0,detail:bodyDetail,last:latestDate(state.body,'measured_at'),go:'evolution'})}${card({label:'Saúde & documentos',present:clinicalCount>0,detail:clinicalDetail,last:[latestDate(state.labs,'collection_date'),latestDate(state.docs,'document_date')].filter(Boolean).sort().at(-1)||null,go:'health'})}</div><p class="tcNote">Apple Health é mostrado por tipo de métrica validada disponível no dia; registros de fontes múltiplas não são somados aqui. Este quadro descreve presença de evidência, não readiness, recovery, meta ou avaliação de saúde.</p></section>`;
    q('todayCurrentEvidence')?.remove();
    const anchor=root.querySelector('.tdHero');
    if(anchor)anchor.insertAdjacentHTML('afterend',html);else root.insertAdjacentHTML('afterbegin',html);
    root.querySelectorAll('[data-tc-go]').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tcGo)));
    q('tcGoTimeline')?.addEventListener('click',()=>activateTab('timeline'));
  }
  const prior=loadAll;loadAll=async function(){const out=await prior();render();return out};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(render,2250)});
})();
