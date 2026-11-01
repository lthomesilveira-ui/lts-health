import {dailyCoverageView} from './health-data-quality-view.js';
import {esc} from './core.js';
import {sourceDisplayLabel} from './source-display.js';
const date=value=>value?value.split('-').reverse().join('/'):'—';
/** Each option is a separate origin segment, never an additive coverage total. */
export function sourceWindowView(metric,{scope='dashboard',print=false,compact=false}={}){
  const sources=metric.sources||[],automatic=metric.sourceSelectionMode!=='explicit';
  const label=source=>sourceDisplayLabel(source,sources);
  const coverage=source=>`${source.count??0}/${metric.expectedDays??0} dias${source.firstDate?` · ${date(source.firstDate)} a ${date(source.periodLastDate)}`:''}`;
  const mode=automatic?'Automática por cobertura no período; pode mudar ao trocar a janela.':'Origem escolhida por você; mantida ao trocar o período.';
  const empty=metric.requestedSourceMissing?'A origem escolhida não está disponível; nenhuma outra foi usada no lugar.':metric.count===0&&metric.otherSourcesWithData?'Sem valor utilizável nesta origem. Há registros em outra origem neste período.':'';
  const alternatives=metric.otherSourcesWithData?`${metric.otherSourcesWithData} outra(s) origem(ns) com registros neste período. Consulte separadamente; não somamos dias nem valores entre origens.`:'';
  if(compact&&!print){
    // Keep the full origin readable even when a narrow select truncates its
    // option. Selection rules and empty/alternate states remain explicit.
    const selected=metric.source?label(metric.source):'origem não disponível';
    const autoLabel='Automática · maior cobertura';
    const modeNote=automatic?'Automática por cobertura; pode mudar com o período.':'Origem escolhida por você; mantida ao trocar o período.';
    const otherCount=metric.otherSourcesWithData||0;
    const otherNote=otherCount?`${otherCount} ${otherCount===1?'outra origem':'outras origens'} com registros. Sem soma entre origens.`:'';
    const emptyNote=metric.requestedSourceMissing?'A origem escolhida não está disponível; nenhuma outra foi usada no lugar.':metric.count===0&&otherCount?'Sem valor utilizável nesta origem.':'';
    const compactOptions=`<option value="" ${automatic?'selected':''}>${esc(autoLabel)}</option>${metric.requestedSourceMissing?`<option value="${esc(metric.requestedSource)}" selected>Origem escolhida indisponível</option>`:''}${sources.map(source=>`<option value="${esc(source.key)}" ${!automatic&&source.key===metric.source?.key?'selected':''}>${esc(label(source))} · ${esc(coverage(source))}</option>`).join('')}`;
    return `<div class="healthSourceWindow" data-source-window="${esc(metric.key)}"><p class="studyMeta">${esc(selected)} · ${esc(modeNote)}</p>${emptyNote?`<p class="healthSourceCaution" role="status">${esc(emptyNote)}</p>`:''}${otherNote?`<p class="studyMeta">${esc(otherNote)}</p>`:''}<label class="studySelect" for="${scope}-source-${esc(metric.key)}">Origem e cobertura<select id="${scope}-source-${esc(metric.key)}" data-${scope}-source="${esc(metric.key)}" aria-label="Origem de ${esc(metric.label)}">${compactOptions}</select></label>${dailyCoverageView(metric)}</div>`;
  }
  const options=`<option value="" ${automatic?'selected':''}>Automática · maior cobertura no período</option>${metric.requestedSourceMissing?`<option value="${esc(metric.requestedSource)}" selected>Origem escolhida indisponível</option>`:''}${sources.map(source=>`<option value="${esc(source.key)}" ${!automatic&&source.key===metric.source?.key?'selected':''}>${esc(label(source))} · ${esc(coverage(source))}</option>`).join('')}`;
  return `<div class="healthSourceWindow" data-source-window="${esc(metric.key)}"><p class="studyMeta">Origem deste número: ${esc(metric.source?label(metric.source):'não disponível')}. ${esc(mode)}</p>${empty?`<p class="healthSourceCaution" role="status">${esc(empty)}</p>`:''}${alternatives?`<p class="studyMeta">${esc(alternatives)}</p>`:''}${print?`<ul>${sources.map(source=>`<li>${esc(label(source))}: ${esc(coverage(source))}</li>`).join('')}</ul>`:`<label class="${scope==='calendar'?'ltsCalendarSourcePicker':'studySelect'}" for="${scope}-source-${esc(metric.key)}">Origem e cobertura<select id="${scope}-source-${esc(metric.key)}" data-${scope}-source="${esc(metric.key)}" aria-label="Origem de ${esc(metric.label)}">${options}</select></label>`}${print?'':dailyCoverageView(metric)}</div>`;
}
