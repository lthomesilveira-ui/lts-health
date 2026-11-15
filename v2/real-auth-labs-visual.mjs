import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {deployedRuntimeAssets} from './deployed-runtime-assets.mjs';
import {observePublicFailures} from './public-entry-diagnostics.mjs';

const tokenHash=readFileSync('/tmp/lts-health-labs-token-hash','utf8').trim();
if(!tokenHash)throw new Error('authenticated labs visual token hash missing');
const coreSource=readFileSync(new URL('./src/core.js',import.meta.url),'utf8');
const supabaseUrl=/url:\s*'([^']+)'/.exec(coreSource)?.[1];
const supabaseKey=/key:\s*'([^']+)'/.exec(coreSource)?.[1];
if(!supabaseUrl||!supabaseKey)throw new Error('public Supabase configuration not resolved');

const appUrl='https://lthomesilveira-ui.github.io/lts-health/v2/';
const evidenceDir='v2/real-auth-evidence';
mkdirSync(evidenceDir,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
let runtimeErrors=0;
const runtimeErrorKinds={page:0,console:0,resourceLoad:0};
let verificationStage='authentication';
let firstErrorStage=null;
page.on('pageerror',()=>{runtimeErrors++;runtimeErrorKinds.page++;firstErrorStage??=verificationStage;});
page.on('console',message=>{if(message.type()==='error'){runtimeErrors++;runtimeErrorKinds.console++;firstErrorStage??=verificationStage;if(/Failed to load resource/.test(message.text()))runtimeErrorKinds.resourceLoad++;}});
// Retain only allowlisted public resource names and bounded counts. Never log
// console text, error details, private paths, queries, bodies or credentials.
const runtimeRoot=new URL('./',import.meta.url),assets=deployedRuntimeAssets(readFileSync(new URL('index.html',runtimeRoot),'utf8'),url=>readFileSync(url,'utf8'),runtimeRoot);
const network=observePublicFailures(page,appUrl,new Set(['','index.html','favicon.ico',...assets.map(asset=>asset.file)]));

async function assertLabs(){
  await page.waitForSelector('.ltsLabsV2',{timeout:30000});
  const state=await page.evaluate(()=>{
    const action=document.querySelector('#routeAction');
    return{
      title:document.querySelector('.ltsLabsV2 h1')?.textContent?.trim()||'',
      hero:Boolean(document.querySelector('.ltsLabsHero')),
      chart:Boolean(document.querySelector('.ltsLabsChart')),
      markers:document.querySelectorAll('[data-lab-marker]').length,
      trust:Boolean(document.querySelector('.ltsLabsTrust')),
      overflow:document.documentElement.scrollWidth-window.innerWidth,
      routeActionVisible:Boolean(action&&!action.classList.contains('hidden')&&getComputedStyle(action).display!=='none')
    };
  });
  if(state.title!=='Exames'||!state.hero||!state.chart||!state.trust||state.overflow>1||state.routeActionVisible)throw new Error(`structural Labs visual contract failed: ${JSON.stringify(state)}`);
  return state;
}

try{
  await page.goto(`${appUrl}#saude`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>Boolean(window.supabase?.createClient),null,{timeout:20000});
  const auth=await page.evaluate(async ({url,key,tokenHash})=>{
    const client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    const {data,error}=await client.auth.verifyOtp({token_hash:tokenHash,type:'email'});
    return{ok:!error&&Boolean(data?.session?.user)};
  },{url:supabaseUrl,key:supabaseKey,tokenHash});
  if(!auth.ok)throw new Error('real authenticated Labs visual session could not be established');
  await page.reload({waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('#app:not(.hidden)',{timeout:30000});
  verificationStage='desktop-labs';
  await page.evaluate(()=>{location.hash='#saude';});
  await assertLabs();
  await page.screenshot({path:`${evidenceDir}/desktop-labs.png`,fullPage:true});

  const marker=page.locator('[data-lab-marker]').nth(1);
  if(await marker.count()){
    verificationStage='marker-selection';
    await marker.click();
    await page.waitForTimeout(250);
    await assertLabs();
  }

  verificationStage='mobile-labs';
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(250);
  await assertLabs();
  await page.screenshot({path:`${evidenceDir}/mobile-labs.png`,fullPage:true});
  if(runtimeErrors)throw new Error(`browser runtime errors occurred during authenticated Labs visual check: ${runtimeErrors}`);
}catch(error){
  console.log('Authenticated Labs bounded failure evidence: '+JSON.stringify({verificationStage,firstErrorStage,runtimeErrors,runtimeErrorKinds,network:network.failures,networkCounts:network.counts}));
  throw error;
}finally{network.stop();await browser.close();}
