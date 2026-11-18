import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

globalThis.location={search:'?fixture=1'};
const{hydrationModel,historicalMyFitnessPalWaterStatus,normalizeWaterMl,validLocalDate}=await import('./src/hydration.js');
const{state,fixtureData}=await import('./src/core.js');
const{saveMyFitnessPalWater}=await import('./src/writes.js');
const{renderNutritionHub}=await import('./src/nutrition-screen.js');
const{renderTodayHub}=await import('./src/today-screen.js');

assert.equal(normalizeWaterMl('2500'),2500);
assert.equal(normalizeWaterMl('2.500'),2500);
assert.equal(normalizeWaterMl('2.500,4'),2500);
assert.equal(normalizeWaterMl('2500.6'),2501);
assert.equal(validLocalDate('2024-02-29'),true);
assert.equal(validLocalDate('2025-02-29'),false);
assert.throws(()=>normalizeWaterMl(''),/water_required/);
assert.throws(()=>normalizeWaterMl('0'),/water_must_be_positive/);
assert.throws(()=>normalizeWaterMl('100001'),/water_value_too_large/);

const canonical={metric_date:'2026-09-08',metric_type:'dietary_water_ml',value:2500,unit:'mL',source_name:'MyFitnessPal',source_family:'myfitnesspal',canonical_status:'canonical'};
assert.deepEqual(hydrationModel({sourceMetrics:[canonical]}).rows.map(row=>[row.date,row.value]),[['2026-09-08',2500]]);
assert.equal(hydrationModel({sourceMetrics:[{...canonical,canonical_status:'candidate'}]}).rows.length,0);
assert.equal(hydrationModel({sourceMetrics:[{...canonical,unit:'L'}]}).rows.length,0);

// Synthetic original Takeout rows keep their source and do not complete the
// independent request for a complete authenticated MyFitnessPal history.
const takeout={...canonical,value:1234,source_family:'google_health_takeout',source_name:'MyFitnessPal · Google Health',confidence:'authenticated_google_takeout',source_record_id:'google_health_takeout:water:'+'a'.repeat(64)};
assert.equal(hydrationModel({sourceMetrics:[takeout]}).rows[0].value,1234);
assert.equal(historicalMyFitnessPalWaterStatus({sourceMetrics:[takeout]},{sourceMetrics:'ready'}),'pending');
for(const changed of [{canonical_status:'held'},{value:0},{unit:'VOLUME_UNIT_UNSPECIFIED'},{confidence:'user_confirmed'},{source_record_id:'google_health_takeout:water:unverified'}]){
  assert.equal(hydrationModel({sourceMetrics:[{...takeout,...changed}]}).rows.length,0);
}
assert.equal(hydrationModel({sourceMetrics:[takeout,{...takeout}]}).rows[0].value,1234,'equal mirrors are not added');
assert.equal(hydrationModel({sourceMetrics:[takeout,{...canonical,value:2500}]}).rows.length,0,'different source totals remain conflicts');
assert.equal(hydrationModel({sourceMetrics:[takeout,{...canonical,value:2500}]}).conflicts.length,1);

const {waterSourceReview} = await import('./src/water-source-review.js');
const {homePeriodModel} = await import('./src/home-period-model.js');
const {healthDashboardModel} = await import('./src/health-dashboard-model.js');
const {renderProductNutrition} = await import('./src/nutrition-product.js');
const dated = {metric_date:'2030-02-11', unit:'mL', value:1234};
const original = {...takeout, ...dated, canonical_status:'held', metric_type:'dietary_water_source_total_ml',
  source_record_id:'google_health_takeout:water-source:'+'a'.repeat(64)};
const phone = {...dated, metric_type:'dietary_water_ml', canonical_status:'canonical', source_family:'health_auto_export',
  confidence:'authenticated_auto_export', source_name:'Ponte sintética', source_record_id:'health_auto_export:synthetic-day'};
const event = {...original, value:130, metric_type:'dietary_water_source_event_ml', source_name:'Google Health App',
  source_record_id:'google_health_takeout:water-event:'+'b'.repeat(64)};
const altered = {...phone, value:1364};
const evidence = {sourceMetrics:[original,event,altered]};
const statuses = {nutrition:'ready',sourceMetrics:'ready'};
assert.deepEqual(waterSourceReview(evidence.sourceMetrics), [{date:dated.metric_date,mfp:[1234],iphone:[1364],events:[130],conflict:true}]);
assert.equal(waterSourceReview([original,{...takeout,...dated},phone,original])[0].conflict,false);
assert.equal(waterSourceReview([original,{...takeout,...dated},phone,original])[0].mfp.length,1);
assert.deepEqual(hydrationModel({sourceMetrics:[original,event]}),{rows:[],conflicts:[]});
assert.deepEqual(hydrationModel(evidence).conflicts.map(row=>row.date),[dated.metric_date]);
assert.equal(hydrationModel({sourceMetrics:[original,phone,event]}).rows[0].value,1234);
assert.equal(homePeriodModel(evidence,statuses,'30',{},'2030-02-15').water.closedRows.length,0);
const dashboardWater=healthDashboardModel(evidence,statuses,{dashboardMode:'period',dashboardPeriod:'30'},'2030-02-15').metrics.find(row=>row.key==='water');
assert.equal(dashboardWater.count,0);
assert.equal(waterSourceReview([original, {...phone, confidence:'unverified'}])[0].iphone.length,0);
for(const bad of [{unit:'L'}, {value:0}, {value:true}, {metric_date:'2030-02-31'}, {source_record_id:'unverified'},
  {canonical_status:'candidate'}, {confidence:'unverified'}, {source_name:'Unidentified publisher'}]){
  assert.equal(waterSourceReview([{...original,...bad}]).length,0);
}
state.data={...fixtureData(), ...evidence};state.domainStatus=statuses;
const sourceScreen=renderProductNutrition();
for(const label of ['Histórico de água por origem','11/02/2030','1.234','1.364','130 mL','Totais diferentes'])assert.ok(sourceScreen.includes(label),label);

const equalSources=hydrationModel({nutrition:[{nutrition_date:'2026-09-08',water_ml:2500,source:'MFP ZIP'}],sourceMetrics:[canonical]});
assert.equal(equalSources.rows.length,1);
assert.equal(equalSources.conflicts.length,0);
const conflict=hydrationModel({nutrition:[{nutrition_date:'2026-09-08',water_ml:2000,source:'MFP ZIP'}],sourceMetrics:[canonical]});
assert.equal(conflict.rows.length,0);
assert.deepEqual(conflict.conflicts.map(row=>row.date),['2026-09-08']);
assert.equal(historicalMyFitnessPalWaterStatus({sourceMetrics:[]},{sourceMetrics:'ready'}),'pending');
assert.equal(historicalMyFitnessPalWaterStatus({sourceMetrics:[canonical]},{sourceMetrics:'ready'}),'pending');
assert.equal(historicalMyFitnessPalWaterStatus({sourceMetrics:[{...canonical,confidence:'account_authenticated_export'}]},{sourceMetrics:'ready'}),'imported');
assert.equal(historicalMyFitnessPalWaterStatus({sourceMetrics:[]},{sourceMetrics:'error'}),'unknown');

const migration=await fs.readFile(new URL('../supabase/migrations/20260908100000_allow_user_confirmed_mfp_water.sql',import.meta.url),'utf8');
for(const contract of ["source_family = 'myfitnesspal'","metric_type = 'dietary_water_ml'","confidence = 'user_confirmed'","source_payload ->> 'entry_method' = 'mfp_water_total_v1'"]){
  assert.ok(migration.includes(contract),`migration is missing ${contract}`);
}

state.data={...fixtureData(),sourceMetrics:[]};
state.domainStatus={nutrition:'ready',meals:'ready',sourceMetrics:'ready',body:'ready',workouts:'ready',workoutEvidence:'ready',exercises:'ready',sets:'ready',metrics:'ready',labs:'ready',treatments:'ready',regimens:'ready'};
await saveMyFitnessPalWater({metric_date:'2026-02-02',water_ml:'2.500',confirmed:true});
await saveMyFitnessPalWater({metric_date:'2026-02-02',water_ml:'2600',confirmed:true});
const saved=state.data.sourceMetrics.filter(row=>row.source_record_id==='mfp-water:2026-02-02');
assert.equal(saved.length,1);
assert.equal(saved[0].value,2600);
assert.match(renderNutritionHub(),/2\.600 mL/);
assert.match(renderNutritionHub(),/Importar histórico do MFP/);
assert.match(renderNutritionHub(),/Registrar um dia manualmente/);
assert.match(renderTodayHub(),/2\.600 mL/);
assert.match(renderTodayHub(),/data-entry="water-import"/);
assert.match(renderTodayHub(),/Atualizar água do MFP/);

console.log('LTS Health hydration contract passed');
