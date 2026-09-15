import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const evidenceDir='v2/public-audit-evidence';
const origin=process.env.LTS_TEST_ORIGIN||'http://127.0.0.1:4173';
mkdirSync(evidenceDir,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto(`${origin}/?fixture=1#hoje`,{waitUntil:'domcontentloaded'});
await page.waitForSelector('#app:not(.hidden)');
await page.evaluate(async()=>{
  const core=await import('./src/core.js');
  const home=await import('./src/home-reference.js');
  core.state.session={user:{user_metadata:{name:'Lucas'}}};
  core.state.ui.homePeriod='30';
  core.state.domainStatus={body:'ready',workouts:'ready',exercises:'ready',sets:'ready',nutrition:'ready',labs:'ready',metrics:'ready',sourceMetrics:'ready',treatments:'ready'};
  core.state.data={
    body:[
      {measured_at:'2026-07-16',weight_kg:99.8,body_fat_pct:13.6,fat_mass_kg:13.6,skeletal_muscle_mass_kg:50.3,source:'InBody'},
      {measured_at:'2026-08-24',weight_kg:98.6,body_fat_pct:11.6,fat_mass_kg:11.6,skeletal_muscle_mass_kg:50.6,source:'InBody'}
    ],
    workouts:[
      {source_record_id:'w1',workout_date:'2026-08-18',workout_type:'Upper',is_canonical:true,record_status:'validated'},
      {source_record_id:'w2',workout_date:'2026-08-22',workout_type:'Lower',is_canonical:true,record_status:'validated'},
      {source_record_id:'w3',workout_date:'2026-08-26',workout_type:'Upper',is_canonical:true,record_status:'validated'},
      {source_record_id:'w4',workout_date:'2026-09-01',workout_type:'Lower',is_canonical:true,record_status:'validated'},
      {source_record_id:'w5',workout_date:'2026-09-04',workout_type:'Upper',is_canonical:true,record_status:'validated'},
      {source_record_id:'w6',workout_date:'2026-09-06',workout_type:'Lower',is_canonical:true,record_status:'validated'},
      {source_record_id:'w7',workout_date:'2026-09-08',workout_type:'Upper',is_canonical:true,record_status:'validated'},
      {source_record_id:'w8',workout_date:'2026-09-10',workout_type:'Lower',is_canonical:true,record_status:'validated'},
      {source_record_id:'w9',workout_date:'2026-09-11',workout_type:'Upper body',duration_minutes:59,calories_kcal:524,is_canonical:true,record_status:'validated'}
    ],
    exercises:[],sets:[],
    nutrition:[
      {nutrition_date:'2026-08-20',calories_kcal:2500,protein_g:150},
      {nutrition_date:'2026-08-26',calories_kcal:2687,protein_g:145}
    ],
    labs:[
      {collection_date:'2026-03-19',laboratory:'Fleury',biomarker:'Vitamina D',result_numeric:27,unit:'ng/mL'},
      {collection_date:'2026-05-21',laboratory:'Fleury',biomarker:'Vitamina D',result_numeric:29,unit:'ng/mL'}
    ],
    metrics:[],
    sourceMetrics:[
      {metric_date:'2026-08-25',metric_type:'sleep_duration_h',value:7.1,unit:'h',canonical_status:'candidate',source_name:'Polar Flow',source_family:'polar_flow'},
      {metric_date:'2026-09-10',metric_type:'sleep_duration_h',value:7.4,unit:'h',canonical_status:'candidate',source_name:'Polar Flow',source_family:'polar_flow'}
    ],
    treatments:[]
  };
  document.body.dataset.productRoute='hoje';
  document.querySelector('#screenHost').innerHTML=home.renderProductHomeReference();
});
await page.waitForSelector('.ltsHomeReference');
const result=await page.evaluate(()=>{
  const top=s=>document.querySelector(s)?.getBoundingClientRect().top??99999;
  const domains=[...document.querySelectorAll('.ltsRefDomain')].map(el=>({label:el.querySelector('.ltsRefDomainTop>span:not(.ltsRefTodayIcon)')?.textContent?.trim(),text:el.textContent.trim(),value:el.querySelector(':scope>b')?.textContent?.trim(),overflow:el.scrollWidth-el.clientWidth}));
  return{
    order:[top('.ltsRefHeader'),top('.ltsRefGreeting'),top('.ltsRefMotto'),top('.ltsRefMetrics'),top('.ltsRefToday'),top('.ltsRefProgress'),top('.ltsRefTrend'),top('.ltsRefIntegrated'),top('.ltsRefChange')],
    domains,
    motto:document.querySelector('.ltsRefMotto')?.textContent?.trim()||'',
    metrics:[...document.querySelectorAll('.ltsRefMetric>span')].map(el=>el.textContent.trim()),
    metricFooters:[...document.querySelectorAll('.ltsRefMetric>div')].map(el=>el.textContent.trim()),
    inlineIntegrity:Boolean(document.querySelector('#lts-home-information-integrity')),
    duplicateRouteAction:getComputedStyle(document.querySelector('#routeAction')).display!=='none',
    fontSizes:[...document.querySelectorAll('.ltsRefMetric>span,.ltsRefMetric>div small,.ltsRefTodayCopy small,.ltsRefProgressItem>small,.ltsRefDomain>small,.ltsRefEvent small,.ltsRefContextItem small')].map(el=>parseFloat(getComputedStyle(el).fontSize)),
    trendTabs:document.querySelectorAll('[data-home-metric]').length,
    activePeriod:document.querySelector('.ltsRefPeriod .active')?.textContent?.trim()||'',
    events:document.querySelectorAll('.ltsRefEvent').length,
    context:document.querySelector('.ltsRefContext')?.textContent?.trim()||'',
    horizontal:document.documentElement.scrollWidth-window.innerWidth
  };
});
for(let i=1;i<result.order.length;i++)if(result.order[i]<result.order[i-1])throw new Error(`Home order regressed: ${JSON.stringify(result.order)}`);
const labs=result.domains.find(x=>x.label==='Exames');
if(!labs||!labs.text.includes('Sem coleta / últimos 30 dias')||!labs.text.includes('Última no histórico 21/05/2026'))throw new Error(`Labs mixes historical totals into 30d window: ${JSON.stringify(labs)}`);
const nutrition=result.domains.find(x=>x.label==='Nutrição');
if(!nutrition||!nutrition.text.includes('2 de 30 dias')||!nutrition.text.includes('último 26/08/2026'))throw new Error(`Nutrition lacks coverage/freshness context: ${JSON.stringify(nutrition)}`);
if(!result.motto.includes('Disciplina hoje, evolução sempre'))throw new Error(`Approved Home context line is missing: ${result.motto}`);
if(!result.metrics.includes('Massa magra'))throw new Error(`Approved Home metric is missing: ${JSON.stringify(result.metrics)}`);
if(result.inlineIntegrity)throw new Error('Home still injects a runtime style/order override');
if(result.duplicateRouteAction)throw new Error('Home duplicates the contextual water import action in the top bar');
if(result.fontSizes.some(size=>size<10.5))throw new Error(`Home contains unreadable mobile supporting type: ${JSON.stringify(result.fontSizes)}`);
if(!result.metricFooters[1]?.includes('medição anterior')||!result.metricFooters[2]?.includes('medição anterior'))throw new Error(`Composition changes do not reuse the comparable body pair: ${JSON.stringify(result.metricFooters)}`);
if(result.trendTabs!==8||result.activePeriod!=='30 dias')throw new Error(`Longitudinal controls are incomplete: ${JSON.stringify(result)}`);
if(result.events<3||!result.context.includes('Extrator do MyFitnessPal pronto'))throw new Error(`Recent history or preserved water context is missing: ${JSON.stringify(result)}`);
if(result.domains.some(x=>x.overflow>3))throw new Error(`Domain card overflows mobile width: ${JSON.stringify(result.domains)}`);
if(result.horizontal>3)throw new Error(`Home horizontal overflow ${result.horizontal}px`);
await page.screenshot({path:`${evidenceDir}/mobile-home.png`,fullPage:true});
await page.setViewportSize({width:1440,height:1000});
await page.screenshot({path:`${evidenceDir}/desktop-home.png`,fullPage:true});
await browser.close();
console.log('Home information integrity smoke passed');
