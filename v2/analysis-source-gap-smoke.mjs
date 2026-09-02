import {chromium} from 'playwright';
const base='http://127.0.0.1:4173/?fixture=1#analise';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Análise');

  const html=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {renderAnalysisHub}=await import('./src/analysis-screen.js');
    const original=state.data.labs||[];
    state.data.labs=[
      {source_record_id:'lab-old-a',collection_date:'2026-01-01',laboratory:'Lab A',biomarker:'Glicose',result_numeric:90,unit:'mg/dL'},
      {source_record_id:'lab-current-b',collection_date:'2026-02-01',laboratory:'Lab B',biomarker:'Glicose',result_numeric:92,unit:'mg/dL'}
    ];
    const rendered=renderAnalysisHub();
    state.data.labs=original;
    return rendered;
  });

  for(const expected of [
    'histórico existe, mas não há coleta anterior da mesma origem',
    'fontes diferentes não são tratadas como continuidade'
  ])if(!html.includes(expected))throw new Error(`${label}: missing same-source gap copy: ${expected}`);

  for(const forbidden of [
    'sem biomarcadores comparáveis na última dupla',
    'não há correspondência segura de nome, unidade e valor numérico'
  ])if(html.includes(forbidden))throw new Error(`${label}: source gap was misclassified as incompatible biomarkers: ${forbidden}`);

  if(/0 biomarcador\(es\) comparáveis/i.test(html))throw new Error(`${label}: source gap rendered as numeric zero`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health Analysis same-source gap smoke passed');
