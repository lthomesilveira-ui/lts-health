import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import {runDepthChecks} from './real-auth-depth-checks.mjs';

const tokenHash=readFileSync('/tmp/lts-health-token-hash','utf8').trim();
if(!tokenHash)throw new Error('authenticated token hash missing');
const coreSource=readFileSync(new URL('./src/core.js',import.meta.url),'utf8');
const supabaseUrl=/url:\s*'([^']+)'/.exec(coreSource)?.[1];
const supabaseKey=/key:\s*'([^']+)'/.exec(coreSource)?.[1];
if(!supabaseUrl||!supabaseKey)throw new Error('public Supabase configuration not resolved');

const appUrl='https://lthomesilveira-ui.github.io/lts-health/v2/';
const evidenceDir='v2/real-auth-evidence';
mkdirSync(evidenceDir,{recursive:true});
let runtimeErrorCount=0;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
page.on('pageerror',()=>runtimeErrorCount++);
page.on('console',m=>{if(m.type()==='error')runtimeErrorCount++;});

const routeReadySelectors=Object.freeze({
  hoje:'.ltsHomeReference',
  timeline:'.timelineSummary',
  treinos:'.ltsTrainingReference',
  bio:'.ltsCompositionV2',
  nutricao:'.nutritionDays',
  saude:'.ltsLabsV2',
  analise:'.ltsRecoveryV2',
  tratamentos:'.protocolSummaryGrid',
  dados:'[data-review-inbox]',
  evolucao:'.evolutionChangeTable'
});

async function waitForRoute(route){
  const readySelector=routeReadySelectors[route];
  if(!readySelector)throw new Error(`no authenticated ready selector registered for ${route}`);
  const mobile=(await page.viewportSize()).width<=840;
  const direct=`#${mobile?'mobileNav':'primaryNav'} [data-route="${route}"]`;
  if(await page.locator(direct).count()){
    await page.locator(direct).click();
  }else{
    const more=`#${mobile?'mobileNav':'primaryNav'} [data-route="mais"]`;
    await page.locator(more).click();
    await page.waitForSelector('#moreSheet:not(.hidden)',{timeout:30000});
    await page.locator(`#moreSheet [data-route="${route}"]`).click();
  }
  await page.waitForFunction(({value,readySelector})=>{
    const routeAction=document.querySelector('#routeAction');
    const mobileButtons=[...document.querySelectorAll('#mobileNav button')].filter(button=>{
      const rect=button.getBoundingClientRect(),style=getComputedStyle(button);
      return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>=44&&rect.left>=-1&&rect.right<=window.innerWidth+1;
    });
    const expectedMobileRoute=['hoje','bio','treinos','saude'].includes(value)?value:'mais';
    const mobileActive=mobileButtons.filter(button=>button.classList.contains('active'));
    const mobileShellReady=window.innerWidth>840||(mobileButtons.length===5&&mobileActive.length===1&&mobileActive[0].dataset.route===expectedMobileRoute);
    return location.hash===`#${value}`
      &&document.body.dataset.productRoute===value
      &&Boolean(document.querySelector('#screenHost h1'))
      &&Boolean(document.querySelector(readySelector))
      &&!document.querySelector('#screenHost .loadingState')
      &&(!routeAction||getComputedStyle(routeAction).display==='none')
      &&mobileShellReady;
  },{value:route,readySelector},{timeout:30000});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(150);
}
async function assertNoHorizontalOverflow(){
  const ok=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
  if(!ok)throw new Error('real-data route overflow detected');
}
async function assertStableMobileShell(label){
  const result=await page.evaluate(()=>{
    if(window.innerWidth>840)return{desktop:true};
    const visible=element=>{const rect=element?.getBoundingClientRect(),style=element?getComputedStyle(element):null;return Boolean(element&&style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0);};
    const buttons=[...document.querySelectorAll('#mobileNav button')].filter(visible).map(button=>{const rect=button.getBoundingClientRect();return{route:button.dataset.route,text:button.textContent.trim(),left:rect.left,right:rect.right,width:rect.width,active:button.classList.contains('active')};});
    const brand=[document.querySelector('.topbar .brand b'),document.querySelector('.ltsRefBrand')].find(visible);
    const routeAction=document.querySelector('#routeAction');
    return{desktop:false,route:document.body.dataset.productRoute||'',viewportWidth:window.innerWidth,buttons,brand:brand?.textContent?.trim()||'',routeActionVisible:visible(routeAction)};
  });
  if(result.desktop)return;
  if(result.buttons.length!==5||result.buttons.some(button=>button.width<44||button.left< -1||button.right>result.viewportWidth+1))throw new Error(`${label}: mobile navigation is not fully settled ${JSON.stringify(result.buttons)}`);
  const expected=['hoje','bio','treinos','saude'].includes(result.route)?result.route:'mais';
  const active=result.buttons.filter(button=>button.active);
  if(active.length!==1||active[0].route!==expected)throw new Error(`${label}: mobile navigation has competing or incorrect active destinations ${JSON.stringify({route:result.route,expected,active})}`);
  if(!result.brand.includes('LTS Health'))throw new Error(`${label}: mobile brand is not visible`);
  if(result.routeActionVisible)throw new Error(`${label}: stale contextual action remains visible`);
}
async function assertMinimumReadableType(selector,minimum,label){
  const result=await page.evaluate(selector=>{
    const samples=[...document.querySelectorAll(selector)].filter(el=>{
      const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
      return style.display!=='none'&&style.visibility!=='hidden'&&(rect.width>0||rect.height>0);
    }).map(el=>parseFloat(getComputedStyle(el).fontSize)).filter(Number.isFinite);
    return{count:samples.length,minimum:samples.length?Math.min(...samples):null};
  },selector);
  if(!result.count)throw new Error(`${label}: audited typography is missing`);
  if(result.minimum<minimum)throw new Error(`${label}: supporting type is too small (${result.minimum}px)`);
}
async function auditReferenceHome(label){
  const result=await page.evaluate(()=>{
    const top=selector=>document.querySelector(selector)?.getBoundingClientRect().top??99999;
    return{
      build:document.querySelector('meta[name="lts-build"]')?.content||'',
      legacyVisible:Boolean(document.querySelector('[data-executive-dashboard]')),
      motto:document.querySelector('.ltsRefMotto')?.textContent?.trim()||'',
      metrics:[...document.querySelectorAll('.ltsRefMetric>span')].map(el=>el.textContent.trim()),
      top:{metrics:top('.ltsRefMetrics'),today:top('.ltsRefToday'),progress:top('.ltsRefProgress'),panorama:top('.ltsRefIntegrated')},
      minSupportingFont:Math.min(...[...document.querySelectorAll('.ltsRefMetric>span,.ltsRefMetric>div small,.ltsRefTodayCopy small,.ltsRefProgressItem>small,.ltsRefDomain>small')].map(el=>parseFloat(getComputedStyle(el).fontSize)))
    };
  });
  if(result.build!=='ux-coherence-public-visual-closure-20260915.26')throw new Error(`${label}: unexpected public build ${result.build}`);
  if(result.legacyVisible)throw new Error(`${label}: legacy Home is visible`);
  if(!result.motto.includes('Disciplina hoje, evolução sempre'))throw new Error(`${label}: approved Home context line is missing`);
  if(!result.metrics.includes('Massa magra'))throw new Error(`${label}: approved lean-mass metric is missing`);
  if(!(result.top.metrics<result.top.today&&result.top.today<result.top.panorama&&result.top.progress<result.top.panorama))throw new Error(`${label}: Home priority hierarchy is wrong ${JSON.stringify(result.top)}`);
  if(result.minSupportingFont<9.5)throw new Error(`${label}: Home supporting type is too small (${result.minSupportingFont}px)`);
}
async function auditExerciseGeometry(label){
  const result=await page.evaluate(()=>{
    const card=document.querySelector('.ltsRefExerciseCard'),header=card?.querySelector(':scope > header'),copy=header?.querySelector(':scope > div:nth-child(2)'),title=copy?.querySelector('b'),sets=card?.querySelector('.ltsRefSetTable'),action=card?.querySelector('.ltsRefExerciseHistory');
    const rect=el=>el?.getBoundingClientRect()||null,c=rect(card),h=rect(header),x=rect(copy),t=rect(title),s=rect(sets),a=rect(action);
    return{display:card?getComputedStyle(card).display:'missing',cardWidth:c?.width||0,headerWidth:h?.width||0,copyWidth:x?.width||0,titleWidth:t?.width||0,setsBelow:Boolean(h&&s&&s.top>=h.bottom-1),actionWidth:a?.width||0};
  });
  if(result.display!=='block'||result.headerWidth<result.cardWidth*.85||result.copyWidth<110||result.titleWidth<110||!result.setsBelow||result.actionWidth<120)throw new Error(`${label}: real Training exercise geometry is broken ${JSON.stringify(result)}`);
}
async function assertLightReadableCards(selector,label){
  const result=await page.evaluate(selector=>{
    const parse=color=>{const match=String(color).match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);return match?[Number(match[1]),Number(match[2]),Number(match[3])]:null;};
    const luminance=rgb=>rgb?(0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2])/255:null;
    return[...document.querySelectorAll(selector)].slice(0,8).map(card=>({bg:luminance(parse(getComputedStyle(card).backgroundColor)),text:luminance(parse(getComputedStyle(card).color))}));
  },selector);
  if(!result.length)throw new Error(`${label}: audited cards are missing`);
  if(result.some(sample=>sample.bg==null||sample.text==null||sample.bg<.78||sample.text>.45))throw new Error(`${label}: dark-on-dark or low-clarity card remains`);
}
async function readIntegritySnapshot(){
  return page.evaluate(async ({url,key})=>{
    const client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
    const {data:sessionData,error:sessionError}=await client.auth.getSession();
    if(sessionError||!sessionData?.session?.user)return{error:'authenticated data session unavailable'};
    async function fetchAll(table,select){
      const rows=[],pageSize=1000;
      for(let from=0;;from+=pageSize){
        const {data,error}=await client.from(table).select(select).range(from,from+pageSize-1);
        if(error)return{error:`${table}: ${error.message}`};
        const chunk=data||[];rows.push(...chunk);if(chunk.length<pageSize)break;
      }
      return{rows};
    }
    const specs=[
      ['workouts','health_workouts','source_record_id,workout_date,is_canonical,record_status'],
      ['exercises','health_workout_exercises','source_record_id,workout_source_record_id'],
      ['sets','health_workout_sets','source_record_id,workout_source_record_id,exercise_source_record_id'],
      ['evidence','health_workout_source_evidence','source_record_id,workout_source_record_id'],
      ['sourceMetrics','health_source_daily_metrics','source_record_id,metric_type,source_family,canonical_status'],
      ['quality','health_data_quality_issues','source_record_id,status'],
      ['uploads','health_uploads','id,status']
    ];
    const results=await Promise.all(specs.map(([,table,select])=>fetchAll(table,select)));
    const failure=results.find(r=>r.error);if(failure)return{error:failure.error};
    const data=Object.fromEntries(specs.map(([name],i)=>[name,results[i].rows]));
    const workoutIds=new Set(data.workouts.map(r=>r.source_record_id).filter(Boolean));
    const exerciseIds=new Set(data.exercises.map(r=>r.source_record_id).filter(Boolean));
    const visibleWorkouts=data.workouts.filter(r=>r.is_canonical===true&&String(r.record_status||'').toLowerCase()!=='quarantined')
      .sort((a,b)=>String(b.workout_date||'').localeCompare(String(a.workout_date||''))||String(a.source_record_id||'').localeCompare(String(b.source_record_id||'')));
    const latest=visibleWorkouts[0]||null;
    const allowedCanonical=new Set(['apple_activity_summary|active_energy_kcal','apple_activity_summary|exercise_minutes','apple_activity_summary|stand_hours']);
    return{
      orphanExercises:data.exercises.filter(r=>!r.workout_source_record_id||!workoutIds.has(r.workout_source_record_id)).length,
      orphanSetsByWorkout:data.sets.filter(r=>!r.workout_source_record_id||!workoutIds.has(r.workout_source_record_id)).length,
      orphanSetsByExercise:data.sets.filter(r=>r.exercise_source_record_id&&!exerciseIds.has(r.exercise_source_record_id)).length,
      orphanEvidence:data.evidence.filter(r=>!r.workout_source_record_id||!workoutIds.has(r.workout_source_record_id)).length,
      canonicalBoundaryViolations:data.sourceMetrics.filter(r=>String(r.canonical_status||'').toLowerCase()==='canonical'&&!allowedCanonical.has(`${String(r.source_family||'').toLowerCase()}|${String(r.metric_type||'').toLowerCase()}`)).length,
      latestWorkoutId:latest?.source_record_id||null,
      latestWorkoutDate:latest?.workout_date||null,
      latestExpectedExercises:latest?data.exercises.filter(r=>r.workout_source_record_id===latest.source_record_id).length:0,
      latestExpectedSets:latest?data.sets.filter(r=>r.workout_source_record_id===latest.source_record_id).length:0,
      internalQualityCount:data.quality.filter(r=>['open','in_progress'].includes(String(r.status||'').toLowerCase())).length,
      uploadActionCount:data.uploads.filter(r=>['rejected','failed'].includes(String(r.status||'').toLowerCase())).length
    };
  },{url:supabaseUrl,key:supabaseKey});
}

try{
  const expectedBuild=/name="lts-build" content="([^"]+)"/.exec(readFileSync('v2/index.html','utf8'))?.[1];
  if(!expectedBuild)throw new Error('Release build is not identified');
  let published=false;
  for(let attempt=0;attempt<45;attempt++){
    try{const response=await fetch(`${appUrl}?release-check=${Date.now()}`,{signal:AbortSignal.timeout(15000)});if(response.ok&&(await response.text()).includes(`name="lts-build" content="${expectedBuild}"`)){published=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,4000));
  }
  if(!published)throw new Error('Public deployment did not reach the exact build within the release window');
  await page.goto(`${appUrl}#hoje`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>Boolean(window.supabase?.createClient),null,{timeout:20000});
  const sessionResult=await page.evaluate(async ({url,key,tokenHash})=>{
    const client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    const {data,error}=await client.auth.verifyOtp({token_hash:tokenHash,type:'email'});
    return{ok:!error&&Boolean(data?.session?.user)};
  },{url:supabaseUrl,key:supabaseKey,tokenHash});
  if(!sessionResult.ok)throw new Error('real authenticated session could not be established');
  await page.reload({waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('#app:not(.hidden)',{timeout:30000});
  if(await page.locator('#login:not(.hidden)').count())throw new Error('real authenticated app returned to login');
  if(page.url().includes('fixture'))throw new Error('fixture mode is not allowed in real authenticated E2E');

  const integrity=await readIntegritySnapshot();
  if(integrity.error)throw new Error(`real-data integrity snapshot failed: ${integrity.error}`);
  const linkageFailures=integrity.orphanExercises+integrity.orphanSetsByWorkout+integrity.orphanSetsByExercise+integrity.orphanEvidence;
  if(linkageFailures)throw new Error(`real-data linkage integrity failed: ${JSON.stringify({orphanExercises:integrity.orphanExercises,orphanSetsByWorkout:integrity.orphanSetsByWorkout,orphanSetsByExercise:integrity.orphanSetsByExercise,orphanEvidence:integrity.orphanEvidence,canonicalBoundaryViolations:integrity.canonicalBoundaryViolations})}`);
  if(integrity.canonicalBoundaryViolations)throw new Error(`real-data canonical boundary failed: ${integrity.canonicalBoundaryViolations}`);
  if(!integrity.latestWorkoutId||integrity.latestExpectedExercises<1||integrity.latestExpectedSets<1)throw new Error('latest canonical workout has no structured linkage');

  await waitForRoute('hoje');
  await page.waitForSelector('.ltsHomeReference',{timeout:30000});
  const homeState=await page.evaluate(()=>({
    greeting:document.querySelector('.ltsHomeReference h1')?.textContent?.trim()||'',
    metrics:document.querySelectorAll('.ltsRefMetrics .ltsRefMetric').length,
    today:Boolean(document.querySelector('.ltsRefToday')),
    progress:document.querySelectorAll('.ltsRefProgressItem').length,
    trainingRow:Boolean(document.querySelector('.ltsRefTodayIcon.training')),
    legacyVisible:Boolean(document.querySelector('[data-executive-dashboard]'))
  }));
  if(!homeState.greeting||homeState.metrics!==3||!homeState.today||homeState.progress!==4||!homeState.trainingRow)throw new Error(`reference Home missing: ${JSON.stringify(homeState)}`);
  if(homeState.legacyVisible)throw new Error('legacy executive Home remained active');
  if(await page.locator('#routeAction').isVisible())throw new Error('desktop Home duplicates the water import action in the top bar');
  await auditReferenceHome('desktop Home');
  await assertNoHorizontalOverflow();
  await page.screenshot({path:`${evidenceDir}/desktop-home.png`,fullPage:true});

  await waitForRoute('treinos');
  await page.waitForSelector('.ltsTrainingV2[data-training-view="summary"]',{timeout:30000});
  const trainingSummary=await page.evaluate(()=>({
    text:document.querySelector('.ltsTrainingV2')?.innerText||'',
    summaryExercises:document.querySelector('.ltsRefOverviewGrid div:first-child b')?.textContent?.trim()||'',
    summarySets:document.querySelector('.ltsRefOverviewGrid div:nth-child(2) b')?.textContent?.trim()||''
  }));
  if(Number(trainingSummary.summaryExercises)!==integrity.latestExpectedExercises||Number(trainingSummary.summarySets)!==integrity.latestExpectedSets){
    throw new Error(`latest workout summary mismatch: ui=${trainingSummary.summaryExercises}/${trainingSummary.summarySets} data=${integrity.latestExpectedExercises}/${integrity.latestExpectedSets}`);
  }
  if(integrity.latestWorkoutDate&&!trainingSummary.text.includes(String(integrity.latestWorkoutDate).split('-').reverse().join('/')))throw new Error('latest workout date missing from structural Training');
  await page.screenshot({path:`${evidenceDir}/desktop-training-summary.png`,fullPage:true});
  await page.locator('.ltsRefTrainTabs [data-depth-training-view="exercises"]').click();
  await page.waitForFunction(()=>document.querySelector('.ltsTrainingV2')?.dataset.trainingView==='exercises',{timeout:30000});
  await page.waitForSelector('.ltsRefExerciseCard',{timeout:30000});
  const trainingDetail=await page.evaluate(()=>({
    exercises:document.querySelectorAll('.ltsRefExerciseCard').length,
    sets:document.querySelectorAll('.ltsRefExerciseCard .ltsRefSetTable>div:not(.ltsRefSetEmpty)').length
  }));
  if(trainingDetail.exercises!==integrity.latestExpectedExercises||trainingDetail.sets!==integrity.latestExpectedSets){
    throw new Error(`latest real workout linkage mismatch after opening Exercises: ui=${trainingDetail.exercises}/${trainingDetail.sets} data=${integrity.latestExpectedExercises}/${integrity.latestExpectedSets}`);
  }
  await auditExerciseGeometry('desktop Training');
  await page.screenshot({path:`${evidenceDir}/desktop-training-exercises.png`,fullPage:true});
  const firstExerciseHistory=page.locator('.ltsRefExerciseCard [data-depth-exercise]').first();
  if(await firstExerciseHistory.count()){
    await firstExerciseHistory.click();
    await page.waitForFunction(()=>document.querySelector('.ltsTrainingV2')?.dataset.trainingView==='exercise',{timeout:30000});
    if(await page.locator('.ltsRefExerciseNav').count()<1)throw new Error('exercise history did not expose return navigation');
    await page.locator('.ltsRefExerciseNav [data-depth-training-view="exercises"]').click();
    await page.waitForFunction(()=>document.querySelector('.ltsTrainingV2')?.dataset.trainingView==='exercises',{timeout:30000});
  }
  await assertNoHorizontalOverflow();

  await waitForRoute('bio');
  await page.waitForSelector('.ltsCompositionV2',{timeout:30000});
  const compositionState=await page.evaluate(()=>({
    title:document.querySelector('.ltsCompositionV2 h1')?.textContent?.trim()||'',
    metrics:document.querySelectorAll('.ltsCompositionMetrics .ltsCompositionMetric').length,
    tabs:document.querySelectorAll('[data-composition-metric]').length,
    chart:Boolean(document.querySelector('.ltsCompositionChart')),
    trust:Boolean(document.querySelector('.ltsCompositionTrust'))
  }));
  if(compositionState.title!=='Composição corporal'||compositionState.metrics!==3||compositionState.tabs<3||!compositionState.chart||!compositionState.trust)throw new Error(`structural Composition missing: ${JSON.stringify(compositionState)}`);
  await page.locator('[data-composition-metric="weight_kg"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-composition-metric="weight_kg"]')?.classList.contains('active'));
  await assertNoHorizontalOverflow();
  await page.screenshot({path:`${evidenceDir}/desktop-composition.png`,fullPage:true});

  await waitForRoute('tratamentos');
  if(await page.locator('.timelineItem').count()<1)throw new Error('real protocol history missing');
  await assertLightReadableCards('.protocolSummaryCard','desktop Protocols');
  await waitForRoute('dados');
  if(await page.locator('.qualityRow').count()<1)throw new Error('real quality history missing');
  const resolvedCount=await page.locator('.qualityRow').filter({hasText:'resolvido'}).count();
  if(resolvedCount<1)throw new Error('resolved real quality item missing');
  const dataText=await page.locator('#screenHost').innerText();
  if(integrity.uploadActionCount===0&&!dataText.includes('Nada exige sua ação agora'))throw new Error('real Data Inbox action state is contradictory');
  if(integrity.uploadActionCount>0&&dataText.includes('Nada exige sua ação agora'))throw new Error('real Data Inbox hides required user action');
  if(integrity.internalQualityCount>0&&!dataText.includes('Tratamento interno'))throw new Error('real Data Inbox internal-quality state is contradictory');
  await assertLightReadableCards('.reviewInbox,.reviewStat,.sourceStatus','desktop Data');

  await waitForRoute('nutricao');
  await assertMinimumReadableType('.nutritionMonthHead b,.nutritionMonthHead span,.nutritionMonthStats span,.nutritionDays time,.nutritionDays b,.nutritionDays small',10.5,'desktop Nutrition');
  if(await page.locator('#routeAction').isVisible())throw new Error('desktop Nutrition duplicates its import action in the top bar');
  await page.screenshot({path:`${evidenceDir}/desktop-nutrition.png`});
  await waitForRoute('evolucao');
  await assertMinimumReadableType('.evoAxis,.evoDelta,.changeRow:not(.changeHead),[data-evolution-metric]',10.5,'desktop Evolution');
  await page.screenshot({path:`${evidenceDir}/desktop-evolution.png`});
  await page.locator('.evolutionLowerGrid').scrollIntoViewIfNeeded();
  const evolutionLowerGrid=await page.evaluate(()=>{
    const grid=document.querySelector('.evolutionLowerGrid');
    const cards=grid?[...grid.children]:[],rects=cards.map(card=>card.getBoundingClientRect());
    return{align:grid?getComputedStyle(grid).alignItems:'missing',columns:grid?getComputedStyle(grid).gridTemplateColumns:'missing',cards:cards.map((card,index)=>({align:getComputedStyle(card).alignSelf,height:rects[index].height,width:rects[index].width,top:rects[index].top,bottom:rects[index].bottom}))};
  });
  if(evolutionLowerGrid.align!=='start'||evolutionLowerGrid.cards.length!==2||evolutionLowerGrid.cards.some(card=>card.align!=='start')||evolutionLowerGrid.cards[1].top<evolutionLowerGrid.cards[0].bottom-1)throw new Error(`desktop Evolution lower flow remains split or stretched: ${JSON.stringify(evolutionLowerGrid)}`);
  await page.screenshot({path:`${evidenceDir}/desktop-evolution-lower.png`});
  await page.locator('.evolutionSegmental').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${evidenceDir}/desktop-evolution-segmental.png`});

  await page.setViewportSize({width:390,height:844});
  await waitForRoute('hoje');
  await page.waitForSelector('.ltsHomeReference',{timeout:30000});
  if(await page.locator('#routeAction').isVisible())throw new Error('mobile Home duplicates the water import action in the top bar');
  await auditReferenceHome('mobile Home');
  await assertNoHorizontalOverflow();
  await assertStableMobileShell('mobile Home');
  await page.screenshot({path:`${evidenceDir}/mobile-home.png`,fullPage:true});
  await waitForRoute('treinos');
  await page.waitForSelector('.ltsTrainingV2',{timeout:30000});
  await page.locator('.ltsRefTrainTabs [data-depth-training-view="summary"]').click();
  await page.waitForFunction(()=>document.querySelector('.ltsTrainingV2')?.dataset.trainingView==='summary',{timeout:30000});
  await assertNoHorizontalOverflow();
  await assertStableMobileShell('mobile Training summary');
  await page.screenshot({path:`${evidenceDir}/mobile-training.png`,fullPage:true});
  await page.locator('.ltsRefTrainTabs [data-depth-training-view="exercises"]').click();
  await page.waitForFunction(()=>document.querySelector('.ltsTrainingV2')?.dataset.trainingView==='exercises',{timeout:30000});
  await page.waitForSelector('.ltsRefExerciseCard',{timeout:30000});
  await auditExerciseGeometry('mobile Training');
  await assertNoHorizontalOverflow();
  await assertStableMobileShell('mobile Training exercises');
  await page.screenshot({path:`${evidenceDir}/mobile-training-exercises.png`,fullPage:true});
  await waitForRoute('bio');
  await page.waitForSelector('.ltsCompositionV2',{timeout:30000});
  await assertNoHorizontalOverflow();
  await assertStableMobileShell('mobile Composition');
  await page.screenshot({path:`${evidenceDir}/mobile-composition.png`,fullPage:true});

  await waitForRoute('nutricao');
  await assertNoHorizontalOverflow();
  await assertMinimumReadableType('.nutritionMonthHead b,.nutritionMonthHead span,.nutritionMonthStats span,.nutritionDays time,.nutritionDays b,.nutritionDays small',10.5,'mobile Nutrition');
  if(await page.locator('#routeAction').isVisible())throw new Error('mobile Nutrition duplicates its import action in the top bar');
  await page.evaluate(()=>document.querySelector('#screenHost')?.scrollTo(0,0));
  await assertStableMobileShell('mobile Nutrition');
  await page.screenshot({path:`${evidenceDir}/mobile-nutrition.png`});
  await page.locator('.nutritionDays').scrollIntoViewIfNeeded();
  await assertStableMobileShell('mobile Nutrition history');
  await page.screenshot({path:`${evidenceDir}/mobile-nutrition-history.png`});
  const nutritionDay=page.locator('details.uxDisclosure summary').filter({hasText:'Detalhe do dia selecionado'}).first();
  await nutritionDay.click();
  await page.locator('.nutritionDayHead').scrollIntoViewIfNeeded();
  await assertMinimumReadableType('.nutritionDayHead span,.nutritionDayHead small,.macroGrid span,.mealRow b,.mealRow small,.mealRow em',10.5,'mobile Nutrition day detail');
  await assertStableMobileShell('mobile Nutrition day detail');
  await page.screenshot({path:`${evidenceDir}/mobile-nutrition-day.png`});

  await waitForRoute('analise');
  const recoveryPeriod=await page.evaluate(()=>({value:document.querySelector('#analysisPeriod')?.value||'',heading:document.querySelector('.domainHero span')?.textContent||''}));
  if(!recoveryPeriod.value||!recoveryPeriod.heading.includes(recoveryPeriod.value==='365'?'último ano':recoveryPeriod.value==='30'?'últimos 30 dias':recoveryPeriod.value==='90'?'últimos 90 dias':'todo o histórico'))throw new Error(`mobile Recovery period control contradicts its heading: ${JSON.stringify(recoveryPeriod)}`);
  await assertNoHorizontalOverflow();
  await assertStableMobileShell('mobile Recovery');
  await page.screenshot({path:`${evidenceDir}/mobile-recovery.png`});

  await waitForRoute('saude');
  await assertNoHorizontalOverflow();
  await assertStableMobileShell('mobile Labs');
  await page.screenshot({path:`${evidenceDir}/mobile-labs.png`});

  await waitForRoute('tratamentos');
  await assertNoHorizontalOverflow();
  await assertStableMobileShell('mobile Protocols');
  await page.screenshot({path:`${evidenceDir}/mobile-protocols.png`});

  await waitForRoute('evolucao');
  await assertNoHorizontalOverflow();
  await assertMinimumReadableType('.evoAxis,.evoDelta,.changeRow:not(.changeHead),[data-evolution-metric]',10.5,'mobile Evolution');
  await page.evaluate(()=>document.querySelector('#screenHost')?.scrollTo(0,0));
  await assertStableMobileShell('mobile Evolution');
  await page.screenshot({path:`${evidenceDir}/mobile-evolution.png`});
  await page.locator('.evolutionChangeTable').scrollIntoViewIfNeeded();
  await assertStableMobileShell('mobile Evolution changes');
  await page.screenshot({path:`${evidenceDir}/mobile-evolution-changes.png`});
  await page.locator('.evolutionTrainingRhythm').scrollIntoViewIfNeeded();
  await assertStableMobileShell('mobile Evolution training rhythm');
  await page.screenshot({path:`${evidenceDir}/mobile-evolution-training.png`});
  if(await page.locator('.segmentKinds').count()){
    await page.locator('.segmentKinds').scrollIntoViewIfNeeded();
    await assertMinimumReadableType('.segmentKindTitle b,.segmentKindTitle small,.segmentPair span,.segmentPair strong,.sideDifferenceHead small',10.5,'mobile Evolution segmental');
    await assertStableMobileShell('mobile Evolution segmental');
    await page.screenshot({path:`${evidenceDir}/mobile-evolution-segmental.png`});
  }

  await waitForRoute('timeline');
  const timelineVisible=Number(await page.locator('.timelineSummary b').textContent());
  if(timelineVisible>50)throw new Error(`mobile Timeline rendered ${timelineVisible} records before progressive loading`);
  await assertNoHorizontalOverflow();
  await assertStableMobileShell('mobile Timeline');
  await page.screenshot({path:`${evidenceDir}/mobile-timeline.png`});

  await waitForRoute('dados');
  await assertNoHorizontalOverflow();
  await assertStableMobileShell('mobile Data');
  await page.screenshot({path:`${evidenceDir}/mobile-data.png`});
  await page.locator('#mobileNav [data-route="mais"]').click();
  await page.waitForSelector('#moreSheet:not(.hidden)',{timeout:30000});
  await assertStableMobileShell('mobile More');
  await page.screenshot({path:`${evidenceDir}/mobile-more.png`});
  await page.locator('#moreSheet [data-route="evolucao"]').click();

  await runDepthChecks(page,{appUrl,supabaseUrl,supabaseKey,evidenceDir,waitForRoute,assertStableMobileShell});

  await page.evaluate(async ({url,key})=>{const client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});await client.auth.signOut({scope:'local'});},{url:supabaseUrl,key:supabaseKey});
  if(runtimeErrorCount)throw new Error(`browser runtime errors occurred during real authenticated E2E: ${runtimeErrorCount}`);
  console.log(`LTS Health real authenticated E2E passed; integrity=${JSON.stringify({orphanExercises:integrity.orphanExercises,orphanSetsByWorkout:integrity.orphanSetsByWorkout,orphanSetsByExercise:integrity.orphanSetsByExercise,orphanEvidence:integrity.orphanEvidence,canonicalBoundaryViolations:integrity.canonicalBoundaryViolations})}`);
}finally{await browser.close();}
