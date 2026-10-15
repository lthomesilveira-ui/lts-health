import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/mobile-study/';
const dir='mobile-study-visual';mkdirSync(dir,{recursive:true});
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
db.health_lab_results.push({source_record_id:'lab-choice',collection_date:date(20),biomarker:'Synthetic second marker',result_numeric:25,result_raw:'25',unit:'u',laboratory:'Synthetic lab',source:'Synthetic lab',method:'Synthetic method',reference_range:'10 a 18'});
db.health_daily_nutrition.push({source_record_id:'other-origin',nutrition_date:date(80),source:'Synthetic separate export',calories_kcal:1800,protein_g:80});
const service=`window.__reviewDb=${JSON.stringify(db)};
window.__reviewDb.health_personal_goals=JSON.parse(localStorage.getItem('synthetic-review-goals')||JSON.stringify(window.__reviewDb.health_personal_goals||[])).map(row=>({user_id:'synthetic-review-user',...row}));
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-review-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  functions:{invoke:async()=>({data:null,error:null})},
  from(table){
    let from=0,to=999,operation=null,payload=null;const filters=[];
    const rows=()=> (window.__reviewDb[table]||[]).filter(row=>filters.every(([key,value])=>row[key]===value));
    const persist=()=>{if(table==='health_personal_goals')localStorage.setItem('synthetic-review-goals',JSON.stringify(window.__reviewDb[table]));};
    const q={
      select(){return q;},eq(key,value){filters.push([key,value]);return q;},is(key,value){filters.push([key,value]);return q;},range(a,b){from=a;to=b;return q;},order(){return q;},
      maybeSingle:async()=>{const found=rows();return found.length>1?{data:null,error:{message:'Multiple rows'}}:{data:found[0]?{...found[0]}:null,error:null};},
      insert(row){operation='insert';payload=row;return q;},update(row){operation='update';payload=row;return q;},
      single:async()=>{
        if(operation==='insert'){
          if((window.__reviewDb[table]||[]).some(row=>row.user_id===payload.user_id&&row.effective_from===payload.effective_from))return {data:null,error:{message:'Duplicate key'}};
          (window.__reviewDb[table]??=[]).push({...payload});persist();return {data:{...payload},error:null};
        }
        const found=rows();if(operation!=='update'||found.length!==1)return {data:null,error:{message:'Missing or changed row'}};
        Object.assign(found[0],payload);persist();return {data:{...found[0]},error:null};
      },
      then(resolve,reject){return Promise.resolve({data:rows().slice(from,to+1),error:null}).then(resolve,reject);}
    };return q;
  }
})};`;
const browser=await chromium.launch({headless:true});
try {
 for(const[label,width,height]of[['desktop',1440,900],['mobile',393,844],['small',320,740]]){
  for(const sparse of [false,true]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const sparseSetup=`window.__reviewDb.health_body_composition=window.__reviewDb.health_body_composition.filter(r=>[${JSON.stringify(date(20))},${JSON.stringify(date(60))}].includes(r.measured_at));
   window.__reviewDb.health_body_composition=[{source_record_id:'study-a',measured_at:${JSON.stringify(date(60))},source:'Synthetic scan',weight_kg:85,fat_mass_kg:18,skeletal_muscle_mass_kg:35},{source_record_id:'study-b',measured_at:${JSON.stringify(date(20))},source:'Synthetic report',device_name:'Synthetic B',weight_kg:84,fat_mass_kg:18.5,skeletal_muscle_mass_kg:34}];
   window.__reviewDb.health_daily_nutrition=window.__reviewDb.health_daily_nutrition.filter(r=>r.nutrition_date>=${JSON.stringify(date(15))});
   window.__reviewDb.health_source_daily_metrics=window.__reviewDb.health_source_daily_metrics.filter(r=>r.metric_type==='sleep_duration_h'&&[1,2,3,9,10,11].map(n=>new Date(Date.parse(${JSON.stringify(today)})-n*86400000).toISOString().slice(0,10)).includes(r.metric_date));`;
   await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'application/javascript',body:service+(sparse?sparseSetup:'')}));
   await page.goto(base+'#hoje');await page.waitForSelector('[data-mobile-study]');
   const stableHome=()=>page.waitForFunction(()=>{const root=document.querySelector('[data-mobile-study]');if(!root||document.querySelector('#syncText')?.textContent!=='Atualizado')return false;if(window.__studyRenderedRoot!==root){window.__studyRenderedRoot=root;window.__studyStableFrames=0;}return ++window.__studyStableFrames>=3;});
   await stableHome();
   await page.locator('[data-home-period-select]').selectOption('90');
   await page.waitForFunction(()=>document.querySelector('[data-home-period-select]')?.value==='90');
   assert.equal(await page.locator('[data-study-domain]:visible').count(),6);
   assert.equal(await page.locator('#screenHost').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(243, 247, 252)');
   assert.ok(await page.locator('.studyInsight').isVisible());assert.equal(await page.locator('.studyPair').count(),3);
   assert.match(await page.locator('.studyCard.nutrition').innerText(),/proteína/);
   assert.equal(await page.locator('.studyCard.body svg text').count(),0,'body uses readable HTML values, no compressed SVG text');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
   await stableHome();await page.locator('#screenHost').evaluate(el=>{el.scrollTop=0;});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${dir}/${label}-${sparse?'sparse':'full'}-top.png`});
   for(const selector of ['.studyInsight','.studyCard.body','.studyCard.nutrition','.studyCard.labs','.studyCard.sleep','.studyCard.water']){
    await stableHome();await page.locator(selector).scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${label}-${sparse?'sparse':'full'}-${selector.split('.').at(-1)}.png`});
   }
   await page.screenshot({path:`${dir}/${label}-${sparse?'sparse':'full'}-lower.png`});
   // Period changes reuse the existing model and controller, never a static study snapshot.
   const initialBody=await page.locator('.studyCard.body').innerText();
   await page.locator('[data-home-period-select]').selectOption('30');
   await page.waitForFunction(()=>document.querySelector('[data-home-period-select]')?.value==='30');
   assert.notEqual(await page.locator('.studyCard.body').innerText(),initialBody);
   for(const period of ['365','all','90']){await page.locator('[data-home-period-select]').selectOption(period);await page.waitForFunction(p=>document.querySelector('[data-home-period-select]')?.value===p,period);assert.equal(await page.locator('[data-study-domain]:visible').count(),6);}
   await page.locator('.studyCard.nutrition details>summary').click();
   const source=page.locator('[data-home-field="reportNutritionSource"]');const sourceOptions=await source.locator('option:not([disabled])').evaluateAll(es=>es.map(e=>e.value));const chosen=sourceOptions.at(-1);if(chosen)await source.selectOption(chosen);
   await page.locator('[data-home-insight-details]').click();
   await page.waitForURL('**/#analise');await page.waitForSelector('.ltsIntegratedReview,.ltsRecoveryDepth,.ltsEvolution');
   const nav=width<=840?'#mobileNav':'#primaryNav';await page.locator(`${nav} [data-route="hoje"]`).click();await page.waitForSelector('[data-mobile-study]');
   assert.equal(await page.locator('[data-home-period-select]').inputValue(),'90');
   assert.equal(await page.locator('.studyCard.body').innerText(),initialBody);
   if(chosen)assert.equal(await page.locator('[data-home-field="reportNutritionSource"]').inputValue(),chosen,'selected nutrition source survives interval and return');
   const blocked=await page.evaluate(()=>{try{window.supabase.createClient('synthetic','synthetic').from('synthetic').insert({});return false;}catch(e){return e.code==='preview_read_only';}});assert.equal(blocked,true);
   assert.deepEqual(errors,[]);await page.close();
  }
 }
}finally{await browser.close();}
console.log('Isolated study: synthetic full/sparse layouts, six visible domains, period/return, body legibility and write guard passed.');
