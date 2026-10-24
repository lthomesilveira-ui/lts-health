import {esc} from './core.js';
import {sourceDisplayLabel} from './source-display.js';
const date=value=>value?value.split('-').reverse().join('/'):'—';
/** Each option is a separate origin segment, never an additive coverage total. */
export function sourceWindowView(metric,{scope='dashboard',print=false}={}){
  const sources=metric.sources||[],automatic=metric.sourceSelectionMode!=='explicit';
  const label=source=>sourceDisplayLabel(source,sources);
  const coverage=source=>`${source.count??0}/${metric.expectedDays??0} dias${source.firstDate?` · ${date(source.firstDate)} a ${date(source.periodLastDate)}`:''}`;
  const mode=automatic?'Automática por cobertura no período; pode mudar ao trocar a janela.':'Origem escolhida por você; mantida ao trocar o período.';
  const empty=metric.requestedSourceMissing?'A origem escolhida não está disponível; nenhuma outra foi usada no lugar.':metric.count===0&&metric.otherSourcesWithData?'Sem valor utilizável nesta origem. Há registros em outra origem neste período.':'';
  const alternatives=metric.otherSourcesWithData?`${metric.otherSourcesWithData} outra(s) origem(ns) com registros neste período. Consulte separadamente; não somamos dias nem valores entre origens.`:'';
  const options=`<option value="" ${automatic?'selected':''}>Automática · maior cobertura no período</option>${metric.requestedSourceMissing?`<option value="${esc(metric.requestedSource)}" selected>Origem escolhida indisponível</option>`:''}${sources.map(source=>`<option value="${esc(source.key)}" ${!automatic&&source.key===metric.source?.key?'selected':''}>${esc(label(source))} · ${esc(coverage(source))}</option>`).join('')}`;
  return `<div class="healthSourceWindow" data-source-window="${esc(metric.key)}"><p class="studyMeta">Origem deste número: ${esc(metric.source?label(metric.source):'não disponível')}. ${esc(mode)}</p>${empty?`<p class="healthSourceCaution" role="status">${esc(empty)}</p>`:''}${alternatives?`<p class="studyMeta">${esc(alternatives)}</p>`:''}${print?`<ul>${sources.map(source=>`<li>${esc(label(source))}: ${esc(coverage(source))}</li>`).join('')}</ul>`:`<label class="${scope==='calendar'?'ltsCalendarSourcePicker':'studySelect'}" for="${scope}-source-${esc(metric.key)}">Origem e cobertura<select id="${scope}-source-${esc(metric.key)}" data-${scope}-source="${esc(metric.key)}" aria-label="Origem de ${esc(metric.label)}">${options}</select></label>`}</div>`;
}
