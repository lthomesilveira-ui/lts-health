import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/v2/';
const dir='v2/reference-period-visual';mkdirSync(dir,{recursive:true});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const date=n=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
const db={health_workouts:[],health_workout_exercises:[],health_workout_sets:[],health_daily_nutrition:[],health_source_daily_metrics:[],health_body_composition:[],health_lab_results:[]};
for(let n=0;n<400;n++){
 const band=n<30?0:n<90?1:2;
 db.health_daily_nutrition.push({source_record_id:`n-${n}`,nutrition_date:date(n),source:'Synthetic food',calories_kcal:n===0?9900:2000+500*band,protein_g:n===0?999:100+50*band});
 db.health_source_daily_metrics.push({source_record_id:`sleep-${n}`,metric_date:date(n),metric_type:'sleep_duration_h',value:6+band,unit:'h',source_name:'Synthetic sleep',source_family:'synthetic',canonical_status:'canonical'}, {source_record_id:`water-${n}`,metric_date:date(n),metric_type:'dietary_water_ml',value:1000+500*band,unit:'mL',source_name:'Synthetic water',source_family:'synthetic',canonical_status:'canonical'});
 if(n%7===0&&n>0){db.health_workouts.push({source_record_id:`w-${n}`,workout_date:date(n),workout_type:'Synthetic session',location:'Synthetic gym',source:'Synthetic log',is_canonical:true,record_status:'validated',duration_minutes:40});db.health_workout_exercises.push({source_record_id:`e-${n}`,workout_source_record_id:`w-${n}`,workout_date:date(n),exercise:'Synthetic press',machine:'Synthetic machine',muscle_group:'Peito'});for(const[order,phase]of ['warmup','working','drop'].entries())db.health_workout_sets.push({source_record_id:`s-${n}-${order}`,workout_source_record_id:`w-${n}`,exercise_source_record_id:`e-${n}`,workout_date:date(n),phase,weight:40,reps_numeric:8,weight_unit:'kg'});}
}
for(const[n,i]of [1,14,45,80,120,220,300].map((n,i)=>[n,i]))db.health_body_composition.push({source_record_id:`body-${n}`,measured_at:date(n),source:'Synthetic body',device_name:i<4?'Synthetic A':'Synthetic B',weight_kg:80+i,body_fat_pct:20+i,fat_mass_kg:16+i*.6,skeletal_muscle_mass_kg:34-i*.2});
for(const n of [20,60,200])db.health_lab_results.push({source_record_id:`lab-${n}`,collection_date:date(n),biomarker:'Hemoglobina',result_numeric:12+n/100,result_raw:String(12+n/100),unit:'g/dL',laboratory:'Synthetic lab',source:'Synthetic lab',method:'Synthetic method',reference_range:'10 a 18'});
const service=`window.__reviewDb=${JSON.stringify(db)};window.__reviewDb.health_personal_goals=JSON.parse(localStorage.getItem('synthetic-review-goals')||JSON.stringify(window.__reviewDb.health_personal_goals||[]));window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-review-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},functions:{invoke:async()=>({data:null,error:null})},from(table){let from=0,to=999;const q={upsert(row){window.__reviewDb[table]=[...(window.__reviewDb[table]||[]).filter(r=>r.effective_from!==row.effective_from),row];if(table==='health_personal_goals')localStorage.setItem('synthetic-review-goals',JSON.stringify(window.__reviewDb[table]));q.saved=row;return q;},single:async()=>({data:q.saved,error:null}),select(){return q;},range(a,b){from=a;to=b;return q;},order(){return q;},then(resolve,reject){return Promise.resolve({data:(window.__reviewDb[table]||[]).slice(from,to+1),error:null}).then(resolve,reject);}};return q;}})};`;
const browser=await chromium.launch({headless:true});
try{
for(const [label,width,height] of [['desktop',1440,900],['compact',500,835],['physical',393,650],['mobile',393,844],['small',320,650]]){
 const page=await browser.newPage({viewport:{width,height},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'application/javascript',body:service}));
 await page.goto(base+'#hoje');await page.waitForSelector('[data-reference-home]');
 const setPeriod=async period=>{if(width<=840)await page.locator('[data-home-period-select]').selectOption(period);else await page.locator(`#home-period-${period}`).click();};
 await page.screenshot({path:`${dir}/${label}-top-full.png`});
 assert.equal(await page.locator('.refSignals>.refSignal').count(),5);assert.equal(await page.locator('.refPanels>.refPanel:not(.mobileWorkout)').count(),6);
 assert.equal(await page.locator('.refPanel.body .refPlot svg').count(),1);assert.equal(await page.locator('.refPanel.body [data-series]').count(),2);
 assert.doesNotMatch(await page.locator('.refLegend').innerText(),/Sem dado/);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const geometry=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height};};return{reading:rect('.refReading'),signals:rect('.refSignals'),body:rect('.refPanel.body'),nav:rect('#mobileNav'),panels:[...document.querySelectorAll('.refPanels>.refPanel')].filter(e=>e.getClientRects().length).map(e=>({name:e.className,top:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height})),fonts:[...document.querySelectorAll('.refLegend,.refBodyDate small,.refFootnote')].filter(e=>e.getClientRects().length).map(e=>parseFloat(getComputedStyle(e).fontSize))};});
 if(width<=840){assert.ok(geometry.reading.top<geometry.signals.top&&geometry.signals.top<geometry.body.top);assert.ok(geometry.fonts.every(n=>n>=11));assert.equal(await page.locator('.refSignal:visible').count(),2);}else{assert.ok(geometry.signals.top<geometry.reading.top&&geometry.reading.top<geometry.body.top);assert.equal(new Set(geometry.panels.slice(0,3).map(p=>Math.round(p.top))).size,1);}
 writeFileSync(`${dir}/${label}-geometry.json`,JSON.stringify(geometry,null,2));
 const outputs=[];
 for(const period of ['30','90','365','all']){await setPeriod(period);outputs.push(await page.locator('#reference-period-evidence').textContent());const expectedStart=period==='all'?date(399):date(Number(period)-1);assert.ok((await page.locator('.refPeriod').textContent()).includes(expectedStart.split('-').reverse().join('/')));assert.equal(await page.locator(`[data-home-period="${period}"]`).getAttribute('aria-pressed'),'true');}
 assert.equal(new Set(outputs).size,4,'all periods must change substantive reading with distinct historical evidence');
 await setPeriod('90');await page.locator('[data-disclosure="reference-body-date"]>summary').click();await page.locator('#overview-body-date').selectOption({index:0});const before=await page.locator('.refLegend').innerText();await page.locator('#overview-body-date').selectOption({index:1});assert.notEqual(await page.locator('.refLegend').innerText(),before);
 await page.locator('#overview-body-date').focus();await page.setViewportSize({width:width<=840?900:393,height});await page.waitForTimeout(200);assert.equal(await page.locator('#overview-body-date').evaluate(el=>el===document.activeElement),true);await page.setViewportSize({width,height});await page.waitForTimeout(300);
 await page.locator(width<=840?'#reference-period-evidence':'.refNext').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${label}-lower-full.png`});
 await page.locator('.refReading [data-home-insight-details]').click();await page.waitForSelector('#reportIntegratedReview');assert.equal(await page.locator('#analysisPeriod').inputValue(),'90');assert.doesNotMatch(await page.locator('#reviewPanel').innerText(),/entre as duas semanas|comparar semanas/);
 await page.locator('#reviewTab-consultation').click();await page.waitForSelector('[data-review-export]');assert.match(await page.locator('.ltsReviewExport').innerText(),/90|janela/);assert.doesNotMatch(await page.locator('.ltsReviewExport').innerText(),/entre as duas semanas/);
 await page.goBack();await page.waitForSelector('[data-reference-home]');assert.equal(await page.locator('#home-period-90').getAttribute('aria-pressed'),'true');
 // Global calendar must survive entry into each domain and its return path.
 await page.locator('.refPanel.body>header [data-route="bio"]').click();await page.waitForSelector('.ltsCompositionV2');
 assert.equal(await page.locator('[data-depth-period="productCompositionPeriod"][data-value="90"]').getAttribute('aria-pressed'),'true');
 assert.match(await page.locator('.ltsCompositionTrend').innerText(),new RegExp(date(89).split('-').reverse().join('/')));
 assert.equal(await page.locator('.ltsCompositionChart circle').count(),4);
 await page.locator('[data-depth-period="productCompositionPeriod"][data-value="30"]').click();
 assert.equal(await page.locator('.ltsCompositionChart circle').count(),2);
 await page.locator('.ltsCompositionV2>.ltsPageHeader .ltsBack').click();await page.waitForSelector('[data-reference-home]');assert.equal(await page.locator('#home-period-30').getAttribute('aria-pressed'),'true');
 await setPeriod('90');
 if(width<=840){assert.equal(await page.locator('#mobileNav button').count(),4);await page.locator('#mobileNav [data-route="mais"]').click();await page.locator('#moreSheet [data-route="saude"]').click();}else await page.locator('.primaryNav [data-route="saude"]').click();await page.waitForSelector('.ltsLabsV2');
 assert.equal(await page.locator('[data-depth-period="productLabPeriod"][data-value="90"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#productLabCollection option').count(),2);
 await page.locator('.ltsLabsV2>.ltsPageHeader .ltsBack').click();await page.waitForSelector('[data-reference-home]');assert.equal(await page.locator('#home-period-90').getAttribute('aria-pressed'),'true');
 await page.locator('.refPanel.water>header [data-route="nutricao"]').click();await page.waitForSelector('.ltsNutritionProduct');assert.equal(await page.locator('[data-period="90"]').getAttribute('aria-pressed'),'true');
 await page.locator(`${width>840?'.primaryNav':'.mobileNav'} [data-route="hoje"]`).click();await page.waitForSelector('[data-reference-home]');assert.equal(await page.locator('#home-period-90').getAttribute('aria-pressed'),'true');
 // Sparse case: old records outside selected period, unknown device and candidate-only sleep.
 await page.evaluate(async()=>{const {state}=await import('./src/core.js');const {renderProductHomeReference}=await import('./src/home-reference.js');state.data.nutrition=state.data.nutrition.slice(1,16);state.data.sourceMetrics=state.data.sourceMetrics.filter(r=>r.metric_type==='sleep_duration_h').slice(1,6).map(r=>({...r,canonical_status:'candidate'}));state.data.body=state.data.body.slice(0,3).map((r,i)=>({...r,device_name:i===0?'Synthetic B':null}));document.querySelector('#screenHost').innerHTML=renderProductHomeReference();document.querySelector('#screenHost').scrollTop=0;});
 await page.screenshot({path:`${dir}/${label}-top-sparse.png`});assert.match(await page.locator('.refPanel.nutrition').innerText(),/15\/89/);assert.match(await page.locator('.refPanel.water').innerText(),/Sem registro/);assert.match(await page.locator('.refPanel.sleep').innerText(),/candidata/);
 await page.locator(width<=840?'#reference-period-evidence':'.refNext').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${label}-lower-sparse.png`});
 assert.equal(await page.locator('[id]').evaluateAll(es=>es.length===new Set(es.map(e=>e.id)).size),true);assert.deepEqual(errors,[]);await page.close();
}
}finally{await browser.close();}
console.log('Reference Home: faithful hierarchy, one dual-series panel, 30/90/365/all evidence, source coverage, sparse states, selection, focus, analysis/consultation/Back.');
