import {chromium} from 'playwright';
const base='http://127.0.0.1:4173/?fixture=1#analise';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Insights');

  const defaultText=(await page.textContent('#screenHost'))||'';
  if(!defaultText.includes('Sinais complementares por origem'))throw new Error(`${label}: complementary signal section missing`);

  const result=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {renderAnalysisHub,complementarySignalSeries}=await import('./src/analysis-screen.js');
    const originalRows=state.data.sourceMetrics||[],originalStatus=state.domainStatus.sourceMetrics,originalPeriod=state.ui.analysisPeriod;
    state.ui.analysisPeriod='all';
    state.domainStatus.sourceMetrics='ready';
    state.data.sourceMetrics=[
      {source_record_id:'aw-hrv-1',metric_date:'2026-01-01',metric_type:'hrv_sdnn_ms',value:40,unit:'ms',source_name:'Apple Watch particular',source_family:'apple_watch',canonical_status:'candidate'},
      {source_record_id:'aw-hrv-2',metric_date:'2026-01-03',metric_type:'hrv_sdnn_ms',value:44,unit:'ms',source_name:'Apple Watch particular',source_family:'apple_watch',canonical_status:'held'},
      {source_record_id:'aw-rhr-1',metric_date:'2026-01-01',metric_type:'resting_heart_rate_bpm',value:60,unit:'count/min',source_name:'Apple Watch particular',source_family:'apple_watch',canonical_status:'candidate'},
      {source_record_id:'aw-rhr-2',metric_date:'2026-01-02',metric_type:'resting_heart_rate_bpm',value:58,unit:'count/min',source_name:'Apple Watch particular',source_family:'apple_watch',canonical_status:'candidate'},
      {source_record_id:'aw-rhr-3a',metric_date:'2026-01-03',metric_type:'resting_heart_rate_bpm',value:57,unit:'count/min',source_name:'Apple Watch particular',source_family:'apple_watch',canonical_status:'candidate'},
      {source_record_id:'aw-rhr-3b',metric_date:'2026-01-03',metric_type:'resting_heart_rate_bpm',value:59,unit:'count/min',source_name:'Apple Watch particular',source_family:'apple_watch',canonical_status:'held'},
      {source_record_id:'phone-a-step-1',metric_date:'2026-01-01',metric_type:'steps',value:1000,unit:'count',source_name:'iPhone-PRIVATE-A',source_family:'iphone',canonical_status:'candidate'},
      {source_record_id:'phone-a-step-2',metric_date:'2026-01-03',metric_type:'steps',value:1200,unit:'count',source_name:'iPhone-PRIVATE-A',source_family:'iphone',canonical_status:'candidate'},
      {source_record_id:'phone-b-step-1',metric_date:'2026-01-01',metric_type:'steps',value:2000,unit:'count',source_name:'iPhone-PRIVATE-B',source_family:'iphone',canonical_status:'candidate'},
      {source_record_id:'phone-b-step-2',metric_date:'2026-01-03',metric_type:'steps',value:2400,unit:'count',source_name:'iPhone-PRIVATE-B',source_family:'iphone',canonical_status:'held'},
      {source_record_id:'polar-step-1',metric_date:'2026-01-01',metric_type:'steps',value:900,unit:'count',source_name:'Polar Flow',source_family:'polar_flow',canonical_status:'candidate'},
      {source_record_id:'polar-step-2',metric_date:'2026-01-03',metric_type:'steps',value:1100,unit:'count',source_name:'Polar Flow',source_family:'polar_flow',canonical_status:'candidate'},
      {source_record_id:'phone-o2-1',metric_date:'2026-01-01',metric_type:'oxygen_saturation_pct',value:98,unit:'%',source_name:'iPhone-PRIVATE-A',source_family:'iphone',canonical_status:'candidate'},
      {source_record_id:'phone-o2-2',metric_date:'2026-01-02',metric_type:'oxygen_saturation_pct',value:97,unit:'%',source_name:'iPhone-PRIVATE-A',source_family:'iphone',canonical_status:'candidate'},
      {source_record_id:'canonical-energy',metric_date:'2026-01-03',metric_type:'active_energy_kcal',value:9999,unit:'kcal',source_name:'Apple Health ActivitySummary',source_family:'apple_activity_summary',canonical_status:'canonical'},
      {source_record_id:'mfp-energy',metric_date:'2026-01-03',metric_type:'dietary_energy_kcal',value:3333,unit:'kcal',source_name:'MyFitnessPal via Apple Health',source_family:'myfitnesspal',canonical_status:'candidate'}
    ];
    const series=complementarySignalSeries(state.data.sourceMetrics,{start:null,end:null});
    const html=renderAnalysisHub();
    state.data.sourceMetrics=originalRows;state.domainStatus.sourceMetrics=originalStatus;state.ui.analysisPeriod=originalPeriod;
    return{html,series:series.map(s=>({metric:s.metric,sourceLabel:s.sourceLabel,reviewDays:s.reviewDays,last:s.last?.date,points:s.points.length}))};
  });

  const {html,series}=result;
  if(series.length!==6)throw new Error(`${label}: expected six separated complementary series, got ${series.length}`);
  const phoneLabels=[...new Set(series.filter(s=>s.sourceLabel.startsWith('iPhone')).map(s=>s.sourceLabel))];
  if(phoneLabels.length!==2||!phoneLabels.includes('iPhone · origem 1')||!phoneLabels.includes('iPhone · origem 2'))throw new Error(`${label}: multiple iPhone origins were merged or leaked raw identifiers`);
  const rhr=series.find(s=>s.metric==='resting_heart_rate_bpm');
  if(!rhr||rhr.reviewDays!==1||rhr.last!=='2026-01-02'||rhr.points!==2)throw new Error(`${label}: ambiguous same-origin day was not excluded conservatively`);
  for(const expected of ['Sinais complementares por origem','Variabilidade da frequência cardíaca (SDNN)','Frequência cardíaca em repouso','Saturação de oxigênio','Passos','Apple Watch','Polar Flow','iPhone · origem 1','iPhone · origem 2','nenhuma média ou comparação entre fontes é calculada'])if(!html.includes(expected))throw new Error(`${label}: missing complementary signal copy ${expected}`);
  for(const forbidden of ['iPhone-PRIVATE-A','iPhone-PRIVATE-B','9999','3333','ActivitySummary','canonical','candidate','held'])if(html.includes(forbidden))throw new Error(`${label}: raw/internal or excluded value leaked ${forbidden}`);
  if(!html.includes('1 dia com mais de um valor da mesma origem ficou fora desta leitura'))throw new Error(`${label}: ambiguous-day disclosure missing`);

  const failedHtml=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');const {renderAnalysisHub}=await import('./src/analysis-screen.js');
    const original=state.domainStatus.sourceMetrics;state.domainStatus.sourceMetrics='error';const html=renderAnalysisHub();state.domainStatus.sourceMetrics=original;return html;
  });
  if(!failedHtml.includes('Os registros complementares não carregaram agora.'))throw new Error(`${label}: complementary source failure is not explicit`);
  if(failedHtml.includes('data-complementary-signals'))throw new Error(`${label}: complementary signals did not fail closed`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health complementary signals smoke passed');
