// Called inside the authorized real-auth session before signing out. Never print record identifiers or values.
export async function runDepthChecks(page,{appUrl,supabaseUrl,supabaseKey,evidenceDir}){
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
  const goto=async(route,selector)=>{await page.evaluate(r=>{location.hash='#'+r;},route);await page.waitForSelector(selector,{timeout:30000});};
  const noOverflow=async()=>check(await page.evaluate(()=>{const h=document.querySelector('#screenHost');return document.documentElement.scrollWidth<=innerWidth+1&&h.scrollWidth<=h.clientWidth+1;}),'horizontal overflow');
  const same=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
  await page.setViewportSize({width:390,height:844});
  await goto('treinos','.ltsTrainingV2');await page.locator('[data-depth-training-view="history"]').first().click();
  const workoutIds=[];
  for(let i=0;i<500;i++){
    workoutIds.push(...await page.locator('[data-depth-workout]').evaluateAll(es=>es.map(e=>e.dataset.depthWorkout)));
    const next=page.locator('[data-depth-page="productTrainingPage"]').last();if(await next.isDisabled())break;await next.click();
  }
  check(same(workoutIds,truth.workoutIds),'workout history coverage differs from the independent database read');
  if(workoutIds.length){const oldest=page.locator('[data-depth-workout]').last(),id=await oldest.getAttribute('data-depth-workout');await oldest.click();check(await page.locator('.ltsTrainingV2').getAttribute('data-workout-id')===id,'historical session did not open');await page.locator('[data-depth-training-view="history"]').first().click();}
  await noOverflow();await page.screenshot({path:`${evidenceDir}/mobile-training-full-history.png`});

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
  await noOverflow();await page.evaluate(()=>document.querySelector('#screenHost').scrollTo(0,0));await page.screenshot({path:`${evidenceDir}/mobile-labs-full-history.png`});

  await goto('bio','.ltsCompositionV2 .ltsCompositionHero');
  await page.locator('[data-depth-period="productCompositionPeriod"][data-value="all"]').click();
  const bodyIds=[];
  for(let i=0;i<500;i++){bodyIds.push(...await page.locator('.ltsCompositionHistoryList [data-depth-composition-record]').evaluateAll(es=>es.map(e=>e.dataset.depthCompositionRecord)));const next=page.locator('[data-depth-page="productCompositionPage"]').last();if(await next.isDisabled())break;await next.click();}
  check(same(bodyIds,truth.bodyIds),'composition history coverage differs from independent database read');
  if(bodyIds.length){await page.locator('.ltsCompositionHistoryList [data-depth-composition-record]').last().click();await page.waitForSelector('[data-composition-view="detail"]');check((await page.locator('.ltsRecordDetails').count())>=2,'measurement and segmental context missing');await noOverflow();await page.screenshot({path:`${evidenceDir}/mobile-measurement-detail.png`});await page.setViewportSize({width:1440,height:1000});await noOverflow();await page.screenshot({path:`${evidenceDir}/desktop-measurement-detail.png`});await page.locator('[data-depth-composition-back]').last().click();}
  await goto('treinos','.ltsTrainingV2');await page.locator('[data-depth-training-view="history"]').first().click();await page.evaluate(()=>document.querySelector('#screenHost').scrollTo(0,0));await noOverflow();await page.screenshot({path:`${evidenceDir}/desktop-training-full-history.png`});
  await goto('saude','.ltsLabsV2 .ltsLabsHero');if(truth.largestMarker)await page.locator('#productLabMarkerSelect').selectOption(truth.largestMarker);await page.evaluate(()=>document.querySelector('#screenHost').scrollTo(0,0));await noOverflow();await page.screenshot({path:`${evidenceDir}/desktop-labs-full-history.png`});
  console.log('Real-data functional depth verified against independent database reads: complete workout, marker and measurement access.');
}
