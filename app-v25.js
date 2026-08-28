(function(){
  const V25={busy:new Set()};
  const ensure=(id,parent,before=null)=>{let e=q(id);if(e)return e;e=document.createElement('div');e.id=id;if(before)parent.insertBefore(e,before);else parent.appendChild(e);return e};
  function install(){
    document.body.classList.add('healthV25');
    const inbox=q('inbox');const before=q('v20Data')||q('v17AppleGuide')||inbox?.querySelector('.uploadBox');
    const p=ensure('v25Ops',inbox,before);p.className='v25Panel';
  }
  function tone(status){status=String(status||'').toLowerCase();return['imported','validated','completed'].includes(status)?'ok':['review_required','processing','uploaded'].includes(status)?'pending':['rejected','failed'].includes(status)?'bad':''}
  async function reprocess(id){
    if(!id||V25.busy.has(id))return;V25.busy.add(id);render();
    try{const r=await sb.functions.invoke(HEALTH_INSPECT_FUNCTION,{body:{upload_id:id}});if(r.error)throw r.error;await loadAll()}catch(e){console.error('v25 reprocess',e);const box=q('v25OpsMsg');if(box)box.textContent=`Reprocessamento não concluído: ${e.message||e}`}finally{V25.busy.delete(id);render()}
  }
  function render(){
    const el=q('v25Ops');if(!el)return;const uploads=state.uploads||[],quality=state.quality||[];
    const queue=uploads.filter(x=>['review_required','processing','uploaded','rejected'].includes(String(x.status||'').toLowerCase())).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
    const open=quality.filter(x=>String(x.status).toLowerCase()==='open'),sev={};open.forEach(x=>sev[String(x.severity||'unknown').toLowerCase()]=(sev[String(x.severity||'unknown').toLowerCase()]||0)+1);
    const statusCounts={};uploads.forEach(x=>statusCounts[x.status]=(statusCounts[x.status]||0)+1);
    el.innerHTML=`<div class="v25Head"><div><b>Central de processamento</b><small>Fila operacional para arquivos preservados que ainda exigem parser, nova inspeção ou revisão. Reprocessar nunca apaga o original do Inbox.</small></div><span>${queue.length} item(ns) na fila</span></div><div class="v25Stats"><div><span>Uploads</span><strong>${uploads.length}</strong><small>${Object.entries(statusCounts).map(([k,v])=>`${k} ${v}`).join(' · ')||'—'}</small></div><div><span>Qualidade aberta</span><strong>${open.length}</strong><small>${Object.entries(sev).map(([k,v])=>`${k} ${v}`).join(' · ')||'nenhuma questão aberta'}</small></div><div><span>Importados</span><strong>${uploads.filter(x=>String(x.status).toLowerCase()==='imported').length}</strong><small>processamento automático concluído</small></div></div><div id="v25OpsMsg" class="v25Msg"></div><div class="v25Queue">${queue.length?queue.slice(0,30).map(x=>`<div class="v25Item"><div><b>${esc(x.original_filename||'arquivo')}</b><small>${esc(x.source_type||'fonte')} · ${fmtDate(x.created_at)} · status ${esc(x.status||'—')}</small></div><span class="v25Badge ${tone(x.status)}">${esc(x.status||'—')}</span><button data-v25-id="${esc(x.id)}" ${V25.busy.has(x.id)?'disabled':''}>${V25.busy.has(x.id)?'Processando…':'Reprocessar'}</button></div>`).join(''):'<div class="v25Empty">Nenhum upload pendente de processamento no momento.</div>'}</div><div class="v25Foot">Questões que dependem de evidência externa continuam abertas; a central não marca lacunas como resolvidas apenas porque o parser foi executado novamente.</div>`;
    el.querySelectorAll('[data-v25-id]').forEach(b=>b.onclick=()=>reprocess(b.dataset.v25Id));
  }
  function renderV25(){render();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v25 · actionable ingestion operations queue · dedicated GitHub / Supabase · provenance first'}
  install();const prior=loadAll;loadAll=async function(){await prior();renderV25()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(renderV25,4000)});
})();
