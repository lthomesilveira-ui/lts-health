import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {healthDashboardModel} from '../src/health-dashboard-model.js';
import {documentedNutritionPlanProjection,nutritionPlanFields} from '../src/documented-nutrition-plan.js';
import {FIXED_TODAY,METRIC_KEYS,makeDashboardFixture,dateLabel,numberLabel} from './health-dashboard-render-test.mjs';
import {syntheticNutritionPlanRow} from './documented-nutrition-plan-fixture.mjs';

// Synthetic browser acceptance only. The SDK is replaced before execution;
// outbound traffic and backend mutations are blocked. No real login or records.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/';
const origin=new URL(base);
assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname),'Synthetic browser QA is restricted to loopback');
assert.equal(origin.protocol,'http:');
assert.ok(origin.pathname.endsWith('/preview/compact-evidence/'),'Only the isolated preview may be tested');
assert.equal(origin.search,'');assert.equal(origin.hash,'');
const executablePath=process.env.LTS_LOCAL_CHROMIUM_EXECUTABLE;
assert.ok(!process.env.CI||!executablePath,'CI uses the pinned Playwright browser, without a local override');
const dir=process.env.LTS_NUTRITION_PLAN_EVIDENCE_DIR||'nutrition-plan-visual';mkdirSync(dir,{recursive:true});
const fields=nutritionPlanFields.map(field=>field.key),results=[];
const format=value=>value.toLocaleString('pt-BR',{maximumFractionDigits:10});
const sourceKey=label=>JSON.stringify(['nutrition',label.toLowerCase(),'canonical']);
const injection='<img src="synthetic-invalid" onerror="globalThis.__planInjection=1">';

function fixture(){
  const f=makeDashboardFixture();
  for(const row of f.data.nutrition){
    const age=Math.round((Date.parse(FIXED_TODAY)-Date.parse(row.nutrition_date))/86400000),offset=row.source==='Synthetic B food'?400:0;
    Object.assign(row,{carbs_g:age===2?null:age?200+age+offset:105+offset,fat_g:age===5?null:age?50+age+offset/10:30+offset/10,fiber_g:age===0||age===1?0:10+age+offset/100,knownPartial:age===3});
    if(age===0)Object.assign(row,{calories_kcal:950+offset,protein_g:65+offset/10,water_ml:1350+offset});
  }
  f.data.nutrition.push({source_record_id:'synthetic-old-food',nutrition_date:f.date(60),source:'Synthetic older food',calories_kcal:1700,protein_g:90,carbs_g:180,fat_g:50,fiber_g:22,water_ml:1600});
  // Separate sourceMetrics mirrors must never be added to nutrition rows.
  for(const row of f.data.nutrition.filter(row=>row.source==='Synthetic A food'&&row.nutrition_date>=f.date(7))){
    for(const [key,type,unit] of [['calories_kcal','dietary_energy_kcal','kcal'],['protein_g','dietary_protein_g','g'],['carbs_g','dietary_carbs_g','g'],['fat_g','dietary_fat_g','g'],['fiber_g','dietary_fiber_g','g']])f.data.sourceMetrics.push({source_record_id:`synthetic-mirror-${key}-${row.nutrition_date}`,metric_date:row.nutrition_date,metric_type:type,value:row[key],unit,source_name:row.source,source_family:'synthetic mirror',canonical_status:'canonical',knownPartial:row.knownPartial});
  }
  const plan=syntheticNutritionPlanRow(FIXED_TODAY,'synthetic-plan-browser-latest');
  plan.nutrition_plan.author.name=`Synthetic logo ${injection}`;
  plan.nutrition_plan.meals[0].items[0].name=`Synthetic food <script>globalThis.__planInjection=1</script>`;
  plan.nutrition_plan.meals[0].items[0].note='Synthetic note with "quotes" & <text>';
  plan.source_file='Synthetic plan "quoted" & <source>.pdf';
  f.data.nutritionPlans=[syntheticNutritionPlanRow(f.date(30),'synthetic-plan-browser-older','b'.repeat(64)),plan];
  f.status.nutritionPlans='ready';
  f.data.meals=[{source_record_id:'synthetic-old-meal',meal_date:f.date(40),meal_name:'Synthetic old meal detail',source:'Synthetic A food',calories_kcal:500,protein_g:25,carbs_g:50,fat_g:15,record_status:'validated'}];
  f.db.health_daily_nutrition=structuredClone(f.data.nutrition);
  f.db.health_source_daily_metrics=structuredClone(f.data.sourceMetrics);
  f.db.health_nutrition_meals=structuredClone(f.data.meals);
  f.db.health_documents.push(...structuredClone(f.data.nutritionPlans));
  return f;
}
function service(db){return `
window.__healthQA={reads:[],writes:[]};window.__reviewDb=${JSON.stringify(db)};
const mutation=(kind,target)=>{window.__healthQA.writes.push({kind,target});throw new Error('Synthetic QA forbids writes: '+kind+' '+target);};
window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-plan-browser-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 functions:{invoke:name=>mutation('invoke',name)},rpc:name=>mutation('rpc',name),storage:{from:name=>({upload:()=>mutation('upload',name),remove:()=>mutation('remove',name)})},
 from(table){let from=0,to=999,projection='*';const filters=[],orders=[];
 const rows=()=>{let selected=(window.__reviewDb[table]||[]).filter(row=>filters.every(([key,value])=>row[key]===value));if(orders.length)selected=selected.slice().sort((a,b)=>{for(const[key,asc]of orders){const result=String(a[key]??'').localeCompare(String(b[key]??''));if(result)return asc?result:-result;}return 0;});return selected;};
 const record=()=>window.__healthQA.reads.push({table,projection,filters:filters.map(pair=>pair.slice()),from,to});
 const q={select(value){projection=value;return q;},eq(key,value){filters.push([key,value]);return q;},is(key,value){filters.push([key,value]);return q;},range(a,b){from=a;to=b;return q;},order(key,options={}){orders.push([key,options.ascending!==false]);return q;},limit(n){to=from+n-1;return q;},maybeSingle:async()=>{record();const selected=rows();return selected.length>1?{data:null,error:{message:'Multiple synthetic rows'}}:{data:selected[0]||null,error:null};},then(resolve,reject){record();return Promise.resolve({data:rows().slice(from,to+1),error:null}).then(resolve,reject);}};
 for(const name of ['insert','update','upsert','delete'])q[name]=()=>mutation(name,table);return q;}
})};`;}
async function stableHome(page){
  await page.waitForFunction(()=>{
    const root=document.querySelector('[data-health-dashboard]');
    if(!root||document.querySelector('#syncText')?.textContent!=='Atualizado'||document.querySelector('#screenHost')?.dataset.productLayoutRoute!=='hoje')return false;
    if(window.__qaPlanRoot!==root){window.__qaPlanRoot=root;window.__qaPlanFrames=0;}
    return ++window.__qaPlanFrames>=3;
  });
}
async function open(page,disclosure){const detail=page.locator(`[data-disclosure="${disclosure}"]`);if(!await detail.evaluate(el=>el.open))await detail.locator(':scope > summary').click();assert.equal(await detail.evaluate(el=>el.open),true);}
async function selectPeriod(page,period){await page.locator('[data-dashboard-period]').selectOption(period);await stableHome(page);assert.equal(await page.locator('[data-dashboard-period]').inputValue(),period);}
async function day(page,date){if(await page.locator('[data-dashboard-mode="day"]').getAttribute('aria-pressed')!=='true'){await page.locator('[data-dashboard-mode="day"]').click();await stableHome(page);}await page.locator('[data-dashboard-date]').fill(date);await page.locator('[data-dashboard-date]').dispatchEvent('change');await stableHome(page);}
async function assertGrid(page,f,ui={}){
  const dashboard=healthDashboardModel(f.data,f.status,ui,FIXED_TODAY);
  assert.deepEqual(await page.locator('[data-dashboard-card]').evaluateAll(nodes=>nodes.map(node=>node.dataset.dashboardCard)),METRIC_KEYS,'the existing seven metric cards remain unchanged');
  for(const key of METRIC_KEYS)assert.equal((await page.locator(`[data-dashboard-card="${key}"] .healthMetricValue strong`).innerText()).trim(),numberLabel(dashboard.metricsByKey[key].value,key),`${key}: existing summary value is unchanged`);
}
function expected(f,key,{source='Synthetic A food',waterSource=source,mode='period',period='7',date=FIXED_TODAY}={}){
  const start=mode==='day'?date:f.date(Number(period)),end=mode==='day'?date:f.date(1);
  const rows=f.data.nutrition.filter(row=>row.source===(key==='water_ml'?waterSource:source)&&row.nutrition_date>=start&&row.nutrition_date<=end&&row[key]!=null&&(mode==='day'||!row.knownPartial));
  return {value:rows.length?rows.reduce((sum,row)=>sum+row[key],0)/(mode==='day'?1:rows.length):null,count:rows.length,expectedDays:mode==='day'?1:Number(period)};
}
async function assertPlan(page,f,ui={}){
  const card=page.locator('[data-nutrition-plan]');assert.equal(await card.getAttribute('data-plan-state'),'ready');
  assert.deepEqual(await card.locator('[data-plan-metric]').evaluateAll(nodes=>nodes.map(node=>node.dataset.planMetric)),fields);
  for(const {key,unit} of nutritionPlanFields){
    const metric=card.locator(`[data-plan-metric="${key}"]`),e=expected(f,key,ui),target=f.data.nutritionPlans.at(-1).nutrition_plan.daily_targets[key].value;
    assert.equal(await metric.locator(':scope > div:nth-child(2) > b').innerText(),e.value==null?'Sem dado':`${format(e.value)} ${unit}`,`${key}: independent observed value, never summed with mirrors`);
    assert.match(await metric.innerText(),new RegExp(`${e.count}/${e.expectedDays} dias com valor elegível`),`${key}: own observed-day coverage`);
    assert.ok((await metric.locator(':scope > div:first-child').innerText()).includes(`Referência diária: ${format(target)} ${unit}`));
    if(e.value!=null){const percentage=(e.value/target*100).toLocaleString('pt-BR',{maximumFractionDigits:1}),delta=e.value-target;assert.ok((await metric.innerText()).includes(`${percentage}% da referência`));assert.ok((await metric.innerText()).includes(`diferença ${delta>0?'+':''}${format(delta)} ${unit}`));}
  }
}
async function quality(page,label){
  const layout=await page.evaluate(()=>{const card=document.querySelector('[data-nutrition-plan]'),host=document.querySelector('#screenHost');return {viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,card:{width:card.clientWidth,scroll:card.scrollWidth},host:{width:host.clientWidth,scroll:host.scrollWidth}};});
  assert.ok(layout.document<=layout.viewport+1&&layout.body<=layout.viewport+1&&layout.card.scroll<=layout.card.width+1&&layout.host.scroll<=layout.host.width+1,`${label}: no horizontal overflow ${JSON.stringify(layout)}`);
  const small=await page.locator('[data-nutrition-plan]').evaluate(root=>[...root.querySelectorAll('button,select,summary')].filter(el=>!el.disabled&&el.checkVisibility({checkVisibilityCSS:true})).flatMap(el=>{const r=el.getBoundingClientRect();return r.width>=43.5&&r.height>=43.5?[]:[{tag:el.tagName,id:el.id,width:r.width,height:r.height}];}));
  assert.deepEqual(small,[],`${label}: all visible plan controls are at least 44 × 44 CSS pixels`);
  assert.doesNotMatch(await page.locator('[data-nutrition-plan]').innerText(),/\b(?:NaN|undefined|Infinity)\b/);
  assert.equal(await page.locator('[data-nutrition-plan] img,[data-nutrition-plan] script').count(),0,'document text is never executable markup');
  assert.equal(await page.evaluate(()=>globalThis.__planInjection),undefined);
  return layout;
}
async function capture(page,name){await page.locator('[data-nutrition-plan]').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${name}-viewport.png`,animations:'disabled'});await page.locator('[data-nutrition-plan]').screenshot({path:`${dir}/${name}-card.png`,animations:'disabled'});}
async function probeStates(page,f){
  for(const [state,status,rows] of [['loading','loading',f.data.nutritionPlans],['error','error',f.data.nutritionPlans],['empty','ready',[]],['invalid','ready',[f.data.nutritionPlans[0],{...f.data.nutritionPlans[1],checksum:'invalid'}]]]){
    await page.evaluate(async({status,rows})=>{const {state}=await import('./src/core.js');const {renderHealthDashboard}=await import('./src/health-dashboard.js');state.domainStatus.nutritionPlans=status;state.data.nutritionPlans=rows;document.querySelector('#screenHost').innerHTML=renderHealthDashboard(state.data,state.domainStatus,state.ui);},{status,rows});
    await page.waitForSelector(`[data-nutrition-plan][data-plan-state="${state}"]`);
    assert.equal(await page.locator('[data-plan-metric]').count(),0,`${state}: stale comparison is withheld`);
    assert.equal(await page.locator('[data-dashboard-card]').count(),7,`${state}: existing dashboard remains available`);
    await quality(page,`state/${state}`);
    await capture(page,`desktop-${state}`);
  }
}

const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
  for(const [label,width,height] of [['small',320,740],['mobile',393,844],['desktopNarrow',1180,757],['desktop',1440,900]]){
    const f=fixture(),context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<=840,hasTouch:width<=840,timezoneId:'America/Sao_Paulo',serviceWorkers:'block'}),external=[],networkWrites=[],errors=[];
    await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2'&&request.method()==='GET')return route.fulfill({status:200,contentType:'application/javascript',body:service(f.db)});if(url.origin===origin.origin&&['GET','HEAD'].includes(request.method()))return route.continue();if(!['GET','HEAD'].includes(request.method()))networkWrites.push({url:request.url(),method:request.method()});else external.push(request.url());return route.abort('blockedbyclient');});
    const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('net::ERR_BLOCKED_BY_CLIENT'))errors.push(message.text());});await page.clock.setFixedTime(new Date(`${FIXED_TODAY}T15:00:00Z`));
    try{
      await page.goto(base+'#hoje');await stableHome(page);await assertGrid(page,f);
      assert.equal(await page.locator('[data-nutrition-plan]').getAttribute('data-plan-state'),'retrospective_required');
      assert.equal(await page.locator('[data-disclosure="nutrition-plan-comparison"]').evaluate(el=>el.open),false,'new plan card starts collapsed');
      assert.equal(await page.locator('.nutritionPlanTargets > span').count(),6);assert.match(await page.locator('.nutritionPlanTitle').innerText(),/Início de uso não informado/);
      assert.ok((await page.locator('.nutritionPlanTitle').innerText()).includes(dateLabel(FIXED_TODAY)));
      assert.equal(await page.locator('.nutritionPlanTargets').innerText().then(text=>text.includes('% da referência')),false,'no retrospective percentages before opt-in');
      await quality(page,`${label}/collapsed`);await capture(page,`${label}-collapsed`);
      await open(page,'nutrition-plan-comparison');assert.equal(await page.locator('[data-plan-retrospective]').getAttribute('aria-pressed'),'false');
      for(const key of fields)assert.equal(await page.locator(`[data-plan-metric="${key}"] > div:nth-child(2) > b`).innerText(),'Sem dado');
      await page.locator('[data-plan-retrospective]').click();await stableHome(page);await assertPlan(page,f);await assertGrid(page,f);
      assert.match(await page.locator('[data-nutrition-plan]').innerText(),/Retrospectiva com o plano recebido.*não indica adesão passada/);
      assert.equal(await page.locator('[data-plan-retrospective]').getAttribute('aria-pressed'),'true');
      assert.match(await page.locator('.nutritionPlanDetailNotice').innerText(),/Comparação por alimento ou refeição indisponível/);assert.ok((await page.locator('.nutritionPlanDetailNotice').innerText()).includes(dateLabel(f.date(40))));
      await quality(page,`${label}/period-expanded`);await capture(page,`${label}-expanded`);
      await open(page,'nutrition-plan-meals');await open(page,'nutrition-plan-provenance');
      assert.equal(await page.locator('.nutritionPlanMeal').count(),3,'two prescribed meals plus one alternative, never a combined meal');
      assert.match(await page.locator('[data-disclosure="nutrition-plan-meals"]').innerText(),/Alternativa a Synthetic morning meal; não somada à refeição principal/);
      assert.match(await page.locator('.nutritionPlanMeal').last().innerText(),/Fibras: não informado/);
      assert.ok((await page.locator('[data-disclosure="nutrition-plan-provenance"]').innerText()).includes(injection),'HTML-looking author text is shown literally');
      assert.match(await page.locator('[data-disclosure="nutrition-plan-provenance"]').innerText(),/Assinatura não verificada/);
      await assertPlan(page,f);await quality(page,`${label}/document-details`);await capture(page,`${label}-details`);
      // Explicit plan food choice survives period and day changes, without
      // changing the independently selected water or seven-card overview.
      const foodB=sourceKey('Synthetic B food'),oldFood=sourceKey('Synthetic older food');
      await page.locator('[data-plan-food-source]').selectOption(foodB);await stableHome(page);await assertPlan(page,f,{source:'Synthetic B food',waterSource:'Synthetic A food'});await assertGrid(page,f);
      await selectPeriod(page,'30');await assertPlan(page,f,{source:'Synthetic B food',waterSource:'Synthetic A food',period:'30'});assert.equal(await page.locator('[data-plan-food-source]').inputValue(),foodB);
      await selectPeriod(page,'7');await page.locator('[data-plan-food-source]').selectOption(oldFood);await stableHome(page);await assertPlan(page,f,{source:'Synthetic older food',waterSource:'Synthetic A food'});
      await day(page,f.date(2));assert.equal(await page.locator('[data-plan-food-source]').inputValue(),oldFood);await assertPlan(page,f,{source:'Synthetic older food',waterSource:'Synthetic A food',mode:'day',date:f.date(2)});
      await page.locator('[data-plan-retrospective]').click();await stableHome(page);assert.equal(await page.locator('[data-nutrition-plan]').getAttribute('data-plan-state'),'retrospective_required','historical day requires explicit opt-in again after revocation');
      await page.locator('[data-plan-retrospective]').click();await stableHome(page);
      await page.locator('[data-plan-food-source]').selectOption(sourceKey('Synthetic A food'));await stableHome(page);await page.locator('#dashboard-today').click();await stableHome(page);
      await assertPlan(page,f,{mode:'day'});await assertGrid(page,f,{dashboardMode:'day',dashboardDate:FIXED_TODAY});
      assert.match(await page.locator('.nutritionPlanTitle').innerText(),new RegExp(`Comparação com o plano recebido ${dateLabel(FIXED_TODAY)}`));assert.match(await page.locator('.nutritionPlanWindow').innerText(),/hoje parcial/);
      assert.equal(await page.locator('[data-plan-metric="fiber_g"] > div:nth-child(2) > b').innerText(),'0 g','literal zero remains observed, with 1/1 coverage');
      for(const key of fields)assert.match(await page.locator(`[data-plan-metric="${key}"] > small`).innerText(),/1\/1 dias com valor elegível · parcial/);
      await quality(page,`${label}/today-partial`);await capture(page,`${label}-today-partial`);
      await open(page,'dashboard-metric-water');const d=healthDashboardModel(f.data,f.status,{},FIXED_TODAY),waterB=d.metricsByKey.water.sources.find(source=>source.label==='Synthetic B food').key;
      await page.locator('[data-dashboard-source="water"]').selectOption(waterB);await stableHome(page);await assertPlan(page,f,{mode:'day',waterSource:'Synthetic B food'});await assertGrid(page,f,{dashboardMode:'day',dashboardDate:FIXED_TODAY,dashboardSources:{water:waterB}});
      await page.locator('[data-dashboard-mode="period"]').click();await stableHome(page);await selectPeriod(page,'30');await page.locator('[data-plan-food-source]').selectOption(foodB);await stableHome(page);
      const routeBefore=await page.locator('.nutritionPlanMetrics').innerText();
      if(width<=840){await page.locator('#mobileNav [data-route="mais"]').click();await page.locator('#moreSheet [data-route="nutricao"]').click();}else await page.locator('#primaryNav [data-route="nutricao"]').click();
      await page.waitForURL('**/#nutricao');await page.waitForSelector('.ltsNutritionProduct [data-nutrition-plan]');await open(page,'nutrition-plan-comparison');
      assert.equal(await page.locator('[data-plan-food-source]').inputValue(),foodB);assert.equal(await page.locator('.nutritionPlanMetrics').innerText(),routeBefore,'Nutrição loads the same plan, source, water and calendar comparison');await quality(page,`${label}/nutrition-route`);await capture(page,`${label}-nutrition-route`);
      await page.locator(`${width<=840?'#mobileNav':'#primaryNav'} [data-route="hoje"]`).click();await stableHome(page);assert.equal(await page.locator('[data-plan-food-source]').inputValue(),foodB);assert.equal(await page.locator('[data-dashboard-source="water"]').inputValue(),waterB);assert.equal(await page.locator('[data-dashboard-period]').inputValue(),'30');
      if(width===1440)await probeStates(page,f);
      const guard=await page.evaluate(()=>{const client=window.supabase.createClient('synthetic','synthetic'),blocked=[];for(const [name,operation] of [['insert',()=>client.from('synthetic').insert({})],['update',()=>client.from('synthetic').update({})],['delete',()=>client.from('synthetic').delete()],['rpc',()=>client.rpc('synthetic')],['invoke',()=>client.functions.invoke('synthetic')]]){try{operation();blocked.push({name,blocked:false});}catch(error){blocked.push({name,blocked:error.code==='preview_read_only'});}}return {blocked,...window.__healthQA};});
      assert.ok(guard.blocked.every(item=>item.blocked));assert.deepEqual(guard.writes,[]);assert.deepEqual(networkWrites,[]);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
      const planReads=guard.reads.filter(read=>read.table==='health_documents'&&read.projection.includes('nutrition_plan:'));
      assert.ok(planReads.length>0,'real route loader requests the sanitized plan projection');for(const read of planReads){assert.equal(read.projection,documentedNutritionPlanProjection);assert.deepEqual(read.filters,[['document_type','nutrition_plan']]);}
      results.push({name:label,width,height,status:'passed',syntheticOnly:true,metricCount:6,originalMetricCount:7,writeCount:0,externalRequestCount:0,states:width===1440?['loading','error','empty','invalid']:[]});writeFileSync(`${dir}/results.json`,JSON.stringify({syntheticOnly:true,today:FIXED_TODAY,results},null,2));console.log(`${label}: six metrics, retrospective opt-in, current-day zero, source separation, route persistence, escaped details, 44px controls and zero writes passed.`);
    }catch(error){await page.screenshot({path:`${dir}/${label}-failure.png`,animations:'disabled'}).catch(()=>{});results.push({name:label,width,height,status:'failed',error:String(error.message),pageErrors:errors,blockedExternal:external,networkWrites});writeFileSync(`${dir}/results.json`,JSON.stringify({syntheticOnly:true,today:FIXED_TODAY,results},null,2));throw error;}finally{await context.close();}
  }
}finally{await browser.close();}
console.log('Nutrition plan browser: four synthetic responsive scenarios passed. No real authenticated session was used.');
