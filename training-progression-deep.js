(function(){
  'use strict';
  const D={key:null,query:''};
  const day=v=>String(v||'').slice(0,10);
  const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
  const num=v=>{if(v==null||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null};
  const safe=v=>esc(v??'');
  const unique=a=>[...new Set(a.filter(Boolean))];
  const setsFor=e=>(state.sets||[]).filter(s=>s.exercise_source_record_id===e.source_record_id).sort((a,b)=>(a.set_index??999)-(b.set_index??999));

  function groups(){
    const map=new Map();
    for(const e of state.exercises||[]){
      const key=norm(e.exercise);if(!key)continue;
      const g=map.get(key)||{key,label:e.exercise,rows:[]};g.rows.push(e);map.set(key,g);
    }
    return [...map.values()].sort((a,b)=>String(a.label).localeCompare(String(b.label),'pt-BR'));
  }
  function sessionSummary(g){
    const byDate=new Map();
    for(const e of g.rows){const d=day(e.workout_date);if(!d)continue;const a=byDate.get(d)||[];a.push(e);byDate.set(d,a)}
    return [...byDate.entries()].map(([d,rows])=>{
      const sets=rows.flatMap(setsFor),byUnit=new Map();
      for(const s of sets){const w=num(s.weight),u=String(s.weight_unit||'').trim();if(w==null||!u)continue;const a=byUnit.get(u)||[];a.push(w);byUnit.set(u,a)}
      const top=[...byUnit.entries()].map(([unit,vals])=>({unit,value:Math.max(...vals)}));
      const repVals=sets.map(s=>num(s.reps_numeric??s.reps)).filter(v=>v!=null);
      const completeReps=sets.length>0&&repVals.length===sets.length;
      return {d,sets:sets.length,rows:rows.length,top,repKnown:repVals.length,repTotal:completeReps?repVals.reduce((a,b)=>a+b,0):null,completeReps};
    }).sort((a,b)=>b.d.localeCompare(a.d));
  }
  function comparable(latest,history){
    if(!latest)return null;
    for(const prev of history.slice(1)){
      for(const now of latest.top){const before=prev.top.find(x=>x.unit===now.unit);if(before)return {prev,unit:now.unit,now:now.value,before:before.value}}
    }
    return null;
  }
  function deltaText(v,unit){return `${v>0?'+':''}${fmtNum(v,Number.isInteger(v)?0:1)} ${safe(unit)}`}
  function comparisonCard(history){
    if(history.length<2)return '<div class="tpdNotice"><b>Comparação ainda indisponível</b><span>É necessária uma segunda sessão registrada para este exercício.</span></div>';
    const latest=history[0],c=comparable(latest,history);
    if(!c)return '<div class="tpdNotice"><b>Comparação retida</b><span>As sessões disponíveis não compartilham uma unidade explícita de carga. Nenhuma conversão é estimada.</span></div>';
    const d=c.now-c.before,setsDelta=latest.sets-c.prev.sets;
    return `<div class="tpdCompare"><div><span>Última sessão</span><strong>${fmtDate(latest.d)}</strong><small>${fmtNum(c.now,Number.isInteger(c.now)?0:1)} ${safe(c.unit)} · ${latest.sets} série(s)</small></div><div><span>Anterior comparável</span><strong>${fmtDate(c.prev.d)}</strong><small>${fmtNum(c.before,Number.isInteger(c.before)?0:1)} ${safe(c.unit)} · ${c.prev.sets} série(s)</small></div><div><span>Diferença observada</span><strong>${deltaText(d,c.unit)}</strong><small>${setsDelta>0?'+':''}${setsDelta} série(s) estruturada(s) · descrição, não meta</small></div></div><p class="tpdGuard">A comparação usa apenas a mesma unidade explícita. Maior carga e número de séries, isoladamente, não representam desempenho total nem recomendação de treino.</p>`;
  }
  function sessionRows(history){
    return history.slice(0,20).map(x=>{
      const loads=x.top.length?x.top.map(t=>`${fmtNum(t.value,Number.isInteger(t.value)?0:1)} ${safe(t.unit)}`).join(' · '):'carga comparável ausente';
      const reps=x.sets===0?'sem séries estruturadas':x.completeReps?`${fmtNum(x.repTotal,0)} reps em ${x.sets}/${x.sets} séries`:`reps numéricas em ${x.repKnown}/${x.sets} séries`;
      return `<div class="tpdRow"><time>${fmtDate(x.d)}</time><div><b>${loads}</b><small>${x.sets} série(s) estruturada(s) · ${reps}</small></div><span class="tpdQuality ${x.sets&&x.completeReps?'complete':'partial'}">${x.sets&&x.completeReps?'reps completas':'evidência parcial'}</span></div>`;
    }).join('')||'<div class="tpdEmpty">Sem sessões estruturadas.</div>';
  }
  function render(){
    const root=q('productTraining');if(!root||!window.state)return;
    let host=q('tpdHost');
    if(!host){host=document.createElement('section');host.id='tpdHost';host.className='tpdPanel';root.appendChild(host)}
    const all=groups(),term=norm(D.query),filtered=all.filter(g=>!term||norm(g.label).includes(term));
    if(!D.key||!filtered.some(g=>g.key===D.key))D.key=filtered[0]?.key||null;
    const selected=filtered.find(g=>g.key===D.key)||null,history=selected?sessionSummary(selected):[];
    host.innerHTML=`<div class="tpdHead"><div><div class="tpdKicker">PROGRESSÃO COMPARÁVEL</div><h2>Histórico por exercício, sessão a sessão</h2><p>Carga, séries e cobertura de repetições permanecem vinculadas ao que foi realmente registrado.</p></div><div class="tpdHeadMetric"><strong>${all.length}</strong><span>exercícios no histórico</span></div></div><div class="tpdGrid"><aside><input id="tpdSearch" type="search" value="${safe(D.query)}" placeholder="Buscar exercício"><div class="tpdList">${filtered.slice(0,120).map(g=>`<button data-tpd-key="${safe(g.key)}" class="${g.key===D.key?'active':''}"><b>${safe(g.label)}</b><small>${unique(g.rows.map(r=>day(r.workout_date))).length} sessão(ões)</small></button>`).join('')||'<div class="tpdEmpty">Nenhum exercício encontrado.</div>'}</div></aside><main>${selected?`<div class="tpdTitle"><div><h3>${safe(selected.label)}</h3><p>${history.length} sessão(ões) registradas · unidades nunca são misturadas ou convertidas por inferência</p></div></div>${comparisonCard(history)}<div class="tpdHistory"><div class="tpdSubhead"><b>Sessões registradas</b><span>repetições só são totalizadas quando todas as séries da sessão têm valor numérico</span></div>${sessionRows(history)}</div>`:'<div class="tpdEmpty">Selecione um exercício para abrir a progressão.</div>'}</main></div>`;
    q('tpdSearch')?.addEventListener('input',e=>{D.query=e.target.value;render()});
    host.querySelectorAll('[data-tpd-key]').forEach(b=>b.onclick=()=>{D.key=b.dataset.tpdKey;render()});
  }
  let timer=null;
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>{if(!q('tpdHost'))render()},40)}
  function observe(){const root=q('productTraining');if(!root)return;new MutationObserver(schedule).observe(root,{childList:true});}
  const prior=loadAll;loadAll=async function(){const out=await prior();render();return out};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(()=>{render();observe()},2350)});
})();
