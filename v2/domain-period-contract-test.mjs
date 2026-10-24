import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {state,setGlobalPeriod}=await import('./src/core.js');
const {localHealthDay}=await import('./src/health-context.js');
const {homePeriodModel}=await import('./src/home-period-model.js');
const {compositionModel,renderProductComposition}=await import('./src/composition-layout-v2.js');
const {labsModel,renderProductLabs}=await import('./src/labs-layout-v2.js');
const today=localHealthDay(),date=n=>new Date(Date.parse(today+'T12:00:00Z')-n*86400000).toISOString().slice(0,10);
state.domainStatus={body:'ready',segmental:'ready',labs:'ready'};state.errors={};state.ui={homePeriod:'7',dashboardPeriod:'7'};
state.data={body:[10,45,120,400].map(n=>({source_record_id:'b'+n,measured_at:date(n),source:'Synthetic body',device_name:'Synthetic model',fat_mass_kg:n/10,body_fat_pct:20,weight_kg:80})),labs:[10,45,120,400].map(n=>({source_record_id:'l'+n,collection_date:date(n),biomarker:'Synthetic marker',laboratory:'Synthetic lab',method:'Synthetic method',unit:'u',result_numeric:n})),segmental:[]};
const original=structuredClone(state.data);
for(const home of ['30','90','365','all']){
 setGlobalPeriod(home);
 assert.equal(compositionModel().period,'all');assert.equal(labsModel().period,'all');
 assert.equal(compositionModel().recent.length,4);assert.equal(labsModel().recent.length,4);
 assert.equal(state.ui.productCompositionPeriod,undefined);assert.equal(state.ui.productLabPeriod,undefined,'Home never assigns a laboratory filter');
}
state.ui.homePeriod='7';state.ui.dashboardPeriod='7';
for(const [period,count] of [['30',1],['90',2],['365',3],['all',4]]){
 state.ui.productCompositionPeriod=period;state.ui.productLabPeriod=period;
 const h=homePeriodModel(state.data,state.domainStatus,period),b=compositionModel(),l=labsModel();
 assert.equal(b.period,period);assert.equal(l.period,period);assert.deepEqual(b.bounds,h.bounds);assert.deepEqual(l.bounds,h.bounds);
 assert.equal(b.windowRows.length,count);assert.equal(b.recent.length,count);assert.equal(l.rows.length,count);assert.equal(l.recent.length,count);
 assert.equal(b.history.total,4);assert.equal(l.history.total,4);assert.equal(state.ui.homePeriod,'7');assert.equal(state.ui.dashboardPeriod,'7');
 assert.match(renderProductComposition(),/independente da Visão geral/);assert.match(renderProductLabs(),/independente da Visão geral/);
}
state.ui.productCompositionPeriod='30';state.ui.productLabPeriod='365';setGlobalPeriod('90');
assert.equal(state.ui.homePeriod,'90');assert.equal(compositionModel().period,'30');assert.equal(labsModel().period,'365');
assert.equal(compositionModel().recent.length,1);assert.equal(labsModel().recent.length,3,'each domain retains a different explicit window');
assert.deepEqual(state.data,original,'period controls cannot mutate records');
state.data.body=state.data.body.slice(-1);state.data.labs=state.data.labs.slice(-1);state.ui.productCompositionPeriod='90';state.ui.productLabPeriod='90';
assert.equal(compositionModel().latest,null);assert.equal(labsModel().item,null);assert.doesNotMatch(renderProductComposition(),/Última medição inequívoca no período/);assert.match(renderProductLabs(),/Nenhum resultado laboratorial nesta janela/);
assert.match(renderProductLabs(),/data-value="all"/);
state.ui.productCompositionPeriod='all';state.ui.productLabPeriod='all';
assert.equal(compositionModel().recent.length,1);assert.equal(labsModel().recent.length,1,'old observations remain available only after an explicit full-history choice');
console.log('Domain periods: independent full-history defaults, explicit 30/90/365/history bounds, Home7/90 persistence, no stale fallback or mutation; full archives remain available.');
