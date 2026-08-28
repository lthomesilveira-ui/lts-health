import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1';
const forbidden=/\b(canonical|parity|backend|provenance[- ]first|readiness|PWA)\b/i;

async function assertScreen(page,title,label){
  await page.waitForFunction(t=>document.querySelector('#screenHost h1')?.textContent===t,title);
  const text=(await page.textContent('#screenHost'))||'';
  if(text.trim().length<20) throw new Error(`${label}: screen unexpectedly empty`);
  if(text.match(forbidden)) throw new Error(`${label}: implementation jargon visible`);
}

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error') errors.push(msg.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await assertScreen(page,'Bio',`${label}/bio`);
  const nav=viewport.width<720?'#mobileNav':'#primaryNav';

  const initial=await page.textContent('#screenHost');
  if(!initial.includes('90,0')||!initial.includes('91,0')) throw new Error(`${label}: fixture body history did not render`);
  await page.click('[data-bio-metric="skeletal_muscle_mass_kg"]');
  await page.waitForFunction(()=>document.querySelector('[data-bio-metric="skeletal_muscle_mass_kg"]')?.classList.contains('active'));
  await page.selectOption('#compareA','2026-01-01');
  await page.selectOption('#compareB','2026-02-01');

  await page.click(`${nav} [data-route="treinos"]`);
  await assertScreen(page,'Treinos',`${label}/treinos`);
  await page.click('[data-workout="workout-2"]');
  await page.waitForSelector('.session.open .sessionBody');
  const trainingText=await page.textContent('#screenHost');
  if(!trainingText.includes('Supino máquina')||!trainingText.includes('90 kg')) throw new Error(`${label}: workout drilldown did not render`);
  await page.fill('#exerciseQuery','supino');
  await page.waitForFunction(()=>document.querySelectorAll('.exerciseList button').length===1);

  for(const [route,screenTitle] of [['evolucao','Evolução'],['analise','Análise']]){
    await page.click(`${nav} [data-route="${route}"]`);
    await assertScreen(page,screenTitle,`${label}/${route}`);
  }

  for(const [route,screenTitle] of [['hoje','Hoje'],['timeline','Timeline'],['saude','Saúde & exames'],['nutricao','Nutrição'],['dados','Dados'],['tratamentos','Tratamentos']]){
    await page.click(`${nav} [data-route="mais"]`);
    await page.waitForSelector('#moreSheet:not(.hidden)');
    await page.click(`#moreSheet [data-route="${route}"]`);
    await assertScreen(page,screenTitle,`${label}/${route}`);
  }

  await page.click(`${nav} [data-route="mais"]`);
  await page.click('#moreSheet [data-route="dados"]');
  await page.waitForSelector('#uploadForm');
  if((await page.locator('#uploadType option').count())<6) throw new Error(`${label}: import source options missing`);

  if(errors.length) throw new Error(`${label}: page errors: ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 browser smoke passed');
