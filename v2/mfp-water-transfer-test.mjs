import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

globalThis.location={search:'?fixture=1'};

const{
  buildIsoDateRange,
  inclusiveDayCount,
  MFP_WATER_ENTRY_METHOD,
  MFP_WATER_EXPORT_METHOD,
  MFP_WATER_EXPORT_SCHEMA,
  myFitnessPalWaterRecords,
  parseMfpWaterEndpoint,
  parseMyFitnessPalWaterExport
}=await import('./src/mfp-water-transfer.js');
const{buildMyFitnessPalWaterBookmarklet,mfpWaterBookmarkletMain,MFP_WATER_CHECKPOINT_KEY}=await import('./src/mfp-water-extractor.js');
const{state,fixtureData}=await import('./src/core.js');
const{importMyFitnessPalWaterExport}=await import('./src/writes.js');

assert.equal(parseMfpWaterEndpoint({item:{date:'2026-09-07',milliliters:700.0}},'2026-09-07'),700);
assert.throws(()=>parseMfpWaterEndpoint({item:{date:'2026-09-08',milliliters:700}},'2026-09-07'),/mfp_endpoint_invalid_date/);
assert.throws(()=>parseMfpWaterEndpoint({item:{date:'2026-09-07',milliliters:-1}},'2026-09-07'),/mfp_endpoint_invalid_water/);
assert.equal(inclusiveDayCount('2024-02-28','2024-03-01'),3);
assert.deepEqual(buildIsoDateRange('2024-02-28','2024-03-01'),['2024-02-28','2024-02-29','2024-03-01']);

const valid={
  schema:MFP_WATER_EXPORT_SCHEMA,
  version:1,
  source:'MyFitnessPal authenticated web',
  method:MFP_WATER_EXPORT_METHOD,
  status:'complete',
  started_at:'2026-09-08T00:00:00.000Z',
  completed_at:'2026-09-08T00:01:00.000Z',
  period:{from:'2026-09-06',to:'2026-09-08'},
  days_scanned:3,
  positive_days:2,
  days_without_positive_total:1,
  rows:[{date:'2026-09-07',water_ml:700},{date:'2026-09-08',water_ml:2500}]
};

const parsed=parseMyFitnessPalWaterExport(JSON.stringify(valid));
assert.deepEqual(parsed.rows,valid.rows);
assert.equal(parsed.days_without_positive_total,1);
const duplicate=parseMyFitnessPalWaterExport({...valid,positive_days:2,rows:[...valid.rows,{date:'2026-09-07',water_ml:700}]});
assert.equal(duplicate.rows.length,2);
assert.throws(()=>parseMyFitnessPalWaterExport({...valid,rows:[...valid.rows,{date:'2026-09-07',water_ml:701}]}),/mfp_export_conflicting_duplicate/);
assert.throws(()=>parseMyFitnessPalWaterExport({...valid,status:'running',completed_at:null}),/mfp_export_incomplete/);
assert.throws(()=>parseMyFitnessPalWaterExport({...valid,days_scanned:2}),/mfp_export_incomplete/);
assert.throws(()=>parseMyFitnessPalWaterExport({...valid,positive_days:1}),/mfp_export_invalid_counts/);
assert.throws(()=>parseMyFitnessPalWaterExport({...valid,rows:[{date:'2026-09-09',water_ml:700}],positive_days:1,days_without_positive_total:2}),/mfp_export_invalid_row_date/);
assert.throws(()=>parseMyFitnessPalWaterExport('not json'),/mfp_export_invalid_json/);

const records=myFitnessPalWaterRecords(parsed,'user-1');
assert.equal(records[0].source_record_id,'mfp-water:2026-09-07');
assert.equal(records[0].confidence,'account_authenticated_export');
assert.equal(records[0].source_payload.entry_method,MFP_WATER_ENTRY_METHOD);
assert.equal(records[0].source_payload.export_schema,MFP_WATER_EXPORT_SCHEMA);
assert.equal(records[0].source_payload.export_period_from,'2026-09-06');
assert.equal('email' in records[0].source_payload,false);

state.data={...fixtureData(),sourceMetrics:[{source_record_id:'mfp-water:2026-09-07',metric_date:'2026-09-07',value:1}]};
const progress=[];
await importMyFitnessPalWaterExport(parsed,{batchSize:1,onProgress:value=>progress.push(value.imported)});
await importMyFitnessPalWaterExport(parsed,{batchSize:1});
const imported=state.data.sourceMetrics.filter(row=>row.source_record_id?.startsWith('mfp-water:'));
assert.equal(imported.length,2);
assert.equal(imported.find(row=>row.metric_date==='2026-09-07')?.value,700);
assert.deepEqual(progress,[2]);

const bookmarklet=buildMyFitnessPalWaterBookmarklet();
assert.ok(bookmarklet.startsWith('javascript:'));
assert.ok(bookmarklet.includes('/food/water?date='));
assert.ok(bookmarklet.includes("credentials:'include'"));
assert.ok(bookmarklet.includes(MFP_WATER_CHECKPOINT_KEY));
assert.ok(bookmarklet.includes("status='complete'"));
assert.ok(bookmarklet.length<50000,`bookmarklet unexpectedly large: ${bookmarklet.length}`);
assert.equal(/password|\bemail\b|food\/diary/i.test(bookmarklet),false);
assert.doesNotThrow(()=>new Function(bookmarklet.replace(/^javascript:/,'')));

const stored=new Map(),nodes=new Map();
class FakeNode{
  constructor(tag='div'){this.tag=tag;this.style={};this.hidden=false;this.disabled=false;this.textContent='';this.id='';this.onclick=null;}
  setAttribute(){}
  remove(){if(this.id)nodes.delete(this.id);}
  scrollIntoView(){}
  querySelector(selector){return this.children?.get(selector)||null;}
}
const documentMock={
  body:{appendChild(node){if(node.id)nodes.set(node.id,node);}},
  getElementById(id){return nodes.get(id)||null;},
  createElement(tag){
    const node=new FakeNode(tag);
    if(tag==='section'){
      node.children=new Map(['#lts-mfp-status','#lts-mfp-detail','#lts-mfp-progress','#lts-mfp-pause','#lts-mfp-save','#lts-mfp-close','#lts-mfp-restart'].map(selector=>[selector,new FakeNode()]));
    }
    return node;
  }
};
Object.assign(globalThis,{
  window:globalThis,
  document:documentMock,
  location:{hostname:'www.myfitnesspal.com'},
  localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},
  alert:message=>{throw new Error(`unexpected alert: ${message}`);},
  confirm:()=>true
});
const prompts=['2026-09-06','2026-09-08'];
globalThis.prompt=()=>prompts.shift()??null;
const requestOptions=[];
globalThis.fetch=async(url,options)=>{
  requestOptions.push({url,options});
  const date=new URL(String(url),'https://www.myfitnesspal.com').searchParams.get('date');
  const water={'2026-09-06':0,'2026-09-07':700,'2026-09-08':2500}[date];
  return{ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({item:{date,milliliters:water}})};
};
mfpWaterBookmarkletMain();
for(let tries=0;tries<100;tries++){
  const checkpoint=JSON.parse(stored.get(MFP_WATER_CHECKPOINT_KEY)||'null');
  if(checkpoint?.status==='complete')break;
  await new Promise(resolve=>setTimeout(resolve,10));
}
const checkpoint=JSON.parse(stored.get(MFP_WATER_CHECKPOINT_KEY));
assert.equal(checkpoint.status,'complete');
assert.deepEqual(checkpoint.rows,[{date:'2026-09-07',water_ml:700},{date:'2026-09-08',water_ml:2500}]);
assert.equal(requestOptions.length,3);
assert.ok(requestOptions.every(request=>request.options.credentials==='include'));
assert.equal(nodes.get('lts-mfp-water-extractor')?.querySelector('#lts-mfp-save')?.hidden,false);

globalThis.prompt=()=>{throw new Error('completed extraction should not ask for dates again');};
mfpWaterBookmarkletMain();
await new Promise(resolve=>setTimeout(resolve,10));
assert.match(nodes.get('lts-mfp-water-extractor')?.querySelector('#lts-mfp-status')?.textContent||'',/já concluída/);

const installer=await fs.readFile(new URL('./mfp-water-extractor.html',import.meta.url),'utf8');
for(const contract of ['Use o notebook','Copiar link para o notebook','Copiar código do extrator','01/01/2018','pausa e retomada','não lê senha','não instala aplicativo nem extensão','mfp-water-extractor.js'])assert.ok(installer.includes(contract),`installer missing ${contract}`);
const migration=await fs.readFile(new URL('../supabase/migrations/20260908223000_allow_authenticated_mfp_water_export.sql',import.meta.url),'utf8');
for(const contract of ["confidence = 'account_authenticated_export'","source_payload ->> 'entry_method' = 'mfp_authenticated_water_export_v1'","source_payload ->> 'export_schema' = 'lts-health-mfp-water-export'","confidence = 'user_confirmed'"])assert.ok(migration.includes(contract),`migration missing ${contract}`);

console.log('LTS Health MyFitnessPal water transfer contract passed');
