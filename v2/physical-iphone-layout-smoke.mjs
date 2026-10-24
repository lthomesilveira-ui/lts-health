import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {makeDashboardFixture,FIXED_TODAY} from '../preview/compact-evidence/tests/health-dashboard-render-test.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';

const evidenceDir='v2/public-audit-evidence';
const origin=process.env.LTS_TEST_ORIGIN||'http://127.0.0.1:4173';
mkdirSync(evidenceDir,{recursive:true});
const base=new URL(origin.replace(/\/$/,'')+'/');
assert.equal(base.protocol,'http:');assert.ok(['127.0.0.1','localhost'].includes(base.hostname));assert.ok(['/','/v2/'].includes(base.pathname));assert.equal(base.search,'');assert.equal(base.hash,'');
const fixture=makeDashboardFixture(FIXED_TODAY);
const service=`window.__physicalDb=${JSON.stringify(fixture.db)};window.__physicalWrites=[];
const deny=target=>{window.__physicalWrites.push(target);throw Error('Synthetic physical-layout gate forbids '+target);};
window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-physical-owner'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
functions:{invoke:async(name,args)=>args?.body?.action==='status'?{data:{configured:false,connected:false,received:false},error:null}:deny('invoke '+name)},rpc:()=>deny('rpc'),storage:{from:()=>({upload:()=>deny('upload'),remove:()=>deny('remove')})},
from(table){let from=0,to=999;const filters=[],orders=[];const rows=()=>[...(window.__physicalDb[table]||[])].filter(row=>filters.every(([key,value])=>row[key]===value)).sort((a,b)=>{for(const[key,ascending]of orders){const n=String(a[key]??'').localeCompare(String(b[key]??''));if(n)return ascending?n:-n;}return 0;});
const q={select(){return q;},eq(key,value){filters.push([key,value]);return q;},is(key,value){filters.push([key,value]);return q;},range(a,b){from=a;to=b;return q;},order(key,options={}){orders.push([key,options.ascending!==false]);return q;},limit(n){to=from+n-1;return q;},maybeSingle:async()=>{const r=rows();return r.length>1?{data:null,error:{message:'Multiple rows'}}:{data:r[0]||null,error:null};},then(resolve,reject){return Promise.resolve({data:rows().slice(from,to+1),error:null}).then(resolve,reject);}};
for(const name of ['insert','update','upsert','delete'])q[name]=()=>deny(table+' '+name);return q;}})};`;
const external=[];

const browser=await chromium.launch({headless:true});

async function productRoute(page,route,selector){
  const direct=page.locator(`#mobileNav [data-route="${route}"]`);
  if(await direct.count())await direct.click();else{await page.locator('#mobileNav [data-route="mais"]').click();await page.locator(`#moreSheet [data-route="${route}"]`).click();}
  await page.waitForSelector(selector);
  await page.waitForFunction(route=>document.body.dataset.productRoute===route&&document.querySelector('#screenHost')?.dataset.productLayoutRoute===route,route);
}
async function homeReady(page){await page.waitForFunction(()=>document.querySelector('[data-health-dashboard]')&&document.querySelector('#syncText')?.textContent==='Atualizado'&&document.querySelector('#screenHost')?.dataset.productLayoutRoute==='hoje');}

for(const config of [
  {label:'iphone-full',viewport:{width:393,height:852}},
  {label:'iphone-safari-sheet',viewport:{width:393,height:650}}
]){
  const page=await browser.newPage({viewport:config.viewport,serviceWorkers:'block'});
  await page.clock.setFixedTime(new Date(`${FIXED_TODAY}T15:00:00Z`));
  await page.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.href==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'&&request.method()==='GET')return route.fulfill({contentType:'application/javascript',body:service});if(url.origin===base.origin&&['GET','HEAD'].includes(request.method()))return route.continue();external.push({url:url.href,method:request.method()});return route.abort('blockedbyclient');});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{
    const value=message.text();
    if(message.type()==='error'&&!value.includes('Failed to load resource'))errors.push(value);
  });
  await page.goto(base.href+'#hoje',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');

  await homeReady(page);
  await page.screenshot({path:`${evidenceDir}/${config.label}-home-initial.png`});
  assert.equal(await page.evaluate(async()=>{const {fixtureMode}=await import('./src/core.js');return fixtureMode;}),false,'exercise the actual production renderer');
  const home=await page.evaluate(()=>{
    const rect=selector=>document.querySelector(selector)?.getBoundingClientRect();
    const app=rect('#app'),host=rect('#screenHost'),nav=rect('#mobileNav'),header=rect('.studyHeading'),cards=rect('.healthMetricGrid');
    const hostStyle=getComputedStyle(document.querySelector('#screenHost'));
    return{
      appHeight:app?.height,hostTop:host?.top,hostBottom:host?.bottom,navTop:nav?.top,
      headerTop:header?.top,cardsTop:cards?.top,
      hostPaddingBottom:parseFloat(hostStyle.paddingBottom),
      hostPaddingTop:parseFloat(hostStyle.paddingTop),
      dashboardPaddingTop:parseFloat(getComputedStyle(document.querySelector('[data-health-dashboard]')).paddingTop),
      hostMinHeight:hostStyle.minHeight,
      overflow:document.documentElement.scrollWidth-window.innerWidth
    };
  });
  writeFileSync(`${evidenceDir}/${config.label}-home-geometry.json`,JSON.stringify(home,null,2));
  for(const key of ['hostTop','hostBottom','navTop','headerTop','cardsTop'])assert.ok(Number.isFinite(home[key]),`${config.label}: ${key} must exist`);
  if(home.hostTop>2)throw new Error(`${config.label}/home: hidden topbar still reserves ${Math.round(home.hostTop)}px`);
  // Approved current mobile spacing is 6px of shell inset plus 14px of
  // dashboard padding, not the retired reference Home's <=18px combined gap.
  // These emulated viewports have no hardware safe-area inset.
  assert.equal(home.hostPaddingTop,6,`${config.label}: preserve the compact shell inset`);
  assert.equal(home.dashboardPaddingTop,14,`${config.label}: preserve accepted dashboard spacing`);
  assert.ok(home.headerTop>=19&&home.headerTop<=21,`${config.label}: expected accepted 20px content inset; geometry=${JSON.stringify(home)}`);
  assert.ok(Math.abs(home.headerTop-(home.hostTop+home.hostPaddingTop+home.dashboardPaddingTop))<=1,`${config.label}: no extra hidden margin above the first useful content`);
  if(home.hostBottom>home.navTop+1)throw new Error(`${config.label}/home: content overlaps navigation`);
  if(home.hostPaddingBottom>30)throw new Error(`${config.label}/home: duplicate bottom reserve ${home.hostPaddingBottom}px`);
  if(home.overflow>3)throw new Error(`${config.label}/home: horizontal overflow ${home.overflow}px`);
  if(await page.locator('[data-dashboard-card]:visible').count()!==7||await page.locator('[data-study-domain]:visible').count()!==4)throw new Error(`${config.label}/home: mobile hides analytical content`);
  for(const [kind,keys] of [['data-dashboard-card',['water','protein','energy','activeEnergy','totalEnergy','steps','sleep']],['data-study-domain',['body','training','labs','protocols']]])for(const key of keys){const header=page.locator(`[${kind}="${key}"]>header`);await header.scrollIntoViewIfNeeded();const reachable=await header.evaluate(el=>{const r=el.getBoundingClientRect(),n=document.querySelector('#mobileNav').getBoundingClientRect();return r.height>0&&r.top>=0&&r.bottom<=n.top+1;});if(!reachable)throw new Error(`${config.label}/home: ${key} header cannot be reached above navigation`);}
  const clipped=await page.locator('.healthMetricValue strong,.healthMetricPeriod,.healthCoverage').evaluateAll(nodes=>nodes.filter(node=>node.scrollWidth>node.clientWidth+1).map(node=>node.textContent));assert.deepEqual(clipped,[],'metric value/date/coverage text cannot clip');
  await page.locator('.studyHeading').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${evidenceDir}/${config.label}-home-physical-remediation.png`});

  await productRoute(page,'treinos','.ltsTrainingReference');
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
    {route:'bio',selector:'.ltsCompositionV2'},
    {route:'saude',selector:'.ltsLabsV2'}
  ]){
    await productRoute(page,domain.route,domain.selector);
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

  assert.deepEqual(await page.evaluate(()=>window.__physicalWrites),[],'navigation must not write');
  if(errors.length)throw new Error(`${config.label}: browser errors ${errors.join(' | ')}`);
  await page.close();
}

await browser.close();
assert.deepEqual(external,[],'no external or write network traffic');
console.log('LTS Health emulated iPhone viewport layout passed; no physical device was tested');
