import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {state,setGlobalPeriod}=await import('./src/core.js');
const {localHealthDay}=await import('./src/health-context.js');
const {homePeriodModel}=await import('./src/home-period-model.js');
const {compositionModel,renderProductComposition}=await import('./src/composition-layout-v2.js');
const {labsModel,renderProductLabs}=await import('./src/labs-layout-v2.js');
const today=localHealthDay(),date=n=>new Date(Date.parse(today+'T12:00:00Z')-n*86400000).toISOString().slice(0,10);
state.domainStatus={body:'ready',segmental:'ready',labs:'ready'};state.errors={};state.ui={};
state.data={body:[10,45,120,400].map(n=>({source_record_id:'b'+n,measured_at:date(n),source:'Synthetic body',device_name:'Synthetic model',fat_mass_kg:n/10,body_fat_pct:20,weight_kg:80})),labs:[10,45,120,400].map(n=>({source_record_id:'l'+n,collection_date:date(n),biomarker:'Synthetic marker',laboratory:'Synthetic lab',method:'Synthetic method',unit:'u',result_numeric:n})),segmental:[]};
for(const [period,count] of [['30',1],['90',2],['365',3],['all',4]]){
 setGlobalPeriod(period);const h=homePeriodModel(state.data,state.domainStatus,period),b=compositionModel(),l=labsModel();
 assert.equal(b.period,period);assert.equal(l.period,period);assert.deepEqual(b.bounds,h.bounds);assert.deepEqual(l.bounds,h.bounds);
 assert.equal(b.windowRows.length,count);assert.equal(b.recent.length,count);assert.equal(l.rows.length,count);assert.equal(l.recent.length,count);
 assert.equal(b.history.total,4);assert.equal(l.history.total,4);assert.equal(state.ui.homePeriod,period);
 assert.match(renderProductComposition(),/mesma janela selecionada/);assert.match(renderProductLabs(),/mesma janela selecionada/);
}
state.data.body=state.data.body.slice(-1);state.data.labs=state.data.labs.slice(-1);setGlobalPeriod('90');
assert.equal(compositionModel().latest,null);assert.equal(labsModel().item,null);assert.doesNotMatch(renderProductComposition(),/Última medição inequívoca no período/);assert.match(renderProductLabs(),/Nenhum resultado laboratorial nesta janela/);
assert.match(renderProductLabs(),/data-value="all"/);
console.log('Domain periods: Home, composition and labs share 30/90/365/history bounds, no stale fallback; full archives remain explicit.');
