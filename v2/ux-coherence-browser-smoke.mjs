import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/?fixture=1';
const output=process.env.LTS_HEALTH_UX_OUTPUT||'artifacts/ux-coherence';
await fs.mkdir(output,{recursive:true});

async function openRoute(page,route,title){
  await page.evaluate(value=>{location.hash=value;},route);
  await page.waitForFunction(expected=>document.querySelector('#screenHost h1')?.textContent===expected,title);
  await page.waitForSelector('.domainHero');
}
async function assertNoMechanicalCopy(page,label){
  const text=await page.locator('#screenHost').innerText();
  for(const token of ['sessão(ões)','dia(s)','resultado(s)','origem(ns)','medição(ões)','registro(s)','item(ns)'])if(text.includes(token))throw new Error(`${label}: mechanical copy ${token}`);
}
async function assertLayout(page,label){
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-window.innerWidth,height:document.documentElement.scrollHeight,heroTop:document.querySelector('.domainHero')?.getBoundingClientRect().top??9999}));
  if(layout.overflow>3)throw new Error(`${label}: horizontal overflow ${layout.overflow}px`);
  if(layout.heroTop>340)throw new Error(`${label}: primary answer starts too low (${layout.heroTop}px)`);
  return layout;
}
async function assertClosedDetails(page,count,label){
  const details=page.locator('details.uxDisclosure');
  if(await details.count()!==count)throw new Error(`${label}: expected ${count} progressive sections`);
  if(await details.evaluateAll(nodes=>nodes.filter(node=>node.open).length)!==0)throw new Error(`${label}: secondary sections start expanded`);
}

async function run(viewport,label){
  const browser=await chromium.launch({headless:true,...(process.env.LTS_CHROMIUM_PATH?{executablePath:process.env.LTS_CHROMIUM_PATH}:{})});
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(`${base}#hoje`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-executive-dashboard]');
  await page.locator('button[data-period="90"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-executive-dashboard]')?.dataset.period==='90');

  await openRoute(page,'treinos','Treinos');
  if(await page.locator('#trainingPeriod').inputValue()!=='90')throw new Error(`${label}/treinos: global period was lost`);
  if(!(await page.locator('.domainHero h2').innerText()).includes('2 sessões registradas'))throw new Error(`${label}/treinos: expected fixture sessions in the shared window`);
  await assertClosedDetails(page,2,`${label}/treinos`);await assertNoMechanicalCopy(page,`${label}/treinos`);await assertLayout(page,`${label}/treinos`);
  if(label==='mobile'){
    const strip=await page.locator('.domainStatStrip').evaluate(node=>({client:node.clientWidth,scroll:node.scrollWidth}));
    if(strip.scroll<=strip.client)throw new Error('mobile/treinos: summary does not use a horizontal rail');
    const controlHeight=await page.locator('#trainingPeriod').evaluate(node=>node.getBoundingClientRect().height);
    if(controlHeight<44)throw new Error(`mobile/treinos: period control is ${controlHeight}px high`);
  }
  await page.screenshot({path:`${output}/${label}-training.png`,fullPage:false});
  await page.locator('details.uxDisclosure summary').first().click();
  if(!await page.locator('details.uxDisclosure').first().evaluate(node=>node.open))throw new Error(`${label}/treinos: progressive section did not open`);

  await openRoute(page,'nutricao','Nutrição');
  if(await page.locator('#nutritionPeriod').inputValue()!=='90')throw new Error(`${label}/nutricao: global period was lost`);
  if(!(await page.locator('.domainHero h2').innerText()).includes('2 dias registrados'))throw new Error(`${label}/nutricao: expected fixture days in the shared window`);
  await assertClosedDetails(page,2,`${label}/nutricao`);await assertNoMechanicalCopy(page,`${label}/nutricao`);await assertLayout(page,`${label}/nutricao`);
  await page.screenshot({path:`${output}/${label}-nutrition.png`,fullPage:false});

  await openRoute(page,'bio','Composição corporal');
  await assertClosedDetails(page,2,`${label}/bio`);await assertNoMechanicalCopy(page,`${label}/bio`);await assertLayout(page,`${label}/bio`);
  if(await page.locator('.domainChartCard').count()!==1)throw new Error(`${label}/bio: expected one primary chart surface`);
  await page.screenshot({path:`${output}/${label}-composition.png`,fullPage:false});

  await openRoute(page,'saude','Exames');
  await assertClosedDetails(page,3,`${label}/saude`);await assertNoMechanicalCopy(page,`${label}/saude`);await assertLayout(page,`${label}/saude`);
  if(await page.locator('.domainChartCard').count()!==1)throw new Error(`${label}/saude: expected one primary explorer`);
  await page.screenshot({path:`${output}/${label}-labs.png`,fullPage:false});

  await openRoute(page,'analise','Recuperação & análises');
  if(await page.locator('#analysisPeriod').inputValue()!=='90')throw new Error(`${label}/analise: global period was lost`);
  await assertClosedDetails(page,1,`${label}/analise`);await assertNoMechanicalCopy(page,`${label}/analise`);await assertLayout(page,`${label}/analise`);
  await page.locator('#analysisPeriod').selectOption('30');
  await openRoute(page,'treinos','Treinos');
  if(await page.locator('#trainingPeriod').inputValue()!=='30')throw new Error(`${label}: period selected in Analysis did not reach Training`);

  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1440,height:1000},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health UX coherence browser smoke passed');
