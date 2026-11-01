import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';
import {labOriginalFixture,LAB_ORIGINAL_ID,LAB_ORIGINAL_TODAY} from '../preview/compact-evidence/tests/lab-original-fixture.mjs';
import {languageDatabase} from '../preview/compact-evidence/tests/consumer-language-fixture.mjs';
import {sourceWindowService} from '../preview/compact-evidence/tests/source-window-service-fixture.mjs';
const base='http://127.0.0.1:4173/v2/',origin=new URL(base),dir='lab-original-visual',results=[];
mkdirSync(dir,{recursive:true});
for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true});
 try{for(const [width,height,failTable]of [[320,740,null],[393,650,null],[1440,900,null],...(engine==='chromium'?[[393,650,'health_documents'],[393,650,'health_lab_results']]:[])]){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),page=await context.newPage(),errors=[],outside=[],opened=[];
  await context.addInitScript(today=>{const Native=Date;window.Date=class extends Native{constructor(...a){super(...(a.length?a:[today+'T12:00:00Z']));}static now(){return new Native(today+'T12:00:00Z').getTime();}};},LAB_ORIGINAL_TODAY);
  const {row,document}=labOriginalFixture(),prior={...row,source_record_id:'synthetic-prior',collection_date:'2026-01-20',report_date:'2026-01-21',original_file_id:null,result_raw:'4,50',result_numeric:4.5};
  const textual={...row,source_record_id:'fleury:synthetic-text',biomarker:'Resultado textual',result_raw:'Ausente',result_numeric:null,unit:'',original_page:4};
  const unlinked={...row,source_record_id:'fleury:synthetic-mismatch',biomarker:'Sem original vinculado',original_sha256:'b'.repeat(64)};
  const db=languageDatabase({labs:[prior,row,textual,unlinked],docs:[document]});
  const sdk=sourceWindowService(db,{failTable});page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(u.hostname==='cdn.jsdelivr.net'&&u.pathname==='/npm/@supabase/supabase-js@2'&&q.method()==='GET')return r.fulfill({contentType:'application/javascript',body:sdk});
   if(u.origin==='https://chatgpt.com'&&u.pathname==='/library'&&u.searchParams.get('file_id')===LAB_ORIGINAL_ID&&u.searchParams.get('account_id')==='personal'){
    assert.equal(q.method(),'GET');assert.deepEqual([...u.searchParams.keys()].sort(),['account_id','file_id']);assert.equal(q.headers().referer,undefined);opened.push(true);return r.fulfill({contentType:'text/html',body:'<title>Synthetic laboratory original</title>'});}
   if(u.origin===origin.origin&&['GET','HEAD'].includes(q.method()))return r.continue();outside.push(q.method());return r.abort();
  });
  await page.goto(base+'#saude');await page.waitForSelector('.ltsLabsV2');
  const checkFit=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('.ltsLabOriginal')].every(e=>e.scrollWidth<=e.clientWidth+1)),'original actions fit the viewport');
  if(failTable==='health_lab_results'){
   await page.waitForFunction(()=>document.querySelector('.ltsLabsV2')?.textContent.includes('Os resultados laboratoriais não carregaram agora.'));assert.equal(await page.locator('[data-lab-original]').count(),0);
  }else{
   await page.waitForSelector('#productLabMarkerSelect');await page.locator('#productLabMarkerSelect').selectOption('ferritina');
   assert.match(await page.locator('.ltsLabsHistory').innerText(),/5,25/);
   if(failTable==='health_documents'){
    await page.waitForSelector('[data-lab-original-read-error]');assert.equal(await page.locator('[data-lab-original]').count(),0);
   }else{
    const links=page.locator('[data-lab-original]');assert.equal(await links.count(),2,'selected chart point and its exact historical row each offer the source');
    const a=links.first();assert.equal(await a.getAttribute('href'),`https://chatgpt.com/library?file_id=${LAB_ORIGINAL_ID}&account_id=personal`);
    assert.equal(await a.getAttribute('target'),'_blank');assert.equal(await a.getAttribute('rel'),'noopener noreferrer');assert.equal(await a.getAttribute('referrerpolicy'),'no-referrer');
    const box=await a.boundingBox();assert.ok(box.height>=44&&box.x>=0&&box.x+box.width<=width+1);
    await page.evaluate(()=>{document.getElementById('screenHost').scrollTop=0;});await page.screenshot({path:`${dir}/${engine}-${width}-entry.png`,fullPage:true});
    const [popup]=await Promise.all([context.waitForEvent('page'),a.click()]);await popup.waitForLoadState('domcontentloaded');assert.equal(await popup.title(),'Synthetic laboratory original');assert.equal(await popup.evaluate(()=>window.opener),null);await popup.close();
    await page.locator('#productLabPoint').selectOption('0');assert.equal(await page.locator('.ltsPointReadout [data-lab-original]').count(),0,'older unlinked point never borrows the new PDF');assert.equal(await page.locator('.ltsLabsHistory [data-lab-original]').count(),1);
    await page.locator('#productLabPoint').selectOption('1');assert.equal(await page.locator('.ltsPointReadout [data-lab-original]').count(),1);assert.match(await page.locator('.ltsPointReadout .ltsLabOriginal').innerText(),/Página 3 de 8/);
    await page.locator('.ltsLabsHistory [data-lab-original]').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${engine}-${width}-history.png`,fullPage:true});
    await page.locator('#productLabMarkerSelect').selectOption('resultado textual');assert.equal(await page.locator('[data-lab-original]').count(),1);assert.match(await page.locator('.ltsLabsHistory').innerText(),/Ausente/);
    await page.locator('#productLabMarkerSelect').selectOption('sem original vinculado');assert.equal(await page.locator('[data-lab-original]').count(),0,'invalid metadata gives no original fallback');
   }
  }
  await checkFit();assert.deepEqual(await page.evaluate(()=>window.__historyQA?.writes||[]),[]);assert.deepEqual(outside,[]);assert.deepEqual(errors,[]);
  await page.screenshot({path:`${dir}/${engine}-${width}-${failTable||'withheld'}.png`,fullPage:true});
  results.push({engine,width,height,mode:failTable||'verified-original',fixedDestination:true,isolatedWindow:true,originalPointBinding:true,missingAndFailedReadersPreserved:true,zeroWrites:true});await context.close();
 }}finally{await browser.close();writeFileSync(dir+'/results.json',JSON.stringify(results,null,2));}
}
console.log('Laboratory original story: Chromium/WebKit mobile/desktop, exact point/history binding, textual results, unavailable/failed readers, isolated external access and zero writes passed.');
