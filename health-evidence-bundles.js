(function(){
  'use strict';
  const H={range:'all'};
  const day=v=>String(v||'').slice(0,10);
  const safe=v=>esc(v??'');
  const dateMs=v=>{const d=day(v);if(!d)return null;const t=Date.parse(d+'T12:00:00');return Number.isFinite(t)?t:null};
  const diffDays=(a,b)=>{const x=dateMs(a),y=dateMs(b);return x==null||y==null?null:Math.round(Math.abs(x-y)/86400000)};
  const cutoff=()=>{if(H.range==='all')return null;const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-Number(H.range)+1);return d.toISOString().slice(0,10)};
  const inRange=v=>H.range==='all'||day(v)>=cutoff();

  function collections(){
    const map=new Map();
    for(const r of state.labs||[]){const d=day(r.collection_date);if(!d||!inRange(d))continue;const a=map.get(d)||[];a.push(r);map.set(d,a)}
    return [...map.entries()].sort((a,b)=>b[0].localeCompare(a[0]));
  }
  function documentCandidates(collectionDate){
    return (state.docs||[]).map(d=>({doc:d,gap:diffDays(collectionDate,d.document_date)})).filter(x=>x.gap!=null&&x.gap<=3).sort((a,b)=>a.gap-b.gap||String(b.doc.document_date).localeCompare(String(a.doc.document_date)));
  }
  function docRow(x){
    const d=x.doc,relation=x.gap==null?'sem coleta próxima':x.gap===0?'mesma data':`${x.gap} dia(s) de distância`;
    return `<div class="hebDoc"><time>${fmtDate(d.document_date)}</time><div><b>${safe(d.title||d.document_type||'Documento clínico')}</b><small>${safe(d.document_type||'tipo não informado')} · ${relation}</small><small>extração ${safe(d.extraction_status||'não classificada')} · confiança ${safe(d.confidence||'não classificada')}</small></div></div>`;
  }
  function collectionCard(entry){
    const [d,rows]=entry,docs=documentCandidates(d),same=docs.filter(x=>x.gap===0),near=docs.filter(x=>x.gap>0),labs=new Set(rows.map(r=>String(r.biomarker||'').trim()).filter(Boolean));
    return `<article class="hebCard"><div class="hebCardHead"><div><span>COLETA</span><strong>${fmtDate(d)}</strong><small>${labs.size} biomarcador(es) estruturado(s) · ${rows.length} resultado(s)</small></div><div class="hebBadge ${same.length?'exact':near.length?'near':'none'}">${same.length?`${same.length} doc(s) na mesma data`:near.length?`${near.length} doc(s) próximos`:'sem documento próximo'}</div></div>${docs.length?`<div class="hebDocs">${docs.slice(0,6).map(docRow).join('')}${docs.length>6?`<div class="hebMore">+ ${docs.length-6} documento(s) dentro da janela de ±3 dias</div>`:''}</div>`:'<div class="hebEmpty">Nenhum documento estruturado foi encontrado na mesma data ou em até 3 dias desta coleta.</div>'}<div class="hebCaution">A proximidade de datas é apenas uma pista de navegação. Ela não prova que o documento pertence a esta coleta, nem cria relação clínica entre os registros.</div></article>`;
  }
  function orphanDocuments(collectionDates){
    const docs=(state.docs||[]).filter(d=>inRange(d.document_date));
    return docs.filter(d=>!collectionDates.some(c=>{const gap=diffDays(c,d.document_date);return gap!=null&&gap<=3})).sort((a,b)=>String(b.document_date).localeCompare(String(a.document_date)));
  }
  function render(){
    const root=q('productHealth');if(!root||!window.state)return;
    let host=q('healthEvidenceBundles');if(!host){host=document.createElement('section');host.id='healthEvidenceBundles';host.className='hebWrap';root.appendChild(host)}
    const cols=collections(),dates=cols.map(x=>x[0]),orphans=orphanDocuments(dates),linked=cols.filter(x=>documentCandidates(x[0]).length).length;
    host.innerHTML=`<div class="hebTitle"><div><div class="hebKicker">EVIDÊNCIA VINCULADA POR DATA</div><h2>Coletas e documentos no mesmo contexto temporal</h2><p>Uma camada de navegação para encontrar evidências próximas sem assumir vínculos que não estão documentados.</p></div><label>Período<select id="hebRange"><option value="365" ${H.range==='365'?'selected':''}>1 ano</option><option value="730" ${H.range==='730'?'selected':''}>2 anos</option><option value="all" ${H.range==='all'?'selected':''}>Todo histórico</option></select></label></div><div class="hebMetrics"><div><span>Coletas no período</span><strong>${cols.length}</strong><small>datas com laboratório estruturado</small></div><div><span>Com documento próximo</span><strong>${linked}</strong><small>mesma data ou até ±3 dias</small></div><div><span>Documentos sem coleta próxima</span><strong>${orphans.length}</strong><small>continuam preservados e navegáveis</small></div></div><div class="hebGuard"><b>Como interpretar esta visão</b><span>Correspondência temporal não significa causalidade, pertencimento ou interpretação clínica. O app não combina resultados, não preenche documentos ausentes e não infere diagnósticos.</span></div><div class="hebGrid">${cols.length?cols.map(collectionCard).join(''):'<div class="hebEmpty">Nenhuma coleta laboratorial estruturada corresponde ao período selecionado.</div>'}</div>${orphans.length?`<div class="hebOrphans"><div class="hebOrphanHead"><b>Documentos fora da janela das coletas</b><small>Mostrados separadamente para evitar associação artificial.</small></div>${orphans.slice(0,12).map(d=>docRow({doc:d,gap:null})).join('')}${orphans.length>12?`<div class="hebMore">+ ${orphans.length-12} documento(s) no período</div>`:''}</div>`:''}`;
    q('hebRange')?.addEventListener('change',e=>{H.range=e.target.value;render()});
  }
  const prior=loadAll;loadAll=async function(){const out=await prior();render();return out};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(render,3200)});
})();
