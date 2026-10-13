import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

// Synthetic data only. Tests the real authenticated renderer, not a demo page.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/v2/';
const dir='v2/overview-visual';mkdirSync(dir,{recursive:true});
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
const service=`window.__reviewDb=${JSON.stringify(db)};window.__reviewDb.health_personal_goals=JSON.parse(localStorage.getItem('synthetic-review-goals')||JSON.stringify(window.__reviewDb.health_personal_goals||[]));window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-review-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},functions:{invoke:async()=>({data:null,error:null})},from(table){let from=0,to=999;const q={upsert(row){window.__reviewDb[table]=[...(window.__reviewDb[table]||[]).filter(r=>r.effective_from!==row.effective_from),row];if(table==='health_personal_goals')localStorage.setItem('synthetic-review-goals',JSON.stringify(window.__reviewDb[table]));q.saved=row;return q;},single:async()=>({data:q.saved,error:null}),select(){return q;},range(a,b){from=a;to=b;return q;},order(){return q;},then(resolve,reject){return Promise.resolve({data:(window.__reviewDb[table]||[]).slice(from,to+1),error:null}).then(resolve,reject);}};return q;}})};`;
const browser=await chromium.launch({headless:true});
try{
 for(const [label,width,height] of [['desktop',1536,864],['mobile',390,844],['physical',393,650],['small',320,740]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'application/javascript',body:service}));
  await page.goto(base+'#hoje');await page.waitForSelector('[data-home-overview]');
  await page.screenshot({path:`${dir}/${label}-home.png`});
  const first=await page.evaluate(()=>{const r=document.querySelector('.ltsOverviewReading').getBoundingClientRect(),g=document.querySelector('.ltsOverviewBodyPlots svg').getBoundingClientRect(),n=document.querySelector('#mobileNav'),end=Math.min(innerHeight,getComputedStyle(n).display!=='none'?n.getBoundingClientRect().top:innerHeight);return {summary:r.bottom<=end,graph:Math.max(0,Math.min(g.bottom,end)-Math.max(g.top,0)),graphs:[...document.querySelectorAll('.ltsOverviewBodyPlots svg')].map(svg=>{const b=svg.getBoundingClientRect();return Math.max(0,Math.min(b.bottom,end)-Math.max(b.top,0));}),advanced:document.querySelector('.ltsHomeAdvanced').open,overflow:document.querySelector('#screenHost').scrollWidth-document.querySelector('#screenHost').clientWidth};});
  writeFileSync(`${dir}/${label}-geometry.json`,JSON.stringify(first,null,2));
  assert.equal(first.summary,true);assert.equal(first.advanced,false);assert.ok(first.overflow<=2);if(width<=840)assert.ok(first.graphs.length===2&&first.graphs.every(h=>h>=64),`${label} aligned charts exposed ${JSON.stringify(first.graphs)}px`);
  assert.equal(await page.locator('.ltsOverviewBodyPlots svg').count(),2);await page.locator('#overview-body-date').selectOption({index:0});assert.equal(await page.locator('.ltsOverviewBodyPlots .selected').count(),2);
  await page.locator('#overview-body-date').focus();await page.setViewportSize({width:width<=840?900:390,height});
  await page.waitForTimeout(300);assert.equal(await page.locator('#overview-body-date').evaluate(el=>el===document.activeElement),true);
  await page.setViewportSize({width,height});await page.waitForTimeout(300);
  await page.locator('[data-disclosure="overview-body-evidence"]>summary').click();assert.equal(await page.locator('.ltsOverviewTable tbody tr').count(),5);
  await page.locator('[data-disclosure="overview-body-evidence"]>summary').click();
  await page.locator('[data-home-period="90"]').click();assert.equal(await page.locator('[data-home-period="90"]').getAttribute('aria-pressed'),'true');
  await page.locator('.ltsOverviewCard.routine').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${label}-routine.png`});
  await page.locator('[data-disclosure="home-advanced"]>summary').click();assert.equal(await page.locator('[data-disclosure="home-advanced"]').getAttribute('open'),'');
  await page.locator('[data-disclosure="home-advanced"]>summary').click();
  await page.locator('.ltsOverview [data-home-consultation]').click();await page.waitForSelector('[data-review-export]');
  await page.goBack();await page.waitForSelector('[data-home-overview]');
  assert.equal(await page.locator('[id]').evaluateAll(rows=>rows.length===new Set(rows.map(x=>x.id)).size),true);
  assert.deepEqual(errors,[]);await page.close();
 }
}finally{await browser.close();}
console.log('Overview browser: first fold, widths, chart filters, keyboard focus, rotation, disclosures, consultation and Back verified.');
