import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#dados';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');

  const text=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {renderDataHub}=await import('./src/data-screen.js');
    state.domainStatus.sourceMetrics='ready';
    state.domainStatus.uploads='ready';
    state.domainStatus.previews='ready';
    state.domainStatus.quality='ready';
    state.data.uploads=[];
    state.data.previews=[];
    state.data.quality=[];
    state.data.sourceMetrics=[
      {source_record_id:'explicit-candidate',metric_date:'2026-08-28',metric_type:'steps',source_family:'apple_watch',canonical_status:'candidate'},
      {source_record_id:'missing-status',metric_date:'2026-08-29',metric_type:'steps',source_family:'apple_watch'},
      {source_record_id:'held-record',metric_date:'2026-08-30',metric_type:'steps',source_family:'apple_watch',canonical_status:'held'}
    ];
    document.querySelector('#screenHost').innerHTML=renderDataHub();
    const card=[...document.querySelectorAll('.provenanceCard')].find(node=>node.textContent.includes('Apple Watch'));
    return card?.textContent||'';
  });

  if(!text.includes('0 canônico(s)'))throw new Error(`${label}: canonical count changed unexpectedly: ${text}`);
  if(!text.includes('1 candidato(s)'))throw new Error(`${label}: missing status was counted as candidate or explicit candidate was lost: ${text}`);
  if(!text.includes('2 preservado(s)'))throw new Error(`${label}: ambiguous/held provenance was not preserved separately: ${text}`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 provenance display smoke passed');
