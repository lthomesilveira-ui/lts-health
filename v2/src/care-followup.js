import {esc,fmtDate} from './core.js';
import {localHealthDay} from './health-context.js';
import {selectDocumentedNutritionPlan} from './documented-nutrition-plan.js';

const list=value=>Array.isArray(value)?value:[];
const date=value=>value?fmtDate(value):'Não registrado';
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
function nutritionEvidence(document,plans,status,today){
  const note=typeof document.care_context?.pending_nutrition==='string'?document.care_context.pending_nutrition.trim():'';
  const historicalDate=validDate(document.document_date)?document.document_date:null;
  const source=document.source||document.source_file||'Origem não informada';
  const history=`<p data-care-nutrition-history>Registro histórico do documento de ${date(historicalDate)} · ${esc(source)}: ${note?`“${esc(note)}”`:'sem nota sobre recebimento do plano alimentar.'}</p>`;
  const selected=selectDocumentedNutritionPlan(plans,today,status),plan=selected.plan;
  // A receipt is a later documentary fact, not a clinical start or a mutation
  // of the original consultation's unresolved follow-ups.
  if(historicalDate&&plan&&plan.received_on>historicalDate)return `<p data-care-plan-received><b>Plano alimentar recebido em ${date(plan.received_on)}.</b> Documento de ${date(plan.documented_on)} · ${esc(plan.source)} · ${esc(plan.source_file)}. Início de uso não informado; recebimento não confirma vigência nem adesão.</p>${history}`;
  const messages={loading:'A verificação de documentos posteriores do plano alimentar está pendente nesta leitura.',error:'Não foi possível verificar documentos posteriores do plano alimentar nesta leitura.',invalid:'Os dados do plano mais recente estão incompletos ou conflitantes; nenhum recebimento posterior foi confirmado.',empty:'Nenhum documento de plano alimentar recebido até esta data está disponível nesta leitura.'};
  const message=!historicalDate?'A data do registro histórico não está confirmada; não foi inferida atualização da pendência.':messages[selected.state]||'O documento disponível não comprova recebimento do plano posterior a este registro histórico.';
  return `${history}<p data-care-plan-status="${esc(!historicalDate?'unknown_history_date':selected.state)}">${esc(message)} O registro histórico não confirma a situação atual.</p>`;
}

export function latestCareDocument(rows=[]){
  return rows.filter(row=>row.document_type==='care_followup'&&row.care_context?.schema_version===1)
    .sort((a,b)=>String(b.document_date||'').localeCompare(String(a.document_date||'')))[0]||null;
}

export function renderCareFollowup(rows=[],status='ready',{nutritionPlans=[],nutritionPlanStatus='idle',today=localHealthDay()}={}){
  if(status==='error')return '<section class="card sectionGap careFollowup"><h2>Acompanhamento da consulta</h2><p role="status">O acompanhamento não carregou. Atualize para consultar as pendências; seu histórico de aplicações continua abaixo.</p></section>';
  const document=latestCareDocument(rows);
  if(!document)return '';
  const care=document.care_context,baseline=list(care.baseline),products=list(care.products),followups=list(care.followups),contacts=list(care.contacts);
  const pending=followups.filter(row=>!row.resolved),resolved=followups.filter(row=>row.resolved);
  const immediate=pending.filter(row=>!row.window&&!String(row.key||'').includes('delivery')&&!String(row.key||'').includes('nutrition'));
  const windows=pending.filter(row=>row.window);
  const item=row=>`<li><div><b>${esc(row.label)}</b>${row.window?`<small>${esc(row.window)}</small>`:''}${row.due_date?`<small>${date(row.due_date)}</small>`:''}</div><span class="careStatus">${esc(row.status||'Registro pendente')}</span></li>`;
  return `<section class="card sectionGap careFollowup" aria-label="Acompanhamento da consulta">
    <header class="careHeader"><div><span>Consulta · ${date(care.consultation_date||document.document_date)}</span><h2>${esc(care.title||'Acompanhamento da consulta')}</h2><p>${esc(care.physician||'Profissional não informado')}</p></div><span class="careStatus">${pending.length} pendências registradas na consulta</span></header>
    <div class="careBaseline"><h3>Protocolo já relatado</h3><div class="careBaselineGrid">${baseline.map(row=>`<article><b>${esc(row.name)}</b><strong>${esc(row.reported_dose||'Não informado')}</strong><small>Informado em ${date(row.source_date)}</small></article>`).join('')}</div><p>Valores recuperados do histórico, sem orientar a próxima aplicação.</p>${care.collection_context?`<p>${esc(care.collection_context)}</p>`:''}</div>
    <div class="carePanels"><section><h3>Próximas ações</h3><ul class="careList">${immediate.map(item).join('')||'<li>Sem pendências registradas.</li>'}</ul></section><section><h3>Compras e início dos novos itens</h3><ul class="careList">${products.map(row=>`<li><div><b>${esc(row.name)}</b><small>${esc(row.purchase_status||'Compra não registrada')}${row.received_date?` · Recebido em ${date(row.received_date)}`:''}</small>${row.start_date?`<small>Início relatado: ${date(row.start_date)}</small>`:''}</div><span class="careStatus">${esc(row.status||'Registro pendente')}</span></li>`).join('')||'<li>Nenhum novo item registrado.</li>'}</ul></section></div>
    <section class="careWindows"><h3>Exames e reavaliações</h3><p>As janelas dependem do início efetivamente registrado e da orientação do prescritor.</p><ul class="careList">${windows.map(item).join('')||'<li>Sem janela registrada.</li>'}</ul></section>
    <div class="careNotes">${nutritionEvidence(document,nutritionPlans,nutritionPlanStatus,today)}<p>${esc(care.record_rule||'Ausência de registro não confirma dose omitida.')}</p>${care.reminder?.first_date?`<p>Acompanhamento ${esc(care.reminder.daypart||'agendado').toLowerCase()}, a partir de ${date(care.reminder.first_date)}.</p>`:''}</div>
    <details class="careMessages"><summary>Mensagens e contatos</summary>${contacts.map(row=>`<article><h3>${esc(row.name)}</h3><p>${esc(list(row.products).join(' · '))}</p><div class="careMessage">${esc(row.message||'Mensagem não registrada.')}</div></article>`).join('')}${care.physician_message?`<article><h3>Mensagem para o médico</h3><div class="careMessage">${esc(care.physician_message)}</div></article>`:''}</details>
    ${resolved.length?`<details class="careResolved"><summary>Resolvido pelo histórico</summary><ul class="careList">${resolved.map(item).join('')}</ul></details>`:''}
  </section>`;
}
