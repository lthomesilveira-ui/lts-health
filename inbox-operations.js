(function(){
  'use strict';

  const ROOT_ID='ltsInboxOperations';
  const APPLE_TYPES=[
    ['steps','Passos'],
    ['active_energy_kcal','Energia ativa'],
    ['exercise_minutes','Minutos de exercício'],
    ['resting_heart_rate_bpm','FC de repouso'],
    ['sleep_duration_h','Sono']
  ];
  const ui={status:'all',source:'all'};

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const day=v=>String(v||'').slice(0,10);
  const fmtDate=v=>{const d=day(v);if(!d)return'—';const p=d.split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:d};
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const status=v=>String(v||'unknown').toLowerCase();
  const source=v=>String(v?.source_type||v?.source||'não informado');
  const rows=()=>Array.isArray(window.state?.uploads)?window.state.uploads:[];
  const metrics=()=>Array.isArray(window.state?.metrics)?window.state.metrics:[];
  const issues=()=>Array.isArray(window.state?.quality)?window.state.quality:[];

  function statusLabel(s){return({processed:'processado',validated:'validado',review_required:'revisão',processing:'processando',uploaded:'recebido',rejected:'retido',failed:'falhou'})[s]||s||'desconhecido'}
  function sourceLabel(s){return({myfitnesspal:'MyFitnessPal',apple_health:'Apple Health',body_composition:'Bioimpedância',lab:'Exames',polar:'Polar',training:'Treino',document:'Documento'})[s]||s||'não informado'}
  function metricCard(type,label){
    const ds=uniq(metrics().filter(x=>x?.metric_type===type&&/apple/i.test(String(x?.source||''))).map(x=>day(x.measured_at)));
    return `<div class="inboxOpsMetric"><span>${esc(label)}</span><strong>${ds.length}</strong><small>dia(s) efetivamente normalizado(s)</small></div>`;
  }
  function countStatus(list,s){return list.filter(x=>status(x.status)===s).length}

  function ensure(){
    const host=document.getElementById('productInbox');
    if(!host||document.getElementById(ROOT_ID))return null;
    const root=document.createElement('section');
    root.id=ROOT_ID;
    root.className='inboxOps';
    const uploadHost=document.getElementById('productUploadHost');
    if(uploadHost?.nextSibling)host.insertBefore(root,uploadHost.nextSibling);else host.prepend(root);
    return root;
  }

  function render(){
    const root=ensure()||document.getElementById(ROOT_ID);if(!root)return;
    const uploads=rows();
    const openIssues=issues().filter(x=>status(x.status)==='open');
    const sources=uniq(uploads.map(source)).sort((a,b)=>a.localeCompare(b));
    const statuses=uniq(uploads.map(x=>status(x.status))).sort();
    const filtered=uploads.filter(x=>(ui.status==='all'||status(x.status)===ui.status)&&(ui.source==='all'||source(x)===ui.source)).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    const actionCount=uploads.filter(x=>['review_required','rejected','failed'].includes(status(x.status))).length;
    const activeCount=uploads.filter(x=>['uploaded','processing'].includes(status(x.status))).length;
    const doneCount=uploads.filter(x=>['processed','validated'].includes(status(x.status))).length;

    root.innerHTML=`
      <div class="inboxOpsHead">
        <div><div class="inboxOpsKicker">OPERAÇÃO DE DADOS</div><h2>Inbox em uma visão</h2><p>O arquivo original é preservado primeiro; automação só avança quando o parser tem regra explícita. Pendência continua pendência.</p></div>
        <div class="inboxOpsTotals">
          <div><strong>${doneCount}</strong><span>concluídos</span></div>
          <div><strong>${activeCount}</strong><span>em processamento</span></div>
          <div class="${actionCount?'attention':''}"><strong>${actionCount}</strong><span>pedem revisão</span></div>
          <div class="${openIssues.length?'attention':''}"><strong>${openIssues.length}</strong><span>questões abertas</span></div>
        </div>
      </div>

      <div class="inboxOpsGrid">
        <article class="inboxOpsCard">
          <header><div><h3>Fila operacional</h3><p>Filtre sem perder o original nem esconder registros retidos.</p></div><span class="inboxOpsBadge">${filtered.length} item(ns)</span></header>
          <div class="inboxOpsFilters">
            <select id="inboxOpsStatus"><option value="all">Todos os status</option>${statuses.map(s=>`<option value="${esc(s)}" ${ui.status===s?'selected':''}>${esc(statusLabel(s))}</option>`).join('')}</select>
            <select id="inboxOpsSource"><option value="all">Todas as fontes</option>${sources.map(s=>`<option value="${esc(s)}" ${ui.source===s?'selected':''}>${esc(sourceLabel(s))}</option>`).join('')}</select>
          </div>
          <div class="inboxOpsQueue">${filtered.length?filtered.slice(0,12).map(x=>`<div class="inboxOpsRow"><div><b>${esc(x.original_filename||'arquivo preservado')}</b><small>${esc(sourceLabel(source(x)))} · ${fmtDate(x.created_at)} · ${esc(statusLabel(status(x.status)))}</small></div><span class="inboxOpsState s-${esc(status(x.status))}">${esc(statusLabel(status(x.status)))}</span></div>`).join(''):'<div class="inboxOpsEmpty">Nenhum upload corresponde aos filtros.</div>'}</div>
          ${filtered.length>12?`<div class="inboxOpsNote">Mostrando 12 de ${filtered.length}; o histórico completo permanece no backend.</div>`:''}
        </article>

        <article class="inboxOpsCard">
          <header><div><h3>Apple Health · contrato conservador</h3><p>Só métricas com normalização validada entram automaticamente.</p></div></header>
          <div class="inboxOpsMetrics">${APPLE_TYPES.map(([t,l])=>metricCard(t,l)).join('')}</div>
          <div class="inboxOpsGuard">Passos e FC de repouso com múltiplas fontes no mesmo dia não são somados nem escolhidos arbitrariamente: ficam para revisão. Sono usa intervalos não sobrepostos. Ausência de registro permanece ausência de evidência.</div>
        </article>
      </div>

      <div class="inboxOpsFlow">
        <div><i>1</i><b>Preservar</b><span>Arquivo bruto no storage privado com usuário e proveniência.</span></div>
        <div><i>2</i><b>Inspecionar</b><span>Tipo, intervalo, estrutura e conflitos são identificados antes de normalizar.</span></div>
        <div><i>3</i><b>Normalizar</b><span>Somente campos suportados entram nas tabelas canônicas; nada é preenchido por estimativa.</span></div>
        <div><i>4</i><b>Revisar</b><span>Conflitos, fonte incompleta ou parser não suportado continuam visíveis no ledger.</span></div>
      </div>`;

    document.getElementById('inboxOpsStatus')?.addEventListener('change',e=>{ui.status=e.target.value;render()});
    document.getElementById('inboxOpsSource')?.addEventListener('change',e=>{ui.source=e.target.value;render()});
  }

  let timer=null;
  function schedule(){clearTimeout(timer);timer=setTimeout(render,80)}
  const obs=new MutationObserver(m=>{if(m.some(x=>x.target?.id==='productInbox'||x.target?.closest?.('#productInbox')))schedule()});
  function start(){const host=document.getElementById('productInbox');if(!host){setTimeout(start,250);return}obs.observe(host,{childList:true,subtree:true});render()}
  window.addEventListener('load',()=>setTimeout(start,900));
})();
