import assert from 'node:assert/strict';
import {test} from 'node:test';
import {nutritionPlanComparison} from '../src/nutrition-plan-comparison.js';
import {healthDashboardCalendar,healthDashboardModel} from '../src/health-dashboard-model.js';
import {syntheticNutritionPlanRow,syntheticStatus,syntheticData,syntheticDate as date,foodRow,sourceMetric,testToday as today} from './documented-nutrition-plan-fixture.mjs';
const get=(model,key)=>model.metrics.find(metric=>metric.key===key);
const compare=(data=syntheticData(),ui={},status=syntheticStatus(),asOf=today)=>nutritionPlanComparison(data,status,ui,asOf);
const fill=(days=7)=>{const data=syntheticData();data.nutrition=Array.from({length:days},(_,i)=>foodRow(date(i+1)));return data;};
const fields=['calories_kcal','protein_g','carbs_g','fat_g','fiber_g','water_ml'];
const metricTypes=['dietary_energy_kcal','dietary_protein_g','dietary_carbs_g','dietary_fat_g','dietary_fiber_g'];

test('Plan loading/error/empty/invalid states do not consume stale documentary targets',()=>{
  const data=fill();
  for(const state of ['loading','idle',undefined]){const result=compare(data,{}, {...syntheticStatus(),nutritionPlans:state});assert.equal(result.state,'loading');assert.equal(result.plan,null);assert.deepEqual(result.metrics,[]);}
  assert.equal(compare(data,{}, {...syntheticStatus(),nutritionPlans:'error'}).state,'error');
  data.nutritionPlans=[];assert.equal(compare(data).state,'empty');
  data.nutritionPlans=[{...syntheticNutritionPlanRow(),nutrition_plan:{}}];assert.equal(compare(data).state,'invalid');
});
test('Six targets compare against per-observed-day means and their own coverage',()=>{
  const data=fill(),model=compare(data);
  assert.equal(model.state,'ready');assert.equal(model.metrics.length,6);assert.deepEqual(model.metrics.map(metric=>metric.key),fields);
  for(const metric of model.metrics){assert.equal(metric.days,7);assert.equal(metric.expectedDays,7);assert.equal(metric.points.length,7);assert.equal(metric.partial,false);assert.equal(metric.aggregation,'observed_mean');assert.equal(metric.delta,metric.value-metric.target);assert.ok(Math.abs(metric.percent-100*metric.value/metric.target)<1e-10);}
  assert.equal(get(model,'calories_kcal').value,1800);assert.equal(get(model,'calories_kcal').delta,-200);assert.equal(get(model,'calories_kcal').percent,90);
  assert.equal(get(model,'protein_g').value,100);assert.equal(get(model,'water_ml').value,1500);
  assert.match(model.comparisonLabel,/Comparação com o plano recebido 01\/03\/2024/);assert.equal(model.clinicalStartNote,'Início de uso não informado');
  assert.equal(new Set(model.metrics.slice(0,5).map(metric=>metric.sourceKey)).size,1);
  assert.ok(model.notes.some(note=>/não comprovam|não são zero/.test(note)));
  for(const metric of model.metrics)for(const key of ['adherent','adequate','clinicalTarget','remaining','score'])assert.equal(Object.hasOwn(metric,key),false);
});
test('Every calendar mode, leap boundary, all-history and selected day matches the existing dashboard',()=>{
  const data=fill(80),status=syntheticStatus();data.body=[{measured_at:'2023-02-01'}];
  for(const asOf of ['2024-03-08','2024-08-31','2024-02-29','2025-03-01'])for(const period of ['7','30','60','90','6m','1y','all','bad'])for(const mode of ['period','day']){
    const ui={dashboardMode:mode,dashboardDate:'2024-02-20',dashboardPeriod:period,nutritionPlanRetrospective:true};
    assert.deepEqual(compare(data,ui,status,asOf).calendar,healthDashboardCalendar(data,status,ui,asOf));
  }
  const empty=syntheticData();empty.nutritionPlans=[syntheticNutritionPlanRow('2023-01-01')];const model=compare(empty,{dashboardPeriod:'all'});
  assert.equal(model.calendar.emptyHistory,true);assert.ok(model.metrics.every(metric=>metric.days===0&&metric.value===null));
});
test('Latest document is independent of selected window and retrospectivity requires explicit true',()=>{
  const data=fill(40);data.nutritionPlans=[syntheticNutritionPlanRow('2024-02-01','synthetic-old'),syntheticNutritionPlanRow('2024-03-07','synthetic-latest','b'.repeat(64))];
  for(const optIn of [undefined,false,'true',1]){
    const model=compare(data,{dashboardPeriod:'30',nutritionPlanRetrospective:optIn});assert.equal(model.state,'retrospective_required');assert.equal(model.plan.sourceRecordId,'synthetic-latest');assert.equal(model.isRetrospective,true);assert.ok(model.metrics.every(metric=>metric.value===null&&metric.delta===null&&metric.percent===null&&metric.points.length===0));
  }
  const model=compare(data,{dashboardPeriod:'30',nutritionPlanRetrospective:true});assert.equal(model.state,'ready');assert.equal(model.isRetrospective,true);assert.equal(get(model,'protein_g').value,100);assert.equal(get(model,'protein_g').target,120);
  assert.match(model.comparisonLabel,/Retrospectiva.*não indica adesão passada/);assert.match(model.notes[0],/não combina metas de versões anteriores/);
  assert.equal(compare(data,{dashboardMode:'day',dashboardDate:'2024-03-06'}).state,'retrospective_required');
  assert.equal(compare(data,{dashboardMode:'day',dashboardDate:'2024-03-07'}).state,'ready');
  data.nutritionPlans[1].nutrition_plan.received_on='2024-03-08';assert.equal(compare(data,{dashboardMode:'day',dashboardDate:'2024-03-07'}).state,'retrospective_required','Receipt does not backdate availability');
});
test('Malformed or duplicate newest plan blocks fallback and future versions are excluded',()=>{
  const data=fill();const next=syntheticNutritionPlanRow('2024-03-07','synthetic-new');data.nutritionPlans.push(next);next.nutrition_plan.daily_targets.fat_g.value=null;
  assert.equal(compare(data).state,'invalid');assert.equal(compare(data).plan,null);
  data.nutritionPlans=[syntheticNutritionPlanRow(),syntheticNutritionPlanRow('2024-03-09','synthetic-future')];assert.equal(compare(data).plan.documentDate,'2024-03-01');
  data.nutritionPlans.push(syntheticNutritionPlanRow());assert.equal(compare(data).state,'invalid');
});
test('Zeros are observed; missing, invalid and absent days never become zero or multiply targets',()=>{
  const data=syntheticData();data.nutrition=[foodRow(date(1),Object.fromEntries(fields.map(field=>[field,0]))),foodRow(date(2),{calories_kcal:null,protein_g:'',carbs_g:false,fat_g:-1,fiber_g:NaN,water_ml:Infinity})];
  const model=compare(data);for(const metric of model.metrics){assert.equal(metric.value,0);assert.equal(metric.days,1);assert.equal(metric.expectedDays,7);assert.equal(metric.percent,0);assert.equal(metric.delta,-metric.target);assert.equal(metric.points.find(point=>point.date===date(3)).value,null);}
  data.nutrition=[foodRow(date(1),{protein_g:'0',carbs_g:[],fat_g:{},fiber_g:true})];const unusual=compare(data);assert.equal(get(unusual,'protein_g').value,0);for(const key of ['carbs_g','fat_g','fiber_g'])assert.equal(get(unusual,key).value,null);
});
test('Today remains partial in day view and is excluded from all closed-period averages',()=>{
  const data=fill();data.nutrition.push(foodRow(today,{calories_kcal:99999,protein_g:9999}));
  const period=compare(data),day=compare(data,{dashboardMode:'day'});assert.equal(get(period,'protein_g').value,100);assert.equal(get(day,'protein_g').value,9999);assert.equal(get(day,'protein_g').days,1);assert.equal(get(day,'protein_g').partial,true);assert.equal(get(day,'protein_g').aggregation,'recorded_day');assert.equal(get(day,'protein_g').points[0].date,today);
  const historical=compare(data,{dashboardMode:'day',dashboardDate:date(1)});assert.equal(get(historical,'protein_g').partial,false);assert.equal(get(historical,'protein_g').value,100);
});
test('Every explicit partial marker remains excluded when its date is old',()=>{
  for(const patch of [{partial:true},{knownPartial:true},{known_partial:true},{is_partial:true},{excludeFromClosedMeans:true},{source_payload:{partial:true}},{source_payload:{knownPartial:true}}]){
    const data=fill(2);Object.assign(data.nutrition[0],patch,{protein_g:900});const model=compare(data);
    assert.equal(get(model,'protein_g').value,100);assert.equal(get(model,'protein_g').days,1);assert.equal(get(model,'protein_g').knownPartial,true);assert.equal(get(model,'protein_g').points.find(point=>point.date===date(1)).eligible,false);
    assert.equal(get(compare(data,{dashboardMode:'day',dashboardDate:date(1)}),'protein_g').value,900);
  }
});
test('Energy source wins over a separately selected protein source for all five nutrients',()=>{
  const data=fill(2);data.nutrition.push(foodRow(date(1),{source:'Synthetic second food',calories_kcal:2500,protein_g:200}));
  const dashboard=healthDashboardModel(data,syntheticStatus(),{},today),sources=dashboard.metricsByKey.energy.sources;
  const first=sources.find(source=>source.label==='Synthetic food origin').key,second=sources.find(source=>source.label==='Synthetic second food').key;
  const model=compare(data,{dashboardSources:{energy:first,protein:second}});assert.equal(model.foodSource.key,first);assert.equal(get(model,'protein_g').value,100);assert.ok(model.metrics.slice(0,5).every(metric=>metric.sourceKey===first));
  const chosen=compare(data,{dashboardSources:{energy:first,protein:first},nutritionPlanFoodSource:second});assert.equal(chosen.foodSource.key,second);assert.equal(get(chosen,'protein_g').value,200);
});
test('Automatic coverage is period-aware; explicit food choices and missing selections never silently substitute',()=>{
  const data=fill(40);data.nutrition.push(foodRow(today,{source:'Synthetic new food',protein_g:300}));
  const model=compare(data);assert.equal(model.foodSource.label,'Synthetic food origin');assert.equal(get(model,'protein_g').value,100);
  const key=model.foodSources.find(source=>source.label==='Synthetic new food').key;
  for(const period of ['7','30','60','90','6m','1y','all']){const explicit=compare(data,{dashboardPeriod:period,nutritionPlanRetrospective:true,nutritionPlanFoodSource:key});assert.equal(explicit.foodSource.key,key);assert.equal(get(explicit,'protein_g').value,null,'Today-only explicit origin is not silently replaced by historical food');}
  for(const ui of [{nutritionPlanFoodSource:'missing-origin'},{dashboardSources:{energy:'missing-origin'}},{homeNutritionSource:'missing-origin'}]){
    const missing=compare(data,ui);assert.equal(missing.foodSource,null);assert.ok(missing.metrics.slice(0,5).every(metric=>metric.value===null));assert.match(get(missing,'protein_g').reason,/Nenhum outro diário/);
  }
});
test('Canonical/candidate/held origins, families and mirrored tables stay separate',()=>{
  const data=fill(2);
  for(const canonical_status of ['canonical','candidate','held'])for(const [index,type]of metricTypes.entries())data.sourceMetrics.push(sourceMetric(date(1),type,10*(index+1),{source_name:'Synthetic food origin',canonical_status}));
  const model=compare(data);assert.equal(model.foodSources.length,4);
  for(const source of model.foodSources){const selected=compare(data,{nutritionPlanFoodSource:source.key});assert.equal(selected.foodSource.key,source.key);assert.equal(get(selected,'calories_kcal').value,source.domain==='nutrition'?1800:10);assert.equal(get(selected,'protein_g').value,source.domain==='nutrition'?100:20);}
  assert.equal(compare(data,{nutritionPlanFoodSource:'Synthetic food origin'}).foodSource,null,'Ambiguous labels cannot choose a status/domain');
  const mirrored=compare(data,{nutritionPlanFoodSource:model.foodSources.find(source=>source.domain==='nutrition').key});assert.equal(get(mirrored,'calories_kcal').value,1800,'Mirrored totals are not added');
});
test('Duplicates and carbohydrate aliases are withheld per metric without erasing other nutrients',()=>{
  const data=syntheticData();for(let age=1;age<=2;age++)for(const [index,type]of metricTypes.entries())data.sourceMetrics.push(sourceMetric(date(age),type,10*(index+1)));
  data.sourceMetrics.push(sourceMetric(date(1),'dietary_protein_g',20),sourceMetric(date(1),'dietary_carbohydrates_g',30));
  const model=compare(data);assert.equal(get(model,'protein_g').days,1);assert.equal(get(model,'protein_g').ambiguousDays,1);assert.equal(get(model,'carbs_g').days,1);assert.equal(get(model,'calories_kcal').days,2);assert.equal(get(model,'fat_g').days,2);assert.equal(get(model,'fiber_g').days,2);
  assert.equal(get(model,'protein_g').points.find(point=>point.date===date(1)).value,null);assert.equal(get(compare(data,{dashboardMode:'day',dashboardDate:date(1)}),'protein_g').value,null);
});
test('Missing nutrients are not borrowed from another origin and wrong units are not converted',()=>{
  const data=syntheticData();data.sourceMetrics=[sourceMetric(date(1),'dietary_energy_kcal',1700),sourceMetric(date(1),'dietary_protein_g',90),sourceMetric(date(1),'dietary_fiber_g',40,{source_name:'Synthetic other'}),sourceMetric(date(1),'dietary_fat_g',55,{unit:'kg'}),sourceMetric(date(1),'dietary_carbs_g',100,{unit:'mg'})];
  const model=compare(data);assert.equal(get(model,'calories_kcal').value,1700);assert.equal(get(model,'protein_g').value,90);for(const key of ['fiber_g','fat_g','carbs_g'])assert.equal(get(model,key).value,null);
});
test('Water uses the existing dashboard source independently from the food selection',()=>{
  const data=fill();data.sourceMetrics=[sourceMetric(date(1),'dietary_water_ml',2600),sourceMetric(today,'dietary_water_ml',700)];
  const dashboard=healthDashboardModel(data,syntheticStatus(),{},today),waterKey=dashboard.metricsByKey.water.sources.find(source=>source.domain==='sourceMetrics').key;
  const ui={dashboardSources:{water:waterKey}},model=compare(data,ui),expected=healthDashboardModel(data,syntheticStatus(),ui,today).metricsByKey.water;
  assert.equal(model.waterSource.key,expected.source.key);assert.equal(get(model,'water_ml').value,expected.value);assert.equal(get(model,'water_ml').days,expected.count);assert.equal(get(model,'water_ml').value,2600);assert.equal(get(model,'calories_kcal').value,1800);
  const missing=compare(data,{dashboardSources:{water:'missing-water'}});assert.equal(missing.waterSource,null);assert.equal(get(missing,'water_ml').value,null);assert.equal(get(missing,'protein_g').value,100);
});
test('Energy intake never includes active, total or basal expenditure metrics',()=>{
  const data=fill(1);data.sourceMetrics.push(sourceMetric(date(1),'active_energy_kcal',800),sourceMetric(date(1),'total_energy_kcal',2800),sourceMetric(date(1),'basal_energy_kcal',1800));
  assert.equal(get(compare(data),'calories_kcal').value,1800);assert.equal(get(compare(data),'calories_kcal').target,2000);
});
test('Reviewed exports retain provenance, partial-day exclusions and invalid-review withholding',()=>{
  const data=syntheticData();
  for(let age=1;age<=2;age++)for(const [index,type]of metricTypes.slice(0,4).entries()){
    const row=sourceMetric(date(age),type,age===1?900:10*(index+1),{source_name:'MyFitnessPal via Apple Health',source_family:'myfitnesspal',source_file:'Synthetic reviewed export.xml',source_record_id:`synthetic-reviewed-${age}-${index}`});
    row.nutrition_review={schema:'apple_nutrition_source_review_v1',method:'sum_distinct_meal_samples_v1',status:'verified',source_file:row.source_file,source_sha256:'c'.repeat(64),original_source:'MyFitnessPal',metric_date:row.metric_date,source_record_id:row.source_record_id,metric_type:row.metric_type,unit:row.unit,verified_value:row.value,exported_at:`${date(1)}T12:00:00-03:00`,sample_count:1,duplicate_count:0};data.sourceMetrics.push(row);
  }
  const model=compare(data);assert.equal(get(model,'protein_g').value,20);assert.equal(get(model,'protein_g').days,1);assert.equal(get(model,'protein_g').knownPartial,true);assert.match(get(model,'protein_g').exportedAt,/T12:00:00-03:00/);assert.equal(get(model,'fiber_g').value,null);
  const broken=syntheticData();broken.sourceMetrics=[sourceMetric(date(1),'dietary_energy_kcal',1800,{nutrition_review:{status:'verified'}}),sourceMetric(date(1),'dietary_protein_g',100,{nutrition_review:{status:'verified'}})];
  assert.equal(get(compare(broken),'calories_kcal').value,null);assert.equal(get(compare(broken,{dashboardMode:'day',dashboardDate:date(1)}),'protein_g').value,null);
});
test('Loading or failed consumption origins never expose stale data from those domains',()=>{
  const data=fill();data.sourceMetrics=[sourceMetric(date(1),'dietary_energy_kcal',1400),sourceMetric(date(1),'dietary_protein_g',80)];
  const key=compare(data).foodSources.find(source=>source.domain==='sourceMetrics').key;
  for(const state of ['loading','error','idle']){const model=compare(data,{nutritionPlanFoodSource:key},{...syntheticStatus(),sourceMetrics:state});assert.equal(model.foodSource,null);assert.equal(get(model,'protein_g').value,null);assert.equal(get(model,'water_ml').value,1500);}
  const allFailed=compare(data,{}, {...syntheticStatus(),sourceMetrics:'error',nutrition:'error'});assert.equal(allFailed.state,'ready');assert.ok(allFailed.metrics.every(metric=>metric.value===null));
});
test('Meal detail availability cannot turn old or different-origin totals into item comparisons',()=>{
  const data=fill();data.meals=[{meal_date:'2023-12-01',meal_name:'Synthetic old meal',source:'Synthetic archive'}];let model=compare(data);assert.equal(model.detailAvailability.latestMealDate,'2023-12-01');assert.equal(model.detailAvailability.hasRecentMeals,false);assert.match(model.detailAvailability.note,/01\/12\/2023/);assert.match(model.detailAvailability.note,/Não é possível comparar/);
  data.meals.push({meal_date:date(1),meal_name:'Synthetic current meal',source:'Synthetic food origin'});model=compare(data);assert.equal(model.detailAvailability.hasRecentMeals,true);assert.match(model.detailAvailability.note,/não identificam todos os alimentos/);assert.match(model.detailAvailability.note,/Não é possível comparar cada alimento com o plano/);
  assert.equal(compare(data,{}, {...syntheticStatus(),meals:'error'}).detailAvailability.latestMealDate,null);
  data.sourceMetrics=[sourceMetric(date(1),'dietary_energy_kcal',1700,{source_name:'Synthetic food origin'})];
  const mirror=compare(data).foodSources.find(source=>source.domain==='sourceMetrics');assert.equal(compare(data,{nutritionPlanFoodSource:mirror.key}).detailAvailability.hasRecentMeals,false,'Matching labels do not prove a join to another source domain');
});
test('Record update timestamps are distinct from export time and scoped to chosen origin/window',()=>{
  const data=fill(2);data.nutrition[0].updated_at='2024-03-08T11:00:00Z';data.nutrition[1].updated_at='2024-03-08T09:00:00-03:00';
  data.nutrition.push(foodRow(date(20),{updated_at:'2024-03-08T20:00:00Z'}),foodRow(date(1),{source:'Synthetic other origin',updated_at:'2024-03-08T21:00:00Z'}));
  const selected=JSON.stringify(['nutrition','synthetic food origin','canonical']),water=JSON.stringify(['nutrition','synthetic food origin','canonical','ml']);const ui={nutritionPlanFoodSource:selected,dashboardSources:{water}};
  const model=compare(data,ui);assert.equal(get(model,'protein_g').updatedAt,'2024-03-08T09:00:00-03:00');assert.equal(get(model,'water_ml').updatedAt,'2024-03-08T09:00:00-03:00');assert.equal(model.lastUpdatedAt,'2024-03-08T09:00:00-03:00');assert.equal(get(model,'protein_g').exportedAt,null);
  const dayModel=compare(data,{...ui,dashboardMode:'day',dashboardDate:date(1)});assert.equal(get(dayModel,'protein_g').updatedAt,'2024-03-08T11:00:00Z');
  for(const invalid of ['invalid','2024-02-30T10:00:00Z','2024-03-08T10:00:00',0,null]){data.nutrition[0].updated_at=invalid;assert.equal(get(compare(data,{...ui,dashboardMode:'day',dashboardDate:date(1)}),'protein_g').updatedAt,null);}
});
test('Source-metric timestamps are read independently from review exports and created_at is ignored',()=>{
  const data=syntheticData();data.sourceMetrics=[sourceMetric(date(1),'dietary_energy_kcal',1500,{updated_at:'2024-03-08T10:00:00Z'}),sourceMetric(date(1),'dietary_protein_g',90,{updated_at:'2024-03-08T11:00:00Z'}),sourceMetric(date(1),'dietary_water_ml',2000,{updated_at:'2024-03-08T12:00:00Z'})];
  const model=compare(data);assert.equal(model.lastUpdatedAt,'2024-03-08T12:00:00Z');assert.equal(get(model,'protein_g').updatedAt,'2024-03-08T11:00:00Z');assert.equal(get(model,'water_ml').updatedAt,'2024-03-08T12:00:00Z');assert.equal(get(model,'protein_g').exportedAt,null);
  const created=fill(1);created.nutrition[0].created_at='2024-03-08T15:00:00Z';assert.equal(compare(created).lastUpdatedAt,null);
});
test('An overall update timestamp requires complete provenance for all received food and water observations',()=>{
  const data=fill(2);data.sourceMetrics=[sourceMetric(date(1),'dietary_water_ml',2000,{updated_at:'2024-03-08T12:00:00Z'})];
  const waterKey=JSON.stringify(['sourceMetrics','synthetic','synthetic metric origin','candidate','ml']),ui={dashboardSources:{water:waterKey}};
  const model=compare(data,ui);
  assert.equal(model.lastUpdatedAt,null,'Water timestamp cannot imply that untimestamped food is current');
  assert.equal(get(model,'protein_g').updatedAt,null);assert.equal(get(model,'protein_g').updateTimeComplete,false);
  assert.equal(get(model,'water_ml').updatedAt,'2024-03-08T12:00:00Z');assert.equal(get(model,'water_ml').updateTimeComplete,true);
  data.nutrition[0].updated_at='2024-03-08T13:00:00Z';
  const partial=compare(data,ui);assert.equal(partial.lastUpdatedAt,null,'A timestamp on only one observed day is not complete provenance');assert.equal(get(partial,'protein_g').updatedAt,'2024-03-08T13:00:00Z');
  data.nutrition[1].updated_at='2024-03-08T14:00:00Z';
  assert.equal(compare(data,ui).lastUpdatedAt,'2024-03-08T14:00:00Z');
  data.sourceMetrics.push(sourceMetric(date(2),'dietary_water_ml',1800));
  const partialWater=compare(data,ui);assert.equal(partialWater.lastUpdatedAt,null);assert.equal(get(partialWater,'water_ml').updatedAt,'2024-03-08T12:00:00Z');assert.equal(get(partialWater,'water_ml').updateTimeComplete,false);
  data.sourceMetrics[1].updated_at='2024-03-08T15:00:00Z';
  assert.equal(compare(data,ui).lastUpdatedAt,'2024-03-08T15:00:00Z');
  data.nutrition.push(foodRow(date(1)));assert.equal(compare(data,ui).lastUpdatedAt,null,'An untimestamped duplicate is still received evidence');
  assert.equal(compare(syntheticData()).lastUpdatedAt,null,'No observations cannot manufacture an update');
});
test('Inputs remain untouched and source strings remain inert data',()=>{
  const data=fill();data.nutrition[0].source='<img src=x onerror=alert(1)>';data.nutritionPlans[0].nutrition_plan.author.name='<script>Synthetic name</script>';
  const before=structuredClone(data),status=syntheticStatus(),ui={nutritionPlanRetrospective:true};const previousUI=structuredClone(ui);
  const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};freeze(data);freeze(status);freeze(ui);
  const model=compare(data,ui,status);assert.match(model.plan.author.name,/<script>/);assert.deepEqual(data,before);assert.deepEqual(ui,previousUI);
});
