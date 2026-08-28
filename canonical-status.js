(function(){
  'use strict';
  const day=v=>String(v||'').slice(0,10);
  const validId=v=>v!=null&&String(v).trim()!=='';
  function coverage(w,e,s){
    const canonical=(w||[]).filter(x=>x&&x.is_canonical!==false&&x.record_status!=='quarantined');
    const exerciseIds=new Set((e||[]).map(x=>x.source_record_id).filter(validId));
    const detailedDays=new Set((s||[]).map(x=>day(x.workout_date)).filter(Boolean));
    const setsWithProvenance=(s||[]).filter(x=>validId(x.source_record_id)).length;
    const setsWithReps=(s||[]).filter(x=>x.reps_numeric!=null||validId(x.reps_raw)).length;
    const orphanSets=(s||[]).filter(x=>validId(x.exercise_source_record_id)&&!exerciseIds.has(x.exercise_source_record_id)).length;
    const summaryOnly=canonical.filter(x=>!detailedDays.has(day(x.workout_date))).length;
    return {canonical,detailedDays,setsWithProvenance,setsWithReps,orphanSets,summaryOnly};
  }
  function patchHeadline(){
    const w=state.canonicalWorkouts||[],e=state.exercises||[],s=state.sets||[],c=coverage(w,e,s),h=q('headline'),sub=q('subheadline');
    if(h)h.textContent=s.length?`Histórico de treino canônico carregado: ${s.length} séries estruturadas.`:'Histórico de treino canônico carregado; detalhes de séries ainda não estão disponíveis.';
    if(sub)sub.textContent=`${w.length} treinos canônicos · ${e.length} exercícios estruturados · ${c.detailedDays.size} sessão(ões) com séries detalhadas · ${state.body?.length||0} registros corporais · ${state.labs?.length||0} resultados laboratoriais.`;
  }
  const priorStatus=renderStatus;
  renderStatus=function(w,e,s,nut,metrics,l,openQ){
    priorStatus(w,e,s,nut,metrics,l,openQ);
    const c=coverage(w,e,s),host=q('statusTraining');if(!host)return;
    const complete=s.length>0&&c.orphanSets===0;
    host.innerHTML=`<span class="pill ${complete?'ok':'warn'}">${complete?'estruturado':'cobertura parcial'}</span><div class="statusValue">${s.length}</div><small>${e.length} exercícios em ${c.detailedDays.size} sessão(ões) detalhadas. ${c.setsWithReps}/${s.length} séries têm repetições registradas; ${c.setsWithProvenance}/${s.length} mantêm source_record_id.${c.summaryOnly?` ${c.summaryOnly} treino(s) canônico(s) permanecem apenas em nível de resumo.`:''}${c.orphanSets?` ${c.orphanSets} série(s) não puderam ser ligadas a um exercício estruturado.`:''}</small>`;
  };
  const priorReadiness=renderReadiness;
  renderReadiness=function(w,s,b,l,nut,metrics){
    priorReadiness(w,s,b,l,nut,metrics);
    const e=state.exercises||[],c=coverage(w,e,s),labDates=new Set((l||[]).map(x=>day(x.collection_date)).filter(Boolean)),activity=(metrics||[]).filter(x=>['steps','exercise_minutes','active_energy_kcal'].includes(x.metric_type)).length,sleep=(metrics||[]).filter(x=>x.metric_type==='sleep_duration_h').length;
    const checks=[
      ['Treino detalhado',c.detailedDays.size>0,`${c.detailedDays.size} sessão(ões) com séries estruturadas`],
      ['Proveniência das séries',s.length>0&&c.setsWithProvenance===s.length,`${c.setsWithProvenance}/${s.length} séries com source_record_id`],
      ['Composição longitudinal',(b||[]).length>=2,`${(b||[]).length} medições registradas`],
      ['Nutrição observada',(nut||[]).length>0,`${(nut||[]).length} dias carregados no estado atual`],
      ['Atividade validada',activity>0,`${activity} registro(s) suportado(s)`],
      ['Sono observado',sleep>0,`${sleep} registro(s)`],
      ['Labs longitudinais',labDates.size>=2,`${labDates.size} coleta(s)`]
    ];
    const ok=checks.filter(x=>x[1]).length;
    const title=q('predictionReadiness');if(title)title.textContent=`${ok}/${checks.length} domínios com evidência utilizável`;
    const grid=q('readinessGrid');if(grid)grid.innerHTML=checks.map(x=>`<div class="ready"><i class="${x[1]?'yes':'no'}"></i><div><b>${esc(x[0])}</b><small>${esc(x[2])}</small></div></div>`).join('');
    const st=q('predictionStatus');if(st)st.textContent='Este quadro mede somente cobertura técnica dos dados para análises longitudinais. Não é readiness/recovery de saúde, não é score de desempenho e não preenche lacunas por estimativa.';
    const label=title?.parentElement?.querySelector('.eyebrow');if(label)label.textContent='Cobertura técnica para análises';
  };
  function render(){patchHeadline();if(state.canonicalWorkouts)renderStatus(state.canonicalWorkouts,state.exercises||[],state.sets||[],state.nutrition||[],state.metrics||[],state.labs||[],(state.quality||[]).filter(x=>String(x.status).toLowerCase()==='open'));if(state.canonicalWorkouts)renderReadiness(state.canonicalWorkouts,state.sets||[],state.body||[],state.labs||[],state.nutrition||[],state.metrics||[])}
  const priorLoad=loadAll;loadAll=async function(){const out=await priorLoad();render();return out};
  window.addEventListener('load',()=>setTimeout(render,2200));
})();
