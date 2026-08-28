(function(){
  'use strict';
  const map={bio:'evolution',treinos:'training',evolucao:'evolution',analise:'insights',tratamentos:'health'};
  const visible=id=>{const e=document.getElementById(id);return !!e&&!e.classList.contains('hidden')};
  const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};
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
    setText(brand,'Seu histórico de saúde em um só lugar');
    document.querySelectorAll('#v10Overview,.v10-overview').forEach(e=>{if(!e.hidden)e.hidden=true;if(e.getAttribute('aria-hidden')!=='true')e.setAttribute('aria-hidden','true')});
    const today=document.getElementById('productToday');
    setText(today?.querySelector('.tdHeroMain h1'),'Resumo atual');
    setText(today?.querySelector('.tdHeroMain p'),'Último treino, composição, nutrição e pendências registradas — sem preencher o que está faltando.');
    setText(today?.querySelector('.tdKicker'),'HOJE');
    const analysis=document.getElementById('claudeAnalysisCockpit');
    setText(analysis?.querySelector('.ccHead h2'),'Visão geral');
    setText(analysis?.querySelector('.ccHead p'),'Composição, treinos e cobertura dos dados em uma leitura rápida do histórico registrado.');
    setText(analysis?.querySelector('.ccHead span'),'ANÁLISE');
    document.querySelectorAll('.cpClassicHead>div>span').forEach(e=>setText(e,'COMPOSIÇÃO CORPORAL'));
    const info=document.getElementById('systemNotice');
    if(info?.classList.contains('info')&&info.getAttribute('aria-hidden')!=='true')info.setAttribute('aria-hidden','true');
    syncCore();
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-cp-core]');if(!b)return;
    const key=b.dataset.cpCore;if(!map[key])return;
    setTimeout(()=>{forceTab(map[key]);syncCore()},40);
    setTimeout(()=>{forceTab(map[key]);syncCore()},180);
  },true);
  const prior=loadAll;loadAll=async function(){const out=await prior();simplifyCopy();setTimeout(simplifyCopy,120);return out};
  window.addEventListener('hashchange',()=>setTimeout(syncCore,20));
  window.addEventListener('load',()=>{[120,700,1800,3200].forEach(ms=>setTimeout(simplifyCopy,ms))});
})();
