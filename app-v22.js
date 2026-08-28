(function(){
  const V22={period:'90',type:'all',query:''};
  const ensure=(id,parent,before=null)=>{let e=q(id);if(e)return e;e=document.createElement('div');e.id=id;if(before)parent.insertBefore(e,before);else parent.appendChild(e);return e};
  const day=v=>String(v||'').slice(0,10);
  const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
  const cutoff=days=>{if(days==='all')return null;const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-Number(days)+1);return d.toISOString().slice(0,10)};
  const same=(a,b)=>day(a)===day(b);
  function install(){
    document.body.classList.add('healthV22');
    const timeline=q('timeline');
    const panel=ensure('v22Timeline',timeline,timeline?.querySelector('#timelineList'));panel.className='v22Panel';
    panel.innerHTML=`<div class="v22Head"><div><b>Navegador longitudinal</b><small>Filtre o histórico por período, domínio e termo. A visualização agrupa eventos reais por dia e mantém a origem disponível.</small></div><div class="v22Controls"><select id="v22Period"><option value="30">30 dias</option><option value="90" selected>90 dias</option><option value="365">1 ano</option><option value="all">Todo histórico</option></select><select id="v22Type"><option value="all">Todos os domínios</option><option value="Treino">Treino</option><option value="Nutrição">Nutrição</option><option value="Composição">Composição</option><option value="Exames">Exames</option><option value="Documento">Documentos</option><option value="Métrica">Atividade / sono</option><option value="Plano">Planos</option></select><input id="v22Query" type="search" placeholder="Buscar no período"></div></div><div id="v22Summary" class="v22Summary"></div><div id="v22TimelineBody" class="v22TimelineBody"></div>`;
    q('v22Period').addEventListener('change',e=>{V22.period=e.target.value;render()});
    q('v22Type').addEventListener('change',e=>{V22.type=e.target.value;render()});
    q('v22Query').addEventListener('input',e=>{V22.query=e.target.value;render()});
    const legacy=q('timelineList');if(legacy)legacy.classList.add('v22LegacyTimeline');
  }
  function allEvents(){
    try{return timelineEvents(state.canonicalWorkouts||[],state.body||[],state.labs||[],state.docs||[],state.plans||[],state.nutrition||[],state.metrics||[])}catch{return[]}
  }
  function filtered(){
    const c=cutoff(V22.period),term=norm(V22.query);
    return allEvents().filter(x=>(!c||day(x.date)>=c)&&(V22.type==='all'||x.type===V22.type)&&(!term||norm(`${x.type} ${x.title} ${x.sub} ${x.source}`).includes(term)));
  }
  function summary(events){
    const dates=[...new Set(events.map(x=>day(x.date)).filter(Boolean))];
    const types={};events.forEach(x=>types[x.type]=(types[x.type]||0)+1);
    const first=[...dates].sort()[0],last=[...dates].sort().at(-1);
    const top=Object.entries(types).sort((a,b)=>b[1]-a[1]).slice(0,4);
    q('v22Summary').innerHTML=`<div><span>Eventos exibidos</span><strong>${events.length}</strong></div><div><span>Dias com evidência</span><strong>${dates.length}</strong></div><div><span>Intervalo</span><strong>${first?`${fmtDate(first)} → ${fmtDate(last)}`:'—'}</strong></div><div><span>Domínios presentes</span><strong>${Object.keys(types).length}</strong><small>${top.map(([k,v])=>`${k} ${v}`).join(' · ')||'—'}</small></div>`;
  }
  function group(events){
    const map=new Map();for(const x of events){const d=day(x.date);if(!d)continue;if(!map.has(d))map.set(d,[]);map.get(d).push(x)}
    return [...map.entries()].sort((a,b)=>b[0].localeCompare(a[0]));
  }
  function icon(type){return({Treino:'T',Nutrição:'N',Composição:'C',Exames:'E',Documento:'D',Métrica:'A',Plano:'P'})[type]||'•'}
  function render(){
    if(!q('v22TimelineBody'))return;const events=filtered();summary(events);const groups=group(events);
    q('v22TimelineBody').innerHTML=groups.length?groups.map(([date,rows])=>`<section class="v22DayGroup"><header><div><b>${fmtDate(date)}</b><small>${new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long'})}</small></div><span>${rows.length} evento(s)</span></header><div class="v22Events">${rows.map(x=>`<article><i class="t-${norm(x.type).replaceAll(' ','-')}">${icon(x.type)}</i><div><span>${esc(x.type)}</span><b>${esc(x.title||'Registro')}</b><small>${esc(x.sub||'')}${x.source?` · fonte: ${esc(x.source)}`:''}</small></div></article>`).join('')}</div></section>`).join(''):'<div class="v22Empty">Nenhum evento corresponde aos filtros atuais.</div>';
  }
  function renderV22(){render();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v22 · longitudinal navigator + deep history filters · dedicated GitHub / Supabase · provenance first'}
  install();
  const prior=loadAll;loadAll=async function(){await prior();renderV22()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(renderV22,3350)});
})();
