import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';
import {makeCalendarReportFixture,calendarReportService} from '../preview/compact-evidence/tests/calendar-report-fixture.mjs';

assert.ok(process.env.CI,'Use the existing approved repository CI environment');
const base='http://127.0.0.1:4173/v2/',dir='artifacts/google-health-period';
mkdirSync(dir,{recursive:true});
const results=[];
for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch();
 try{for(const width of [320,390,1440]){
  const fixture=makeCalendarReportFixture(),traffic={external:[],writes:[],errors:[]};
  const service=calendarReportService(fixture)+`\n(()=>{
   window.__googlePeriodCalls=[];window.__googleAvailabilityMode='historical';const create=window.supabase.createClient;
   window.supabase.createClient=(...args)=>{const client=create(...args),invoke=client.functions.invoke;
    client.functions.invoke=async(name,{body})=>{
     if(name!=='health-google-connection'){
      if(['health-polar-connection','health-auto-export-connection'].includes(name)&&body.action==='status'&&Object.keys(body).length===1)return{data:{configured:false,connected:false,received:false},error:null};
      return invoke(name,{body});
     }
     window.__googlePeriodCalls.push(structuredClone(body));
     if(body.action==='status'&&Object.keys(body).length===1)return{data:{configured:true,connected:true,last_scheduled_attempt_at:'2030-10-27T14:36:00Z',last_scheduled_read_at:'2030-10-27T14:36:02Z',scheduled_result:{from:'2030-10-21',to_exclusive:'2030-10-28',observations:0,empty:true}},error:null};
     if(body.action==='read'&&Object.keys(body).sort().join(',')==='action,from,to')return{data:{read:true,observations:0,empty:true,canonical_updated:false},error:null};
     if(body.action==='inspect-nutrition'&&Object.keys(body).sort().join(',')==='action,from,to')return{data:{inspected:true,complete:true,data_type:'nutrition-log',from:body.from,to_exclusive:body.to,observations:0,canonical_updated:false,water_received:false},error:null};
     if(body.action==='inspect-hydration'&&Object.keys(body).sort().join(',')==='action,from,to'){
      const recent=window.__googleAvailabilityMode==='recent',invalid=window.__googleAvailabilityMode==='invalid',day=recent?body.from:new Date(Date.parse(body.from)-86400000).toISOString().slice(0,10);
      return{data:{inspected:true,bounded:true,mode:'read_only',data_type:'hydration-log',from:body.from,to_exclusive:body.to,max_points_per_probe:25,canonical_updated:false,water_received:false,
       probes:['civil_window','latest_all_sources','latest_default_sources'].map((kind,i)=>({kind,observations:invalid?26:i?1:0,recent_observations:recent&&i?1:0,undated_observations:0,first_day:i?day:null,last_day:i?day:null,truncated:false,sources:[]}))},error:null};
     }
     throw Error('Unexpected synthetic Google operation');
    };return client;
   };
  })();`;
  const context=await browser.newContext({viewport:{width,height:width<840?844:1000},isMobile:width<840,hasTouch:width<840,locale:'pt-BR',timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.href==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'&&request.method()==='GET')return route.fulfill({contentType:'application/javascript',body:service});
   if(url.origin==='http://127.0.0.1:4173'&&['GET','HEAD'].includes(request.method()))return route.continue();
   traffic[!['GET','HEAD'].includes(request.method())?'writes':'external'].push(url.origin);return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>traffic.errors.push(e.message));
  try{
   await page.goto(base+'#dados');const card=page.locator('[data-google-health]');
   await card.getByText('Conta autorizada',{exact:true}).waitFor();
   const before=await page.evaluate(()=>JSON.stringify(window.__historyDb));
   assert.equal(await page.evaluate(()=>window.__googlePeriodCalls.some(call=>call.action==='read')),false);
   assert.equal(await page.evaluate(()=>window.__googlePeriodCalls.some(call=>call.action==='inspect-nutrition')),false);
   assert.equal(await page.evaluate(()=>window.__googlePeriodCalls.some(call=>call.action==='inspect-hydration')),false);
   await card.getByText('Última consulta automática: 27/10/2030, 11:36 (Brasília).',{exact:true}).waitFor();
   await card.getByText('De 21/10/2030 a 27/10/2030, o Google não retornou registros de água. Dias sem registro continuam sem informação.',{exact:true}).waitFor();
   await card.getByText('Consultar outro período',{exact:true}).click();
   await card.getByLabel('Data inicial',{exact:true}).fill('2030-10-14');
   await card.getByLabel('Data final',{exact:true}).fill('2030-10-25');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   for(const control of await card.locator('input:visible,button:visible').all()){
    const box=await control.boundingBox();assert.ok(box&&box.height>=44&&box.x>=0&&box.x+box.width<=width+1);
   }
   await card.screenshot({path:`${dir}/${engineName}-${width}-period.png`});
   await card.getByRole('button',{name:'Conferir água deste período',exact:true}).click();
   await card.getByRole('status').filter({hasText:'De 14/10/2030 a 25/10/2030, o Google Health não retornou registros de água.'}).waitFor();
   assert.deepEqual(await page.evaluate(()=>window.__googlePeriodCalls.filter(call=>call.action==='read')),[{action:'read',from:'2030-10-14',to:'2030-10-26'}]);
   assert.doesNotMatch(await card.innerText(),/0 mL|0 ml|consumo zero/);
   if(!await card.locator('details.googleHealthPeriod').evaluate(element=>element.open))await card.getByText('Consultar outro período',{exact:true}).click();
   assert.equal(await card.getByLabel('Data inicial',{exact:true}).inputValue(),'2030-10-14');
   await card.getByLabel('Data final',{exact:true}).fill('2030-11-25');
   await card.getByRole('button',{name:'Conferir água deste período',exact:true}).click();
   await card.getByRole('status').filter({hasText:'Escolha uma data inicial e uma final, em ordem, com até 31 dias no período.'}).waitFor();
   assert.equal(await page.evaluate(()=>window.__googlePeriodCalls.filter(call=>call.action==='read').length),1);
   await card.getByText('Comparar chegada da alimentação',{exact:true}).click();
   await card.getByRole('button',{name:'Conferir alimentação no Google',exact:true}).click();
   await card.getByRole('status').filter({hasText:'o Google também não retornou registros de alimentação. Isso não informa o que está salvo no MyFitnessPal.'}).waitFor();
   const inspections=await page.evaluate(()=>window.__googlePeriodCalls.filter(call=>call.action==='inspect-nutrition'));
   assert.equal(inspections.length,1);assert.equal((Date.parse(inspections[0].to)-Date.parse(inspections[0].from))/86400000,7);
   assert.doesNotMatch(await card.innerText(),/0 mL|0 ml|consumo zero/);
   await card.screenshot({path:`${dir}/${engineName}-${width}-source.png`});
   await card.getByText('Conferir disponibilidade da água',{exact:true}).click();
   const availability=card.getByRole('button',{name:'Conferir disponibilidade no Google',exact:true});
   const availabilityBox=await availability.boundingBox();assert.ok(availabilityBox&&availabilityBox.height>=44&&availabilityBox.x>=0&&availabilityBox.x+availabilityBox.width<=width+1);
   await availability.click();
   await card.getByRole('status').filter({hasText:'Entre os registros retornados, a data mais recente é'}).waitFor();
   assert.doesNotMatch(await card.innerText(),/0 mL|0 ml|consumo zero/);
   assert.equal(await page.evaluate(()=>window.__googlePeriodCalls.filter(call=>call.action==='inspect-hydration').length),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await card.screenshot({path:`${dir}/${engineName}-${width}-water-availability.png`});
   await page.evaluate(()=>{window.__googleAvailabilityMode='recent';});
   if(!await availability.isVisible())await card.getByText('Conferir disponibilidade da água',{exact:true}).click();
   await availability.click();
   await card.getByRole('status').filter({hasText:'A origem ainda precisa ser conferida; nenhum valor foi incluído nos totais.'}).waitFor();
   await page.evaluate(()=>{window.__googleAvailabilityMode='invalid';});
   if(!await availability.isVisible())await card.getByText('Conferir disponibilidade da água',{exact:true}).click();
   await availability.click();
   await card.getByRole('status').filter({hasText:'Não foi possível conferir a disponibilidade da água agora.'}).waitFor();
   const availabilityCalls=await page.evaluate(()=>window.__googlePeriodCalls.filter(call=>call.action==='inspect-hydration'));
   assert.equal(availabilityCalls.length,3);assert.ok(availabilityCalls.every(call=>(Date.parse(call.to)-Date.parse(call.from))/86400000===7));
   assert.equal(await page.evaluate(()=>JSON.stringify(window.__historyDb)),before);
   assert.deepEqual(traffic,{external:[],writes:[],errors:[]});
   results.push({engine:engineName,width,status:'passed',zeroWrites:true,physicalIPhone:false});
  }catch(error){await page.screenshot({path:`${dir}/${engineName}-${width}-failed.png`}).catch(()=>{});results.push({engine:engineName,width,status:'failed',message:error.message});}
  finally{await context.close();writeFileSync(`${dir}/results.json`,JSON.stringify(results,null,2));}
 }}finally{await browser.close();}
}
assert.ok(results.every(result=>result.status==='passed'),JSON.stringify(results.filter(result=>result.status!=='passed')));
console.log('Google bounded period: actual app wiring, exclusive end, empty without zero, invalid dates, unchanged records, desktop and mobile browsers passed.');
