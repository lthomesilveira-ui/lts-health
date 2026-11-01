import {auditObservedNutritionContrast} from './real-auth-dashboard-checks.mjs';
// Called inside the authorized real-auth session before signing out. Never print record identifiers or values.
export async function runDepthChecks(page,{appUrl,supabaseUrl,supabaseKey,evidenceDir,waitForRoute,assertStableMobileShell}){
  let depthCheck=0;
  const check=(ok,message)=>{depthCheck++;if(!ok){const error=new Error(`Real-data depth contract: ${message}`);error.auditCode=`depth-check-${depthCheck}`;throw error;}};
  const truth=await page.evaluate(async ({url,key})=>{
    const client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
    async function all(table,select){
      const rows=[];
      for(let from=0;;from+=1000){const {data,error}=await client.from(table).select(select).order('source_record_id',{ascending:true}).range(from,from+999);if(error)throw new Error('Independent read failed');rows.push(...data);if(data.length<1000)break;}
      return rows;
    }
    const [workouts,labs,body]=await Promise.all([all('health_workouts','source_record_id,is_canonical,record_status'),all('health_lab_results','source_record_id,biomarker,result_numeric,result_raw'),all('health_body_composition','source_record_id')]);
    const norm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const groups=new Map();labs.forEach(r=>{const k=norm(r.biomarker);if(!k)return;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);});
    const ranked=[...groups].sort((a,b)=>b[1].length-a[1].length);
    return{workoutIds:workouts.filter(r=>r.is_canonical===true&&r.record_status!=='quarantined').map(r=>r.source_record_id),bodyIds:body.map(r=>r.source_record_id),markerKeys:[...groups.keys()],largestMarker:ranked[0]?.[0],largestMarkerCount:ranked[0]?.[1].length||0,singleMarker:ranked.find(([,r])=>r.length===1)?.[0]||null};
  },{url:supabaseUrl,key:supabaseKey});
  const goto=async(route,selector)=>{await waitForRoute(route);await page.waitForSelector(selector,{timeout:30000});};
  const noOverflow=async()=>check(await page.evaluate(()=>{const h=document.querySelector('#screenHost');return document.documentElement.scrollWidth<=innerWidth+1&&h.scrollWidth<=h.clientWidth+1;}),'horizontal overflow');
  const same=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
  const polar=await page.evaluate(async()=>{const {CONFIG,sb}=await import('./src/core.js');const {data,error}=await sb.functions.invoke('health-polar-connection',{body:{action:'status'}});return {ok:!error,keys:Object.keys(data||{}),status:data};});
  check(polar.ok&&typeof polar.status?.configured==='boolean'&&typeof polar.status?.connected==='boolean','authenticated Polar activation status failed');
  check(!polar.keys.some(k=>/token|secret|user_id/.test(k)),'Polar status exposed connection credentials or owner');
  const unauthenticated=await page.request.post(`${supabaseUrl}/functions/v1/health-polar-connection`,{headers:{apikey:supabaseKey},data:{action:'status'}});
  check(unauthenticated.status()===401,'Polar connection accepts unauthenticated access');
  const invalidCallback=await page.request.get(`${supabaseUrl}/functions/v1/health-polar-callback?state=invalid`);
  check(invalidCallback.status()===400,'invalid OAuth callback state was accepted');
  await page.setViewportSize({width:390,height:844});
  await goto('treinos','.ltsTrainingV2');await page.locator('[data-depth-training-view="history"]').first().click();
  const workoutIds=[];
  for(let i=0;i<500;i++){
    workoutIds.push(...await page.locator('[data-depth-workout]').evaluateAll(es=>es.map(e=>e.dataset.depthWorkout)));
    const next=page.locator('[data-depth-page="productTrainingPage"]').last();if(await next.isDisabled())break;await next.click();
  }
  check(same(workoutIds,truth.workoutIds),'workout history coverage differs from the independent database read');
  if(workoutIds.length){const oldest=page.locator('[data-depth-workout]').last(),id=await oldest.getAttribute('data-depth-workout');await oldest.click();check(await page.locator('.ltsTrainingV2').getAttribute('data-workout-id')===id,'historical session did not open');await page.locator('[data-depth-training-view="history"]').first().click();}
  await noOverflow();await assertStableMobileShell('mobile Training full history');await page.screenshot({path:`${evidenceDir}/mobile-training-full-history.png`});

  await goto('saude','.ltsLabsV2');
  // Full-history audit explicitly chooses the global history window first.
  await page.locator('[data-depth-period="productLabPeriod"][data-value="all"]').click();
  await page.waitForSelector('.ltsLabsHero');
  const keys=await page.locator('#productLabMarkerSelect option').evaluateAll(es=>es.map(e=>e.value).filter(Boolean));
  check(truth.markerKeys.every(k=>keys.includes(k)),'some lab markers are unreachable');
  if(truth.largestMarker){
    await page.locator('#productLabMarkerSelect').selectOption(truth.largestMarker);
    check(Number(await page.locator('[data-lab-history-total]').getAttribute('data-lab-history-total'))===truth.largestMarkerCount,'lab history total differs from database');
    let seen=0;for(let i=0;i<500;i++){seen+=await page.locator('.ltsLabsHistoryRow').count();const next=page.locator('[data-depth-page="productLabPage"]').last();if(await next.isDisabled())break;await next.click();}check(seen===truth.largestMarkerCount,'lab history pagination lost results');
    await page.locator('[data-depth-period="productLabPeriod"][data-value="all"]').click();
    const options=await page.locator('#productLabCohort option').evaluateAll(es=>es.map(e=>e.value));
    if(options.length>1){await page.locator('#productLabCohort').selectOption(options.at(-1));check(await page.locator('#productLabCohort').inputValue()===options.at(-1),'source/unit selector failed');}
  }
  await page.locator('#productLabQuery').fill('zzzz-unmatched-query');check(await page.locator('#productLabMarkerSelect option').count()===1,'marker search did not filter');await page.locator('#productLabQuery').fill('');
  if(truth.singleMarker){await page.locator('#productLabMarkerSelect').selectOption(truth.singleMarker);check(await page.locator('.ltsLabsHero').count()===1,'single-result marker is hidden');check(await page.locator('.ltsDepthLine').count()===0,'single result manufactured a trend');}
  await noOverflow();await page.evaluate(()=>document.querySelector('#screenHost').scrollTo(0,0));await assertStableMobileShell('mobile Labs full history');await page.screenshot({path:`${evidenceDir}/mobile-labs-full-history.png`});

  await goto('bio','.ltsCompositionV2 .ltsCompositionHero');
  await page.locator('[data-depth-period="productCompositionPeriod"][data-value="all"]').click();
  const bodyIds=[];
  for(let i=0;i<500;i++){bodyIds.push(...await page.locator('.ltsCompositionHistoryList [data-depth-composition-record]').evaluateAll(es=>es.map(e=>e.dataset.depthCompositionRecord)));const next=page.locator('[data-depth-page="productCompositionPage"]').last();if(await next.isDisabled())break;await next.click();}
  check(same(bodyIds,truth.bodyIds),'composition history coverage differs from independent database read');
  if(bodyIds.length){await page.locator('.ltsCompositionHistoryList [data-depth-composition-record]').last().click();await page.waitForSelector('[data-composition-view="detail"]');check((await page.locator('.ltsRecordDetails').count())>=2,'measurement and segmental context missing');await noOverflow();await assertStableMobileShell('mobile measurement detail');await page.screenshot({path:`${evidenceDir}/mobile-measurement-detail.png`});await page.setViewportSize({width:1440,height:1000});await noOverflow();await page.screenshot({path:`${evidenceDir}/desktop-measurement-detail.png`});await page.locator('[data-depth-composition-back]').last().click();}
  await goto('treinos','.ltsTrainingV2');await page.locator('[data-depth-training-view="history"]').first().click();await page.evaluate(()=>document.querySelector('#screenHost').scrollTo(0,0));await noOverflow();await page.screenshot({path:`${evidenceDir}/desktop-training-full-history.png`});
  await goto('saude','.ltsLabsV2 .ltsLabsHero');if(truth.largestMarker)await page.locator('#productLabMarkerSelect').selectOption(truth.largestMarker);await page.evaluate(()=>document.querySelector('#screenHost').scrollTo(0,0));await noOverflow();await page.screenshot({path:`${evidenceDir}/desktop-labs-full-history.png`});
  await goto('analise','.ltsUsefulReports');
  const insightBeforePeriod=await page.locator('#reportEvidenceInsights').elementHandle();
  await page.locator('#analysisPeriod').selectOption('all');
  await page.waitForFunction(element=>!element.isConnected,insightBeforePeriod);
  await page.locator('[data-report-section="reportEvidenceInsights"]').click();
  await page.waitForSelector('#reportEvidenceInsights');
  await page.waitForFunction(()=>document.querySelector('#analysisPeriod')?.value==='all'&&document.querySelector('#reportNutritionSource'));
  try{await auditObservedNutritionContrast(page);}catch(error){error.auditCode='nutrition-contrast';throw error;}
  // Boolean-only checks of the existing authorized state: no patient readings in logs.
  const sleepReport=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js'),{calendarReport}=await import('./src/calendar-report-model.js'),{sourceDisplayLabel}=await import('./src/source-display.js');
    const m=calendarReport(state.data,state.domainStatus,state.ui),metric=m.metricsByKey.sleep;
    const card=document.querySelector('#calendarReport [data-calendar-metric="sleep"]'),signal=document.querySelector('#calendarReport [data-report-signal="sleep"]');
    if(!metric||!card||!signal)return{present:false};
    const value=card.querySelector('.ltsCalendarMetricValue')?.textContent.trim(),coverage=card.querySelector('.ltsCalendarCoverage')?.textContent.trim();
    const mean=metric.value==null?!/^0(?:[,.]0)?\s*h$/.test(value):value===metric.value.toLocaleString('pt-BR',{maximumFractionDigits:1})+' '+metric.unit;
    const expected=metric.points.filter(p=>p.eligible===true&&p.date>=m.bounds.start&&p.date<=m.bounds.closedEnd&&p.date<m.today&&!p.open&&!p.ambiguous&&!p.knownPartial&&!p.excludeFromClosedMeans&&!p.reviewInvalid&&typeof p.value==='number'&&Number.isFinite(p.value)&&p.value>=0).map(p=>p.date).sort();
    const actual=Array.from(card.querySelectorAll('[data-calendar-plot-date]')).map(p=>p.dataset.calendarPlotDate).sort();
    const origin=metric.source?sourceDisplayLabel(metric.source,metric.sources):null;
    return{present:true,mean,coverage:metric.coverageUnavailable?coverage==='Cobertura indisponível':coverage===`${metric.count}/${metric.expectedDays} dias encerrados com valor`,dates:JSON.stringify(actual)===JSON.stringify(expected),origin:!origin||card.querySelector('.ltsCalendarSource')?.textContent.includes(origin),unit:metric.unit==='h',selector:!!card.querySelector('#calendar-source-sleep')};
  });
  check(Object.values(sleepReport).every(Boolean),'sleep report lost its recorded value, date, unit, source or coverage');
  const loadLink=page.locator('[data-report-exercise]').first();
  if(await loadLink.count()){
    await loadLink.click();await page.waitForSelector('.ltsExerciseHistory');
    check(await page.locator('.ltsTrainingV2').getAttribute('data-training-view')==='exercise','load insight did not open exercise evidence');
    await goto('analise','.ltsUsefulReports');
  }
  await page.locator('[data-report-section="reportComposition"]').click();
  const reportKeys=await page.locator('#reportLabMarker option').evaluateAll(es=>es.map(e=>e.value));
  check(same(reportKeys,truth.markerKeys),'report markers differ from the independent private database read');
  if(truth.singleMarker){
    const previousReport=await page.locator('#reportLabs').elementHandle();
    await page.locator('#reportLabMarker').selectOption(truth.singleMarker);
    // Selection schedules the production render on the next animation frame.
    // Check the new report, rather than the previous marker's still-mounted chart.
    await page.waitForFunction(element=>!element.isConnected,previousReport);
    check(await page.locator('#reportLabs .ltsContextLine').count()===0,'single-result report manufactured a trend');
  }
  await page.locator('#reportRegion').selectOption('left_arm');check(await page.locator('#reportRegion').inputValue()==='left_arm','regional report control failed');
  await noOverflow();await page.evaluate(()=>document.querySelector('#screenHost').scrollTo(0,0));await page.screenshot({path:`${evidenceDir}/desktop-useful-reports.png`});
  await page.setViewportSize({width:390,height:844});await noOverflow();await assertStableMobileShell('mobile useful reports');await page.screenshot({path:`${evidenceDir}/mobile-useful-reports.png`});
  await page.locator('[data-review-view="overview"]').click();await page.waitForSelector('.ltsReviewContrasts');
  const reviewTruth=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js'),{usefulReports}=await import('./src/reports-model.js'),{integratedReview}=await import('./src/integrated-review.js');
    const m=usefulReports(state.data,state.domainStatus,state.ui),r=integratedReview(state.data,state.domainStatus,m.current,state.ui,m.today);
    const avg=rows=>rows.length?rows.reduce((sum,row)=>sum+row.value,0)/rows.length:null;
    return{waterConsistent:r.water.mean===avg(r.water.closedRows),sleepConsistent:r.sleep.mean===avg(r.sleep.closedRows),closed:r.closed.every(d=>d.date<m.today),waterAvailable:r.water.available,waterComparable:r.contrasts.water.comparable,waterWith:avg(r.contrasts.water.withTraining),waterWithout:avg(r.contrasts.water.withoutTraining),dates:r.dates.length};
  });
  check(reviewTruth.waterConsistent&&reviewTruth.sleepConsistent&&reviewTruth.closed,'integrated means include an open day or disagree with observations');
  check(await page.locator('.ltsReviewCoverage,.ltsReviewOverlap').count()===0,'record coverage is promoted as a health outcome');
  const waterCard=page.locator('.ltsReviewContrast').filter({has:page.locator('h3', {hasText:'Água × treino registrado'})});
  check(await waterCard.count()===(reviewTruth.waterComparable?1:0),'water comparison appears without enough closed observations');
  if(reviewTruth.waterComparable){
    const text=await waterCard.innerText(),format=value=>Number(value).toLocaleString('pt-BR',{maximumFractionDigits:0})+' mL';
    check(text.includes(format(reviewTruth.waterWith))&&text.includes(format(reviewTruth.waterWithout)),'rendered water means disagree with the selected source observations');
  }
  await noOverflow();await page.evaluate(()=>document.querySelector('#reportIntegratedReview')?.scrollIntoView({block:'start'}));await page.screenshot({path:`${evidenceDir}/mobile-integrated-review.png`});
  await page.locator('[data-review-view="day"]').click();await page.waitForSelector('#reviewDate');
  check(await page.locator('#reviewDate option').count()===Math.max(1,reviewTruth.dates),'integrated day selector lost observed dates');
  await noOverflow();await page.evaluate(()=>document.querySelector('.ltsReviewDayControls')?.scrollIntoView({block:'start'}));await page.screenshot({path:`${evidenceDir}/mobile-integrated-day.png`});
  await page.locator('[data-review-view="consultation"]').click();await page.waitForSelector('[data-review-export]');
  check((await page.locator('.ltsConsultation').innerText()).includes('Não é laudo'),'private summary lost its interpretation boundary');
  await noOverflow();await page.evaluate(()=>document.querySelector('.ltsReviewExport')?.scrollIntoView({block:'start'}));await page.screenshot({path:`${evidenceDir}/mobile-consultation-summary.png`});
  await page.setViewportSize({width:1536,height:864});await noOverflow();await page.screenshot({path:`${evidenceDir}/desktop-consultation-summary.png`});
  console.log('Real-data functional depth verified: complete histories, source-specific closed-date comparisons, sparse water boundary, date exploration and private consultation preview. No health observations logged.');
}
