// Called inside the authorized real-auth session before signing out. Never print record identifiers or values.
export async function runDepthChecks(page,{appUrl,supabaseUrl,supabaseKey,evidenceDir,waitForRoute,assertStableMobileShell}){
  const check=(ok,message)=>{if(!ok)throw new Error(`Real-data depth contract: ${message}`);};
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

  await goto('saude','.ltsLabsV2 .ltsLabsHero');
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
  await page.waitForSelector('#reportEvidenceInsights');
  await page.waitForFunction(()=>document.querySelector('#analysisPeriod')?.value==='all'&&document.querySelector('#reportNutritionSource'));
  const insightTruth=await page.evaluate(async()=>{
    const {state,fmtNum}=await import('./src/core.js');
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const norm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const selected=document.querySelector('#reportNutritionSource')?.value;
    const days=new Map();
    for(const row of state.data.nutrition||[]){const date=String(row.nutrition_date||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>=today)continue;if(!days.has(date))days.set(date,[]);days.get(date).push(row);}
    const training=new Set((state.data.workouts||[]).filter(r=>r.is_canonical===true&&norm(r.record_status)!=='quarantined').map(r=>String(r.workout_date||'').slice(0,10)));
    const observations=[...days].filter(([,rows])=>rows.length===1&&norm(rows[0].source)===selected).map(([date,[row]])=>({row,training:training.has(date)}));
    const rows=[...document.querySelectorAll('#reportEvidenceInsights .ltsInsightTable')][0]?.querySelectorAll('tbody tr');
    const specifications=[['protein_g','g'],['calories_kcal','kcal'],['carbs_g','g'],['fat_g','g']];
    const matches=Boolean(rows?.length===4)&&specifications.every(([key,unit],index)=>{
      const value=r=>r[key]==null||r[key]===''?null:Number(r[key]);
      const group=flag=>observations.filter(o=>o.training===flag&&value(o.row)!=null&&Number.isFinite(value(o.row))&&value(o.row)>=0).map(o=>value(o.row));
      const withValues=group(true),withoutValues=group(false);
      const average=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
      const a=average(withValues),b=average(withoutValues),cells=rows[index].querySelectorAll('td');
      const expected=(mean,count)=>`${mean==null?'Sem valor':`${fmtNum(mean,0)} ${unit}`}${count} dias com valor`;
      const clean=text=>String(text).replace(/\s+/g,' ').trim();
      const cellMatch=(cell,mean,count)=>clean(cell.textContent)===clean(expected(mean,count));
      const difference=withValues.length>=5&&withoutValues.length>=5?`${a-b>0?'+':''}${fmtNum(a-b,1)} ${unit}`:'Base curta: mínimo 5 dias por grupo';
      return cellMatch(cells[0],a,withValues.length)&&cellMatch(cells[1],b,withoutValues.length)&&clean(cells[2].textContent)===clean(difference);
    });
    return{section:Boolean(document.querySelector('#reportEvidenceInsights')),matches};
  });
  check(insightTruth.section&&insightTruth.matches,'insight table differs from independently recomputed observed means and denominators');
  const loadLink=page.locator('[data-report-exercise]').first();
  if(await loadLink.count()){
    await loadLink.click();await page.waitForSelector('.ltsExerciseHistory');
    check(await page.locator('.ltsTrainingV2').getAttribute('data-training-view')==='exercise','load insight did not open exercise evidence');
    await goto('analise','.ltsUsefulReports');
  }
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
  await page.locator('[data-review-view="overview"]').click();await page.waitForSelector('.ltsReviewCoverage');
  const reviewTruth=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js'),{usefulReports}=await import('./src/reports-model.js'),{integratedReview}=await import('./src/integrated-review.js');
    const m=usefulReports(state.data,state.domainStatus,state.ui),r=integratedReview(state.data,state.domainStatus,m.current,state.ui,m.today);
    const avg=rows=>rows.length?rows.reduce((sum,row)=>sum+row.value,0)/rows.length:null;
    return{waterConsistent:r.water.mean===avg(r.water.closedRows),sleepConsistent:r.sleep.mean===avg(r.sleep.closedRows),closed:r.closed.every(d=>d.date<m.today),waterCount:r.water.closedRows.length,waterAvailable:r.water.available,waterComparable:r.contrasts.water.comparable,dates:r.dates.length};
  });
  check(reviewTruth.waterConsistent&&reviewTruth.sleepConsistent&&reviewTruth.closed,'integrated means include an open day or disagree with observations');
  const waterCard=await page.locator('.ltsReviewCoverage article').nth(2).innerText();
  check(waterCard.includes(reviewTruth.waterAvailable?`${reviewTruth.waterCount} dias`:'Indisponível'),'rendered water coverage differs from observed closed dates');
  if(reviewTruth.waterAvailable&&!reviewTruth.waterComparable)check((await page.locator('.ltsReviewContrast').first().innerText()).includes('Ainda não há base suficiente'),'sparse real water manufactured a contrast');
  await noOverflow();await page.evaluate(()=>document.querySelector('#reportIntegratedReview')?.scrollIntoView({block:'start'}));await page.screenshot({path:`${evidenceDir}/mobile-integrated-review.png`});
  await page.locator('[data-review-view="day"]').click();await page.waitForSelector('#reviewDate');
  check(await page.locator('#reviewDate option').count()===Math.max(1,reviewTruth.dates),'integrated day selector lost observed dates');
  await noOverflow();await page.evaluate(()=>document.querySelector('.ltsReviewDayControls')?.scrollIntoView({block:'start'}));await page.screenshot({path:`${evidenceDir}/mobile-integrated-day.png`});
  await page.locator('[data-review-view="consultation"]').click();await page.waitForSelector('[data-review-export]');
  check((await page.locator('.ltsConsultation').innerText()).includes('Não é laudo'),'private summary lost its interpretation boundary');
  await noOverflow();await page.evaluate(()=>document.querySelector('.ltsReviewExport')?.scrollIntoView({block:'start'}));await page.screenshot({path:`${evidenceDir}/mobile-consultation-summary.png`});
  await page.setViewportSize({width:1536,height:864});await noOverflow();await page.screenshot({path:`${evidenceDir}/desktop-consultation-summary.png`});
  console.log('Real-data functional depth verified: complete histories, integrated closed-date coverage, sparse water boundary, date exploration and private consultation preview. No health observations logged.');
}
