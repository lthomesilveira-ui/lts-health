import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {consumerLanguageService,LANGUAGE_ERROR} from './consumer-language-fixture.mjs';
import {consumerRouteSettled,consumerDomainSettled} from './consumer-language-readiness.mjs';
import {visibleTextGeometry} from './consumer-language-geometry.mjs';
import {
  makeTrainingSessionSummaryFixture,SUMMARY_TODAY,SUMMARY_IDS,SUMMARY_COMMENT,
  SUMMARY_REPORT,SUMMARY_OLD_REPORT,SUMMARY_GENERIC_NOTE,SUMMARY_EXPECTED
} from './training-session-summary-fixture.mjs';

// Run only in the authorized CI browser environment. Startup, navigation,
// disclosures and refresh are the real preview application, without ?fixture.
// Only the SDK response/auth identity are synthetic. No backend mutation,
// user credentials, user records, external network or file upload is allowed.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/';
const origin=new URL(base);
assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname),'Synthetic browser QA must use loopback');
assert.equal(origin.protocol,'http:');
assert.ok(origin.pathname.endsWith('/preview/compact-evidence/'),'Use only the isolated preview');
assert.equal(origin.search,'','Use production startup, never a fixture query');
assert.equal(origin.hash,'');
const dir='training-session-summary-visual';
mkdirSync(dir,{recursive:true});
const results=[],captures=[],failures=[],refreshProof=[],literalTextEvidence=[];
const roots={treinos:'.ltsTrainingReference',hoje:'[data-health-dashboard]',nutricao:'.ltsNutritionProduct'};
const trainingSelector=(view='summary',id=SUMMARY_IDS.current)=>`${roots.treinos}[data-training-view="${view}"][data-workout-id="${id}"]`;
const disclosureKey=(kind,id=SUMMARY_IDS.current)=>`training-${kind}-${id}`;
const disclosureSelector=(kind,id=SUMMARY_IDS.current)=>`[data-disclosure="${disclosureKey(kind,id)}"]`;
function save(){
  writeFileSync(`${dir}/results.json`,JSON.stringify({
    syntheticOnly:true,authenticatedReal:false,authenticatedWithRealAccount:false,
    fixedDate:SUMMARY_TODAY,deviceScaleFactor:1,originalResolutionScreenshots:true,
    viewportWidths:[320,393,1180,1440],results,captures,refreshProof,literalTextEvidence,failures
  },null,2));
}

async function installAppProbe(page){
  await page.evaluate(async()=>{
    if(window.__languageApp)return;
    const {state,fixtureMode}=await import('./src/core.js');
    const {isRouteReady}=await import('./src/data-layer.js');
    const imports=JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
    const coreUrl=new URL(imports['./src/core.js'],document.baseURI).href;
    if(state!==(await import(coreUrl)).state)throw new Error('QA and application imported different core state');
    window.__languageApp={state,isRouteReady,fixtureMode};
  });
}
async function stable(page,route,{selector=roots[route],afterRefresh=false}={}){
  await installAppProbe(page);
  await page.evaluate(()=>{window.__languageStableRoot=null;window.__languageFrames=0;});
  // The shared predicate is synchronous. Imports above must not turn a
  // Playwright polling predicate into an immediately truthy Promise.
  const settled=await page.waitForFunction(consumerRouteSettled,{route,selector,afterRefresh});
  assert.equal(await settled.jsonValue(),true,'Actual route readiness and a stable root are required');
}
const stableTraining=(page,view='summary',id=SUMMARY_IDS.current)=>stable(page,'treinos',{selector:trainingSelector(view,id)});
async function navigate(page,route,width){
  const nav=width<=840?'#mobileNav':'#primaryNav';
  const direct=page.locator(`${nav} [data-route="${route}"]`);
  if(await direct.count())await direct.click();
  else{
    await page.locator(`${nav} [data-route="mais"]`).click();
    await page.locator(`#moreSheet [data-route="${route}"]`).click();
  }
  await stable(page,route);
}
async function chooseTab(page,view,id=SUMMARY_IDS.current){
  await page.locator(`.ltsRefTrainPrimaryTabs [data-depth-training-view="${view}"]`).click();
  await stableTraining(page,view,id);
  assert.equal(await page.locator(`.ltsRefTrainPrimaryTabs [data-depth-training-view="${view}"]`).getAttribute('aria-selected'),'true');
}
async function openSession(page,id,previousId=SUMMARY_IDS.current){
  await chooseTab(page,'history',previousId);
  const button=page.locator(`.ltsWorkoutList [data-depth-workout="${id}"]`);
  assert.equal(await button.count(),1,'The real history lists the selected synthetic session');
  await button.click();
  await stableTraining(page,'summary',id);
  assert.equal(await page.locator('.ltsRefTrainPrimaryTabs [data-depth-training-view="summary"]').getAttribute('aria-selected'),'true','Opening a history session returns to Resumo');
}
async function disclose(page,kind,open=true,id=SUMMARY_IDS.current){
  const details=page.locator(disclosureSelector(kind,id));
  assert.equal(await details.count(),1,`${kind}: exactly one session-specific disclosure`);
  const summary=details.locator(':scope > summary');
  assert.equal(await summary.isVisible(),true,'Disclosure is an actual visible user control');
  if(await details.evaluate(el=>el.open)!==open)await summary.click();
  assert.equal(await details.evaluate(el=>el.open),open,`${kind}: native details toggles`);
}

async function layout(page,name){
  const report=await page.evaluate(()=>{
    const host=document.querySelector('#screenHost');
    const training=host.querySelector('.ltsTrainingReference');
    const smallControls=[],preexistingSmallControls=[],rawText=[];
    for(const el of training?.querySelectorAll('button,summary,select,input,a[href]')||[]){
      if(el.disabled||!el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}))continue;
      const box=el.getBoundingClientRect();
      if(box.width<43.5||box.height<43.5){
        const item={tag:el.tagName,text:el.textContent.trim().slice(0,90),width:box.width,height:box.height};
        // This change adds only the two session disclosure controls. Keep
        // approved legacy control geometry unchanged, but inventory it openly.
        (el.matches('.ltsRefSessionContext > summary,.ltsTrainingRecentBars > button,.ltsRefTrainHero > button')?smallControls:preexistingSmallControls).push(item);
      }
    }
    const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);let node,nodeId=0;
    while(node=walker.nextNode()){
      nodeId++;
      const el=node.parentElement;
      if(!node.textContent.trim()||!el||el.closest('svg,select,option,script,style')||!el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}))continue;
      const clips=[];
      for(let parent=el;parent;parent=parent.parentElement){
        const css=getComputedStyle(parent),x=/^(hidden|clip|scroll|auto)$/.test(css.overflowX),y=/^(hidden|clip|scroll|auto)$/.test(css.overflowY);
        if((!x&&!y)||css.display==='inline'||css.display==='contents')continue;
        const b=parent.getBoundingClientRect(),left=b.left+parent.clientLeft,top=b.top+parent.clientTop;
        clips.push({x,y,left,right:left+parent.clientWidth,top,bottom:top+parent.clientHeight});
      }
      const range=document.createRange();range.selectNodeContents(node);
      for(const rect of range.getClientRects())if(rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<innerHeight)rawText.push({nodeId,text:node.textContent.trim().slice(0,100),rect:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},clips});
    }
    return {viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,hostWidth:host.clientWidth,hostScrollWidth:host.scrollWidth,trainingWidth:training?.clientWidth,trainingScrollWidth:training?.scrollWidth,smallControls,preexistingSmallControls,rawText};
  });
  Object.assign(report,visibleTextGeometry(report.rawText,report.viewport.width));
  writeFileSync(`${dir}/${name}-layout.json`,JSON.stringify({syntheticOnly:true,authenticatedReal:false,...report},null,2));
  const issues=[];
  if(report.documentWidth>report.viewport.width+1||report.bodyWidth>report.viewport.width+1||report.hostScrollWidth>report.hostWidth+1||report.trainingScrollWidth>report.trainingWidth+1)issues.push('horizontal overflow');
  if(report.overflowingText.length)issues.push('painted text outside viewport');
  if(report.smallControls.length)issues.push('new session disclosure control below 44px');
  if(issues.length)failures.push({name,category:'layout',issues,evidence:`${name}-layout.json`});
  return report;
}
async function capture(page,name,selector=null){
  assert.ok(!captures.some(item=>item.name===name),'Never overwrite a different evidence capture');
  if(selector){
    const target=page.locator(selector).first();
    assert.equal(await target.isVisible(),true,`${name}: screenshot target is visible`);
    await target.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
  }else await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('#screenHost')?.scrollTo({top:0,left:0,behavior:'instant'});});
  await page.screenshot({path:`${dir}/${name}.png`,animations:'disabled',scale:'css'});
  const report=await layout(page,name);
  captures.push({name,viewport:report.viewport,originalResolution:true,selector});save();
}
async function literalText(page,selector,expected,{mustWrap=false}={}){
  // Resolve and inspect the current DOM in one synchronous browser callback.
  // A locator's separately resolved handle can be detached by a refresh render
  // before evaluate runs, yielding empty computed styles and zero rectangles.
  const geometry=await page.evaluate(({selector})=>{
    const matches=document.querySelectorAll(selector),el=matches[0];
    if(matches.length!==1)return {matchCount:matches.length,connected:false};
    const root=document.querySelector('.ltsTrainingReference');
    const b=el.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(el);
    const rectangle=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height});
    const positive=r=>r.width>0&&r.height>0;
    const outside=r=>positive(r)&&(r.left<b.left-1||r.right>b.right+1);
    const rects=[...range.getClientRects()].map(rectangle),characters=[];
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node,nodeIndex=0;
    while(node=walker.nextNode()){
      let offset=0;
      for(const character of node.textContent){
        // DOM offsets are UTF-16, while iteration preserves surrogate pairs.
        range.setStart(node,offset);range.setEnd(node,offset+character.length);
        characters.push({nodeIndex,offset,character,whitespace:/^\s$/u.test(character),rects:[...range.getClientRects()].map(rectangle)});
        offset+=character.length;
      }
      nodeIndex++;
    }
    // pre-wrap may give a hanging end-of-line space its own Range rectangle
    // beyond the paragraph. It paints no glyph. Keep that raw evidence, but
    // require every non-whitespace character (including the long token) to fit
    // the same paragraph bounds with the unchanged 1px rounding tolerance.
    const ink=characters.filter(character=>!character.whitespace);
    const overflowingCharacters=ink.filter(character=>character.rects.some(outside));
    return {matchCount:matches.length,connected:el.isConnected,inCurrentTrainingRoot:el.closest('.ltsTrainingReference')===root,
      sourceText:el.textContent,childCount:el.querySelectorAll('*').length,
      viewport:{width:innerWidth,height:innerHeight},workoutId:el.closest('[data-workout-id]')?.dataset.workoutId,
      paragraph:rectangle(b),rects,characters,rawOverflowingRects:rects.filter(outside),overflowingCharacters,
      lineCount:new Set(ink.flatMap(character=>character.rects.filter(positive).map(r=>r.top))).size,
      overflow:overflowingCharacters.length>0,whiteSpace:getComputedStyle(el).whiteSpace};
  },{selector});
  assert.equal(geometry.matchCount,1);
  assert.equal(geometry.connected,true,'Measure a connected paragraph in the current document');
  assert.equal(geometry.inCurrentTrainingRoot,true,'The paragraph belongs to the current training render');
  assert.equal(geometry.sourceText,expected,'The original string, including HTML/newlines, is preserved exactly');
  assert.equal(geometry.childCount,0,'HTML-looking text creates no child markup');
  const evidence=`literal-text-${String(literalTextEvidence.length+1).padStart(3,'0')}-${geometry.viewport.width}-${geometry.workoutId}.json`;
  writeFileSync(`${dir}/${evidence}`,JSON.stringify({syntheticOnly:true,authenticatedReal:false,selector,...geometry},null,2));
  literalTextEvidence.push({evidence,selector,viewport:geometry.viewport,workoutId:geometry.workoutId,lineCount:geometry.lineCount,rawOverflowRectCount:geometry.rawOverflowingRects.length,overflowingCharacterCount:geometry.overflowingCharacters.length});save();
  assert.equal(geometry.overflow,false,'Long unbroken original text wraps within its paragraph');
  if(mustWrap)assert.ok(geometry.lineCount>=3,'The long comment is wrapped across real rendered lines');
  assert.match(geometry.whiteSpace,/pre-wrap|break-spaces/,'Original newlines remain readable');
  assert.equal(await page.evaluate(()=>typeof window.__trainingSummaryExecuted),'undefined','No HTML payload ran');
  return geometry;
}
async function checkShell(page,id=SUMMARY_IDS.current){
  assert.equal(await page.locator(trainingSelector('summary',id)).count(),1);
  assert.deepEqual(await page.locator('.ltsRefTrainPrimaryTabs [role="tab"]').allTextContents(),['Resumo','Exercícios','Sessões','Por exercício'],'Keep session views and expose the requested exercise history');
  assert.deepEqual(await page.locator('.ltsRefTrainPrimaryTabs [role="tab"]').evaluateAll(nodes=>nodes.map(el=>el.dataset.depthTrainingView)),['summary','exercises','history','progress'],'Original session destinations remain intact beside the exercise index');
  assert.equal(await page.locator('.ltsRefTrainHero').count(),1);
  assert.equal(await page.locator('.ltsRefTrainMetric').count(),4,'Keep all four existing metric cards');
  assert.equal(await page.locator('.ltsRefHrPanel').count(),1);
  assert.equal(await page.locator('.ltsRefSessionOverview').count(),1);
  assert.doesNotMatch(await page.locator('#screenHost').innerText(),/\b(?:NaN|undefined|Infinity)\b/);
}
async function checkCurrent(page){
  await checkShell(page);
  assert.equal(await page.locator('[data-training-chart]').count(),2,'source-backed session and history charts are visible');
  const bars=await page.locator('[data-training-group]').evaluateAll(rows=>rows.map(row=>Number(row.dataset.primary)));
  assert.equal(bars.reduce((a,b)=>a+b,0),SUMMARY_EXPECTED.primary,'chart counts reconcile without extensions');
  assert.equal(await page.locator('.ltsTrainingRecentBars > button.selected').count(),1);
  assert.equal((await page.locator('.ltsRefTrainMetric').last().locator('strong').innerText()).trim(),String(SUMMARY_EXPECTED.primary));
  assert.deepEqual((await page.locator('.ltsRefOverviewGrid b').allTextContents()).map(s=>s.trim()),['4','8']);
  assert.match(await page.locator('.ltsRefExtensionNote').innerText(),/2 prolongamentos.*separados/s,'Extensions stay separate from primary sets');
  assert.equal(await page.locator('.ltsRefSessionComment > b').innerText(),'Como você terminou');
  await literalText(page,'.ltsRefSessionComment > p',SUMMARY_COMMENT,{mustWrap:true});
  assert.ok(!(await page.locator('.ltsRefSessionComment').innerText()).includes(SUMMARY_GENERIC_NOTE),'Generic notes do not become the explicit session comment');
}
async function checkDistribution(page){
  await disclose(page,'distribution');
  const rows=await page.locator(`${disclosureSelector('distribution')} .ltsRefSessionGroups > li`).evaluateAll(items=>items.map(el=>({label:el.querySelector('b')?.textContent,counts:el.querySelector('span')?.textContent,exercises:el.querySelector('small')?.textContent})));
  assert.deepEqual(rows,SUMMARY_EXPECTED.groups.map(row=>({label:row.label,counts:`${row.primary} ${row.primary===1?'série registrada':'séries registradas'}${row.extensions?` + ${row.extensions} prolong.`:''}`,exercises:`${row.exercises} ${row.exercises===1?'exercício':'exercícios'}`})),'The two known groups and unknown group use only their linked records');
  const text=await page.locator(disclosureSelector('distribution')).innerText();
  for(const phrase of ['4 séries identificadas como trabalho','1 de aquecimento','1 com outro tipo informado','2 sem tipo informado'])assert.ok(text.includes(phrase),phrase);
  assert.match(text,/Séries sem tipo informado não são classificadas como séries de trabalho/);
  assert.match(text,/Falha relatada em 1 série principal\./,'An extension failure cannot be counted as a second primary failure');
  assert.match(text,/sem avaliação de intensidade ou recuperação/);
  assert.match(text,/não distingue a participação principal e secundária/);
  assert.match(text,/não indica, sozinha, necessidade de aumentar ou reduzir/);
}
async function visibleRefresh(page,width,domain,status,label){
  const table={exercises:'health_workout_exercises',sets:'health_workout_sets'}[domain];
  const actionRoute=await page.locator('#refreshBtn').isVisible()?'treinos':'nutricao';
  if(actionRoute!=='treinos')await navigate(page,actionRoute,width);
  assert.equal(await page.locator('#refreshBtn').isVisible(),true,'Use the real visible refresh control, including Nutrition on mobile');
  const readsBefore=await page.evaluate(({table,status,selector})=>{
    window.__historyQA.failTable=status==='error'?table:null;
    window.__languageBeforeRefreshRoot=document.querySelector(selector);
    return window.__historyQA.reads.length;
  },{table,status,selector:roots[actionRoute]});
  await capture(page,`${label}-${domain}-${status}-refresh-control`,'#refreshBtn');
  await page.locator('#refreshBtn').click();
  await stable(page,actionRoute,{afterRefresh:true});
  if(actionRoute!=='treinos')await navigate(page,'treinos',width);
  await stableTraining(page);
  assert.equal(await (await page.waitForFunction(consumerDomainSettled,{domain,status})).jsonValue(),true);
  const proof=await page.evaluate(({domain,table,readsBefore,actionRoute})=>({
    domain,table,actionRoute,route:window.__languageApp.state.route,
    status:window.__languageApp.state.domainStatus[domain],
    newReads:window.__historyQA.reads.slice(readsBefore).filter(item=>item.table===table),
    error:window.__languageApp.state.errors[domain]||null,
    retainedRows:window.__languageApp.state.data[domain]?.length
  }),{domain,table,readsBefore,actionRoute});
  assert.ok(proof.newReads.length>0,'Real refresh must re-read the target source');
  assert.equal(proof.route,'treinos');assert.equal(proof.status,status);
  refreshProof.push({name:label,width,...proof});save();
  return proof;
}
async function failureAndRecovery(page,width,domain,label){
  const proof=await visibleRefresh(page,width,domain,'error',label);
  assert.ok(proof.retainedRows>0,'The failure case includes previous rows; stale totals must not be reused');
  assert.ok(proof.error.includes(LANGUAGE_ERROR),'Keep technical details only in diagnostic state');
  await checkShell(page);
  assert.equal((await page.locator('.ltsRefTrainMetric').last().locator('strong').innerText()).trim(),'—','Unavailable sets are never presented as zero or stale counts');
  assert.deepEqual((await page.locator('.ltsRefOverviewGrid b').allTextContents()).map(s=>s.trim()),domain==='exercises'?['—','—']:['4','—']);
  await literalText(page,'.ltsRefSessionComment > p',SUMMARY_COMMENT,{mustWrap:true});
  await disclose(page,'distribution');
  const distribution=page.locator(disclosureSelector('distribution'));
  const text=await distribution.innerText();
  assert.match(text,/não (?:está disponível|carregaram)|indisponíveis/i,'Source failure remains explicit');
  assert.doesNotMatch(text,/Sem séries detalhadas|Ainda não há exercícios/,'A failed read is not a confirmed empty history');
  assert.doesNotMatch(text,/0 séries registradas|4 séries identificadas como trabalho|Falha relatada/,'Withhold stale counts, phases and effort after failure');
  assert.ok(!(await page.locator('#screenHost').innerText()).includes(LANGUAGE_ERROR),'Raw technical errors are not primary UI copy');
  if(domain==='exercises')assert.equal(await distribution.locator('.ltsRefSessionGroups > li').count(),0);
  else{
    assert.equal(await distribution.locator('.ltsRefSessionGroups > li').count(),3);
    assert.deepEqual(await distribution.locator('.ltsRefSessionGroups > li > span').allTextContents(),Array(3).fill('Séries indisponíveis agora'));
  }
  await capture(page,`${label}-${domain}-unavailable`,disclosureSelector('distribution'));
  await disclose(page,'original');
  await literalText(page,`${disclosureSelector('original')} .ltsRefSessionOriginal`,SUMMARY_REPORT);
  await capture(page,`${label}-${domain}-original-preserved`,`${disclosureSelector('original')} .ltsRefSessionOriginal`);
  await disclose(page,'original',false);await disclose(page,'distribution',false);
  await visibleRefresh(page,width,domain,'ready',label);
  await checkCurrent(page);await checkDistribution(page);
  await capture(page,`${label}-${domain}-recovered`,disclosureSelector('distribution'));
  await disclose(page,'distribution',false);
}
async function security(page,traffic){
  const proof=await page.evaluate(()=>({
    fixtureMode:window.__languageApp.fixtureMode,
    user:window.__languageApp.state.session?.user?.id,
    readonly:Boolean(window.LTSPreviewReadOnly),
    reads:window.__historyQA.reads,writes:window.__historyQA.writes,
    payloadExecuted:typeof window.__trainingSummaryExecuted!=='undefined'
  }));
  assert.equal(proof.fixtureMode,false);assert.equal(proof.readonly,true);
  assert.equal(proof.user,'synthetic-history-browser-user');
  for(const table of ['health_workouts','health_workout_exercises','health_workout_sets'])assert.ok(proof.reads.some(read=>read.table===table),`The real loader read ${table}`);
  const workoutReads=proof.reads.filter(read=>read.table==='health_workouts');
  assert.ok(workoutReads.every(read=>read.projection.includes('session_comment:source_payload->>user_reported_completion_note')&&read.projection.includes('raw_exercises')),'Real loader requests the explicit comment alias and original report');
  assert.ok(workoutReads.every(read=>!read.projection.split(',').some(field=>field==='*'||field==='source_payload')),'Do not broaden reads to the whole source payload');
  assert.equal(proof.payloadExecuted,false);
  assert.deepEqual(proof.writes,[]);assert.deepEqual(traffic.writes,[]);assert.deepEqual(traffic.external,[]);assert.deepEqual(traffic.errors,[]);
  return {productionStartup:true,syntheticOnly:true,authenticatedReal:false,readCount:proof.reads.length,writeCount:0,externalRequestCount:0,commentProjectionVerified:true};
}
async function contextFor(browser,fixture,width,height){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<=840,hasTouch:width<=840,locale:'pt-BR',timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
  const traffic={external:[],writes:[],errors:[]};
  await context.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2'&&request.method()==='GET')return route.fulfill({status:200,contentType:'application/javascript',body:consumerLanguageService(fixture.db)});
    if(url.origin===origin.origin&&['GET','HEAD'].includes(request.method()))return route.continue();
    if(!['GET','HEAD'].includes(request.method()))traffic.writes.push({url:request.url(),method:request.method()});
    else traffic.external.push(request.url());
    return route.abort('blockedbyclient');
  });
  const page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',error=>traffic.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('net::ERR_BLOCKED_BY_CLIENT'))traffic.errors.push(message.text());});
  await page.clock.setFixedTime(new Date(`${SUMMARY_TODAY}T15:00:00Z`));
  return {context,page,traffic};
}

const browser=await chromium.launch({headless:true});
try{
  for(const [width,height] of [[320,740],[393,844],[1180,757],[1440,900]]){
    const label=`${width}-session-summary`,fixture=makeTrainingSessionSummaryFixture();
    const {context,page,traffic}=await contextFor(browser,fixture,width,height);
    const failureStart=failures.length;
    try{
      await page.goto(`${base}#hoje`);await stable(page,'hoje');
      assert.equal(await page.locator('[data-dashboard-card]').count(),7,'The approved Home cards stay unchanged');
      await navigate(page,'treinos',width);await stableTraining(page);await checkCurrent(page);
      await page.locator('.ltsRefTrainPrimaryTabs [data-depth-training-view="summary"]').focus();for(let i=0;i<3;i++)await page.keyboard.press('Tab');
      const progressTab=page.locator('.ltsRefTrainPrimaryTabs [data-depth-training-view="progress"]');assert.equal(await progressTab.evaluate(el=>el===document.activeElement),true,'The exercise index is keyboard-reachable as the fourth destination');
      await page.keyboard.press('Enter');await stableTraining(page,'progress');assert.ok(await page.locator('.ltsExerciseDirectory').isVisible(),'The real fourth tab opens observed exercise history');await chooseTab(page,'summary');await checkCurrent(page);
      for(const kind of ['distribution','original'])assert.equal(await page.locator(disclosureSelector(kind)).evaluate(el=>el.open),false,'New session details begin collapsed');
      await capture(page,`${label}-summary`);
      await capture(page,`${label}-group-chart`,'[data-training-chart="groups"]');
      await capture(page,`${label}-session-chart`,'[data-training-chart="sessions"]');
      await capture(page,`${label}-literal-comment`,'.ltsRefSessionComment');
      await checkDistribution(page);await capture(page,`${label}-distribution`,disclosureSelector('distribution'));
      await disclose(page,'distribution',false);
      assert.equal(await page.locator('.ltsRefSessionGroups').isVisible(),false,'Closing the native disclosure hides its details');
      await disclose(page,'original');
      await literalText(page,`${disclosureSelector('original')} .ltsRefSessionOriginal`,SUMMARY_REPORT);
      await capture(page,`${label}-literal-original`,`${disclosureSelector('original')} .ltsRefSessionOriginal`);
      await disclose(page,'original',false);
      assert.equal(await page.locator('.ltsRefSessionOriginal').isVisible(),false);

      await chooseTab(page,'exercises');
      assert.equal(await page.locator('.ltsRefExerciseCard').count(),4);
      await capture(page,`${label}-exercises`);
      await chooseTab(page,'summary');await checkCurrent(page);
      await chooseTab(page,'history');await capture(page,`${label}-history`);
      await page.locator(`.ltsWorkoutList [data-depth-workout="${SUMMARY_IDS.old}"]`).click();
      await stableTraining(page,'summary',SUMMARY_IDS.old);await checkShell(page,SUMMARY_IDS.old);
      assert.equal(await page.locator('.ltsRefSessionComment').count(),0,'An older session without an explicit comment never inherits the current comment');
      assert.ok(!(await page.locator('#screenHost').innerText()).includes(SUMMARY_COMMENT));
      assert.ok(!(await page.locator('#screenHost').innerText()).includes(SUMMARY_GENERIC_NOTE),'Generic notes never become a completion comment');
      assert.equal(await page.locator(disclosureSelector('distribution')).count(),0,'Session disclosure IDs follow the selected session');
      await disclose(page,'original',true,SUMMARY_IDS.old);
      await literalText(page,`${disclosureSelector('original',SUMMARY_IDS.old)} .ltsRefSessionOriginal`,SUMMARY_OLD_REPORT);
      await capture(page,`${label}-older-no-comment`,disclosureSelector('original',SUMMARY_IDS.old));
      await disclose(page,'original',false,SUMMARY_IDS.old);

      await openSession(page,SUMMARY_IDS.empty,SUMMARY_IDS.old);
      assert.equal(await page.locator('.ltsRefSessionComment').count(),0);
      assert.deepEqual((await page.locator('.ltsRefOverviewGrid b').allTextContents()).map(s=>s.trim()),['0','0'],'Only a successful empty source can display zero');
      await disclose(page,'distribution',true,SUMMARY_IDS.empty);
      assert.equal(await page.locator('.ltsRefSessionGroups > li').count(),0);
      assert.match(await page.locator(disclosureSelector('distribution',SUMMARY_IDS.empty)).innerText(),/Ainda não há exercícios/);
      await capture(page,`${label}-confirmed-empty`,disclosureSelector('distribution',SUMMARY_IDS.empty));
      await openSession(page,SUMMARY_IDS.current,SUMMARY_IDS.empty);await checkCurrent(page);

      await page.locator('.ltsRefTrainBack[data-route="hoje"]').click();await stable(page,'hoje');
      assert.equal(await page.locator('[data-dashboard-card]').count(),7);
      await capture(page,`${label}-home-return`);
      await navigate(page,'treinos',width);await stableTraining(page);await checkCurrent(page);
      for(const domain of ['exercises','sets'])await failureAndRecovery(page,width,domain,label);
      const proof=await security(page,traffic);
      results.push({name:label,width,height,status:failures.length===failureStart?'passed':'failed',...proof});save();
    }catch(error){
      const diagnostic=await page.evaluate(()=>({route:window.__languageApp?.state.route,domainStatus:window.__languageApp?.state.domainStatus,reads:window.__historyQA?.reads,view:document.querySelector('.ltsTrainingReference')?.dataset,visibleText:document.querySelector('#screenHost')?.innerText})).catch(()=>null);
      writeFileSync(`${dir}/${label}-failure-diagnostic.json`,JSON.stringify({syntheticOnly:true,authenticatedReal:false,diagnostic,traffic},null,2));
      await page.screenshot({path:`${dir}/${label}-failure.png`,animations:'disabled',scale:'css'}).catch(()=>{});
      failures.push({name:label,message:String(error.message)});
      results.push({name:label,width,height,status:'failed',syntheticOnly:true,authenticatedReal:false});save();
    }finally{await context.close();}
  }
}finally{save();await browser.close();}
assert.equal(failures.length,0,`Session summary QA found ${failures.length} failures; inspect ${dir}/results.json and original-resolution screenshots.`);
console.log('Session summary: four widths, literal comments/reports, separate groups/phases/extensions, history and Home navigation, visible refresh failure/recovery, >=44px new disclosures and no overflow. Legacy smaller controls are inventoried separately. Synthetic only; no real authenticated QA.');
