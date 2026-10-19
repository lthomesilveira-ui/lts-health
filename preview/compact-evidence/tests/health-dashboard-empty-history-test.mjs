import assert from 'node:assert/strict';
import {healthDashboardModel,healthDashboardCalendar} from '../src/health-dashboard-model.js';
import {dashboardContext} from '../src/health-dashboard-context.js';
globalThis.location={search:'?fixture=1'};
const {renderHealthDashboard}=await import('../src/health-dashboard.js');
const today='2024-03-01',yesterday='2024-02-29';
const domains=['nutrition','sourceMetrics','metrics','body','segmental','workouts','workoutEvidence','exercises','sets','labs','treatments','regimens','docs','goals','waterReferences','polarSessions','meals','uploads'];
const status=Object.fromEntries(domains.map(key=>[key,'ready']));
const empty=()=>Object.fromEntries(domains.map(key=>[key,[]]));
const future=empty();
future.nutrition=[{nutrition_date:'2024-03-02',source:'Synthetic future food',water_ml:2000,protein_g:120}];
future.body=[{measured_at:'2024-03-02',weight_kg:80,source:'Synthetic future body'}];
future.sourceMetrics=[{metric_date:'2024-03-02',metric_type:'steps',value:8000,unit:'count',source_name:'Synthetic future watch',canonical_status:'candidate'}];
for(const data of [empty(),future])for(const state of [status,Object.fromEntries(domains.map(key=>[key,'error']))]){
  const before=structuredClone(data),model=healthDashboardModel(data,state,{dashboardPeriod:'all'},today);
  assert.equal(model.emptyHistory,true);assert.equal(model.bounds.emptyHistory,true);
  assert.equal(model.bounds.start,yesterday);assert.equal(model.bounds.end,yesterday);
  assert.equal(model.bounds.days,1);assert.equal(model.previousBounds,null);
  assert.equal(model.label,'Sem histórico encerrado');assert.match(model.note,/não representa um dia observado/);
  assert.ok(model.metrics.every(metric=>metric.value===null&&metric.count===0));
  assert.ok(model.metrics.every(metric=>metric.points.every(point=>point.value===null&&!point.eligible)));
  assert.ok(model.metrics.every(metric=>!metric.comparison.comparable));
  const context=dashboardContext(data,state,{bounds:model.bounds,today,mode:model.mode});
  assert.equal(context.valid,true);assert.notEqual(context.reason,'invalid_calendar');
  const html=renderHealthDashboard(data,state,{dashboardPeriod:'all'},today);
  assert.match(html,/<p class="healthWindow">Sem histórico encerrado · dias encerrados/);
  assert.doesNotMatch(html,/01\/03\/2024 a 29\/02\/2024/);
  assert.doesNotMatch(html,/\b(?:NaN|undefined|Infinity|invalid_calendar)\b/);
  assert.equal((html.match(/data-dashboard-card=/g)||[]).length,7);
  assert.ok([...html.matchAll(/<div class="healthMetricValue"><strong>(.*?)<\/strong>/g)].every(match=>match[1]==='—'));
  assert.deepEqual(data,before);
}
// Today-only data is still separate and partial, not a fabricated closed day.
const todayOnly=empty();todayOnly.nutrition=[{nutrition_date:today,source:'Synthetic today food',water_ml:1500}];
const only=healthDashboardModel(todayOnly,status,{dashboardPeriod:'all'},today);
assert.equal(only.emptyHistory,true);assert.equal(only.metricsByKey.water.value,null);
assert.equal(only.metricsByKey.water.todayValue,1500);
assert.equal(only.todayMetrics.find(metric=>metric.key==='water').value,1500);
assert.equal(only.todayMetrics.find(metric=>metric.key==='water').partial,true);

// The default local date is São Paulo, independently of the executor timezone.
const RealDate=globalThis.Date;
try{
  globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2024-03-01T01:30:00Z']));}static now(){return RealDate.parse('2024-03-01T01:30:00Z');}};
  const local=healthDashboardCalendar({},status,{dashboardPeriod:'all'});
  assert.equal(local.today,'2024-02-29');assert.equal(local.bounds.start,'2024-02-28');assert.equal(local.bounds.end,'2024-02-28');
  const explicit=healthDashboardCalendar({},status,{dashboardPeriod:'all'},'2024-03-01');
  assert.equal(explicit.today,'2024-03-01');assert.equal(explicit.bounds.start,'2024-02-29');
}finally{globalThis.Date=RealDate;}
console.log('Empty history integration: valid placeholder bounds, future/today-only data, no invented observations, context, renderer and São Paulo timezone passed.');
