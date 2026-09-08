import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

globalThis.location={search:'?fixture=1'};
const{hydrationModel,normalizeWaterMl,validLocalDate}=await import('./src/hydration.js');
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

const equalSources=hydrationModel({nutrition:[{nutrition_date:'2026-09-08',water_ml:2500,source:'MFP ZIP'}],sourceMetrics:[canonical]});
assert.equal(equalSources.rows.length,1);
assert.equal(equalSources.conflicts.length,0);
const conflict=hydrationModel({nutrition:[{nutrition_date:'2026-09-08',water_ml:2000,source:'MFP ZIP'}],sourceMetrics:[canonical]});
assert.equal(conflict.rows.length,0);
assert.deepEqual(conflict.conflicts.map(row=>row.date),['2026-09-08']);

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
assert.match(renderTodayHub(),/Trazer do MFP/);

console.log('LTS Health hydration contract passed');
