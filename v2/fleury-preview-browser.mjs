import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium,webkit} from 'playwright';

const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/v2/';
const output=process.env.LTS_FLEURY_PREVIEW_OUTPUT||join(tmpdir(),'lts-fleury-preview-visual');
await mkdir(output,{recursive:true});
const evidence=[];
for(const [engine,name]of [[chromium,'chromium'],[webkit,'webkit']]){
  const browser=await engine.launch({headless:true});
  for(const width of [320,393,1440]){
    const page=await browser.newPage({viewport:{width,height:844}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}?fixture=1#dados`);
    await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados & fontes');
    await page.evaluate(async()=>{
      const {state}=await import('./src/core.js'),{renderDataHub}=await import('./src/data-screen.js');
      const results=Array.from({length:30},(_,i)=>({biomarker:i===0?'Glicose':i===1?'Estradiol':'Marcador de exemplo com nome comprido '+i,result_raw:i===1?'inferior a 0,5':i===2?'Não reagente':'83',result_numeric:i===1||i===2?null:83,unit:i===1?'ng/dL':i===2?null:'mg/dL',collection_date:'2001-02-03',pdf_page:1,already_in_history:true}));
      state.data.uploads=[{id:'invented-preview',source_type:'fleury',original_filename:'laudo-inventado.pdf',created_at:'2001-02-04T12:00:00Z',status:'processed'}];
      state.data.previews=[{upload_id:'invented-preview',detected_format:'pdf',status:'inspected',row_count:30,date_min:'2001-02-03',date_max:'2001-02-03',warnings:[],lab_preview:{kind:'fleury_lab_preview_v1',read_only:true,source_verified:true,history_available:true,source_sha256:'1'.repeat(64),results,unsupported_count:0,conflicts:[]}}];
      state.data.labs=[{original_pdf_status:'ready',original_pdf:{schema_version:1,status:'source_verified',library_file_id:'libfile_'+'1'.repeat(32),source_sha256:'1'.repeat(64),page:1,page_count:2}}];
      document.querySelector('#screenHost').innerHTML=renderDataHub();
    });
    const summary=page.locator('.fleuryPreview>summary');
    await summary.click();
    await assert.doesNotReject(()=>page.getByText('Nenhum exame foi duplicado ou alterado.',{exact:false}).waitFor({state:'visible'}));
    assert.equal(await page.locator('.fleuryPreviewResults>li').count(),30);
    assert.ok(await page.locator('.fleuryPreviewValue').filter({hasText:'inferior a 0,5'}).isVisible());
    assert.ok(await page.getByText('Referências, método e observações devem ser consultados no laudo completo.',{exact:false}).isVisible());
    const original=page.getByRole('link',{name:'Abrir laudo original'});
    assert.ok(await original.isVisible());
    assert.ok((await original.boundingBox()).height>=44);
    const layout=await page.evaluate(()=>({pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,summary:document.querySelector('.fleuryPreview>summary').getBoundingClientRect().height,overflow:[...document.querySelectorAll('.fleuryPreviewResults>li')].some(e=>e.scrollWidth>e.clientWidth+1)}));
    assert.ok(layout.pageWidth<=width+1);assert.ok(layout.summary>=44);assert.equal(layout.overflow,false);
    await summary.focus();await summary.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Abrir laudo original ↗');
    await original.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement?.className),'fleuryPreviewResults');
    await page.screenshot({path:join(output,`${name}-${width}.png`)});
    await page.evaluate(async()=>{
      const {state}=await import('./src/core.js'),{renderDataHub}=await import('./src/data-screen.js');
      const sample=state.data.previews[0].lab_preview;sample.source_verified=false;sample.history_available=false;sample.unsupported_count=1;sample.conflicts=[{reason:'conflicting_source_copies'}];
      document.querySelector('#screenHost').innerHTML=renderDataHub();
    });
    await page.locator('.fleuryPreview>summary').click();
    assert.ok(await page.getByText('Esta é uma prévia do arquivo.',{exact:false}).isVisible());
    assert.ok(await page.getByText('divergentes entre cópias do laudo foram retidos.',{exact:false}).isVisible());
    assert.equal(await page.getByText('Já está no histórico',{exact:false}).count(),0);
    assert.equal(await page.getByRole('link',{name:'Abrir laudo original'}).count(),0);
    assert.deepEqual(errors,[]);
    evidence.push({engine:name,width,status:'passed',invented_data_only:true,...layout});
    await page.close();
  }
  await browser.close();
}
await writeFile(join(output,'acceptance.json'),JSON.stringify(evidence,null,2));
console.log(`Fleury preview browser: ${evidence.length} invented-data phone/desktop checks passed.`);
