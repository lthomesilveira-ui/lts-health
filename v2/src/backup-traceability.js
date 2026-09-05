import {buildStructuredBackup,localBackupDate} from './data-layer.js';

const encoder=new TextEncoder();
const hex=buffer=>[...new Uint8Array(buffer)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const sha256=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(String(value))));
const stableFields=rows=>[...new Set((rows||[]).flatMap(row=>row&&typeof row==='object'&&!Array.isArray(row)?Object.keys(row):[]))].sort();
const recordTotal=counts=>Object.values(counts||{}).reduce((sum,value)=>sum+(Number(value)||0),0);

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
  const domains=Array.isArray(backup?.domains)?backup.domains:[];
  if(domains.length!==Number(backup?.domain_count||0))errors.push('domain_count');
  if(recordTotal(backup?.counts)!==Number(backup?.record_total||0))errors.push('record_total');
  const expected=await integrityFor(backup?.data||{},domains);
  if(backup?.integrity?.algorithm!=='SHA-256')errors.push('integrity_algorithm');
  if(backup?.integrity?.data_sha256!==expected.integrity.data_sha256)errors.push('data_sha256');
  const manifest=Array.isArray(backup?.domain_manifest)?backup.domain_manifest:[];
  if(manifest.length!==domains.length)errors.push('domain_manifest');
  for(const expectedDomain of expected.domain_manifest){
    const actual=manifest.find(item=>item?.domain===expectedDomain.domain);
    if(!actual){errors.push(`manifest:${expectedDomain.domain}`);continue;}
    if(actual.row_count!==expectedDomain.row_count)errors.push(`row_count:${expectedDomain.domain}`);
    if(actual.sha256!==expectedDomain.sha256)errors.push(`sha256:${expectedDomain.domain}`);
    if(backup?.integrity?.domain_sha256?.[expectedDomain.domain]!==expectedDomain.sha256)errors.push(`domain_sha256:${expectedDomain.domain}`);
  }
  return{valid:errors.length===0,errors};
}

export async function downloadTraceableBackup(onProgress=()=>{}){
  const backup=await buildTraceableBackup(onProgress),date=localBackupDate(),filename=`lts-health-backup-${date}.json`;
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;link.style.display='none';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  return{filename,counts:backup.counts,complete:backup.complete,structuredComplete:backup.structured_complete,domainCount:backup.domain_count,recordTotal:backup.record_total,integrity:backup.integrity};
}

async function handleBackupClick(event){
  const button=event.target?.closest?.('#backupExportBtn');
  if(!button)return;
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

document.addEventListener('click',handleBackupClick,true);
