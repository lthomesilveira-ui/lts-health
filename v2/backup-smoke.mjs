import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const base='http://127.0.0.1:4173/?fixture=1#dados';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport,acceptDownloads:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');
  await page.waitForSelector('#backupExportBtn');
  const panel=(await page.locator('.backupPanel').textContent())||'';
  if(!panel.includes('Exportar registros organizados')||!panel.includes('Arquivos privados e credenciais ficam de fora')||!panel.includes('dados de saúde'))throw new Error(`${label}: backup privacy/scope copy missing`);
  const downloadPromise=page.waitForEvent('download');
  await page.click('#backupExportBtn');
  const download=await downloadPromise;
  if(!/^lts-health-backup-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()))throw new Error(`${label}: unexpected backup filename ${download.suggestedFilename()}`);
  const path=await download.path();if(!path)throw new Error(`${label}: browser did not produce backup file`);
  const raw=await readFile(path,'utf8'),backup=JSON.parse(raw);
  if(backup.format!=='lts-health-structured-backup'||backup.schema_version!==2||backup.scope!=='structured_records_only')throw new Error(`${label}: backup envelope invalid`);
  if(backup.complete!==true||backup.structured_complete!==true)throw new Error(`${label}: structured backup is not explicitly complete within its scope`);
  if(backup.includes_private_files!==false||backup.includes_credentials!==false)throw new Error(`${label}: backup inclusion flags are unsafe or ambiguous`);
  if(backup.components?.structured_records!=='included'||backup.components?.private_original_files!=='not_included'||backup.components?.credentials_and_tokens!=='not_included')throw new Error(`${label}: backup component manifest is incomplete or ambiguous`);
  if(!Array.isArray(backup.domains)||backup.domains.length!==backup.domain_count)throw new Error(`${label}: backup domain manifest mismatch`);
  if(Object.keys(backup.counts||{}).length!==backup.domain_count)throw new Error(`${label}: backup counts do not cover all domains`);
  if(backup.counts?.body!==2||backup.counts?.workouts!==2||backup.counts?.labs!==2||backup.counts?.metrics!==3)throw new Error(`${label}: backup did not include all fixture structured domains`);
  for(const key of ['body','segmental','workouts','exercises','sets','labs','docs','treatments','uploads','previews','quality','nutrition','meals','activity','metrics']){
    if(!backup.domains.includes(key))throw new Error(`${label}: backup manifest missing domain ${key}`);
    if(!Array.isArray(backup.data?.[key]))throw new Error(`${label}: backup missing domain ${key}`);
  }
  if(!backup.notes?.some?.(n=>String(n).includes('nenhum arquivo de backup é baixado')))throw new Error(`${label}: incomplete-backup guardrail note missing`);
  if(!backup.notes?.some?.(n=>String(n).includes('complete se refere somente ao escopo structured_records_only')))throw new Error(`${label}: complete-field scope qualification missing`);
  if(!backup.notes?.some?.(n=>String(n).includes('Arquivos originais armazenados na área privada não são incorporados')))throw new Error(`${label}: private-file exclusion note missing`);
  if(/"(storage_path|dose_mg|dose_ml|frequency|injection_site|source_payload|access_token|refresh_token|password)"\s*:/.test(raw))throw new Error(`${label}: backup contains a prohibited private, operational or secret field`);
  await page.waitForFunction(()=>document.querySelector('#backupExportMsg')?.textContent?.includes('Backup criado:'));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);if(overflow>3)throw new Error(`${label}: backup panel caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 structured backup smoke passed');
