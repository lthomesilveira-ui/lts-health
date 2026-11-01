import assert from 'node:assert/strict';
import {nutritionArchiveModel,nutritionArchiveSelection,nutritionTimelineSelection} from '../src/nutrition-archive.js';
import {makeNutritionHistoryFixture,HISTORY_SOURCE,CURRENT_SOURCE,HISTORY_TODAY,FIRST_HISTORY_DAY,LAST_HISTORY_DAY,MISSING_HISTORY_DAY,historySourceKey,mirrorSourceKey,FOOD_KEYS} from './nutrition-history-access-fixture.mjs';

const f=makeNutritionHistoryFixture(),before=structuredClone(f.data),historyKey=historySourceKey(HISTORY_SOURCE),currentKey=historySourceKey(CURRENT_SOURCE);
const model=(ui={},status=f.status)=>nutritionArchiveModel(f.data,status,ui,HISTORY_TODAY);
assert.equal(f.historicalDays,2503);assert.ok(f.historicalMeals>5107);
assert.equal(new Set(f.dates).size,2503);
assert.deepEqual([...new Set(f.dates.map(date=>date.slice(0,4)))],Array.from({length:9},(_,index)=>String(2018+index)).filter(year=>year!=='2022')); 
assert.equal(model().source.key,currentKey,'newer origin is the initial summary default');
const chosen={homeNutritionSource:historyKey};
let archive=model(chosen);
assert.equal(archive.source.key,historyKey);assert.equal(archive.firstDate,FIRST_HISTORY_DAY);assert.equal(archive.lastDate,LAST_HISTORY_DAY);
assert.equal(archive.source.dailyRecords.length,2504,'the duplicate is preserved without making a new day');
assert.equal(archive.source.meals.length,5108,'all historical meal pages reach the archive');
assert.equal(archive.source.dates.length,2504,'a meal-only day is reachable without inventing a daily total');
assert.equal(archive.years.length,8);assert.ok(archive.dates.length<=31);
// Exhaustively visit each hierarchy slice rather than merely count years.
const reachable=new Set();
for(const year of archive.years){
  const yearSelection=nutritionArchiveSelection(archive,'year',year),yearUi={...chosen,...yearSelection},yearModel=model(yearUi);
  for(const month of yearModel.months){
    const monthModel=model({...yearUi,...nutritionArchiveSelection(yearModel,'month',month)});
    assert.ok(monthModel.dates.length>0&&monthModel.dates.length<=31,month);
    for(const date of monthModel.dates)reachable.add(date);
    for(const date of [monthModel.dates[0],monthModel.dates.at(-1)]){
      const selected=model({...yearUi,...nutritionArchiveSelection(monthModel,'date',date)});
      assert.equal(selected.date,date);assert.equal(selected.source.key,historyKey);
      assert.ok(selected.hasDate);assert.ok(selected.meals.every(row=>row.meal_date===date&&row.source===HISTORY_SOURCE));
    }
  }
}
assert.equal(reachable.size,2504,'every old day and the meal-only day can be selected through the hierarchy');
for(const period of ['30','90','365','all']){
  const old=model({...chosen,nutritionPeriod:period,nutritionDate:FIRST_HISTORY_DAY});
  assert.equal(old.date,FIRST_HISTORY_DAY);assert.equal(old.food.calories_kcal,1800);assert.equal(old.food.fiber_g,0);
  assert.deepEqual(old.meals.map(row=>row.source_record_id),['synthetic-history-meal-0-0','synthetic-history-meal-0-1','synthetic-history-meal-0-2']);
  assert.equal(old.food.calories_kcal,1800,'daily total is neither the 1,050 meal sum nor the mirror total');
}
for(const missing of [MISSING_HISTORY_DAY,HISTORY_TODAY]){
  const m=model({...chosen,nutritionDate:missing});assert.equal(m.date,missing);assert.equal(m.hasDate,false);assert.equal(m.food,null);assert.deepEqual(m.meals,[]);
  assert.equal(m.source.key,historyKey,'explicit missing day cannot silently switch to a newer origin');
}
const mealOnly=model({...chosen,nutritionDate:f.mealOnlyDay});assert.equal(mealOnly.food,null);assert.equal(mealOnly.dailyRecords.length,0);assert.equal(mealOnly.meals.length,1);assert.equal(mealOnly.meals[0].calories_kcal,432);
const duplicate=model({...chosen,nutritionDate:f.ambiguousDay});assert.equal(duplicate.food,null);assert.equal(duplicate.dailyRecords.length,2);assert.equal(duplicate.duplicates.length,FOOD_KEYS.length);assert.equal(duplicate.meals.length,3);
for(const [state,value] of [['canonical',9001],['candidate',9101],['held',9201]]){
  const mirror=model({homeNutritionSource:mirrorSourceKey(state),nutritionDate:FIRST_HISTORY_DAY});
  assert.equal(mirror.source.domain,'sourceMetrics');assert.equal(mirror.source.status,state);assert.equal(mirror.food.calories_kcal,value);assert.deepEqual(mirror.meals,[],'same-labelled mirrors cannot inherit canonical daily meals');
}
const unknown=model({homeNutritionSource:'["nutrition","missing synthetic source","canonical"]',nutritionDate:FIRST_HISTORY_DAY});
assert.equal(unknown.requestedSourceMissing,true);assert.equal(unknown.source,null);assert.equal(unknown.date,FIRST_HISTORY_DAY);assert.equal(unknown.food,null);assert.deepEqual(unknown.meals,[]);
const timeline=nutritionTimelineSelection(f.data,f.status,historyKey,FIRST_HISTORY_DAY,'synthetic-history-day-0');assert.equal(timeline.homeNutritionSource,historyKey);assert.equal(timeline.nutritionDate,FIRST_HISTORY_DAY);assert.equal(model(timeline).food.calories_kcal,1800);
assert.equal(nutritionTimelineSelection(f.data,f.status,currentKey,FIRST_HISTORY_DAY,'synthetic-history-day-0'),null,'same display alias cannot authorize another source');
assert.equal(nutritionTimelineSelection(f.data,f.status,historyKey,FIRST_HISTORY_DAY,'missing synthetic ID'),null);
assert.equal(nutritionTimelineSelection(f.data,f.status,historyKey,HISTORY_TODAY,'synthetic-history-day-0'),null);
assert.equal(nutritionTimelineSelection(f.data,f.status,'MyFitnessPal',FIRST_HISTORY_DAY,''),null,'display alias is never a verified Timeline key');
assert.equal(nutritionTimelineSelection(f.data,{...f.status,nutrition:'error'},historyKey,FIRST_HISTORY_DAY,'synthetic-history-day-0'),null);
for(const status of ['loading','error']){
  const failed=model({...chosen,nutritionDate:FIRST_HISTORY_DAY},{...f.status,nutrition:status,meals:status,sourceMetrics:status});
  assert.equal(failed.source,null);assert.equal(failed.food,null);assert.deepEqual(failed.meals,[]);assert.equal(failed.date,FIRST_HISTORY_DAY);
  assert.deepEqual(failed.unavailable,['nutrition','sourceMetrics','meals']);
}
assert.equal(nutritionArchiveSelection(archive,'date','2018-02-31'),null);
assert.equal(nutritionArchiveSelection(archive,'date','2099-01-01'),null);
assert.equal(nutritionArchiveSelection(archive,'source','MyFitnessPal'),null);
assert.deepEqual(f.data,before,'archive does not mutate or rewrite the source records');
console.log('Historical access: 2,503 synthetic daily dates + meal-only date, 5,108 meals, all year/month/day slices, exact source joins, mirrors, missing days, duplicates and verified Timeline targets passed.');
