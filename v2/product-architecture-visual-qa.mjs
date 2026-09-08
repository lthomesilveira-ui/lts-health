import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/?fixture=1';
const output=process.env.LTS_HEALTH_VISUAL_OUTPUT||'artifacts/product-architecture';

await fs.mkdir(output,{recursive:true});

async function inspect(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});

  await page.goto(`${base}#hoje`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-executive-dashboard]');
  await page.evaluate(()=>document.fonts?.ready);

  const result=await page.evaluate(label=>{
    const rect=selector=>{
      const value=document.querySelector(selector)?.getBoundingClientRect();
      return value?{top:value.top,bottom:value.bottom,left:value.left,right:value.right,width:value.width,height:value.height}:null;
    };
    const visible=selector=>{
      const element=document.querySelector(selector);
      return Boolean(element&&getComputedStyle(element).display!=='none'&&element.getBoundingClientRect().width>0);
    };
    const status=[...document.querySelectorAll('.cockpitStatus')];
    const colors=status.map(card=>getComputedStyle(card).backgroundColor);
    const canvas=getComputedStyle(document.querySelector('#screenHost')).backgroundColor;
    const rail=document.querySelector('#primaryNav');
    const railColor=rail?getComputedStyle(rail).backgroundColor:null;
    return{
      label,
      statusCount:status.length,
      distinctStatusColors:new Set(colors).size,
      canvas,
      railColor,
      decision:rect('.cockpitDecisionGrid'),
      analytics:rect('.cockpitAnalyticsGrid'),
      trust:rect('.cockpitTrustGrid'),
      rail:rail?rect('#primaryNav'):null,
      desktopNav:visible('#primaryNav'),
      mobileNav:visible('#mobileNav'),
      overflow:document.documentElement.scrollWidth-window.innerWidth
    };
  },label);

  if(result.statusCount!==5)throw new Error(`${label}: expected five domain cards`);
  if(result.distinctStatusColors<4)throw new Error(`${label}: domain color system collapsed`);
  if(!result.decision||!result.analytics||result.decision.top>=result.analytics.top)throw new Error(`${label}: interpretation does not precede analytics`);
  if(!result.trust||result.trust.top<=result.analytics.top)throw new Error(`${label}: trust and sources do not close the overview`);
  if(result.overflow>3)throw new Error(`${label}: horizontal overflow ${result.overflow}px`);

  if(label==='desktop'){
    if(!result.desktopNav||result.mobileNav)throw new Error('desktop: navigation mode is incorrect');
    if(!result.rail||result.rail.width<208||result.rail.width>268)throw new Error(`desktop: rail width ${result.rail?.width??'missing'} is outside the documented range`);
  }else{
    if(result.desktopNav||!result.mobileNav)throw new Error('mobile: navigation mode is incorrect');
  }

  await page.screenshot({path:`${output}/${label}-overview.png`,fullPage:label==='desktop'});
  if(label==='mobile'){
    await page.locator('#screenHost').evaluate(element=>{element.scrollTop=element.scrollHeight;});
    await page.screenshot({path:`${output}/${label}-overview-end.png`});
  }

  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await fs.writeFile(`${output}/${label}-inspection.json`,`${JSON.stringify(result,null,2)}\n`);
  await browser.close();
}

await inspect({width:1536,height:864},'desktop');
await inspect({width:390,height:844},'mobile');
console.log('LTS Health product architecture visual QA passed');
