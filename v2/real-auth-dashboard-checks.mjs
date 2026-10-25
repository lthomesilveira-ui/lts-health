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
   return {matched,overflow:document.documentElement.scrollWidth>innerWidth+1,missingWater:d.metricsByKey.water.value==null,ambiguousWater:Boolean(d.metricsByKey.water.ambiguousDays),latestWater:d.metricsByKey.water.latestRecorded?.date||null};
  });
  assert.equal(reading.matched,true,'actual seven-card readings match the loaded source-specific calendar');
  assert.equal(reading.overflow,false,'actual dashboard fits viewport');
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
