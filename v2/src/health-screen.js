import {state,esc,fmtDate,fmtNum,num,norm,unique} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const empty=text=>`<div class="empty">${esc(text)}</div>`;
const unavailable=text=>`<div class="errorState"><b>Esta parte não carregou agora.</b><span>${esc(text)}</span></div>`;
const pill=(text,kind='')=>`<span class="pill ${kind}">${esc(text)}</span>`;
const failed=key=>state.domainStatus?.[key]==='error'||!!state.errors?.[key];

function collectionKey(row){return `${row.collection_date||''}__${row.laboratory||''}`;}
function collections(){
  const map=new Map();
  for(const row of state.data.labs||[]){const key=collectionKey(row);if(!map.has(key))map.set(key,{key,date:row.collection_date,lab:row.laboratory||'Laboratório não informado',rows:[]});map.get(key).rows.push(row);}
  return [...map.values()].sort((a,b)=>String(b.date).localeCompare(String(a.date))||a.lab.localeCompare(b.lab,'pt-BR'));
}
function biomarkerGroups(){
  const map=new Map();
  for(const row of state.data.labs||[]){const key=norm(row.biomarker);if(!key)continue;if(!map.has(key))map.set(key,{key,label:row.biomarker,rows:[]});map.get(key).rows.push(row);}
  return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
}
function resultText(row){
  if(row.result_raw)return row.result_raw;
  if(num(row.result_numeric)!=null)return `${fmtNum(row.result_numeric)}${row.unit?` ${row.unit}`:''}`;
  return 'resultado não informado';
}
function markerChart(ordered,unit){
  if(ordered.length<2)return'';
  const points=ordered.map(r=>({date:r.collection_date,value:num(r.result_numeric)})).filter(p=>p.value!=null),values=points.map(p=>p.value);if(points.length<2)return'';
  const w=560,h=150,p=20,lo=Math.min(...values),hi=Math.max(...values),span=hi-lo||1,pad=span*.14,min=lo-pad,max=hi+pad;
  const x=i=>p+i*(w-p*2)/Math.max(1,points.length-1),y=v=>p+(max-v)*(h-p*2)/(max-min||1);
  const path=points.map((pt,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(pt.value).toFixed(1)}`).join(' ');
  const dots=points.map((pt,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(pt.value).toFixed(1)}" r="3.5"><title>${esc(fmtDate(pt.date))}: ${esc(fmtNum(pt.value))} ${esc(unit||'')}</title></circle>`).join('');
  return `<div class="labHistoryChart"><div class="labHistoryChartHead"><b>Série histórica</b><small>${points.length} ponto(s) · mesma unidade (${esc(unit||'sem unidade')})</small></div><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Série histórica do marcador selecionado"><path class="labHistoryGrid" d="M20 50H540 M20 100H540"/><path class="labHistoryLine" d="${path}"/>${dots}</svg><div class="labHistoryAxis"><span>${fmtDate(points[0].date)}</span><span>${fmtDate(points.at(-1).date)}</span></div><small class="labHistoryNote">Valores exibidos de forma descritiva; o gráfico não classifica o resultado nem substitui a interpretação clínica.</small></div>`;
}
function markerHistory(group){
  if(!group)return empty('Selecione um marcador para ver o histórico.');
  const rows=[...group.rows].sort((a,b)=>String(b.collection_date).localeCompare(String(a.collection_date))),numeric=rows.filter(r=>num(r.result_numeric)!=null),units=unique(numeric.map(r=>r.unit||''));
  const comparable=numeric.length>=2&&units.length===1;
  const history=rows.map(r=>`<div class="labResultRow"><time>${fmtDate(r.collection_date)}</time><div><b>${esc(resultText(r))}${!r.result_raw&&r.unit?'':r.result_raw&&r.unit&&!String(r.result_raw).includes(r.unit)?` ${esc(r.unit)}`:''}</b><small>${esc(r.laboratory||'Laboratório não informado')}${r.reference_range?` · referência ${esc(r.reference_range)}`:''}${r.method?` · método ${esc(r.method)}`:''}</small></div>${r.flag?pill(r.flag,'warn'):''}</div>`).join('');
  let trend='';
  if(comparable){const ordered=[...numeric].sort((a,b)=>String(a.collection_date).localeCompare(String(b.collection_date))),first=ordered[0],last=ordered.at(-1),delta=num(last.result_numeric)-num(first.result_numeric);trend=`<div class="labTrend"><span>${fmtDate(first.collection_date)} · ${fmtNum(first.result_numeric)} ${esc(first.unit||'')}</span><b>Diferença ${delta>0?'+':''}${fmtNum(delta)} ${esc(first.unit||'')}</b><span>${fmtDate(last.collection_date)} · ${fmtNum(last.result_numeric)} ${esc(last.unit||'')}</span></div>${markerChart(ordered,first.unit||'')}`;}
  else if(rows.length>1)trend='<div class="note">Há mais de um resultado, mas eles não são combinados em tendência quando faltam valores numéricos ou as unidades não são compatíveis.</div>';
  else trend='<div class="note">Há um único ponto estruturado para este marcador. Novas coletas permitirão comparação longitudinal.</div>';
  return `<div class="markerHead"><b>${esc(group.label)}</b><small>${rows.length} resultado(s) estruturado(s)</small></div>${trend}<div class="list labHistory">${history}</div>`;
}
function collectionPanel(collection){
  if(!collection)return empty('Nenhuma coleta laboratorial estruturada.');
  const q=norm(state.ui.labQuery),rows=collection.rows.filter(r=>!q||norm(`${r.biomarker} ${r.result_raw} ${r.unit} ${r.reference_range}`).includes(q)).sort((a,b)=>String(a.biomarker).localeCompare(String(b.biomarker),'pt-BR'));
  const flagged=collection.rows.filter(r=>r.flag).length,units=unique(collection.rows.map(r=>r.unit).filter(Boolean)).length;
  return `<div class="collectionHeader"><div><span>${fmtDate(collection.date)}</span><b>${esc(collection.lab)}</b><small>${collection.rows.length} resultado(s) estruturado(s)</small></div>${pill(`${rows.length} visíveis`)}</div><div class="collectionFacts"><div><span>Resultados</span><b>${collection.rows.length}</b></div><div><span>Com sinalização na fonte</span><b>${flagged}</b></div><div><span>Unidades registradas</span><b>${units}</b></div></div><div class="labTable">${rows.map(r=>`<div class="labTableRow"><div><b>${esc(r.biomarker||'Marcador')}</b><small>${r.reference_range?`Referência ${esc(r.reference_range)}`:'Sem faixa de referência registrada'}</small></div><strong>${esc(resultText(r))}${r.unit&&!String(resultText(r)).includes(r.unit)?` <small>${esc(r.unit)}</small>`:''}</strong>${r.flag?pill(r.flag,'warn'):''}</div>`).join('')||empty('Nenhum resultado corresponde à busca.')}</div>`;
}
function documentStatus(doc){
  const status=norm(doc.extraction_status);
  if(status==='structured'||status==='extracted')return pill('dados extraídos','ok');
  if(status.includes('review'))return pill('revisão necessária','warn');
  if(status.includes('failed'))return pill('leitura não concluída','warn');
  return pill('documento registrado');
}
function documentSummary(docs){
  const types=new Map(),sources=new Map(),years=new Map();
  for(const doc of docs){
    const type=doc.document_type||'Tipo não informado',source=doc.source||'Origem não informada',year=String(doc.document_date||'').slice(0,4)||'Sem data';
    types.set(type,(types.get(type)||0)+1);sources.set(source,(sources.get(source)||0)+1);years.set(year,(years.get(year)||0)+1);
  }
  const top=map=>[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  return `<div class="documentSummary"><div><span>Tipos de documento</span>${top(types).map(([k,v])=>`<b>${esc(k)} <em>${v}</em></b>`).join('')||'<b>Sem registros</b>'}</div><div><span>Origens</span>${top(sources).map(([k,v])=>`<b>${esc(k)} <em>${v}</em></b>`).join('')||'<b>Sem registros</b>'}</div><div><span>Por ano</span>${top(years).map(([k,v])=>`<b>${esc(k)} <em>${v}</em></b>`).join('')||'<b>Sem registros</b>'}</div></div>`;
}
function evidenceByDate(cols,docs){
  const dateMap=new Map();
  for(const c of cols){if(!c.date)continue;if(!dateMap.has(c.date))dateMap.set(c.date,{date:c.date,collections:[],docs:[]});dateMap.get(c.date).collections.push(c);}
  for(const d of docs){if(!d.document_date)continue;if(!dateMap.has(d.document_date))dateMap.set(d.document_date,{date:d.document_date,collections:[],docs:[]});dateMap.get(d.document_date).docs.push(d);}
  const rows=[...dateMap.values()].filter(x=>x.collections.length&&x.docs.length).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,12);
  if(!rows.length)return empty('Ainda não há datas com coleta estruturada e documento registrado no mesmo dia.');
  return `<div class="evidenceDateList">${rows.map(x=>`<article><time>${fmtDate(x.date)}</time><div><b>${x.collections.reduce((s,c)=>s+c.rows.length,0)} resultado(s) · ${x.docs.length} documento(s)</b><small>${esc(unique(x.collections.map(c=>c.lab)).join(' · '))}</small><div class="evidenceDocNames">${x.docs.slice(0,4).map(d=>`<span>${esc(d.title||d.document_type||'Documento')}</span>`).join('')}</div></div></article>`).join('')}</div>`;
}

export function renderHealthHub(){
  const labFailed=failed('labs'),docsFailed=failed('docs'),labs=state.data.labs||[],docs=[...(state.data.docs||[])].sort((a,b)=>String(b.document_date||'').localeCompare(String(a.document_date||''))),cols=collections(),groups=biomarkerGroups(),q=norm(state.ui.labQuery);
  if(!state.ui.selectedCollection||!cols.some(c=>c.key===state.ui.selectedCollection))state.ui.selectedCollection=cols[0]?.key||null;
  if(!state.ui.selectedBiomarker||!groups.some(g=>g.key===state.ui.selectedBiomarker))state.ui.selectedBiomarker=groups[0]?.key||null;
  const collection=cols.find(c=>c.key===state.ui.selectedCollection),filteredGroups=groups.filter(g=>!q||norm(g.label).includes(q)),marker=groups.find(g=>g.key===state.ui.selectedBiomarker);
  const labDates=unique(labs.map(r=>r.collection_date)),docDates=unique(docs.map(r=>r.document_date));
  return `${title('Saúde & exames','Resultados, coletas e documentos organizados para consulta longitudinal.')}
    ${labFailed?unavailable('Os exames continuam preservados; tente atualizar para carregar os resultados.') : ''}
    <div class="grid cols4">
      <div class="card metric"><span>Coletas</span><strong>${labFailed?'—':cols.length}</strong><em>${labFailed?'não carregado':labDates.length?`${fmtDate(labDates.sort().at(0))} → ${fmtDate(labDates.sort().at(-1))}`:'sem datas'}</em></div>
      <div class="card metric"><span>Resultados</span><strong>${labFailed?'—':labs.length}</strong><em>${labFailed?'não carregado':'marcadores estruturados'}</em></div>
      <div class="card metric"><span>Marcadores</span><strong>${labFailed?'—':groups.length}</strong><em>${labFailed?'não carregado':'nomes distintos'}</em></div>
      <div class="card metric"><span>Documentos</span><strong>${docsFailed?'—':docs.length}</strong><em>${docsFailed?'não carregado':docDates.length?`${docDates.length} data(s)`:'sem datas'}</em></div>
    </div>
    <div class="grid split sectionGap">
      <div class="card">${labFailed?unavailable('Não é possível listar coletas enquanto os resultados estão indisponíveis.'):`<div class="cardHead"><div><b>Coleta</b><small>Escolha uma coleta para ver os resultados disponíveis.</small></div><select id="collectionSelect">${cols.map(c=>`<option value="${esc(c.key)}">${fmtDate(c.date)} · ${esc(c.lab)}</option>`).join('')}</select></div><input id="labQuery" class="fullInput" type="search" placeholder="Buscar marcador ou resultado" value="${esc(state.ui.labQuery)}">${collectionPanel(collection)}`}</div>
      <div class="card">${labFailed?unavailable('O histórico por marcador ficará disponível após o carregamento dos exames.'):`<div class="cardHead"><div><b>Histórico por marcador</b><small>Compare coletas somente quando os valores e unidades forem compatíveis.</small></div></div><div class="labExplorer refined"><div class="exerciseList markerList">${filteredGroups.slice(0,200).map(g=>`<button type="button" data-marker="${esc(g.key)}" class="${g.key===state.ui.selectedBiomarker?'active':''}"><b>${esc(g.label)}</b><small>${g.rows.length} resultado(s)</small></button>`).join('')||empty('Nenhum marcador encontrado.')}</div><div class="exerciseDetail">${markerHistory(marker)}</div></div>`}</div>
    </div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Documentos</b><small>Metadados do histórico, origem e estado da leitura quando disponíveis.</small></div>${!docsFailed?pill(`${docs.length}`):''}</div>${docsFailed?unavailable('Os documentos não carregaram agora.'):`${documentSummary(docs)}<div class="documentGrid">${docs.slice(0,100).map(d=>`<article class="documentItem"><time>${fmtDate(d.document_date)}</time><div><b>${esc(d.title||d.document_type||'Documento')}</b><small>${esc(d.document_type||'tipo não informado')} · ${esc(d.source||'origem registrada')}</small>${d.source_file?`<em>${esc(d.source_file)}</em>`:''}</div>${documentStatus(d)}</article>`).join('')||empty('Nenhum documento registrado.')}</div>`}</div>
      <div class="card"><div class="cardHead"><div><b>Resultados e documentos na mesma data</b><small>Ajuda a localizar evidências relacionadas pela data sem assumir que um item explica o outro.</small></div></div>${labFailed||docsFailed?unavailable('Esta visão precisa dos resultados e dos documentos carregados ao mesmo tempo.'):evidenceByDate(cols,docs)}</div>
    </div>
    <p class="footerNote">A tela organiza os resultados registrados. Coincidência de data não demonstra causa, e interpretação clínica ou decisões de tratamento devem considerar o contexto médico completo.</p>`;
}
