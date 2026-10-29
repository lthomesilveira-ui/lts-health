import assert from 'node:assert/strict';

// Called only inside the established authenticated CI session. No fixtures,
// writes, credentials, medical values or source identifiers are printed.
async function inspectIntegratedDashboard(page,{expectedBuild}){
 const keys=['water','protein','energy','activeEnergy','totalEnergy','steps','sleep'];
 assert.equal(await page.locator('meta[name="lts-build"]').getAttribute('content'),expectedBuild);
 const check=async()=>{
  await page.waitForFunction(async()=>{
   const {state,fmtNum}=await import('./src/core.js'),{healthDashboardModel}=await import('./src/health-dashboard-model.js');
   if(!state.loaded||state.route!=='hoje'||!document.querySelector('[data-health-dashboard]')||document.querySelector('.loadingState'))return false;
   return healthDashboardModel(state.data,state.domainStatus,state.ui).metrics.every(m=>document.querySelector(`[data-dashboard-card="${m.key}"] .healthMetricValue strong`)?.textContent===(m.value==null?'—':fmtNum(m.value,m.key==='sleep'?1:0)));
  });
  assert.deepEqual(await page.locator('[data-dashboard-card]').evaluateAll(es=>es.map(e=>e.dataset.dashboardCard)),keys);
  const reading=await page.evaluate(async()=>{
   const {state,fmtNum}=await import('./src/core.js'),{healthDashboardModel}=await import('./src/health-dashboard-model.js');
   const d=healthDashboardModel(state.data,state.domainStatus,state.ui);
   const matched=d.metrics.every(m=>document.querySelector(`[data-dashboard-card="${m.key}"] .healthMetricValue strong`)?.textContent===(m.value==null?'—':fmtNum(m.value,m.key==='sleep'?1:0)));
   const qualityMatched=d.metrics.every(m=>{
    const audit=m.coverageAudit,card=document.querySelector(`[data-dashboard-card="${m.key}"]`),detail=card?.querySelector(`[data-coverage-audit="${m.key}"]`);
    if(!audit||!detail||audit.usedDays!==m.count||audit.receivedDays>m.expectedDays||new Set(audit.rows.map(row=>row.date)).size!==audit.rows.length)return false;
    if(detail.querySelectorAll('[data-coverage-date]').length!==Math.min(31,audit.rows.length))return false;
    const receipt=card.querySelector('[data-received-coverage]'),shouldShow=d.mode==='period'&&audit.receivedDays>audit.usedDays;
    if(Boolean(receipt)!==shouldShow||shouldShow&&!receipt.textContent.includes(`${audit.receivedDays}/${audit.expectedDays}`))return false;
    if(m.key==='totalEnergy'&&Boolean(card.querySelector('[data-total-energy-unavailable]'))!==(m.value==null))return false;
    return audit.rows.every(row=>row.date>=d.bounds.start&&row.date<=d.bounds.end&&(d.mode==='day'||row.date<d.today));
   });
   return {matched,qualityMatched,overflow:document.documentElement.scrollWidth>innerWidth+1,missingWater:d.metricsByKey.water.value==null,ambiguousWater:Boolean(d.metricsByKey.water.ambiguousDays),latestWater:d.metricsByKey.water.latestRecorded?.date||null};
  });
  assert.equal(reading.matched,true,'actual seven-card readings match the loaded source-specific calendar');
  assert.equal(reading.overflow,false,'actual dashboard fits viewport');
  assert.equal(reading.qualityMatched,true,'actual daily receipt audit, source-specific coverage and total-energy absence agree across all windows');
  if(reading.missingWater&&!reading.ambiguousWater){assert.equal(await page.locator('[data-dashboard-card="water"] .healthMetricValue strong').innerText(),'—');}
  return reading;
 };
 await check();
 for(const period of ['7','30','60','90','6m','1y','all']){
  await page.locator('[data-dashboard-mode="period"]').click();
  await page.locator('#dashboard-period').selectOption(period);
  await page.waitForFunction(period=>document.querySelector('#dashboard-period')?.value===period,period);
  await check();
 }
 // Independently read the selected water origin from the authenticated API,
 // then reopen an actual observed day through the published date control.
 await page.locator('#dashboard-period').selectOption('7');
 await check();
 const truth=await page.evaluate(async()=>{
  const {state,sb}=await import('./src/core.js'),{healthDashboardModel}=await import('./src/health-dashboard-model.js');
  const d=healthDashboardModel(state.data,state.domainStatus,state.ui),s=d.metricsByKey.water.source;
  if(!s)return null;
  const normalize=x=>String(x??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const rows=[];
  for(let start=0;;start+=1000){
   const q=s.domain==='nutrition'?sb.from('health_daily_nutrition').select('source_record_id,nutrition_date,water_ml,source').order('nutrition_date').order('source_record_id'):sb.from('health_source_daily_metrics').select('source_record_id,metric_date,value,unit,source_name,source_family,canonical_status').eq('metric_type','dietary_water_ml').order('metric_date').order('source_record_id');
   const {data,error}=await q.range(start,start+999);if(error)throw Error('independent water read failed');rows.push(...data);if(data.length<1000)break;
  }
  const selected=rows.filter(r=>s.domain==='nutrition'?normalize(r.source)===normalize(s.label):normalize(r.source_name)===normalize(s.label)&&normalize(r.source_family)===normalize(s.sourceFamily)&&normalize(r.canonical_status)===s.status&&normalize(r.unit)==='ml');
  const groups=new Map();for(const r of selected){const date=r.nutrition_date||r.metric_date;if(!date||date>d.today)continue;if(!groups.has(date))groups.set(date,[]);groups.get(date).push(r);}
  const numeric=r=>{const raw=s.domain==='nutrition'?r.water_ml:r.value;return raw==null||typeof raw==='boolean'||String(raw).trim()===''||!Number.isFinite(Number(raw))?null:Number(raw);};
  const dates=[...groups].filter(([,rs])=>rs.length===1&&numeric(rs[0])!=null).sort(([a],[b])=>a.localeCompare(b));
  if(!dates.length)return null;
  const [date,[row]]=dates.at(-1);
  return {date,value:numeric(row),today:d.today};
 });
 if(truth){
  await page.locator('[data-dashboard-mode="day"]').click();
  await page.locator('#dashboard-date').fill(truth.date);
  await page.locator('#dashboard-date').dispatchEvent('change');
  await page.waitForFunction(date=>document.querySelector('#dashboard-date')?.value===date,truth.date);
  await check();
  assert.equal(await page.locator('[data-dashboard-card="water"] .healthMetricValue strong').innerText(),Number(truth.value).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0}),'observed historical water day agrees with independent API');
  await page.locator('#dashboard-today').click();
  const current=await check();
  if(truth.date<truth.today&&current.missingWater){
   assert.ok(await page.locator('[data-last-known="water"]').isVisible(),'known historical water remains dated, never carried into today');
   assert.ok((await page.locator('[data-last-known="water"]').innerText()).includes(truth.date.split('-').reverse().join('/')));
  }
 }
 await page.locator('[data-dashboard-mode="period"]').click();
 await page.locator('#dashboard-period').selectOption('7');
 await check();
}

export async function auditIntegratedDashboard(page,options){
 try{return await inspectIntegratedDashboard(page,options);}
 catch{
  // This workflow has public logs. Preserve evidence only in the existing
  // encrypted-artifact path; never print an assertion containing private values.
  try{await page.screenshot({path:'v2/real-auth-evidence/dashboard-failure.png',fullPage:true});}catch{}
  throw new Error('Integrated dashboard verification failed; private observations withheld. Inspect the encrypted authenticated evidence.');
 }
}


async function inspectIntegratedEvolution(page){
 const rows=await page.evaluate(async()=>{
  const {sb}=await import('./src/core.js'),rows=[];
  for(let from=0;;from+=1000){
   const {data,error}=await sb.from('health_body_composition').select('source_record_id,measured_at,weight_kg,body_fat_pct,skeletal_muscle_mass_kg,fat_mass_kg').order('source_record_id').range(from,from+999);
   if(error)throw Error('independent body read failed');rows.push(...data);if(data.length<1000)break;
  }
  return rows;
 });
 const check=async(metric,period)=>{
  await page.waitForFunction(({metric,period})=>document.querySelector(`[data-evolution-overview-metric="${metric}"]`)?.getAttribute('aria-pressed')==='true'&&document.querySelector(`[data-evolution-period="${period}"]`)?.getAttribute('aria-pressed')==='true',{metric,period});
  const matches=await page.evaluate(async({rows,metric,period})=>{
   const {fmtNum}=await import('./src/core.js'),{localHealthDay}=await import('./src/health-context.js');
   const end=localHealthDay(),[year,month,day]=end.split('-').map(Number),first=new Date(Date.UTC(year,month-1-(period==='6m'?6:12),1));
   first.setUTCDate(Math.min(day,new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate()));
   const start=period==='all'?'0000-01-01':first.toISOString().slice(0,10);
   const valid=rows.filter(r=>r.measured_at&&String(r.measured_at).slice(0,10)>=start&&String(r.measured_at).slice(0,10)<=end&&r[metric]!=null&&Number.isFinite(Number(r[metric])));
   const select=document.querySelector('#evolution-point'),marks=document.querySelectorAll('[data-evolution-point]');
   if(!valid.length)return marks.length===0&&Boolean(document.querySelector('.ltsEvolutionEmpty'));
   if(!select||select.options.length!==valid.length||marks.length!==valid.length)return false;
   const identity=JSON.parse(decodeURIComponent(select.value.slice(0,select.value.lastIndexOf('~'))));
   const row=valid.find(r=>r.source_record_id===identity[0]),reading=document.querySelector('.ltsEvolutionReading');
   return Boolean(row&&String(row.measured_at).slice(0,10)===identity[1]&&Number(row[metric])===identity[2]&&reading?.querySelector('strong')?.textContent.startsWith(fmtNum(row[metric],1))&&reading.innerText.includes(identity[1].split('-').reverse().join('/'))&&document.querySelector('[data-evolution-body]')?.getAttribute('data-evolution-body')===row.source_record_id&&document.querySelectorAll('.ltsEvolutionChart path, .ltsEvolutionChart polyline').length===0&&document.documentElement.scrollWidth<=innerWidth+1);
  },{rows,metric,period});
  assert.ok(matches,'current body points, selected value and original-record link agree with independent observations');
 };
 for(const period of ['6m','12m','all']){
  await page.locator(`[data-evolution-period="${period}"]`).click();
  for(const metric of ['weight_kg','body_fat_pct','skeletal_muscle_mass_kg','fat_mass_kg']){
   await page.locator(`[data-evolution-overview-metric="${metric}"]`).click();await check(metric,period);
   const options=await page.locator('#evolution-point option').evaluateAll(es=>es.map(e=>e.value));
   if(options.length>1){await page.locator('#evolution-point').selectOption(options.at(-1));await check(metric,period);}
  }
 }
 await page.locator('[data-evolution-overview-metric="weight_kg"]').click();
 await page.locator('[data-evolution-period="12m"]').click();await check('weight_kg','12m');
}

export async function auditIntegratedEvolution(page){
 try{return await inspectIntegratedEvolution(page);}
 catch{
  try{await page.screenshot({path:'v2/real-auth-evidence/evolution-failure.png',fullPage:true});}catch{}
  throw new Error('Current evolution verification failed; private observations withheld. Inspect the encrypted authenticated evidence.');
 }
}


export async function auditObservedNutritionContrast(page){
 const truth=await page.evaluate(async()=>{
  const {sb}=await import('./src/core.js');
  async function all(table,select){const rows=[];for(let from=0;;from+=1000){const {data,error}=await sb.from(table).select(select).order('source_record_id').range(from,from+999);if(error)throw Error('independent contrast read failed');rows.push(...data);if(data.length<1000)return rows;}}
  const [nutrition,workouts]=await Promise.all([all('health_daily_nutrition','source_record_id,nutrition_date,source,protein_g,calories_kcal,carbs_g,fat_g'),all('health_workouts','source_record_id,workout_date,is_canonical,record_status')]);
  return{nutrition,workouts};
 });
 const source=await page.evaluate(({nutrition})=>{
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),norm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const counts=new Map();for(const r of nutrition){if(r.nutrition_date>=today||!norm(r.source))continue;const key=JSON.stringify(['nutrition',norm(r.source),'canonical']);counts.set(key,(counts.get(key)||0)+1);}
  const options=new Set([...document.querySelectorAll('#reportNutritionSource option')].map(e=>e.value));
  return [...counts].filter(([key])=>options.has(key)).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]||null;
 },truth);
 assert.ok(source,'an independently received original nutrition source is reachable in the full-history comparison');
 if(await page.locator('#reportNutritionSource').inputValue()!==source){
  const previous=await page.locator('#reportEvidenceInsights').elementHandle();await page.locator('#reportNutritionSource').selectOption(source);await page.waitForFunction(element=>!element.isConnected,previous);
 }
 const matches=await page.evaluate(async({nutrition,workouts,source})=>{
  const {fmtNum}=await import('./src/core.js'),today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const norm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),identity=JSON.parse(source),days=new Map();
  // Filter the exact source BEFORE checking duplicate dates. Other origins on
  // the same date do not invalidate this source and are never pooled into it.
  for(const row of nutrition){const date=String(row.nutrition_date||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>=today||norm(row.source)!==identity[1])continue;if(!days.has(date))days.set(date,[]);days.get(date).push(row);}
  const training=new Set(workouts.filter(r=>r.is_canonical===true&&norm(r.record_status)!=='quarantined').map(r=>String(r.workout_date||'').slice(0,10)));
  const observations=[...days].filter(([,rows])=>rows.length===1).map(([date,[row]])=>({row,training:training.has(date)}));
  const rows=document.querySelector('#reportEvidenceInsights .ltsInsightTable')?.querySelectorAll('tbody tr'),specifications=[['protein_g','g'],['calories_kcal','kcal'],['carbs_g','g'],['fat_g','g']];
  const clean=x=>String(x).replace(/\s+/g,' ').trim();
  return document.querySelector('#analysisPeriod')?.value==='all'&&document.querySelector('#reportNutritionSource')?.value===source&&rows?.length===4&&specifications.every(([key,unit],index)=>{
   const number=r=>r[key]==null||r[key]===''?null:Number(r[key]),group=flag=>observations.filter(o=>o.training===flag&&number(o.row)!=null&&Number.isFinite(number(o.row))&&number(o.row)>=0).map(o=>number(o.row));
   const a=group(true),b=group(false),avg=xs=>xs.length?xs.reduce((x,y)=>x+y,0)/xs.length:null,am=avg(a),bm=avg(b),cells=rows[index].querySelectorAll('td');
   const expected=(mean,count)=>`${mean==null?'Sem valor':`${fmtNum(mean,0)} ${unit}`}${count} dias com valor`,difference=a.length>=5&&b.length>=5?`${am-bm>0?'+':''}${fmtNum(am-bm,1)} ${unit}`:'Base curta: mínimo 5 dias por grupo';
   return clean(cells[0].textContent)===clean(expected(am,a.length))&&clean(cells[1].textContent)===clean(expected(bm,b.length))&&clean(cells[2].textContent)===clean(difference);
  });
 },{...truth,source});
 assert.ok(matches,'selected-origin nutrition means and denominators agree with independently read closed observations');
}
