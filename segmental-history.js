(function(){
  'use strict';
  const S={date:null,reference:null};
  const safe=v=>esc(v??'');
  const day=v=>String(v||'').slice(0,10);
  const num=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const rows=()=>[...(state.segmental||[])].filter(x=>x.measured_at).sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at)));
  const diff=(a,b)=>{a=num(a);b=num(b);if(a==null||b==null)return'—';const d=a-b;return`${d>0?'+':''}${fmtNum(d,2)} kg`};
  const fmtKg=v=>num(v)==null?'—':`${fmtNum(num(v),2)} kg`;
  const sourceLabel=r=>r?`${safe(r.source||'fonte não informada')}${r.confidence?` · confiança ${safe(r.confidence)}`:''}`:'sem referência selecionada';
  function pair(label,leftKey,rightKey,row,reference){
    const l=num(row?.[leftKey]),r=num(row?.[rightKey]),pl=num(reference?.[leftKey]),pr=num(reference?.[rightKey]);
    return `<div class="shPair"><div class="shPairHead"><b>${safe(label)}</b><small>diferença direita − esquerda: ${l!=null&&r!=null?`${r-l>0?'+':''}${fmtNum(r-l,2)} kg`:'—'}</small></div><div class="shSides"><div><span>Esquerda</span><strong>${fmtKg(l)}</strong><small>${reference&&pl!=null&&l!=null?`A − B ${diff(l,pl)}`:'sem comparação disponível'}</small></div><div><span>Direita</span><strong>${fmtKg(r)}</strong><small>${reference&&pr!=null&&r!=null?`A − B ${diff(r,pr)}`:'sem comparação disponível'}</small></div></div></div>`;
  }
  function render(){
    const root=q('productEvolution');if(!root)return;const all=rows();let host=q('segmentalHistoryProduct');
    if(!host){host=document.createElement('section');host.id='segmentalHistoryProduct';host.className='epPanel shPanel';root.appendChild(host)}
    if(!all.length){host.innerHTML='<div class="shHead"><div><b>Histórico segmentar</b><small>Sem medições segmentares estruturadas.</small></div></div>';return}
    if(!S.date||!all.some(x=>day(x.measured_at)===S.date))S.date=day(all.at(-1).measured_at);
    const curIndex=all.findIndex(x=>day(x.measured_at)===S.date),cur=all[curIndex];
    if(!S.reference||!all.some(x=>day(x.measured_at)===S.reference)||S.reference===S.date){
      const fallback=curIndex>0?all[curIndex-1]:all.find(x=>day(x.measured_at)!==S.date)||null;
      S.reference=fallback?day(fallback.measured_at):null;
    }
    const reference=S.reference?all.find(x=>day(x.measured_at)===S.reference)||null:null;
    const options=[...all].reverse().map(x=>`<option value="${day(x.measured_at)}">${fmtDate(x.measured_at)}</option>`).join('');
    const refOptions=[...all].reverse().filter(x=>day(x.measured_at)!==S.date).map(x=>`<option value="${day(x.measured_at)}">${fmtDate(x.measured_at)}</option>`).join('');
    host.innerHTML=`<div class="shHead"><div><b>Histórico segmentar detalhado</b><small>Compare duas medições registradas por região. Diferenças entre lados e datas são apenas descritivas e não classificam aparência, saúde ou desempenho.</small></div><div class="shCompareControls"><label>A · medição<select id="shDate">${options}</select></label><label>B · referência<select id="shReference" ${all.length<2?'disabled':''}>${refOptions||'<option value="">Sem outra medição</option>'}</select></label></div></div><div class="shMeta"><span>${all.length} medição(ões) segmentares</span><span>A: ${fmtDate(cur.measured_at)} · ${sourceLabel(cur)}</span><span>${reference?`B: ${fmtDate(reference.measured_at)} · ${sourceLabel(reference)}`:'sem segunda medição disponível'}</span></div><div class="shGrid">${pair('Braços · massa magra','lean_left_arm_kg','lean_right_arm_kg',cur,reference)}${pair('Pernas · massa magra','lean_left_leg_kg','lean_right_leg_kg',cur,reference)}${pair('Braços · gordura registrada','fat_left_arm_kg','fat_right_arm_kg',cur,reference)}${pair('Pernas · gordura registrada','fat_left_leg_kg','fat_right_leg_kg',cur,reference)}<div class="shPair"><div class="shPairHead"><b>Tronco</b><small>valor central, sem comparação lateral</small></div><div class="shSides"><div><span>Massa magra</span><strong>${fmtKg(cur.lean_trunk_kg)}</strong><small>${reference?`A − B ${diff(cur.lean_trunk_kg,reference.lean_trunk_kg)}`:'sem comparação disponível'}</small></div><div><span>Gordura registrada</span><strong>${fmtKg(cur.fat_trunk_kg)}</strong><small>${reference?`A − B ${diff(cur.fat_trunk_kg,reference.fat_trunk_kg)}`:'sem comparação disponível'}</small></div></div></div></div><div class="shNote">Somente valores estruturados das medições selecionadas são exibidos. Campo ausente permanece ausente; nenhuma estimativa, alvo corporal ou score de simetria é criado. A comparação não interpreta a direção da mudança como melhor ou pior.</div>`;
    q('shDate').value=S.date;if(reference&&q('shReference'))q('shReference').value=S.reference;
    q('shDate')?.addEventListener('change',e=>{S.date=e.target.value;S.reference=null;render()});
    q('shReference')?.addEventListener('change',e=>{S.reference=e.target.value||null;render()});
  }
  const prior=loadAll;loadAll=async function(){const out=await prior();setTimeout(render,0);return out};
  const evo=q('productEvolution');if(evo){const obs=new MutationObserver(()=>{if(!q('segmentalHistoryProduct'))setTimeout(render,0)});obs.observe(evo,{childList:true});}
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(render,2850)});
})();