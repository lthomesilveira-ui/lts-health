import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();
await page.goto('http://127.0.0.1:4173/?fixture=1#bio',{waitUntil:'domcontentloaded'});
await page.waitForSelector('#app:not(.hidden)');
const result=await page.evaluate(async()=>{
  const layer=await import('./src/data-layer.js');
  const prior=layer.refreshFailureMessage(new Error('Falha simulada'),true);
  const first=layer.refreshFailureMessage(new Error('Falha simulada'),false);
  const source=await fetch('./src/data-layer.js').then(r=>r.text());
  const refreshBlock=source.match(/export async function refreshData\([\s\S]*?\n}\n\nexport function localBackupDate/)?.[0]||'';
  return {prior,first,refreshBlock};
});
if(!result.prior.includes('Dados anteriores mantidos.'))throw new Error('refresh failure does not disclose retained prior data');
if(result.first.includes('Dados anteriores mantidos.'))throw new Error('first-load failure incorrectly claims prior data was retained');
if(result.refreshBlock.includes('state.data={}'))throw new Error('refresh still clears all cached domain data before network reads');
if(!result.refreshBlock.includes('Atualização parcial; dados anteriores foram mantidos onde houve falha.'))throw new Error('partial refresh status copy missing');
await context.close();
await browser.close();
console.log('LTS Health refresh resilience smoke passed');
