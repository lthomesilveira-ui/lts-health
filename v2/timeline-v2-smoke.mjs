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
  let text=(await page.textContent('#screenHost'))||'';
  for(const expected of ['Sono','Passos','Frequência cardíaca em repouso','61 bpm','Visão cruzada por dia','Tratamento registrado']){
    if(!text.includes(expected))throw new Error(`${label}: Timeline missing ${expected}`);
  }
  if(!text.includes('não demonstra causa'))throw new Error(`${label}: causal guardrail missing`);
  if(text.includes('Confirmação registrada'))throw new Error(`${label}: treatment operational state leaked into Timeline`);
  if(/\btaken\b/i.test(text))throw new Error(`${label}: treatment event_type leaked into Timeline`);

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.body=[...(state.data.body||[]),
      {source_record_id:'missing-body-fields',measured_at:'2026-02-03',weight_kg:null,skeletal_muscle_mass_kg:null,body_fat_pct:null,source:'Fixture de interface'},
      {source_record_id:'ambiguous-body-a',measured_at:'2026-02-05',weight_kg:999.1,skeletal_muscle_mass_kg:777.1,body_fat_pct:66.1,source:'InBody A'},
      {source_record_id:'ambiguous-body-b',measured_at:'2026-02-05',weight_kg:888.2,skeletal_muscle_mass_kg:666.2,body_fat_pct:55.2,source:'InBody B'}
    ];
    state.data.nutrition=[...(state.data.nutrition||[]),
      {source_record_id:'ambiguous-nutrition-a',nutrition_date:'2026-02-05',calories_kcal:7777,protein_g:777,source:'MyFitnessPal export A'},
      {source_record_id:'ambiguous-nutrition-b',nutrition_date:'2026-02-05',calories_kcal:6666,protein_g:666,source:'MyFitnessPal export B'}
    ];
    state.data.metrics=[...(state.data.metrics||[]),{source_record_id:'missing-metric-value',measured_at:'2026-02-03T12:00:00Z',metric_type:'weight_kg',value:null,unit:'kg',source:'Fixture de interface'}];
    state.data.labs=[...(state.data.labs||[]),
      {source_record_id:'lab-source-a',collection_date:'2026-02-04',laboratory:null,test_name:'Marcador A',value_num:1,unit:'u',source:'Fleury arquivo A'},
      {source_record_id:'lab-source-b',collection_date:'2026-02-04',laboratory:null,test_name:'Marcador B',value_num:2,unit:'u',source:'Einstein arquivo B'}
    ];
    state.data.sourceMetrics=[...(state.data.sourceMetrics||[]),
      {source_record_id:'sleep-watch',metric_date:'2026-02-03',metric_type:'sleep_duration_h',value:7.1,unit:'h',source_name:'Apple Watch',source_family:'apple_watch',canonical_status:'candidate'},
      {source_record_id:'sleep-ring',metric_date:'2026-02-03',metric_type:'sleep_duration_h',value:6.8,unit:'h',source_name:'RingConn',source_family:'ringconn',canonical_status:'held'},
      {source_record_id:'steps-watch',metric_date:'2026-02-03',metric_type:'steps',value:7100,unit:'count',source_name:'Apple Watch',source_family:'apple_watch',canonical_status:'candidate'},
      {source_record_id:'rhr-watch',metric_date:'2026-02-03',metric_type:'resting_heart_rate_bpm',value:59,unit:'count/min',source_name:'Apple Watch',source_family:'apple_watch',canonical_status:'candidate'},
      {source_record_id:'steps-ring',metric_date:'2026-02-03',metric_type:'steps',value:6900,unit:'count',source_name:'RingConn',source_family:'ringconn',canonical_status:'held'},
      {source_record_id:'mfp-energy',metric_date:'2026-02-03',metric_type:'dietary_energy_kcal',value:2100,unit:'kcal',source_name:'MyFitnessPal via Apple Health',source_family:'myfitnesspal',canonical_status:'candidate'},
      {source_record_id:'mfp-protein',metric_date:'2026-02-03',metric_type:'dietary_protein_g',value:165,unit:'g',source_name:'MyFitnessPal via Apple Health',source_family:'myfitnesspal',canonical_status:'candidate'},
      {source_record_id:'sleep-unclassified',metric_date:'2026-02-03',metric_type:'sleep_duration_h',value:8.2,unit:'h',source_name:'Origem sem status',source_family:'healthkit_candidate',canonical_status:null},
      {source_record_id:'hrv-unclassified',metric_date:'2026-02-03',metric_type:'hrv_sdnn_ms',value:42,unit:'ms',source_name:'Apple ambíguo',source_family:'apple_watch',canonical_status:null},
      {source_record_id:'canonical-source-metric',metric_date:'2026-02-03',metric_type:'steps',value:9999,unit:'count',source_name:'Fonte técnica indevida',source_family:'apple_activity_summary',canonical_status:'canonical'}
    ];
    state.ui.timelinePeriod='all';state.ui.timelineYear='2026';state.ui.timelineQuery='';state.ui.timelineDomain='all';
  });
  const nav=viewport.width<720?'#mobileNav':'#primaryNav';
  await page.click(`${nav} [data-route="bio"]`);
  await page.click(`${nav} [data-route="mais"]`);
  await page.click('#moreSheet [data-route="timeline"]');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Timeline');
  text=(await page.textContent('#screenHost'))||'';
  if(!text.includes('Composição corporal registrada'))throw new Error(`${label}: missing body fields were not rendered neutrally`);
  if(!text.includes('Registro disponível'))throw new Error(`${label}: missing metric value was not rendered neutrally`);
  if(text.includes('Peso — kg')||text.includes('MME'))throw new Error(`${label}: missing body values leaked as pseudo-measurements or acronym`);
  if(text.includes('Confirmação registrada')||/\btaken\b/i.test(text))throw new Error(`${label}: treatment operational context reappeared after rerender`);
  for(const expected of ['Sono em conferência','Métricas em conferência','Alimentação em conferência','Apple Watch','RingConn','MyFitnessPal (via Apple Saúde)','Sono 7,1 h','Sono 6,8 h','Passos 7.100 passos','Frequência cardíaca em repouso 59 bpm','Calorias 2.100 kcal','Proteína 165,0 g','aguardando conferência; mantido separado dos dados confirmados','Composição em revisão','Alimentação em revisão','valores preservados sem escolha automática']){
    if(!text.includes(expected))throw new Error(`${label}: readable source-preserving evidence missing ${expected}`);
  }
  const reviewDay=page.locator('.timelineDay').filter({hasText:'05/02/2026'});
  if(await reviewDay.locator('.timelineItem').filter({hasText:'Composição em revisão'}).count()!==2)throw new Error(`${label}: same-day body records were not preserved separately during review`);
  if(await reviewDay.locator('.timelineItem').filter({hasText:'Alimentação em revisão'}).count()!==2)throw new Error(`${label}: same-day nutrition records were not preserved separately during review`);
  for(const forbiddenValue of ['999,1 kg','888,2 kg','777,1 kg','666,2 kg','7.777 kcal','6.666 kcal','777 g de proteína','666 g de proteína']){
    if(text.includes(forbiddenValue))throw new Error(`${label}: conflicting same-day value leaked into Timeline: ${forbiddenValue}`);
  }
  const labItems=page.locator('.timelineDay').filter({hasText:'04/02/2026'}).locator('.timelineItem').filter({hasText:/Fleury arquivo A|Einstein arquivo B/});
  if(await labItems.count()!==2)throw new Error(`${label}: same-day lab sources were not preserved as two Timeline collections`);
  for(let i=0;i<2;i++){
    const labText=(await labItems.nth(i).textContent())||'';
    if(!labText.includes('1 resultado(s)'))throw new Error(`${label}: a lab source was merged with another source on the same date`);
  }
  if(text.includes('Origem sem status')||text.includes('8,2 h')||text.includes('Apple ambíguo')||text.includes('42 ms'))throw new Error(`${label}: ambiguous source metric status leaked into Timeline evidence`);
  if(text.includes('Fonte técnica indevida')||text.includes('9.999'))throw new Error(`${label}: confirmed sourceMetrics row leaked into review evidence`);
  if(text.includes('13,9 h'))throw new Error(`${label}: overlapping sleep sources were summed`);
  if(text.includes('14.000 passos'))throw new Error(`${label}: source-specific step records were summed across sources`);
  const reviewContext=page.locator('.timelineContextCard').filter({hasText:'03/02/2026'});
  if(await reviewContext.count()){
    const reviewContextText=(await reviewContext.first().textContent())||'';
    for(const reviewDomain of ['Sono em conferência','Alimentação em conferência','Métricas em conferência']){
      if(reviewContextText.includes(reviewDomain))throw new Error(`${label}: review-only evidence leaked into cross-domain context: ${reviewDomain}`);
    }
  }
  for(const forbidden of [' count','count/min','ActivitySummary','source_family','Em validação · Não consolidado','canônico','candidato','FC de repouso','MME']){
    if(text.includes(forbidden))throw new Error(`${label}: technical language leaked into Timeline: ${forbidden}`);
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 Timeline smoke passed');