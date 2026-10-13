import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {homeCockpitModel,renderHomeCockpit}=await import('./src/home-cockpit.js');
const {consultationLines}=await import('./src/integrated-review.js');
const today='2026-10-13',day=age=>new Date(Date.parse(`${today}T12:00:00Z`)-age*86400000).toISOString().slice(0,10);
const status=Object.fromEntries(['body','segmental','nutrition','sourceMetrics','metrics','workouts','exercises','sets','labs','treatments','polarSessions','goals','meals'].map(key=>[key,'ready']));
const data={nutrition:[],sourceMetrics:[],metrics:[],body:[],workouts:[],exercises:[],sets:[],labs:[],goals:[],treatments:[]};
for(let age=0;age<800;age++){
  const protein=age<30?100:age<90?200:age<365?300:400;
  data.nutrition.push({nutrition_date:day(age),source:'Synthetic diary',protein_g:age?protein:9999,calories_kcal:protein*20});
  data.sourceMetrics.push({metric_date:day(age),metric_type:'sleep_duration_h',value:age<30?8:age<90?6:5,unit:'h',source_family:'synthetic',source_name:'Synthetic watch',canonical_status:'candidate'});
}
const snapshot=structuredClone(data),get=(period,d=data,ui={})=>homeCockpitModel(d,status,period,ui,today);
const a=get('30'),b=get('90'),c=get('365'),all=get('all');
assert.equal(a.evo.recent.nutrition.protein_g.current,100);assert.equal(b.evo.recent.nutrition.protein_g.current,(29*100+60*200)/89);assert.equal(c.evo.recent.nutrition.protein_g.current,(29*100+60*200+275*300)/364);
assert.equal(a.evo.recent.nutrition.protein_g.previous,200);assert.equal(b.evo.recent.nutrition.protein_g.previous,300);assert.equal(c.evo.recent.nutrition.protein_g.previous,400);
for(const [model,n]of [[a,30],[b,90],[c,365]]){
  for(const comparison of [model.evo.recent.nutrition.protein_g,model.evo.recent.sleep]){
    assert.equal(comparison.currentBounds.days,n);assert.equal(comparison.previousBounds.days,n);
    assert.equal(comparison.currentBounds.start,day(n-1));assert.equal(comparison.previousBounds.start,day(2*n-1));assert.equal(comparison.previousBounds.end,day(n));
    assert.equal(comparison.currentDays,n-1);assert.equal(comparison.previousDays,n);assert.equal(comparison.comparable,true);
  }
  assert.equal(model.evo.foodChange('protein_g').delta,model.evo.recent.nutrition.protein_g.delta);
  assert.equal(model.evo.sleepChange.delta,model.evo.recent.sleep.delta);
  const html=renderHomeCockpit(model),summary=consultationLines(model.r,model.m,model.evo).join('\n');
  assert.doesNotMatch(html,/duas semanas|semanas consecutivas|mesmas semanas|Semanas, fontes/);
  assert.doesNotMatch(summary,/duas semanas|entre as semanas/);
  assert.match(html,/períodos de mesma duração/);
  assert.match(summary,new RegExp(`${n-1} dias com valor`));
}
assert.equal(all.evo.recent.nutrition.protein_g.comparable,false);assert.equal(all.evo.recent.sleep.delta,null);assert.equal(all.evo.periodModel.previous,null);
assert.deepEqual(data,snapshot);

const changed=structuredClone(data);
changed.nutrition.forEach(row=>{if(row.nutrition_date>=day(89)&&row.nutrition_date<=day(30))row.protein_g=500;});
assert.equal(get('30',changed).evo.recent.nutrition.protein_g.current,a.evo.recent.nutrition.protein_g.current);
assert.notEqual(get('90',changed).evo.recent.nutrition.protein_g.current,b.evo.recent.nutrition.protein_g.current);
assert.notEqual(get('365',changed).evo.recent.nutrition.protein_g.current,c.evo.recent.nutrition.protein_g.current);
assert.notEqual(get('90',changed).evo.domainReadings.nutrition.meaning,b.evo.domainReadings.nutrition.meaning);

// Existing source selection is authoritative. Another origin must never provide
// the missing predecessor, even if it has a much larger history.
const switched=structuredClone(data);
for(const row of switched.nutrition)if(row.nutrition_date>=day(29))row.source='Synthetic new diary';
const different=get('30',switched);
assert.equal(different.r.nutrition.source.label,'Synthetic new diary');assert.equal(different.evo.recent.nutrition.protein_g.sourceLabel,'Synthetic new diary');
assert.equal(different.evo.recent.nutrition.protein_g.comparable,false);assert.equal(different.evo.recent.nutrition.protein_g.previous,null);assert.equal(different.evo.foodChange('protein_g'),null);
const chosen=get('90',switched,{reportNutritionSource:'synthetic diary'});assert.equal(chosen.evo.recent.nutrition.protein_g.sourceLabel,'Synthetic diary');assert.equal(chosen.evo.recent.nutrition.protein_g.current,200);assert.equal(chosen.evo.recent.nutrition.protein_g.currentDays,60);assert.equal(chosen.evo.recent.nutrition.protein_g.comparable,false,'60/89 days misses the documented display threshold');
const failed=homeCockpitModel(data,{...status,sourceMetrics:'error'},'30',{},today);assert.equal(failed.evo.recent.nutrition.protein_g.reason,'partial_sources');assert.equal(failed.evo.recent.nutrition.protein_g.delta,null);

const oldBody={...data,body:[{measured_at:day(40),source:'Synthetic scan',device_name:'Synthetic model',weight_kg:80}]};
assert.equal(get('30',oldBody).evo.body,null,'a measurement outside the window cannot become the current body evidence');
assert.equal(get('30',oldBody).evo.bodyPrevious,null);assert.equal(get('90',oldBody).evo.body.measured_at,day(40));
console.log('Legacy evolution/consultation: full 30/90/365 windows and equal predecessors, no global 7+7 fallback, historical mode, selected source identity, source failures, per-variable coverage, old-body exclusion and unchanged input passed.');
