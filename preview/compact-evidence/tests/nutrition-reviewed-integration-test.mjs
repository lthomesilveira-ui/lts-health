import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {homePeriodModel}=await import('../src/home-period-model.js');
const {bodyIntervalModel}=await import('../src/body-interval-model.js');
const {usefulReports}=await import('../src/reports-model.js');
const status=Object.fromEntries(['body','segmental','workouts','exercises','sets','nutrition','sourceMetrics','metrics','labs','treatments','goals','waterReferences','polarSessions'].map(k=>[k,'ready']));
const metric=(date,value,type='dietary_protein_g')=>{const unit=type==='dietary_energy_kcal'?'kcal':'g',id=`synthetic:${date}:${type}`;return{source_record_id:id,metric_date:date,metric_type:type,value,unit,source_family:'myfitnesspal',source_name:'MyFitnessPal via Apple Health',source_file:'synthetic.zip',canonical_status:'candidate',nutrition_review:{schema:'apple_nutrition_source_review_v1',method:'sum_distinct_meal_samples_v1',status:'verified',source_record_id:id,metric_date:date,metric_type:type,unit,verified_value:value,source_file:'synthetic.zip',source_sha256:'a'.repeat(64),original_source:'MyFitnessPal',exported_at:'2026-06-03T15:00:00-03:00',sample_count:1,duplicate_count:0}};};
const sourceMetrics=['2026-06-01','2026-06-02','2026-06-03'].flatMap((d,i)=>[metric(d,[100,200,30][i]),metric(d,[1000,2000,300][i],'dietary_energy_kcal')]);
const data={sourceMetrics,body:['2026-05-31','2026-06-03'].map(d=>({source_record_id:`body:${d}`,measured_at:d,weight_kg:80,fat_mass_kg:20,skeletal_muscle_mass_kg:30,source:'Synthetic'})),nutrition:[],workouts:[],exercises:[],sets:[],metrics:[],labs:[],segmental:[],goals:[]};
const before=JSON.stringify(data);
for(const period of ['30','90','365','all']){
 const home=homePeriodModel(data,status,period,{},'2026-06-05');const n=home.nutrition;
 assert.equal(n.means.protein_g,150);assert.equal(n.means.calories_kcal,1500);assert.equal(n.counts.protein_g,2);assert.equal(n.rows.length,3);assert.equal(n.source.reviewVerified,true);assert.equal(n.source.status,'candidate');assert.equal(n.source.knownPartialRows[0].date,'2026-06-03');assert.equal(n.coverage.closedDays,2);
 const report=usefulReports(data,status,{analysisPeriod:period,reportNutritionSource:n.source.key},'2026-06-05');assert.equal(report.period,period);assert.equal(report.current.start,home.bounds.start);assert.equal(report.current.end,home.bounds.end);assert.equal(report.nutrition.means.protein_g,150);assert.equal(report.nutrition.source.key,n.source.key);
}
const interval=bodyIntervalModel(data,status,{},'2026-06-05');const n=interval.nutrition.sources.find(s=>s.domain==='sourceMetrics');assert.equal(n.means.protein_g,150);assert.equal(n.counts.protein_g,2);assert.equal(n.rows.length,3);assert.equal(n.knownPartialRows.length,1);assert.equal(n.reviewVerified,true);
assert.equal(homePeriodModel(data,status,'365',{},'2026-10-14').nutrition.counts.protein_g,2,'historical partial never becomes closed by elapsed time');
assert.equal(JSON.stringify(data),before);
console.log('Reviewed nutrition integration: Home/report/interval, source identity, 30/90/365/history, historical partial exclusion and immutability passed');

assert.equal(n.key,homePeriodModel(data,status,'90',{},'2026-06-05').nutrition.source.key,'same reviewed origin across Home and interval');

const {nutritionCoverage}=await import('../src/home-evidence-insights.js');
const conflict=homePeriodModel({...data,sourceMetrics:[{...metric('2026-06-01',100),nutrition_review:null},{...metric('2026-06-01',110),nutrition_review:null}]},status,'90',{},'2026-06-05');
assert.equal(nutritionCoverage(conflict).receivedDays,1);assert.equal(conflict.nutrition.sources[0].ambiguousDays,1);assert.equal(conflict.nutrition.sources[0].counts.protein_g,0);
