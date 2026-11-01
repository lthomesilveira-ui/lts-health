import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
mkdirSync('artifacts/production-integration',{recursive:true});
import {chromium} from 'playwright';
import {FIXED_TODAY,makeDashboardFixture} from '../preview/compact-evidence/tests/health-dashboard-render-test.mjs';
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4175/v2/';
const parsed=new URL(base);assert.ok(['127.0.0.1','localhost'].includes(parsed.hostname));assert.equal(parsed.pathname,'/v2/');
function service(db){return `
window.__healthQA={reads:[],writes:[]};
window.__reviewDb=${JSON.stringify(db)};
const mutation=(kind,target)=>{window.__healthQA.writes.push({kind,target});throw new Error('Synthetic QA forbids writes: '+kind+' '+target);};
window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-health-dashboard-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},
 functions:{invoke:async(name,args)=>{if(args?.body?.action!=='status')return mutation('invoke',name);window.__healthQA.reads.push({function:name,action:'status'});return {data:window.__statusOverrides?.[name]||{configured:false,connected:false,received:false},error:null}}},rpc:(name)=>mutation('rpc',name),
 storage:{from:(name)=>({upload:()=>mutation('upload',name),remove:()=>mutation('remove',name)})},
 from(table){
  let from=0,to=999;const filters=[],orders=[];
  const rows=()=>{
   let selected=(window.__reviewDb[table]||[]).filter(row=>filters.every(([key,value])=>row[key]===value));
   if(orders.length)selected=selected.slice().sort((a,b)=>{for(const[key,asc]of orders){const result=String(a[key]??'').localeCompare(String(b[key]??''));if(result)return asc?result:-result;}return 0;});
   return selected;
  };
  const q={select(){return q;},eq(key,value){filters.push([key,value]);return q;},is(key,value){filters.push([key,value]);return q;},range(a,b){from=a;to=b;return q;},order(key,options={}){orders.push([key,options.ascending!==false]);return q;},limit(n){to=from+n-1;return q;},
   maybeSingle:async()=>{window.__healthQA.reads.push({table,single:true});const selected=rows();return selected.length>1?{data:null,error:{message:'Multiple synthetic rows'}}:{data:selected[0]||null,error:null};},
   then(resolve,reject){window.__healthQA.reads.push({table,from,to});return Promise.resolve({data:rows().slice(from,to+1),error:null}).then(resolve,reject);}
  };
  for(const name of ['insert','update','upsert','delete'])q[name]=()=>mutation(name,table);
  return q;
 }
})};
`;}

const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
for(const width of [320,393,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2'){
   const db=makeDashboardFixture(FIXED_TODAY).db;
   db.health_workouts=db.health_workouts.map(row=>({...row,documented_energy_kind:'estimate',documented_duration_kind:'approximate'}));
   db.health_workout_sets=[];
   db.health_workout_exercises=db.health_workout_exercises.map(row=>({...row,source_text:'Escala de placa: 4 × 8 — registro original de exemplo'}));
   return route.fulfill({contentType:'application/javascript',body:service(db)});
  }
  if(url.origin===parsed.origin&&route.request().method()==='GET')return route.continue();
  external.push({origin:url.origin,method:route.request().method()});return route.abort();
 });
 await page.clock.setFixedTime(new Date(FIXED_TODAY+'T15:00:00Z'));
 await page.goto(base+'#hoje');
 await page.locator('[data-health-dashboard]').waitFor();
 assert.equal(await page.locator('[data-preview-readonly-banner]').count(),0);
 assert.equal(await page.locator('[data-dashboard-card]').count(),7);
 for(const route of ['treinos','bio','nutricao','saude','analise','tratamentos','dados','timeline','evolucao','hoje']){
  await page.evaluate(r=>{location.hash=r},route);
  await page.waitForTimeout(150);
  await page.waitForFunction(r=>document.querySelector('#screenHost')?.dataset.productLayoutRoute===r||r==='evolucao'||r==='timeline'||r==='dados'||r==='tratamentos',route);
  assert.ok((await page.locator('#screenHost').innerText()).trim().length>30,route+' renders');
  assert.equal(await page.evaluate(async()=>{const {state}=await import('./src/core.js');return state.route}),route);
  if(route==='treinos'){
   assert.equal(await page.getByText('Energia estimada',{exact:true}).count(),1,'documented energy estimate is identified at '+width);
   assert.equal(await page.getByText('Duração aproximada',{exact:true}).count(),1,'documented approximate duration is identified at '+width);
   assert.equal(await page.locator('.ltsRefTrainMetrics').getByText('Séries em texto',{exact:true}).count(),1,'original textual sets are not a confirmed zero at '+width);
   await page.getByRole('tab',{name:'Exercícios',exact:true}).click();
   assert.ok(await page.getByText('Escala de placa: 4 × 8 — registro original de exemplo',{exact:true}).count()>0,'literal source units remain readable');
   assert.ok((await page.locator('.ltsRefExerciseCard').first().innerText()).includes('Séries em texto'));
   const sourceGeometry=await page.locator('.ltsRefSetEmpty').first().evaluate(node=>{
    const range=document.createRange();range.selectNodeContents(node);
    return{textWidth:range.getBoundingClientRect().width,cardWidth:node.closest('.ltsRefExerciseCard').getBoundingClientRect().width};
   });
   assert.ok(sourceGeometry.textWidth>=Math.min(240,sourceGeometry.cardWidth*.65),'original text uses the card width, not the first table column at '+width);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'textual exercise details fit '+width);
   await page.screenshot({path:`artifacts/production-integration/training-text-sets-${width}.png`});
   await page.getByRole('tab',{name:'Resumo',exact:true}).click();
   await page.screenshot({path:`artifacts/production-integration/training-qualifiers-${width}.png`});
  }
  await page.screenshot({path:`artifacts/production-integration/${route}-${width}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,route+' fits '+width);
  if(['bio','treinos'].includes(route)){
   await page.locator(`#screenHost [data-entry="${route==='bio'?'body':'workout'}"]`).click();await page.locator('#entryModal:not(.hidden)').waitFor();
   assert.equal(await page.locator('#entryModal input:not([disabled])').count()>0,true,'operational fields available');
   await page.locator('#closeEntry').click();await page.locator('#entryModal').waitFor({state:'hidden'});
   assert.equal(await page.locator('#entryModal').evaluate(e=>e.classList.contains('hidden')),true);
   await page.locator(`#screenHost [data-entry="${route==='bio'?'body':'workout'}"]`).click();await page.locator('#entryModal:not(.hidden)').waitFor();
   await page.locator('#closeEntry').click();await page.locator('#entryModal').waitFor({state:'hidden'});
   assert.equal(await page.locator('#entryModal').evaluate(e=>e.classList.contains('hidden')),true);
   assert.equal(await page.evaluate(()=>location.hash),'#'+route,'cancel retains route');
  }
 }
 const forms=await page.evaluate(async()=>{
  const {state}=await import('./src/core.js');
  const {renderGoals}=await import('./src/personal-goals.js');
  state.domainStatus.goals='ready';const host=document.createElement('div');host.innerHTML=renderGoals();
  return {goalsDisabled:host.querySelector('button[type="submit"]').disabled,preview:!!window.LTSPreviewReadOnly};
 });
 assert.deepEqual(forms,{goalsDisabled:false,preview:false});
 await page.screenshot({path:`artifacts/production-integration/home-${width}.png`,fullPage:true});
 await page.screenshot({path:`artifacts/production-integration/home-viewport-${width}.png`});
 assert.deepEqual(await page.evaluate(()=>window.__healthQA.writes),[],'navigation produces no writes when disconnected');
 // Mobile Home owns its header; account controls remain in the sources area.
 await page.locator('.studyFooter [data-route="dados"]').click();
 await page.waitForFunction(()=>location.hash==='#dados');
 await page.getByRole('heading',{name:'Dados & fontes',exact:true}).waitFor();
 // A refresh must retrieve connection status as well as table rows. These are
 // invented old dates, unrelated to the owner's source history.
 await page.evaluate(()=>{
  window.__statusOverrides={
   'health-polar-connection':{configured:true,connected:true,update_mode:'scheduled_hourly',last_sync_at:'2001-04-03T07:15:00Z',last_scheduled_sync_at:'2001-04-03T07:15:00Z'},
   'health-auto-export-connection':{configured:true,received:true,last_received_at:'2001-04-03T08:20:00Z',last_metric_date:'2001-04-02'}
  };
  window.__reviewDb.health_daily_nutrition=[{source_record_id:'invented-file',nutrition_date:'2001-03-01',source:'MyFitnessPal',calories_kcal:1234}];
  window.__reviewDb.health_nutrition_meals=[];
  const bridge=(date,source)=>({source_record_id:'health_auto_export:invented:'+date,metric_date:date,metric_type:'dietary_energy_kcal',value:1234,unit:'kcal',source_name:'Apple Saúde · '+source,source_family:'health_auto_export',canonical_status:'canonical',confidence:'authenticated_auto_export'});
  window.__reviewDb.health_source_daily_metrics=[bridge('2001-04-01','MyFitnessPal'),bridge('2001-04-02','Origem não informada pelo Saúde')];
  window.__reviewDb.health_polar_sessions=[{source_record_id:'invented-polar-session',workout_date:'2001-04-02',source_name:'Polar Flow'}];
  window.__reviewDb.health_workout_source_evidence=[];
  window.__reviewDb.health_medication_events=[{source_record_id:'invented-historical-event',event_date:'2001-03-02',medication:'Registro histórico de exemplo',event_type:'application',source:'Relato de exemplo',local_time:'07:45',recorded_site:'glute',recorded_side:'left'}];
 });
 assert.equal(await page.locator('#refreshBtn').isVisible(),true,'Sources exposes refresh at '+width);
 await page.locator('#refreshBtn').click();
 await page.waitForFunction(()=>document.querySelector('[data-connections]')?.textContent.includes('03/04/2001, 04:15:00'));
 assert.ok((await page.locator('[data-health-auto-export]').innerText()).includes('03/04/2001, 05:20:00'));
 const mfpCard=page.locator('.sourceStatus.ready').filter({hasText:'Totais identificados como MyFitnessPal'});
 const mfpText=await mfpCard.innerText();
 assert.ok(mfpText.includes('Histórico por arquivo até: 01/03/2001'));
 assert.ok(mfpText.includes('pelo Saúde do iPhone até: 01/04/2001'));
 assert.ok(!mfpText.includes('02/04/2001'),'anonymous newer source cannot advance MyFitnessPal coverage');
 assert.equal(await page.getByText('Sessões recebidas do Polar até: 02/04/2001',{exact:true}).count(),1);
 await page.screenshot({path:`artifacts/production-integration/source-history-${width}.png`,fullPage:true});
 await page.screenshot({path:`artifacts/production-integration/source-viewport-${width}.png`});
 await mfpCard.screenshot({path:`artifacts/production-integration/source-card-${width}.png`});
 // A missing-water action must reach its own receiving status, past Polar,
 // without opening setup, changing keys, or leaving a sticky jump on other visits.
 await page.evaluate(()=>{location.hash='hoje'});
 await page.locator('[data-dashboard-card="water"] [data-source-focus="water"]').waitFor();
 if(width===393)await page.setViewportSize({width,height:650});
 await page.locator('[data-dashboard-card="water"] [data-source-focus="water"]').click();
 await page.waitForFunction(()=>document.activeElement?.id==='health-auto-export-title');
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const receiver=page.locator('[data-health-auto-export]');
 assert.match(await receiver.locator('.pill').innerText(),/Água sem atualização/);
 assert.match(await receiver.locator('.healthSourceCaution').innerText(),/Chegaram outros dados/);
 const setup=receiver.locator('[data-disclosure="health-auto-export-setup"]');
 assert.equal(await setup.getAttribute('open'),null,'water diagnosis does not open configuration');
 for(const action of ['rotate','disconnect'])assert.equal(await receiver.locator(`[data-hae-action="${action}"]`).isVisible(),false,'configuration is secondary');
 assert.equal(await receiver.locator('[data-hae-check]').isVisible(),true,'receipt check remains directly available');
 for(const selector of ['.healthSourceCaution','details>summary'])assert.ok(await receiver.locator(selector).evaluate(el=>Number.parseFloat(getComputedStyle(el).fontSize))>=14,'receiving text remains readable at '+width);
 assert.ok(await receiver.locator('[data-hae-check]').evaluate(el=>el.getBoundingClientRect().height)>=44,'primary receiving action retains a touch target');
 const box=await receiver.locator('h2').boundingBox();
 assert.ok(box.y>=0&&box.y+box.height<(width===393?650:900),'receiving heading is actually in view at '+width+': '+JSON.stringify(box));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'targeted receiving status fits '+width);
 await page.screenshot({path:`artifacts/production-integration/water-receiving-focus-${width}.png`});
 await setup.locator('summary').click();
 assert.equal(await receiver.locator('[data-hae-action="rotate"]').isVisible(),true,'existing configuration remains accessible');
 await setup.locator('summary').click();
 await page.evaluate(()=>{location.hash='hoje'});await page.locator('[data-health-dashboard]').waitFor();
 await page.locator('.studyFooter [data-route="dados"]').click();
 await page.getByRole('heading',{name:'Dados & fontes',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('#screenHost')?.scrollTop===0);
 assert.equal(await page.evaluate(()=>document.activeElement?.id==='health-auto-export-title'),false,'ordinary source entry is not hijacked by prior context');
 if(width===393)await page.setViewportSize({width,height:900});
 await page.evaluate(()=>{location.hash='tratamentos'});
 await page.getByRole('heading',{name:'Protocolos',exact:true}).waitFor();
 const legacy=await page.locator('.timelineItem.rich').filter({hasText:'Registro histórico de exemplo'}).innerText();
 assert.ok(legacy.includes('07:45 · glúteo esquerdo'),'bounded saved historical context survives the actual loader and renderer');
 await page.screenshot({path:`artifacts/production-integration/legacy-context-${width}.png`,fullPage:true});
 await page.evaluate(()=>{
  window.__statusOverrides['health-polar-connection'].last_scheduled_sync_at='2001-04-04T07:15:00Z';
  window.__statusOverrides['health-auto-export-connection'].last_received_at='2001-04-04T08:20:00Z';
  location.hash='dados';
 });
 await page.waitForFunction(()=>document.querySelector('[data-connections]')?.textContent.includes('04/04/2001, 04:15:00'));
 assert.ok((await page.locator('[data-health-auto-export]').innerText()).includes('04/04/2001, 05:20:00'),'returning to Sources refreshes its receipt status');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'source dates fit '+width);
 assert.deepEqual(await page.evaluate(()=>window.__healthQA.writes),[],'status refresh and historical reading cannot mutate records or renew authorisation');
 await page.locator('#logoutBtn').click();await page.locator('#login:not(.hidden)').waitFor();
 assert.equal(await page.locator('#app').evaluate(e=>e.classList.contains('hidden')),true);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[],'no unexpected external request');await page.close();
}
// Missing real session must remain at login, not enter fixture or render data.
const page=await browser.newPage();
await page.route('**/*',route=>{
 if(new URL(route.request().url()).origin===parsed.origin)return route.continue();
 if(route.request().url().includes('@supabase/supabase-js'))return route.fulfill({contentType:'application/javascript',body:"window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})}"});
 return route.abort();
});
await page.goto(base);await page.locator('#login:not(.hidden)').waitFor();
assert.equal(await page.locator('#app').evaluate(e=>e.classList.contains('hidden')),true);
await browser.close();console.log('Production entry at 320/393/1440px, 10 routes, status refresh/reentry, separate source coverage, literal historical context, logout, absent-session auth and operational forms passed; synthetic authenticated SDK only; no external writes.');
