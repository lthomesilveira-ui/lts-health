import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:4173/?fixture=1#dados',{waitUntil:'domcontentloaded'});
await page.waitForSelector('#app:not(.hidden)');
await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');

const result=await page.evaluate(async()=>{
  const {uploadOutcomeMessage}=await import('./src/main.js');
  const started=uploadOutcomeMessage({received:true,processing:'started'});
  const review=uploadOutcomeMessage({received:true,processing:'review_required'});
  const unknown=uploadOutcomeMessage({received:true,processing:'status_unknown'});
  const coreSource=await fetch('./src/core.js').then(r=>r.text());
  return{started,review,unknown,coreSource};
});

if(!result.started.includes('processamento foi iniciado'))throw new Error(`unexpected started message: ${result.started}`);
if(!result.review.includes('recebido e preservado')||!result.review.includes('revisão'))throw new Error(`review outcome is not explicit: ${result.review}`);
if(!result.unknown.includes('recebido e preservado')||!result.unknown.includes('antes de reenviar'))throw new Error(`unknown-status outcome is unsafe: ${result.unknown}`);
for(const text of [result.review,result.unknown])if(/importad[oa]/i.test(text))throw new Error(`preserved upload was described as imported: ${text}`);
if(!result.coreSource.includes("processing:statusError?'status_unknown':'review_required'"))throw new Error('parser failure no longer returns a preserved-upload outcome');
if(!result.coreSource.includes("processing:'started'"))throw new Error('successful inspector invocation no longer returns started outcome');
if(!result.coreSource.includes("remove([path])"))throw new Error('orphaned storage cleanup is missing after metadata failure');
if(result.coreSource.includes('throw fnError'))throw new Error('parser failure is again surfaced as upload failure');
if(errors.length)throw new Error(`browser errors: ${errors.join(' | ')}`);

await browser.close();
console.log('LTS Health v2 upload semantics smoke passed');
