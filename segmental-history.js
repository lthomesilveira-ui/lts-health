(function(){
  'use strict';
  const S={date:null};
  const safe=v=>esc(v??'');
  const day=v=>String(v||'').slice(0,10);
  const num=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const rows=()=>[...(state.segmental||[])].filter(x=>x.measured_at).sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at)));
  const diff=(a,b)=>{a=num(a);b=num(b);if(a==null||b==null)return'—';const d=a-b;return`${d>0?'+':''}${fmtNum(d,2)} kg`};
  const fmtKg=v=>num(v)==null?'—':`${fmtNum(num(v),2)} kg`;
  function pair(label,leftKey,rightKey,row,previous){
    const l=num(row?.[leftKey]),r=num(row?.[rightKey]),pl=num(previous?.[leftKey]),pr=num(previous?.[rightKey]);
    return `<div class="shPair"><div class="shPairHead"><b>${safe(label)}</b><small>diferença direita − esquerda: ${l!=null&&r!=null?`${r-l>0?'+':''}${fmtNum(r-l,2)} kg`:'—'}</small></div><div class="shSides"><div><span>Esquerda</span><strong>${fmtKg(l)}</strong><small>${previous&&pl!=null&&l!=null?`vs. medição anterior ${diff(l,pl)}`:'sem comparação anterior'}</small></div><div><span>Direita</span><strong>${fmtKg(r)}</strong><small>${previous&&pr!=null&&r!=null?`vs. medição anterior ${diff(r,pr)}`:'sem comparação anterior'}</small></div></div></div>`;
  }
  function render(){
    const root=q('productEvolution');if(!root)return;const all=rows();let host=q('segmentalHistoryProduct');
    if(!host){host=document.createElement('section');host.id='segmentalHistoryProduct';host.className='epPanel shPanel';root.appendChild(host)}
    if(!all.length){host.innerHTML='<div class="shHead"><div><b>Histórico segmentar</b><small>Sem medições segmentares estruturadas.</small></div></div>';return}
    if(!S.date||!all.some(x=>day(x.measured_at)===S.date))S.date=day(all.at(-1).measured_at);
    const idx=all.findIndex(x=>day(x.measured_at)===S.date),cur=all[idx],prev=idx>0?all[idx-1]:null;
    const options=[...all].reverse().map(x=>`<option value="${day(x.measured_at)}" ${day(x.measured_at)===S.date?'selected':''}>${fmtDate(x.measured_at)}</option>`).join('');
    host.innerHTML=`<div class="shHead"><div><b>Histórico segmentar detalhado</b><small>Compare medições registradas por região. Diferenças entre lados são apenas descritivas e não classificam aparência, saúde ou desempenho.</small></div><label>Medição<select id="shDate">${options}</select></label></div><div class="shMeta"><span>${all.length} medição(ões) segmentares</span><span>${prev?`comparação anterior: ${fmtDate(prev.measured_at)}`:'primeira medição segmentar disponível'}</span></div><div class="shGrid">${pair('Braços · massa magra','lean_left_arm_kg','lean_right_arm_kg',cur,prev)}${pair('Pernas · massa magra','lean_left_leg_kg','lean_right_leg_kg',cur,prev)}${pair('Braços · gordura registrada','fat_left_arm_kg','fat_right_arm_kg',cur,prev)}${pair('Pernas · gordura registrada','fat_left_leg_kg','fat_right_leg_kg',cur,prev)}<div class="shPair"><div class="shPairHead"><b>Tronco</b><small>valor central, sem comparação lateral</small></div><div class="shSides"><div><span>Massa magra</span><strong>${fmtKg(cur.lean_trunk_kg)}</strong><small>${prev?`vs. medição anterior ${diff(cur.lean_trunk_kg,prev.lean_trunk_kg)}`:'sem comparação anterior'}</small></div><div><span>Gordura registrada</span><strong>${fmtKg(cur.fat_trunk_kg)}</strong><small>${prev?`vs. medição anterior ${diff(cur.fat_trunk_kg,prev.fat_trunk_kg)}`:'sem comparação anterior'}</small></div></div></div></div><div class="shNote">Somente valores estruturados da medição selecionada são exibidos. Campo ausente permanece ausente; nenhuma estimativa, alvo corporal ou score de simetria é criado.</div>`;
    q('shDate')?.addEventListener('change',e=>{S.date=e.target.value;render()});
  }
  const prior=loadAll;loadAll=async function(){const out=await prior();setTimeout(render,0);return out};
  const evo=q('productEvolution');if(evo){const obs=new MutationObserver(()=>{if(!q('segmentalHistoryProduct'))setTimeout(render,0)});obs.observe(evo,{childList:true});}
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(render,2850)});
})();