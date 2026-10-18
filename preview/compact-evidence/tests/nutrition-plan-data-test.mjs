import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import {documentedNutritionPlanProjection} from '../src/documented-nutrition-plan.js';
globalThis.location={search:'?fixture=1'};
const {state}=await import('../src/core.js');
const {fetchNutritionPlans,isRouteReady}=await import('../src/data-layer.js');

test('Document query uses the exact selective projection and type filter on every ordered page',async()=>{
  const queries=[],rows=Array.from({length:1001},(_,index)=>({source_record_id:`synthetic-plan-${index}`}));
  const client={from(table){const call={table,filters:[],orders:[]};queries.push(call);const query={select(value){call.select=value;return query;},range(from,to){call.from=from;call.to=to;return query;},eq(key,value){call.filters.push([key,value]);return query;},order(key,options){call.orders.push([key,options]);return query;},then(resolve,reject){return Promise.resolve({data:rows.slice(call.from,call.to+1),error:null}).then(resolve,reject);}};return query;}};
  assert.deepEqual(await fetchNutritionPlans(client),rows);assert.equal(queries.length,2);
  for(const query of queries){assert.equal(query.table,'health_documents');assert.equal(query.select,documentedNutritionPlanProjection);assert.deepEqual(query.filters,[['document_type','nutrition_plan']]);assert.deepEqual(query.orders,[['document_date',{ascending:false}],['source_record_id',{ascending:true}]]);}
  assert.deepEqual(queries.map(query=>[query.from,query.to]),[[0,999],[1000,1999]]);
});

test('Both plan-bearing routes wait for their independent document domain',()=>{
  const previous={loaded:state.loaded,domainStatus:state.domainStatus};
  try{
    const source=readFileSync(new URL('../src/data-layer.js',import.meta.url),'utf8');
    state.loaded=true;
    for(const route of ['hoje','nutricao']){
      const keys=[...source.match(new RegExp(`  ${route}:\\[([^\\]]+)\\]`))[1].matchAll(/'([^']+)'/g)].map(match=>match[1]);
      assert.ok(keys.includes('nutritionPlans'));state.domainStatus=Object.fromEntries(keys.map(key=>[key,'ready']));
      assert.equal(isRouteReady(route),true);delete state.domainStatus.nutritionPlans;assert.equal(isRouteReady(route),false);
      state.domainStatus.nutritionPlans='loading';assert.equal(isRouteReady(route),false);
      state.domainStatus.nutritionPlans='error';assert.equal(isRouteReady(route),true,'failures render a clear unavailable state');
    }
    assert.match(source,/water_ml,source,source_file,confidence','nutrition_date'/);
    assert.doesNotMatch(source,/confidence,updated_at','nutrition_date'/,'daily nutrition has no update timestamp column');
    assert.match(source,/source_file,updated_at,nutrition_review:source_payload->nutrition_review/);
  }finally{Object.assign(state,previous);}
});

test('Legacy browser service mocks apply document filters before pagination and return empty for unrelated documents',async()=>{
  const db={health_documents:[{source_record_id:'synthetic-care',document_type:'care_followup',document_date:'2024-03-01'},
    {source_record_id:'synthetic-plan-a',document_type:'nutrition_plan',document_date:'2024-03-01',source:'Synthetic A'},
    {source_record_id:'synthetic-plan-b',document_type:'nutrition_plan',document_date:'2024-03-01',source:'Synthetic B'}]};
  for(const filename of ['history-depth-browser.mjs','body-interval-browser.mjs','evidence-insights-browser.mjs']){
    const source=readFileSync(new URL(filename,import.meta.url),'utf8'),template=source.match(/const service=`([\s\S]*?)`;/)?.[1];
    assert.ok(template,`${filename} exposes its synthetic mock`);
    const service=template.replace('${JSON.stringify(db)}',JSON.stringify(db));
    const context=vm.createContext({window:{},localStorage:{getItem:()=>null,setItem:()=>{}},Promise,JSON});vm.runInContext(service,context);
    const client=context.window.supabase.createClient();
    const all=await fetchNutritionPlans(client);assert.deepEqual(Array.from(all,row=>row.source_record_id),['synthetic-plan-a','synthetic-plan-b'],filename);
    const paged=await client.from('health_documents').select('*').eq('document_type','nutrition_plan').eq('source','Synthetic B').range(0,0);
    assert.deepEqual(Array.from(paged.data,row=>row.source_record_id),['synthetic-plan-b'],`${filename} filters before range`);
    const empty=await client.from('health_documents').select('*').eq('document_type','missing_type').range(0,99);
    assert.equal(empty.data.length,0,`${filename} no matching documents`);
    assert.equal((await client.from('missing_table').select('*').eq('document_type','nutrition_plan')).data.length,0,`${filename} absent fixture table stays empty`);
  }
});
