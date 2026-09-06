import {buildStructuredBackup,localBackupDate} from './data-layer.js';

const encoder=new TextEncoder();
const hex=buffer=>[...new Uint8Array(buffer)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const sha256=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(String(value))));
const stableFields=rows=>[...new Set((rows||[]).flatMap(row=>row&&typeof row==='object'&&!Array.isArray(row)?Object.keys(row):[]))].sort();
const recordTotal=counts=>Object.values(counts||{}).reduce((sum,value)=>sum+(Number(value)||0),0);
const sameStrings=(left,right)=>JSON.stringify([...(left||[])].map(String).sort())===JSON.stringify([...(right||[])].map(String).sort());
const uniqueStrings=values=>new Set((values||[]).map(String)).size===(values||[]).length;

async function integrityFor(data,domains){
  const domain_sha256={};
  const domain_manifest=[];
  for(const domain of domains){
    const rows=Array.isArray(data?.[domain])?data[domain]:[];
    const digest=await sha256(JSON.stringify(rows));
    domain_sha256[domain]=digest;
    domain_manifest.push({domain,row_count:rows.length,non_empty:rows.length>0,fields:stableFields(rows),sha256:digest});
  }
  return{
    domain_manifest,
    integrity:{
      algorithm:'SHA-256',
      encoding:'UTF-8',
      canonicalization:'JSON.stringify using exported property order',
      data_sha256:await sha256(JSON.stringify(data)),
      domain_sha256
    }
  };
}

export async function buildTraceableBackup(onProgress=()=>{}){
  const backup=await buildStructuredBackup(onProgress);
  onProgress('Gerando manifesto de integridade…');
  const domains=[...(backup.domains||[])],trace=await integrityFor(backup.data||{},domains);
  const enriched={
    ...backup,
    schema_version:3,
    traceability_version:1,
    export_id:globalThis.crypto?.randomUUID?.()||`lts-${Date.now()}`,
    record_total:recordTotal(backup.counts),
    domain_manifest:trace.domain_manifest,
    integrity:trace.integrity,
    notes:[
      ...(backup.notes||[]),
      'O manifesto SHA-256 permite detectar alterações acidentais nos registros estruturados após a exportação.',
      'Os hashes verificam somente o JSON estruturado exportado; não são uma atestação criptográfica dos arquivos privados originais.',
      'Arquivos privados originais, credenciais e tokens continuam fora do backup e fora do manifesto de integridade.'
    ]
  };
  onProgress('Backup verificável pronto');
  return enriched;
}

export async function verifyTraceableBackup(backup){
  const errors=[];
  if(backup?.format!=='lts-health-structured-backup')errors.push('format');
  if(backup?.schema_version!==3)errors.push('schema_version');
  if(backup?.traceability_version!==1)errors.push('traceability_version');
  if(backup?.scope!=='structured_records_only')errors.push('scope');
  if(backup?.complete!==true)errors.push('complete');
  if(backup?.structured_complete!==true)errors.push('structured_complete');
  if(backup?.includes_private_files!==false)errors.push('includes_private_files');
  if(backup?.includes_credentials!==false)errors.push('includes_credentials');
  if(backup?.components?.structured_records!=='included')errors.push('components_structured_records');
  if(backup?.components?.private_original_files!=='not_included')errors.push('components_private_original_files');
  if(backup?.components?.credentials_and_tokens!=='not_included')errors.push('components_credentials_and_tokens');
  if(typeof backup?.export_id!=='string'||!backup.export_id.trim())errors.push('export_id');
  if(!Number.isFinite(Date.parse(backup?.exported_at||'')))errors.push('exported_at');

  const domains=Array.isArray(backup?.domains)?backup.domains.map(String):[];
  if(!uniqueStrings(domains))errors.push('domains_unique');
  if(domains.length!==Number(backup?.domain_count||0))errors.push('domain_count');

  const data=backup?.data&&typeof backup.data==='object'&&!Array.isArray(backup.data)?backup.data:{};
  const counts=backup?.counts&&typeof backup.counts==='object'&&!Array.isArray(backup.counts)?backup.counts:{};
  if(!sameStrings(Object.keys(data),domains))errors.push('data_domains');
  if(!sameStrings(Object.keys(counts),domains))errors.push('counts_domains');

  let actualRecordTotal=0;
  for(const domain of domains){
    const rows=Array.isArray(data?.[domain])?data[domain]:null;
    if(!rows){errors.push(`data:${domain}`);continue;}
    actualRecordTotal+=rows.length;
    if(Number(counts?.[domain])!==rows.length)errors.push(`count:${domain}`);
  }
  if(Number(backup?.record_total)!==actualRecordTotal)errors.push('record_total');
  if(recordTotal(counts)!==actualRecordTotal)errors.push('counts_total');

  const expected=await integrityFor(data,domains);
  if(backup?.integrity?.algorithm!=='SHA-256')errors.push('integrity_algorithm');
  if(backup?.integrity?.encoding!=='UTF-8')errors.push('integrity_encoding');
  if(backup?.integrity?.data_sha256!==expected.integrity.data_sha256)errors.push('data_sha256');
  const domainHashes=backup?.integrity?.domain_sha256&&typeof backup.integrity.domain_sha256==='object'?backup.integrity.domain_sha256:{};
  if(!sameStrings(Object.keys(domainHashes),domains))errors.push('domain_sha256_domains');

  const manifest=Array.isArray(backup?.domain_manifest)?backup.domain_manifest:[];
  const manifestDomains=manifest.map(item=>String(item?.domain||''));
  if(manifest.length!==domains.length)errors.push('domain_manifest');
  if(!uniqueStrings(manifestDomains))errors.push('manifest_domains_unique');
  if(!sameStrings(manifestDomains,domains))errors.push('manifest_domains');
  for(const expectedDomain of expected.domain_manifest){
    const actual=manifest.find(item=>String(item?.domain||'')===expectedDomain.domain);
    if(!actual){errors.push(`manifest:${expectedDomain.domain}`);continue;}
    if(actual.row_count!==expectedDomain.row_count)errors.push(`row_count:${expectedDomain.domain}`);
    if(actual.non_empty!==expectedDomain.non_empty)errors.push(`non_empty:${expectedDomain.domain}`);
    if(!sameStrings(actual.fields,expectedDomain.fields))errors.push(`fields:${expectedDomain.domain}`);
    if(actual.sha256!==expectedDomain.sha256)errors.push(`sha256:${expectedDomain.domain}`);
    if(domainHashes?.[expectedDomain.domain]!==expectedDomain.sha256)errors.push(`domain_sha256:${expectedDomain.domain}`);
  }
  return{valid:errors.length===0,errors};
}

export async function downloadTraceableBackup(onProgress=()=>{}){
  const backup=await buildTraceableBackup(onProgress),date=localBackupDate(),filename=`lts-health-backup-${date}.json`;
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;link.style.display='none';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  return{filename,counts:backup.counts,complete:backup.complete,structuredComplete:backup.structured_complete,domainCount:backup.domain_count,recordTotal:backup.record_total,integrity:backup.integrity};
}

function ensureBackupVerificationControl(){
  const exportButton=document.getElementById('backupExportBtn');
  if(!exportButton||document.getElementById('backupVerifyFile'))return Boolean(exportButton);
  const exportMsg=document.getElementById('backupExportMsg');
  const wrapper=document.createElement('div');
  wrapper.className='backupVerifyControl';
  wrapper.innerHTML='<button type="button" id="backupVerifyBtn">Verificar backup</button><input id="backupVerifyFile" type="file" accept=".json,application/json" hidden><p id="backupVerifyMsg" class="footerNote" aria-live="polite">A verificação acontece somente neste dispositivo; o arquivo não é enviado.</p>';
  (exportMsg||exportButton).insertAdjacentElement('afterend',wrapper);
  return true;
}

function scheduleBackupVerificationControl(){
  let attempts=0;
  const install=()=>{
    if(ensureBackupVerificationControl()||attempts++>=60)return;
    setTimeout(install,200);
  };
  install();
}

async function handleBackupClick(event){
  const verifyButton=event.target?.closest?.('#backupVerifyBtn');
  if(verifyButton){
    event.preventDefault();
    document.getElementById('backupVerifyFile')?.click();
    return;
  }
  const button=event.target?.closest?.('#backupExportBtn');
  if(!button){setTimeout(ensureBackupVerificationControl,0);return;}
  event.preventDefault();event.stopImmediatePropagation();
  const msg=document.getElementById('backupExportMsg'),sync=document.getElementById('syncText');
  button.disabled=true;if(msg)msg.textContent='Preparando backup verificável…';if(sync)sync.textContent='Preparando backup…';
  try{
    const result=await downloadTraceableBackup(text=>{if(msg)msg.textContent=text;if(sync)sync.textContent=text;});
    if(msg)msg.textContent=`Backup criado: ${result.filename}`;
    if(sync)sync.textContent='Atualizado';
  }catch(error){
    console.error(error);if(msg)msg.textContent='Não foi possível criar o backup agora.';if(sync)sync.textContent='Falha no backup';
  }finally{button.disabled=false;}
}

async function handleBackupVerifyChange(event){
  const input=event.target;
  if(input?.id!=='backupVerifyFile')return;
  const msg=document.getElementById('backupVerifyMsg'),file=input.files?.[0];
  if(!file)return;
  if(msg)msg.textContent='Verificando integridade do backup…';
  try{
    if(file.size>100*1024*1024)throw new Error('backup_too_large');
    const backup=JSON.parse(await file.text()),verification=await verifyTraceableBackup(backup);
    if(verification.valid){
      const records=Number(backup.record_total||0),domains=Number(backup.domain_count||0);
      if(msg)msg.textContent=`Backup íntegro: ${records} registro(s) estruturado(s) em ${domains} área(s).`;
    }else if(msg)msg.textContent='Backup não passou na verificação de integridade. Não use este arquivo como cópia confiável.';
  }catch(error){
    if(msg)msg.textContent='Não foi possível verificar este arquivo como backup estruturado do LTS Health.';
  }finally{input.value='';}
}

document.addEventListener('click',handleBackupClick,true);
document.addEventListener('change',handleBackupVerifyChange,true);
window.addEventListener('hashchange',()=>setTimeout(ensureBackupVerificationControl,0));
scheduleBackupVerificationControl();
