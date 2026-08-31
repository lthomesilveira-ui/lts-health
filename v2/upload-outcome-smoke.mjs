import { chromium } from 'playwright';

const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/?fixture=1';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.goto(`${base}#dados`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');

  const messages=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {uploadOutcomeMessage,uploadOutcomeMessageFromState}=await import('./src/main.js');
    state.data.uploads=[
      {id:'mfp',source_type:'myfitnesspal',status:'imported'},
      {id:'apple',source_type:'apple_health',status:'imported'},
      {id:'review',source_type:'fleury',status:'review_required'},
      {id:'failed',source_type:'other',status:'rejected'},
      {id:'running',source_type:'apple_health',status:'processing'}
    ];
    state.data.previews=[{upload_id:'review',detected_format:'pdf',status:'needs_specialized_parser'}];
    return {
      started:uploadOutcomeMessage({id:'x',processing:'started'}),
      fallbackReview:uploadOutcomeMessage({id:'x',processing:'review_required'}),
      mfp:uploadOutcomeMessageFromState({id:'mfp',processing:'started'}),
      apple:uploadOutcomeMessageFromState({id:'apple',processing:'started'}),
      review:uploadOutcomeMessageFromState({id:'review',processing:'started'}),
      failed:uploadOutcomeMessageFromState({id:'failed',processing:'started'}),
      running:uploadOutcomeMessageFromState({id:'running',processing:'started'})
    };
  });

  const expected={
    started:'Arquivo recebido. A leitura foi iniciada.',
    fallbackReview:'Arquivo recebido e preservado. A leitura automática não terminou; ficou aguardando leitura segura.',
    mfp:'Arquivo incorporado ao histórico.',
    apple:'Arquivo incorporado ao histórico. Dados com regra segura entraram; sono e outras métricas sem regra segura continuam separados aguardando conferência.',
    review:'Arquivo recebido e guardado (PDF). Ainda não entrou nas análises e você não precisa revisar linha por linha.',
    failed:'O arquivo foi guardado, mas não foi possível concluir o processamento. Para tentar novamente, envie outra versão do arquivo.',
    running:'Arquivo recebido e guardado. A leitura ainda está em andamento.'
  };
  for(const [key,value] of Object.entries(expected))if(messages[key]!==value)throw new Error(`${label}: ${key} message mismatch: ${messages[key]}`);
  for(const text of Object.values(messages))for(const forbidden of ['review_required','needs_specialized_parser','source_payload','canonical','candidate'])if(text.includes(forbidden))throw new Error(`${label}: internal term leaked in upload outcome: ${forbidden}`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health upload outcome smoke passed');