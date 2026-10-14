import {esc,fmtDate} from './core.js';

const list=value=>Array.isArray(value)?value:[];
const date=value=>value?fmtDate(value):'Não registrado';

export function latestCareDocument(rows=[]){
  return rows.filter(row=>row.document_type==='care_followup'&&row.care_context?.schema_version===1)
    .sort((a,b)=>String(b.document_date||'').localeCompare(String(a.document_date||'')))[0]||null;
}

export function renderCareFollowup(rows=[],status='ready'){
  if(status==='error')return '<section class="card sectionGap careFollowup"><h2>Acompanhamento da consulta</h2><p role="status">O acompanhamento não carregou. Atualize para consultar as pendências; seu histórico de aplicações continua abaixo.</p></section>';
  const document=latestCareDocument(rows);
  if(!document)return '';
  const care=document.care_context,baseline=list(care.baseline),products=list(care.products),followups=list(care.followups),contacts=list(care.contacts);
  const pending=followups.filter(row=>!row.resolved),resolved=followups.filter(row=>row.resolved);
  const immediate=pending.filter(row=>!row.window&&!String(row.key||'').includes('delivery')&&!String(row.key||'').includes('nutrition'));
  const windows=pending.filter(row=>row.window);
  const item=row=>`<li><div><b>${esc(row.label)}</b>${row.window?`<small>${esc(row.window)}</small>`:''}${row.due_date?`<small>${date(row.due_date)}</small>`:''}</div><span class="careStatus">${esc(row.status||'Registro pendente')}</span></li>`;
  return `<section class="card sectionGap careFollowup" aria-label="Acompanhamento da consulta">
    <header class="careHeader"><div><span>Consulta · ${date(care.consultation_date||document.document_date)}</span><h2>${esc(care.title||'Acompanhamento da consulta')}</h2><p>${esc(care.physician||'Profissional não informado')}</p></div><span class="careStatus">${pending.length} pendências acompanhadas</span></header>
    <div class="careBaseline"><h3>Protocolo já relatado</h3><div class="careBaselineGrid">${baseline.map(row=>`<article><b>${esc(row.name)}</b><strong>${esc(row.reported_dose||'Não informado')}</strong><small>Informado em ${date(row.source_date)}</small></article>`).join('')}</div><p>Valores recuperados do histórico, sem orientar a próxima aplicação.</p>${care.collection_context?`<p>${esc(care.collection_context)}</p>`:''}</div>
    <div class="carePanels"><section><h3>Próximas ações</h3><ul class="careList">${immediate.map(item).join('')||'<li>Sem pendências registradas.</li>'}</ul></section><section><h3>Compras e início dos novos itens</h3><ul class="careList">${products.map(row=>`<li><div><b>${esc(row.name)}</b><small>${esc(row.purchase_status||'Compra não registrada')}${row.received_date?` · Recebido em ${date(row.received_date)}`:''}</small>${row.start_date?`<small>Início relatado: ${date(row.start_date)}</small>`:''}</div><span class="careStatus">${esc(row.status||'Registro pendente')}</span></li>`).join('')||'<li>Nenhum novo item registrado.</li>'}</ul></section></div>
    <section class="careWindows"><h3>Exames e reavaliações</h3><p>As janelas dependem do início efetivamente registrado e da orientação do prescritor.</p><ul class="careList">${windows.map(item).join('')||'<li>Sem janela registrada.</li>'}</ul></section>
    <div class="careNotes"><p>${esc(care.pending_nutrition||'Plano alimentar sem atualização registrada.')}</p><p>${esc(care.record_rule||'Ausência de registro não confirma dose omitida.')}</p>${care.reminder?.first_date?`<p>Acompanhamento ${esc(care.reminder.daypart||'agendado').toLowerCase()}, a partir de ${date(care.reminder.first_date)}.</p>`:''}</div>
    <details class="careMessages"><summary>Mensagens e contatos</summary>${contacts.map(row=>`<article><h3>${esc(row.name)}</h3><p>${esc(list(row.products).join(' · '))}</p><div class="careMessage">${esc(row.message||'Mensagem não registrada.')}</div></article>`).join('')}${care.physician_message?`<article><h3>Mensagem para o médico</h3><div class="careMessage">${esc(care.physician_message)}</div></article>`:''}</details>
    ${resolved.length?`<details class="careResolved"><summary>Resolvido pelo histórico</summary><ul class="careList">${resolved.map(item).join('')}</ul></details>`:''}
  </section>`;
}
