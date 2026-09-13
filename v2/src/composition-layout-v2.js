import {state,esc,fmtDate,fmtNum,num} from './core.js';

const metricMeta={
  body_fat_pct:{label:'Gordura corporal',short:'Gordura',unit:'%',digits:1},
  skeletal_muscle_mass_kg:{label:'Massa muscular',short:'Músculo',unit:'kg',digits:1},
  weight_kg:{label:'Peso',short:'Peso',unit:'kg',digits:1},
  fat_mass_kg:{label:'Massa de gordura',short:'Gordura kg',unit:'kg',digits:1}
};
const day=value=>String(value||'').slice(0,10);
const sourceIdentity=row=>String(row?.source_family||row?.source_name||row?.source||'').trim().toLowerCase();
const sourceDisplay=row=>{
  const raw=String(row?.source_name||row?.source||row?.source_family||'').trim();
  const normalized=raw.toLowerCase();
  if(normalized.includes('inbody'))return 'InBody';
  if(normalized.includes('bioimpedance'))return 'Bioimpedância';
  return raw||'Origem registrada';
};
const formatValue=(value,meta)=>num(value)==null?'—':`${fmtNum(value,meta.digits)} ${meta.unit}`;
const signed=(value,meta)=>num(value)==null?'—':`${Number(value)>0?'+':''}${fmtNum(value,meta.digits)} ${meta.unit}`;

function allBodyRows(){
  return [...(state.data.body||[])].filter(row=>row?.measured_at).sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at)));
}
function groupedByDay(rows){
  const groups=new Map();
  for(const row of rows){const key=day(row.measured_at);if(!key)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  return groups;
}
function comparableRows(rows){
  return [...groupedByDay(rows).entries()].filter(([,items])=>items.length===1).sort((a,b)=>a[0].localeCompare(b[0])).map(([,items])=>items[0]);
}
function ambiguityCount(rows){return [...groupedByDay(rows).values()].filter(items=>items.length>1).length;}
function coherentSeries(rows,anchor){
  if(!anchor)return[];
  const identity=sourceIdentity(anchor);
  if(!identity)return rows.length===1?rows:[];
  return rows.filter(row=>sourceIdentity(row)===identity);
}
function delta(last,first,key){
  const a=num(last?.[key]),b=num(first?.[key]);
  return a==null||b==null?null:a-b;
}

function lineChart(rows,key){
  const meta=metricMeta[key]||metricMeta.body_fat_pct;
  const pts=rows.map(row=>({date:row.measured_at,value:num(row[key])})).filter(point=>point.value!=null);
  if(pts.length<2)return `<div class="ltsCompositionEmptyChart"><b>${esc(meta.label)}</b><span>Histórico comparável ainda insuficiente para uma tendência.</span></div>`;
  const width=640,height=190,padX=24,padY=24;
  const values=pts.map(point=>point.value),rawMin=Math.min(...values),rawMax=Math.max(...values),span=Math.max(rawMax-rawMin,meta.unit==='%'?1:.5);
  const min=rawMin-span*.14,max=rawMax+span*.14;
  const x=index=>padX+(index*(width-padX*2))/Math.max(pts.length-1,1);
  const y=value=>padY+((max-value)*(height-padY*2))/(max-min||1);
  const path=pts.map((point,index)=>`${index?'L':'M'} ${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' ');
  const dots=pts.map((point,index)=>`<circle cx="${x(index).toFixed(1)}" cy="${y(point.value).toFixed(1)}" r="${index===pts.length-1?5:3}"><title>${esc(fmtDate(point.date))}: ${esc(formatValue(point.value,meta))}</title></circle>`).join('');
  const first=pts[0],last=pts.at(-1);
  return `<div class="ltsCompositionChartBody">
    <div class="ltsCompositionScale"><span>${esc(formatValue(rawMax,meta))}</span><span>${esc(formatValue((rawMax+rawMin)/2,meta))}</span><span>${esc(formatValue(rawMin,meta))}</span></div>
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${esc(meta.label)} ao longo do tempo"><path class="ltsCompositionGrid" d="M24 47H616 M24 95H616 M24 143H616"/><path class="ltsCompositionLine" d="${path}"/>${dots}</svg>
  </div><div class="ltsCompositionAxis"><span>${esc(fmtDate(first.date))}</span><b>${esc(meta.label)}</b><span>${esc(fmtDate(last.date))}</span></div>`;
}

function latestMetric(label,value,unit,accent=''){
  return `<div class="ltsCompositionMetric ${esc(accent)}"><span>${esc(label)}</span><b>${num(value)==null?'—':fmtNum(value,1)}${num(value)==null?'':` <small>${esc(unit)}</small>`}</b></div>`;
}
function changeMetric(label,value,meta){
  const available=num(value)!=null;
  return `<div><span>${esc(label)}</span><b>${available?esc(signed(value,meta)):'—'}</b></div>`;
}
function historyRow(row){
  const parts=[];
  if(num(row.body_fat_pct)!=null)parts.push(`${fmtNum(row.body_fat_pct,1)}% gordura`);
  if(num(row.skeletal_muscle_mass_kg)!=null)parts.push(`${fmtNum(row.skeletal_muscle_mass_kg,1)} kg músculo`);
  return `<article class="ltsCompositionHistoryRow"><time>${esc(fmtDate(row.measured_at))}</time><div><b>${num(row.weight_kg)!=null?`${fmtNum(row.weight_kg,1)} kg`:'Medição corporal'}</b><small>${esc(parts.join(' · ')||'Detalhes preservados')}</small></div><span>${esc(sourceDisplay(row))}</span></article>`;
}

export function renderProductComposition(){
  const all=allBodyRows();
  const unique=comparableRows(all);
  const latest=unique.at(-1)||null;
  if(!latest){
    return `<section class="ltsCompositionV2"><header class="ltsPageHeader"><button class="ltsBack" data-route="hoje" aria-label="Voltar">‹</button><div><span class="ltsEyebrow">Composição</span><h1>Composição corporal</h1><p>Histórico corporal com origem preservada.</p></div><button class="ltsRoundAction" data-entry="body" aria-label="Registrar bioimpedância">+</button></header><div class="ltsEmptyCard">Ainda não há uma medição corporal inequívoca para mostrar como atual.</div></section>`;
  }
  const series=coherentSeries(unique,latest);
  const firstComparable=series.length>1?series[0]:null;
  const selected=metricMeta[state.ui.productCompositionMetric]?state.ui.productCompositionMetric:'body_fat_pct';
  const selectedMeta=metricMeta[selected];
  const fatDelta=firstComparable?delta(latest,firstComparable,'body_fat_pct'):null;
  const muscleDelta=firstComparable?delta(latest,firstComparable,'skeletal_muscle_mass_kg'):null;
  const weightDelta=firstComparable?delta(latest,firstComparable,'weight_kg'):null;
  const ambiguous=ambiguityCount(all);
  const excludedOtherSources=Math.max(0,unique.length-series.length);
  const source=sourceDisplay(latest);
  const contextBits=[`${series.length} ${series.length===1?'medição comparável':'medições comparáveis'}`,source];
  if(ambiguous)contextBits.push(`${ambiguous} ${ambiguous===1?'data ambígua preservada':'datas ambíguas preservadas'}`);
  if(excludedOtherSources)contextBits.push(`${excludedOtherSources} ${excludedOtherSources===1?'registro de outra origem fora da tendência':'registros de outras origens fora da tendência'}`);
  const changeCopy=firstComparable
    ?`De ${fmtDate(firstComparable.measured_at)} a ${fmtDate(latest.measured_at)}, com a mesma origem: gordura ${fatDelta==null?'sem comparação':signed(fatDelta,metricMeta.body_fat_pct)}, massa muscular ${muscleDelta==null?'sem comparação':signed(muscleDelta,metricMeta.skeletal_muscle_mass_kg)} e peso ${weightDelta==null?'sem comparação':signed(weightDelta,metricMeta.weight_kg)}.`
    :'Ainda não há duas medições da mesma origem para calcular mudança.';
  return `<section class="ltsCompositionV2">
    <header class="ltsPageHeader"><button class="ltsBack" data-route="hoje" aria-label="Voltar">‹</button><div><span class="ltsEyebrow">Composição</span><h1>Composição corporal</h1><p>O que mudou no corpo, sem misturar origens incompatíveis.</p></div><button class="ltsRoundAction" data-entry="body" aria-label="Registrar bioimpedância">+</button></header>

    <section class="ltsCompositionHero">
      <div class="ltsCompositionHeroTop"><div><span>Última medição · ${esc(source)}</span><strong>${num(latest.body_fat_pct)!=null?`${fmtNum(latest.body_fat_pct,1)}%`:'Composição registrada'}</strong><small>${esc(fmtDate(latest.measured_at))}</small></div><span class="ltsCompositionGlyph">◒</span></div>
      <div class="ltsCompositionMetrics">
        ${latestMetric('Peso',latest.weight_kg,'kg','weight')}
        ${latestMetric('Gordura',latest.body_fat_pct,'%','fat')}
        ${latestMetric('Massa muscular',latest.skeletal_muscle_mass_kg,'kg','muscle')}
      </div>
    </section>

    <section class="ltsSection ltsCompositionChange">
      <div class="ltsSectionHead"><div><span>Período comparável</span><h2>O que mudou</h2></div></div>
      <div class="ltsCompositionChangeCard"><p>${esc(changeCopy)}</p><div class="ltsCompositionChangeGrid">${changeMetric('Gordura',fatDelta,metricMeta.body_fat_pct)}${changeMetric('Massa muscular',muscleDelta,metricMeta.skeletal_muscle_mass_kg)}${changeMetric('Peso',weightDelta,metricMeta.weight_kg)}</div></div>
    </section>

    <section class="ltsSection ltsCompositionTrend">
      <div class="ltsSectionHead"><div><span>Evolução</span><h2>Tendência por métrica</h2></div><small>${esc(contextBits.join(' · '))}</small></div>
      <div class="ltsCompositionTabs" role="tablist" aria-label="Métrica de composição">${Object.entries(metricMeta).map(([key,meta])=>`<button type="button" data-composition-metric="${esc(key)}" class="${selected===key?'active':''}" aria-pressed="${selected===key?'true':'false'}">${esc(meta.short)}</button>`).join('')}</div>
      <div class="ltsCompositionChart">${lineChart(series.slice(-16),selected)}</div>
    </section>

    <section class="ltsSection ltsCompositionHistory"><div class="ltsSectionHead"><div><span>Histórico</span><h2>Medições recentes</h2></div><button data-route="evolucao">Ver evolução detalhada</button></div><div class="ltsCompositionHistoryList">${unique.slice(-8).reverse().map(historyRow).join('')}</div></section>

    <section class="ltsCompositionTrust"><span>i</span><p>Gráficos e diferenças usam somente datas inequívocas da mesma origem da medição atual. Registros ambíguos ou de outra origem permanecem preservados, mas não são combinados automaticamente.</p></section>
  </section>`;
}
