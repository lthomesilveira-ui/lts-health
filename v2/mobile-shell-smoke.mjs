import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});

await page.goto('http://127.0.0.1:4173/?fixture=1',{waitUntil:'domcontentloaded'});
await page.waitForSelector('#app:not(.hidden)');
await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Bio');

const layout=await page.evaluate(()=>{
  const app=document.querySelector('#app').getBoundingClientRect();
  const host=document.querySelector('#screenHost').getBoundingClientRect();
  const nav=document.querySelector('#mobileNav').getBoundingClientRect();
  const style=getComputedStyle(document.querySelector('#mobileNav'));
  return {
    appTop:app.top,appBottom:app.bottom,
    hostTop:host.top,hostBottom:host.bottom,
    navTop:nav.top,navBottom:nav.bottom,
    navPosition:style.position,
    overflow:document.documentElement.scrollWidth-window.innerWidth
  };
});

if(layout.navPosition==='fixed')throw new Error('mobile nav still overlays the scrolling content');
if(layout.hostBottom>layout.navTop+1)throw new Error(`mobile content overlaps nav by ${Math.round(layout.hostBottom-layout.navTop)}px`);
if(layout.navBottom>layout.appBottom+1)throw new Error('mobile nav exceeds app viewport');
if(layout.overflow>3)throw new Error(`horizontal overflow ${layout.overflow}px`);

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

for(const route of ['treinos','evolucao','analise']){
  await page.click(`#mobileNav [data-route="${route}"]`);
  await page.waitForFunction(r=>location.hash===`#${r}`,route);
  const overlap=await page.evaluate(()=>document.querySelector('#screenHost').getBoundingClientRect().bottom-document.querySelector('#mobileNav').getBoundingClientRect().top);
  if(overlap>1)throw new Error(`${route}: navigation overlaps content by ${Math.round(overlap)}px`);
}

if(errors.length)throw new Error(`page errors: ${errors.join(' | ')}`);
await browser.close();
console.log('LTS Health mobile shell smoke passed');
