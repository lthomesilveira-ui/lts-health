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
  if(!panel.includes('Backup estruturado')||!panel.includes('Arquivos originais privados')||!panel.includes('dados pessoais de saúde'))throw new Error(`${label}: backup privacy/scope copy missing`);
  const downloadPromise=page.waitForEvent('download');
  await page.click('#backupExportBtn');
  const download=await downloadPromise;
  if(!/^lts-health-backup-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()))throw new Error(`${label}: unexpected backup filename ${download.suggestedFilename()}`);
  const path=await download.path();if(!path)throw new Error(`${label}: browser did not produce backup file`);
  const raw=await readFile(path,'utf8'),backup=JSON.parse(raw);
  if(backup.format!=='lts-health-structured-backup'||backup.schema_version!==1||backup.scope!=='structured_records_only')throw new Error(`${label}: backup envelope invalid`);
  if(backup.counts?.body!==2||backup.counts?.workouts!==2||backup.counts?.labs!==2||backup.counts?.metrics!==3)throw new Error(`${label}: backup did not include all fixture structured domains`);
  for(const key of ['body','segmental','workouts','exercises','sets','labs','docs','treatments','uploads','previews','quality','nutrition','meals','activity','metrics'])if(!Array.isArray(backup.data?.[key]))throw new Error(`${label}: backup missing domain ${key}`);
  if(/"(dose_mg|dose_ml|frequency|injection_site|source_payload|access_token|refresh_token|password)"\s*:/.test(raw))throw new Error(`${label}: backup contains a prohibited operational or secret field`);
  await page.waitForFunction(()=>document.querySelector('#backupExportMsg')?.textContent?.includes('Backup criado:'));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);if(overflow>3)throw new Error(`${label}: backup panel caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 structured backup smoke passed');
