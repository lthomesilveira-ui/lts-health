import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {nutritionTrainingContrast,workingLoadChanges,evidenceInsights,insightSummaries}=await import('./src/evidence-insights.js');
const {renderEvidenceInsights,renderHomeEvidenceInsights}=await import('./src/evidence-insights-view.js');
const status={nutrition:'ready',workouts:'ready',exercises:'ready',sets:'ready'};
const bounds={start:'2025-01-01',end:'2025-01-31'},today='2025-02-01';
const workout=(id,date,extra={})=>({source_record_id:id,workout_date:date,is_canonical:true,record_status:'validated',source:'Test notes',location:'Test gym',...extra});
const date=i=>`2025-01-${String(i).padStart(2,'0')}`;
const nutrition=Array.from({length:10},(_,i)=>({nutrition_date:date(i+1),source:'Food A',protein_g:i<5?100+i*10:50+(i-5)*10,calories_kcal:2000,carbs_g:i===9?null:200,fat_g:0}));
const workouts=Array.from({length:5},(_,i)=>workout(`w${i+1}`,date(i+1)));
const exercise=(i,extra={})=>({source_record_id:`e${i}`,workout_source_record_id:`w${i}`,workout_date:date(i),exercise:'Test press',machine:'Test machine',source:'Test notes',...extra});
const set=(i,weight,extra={})=>({source_record_id:`s${i}`,exercise_source_record_id:`e${i}`,workout_source_record_id:`w${i}`,workout_date:date(i),phase:'working',weight,weight_unit:'kg',reps_numeric:10,source:'Test notes',...extra});
const data={workouts,nutrition,exercises:[exercise(1),exercise(2)],sets:[set(1,20),set(2,30),set(2,999,{source_record_id:'warmup',phase:'warmup'})]};
const snapshot=JSON.stringify(data);
let n=nutritionTrainingContrast(data,status,bounds,'',today);
assert.equal(n.rows[0].withMean,120);assert.equal(n.rows[0].withoutMean,70);assert.equal(n.rows[0].delta,50);
assert.equal(n.rows[0].withDays,5);assert.equal(n.rows[0].withoutDays,5);
assert.equal(n.rows[2].comparable,false,'metric-specific nulls lower their own denominator');
assert.equal(n.rows[3].withMean,0,'explicit zero is preserved');
const duplicate={...data,nutrition:[...nutrition,nutrition[0]]};
n=nutritionTrainingContrast(duplicate,status,bounds,'',today);assert.equal(n.ambiguousDays,1);assert.equal(n.rows[0].withDays,4);assert.equal(n.rows[0].delta,null);
n=nutritionTrainingContrast({...data,nutrition:nutrition.map((row,i)=>({...row,source:i<5?'A':'B'}))},status,bounds,'',today);assert.equal(n.sources.length,2);assert.equal(n.rows[0].comparable,false,'origins cannot be pooled to meet a threshold');
n=nutritionTrainingContrast({...data,nutrition:[...nutrition,{nutrition_date:date(12),protein_g:999,source:null},{nutrition_date:'2025-02-01',protein_g:999,source:'Food A'},{nutrition_date:'2025-02-02',protein_g:999,source:'Food A'}]},status,{end:'2025-02-02'},'',today);assert.equal(n.rows[0].withMean,120);assert.equal(n.unknownSourceDays,1);assert.equal(n.rows[0].withoutDays,5);
n=nutritionTrainingContrast({...data,workouts:[...workouts,workout('noncanonical',date(6),{is_canonical:false}),workout('quarantine',date(7),{record_status:'quarantined'})]},status,bounds,'',today);assert.equal(n.rows[0].withoutDays,5);
assert.equal(nutritionTrainingContrast(data,{...status,workouts:'error'},bounds,'',today).available,false);
assert.equal(nutritionTrainingContrast(data,{...status,nutrition:'loading'},bounds,'',today).available,false);
let l=workingLoadChanges(data,status,bounds,today);assert.equal(l.rows.length,1);assert.equal(l.rows[0].delta,10);assert.equal(l.rows[0].previous.weight,20);assert.equal(l.rows[0].latest.weight,30);assert.equal(l.rows[0].points.length,2);
for(const altered of [
 {...data,sets:[data.sets[0],set(2,30,{reps_numeric:12})]},
 {...data,exercises:[data.exercises[0],exercise(2,{machine:'Other machine'})]},
 {...data,workouts:[workouts[0],{...workouts[1],location:'Other gym'},...workouts.slice(2)]},
 {...data,sets:[data.sets[0],set(2,30,{weight_unit:'lb'})]},
 {...data,sets:[data.sets[0],set(2,30,{technique:'drop set'})]},
 {...data,sets:[data.sets[0],set(2,30,{source:'Other notes'})]},
 {...data,sets:[data.sets[0],set(2,30,{source:null})]},
 {...data,sets:[data.sets[0],set(2,30,{weight_unit:'source_value'})]},
 {...data,sets:[data.sets[0],set(2,30,{workout_source_record_id:'w1'})]},
 {...data,sets:[data.sets[0],set(2,30,{workout_date:date(3)})]}
])assert.equal(workingLoadChanges(altered,status,bounds,today).rows.length,0,'incompatible observations must remain separate');
l=workingLoadChanges({...data,workouts:[...workouts,workout('second',date(2))],exercises:[...data.exercises,exercise(2,{source_record_id:'second-ex',workout_source_record_id:'second'})],sets:[...data.sets,set(2,40,{source_record_id:'second-set',exercise_source_record_id:'second-ex',workout_source_record_id:'second'})]},status,bounds,today);assert.equal(l.rows.length,0);assert.equal(l.ambiguousDays,1);
l=workingLoadChanges(data,status,bounds,date(2));assert.equal(l.rows.length,0,'today must not enter a closed-day comparison');
assert.equal(workingLoadChanges(data,{...status,sets:'error'},bounds,today).available,false);
assert.equal(JSON.stringify(data),snapshot,'insights do not alter preserved records');
assert.equal(insightSummaries(evidenceInsights(data,status,bounds,'',today)).length,2);
const dangerous={...data,exercises:data.exercises.map(row=>({...row,exercise:'<script>unsafe</script>'}))};
const html=renderEvidenceInsights(dangerous,status,bounds);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>unsafe/);
assert.match(html,/data-report-exercise="e2"/);assert.match(html,/reportNutritionSource/);assert.match(html,/mínimo 5 dias por grupo/);
assert.match(renderHomeEvidenceInsights(data,status,bounds),/O que os registros mostram/);
console.log('Evidence insights: independent means/denominators, source separation, ambiguous and open days, working-set identity, matching reps, unknown units, failure boundaries, immutability and escaping passed.');
