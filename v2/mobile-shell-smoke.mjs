import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});

await page.goto('http://127.0.0.1:4173/?fixture=1#bio',{waitUntil:'domcontentloaded'});
await page.waitForSelector('#app:not(.hidden)');
await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Composição corporal');

const layout=await page.evaluate(()=>{
  const app=document.querySelector('#app').getBoundingClientRect();
  const host=document.querySelector('#screenHost').getBoundingClientRect();
  const nav=document.querySelector('#mobileNav').getBoundingClientRect();
  const topbar=document.querySelector('.topbar').getBoundingClientRect();
  const style=getComputedStyle(document.querySelector('#mobileNav'));
  const metrics=[...document.querySelectorAll('#screenHost>.grid.cols4 .card.metric')].slice(0,4).map(el=>el.getBoundingClientRect());
  return {
    appTop:app.top,appBottom:app.bottom,
    hostTop:host.top,hostBottom:host.bottom,
    navTop:nav.top,navBottom:nav.bottom,
    topbarHeight:topbar.height,
    navPosition:style.position,
    overflow:document.documentElement.scrollWidth-window.innerWidth,
    metricRects:metrics.map(r=>({top:r.top,left:r.left,width:r.width,height:r.height}))
  };
});

if(layout.navPosition==='fixed')throw new Error('mobile nav still overlays the scrolling content');
if(layout.hostBottom>layout.navTop+1)throw new Error(`mobile content overlaps nav by ${Math.round(layout.hostBottom-layout.navTop)}px`);
if(layout.navBottom>layout.appBottom+1)throw new Error('mobile nav exceeds app viewport');
if(layout.overflow>3)throw new Error(`horizontal overflow ${layout.overflow}px`);
if(layout.topbarHeight>62)throw new Error(`mobile header is too tall: ${Math.round(layout.topbarHeight)}px`);
if(layout.metricRects.length===4){
  const [a,b,c]=layout.metricRects;
  if(Math.abs(a.top-b.top)>2)throw new Error('first two composition metrics are not on the same mobile row');
  if(c.top<=a.top+2)throw new Error('composition metrics did not form a compact 2x2 mobile grid');
  if(a.width<130||b.width<130)throw new Error('composition metric cards became too narrow on mobile');
}

await page.evaluate(()=>{const host=document.querySelector('#screenHost');host.scrollTop=host.scrollHeight;});
await page.waitForTimeout(100);
const bottom=await page.evaluate(()=>{
  const host=document.querySelector('#screenHost');
  const nav=document.querySelector('#mobileNav');
  const last=host.lastElementChild;
  const hostRect=host.getBoundingClientRect();
  const navRect=nav.getBoundingClientRect();
  const lastRect=last?.getBoundingClientRect();
  return {hostBottom:hostRect.bottom,navTop:navRect.top,lastBottom:lastRect?.bottom??hostRect.bottom};
});
if(bottom.hostBottom>bottom.navTop+1)throw new Error('scroll viewport overlaps mobile nav');
if(bottom.lastBottom>bottom.hostBottom+1)throw new Error('last content cannot scroll fully above the navigation');

async function openMobileRoute(route){
  const direct=page.locator(`#mobileNav [data-route="${route}"]`);
  if(await direct.count()){
    await direct.click();
  }else{
    await page.locator('#mobileNav [data-route="mais"]').click();
    await page.waitForSelector('#moreSheet:not(.hidden)');
    await page.locator(`#moreSheet [data-route="${route}"]`).click();
    await page.waitForFunction(()=>document.querySelector('#moreSheet')?.classList.contains('hidden')===true);
  }
  await page.waitForFunction(r=>location.hash===`#${r}`,route);
  const overlap=await page.evaluate(()=>document.querySelector('#screenHost').getBoundingClientRect().bottom-document.querySelector('#mobileNav').getBoundingClientRect().top);
  if(overlap>1)throw new Error(`${route}: navigation overlaps content by ${Math.round(overlap)}px`);
}

for(const route of ['treinos','evolucao','analise'])await openMobileRoute(route);

if(errors.length)throw new Error(`page errors: ${errors.join(' | ')}`);
await browser.close();
console.log('LTS Health mobile shell smoke passed');
