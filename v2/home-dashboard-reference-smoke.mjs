import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';

const origin=process.env.LTS_TEST_ORIGIN||'http://127.0.0.1:4173';
const evidenceDir='v2/public-audit-evidence';
mkdirSync(evidenceDir,{recursive:true});

const browser=await chromium.launch({headless:true});

async function renderReference(page,{metric='weight',period='365'}={}){
  await page.evaluate(async({metric,period})=>{
    const core=await import('./src/core.js');
    const home=await import('./src/home-reference.js');
    core.state.data=core.fixtureData();
    core.state.loaded=true;
    core.state.route='hoje';
    core.state.session={user:{user_metadata:{full_name:'Lucas'}}};
    core.state.ui.homeMetric=metric;
    core.state.ui.homePeriod=period;
    core.state.domainStatus={body:'ready',segmental:'ready',workouts:'ready',workoutEvidence:'ready',exercises:'ready',sets:'ready',nutrition:'ready',labs:'ready',docs:'ready',metrics:'ready',sourceMetrics:'ready',treatments:'ready',regimens:'ready'};
    document.body.dataset.productRoute='hoje';
    const host=document.querySelector('#screenHost');
    host.innerHTML=home.renderProductHomeReference();
    host.scrollTop=0;
  },{metric,period});
  await page.waitForSelector('.ltsHomeReference');
}

for(const config of [
  {label:'desktop',viewport:{width:1440,height:900}},
  {label:'mobile',viewport:{width:393,height:852}}
]){
  const page=await browser.newPage({viewport:config.viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('Failed to load resource'))errors.push(message.text());});
  await page.goto(`${origin}/?fixture=1#hoje`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await renderReference(page);

  const initial=await page.evaluate(label=>{
    const rect=selector=>document.querySelector(selector)?.getBoundingClientRect();
    const font=selector=>parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    const rail=document.querySelector('.ltsRefDomainGrid');
    return{
      label,
      metricCount:document.querySelectorAll('.ltsRefMetric').length,
      todayRows:document.querySelectorAll('.ltsRefTodayRow').length,
      progressCount:document.querySelectorAll('.ltsRefProgressItem').length,
      trendTabs:document.querySelectorAll('[data-home-metric]').length,
      domainCount:document.querySelectorAll('.ltsRefDomain').length,
      eventCount:document.querySelectorAll('.ltsRefEvent').length,
      overflow:document.documentElement.scrollWidth-window.innerWidth,
      progressBottom:rect('.ltsRefProgress')?.bottom,
      trendTop:rect('.ltsRefTrend')?.top,
      todayTop:rect('.ltsRefToday')?.top,
      bodyFont:font('.ltsRefTodayCopy b'),
      railClient:rail?.clientWidth,
      railScroll:rail?.scrollWidth
    };
  },config.label);
  if(initial.metricCount!==3||initial.todayRows<4||initial.progressCount!==4)throw new Error(`${config.label}: approved Home hierarchy is incomplete ${JSON.stringify(initial)}`);
  if(initial.trendTabs!==8||initial.domainCount!==6||initial.eventCount<3)throw new Error(`${config.label}: longitudinal cockpit is incomplete ${JSON.stringify(initial)}`);
  if(initial.overflow>3)throw new Error(`${config.label}: horizontal overflow ${initial.overflow}px`);
  if(initial.bodyFont<12)throw new Error(`${config.label}: primary Home text is too small (${initial.bodyFont}px)`);
  if(config.label==='desktop'){
    if(initial.trendTop>initial.todayTop+4)throw new Error(`desktop: longitudinal chart does not lead beside Today ${JSON.stringify(initial)}`);
  }else{
    if(initial.progressBottom>790)throw new Error(`mobile: weekly progress fell below the approved first-screen hierarchy ${JSON.stringify(initial)}`);
    if(initial.railScroll<=initial.railClient)throw new Error('mobile: domain summaries must remain a compact horizontal rail');
  }

  await renderReference(page,{metric:'training',period:'30'});
  const changed=await page.evaluate(()=>({heading:document.querySelector('.ltsRefTrend h2')?.textContent,period:[...document.querySelectorAll('.ltsRefPeriod button.active')].map(button=>button.textContent.trim()),bars:document.querySelectorAll('.ltsRefTrendMarks rect').length}));
  if(changed.heading!=='Treinos por semana'||changed.period[0]!=='30 dias'||changed.bars<1)throw new Error(`${config.label}: chart controls do not change the longitudinal view ${JSON.stringify(changed)}`);
  if(errors.length)throw new Error(`${config.label}: browser errors ${errors.join(' | ')}`);
  await renderReference(page);
  await page.screenshot({path:`${evidenceDir}/${config.label}-home-dashboard-reference.png`,fullPage:config.label==='desktop'});
  await page.close();
}

await browser.close();
console.log('LTS Health Home dashboard reference smoke passed');
