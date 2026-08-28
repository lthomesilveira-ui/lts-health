(function(){
  'use strict';
  const C={evolutionMode:'bio',coreKey:'bio',treatments:[],treatmentsLoaded:false};
  try{C.evolutionMode=localStorage.getItem('lts-health:evolution-mode')||'bio';C.coreKey=localStorage.getItem('lts-health:core-key')||'bio'}catch{}
  const day=v=>String(v||'').slice(0,10);
  const num=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const safe=v=>esc(v??'');
  const bodyRows=()=>[...(state.body||[])].filter(x=>x.measured_at).sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at)));
  const latestBody=()=>bodyRows().at(-1)||null;
  const dtext=(a,b,d=1,unit='')=>{a=num(a);b=num(b);if(a==null||b==null)return'—';const x=a-b;return`${x>0?'+':''}${fmtNum(x,d)}${unit?' '+unit:''}`};
  const stat=(label,value,unit='',sub='')=>`<div class="cpStat"><span>${safe(label)}</span><strong>${value==null?'—':safe(value)}${value!=null&&unit?`<em>${safe(unit)}</em>`:''}</strong>${sub?`<small>${safe(sub)}</small>`:''}</div>`;

  function installCoreNavigation(){
    const hdr=document.querySelector('.hdrin');if(!hdr)return;
    const legacy=hdr.querySelector('.nav');if(legacy)legacy.classList.add('cpLegacyNav');
    let nav=q('cpCoreNav');
    if(!nav){
      nav=document.createElement('nav');nav.id='cpCoreNav';nav.className='cpCoreNav';
      nav.innerHTML=`<button data-cp-core="bio">Bio</button><button data-cp-core="treinos">Treinos</button><button data-cp-core="evolucao">Evolução</button><button data-cp-core="analise">Análise</button><button data-cp-core="tratamentos">Tratamentos</button><button class="more" data-cp-core="mais">Mais</button>`;
      (legacy||hdr.lastElementChild)?.insertAdjacentElement('afterend',nav);
      nav.querySelectorAll('[data-cp-core]').forEach(b=>b.onclick=()=>activateCore(b.dataset.cpCore));
    }
    if(!q('cpMobileDock')){
      const d=document.createElement('nav');d.id='cpMobileDock';d.className='cpMobileDock';d.innerHTML=`<button data-cp-core="bio">Bio</button><button data-cp-core="treinos">Treinos</button><button data-cp-core="evolucao">Evolução</button><button data-cp-core="analise">Análise</button><button class="more" data-cp-core="mais">Mais</button>`;document.body.appendChild(d);d.querySelectorAll('[data-cp-core]').forEach(b=>b.onclick=()=>activateCore(b.dataset.cpCore));
    }
    document.querySelector('.mobileDock')?.classList.add('cpLegacyMobileDock');
    updateCoreActive();
  }

  function openMore(){
    let m=q('cpMore');if(m)m.remove();m=document.createElement('div');m.id='cpMore';m.className='cpMore';m.innerHTML=`<div class="cpMoreSheet"><div class="cpMoreHead"><div><b>LTS Health completo</b><small>Além do núcleo que existia no Claude</small></div><button data-close>×</button></div><div class="cpMoreGrid"><button data-go="today">Hoje</button><button data-go="timeline">Timeline</button><button data-go="health">Saúde & exames</button><button data-core="tratamentos">Tratamentos</button><button data-go="nutrition">Nutrição</button><button data-go="inbox">Dados / Inbox</button></div><p>O núcleo Bio · Treinos · Evolução · Análise permanece na navegação principal; as fontes novas ficam acessíveis aqui sem perder a experiência anterior.</p></div>`;document.body.appendChild(m);m.onclick=e=>{if(e.target===m||e.target.closest('[data-close]'))m.remove();const go=e.target.closest('[data-go]');if(go){C.coreKey='';activateTab(go.dataset.go);m.remove()}const core=e.target.closest('[data-core]');if(core){m.remove();activateCore(core.dataset.core)}};
  }
  function activateCore(key){
    if(key==='mais'){openMore();return}
    C.coreKey=key;try{localStorage.setItem('lts-health:core-key',key)}catch{}
    if(key==='bio'){setEvolutionMode('bio');activateTab('evolution')}
    if(key==='treinos')activateTab('training');
    if(key==='evolucao'){setEvolutionMode('segmental');activateTab('evolution')}
    if(key==='analise')activateTab('insights');
    if(key==='tratamentos'){activateTab('health');setTimeout(()=>q('cpTreatments')?.scrollIntoView({behavior:'smooth',block:'start'}),80)}
    updateCoreActive();
  }
  function updateCoreActive(){
    let key=C.coreKey;
    if(document.getElementById('training')&&!document.getElementById('training').classList.contains('hidden'))key='treinos';
    if(document.getElementById('insights')&&!document.getElementById('insights').classList.contains('hidden'))key='analise';
    if(document.getElementById('evolution')&&!document.getElementById('evolution').classList.contains('hidden'))key=C.evolutionMode==='segmental'?'evolucao':'bio';
    document.querySelectorAll('[data-cp-core]').forEach(b=>b.classList.toggle('active',b.dataset.cpCore===key));
  }

  function relabelNavigation(){
    document.querySelectorAll('[data-tab="training"]').forEach(b=>{if(b.textContent.trim()==='Treino')b.textContent='Treinos'});
    document.querySelectorAll('[data-tab="insights"]').forEach(b=>b.textContent='Análise');
    const more=q('productMoreModal');more?.querySelectorAll('[data-go="insights"]').forEach(b=>b.textContent='Análise');
    const brand=document.querySelector('.brandtext small');if(brand)brand.textContent='Bio · Treinos · Evolução · Análise · histórico longitudinal';
  }

  function renderHeaderStats(){
    const anchor=q('cpCoreNav')||document.querySelector('.hdr .nav');if(!anchor)return;let host=q('claudeParityStats');if(!host){host=document.createElement('div');host.id='claudeParityStats';host.className='cpStats';anchor.insertAdjacentElement('afterend',host)}
    const rows=bodyRows(),b=rows.at(-1),p=rows.at(-2);
    const sub=(k,d=1,u='')=>b&&p?`vs anterior ${dtext(b[k],p[k],d,u)}`:'sem comparação anterior';
    host.innerHTML=`<div class="cpStatsMeta"><b>Última bio</b><span>${b?fmtDate(b.measured_at):'sem medição'}${b?.source?` · ${safe(b.source)}`:''}</span></div><div class="cpStatsGrid">${stat('Peso',num(b?.weight_kg)!=null?fmtNum(b.weight_kg,1):null,'kg',sub('weight_kg',1,'kg'))}${stat('MME',num(b?.skeletal_muscle_mass_kg)!=null?fmtNum(b.skeletal_muscle_mass_kg,1):null,'kg',sub('skeletal_muscle_mass_kg',1,'kg'))}${stat('Gordura',num(b?.body_fat_pct)!=null?fmtNum(b.body_fat_pct,1):null,'%',sub('body_fat_pct',1,'%'))}${stat('Visceral',num(b?.visceral_fat_level)!=null?fmtNum(b.visceral_fat_level,0):null,'nív',sub('visceral_fat_level',0))}${stat('InBody',num(b?.score)!=null?fmtNum(b.score,0):null,'/100',sub('score',0))}</div>`;
  }

  function setEvolutionMode(mode){C.evolutionMode=mode==='segmental'?'segmental':'bio';try{localStorage.setItem('lts-health:evolution-mode',C.evolutionMode)}catch{}applyEvolutionMode();updateCoreActive()}
  function applyEvolutionMode(){
    const root=q('productEvolution');if(!root)return;let tabs=q('cpEvolutionTabs');const title=root.querySelector('.epTitle');
    if(title&&!tabs){tabs=document.createElement('div');tabs.id='cpEvolutionTabs';tabs.className='cpEvolutionTabs';tabs.innerHTML='<button type="button" data-cp-mode="bio">Bio</button><button type="button" data-cp-mode="segmental">Evolução segmentar</button>';title.insertAdjacentElement('afterend',tabs);tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>setEvolutionMode(b.dataset.cpMode))}
    tabs?.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.cpMode===C.evolutionMode));root.classList.toggle('cpBioMode',C.evolutionMode==='bio');root.classList.toggle('cpSegmentalMode',C.evolutionMode==='segmental');
    const current=root.querySelector('.epCurrent'),panels=[...root.children].filter(x=>x.classList?.contains('epPanel')),series=panels.find(x=>!x.classList.contains('epHistoryPanel')&&x.id!=='segmentalHistoryProduct'),grid=root.querySelector('.epGrid'),compare=grid?.children?.[0]||null,segmentSummary=grid?.children?.[1]||null,history=root.querySelector('.epHistoryPanel'),segmentDetail=q('segmentalHistoryProduct'),classic=q('cpBioClassic');const bio=C.evolutionMode==='bio';
    [current,series,history,classic].forEach(x=>{if(x)x.hidden=!bio});if(compare)compare.hidden=!bio;if(segmentSummary)segmentSummary.hidden=bio;if(segmentDetail)segmentDetail.hidden=bio;
    const h1=title?.querySelector('h1');if(h1)h1.textContent=bio?'Bio':'Evolução segmentar';const p=title?.querySelector('p');if(p)p.textContent=bio?'Gráficos, histórico e comparação entre bioimpedâncias — reconstruídos a partir dos registros canônicos.':'Massa magra e gordura por segmento, comparação entre datas e diferenças D/E usando somente medições observadas.';const add=q('epAdd');if(add)add.style.display=bio?'':'none';
  }

  function linePath(rows,key,x,y){return rows.map((r,i)=>num(r[key])!=null?`${i?'L':'M'}${x(i).toFixed(1)} ${y(num(r[key])).toFixed(1)}`:'').filter(Boolean).join(' ')}
  function renderBioClassic(){
    const root=q('productEvolution');if(!root)return;let host=q('cpBioClassic');if(!host){host=document.createElement('section');host.id='cpBioClassic';host.className='cpBioClassic';const tabs=q('cpEvolutionTabs');tabs?.insertAdjacentElement('afterend',host)}
    const rows=bodyRows(),last=rows.at(-1),prev=rows.at(-2),first=rows[0];if(!rows.length){host.innerHTML='<div class="cpEmpty">Sem bioimpedâncias estruturadas.</div>';return}
    const keys=['weight_kg','skeletal_muscle_mass_kg','fat_mass_kg'],values=rows.flatMap(r=>keys.map(k=>num(r[k])).filter(v=>v!=null));const w=980,h=230,p=28,min0=Math.min(...values),max0=Math.max(...values),pad=(max0-min0||1)*.06,min=min0-pad,max=max0+pad,span=max-min||1,x=i=>p+i*(w-p*2)/Math.max(1,rows.length-1),y=v=>p+(max-v)*(h-p*2)/span;
    const paths={weight:linePath(rows,'weight_kg',x,y),muscle:linePath(rows,'skeletal_muscle_mass_kg',x,y),fat:linePath(rows,'fat_mass_kg',x,y)};
    const card=(label,key,unit,d=1)=>`<div class="cpMetric"><span>${label}</span><strong>${num(last?.[key])!=null?fmtNum(last[key],d)+' '+unit:'—'}</strong><small>vs anterior ${prev?dtext(last[key],prev[key],d,unit):'—'} · vs primeiro ${first?dtext(last[key],first[key],d,unit):'—'}</small></div>`;
    host.innerHTML=`<div class="cpClassicHead"><div><span>PARIDADE CLAUDE · BIO</span><h2>Visão rápida da composição</h2><p>Mesma lógica central do app anterior: estado atual, diferença para a medição anterior e série histórica. As direções são descritivas, sem classificar aparência como melhor ou pior.</p></div><button id="cpAddBio">+ Bioimpedância</button></div><div class="cpMetricGrid">${card('Peso','weight_kg','kg')}${card('MME','skeletal_muscle_mass_kg','kg')}${card('Gordura','fat_mass_kg','kg')}${card('% gordura','body_fat_pct','%')}</div><div class="cpChartCard"><div class="cpChartHead"><b>Peso · MME · Gordura (kg)</b><div class="cpLegend"><span class="weight">Peso</span><span class="muscle">MME</span><span class="fat">Gordura</span></div></div><svg class="cpMultiChart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path class="weight" d="${paths.weight}"/><path class="muscle" d="${paths.muscle}"/><path class="fat" d="${paths.fat}"/></svg><div class="cpChartAxis"><span>${fmtDate(rows[0].measured_at)}</span><span>${rows.length} medições</span><span>${fmtDate(rows.at(-1).measured_at)}</span></div></div>`;
    q('cpAddBio').onclick=()=>q('v14AddBody')?.click();applyEvolutionMode();
  }

  async function loadTreatments(){
    if(C.treatmentsLoaded||!currentSession?.user)return;C.treatmentsLoaded=true;
    try{const r=await sb.from('health_medication_events').select('event_date,medication,event_type,source,confidence').order('event_date',{ascending:false}).limit(80);if(r.error)throw r.error;C.treatments=r.data||[]}catch(e){C.treatmentsLoaded=false;console.error('LTS Health treatment history',e)}
  }
  function renderTreatments(){
    const root=q('productHealth');if(!root)return;let host=q('cpTreatments');if(!host){host=document.createElement('section');host.id='cpTreatments';host.className='cpTreatments';root.appendChild(host)}const rows=C.treatments;
    host.innerHTML=`<div class="cpTreatmentHead"><div><span>TRATAMENTOS · CONTEXTO LONGITUDINAL</span><h2>Histórico registrado</h2><p>Recupera a função de contexto temporal que existia no Claude, em formato seguro: datas, nomes, fonte e confiança. Esta tela não mostra doses, ciclos, frequências, locais de aplicação nem instruções de uso.</p></div><span class="cpTreatmentCount">${rows.length} evento(s)</span></div><div class="cpTreatmentList">${rows.length?rows.slice(0,36).map(x=>`<div class="cpTreatmentRow"><time>${fmtDate(x.event_date)}</time><div><b>${safe(x.medication||'Tratamento')}</b><small>${safe(x.source||'fonte registrada')} · confiança ${safe(x.confidence||'não classificada')}</small></div><span>histórico</span></div>`).join(''):'<div class="cpEmpty">Nenhum evento de tratamento estruturado.</div>'}</div><p class="cpTreatmentFoot">O histórico serve para organizar contexto ao comparar datas de exames, sintomas e outras medições. Decisões sobre tratamentos pertencem ao profissional de saúde responsável.</p>`;
  }

  function relabelAnalysis(){const root=q('productInsights');if(!root)return;const h1=root.querySelector('.epTitle h1');if(h1)h1.textContent='Análise';const kicker=root.querySelector('.epKicker');if(kicker)kicker.textContent='ANÁLISE CONSOLIDADA · EVIDÊNCIA CRUZADA'}
  async function renderParity(){installCoreNavigation();relabelNavigation();renderHeaderStats();renderBioClassic();applyEvolutionMode();relabelAnalysis();await loadTreatments();renderTreatments();updateCoreActive()}

  const priorActivate=activateTab;activateTab=function(tab){priorActivate(tab);setTimeout(updateCoreActive,0)};
  const prior=loadAll;loadAll=async function(){const out=await prior();await renderParity();return out};
  const evo=q('productEvolution');if(evo){let lock=false;new MutationObserver(()=>{if(lock)return;lock=true;requestAnimationFrame(()=>{renderBioClassic();applyEvolutionMode();lock=false})}).observe(evo,{childList:true,subtree:false})}
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(renderParity,3400)});
})();
