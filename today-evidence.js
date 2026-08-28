(function(){
  'use strict';
  const N=14;
  const day=v=>String(v||'').slice(0,10);
  const safe=v=>esc(v??'');
  const cutoff=()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-N+1);return d.toISOString().slice(0,10)};
  const unique=a=>[...new Set(a.filter(Boolean))];
  const dateAdd=(iso,n)=>{const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
  const dates=()=>{const end=new Date();end.setHours(12,0,0,0);const out=[];for(let i=N-1;i>=0;i--){const d=new Date(end);d.setDate(d.getDate()-i);out.push(d.toISOString().slice(0,10))}return out};
  const metricDays=types=>new Set((state.metrics||[]).filter(x=>types.includes(String(x.metric_type||''))&&day(x.measured_at)>=cutoff()).map(x=>day(x.measured_at)));
  const workoutDays=()=>new Set((state.canonicalWorkouts||[]).filter(x=>day(x.workout_date)>=cutoff()).map(x=>day(x.workout_date)));
  const nutritionDays=()=>new Set((state.nutrition||[]).filter(x=>day(x.nutrition_date)>=cutoff()).map(x=>day(x.nutrition_date)));
  const dots=(set)=>dates().map(d=>`<i class="${set.has(d)?'has':''}" title="${safe(fmtDate(d))}"></i>`).join('');
  function row(label,set,detail){return `<div class="teRow"><div class="teRowHead"><div><b>${safe(label)}</b><small>${safe(detail)}</small></div><strong>${set.size}<span>/${N}</span></strong></div><div class="teDots" aria-label="${safe(label)}: ${set.size} de ${N} dias com evidência">${dots(set)}</div></div>`}
  function render(){
    const root=q('productToday');if(!root)return;
    const wd=workoutDays(),nd=nutritionDays(),sd=metricDays(['sleep_duration_h']),steps=metricDays(['steps']),energy=metricDays(['active_energy_kcal']),exercise=metricDays(['exercise_minutes']),rhr=metricDays(['resting_heart_rate_bpm']),apple=new Set(unique([...steps,...energy,...exercise,...rhr]));
    const both=[...wd].filter(d=>nd.has(d)).length;
    const priorSleep=[...wd].filter(d=>sd.has(dateAdd(d,-1))).length;
    const sameActivity=[...wd].filter(d=>apple.has(d)).length;
    const appleDetail=`Apple Health suportado: passos ${steps.size}, energia ativa ${energy.size}, exercício ${exercise.size}, FC repouso ${rhr.size} dia(s)`;
    const html=`<section class="tdPanel tePanel" id="todayEvidenceCoverage"><div class="tdPanelHead"><div><b>Cobertura de evidência · ${N} dias</b><small>Mostra somente dias com registros realmente disponíveis. É cobertura de evidência, não meta, aderência ou score.</small></div><button class="teLink" id="teGoInsights" type="button">Ver evidências</button></div><div class="teGrid">${row('Treino',wd,'sessão canônica registrada')}${row('Nutrição',nd,'dia importado de fonte registrada')}${row('Sono',sd,'duração de sono estruturada')}${row('Atividade suportada',apple,appleDetail)}</div><div class="teOverlap"><div><span>Treino + nutrição no mesmo dia</span><b>${both}/${wd.size||0}</b></div><div><span>Treino com sono registrado no dia anterior</span><b>${priorSleep}/${wd.size||0}</b></div><div><span>Treino + atividade Apple no mesmo dia</span><b>${sameActivity}/${wd.size||0}</b></div></div><p class="teNote">Sobreposição temporal apenas descreve disponibilidade conjunta de dados. Não demonstra causa, efeito, recuperação ou prontidão.</p></section>`;
    q('todayEvidenceCoverage')?.remove();
    const anchor=root.querySelector('.tdMetrics');if(anchor)anchor.insertAdjacentHTML('afterend',html);else root.insertAdjacentHTML('beforeend',html);
    q('teGoInsights')?.addEventListener('click',()=>activateTab('insights'));
  }
  const prior=loadAll;loadAll=async function(){const out=await prior();render();return out};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(render,2350)});
})();
