const escape = value => String(value??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function fleuryPreviewModel(preview) {
  const sample=preview?.lab_preview;
  if(sample?.kind!=='fleury_lab_preview_v1'||sample.read_only!==true||!Array.isArray(sample.results)||sample.results.length>500)return null;
  const valid=sample.results.every(r=>r&&typeof r.biomarker==='string'&&typeof r.result_raw==='string'&&(typeof r.unit==='string'||r.unit===null)&&/^\d{4}-\d{2}-\d{2}$/.test(r.collection_date)&&Number.isInteger(r.pdf_page)&&r.pdf_page>=1&&r.pdf_page<=64);
  if(!valid)return null;
  const confirmed=sample.source_verified===true&&sample.history_available===true;
  const matched=sample.results.filter(r=>confirmed&&r.already_in_history===true).length;
  const conflicts=Array.isArray(sample.conflicts)?sample.conflicts.length:0;
  const unsupported=Number.isSafeInteger(sample.unsupported_count)&&sample.unsupported_count>=0?sample.unsupported_count:0;
  const rows=sample.results.map(r=>({...r,already_in_history:confirmed&&r.already_in_history===true}));
  return {rows,matched,conflicts,unsupported,complete:rows.length>0&&confirmed&&matched===rows.length&&conflicts===0&&unsupported===0};
}

export function renderFleuryPreview(preview, formatDate=value=>value) {
  const model=fleuryPreviewModel(preview);
  if(!model)return '';
  if(!model.rows.length)return '<p class="fleuryPreviewNotice">O original está guardado. Ainda não foi possível ler os resultados deste formato com segurança.</p>';
  const meaning=model.complete?'Esta leitura corresponde aos resultados que já estão no seu histórico. Nenhum exame foi duplicado ou alterado.':'Esta é uma prévia do arquivo. Os resultados abaixo ainda não foram incluídos nas análises; seu histórico foi preservado.';
  const limitations=[model.unsupported?`${model.unsupported} trecho(s) não puderam ser lidos.`:'',model.conflicts?`${model.conflicts} resultado(s) divergentes entre cópias do laudo foram retidos.`:''].filter(Boolean).join(' ');
  return `<details class="fleuryPreview" data-disclosure="fleury-preview:${escape(preview.upload_id||'current')}"><summary>Ver resultados lidos do laudo</summary><div class="fleuryPreviewBody"><p>${escape(meaning)}</p>${limitations?`<p class="fleuryPreviewNotice">${escape(limitations)}</p>`:''}<p class="fleuryPreviewScope">Valores e unidades como escritos no arquivo. Referências, método e observações devem ser consultados no laudo completo. A página indicada é a posição no arquivo PDF.</p><ol class="fleuryPreviewResults" tabindex="0" aria-label="Resultados lidos do arquivo">${model.rows.map(row=>`<li><div class="fleuryPreviewHeading"><b>${escape(row.biomarker)}</b><span>${escape(formatDate(row.collection_date))}</span></div><div class="fleuryPreviewValue">${escape(row.result_raw)}${row.unit?` <span>${escape(row.unit)}</span>`:''}</div><small>Página ${row.pdf_page}${row.already_in_history?' · Já está no histórico':''}</small></li>`).join('')}</ol></div></details>`;
}
