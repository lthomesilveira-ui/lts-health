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
async function assertReadableTheme(page,label){
  const result=await page.evaluate(()=>{
    const parse=value=>{
      const match=value.match(/[\d.]+/g);
      return match?.slice(0,3).map(Number)??[];
    };
    const luminance=rgb=>{
      const linear=rgb.map(value=>{
        const channel=value/255;
        return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;
      });
      return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
    };
    const contrast=(foreground,background)=>{
      const light=Math.max(luminance(foreground),luminance(background));
      const dark=Math.min(luminance(foreground),luminance(background));
      return (light+.05)/(dark+.05);
    };
    const surfaceSelectors=['.domainHero','.domainStatStrip>.metric','.uxDisclosure'];
    const textPairs=[
      ['.domainHero h2','.domainHero'],
      ['.domainHero p','.domainHero'],
      ['.domainStatStrip>.metric strong','.domainStatStrip>.metric'],
      ['.domainStatStrip>.metric em','.domainStatStrip>.metric'],
      ['.uxDisclosure>summary b','.uxDisclosure'],
      ['.uxDisclosure>summary small','.uxDisclosure']
    ];
    const surfaces=surfaceSelectors.flatMap(selector=>{
      const node=document.querySelector(selector);
      if(!node)return [`missing ${selector}`];
      const background=parse(getComputedStyle(node).backgroundColor);
      return background.length===3&&luminance(background)>=.78?[]:[`${selector} is not a light surface (${getComputedStyle(node).backgroundColor})`];
    });
    const text=textPairs.flatMap(([textSelector,surfaceSelector])=>{
      const node=document.querySelector(textSelector),surface=document.querySelector(surfaceSelector);
      if(!node||!surface)return [`missing ${textSelector}`];
      const foreground=parse(getComputedStyle(node).color),background=parse(getComputedStyle(surface).backgroundColor);
      if(foreground.length!==3||background.length!==3)return [`could not parse colors for ${textSelector}`];
      const ratio=contrast(foreground,background);
      return ratio>=4.5?[]:[`${textSelector} contrast ${ratio.toFixed(2)}:1`];
    });
    return [...surfaces,...text];
  });
  if(result.length)throw new Error(`${label}: ${result.join(' | ')}`);
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
  await assertClosedDetails(page,2,`${label}/treinos`);await assertNoMechanicalCopy(page,`${label}/treinos`);await assertLayout(page,`${label}/treinos`);await assertReadableTheme(page,`${label}/treinos`);
  if(label==='mobile'){
    const strip=await page.locator('.domainStatStrip').evaluate(node=>({client:node.clientWidth,scroll:node.scrollWidth}));
    if(strip.scroll<=strip.client)throw new Error('mobile/treinos: summary does not use a horizontal rail');
    const controlHeight=await page.locator('#trainingPeriod').evaluate(node=>node.getBoundingClientRect().height);
    if(controlHeight<44)throw new Error(`mobile/treinos: period control is ${controlHeight}px high`);
  }
  await page.screenshot({path:`${output}/${label}-training.png`,fullPage:false});
  await page.locator('details.uxDisclosure summary').first().click();
  if(!await page.locator('details.uxDisclosure').first().evaluate(node=>node.open))throw new Error(`${label}/treinos: progressive section did not open`);
  const exerciseDisclosure=page.locator('details.uxDisclosure').filter({hasText:'Evolução por exercício'});
  await exerciseDisclosure.locator('summary').click();
  await page.fill('#exerciseQuery','supino');
  await page.waitForFunction(()=>{
    const input=document.querySelector('#exerciseQuery');
    const buttons=[...document.querySelectorAll('.exerciseList button')];
    return input?.value==='supino'
      && document.activeElement===input
      && buttons.length>0
      && buttons.every(button=>button.textContent?.toLowerCase().includes('supino'));
  });
  if(!await exerciseDisclosure.evaluate(node=>node.open))throw new Error(`${label}/treinos: progressive section closed while filtering`);
  if(await page.locator('#exerciseQuery').evaluate(node=>document.activeElement!==node))throw new Error(`${label}/treinos: search focus was lost while filtering`);

  await openRoute(page,'nutricao','Nutrição');
  if(await page.locator('#nutritionPeriod').inputValue()!=='90')throw new Error(`${label}/nutricao: global period was lost`);
  if(!(await page.locator('.domainHero h2').innerText()).includes('2 dias registrados'))throw new Error(`${label}/nutricao: expected fixture days in the shared window`);
  await assertClosedDetails(page,2,`${label}/nutricao`);await assertNoMechanicalCopy(page,`${label}/nutricao`);await assertLayout(page,`${label}/nutricao`);await assertReadableTheme(page,`${label}/nutricao`);
  await page.screenshot({path:`${output}/${label}-nutrition.png`,fullPage:false});

  await openRoute(page,'bio','Composição corporal');
  await assertClosedDetails(page,2,`${label}/bio`);await assertNoMechanicalCopy(page,`${label}/bio`);await assertLayout(page,`${label}/bio`);await assertReadableTheme(page,`${label}/bio`);
  if(await page.locator('.domainChartCard').count()!==1)throw new Error(`${label}/bio: expected one primary chart surface`);
  await page.screenshot({path:`${output}/${label}-composition.png`,fullPage:false});

  await openRoute(page,'saude','Exames');
  await assertClosedDetails(page,3,`${label}/saude`);await assertNoMechanicalCopy(page,`${label}/saude`);await assertLayout(page,`${label}/saude`);await assertReadableTheme(page,`${label}/saude`);
  if(await page.locator('.domainChartCard').count()!==1)throw new Error(`${label}/saude: expected one primary explorer`);
  await page.screenshot({path:`${output}/${label}-labs.png`,fullPage:false});

  await openRoute(page,'analise','Recuperação & análises');
  if(await page.locator('#analysisPeriod').inputValue()!=='90')throw new Error(`${label}/analise: global period was lost`);
  await assertClosedDetails(page,1,`${label}/analise`);await assertNoMechanicalCopy(page,`${label}/analise`);await assertLayout(page,`${label}/analise`);await assertReadableTheme(page,`${label}/analise`);
  await page.locator('#analysisPeriod').selectOption('30');
  await openRoute(page,'treinos','Treinos');
  if(await page.locator('#trainingPeriod').inputValue()!=='30')throw new Error(`${label}: period selected in Analysis did not reach Training`);

  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1440,height:1000},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health UX coherence browser smoke passed');
