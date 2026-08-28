(function(){
  const VALID=new Set(['today','timeline','evolution','training','health','nutrition','insights','inbox']);
  const ensureButton=(id,label,parent)=>{let b=q(id);if(b)return b;b=document.createElement('button');b.id=id;b.textContent=label;parent?.appendChild(b);return b};
  function install(){
    document.body.classList.add('healthV24');
    const actions=document.querySelector('.topActions');
    const refresh=ensureButton('v24Refresh','Atualizar',actions);refresh.className='v24Refresh';refresh.onclick=async()=>{if(refresh.disabled)return;refresh.disabled=true;refresh.textContent='Atualizando…';try{await loadAll()}finally{refresh.disabled=false;refresh.textContent='Atualizar'}};
    const net=document.createElement('span');net.id='v24Network';net.className='v24Network';actions?.insertBefore(net,refresh);updateNetwork();
    window.addEventListener('online',updateNetwork);window.addEventListener('offline',updateNetwork);
    const priorActivate=activateTab;
    activateTab=function(tab){priorActivate(tab);if(!VALID.has(tab))return;try{localStorage.setItem('lts-health:last-tab',tab)}catch{}if(location.hash!==`#${tab}`)history.replaceState(null,'',`${location.pathname}${location.search}#${tab}`)};
    document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.v24Bound)return;b.dataset.v24Bound='1';b.addEventListener('click',()=>{if(VALID.has(b.dataset.tab))activateTab(b.dataset.tab)})});
    window.addEventListener('hashchange',restoreRoute);
    installUpdateWatcher();
  }
  function updateNetwork(){const e=q('v24Network');if(!e)return;const on=navigator.onLine;e.className='v24Network '+(on?'online':'offline');e.textContent=on?'online':'offline'}
  function restoreRoute(){
    if(!currentSession)return;let tab=location.hash.replace('#','');if(!VALID.has(tab)){try{tab=localStorage.getItem('lts-health:last-tab')}catch{} }if(!VALID.has(tab))tab='today';activateTab(tab)
  }
  function installUpdateWatcher(){
    if(!('serviceWorker'in navigator))return;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(q('v24Update'))return;const el=document.createElement('div');el.id='v24Update';el.className='v24Update';el.innerHTML='<span>Uma versão nova do LTS Health foi ativada.</span><button>Recarregar</button>';document.body.appendChild(el);el.querySelector('button').onclick=()=>location.reload()});
  }
  function renderV24(){restoreRoute();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v24 · persistent navigation + refresh resilience · dedicated GitHub / Supabase · provenance first'}
  install();const prior=loadAll;loadAll=async function(){await prior();renderV24()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(renderV24,3800)});
})();
