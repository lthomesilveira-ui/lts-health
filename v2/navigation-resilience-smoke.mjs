import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1';
const routeTitles={bio:'Bio',treinos:'Treinos',evolucao:'Evolução',analise:'Análise',tratamentos:'Tratamentos',hoje:'Hoje',timeline:'Timeline',saude:'Saúde',nutricao:'Nutrição',dados:'Dados'};

async function waitRoute(page,route){
  await page.waitForFunction(({route,title})=>location.hash===`#${route}`&&document.querySelector('#screenHost h1')?.textContent?.includes(title),{route,title:routeTitles[route]});
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

  // Browser history must restore actual routes rather than only visual state.
  await clickRoute(page,nav,'treinos');await waitRoute(page,'treinos');
  await clickRoute(page,nav,'evolucao');await waitRoute(page,'evolucao');
  await page.goBack();await waitRoute(page,'treinos');
  await page.goForward();await waitRoute(page,'evolucao');

  // Route persistence must survive a reload even when the hash is removed.
  await clickRoute(page,nav,'dados');await waitRoute(page,'dados');
  await page.evaluate(()=>history.replaceState(null,'',location.pathname+location.search));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');
  const restoredHash=await page.evaluate(()=>location.hash);
  if(restoredHash!=='#dados')throw new Error(`${label}: saved route was not restored after reload (${restoredHash||'sem hash'})`);

  // Entry dialog must focus its contents, close with Escape and return focus to its trigger.
  await clickRoute(page,nav,'bio');await waitRoute(page,'bio');
  await page.locator('#routeAction').click();
  await page.waitForSelector('#entryModal:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#entryModal')?.contains(document.activeElement));
  await page.keyboard.press('Escape');
  await waitHidden(page,'#entryModal');
  await page.waitForFunction(()=>document.activeElement?.id==='routeAction');
  await waitRoute(page,'bio');

  // Workout entry still closes through its explicit close button and restores focus.
  await clickRoute(page,nav,'treinos');await waitRoute(page,'treinos');
  await page.locator('#routeAction').click();
  await page.waitForSelector('#entryModal:not(.hidden)');
  await page.locator('#closeEntry').click();
  await waitHidden(page,'#entryModal');
  await page.waitForFunction(()=>document.activeElement?.id==='routeAction');
  await waitRoute(page,'treinos');

  // More sheet must focus its contents, close with Escape and restore focus without route changes.
  const moreSelector=`${nav} [data-route="mais"]`;
  await page.locator(moreSelector).click();
  await page.waitForSelector('#moreSheet:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#moreSheet')?.contains(document.activeElement));
  await page.keyboard.press('Escape');
  await waitHidden(page,'#moreSheet');
  await page.waitForFunction(sel=>document.activeElement===document.querySelector(sel),moreSelector);
  await waitRoute(page,'treinos');

  // System reduced-motion preference must disable the spinner animation in the rendered CSS.
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
