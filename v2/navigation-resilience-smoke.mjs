import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1';
const routeTitles={bio:'Composição corporal',treinos:'Treinos',evolucao:'Evolução',analise:'Insights',tratamentos:'Tratamentos',timeline:'Timeline',saude:'Saúde',nutricao:'Nutrição',dados:'Dados'};
const focusableSelector='button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

async function waitRoute(page,route){
  await page.waitForFunction(({route,title})=>{
    if(location.hash!==`#${route}`)return false;
    if(route==='hoje')return!!document.querySelector('[data-executive-dashboard]');
    return document.querySelector('#screenHost h1')?.textContent?.includes(title);
  },{route,title:routeTitles[route]||''});
}

async function assertViewport(page,label,route){
  const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-window.innerWidth,appHidden:document.querySelector('#app')?.classList.contains('hidden'),loginVisible:!document.querySelector('#login')?.classList.contains('hidden')}));
  if(result.overflow>3)throw new Error(`${label}/${route}: horizontal overflow ${result.overflow}px`);
  if(result.appHidden||result.loginVisible)throw new Error(`${label}/${route}: authenticated fixture shell not visible`);
}

async function clickRoute(page,nav,route){
  const direct=page.locator(`${nav} [data-route="${route}"]`);
  if(await direct.count()){await direct.click();return;}
  await page.locator(`${nav} [data-route="mais"]`).click();
  await page.waitForSelector('#moreSheet:not(.hidden)');
  await page.locator(`#moreSheet [data-route="${route}"]`).click();
}

async function waitHidden(page,selector){
  await page.waitForFunction(sel=>document.querySelector(sel)?.classList.contains('hidden')===true,selector);
}

async function assertModalIsolation(page,id,label){
  await page.waitForFunction(id=>{
    const dialog=document.getElementById(id),app=document.getElementById('app');
    return !!dialog&&!dialog.classList.contains('hidden')&&dialog.contains(document.activeElement)&&app?.inert===true&&app.getAttribute('aria-hidden')==='true';
  },id);
  const count=await page.evaluate(({id,focusableSelector})=>[...document.getElementById(id).querySelectorAll(focusableSelector)].filter(el=>el.tabIndex>=0&&!el.hasAttribute('hidden')&&!el.closest('[hidden]')).length,{id,focusableSelector});
  if(count<1)throw new Error(`${label}/${id}: dialog has no focusable controls`);

  await page.evaluate(({id,focusableSelector})=>{
    const items=[...document.getElementById(id).querySelectorAll(focusableSelector)].filter(el=>el.tabIndex>=0&&!el.hasAttribute('hidden')&&!el.closest('[hidden]'));
    items.at(-1)?.focus();
  },{id,focusableSelector});
  await page.keyboard.press('Tab');
  await page.waitForFunction(({id,focusableSelector})=>{
    const items=[...document.getElementById(id).querySelectorAll(focusableSelector)].filter(el=>el.tabIndex>=0&&!el.hasAttribute('hidden')&&!el.closest('[hidden]'));
    return document.activeElement===items[0];
  },{id,focusableSelector});

  await page.evaluate(({id,focusableSelector})=>{
    const items=[...document.getElementById(id).querySelectorAll(focusableSelector)].filter(el=>el.tabIndex>=0&&!el.hasAttribute('hidden')&&!el.closest('[hidden]'));
    items[0]?.focus();
  },{id,focusableSelector});
  await page.keyboard.press('Shift+Tab');
  await page.waitForFunction(({id,focusableSelector})=>{
    const items=[...document.getElementById(id).querySelectorAll(focusableSelector)].filter(el=>el.tabIndex>=0&&!el.hasAttribute('hidden')&&!el.closest('[hidden]'));
    return document.activeElement===items.at(-1);
  },{id,focusableSelector});
}

async function assertIsolationReleased(page,label){
  const result=await page.evaluate(()=>({inert:document.getElementById('app')?.inert===true,ariaHidden:document.getElementById('app')?.getAttribute('aria-hidden')}));
  if(result.inert||result.ariaHidden!==null)throw new Error(`${label}: app remained isolated after dialog closed`);
}

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${base}#bio`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await waitRoute(page,'bio');
  const nav=viewport.width<720?'#mobileNav':'#primaryNav';

  for(const route of ['treinos','evolucao','analise','hoje','timeline','saude','nutricao','dados','tratamentos','bio']){
    await clickRoute(page,nav,route);
    await waitRoute(page,route);
    await assertViewport(page,label,route);
  }

  await clickRoute(page,nav,'treinos');await waitRoute(page,'treinos');
  await clickRoute(page,nav,'evolucao');await waitRoute(page,'evolucao');
  await page.goBack();await waitRoute(page,'treinos');
  await page.goForward();await waitRoute(page,'evolucao');

  await clickRoute(page,nav,'dados');await waitRoute(page,'dados');
  await page.evaluate(()=>history.replaceState(null,'',location.pathname+location.search));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');
  const restoredHash=await page.evaluate(()=>location.hash);
  if(restoredHash!=='#dados')throw new Error(`${label}: saved route was not restored after reload (${restoredHash||'sem hash'})`);

  await clickRoute(page,nav,'bio');await waitRoute(page,'bio');
  await page.locator('#routeAction').click();
  await page.waitForSelector('#entryModal:not(.hidden)');
  await assertModalIsolation(page,'entryModal',label);
  await page.keyboard.press('Escape');
  await waitHidden(page,'#entryModal');
  await page.waitForFunction(()=>document.activeElement?.id==='routeAction');
  await assertIsolationReleased(page,`${label}/entry-escape`);
  await waitRoute(page,'bio');

  await clickRoute(page,nav,'treinos');await waitRoute(page,'treinos');
  await page.locator('#routeAction').click();
  await page.waitForSelector('#entryModal:not(.hidden)');
  await assertModalIsolation(page,'entryModal',label);
  await page.locator('#closeEntry').click();
  await waitHidden(page,'#entryModal');
  await page.waitForFunction(()=>document.activeElement?.id==='routeAction');
  await assertIsolationReleased(page,`${label}/entry-close`);
  await waitRoute(page,'treinos');

  const moreSelector=`${nav} [data-route="mais"]`;
  await page.locator(moreSelector).click();
  await page.waitForSelector('#moreSheet:not(.hidden)');
  await assertModalIsolation(page,'moreSheet',label);
  await page.keyboard.press('Escape');
  await waitHidden(page,'#moreSheet');
  await page.waitForFunction(sel=>document.activeElement===document.querySelector(sel),moreSelector);
  await assertIsolationReleased(page,`${label}/more-escape`);
  await waitRoute(page,'treinos');

  await page.locator(moreSelector).click();
  await page.waitForSelector('#moreSheet:not(.hidden)');
  await assertModalIsolation(page,'moreSheet',label);
  await page.locator('#moreSheet [data-route="timeline"]').click();
  await waitHidden(page,'#moreSheet');
  await waitRoute(page,'timeline');
  await page.waitForFunction(()=>document.getElementById('app')?.inert===false&&document.getElementById('app')?.getAttribute('aria-hidden')===null);
  await assertIsolationReleased(page,`${label}/more-route`);

  await page.emulateMedia({reducedMotion:'reduce'});
  const reduced=await page.evaluate(()=>{
    const probe=document.createElement('div');probe.className='spinner';document.body.appendChild(probe);
    const style=getComputedStyle(probe);const result={name:style.animationName,duration:style.animationDuration};probe.remove();return result;
  });
  if(reduced.name!=='none')throw new Error(`${label}: reduced motion still animates spinner (${reduced.name}/${reduced.duration})`);

  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
await run({width:320,height:740},'compact-mobile');
console.log('LTS Health v2 navigation resilience smoke passed');