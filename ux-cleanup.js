(function(){
  'use strict';
  const map={bio:'evolution',treinos:'training',evolucao:'evolution',analise:'insights',tratamentos:'health'};
  const visible=id=>{const e=document.getElementById(id);return !!e&&!e.classList.contains('hidden')};
  function forceTab(tab){
    if(!tab)return;
    document.querySelectorAll('.tab').forEach(x=>x.classList.add('hidden'));
    document.getElementById(tab)?.classList.remove('hidden');
    document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  }
  function syncCore(){
    let key='';
    if(visible('training'))key='treinos';
    else if(visible('insights'))key='analise';
    else if(visible('evolution')){
      const segmented=document.getElementById('productEvolution')?.classList.contains('cpSegmentalMode');
      key=segmented?'evolucao':'bio';
    }else if(visible('health')&&document.getElementById('cpTreatments'))key='tratamentos';
    document.querySelectorAll('[data-cp-core]').forEach(b=>b.classList.toggle('active',!!key&&b.dataset.cpCore===key));
  }
  function simplifyCopy(){
    const brand=document.querySelector('.hdr .brandtext small');
    if(brand)brand.textContent='Seu histórico de saúde em um só lugar';
    document.querySelectorAll('#v10Overview,.v10-overview').forEach(e=>{e.hidden=true;e.setAttribute('aria-hidden','true')});
    const today=document.getElementById('productToday');
    const th=today?.querySelector('.tdHeroMain h1');if(th)th.textContent='Resumo atual';
    const tp=today?.querySelector('.tdHeroMain p');if(tp)tp.textContent='Último treino, composição, nutrição e pendências registradas — sem preencher o que está faltando.';
    const tk=today?.querySelector('.tdKicker');if(tk)tk.textContent='HOJE';
    const analysis=document.getElementById('claudeAnalysisCockpit');
    const ah=analysis?.querySelector('.ccHead h2');if(ah)ah.textContent='Visão geral';
    const ap=analysis?.querySelector('.ccHead p');if(ap)ap.textContent='Composição, treinos e cobertura dos dados em uma leitura rápida do histórico registrado.';
    const ak=analysis?.querySelector('.ccHead span');if(ak)ak.textContent='ANÁLISE';
    document.querySelectorAll('.cpClassicHead>div>span').forEach(e=>e.textContent='COMPOSIÇÃO CORPORAL');
    const info=document.getElementById('systemNotice');
    if(info?.classList.contains('info'))info.setAttribute('aria-hidden','true');
    syncCore();
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-cp-core]');if(!b)return;
    const key=b.dataset.cpCore;if(!map[key])return;
    setTimeout(()=>{forceTab(map[key]);syncCore()},40);
    setTimeout(()=>{forceTab(map[key]);syncCore()},180);
  },true);
  let queued=false;
  const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;simplifyCopy()})};
  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
  const prior=loadAll;loadAll=async function(){const out=await prior();simplifyCopy();return out};
  window.addEventListener('hashchange',()=>setTimeout(syncCore,20));
  window.addEventListener('load',()=>{setTimeout(simplifyCopy,120);setTimeout(simplifyCopy,2600)});
})();
