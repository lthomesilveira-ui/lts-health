import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
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
