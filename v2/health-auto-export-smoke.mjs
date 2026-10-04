import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
    const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/?fixture=1#dados',{waitUntil:'domcontentloaded'});
    const card=page.locator('[data-health-auto-export]');await card.waitFor();
    await page.getByRole('button',{name:'Verificar recebimento'}).click();
    await assert.doesNotReject(()=>card.getByText('Ativação no iPhone pendente',{exact:true}).waitFor());
    await card.getByText('Configurar o Health Auto Export',{exact:true}).click();
    assert.match(await card.innerText(),/JSON · versão 2/);assert.match(await card.innerText(),/Dias \/ Day/);
    assert.match(await card.innerText(),/água precisa aparecer no Saúde/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no horizontal overflow');
    for(const box of await card.locator('button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height)))assert.ok(box>=44,'phone touch target');
    // Check the configured and received layouts with only synthetic status, no live key.
    await page.evaluate(async()=>{
      const {state}=await import('./src/core.js');const {renderAutoExportConnection}=await import('./src/health-auto-export-connection.js');
      state.autoExportConnection={status:'ready',configured:true,received:true,last_received_at:'2026-10-04T19:00:00Z',last_metric_date:'2026-10-03',last_water_date:null};
      document.querySelector('[data-health-auto-export]').outerHTML=renderAutoExportConnection();
    });
    assert.match(await page.locator('[data-health-auto-export]').innerText(),/Recebendo dados/);
    assert.match(await page.locator('[data-health-auto-export]').innerText(),/Ainda não recebemos volume de água/);
    await page.locator('[data-health-auto-export] summary').click();
    assert.equal(await page.locator('textarea[aria-label="URL do Health Auto Export"]').inputValue(),'https://plztdqyuqcjohiimudnr.supabase.co/functions/v1/health-auto-export-receive');
    assert.equal(await page.locator('input[aria-label="Nome do cabeçalho"]').inputValue(),'x-lts-health-key');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('Health Auto Export setup: desktop/mobile status, configuration, copy fields, missing water and touch targets passed.');
}finally{await browser.close();}
