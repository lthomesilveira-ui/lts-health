import assert from 'node:assert/strict';

// Entirely synthetic in-memory service. No external database is contacted.
globalThis.location={search:''};
globalThis.FormData=class{constructor(form){return Object.entries(form);}};
let records=[],calls=[],readError=null,throwRead=false,beforeWrite=null;
const client={from(table){
  assert.equal(table,'health_personal_goals');
  const filters=[];let operation=null,payload=null;
  const matching=()=>records.filter(row=>filters.every(([key,value])=>row[key]===value));
  const query={
    select(){return query;},
    eq(key,value){assert.notEqual(value,null,'null comparisons must use is');filters.push([key,value]);return query;},
    is(key,value){assert.equal(value,null);filters.push([key,value]);return query;},
    async maybeSingle(){
      calls.push({operation:'read',filters:[...filters]});
      if(throwRead)throw new Error('Synthetic read failure');
      if(readError)return {data:null,error:readError};
      const rows=matching();
      return rows.length>1?{data:null,error:{message:'Ambiguous'}}:{data:rows[0]?{...rows[0]}:null,error:null};
    },
    insert(row){operation='insert';payload=row;return query;},
    update(row){operation='update';payload=row;return query;},
    upsert(){throw new Error('Blind upsert must never be called');},
    async single(){
      calls.push({operation,payload:{...payload},filters:[...filters]});
      if(beforeWrite){const run=beforeWrite;beforeWrite=null;run();}
      if(operation==='insert'){
        if(records.some(row=>row.user_id===payload.user_id&&row.effective_from===payload.effective_from))return {data:null,error:{message:'Duplicate key'}};
        records.push({...payload});return {data:{...payload},error:null};
      }
      const rows=matching();
      if(rows.length!==1)return {data:null,error:{message:'Concurrent change or missing row'}};
      Object.assign(rows[0],payload);return {data:{...rows[0]},error:null};
    }
  };
  return query;
}};
globalThis.window={supabase:{createClient:()=>client}};
const {state}=await import('../src/core.js');
const {saveGoals,renderGoals}=await import('../src/personal-goals.js');
const date='2024-03-05',userId='synthetic-user';
const form={effective_from:date,water_ml:'1800',notes:'Synthetic personal goal'};
const reference=type=>({user_id:userId,effective_from:date,water_ml:1600,notes:JSON.stringify({type,source:'Synthetic source',documented_on:date,current_validity:'unconfirmed',date_basis:'document_update',clinical_start:'not_explicit',source_page:3})});
const ordinary={user_id:userId,effective_from:date,water_ml:1400,notes:'Synthetic earlier personal goal'};
function reset(server=[],cached=server,status='ready'){
  records=structuredClone(server);calls=[];readError=null;throwRead=false;beforeWrite=null;
  state.session={user:{id:userId}};state.data.goals=structuredClone(cached);state.domainStatus.goals=status;
}
async function blocked(pattern){
  const cache=structuredClone(state.data.goals),server=structuredClone(records);
  await assert.rejects(()=>saveGoals(form),pattern);
  assert.equal(calls.filter(call=>call.operation!=='read').length,0,'no mutation call');
  assert.deepEqual(state.data.goals,cache);assert.deepEqual(records,server);
}
for(const type of ['historical_protocol','documented_water_base']){
  reset([reference(type)]);await blocked(/referência histórica ou documentada/);assert.equal(calls.length,0,'cached protected reference blocks before any service call');
  reset([reference(type)],[]);await blocked(/referência histórica ou documentada/);assert.equal(calls.length,1,'fresh read protects a reference absent from cache');
  reset([reference(type)],[ordinary]);await blocked(/referência histórica ou documentada/);
  reset([{...reference(type),notes:JSON.stringify({type})}]);await blocked(/referência histórica ou documentada/);
}
for(const status of ['error','loading','unavailable',undefined]){
  reset();state.domainStatus.goals=status;await blocked(/carregamento das metas/);assert.equal(calls.length,0);
  assert.match(renderGoals(),/<button type="submit" disabled>/);
}
reset();readError={message:'Synthetic unavailable service'};await blocked(/conferir a referência atual/);
reset();throwRead=true;await blocked(/conferir a referência atual/);
reset([{...ordinary,notes:undefined}],[]);await blocked(/conferir a referência atual/);
reset([ordinary,ordinary],[]);await blocked(/conferir a referência atual/);

reset();await saveGoals(form);
assert.deepEqual(calls.map(call=>call.operation),['read','insert']);assert.equal(records[0].water_ml,1800);
assert.deepEqual(calls[0].filters,[['user_id',userId],['effective_from',date]]);
reset([ordinary]);await saveGoals(form);
assert.deepEqual(calls.map(call=>call.operation),['read','update']);assert.equal(records[0].water_ml,1800);
assert.deepEqual(calls[1].filters,[['user_id',userId],['effective_from',date],['notes',ordinary.notes]]);
reset([{...ordinary,notes:null}]);await saveGoals(form);
assert.deepEqual(calls.map(call=>call.operation),['read','update']);assert.equal(records[0].water_ml,1800);
assert.deepEqual(calls[1].filters,[['user_id',userId],['effective_from',date],['notes',null]]);

for(const type of ['historical_protocol','documented_water_base']){
  reset();beforeWrite=()=>records.push(reference(type));
  await assert.rejects(()=>saveGoals(form),/metas anteriores continuam preservadas/);
  assert.deepEqual(records,[reference(type)]);assert.deepEqual(state.data.goals,[]);
  reset([ordinary]);beforeWrite=()=>{records[0]=reference(type);};
  await assert.rejects(()=>saveGoals(form),/metas anteriores continuam preservadas/);
  assert.deepEqual(records,[reference(type)]);assert.deepEqual(state.data.goals,[ordinary]);
}
const older=reference('historical_protocol');older.effective_from='2024-03-01';
reset([older]);await saveGoals(form);assert.deepEqual(records[0],older);assert.equal(records.length,2);
console.log('Personal goal preservation: protected cached/fresh/incomplete references, unavailable reads, ordinary inserts/updates, concurrent reference creation/change, and unchanged historical rows passed.');
