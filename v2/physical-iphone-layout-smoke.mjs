import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';

const evidenceDir='v2/public-audit-evidence';
const origin=process.env.LTS_TEST_ORIGIN||'http://127.0.0.1:4173';
mkdirSync(evidenceDir,{recursive:true});

const browser=await chromium.launch({headless:true});

async function productRoute(page,route,modulePath,exportName){
  await page.evaluate(async({route,modulePath,exportName})=>{
    const core=await import('./src/core.js');
    const module=await import(modulePath);
    core.state.data=core.fixtureData();
    core.state.loaded=true;
    core.state.route=route;
    core.state.domainStatus={body:'ready',segmental:'ready',workouts:'ready',exercises:'ready',sets:'ready',nutrition:'ready',labs:'ready',docs:'ready',metrics:'ready',sourceMetrics:'ready',treatments:'ready'};
    document.body.dataset.productRoute=route;
    const host=document.querySelector('#screenHost');
    host.innerHTML=module[exportName]();
    host.scrollTop=0;
    document.querySelectorAll('#mobileNav [data-route]').forEach(button=>button.classList.toggle('active',button.dataset.route===route));
  },{route,modulePath,exportName});
}

for(const config of [
  {label:'iphone-full',viewport:{width:393,height:852}},
  {label:'iphone-safari-sheet',viewport:{width:393,height:650}}
]){
  const page=await browser.newPage({viewport:config.viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{
    const value=message.text();
    if(message.type()==='error'&&!value.includes('Failed to load resource'))errors.push(value);
  });
  await page.goto(`${origin}/?fixture=1#hoje`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');

  await productRoute(page,'hoje','./src/home-reference.js','renderProductHomeReference');
  await page.waitForSelector('.ltsHomeReference');
  const home=await page.evaluate(()=>{
    const rect=selector=>document.querySelector(selector)?.getBoundingClientRect();
    const app=rect('#app'),host=rect('#screenHost'),nav=rect('#mobileNav'),header=rect('.ltsRefHeader'),progress=rect('.ltsRefProgress');
    const hostStyle=getComputedStyle(document.querySelector('#screenHost'));
    return{
      appHeight:app?.height,hostTop:host?.top,hostBottom:host?.bottom,navTop:nav?.top,
      headerTop:header?.top,progressTop:progress?.top,
      hostPaddingBottom:parseFloat(hostStyle.paddingBottom),
      hostMinHeight:hostStyle.minHeight,
      overflow:document.documentElement.scrollWidth-window.innerWidth
    };
  });
  if(home.hostTop>2)throw new Error(`${config.label}/home: hidden topbar still reserves ${Math.round(home.hostTop)}px`);
  if(home.headerTop<0||home.headerTop>18)throw new Error(`${config.label}/home: first useful content starts at ${Math.round(home.headerTop)}px`);
  if(home.hostBottom>home.navTop+1)throw new Error(`${config.label}/home: content overlaps navigation`);
  if(home.hostPaddingBottom>30)throw new Error(`${config.label}/home: duplicate bottom reserve ${home.hostPaddingBottom}px`);
  if(home.overflow>3)throw new Error(`${config.label}/home: horizontal overflow ${home.overflow}px`);
  if(config.label==='iphone-safari-sheet'&&home.progressTop>650)throw new Error(`${config.label}/home: weekly progress starts below the reduced first viewport at ${Math.round(home.progressTop)}px`);
  await page.screenshot({path:`${evidenceDir}/${config.label}-home-physical-remediation.png`});

  await productRoute(page,'treinos','./src/training-reference-v2.js','renderProductTraining');
  await page.waitForSelector('.ltsTrainingReference');
  await page.evaluate(()=>{const host=document.querySelector('#screenHost');host.scrollTop=host.scrollHeight;});
  await page.waitForTimeout(50);
  const training=await page.evaluate(()=>{
    const host=document.querySelector('#screenHost');
    const nav=document.querySelector('#mobileNav');
    const content=document.querySelector('.ltsTrainingReference');
    const h=host.getBoundingClientRect(),n=nav.getBoundingClientRect(),c=content.getBoundingClientRect();
    return{
      hostBottom:h.bottom,navTop:n.top,lastGap:Math.max(0,h.bottom-c.bottom),
      paddingBottom:parseFloat(getComputedStyle(host).paddingBottom),
      overflow:document.documentElement.scrollWidth-window.innerWidth
    };
  });
  if(training.hostBottom>training.navTop+1)throw new Error(`${config.label}/training: content overlaps navigation`);
  if(training.paddingBottom>30||training.lastGap>32)throw new Error(`${config.label}/training: blank tail remains ${JSON.stringify(training)}`);
  if(training.overflow>3)throw new Error(`${config.label}/training: horizontal overflow ${training.overflow}px`);
  await page.screenshot({path:`${evidenceDir}/${config.label}-training-physical-remediation.png`});

  for(const domain of [
    {route:'bio',modulePath:'./src/composition-layout-v2.js',exportName:'renderProductComposition',selector:'.ltsCompositionV2'},
    {route:'saude',modulePath:'./src/labs-layout-v2.js',exportName:'renderProductLabs',selector:'.ltsLabsV2'}
  ]){
    await productRoute(page,domain.route,domain.modulePath,domain.exportName);
    await page.waitForSelector(domain.selector);
    const layout=await page.evaluate(selector=>{
      const host=document.querySelector('#screenHost');
      const nav=document.querySelector('#mobileNav');
      const root=document.querySelector(selector);
      const h=host.getBoundingClientRect(),n=nav.getBoundingClientRect(),r=root.getBoundingClientRect();
      return{
        hostBottom:h.bottom,navTop:n.top,rootTop:r.top,
        paddingBottom:parseFloat(getComputedStyle(host).paddingBottom),
        overflow:document.documentElement.scrollWidth-window.innerWidth
      };
    },domain.selector);
    if(layout.rootTop<45||layout.rootTop>72)throw new Error(`${config.label}/${domain.route}: header hierarchy starts at ${Math.round(layout.rootTop)}px`);
    if(layout.hostBottom>layout.navTop+1)throw new Error(`${config.label}/${domain.route}: content overlaps navigation`);
    if(layout.paddingBottom>30)throw new Error(`${config.label}/${domain.route}: duplicate bottom reserve ${layout.paddingBottom}px`);
    if(layout.overflow>3)throw new Error(`${config.label}/${domain.route}: horizontal overflow ${layout.overflow}px`);
    await page.screenshot({path:`${evidenceDir}/${config.label}-${domain.route}-physical-remediation.png`});
  }

  if(errors.length)throw new Error(`${config.label}: browser errors ${errors.join(' | ')}`);
  await page.close();
}

await browser.close();
console.log('LTS Health physical iPhone layout smoke passed');
