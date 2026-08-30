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
  if(!contextText.includes('Toque em um registro para abrir o detalhe'))throw new Error(`${label}: cross-domain drilldown instruction is missing`);
  const contextJump=page.locator('.timelineContext [data-timeline-jump]').first();
  if(!await contextJump.count())throw new Error(`${label}: actionable record is missing from cross-domain context`);
  const contextRoute=await contextJump.getAttribute('data-timeline-route');
  if(!contextRoute)throw new Error(`${label}: cross-domain action has no target route`);
  await contextJump.click();
  await page.waitForFunction(route=>location.hash===`#${route}`&&document.querySelector('#screenHost h1')?.textContent!=='Timeline',contextRoute);

  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Timeline');
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
    state.data.sourceMetrics=[...(state.data.sourceMetrics||[]),
      {source_record_id:'timeline-sleep-watch',metric_date:'2026-04-04',metric_type:'sleep_duration_h',value:7.1,unit:'h',source_name:'Apple Watch',source_family:'apple_watch',canonical_status:'candidate'},
      {source_record_id:'timeline-sleep-ring',metric_date:'2026-04-04',metric_type:'sleep_duration_h',value:6.8,unit:'h',source_name:'RingConn',source_family:'ringconn',canonical_status:'held'},
      {source_record_id:'timeline-sleep-unknown',metric_date:'2026-04-04',metric_type:'sleep_duration_h',value:8.2,unit:'h',source_name:'Origem sem status',source_family:'healthkit_candidate',canonical_status:null}
    ];
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
  await page.selectOption('#timelineDomain','Sono por fonte');
  await page.waitForTimeout(80);
  const sleepText=(await page.locator('#screenHost').textContent())||'';
  for(const expected of ['Apple Watch','RingConn','7,1 h · Em validação · Não consolidado','6,8 h · Em validação · Não consolidado']){
    if(!sleepText.includes(expected))throw new Error(`${label}: source-preserving sleep evidence missing ${expected}`);
  }
  if(sleepText.includes('Origem sem status')||sleepText.includes('8,2 h'))throw new Error(`${label}: sleep evidence without explicit candidate/held status leaked into Timeline`);
  if(sleepText.includes('13,9 h'))throw new Error(`${label}: overlapping sleep sources were summed`);

  await page.selectOption('#timelineDomain','Treinos');
  await page.waitForTimeout(80);
  const jump=page.locator('.timelineGroups [data-timeline-jump][data-timeline-kind="workout"]').first();
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
