(function(){
  'use strict';
  const X={collection:null,docType:'all',docYear:'all'};
  const day=v=>String(v||'').slice(0,10);
  const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
  const safe=v=>esc(v??'');
  const num=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const uniq=a=>[...new Set(a.filter(v=>v!==null&&v!==undefined&&String(v).trim()!==''))];
  const unit=v=>String(v||'').trim();
  const signed=(v,d=2)=>`${v>0?'+':''}${fmtNum(v,d)}`;
  function labsByDate(){
    const map=new Map();
    for(const r of state.labs||[]){const d=day(r.collection_date);if(!d)continue;if(!map.has(d))map.set(d,[]);map.get(d).push(r)}
    return map;
  }
  function comparison(){
    const byDate=labsByDate(),dates=[...byDate.keys()].sort().reverse();
    if(!dates.length)return'<div class="hlEmpty">Sem coletas laboratoriais estruturadas para comparar.</div>';
    if(!X.collection||!dates.includes(X.collection))X.collection=dates[0];
    const idx=dates.indexOf(X.collection),previous=dates[idx+1]||null,currentRows=byDate.get(X.collection)||[],previousRows=previous?(byDate.get(previous)||[]):[];
    const prevMap=new Map();
    for(const r of previousRows){const k=norm(r.biomarker);if(k&&!prevMap.has(k))prevMap.set(k,r)}
    const pairs=[];let withheld=0;
    for(const cur of currentRows){
      const prev=prevMap.get(norm(cur.biomarker));if(!prev)continue;
      const a=num(cur.result_numeric),b=num(prev.result_numeric),ua=unit(cur.unit),ub=unit(prev.unit);
      if(a==null||b==null||!ua||!ub||norm(ua)!==norm(ub)){withheld++;continue}
      pairs.push({label:cur.biomarker,current:a,previous:b,delta:a-b,unit:ua,currentRaw:cur.result_raw,previousRaw:prev.result_raw});
    }
    pairs.sort((a,b)=>String(a.label).localeCompare(String(b.label),'pt-BR'));
    return`<div class="hlControl"><label>Coleta<select id="hlCollection">${dates.map(d=>`<option value="${d}" ${d===X.collection?'selected':''}>${fmtDate(d)}</option>`).join('')}</select></label><div><b>${previous?`${pairs.length} biomarcador(es) comparáveis`:'Sem coleta anterior'}</b><small>${previous?`comparação com ${fmtDate(previous)} · ${withheld} par(es) retido(s) por unidade/valor não comparável`:'é preciso ao menos duas coletas estruturadas'}</small></div></div>${previous?`<div class="hlCompareRows">${pairs.map(p=>`<div><b>${safe(p.label)}</b><span>${fmtNum(p.previous,2)} → ${fmtNum(p.current,2)} ${safe(p.unit)}</span><strong class="${p.delta>0?'up':p.delta<0?'down':'flat'}">${signed(p.delta,2)} ${safe(p.unit)}</strong></div>`).join('')||'<div class="hlEmpty">As duas coletas não têm biomarcadores numéricos comparáveis com a mesma unidade.</div>'}</div><div class="hlNote">A seta e a diferença mostram apenas mudança numérica entre duas coletas. Não classificam o resultado como melhor/pior e não substituem referência laboratorial ou interpretação clínica.</div>`:''}`;
  }
  function documents(){
    const docs=[...(state.docs||[])],types=uniq(docs.map(d=>d.document_type||'Tipo não informado')).sort((a,b)=>String(a).localeCompare(String(b),'pt-BR')),years=uniq(docs.map(d=>day(d.document_date).slice(0,4)).filter(Boolean)).sort().reverse();
    const filtered=docs.filter(d=>(X.docType==='all'||String(d.document_type||'Tipo não informado')===X.docType)&&(X.docYear==='all'||day(d.document_date).startsWith(X.docYear))).sort((a,b)=>String(b.document_date).localeCompare(String(a.document_date)));
    const statusCounts=new Map();for(const d of filtered){const s=String(d.extraction_status||'não classificada');statusCounts.set(s,(statusCounts.get(s)||0)+1)}
    return`<div class="hlDocControls"><label>Tipo<select id="hlDocType"><option value="all">Todos</option>${types.map(t=>`<option value="${safe(t)}" ${t===X.docType?'selected':''}>${safe(t)}</option>`).join('')}</select></label><label>Ano<select id="hlDocYear"><option value="all">Todos</option>${years.map(y=>`<option value="${safe(y)}" ${y===X.docYear?'selected':''}>${safe(y)}</option>`).join('')}</select></label></div><div class="hlStatus">${[...statusCounts.entries()].map(([s,c])=>`<span><b>${c}</b> ${safe(s)}</span>`).join('')||'<span>Sem documentos no filtro.</span>'}</div><div class="hlDocTimeline">${filtered.map(d=>`<div><time>${fmtDate(d.document_date)}</time><div><b>${safe(d.title||d.document_type||'Documento')}</b><small>${safe(d.document_type||'tipo não informado')} · extração ${safe(d.extraction_status||'não classificada')} · confiança ${safe(d.confidence||'não classificada')}</small><small>${d.source_file?`fonte/arquivo: ${safe(d.source_file)}`:safe(d.source||'fonte não registrada')}</small></div></div>`).join('')||'<div class="hlEmpty">Nenhum documento corresponde aos filtros.</div>'}</div><div class="hlNote">Esta navegação usa apenas metadados e proveniência já estruturados. Ausência de documento ou status de extração não é interpretada como ausência de condição clínica.</div>`;
  }
  function render(){
    const root=q('productHealth');if(!root)return;
    let host=q('healthLongitudinal');if(!host){host=document.createElement('section');host.id='healthLongitudinal';host.className='hlWrap';root.appendChild(host)}
    host.innerHTML=`<div class="hlTitle"><div><div class="hlKicker">LONGITUDINAL</div><h2>Comparação de coletas & arquivo clínico</h2><p>Diferenças determinísticas entre coletas comparáveis e organização documental por tipo/ano, sem preencher lacunas.</p></div></div><div class="hlGrid"><article class="hlPanel"><div class="hlHead"><div><b>Coleta versus coleta anterior</b><small>Somente valores numéricos com a mesma unidade entram no delta.</small></div></div>${comparison()}</article><article class="hlPanel"><div class="hlHead"><div><b>Mapa de documentos</b><small>Filtro longitudinal de metadados e status de extração.</small></div></div>${documents()}</article></div>`;
    q('hlCollection')?.addEventListener('change',e=>{X.collection=e.target.value;render()});
    q('hlDocType')?.addEventListener('change',e=>{X.docType=e.target.value;render()});
    q('hlDocYear')?.addEventListener('change',e=>{X.docYear=e.target.value;render()});
  }
  const prior=loadAll;
  loadAll=async function(){const out=await prior();render();return out};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(render,3000)});
})();
