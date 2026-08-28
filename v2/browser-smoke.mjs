import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1';
const forbidden=/\b(canonical|parity|backend|provenance[- ]first|readiness|PWA)\b/i;

async function assertScreen(page,title,label){
  await page.waitForFunction(t=>document.querySelector('#screenHost h1')?.textContent===t,title);
  const text=(await page.textContent('#screenHost'))||'';
  if(text.trim().length<20) throw new Error(`${label}: screen unexpectedly empty`);
  if(text.match(forbidden)) throw new Error(`${label}: implementation jargon visible`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3) throw new Error(`${label}: horizontal overflow ${overflow}px`);
}

async function openMoreRoute(page,nav,route,title,label){
  await page.click(`${nav} [data-route="mais"]`);
  await page.waitForSelector('#moreSheet:not(.hidden)');
  await page.click(`#moreSheet [data-route="${route}"]`);
  await assertScreen(page,title,label);
}

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
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
  await page.click('#routeAction');
  await page.waitForSelector('#entryModal:not(.hidden) #bodyEntryForm');
  await page.click('#closeEntry');

  await page.click(`${nav} [data-route="treinos"]`);
  await assertScreen(page,'Treinos',`${label}/treinos`);
  await page.selectOption('#trainingPeriod','all');
  await page.waitForSelector('[data-workout="workout-2"]');
  await page.click('[data-workout="workout-2"]');
  await page.waitForSelector('.session.open .sessionBody');
  const trainingText=await page.textContent('#screenHost');
  if(!trainingText.includes('Supino máquina')||!trainingText.includes('90 kg')) throw new Error(`${label}: workout drilldown did not render`);
  await page.fill('#exerciseQuery','supino');
  await page.waitForFunction(()=>document.querySelectorAll('.exerciseList button').length===1);
  await page.click('#routeAction');
  await page.waitForSelector('#entryModal:not(.hidden) #workoutEntryForm');
  await page.click('[data-add-exercise]');
  if((await page.locator('.exerciseEntry').count())!==2) throw new Error(`${label}: add exercise control failed`);
  await page.click('.exerciseEntry:first-child [data-add-set]');
  if((await page.locator('.exerciseEntry:first-child .setEntry').count())!==2) throw new Error(`${label}: add set control failed`);
  await page.click('#closeEntry');

  await page.click(`${nav} [data-route="evolucao"]`);
  await assertScreen(page,'Evolução',`${label}/evolucao`);
  await page.click('[data-evolution-metric="skeletal_muscle_mass_kg"]');
  await page.waitForFunction(()=>document.querySelector('[data-evolution-metric="skeletal_muscle_mass_kg"]')?.classList.contains('active'));
  if((await page.locator('[data-segmental-date]').count())!==2) throw new Error(`${label}: segmental dates missing`);
  await page.click('[data-segmental-date="2026-01-01"]');
  await page.waitForFunction(()=>document.querySelector('[data-segmental-date="2026-01-01"]')?.classList.contains('active'));

  await page.click(`${nav} [data-route="analise"]`);
  await assertScreen(page,'Análise',`${label}/analise`);

  await openMoreRoute(page,nav,'hoje','Hoje',`${label}/hoje`);
  const todayText=await page.textContent('#screenHost');
  if(!todayText.includes('Último treino')||!todayText.includes('Última bio')) throw new Error(`${label}: Today essentials missing`);

  await openMoreRoute(page,nav,'timeline','Timeline',`${label}/timeline`);
  const timelineText=await page.textContent('#screenHost');
  if(!timelineText.includes('Caminhada')||!timelineText.includes('Sono')) throw new Error(`${label}: activity/sleep timeline events missing`);

  await openMoreRoute(page,nav,'saude','Saúde & exames',`${label}/saude`);
  if((await page.locator('#collectionSelect option').count())!==1) throw new Error(`${label}: lab collection selector missing`);
  if((await page.locator('.markerList button').count())!==2) throw new Error(`${label}: biomarker explorer missing`);
  await page.fill('#labQuery','Marcador A');
  await page.waitForFunction(()=>document.querySelectorAll('.markerList button').length===1);

  await openMoreRoute(page,nav,'nutricao','Nutrição',`${label}/nutricao`);
  await page.selectOption('#nutritionPeriod','all');
  await page.click('[data-nutrition-date="2026-02-02"]');
  const nutritionText=await page.textContent('#screenHost');
  if(!nutritionText.includes('Almoço')||!nutritionText.includes('Jantar')) throw new Error(`${label}: nutrition day drilldown missing meals`);

  await openMoreRoute(page,nav,'dados','Dados',`${label}/dados`);
  await page.waitForSelector('#uploadForm');
  if((await page.locator('#uploadType option').count())<6) throw new Error(`${label}: import source options missing`);
  if((await page.locator('.sourceStatus').count())!==5) throw new Error(`${label}: source status cards missing`);
  await page.click('[data-source-upload="apple_health"]');
  if(await page.inputValue('#uploadType')!=='apple_health') throw new Error(`${label}: source upload shortcut failed`);

  await openMoreRoute(page,nav,'tratamentos','Tratamentos',`${label}/tratamentos`);
  if(errors.length) throw new Error(`${label}: page errors: ${errors.join(' | ')}`);
  await browser.close();
}

async function runPartialTraining(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  await page.goto(`${base}&fixtureError=sets#treinos`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await assertScreen(page,'Treinos',`${label}/partial-training`);
  await page.selectOption('#trainingPeriod','all');
  const seriesMetric=await page.locator('.metric').filter({hasText:'Séries'}).first().textContent();
  if(!seriesMetric?.includes('—')||!seriesMetric?.includes('não carregado')) throw new Error(`${label}: failed sets were rendered as a numeric zero`);
  await page.waitForSelector('[data-workout="workout-2"]');
  await page.click('[data-workout="workout-2"]');
  const sessionText=await page.locator('.session.open').textContent();
  if(!sessionText?.includes('séries indisponíveis')||!sessionText?.includes('Detalhes das séries indisponíveis agora')) throw new Error(`${label}: session hides partial set loading failure`);
  const full=(await page.textContent('#screenHost'))||'';
  if(full.match(/Séries\s*0\b/i)) throw new Error(`${label}: contradictory zero-count series state visible`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
await runPartialTraining({width:1280,height:900},'desktop');
await runPartialTraining({width:390,height:844},'mobile');
console.log('LTS Health v2 browser smoke passed');
