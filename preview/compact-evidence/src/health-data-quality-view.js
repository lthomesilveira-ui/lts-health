import {esc} from './core.js';
import {sourceDisplayLabel} from './source-display.js';
const date=value=>value.split('-').reverse().join('/');
const reasons={used:'Usado na média',day_value:'Valor disponível neste dia',in_progress:'Dia em andamento',
  multiple_values:'Mais de um valor na mesma origem; fora da média',review:'Informação em conferência; fora da média',
  partial:'Registro identificado como incompleto; fora da média',invalid_value:'Valor recebido precisa de conferência; fora da média',
  other_source:'Recebido em outra origem; fora desta média',not_received:'Sem valor recebido nas fontes consultadas',not_verified:'Recebimento não pôde ser confirmado'};
export function coverageReceiptView(metric){
  const audit=metric.coverageAudit;
  if(!audit||metric.aggregation==='recorded_day'||audit.receivedDays<=audit.usedDays)return '';
  return `<p class="healthReceiptCoverage" data-received-coverage="${esc(metric.key)}">${audit.receivedDays}/${audit.expectedDays} dias com registros recebidos${audit.complete?'':' nas fontes carregadas'}.</p>`;
}
export function missingTotalEnergyView(metric){
  return metric.key==='totalEnergy'&&metric.value==null?'<p class="healthEnergyUnavailable" data-total-energy-unavailable role="status">Gasto total indisponível nesta leitura. Isso não significa gasto zero.</p>':'';
}
export function dailyCoverageView(metric){
  const audit=metric.coverageAudit;if(!audit)return '';
  const sources=new Map((metric.sources||[]).map(source=>[source.key,sourceDisplayLabel(source,metric.sources)]));
  const rows=audit.rows.slice(-31),day=metric.aggregation==='recorded_day';
  const label=reason=>day?reasons[reason].replaceAll('fora da média','fora desta leitura').replaceAll('fora desta média','fora desta leitura'):reasons[reason];
  const summary=`${audit.receivedDays}/${audit.expectedDays} dias com registros recebidos; ${audit.usedDays} ${day?'com valor nesta leitura':'usados nesta média'}.`;
  return `<details class="healthDailyCoverage" data-coverage-audit="${esc(metric.key)}"><summary>Cobertura dos dias</summary><p>${esc(summary)}</p>${audit.otherSourceDays?`<p>${audit.otherSourceDays} ${audit.otherSourceDays===1?'dia tem':'dias têm'} registro apenas em outra origem. As origens podem ser consultadas separadamente no seletor acima.</p>`:''}${audit.excludedDays?`<p>${audit.excludedDays} ${audit.excludedDays===1?'dia foi retirado':'dias foram retirados'} ${day?'desta leitura':'desta média'} pelos motivos abaixo.</p>`:''}${audit.multipleSourceDays?'<p>Um dia recebido em mais de uma origem é contado uma única vez na cobertura recebida. Os valores não são somados e as médias continuam separadas.</p>':''}${!audit.complete?'<p>Não foi possível conferir todos os registros. A cobertura recebida considera apenas as fontes carregadas; uma lacuna pode precisar de conferência.</p>':''}<p>Recebimento não comprova que o dia está completo. ${day?'O dia em andamento pode mudar.':'Hoje não entra nesta média.'}</p>${audit.rows.length>31?'<p>Últimos 31 dias da janela. Os totais acima consideram toda a janela; escolha uma data no modo Dia para conferir os anteriores.</p>':''}<ul>${rows.map(row=>`<li data-coverage-date="${esc(row.date)}" data-coverage-status="${row.reason}"><b>${date(row.date)}</b><span>${esc(label(row.reason))}</span>${row.sources.length?`<small>${esc(row.sources.map(key=>sources.get(key)||'Origem não disponível').join(' · '))}</small>`:''}</li>`).join('')}</ul></details>`;
}
