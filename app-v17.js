(function(){
  const V17={search:''};
  const ensure=(id,parent,before=null)=>{let e=q(id);if(e)return e;e=document.createElement('div');e.id=id;if(before)parent.insertBefore(e,before);else parent.appendChild(e);return e};
  const day=v=>String(v||'').slice(0,10);
  const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const dateAgo=d=>{if(!d)return null;const t=new Date(day(d)+'T12:00:00').getTime();if(!Number.isFinite(t))return null;return Math.max(0,Math.floor((Date.now()-t)/86400000))};
  const recentCut=days=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-days+1);return d.toISOString().slice(0,10)};
  const unique=a=>[...new Set(a.filter(Boolean))];
  function freshness(label,date,detail){const age=dateAgo(date),tone=age==null?'missing':age<=7?'fresh':age<=30?'aging':'stale';const txt=age==null?'sem dado':age===0?'hoje':age===1?'1 dia':`${age} dias`;return `<div class="v17Fresh ${tone}"><div><span>${esc(label)}</span><strong>${txt}</strong></div><small>${esc(detail||'')}</small></div>`}
  function install(){
    document.body.classList.add('healthV17');
    const today=q('today');
    const command=ensure('v17Command',today,today?.firstChild);command.className='v17Command';
    const rhythm=ensure('v17Rhythm',today,q('v12Coverage')||today?.querySelector('.hero'));rhythm.className='v17Panel';
    const inbox=q('inbox');const upload=inbox?.querySelector('.uploadBox')||inbox?.firstChild;const apple=ensure('v17AppleGuide',inbox,upload);apple.className='v17Panel';
    const search=document.createElement('div');search.id='v17SearchModal';search.className='v17Modal hidden';search.innerHTML='<div class="v17SearchSheet"><div class="v17SearchHead"><div><b>Buscar no histórico</b><small>Treinos, exercícios, exames, documentos e medições.</small></div><button id="v17SearchClose">×</button></div><input id="v17SearchInput" type="search" placeholder="Digite um termo"><div id="v17SearchResults" class="v17SearchResults"></div></div>';document.body.appendChild(search);
    search.addEventListener('click',e=>{if(e.target===search)closeSearch()});q('v17SearchClose').onclick=closeSearch;q('v17SearchInput').addEventListener('input',e=>{V17.search=e.target.value;renderSearch()});
  }
  function openSearch(){q('v17SearchModal').classList.remove('hidden');setTimeout(()=>q('v17SearchInput')?.focus(),40)}
  function closeSearch(){q('v17SearchModal')?.classList.add('hidden')}
  function addSearchButton(){
    const top=document.querySelector('.hdr .top')||document.querySelector('.hdrin');if(!top||q('v17SearchBtn'))return;
    const b=document.createElement('button');b.id='v17SearchBtn';b.className='v17SearchBtn';b.textContent='Buscar';b.onclick=openSearch;top.appendChild(b);
  }
  function renderCommand(){
    const w=state.canonicalWorkouts||[],b=state.body||[],labs=state.labs||[],m=state.metrics||[],nut=state.nutrition||[];
    const lastW=w[0],lastB=b[0],lastLab=[...labs].sort((a,c)=>String(c.collection_date).localeCompare(String(a.collection_date)))[0],lastNut=[...nut].sort((a,c)=>String(c.nutrition_date).localeCompare(String(a.nutrition_date)))[0];
    const sleep=m.filter(x=>x.metric_type==='sleep_duration_h').sort((a,c)=>String(c.measured_at).localeCompare(String(a.measured_at)))[0];
    const cut=recentCut(7),w7=w.filter(x=>day(x.workout_date)>=cut),nut7=unique(nut.filter(x=>day(x.nutrition_date)>=cut).map(x=>day(x.nutrition_date))).length;
    const latestBody=[lastB?.weight_kg!=null?`${fmtNum(lastB.weight_kg,1)} kg`:null,lastB?.skeletal_muscle_mass_kg!=null?`${fmtNum(lastB.skeletal_muscle_mass_kg,1)} kg massa muscular`:null].filter(Boolean).join(' · ');
    q('v17Command').innerHTML=`<div class="v17CommandMain"><div><span class="v17Kicker">PAINEL ATUAL</span><h2>Seu histórico, sem ruído</h2><p>Resumo descritivo das fontes conectadas. Ausências ficam explícitas; nenhuma lacuna vira score inventado.</p></div><button class="v17CommandSearch" id="v17CommandSearch">Buscar histórico</button></div><div class="v17NowGrid"><div class="v17Now"><span>Último treino</span><strong>${lastW?fmtDate(lastW.workout_date):'—'}</strong><small>${esc(lastW?.workout_type||'sem sessão registrada')}</small></div><div class="v17Now"><span>Última composição</span><strong>${lastB?fmtDate(lastB.measured_at):'—'}</strong><small>${esc(latestBody||'sem medição estruturada')}</small></div><div class="v17Now"><span>Treinos · 7 dias</span><strong>${w7.length}</strong><small>sessões canônicas registradas</small></div><div class="v17Now"><span>Nutrição · 7 dias</span><strong>${nut7}/7</strong><small>dias com registro disponível</small></div></div><div class="v17FreshGrid">${freshness('Treino',lastW?.workout_date,lastW?.source||'fonte registrada')}${freshness('Composição',lastB?.measured_at,lastB?.source||'fonte registrada')}${freshness('Nutrição',lastNut?.nutrition_date,lastNut?.source||'MyFitnessPal')}${freshness('Sono',sleep?.measured_at,sleep?.source||'Apple Health pendente')}${freshness('Laboratório',lastLab?.collection_date,lastLab?.laboratory||'coleta estruturada')}</div>`;
    q('v17CommandSearch').onclick=openSearch;
  }
  function domainByDay(){
    const out=new Map(),touch=(d,k)=>{d=day(d);if(!d)return;(out.get(d)||out.set(d,{date:d}).get(d))[k]=true};
    (state.canonicalWorkouts||[]).forEach(x=>touch(x.workout_date,'training'));
    (state.nutrition||[]).forEach(x=>touch(x.nutrition_date,'nutrition'));
    (state.body||[]).forEach(x=>touch(x.measured_at,'body'));
    (state.labs||[]).forEach(x=>touch(x.collection_date,'labs'));
    (state.metrics||[]).forEach(x=>{if(['sleep_duration_h','steps','active_energy_kcal','exercise_minutes','resting_heart_rate_bpm'].includes(x.metric_type))touch(x.measured_at,'metrics')});
    return out;
  }
  function renderRhythm(){
    const map=domainByDay(),days=[];for(let i=13;i>=0;i--){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-i);days.push(d.toISOString().slice(0,10))}
    const label={training:'T',nutrition:'N',body:'C',labs:'E',metrics:'A'};
    const cells=days.map(d=>{const x=map.get(d)||{};const marks=Object.keys(label).filter(k=>x[k]).map(k=>`<i class="${k}" title="${k}">${label[k]}</i>`).join('');return `<div class="v17Day"><b>${d.slice(8,10)}</b><small>${new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','')}</small><div>${marks||'<em>—</em>'}</div></div>`}).join('');
    q('v17Rhythm').innerHTML=`<div class="v17Head"><div><b>Mapa dos últimos 14 dias</b><small>Presença de dados por dia; não é avaliação de aderência ou performance.</small></div><div class="v17Legend"><span><i class="training">T</i> treino</span><span><i class="nutrition">N</i> nutrição</span><span><i class="body">C</i> composição</span><span><i class="labs">E</i> exames</span><span><i class="metrics">A</i> atividade/sono</span></div></div><div class="v17Days">${cells}</div>`;
  }
  function renderAppleGuide(){
    const metrics=state.metrics||[],apple=metrics.filter(x=>/apple health/i.test(String(x.source||''))),uploads=(state.uploads||[]).filter(x=>x.source_type==='apple_health');
    const supported=['atividade diária','sono','passos sem sobreposição','FC de repouso quando consolidável'];
    q('v17AppleGuide').innerHTML=`<div class="v17Head"><div><b>Apple Health</b><small>Importador conservador pronto para ZIP ou export.xml.</small></div><span class="v17AppleState ${apple.length?'ready':'pending'}">${apple.length?'dados importados':'aguardando export'}</span></div><div class="v17AppleGrid"><div><span>Métricas Apple normalizadas</span><strong>${apple.length}</strong></div><div><span>Uploads Apple recebidos</span><strong>${uploads.length}</strong></div></div><div class="v17AppleTags">${supported.map(x=>`<span>${esc(x)}</span>`).join('')}</div><p>O parser só consolida automaticamente quando consegue evitar dupla contagem. Registros ambíguos permanecem para revisão.</p>`;
  }
  function searchRows(){
    const rows=[];
    (state.canonicalWorkouts||[]).forEach(x=>rows.push({type:'Treino',date:x.workout_date,title:x.workout_type||'Treino',sub:x.location||''}));
    (state.exercises||[]).forEach(x=>rows.push({type:'Exercício',date:x.workout_date,title:x.exercise,sub:[x.muscle_group,x.machine].filter(Boolean).join(' · ')}));
    (state.labs||[]).forEach(x=>rows.push({type:'Exame',date:x.collection_date,title:x.biomarker,sub:[x.result_raw,x.laboratory].filter(Boolean).join(' · ')}));
    (state.docs||[]).forEach(x=>rows.push({type:'Documento',date:x.document_date,title:x.title,sub:x.document_type||''}));
    (state.body||[]).forEach(x=>rows.push({type:'Composição',date:x.measured_at,title:`Medição corporal · ${x.weight_kg!=null?fmtNum(x.weight_kg,1)+' kg':'peso não informado'}`,sub:x.source||''}));
    return rows;
  }
  function renderSearch(){
    const term=norm(V17.search),box=q('v17SearchResults');if(!box)return;if(term.length<2){box.innerHTML='<div class="v17SearchEmpty">Digite pelo menos 2 caracteres.</div>';return}
    const r=searchRows().filter(x=>norm(`${x.type} ${x.title} ${x.sub}`).includes(term)).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,80);
    box.innerHTML=r.length?r.map(x=>`<div class="v17SearchRow"><div><span>${esc(x.type)}</span><b>${esc(x.title)}</b><small>${fmtDate(x.date)}${x.sub?` · ${esc(x.sub)}`:''}</small></div></div>`).join(''):'<div class="v17SearchEmpty">Nenhum registro corresponde à busca.</div>';
  }
  function renderV17(){addSearchButton();renderCommand();renderRhythm();renderAppleGuide();renderSearch();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v17 · unified command center + global history search · dedicated GitHub / Supabase · provenance first'}
  install();
  const prior=loadAll;
  loadAll=async function(){await prior();renderV17()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(renderV17,2100)});
})();
