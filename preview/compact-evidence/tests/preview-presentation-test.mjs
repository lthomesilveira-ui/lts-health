import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {renderReferenceHome}=await import('../src/home-reference-experience.js');
const {esc}=await import('../src/core.js');
const {homePeriodModel}=await import('../src/home-period-model.js');
const status=Object.fromEntries(['body','workouts','exercises','sets','nutrition','sourceMetrics','metrics','labs','treatments','polarSessions'].map(k=>[k,'ready']));
const data={body:[],nutrition:[],workouts:[],exercises:[],sets:[],sourceMetrics:[],metrics:[],labs:[],treatments:[],polarSessions:[]};
for(const [i,source] of ['Apple Saúde · MyFitnessPal (Health Auto Export)','Apple Saúde · MyFitnessPal','MyFitnessPal export'].entries())for(const d of (i===2?['2025-01-20']:['2025-03-16','2025-03-17']))data.nutrition.push({source_record_id:`n-${i}-${d}`,nutrition_date:d,source,calories_kcal:2000+i*100,protein_g:100+i*10});
const render=(value,range,ui={})=>renderReferenceHome({...data,labs:[{collection_date:'2025-03-15',biomarker:'Synthetic laboratory metric',result_numeric:value,result_raw:String(value),unit:'u',reference_range:range,laboratory:'Synthetic lab'}]},status,'90',ui,'2025-03-20');
const html=render(.3,'0.4 a 2');
assert.match(html,/>0,0<\/text>/);assert.doesNotMatch(html,/[-−]0,0<\/text>/);assert.match(html,/0,3 u/);assert.match(html,/Laudo: 0,4–2,0 u/);
assert.match(html,/1 fora da faixa/);assert.match(html,/Entre 1 avaliáveis · 1 resultados/);
assert.match(html,/3\/89 dias únicos no conjunto/);assert.match(html,/2 dias sobrepostos no conjunto/);assert.match(html,/Sobreposição não confirma que as fontes sejam cópias/);assert.doesNotMatch(html,/Comparar origens \(3\)/);
assert.match(html,/>Apple · exportação<\/option>/);assert.match(html,/>Apple · MyFitnessPal<\/option>/);assert.match(html,/>MyFitnessPal · arquivo<\/option>/);assert.match(html,/<b>Apple Saúde · MyFitnessPal \(Health Auto Export\)<\/b>/);
const model=homePeriodModel(data,status,'90',{},'2025-03-20');
for(const source of model.nutrition.sources){const selected=render(.3,'0.4 a 2',{reportNutritionSource:source.key});assert.ok(selected.includes(`value="${esc(source.key)}" selected`),'original source key and selection preserved');}
const negative=render(-1,'0 a 2');assert.match(negative,/>-1,4<\/text>/);assert.match(negative,/-1,0 u/);assert.doesNotMatch(negative,/>0,0<\/text>/,'negative result remains in domain');
console.log('Preview presentation: nonnegative and negative domains, original results, unique overlap coverage, distinct short labels/full provenance and source selection passed.');

const collisionData={...data,nutrition:[...data.nutrition,{nutrition_date:'2025-03-16',source:'Apple Saúde · MyFitnessPal (Health Auto Export extra)',calories_kcal:2100,protein_g:110}]};
const collision=renderReferenceHome(collisionData,status,'90',{},'2025-03-20');assert.match(collision,/>Apple · exportação \(1\)<\/option>/);assert.match(collision,/>Apple · exportação \(2\)<\/option>/);
