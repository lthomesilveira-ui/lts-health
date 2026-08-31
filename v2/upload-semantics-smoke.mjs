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
  const {state}=await import('./src/core.js');
  const {uploadOutcomeMessage,uploadOutcomeMessageFromState}=await import('./src/main.js');
  const started=uploadOutcomeMessage({received:true,processing:'started'});
  const review=uploadOutcomeMessage({received:true,processing:'review_required'});
  const unknown=uploadOutcomeMessage({received:true,processing:'status_unknown'});
  state.data.uploads=[
    {id:'imported',source_type:'myfitnesspal',status:'imported'},
    {id:'safe',source_type:'fleury',status:'review_required'},
    {id:'failed',source_type:'other',status:'rejected'}
  ];
  state.data.previews=[{upload_id:'safe',detected_format:'pdf',status:'needs_specialized_parser'}];
  const imported=uploadOutcomeMessageFromState({id:'imported',received:true,processing:'started'});
  const safe=uploadOutcomeMessageFromState({id:'safe',received:true,processing:'started'});
  const failed=uploadOutcomeMessageFromState({id:'failed',received:true,processing:'started'});
  const coreSource=await fetch('./src/core.js').then(r=>r.text());
  return{started,review,unknown,imported,safe,failed,coreSource};
});

if(!result.started.includes('leitura foi iniciada'))throw new Error(`unexpected started message: ${result.started}`);
if(!result.review.includes('recebido e preservado')||!result.review.includes('aguardando leitura segura'))throw new Error(`review outcome is not explicit: ${result.review}`);
if(!result.unknown.includes('recebido e preservado')||!result.unknown.includes('antes de reenviar'))throw new Error(`unknown-status outcome is unsafe: ${result.unknown}`);
if(result.imported!=='Arquivo incorporado ao histórico.')throw new Error(`imported state is not explicit: ${result.imported}`);
if(!result.safe.includes('recebido e guardado (PDF)')||!result.safe.includes('não precisa revisar linha por linha'))throw new Error(`safe-review state is not explicit: ${result.safe}`);
if(!result.failed.includes('não foi possível concluir o processamento')||!result.failed.includes('envie outra versão do arquivo'))throw new Error(`failed state does not give a safe next step: ${result.failed}`);
for(const text of [result.review,result.unknown,result.safe,result.failed])if(/importad[oa]/i.test(text))throw new Error(`preserved upload was described as imported: ${text}`);
for(const text of [result.started,result.review,result.unknown,result.imported,result.safe,result.failed])for(const forbidden of ['review_required','needs_specialized_parser','source_payload','canonical','candidate'])if(text.includes(forbidden))throw new Error(`internal term leaked into upload message: ${forbidden}`);
if(!result.coreSource.includes("processing:statusError?'status_unknown':'review_required'"))throw new Error('parser failure no longer returns a preserved-upload outcome');
if(!result.coreSource.includes("processing:'started'"))throw new Error('successful inspector invocation no longer returns started outcome');
if(result.coreSource.includes("remove([path])"))throw new Error('metadata failure must not delete an original already preserved in health-inbox');
if(!result.coreSource.includes('Arquivo recebido e preservado, mas não foi possível concluir o registro para processamento.'))throw new Error('metadata failure no longer reports preserved original semantics');
if(result.coreSource.includes('throw fnError'))throw new Error('parser failure is again surfaced as upload failure');
if(errors.length)throw new Error(`browser errors: ${errors.join(' | ')}`);

await browser.close();
console.log('LTS Health v2 upload semantics smoke passed');