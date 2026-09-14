import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#analise';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});

  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Recuperação & análises');

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.domainStatus.sourceMetrics='ok';
    state.data.sourceMetrics=[
      {metric_date:'2026-02-01',metric_type:'resting_heart_rate_bpm',value:61,unit:'bpm',source_family:'apple_watch',source_name:'Apple Watch',canonical_status:'candidate'},
      {metric_date:'2026-02-02',metric_type:'resting_heart_rate_bpm',value:60,unit:'bpm',source_family:'apple_watch',source_name:'Apple Watch',canonical_status:'candidate'},
      {metric_date:'2026-02-01',metric_type:'resting_heart_rate_bpm',value:63,unit:'bpm',source_family:'ringconn',source_name:'RingConn',canonical_status:'held'},
      {metric_date:'2026-02-02',metric_type:'resting_heart_rate_bpm',value:62,unit:'bpm',source_family:'ringconn',source_name:'RingConn',canonical_status:'held'},
      {metric_date:'2026-02-02',metric_type:'resting_heart_rate_bpm',value:65,unit:'bpm',source_family:'ringconn',source_name:'RingConn',canonical_status:'held'},
      {metric_date:'2026-02-01',metric_type:'hrv_sdnn_ms',value:48,unit:'ms',source_family:'apple_watch',source_name:'Apple Watch',canonical_status:'candidate'},
      {metric_date:'2026-02-02',metric_type:'hrv_sdnn_ms',value:52,unit:'ms',source_family:'apple_watch',source_name:'Apple Watch',canonical_status:'candidate'}
    ];
    state.ui.analysisPeriod='365';
    const {renderRecoveryDepth}=await import('./src/recovery-layout-v2.js');
    document.getElementById('screenHost').innerHTML=renderRecoveryDepth();
  });

  await page.waitForSelector('.ltsRecoveryV2');
  const disclosure=page.locator('details[data-disclosure="recovery-evidence"]');
  await disclosure.locator('summary').click();
  const text=(await disclosure.textContent())||'';

  if(!text.includes('Sinais de recuperação por origem')||!text.includes('Evidência complementar separada'))throw new Error(`${label}: recovery evidence panel is missing`);
  if(!text.includes('Apple Watch')||!text.includes('RingConn'))throw new Error(`${label}: source identities are not preserved`);
  if(!text.includes('61 bpm → 60 bpm'))throw new Error(`${label}: Apple Watch observations are not preserved independently`);
  if(!text.includes('63 bpm → 63 bpm'))throw new Error(`${label}: RingConn unique observations are not preserved independently`);
  if(!text.includes('1 dia em revisão'))throw new Error(`${label}: duplicate source-day is not held for review`);
  if(!text.includes('48 ms → 52 ms'))throw new Error(`${label}: HRV series is not rendered with its own unit`);
  if(!text.includes('não são combinadas nem comparadas automaticamente'))throw new Error(`${label}: source-separation boundary is not explicit`);
  if(text.includes('média entre aparelhos')&&text.includes('bpm médio'))throw new Error(`${label}: cross-device average appears in the evidence panel`);

  const rows=await disclosure.locator('.recoveryEvidenceRow').count();
  if(rows!==3)throw new Error(`${label}: expected three source-separated series, got ${rows}`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: recovery panel caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 recovery depth smoke passed');
