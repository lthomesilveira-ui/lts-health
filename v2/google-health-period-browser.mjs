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
   window.__googlePeriodCalls=[];window.__googleAvailabilityMode='historical';window.__googleMethodsMode='empty';const create=window.supabase.createClient;
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
      const recent=window.__googleAvailabilityMode==='recent',invalid=window.__googleAvailabilityMode==='invalid',undated=window.__googleAvailabilityMode==='undated',day=recent?body.from:new Date(Date.parse(body.from)-86400000).toISOString().slice(0,10);
      return{data:{inspected:true,bounded:true,mode:'read_only',data_type:'hydration-log',from:body.from,to_exclusive:body.to,max_points_per_probe:25,canonical_updated:false,water_received:false,
       probes:['civil_window','latest_all_sources','latest_default_sources'].map((kind,i)=>({kind,observations:invalid?26:i?1:0,recent_observations:recent&&i?1:0,undated_observations:undated&&i?1:0,first_day:i&&!undated?day:null,last_day:i&&!undated?day:null,truncated:false,sources:[]}))},error:null};
     }
     if(body.action==='inspect-hydration-methods'&&body.physical_time===true&&Object.keys(body).sort().join(',')==='action,from,physical_time,to'){
      const mode=window.__googleMethodsMode;
      return{data:{inspected:true,bounded:true,mode:'read_only',data_type:'hydration-log',from:body.from,to_exclusive:body.to,max_points_per_probe:25,physical_time_included:true,canonical_updated:false,water_received:false,
       probes:['reconciled_window','daily_rollup_window','physical_rollup_window'].map((kind,i)=>mode==='unavailable'&&!i?{kind,status:'unavailable',error_code:'provider_request_rejected'}:
        {kind,status:'ok',observations:mode==='invalid'?26:mode==='recent'||mode==='physical-only'&&i===2?1:0,recent_observations:mode==='recent'||mode==='physical-only'&&i===2?1:0,undated_observations:0,empty_intervals:mode==='recent'||mode==='physical-only'&&i===2?0:i?Math.min(7,(Date.parse(body.to)-Date.parse(body.from))/86400000):0,first_day:mode==='recent'||mode==='physical-only'&&i===2?body.from:null,last_day:mode==='recent'||mode==='physical-only'&&i===2?body.from:null,truncated:false})},error:null};
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
   assert.equal(await page.evaluate(()=>window.__googlePeriodCalls.some(call=>call.action==='inspect-hydration-methods')),false);
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
   await page.evaluate(()=>{window.__googleAvailabilityMode='undated';});
   if(!await availability.isVisible())await card.getByText('Conferir disponibilidade da água',{exact:true}).click();
   await availability.click();
   await card.getByRole('status').filter({hasText:'Há registros de água sem data local verificável. Não foi possível confirmar o período'}).waitFor();
   assert.doesNotMatch(await card.getByRole('status').innerText(),/não disponibilizou água/);
   await page.evaluate(()=>{window.__googleAvailabilityMode='invalid';});
   if(!await availability.isVisible())await card.getByText('Conferir disponibilidade da água',{exact:true}).click();
   await availability.click();
   await card.getByRole('status').filter({hasText:'Não foi possível conferir a disponibilidade da água agora.'}).waitFor();
   const availabilityCalls=await page.evaluate(()=>window.__googlePeriodCalls.filter(call=>call.action==='inspect-hydration'));
   assert.equal(availabilityCalls.length,4);assert.ok(availabilityCalls.every(call=>(Date.parse(call.to)-Date.parse(call.from))/86400000===7));
   const methods=card.getByRole('button',{name:'Comparar outras leituras de água',exact:true});
   for(const mode of ['empty','recent','unavailable','invalid','physical-only']){
    await page.evaluate(value=>{window.__googleMethodsMode=value;},mode);
    if(!await methods.isVisible())await card.getByText('Conferir disponibilidade da água',{exact:true}).click();
    const box=await methods.boundingBox();assert.ok(box&&box.height>=44&&box.x>=0&&box.x+box.width<=width+1);
    await methods.click();
    await card.getByRole('status').filter({hasText:mode==='invalid'?'Não foi possível comparar as outras leituras de água agora.':mode==='unavailable'?'o Google não permitiu concluir esta leitura':mode==='physical-only'?'Totais por intervalos de 24 horas: o Google retornou informação de água; a origem ainda precisa ser conferida':mode==='recent'?'o Google retornou informação de água; a origem ainda precisa ser conferida':'Totais por dia: o Google não retornou informação de água no período.'}).waitFor();
    assert.doesNotMatch(await card.getByRole('status').innerText(),/0 mL|0 ml|consumo zero/);
    if(mode==='unavailable')assert.doesNotMatch(await card.getByRole('status').innerText(),/Registros entre fontes: o Google não retornou/);
    if(mode==='empty')await card.screenshot({path:`${dir}/${engineName}-${width}-water-methods.png`});
   }
   const methodCalls=await page.evaluate(()=>window.__googlePeriodCalls.filter(call=>call.action==='inspect-hydration-methods'));
   assert.equal(methodCalls.length,5);assert.ok(methodCalls.every(call=>call.physical_time===true&&(Date.parse(call.to)-Date.parse(call.from))/86400000===7));
   const periodButton=card.getByRole('button',{name:'Comparar disponibilidade neste período',exact:true});
   if(!await periodButton.isVisible())await card.getByText('Consultar outro período',{exact:true}).click();
   await card.getByLabel('Data inicial',{exact:true}).fill('2030-10-14');
   await card.getByLabel('Data final',{exact:true}).fill('2030-10-25');
   await periodButton.click();
   await card.getByRole('status').filter({hasText:'com até 7 dias para comparar a disponibilidade'}).waitFor();
   assert.equal(await page.evaluate(()=>window.__googlePeriodCalls.filter(call=>call.action==='inspect-hydration-methods').length),5);
   if(!await periodButton.isVisible())await card.getByText('Consultar outro período',{exact:true}).click();
   await card.getByLabel('Data final',{exact:true}).fill('2030-10-15');
   const periodBox=await periodButton.boundingBox();assert.ok(periodBox&&periodBox.height>=44&&periodBox.x>=0&&periodBox.x+periodBox.width<=width+1);
   await periodButton.click();
   await card.getByRole('status').filter({hasText:'De 14/10/2030 a 15/10/2030.'}).waitFor();
   const historical=await page.evaluate(()=>window.__googlePeriodCalls.filter(call=>call.action==='inspect-hydration-methods').at(-1));
   assert.deepEqual(historical,{action:'inspect-hydration-methods',from:'2030-10-14',to:'2030-10-16',physical_time:true});
   assert.match(await card.getByRole('status').innerText(),/Totais por intervalos de 24 horas: o Google retornou/);
   await card.screenshot({path:`${dir}/${engineName}-${width}-water-history-methods.png`});
   assert.equal(await page.evaluate(()=>JSON.stringify(window.__historyDb)),before);
   assert.deepEqual(traffic,{external:[],writes:[],errors:[]});
   results.push({engine:engineName,width,status:'passed',zeroWrites:true,physicalIPhone:false});
  }catch(error){await page.screenshot({path:`${dir}/${engineName}-${width}-failed.png`}).catch(()=>{});results.push({engine:engineName,width,status:'failed',message:error.message});}
  finally{await context.close();writeFileSync(`${dir}/results.json`,JSON.stringify(results,null,2));}
 }}finally{await browser.close();}
}
assert.ok(results.every(result=>result.status==='passed'),JSON.stringify(results.filter(result=>result.status!=='passed')));
console.log('Google bounded period: actual app wiring, exclusive end, empty without zero, invalid dates, unchanged records, desktop and mobile browsers passed.');
