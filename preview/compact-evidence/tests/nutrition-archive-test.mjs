import assert from 'node:assert/strict';
import {test} from 'node:test';
import {nutritionArchiveModel,nutritionArchiveSelection,nutritionArchiveSourceKey,nutritionArchiveSourceLabel,nutritionTimelineSelection} from '../src/nutrition-archive.js';
globalThis.location={search:'?fixture=1'};
const {state}=await import('../src/core.js');
const {renderProductNutrition}=await import('../src/nutrition-product.js');
const {renderTimelineHub}=await import('../src/timeline-screen.js');
const today='2025-11-17',oldKey=nutritionArchiveSourceKey('Synthetic archive'),newKey=nutritionArchiveSourceKey('Synthetic connected');
const status=Object.fromEntries(['nutrition','sourceMetrics','meals','body','segmental','metrics','workouts','workoutEvidence','exercises','sets','labs','goals','nutritionPlans','waterReferences','treatments','regimens','polarSessions','docs','activity'].map(key=>[key,'ready']));
function fixture(){
  const data=Object.fromEntries(Object.keys(status).map(key=>[key,[]]));
  data.nutrition=[
    {source_record_id:'old-2017',nutrition_date:'2017-02-06',source:'Synthetic archive',calories_kcal:2100,protein_g:100},
    {source_record_id:'old-2023',nutrition_date:'2023-04-19',source:'Synthetic archive',calories_kcal:2200,protein_g:110},
    {source_record_id:'new-2025',nutrition_date:'2025-11-16',source:'Synthetic connected',calories_kcal:2300,protein_g:120}
  ];
  data.meals=[{source_record_id:'meal-2017',meal_date:'2017-02-06',source:'Synthetic archive',meal_name:'Synthetic historical lunch',calories_kcal:600,protein_g:30},
    {source_record_id:'meal-2023',meal_date:'2023-04-19',source:'Synthetic archive',meal_name:'Synthetic second lunch',calories_kcal:650,protein_g:35},
    {source_record_id:'meal-other',meal_date:'2017-02-06',source:'Synthetic other',meal_name:'Wrong source meal',calories_kcal:9999,protein_g:999}];
  data.sourceMetrics=[{source_record_id:'mirror',metric_date:'2017-02-06',metric_type:'dietary_protein_g',value:900,unit:'g',source_name:'Synthetic archive',source_family:'synthetic',canonical_status:'candidate'}];
  return data;
}
function render(data,ui,st=status){state.data=data;state.domainStatus=st;state.ui={...ui,nutritionPeriod:'30'};return renderProductNutrition();}
function diary(html){return html.match(/<section id="nutritionArchiveDiary"[\s\S]*?<\/section>/)[0];}

test('All-history source/year/month/day access reaches 2017 and 2023 outside a 30-day summary without rewriting inputs',()=>{
  const data=fixture(),ui={nutritionPeriod:'30',reportNutritionSource:oldKey,nutritionDate:'2017-02-06'},original=structuredClone({data,ui});
  const a=nutritionArchiveModel(data,status,ui,today);
  assert.equal(a.date,'2017-02-06');assert.equal(a.food.protein_g,100);assert.equal(a.firstDate,'2017-02-06');assert.deepEqual(a.years,['2023','2017']);
  assert.equal(a.meals.length,1);assert.equal(a.meals[0].meal_name,'Synthetic historical lunch');
  const html=render(data,ui);assert.match(diary(html),/Synthetic historical lunch/);assert.doesNotMatch(diary(html),/Wrong source meal/);
  assert.match(html,/independente da janela de médias acima/);assert.match(html,/id="nutritionArchiveYear"/);assert.match(html,/data-nutrition-archive-date="2017-02-06"/);
  const yearUi={...ui,...nutritionArchiveSelection(a,'year','2023')},year=nutritionArchiveModel(data,status,yearUi,today);
  assert.equal(year.date,'2023-04-19');assert.equal(year.meals[0].meal_name,'Synthetic second lunch');
  assert.deepEqual({data,ui},original);
});

test('Explicit missing dates and absent sources are retained; another origin is never substituted',()=>{
  const data=fixture(),ui={reportNutritionSource:newKey,nutritionDate:'2017-02-06'},a=nutritionArchiveModel(data,status,ui,today);
  assert.equal(a.source.key,newKey);assert.equal(a.date,'2017-02-06');assert.equal(a.food,null);assert.equal(a.hasDate,false);assert.equal(a.meals.length,0);assert.ok(a.otherSources.some(source=>source.key===oldKey));
  const html=diary(render(data,ui));assert.match(html,/Sem registro de alimentação em 06\/02\/2017 neste diário/);assert.match(html,/data-nutrition-archive-open=/);assert.doesNotMatch(html,/2\.300 kcal/);
  const missing=nutritionArchiveModel(data,status,{reportNutritionSource:'missing-origin',nutritionDate:'2023-04-19'},today);
  assert.equal(missing.source,null);assert.equal(missing.date,'2023-04-19');assert.equal(missing.requestedSourceMissing,true);
  assert.match(diary(render(data,{reportNutritionSource:'missing-origin',nutritionDate:'2023-04-19'})),/Sua escolha foi preservada/);
});

test('Source switching and route return preserve explicitly selected dates; one source is never pooled with a same-label candidate mirror',()=>{
  const data=fixture();let ui={reportNutritionSource:oldKey,nutritionDate:'2017-02-06'};
  let archive=nutritionArchiveModel(data,status,ui,today);ui={...ui,...nutritionArchiveSelection(archive,'source',newKey)};
  archive=nutritionArchiveModel(data,status,ui,today);assert.equal(archive.source.key,newKey);assert.equal(archive.date,'2017-02-06');assert.equal(archive.hasDate,false);
  ui={...ui,...nutritionArchiveSelection(archive,'source',oldKey)};
  for(let i=0;i<3;i++){archive=nutritionArchiveModel(data,status,ui,today);assert.equal(archive.food.protein_g,100);assert.equal(archive.meals.length,1);}
  const mirror=archive.sources.find(source=>source.domain==='sourceMetrics');
  ui={...ui,...nutritionArchiveSelection(archive,'source',mirror.key)};archive=nutritionArchiveModel(data,status,ui,today);
  assert.equal(archive.food.protein_g,900);assert.equal(archive.meals.length,0);assert.equal(archive.source.status,'candidate');
  assert.equal(nutritionArchiveSelection(archive,'source','unknown'),null);assert.equal(nutritionArchiveSelection(archive,'date','2030-01-01'),null);assert.equal(nutritionArchiveSelection(archive,'date','2024-02-31'),null);
});

test('Meal-only historical days remain reachable without manufacturing a daily total',()=>{
  const data=fixture();data.meals.push({source_record_id:'meal-only',meal_date:'2016-01-03',source:'Synthetic archive',meal_name:'Only received meal',calories_kcal:700});
  const ui={reportNutritionSource:oldKey,nutritionDate:'2016-01-03'},archive=nutritionArchiveModel(data,status,ui,today);
  assert.equal(archive.firstDate,'2016-01-03');assert.equal(archive.hasDate,true);assert.equal(archive.food,null);assert.equal(archive.meals.length,1);
  const html=diary(render(data,ui));assert.match(html,/Only received meal/);assert.match(html,/não são somadas para formar um total/);assert.doesNotMatch(html,/ltsNutritionDiaryMetrics/);
});

test('Ambiguous daily totals are not picked; failed and loading sources cannot expose stale meals or totals',()=>{
  const data=fixture();data.nutrition.push({...data.nutrition[0],source_record_id:'duplicate',protein_g:999});
  const ui={reportNutritionSource:oldKey,nutritionDate:'2017-02-06'},a=nutritionArchiveModel(data,status,ui,today);
  assert.equal(a.food,null);assert.equal(a.dailyRecords.length,2);assert.ok(a.duplicates.length);assert.equal(a.meals.length,1);
  const html=diary(render(data,ui));assert.match(html,/totais repetidos ou conflitantes/);assert.match(html,/Conferir os totais deste dia/);
  for(const failure of ['error','loading']){
    const st={...status,nutrition:failure,sourceMetrics:failure,meals:failure},failed=nutritionArchiveModel(data,st,ui,today);
    assert.equal(failed.source,null);assert.equal(failed.meals.length,0);assert.equal(failed.food,null);assert.equal(failed.date,'2017-02-06');assert.equal(failed.unavailable.length,3);
    assert.doesNotMatch(diary(render(data,ui,st)),/Synthetic historical lunch|999 g/);
  }
});

test('Timeline identity is verified against loaded raw source/date/id and mixed origins are not falsely ambiguous',()=>{
  const data=fixture();data.nutrition.push({source_record_id:'same-date-other',nutrition_date:'2017-02-06',source:'Synthetic connected',calories_kcal:2000,protein_g:200});
  const patch=nutritionTimelineSelection(data,status,oldKey,'2017-02-06','old-2017');assert.equal(patch.reportNutritionSource,oldKey);assert.equal(patch.nutritionDate,'2017-02-06');assert.equal(patch.nutritionMonth,'2017-02');
  assert.equal(nutritionTimelineSelection(data,status,newKey,'2017-02-06','old-2017'),null);
  assert.equal(nutritionTimelineSelection(data,status,oldKey,'2023-04-19','old-2017'),null);
  assert.equal(nutritionTimelineSelection(data,{...status,nutrition:'error'},oldKey,'2017-02-06','old-2017'),null);
  state.data=data;state.domainStatus=status;state.ui={timelinePeriod:'all',timelineYear:'2017',timelineLimit:50};
  const html=renderTimelineHub();assert.match(html,/data-timeline-ref="old-2017"/);assert.match(html,/data-timeline-source="\[&quot;nutrition&quot;,&quot;synthetic archive&quot;,&quot;canonical&quot;\]"/);assert.doesNotMatch(html,/Alimentação em revisão/);
  const returned=nutritionArchiveModel(data,status,patch,today);assert.equal(returned.food.protein_g,100);assert.equal(returned.meals.length,1);
});

test('Conflicting same-origin source metrics retain their raw values and cannot inherit direct-table meals',()=>{
  const data=fixture();data.sourceMetrics.push({...data.sourceMetrics[0],source_record_id:'mirror-duplicate',value:901,source_file:'<synthetic-file>'});
  const initial=nutritionArchiveModel(data,status,{},today),key=initial.sources.find(source=>source.domain==='sourceMetrics').key;
  const ui={reportNutritionSource:key,nutritionDate:'2017-02-06'},a=nutritionArchiveModel(data,status,ui,today);
  assert.equal(a.food,null);assert.equal(a.metricRecords.length,2);assert.equal(a.meals.length,0);
  const html=diary(render(data,ui));assert.match(html,/Conferir os valores deste dia/);assert.match(html,/900 g/);assert.match(html,/901 g/);assert.match(html,/&lt;synthetic-file&gt;/);assert.doesNotMatch(html,/Synthetic historical lunch/);
});

test('Historical Home day offers an explicit source/date verified archive link without changing seven cards or the chosen origin',async()=>{
  const {renderHealthDashboard}=await import('../src/health-dashboard.js');
  const {healthDashboardModel}=await import('../src/health-dashboard-model.js');
  const data=fixture(),ui={dashboardMode:'day',dashboardDate:'2017-02-06',dashboardSources:{protein:newKey,energy:newKey}},before=structuredClone(ui);
  const model=healthDashboardModel(data,status,ui,today),html=renderHealthDashboard(data,status,ui,today);
  assert.equal(model.metricsByKey.protein.source.key,newKey);assert.equal(model.metricsByKey.protein.value,null);
  assert.equal((html.match(/data-dashboard-card=/g)||[]).length,7);assert.match(html,/healthArchiveAccess/);assert.match(html,/data-nutrition-archive-route="nutricao"/);assert.match(html,/data-nutrition-archive-date="2017-02-06"/);
  assert.deepEqual(ui,before);
  const noData=renderHealthDashboard(data,status,{...ui,dashboardDate:'2019-05-01'},today);assert.doesNotMatch(noData,/healthArchiveAccess/);
});

test('Malformed dates and future Timeline targets cannot masquerade as historical observations',()=>{
  const data=fixture();data.nutrition.push({source_record_id:'invalid-date',nutrition_date:'2023-04-19garbage',source:'Synthetic invalid date',protein_g:900});
  data.nutrition.push({source_record_id:'future-date',nutrition_date:'2035-03-12',source:'Synthetic future date',protein_g:800});
  const archive=nutritionArchiveModel(data,status,{},today);
  assert.equal(archive.sources.some(source=>source.label==='Synthetic invalid date'||source.label==='Synthetic future date'),false);
  assert.equal(nutritionTimelineSelection(data,status,nutritionArchiveSourceKey('Synthetic future date'),'2035-03-12','future-date',today),null);
});


test('Raw duplicate daily records preserve original fractional scalars without rounding and archive wording does not promise complete coverage',()=>{
  const data=fixture();data.nutrition[0].calories_kcal='2100.0750';data.nutrition[0].protein_g=100.125;
  data.nutrition.push({...data.nutrition[0],source_record_id:'fraction-duplicate',calories_kcal:2100.0875,protein_g:'100.3750'});
  const html=render(data,{reportNutritionSource:oldKey,nutritionDate:'2017-02-06'}),raw=diary(html).match(/<details data-disclosure="nutrition-archive-raw">[\s\S]*?<\/details>/)[0];
  assert.match(raw,/Energia: 2100\.0750 kcal/);assert.match(raw,/Proteína: 100\.125 g/);assert.match(raw,/Energia: 2100\.0875 kcal/);assert.match(raw,/Proteína: 100\.3750 g/);
  assert.match(html,/Histórico alimentar salvo/);assert.match(diary(html),/Consulta de um dia, independente da janela de médias acima/);assert.doesNotMatch(html,/Histórico alimentar completo|Dia do arquivo completo/);
  data.nutrition[0].calories_kcal='<synthetic-value>';
  const escaped=diary(render(data,{reportNutritionSource:oldKey,nutritionDate:'2017-02-06'}));assert.match(escaped,/&lt;synthetic-value&gt; kcal/);assert.doesNotMatch(escaped,/<synthetic-value>/);
});


test('Same-alias archive sources are visibly distinct by domain and status in controls, alternatives, context and Home',async()=>{
  const data=fixture();data.sourceMetrics=['canonical','candidate','held'].map((canonical_status,index)=>({source_record_id:`alias-${canonical_status}`,metric_date:'2017-02-06',metric_type:'dietary_protein_g',value:80+index,unit:'g',source_name:'Synthetic archive',source_family:'synthetic',canonical_status}));
  const archive=nutritionArchiveModel(data,status,{},today),shared=archive.sources.filter(source=>source.label==='Synthetic archive'),labels=shared.map(source=>nutritionArchiveSourceLabel(source,archive.sources));
  assert.deepEqual(new Set(labels),new Set(['Synthetic archive · Histórico alimentar','Synthetic archive · Diário importado','Synthetic archive · Registro adicional','Synthetic archive · Registro com limitações']));
  const html=render(data,{reportNutritionSource:newKey,nutritionDate:'2017-02-06'}),select=html.match(/<select id="nutritionArchiveSource"[\s\S]*?<\/select>/)[0],details=html.match(/<details data-disclosure="nutrition-archive-origins">[\s\S]*?<\/details>/)[0],selected=diary(render(data,{reportNutritionSource:oldKey,nutritionDate:'2017-02-06'}));
  for(const label of labels){assert.ok(select.includes(label));assert.ok(details.includes(label));assert.ok(diary(html).includes(`>${label}</button>`));}
  assert.ok(selected.includes('Synthetic archive · Histórico alimentar.</p>'));assert.match(selected,/<details data-disclosure="nutrition-diary-about"><summary>Sobre estes dados<\/summary>/);
  const {renderHealthDashboard}=await import('../src/health-dashboard.js');
  const home=renderHealthDashboard(data,status,{dashboardMode:'day',dashboardDate:'2017-02-06',dashboardSources:{protein:newKey,energy:newKey}},today);
  for(const label of labels)assert.ok(home.includes(`Abrir diário · ${label}</button>`));
  const calendar=render(data,{reportNutritionSource:oldKey,nutritionDate:'2017-02-06'});assert.match(calendar,/<option value="2017-02" selected>fevereiro<\/option>/);assert.match(calendar,/aria-label="Mês do histórico alimentar de 2017"/);
});


test('Consumer labels preserve distinct source identities and raw meal notes without backend labels in controls',()=>{
  const data=fixture();
  const row=data.sourceMetrics[0];
  data.sourceMetrics.push({...row,source_record_id:'same-name-other-family',source_family:'synthetic-other',value:901});
  data.meals[0].notes='Synthetic raw note: candidate is a quoted label; keep the original wording.';
  const ui={reportNutritionSource:oldKey,nutritionDate:'2017-02-06'},before=structuredClone(data),archive=nutritionArchiveModel(data,status,ui,today);
  const aliases=archive.sources.filter(source=>source.domain==='sourceMetrics'),labels=aliases.map(source=>nutritionArchiveSourceLabel(source,archive.sources));
  assert.equal(new Set(labels).size,aliases.length);assert.ok(labels.every(label=>/Registro adicional [12]$/.test(label)));
  const html=render(data,ui),select=html.match(/<select id="nutritionArchiveSource"[\s\S]*?<\/select>/)[0];
  const visibleOptions=[...select.matchAll(/<option[^>]*>(.*?)<\/option>/g)].map(match=>match[1]).join(' ');
  assert.doesNotMatch(visibleOptions,/canonical|candidate|held|canônica|candidata|métricas por origem|totais diários/i);
  assert.match(diary(html),/Synthetic raw note: candidate is a quoted label; keep the original wording\./);
  for(const source of aliases){
    const chosen=nutritionArchiveModel(data,status,{...ui,reportNutritionSource:source.key},today);
    assert.equal(chosen.source.key,source.key);assert.equal(chosen.meals.length,0);assert.equal(chosen.food.protein_g,source.sourceFamily==='synthetic-other'?901:900);
    assert.ok(html.includes(nutritionArchiveSourceLabel(source,archive.sources)));
  }
  const failed=render(data,ui,{...status,nutrition:'error',meals:'error',sourceMetrics:'error'});
  assert.match(failed,/Parte do histórico não carregou/);assert.match(failed,/Não foi possível abrir o diário escolhido/);
  assert.doesNotMatch(failed,/origem.*indisponível nesta leitura|métricas por origem|registros recebidos/);
  assert.deepEqual(data,before);
});


test('Reviewed exports with the same visible name keep distinct human labels and exact file identities',()=>{
  const data=fixture();data.nutrition=[];data.meals=[];
  data.sourceMetrics=['a','b'].map((letter,index)=>{
    const id=`synthetic-reviewed-${letter}`,value=100+index,date='2017-02-06',file=`synthetic-${letter}.zip`;
    return {source_record_id:id,metric_date:date,metric_type:'dietary_protein_g',value,unit:'g',source_family:'myfitnesspal',source_name:'MyFitnessPal via Apple Health',source_file:file,canonical_status:'candidate',nutrition_review:{schema:'apple_nutrition_source_review_v1',method:'sum_distinct_meal_samples_v1',status:'verified',source_record_id:id,metric_date:date,metric_type:'dietary_protein_g',unit:'g',verified_value:value,source_file:file,source_sha256:letter.repeat(64),original_source:'MyFitnessPal',exported_at:'2017-02-07T15:00:00-03:00',sample_count:1,duplicate_count:0}};
  });
  const before=structuredClone(data),archive=nutritionArchiveModel(data,status,{},today),labels=archive.sources.map(source=>nutritionArchiveSourceLabel(source,archive.sources));
  assert.equal(archive.sources.length,2);assert.equal(new Set(labels).size,2);assert.ok(labels.every(label=>/Registro adicional [12]$/.test(label)));
  for(const source of archive.sources){
    const selected=nutritionArchiveModel(data,status,{reportNutritionSource:source.key,nutritionDate:'2017-02-06'},today);
    assert.equal(selected.source.key,source.key);assert.equal(selected.source.status,'candidate');assert.equal(selected.source.reviewVerified,true);
    assert.equal(selected.metricRecords.length,1);assert.equal(selected.food.protein_g,selected.metricRecords[0].value);assert.equal(selected.meals.length,0);
    assert.match(diary(render(data,{reportNutritionSource:source.key,nutritionDate:'2017-02-06'})),new RegExp(labels[archive.sources.indexOf(source)].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  assert.deepEqual(data,before);
});
