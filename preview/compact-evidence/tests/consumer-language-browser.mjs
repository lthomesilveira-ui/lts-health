import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {makeConsumerLanguageFixture,consumerLanguageService,LANGUAGE_TODAY,LANGUAGE_NOTE,LANGUAGE_ERROR,LANGUAGE_ROUTES,foodSourceKey,candidateSourceKey} from './consumer-language-fixture.mjs';
import {technicalMatches} from './consumer-language-html.mjs';

// Production-shaped application startup and real navigation. Only the SDK and
// auth identity are synthetic. No ?fixture, runtime DOM replacement, real data,
// credentials, external requests, storage writes or backend mutations.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/',origin=new URL(base);
assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname),'Only loopback synthetic QA is allowed');
assert.equal(origin.protocol,'http:');assert.ok(origin.pathname.endsWith('/preview/compact-evidence/'));assert.equal(origin.search,'');assert.equal(origin.hash,'');
const dir=process.env.LTS_CONSUMER_LANGUAGE_EVIDENCE_DIR||'consumer-language-visual';mkdirSync(dir,{recursive:true});
const results=[],captures=[],inventories=[],failures=[];
const roots={hoje:'[data-health-dashboard]',nutricao:'.ltsNutritionProduct',timeline:'.timelineGroups',treinos:'.ltsTrainingReference',saude:'.ltsLabsV2',tratamentos:'.screenTitle',dados:'.screenTitle',bio:'.ltsCompositionV2',evolucao:'#screenHost > :first-child',analise:'#screenHost > :first-child'};
const save=()=>writeFileSync(`${dir}/results.json`,JSON.stringify({syntheticOnly:true,authenticatedWithRealAccount:false,fixedDate:LANGUAGE_TODAY,deviceScaleFactor:1,originalResolutionScreenshots:true,results,captures,failures},null,2));
async function stable(page,route){
  await page.evaluate(()=>{window.__languageStableRoot=null;window.__languageFrames=0;});
  await page.waitForFunction(async({route,selector})=>{const{state}=await import('./src/core.js');const root=document.querySelector(selector);if(!root||state.loading||!state.loaded||state.route!==route||location.hash!==`#${route}`||document.querySelector('#screenHost .loadingState'))return false;if(window.__languageStableRoot!==root){window.__languageStableRoot=root;window.__languageFrames=0;}return ++window.__languageFrames>=3;},{route,selector:roots[route]});
}
async function navigate(page,route,width){
  const nav=width<=840?'#mobileNav':'#primaryNav',direct=page.locator(`${nav} [data-route="${route}"]`);
  if(await direct.count())await direct.click();else{await page.locator(`${nav} [data-route="mais"]`).click();await page.locator(`#moreSheet [data-route="${route}"]`).click();}
  await stable(page,route);
}
async function disclose(page,key,open=true){
  const details=page.locator(`[data-disclosure="${key}"]`);assert.equal(await details.count(),1,`${key}: disclosure exists`);
  if(await details.evaluate(el=>el.open)!==open)await details.locator(':scope > summary').click();
  assert.equal(await details.evaluate(el=>el.open),open,`${key}: native expansion works`);
}
async function primary(page,label){
  const text=await page.locator('#screenHost').innerText(),options=await page.locator('#screenHost select option').allTextContents();
  assert.deepEqual(technicalMatches(text),[],`${label}: no technical vocabulary in actual visible primary text`);
  assert.deepEqual(technicalMatches(options.join('\n')),[],`${label}: all source options have human labels`);
  assert.doesNotMatch(text,/\b(?:NaN|undefined|Infinity)\b/);
  inventories.push({label,text,options});return text;
}
async function layout(page,label){
  const report=await page.evaluate(()=>{
    const host=document.querySelector('#screenHost'),r=host.getBoundingClientRect(),nodes=[],smallControls=[];
    const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);let node;
    while(node=walker.nextNode()){
      const el=node.parentElement;if(!node.textContent.trim()||!el||el.closest('svg,select,option,script,style')||!el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}))continue;
      const range=document.createRange();range.selectNodeContents(node);
      for(const rect of range.getClientRects())if(rect.width>0&&rect.height>0&&rect.bottom>Math.max(0,r.top)&&rect.top<Math.min(innerHeight,r.bottom))nodes.push({text:node.textContent.trim().slice(0,100),left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom});
    }
    for(const el of host.querySelectorAll('button,summary,select,input')){if(el.disabled||!el.checkVisibility({checkVisibilityCSS:true}))continue;const box=el.getBoundingClientRect();if(box.width<43.5||box.height<43.5)smallControls.push({tag:el.tagName,id:el.id,text:el.textContent.trim().slice(0,100),width:box.width,height:box.height});}
    const overlaps=[];for(let a=0;a<nodes.length;a++)for(let b=a+1;b<nodes.length;b++){const x=nodes[a],y=nodes[b];if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1)overlaps.push({first:x,second:y});}
    return {viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,host:{width:host.clientWidth,scrollWidth:host.scrollWidth},overflowingText:nodes.filter(rect=>rect.left<-1||rect.right>innerWidth+1),overlaps,smallControls};
  });
  writeFileSync(`${dir}/${label}-layout.json`,JSON.stringify(report,null,2));
  const issues=[];
  if(report.documentWidth>report.viewport.width+1||report.bodyWidth>report.viewport.width+1||report.host.scrollWidth>report.host.width+1)issues.push('horizontal overflow');
  if(report.overflowingText.length)issues.push('text outside viewport');
  if(report.overlaps.length)issues.push('overlapping visible text');
  if(issues.length){failures.push({name:label,category:'layout',issues,evidence:`${label}-layout.json`});save();}
  // Continue capturing after a geometry issue so CI gives all widths/areas,
  // then fail the suite at the end. No visual defect is silently waived.
  // Inventory all controls. Strict 44px archive/plan checks are also covered by
  // their dedicated suites; do not silently add global CSS in this copy change.
  return report;
}
async function capture(page,name,selector=null){
  if(selector){const target=page.locator(selector).first();assert.ok(await target.isVisible(),`${name}: evidence is not hidden by CSS`);await target.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));}
  else await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('#screenHost')?.scrollTo(0,0);});
  await page.screenshot({path:`${dir}/${name}.png`,animations:'disabled',scale:'css'});
  const report=await layout(page,name);captures.push({name,viewport:report.viewport,originalResolution:true});save();
}
async function chooseArchiveDate(page,date){await page.locator('#nutritionArchiveDate').fill(date);await page.locator('#nutritionArchiveDate').dispatchEvent('change');await stable(page,'nutricao');assert.equal(await page.locator('#nutritionArchiveDate').inputValue(),date);}
async function chooseArchiveSource(page,key){await page.locator('#nutritionArchiveSource').selectOption(key);await stable(page,'nutricao');assert.equal(await page.locator('#nutritionArchiveSource').inputValue(),key);}
async function homeChecks(page,f,label){
  assert.equal(await page.locator('[data-dashboard-card]').count(),7,'approved seven cards stay unchanged');
  const model=await page.evaluate(async today=>{const{state}=await import('./src/core.js');const{healthDashboardModel}=await import('./src/health-dashboard-model.js');return healthDashboardModel(state.data,state.domainStatus,state.ui,today);},LANGUAGE_TODAY);
  for(const metric of model.metrics){const card=page.locator(`[data-dashboard-card="${metric.key}"]`);if(metric.value!=null)assert.equal(await card.locator('.healthMetricValue strong').innerText(),metric.value.toLocaleString('pt-BR',{minimumFractionDigits:metric.key==='sleep'?1:0,maximumFractionDigits:metric.key==='sleep'?1:0}));assert.ok((await card.locator('.healthCoverage').innerText()).includes(`${metric.count}/${metric.expectedDays}`),'coverage stays primary, not CSS-hidden');}
  if(f.kind==='empty')return;
  assert.equal(await page.locator('[data-disclosure="nutrition-plan-comparison"]').evaluate(el=>el.open),false);
  assert.match(await page.locator('.nutritionPlanTitle').innerText(),/Início de uso não informado/);
  await capture(page,`${label}-plan-collapsed`,'.nutritionPlanTitle');
  await disclose(page,'nutrition-plan-comparison');await disclose(page,'nutrition-plan-notes');
  assert.ok((await page.locator('[data-disclosure="nutrition-plan-notes"]').innerText()).includes(LANGUAGE_NOTE),'documentary note remains exactly readable, with technical-looking original words');
  await capture(page,`${label}-plan-original-note`,'[data-disclosure="nutrition-plan-notes"] > p:last-child');
  await disclose(page,'nutrition-plan-notes',false);await disclose(page,'nutrition-plan-comparison',false);
  await page.locator('[data-dashboard-mode="day"]').click();await stable(page,'hoje');assert.match(await page.locator('.healthWindow').innerText(),/hoje parcial/);await primary(page,`${label}-today`);await capture(page,`${label}-today`,'.healthWindow');
  await page.locator('[data-dashboard-date]').fill(f.date(1));await page.locator('[data-dashboard-date]').dispatchEvent('change');await stable(page,'hoje');
  for(const status of ['candidate','held']){await disclose(page,'dashboard-metric-energy');await page.locator('#dashboard-source-energy').selectOption(candidateSourceKey(status));await stable(page,'hoje');await disclose(page,'dashboard-metric-energy',false);const card=page.locator('[data-dashboard-card="energy"]');assert.match(await card.innerText(),/adicional|limita|confer|confirma|revis/i,'selected unreviewed source has a visible per-card qualification');await capture(page,`${label}-home-${status}`,'[data-dashboard-card="energy"] .healthCoverage');}
  await disclose(page,'dashboard-metric-energy');await page.locator('#dashboard-source-energy').selectOption(foodSourceKey('Synthetic A food'));await stable(page,'hoje');await disclose(page,'dashboard-metric-energy',false);
  await page.locator('[data-dashboard-mode="period"]').click();await stable(page,'hoje');
}
async function nutritionChecks(page,f,label){
  if(f.kind==='empty')return;
  const source=foodSourceKey('Synthetic A food');await chooseArchiveSource(page,source);await chooseArchiveDate(page,f.date(1));
  const diary=page.locator('#nutritionArchiveDiary');assert.match(await diary.innerText(),new RegExp(f.date(1).split('-').reverse().join('/')));
  if(f.kind==='conflict'){
    assert.equal(await diary.locator('.ltsNutritionDiaryMetrics article').count(),0,'ambiguous daily totals are withheld');assert.match(await diary.innerText(),/conflit|repetid|diferentes|diverg/i);
    await disclose(page,'nutrition-archive-raw');assert.ok((await page.locator('[data-disclosure="nutrition-archive-raw"]').innerText()).includes('6666'));await capture(page,`${label}-nutrition-conflicting-originals`,'[data-disclosure="nutrition-archive-raw"] > summary');await disclose(page,'nutrition-archive-raw',false);
  }else{assert.equal(await diary.locator('.ltsNutritionDiaryMetrics article > b').first().innerText(),'2.010 kcal');assert.equal(await diary.locator('.ltsNutritionDiaryMetrics article > b').last().innerText(),'0 g');}
  assert.equal(await diary.locator('.ltsNutritionMeals article > b').first().innerText(),'Refeição sintética registrada');await primary(page,`${label}-selected-diary`);await capture(page,`${label}-selected-diary`,'.ltsNutritionDiaryContext');
  for(const status of ['candidate','held']){
    await chooseArchiveSource(page,candidateSourceKey(status));assert.equal(await page.locator('#nutritionArchiveDate').inputValue(),f.date(1));assert.equal(await diary.locator('.ltsNutritionMeals article').count(),0,'same day does not join another source meals');assert.match(await diary.innerText(),/revis[aã]o|confer[eê]ncia|n[aã]o confirmad|n[aã]o comparad/i);await primary(page,`${label}-${status}`);await capture(page,`${label}-${status}`,'.ltsNutritionDiaryContext');
    const sourceState=await page.evaluate(async today=>{const{state}=await import('./src/core.js');const{nutritionArchiveModel}=await import('./src/nutrition-archive.js');return nutritionArchiveModel(state.data,state.domainStatus,state.ui,today).source.status;},LANGUAGE_TODAY);assert.equal(sourceState,status,'humanized labels do not promote backend status');
  }
  await chooseArchiveSource(page,source);await chooseArchiveDate(page,'2022-04-17');assert.match(await diary.innerText(),/sem registro|n[aã]o h[aá]/i);assert.equal(await diary.locator('.ltsNutritionDiaryMetrics article,.ltsNutritionMeals article').count(),0);await primary(page,`${label}-missing-date`);await capture(page,`${label}-missing-date`,'.ltsNutritionDiaryContext');await chooseArchiveDate(page,f.date(1));
}
async function dataChecks(page,f,label){
  if(f.kind==='empty')return;
  await disclose(page,'data-record-status');const diagnostic=page.locator('.technicalDiagnostic').first();assert.equal(await diagnostic.evaluate(el=>el.open),false);assert.ok(!(await page.locator('#screenHost').innerText()).includes(LANGUAGE_ERROR));await diagnostic.locator(':scope > summary').click();assert.ok((await diagnostic.innerText()).includes(LANGUAGE_ERROR));await capture(page,`${label}-technical-diagnostic`,'.technicalDiagnostic[open] > summary');await diagnostic.locator(':scope > summary').click();await disclose(page,'data-record-status',false);await primary(page,`${label}-diagnostic-closed`);
}
async function trainingChecks(page,f,label){
  await page.locator('[data-depth-training-view="exercises"]').first().click();await stable(page,'treinos');await primary(page,`${label}-exercises`);await capture(page,`${label}-exercises`);
  if(f.kind!=='empty'){
    const note=page.locator('.ltsRefExerciseNotes').first();assert.equal(await note.evaluate(el=>el.open),false);await note.locator(':scope > summary').click();assert.ok((await note.innerText()).includes(LANGUAGE_NOTE));await capture(page,`${label}-exercise-original-note`,'.ltsRefExerciseNotes > p');await note.locator(':scope > summary').click();
    const text=await page.locator('#screenHost').innerText();assert.match(text,/42,5|42\.5/);assert.match(text,/8 \+ 2 assistidas/);
  }
  await page.locator('[data-depth-training-view="history"]').first().click();await stable(page,'treinos');await primary(page,`${label}-training-history`);await capture(page,`${label}-training-history`);
}
async function labChecks(page,f,label){
  if(f.kind==='empty')return;
  await page.locator('#productLabMarkerSelect').selectOption('hemoglobina');await stable(page,'saude');const history=await page.locator('.ltsLabsHistoryList').innerText();assert.ok(history.includes('<4 g/dL'));assert.ok(history.includes('1,2345 g/dL'));if(f.kind==='conflict'){assert.ok(history.includes('7,8901 g/dL'));assert.match(await page.locator('.ltsLabsHero').innerText(),/2 resultados|mais de um/i);}
  await primary(page,`${label}-lab-raw`);await capture(page,`${label}-lab-original-values`,'.ltsLabsHistoryList');
}
async function refreshCase(page,f,label,route,width,table,domain){
  await navigate(page,route,width);
  if(route==='nutricao'){await chooseArchiveSource(page,foodSourceKey('Synthetic A food'));await chooseArchiveDate(page,f.date(1));}
  await page.evaluate(table=>{window.__historyQA.failTable=table;},table);await page.locator('#refreshBtn').click();
  await page.waitForFunction(async domain=>{const{state}=await import('./src/core.js');return state.domainStatus[domain]==='error'&&!state.loading;},domain);await stable(page,route);
  const text=await primary(page,`${label}-refresh-${domain}`);assert.match(text,/n[aã]o.*carreg|indispon[ií]v|atualiz|parcial|n[aã]o.*poss[ií]vel/i);assert.ok(!text.includes(LANGUAGE_ERROR));
  const diagnostics=await page.evaluate(async domain=>{const{state}=await import('./src/core.js');return state.errors[domain];},domain);assert.ok(diagnostics.includes(LANGUAGE_ERROR),'technical error remains in diagnostic state');
  if(route==='nutricao'){assert.equal(await page.locator('#nutritionArchiveDate').inputValue(),f.date(1));assert.equal(await page.locator('#nutritionArchiveSource').inputValue(),foodSourceKey('Synthetic A food'));if(domain==='meals'){assert.equal(await page.locator('.ltsNutritionMeals article').count(),0);assert.equal(await page.locator('.ltsNutritionDiaryMetrics article > b').first().innerText(),'2.010 kcal');}else if(domain==='nutrition')assert.equal(await page.locator('#nutritionArchiveDiary .ltsNutritionDiaryMetrics article').count(),0);}
  await capture(page,`${label}-refresh-${domain}`,route==='nutricao'?'.ltsNutritionDiaryContext':null);
  await page.evaluate(()=>{window.__historyQA.failTable=null;});await page.locator('#refreshBtn').click();await page.waitForFunction(async domain=>{const{state}=await import('./src/core.js');return state.domainStatus[domain]==='ready'&&!state.loading;},domain);await stable(page,route);await primary(page,`${label}-recovered-${domain}`);
}
async function securityChecks(page,traffic){
  const proof=await page.evaluate(async()=>{const{state,fixtureMode}=await import('./src/core.js');const client=window.supabase.createClient('synthetic','synthetic'),guard=[];for(const operation of [()=>client.from('synthetic').insert({}),()=>client.from('synthetic').update({}),()=>client.from('synthetic').delete(),()=>client.rpc('synthetic'),()=>client.functions.invoke('synthetic'),()=>client.storage.from('synthetic').upload('synthetic',new Blob(['synthetic']))]){try{operation();guard.push(false);}catch(error){guard.push(error.code==='preview_read_only');}}return {fixtureMode,user:state.session?.user?.id,reads:window.__historyQA.reads,writes:window.__historyQA.writes,guard};});
  assert.equal(proof.fixtureMode,false);assert.equal(proof.user,'synthetic-history-browser-user');assert.ok(proof.reads.length>0);assert.ok(proof.reads.some(read=>read.table==='health_documents'&&read.filters.some(([field,value])=>field==='document_type'&&value==='nutrition_plan')),'actual restricted nutrition-plan loader executes');assert.ok(proof.guard.every(Boolean));assert.deepEqual(proof.writes,[]);assert.deepEqual(traffic.external,[]);assert.deepEqual(traffic.writes,[]);assert.deepEqual(traffic.errors,[]);return {readCount:proof.reads.length,writeCount:0,externalRequestCount:0,productionStartup:true};
}
async function contextFor(browser,f,width,height,options={}){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<=840,hasTouch:width<=840,timezoneId:'America/Sao_Paulo',locale:'pt-BR',serviceWorkers:'block'}),traffic={external:[],writes:[],errors:[]};
  await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2'&&request.method()==='GET')return route.fulfill({status:200,contentType:'application/javascript',body:consumerLanguageService(f.db,options)});if(url.origin===origin.origin&&['GET','HEAD'].includes(request.method()))return route.continue();if(!['GET','HEAD'].includes(request.method()))traffic.writes.push({url:request.url(),method:request.method()});else traffic.external.push(request.url());return route.abort('blockedbyclient');});
  const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',error=>traffic.errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('net::ERR_BLOCKED_BY_CLIENT'))traffic.errors.push(message.text());});await page.clock.setFixedTime(new Date(`${LANGUAGE_TODAY}T15:00:00Z`));return {context,page,traffic};
}

const browser=await chromium.launch({headless:true});
try{
  for(const [size,width,height] of [['small',320,740],['mobile',393,844],['desktopNarrow',1180,757],['desktop',1440,900]])for(const kind of ['complete','partial','empty','conflict']){
    const f=makeConsumerLanguageFixture(kind),label=`${size}-${kind}`,{context,page,traffic}=await contextFor(browser,f,width,height);
    const failureStart=failures.length;
    try{
      await page.goto(base+'#hoje');await stable(page,'hoje');
      for(const route of LANGUAGE_ROUTES){
        if(route!=='hoje')await navigate(page,route,width);
        await primary(page,`${label}-${route}`);await capture(page,`${label}-${route}`);
        if(route==='hoje')await homeChecks(page,f,label);
        if(route==='nutricao')await nutritionChecks(page,f,label);
        if(route==='treinos')await trainingChecks(page,f,label);
        if(route==='saude')await labChecks(page,f,label);
        if(route==='dados')await dataChecks(page,f,label);
      }
      if(kind==='complete'){
        // Repeated route/back transitions retain the explicit diary selection.
        await navigate(page,'nutricao',width);assert.equal(await page.locator('#nutritionArchiveDate').inputValue(),f.date(1));assert.equal(await page.locator('#nutritionArchiveSource').inputValue(),foodSourceKey('Synthetic A food'));
        await navigate(page,'timeline',width);await page.goBack();await stable(page,'nutricao');assert.equal(await page.locator('#nutritionArchiveDate').inputValue(),f.date(1));
        for(const [route,table,domain] of [['nutricao','health_nutrition_meals','meals'],['nutricao','health_daily_nutrition','nutrition'],['hoje','health_source_daily_metrics','sourceMetrics']])await refreshCase(page,f,label,route,width,table,domain);
        if(width===393)for(const [route,table,domain] of [['timeline','health_activity_records','activity'],['treinos','health_workouts','workouts'],['saude','health_lab_results','labs'],['tratamentos','health_medication_events','treatments'],['dados','health_daily_nutrition','nutrition']])await refreshCase(page,f,label,route,width,table,domain);
      }
      const proof=await securityChecks(page,traffic);results.push({name:label,width,height,kind,status:failures.length===failureStart?'passed':'failed',routes:LANGUAGE_ROUTES,...proof});save();console.log(`${label}: ${failures.length===failureStart?'passed':'issues recorded'}; primary language, disclosures, clinical originals and responsive layout captured.`);
    }catch(error){await page.screenshot({path:`${dir}/${label}-failure.png`,animations:'disabled'}).catch(()=>{});failures.push({name:label,message:String(error.message),...traffic});results.push({name:label,width,height,kind,status:'failed'});save();}finally{await context.close();}
  }
  // A real unresolved SDK read must show loading, never a complete empty state.
  const f=makeConsumerLanguageFixture('partial'),{context,page,traffic}=await contextFor(browser,f,393,844,{pauseTable:'health_nutrition_meals'});
  try{await page.goto(base+'#nutricao');await page.waitForFunction(()=>window.__historyQA?.reads.some(read=>read.table==='health_nutrition_meals'));assert.equal(await page.locator('#screenHost .loadingState').count(),1);assert.equal(await page.locator('.ltsNutritionArchive').count(),0);await capture(page,'mobile-loading','#screenHost .loadingState b');await page.evaluate(()=>window.__releaseHistoryReads());await stable(page,'nutricao');await primary(page,'mobile-loading-resolved');const proof=await securityChecks(page,traffic);results.push({name:'mobile-loading-recovery',status:'passed',...proof});save();}finally{await context.close();}
}finally{writeFileSync(`${dir}/visible-language-inventory.json`,JSON.stringify({syntheticOnly:true,inventories},null,2));await browser.close();}
assert.equal(failures.length,0,`Consumer-language QA found ${failures.length} failures; inspect results.json and original-resolution evidence.`);
console.log('Consumer-language browser: synthetic production path, ten routes, four widths and full/partial/empty/conflict/failure/recovery states. No real authenticated QA was performed.');
