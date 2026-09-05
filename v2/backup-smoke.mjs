import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const base='http://127.0.0.1:4173/?fixture=1#dados';
const hash=/^[0-9a-f]{64}$/;

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport,acceptDownloads:true,timezoneId:'America/Sao_Paulo'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');
  await page.waitForSelector('#backupExportBtn');

  const localDateCheck=await page.evaluate(async()=>{
    const {localBackupDate}=await import('./src/data-layer.js');
    return localBackupDate(new Date('2026-08-30T02:30:00Z'));
  });
  if(localDateCheck!=='2026-08-29')throw new Error(`${label}: backup filename date drifted to UTC next day (${localDateCheck})`);

  const panel=(await page.locator('.backupPanel').textContent())||'';
  if(!panel.includes('Exportar registros organizados')||!panel.includes('Arquivos privados e credenciais ficam de fora')||!panel.includes('dados de saúde'))throw new Error(`${label}: backup privacy/scope copy missing`);
  const downloadPromise=page.waitForEvent('download');
  await page.click('#backupExportBtn');
  const download=await downloadPromise;
  if(!/^lts-health-backup-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()))throw new Error(`${label}: unexpected backup filename ${download.suggestedFilename()}`);
  const path=await download.path();if(!path)throw new Error(`${label}: browser did not produce backup file`);
  const raw=await readFile(path,'utf8'),backup=JSON.parse(raw);
  if(backup.format!=='lts-health-structured-backup'||backup.schema_version!==3||backup.traceability_version!==1||backup.scope!=='structured_records_only')throw new Error(`${label}: traceable backup envelope invalid`);
  if(backup.complete!==true||backup.structured_complete!==true)throw new Error(`${label}: structured backup is not explicitly complete within its scope`);
  if(backup.includes_private_files!==false||backup.includes_credentials!==false)throw new Error(`${label}: backup inclusion flags are unsafe or ambiguous`);
  if(backup.components?.structured_records!=='included'||backup.components?.private_original_files!=='not_included'||backup.components?.credentials_and_tokens!=='not_included')throw new Error(`${label}: backup component manifest is incomplete or ambiguous`);
  if(!Array.isArray(backup.domains)||backup.domains.length!==backup.domain_count)throw new Error(`${label}: backup domain manifest mismatch`);
  if(Object.keys(backup.counts||{}).length!==backup.domain_count)throw new Error(`${label}: backup counts do not cover all domains`);
  const countTotal=Object.values(backup.counts||{}).reduce((sum,value)=>sum+Number(value||0),0);
  if(backup.record_total!==countTotal)throw new Error(`${label}: record total does not match domain counts`);
  if(!Array.isArray(backup.domain_manifest)||backup.domain_manifest.length!==backup.domain_count)throw new Error(`${label}: traceability domain manifest mismatch`);
  if(backup.integrity?.algorithm!=='SHA-256'||backup.integrity?.encoding!=='UTF-8'||!hash.test(backup.integrity?.data_sha256||''))throw new Error(`${label}: whole-backup integrity metadata invalid`);
  if(backup.counts?.body!==2||backup.counts?.workouts!==2||backup.counts?.labs!==2||backup.counts?.metrics!==3||backup.counts?.sourceMetrics!==1||backup.counts?.regimens!==2)throw new Error(`${label}: backup did not include all fixture structured domains`);
  for(const key of ['body','segmental','workouts','workoutEvidence','exercises','sets','labs','docs','treatments','regimens','uploads','previews','quality','nutrition','meals','activity','metrics','sourceMetrics']){
    if(!backup.domains.includes(key))throw new Error(`${label}: backup manifest missing domain ${key}`);
    if(!Array.isArray(backup.data?.[key]))throw new Error(`${label}: backup missing domain ${key}`);
    const manifest=backup.domain_manifest.find(item=>item?.domain===key);
    if(!manifest||manifest.row_count!==backup.counts[key]||manifest.non_empty!==(backup.counts[key]>0)||!Array.isArray(manifest.fields)||!hash.test(manifest.sha256||''))throw new Error(`${label}: domain traceability invalid for ${key}`);
    if(backup.integrity?.domain_sha256?.[key]!==manifest.sha256)throw new Error(`${label}: domain hash mismatch for ${key}`);
  }
  const sourceMetric=backup.data.sourceMetrics?.[0];
  if(!sourceMetric||sourceMetric.metric_type!=='steps'||sourceMetric.canonical_status!=='candidate'||sourceMetric.source_family!=='test_device')throw new Error(`${label}: source metric provenance/candidate status was not preserved`);
  if(Object.hasOwn(sourceMetric,'source_payload'))throw new Error(`${label}: raw source payload leaked into sourceMetrics backup`);
  const regimen=backup.data.regimens?.[0];
  if(!regimen||!regimen.medication||!regimen.source)throw new Error(`${label}: safe protocol context was not preserved`);
  for(const forbidden of ['source_payload','storage_path'])if(Object.hasOwn(regimen,forbidden))throw new Error(`${label}: private protocol context field leaked: ${forbidden}`);
  if(!backup.notes?.some?.(n=>String(n).includes('nenhum arquivo de backup é baixado')))throw new Error(`${label}: incomplete-backup guardrail note missing`);
  if(!backup.notes?.some?.(n=>String(n).includes('complete se refere somente ao escopo structured_records_only')))throw new Error(`${label}: complete-field scope qualification missing`);
  if(!backup.notes?.some?.(n=>String(n).includes('Arquivos originais armazenados na área privada não são incorporados')))throw new Error(`${label}: private-file exclusion note missing`);
  if(!backup.notes?.some?.(n=>String(n).includes('payloads brutos de origem ficam de fora')))throw new Error(`${label}: sourceMetrics raw-payload exclusion note missing`);
  if(!backup.notes?.some?.(n=>String(n).includes('detectar alterações acidentais')))throw new Error(`${label}: integrity purpose note missing`);
  if(!backup.notes?.some?.(n=>String(n).includes('não são uma atestação criptográfica')))throw new Error(`${label}: integrity limitation note missing`);
  if(/"(storage_path|dose_mg|dose_ml|frequency|injection_site|source_payload|access_token|refresh_token|password)"\s*:/.test(raw))throw new Error(`${label}: backup contains a prohibited private, operational or secret field`);

  const verification=await page.evaluate(async value=>{
    const {verifyTraceableBackup}=await import('./src/backup-traceability.js');
    return verifyTraceableBackup(value);
  },backup);
  if(!verification.valid||verification.errors.length)throw new Error(`${label}: exported backup failed its own verifier: ${verification.errors.join(',')}`);

  const tampered=structuredClone(backup);
  tampered.data.body[0].weight_kg=Number(tampered.data.body[0].weight_kg||0)+1;
  const tamperVerification=await page.evaluate(async value=>{
    const {verifyTraceableBackup}=await import('./src/backup-traceability.js');
    return verifyTraceableBackup(value);
  },tampered);
  if(tamperVerification.valid||!tamperVerification.errors.includes('data_sha256')||!tamperVerification.errors.some(error=>String(error).startsWith('sha256:body')))throw new Error(`${label}: tampering was not detected at whole-data and domain level`);

  await page.waitForFunction(()=>document.querySelector('#backupExportMsg')?.textContent?.includes('Backup criado:'));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);if(overflow>3)throw new Error(`${label}: backup panel caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await context.close();
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 verifiable structured backup smoke passed');
