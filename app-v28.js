(function(){
  const ensure=(id,parent)=>{let e=q(id);if(e)return e;e=document.createElement('div');e.id=id;parent?.appendChild(e);return e};
  function renderAppleAccuracy(){
    const el=q('v17AppleGuide');if(!el)return;const metrics=state.metrics||[],apple=metrics.filter(x=>/apple health/i.test(String(x.source||''))),uploads=(state.uploads||[]).filter(x=>x.source_type==='apple_health');
    const supported=[['Energia ativa','active_energy_kcal'],['Minutos de exercício','exercise_minutes'],['Horas em pé','stand_hours'],['Duração do sono','sleep_duration_h']];
    const counts=Object.fromEntries(supported.map(([label,type])=>[label,new Set(apple.filter(x=>x.metric_type===type).map(x=>String(x.measured_at||'').slice(0,10)).filter(Boolean)).size]));
    el.innerHTML=`<div class="v17Head"><div><b>Apple Health</b><small>Importador validado para ZIP ou export.xml com normalização conservadora.</small></div><span class="v17AppleState ${apple.length?'ready':'pending'}">${apple.length?'dados importados':'aguardando export'}</span></div><div class="v17AppleGrid"><div><span>Métricas Apple normalizadas</span><strong>${apple.length}</strong></div><div><span>Uploads Apple recebidos</span><strong>${uploads.length}</strong></div></div><div class="v28CapabilityGrid">${supported.map(([label])=>`<div><span>${esc(label)}</span><strong>${counts[label]}</strong><small>dia(s) normalizado(s)</small></div>`).join('')}</div><p>Passos e frequência cardíaca de repouso ainda não são consolidados automaticamente pelo parser atual. O export bruto continua preservado para evolução futura, evitando apresentar como suportado algo que ainda não foi validado.</p>`;
  }
  function install(){document.body.classList.add('healthV28');const inbox=q('inbox');const note=ensure('v28ParserNote',inbox);note.className='v28ParserNote';note.innerHTML='<b>Parser ativo</b><span>Inspeção autenticada com suporte validado a MyFitnessPal e Apple Health para métricas específicas. Arquivos fora desses parsers permanecem preservados e sinalizados para revisão.</span>'}
  function renderV28(){renderAppleAccuracy();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v28 · validated ingestion capability map · dedicated GitHub / Supabase · provenance first'}
  install();const prior=loadAll;loadAll=async function(){await prior();renderV28()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(renderV28,4850)});
})();
