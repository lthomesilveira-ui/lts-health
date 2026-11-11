import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./real-auth-e2e.mjs',import.meta.url),'utf8');
// Exercise the exact predicate shipped to the independent authenticated audit.
const expression=source.match(/const validTakeoutWater=([^\n]+);/)[1];
const valid=Function('return ('+expression+')')();
const row={source_record_id:'google_health_takeout:water:'+'a'.repeat(64),metric_date:'2030-02-11',metric_type:'dietary_water_ml',value:1234,unit:'mL',source_name:'MyFitnessPal · Google Health',source_family:'google_health_takeout',confidence:'authenticated_google_takeout'};
const proof={...row,canonical_status:'canonical',source_payload:{entry_method:'google_health_takeout_water_v1',export_version:1,archive_sha256:'b'.repeat(64),original_unit:'MILLILITER',original_source:'MyFitnessPal Fitbit 3P Web API',aggregation:'day',local_date:row.metric_date}};
assert.equal(valid(row,proof),true);
assert.equal(Boolean(valid(row,undefined)),false);
for(const change of [{source_family:'unverified'},{source_name:'Google Health App'},{confidence:'user_confirmed'},{source_record_id:'google_health_takeout:water:invalid'},{value:0},{value:-1},{value:100001},{value:'NaN'},{unit:'L'},{metric_type:'dietary_energy_kcal'},{metric_date:'2030-02-12'}])assert.equal(Boolean(valid({...row,...change},proof)),false);
for(const change of [{canonical_status:'held'},{source_record_id:'another'},{metric_date:'2030-02-12'},{value:2500},{source_payload:{}}])assert.equal(Boolean(valid(row,{...proof,...change})),false);
for(const key of Object.keys(proof.source_payload)){
 const payload={...proof.source_payload};delete payload[key];
 assert.equal(Boolean(valid(row,{...proof,source_payload:payload})),false,'missing proof field '+key);
}
for(const change of [{archive_sha256:'invalid'},{original_source:'MyFitnessPal Google Web API'},{original_unit:'VOLUME_UNIT_UNSPECIFIED'},{local_date:'2030-02-12'},{aggregation:'hour'}])assert.equal(Boolean(valid(row,{...proof,source_payload:{...proof.source_payload,...change}})),false);
assert.match(source,/!validOriginalWater\(r\)&&!validTakeoutWater\(r,takeoutProof\.get\(r\.source_record_id\)\)/);
assert.match(source,/if\(family\)query=query\.eq\('source_family',family\)/);
console.log('Authenticated Takeout audit: independent original evidence, exact identity/date/value, missing proof, bad units, unsupported sources and unchanged legacy boundary passed.');
