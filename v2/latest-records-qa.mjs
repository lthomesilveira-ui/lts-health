import {readFileSync,mkdirSync} from 'node:fs';
import {chromium,webkit} from 'playwright';

// Read-only verification of a pinned record day against the deployed app.
// Private values and screenshots never enter public logs or plaintext artifacts.
const appUrl='https://lthomesilveira-ui.github.io/lts-health/v2/';
const evidenceDir='v2/latest-records-evidence';
const date=process.env.HEALTH_RECORD_DATE;
const expectedBuild=/name="lts-build" content="([^"]+)"/.exec(readFileSync('v2/index.html','utf8'))?.[1];
const tokenHash=readFileSync('/tmp/lts-health-latest-token-hash','utf8').trim();
if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!tokenHash||!expectedBuild)throw Error('qa-configuration');
mkdirSync(evidenceDir,{recursive:true});
const outcomes=[];
let stage='setup';
const check=(ok,label)=>{if(!ok){const e=Error('Private record verification failed');e.auditCode=label;throw e;}};
const f=(value,digits=1)=>Number(value).toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const dayText=value=>value.split('-').reverse().join('/');
const space=value=>String(value||'').replace(/\s+/g,' ').trim();
const contexts=[];
let browser,mobileBrowser;

async function originalRows(page){
 return page.evaluate(async recordDay=>{
  const {sb,state}=await import('./src/core.js');
  const owner=state.session?.user?.id;
  if(!owner)throw Error('qa-owner');
  async function rows(table,column=null,value=null){
   const all=[];
   for(let from=0;;from+=1000){
    let q=sb.from(table).select('*').eq('user_id',owner).order('source_record_id').range(from,from+999);
    if(column)q=q.eq(column,value);
    const {data,error}=await q;if(error)throw Error('qa-source-read');
    all.push(...data);if(data.length<1000)return all;
   }
  }
  const [body,segmental,medications,workouts,exercises,sets,evidence]=await Promise.all([
   rows('health_body_composition'),rows('health_segmental_composition','measured_at',recordDay),
   rows('health_medication_events','event_date',recordDay),rows('health_workouts','workout_date',recordDay),
   rows('health_workout_exercises','workout_date',recordDay),rows('health_workout_sets','workout_date',recordDay),
   rows('health_workout_source_evidence','workout_date',recordDay)
  ]);
  return {body,segmental,medications,workouts,exercises,sets,evidence};
 },date);
}
async function route(page,value,selector){
 const mobile=(await page.viewportSize()).width<=840;
 const nav=`#${mobile?'mobileNav':'primaryNav'}`;
 const direct=page.locator(`${nav} [data-route="${value}"]`);
 if(await direct.count()&&await direct.isVisible())await direct.click();
 else{await page.locator(`${nav} [data-route="mais"]`).click();await page.locator(`#moreSheet [data-route="${value}"]`).click();}
 await page.locator(selector).waitFor({state:'visible',timeout:45000});
 await page.waitForFunction(v=>document.body.dataset.productRoute===v&&!document.querySelector('#screenHost .loadingState'),value);
 await page.evaluate(()=>document.fonts.ready);
}
async function layout(page,label){
 const geometry=await page.evaluate(()=>({fits:document.documentElement.scrollWidth<=innerWidth+1,hostFits:(document.querySelector('#screenHost')?.scrollWidth||0)<=(document.querySelector('#screenHost')?.clientWidth||0)+1}));
 check(geometry.fits&&geometry.hostFits,label);
}
async function capture(page,surface,name){
 await layout(page,`${name}-layout`);
 await page.screenshot({path:`${evidenceDir}/${surface}-${name}.png`,fullPage:true});
}
async function surface(page,label,truth){
 const latest=truth.body.filter(r=>r.measured_at===date);
 check(latest.length===1,'body-unique');
 const body=latest[0],seg=truth.segmental.filter(r=>r.source_payload?.body_source_record_id===body.source_record_id);
 check(seg.length===1,'segmental-linked-unique');
 check(truth.medications.length>0,'medications-present');
 const workouts=truth.workouts.filter(w=>w.is_canonical===true&&w.record_status!=='quarantined');
 check(workouts.length===1,'workout-unique');
 const w=workouts[0],exercises=truth.exercises.filter(e=>e.workout_source_record_id===w.source_record_id).sort((a,b)=>a.order_index-b.order_index);
 const sets=truth.sets.filter(s=>s.workout_source_record_id===w.source_record_id);
 check(exercises.length>0&&sets.length>0,'workout-children');
 check(new Set(exercises.map(e=>e.source_record_id)).size===exercises.length&&new Set(sets.map(s=>s.source_record_id)).size===sets.length,'no-duplicate-children');

 stage='composition-detail';
 await route(page,'bio','.ltsCompositionV2');
 check((await page.locator('.ltsCompositionHero').innerText()).includes(dayText(date)),'body-latest-date');
 await page.locator(`[data-depth-composition-record=${JSON.stringify(body.source_record_id)}]`).first().click();
 await page.locator('[data-composition-view="detail"]').waitFor();
 const details=await page.locator('.ltsDetailGrid').innerText();
 for(const [key,unit] of [['weight_kg','kg'],['skeletal_muscle_mass_kg','kg'],['fat_mass_kg','kg'],['body_fat_pct','%'],['body_water_l','L']])check(space(details).includes(`${f(body[key])} ${unit}`),'body-detail-value');
 const regions=[['Braço direito','right_arm'],['Braço esquerdo','left_arm'],['Tronco','trunk'],['Perna direita','right_leg'],['Perna esquerda','left_leg']];
 const rows=await page.locator('.ltsSegmentTable tbody tr').allTextContents();
 check(rows.length===regions.length,'segmental-row-count');
 for(let i=0;i<regions.length;i++){
  const [name,key]=regions[i],row=space(rows[i]);
  check(row.includes(name)&&row.includes(f(seg[0][`lean_${key}_kg`],2))&&row.includes(f(seg[0][`fat_${key}_kg`],2)),'segmental-laterality-values');
 }
 await capture(page,label,'composition-detail');
 await page.locator('.ltsSegmentTable').screenshot({path:`${evidenceDir}/${label}-region-table.png`});
 await page.locator('[data-depth-composition-back]').first().click();
 await page.locator('[data-composition-view="overview"]').waitFor();

 stage='composition-comparison';
 const device=body.source_payload?.device;
 const source=await page.locator('#productCompositionSource option').evaluateAll((options,name)=>options.find(o=>o.textContent.trim()===name)?.value,device);
 check(Boolean(device&&source),'comparison-documented-device');
 await page.locator('#productCompositionSource').selectOption(source);
 const peers=truth.body.filter(r=>r.source===body.source&&r.source_payload?.device===device&&r.measured_at<date).sort((a,b)=>a.measured_at.localeCompare(b.measured_at));
 check(peers.length>0,'comparison-previous');
 const previous=peers.at(-1);
 await page.locator('.ltsCompareDisclosure > summary').click();
 await page.locator('#productCompareA').selectOption(previous.source_record_id);
 await page.locator('#productCompareB').selectOption(body.source_record_id);
 const comparison=space(await page.locator('.ltsCompareDisclosure').innerText());
 for(const [key,unit] of [['weight_kg','kg'],['skeletal_muscle_mass_kg','kg'],['fat_mass_kg','kg'],['body_fat_pct','p.p.']]){
  const delta=Number(body[key])-Number(previous[key]);
  check(comparison.includes(`${delta>0?'+':''}${f(delta)} ${unit}`),'comparison-delta');
 }
 await capture(page,label,'composition-comparison');
 await page.locator('.ltsCompositionChart').screenshot({path:`${evidenceDir}/${label}-comparison-chart.png`});
 await page.locator('.ltsCompareDisclosure').screenshot({path:`${evidenceDir}/${label}-comparison-values.png`});
 outcomes.push({surface:label,case:'composition-and-regions',passed:true});

 stage='medications';
 await route(page,'tratamentos','.protocolSummaryGrid');
 for(const [eventIndex,event] of truth.medications.entries()){
  const card=page.locator('.protocolSummaryCard').filter({has:page.locator('h3').getByText(event.medication,{exact:true})});
  check(await card.count()===1,'medication-card-unique');
  const text=space(await card.innerText()),p=event.source_payload||{};
  const site={abdomen:'abdômen',glute:'glúteo'}[p.site],side={left:'esquerdo',right:'direito'}[p.side];
  check(text.includes(dayText(date))&&text.includes(p.local_time)&&text.includes('Brasília')&&text.includes(`${site} ${side}`),'medication-time-site-side');
  await card.screenshot({path:`${evidenceDir}/${label}-medication-${eventIndex}.png`});
 }
 await capture(page,label,'medications');
 outcomes.push({surface:label,case:'medication-time-and-side',passed:true});

 stage='workout-summary';
 await route(page,'treinos','.ltsTrainingV2');
 await page.locator('[data-depth-training-view="history"]').first().click();
 await page.locator(`[data-depth-workout=${JSON.stringify(w.source_record_id)}]`).first().click();
 await page.locator('.ltsTrainingV2[data-training-view="summary"]').waitFor();
 const summary=space(await page.locator('.ltsTrainingV2').innerText());
 check(summary.includes(w.location)&&summary.includes(dayText(date)),'workout-date-location');
 check(await page.locator('.ltsRefOverviewGrid div:first-child b').innerText()===String(exercises.length),'workout-exercise-count');
 check(await page.locator('.ltsRefOverviewGrid div:nth-child(2) b').innerText()===String(sets.filter(s=>!['drop','rest_pause'].includes(s.phase)).length),'workout-set-count');
 const telemetry=truth.evidence.filter(e=>e.workout_source_record_id===w.source_record_id&&e.evidence_kind==='telemetry'&&e.evidence_status==='confirmed');
 check(telemetry.length>0,'polar-evidence-present');
 for(const value of [w.calories_kcal,w.heart_rate_avg,w.heart_rate_min,w.heart_rate_max])check(summary.includes(f(value,0)),'polar-visible-metric');
 check(summary.toLocaleLowerCase('pt-BR').includes('energia estimada')&&summary.includes('Polar Flow'),'polar-estimate-and-source');
 await capture(page,label,'workout-summary');
 await page.locator('.ltsRefHrPanel').screenshot({path:`${evidenceDir}/${label}-polar-source.png`});

 stage='workout-exercises';
 await page.locator('[data-depth-training-view="exercises"]').first().click();
 await page.locator('.ltsTrainingV2[data-training-view="exercises"]').waitFor();
 const cards=page.locator('.ltsRefExerciseCard');check(await cards.count()===exercises.length,'workout-card-count');
 for(let i=0;i<exercises.length;i++){
  const e=exercises[i],card=cards.nth(i),expected=sets.filter(s=>s.exercise_source_record_id===e.source_record_id).sort((a,b)=>a.set_index-b.set_index);
  check((await card.locator('header').innerText()).includes(e.exercise),'exercise-name');
  if(e.notes){await card.locator('.ltsRefExerciseNotes > summary').click();check((await card.innerText()).includes(e.notes),'exercise-note');}
  const displayed=card.locator('.ltsRefSetTable > div');check(await displayed.count()===expected.length,'exercise-set-count');
  for(let j=0;j<expected.length;j++){
   const s=expected[j],r=displayed.nth(j),load=space(await r.locator('b').innerText());
   check(load===`${Number(s.weight).toLocaleString('pt-BR',{maximumFractionDigits:20})} ${s.weight_unit}`,'set-load');
   const reps=await r.locator('i').evaluate(el=>el.childNodes[0]?.textContent.trim());
   check(reps===String(s.reps_raw??s.reps_numeric),'set-repetitions');
   if(s.technique)check((await r.innerText()).includes(s.technique)||(e.notes?.includes(s.technique)&&(await card.locator('.ltsRefExerciseNotes').innerText()).includes(s.technique)),'set-execution-note');
  }
  await card.screenshot({path:`${evidenceDir}/${label}-exercise-${String(i+1).padStart(2,'0')}.png`});
 }
 await capture(page,label,'workout-exercises');
 await page.locator('[data-depth-training-view="history"]').first().click();
 await page.locator('.ltsTrainingV2[data-training-view="history"]').waitFor();
 check(await page.locator(`[data-depth-workout=${JSON.stringify(w.source_record_id)}]`).count()===1,'workout-history-return');
 outcomes.push({surface:label,case:'workout-sets-notes-polar-and-return',passed:true});
}

try{
 stage='authentication';browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Sao_Paulo'});contexts.push(context);
 let mutations=0,runtimeErrors=0;
 async function protect(ctx){
  await ctx.route('**/rest/v1/**',route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){mutations++;return route.abort();}return route.continue();});
  ctx.on('page',page=>page.on('pageerror',()=>runtimeErrors++));
 }
 await protect(context);const page=await context.newPage();
 await page.goto(`${appUrl}#bio`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>Boolean(window.supabase?.createClient));
 const signedIn=await page.evaluate(async token=>{const {sb}=await import('./src/core.js');const {data,error}=await sb.auth.verifyOtp({token_hash:token,type:'email'});return!error&&Boolean(data.session?.user);},tokenHash);
 check(signedIn,'authenticated-session');await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#app:not(.hidden)').waitFor({timeout:45000});
 check(!page.url().includes('fixture'),'real-data-only');
 check(await page.locator('meta[name="lts-build"]').getAttribute('content')===expectedBuild,'exact-published-build');
 const truth=await originalRows(page);await surface(page,'desktop-chromium',truth);
 mobileBrowser=await webkit.launch({headless:true});
 const mobile=await mobileBrowser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,timezoneId:'America/Sao_Paulo',storageState:await context.storageState()});contexts.push(mobile);
 await protect(mobile);const mobilePage=await mobile.newPage();
 await mobilePage.goto(`${appUrl}#bio`,{waitUntil:'domcontentloaded'});await mobilePage.locator('#app:not(.hidden)').waitFor({timeout:45000});
 await surface(mobilePage,'mobile-webkit-touch',truth);
 stage='integrity';check(JSON.stringify(await originalRows(page))===JSON.stringify(truth),'private-records-unchanged');
 check(mutations===0&&runtimeErrors===0,'zero-writes-and-runtime-errors');
 console.log(JSON.stringify({buildMatched:true,realAuthenticatedData:true,outcomes,zeroWrites:true,zeroRuntimeErrors:true,sourceRecordsUnchanged:true}));
}catch(error){
 for(let i=0;i<contexts.length;i++)for(const page of contexts[i].pages())await page.screenshot({path:`${evidenceDir}/failure-surface-${i}.png`,fullPage:true}).catch(()=>{});
 console.log(JSON.stringify({passed:false,stage,code:error.auditCode||'browser-operation',outcomes,privateDetailsWithheld:true}));process.exitCode=1;
}finally{
 for(const context of contexts)await context.close().catch(()=>{});
 await mobileBrowser?.close();await browser?.close();
}
