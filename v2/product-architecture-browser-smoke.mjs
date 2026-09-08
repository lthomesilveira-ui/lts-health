import {chromium} from 'playwright';

const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/?fixture=1';
const number=async(locator,property)=>Number(await locator.evaluate((element,key)=>parseFloat(getComputedStyle(element)[key])||0,property));

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(`${base}#hoje`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-executive-dashboard]');

  if((await page.locator('.cockpitStatus').count())!==5)throw new Error(`${label}: expected five domain summaries`);
  if((await page.locator('.cockpitReviewItem').count())>3)throw new Error(`${label}: overview exposes more than three priorities`);
  const text=(await page.locator('#screenHost').innerText())||'';
  for(const expected of ['Visão geral da sua saúde','Leitura principal','Pontos a revisar','Explore o histórico','Dados conectados'])if(!text.includes(expected))throw new Error(`${label}: missing product hierarchy ${expected}`);
  for(const action of ['Abrir treinos','Abrir nutrição','Abrir composição','Abrir recuperação','Abrir exames','Gerenciar fontes','Abrir Timeline'])if(!text.includes(action))throw new Error(`${label}: missing specific action ${action}`);
  if(text.includes('Ver mais'))throw new Error(`${label}: generic action copy returned`);

  const order=await page.evaluate(()=>{
    const top=selector=>document.querySelector(selector)?.getBoundingClientRect().top??Number.POSITIVE_INFINITY;
    return{decision:top('.cockpitDecisionGrid'),analytics:top('.cockpitAnalyticsGrid')};
  });
  if(!(order.decision<order.analytics))throw new Error(`${label}: evidence modules precede interpretation`);
  if(await number(page.locator('.cockpitStatusText small').first(),'fontSize')<14)throw new Error(`${label}: domain label is too small`);
  if(await number(page.locator('.cockpitInsightHero p').first(),'fontSize')<15)throw new Error(`${label}: main interpretation is too small`);
  if(await number(page.locator('.cockpitButton').first(),'fontSize')<12.5)throw new Error(`${label}: actions are too small`);

  if(label==='desktop'){
    for(const group of ['Acompanhar','Áreas','Contexto','Sistema'])if(!await page.locator('#primaryNav .navGroupLabel',{hasText:group}).isVisible())throw new Error(`desktop: navigation group missing ${group}`);
    if(await page.locator('#primaryNav > [data-route="evolucao"]').count())throw new Error('desktop: Evolução still competes in primary navigation');
    if(await page.locator('#routeAction').isVisible())throw new Error('desktop: duplicate overview action visible in top bar');
  }else{
    if(!await page.locator('#mobileNav').isVisible())throw new Error('mobile: primary mobile navigation is missing');
    const overlap=await page.evaluate(()=>{
      const host=document.querySelector('#screenHost')?.getBoundingClientRect(),nav=document.querySelector('#mobileNav')?.getBoundingClientRect();
      return Boolean(host&&nav&&host.bottom>nav.top+3);
    });
    if(overlap)throw new Error('mobile: navigation overlaps the content viewport');
  }

  await page.locator('[data-period="90"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-executive-dashboard]')?.dataset.period==='90');
  if(await page.locator('button[data-period="90"]').getAttribute('aria-pressed')!=='true')throw new Error(`${label}: period control state did not update`);

  const destinations=[
    ['timeline','Timeline'],
    ['treinos','Treinos'],
    ['bio','Composição corporal'],
    ['nutricao','Nutrição'],
    ['saude','Exames'],
    ['analise','Recuperação & análises'],
    ['tratamentos','Protocolos'],
    ['dados','Dados & fontes'],
    ['evolucao','Evolução detalhada']
  ];
  for(const[route,title]of destinations){
    await page.evaluate(value=>{location.hash=value;},route);
    await page.waitForFunction(expected=>document.querySelector('#screenHost h1')?.textContent===expected,title);
    if(!await page.locator('.domainHeader').isVisible())throw new Error(`${label}/${route}: shared destination header missing`);
    if(!await page.locator('.domainHomeAction').isVisible())throw new Error(`${label}/${route}: return to overview is missing`);
    if(label==='desktop'&&await page.locator('#primaryNav [data-route].active').count()!==1)throw new Error(`desktop/${route}: primary navigation has competing active destinations`);
    const routeOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    if(routeOverflow>3)throw new Error(`${label}/${route}: horizontal overflow ${routeOverflow}px`);
  }
  await page.locator('.domainHomeAction').click();
  await page.waitForSelector('[data-executive-dashboard]');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);

  await page.locator('#logoutBtn').click();
  await page.waitForSelector('#login:not(.hidden)');
  const isolation=await page.evaluate(()=>({appDisplay:getComputedStyle(document.querySelector('#app')).display,loginVisible:document.querySelector('#login')?.classList.contains('hidden')===false}));
  if(isolation.appDisplay!=='none'||!isolation.loginVisible)throw new Error(`${label}: authenticated shell leaks into login`);
  const loginText=(await page.locator('#login').innerText())||'';
  for(const expected of ['Seu histórico de saúde, finalmente em contexto.','Uma linha do tempo','Leitura com evidência','Acesse seu cockpit'])if(!loginText.includes(expected))throw new Error(`${label}: login does not explain the product: ${expected}`);

  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1440,height:1000},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health product architecture browser smoke passed');
