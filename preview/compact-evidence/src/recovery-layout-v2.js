import {state,fixtureMode,esc,fmtDate,fmtNum,countLabel,periodLabel} from './core.js';
import {renderUsefulReports} from './reports-screen.js';
import {reportBounds} from './reports-model.js';
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
  if(!series.length)return '<div class="empty">Ainda não há registros adicionais neste período.</div>';
  return `<div class="mealList recoveryEvidenceList">${series.map(item=>{
    const definition=labels[item.metric]||item.metric;
    const first=`${fmtNum(item.first.value,digits[item.metric]??1)} ${esc(item.unit)}`;
    const last=`${fmtNum(item.last.value,digits[item.metric]??1)} ${esc(item.unit)}`;
    const review=item.reviewDays?` · ${countLabel(item.reviewDays,'dia em revisão','dias em revisão')}`:'';
    return `<div class="mealRow recoveryEvidenceRow"><div><b>${esc(definition)}</b><small>${esc(item.baseLabel)} · ${esc(item.identity)} · ${esc(item.unit)}</small></div><span>${first} → ${last}</span><em>${fmtDate(item.first.date)} → ${fmtDate(item.last.date)} · ${countLabel(item.points.length,'ponto preservado','pontos preservados')}${esc(review)}</em></div>`;
  }).join('')}</div>`;
}

export function renderRecoveryDepth(){
  const base=fixtureMode?renderAnalysisHub():renderUsefulReports();
  const period=state.ui.analysisPeriod||'365';
  const bounds=fixtureMode?periodBounds(period,referenceDayFor(state.data)):reportBounds(period).current;
  if(state.domainStatus?.sourceMetrics==='error')return `<div class="ltsRecoveryV2">${base}<details class="uxDisclosure sectionGap" data-disclosure="recovery-evidence"><summary><span><b>Recuperação por aparelho</b><small>Registros de cada aparelho, apresentados separadamente</small></span><i>Explorar</i></summary><div class="disclosureBody card"><div class="errorState"><b>Sinais complementares indisponíveis agora.</b><span>Tente novamente em Atualizar. Os registros das outras áreas continuam disponíveis.</span></div></div></details></div>`;
  const series=complementarySignalSeries(state.data.sourceMetrics||[],bounds);
  const origins=new Set(series.map(item=>`${item.family}\u0000${item.identity}`));
  const reviewDays=series.reduce((sum,item)=>sum+Number(item.reviewDays||0),0);
  return `<div class="ltsRecoveryV2">${base}
    <details class="uxDisclosure sectionGap" data-disclosure="recovery-evidence">
      <summary><span><b>Recuperação por aparelho</b><small>${countLabel(series.length,'série registrada','séries registradas')} · ${countLabel(origins.size,'origem','origens')} · ${esc(periodLabel(period))}</small></span><i>Explorar</i></summary>
      <div class="disclosureBody card">
        <div class="cardHead"><div><b>Registros por aparelho</b><small>Cada linha mantém métrica, unidade e dispositivo/origem próprios.</small></div><span class="pill">${reviewDays?`${countLabel(reviewDays,'dia em revisão','dias em revisão')}`:'sem conflitos diários'}</span></div>
        ${signalRows(series)}
        <p class="footerNote">Primeiro e último valores são observações preservadas, não interpretação de melhora ou piora. Séries de dispositivos, origens ou unidades diferentes não são combinadas nem comparadas automaticamente.</p>
      </div>
    </details>
  </div>`;
}
