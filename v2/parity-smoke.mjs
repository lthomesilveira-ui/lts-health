import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1';
const forbidden=/\b(canonical|parity|backend|provenance[- ]first|readiness|PWA)\b/i;
const browser=await chromium.launch({headless:true});

for(const [viewport,label] of [[{width:1280,height:900},'desktop'],[{width:390,height:844},'mobile']]){
  const page=await browser.newPage({viewport});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('#app:not(.hidden)');
  const nav=viewport.width<720?'#mobileNav':'#primaryNav';

  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Bio');
  if((await page.locator('[data-body-date]').count())!==2)throw new Error(`${label}: Bio history is not interactive`);
  await page.click('[data-body-date="2026-01-01"]');
  await page.waitForFunction(()=>document.querySelector('[data-body-date="2026-01-01"]')?.classList.contains('active'));
  const detail=await page.locator('.bioDetail').textContent();
  if(!detail?.includes('01/01/2026')||!detail.includes('Detalhe da medição')||!detail.includes('Peso')||!detail.includes('MME'))throw new Error(`${label}: Bio measurement detail incomplete`);

  await page.click(`${nav} [data-route="treinos"]`);await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Treinos');
  await page.selectOption('#trainingPeriod','all');await page.click('[data-workout="workout-2"]');
  const session=await page.locator('.session.open').textContent();if(!session?.includes('Supino máquina')||!session.includes('Voador')||!session.includes('90 kg'))throw new Error(`${label}: workout session detail incomplete`);

  await page.click(`${nav} [data-route="evolucao"]`);await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Evolução');
  if((await page.locator('[data-segmental-date]').count())<2)throw new Error(`${label}: segmental history incomplete`);
  const evolution=await page.textContent('#screenHost');if(!evolution.includes('Análise segmentar')||!evolution.includes('Treinos por semana'))throw new Error(`${label}: evolution core surfaces missing`);

  await page.click(`${nav} [data-route="analise"]`);await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Análise');
  const analysis=await page.textContent('#screenHost');if(!analysis.includes('Treino × alimentação')||!analysis.includes('Sono antes do treino')||!analysis.includes('Entre as duas últimas bios'))throw new Error(`${label}: analysis evidence surfaces missing`);

  await page.click(`${nav} [data-route="mais"]`);await page.click('#moreSheet [data-route="tratamentos"]');await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Tratamentos');
  const treatment=await page.textContent('#screenHost');if(!treatment.includes('Histórico')||treatment.match(/\b(dose|dosagem|ciclo|aplica[cç][aã]o)\b/i))throw new Error(`${label}: treatment history is not neutral`);

  const all=(await page.textContent('body'))||'';if(all.match(forbidden))throw new Error(`${label}: implementation jargon visible`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors ${errors.join(' | ')}`);
  await page.close();
}
await browser.close();
console.log('LTS Health v2 core experience smoke passed');
