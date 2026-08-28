(function(){
  const V23={key:null,query:''};
  const ensure=(id,parent,before=null)=>{let e=q(id);if(e)return e;e=document.createElement('div');e.id=id;if(before)parent.insertBefore(e,before);else parent.appendChild(e);return e};
  const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
  const n=v=>{if(v==null)return null;const s=String(v).replace(',','.').match(/-?\d+(?:\.\d+)?/);if(!s)return null;const x=Number(s[0]);return Number.isFinite(x)?x:null};
  function install(){
    document.body.classList.add('healthV23');
    const health=q('health');const before=q('v13LabTrend')||q('v12Clinical')||health?.querySelector('.grid2');
    const p=ensure('v23Biomarkers',health,before);p.className='v23Panel';
    p.innerHTML=`<div class="v23Head"><div><b>Histórico por biomarcador</b><small>Resultados são agrupados pelo nome registrado. Tendência numérica só aparece quando há pelo menos dois valores reconhecíveis e a unidade não muda.</small></div><input id="v23Query" type="search" placeholder="Buscar biomarcador"></div><div class="v23Body"><div id="v23List" class="v23List"></div><div id="v23Detail" class="v23Detail"></div></div>`;
    q('v23Query').addEventListener('input',e=>{V23.query=e.target.value;render()});
  }
  function groups(){
    const m=new Map();for(const r of state.labs||[]){const key=norm(r.biomarker);if(!key)continue;const g=m.get(key)||{key,label:r.biomarker,rows:[]};g.rows.push(r);m.set(key,g)}
    return [...m.values()].sort((a,b)=>String(a.label).localeCompare(String(b.label),'pt-BR'));
  }
  function units(rows){return [...new Set(rows.map(x=>String(x.unit||'').trim()).filter(Boolean))]}
  function spark(rows){
    const u=units(rows);const pts=[...rows].sort((a,b)=>String(a.collection_date).localeCompare(String(b.collection_date))).map(x=>({date:x.collection_date,value:n(x.result_raw??x.value)})).filter(x=>x.value!=null);
    if(pts.length<2||u.length>1)return'';const min=Math.min(...pts.map(x=>x.value)),max=Math.max(...pts.map(x=>x.value)),span=max-min||1,w=520,h=130,p=12,x=i=>p+i*(w-p*2)/Math.max(1,pts.length-1),y=v=>p+(max-v)*(h-p*2)/span,d=pts.map((z,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(z.value).toFixed(1)}`).join(' ');
    return `<div class="v23Chart"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${d}"/>${pts.map((z,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(z.value).toFixed(1)}" r="3"><title>${fmtDate(z.date)} · ${fmtNum(z.value,2)} ${esc(u[0]||'')}</title></circle>`).join('')}</svg><div><span>${fmtDate(pts[0].date)}</span><span>escala observada ${fmtNum(min,2)} → ${fmtNum(max,2)} ${esc(u[0]||'')}</span><span>${fmtDate(pts.at(-1).date)}</span></div></div>`;
  }
  function render(){
    const all=groups(),term=norm(V23.query),filtered=all.filter(g=>!term||norm(g.label).includes(term));
    if(!filtered.length){q('v23List').innerHTML='<div class="v23Empty">Nenhum biomarcador corresponde à busca.</div>';q('v23Detail').innerHTML='<div class="v23Empty">Ajuste o termo de busca.</div>';return}
    if(!V23.key||!filtered.some(g=>g.key===V23.key))V23.key=filtered[0].key;
    q('v23List').innerHTML=filtered.map(g=>`<button data-v23-key="${esc(g.key)}" class="${g.key===V23.key?'active':''}"><b>${esc(g.label)}</b><small>${g.rows.length} resultado(s) · ${new Set(g.rows.map(x=>x.collection_date)).size} coleta(s)</small></button>`).join('');
    q('v23List').querySelectorAll('[data-v23-key]').forEach(b=>b.onclick=()=>{V23.key=b.dataset.v23Key;render()});
    const g=all.find(x=>x.key===V23.key)||filtered[0],rows=[...g.rows].sort((a,b)=>String(b.collection_date).localeCompare(String(a.collection_date))),u=units(rows);
    const timeline=rows.map(r=>`<div class="v23Row"><time>${fmtDate(r.collection_date)}</time><div><b>${esc(r.result_raw||r.value||'—')}${r.unit?` ${esc(r.unit)}`:''}</b><small>${r.reference_range?`ref. ${esc(r.reference_range)}`:'referência não registrada'}${r.laboratory?` · ${esc(r.laboratory)}`:''}${r.source_file?` · fonte: ${esc(r.source_file)}`:''}</small></div>${r.flag?`<span class="v23Flag">${esc(r.flag)}</span>`:'<span></span>'}</div>`).join('');
    q('v23Detail').innerHTML=`<div class="v23DetailHead"><div><b>${esc(g.label)}</b><small>${rows.length} resultado(s) preservado(s). ${u.length>1?'Unidades diferentes detectadas; gráfico combinado retido.':u.length===1?`Unidade registrada: ${esc(u[0])}.`:'Unidade não estruturada.'}</small></div><span>${new Set(rows.map(x=>x.collection_date)).size} coleta(s)</span></div>${spark(rows)}<div class="v23Rows">${timeline}</div><div class="v23Foot">Esta tela apresenta histórico e referências exatamente como estruturados. Alterações entre resultados não são diagnóstico e não geram recomendação de tratamento.</div>`;
  }
  function renderV23(){render();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v23 · longitudinal biomarker explorer · dedicated GitHub / Supabase · provenance first'}
  install();const prior=loadAll;loadAll=async function(){await prior();renderV23()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(renderV23,3550)});
})();
