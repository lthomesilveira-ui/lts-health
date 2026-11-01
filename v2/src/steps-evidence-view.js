import {esc,fmtDate} from './core.js';
import {stepValueText} from './steps-evidence.js';

const received=value=>{
  if(typeof value!=='string'||!/(?:Z|[+-]\d\d:\d\d)$/.test(value))return 'Horário de atualização não informado';
  const instant=new Date(value);if(!Number.isFinite(instant.getTime()))return 'Horário de atualização não informado';
  return `Atualizado no app em ${new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(instant)} (Brasília)`;
};
export function stepsEvidenceNotice(metric){
  if(metric?.key!=='steps')return '';
  const evidence=metric.stepEvidence||{},notes=[];
  if(evidence.differingSourceDays)notes.push(`${evidence.differingSourceDays} dia(s) com contagens diferentes por origem; nenhuma foi escolhida como total consolidado.`);
  if(evidence.invalidCountDays)notes.push(`${evidence.invalidCountDays} dia(s) com contagem em revisão; valores fracionados ou inválidos ficam fora dos números e das médias.`);
  return notes.join(' ');
}
export function renderStepsEvidence(metric,{all=false}={}){
  if(metric?.key!=='steps')return '';
  const days=(metric.stepEvidence?.days||[]).filter(day=>all||day.differingSources||day.invalidCount);
  if(!days.length)return '';
  return `<div class="healthStepsEvidence" data-steps-evidence><p>Contagens recebidas, separadas por origem. Não são somadas nem confirmam cobertura integral do dia.</p>${days.map(day=>`<section data-steps-date="${esc(day.date)}"><b>${fmtDate(day.date)}${day.partial?' · parcial':''}</b>${day.observations.map(row=>`<p>${esc(row.label)}: <strong>${esc(stepValueText(row.receivedRaw??row.receivedValue))}</strong><br><small>${esc(received(row.receivedAt))} · ${row.status==='canonical'?'registro confirmado':'ainda sem confirmação'} · ${row.partial?'dia parcial':'cobertura integral não confirmada'}${row.ambiguous?' · mais de um registro nesta origem':''}</small></p>`).join('')}</section>`).join('')}</div>`;
}
