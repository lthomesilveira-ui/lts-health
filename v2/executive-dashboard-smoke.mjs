import {chromium} from 'playwright';

const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/?fixture=1';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-executive-dashboard]');

  const boundary=await page.evaluate(async()=>{
    const {buildHealthIntelligence}=await import('./src/intelligence-engine.js');
    const status={body:'ready',workouts:'ready',exercises:'ready',sets:'ready',nutrition:'ready',metrics:'ready',labs:'ready'};
    const model=buildHealthIntelligence({
      metrics:[
        {measured_at:'2026-08-29',metric_type:'steps',value:12000,source:'Apple Health'},
        {measured_at:'2026-08-29',metric_type:'sleep_duration_h',value:8,source:'RingConn'},
        {measured_at:'2026-08-29',metric_type:'active_energy_kcal',value:650,source:'Apple Health ActivitySummary'}
      ],
      sourceMetrics:[
        {metric_date:'2026-08-29',metric_type:'sleep_duration_h',canonical_status:'held'},
        {metric_date:'2026-08-29',metric_type:'steps',canonical_status:'candidate'}
      ]
    },status,new Date('2026-08-30T12:00:00Z'));
    const coverage=model.coverage.find(row=>row.key==='metrics');
    const timelineInsight=model.cross.find(item=>item.route==='timeline');
    return{
      coverageLabel:coverage?.label||'',
      coverageDetail:coverage?.detail||'',
      timelineSummary:timelineInsight?.summary||'',
      pendingSummary:model.pending?.summary||'',
      referenceDay:model.referenceDay
    };
  });
  if(boundary.coverageLabel!=='Atividade')throw new Error(`${label}: sleep must not be treated as canonical coverage`);
  if(!boundary.coverageDetail.includes('1 dia(s)'))throw new Error(`${label}: only validated activity types may count (${boundary.coverageDetail})`);
  if(!boundary.timelineSummary.includes('Sono permanece fora desta leitura'))throw new Error(`${label}: sleep policy must remain explicit`);
  if(!boundary.pendingSummary.includes('2 registro(s)'))throw new Error(`${label}: candidate and held source records must remain pending`);
  if(boundary.referenceDay!=='2026-08-29')throw new Error(`${label}: candidate-only metrics must not move reference day (${boundary.referenceDay})`);

  const hash=await page.evaluate(()=>location.hash);
  if(hash!=='#hoje')throw new Error(`${label}: executive dashboard was not the first-run home (${hash})`);
  const activeRoutes=await page.locator('[data-route].active').evaluateAll(nodes=>nodes.map(node=>node.dataset.route));
  const visibleActive=[...new Set(activeRoutes)];
  if(visibleActive.length!==1||visibleActive[0]!=='hoje')throw new Error(`${label}: home navigation state is ambiguous (${visibleActive.join('|')})`);
  const text=(await page.textContent('#screenHost'))||'';
  for(const expected of ['LTS Health Intelligence','Estado atual','O que merece sua atenção no histórico','Pontos de atenção','Cobertura','Pergunte ao histórico']){
    if(!text.includes(expected))throw new Error(`${label}: missing executive dashboard section: ${expected}`);
  }
  const current=await page.locator('.intelCurrentCard').count();
  const insights=await page.locator('.intelInsightCard').count();
  const coverage=await page.locator('.intelCoverageCard').count();
  if(current!==6)throw new Error(`${label}: expected 6 current-state cards, got ${current}`);
  if(insights<3)throw new Error(`${label}: expected at least 3 evidence-backed insights, got ${insights}`);
  if(coverage!==5)throw new Error(`${label}: expected 5 coverage domains, got ${coverage}`);
  if(/\b(causou|provou|garante|melhorou|piorou)\b/i.test(text))throw new Error(`${label}: dashboard used causal or value-judgment language`);
  const firstEvidence=page.locator('.intelInsightCard button').first();
  await firstEvidence.click();
  await page.waitForFunction(()=>location.hash!=='#hoje');
  await page.locator('[data-route="hoje"]:visible').first().click();
  await page.waitForSelector('[data-executive-dashboard]');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: executive dashboard horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
await run({width:320,height:700},'compact');
console.log('LTS Health executive dashboard smoke passed');
