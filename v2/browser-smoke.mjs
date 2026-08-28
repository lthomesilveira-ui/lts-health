import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1';
const forbidden=/\b(canonical|parity|backend|provenance[- ]first|readiness|PWA)\b/i;

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForSelector('#screenHost h1');
  if((await page.textContent('body')).match(forbidden)) throw new Error(`${label}: implementation jargon visible`);
  const nav=viewport.width<680?'#mobileNav':'#primaryNav';
  for(const [route,screenTitle] of [['bio','Bio'],['treinos','Treinos'],['evolucao','Evolução'],['analise','Análise']]){
    await page.click(`${nav} [data-route="${route}"]`);
    await page.waitForFunction(t=>document.querySelector('#screenHost h1')?.textContent===t,screenTitle);
    if((await page.textContent('body')).match(forbidden)) throw new Error(`${label}/${route}: implementation jargon visible`);
  }
  await page.click(`${nav} [data-route="mais"]`);
  await page.waitForSelector('#moreSheet:not(.hidden)');
  for(const [route,screenTitle] of [['hoje','Hoje'],['timeline','Timeline'],['saude','Saúde & exames'],['nutricao','Nutrição'],['dados','Dados'],['tratamentos','Tratamentos']]){
    if(await page.locator('#moreSheet').evaluate(el=>el.classList.contains('hidden'))) await page.click(`${nav} [data-route="mais"]`);
    await page.click(`#moreSheet [data-route="${route}"]`);
    await page.waitForFunction(t=>document.querySelector('#screenHost h1')?.textContent===t,screenTitle);
  }
  await page.click(`${nav} [data-route="bio"]`);
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Bio');
  const bodyText=await page.textContent('#screenHost');
  if(!bodyText.includes('90,0')||!bodyText.includes('91,0')) throw new Error(`${label}: fixture data did not render`);
  if(errors.length) throw new Error(`${label}: page errors: ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 browser smoke passed');
