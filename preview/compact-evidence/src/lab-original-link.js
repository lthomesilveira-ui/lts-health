// An original is available only when a reviewed result and one validated
// document agree. Inventory names, older documents and arbitrary URLs never
// become substitutes for a missing or failed original-document read.
export const labOriginalColumns='original_file_id:source_payload->>library_file_id,original_sha256:source_payload->>sha256,original_page:source_payload->pdf_page,original_page_count:source_payload->pdf_page_count,original_import_version:source_payload->>import_version,original_date_kind:source_payload->>report_date_kind';
export const labOriginalDocumentColumns='source_record_id,document_date,document_type,source_file,source,checksum,extraction_status,confidence,original_file_id:source_payload->>library_file_id,original_page_count:source_payload->page_count,original_import_version:source_payload->>import_version';
const reviewed=new Set(['reviewed-20261003-v1','fleury-source-audit-v1']);
const fileId=value=>typeof value==='string'&&/^libfile_[a-f0-9]{32}$/.test(value);
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const pages=(page,count)=>Number.isSafeInteger(page)&&Number.isSafeInteger(count)&&page>0&&page<=count&&count<=10000;
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
function originalFor(row,documents){
 if(row?.source!=='Fleury laboratory report'||row.laboratory!=='Fleury'||row.confidence!=='high'||!date(row.collection_date)||!String(row.source_record_id||'').startsWith('fleury:'))return null;
 if(!reviewed.has(row.original_import_version)||row.original_date_kind!=='report_print_date'||!fileId(row.original_file_id)||!digest(row.original_sha256)||!pages(row.original_page,row.original_page_count))return null;
 if(typeof row.source_file!=='string'||!row.source_file.trim()||!/\.pdf$/i.test(row.source_file)||/[\r\n\x00]/.test(row.source_file))return null;
 const candidates=documents.filter(doc=>doc?.checksum===row.original_sha256||doc?.original_file_id===row.original_file_id);
 if(candidates.length!==1)return null;
 const doc=candidates[0];
 if(doc.document_type!=='laboratory_report'||doc.extraction_status!=='validated'||doc.confidence!=='high'||doc.source!=='Fleury laboratory report'||!reviewed.has(doc.original_import_version))return null;
 if(doc.source_record_id!==`fleury:document:${row.original_sha256}`||doc.checksum!==row.original_sha256||doc.original_file_id!==row.original_file_id||doc.source_file!==row.source_file||doc.document_date!==row.collection_date||doc.original_page_count!==row.original_page_count)return null;
 return {schema_version:1,status:'source_verified',library_file_id:row.original_file_id,source_sha256:row.original_sha256,page:row.original_page,page_count:row.original_page_count};
}
export function attachLabOriginals(rows,documents,documentsReady=true){
 return rows.map(row=>{const original=documentsReady?originalFor(row,documents):null;return {...row,original_pdf:original,original_pdf_status:documentsReady?(original?'ready':'unavailable'):'error'};});
}
export function labOriginalUrl(row){
 const p=row?.original_pdf;
 if(row?.original_pdf_status!=='ready'||p?.schema_version!==1||p.status!=='source_verified'||!fileId(p.library_file_id)||!digest(p.source_sha256)||!pages(p.page,p.page_count))return null;
 return `https://chatgpt.com/library?file_id=${p.library_file_id}&account_id=personal`;
}
export function renderLabOriginalLink(row){
 const url=labOriginalUrl(row);if(!url)return '';
 const p=row.original_pdf;
 return `<div class="ltsLabOriginal"><a href="${url.replaceAll('&','&amp;')}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" data-lab-original>Abrir laudo original <span aria-hidden="true">↗</span></a><small>Página ${p.page} de ${p.page_count} do PDF. Abre no ChatGPT e pode pedir acesso à sua conta.</small></div>`;
}
