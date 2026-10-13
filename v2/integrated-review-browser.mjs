import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

// Synthetic data only. Tests the real authenticated renderer, not a demo page.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/v2/';
const dir='v2/integrated-review-visual';mkdirSync(dir,{recursive:true});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const date=offset=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-offset);return d.toISOString().slice(0,10);};
const db={health_workouts:[],health_daily_nutrition:[],health_source_daily_metrics:[]};
db.health_body_composition=Array.from({length:5},(_,i)=>({measured_at:date(i*3+1),source_record_id:`body-${i}`,source:'Synthetic scan',device_name:'Synthetic device',weight_kg:80+i*.2,body_fat_pct:20+i*.1,fat_mass_kg:16+i*.1,skeletal_muscle_mass_kg:32}));
db.health_lab_results=[{source_record_id:'lab-1',collection_date:date(2),biomarker:'Synthetic marker',unit:'u',result_numeric:12,result_raw:'12',source:'Synthetic lab',laboratory:'Synthetic lab',method:'Synthetic method'}];
for(const [offset,n]of [[120,98765.43],[2,123456.78]])db.health_lab_results.push({source_record_id:`wide-${offset}`,collection_date:date(offset),biomarker:'Synthetic wide scale',unit:'u',result_numeric:n,result_raw:String(n),source:'Synthetic lab',laboratory:'Synthetic lab',method:'Synthetic method'});
for(const [i,label] of ['Hemoglobina Glicada (A1C)','LDL-Colesterol','Triglicérides','Hemoglobina','Hematócrito','Ferritina','Testosterona Total','Estradiol'].entries())for(const [suffix,offset,value] of [['prior',120,10+i],['current',2,12+i]])db.health_lab_results.push({source_record_id:`comparison-${i}-${suffix}`,collection_date:date(offset),biomarker:label,unit:'u',result_numeric:value,result_raw:String(value),reference_range:['Hemoglobina','Hematócrito','Testosterona Total'].includes(label)?'Homens: 10 a 14 u':'Synthetic report reference',laboratory:'Synthetic lab',source:'Synthetic lab',method:i%2?'':suffix==='prior'?'HPLC':'Cromatografia líquida de alta eficiência (HPLC)'});
db.health_personal_goals=[{effective_from:date(40),calories_kcal:1800,protein_g:120,water_ml:2000,notes:JSON.stringify({type:'historical_protocol',source:'Synthetic protocol',documented_on:date(40),current_validity:'unconfirmed'})}];
for(let i=0;i<=16;i++){
  db.health_daily_nutrition.push({source_record_id:`n${i}`,nutrition_date:date(i),source:'Synthetic food',calories_kcal:i?2000:9000,protein_g:100});
  db.health_source_daily_metrics.push({source_record_id:`health_auto_export:w${i}`,metric_date:date(i),metric_type:'dietary_water_ml',unit:'mL',value:i===0?1250:i%2?1000:1200,source_name:'Synthetic water',source_family:'health_auto_export',canonical_status:'canonical',confidence:'authenticated_auto_export'},
    {source_record_id:`s${i}`,metric_date:date(i),metric_type:'sleep_duration_h',unit:'h',value:i%2?8:7,source_name:'Synthetic sleep',source_family:'synthetic',canonical_status:'candidate'});
  if(i>0)db.health_source_daily_metrics.push({source_record_id:`other${i}`,metric_date:date(i),metric_type:'sleep_duration_h',unit:'h',value:20,source_name:'Other sleep',source_family:'synthetic',canonical_status:'candidate'});
  if(i>0&&i%2===0)db.health_workouts.push({source_record_id:`w${i}`,workout_date:date(i),workout_type:'Synthetic session',source:'Synthetic log',is_canonical:true,record_status:'validated',duration_minutes:40});
}
const service=`window.__reviewDb=${JSON.stringify(db)};window.__reviewDb.health_personal_goals=JSON.parse(localStorage.getItem('synthetic-review-goals')||JSON.stringify(window.__reviewDb.health_personal_goals||[]));window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-review-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},functions:{invoke:async()=>({data:null,error:null})},from(table){let from=0,to=999;const q={upsert(row){window.__reviewDb[table]=[...(window.__reviewDb[table]||[]).filter(r=>r.effective_from!==row.effective_from),row];if(table==='health_personal_goals')localStorage.setItem('synthetic-review-goals',JSON.stringify(window.__reviewDb[table]));q.saved=row;return q;},single:async()=>({data:q.saved,error:null}),select(){return q;},range(a,b){from=a;to=b;return q;},order(){return q;},then(resolve,reject){return Promise.resolve({data:(window.__reviewDb[table]||[]).slice(from,to+1),error:null}).then(resolve,reject);}};return q;}})};`;
const browser=await chromium.launch({headless:true,...(process.env.LTS_BROWSER_PATH?{executablePath:process.env.LTS_BROWSER_PATH}:{}),args:['--no-sandbox']});
const errors=[];
const noOverflow=async page=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no document overflow');
const capture=async(page,selector,path)=>{await page.evaluate(s=>document.querySelector(s)?.scrollIntoView({block:'start',behavior:'auto'}),selector);await page.screenshot({path});};
try{
  for(const[label,width,height]of [['desktop',1536,864],['mobile',390,844],['physical-viewport',393,650],['small',320,740]]){
    const page=await browser.newPage({viewport:{width,height},acceptDownloads:true});page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'application/javascript',body:service}));
    await page.goto(base+'#hoje');await page.waitForSelector('.ltsHomeReference');
    await page.screenshot({path:`${dir}/${label}-home.png`});
    assert.equal(await page.locator('.refSignal').count(),5);assert.equal(await page.locator('.refPanels>.refPanel:not(.mobileWorkout)').count(),6);
    assert.equal(await page.locator('.refPanel.body .refPlot svg').count(),1);
    assert.equal(await page.locator('[data-home-period]').count(),4);await noOverflow(page);
    // Goals remain on Nutrition, where they are relevant, with persistence intact.
    await page.locator('.refSignal.nutrition').click();await page.waitForSelector('#personalGoalsForm',{state:'attached'});
    await page.locator('.ltsGoalSettings summary').first().click();
    assert.equal(await page.locator('#personalGoalsForm [name="protein_g"]').inputValue(),'');
    await page.locator('#personalGoalsForm [name="effective_from"]').fill(date(8));
    await page.locator('#personalGoalsForm [name="water_ml"]').fill('2200');
    await page.locator('#personalGoalsForm [name="protein_g"]').fill('150');
    await page.locator('#personalGoalsForm [type="submit"]').click();
    await page.waitForFunction(()=>document.querySelector('#personalGoalsMessage')?.textContent.includes('Metas salvas'));
    await page.reload();await page.waitForSelector('#personalGoalsForm',{state:'attached'});await page.locator('.ltsGoalSettings summary').first().click();
    assert.equal(await page.locator('#personalGoalsForm [name="water_ml"]').inputValue(),'2200');
    await page.locator('#personalGoalsForm [name="effective_from"]').fill(date(1));
    await page.locator('#personalGoalsForm [name="water_ml"]').fill('2000');
    await page.locator('#personalGoalsForm [name="protein_g"]').fill('120');
    await page.locator('#personalGoalsForm [type="submit"]').click();await page.waitForFunction(()=>document.querySelector('#personalGoalsMessage')?.textContent.includes('Metas salvas'));
    await page.locator(`${width>840?'.primaryNav':'.mobileNav'} [data-route="hoje"]`).click();await page.waitForSelector('[data-reference-home]');
    // Finish the route's compatibility settling pass before testing rotation focus.
    await page.waitForTimeout(350);
    await page.locator('#home-period-90').focus();await page.setViewportSize({width:width<=840?900:393,height});await page.waitForTimeout(200);assert.equal(await page.locator('#home-period-90').evaluate(el=>el===document.activeElement),true);await page.setViewportSize({width,height});
    await page.locator('.refReading [data-home-insight-details]').click();await page.waitForSelector('#reportIntegratedReview');
    assert.equal(await page.locator('.ltsReportWorkspace[open]').count(),0,'history workspaces are progressive by default');
    assert.equal(await page.locator('#analysisPeriod').inputValue(),'90');
    assert.match(await page.locator('#reviewPanel>.ltsReviewContrasts').innerText(),/Exames para discutir na consulta/);
    await page.locator('[data-disclosure="review-numeric-contrasts"]>summary').click();
    assert.match(await page.locator('#reviewPanel>details .ltsReviewContrasts').innerText(),/1\.200 mL.*1\.000 mL/s);
    assert.equal(await page.locator('.ltsReviewCoverage,.ltsReviewOverlap').count(),0);await noOverflow(page);
    assert.match(await page.locator('.ltsReviewContrast').last().innerText(),/7,0 h.*8,0 h/s);
    await capture(page,'#reportIntegratedReview',`${dir}/${label}-overview.png`);
    await page.locator('[data-review-view="day"]').click();await page.waitForSelector('#reviewDate');
    assert.match(await page.locator('.ltsReviewDay').innerText(),/Dia em andamento/);
    await page.locator('#reviewDate').selectOption(date(2));await page.waitForFunction(()=>document.querySelector('.ltsReviewDayFacts')?.textContent.includes('1.200 mL'));
    assert.match(await page.locator('.ltsReviewDayFacts').innerText(),/Synthetic session.*2\.000 kcal.*1\.200 mL/s);
    await page.locator('.ltsReviewCalendar summary').click();assert.equal(await page.locator('.ltsReviewCalendar tbody tr').count(),7);
    const beforePage=await page.locator('.ltsReviewCalendar tbody').elementHandle();
    await page.locator('[data-report-page="reviewDayPage"]').last().click();await page.waitForFunction(element=>!element.isConnected,beforePage);
    await page.locator('.ltsReviewSources summary').click();
    const other=JSON.stringify(['sleep_duration_h','synthetic','Other sleep','h']);
    const beforeSource=await page.locator('#reviewPanel').elementHandle();
    await page.locator('#reviewSleepSource').selectOption(other);await page.waitForFunction(element=>!element.isConnected,beforeSource);
    await page.waitForFunction(()=>document.querySelector('.ltsDaySleep')?.textContent.includes('20,0 h'));
    await noOverflow(page);await capture(page,'.ltsReviewDayControls',`${dir}/${label}-day.png`);
    await page.locator('[data-review-view="consultation"]').click();await page.waitForSelector('[data-review-export]');
    const downloadPromise=page.waitForEvent('download');await page.locator('[data-review-export]').click();const download=await downloadPromise;
    assert.match(download.suggestedFilename(),/^LTS_Health_Resumo_\d{4}-\d{2}-\d{2}\.txt$/);
    const text=readFileSync(await download.path(),'utf8');assert.match(text,/20,0 h/);assert.match(text,/1\.100 mL/);assert.match(text,/Não é laudo/);
    await noOverflow(page);await capture(page,'.ltsReviewExport',`${dir}/${label}-consultation.png`);
    await page.locator('[data-report-section="reportHydration"]').click();assert.equal(new URL(page.url()).hash,'#analise','section jump does not corrupt app routing');
    assert.equal(await page.locator('[data-disclosure="report-workspace-water"]').getAttribute('open'),'','direct evidence link opens its workspace');
    await page.locator('#analysisPeriod').selectOption('90');await page.waitForFunction(()=>document.querySelector('#analysisPeriod')?.value==='90');
    assert.equal(await page.locator('[data-review-view="consultation"]').getAttribute('aria-pressed'),'true','period change preserves the current task');
    await page.evaluate(async()=>{const {state}=await import('./src/core.js');state.domainStatus.sourceMetrics='error';state.ui.reviewView='overview';const {renderUsefulReports}=await import('./src/reports-screen.js');document.querySelector('#screenHost').innerHTML=renderUsefulReports();});
    assert.match(await page.locator('#reportIntegratedReview').innerText(),/Entender a evolução/);assert.doesNotMatch(await page.locator('#reviewPanel>.ltsReviewContrasts').innerText(),/1\.200 mL/);await noOverflow(page);
    await page.locator(`${width>840?'.primaryNav':'.mobileNav'} [data-route="hoje"]`).click();await page.waitForSelector('.ltsHomeReference');
    await page.evaluate(async()=>{const {state}=await import('./src/core.js');for(const key of ['body','nutrition','sourceMetrics','metrics','workouts','labs'])state.domainStatus[key]='error';const {renderProductHomeReference}=await import('./src/home-reference.js');document.querySelector('#screenHost').innerHTML=renderProductHomeReference();});
    assert.match(await page.locator('.ltsReferenceHome').innerText(),/não carreg/);
    assert.doesNotMatch(await page.locator('[data-reference-home]').innerText(),/31,0 kg/);
    await noOverflow(page);await capture(page,'.ltsHomeReference',`${dir}/${label}-unavailable.png`);
    await page.close();
  }
  assert.deepEqual(errors,[]);
  console.log('Integrated review UI: 1536/390/393x650/320, bridge water in Home, independent means, date and source controls, paginated map, private text export, routing/period preservation and failed readers passed.');
}finally{await browser.close();}
