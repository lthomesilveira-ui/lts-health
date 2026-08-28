(function(){
  'use strict';
  const ROOT='ltsSourceCoverage';
  const day=v=>String(v||'').slice(0,10);
  const safe=v=>esc(v??'');
  const arr=k=>Array.isArray(window.state?.[k])?window.state[k]:[];
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const hasSource=(x,name)=>String(x?.source||x?.source_type||'').toLowerCase().includes(name);
  const uploadCount=name=>arr('uploads').filter(x=>String(x?.source_type||'').toLowerCase()===name).length;
  const metricRows=name=>arr('metrics').filter(x=>hasSource(x,name));
  const metricDays=name=>uniq(metricRows(name).map(x=>day(x.measured_at))).length;
  const statusCard=(label,primary,detail,state='observed')=>`<div class="scCard ${state}"><span>${safe(label)}</span><strong>${safe(primary)}</strong><small>${safe(detail)}</small></div>`;

  function overlapSummary(){
    const groups=new Map();
    for(const m of arr('metrics')){
      const d=day(m.measured_at),t=String(m.metric_type||'');
      if(!d||!t)continue;
      const key=`${d}|${t}`;
      if(!groups.has(key))groups.set(key,new Set());
      groups.get(key).add(String(m.source||'fonte não informada'));
    }
    const overlap=[...groups.values()].filter(s=>s.size>1).length;
    return {overlap,total:groups.size};
  }

  function ensure(){
    const host=document.getElementById('productInbox');
    if(!host)return null;
    let root=document.getElementById(ROOT);
    if(root)return root;
    root=document.createElement('section');root.id=ROOT;root.className='scPanel';
    const anchor=document.getElementById('ltsInboxOperations');
    if(anchor?.nextSibling)host.insertBefore(root,anchor.nextSibling);else host.appendChild(root);
    return root;
  }

  function render(){
    const root=ensure();if(!root)return;
    const appleRows=metricRows('apple');
    const polarRows=metricRows('polar');
    const mfp=arr('nutrition');
    const labs=arr('labs');
    const docs=arr('docs');
    const body=arr('body');
    const workouts=arr('canonicalWorkouts');
    const sets=arr('sets');
    const overlap=overlapSummary();
    const polarPreserved=uploadCount('polar');
    const applePreserved=uploadCount('apple_health');
    const labPreserved=uploadCount('lab');
    const mfpPreserved=uploadCount('myfitnesspal');
    root.innerHTML=`<div class="scHead"><div><span>COBERTURA & PROVENIÊNCIA</span><h2>Fontes conectadas sem dupla contagem</h2><p>Esta visão separa arquivo preservado de dado estruturado. Fontes sobrepostas continuam identificáveis; nenhuma é somada só porque está disponível.</p></div><button type="button" id="scTimeline">Abrir timeline</button></div>
      <div class="scGrid">
        ${statusCard('Apple Health',`${metricDays('apple')} dia(s) estruturado(s)`,`${appleRows.length} linhas carregadas · ${applePreserved} upload(s) preservado(s)`,appleRows.length?'observed':'missing')}
        ${statusCard('Polar',`${metricDays('polar')} dia(s) estruturado(s)`,`${polarRows.length} linhas carregadas · ${polarPreserved} upload(s) preservado(s)`,polarRows.length?'observed':polarPreserved?'partial':'missing')}
        ${statusCard('MyFitnessPal',`${mfp.length} dia(s) carregado(s)`,`${mfpPreserved} upload(s) preservado(s); dias ausentes não viram zero`,mfp.length?'observed':'missing')}
        ${statusCard('Exames & documentos',`${labs.length} resultado(s) · ${docs.length} doc(s)`,`${labPreserved} upload(s) laboratoriais preservados`,labs.length||docs.length?'observed':'missing')}
        ${statusCard('Composição corporal',`${body.length} medição(ões)`,`Histórico estruturado; campos ausentes permanecem ausentes`,body.length?'observed':'missing')}
        ${statusCard('Treinos',`${workouts.length} sessão(ões) canônica(s)`,`${sets.length} séries estruturadas; quarentenas ficam fora do total`,workouts.length?'observed':'missing')}
      </div>
      <div class="scOverlap ${overlap.overlap?'attention':''}"><div><b>${overlap.overlap}</b><span>dia(s)-métrica com mais de uma fonte na janela carregada</span></div><p>Essas sobreposições são um sinal de proveniência, não uma autorização para agregar valores. Apple Health segue como hub passivo; quando Polar ou outra fonte trouxer detalhe adicional de treino/FC, a evidência específica pode ser mantida lado a lado sem duplicar o evento.</p></div>
      <p class="scGuard">Cobertura descreve o que foi preservado ou estruturado nesta sessão. Não é score de saúde, readiness, recovery, qualidade da dieta ou avaliação corporal. Ausência de dado continua ausência de evidência.</p>`;
    document.getElementById('scTimeline')?.addEventListener('click',()=>activateTab('timeline'));
  }

  let timer=null;const schedule=()=>{clearTimeout(timer);timer=setTimeout(render,120)};
  const prior=loadAll;loadAll=async function(){const out=await prior();schedule();return out};
  window.addEventListener('load',()=>setTimeout(render,2400));
})();
