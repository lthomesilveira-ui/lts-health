import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=new URL('./',import.meta.url);
const shell=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/entry.css"><main><button id="open">Registrar treino</button></main><div id="entryModal" class="hidden" role="dialog"><div class="entryPanel"><button id="closeEntry">Fechar</button><h2 id="entryTitle"></h2><div id="entryHost"></div></div></div><style>*{box-sizing:border-box}.hidden{display:none!important}body{margin:0}#entryModal{position:fixed;inset:0;overflow:auto}</style><script type="module">
window.qa={attempts:[],committed:new Map(),lose:false};
window.supabase={createClient:()=>({rpc:async(name,args)=>{if(name!=='health_log_structured_workout')throw Error('unexpected RPC');const p=args.p_payload;qa.attempts.push(p);qa.committed.set(p.entry_id,p);if(qa.lose){qa.lose=false;return {error:{message:'synthetic transport failure'}};}return {data:{ok:true,source_record_id:'manual-structured:'+p.entry_id},error:null};}})};
const {state}=await import('/src/core.js');state.session={user:{id:'synthetic'}};state.data={workouts:[{source_record_id:'owned-a',is_canonical:true,record_status:'validated',workout_date:'2024-03-15'}],exercises:[{workout_source_record_id:'owned-a',exercise:'Remada sintética',machine:'Equipamento de teste',muscle_group:'Costas'}]};
state.domainStatus={polarSessions:'ready'};state.data.polarSessions=[{workout_date:'2024-03-15',recorded_start:'2024-03-15T09:12:00',recorded_stop:'2024-03-15T09:32:00',duration_minutes:20,recorded_calories:0,heart_rate_avg:98}];
const {openEntry,setupEntryController}=await import('/src/entry.js');setupEntryController({onSaved:async()=>{}});document.getElementById('open').onclick=()=>openEntry('workout');document.body.dataset.ready='true';</script>`;
const server=http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/'){res.setHeader('content-type','text/html; charset=utf-8');res.end(shell);return;}
  if(!/^\/(?:src\/[A-Za-z0-9-]+\.js|entry\.css)$/.test(path)){res.writeHead(404).end();return;}
  try{res.setHeader('content-type',path.endsWith('.css')?'text/css':'text/javascript');res.end(await readFile(new URL('.'+path,root)));}
  catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.LTS_QA_BROWSER_PATH?{executablePath:process.env.LTS_QA_BROWSER_PATH}:{})});
try{
 for(const width of [320,393,1280]){
  const page=await browser.newPage({viewport:{width,height:820},timezoneId:'America/Sao_Paulo'});
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin);await page.locator('body[data-ready="true"]').waitFor();
  const open=async()=>{await page.getByRole('button',{name:'Registrar treino'}).click();await page.getByLabel('Data',{exact:true}).fill('2024-03-15');};
  const checkWidth=async()=>{
    const geometry=await page.locator('.entryPanel').evaluate(panel=>{
      const bounds=panel.getBoundingClientRect();
      const overflow=[...panel.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>bounds.right+1)
        .slice(0,10).map(el=>[el.tagName,el.className,el.getAttribute('name'),Math.round(el.getBoundingClientRect().right)]);
      return {client:panel.clientWidth,scroll:panel.scrollWidth,overflow};
    });
    assert.ok(geometry.scroll<=geometry.client+1,'form fits at '+width+' '+JSON.stringify(geometry));
  };
  await open();await page.getByText('Registros do Polar nesta data',{exact:true}).click();assert.match(await page.locator('[data-polar-day]').innerText(),/09:12:00 a 09:32:00.*0 kcal do aparelho/);await page.getByLabel('Buscar exercício').fill('rema teste');await page.getByRole('button',{name:/Remada sintética/}).click();
  await page.getByLabel('Carga da série 1',{exact:true}).fill('12,5');await page.getByLabel('Repetições da série 1').fill('8');await checkWidth();
  await page.getByRole('button',{name:'Revisar treino'}).click();assert.match(await page.getByRole('region',{name:'Revisão do treino'}).innerText(),/12,5 kg/);
  await page.getByRole('button',{name:'Salvar treino'}).click();assert.equal(await page.evaluate(()=>qa.attempts.length),0,'separate workout on the same date requires a deliberate choice');
  await page.getByLabel('Este é outro treino nessa data.').check();await page.getByRole('button',{name:'Salvar treino'}).click();await page.locator('#entryModal.hidden').waitFor({state:'attached'});
  let saved=await page.evaluate(()=>qa.attempts.at(-1));assert.equal(saved.exercises[0].name,'Remada sintética');assert.equal(saved.exercises[0].sets[0].weight,12.5);
  await open();await page.getByLabel('Data',{exact:true}).fill('2024-03-16');await page.getByRole('button',{name:'Escrever treino'}).click();
  const raw='Supino: 25 kg x 10, 30 kg x 8 até a falha\nRemada: 2 séries de 9 com 12,5 kg\nObservação: relato <literal>';
  await page.getByLabel('Descreva seu treino').fill(raw);await page.getByRole('button',{name:'Interpretar e revisar'}).click();assert.equal(await page.locator('.exerciseEntry').count(),2);
  await page.getByRole('button',{name:'Escrever treino'}).click();await page.getByLabel('Descreva seu treino').fill(raw);await page.getByRole('button',{name:'Interpretar e revisar'}).click();assert.equal(await page.locator('.exerciseEntry').count(),2);
  await page.getByRole('button',{name:'Revisar treino'}).click();const review=page.getByRole('region',{name:'Revisão do treino'});assert.match(await review.innerText(),/relato <literal>/);assert.equal(await review.locator('literal').count(),0);await checkWidth();
  await page.evaluate(()=>{qa.lose=true;});await page.getByRole('button',{name:'Salvar treino'}).click();await page.waitForFunction(()=>qa.attempts.length===2);await page.getByRole('button',{name:'Salvar treino'}).click();
  await page.locator('#entryModal.hidden').waitFor({state:'attached'});
  const fact=await page.evaluate(()=>({payload:qa.attempts.at(-1),same:qa.attempts[1].entry_id===qa.attempts[2].entry_id,count:qa.committed.size}));
  assert.equal(fact.same,true);assert.equal(fact.count,2);assert.equal(fact.payload.original_text,raw);assert.equal(fact.payload.exercises[1].sets.length,2);assert.equal(fact.payload.exercises[0].sets[1].failure,true);
  await open();
  await page.getByLabel('Data',{exact:true}).fill('2024-03-16');
  await page.getByRole('button',{name:'Escrever treino'}).click();
  const machineText='Remada de teste: nível 4 x 9 reps\nPuxada de teste: 18 kg x 8 a 10 reps\nSupino de teste: 24 kg x 7 reps sem chegar à falha';
  await page.getByLabel('Descreva seu treino').fill(machineText);
  await page.getByRole('button',{name:'Interpretar e revisar'}).click();
  await page.getByRole('button',{name:'Revisar treino'}).click();
  const reviewText=await review.innerText();
  assert.match(reviewText,/nível 4 · 9 rep/);
  assert.match(reviewText,/Trechos mantidos no relato original[\s\S]*Puxada de teste: 18 kg x 8 a 10 reps/);
  assert.doesNotMatch(reviewText,/· até a falha/);
  await checkWidth();
  await page.getByRole('button',{name:'Salvar treino'}).click();
  await page.locator('#entryModal.hidden').waitFor({state:'attached'});
  saved=await page.evaluate(()=>qa.attempts.at(-1));
  assert.equal(saved.original_text,machineText);
  assert.deepEqual(saved.exercises.map(e=>[e.name,e.sets.length]),[['Remada de teste',1],['Supino de teste',1]]);
  const plateSet=saved.exercises[0].sets[0], effortSet=saved.exercises[1].sets[0];
  assert.deepEqual([plateSet.weight,plateSet.weight_unit,plateSet.reps],[4,'plate_index',9]);
  assert.equal(effortSet.failure,undefined);
  assert.equal(effortSet.notes,'sem chegar à falha');
  await open();await page.getByLabel('Data',{exact:true}).fill('2024-03-17');await page.getByRole('button',{name:'Escrever treino'}).click();await page.getByLabel('Descreva seu treino').fill('Treino leve sem detalhes');await page.getByRole('button',{name:'Interpretar e revisar'}).click();await page.getByRole('button',{name:'Revisar treino'}).click();await page.getByRole('button',{name:'Salvar treino'}).click();await page.locator('#entryModal.hidden').waitFor({state:'attached'});
  saved=await page.evaluate(()=>qa.attempts.at(-1));assert.equal(saved.text_only,true);assert.deepEqual(saved.exercises,[]);await page.close();
 }
 console.log('Workout form in Chromium: picker, free text, review, duplicates, retries, raw-only fallback and widths 320/393/1280 passed with a synthetic transport.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
