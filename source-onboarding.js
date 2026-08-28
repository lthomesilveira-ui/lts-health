(function(){
  'use strict';
  const ROOT='sourceOnboarding';
  const day=v=>String(v||'').slice(0,10);
  const safe=v=>esc(v??'');
  const arr=k=>Array.isArray(window.state?.[k])?window.state[k]:[];
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const includes=(v,s)=>String(v||'').toLowerCase().includes(s);
  const uploads=t=>arr('uploads').filter(x=>String(x.source_type||'').toLowerCase()===t);
  const metricsBySource=s=>arr('metrics').filter(x=>includes(x.source,s));
  const labsByProvider=s=>arr('labs').filter(x=>includes(x.laboratory,s)||includes(x.source,s)||includes(x.source_file,s));
  const workoutsBySource=s=>arr('canonicalWorkouts').filter(x=>includes(x.source,s)||includes(x.notes,s));
  const status=(kind,label)=>`<span class="soStatus ${kind}">${safe(label)}</span>`;
  const dateSpan=(rows,key)=>{const d=rows.map(x=>day(x[key])).filter(Boolean).sort();return d.length?`${fmtDate(d[0])} → ${fmtDate(d.at(-1))}`:'sem intervalo estruturado'};

  function ensure(){
    const host=document.getElementById('productInbox');if(!host)return null;
    let root=document.getElementById(ROOT);if(root)return root;
    root=document.createElement('section');root.id=ROOT;root.className='soPanel';
    const anchor=document.getElementById('productUploadHost')||host.firstElementChild;
    if(anchor?.nextSibling)host.insertBefore(root,anchor.nextSibling);else host.appendChild(root);
    return root;
  }
  function selectSource(type,label){
    activateTab('inbox');
    const sel=document.getElementById('uploadType'),file=document.getElementById('uploadFile');
    if(sel){sel.value=type;sel.dispatchEvent(new Event('change',{bubbles:true}))}
    const msg=document.getElementById('uploadMsg');if(msg){msg.className='msg';msg.textContent=`Fonte selecionada: ${label}. O arquivo original será preservado antes de qualquer normalização.`}
    document.getElementById('productUploadHost')?.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(()=>file?.click(),250);
  }
  function card({id,title,eyebrow,state,label,primary,detail,body,button,type}){
    return `<article class="soCard ${state}"><div class="soCardHead"><div><span>${safe(eyebrow)}</span><h3>${safe(title)}</h3></div>${status(state,label)}</div><strong class="soPrimary">${safe(primary)}</strong><small class="soDetail">${safe(detail)}</small><p>${safe(body)}</p>${button?`<button type="button" data-so-source="${safe(type)}" data-so-label="${safe(title)}">${safe(button)}</button>`:''}</article>`;
  }
  function render(){
    const root=ensure();if(!root)return;
    const apple=metricsBySource('apple health'),appleTypes=uniq(apple.map(x=>x.metric_type)),appleUp=uploads('apple_health');
    const polarW=workoutsBySource('polar'),polarM=metricsBySource('polar'),polarUp=uploads('polar');
    const fleury=labsByProvider('fleury'),einstein=labsByProvider('einstein'),labUp=uploads('lab');
    const mfpDays=Number(state.mfp?.dailyCount||arr('nutrition').length||0),mfpUp=uploads('myfitnesspal');
    const appleState=apple.length?'ready':appleUp.length?'partial':'next';
    const polarState=(polarW.length||polarM.length)?'partial':polarUp.length?'partial':'next';
    const fleuryState=fleury.length?'ready':'next',einsteinState=einstein.length?'ready':'next',mfpState=mfpDays?'ready':'next';
    root.innerHTML=`<div class="soHead"><div><span>TRAZER MEUS DADOS</span><h2>Fontes do LTS Health</h2><p>Um único histórico, sem transformar a mesma atividade em dois eventos. O arquivo bruto é preservado e cada dado estruturado mantém sua origem.</p></div><div class="soLegend">${status('ready','estruturado')}${status('partial','parcial')}${status('next','próximo')}</div></div>
      <div class="soGrid">
        ${card({title:'Apple Saúde',eyebrow:'iPhone · hub passivo',state:appleState,label:apple.length?'estruturado':appleUp.length?'arquivo recebido':'próxima fonte',primary:apple.length?`${uniq(apple.map(x=>day(x.measured_at))).length} dia(s) com métricas`:'Export ZIP/XML ainda não estruturado',detail:apple.length?`${appleTypes.length} tipo(s) · ${dateSpan(apple,'measured_at')}`:`${appleUp.length} upload(s) preservado(s)`,body:'Parser validado: energia ativa, minutos de exercício, horas em pé e sono. Passos e FC de repouso só entram em dias com uma única fonte identificada; dias ambíguos são retidos para evitar dupla contagem.',button:'Selecionar export do iPhone',type:'apple_health'})}
        ${card({title:'Polar Flow',eyebrow:'treino · FC · evidência específica',state:polarState,label:(polarW.length||polarM.length)?'contexto presente':polarUp.length?'arquivo recebido':'próxima fonte',primary:`${polarW.length} treino(s) · ${polarM.length} métrica(s)`,detail:`${polarUp.length} upload(s) Polar preservado(s)`,body:'Polar pode complementar o Apple Saúde quando trouxer detalhe de sessão/FC. O export CSV/JSON já pode ser preservado e inspecionado; a normalização automática específica do Polar ainda não é tratada como concluída.',button:'Adicionar arquivo Polar',type:'polar'})}
        ${card({title:'Fleury',eyebrow:'laboratório · laudos',state:fleuryState,label:fleury.length?'estruturado':'adicionar histórico',primary:`${fleury.length} resultado(s) identificado(s)`,detail:fleury.length?dateSpan(fleury,'collection_date'):`${labUp.length} upload(s) laboratoriais no Inbox`,body:'Os resultados já estruturados continuam ligados à coleta e à proveniência. Novos PDFs/imagens são preservados primeiro; a extração de documento exige validação e não inventa biomarcadores ausentes.',button:'Adicionar exame Fleury',type:'lab'})}
        ${card({title:'Einstein',eyebrow:'laboratório · laudos',state:einsteinState,label:einstein.length?'estruturado':'próxima fonte',primary:`${einstein.length} resultado(s) identificado(s)`,detail:einstein.length?dateSpan(einstein,'collection_date'):'nenhuma coleta Einstein identificada na base atual',body:'PDFs e imagens podem entrar pelo mesmo Inbox de exames. O app deve manter laboratório, data, unidade, referência e documento de origem separados de qualquer interpretação clínica.',button:'Adicionar exame Einstein',type:'lab'})}
        ${card({title:'MyFitnessPal',eyebrow:'nutrição · histórico',state:mfpState,label:mfpDays?'importado':'adicionar export',primary:`${mfpDays.toLocaleString('pt-BR')} dia(s) no histórico`,detail:`${mfpUp.length} upload(s) preservado(s)`,body:'A base nutricional real já alimenta Nutrição, Timeline e cruzamentos descritivos. Dias sem registro permanecem ausentes; nunca são transformados em zero ou em aderência presumida.',button:'Atualizar export MFP',type:'myfitnesspal'})}
      </div>
      <div class="soRules"><div><b>1 · Preservar</b><span>Original privado antes da extração.</span></div><div><b>2 · Identificar</b><span>Fonte, data, unidade e evento.</span></div><div><b>3 · Deduplicar</b><span>Sobreposição não vira soma automática.</span></div><div><b>4 · Normalizar</b><span>Só campos suportados entram no canônico.</span></div><div><b>5 · Contextualizar</b><span>Análise separa dado, cálculo e hipótese.</span></div></div>
      <p class="soFoot">Status de integração descreve cobertura técnica e proveniência, não qualidade de saúde, desempenho ou recuperação.</p>`;
    root.querySelectorAll('[data-so-source]').forEach(b=>b.onclick=()=>selectSource(b.dataset.soSource,b.dataset.soLabel));
  }
  let timer=null;const schedule=()=>{clearTimeout(timer);timer=setTimeout(render,130)};
  const prior=loadAll;loadAll=async function(){const out=await prior();schedule();return out};
  window.addEventListener('load',()=>setTimeout(render,2800));
})();
