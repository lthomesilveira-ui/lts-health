import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/?fixture=1';
const output=process.env.LTS_HEALTH_UX_OUTPUT||'artifacts/ux-coherence';
const ignoreExternalNetwork=process.env.LTS_IGNORE_EXTERNAL_NETWORK==='1';
const visualEvidence=[];
const launchOptions={headless:true,...(process.env.LTS_CHROMIUM_PATH?{executablePath:process.env.LTS_CHROMIUM_PATH}:{})};
await fs.mkdir(output,{recursive:true});

async function openRoute(page,route,title){
  await page.evaluate(value=>{location.hash=value;},route);
  await page.waitForFunction(expected=>document.querySelector('#screenHost h1')?.textContent===expected,title);
  await page.waitForSelector('.domainHero');
  await page.waitForFunction(()=>window.scrollY<=1&&(document.querySelector('#screenHost')?.scrollTop??999)>-1&&(document.querySelector('#screenHost')?.scrollTop??999)<=1);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.waitForTimeout(260);
  await page.waitForFunction(expected=>document.querySelector('#screenHost h1')?.textContent===expected&&window.scrollY<=1&&(document.querySelector('#screenHost')?.scrollTop??999)<=1,title);
}
async function assertNoMechanicalCopy(page,label){
  const text=await page.locator('#screenHost').innerText();
  for(const token of ['sessão(ões)','dia(s)','resultado(s)','origem(ns)','medição(ões)','registro(s)','item(ns)'])if(text.includes(token))throw new Error(`${label}: mechanical copy ${token}`);
}
async function assertLayout(page,label){
  const layout=await page.evaluate(()=>{
    const header=document.querySelector('.topbar')?.getBoundingClientRect();
    const host=document.querySelector('#screenHost')?.getBoundingClientRect();
    const screenTitle=document.querySelector('#screenHost .screenTitle')?.getBoundingClientRect();
    const eyebrowNode=document.querySelector('#screenHost .screenEyebrow');
    const eyebrow=eyebrowNode?.getBoundingClientRect();
    const hit=eyebrow?document.elementFromPoint(eyebrow.left+Math.min(4,eyebrow.width/2),eyebrow.top+eyebrow.height/2):null;
    return{overflow:document.documentElement.scrollWidth-window.innerWidth,height:document.documentElement.scrollHeight,windowScroll:window.scrollY,heroTop:document.querySelector('.domainHero')?.getBoundingClientRect().top??9999,hostScroll:document.querySelector('#screenHost')?.scrollTop??-1,hostTop:host?.top??9999,headerBottom:header?.bottom??0,titleTop:screenTitle?.top??9999,eyebrowTop:eyebrow?.top??9999,eyebrowHeight:eyebrow?.height??0,eyebrowText:String(eyebrowNode?.textContent||'').trim(),eyebrowHit:Boolean(eyebrowNode&&(hit===eyebrowNode||eyebrowNode.contains(hit)))};
  });
  if(layout.overflow>3)throw new Error(`${label}: horizontal overflow ${layout.overflow}px`);
  if(layout.windowScroll>1)throw new Error(`${label}: window retained ${layout.windowScroll}px of scroll`);
  if(layout.hostScroll>1)throw new Error(`${label}: route retained ${layout.hostScroll}px of scroll`);
  if(!layout.eyebrowText||layout.eyebrowHeight<10)throw new Error(`${label}: section eyebrow is not visible`);
  if(label.startsWith('mobile/')&&Math.abs(layout.hostTop-layout.headerBottom)>1)throw new Error(`${label}: content starts at ${layout.hostTop.toFixed(1)}px but header ends at ${layout.headerBottom.toFixed(1)}px`);
  if(label.startsWith('mobile/')&&!layout.eyebrowHit)throw new Error(`${label}: section eyebrow is covered by another layer`);
  if(label.startsWith('mobile/')&&layout.titleTop<layout.hostTop+8)throw new Error(`${label}: title starts above the content area by ${(layout.hostTop+8-layout.titleTop).toFixed(1)}px`);
  if(label.startsWith('mobile/')&&(layout.eyebrowTop<layout.hostTop+8||layout.eyebrowTop>layout.hostTop+34))throw new Error(`${label}: section eyebrow starts outside the expected route header band (${layout.eyebrowTop.toFixed(1)}px, host ${layout.hostTop.toFixed(1)}px)`);
  if(layout.heroTop>340)throw new Error(`${label}: primary answer starts too low (${layout.heroTop}px)`);
  return layout;
}

async function captureFreshRoute(viewport,label,route,title,file){
  const browser=await chromium.launch(launchOptions);
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  try{
    await page.goto(`${base}#hoje`,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('[data-executive-dashboard]');
    await page.locator('button[data-period="90"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-executive-dashboard]')?.dataset.period==='90');
    await openRoute(page,route,title);
    const before=await assertLayout(page,`${label}/${route}/capture-before`);
    await page.screenshot({path:`${output}/${file}`,fullPage:false});
    await page.waitForTimeout(120);
    const after=await assertLayout(page,`${label}/${route}/capture-after`);
    visualEvidence.push({label,route,title,before,after});
  }finally{await browser.close();}
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
  const browser=await chromium.launch(launchOptions);
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{const text=message.text();if(message.type()==='error'&&!(ignoreExternalNetwork&&text.includes('Failed to load resource')))errors.push(text);});
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
    const shell=await page.evaluate(()=>{
      const host=document.querySelector('#screenHost'),nav=document.querySelector('#mobileNav'),style=host?getComputedStyle(host):null;
      return{hostOverflowY:style?.overflowY,hostBottom:host?.getBoundingClientRect().bottom??0,navTop:nav?.getBoundingClientRect().top??0,navPosition:nav?getComputedStyle(nav).position:''};
    });
    if(!['auto','scroll'].includes(shell.hostOverflowY))throw new Error(`mobile/treinos: content area is not scrollable (${shell.hostOverflowY})`);
    if(shell.hostBottom>shell.navTop+1)throw new Error(`mobile/treinos: navigation overlaps content area by ${(shell.hostBottom-shell.navTop).toFixed(1)}px`);
    if(shell.navPosition==='fixed')throw new Error('mobile/treinos: navigation escaped the application grid');
  }
  await captureFreshRoute(viewport,label,'treinos','Treinos',`${label}-training.png`);
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
  await captureFreshRoute(viewport,label,'nutricao','Nutrição',`${label}-nutrition.png`);

  await openRoute(page,'bio','Composição corporal');
  await assertClosedDetails(page,2,`${label}/bio`);await assertNoMechanicalCopy(page,`${label}/bio`);await assertLayout(page,`${label}/bio`);await assertReadableTheme(page,`${label}/bio`);
  if(await page.locator('.domainChartCard').count()!==1)throw new Error(`${label}/bio: expected one primary chart surface`);
  await captureFreshRoute(viewport,label,'bio','Composição corporal',`${label}-composition.png`);

  await openRoute(page,'saude','Exames');
  await assertClosedDetails(page,3,`${label}/saude`);await assertNoMechanicalCopy(page,`${label}/saude`);await assertLayout(page,`${label}/saude`);await assertReadableTheme(page,`${label}/saude`);
  if(await page.locator('.domainChartCard').count()!==1)throw new Error(`${label}/saude: expected one primary explorer`);
  await captureFreshRoute(viewport,label,'saude','Exames',`${label}-labs.png`);

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
await fs.writeFile(`${output}/layout-evidence.json`,JSON.stringify(visualEvidence,null,2));
console.log('LTS Health UX coherence browser smoke passed');
