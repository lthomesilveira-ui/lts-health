import {chromium} from 'playwright';

const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/?fixture=1';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-executive-dashboard]');
  const result=await page.evaluate(async()=>{
    const {buildHealthIntelligence}=await import('./src/intelligence-engine.js');
    const status={body:'ready',workouts:'ready',exercises:'ready',sets:'ready',nutrition:'ready',metrics:'ready',sourceMetrics:'ready',labs:'ready'};
    const missingUnits=buildHealthIntelligence({labs:[
      {collection_date:'2026-07-10',laboratory:'Fleury',biomarker:'Glicose',result_numeric:90,unit:''},
      {collection_date:'2026-08-10',laboratory:'Fleury',biomarker:'Glicose',result_numeric:95,unit:''}
    ]},status,new Date('2026-08-11T12:00:00Z'));
    const splitSources=buildHealthIntelligence({labs:[
      {collection_date:'2026-07-10',laboratory:'Fleury',biomarker:'Glicose',result_numeric:90,unit:'mg/dL'},
      {collection_date:'2026-07-10',laboratory:'Einstein',biomarker:'Hemoglobina',result_numeric:14,unit:'g/dL'},
      {collection_date:'2026-08-10',laboratory:'Fleury',biomarker:'Glicose',result_numeric:95,unit:'mg/dL'},
      {collection_date:'2026-08-10',laboratory:'Einstein',biomarker:'Hemoglobina',result_numeric:14.2,unit:''}
    ]},status,new Date('2026-08-11T12:00:00Z'));
    const missing=missingUnits.changes.find(item=>item.route==='saude');
    const split=splitSources.changes.find(item=>item.route==='saude');
    return{missingKind:missing?.kind||'',missingSummary:missing?.summary||'',splitKind:split?.kind||'',splitSummary:split?.summary||''};
  });
  if(result.missingKind!=='coverage')throw new Error(`${label}: unitless lab values were promoted as longitudinal change (${result.missingKind})`);
  if(!result.missingSummary.includes('unidade presente'))throw new Error(`${label}: missing-unit boundary is not explicit (${result.missingSummary})`);
  if(result.splitKind!=='change')throw new Error(`${label}: valid same-source comparison was lost (${result.splitKind})`);
  if(!result.splitSummary.includes('1 biomarcador(es)'))throw new Error(`${label}: same-day laboratories were merged into one comparison (${result.splitSummary})`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health lab intelligence boundary smoke passed');
