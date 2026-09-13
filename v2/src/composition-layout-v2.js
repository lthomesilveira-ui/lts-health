import {state,esc,fmtDate,fmtNum,num,norm} from './core.js';
import {validDay,rowKey,pageOf,pager,years,yearFilter,seriesWindow,periodControl,pointChart,emptyCard,errorCard,failed,valueText,differenceText} from './history-tools.js';

export const compositionMetrics={
  body_fat_pct:{label:'Gordura corporal',short:'Gordura',unit:'%',deltaUnit:'p.p.'},
  skeletal_muscle_mass_kg:{label:'Massa muscular',short:'Músculo',unit:'kg'},
  weight_kg:{label:'Peso',short:'Peso',unit:'kg'},
  fat_mass_kg:{label:'Massa de gordura',short:'Gordura kg',unit:'kg'}
};
const identity=row=>norm(row?.source_family||row?.source_name||row?.source||'');
const sourceDisplay=row=>{
  const raw=String(row?.source_name||row?.source||row?.source_family||'').trim();
  return norm(raw).includes('inbody')?'InBody':norm(raw).includes('bioimpedance')?'Bioimpedância':raw||'Origem não informada';
};
export function compositionModel(){
  const all=(state.data.body||[]).map((r,i)=>({...r,__key:rowKey(r,i)})).sort((a,b)=>String(a.measured_at||'').localeCompare(String(b.measured_at||'')));
  const counts=new Map();for(const row of all){const d=validDay(row.measured_at);if(d)counts.set(d,(counts.get(d)||0)+1);}
  const unique=all.filter(row=>validDay(row.measured_at)&&counts.get(validDay(row.measured_at))===1);
  const latest=unique.at(-1)||null,origins=[...new Map(all.map(r=>[identity(r),sourceDisplay(r)])).entries()];
  const requested=state.ui.productCompositionSource;
  const source=origins.some(([id])=>id===requested)?requested:identity(latest)||origins[0]?.[0]||'';
  const series=source?unique.filter(r=>identity(r)===source):[];
  const period=['recent','90','365','all'].includes(state.ui.productCompositionPeriod)?state.ui.productCompositionPeriod:'recent';
  const recent=seriesWindow(series,'measured_at',period);
  const year=state.ui.productCompositionYear||'all',visible=all.filter(r=>year==='all'||validDay(r.measured_at).slice(0,4)===year).reverse();
  const history=pageOf(visible,state.ui.productCompositionPage,8);
  const record=all.find(r=>r.__key===state.ui.productCompositionRecord)||null;
  return{all,counts,unique,latest,origins,source,series,period,recent,year,history,record};
}
const metricTile=(label,value,unit)=>`<div class="ltsCompositionMetric"><span>${esc(label)}</span><b>${num(value)==null?'—':fmtNum(value,1)}${num(value)==null?'':` <small>${esc(unit)}</small>`}</b></div>`;
function header(detail=false){return `<header class="ltsPageHeader"><button class="ltsBack" ${detail?'data-depth-composition-back':'data-route="hoje"'} aria-label="Voltar">‹</button><div><span class="ltsEyebrow">Composição</span><h1 tabindex="-1" id="productCompositionTitle">${detail?'Detalhes da medição':'Composição corporal'}</h1><p>${detail?'Valores registrados e análise segmentar.':'Medições e evolução, com origem preservada.'}</p></div><button class="ltsRoundAction" data-entry="body" aria-label="Registrar bioimpedância">+</button></header>`;}
function detailValue(label,value,unit=''){return `<div><span>${esc(label)}</span><b>${esc(valueText(value,unit))}</b></div>`;}
export function linkedSegmental(record,bodyRows,segmentalRows){
  const date=validDay(record?.measured_at),source=identity(record);
  if(!date||!source)return{row:null,reason:'A data ou origem não permite vincular um registro segmentar.'};
  let candidates=segmentalRows.filter(r=>validDay(r.measured_at)===date&&identity(r)===source);
  if(record.source_file)candidates=candidates.filter(r=>!r.source_file||r.source_file===record.source_file);
  const bodySameDay=bodyRows.filter(r=>validDay(r.measured_at)===date&&identity(r)===source);
  if(bodySameDay.length>1&&(!record.source_file||!candidates.every(r=>r.source_file===record.source_file)))return{row:null,reason:'Há múltiplas medições nesta data; a vinculação segmentar não é inequívoca.'};
  return candidates.length===1?{row:candidates[0],reason:''}:{row:null,reason:candidates.length?'Há mais de um registro segmentar compatível; nenhum foi escolhido automaticamente.':'Não há análise segmentar vinculável a esta data e origem.'};
}
function renderRecordDetail(model){
  const r=model.record,seg=linkedSegmental(r,model.all,state.data.segmental||[]);
  const parts=[['Braço direito','right_arm'],['Braço esquerdo','left_arm'],['Tronco','trunk'],['Perna direita','right_leg'],['Perna esquerda','left_leg']];
  const ambiguous=model.counts.get(validDay(r.measured_at))>1;
  return `<section class="ltsCompositionV2" data-composition-view="detail">${header(true)}<div class="ltsHistoryContext"><b>${esc(fmtDate(r.measured_at))} · ${esc(sourceDisplay(r))}</b>${r.source_file?esc(r.source_file):'Arquivo de origem não informado'}${ambiguous?'<br>Data com múltiplos registros: leitura individual, fora das comparações automáticas.':''}</div><section class="ltsRecordDetails"><h2>Valores da medição</h2><div class="ltsDetailGrid">${detailValue('Peso',r.weight_kg,'kg')}${detailValue('Massa muscular esquelética',r.skeletal_muscle_mass_kg,'kg')}${detailValue('Massa de gordura',r.fat_mass_kg,'kg')}${detailValue('Gordura corporal',r.body_fat_pct,'%')}${detailValue('Água corporal',r.body_water_l,'L')}${detailValue('Nível de gordura visceral',r.visceral_fat_level)}${detailValue('Relação cintura/quadril',r.waist_hip_ratio)}</div></section><section class="ltsRecordDetails"><h2>Análise segmentar</h2>${failed(state,'segmental')?errorCard('Os dados segmentares não carregaram agora.'):seg.row?`<p class="ltsDepthNote">Massa magra e massa de gordura, em kg. Valores da mesma data e origem; massa magra segmentar não é sinônimo de músculo esquelético.</p><table class="ltsSegmentTable"><thead><tr><th scope="col">Segmento</th><th scope="col">Magra · kg</th><th scope="col">Gordura · kg</th></tr></thead><tbody>${parts.map(([name,key])=>`<tr><th scope="row">${esc(name)}</th><td>${num(seg.row[`lean_${key}_kg`])==null?'—':fmtNum(seg.row[`lean_${key}_kg`],2)}</td><td>${num(seg.row[`fat_${key}_kg`])==null?'—':fmtNum(seg.row[`fat_${key}_kg`],2)}</td></tr>`).join('')}</tbody></table>`:emptyCard(seg.reason)}</section><button class="ltsDepthLink" data-depth-composition-back>Voltar ao histórico de medições</button></section>`;
}
function comparison(model){
  if(model.series.length<2)return '';
  const a=model.series.find(r=>r.__key===state.ui.productCompareA)||model.series.at(-2),b=model.series.find(r=>r.__key===state.ui.productCompareB)||model.series.at(-1);
  const select=(key,label,chosen)=>`<label class="ltsField">${label}<select id="${key}" data-depth-field="${key}">${model.series.map(r=>`<option value="${esc(r.__key)}" ${chosen.__key===r.__key?'selected':''}>${esc(fmtDate(r.measured_at))}</option>`).join('')}</select></label>`;
  return `<details class="ltsCompareDisclosure" data-disclosure="product-composition-compare"><summary>Comparar duas medições desta origem</summary><div class="ltsFilters">${select('productCompareA','De',a)}${select('productCompareB','Até',b)}</div>${a.__key===b.__key?emptyCard('Escolha duas medições diferentes.'):validDay(a.measured_at)>validDay(b.measured_at)?emptyCard('A data inicial precisa vir antes da data final.'):`<div class="ltsDetailGrid">${Object.entries(compositionMetrics).map(([key,meta])=>`<div><span>${esc(meta.label)}</span><b>${esc(differenceText(b[key],a[key],meta.deltaUnit||meta.unit))}</b></div>`).join('')}</div>`}</details>`;
}

export function renderProductComposition(){
  if(failed(state,'body'))return `<section class="ltsCompositionV2">${header()}${errorCard('As medições corporais não carregaram agora.')}</section>`;
  const m=compositionModel();
  if(m.record)return renderRecordDetail(m);
  if(!m.all.length)return `<section class="ltsCompositionV2">${header()}${emptyCard('Nenhuma medição foi encontrada no histórico carregado.')}</section>`;
  const last=m.latest,metric=compositionMetrics[state.ui.productCompositionMetric]?state.ui.productCompositionMetric:'body_fat_pct',meta=compositionMetrics[metric];
  const first=m.recent[0],end=m.recent.at(-1),originName=m.origins.find(([key])=>key===m.source)?.[1]||'Origem não informada';
  return `<section class="ltsCompositionV2" data-composition-view="overview">${header()}
    ${last?`<section class="ltsCompositionHero"><div class="ltsCompositionHeroTop"><div><span>Última medição inequívoca · ${esc(sourceDisplay(last))}</span><strong>${num(last.body_fat_pct)!=null?`${fmtNum(last.body_fat_pct,1)}%`:'Medição registrada'}</strong><small>${esc(fmtDate(last.measured_at))}</small></div><span class="ltsCompositionGlyph" aria-hidden="true">◒</span></div><div class="ltsCompositionMetrics">${metricTile('Peso',last.weight_kg,'kg')}${metricTile('Gordura',last.body_fat_pct,'%')}${metricTile('Massa muscular',last.skeletal_muscle_mass_kg,'kg')}</div><button class="ltsDepthLink" data-depth-composition-record="${esc(last.__key)}">Detalhes e análise segmentar ›</button></section>`:emptyCard('As datas têm múltiplos registros. Todas as medições continuam abaixo; nenhuma é escolhida automaticamente como atual.')}

    <section class="ltsSection ltsCompositionTrend"><div class="ltsSectionHead"><div><span>Evolução</span><h2>Tendência por métrica</h2></div></div><label class="ltsField ltsSourceSelect">Origem da série<select id="productCompositionSource" data-depth-field="productCompositionSource">${m.origins.map(([key,label])=>`<option value="${esc(key)}" ${key===m.source?'selected':''}>${esc(label)}</option>`).join('')}</select></label>${periodControl('productCompositionPeriod',m.period)}<div class="ltsCompositionTabs" role="group" aria-label="Métrica de composição">${Object.entries(compositionMetrics).map(([key,v])=>`<button type="button" data-composition-metric="${key}" class="${key===metric?'active':''}" aria-pressed="${key===metric}">${esc(v.short)}</button>`).join('')}</div><div class="ltsCompositionChart">${pointChart(m.recent.map(r=>({date:r.measured_at,value:r[metric]})),{unit:meta.unit,label:meta.label,scope:'productComposition',selected:state.ui.productCompositionPoint})}</div><p class="ltsDepthNote">${m.recent.length} de ${m.series.length} medições inequívocas · ${esc(originName)}. A janela termina na última medição desta origem; o último registro permanece visível mesmo quando não há uma medição de hoje.</p></section>

    <section class="ltsSection ltsCompositionChange"><div class="ltsSectionHead"><div><span>Período selecionado</span><h2>O que mudou</h2></div></div><div class="ltsCompositionChangeCard">${m.recent.length>1?`<p>${esc(fmtDate(first.measured_at))} → ${esc(fmtDate(end.measured_at))} · ${esc(originName)}</p><div class="ltsCompositionChangeGrid">${['body_fat_pct','skeletal_muscle_mass_kg','weight_kg'].map(key=>`<div><span>${esc(compositionMetrics[key].label)}</span><b>${esc(differenceText(end[key],first[key],compositionMetrics[key].deltaUnit||compositionMetrics[key].unit))}</b></div>`).join('')}</div>`:'<p>Não há duas medições inequívocas desta origem no período para calcular diferenças.</p>'}</div>${comparison(m)}</section>

    <section class="ltsSection ltsCompositionHistory" id="productCompositionHistory"><div class="ltsSectionHead"><div><span>Consultar</span><h2>Histórico completo</h2></div><small>${m.all.length} medições preservadas</small></div>${yearFilter('productCompositionYear',m.year,years(m.all,'measured_at'))}<div class="ltsCompositionHistoryList" data-composition-history-total="${m.history.total}">${m.history.rows.map(r=>`<button type="button" class="ltsCompositionHistoryRow" data-depth-composition-record="${esc(r.__key)}"><time>${esc(fmtDate(r.measured_at))}</time><div><b>${num(r.weight_kg)==null?'Medição corporal':`${fmtNum(r.weight_kg,1)} kg`}</b><small>${num(r.body_fat_pct)!=null?`${fmtNum(r.body_fat_pct,1)}% gordura`:'Gordura não informada'}${m.counts.get(validDay(r.measured_at))>1?' · data com múltiplos registros':''}</small></div><span>${esc(sourceDisplay(r))} ›</span></button>`).join('')||emptyCard('Nenhuma medição corresponde ao ano escolhido.')}</div>${pager(m.history,'productCompositionPage')}</section>
    <section class="ltsCompositionTrust"><span>i</span><p>Os detalhes incluem todas as medições, mesmo quando não podem formar uma curva. Comparações usam somente datas inequívocas da mesma origem. Registros segmentares precisam de vínculo seguro; nenhuma medida é estimada ou classificada esteticamente.</p></section>
  </section>`;
}
