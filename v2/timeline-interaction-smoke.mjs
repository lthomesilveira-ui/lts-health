import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#timeline';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});

  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Timeline');
  await page.waitForSelector('.timelineStats');
  await page.waitForSelector('.timelineContext');
  const contextText=(await page.locator('.timelineContext').textContent())||'';
  if(!contextText.includes('Visão cruzada por dia'))throw new Error(`${label}: cross-domain daily context is missing`);
  if(!contextText.includes('não demonstra causa'))throw new Error(`${label}: cross-domain context lost the non-causal guardrail`);

  await page.selectOption('#timelinePeriod','all');
  await page.waitForSelector('#timelineYear');
  if(await page.inputValue('#timelineYear')!=='2026')throw new Error(`${label}: timeline year navigation did not select available year`);

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const rows=[];
    for(let i=0;i<300;i++){
      const d=new Date('2026-04-01T12:00:00Z');d.setUTCDate(d.getUTCDate()+(i%90));
      rows.push({source_record_id:`timeline-load-${i}`,activity_date:d.toISOString().slice(0,10),activity_name:'Teste carga timeline',activity_type:'test',source:'Fixture de interface'});
    }
    state.data.activity=[...(state.data.activity||[]),...rows];
  });

  await page.selectOption('#timelineDomain','Atividade');
  await page.waitForTimeout(80);
  await page.fill('#timelineQuery','Teste carga timeline');
  await page.waitForFunction(()=>document.querySelector('.timelineSummary b')?.textContent==='250');
  await page.waitForFunction(()=>document.querySelector('.timelineSummary span')?.textContent.includes('de 300'));
  await page.waitForSelector('[data-timeline-more]');
  await page.click('[data-timeline-more]');
  await page.waitForFunction(async()=>{const {state}=await import('./src/core.js');return Number(state.ui.timelineLimit)>=500;});
  await page.waitForFunction(()=>document.querySelector('.timelineSummary b')?.textContent==='300');
  if(await page.locator('[data-timeline-more]').count())throw new Error(`${label}: load-more button remained after all matching history became visible`);

  await page.fill('#timelineQuery','');
  await page.waitForTimeout(80);
  await page.selectOption('#timelineDomain','Treinos');
  await page.waitForTimeout(80);
  const jump=page.locator('[data-timeline-jump][data-timeline-kind="workout"]').first();
  await jump.click();
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Treinos');
  await page.waitForSelector('.session.open .sessionBody');
  const session=(await page.locator('.session.open').textContent())||'';
  if(!session.includes('Supino máquina')||!session.includes('90 kg'))throw new Error(`${label}: timeline workout drilldown did not open the structured session`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: timeline caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 timeline interaction smoke passed');
