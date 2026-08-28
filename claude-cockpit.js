(function(){
  'use strict';
  const safe=v=>esc(v??'');
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const day=v=>String(v||'').slice(0,10);
  const rows=()=>[...(state.body||[])].filter(x=>x.measured_at).sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at)));
  const diff=(a,b,d=1,u='')=>{a=num(a);b=num(b);if(a==null||b==null)return'—';const x=a-b;return`${x>0?'+':''}${fmtNum(x,d)}${u?' '+u:''}`};
  const cutoff=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-n+1);return d.toISOString().slice(0,10)};
  const setsForExercise=e=>(state.sets||[]).filter(s=>s.exercise_source_record_id===e.source_record_id).length;
  function workoutVolume(days=90){
    const cut=cutoff(days),out={};
    for(const w of state.canonicalWorkouts||[]){
      if(day(w.workout_date)<cut)continue;
      if(w.sets_by_group&&typeof w.sets_by_group==='object'&&Object.keys(w.sets_by_group).length){for(const [g,v] of Object.entries(w.sets_by_group)){const n=num(v);if(g&&n!=null)out[g]=(out[g]||0)+n}continue}
      const ex=(state.exercises||[]).filter(e=>e.workout_source_record_id===w.source_record_id);
      for(const e of ex){if(!e.muscle_group)continue;const c=setsForExercise(e);if(c)out[e.muscle_group]=(out[e.muscle_group]||0)+c}
    }
    return Object.entries(out).sort((a,b)=>b[1]-a[1]);
  }
  function metric(label,value,sub){return`<div class="ccMetric"><span>${safe(label)}</span><strong>${safe(value)}</strong><small>${safe(sub)}</small></div>`}
  function renderAnalysis(){
    const root=q('productInsights');if(!root)return;let host=q('claudeAnalysisCockpit');if(!host){host=document.createElement('section');host.id='claudeAnalysisCockpit';host.className='ccAnalysis';root.prepend(host)}
    const b=rows(),first=b[0],prev=b.at(-2),last=b.at(-1),vol=workoutVolume(90),max=Math.max(1,...vol.map(x=>x[1]));
    const workouts=(state.canonicalWorkouts||[]).filter(w=>day(w.workout_date)>=cutoff(90));const labDates=new Set((state.labs||[]).map(x=>day(x.collection_date)).filter(Boolean));const nutritionDays=new Set((state.nutrition||[]).map(x=>day(x.nutrition_date)).filter(Boolean));
    host.innerHTML=`<div class="ccHead"><div><span>PARIDADE CLAUDE · ANÁLISE</span><h2>Resumo consolidado</h2><p>Recupera a leitura rápida que existia no app anterior, mas mantém as diferenças como descrições do histórico. Não cria meta corporal, classificação estética, diagnóstico ou readiness score.</p></div><button type="button" id="ccGoTimeline">Abrir timeline</button></div>
      <div class="ccMetrics">${metric('Peso atual',last?.weight_kg!=null?fmtNum(last.weight_kg,1)+' kg':'—',prev?`vs anterior ${diff(last.weight_kg,prev.weight_kg,1,'kg')} · vs primeiro ${diff(last.weight_kg,first?.weight_kg,1,'kg')}`:'sem comparação')}${metric('MME atual',last?.skeletal_muscle_mass_kg!=null?fmtNum(last.skeletal_muscle_mass_kg,1)+' kg':'—',prev?`vs anterior ${diff(last.skeletal_muscle_mass_kg,prev.skeletal_muscle_mass_kg,1,'kg')} · vs primeiro ${diff(last.skeletal_muscle_mass_kg,first?.skeletal_muscle_mass_kg,1,'kg')}`:'sem comparação')}${metric('Gordura registrada',last?.fat_mass_kg!=null?fmtNum(last.fat_mass_kg,1)+' kg':'—',prev?`vs anterior ${diff(last.fat_mass_kg,prev.fat_mass_kg,1,'kg')} · vs primeiro ${diff(last.fat_mass_kg,first?.fat_mass_kg,1,'kg')}`:'sem comparação')}${metric('Treinos · 90 dias',String(workouts.length),`${vol.reduce((s,x)=>s+x[1],0)} séries por grupo preservadas no resumo`)}</div>
      <div class="ccGrid"><section><div class="ccSectionHead"><b>Volume por grupo · 90 dias</b><small>Somatório histórico de séries registradas. Não é recomendação de volume.</small></div><div class="ccBars">${vol.length?vol.map(([g,v])=>`<div class="ccBar"><span>${safe(g)}</span><div><i style="width:${Math.max(4,Math.round(v/max*100))}%"></i></div><strong>${v}</strong></div>`).join(''):'<div class="ccEmpty">Sem volume estruturado no período.</div>'}</div></section>
      <section><div class="ccSectionHead"><b>Cobertura longitudinal</b><small>Quantidade de evidência disponível, não qualidade de saúde.</small></div><div class="ccCoverage">${metric('Bioimpedâncias',String(b.length),b.length?`${fmtDate(first.measured_at)} → ${fmtDate(last.measured_at)}`:'sem série')}${metric('Coletas laboratoriais',String(labDates.size),`${(state.labs||[]).length} resultado(s) estruturados`)}${metric('Nutrição carregada',String(nutritionDays.size),`dias no estado atual do app`)}${metric('Segmentar',String((state.segmental||[]).length),`medições estruturadas`)}</div></section></div>
      <div class="ccGuard">Diferenças entre medições são aritméticas. O app não interpreta automaticamente ganho/perda como melhor ou pior e não transforma histórico em metas de corpo, alimentação ou treino.</div>`;
    q('ccGoTimeline').onclick=()=>activateTab('timeline');
  }
  function applySkin(){document.body.classList.add('claudeCockpit')}
  function render(){applySkin();renderAnalysis()}
  const prior=loadAll;loadAll=async function(){const out=await prior();render();return out};
  window.addEventListener('load',()=>setTimeout(render,3200));
})();