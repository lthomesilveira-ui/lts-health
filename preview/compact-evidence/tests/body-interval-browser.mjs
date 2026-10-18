import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

// Synthetic data only. Tests the real authenticated renderer, not a demo page.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/v2/';
const dir='v2/interval-visual';mkdirSync(dir,{recursive:true});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const date=offset=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-offset);return d.toISOString().slice(0,10);};
const db={health_workouts:[],health_daily_nutrition:[],health_source_daily_metrics:[]};
db.health_body_composition=Array.from({length:5},(_,i)=>({measured_at:date(i*3+1),source_record_id:`body-${i}`,source:'Synthetic scan',device_name:'Synthetic device',weight_kg:80+i*.2,body_fat_pct:20+i*.1,fat_mass_kg:16+i*.1,skeletal_muscle_mass_kg:32}));
db.health_lab_results=[{source_record_id:'lab-1',collection_date:date(2),biomarker:'Synthetic marker',unit:'u',result_numeric:12,result_raw:'12',source:'Synthetic lab',laboratory:'Synthetic lab',method:'Synthetic method'}];
for(const [offset,n]of [[120,98765.43],[2,123456.78]])db.health_lab_results.push({source_record_id:`wide-${offset}`,collection_date:date(offset),biomarker:'Synthetic wide scale',unit:'u',result_numeric:n,result_raw:String(n),source:'Synthetic lab',laboratory:'Synthetic lab',method:'Synthetic method'});
for(const [i,label] of ['Hemoglobina Glicada (A1C)','LDL-Colesterol','Triglicérides','Hemoglobina','Hematócrito','Ferritina','Testosterona Total','Estradiol'].entries())for(const [suffix,offset,value] of [['prior',120,10+i],['current',2,12+i]])db.health_lab_results.push({source_record_id:`comparison-${i}-${suffix}`,collection_date:date(offset),biomarker:label,unit:'u',result_numeric:value,result_raw:String(value),reference_range:['Hemoglobina','Hematócrito','Testosterona Total'].includes(label)?'Homens: 10 a 14 u':'Synthetic report reference',laboratory:'Synthetic lab',source:'Synthetic lab',method:i%2?'':suffix==='prior'?'HPLC':'Cromatografia líquida de alta eficiência (HPLC)'});
db.health_personal_goals=[{effective_from:date(40),calories_kcal:1800,protein_g:120,water_ml:2000,notes:JSON.stringify({type:'historical_protocol',source:'Synthetic protocol',documented_on:date(40),current_validity:'unconfirmed'})}];
for(let i=0;i<=16;i++){
  db.health_daily_nutrition.push({source_record_id:`n${i}`,nutrition_date:date(i),source:'Synthetic food',calories_kcal:i?2000:9000,protein_g:i>7?180:90});
  db.health_source_daily_metrics.push({source_record_id:`health_auto_export:w${i}`,metric_date:date(i),metric_type:'dietary_water_ml',unit:'mL',value:i===0?1250:i%2?1000:1200,source_name:'Synthetic water',source_family:'health_auto_export',canonical_status:'canonical',confidence:'authenticated_auto_export'},
    {source_record_id:`s${i}`,metric_date:date(i),metric_type:'sleep_duration_h',unit:'h',value:i>7?8:6,source_name:'Synthetic sleep',source_family:'synthetic',canonical_status:'candidate'});
  if(i>0)db.health_source_daily_metrics.push({source_record_id:`other${i}`,metric_date:date(i),metric_type:'sleep_duration_h',unit:'h',value:20,source_name:'Other sleep',source_family:'synthetic',canonical_status:'candidate'});
  if(i>0&&i%2===0)db.health_workouts.push({source_record_id:`w${i}`,workout_date:date(i),workout_type:'Synthetic session',source:'Synthetic log',is_canonical:true,record_status:'validated',duration_minutes:40});
}
// Distinct source/device and sparse coverage, deliberately synthetic.
db.health_body_composition=[61,31,1].map((n,i)=>({source_record_id:`interval-body-${i}`,measured_at:date(n),source:'Synthetic body',device_name:i===2?'Synthetic device B':null,weight_kg:80-i,fat_mass_kg:15+i*.2,skeletal_muscle_mass_kg:35-i*.3,body_fat_pct:20,body_water_l:45-i,source_file:`synthetic-${i}.pdf`}));
db.health_daily_nutrition=[30,29].map(n=>({source_record_id:`interval-food-${n}`,nutrition_date:date(n),source:'Synthetic food source',calories_kcal:2100,protein_g:130}));
db.health_source_daily_metrics=[30,29,28,27,26].flatMap(n=>['Polar Flow','Polar Flow via Apple Health'].map((name,i)=>({source_record_id:`interval-sleep-${n}-${i}`,metric_date:date(n),metric_type:'sleep_duration_h',unit:'h',value:7.5,source_name:name,source_family:i?'healthkit_candidate':'polar_flow',source_file:'synthetic-export.zip',canonical_status:'candidate'})));
db.health_workouts=[20,10].map(n=>({source_record_id:`interval-workout-${n}`,workout_date:date(n),is_canonical:true,record_status:'validated',workout_type:'Synthetic workout',duration_minutes:n===20?45:null,source:'Synthetic log'}));
db.health_workout_exercises=[20,10].map(n=>({source_record_id:`interval-ex-${n}`,workout_source_record_id:`interval-workout-${n}`,workout_date:date(n),exercise:'Synthetic press',machine:'Synthetic machine',muscle_group:'Peito'}));
db.health_workout_sets=[20,10].flatMap(n=>['warmup','working',null,'drop'].map((phase,i)=>({source_record_id:`interval-set-${n}-${i}`,workout_source_record_id:`interval-workout-${n}`,exercise_source_record_id:`interval-ex-${n}`,workout_date:date(n),phase,weight:40,reps_numeric:8,weight_unit:'kg'})));

// Reach every marker without rendering the entire collection as open cards.
db.health_lab_results=Array.from({length:115},(_,i)=>({source_record_id:`interval-lab-${i}`,collection_date:date(2),biomarker:`Synthetic marker ${String(i).padStart(3,'0')}`,result_numeric:i,result_raw:String(i),unit:'u',reference_range:'1 a 5 u',laboratory:'Synthetic lab',method:'Synthetic method'}));
db.health_lab_results.push({source_record_id:'interval-lab-prior',collection_date:date(120),biomarker:'Synthetic marker 114',result_raw:'< 3',unit:'u',laboratory:'Different prior origin',method:'Different prior method'});
db.health_segmental_composition=[31,1].map((n,i)=>({measured_at:date(n),body_source_record_id:`interval-body-${i+1}`,lean_right_arm_kg:i?4.3:4.5,lean_left_arm_kg:i?4.1:4.2,source:'Synthetic scan'}));
const service=`window.__reviewDb=${JSON.stringify(db)};window.__reviewDb.health_personal_goals=JSON.parse(localStorage.getItem('synthetic-review-goals')||JSON.stringify(window.__reviewDb.health_personal_goals||[]));window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-review-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},functions:{invoke:async()=>({data:null,error:null})},from(table){let from=0,to=999;const filters=[];const q={upsert(row){window.__reviewDb[table]=[...(window.__reviewDb[table]||[]).filter(r=>r.effective_from!==row.effective_from),row];if(table==='health_personal_goals')localStorage.setItem('synthetic-review-goals',JSON.stringify(window.__reviewDb[table]));q.saved=row;return q;},single:async()=>({data:q.saved,error:null}),select(){return q;},eq(key,value){filters.push([key,value]);return q;},range(a,b){from=a;to=b;return q;},order(){return q;},then(resolve,reject){return Promise.resolve({data:(window.__reviewDb[table]||[]).filter(row=>filters.every(([key,value])=>row[key]===value)).slice(from,to+1),error:null}).then(resolve,reject);}};return q;}})};`;
const browser=await chromium.launch({headless:true});
try{
 for(const [label,width,height]of [['desktop',1440,900],['mobile',393,650],['small',320,740]]){
 const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'application/javascript',body:service}));
 await page.goto(base+'#analise');await page.waitForSelector('#reviewTab-interval');await page.locator('#reviewTab-interval').click();await page.waitForSelector('[data-body-interval]');
 await page.screenshot({path:`${dir}/${label}-body.png`});
 assert.equal(await page.locator('#reviewTab-interval').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('.ltsIntervalMetrics .ltsIntervalMetric').count(),5);
 assert.ok((await page.locator('.ltsIntervalCoverageGrid').innerText()).includes('2/30'));
 assert.ok((await page.locator('.ltsIntervalFacts').innerText()).includes('6'));
 assert.ok((await page.locator('.ltsIntervalFacts').innerText()).includes('2'));
 assert.equal(await page.locator('#bodyIntervalLabMarker option').count(),115);
 await page.locator('#bodyIntervalLabMarker').selectOption('synthetic marker 114');
 await page.waitForFunction(()=>document.querySelector('.ltsIntervalLabs')?.textContent.includes('114 u'));
 assert.equal(await page.locator('.ltsIntervalLabs>.ltsIntervalLab').count(),1);
 assert.ok((await page.locator('[data-disclosure="interval-lab-previous"]>summary').innerText()).includes('Anterior fora da janela'));
 await page.locator('[data-disclosure="interval-lab-previous"]>summary').click();
 assert.ok((await page.locator('[data-disclosure="interval-lab-previous"]').innerText()).includes('Different prior method'));
 await page.locator('#bodyIntervalLabMarker').selectOption('synthetic marker 000');
 await page.waitForFunction(()=>document.querySelector('.ltsIntervalLabs')?.textContent.includes('Synthetic marker 000'));
 assert.equal(await page.locator('[data-body-interval]').evaluate(el=>el.scrollWidth<=el.clientWidth+2),true);
 await page.locator('.ltsIntervalGroups').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${label}-training.png`});
 await page.locator('.ltsIntervalCoverageGrid').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${label}-coverage.png`});
 await page.locator('#bodyIntervalStart').selectOption(date(61));await page.waitForTimeout(200);assert.ok((await page.locator('.ltsIntervalBand').innerText()).includes('60 dias'));
 await page.locator('#bodyIntervalStart').selectOption(date(31));await page.locator('#bodyIntervalStart').focus();await page.setViewportSize({width:900,height});await page.waitForTimeout(200);assert.equal(await page.locator('#bodyIntervalStart').evaluate(el=>el===document.activeElement),true);await page.setViewportSize({width,height});
 await page.locator('[data-disclosure="interval-training-detail"]>summary').click();assert.equal(await page.locator('[data-disclosure="interval-training-detail"]').getAttribute('open'),'');
 await page.locator('#reviewTab-consultation').click();await page.waitForSelector('[data-review-export]');await page.locator('#reviewTab-interval').click();await page.locator('[data-body-interval]').waitFor({state:'visible',timeout:10000});assert.equal(await page.locator('[data-body-interval]').isVisible(),true);assert.equal(await page.locator('#reviewTab-interval').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#reviewTab-consultation').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#bodyIntervalStart').inputValue(),date(31));assert.equal(await page.locator('#bodyIntervalEnd').inputValue(),date(1));
 // The current day is displayed separately from closed-day means.
 await page.evaluate(async({today})=>{const {state}=await import('./src/core.js');state.data.body.push({source_record_id:'interval-today',measured_at:today,weight_kg:77,source:'Synthetic body'});state.data.nutrition.push({source_record_id:'today-food',nutrition_date:today,source:'Synthetic food source',protein_g:17,calories_kcal:321,water_ml:123});state.data.sourceMetrics.push({source_record_id:'today-sleep',metric_date:today,metric_type:'sleep_duration_h',unit:'h',value:1.5,source_name:'Polar Flow',source_family:'polar_flow',canonical_status:'candidate'});},{today});
 await page.locator('#bodyIntervalStart').selectOption(date(31));await page.locator('#bodyIntervalEnd').selectOption(today);
 assert.ok((await page.locator('.ltsIntervalOpenDay').allTextContents()).some(text=>text.includes('17 g')));
 assert.ok((await page.locator('.ltsIntervalOpenDay').allTextContents()).some(text=>text.includes('321 kcal')));
 assert.ok((await page.locator('.ltsIntervalOpenDay').allTextContents()).some(text=>text.includes('123 mL')));
 assert.ok((await page.locator('.ltsIntervalOpenDay').allTextContents()).some(text=>text.includes('1,5 h')));
 await page.locator('.ltsIntervalCoverageGrid').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${label}-open-day.png`});
 // A failed training domain must not hide regional measurements.
 await page.evaluate(async()=>{const {state}=await import('./src/core.js');state.domainStatus.workouts='error';});
 await page.locator('#bodyIntervalEnd').selectOption(date(1));
 assert.ok((await page.locator('[data-body-interval]').innerText()).includes('Treinos não carregaram'));
 await page.locator('[data-disclosure="interval-segmental"]>summary').click();
 assert.ok((await page.locator('[data-disclosure="interval-segmental"]').innerText()).includes('4,50 kg'));
 assert.equal(await page.locator('[data-body-interval]').evaluate(el=>el.scrollWidth<=el.clientWidth+2),true);
 assert.equal(await page.locator('[id]').evaluateAll(es=>es.length===new Set(es.map(e=>e.id)).size),true);assert.deepEqual(errors,[]);await page.close();
 }
}finally{await browser.close();}
console.log('Body interval browser: sparse coverage, phases, complete lab selection, explicit open-day values, regions after training failure, date selection, mobile-sized viewport, keyboard and consultation preserved.');
