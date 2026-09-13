import {state,esc,fmtDate,fmtNum,num,norm} from './core.js';

const day=value=>String(value||'').slice(0,10);
const origin=row=>String(row?.laboratory||row?.source||row?.source_file||row?.source_record_id||row?.id||'').trim();
const unit=row=>String(row?.unit||'').trim();
const numeric=row=>num(row?.result_numeric)!=null;
const resultText=row=>{
  const raw=String(row?.result_raw||'').trim();
  if(raw)return raw;
  if(numeric(row))return `${fmtNum(row.result_numeric)}${unit(row)?` ${unit(row)}`:''}`;
  return 'Resultado não estruturado';
};

function labRows(){return [...(state.data.labs||[])].filter(row=>row?.collection_date&&row?.biomarker).sort((a,b)=>String(a.collection_date).localeCompare(String(b.collection_date)));}
function markerGroups(rows){
  const map=new Map();
  for(const row of rows){const key=norm(row.biomarker);if(!key)continue;if(!map.has(key))map.set(key,{key,label:String(row.biomarker).trim(),rows:[]});map.get(key).rows.push(row);}
  return [...map.values()];
}
function cohortSeries(group){
  const cohorts=new Map();
  for(const row of group?.rows||[]){
    if(!numeric(row)||!origin(row)||!unit(row))continue;
    const key=`${norm(origin(row))}__${unit(row)}`;
    if(!cohorts.has(key))cohorts.set(key,{key,origin:origin(row),unit:unit(row),rows:[]});
    cohorts.get(key).rows.push(row);
  }
  return [...cohorts.values()].map(cohort=>{
    const byDate=new Map();
    for(const row of cohort.rows){const key=day(row.collection_date);if(!key)continue;if(!byDate.has(key))byDate.set(key,[]);byDate.get(key).push(row);}
    const ambiguousDates=[...byDate.entries()].filter(([,items])=>items.length>1).map(([date])=>date);
    const rows=[...byDate.entries()].filter(([,items])=>items.length===1).map(([,items])=>items[0]).sort((a,b)=>String(a.collection_date).localeCompare(String(b.collection_date)));
    return {...cohort,rows,ambiguousDates};
  }).filter(cohort=>cohort.rows.length>=2).sort((a,b)=>String(b.rows.at(-1)?.collection_date||'').localeCompare(String(a.rows.at(-1)?.collection_date||''))||b.rows.length-a.rows.length);
}
function rankedGroups(groups){
  return groups.map(group=>{const series=cohortSeries(group),best=series[0]||null;return{group,series,best,latestDate:best?.rows.at(-1)?.collection_date||group.rows.at(-1)?.collection_date||'',points:best?.rows.length||0};})
    .sort((a,b)=>String(b.latestDate).localeCompare(String(a.latestDate))||b.points-a.points||a.group.label.localeCompare(b.group.label,'pt-BR'));
}
function selectedGroup(groups){
  const ranked=rankedGroups(groups),requested=state.ui.productLabMarker;
  const explicit=requested&&ranked.find(item=>item.group.key===requested);
  return explicit||ranked.find(item=>item.best)||ranked[0]||null;
}
function latestCollection(rows){
  const latestDate=rows.at(-1)?.collection_date;if(!latestDate)return null;
  const sameDate=rows.filter(row=>day(row.collection_date)===day(latestDate));
  return{date:latestDate,count:sameDate.length,origins:[...new Set(sameDate.map(origin).filter(Boolean))]};
}
function chart(series){
  const rows=(series?.rows||[]).slice(-12);
  if(rows.length<2)return `<div class="ltsLabsEmptyChart"><b>Série ainda insuficiente</b><span>São necessários pelo menos dois pontos inequívocos da mesma origem e unidade.</span></div>`;
  const values=rows.map(row=>num(row.result_numeric)),width=660,height=190,padX=28,padY=24;
  const rawMin=Math.min(...values),rawMax=Math.max(...values),span=Math.max(rawMax-rawMin,Math.max(Math.abs(rawMax)*.06,.1));
  const min=rawMin-span*.16,max=rawMax+span*.16;
  const x=index=>padX+(index*(width-padX*2))/Math.max(rows.length-1,1);
  const y=value=>padY+((max-value)*(height-padY*2))/(max-min||1);
  const path=rows.map((row,index)=>`${index?'L':'M'} ${x(index).toFixed(1)} ${y(num(row.result_numeric)).toFixed(1)}`).join(' ');
  const dots=rows.map((row,index)=>`<circle cx="${x(index).toFixed(1)}" cy="${y(num(row.result_numeric)).toFixed(1)}" r="${index===rows.length-1?5:3}"><title>${esc(fmtDate(row.collection_date))}: ${esc(fmtNum(row.result_numeric))} ${esc(series.unit)}</title></circle>`).join('');
  return `<div class="ltsLabsChartBody"><div class="ltsLabsScale"><span>${esc(fmtNum(rawMax))}</span><span>${esc(fmtNum((rawMax+rawMin)/2))}</span><span>${esc(fmtNum(rawMin))}</span></div><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Evolução longitudinal do marcador"><path class="ltsLabsGrid" d="M28 48H632 M28 95H632 M28 142H632"/><path class="ltsLabsLine" d="${path}"/>${dots}</svg></div><div class="ltsLabsAxis"><span>${esc(fmtDate(rows[0].collection_date))}</span><b>${esc(series.unit)}</b><span>${esc(fmtDate(rows.at(-1).collection_date))}</span></div>`;
}
function resultMeta(row){
  const pieces=[origin(row)||'Origem não informada'];
  if(row?.reference_range)pieces.push(`referência ${row.reference_range}`);
  if(row?.method)pieces.push(`método ${row.method}`);
  return pieces.join(' · ');
}
function markerHistory(group){
  return [...(group?.rows||[])].sort((a,b)=>String(b.collection_date).localeCompare(String(a.collection_date))).slice(0,10).map(row=>`<article class="ltsLabsHistoryRow"><time>${esc(fmtDate(row.collection_date))}</time><div><b>${esc(resultText(row))}</b><small>${esc(resultMeta(row))}</small></div>${row.flag?`<span title="Sinalização registrada pela fonte">${esc(row.flag)}</span>`:''}</article>`).join('');
}

export function renderProductLabs(){
  if(state.domainStatus?.labs==='error'||state.errors?.labs)return `<section class="ltsLabsV2"><header class="ltsPageHeader"><button class="ltsBack" data-route="hoje" aria-label="Voltar">‹</button><div><span class="ltsEyebrow">Exames</span><h1>Exames</h1><p>Histórico longitudinal por marcador.</p></div></header><div class="ltsEmptyCard">Os resultados laboratoriais não carregaram agora. Nenhum valor foi substituído ou inferido.</div></section>`;
  const rows=labRows(),groups=markerGroups(rows),selected=selectedGroup(groups),collection=latestCollection(rows);
  if(!rows.length||!selected)return `<section class="ltsLabsV2"><header class="ltsPageHeader"><button class="ltsBack" data-route="hoje" aria-label="Voltar">‹</button><div><span class="ltsEyebrow">Exames</span><h1>Exames</h1><p>Histórico longitudinal por marcador.</p></div></header><div class="ltsEmptyCard">Nenhum resultado laboratorial estruturado foi encontrado.</div></section>`;
  const group=selected.group,series=selected.best,recent=(series?.rows||[]).slice(-12),latest=series?.rows.at(-1)||[...group.rows].sort((a,b)=>String(a.collection_date).localeCompare(String(b.collection_date))).at(-1);
  const first=recent.length>1?recent[0]:null,delta=first&&numeric(latest)?num(latest.result_numeric)-num(first.result_numeric):null;
  const ranked=rankedGroups(groups),longitudinal=ranked.filter(item=>item.best).slice(0,14);
  const ambiguous=series?.ambiguousDates?.length||0;
  const unitLabel=series?.unit||unit(latest)||'';
  const sourceLabel=series?.origin||origin(latest)||'Origem registrada';
  const changeText=first&&delta!=null?`De ${fmtDate(first.collection_date)} a ${fmtDate(latest.collection_date)}: ${delta>0?'+':''}${fmtNum(delta)}${unitLabel?` ${unitLabel}`:''}.`:'Ainda não há dois pontos comparáveis para calcular diferença.';
  return `<section class="ltsLabsV2">
    <header class="ltsPageHeader"><button class="ltsBack" data-route="hoje" aria-label="Voltar">‹</button><div><span class="ltsEyebrow">Exames</span><h1>Exames</h1><p>Resultado, mudança e histórico sem misturar origem ou unidade.</p></div><button class="ltsRoundAction" data-route="dados" aria-label="Dados e fontes">i</button></header>

    <section class="ltsLabsHero">
      <div class="ltsLabsHeroTop"><div><span>${esc(group.label)}</span><strong>${esc(resultText(latest))}</strong><small>${esc(fmtDate(latest.collection_date))} · ${esc(sourceLabel)}</small></div><span class="ltsLabsGlyph">✦</span></div>
      <div class="ltsLabsHeroContext"><div><span>Comparação recente</span><b>${esc(changeText)}</b></div><div><span>Referência registrada</span><b>${esc(latest.reference_range||'Não informada na fonte')}</b></div></div>
    </section>

    <section class="ltsSection ltsLabsMarkers"><div class="ltsSectionHead"><div><span>Acompanhar</span><h2>Marcadores com série</h2></div>${collection?`<small>Última coleta ${esc(fmtDate(collection.date))} · ${collection.count} resultados</small>`:''}</div><div class="ltsLabsMarkerRail">${longitudinal.map(item=>`<button type="button" data-lab-marker="${esc(item.group.key)}" class="${item.group.key===group.key?'active':''}"><b>${esc(item.group.label)}</b><small>${item.best.rows.length} pontos · ${esc(item.best.unit)}</small></button>`).join('')||'<span class="ltsLabsNoSeries">Ainda não há outros marcadores com série comparável.</span>'}</div></section>

    <section class="ltsSection ltsLabsTrend"><div class="ltsSectionHead"><div><span>Evolução</span><h2>${esc(group.label)}</h2></div><small>${esc(`${recent.length} pontos recentes · ${sourceLabel}${unitLabel?` · ${unitLabel}`:''}${ambiguous?` · ${ambiguous} data(s) ambígua(s) fora da linha`:''}`)}</small></div><div class="ltsLabsChart">${chart(series)}</div></section>

    <section class="ltsSection ltsLabsHistory"><div class="ltsSectionHead"><div><span>Resultados</span><h2>Histórico do marcador</h2></div></div><div class="ltsLabsHistoryList">${markerHistory(group)}</div></section>

    <section class="ltsLabsTrust"><span>i</span><p>A tendência só combina resultados numéricos do mesmo marcador, origem e unidade, em datas inequívocas. Faixas de referência e sinalizações são exibidas como contexto registrado pela fonte; o app não diagnostica nem classifica o resultado automaticamente.</p></section>
  </section>`;
}
