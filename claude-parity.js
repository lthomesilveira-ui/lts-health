(function(){
  'use strict';
  const C={evolutionMode:'bio'};
  try{C.evolutionMode=localStorage.getItem('lts-health:evolution-mode')||'bio'}catch{}
  const day=v=>String(v||'').slice(0,10);
  const num=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const safe=v=>esc(v??'');
  const latestBody=()=>[...(state.body||[])].filter(x=>x.measured_at).sort((a,b)=>String(b.measured_at).localeCompare(String(a.measured_at)))[0]||null;
  const stat=(label,value,unit='')=>`<div class="cpStat"><span>${safe(label)}</span><strong>${value==null?'—':safe(value)}${value!=null&&unit?`<em>${safe(unit)}</em>`:''}</strong></div>`;

  function relabelNavigation(){
    document.querySelectorAll('[data-tab="training"]').forEach(b=>{if(b.textContent.trim()==='Treino')b.textContent='Treinos'});
    document.querySelectorAll('[data-tab="insights"]').forEach(b=>b.textContent='Análise');
    const more=q('productMoreModal');
    more?.querySelectorAll('[data-go="insights"]').forEach(b=>b.textContent='Análise');
    const brand=document.querySelector('.brandtext small');if(brand)brand.textContent='Bio · Treinos · Evolução · Análise · histórico longitudinal';
  }

  function renderHeaderStats(){
    const nav=document.querySelector('.hdr .nav');if(!nav)return;let host=q('claudeParityStats');if(!host){host=document.createElement('div');host.id='claudeParityStats';host.className='cpStats';nav.insertAdjacentElement('afterend',host)}
    const b=latestBody();
    host.innerHTML=`<div class="cpStatsMeta"><b>Última bio</b><span>${b?fmtDate(b.measured_at):'sem medição'}${b?.source?` · ${safe(b.source)}`:''}</span></div><div class="cpStatsGrid">${stat('Peso',num(b?.weight_kg)!=null?fmtNum(b.weight_kg,1):null,'kg')}${stat('MME',num(b?.skeletal_muscle_mass_kg)!=null?fmtNum(b.skeletal_muscle_mass_kg,1):null,'kg')}${stat('Gordura',num(b?.body_fat_pct)!=null?fmtNum(b.body_fat_pct,1):null,'%')}${stat('Visceral',num(b?.visceral_fat_level)!=null?fmtNum(b.visceral_fat_level,0):null,'nív')}${stat('InBody',num(b?.score)!=null?fmtNum(b.score,0):null,'/100')}</div>`;
  }

  function setEvolutionMode(mode){C.evolutionMode=mode==='segmental'?'segmental':'bio';try{localStorage.setItem('lts-health:evolution-mode',C.evolutionMode)}catch{}applyEvolutionMode()}
  function applyEvolutionMode(){
    const root=q('productEvolution');if(!root)return;
    let tabs=q('cpEvolutionTabs');
    const title=root.querySelector('.epTitle');
    if(title&&!tabs){tabs=document.createElement('div');tabs.id='cpEvolutionTabs';tabs.className='cpEvolutionTabs';tabs.innerHTML='<button type="button" data-cp-mode="bio">Bio</button><button type="button" data-cp-mode="segmental">Evolução segmentar</button>';title.insertAdjacentElement('afterend',tabs);tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>setEvolutionMode(b.dataset.cpMode))}
    tabs?.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.cpMode===C.evolutionMode));
    root.classList.toggle('cpBioMode',C.evolutionMode==='bio');root.classList.toggle('cpSegmentalMode',C.evolutionMode==='segmental');
    const current=root.querySelector('.epCurrent');
    const panels=[...root.children].filter(x=>x.classList?.contains('epPanel'));
    const series=panels.find(x=>!x.classList.contains('epHistoryPanel')&&x.id!=='segmentalHistoryProduct');
    const grid=root.querySelector('.epGrid');
    const compare=grid?.children?.[0]||null,segmentSummary=grid?.children?.[1]||null;
    const history=root.querySelector('.epHistoryPanel'),segmentDetail=q('segmentalHistoryProduct');
    const bio=C.evolutionMode==='bio';
    [current,series,history].forEach(x=>{if(x)x.hidden=!bio});
    if(compare)compare.hidden=!bio;
    if(segmentSummary)segmentSummary.hidden=bio;
    if(segmentDetail)segmentDetail.hidden=bio;
    const h1=title?.querySelector('h1');if(h1)h1.textContent=bio?'Bio':'Evolução segmentar';
    const p=title?.querySelector('p');if(p)p.textContent=bio?'Gráficos, histórico e comparação entre bioimpedâncias — reconstruídos a partir dos registros canônicos.':'Massa magra e gordura por segmento, comparação entre datas e diferenças D/E usando somente medições observadas.';
    const add=q('epAdd');if(add)add.style.display=bio?'':'none';
  }

  function relabelAnalysis(){
    const root=q('productInsights');if(!root)return;const h1=root.querySelector('.epTitle h1');if(h1)h1.textContent='Análise';const kicker=root.querySelector('.epKicker');if(kicker)kicker.textContent='ANÁLISE CONSOLIDADA · EVIDÊNCIA CRUZADA';
  }

  function renderParity(){relabelNavigation();renderHeaderStats();applyEvolutionMode();relabelAnalysis()}
  const prior=loadAll;loadAll=async function(){const out=await prior();setTimeout(renderParity,0);return out};
  const evo=q('productEvolution');if(evo){let lock=false;new MutationObserver(()=>{if(lock)return;lock=true;requestAnimationFrame(()=>{applyEvolutionMode();lock=false})}).observe(evo,{childList:true,subtree:false})}
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(renderParity,3300)});
})();
