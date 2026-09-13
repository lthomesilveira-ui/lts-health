import {state,esc,fmtDate,fmtNum,num,norm} from './core.js';
import {validDay,pageOf,pager,searchField,periodControl,seriesWindow,pointChart,emptyCard,errorCard,failed,differenceText} from './history-tools.js';

const origin=row=>String(row?.laboratory||row?.source||row?.source_file||'').trim();
const unit=row=>String(row?.unit||'').trim();
const method=row=>String(row?.method||'').trim();
const exactNumeric=row=>num(row?.result_numeric)!=null&&!/[<>≤≥]|menor que|maior que|inferior a|superior a/i.test(String(row?.result_raw||''));
export function labResultText(row){
  const raw=String(row?.result_raw??'').trim(),u=unit(row);
  if(raw)return `${raw}${u&&!norm(raw).includes(norm(u))?` ${u}`:''}`;
  if(num(row?.result_numeric)!=null)return `${fmtNum(row.result_numeric,2)}${u?` ${u}`:''}`;
  return 'Resultado não estruturado';
}
export function labGroups(rows){
  const map=new Map();
  for(const [index,row] of rows.entries()){
    const key=norm(row.biomarker)||`sem-marcador-${index}`;
    if(!map.has(key))map.set(key,{key,label:String(row.biomarker||'Marcador não informado').trim(),rows:[]});
    map.get(key).rows.push(row);
  }
  return [...map.values()].map(group=>({...group,rows:group.rows.slice().sort((a,b)=>String(a.collection_date||'').localeCompare(String(b.collection_date||'')))})).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
}
export function labCohorts(group){
  const map=new Map();
  for(const row of group?.rows||[]){
    // Unknown metadata stays available to read, but is never considered comparable.
    const o=origin(row),u=unit(row),m=method(row),key=JSON.stringify([norm(o),u,norm(m)]);
    if(!map.has(key))map.set(key,{key,origin:o,unit:u,method:m,all:[]});
    map.get(key).all.push(row);
  }
  return [...map.values()].map(c=>{
    const byDate=new Map();
    for(const row of c.all){const d=validDay(row.collection_date);if(!d)continue;if(!byDate.has(d))byDate.set(d,[]);byDate.get(d).push(row);}
    const ambiguousDates=[...byDate].filter(([,list])=>list.length>1).map(([d])=>d);
    const rows=c.origin&&c.unit&&norm(group?.label)&&!String(group?.key||'').startsWith('sem-marcador-')?[...byDate].filter(([,list])=>list.length===1&&exactNumeric(list[0])).map(([,list])=>list[0]).sort((a,b)=>validDay(a.collection_date).localeCompare(validDay(b.collection_date))):[];
    return{...c,rows,ambiguousDates};
  }).sort((a,b)=>String(b.all.at(-1)?.collection_date||'').localeCompare(String(a.all.at(-1)?.collection_date||''))||b.rows.length-a.rows.length||a.key.localeCompare(b.key));
}
export function labsModel(){
  const rows=state.data.labs||[],groups=labGroups(rows);
  const ranked=groups.map(group=>({group,cohorts:labCohorts(group)})).sort((a,b)=>String(b.group.rows.at(-1)?.collection_date||'').localeCompare(String(a.group.rows.at(-1)?.collection_date||''))||a.group.label.localeCompare(b.group.label,'pt-BR'));
  const item=ranked.find(i=>i.group.key===state.ui.productLabMarker)||ranked.find(i=>i.cohorts.some(c=>c.rows.length>=2))||ranked[0]||null;
  if(!item)return{rows,groups,ranked,item:null};
  const cohort=item.cohorts.find(c=>c.key===state.ui.productLabCohort)||item.cohorts.find(c=>c.rows.length>=2)||item.cohorts[0];
  const lastDate=validDay(cohort?.all.at(-1)?.collection_date);
  const latestRows=lastDate?cohort.all.filter(row=>validDay(row.collection_date)===lastDate):cohort?.all||[];
  const latest=latestRows.length===1?latestRows[0]:null;
  const period=['recent','90','365','all'].includes(state.ui.productLabPeriod)?state.ui.productLabPeriod:'recent';
  const recent=seriesWindow(cohort?.rows||[],'collection_date',period);
  const history=pageOf([...item.group.rows].reverse(),state.ui.productLabPage,10);
  const query=norm(state.ui.productLabQuery),matches=groups.filter(g=>!query||norm(g.label).includes(query));
  return{rows,groups,ranked,item,cohort,latestRows,latest,lastDate,period,recent,history,matches};
}
const header=()=>`<header class="ltsPageHeader"><button class="ltsBack" data-route="hoje" aria-label="Voltar">‹</button><div><span class="ltsEyebrow">Exames</span><h1 tabindex="-1" id="productLabsTitle">Exames</h1><p>Resultados e histórico, com origem preservada.</p></div><button class="ltsRoundAction" data-route="dados" aria-label="Dados e fontes">i</button></header>`;
function resultMeta(row){return [origin(row)||'Origem não informada',unit(row)||'Unidade não informada',row.reference_range?`Referência: ${row.reference_range}`:'Referência não informada',method(row)?`Método: ${method(row)}`:''].filter(Boolean).join(' · ');}

export function renderProductLabs(){
  if(failed(state,'labs'))return `<section class="ltsLabsV2">${header()}${errorCard('Os resultados laboratoriais não carregaram agora.')}</section>`;
  const m=labsModel();
  if(!m.item)return `<section class="ltsLabsV2">${header()}${emptyCard('Nenhum resultado laboratorial foi encontrado no histórico carregado.')}</section>`;
  const group=m.item.group,c=m.cohort,first=m.recent[0],last=m.recent.at(-1);
  const change=m.recent.length>=2?`${fmtDate(first.collection_date)} → ${fmtDate(last.collection_date)}: ${differenceText(last.result_numeric,first.result_numeric,c.unit,2)}`:'Não há dois pontos comparáveis no período.';
  const shortcuts=(state.ui.productLabQuery?m.matches:m.ranked.map(i=>i.group)).slice(0,8);
  const latestValue=m.latest?labResultText(m.latest):`${m.latestRows.length} resultados na mesma data`;
  return `<section class="ltsLabsV2">
    ${header()}
    <section class="ltsLabsHero"><div class="ltsLabsHeroTop"><div><span>${esc(group.label)}</span><strong>${esc(latestValue)}</strong><small>${esc(m.lastDate?fmtDate(m.lastDate):'Data não informada')} · ${esc(c.origin||'Origem não informada')}</small></div><span class="ltsLabsGlyph" aria-hidden="true">✦</span></div><div class="ltsLabsHeroContext"><div><span>Último registro da origem selecionada</span><b>${m.latest?'Valor transcrito da fonte.':'Nenhum resultado foi escolhido automaticamente.'}</b></div><div><span>Referência registrada</span><b>${esc(m.latest?.reference_range||'Consulte o contexto de cada resultado no histórico.')}</b></div></div></section>

    <section class="ltsSection ltsLabsMarkers"><div class="ltsSectionHead"><div><span>Explorar</span><h2>Todos os marcadores</h2></div><small>${m.groups.length} marcadores · ${m.rows.length} resultados</small></div>
      ${searchField('productLabQuery',state.ui.productLabQuery,'Nome do marcador','Buscar em todos os marcadores')}
      <label class="ltsField ltsSourceSelect">Marcador · ${m.matches.length} encontrados<select id="productLabMarkerSelect" data-depth-field="productLabMarkerSelect"><option value="">Selecione um marcador</option>${m.matches.map(g=>`<option value="${esc(g.key)}" ${g.key===group.key?'selected':''}>${esc(g.label)} (${g.rows.length})</option>`).join('')}</select></label>
      <div class="ltsLabsMarkerRail">${shortcuts.map(g=>`<button type="button" data-lab-marker="${esc(g.key)}" class="${g.key===group.key?'active':''}" aria-pressed="${g.key===group.key}"><b>${esc(g.label)}</b><small>${g.rows.length} ${g.rows.length===1?'resultado':'resultados'}</small></button>`).join('')||emptyCard('Nenhum marcador corresponde à busca. Apague a busca para ver todos.')}</div>
      <p class="ltsDepthNote">Os atalhos são recentes; o seletor inclui todo o histórico, inclusive resultados textuais e marcadores com uma única coleta.</p>
    </section>

    <section class="ltsSection ltsLabsTrend"><div class="ltsSectionHead"><div><span>Evolução</span><h2>${esc(group.label)}</h2></div></div>
      <label class="ltsField ltsSourceSelect">Origem, unidade e método da série<select id="productLabCohort" data-depth-field="productLabCohort">${m.item.cohorts.map(co=>`<option value="${esc(co.key)}" ${co.key===c.key?'selected':''}>${esc(co.origin||'Origem não informada')} · ${esc(co.unit||'Sem unidade')} · ${esc(co.method||'Método não informado')} (${co.all.length})</option>`).join('')}</select></label>
      ${periodControl('productLabPeriod',m.period)}
      <div class="ltsHistoryContext"><b>Diferença na série selecionada</b>${esc(change)}</div>
      <div class="ltsLabsChart">${pointChart(m.recent.map(r=>({date:r.collection_date,value:r.result_numeric,context:r.reference_range?`Referência da coleta: ${r.reference_range}`:'Referência não informada'})),{unit:c.unit,label:group.label,scope:'productLab',selected:state.ui.productLabPoint})}</div>
      <p class="ltsDepthNote">${m.recent.length} pontos exibidos de ${c.rows.length} inequívocos. A janela termina na última coleta comparável desta série; os intervalos do gráfico representam o tempo entre as coletas.${c.ambiguousDates.length?` ${c.ambiguousDates.length} data(s) com múltiplos resultados fica(m) fora da curva.`:''}</p>
    </section>

    <section class="ltsSection ltsLabsHistory"><div class="ltsSectionHead"><div><span>Consultar</span><h2>Histórico completo do marcador</h2></div><small>Todas as origens e unidades</small></div><div class="ltsLabsHistoryList" data-lab-history-total="${m.history.total}">${m.history.rows.map(row=>`<article class="ltsLabsHistoryRow"><time>${esc(fmtDate(row.collection_date))}</time><div><b>${esc(labResultText(row))}</b><small>${esc(resultMeta(row))}</small></div>${row.flag?`<span class="ltsRecordFlag" title="Sinalização transcrita da fonte">${esc(row.flag)}</span>`:''}</article>`).join('')}</div>${pager(m.history,'productLabPage')}</section>
    <section class="ltsLabsTrust"><span>i</span><p>O histórico preserva cada resultado. Curvas e diferenças usam somente números exatos, na mesma origem, unidade e método registrado, em datas inequívocas. Sem conversão automática, diagnóstico ou interpretação clínica.</p></section>
  </section>`;
}
