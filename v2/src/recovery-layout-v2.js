import {state,esc,fmtDate,fmtNum,countLabel,periodLabel} from './core.js';
import {renderAnalysisHub,complementarySignalSeries} from './analysis-screen.js';
import {periodBounds,referenceDayFor} from './integrated-analysis.js';

const labels={
  steps:'Passos',
  resting_heart_rate_bpm:'Frequência cardíaca em repouso',
  hrv_sdnn_ms:'Variabilidade da frequência cardíaca (SDNN)',
  respiratory_rate_bpm:'Frequência respiratória',
  oxygen_saturation_pct:'Saturação de oxigênio'
};
const digits={steps:0,resting_heart_rate_bpm:0,hrv_sdnn_ms:0,respiratory_rate_bpm:1,oxygen_saturation_pct:1};

function signalRows(series){
  if(!series.length)return '<div class="empty">Não há séries complementares preservadas nesta janela.</div>';
  return `<div class="mealList recoveryEvidenceList">${series.map(item=>{
    const definition=labels[item.metric]||item.metric;
    const first=`${fmtNum(item.first.value,digits[item.metric]??1)} ${esc(item.unit)}`;
    const last=`${fmtNum(item.last.value,digits[item.metric]??1)} ${esc(item.unit)}`;
    const review=item.reviewDays?` · ${countLabel(item.reviewDays,'dia em revisão','dias em revisão')}`:'';
    return `<div class="mealRow recoveryEvidenceRow"><div><b>${esc(definition)}</b><small>${esc(item.baseLabel)} · ${esc(item.identity)} · ${esc(item.unit)}</small></div><span>${first} → ${last}</span><em>${fmtDate(item.first.date)} → ${fmtDate(item.last.date)} · ${countLabel(item.points.length,'ponto preservado','pontos preservados')}${esc(review)}</em></div>`;
  }).join('')}</div>`;
}

export function renderRecoveryDepth(){
  const base=renderAnalysisHub();
  const period=state.ui.analysisPeriod||'365';
  const bounds=periodBounds(period,referenceDayFor(state.data));
  if(state.domainStatus?.sourceMetrics==='error')return `<div class="ltsRecoveryV2">${base}<details class="uxDisclosure sectionGap" data-disclosure="recovery-evidence"><summary><span><b>Sinais de recuperação por origem</b><small>Evidência complementar sem mistura entre dispositivos</small></span><i>Explorar</i></summary><div class="disclosureBody card"><div class="errorState"><b>Sinais complementares indisponíveis agora.</b><span>Nenhum valor ausente foi substituído por zero e nenhuma origem foi usada como substituta de outra.</span></div></div></details></div>`;
  const series=complementarySignalSeries(state.data.sourceMetrics||[],bounds);
  const origins=new Set(series.map(item=>`${item.family}\u0000${item.identity}`));
  const reviewDays=series.reduce((sum,item)=>sum+Number(item.reviewDays||0),0);
  return `<div class="ltsRecoveryV2">${base}
    <details class="uxDisclosure sectionGap" data-disclosure="recovery-evidence">
      <summary><span><b>Sinais de recuperação por origem</b><small>${countLabel(series.length,'série preservada','séries preservadas')} · ${countLabel(origins.size,'origem','origens')} · ${esc(periodLabel(period))}</small></span><i>Explorar</i></summary>
      <div class="disclosureBody card">
        <div class="cardHead"><div><b>Evidência complementar separada</b><small>Cada linha mantém métrica, unidade e dispositivo/origem próprios.</small></div><span class="pill">${reviewDays?`${countLabel(reviewDays,'dia em revisão','dias em revisão')}`:'sem conflitos diários'}</span></div>
        ${signalRows(series)}
        <p class="footerNote">Primeiro e último valores são observações preservadas, não interpretação de melhora ou piora. Séries de dispositivos, origens ou unidades diferentes não são combinadas nem comparadas automaticamente.</p>
      </div>
    </details>
  </div>`;
}
