import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const tokenHash=readFileSync('/tmp/lts-health-token-hash','utf8').trim();
if(!tokenHash)throw new Error('authenticated token hash missing');

const coreSource=readFileSync(new URL('./src/core.js',import.meta.url),'utf8');
const supabaseUrl=/url:\s*'([^']+)'/.exec(coreSource)?.[1];
const supabaseKey=/key:\s*'([^']+)'/.exec(coreSource)?.[1];
if(!supabaseUrl||!supabaseKey)throw new Error('public Supabase configuration not resolved');

const appUrl='https://lthomesilveira-ui.github.io/lts-health/v2/';
let runtimeErrorCount=0;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
page.on('pageerror',()=>runtimeErrorCount++);
page.on('console',message=>{if(message.type()==='error')runtimeErrorCount++;});

async function waitForRoute(route){
  await page.evaluate(value=>{location.hash=`#${value}`;},route);
  await page.waitForFunction(value=>location.hash===`#${value}`&&Boolean(document.querySelector('#screenHost h1')),route,{timeout:30000});
  await page.waitForTimeout(150);
}

async function assertNoHorizontalOverflow(){
  const ok=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
  if(!ok)throw new Error('real-data route overflow detected');
}

try{
  await page.goto(`${appUrl}#hoje`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>Boolean(window.supabase?.createClient),null,{timeout:20000});

  const sessionResult=await page.evaluate(async ({url,key,tokenHash})=>{
    const client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    const {data,error}=await client.auth.verifyOtp({token_hash:tokenHash,type:'email'});
    return{ok:!error&&Boolean(data?.session?.user)};
  },{url:supabaseUrl,key:supabaseKey,tokenHash});
  if(!sessionResult.ok)throw new Error('real authenticated session could not be established');
  await page.reload({waitUntil:'domcontentloaded',timeout:45000});

  await page.waitForSelector('#app:not(.hidden)',{timeout:30000});
  if(await page.locator('#login:not(.hidden)').count())throw new Error('real authenticated app returned to login');
  if(page.url().includes('fixture'))throw new Error('fixture mode is not allowed in real authenticated E2E');

  await waitForRoute('hoje');
  await page.waitForSelector('[data-executive-dashboard]',{timeout:30000});
  const homeState=await page.evaluate(()=>{
    const training=[...document.querySelectorAll('.cockpitStatus')].find(card=>card.querySelector('small')?.textContent?.trim()==='Treinos');
    return{
      title:document.querySelector('[data-executive-dashboard] h1')?.textContent?.trim()||'',
      trainingValue:training?.querySelector('b')?.textContent?.trim()||'',
      hydration:document.body.innerText.includes('Sem registro de ingestão de água')
    };
  });
  if(homeState.title!=='Visão geral da sua saúde')throw new Error('real-data cockpit title missing');
  if(!homeState.trainingValue||homeState.trainingValue==='0'||homeState.trainingValue==='—')throw new Error('real-data training state is contradictory');
  if(!homeState.hydration)throw new Error('hydration fail-closed state missing');
  await assertNoHorizontalOverflow();

  await waitForRoute('treinos');
  await page.waitForSelector('.session',{timeout:30000});
  const latest=page.locator('.session.latest').first();
  if(await latest.count()!==1)throw new Error('latest real workout card missing');
  await latest.locator('.sessionHead').click();
  await page.waitForTimeout(120);
  const exerciseCount=await latest.locator('.exercise').count();
  const setCount=await latest.locator('.set').count();
  if(exerciseCount!==11||setCount!==43)throw new Error('latest real workout linkage failed');

  await waitForRoute('tratamentos');
  if(await page.locator('.timelineItem').count()<1)throw new Error('real protocol history missing');

  await waitForRoute('dados');
  if(await page.locator('.qualityRow').count()<1)throw new Error('real quality history missing');
  const resolvedCount=await page.locator('.qualityRow').filter({hasText:'resolvido'}).count();
  if(resolvedCount<1)throw new Error('resolved real quality item missing');

  const routes=['hoje','treinos','nutricao','bio','analise','saude','tratamentos','evolucao','timeline','dados'];
  await page.setViewportSize({width:390,height:844});
  for(const route of routes){
    await waitForRoute(route);
    await assertNoHorizontalOverflow();
  }

  await page.evaluate(async ({url,key})=>{
    const client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
    await client.auth.signOut({scope:'local'});
  },{url:supabaseUrl,key:supabaseKey});

  if(runtimeErrorCount)throw new Error('browser runtime errors occurred during real authenticated E2E');
  console.log('LTS Health real authenticated E2E passed');
}finally{
  await browser.close();
}
