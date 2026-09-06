import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#dados';

async function verificationErrors(page,backup){
  return page.evaluate(async value=>{
    const {verifyTraceableBackup}=await import('./src/backup-traceability.js');
    return verifyTraceableBackup(value);
  },backup);
}

async function setBackupFile(page,name,payload){
  const body=typeof payload==='string'?payload:JSON.stringify(payload);
  await page.locator('#backupVerifyFile').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(body)});
}

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');
  await page.waitForSelector('#backupVerifyBtn');
  await page.waitForSelector('#backupVerifyFile',{state:'attached'});

  const initial=(await page.locator('#backupVerifyMsg').textContent())||'';
  if(!initial.includes('somente neste dispositivo')||!initial.includes('não é enviado'))throw new Error(`${label}: local-only verification privacy copy missing`);

  const backup=await page.evaluate(async()=>{
    const {buildTraceableBackup}=await import('./src/backup-traceability.js');
    return buildTraceableBackup();
  });
  if(!backup?.record_total||backup?.domain_count!==18)throw new Error(`${label}: fixture backup was not built for UI verification`);

  await setBackupFile(page,'lts-health-backup-valid.json',backup);
  await page.waitForFunction(()=>document.querySelector('#backupVerifyMsg')?.textContent?.includes('Backup íntegro:'));
  let message=(await page.locator('#backupVerifyMsg').textContent())||'';
  if(!message.includes(`${backup.record_total} registro(s) estruturado(s)`)||!message.includes('18 área(s)'))throw new Error(`${label}: valid backup summary is incomplete: ${message}`);

  const dataTampered=structuredClone(backup);
  dataTampered.data.body[0].weight_kg=Number(dataTampered.data.body[0].weight_kg||0)+1;
  await setBackupFile(page,'lts-health-backup-data-tampered.json',dataTampered);
  await page.waitForFunction(()=>document.querySelector('#backupVerifyMsg')?.textContent?.includes('não passou na verificação de integridade'));

  const countsTampered=structuredClone(backup);
  countsTampered.counts.body+=1;
  countsTampered.counts.workouts-=1;
  const countCheck=await verificationErrors(page,countsTampered);
  if(countCheck.valid||!countCheck.errors.includes('count:body')||!countCheck.errors.includes('count:workouts'))throw new Error(`${label}: offsetting count tamper was not detected: ${countCheck.errors.join(',')}`);

  const fieldsTampered=structuredClone(backup);
  const bodyManifest=fieldsTampered.domain_manifest.find(item=>item.domain==='body');
  bodyManifest.fields=[...(bodyManifest.fields||[]),'invented_field'];
  const fieldsCheck=await verificationErrors(page,fieldsTampered);
  if(fieldsCheck.valid||!fieldsCheck.errors.includes('fields:body'))throw new Error(`${label}: manifest field tamper was not detected: ${fieldsCheck.errors.join(',')}`);

  const nonEmptyTampered=structuredClone(backup);
  nonEmptyTampered.domain_manifest.find(item=>item.domain==='body').non_empty=false;
  const nonEmptyCheck=await verificationErrors(page,nonEmptyTampered);
  if(nonEmptyCheck.valid||!nonEmptyCheck.errors.includes('non_empty:body'))throw new Error(`${label}: manifest non_empty tamper was not detected: ${nonEmptyCheck.errors.join(',')}`);

  const duplicateDomains=structuredClone(backup);
  duplicateDomains.domains[duplicateDomains.domains.length-1]=duplicateDomains.domains[0];
  const duplicateCheck=await verificationErrors(page,duplicateDomains);
  if(duplicateCheck.valid||!duplicateCheck.errors.includes('domains_unique'))throw new Error(`${label}: duplicate domain tamper was not detected: ${duplicateCheck.errors.join(',')}`);

  const countsDomainTampered=structuredClone(backup);
  delete countsDomainTampered.counts.labs;
  const countsDomainCheck=await verificationErrors(page,countsDomainTampered);
  if(countsDomainCheck.valid||!countsDomainCheck.errors.includes('counts_domains'))throw new Error(`${label}: counts domain-set tamper was not detected: ${countsDomainCheck.errors.join(',')}`);

  const hashDomainTampered=structuredClone(backup);
  delete hashDomainTampered.integrity.domain_sha256.labs;
  const hashDomainCheck=await verificationErrors(page,hashDomainTampered);
  if(hashDomainCheck.valid||!hashDomainCheck.errors.includes('domain_sha256_domains'))throw new Error(`${label}: domain hash-set tamper was not detected: ${hashDomainCheck.errors.join(',')}`);

  await setBackupFile(page,'not-a-backup.json','{malformed json');
  await page.waitForFunction(()=>document.querySelector('#backupVerifyMsg')?.textContent?.includes('Não foi possível verificar este arquivo'));

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: backup verification UI caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health local backup verification UI smoke passed');
