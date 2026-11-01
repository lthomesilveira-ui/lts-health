import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {makeNutritionHistoryFixture,nutritionHistoryService,HISTORY_TODAY,HISTORY_SOURCE,CURRENT_SOURCE,FIRST_HISTORY_DAY,LAST_HISTORY_DAY,MISSING_HISTORY_DAY,FOOD_KEYS,historySourceKey,mirrorSourceKey} from './nutrition-history-access-fixture.mjs';

// Uses the real production-shaped read path in the isolated preview, never
// ?fixture. The SDK and session below are synthetic; external traffic is blocked.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/',origin=new URL(base);
assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname),'Synthetic browser QA is restricted to loopback');
assert.equal(origin.protocol,'http:');assert.ok(origin.pathname.endsWith('/preview/compact-evidence/'));assert.equal(origin.search,'');assert.equal(origin.hash,'');
const executablePath=process.env.LTS_LOCAL_CHROMIUM_EXECUTABLE;
assert.ok(!process.env.CI||!executablePath,'CI uses the pinned Playwright browser, without a local override');
const dir=process.env.LTS_NUTRITION_HISTORY_EVIDENCE_DIR||'nutrition-history-access-visual';mkdirSync(dir,{recursive:true});
const f=makeNutritionHistoryFixture(),historyKey=historySourceKey(HISTORY_SOURCE),currentKey=historySourceKey(CURRENT_SOURCE),results=[];
const dateLabel=date=>date.split('-').reverse().join('/');
const quantity=(value,unit)=>value==null?'Não informado':`${value.toLocaleString('pt-BR',{maximumFractionDigits:0})} ${unit}`;
const units=['kcal','g','g','g','g'];
const attr=(name,value)=>`[${name}=${JSON.stringify(value)}]`;
const writeResults=()=>writeFileSync(`${dir}/results.json`,JSON.stringify({syntheticOnly:true,today:HISTORY_TODAY,fixture:{dailyDates:f.historicalDays,historicalMeals:f.historicalMeals,missingYear:'2022',allNutritionRows:f.data.nutrition.length,allMealRows:f.data.meals.length},results},null,2));

async function stable(page,route='nutricao'){
  // A ready-domain refresh can still have a scheduled main/controller render.
  // Observe root identity and layout beyond the controller's 250 ms cycle.
  await page.evaluate(()=>{window.__historyStableRoot=null;window.__historyStableGeometry=null;window.__historyStableSince=0;});
  await page.waitForFunction(route=>{
    const root=document.querySelector(route==='nutricao'?'.ltsNutritionProduct':route==='timeline'?'.timelineGroups':'[data-health-dashboard]');
    if(!root||location.hash!==`#${route}`||document.querySelector('#screenHost .loadingState'))return false;
    const geometry=[root.clientWidth,root.scrollWidth,root.clientHeight,root.scrollHeight].join(','),now=performance.now();
    if(window.__historyStableRoot!==root||window.__historyStableGeometry!==geometry){window.__historyStableRoot=root;window.__historyStableGeometry=geometry;window.__historyStableSince=now;return false;}
    return now-window.__historyStableSince>=350;
  },route);
}
async function stateSelection(page){return page.evaluate(async()=>{const{state}=await import('./src/core.js');return {source:state.ui.homeNutritionSource,date:state.ui.nutritionDate,year:state.ui.nutritionYear,month:state.ui.nutritionMonth,period:state.ui.nutritionPeriod,status:{...state.domainStatus}};});}
async function choose(page,selector,value){await page.locator(selector).selectOption(value);await stable(page);assert.equal(await page.locator(selector).inputValue(),value,`${selector}: explicit choice persists`);}
async function chooseDate(page,date){await page.locator('#nutritionArchiveDate').fill(date);await page.locator('#nutritionArchiveDate').dispatchEvent('change');await stable(page);assert.equal(await page.locator('#nutritionArchiveDate').inputValue(),date);assert.equal((await stateSelection(page)).date,date);}
async function navigate(page,route,width){
  const mobile=width<=840,nav=mobile?'#mobileNav':'#primaryNav';
  const direct=page.locator(`${nav} [data-route="${route}"]`);
  if(await direct.count())await direct.click();else{await page.locator(`${nav} [data-route="mais"]`).click();await page.locator(`#moreSheet [data-route="${route}"]`).click();}
  await stable(page,route);
}
async function assertDiary(page,date,source=HISTORY_SOURCE){
  assert.equal(await page.locator('#nutritionArchiveSource').inputValue(),historySourceKey(source));
  assert.equal(await page.locator('#nutritionArchiveDate').inputValue(),date);
  const context=await page.locator('.ltsNutritionDiaryContext').innerText();assert.ok(context.includes(dateLabel(date)));assert.ok(context.includes(source));
  const expectedRows=f.data.nutrition.filter(row=>row.source===source&&row.nutrition_date===date),expectedMeals=f.data.meals.filter(row=>row.source===source&&row.meal_date===date);
  assert.deepEqual(await page.locator('#nutritionArchiveDiary .ltsNutritionMeals article > b').allTextContents(),expectedMeals.map(row=>row.meal_name),'only exact source/date meals are joined');
  for(let index=0;index<expectedMeals.length;index++)assert.ok((await page.locator('#nutritionArchiveDiary .ltsNutritionMeals article').nth(index).innerText()).includes(quantity(expectedMeals[index].calories_kcal,'kcal')));
  const metrics=page.locator('#nutritionArchiveDiary .ltsNutritionDiaryMetrics article > b');
  if(expectedRows.length===1)assert.deepEqual(await metrics.allTextContents(),FOOD_KEYS.map((key,index)=>quantity(expectedRows[0][key],units[index])),'stored daily totals remain independent from meal sums and other origins');
  else assert.equal(await metrics.count(),0,'missing or wholly ambiguous daily totals are not synthesized from meals');
  assert.doesNotMatch(await page.locator('#nutritionArchiveDiary').innerText(),/\b(?:NaN|undefined|Infinity)\b/);
}
async function inlineDetails(page,label){
  const selection=await stateSelection(page),url=page.url();
  const diary=await page.locator('#nutritionArchiveDiary').innerText();
  const readCount=await page.evaluate(()=>window.__historyQA.reads.length);
  for(const [kind,title] of [['nutrition','Consumo e plano alimentar'],['water','Água consumida']]){
    const summary=page.locator(`#home-${kind}-detail`),details=page.locator(`[data-disclosure="home-${kind}-detail"]`);
    assert.equal(await details.getAttribute('open'),null,'the disclosure starts collapsed');
    await page.getByRole('button',{name:`Abrir ${title}`,exact:true}).click();
    await page.waitForFunction(id=>{
      const summary=document.getElementById(id),header=document.querySelector('.topbar');
      if(!summary||!summary.parentElement.open||document.activeElement!==summary)return false;
      const box=summary.getBoundingClientRect(),first=summary.nextElementSibling?.getBoundingClientRect(),nav=document.querySelector('#mobileNav'),bottom=nav?.checkVisibility()?nav.getBoundingClientRect().top:innerHeight;
      return box.top>=Math.max(0,header.getBoundingClientRect().bottom)-1&&first?.bottom<=bottom+1;
    },`home-${kind}-detail`);
    assert.equal(await summary.evaluate(element=>element.tabIndex),0,'native summary stays in the keyboard sequence');
    assert.equal(page.url(),url,'a local detail action does not navigate to its own route');
    assert.deepEqual(await stateSelection(page),selection,'selected origin/date/month/year/window and domain states are preserved');
    assert.equal(await page.locator('#nutritionArchiveDiary').innerText(),diary,'opening context cannot replace the selected diary');
    assert.equal(await page.evaluate(()=>window.__historyQA.reads.length),readCount,'the action opens available context without reloading data');
    await page.screenshot({path:`${dir}/${label}-${kind}-inline-detail.png`,animations:'disabled'});
    await summary.press('Enter');assert.equal(await details.getAttribute('open'),null,'Enter closes the native disclosure');
    await summary.press('Enter');assert.notEqual(await details.getAttribute('open'),null,'Enter opens the same native disclosure again');
    await summary.click();assert.equal(await details.getAttribute('open'),null);
  }
}
async function buttonQuality(page,label,selector){
  const issues=await page.locator(selector).evaluateAll(buttons=>buttons.filter(button=>button.checkVisibility({checkVisibilityCSS:true})).flatMap(button=>{const style=getComputedStyle(button),parent=getComputedStyle(button.parentElement),radii=[style.borderTopLeftRadius,style.borderTopRightRadius,style.borderBottomLeftRadius,style.borderBottomRightRadius];return radii.every(value=>parseFloat(value)>=8)&&style.fontFamily===parent.fontFamily?[]:[{text:button.textContent.trim(),radii,font:style.fontFamily,parentFont:parent.fontFamily}];}));
  assert.deepEqual(issues,[],`${label}: new archive actions use the rounded, inherited-font app styling`);
  const buttons=page.locator(selector);let target=null;
  for(let index=0;index<await buttons.count();index++)if(await buttons.nth(index).isVisible()){target=buttons.nth(index);break;}
  if(target){
    await target.focus();await target.press('Tab');await page.keyboard.press('Shift+Tab');
    const focus=await target.evaluate(element=>{const style=getComputedStyle(element);return {active:document.activeElement===element,visible:element.matches(':focus-visible'),width:parseFloat(style.outlineWidth),style:style.outlineStyle};});
    assert.ok(focus.active&&focus.visible&&focus.width>=2&&focus.style!=='none',`${label}: keyboard focus is visibly outlined ${JSON.stringify(focus)}`);
  }
}
async function quality(page,label,{archive=true}={}){
  const measurement=await page.evaluate(()=>{const host=document.querySelector('#screenHost');return {width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,host:{width:host.clientWidth,scroll:host.scrollWidth},regions:[...document.querySelectorAll('.ltsNutritionArchive,.ltsNutritionDiary')].map(el=>({class:el.className,width:el.clientWidth,scroll:el.scrollWidth}))};});
  assert.ok(measurement.document<=measurement.width+1&&measurement.body<=measurement.width+1&&measurement.host.scroll<=measurement.host.width+1&&measurement.regions.every(region=>region.scroll<=region.width+1),`${label}: no horizontal overflow ${JSON.stringify(measurement)}`);
  if(!archive){await buttonQuality(page,label,'.healthArchiveAccess button');return measurement;}
  await buttonQuality(page,label,'.ltsNutritionArchive button,.ltsNutritionDiary [data-nutrition-archive-open]');
  const issues=await page.evaluate(()=>{
    const roots=[...document.querySelectorAll('.ltsNutritionArchive,.ltsNutritionDiary')],controls=[],text=[];
    for(const root of roots){
      for(const element of root.querySelectorAll('button,select,input,summary'))if(!element.disabled&&element.checkVisibility({checkVisibilityCSS:true})){const box=element.getBoundingClientRect();if(box.width<43.5||box.height<43.5)controls.push({id:element.id,tag:element.tagName,text:element.textContent.slice(0,100),width:box.width,height:box.height});}
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
      while(node=walker.nextNode()){
        const element=node.parentElement;
        if(!node.textContent.trim()||!element?.checkVisibility({checkVisibilityCSS:true})||element.closest('select,input,option,script,style'))continue;
        const range=document.createRange();range.selectNodeContents(node);
        for(const rect of range.getClientRects())if(rect.width>0&&rect.height>0)text.push({text:node.textContent.trim().slice(0,90),left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom});
      }
    }
    const overlaps=[];for(let first=0;first<text.length;first++)for(let second=first+1;second<text.length;second++){const a=text[first],b=text[second];if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push({first:a,second:b});}
    return {controls,overlaps};
  });
  if(issues.controls.length||issues.overlaps.length)writeFileSync(`${dir}/${label.replace(/[^a-z0-9-]/gi,'-')}-layout.json`,JSON.stringify(issues,null,2));
  assert.deepEqual(issues.controls,[],`${label}: archive controls keep 44 × 44 CSS pixel targets`);
  assert.deepEqual(issues.overlaps,[],`${label}: archive and diary text never overlap`);
  assert.ok(await page.locator('#nutritionDateProduct option:not([disabled])').count()<=31,'only a selected month of day options is mounted');
  return measurement;
}
async function tile(page,name,target){
  const root=await page.locator('#screenHost > :first-child').elementHandle();
  assert.ok(root,`${name}: a real screen root exists before scrolling`);
  await target.evaluate(element=>element.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
  const visible=await target.evaluate((element,settledRoot)=>{const rect=element.getBoundingClientRect(),nav=document.querySelector('#mobileNav'),navRect=nav?.getBoundingClientRect(),bottom=nav?.checkVisibility({checkVisibilityCSS:true})?Math.min(innerHeight,navRect.top):innerHeight;return {rootUnchanged:settledRoot===document.querySelector('#screenHost > :first-child'),top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,width:innerWidth,visibleBottom:bottom,hostScroll:document.querySelector('#screenHost')?.scrollTop,windowScroll:scrollY};},root);
  assert.equal(visible.rootUnchanged,true,`${name}: root remains identical between scroll and measurement`);
  assert.ok(visible.top>=-1&&visible.bottom<=visible.visibleBottom+1&&visible.left>=-1&&visible.right<=visible.width+1,`${name}: actual scroll target must be wholly visible ${JSON.stringify(visible)}`);
  await page.screenshot({path:`${dir}/${name}.png`,animations:'disabled'});
  assert.ok(await page.evaluate(root=>root===document.querySelector('#screenHost > :first-child'),root),'scrolling and capture do not replace the settled screen');
  await root.dispose();
  writeFileSync(`${dir}/${name}-viewport.json`,JSON.stringify(visible,null,2));
}
async function capture(page,name){
  for(const [suffix,selector] of [['origin','#nutritionArchiveSource'],['year','#nutritionArchiveYear'],['day','#nutritionArchiveDate'],['context','.ltsNutritionDiaryContext']])await tile(page,`${name}-${suffix}`,page.locator(selector));
  if(await page.locator('#nutritionArchiveDiary .ltsNutritionDiaryMetrics article').count())await tile(page,`${name}-totals`,page.locator('#nutritionArchiveDiary .ltsNutritionDiaryMetrics article').first());
  if(await page.locator('#nutritionArchiveDiary .ltsNutritionMeals article').count())await tile(page,`${name}-meal`,page.locator('#nutritionArchiveDiary .ltsNutritionMeals article').first());
}
async function serviceChecks(page,external,networkWrites,errors){
  const guard=await page.evaluate(()=>{const client=window.supabase.createClient('synthetic','synthetic'),blocked=[];for(const [name,operation] of [['insert',()=>client.from('synthetic').insert({})],['update',()=>client.from('synthetic').update({})],['delete',()=>client.from('synthetic').delete()],['rpc',()=>client.rpc('synthetic')],['invoke',()=>client.functions.invoke('synthetic')]]){try{operation();blocked.push({name,blocked:false});}catch(error){blocked.push({name,blocked:error.code==='preview_read_only'});}}return blocked;});
  assert.ok(guard.every(item=>item.blocked),'preview guard prevents every attempted synthetic backend mutation');
  const observed=await page.evaluate(async()=>{const{state}=await import('./src/core.js');return {reads:window.__historyQA.reads,writes:window.__historyQA.writes,nutritionCount:state.data.nutrition.length,mealCount:state.data.meals.length};});
  assert.equal(observed.nutritionCount,f.data.nutrition.length,'loader retains every nutrition page');assert.equal(observed.mealCount,f.data.meals.length,'loader retains every meals page');
  for(const [table,count] of [['health_daily_nutrition',f.data.nutrition.length],['health_nutrition_meals',f.data.meals.length]]){
    const reads=observed.reads.filter(read=>read.table===table);
    for(let from=0;from<count;from+=1000)assert.ok(reads.some(read=>read.from===from&&read.to===from+999),`${table}: offset ${from} is actually read`);
    assert.ok(reads.every(read=>read.orders.some(([key])=>key==='source_record_id')),'pagination is deterministically tie-broken');
  }
  assert.deepEqual(observed.writes,[]);assert.deepEqual(networkWrites,[]);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  return {readCount:observed.reads.length,writeCount:0,externalRequestCount:0};
}
async function contextFor(browser,width,height,serviceOptions={}){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<=840,hasTouch:width<=840,timezoneId:'America/Sao_Paulo',locale:'pt-BR',serviceWorkers:'block'}),external=[],networkWrites=[],errors=[];
  await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2'&&request.method()==='GET')return route.fulfill({status:200,contentType:'application/javascript',body:nutritionHistoryService(f.db,serviceOptions)});if(url.origin===origin.origin&&['GET','HEAD'].includes(request.method()))return route.continue();if(!['GET','HEAD'].includes(request.method()))networkWrites.push({url:request.url(),method:request.method()});else external.push(request.url());return route.abort('blockedbyclient');});
  const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('net::ERR_BLOCKED_BY_CLIENT'))errors.push(message.text());});await page.clock.setFixedTime(new Date(`${HISTORY_TODAY}T15:00:00Z`));
  return {context,page,external,networkWrites,errors};
}

const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
try{
  for(const [label,width,height] of [['small',320,740],['mobile',393,844],['desktopNarrow',1180,757],['desktop',1440,900]]){
    const {context,page,external,networkWrites,errors}=await contextFor(browser,width,height);
    try{
      await page.goto(base+'#nutricao');await stable(page);
      assert.equal(await page.locator('#nutritionArchiveSource').inputValue(),currentKey,'latest independent source is the initial default');
      await quality(page,`${label}/initial`);await capture(page,`${label}-initial`);
      await choose(page,'#nutritionArchiveSource',historyKey);
      assert.deepEqual(await page.locator('#nutritionArchiveYear option').evaluateAll(options=>options.map(option=>option.value)),['2026','2025','2024','2023','2021','2020','2019','2018'],'old years are fully reachable; absent 2022 is not fabricated');
      // Earliest origin shortcut works without expanding the summary window.
      await page.locator(`.ltsNutritionArchiveActions ${attr('data-nutrition-archive-date',FIRST_HISTORY_DAY)}`).click();await stable(page);
      await assertDiary(page,FIRST_HISTORY_DAY);assert.equal(await page.locator('.ltsNutritionProduct [data-period="90"]').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('#nutritionDateProduct').inputValue(),FIRST_HISTORY_DAY);assert.equal(await page.locator('#nutritionArchiveYear').inputValue(),'2018');assert.equal(await page.locator('#nutritionArchiveMonth').inputValue(),'2018-02');
      assert.equal(await page.locator('#nutritionArchiveDiary .ltsNutritionDiaryMetrics article > b').last().innerText(),'0 g','literal zero is retained');
      const alternateLabels=await page.locator('#nutritionArchiveDiary [data-nutrition-archive-open]').allTextContents();
      assert.equal(alternateLabels.length,4);assert.equal(new Set(alternateLabels).size,alternateLabels.length,'same aliases remain distinguishable by source domain/status');
      const originLabels=await page.locator('#nutritionArchiveSource option').allTextContents();assert.equal(new Set(originLabels).size,originLabels.length,'source options distinguish canonical, candidate and review identities');
      assert.equal(await page.locator('#nutritionArchiveMonth option:checked').textContent(),'fevereiro','month fits narrow controls without repeating the adjacent year');
      await quality(page,`${label}/earliest`);await capture(page,`${label}-earliest`);
      await inlineDetails(page,label);
      // Existing summary selector and the archive use one explicit choice.
      const summaryDetail=page.locator('[data-disclosure="home-nutrition-detail"]');
      await summaryDetail.locator(':scope > summary').click();
      await choose(page,'#home-reportNutritionSource',currentKey);await assertDiary(page,FIRST_HISTORY_DAY,CURRENT_SOURCE);
      await choose(page,'#nutritionArchiveSource',historyKey);await assertDiary(page,FIRST_HISTORY_DAY);assert.equal(await page.locator('#home-reportNutritionSource').inputValue(),historyKey);
      await choose(page,'#home-reportNutritionSource',currentKey);await choose(page,'#home-reportNutritionSource',historyKey);await assertDiary(page,FIRST_HISTORY_DAY);
      await summaryDetail.locator(':scope > summary').click();
      // Source inventory provides the same direct oldest-date jump.
      await page.locator('[data-disclosure="nutrition-archive-origins"] > summary').click();
      const inventory=page.locator('[data-disclosure="nutrition-archive-origins"]');
      await inventory.locator(attr('data-nutrition-archive-open',currentKey)).click();await stable(page);await assertDiary(page,FIRST_HISTORY_DAY,CURRENT_SOURCE);
      await inventory.locator(attr('data-nutrition-archive-open',historyKey)).click();await stable(page);await assertDiary(page,FIRST_HISTORY_DAY);
      await inventory.locator(':scope > summary').click();
      // Annual and monthly navigation always stays within the chosen source.
      await choose(page,'#nutritionArchiveYear','2020');await choose(page,'#nutritionArchiveMonth','2020-07');
      const target=f.dates.find(date=>date.startsWith('2020-07-'));
      await choose(page,'#nutritionDateProduct',target);await assertDiary(page,target);
      assert.equal(await page.locator('#nutritionArchiveSource').inputValue(),historyKey);await quality(page,`${label}/year-month-day`);
      // A missing entire year stays requested, even when another origin has newer records.
      await chooseDate(page,MISSING_HISTORY_DAY);await assertDiary(page,MISSING_HISTORY_DAY);
      assert.equal(await page.locator('#nutritionArchiveYear').inputValue(),'2022');assert.match(await page.locator('#nutritionArchiveDiary').innerText(),/Sem registro de alimentação.*A data escolhida foi preservada/);
      assert.equal(await page.locator('#nutritionDateProduct option:not([disabled])').count(),0);
      await quality(page,`${label}/missing-year`);await capture(page,`${label}-missing-year`);
      await chooseDate(page,HISTORY_TODAY);await assertDiary(page,HISTORY_TODAY);
      assert.match(await page.locator('#nutritionArchiveDiary').innerText(),/Há outros diários para esta data/);
      await page.locator(`#nutritionArchiveDiary ${attr('data-nutrition-archive-open',currentKey)}`).click();await stable(page);await assertDiary(page,HISTORY_TODAY,CURRENT_SOURCE);
      await choose(page,'#nutritionArchiveSource',historyKey);await assertDiary(page,HISTORY_TODAY);
      // Every summary-window switch must preserve an explicit missing archive day.
      for(const period of ['30','all','90']){await page.locator(`.ltsNutritionProduct [data-period="${period}"]`).click();await stable(page);await assertDiary(page,HISTORY_TODAY);}
      await chooseDate(page,f.mealOnlyDay);await assertDiary(page,f.mealOnlyDay);assert.match(await page.locator('#nutritionArchiveDiary').innerText(),/As refeições abaixo não são somadas para formar um total/);await quality(page,`${label}/meal-only`);await capture(page,`${label}-meal-only`);
      await chooseDate(page,f.ambiguousDay);await assertDiary(page,f.ambiguousDay);assert.match(await page.locator('#nutritionArchiveDiary').innerText(),/totais repetidos ou conflitantes/);await page.locator('[data-disclosure="nutrition-archive-raw"] > summary').click();assert.equal(await page.locator('[data-disclosure="nutrition-archive-raw"] > p').count(),2);await quality(page,`${label}/ambiguous`);
      await chooseDate(page,FIRST_HISTORY_DAY);
      for(const [status,energy] of [['canonical',9001],['candidate',9101],['held',9201]]){
        await choose(page,'#nutritionArchiveSource',mirrorSourceKey(status));
        assert.equal(await page.locator('#nutritionArchiveDate').inputValue(),FIRST_HISTORY_DAY);
        assert.equal(await page.locator('#nutritionArchiveDiary .ltsNutritionDiaryMetrics article > b').first().innerText(),quantity(energy,'kcal'));
        assert.equal(await page.locator('#nutritionArchiveDiary .ltsNutritionMeals article').count(),0,'same-label metric mirrors never inherit canonical meals');
        await quality(page,`${label}/mirror-${status}`);
      }
      // Restore the newest source before Timeline: a correct jump must override it.
      await choose(page,'#nutritionArchiveSource',currentKey);await chooseDate(page,HISTORY_TODAY);
      await navigate(page,'timeline',width);await page.locator('#timelinePeriod').selectOption('all');await stable(page,'timeline');await page.locator('#timelineYear').selectOption('2018');await stable(page,'timeline');await page.locator('#timelineMonth').selectOption('02');await stable(page,'timeline');await page.locator('#timelineDate').selectOption(FIRST_HISTORY_DAY);await stable(page,'timeline');
      // The select changes before main.js's scheduled render. Root stability
      // alone cannot prove the selected day has replaced the month's groups.
      assert.equal(await (await page.waitForFunction(({date,label})=>{
        const dates=[...document.querySelectorAll('.timelineGroups .timelineDay .timelineDate > b')];
        return location.hash==='#timeline'&&document.querySelector('#timelineDate')?.value===date&&dates.length===1&&dates[0].textContent===label;
      },{date:FIRST_HISTORY_DAY,label:dateLabel(FIRST_HISTORY_DAY)})).jsonValue(),true);
      const timelineTarget=page.locator('[data-timeline-ref="synthetic-history-day-0"]').first();
      assert.equal(await timelineTarget.getAttribute('data-timeline-source'),historyKey);assert.equal(await timelineTarget.getAttribute('data-timeline-date'),FIRST_HISTORY_DAY);
      assert.equal(await page.locator('[data-timeline-ref="synthetic-current-day-0"]').first().getAttribute('data-timeline-source'),currentKey,'identical display aliases retain distinct source identity');
      assert.equal(await page.locator('#timelineDate').inputValue(),FIRST_HISTORY_DAY);
      assert.deepEqual(await page.locator('.timelineGroups .timelineDay .timelineDate > b').allTextContents(),[dateLabel(FIRST_HISTORY_DAY)],'selected date filter has rendered before capturing the Timeline tile');
      await quality(page,`${label}/timeline`,{archive:false});await tile(page,`${label}-timeline-oldest`,timelineTarget);
      // Even a stale or altered button must be verified against loaded identity.
      await timelineTarget.evaluate((element,key)=>{element.dataset.timelineSource=key;},currentKey);
      await timelineTarget.click();await stable(page);
      assert.equal(await page.locator('#nutritionArchiveDate').inputValue(),FIRST_HISTORY_DAY,'unverified Timeline identity keeps the requested date');
      assert.match(await page.locator('#nutritionArchiveDiary').innerText(),/Não foi possível abrir o diário escolhido/);
      assert.equal(await page.locator('#nutritionArchiveDiary .ltsNutritionDiaryMetrics article,#nutritionArchiveDiary .ltsNutritionMeals article').count(),0,'unverified identity fails closed without exposing another diary');
      await page.goBack();await stable(page,'timeline');
      assert.equal(await timelineTarget.getAttribute('data-timeline-source'),historyKey,'return reconstructs the verified original Timeline identity');
      await timelineTarget.click();await stable(page);await assertDiary(page,FIRST_HISTORY_DAY);
      await page.goBack();await stable(page,'timeline');assert.equal(await page.locator('#timelineYear').inputValue(),'2018');assert.equal(await page.locator('#timelineMonth').inputValue(),'02');assert.equal(await page.locator('#timelineDate').inputValue(),FIRST_HISTORY_DAY);
      await page.locator('[data-timeline-ref="synthetic-history-day-0"]').first().click();await stable(page);await assertDiary(page,FIRST_HISTORY_DAY);
      await navigate(page,'hoje',width);assert.equal(await page.locator('[data-dashboard-card]').count(),7,'approved seven-card Home remains unchanged');await quality(page,`${label}/home-return`,{archive:false});
      await navigate(page,'nutricao',width);await assertDiary(page,FIRST_HISTORY_DAY);await quality(page,`${label}/route-return`);
      // The Home old-day hint leads directly to the matching archive origin;
      // an empty current-source card is not used to conceal historical rows.
      await choose(page,'#nutritionArchiveSource',currentKey);
      await navigate(page,'hoje',width);
      await page.locator('[data-dashboard-mode="day"]').click();await stable(page,'hoje');
      await page.locator('[data-dashboard-date]').fill(target);await page.locator('[data-dashboard-date]').dispatchEvent('change');await stable(page,'hoje');
      assert.equal(await page.locator('[data-dashboard-card]').count(),7);
      const homeTarget=page.locator(`.healthArchiveAccess ${attr('data-nutrition-archive-open',historyKey)}`);
      assert.equal(await homeTarget.getAttribute('data-nutrition-archive-date'),target);assert.equal(await homeTarget.getAttribute('data-nutrition-archive-route'),'nutricao');
      await quality(page,`${label}/home-old-day`,{archive:false});await tile(page,`${label}-home-old-day`,homeTarget);
      await homeTarget.click();await stable(page);await assertDiary(page,target);
      await chooseDate(page,FIRST_HISTORY_DAY);await assertDiary(page,FIRST_HISTORY_DAY);
      const readProof=await serviceChecks(page,external,networkWrites,errors);
      results.push({name:label,width,height,status:'passed',syntheticOnly:true,...readProof,originalResolutionScreenshots:true,covered:['all-pages','earliest','summary-source-sync','home-old-day-link','year-month-day','missing-year','explicit-missing','meal-only','duplicate','source-mirrors','timeline-identity','back-repeat','home-return','44px-controls','rounded-inherited-font-controls','visible-keyboard-focus','qualified-origin-labels','text-no-overlap']});writeResults();console.log(`${label}: historical loader pagination, origin/calendar/meal integrity, Timeline back/repeat and responsive archive passed.`);
    }catch(error){await page.screenshot({path:`${dir}/${label}-failure.png`,animations:'disabled'}).catch(()=>{});results.push({name:label,width,height,status:'failed',error:String(error.message),pageErrors:errors,blockedExternal:external,networkWrites});writeResults();throw error;}finally{await context.close();}
  }
  // Pause a genuine second loader page. A partial page is never presented as
  // the complete history while the outstanding read is still unresolved.
  {
    const {context,page,external,networkWrites,errors}=await contextFor(browser,393,844,{pauseTable:'health_nutrition_meals',pauseFrom:1000});
    try{
      await page.goto(base+'#nutricao');await page.waitForFunction(()=>window.__historyQA?.reads.some(read=>read.table==='health_nutrition_meals'&&read.from===1000));
      // The paginated read starts before requestAnimationFrame renders the loading state.
      // Keep the second page paused while waiting for the actual visible UI boundary.
      await page.locator('#screenHost .loadingState').waitFor({state:'visible'});
      assert.equal(await page.locator('.ltsNutritionArchive').count(),0);assert.equal(await page.locator('#screenHost .loadingState').count(),1);
      await tile(page,'mobile-loading',page.locator('#screenHost .loadingState b'));
      await page.evaluate(()=>window.__releaseHistoryReads());await stable(page);await choose(page,'#nutritionArchiveSource',historyKey);await chooseDate(page,FIRST_HISTORY_DAY);await assertDiary(page,FIRST_HISTORY_DAY);
      // Import once before polling: waitForFunction needs a synchronous
      // boolean predicate, not the truthy Promise returned by an async function.
      await page.evaluate(async()=>{window.__historyAppState=(await import('./src/core.js')).state;});
      // Failure on refresh preserves requested origin/day, withholds stale
      // meal details, and makes the missing source explicit without zeros.
      await page.evaluate(()=>{window.__historyQA.failTable='health_nutrition_meals';});await page.locator('#refreshBtn').click();await stable(page);await page.waitForFunction(()=>window.__historyAppState.domainStatus.meals==='error');await stable(page);
      assert.equal(await page.locator('#nutritionArchiveDate').inputValue(),FIRST_HISTORY_DAY);assert.equal(await page.locator('#nutritionArchiveSource').inputValue(),historyKey);assert.equal(await page.locator('#nutritionArchiveDiary .ltsNutritionMeals article').count(),0);assert.match(await page.locator('#nutritionArchiveDiary').innerText(),/Não foi possível carregar as refeições/);assert.equal(await page.locator('#nutritionArchiveDiary .ltsNutritionDiaryMetrics article > b').first().innerText(),'1.800 kcal');
      await quality(page,'mobile/meals-error');await capture(page,'mobile-meals-error');
      await page.evaluate(()=>{window.__historyQA.failTable='health_daily_nutrition';});await page.locator('#refreshBtn').click();await page.waitForFunction(()=>window.__historyAppState.domainStatus.nutrition==='error'&&window.__historyAppState.domainStatus.meals==='ready');await stable(page);
      assert.equal(await page.locator('#nutritionArchiveDate').inputValue(),FIRST_HISTORY_DAY);assert.equal(await page.locator('#nutritionArchiveDiary .ltsNutritionDiaryMetrics article').count(),0);assert.equal(await page.locator('#nutritionArchiveDiary .ltsNutritionMeals article').count(),3,'successful meal read stays useful when the independent totals read fails');await quality(page,'mobile/totals-error');await capture(page,'mobile-totals-error');
      await page.evaluate(()=>{window.__historyQA.failTable=null;});await page.locator('#refreshBtn').click();await page.waitForFunction(()=>window.__historyAppState.domainStatus.nutrition==='ready'&&window.__historyAppState.domainStatus.meals==='ready');await stable(page);await assertDiary(page,FIRST_HISTORY_DAY);
      const proof=await serviceChecks(page,external,networkWrites,errors);results.push({name:'loading-error-recovery',width:393,height:844,status:'passed',syntheticOnly:true,...proof,states:['real-paginated-loading','meals-error','totals-error','successful-retry']});writeResults();
    }catch(error){await page.screenshot({path:`${dir}/loading-error-failure.png`,animations:'disabled'}).catch(()=>{});results.push({name:'loading-error-recovery',status:'failed',error:String(error.message),pageErrors:errors});writeResults();throw error;}finally{await context.close();}
  }
}finally{await browser.close();}
console.log('Historical access browser: four responsive production-path synthetic scenarios plus delayed-page/error/recovery passed. No real authenticated session or external writes.');
