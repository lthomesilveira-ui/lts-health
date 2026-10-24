import {labResultReading,compareLabResults,knownLabMetadata,labHistoryConflicts} from './health-dashboard-labs.js';
import {selectedCalendar} from './home-period-model.js';
import {state,esc,fmtDate,fmtNum,num,norm} from './core.js';
import {validDay,pageOf,pager,searchField,periodControl,seriesWindow,pointChart,emptyCard,errorCard,failed,differenceText} from './history-tools.js';

const origin=row=>String(row?.laboratory||row?.source||row?.source_file||'').trim();
const unit=row=>String(row?.unit||'').trim();
const method=row=>String(row?.method||'').trim();
// Expand only this explicitly named abbreviation. Preserve the original label
// in the result; missing methods and other chromatographic methods stay separate.
export function labMethodKey(value){
  const label=norm(value);
  return ['hplc','cromatografia líquida de alta eficiência (hplc)'].map(norm).includes(label)?'hplc':label;
}
const exactNumeric=row=>labResultReading(row).exactValue!=null;
export function labResultText(row){
  const raw=String(row?.result_raw??'').trim(),u=unit(row);
  if(raw)return `${raw}${u&&!norm(raw).includes(norm(u))?` ${u}`:''}`;
  if(num(row?.result_numeric)!=null)return `${fmtNum(row.result_numeric,2)}${u?` ${u}`:''}`;
  return 'Resultado não informado';
}
// Read only one explicit interval from this result's own report. Do not pick a
// range from multiple populations, fasting conditions, risk targets or units.
// This is a numerical position in the printed interval, never a diagnosis.
export function labReferenceStatus(row){
  const reading=labResultReading(row),reference=reading.reference||'';
  if(reading.referencePosition==='unknown')return {status:'unclassified',reference};
  const range=reading.interval;
  // Retain printed decimal precision for display-only consumers. Eligibility
  // and boundaries above come solely from the shared, conservative reader.
  const printed=reference.replace(/^[^:]+:\s*/,'').replace(/;\s*resultado confirmado após diluição$/i,'');
  const rawRange=printed.match(/^([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*(?:a|até|to|[-–—])\s*([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))(?:\s+.+)?$/i);
  const printedBounds=rawRange&&Number(rawRange[1].replace(',','.'))===range.lower&&Number(rawRange[2].replace(',','.'))===range.upper;
  return {status:reading.referencePosition,reference,low:range.lower,high:range.upper,
    lowRaw:range.lower==null?null:printedBounds?rawRange[1]:String(range.lower),highRaw:range.upper==null?null:printedBounds?rawRange[2]:String(range.upper),
    unit:reading.unit,scope:reading.referenceScope,lowerInclusive:range.lowerInclusive,upperInclusive:range.upperInclusive};
}
export const labReferenceLabel=row=>{
  const reading=labReferenceStatus(row),label=({above:'Acima da faixa exibida no laudo',below:'Abaixo da faixa exibida no laudo',within:'Dentro da faixa exibida no laudo'})[reading.status];
  return label?`${label}${reading.scope?' · '+reading.scope:''}`:'';
};
export function labGroups(rows,evidenceRows=rows){
  const map=new Map(),identityConflicts=labHistoryConflicts(evidenceRows);
  for(const [index,row] of rows.entries()){
    const key=norm(row.biomarker)||`sem-marcador-${index}`;
    if(!map.has(key))map.set(key,{key,label:String(row.biomarker||'Marcador não informado').trim(),rows:[]});
    map.get(key).rows.push(row);
  }
  return [...map.values()].map(group=>({...group,identityConflicts,rows:group.rows.slice().sort((a,b)=>String(a.collection_date||'').localeCompare(String(b.collection_date||'')))})).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
}
export function labCohorts(group){
  const map=new Map();
  for(const row of group?.rows||[]){
    // Unknown metadata stays available to read, but is never considered comparable.
    const o=origin(row),u=unit(row),m=method(row),key=JSON.stringify([norm(o),u,labMethodKey(m)]);
    if(!map.has(key))map.set(key,{key,origin:o,unit:u,method:m,all:[]});
    map.get(key).all.push(row);
  }
  return [...map.values()].map(c=>{
    const byDate=new Map();
    for(const row of c.all){const d=validDay(row.collection_date);if(!d)continue;if(!byDate.has(d))byDate.set(d,[]);byDate.get(d).push(row);}
    const contextDates=new Map();
    for(const row of group?.rows||[]){const date=validDay(row.collection_date);if(date&&norm(origin(row))===norm(c.origin)&&unit(row)===c.unit){if(!contextDates.has(date))contextDates.set(date,[]);contextDates.get(date).push(row);}}
    const ambiguousDates=[...contextDates].filter(([,list])=>list.length>1||list.some(row=>group?.identityConflicts?.has(row))).map(([d])=>d);
    const rows=knownLabMetadata(c.origin)&&knownLabMetadata(c.unit)&&norm(group?.label)&&!String(group?.key||'').startsWith('sem-marcador-')?[...byDate].filter(([date,list])=>!ambiguousDates.includes(date)&&list.length===1&&exactNumeric(list[0])).map(([,list])=>list[0]).sort((a,b)=>validDay(a.collection_date).localeCompare(validDay(b.collection_date))):[];
    return{...c,rows,ambiguousDates,identityConflicts:group?.identityConflicts||new Set(),collectionRows:group?.rows||c.all};
  }).sort((a,b)=>String(b.all.at(-1)?.collection_date||'').localeCompare(String(a.all.at(-1)?.collection_date||''))||b.rows.length-a.rows.length||a.key.localeCompare(b.key));
}
// Keep line segments bound to adjacent readable collections. A note, limit,
// ambiguity or incompatible reference breaks the segment instead of being
// silently skipped. Original rows remain in cohort.all and the full history.
export function labCohortPoints(cohort){
  const byDate=new Map();
  for(const row of cohort?.collectionRows||cohort?.all||[]){const date=validDay(row.collection_date);if(!date)continue;if(!byDate.has(date))byDate.set(date,[]);byDate.get(date).push(row);}
  const eligible=new Set(cohort?.rows||[]),points=[];let previous=null,segment=0;
  for(const [date,rows] of [...byDate].sort(([a],[b])=>a.localeCompare(b))){
    const selected=rows.filter(row=>cohort.all.includes(row)),row=selected.length===1?selected[0]:null;
    if(!row||!eligible.has(row)){previous=null;segment++;continue;}
    const reading=labResultReading(row),comparison=previous?compareLabResults(row,previous):null;
    if(!comparison?.comparable)segment++;
    const metadata=[row.biomarker,row.laboratory,row.unit,row.method,row.reference_range].every(knownLabMetadata);
    points.push({date,value:reading.exactValue,cohort:metadata?JSON.stringify([cohort.key,segment]):null,
      context:`${cohort.origin} · ${cohort.method||'método não informado'} · Referência: ${row.reference_range||'não informada'}`,
      raw:labResultText(row),row});
    previous=row;
  }
  return points;
}
export function labCohortComparison(cohort){
  const all=(cohort?.all||[]).slice().sort((a,b)=>String(a.collection_date||'').localeCompare(String(b.collection_date||'')));
  const first=all[0],last=all.at(-1);
  if(all.some(row=>cohort?.identityConflicts?.has(row))||(cohort?.ambiguousDates||[]).some(date=>all.some(row=>validDay(row.collection_date)===date)))return {...compareLabResults(last,first,{ambiguous:true}),first,last};
  if(all.length<2)return {...compareLabResults(last,null),first,last};
  const selectedDates=new Set(all.map(row=>validDay(row.collection_date)));
  const intervening=(cohort.collectionRows||[]).filter(row=>validDay(row.collection_date)>validDay(first.collection_date)&&validDay(row.collection_date)<validDay(last.collection_date)&&!selectedDates.has(validDay(row.collection_date))).sort((a,b)=>String(a.collection_date).localeCompare(String(b.collection_date)));
  if(intervening.length){const row=intervening[0],prior=all.filter(x=>validDay(x.collection_date)<validDay(row.collection_date)).at(-1);const pair=compareLabResults(row,prior);return {...pair,comparable:false,rangeComparable:false,delta:null,comparisonReason:'intervening_collection',comparisonReasonLabel:labComparisonText('intervening_collection'),label:'sem comparação',status:'sem comparação',comparisonLabel:'Valores separados; comparação não estabelecida',first,last};}
  const dates=all.map(row=>validDay(row.collection_date));
  const ambiguous=dates.some((date,i)=>date&&dates.indexOf(date)!==i);
  if(ambiguous)return {...compareLabResults(last,first,{ambiguous:true}),first,last};
  for(let i=1;i<all.length;i++){
    const pair=compareLabResults(all[i],all[i-1]);
    if(!pair.comparable)return {...pair,first,last};
  }
  return {...compareLabResults(last,first),first,last};
}
export function labComparisonText(reason){
  return ({
    intervening_collection:'Há uma coleta intermediária em outro contexto. Os valores permanecem separados para não pular esse resultado.',
    no_previous:'Uma coleta disponível nesta série. Os resultados originais estão no histórico.',
    non_exact_value:'Há resultado com nota, limite ou formato que não permite uma diferença automática. Consulte o resultado original no histórico.',
    unknown_method:'O método não está informado em uma das coletas. Os valores permanecem separados.',
    different_method:'Os métodos das coletas são diferentes. Os valores permanecem separados.',
    different_or_missing_reference:'As referências das coletas são diferentes ou não estão informadas. Os valores permanecem separados.',
    ambiguous_collection:'Há mais de um resultado na mesma coleta. Consulte cada resultado no histórico.',
    unknown_laboratory:'O laboratório não está informado em uma das coletas. Os valores permanecem separados.',
    different_laboratory:'As coletas são de laboratórios diferentes. Os valores permanecem separados.',
    unknown_unit:'A unidade não está informada em uma das coletas. Os valores permanecem separados.',
    different_unit:'As unidades são diferentes. Os valores permanecem separados.',
    unknown_biomarker:'O nome do marcador não está informado. Consulte o resultado original.',
    different_biomarker:'Os nomes dos marcadores são diferentes. Os valores permanecem separados.',
    invalid_collection_date:'A data de uma coleta não está disponível para comparar. Consulte o histórico.',
    non_chronological_collections:'As datas não permitem ordenar essas coletas para comparar.'
  })[reason]||'Esta série não permite uma diferença automática. Consulte os resultados originais no histórico.';
}

export function labsModel(){
  const asOf=validDay(state.ui.productLabAsOf);
  const allRows=(state.data.labs||[]).filter(row=>!asOf||validDay(row.collection_date)<=asOf);
  const selected=selectedCalendar(state.data,state.domainStatus,state.ui.productLabPeriod||state.ui.homePeriod||'90');
  const period=selected.period,bounds=asOf?{...selected.bounds,start:selected.bounds.start<asOf?selected.bounds.start:asOf,end:asOf}:selected.bounds;
  const rows=allRows.filter(r=>validDay(r.collection_date)>=bounds.start&&validDay(r.collection_date)<=bounds.end),groups=labGroups(rows,allRows.filter(row=>validDay(row.collection_date)&&validDay(row.collection_date)<=bounds.end));
  const ranked=groups.map(group=>({group,cohorts:labCohorts(group)})).sort((a,b)=>String(b.group.rows.at(-1)?.collection_date||'').localeCompare(String(a.group.rows.at(-1)?.collection_date||''))||a.group.label.localeCompare(b.group.label,'pt-BR'));
  const item=ranked.find(i=>i.group.key===state.ui.productLabMarker)||ranked.find(i=>i.group.key===norm('Hemoglobina Glicada (A1C)')&&i.group.rows.at(-1)?.collection_date===ranked[0]?.group.rows.at(-1)?.collection_date)||ranked[0]||null;
  if(!item)return{allRows,rows,groups,ranked,item:null,period,bounds,asOf};
  const cohort=item.cohorts.find(c=>c.key===state.ui.productLabCohort)||item.cohorts[0];
  const lastDate=validDay(cohort?.all.at(-1)?.collection_date);
  const latestRows=lastDate?cohort.all.filter(row=>validDay(row.collection_date)===lastDate):cohort?.all||[];
  const latest=latestRows.length===1&&!cohort?.identityConflicts?.has(latestRows[0])&&!cohort?.ambiguousDates?.includes(lastDate)?latestRows[0]:null;
  const recent=cohort?.rows||[];
  const history=pageOf([...(labGroups(allRows).find(g=>g.key===item.group.key)?.rows||[])].reverse(),state.ui.productLabPage,10);
  const query=norm(state.ui.productLabQuery),matches=groups.filter(g=>!query||norm(g.label).includes(query));
  return{allRows,rows,bounds,groups,ranked,item,cohort,latestRows,latest,lastDate,period,recent,history,matches,asOf};
}
const header=()=>`<header class="ltsPageHeader"><button class="ltsBack" data-route="hoje" aria-label="Voltar">‹</button><div><span class="ltsEyebrow">Exames</span><h1 tabindex="-1" id="productLabsTitle">Exames</h1><p>Seus resultados, referências e coletas anteriores.</p></div><button class="ltsRoundAction" data-route="dados" aria-label="Dados e fontes">i</button></header>`;
function resultMeta(row){return [origin(row)||'Origem não informada',unit(row)||'Unidade não informada',row.reference_range?`Referência: ${row.reference_range}`:'Referência não informada',method(row)?`Método: ${method(row)}`:''].filter(Boolean).join(' · ');}

function collectionOverview(rows,identityConflicts=new Set()){
  const dates=[...new Set(rows.map(r=>validDay(r.collection_date)).filter(Boolean))].sort().reverse();
  const date=dates.includes(state.ui.productLabCollection)?state.ui.productLabCollection:dates[0];
  const panels=[['Metabolismo e lipídios',['Hemoglobina Glicada (A1C)','Glicose','LDL-Colesterol','HDL-Colesterol','Triglicérides','Apolipoproteína B']],['Hemograma e reservas',['Hemoglobina','Hematócrito','Leucócitos','Ferritina','Vitamina B-12','25-OH Vitamina D Total']],['Hormônios e contexto',['Testosterona Total','Testosterona livre','Estradiol','SHBG','TSH','T4 Livre']]];
  const values=rows.filter(r=>validDay(r.collection_date)===date);
  return `<section class="ltsLabCollection"><div class="ltsSectionHead"><div><span>RESULTADOS JUNTOS</span><h2>Coleta de ${esc(fmtDate(date))}</h2></div></div><label class="ltsField">Consultar coleta<select id="productLabCollection" data-depth-field="productLabCollection">${dates.map(d=>`<option value="${d}" ${d===date?'selected':''}>${fmtDate(d)}</option>`).join('')}</select></label>${panels.map(([title,names])=>{const cards=names.map(name=>{const matches=values.filter(r=>norm(r.biomarker)===norm(name));if(!matches.length)return '';return `<button type="button" class="ltsLabValueCard" data-lab-marker="${esc(norm(name))}"><span>${esc(name)}</span><strong>${esc(matches.length===1?labResultText(matches[0]):'Resultados distintos')}</strong>${matches.length===1&&!identityConflicts.has(matches[0])&&labReferenceLabel(matches[0])?`<small class="ltsLabReferencePosition">${esc(labReferenceLabel(matches[0]))}</small>`:''}<small>${esc(matches.length===1?matches[0].reference_range?`Referência do laudo: ${matches[0].reference_range}`:'Sem referência registrada':'Consulte cada resultado no histórico.')}</small><em>Histórico e detalhes ›</em></button>`;}).join('');return cards?`<h3>${esc(title)}</h3><div class="ltsLabValueGrid">${cards}</div>`:'';}).join('')}<p class="ltsDepthNote">A posição na faixa usa somente um intervalo explícito do próprio laudo, na mesma unidade. Referências não são metas individuais; estar dentro da faixa não garante saúde, e estar fora não define diagnóstico. Faixas com múltiplas condições exigem leitura do laudo. Outros marcadores, métodos e resultados textuais continuam no seletor completo abaixo.</p></section>`;
}

export function renderProductLabs(){
  if(failed(state,'labs'))return `<section class="ltsLabsV2">${header()}${errorCard('Os resultados laboratoriais não carregaram agora.')}</section>`;
  const m=labsModel();
  const windowControl=`${m.asOf?`<p class="ltsDepthNote" data-lab-asof>Consulta até ${esc(fmtDate(m.asOf))}, data da leitura selecionada. <button type="button" data-lab-clear-asof>Ver histórico sem este corte</button></p>`:''}${periodControl('productLabPeriod',m.period)}<p class="ltsDepthNote">${esc(fmtDate(m.bounds.start))}–${esc(fmtDate(m.bounds.end))}, ${m.asOf?'corte da leitura selecionada.':'a mesma janela selecionada na Visão geral.'}</p>`;
  if(!m.item)return `<section class="ltsLabsV2">${header()}${windowControl}${emptyCard('Nenhum resultado laboratorial nesta janela. Selecione Histórico para consultar coletas anteriores.')}</section>`;
  const group=m.item.group,c=m.cohort,comparison=labCohortComparison(c),first=comparison.first,last=comparison.last;
  const change=comparison.comparable?`${fmtDate(first.collection_date)} → ${fmtDate(last.collection_date)}: ${differenceText(labResultReading(last).exactValue,labResultReading(first).exactValue,c.unit,2)}`:labComparisonText(comparison.comparisonReason);
  const shortcuts=(state.ui.productLabQuery?m.matches:m.ranked.map(i=>i.group)).slice(0,8);
  const latestValue=m.latest?labResultText(m.latest):m.latestRows.length===1?'Resultado com registros divergentes':`${m.latestRows.length} resultados na mesma data`;
  return `<section class="ltsLabsV2">
    ${header()}${windowControl}
    ${collectionOverview(m.rows,m.item.group.identityConflicts)}
    <section class="ltsLabsHero"><div class="ltsLabsHeroTop"><div><span>${esc(group.label)}</span><strong>${esc(latestValue)}</strong><small>${esc(m.lastDate?fmtDate(m.lastDate):'Data não informada')} · ${esc(c.origin||'Origem não informada')}</small></div><span class="ltsLabsGlyph" aria-hidden="true">✦</span></div><div class="ltsLabsHeroContext"><div><span>Último resultado desta origem</span><b>${m.latest?'Resultado como aparece no laudo.':'Nenhum resultado foi escolhido automaticamente.'}</b></div><div><span>Referência registrada</span><b>${esc(m.latest?.reference_range||'Consulte o contexto de cada resultado no histórico.')}</b></div></div></section>

    <section class="ltsSection ltsLabsMarkers"><div class="ltsSectionHead"><div><span>Explorar</span><h2>Todos os marcadores</h2></div><small>${m.groups.length} marcadores · ${m.rows.length} resultados</small></div>
      ${searchField('productLabQuery',state.ui.productLabQuery,'Nome do marcador','Buscar em todos os marcadores')}
      <label class="ltsField ltsSourceSelect">Marcador · ${m.matches.length} encontrados<select id="productLabMarkerSelect" data-depth-field="productLabMarkerSelect"><option value="">Selecione um marcador</option>${m.matches.map(g=>`<option value="${esc(g.key)}" ${g.key===group.key?'selected':''}>${esc(g.label)} (${g.rows.length})</option>`).join('')}</select></label>
      <div class="ltsLabsMarkerRail">${shortcuts.map(g=>`<button type="button" data-lab-marker="${esc(g.key)}" class="${g.key===group.key?'active':''}" aria-pressed="${g.key===group.key}"><b>${esc(g.label)}</b><small>${g.rows.length} ${g.rows.length===1?'resultado':'resultados'}</small></button>`).join('')||emptyCard('Nenhum marcador corresponde à busca. Apague a busca para ver todos.')}</div>
      <p class="ltsDepthNote">O seletor inclui os marcadores desta janela, inclusive resultados textuais e marcadores com uma única coleta. Selecione Histórico para acessar outras datas.</p>
    </section>

    <section class="ltsSection ltsLabsTrend"><div class="ltsSectionHead"><div><span>Evolução</span><h2>${esc(group.label)}</h2></div></div>
      <label class="ltsField ltsSourceSelect">Origem, unidade e método da série<select id="productLabCohort" data-depth-field="productLabCohort">${m.item.cohorts.map(co=>`<option value="${esc(co.key)}" ${co.key===c.key?'selected':''}>${esc(co.origin||'Origem não informada')} · ${esc(co.unit||'Sem unidade')} · ${esc(co.method||'Método não informado')} (${co.all.length})</option>`).join('')}</select></label>

      <div class="ltsHistoryContext"><b>Diferença na série selecionada</b>${esc(change)}</div>
      <div class="ltsLabsChart">${pointChart(m.recent.map(r=>({date:r.collection_date,value:r.result_numeric,context:r.reference_range?`Referência da coleta: ${r.reference_range}`:'Referência não informada'})),{unit:c.unit,label:group.label,scope:'productLab',selected:state.ui.productLabPoint,connect:comparison.comparable})}</div>
      <p class="ltsDepthNote">${m.recent.length} pontos exibidos de ${c.all.length} resultados desta série. Os demais resultados permanecem no histórico, com suas notas, limites e referências originais. A janela segue o período global; os intervalos do gráfico representam o tempo entre as coletas.${c.ambiguousDates.length?` ${c.ambiguousDates.length} data(s) com múltiplos resultados fica(m) fora da curva.`:''}</p>
    </section>

    <section class="ltsSection ltsLabsHistory"><div class="ltsSectionHead"><div><span>Consultar</span><h2>Histórico completo do marcador</h2></div><small>Todas as origens e unidades</small></div><div class="ltsLabsHistoryList" data-lab-history-total="${m.history.total}">${m.history.rows.map(row=>`<article class="ltsLabsHistoryRow"><time>${esc(fmtDate(row.collection_date))}</time><div><b>${esc(labResultText(row))}</b><small>${esc(resultMeta(row))}</small></div>${row.flag?`<span class="ltsRecordFlag" title="Sinalização transcrita da fonte">${esc(row.flag)}</span>`:''}</article>`).join('')}</div>${pager(m.history,'productLabPage')}</section>
    <section class="ltsLabsTrust"><span>i</span><details><summary>Sobre estes dados</summary><p>O histórico preserva cada resultado. Curvas e diferenças usam somente números com leitura exata, no mesmo laboratório, unidade, método e referência registrados, em datas sem conflito. Notas, limites e coletas incompatíveis interrompem a comparação. Sem conversão automática, diagnóstico ou interpretação clínica.</p></details></section>
  </section>`;
}
