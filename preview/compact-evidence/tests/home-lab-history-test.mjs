import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {homeLabHistory}=await import('../src/home-lab-history.js');
const row=(date,value,extra={})=>({source_record_id:`synthetic:${date}`,collection_date:date,biomarker:'Hematócrito',result_numeric:value,unit:'%',laboratory:'Synthetic lab',method:'Synthetic method',reference_range:'30 a 45',...extra});
const old=row('2025-01-01',40),latest=row('2025-05-01',42),data={labs:[old,latest],waterReferences:[{source_record_id:'synthetic-doc',source_file:'Synthetic.pdf',document_date:'2025-05-02',document_type:'care_followup',extraction_status:'extracted',confidence:'high',clinical_baseline:{collection_date:'2025-05-01',hematocrit_pct:42}}]},status={labs:'ready',waterReferences:'ready'},m={today:'2025-05-03',bounds:{start:'2025-02-03',end:'2025-05-03'},labs:{latestRows:[latest]}};
const original=JSON.stringify(data);let r=homeLabHistory(data,status,m);assert.equal(r.selected.delta,2);assert.equal(r.selected.comparable,true);assert.equal(r.selected.priorOutside,true);assert.equal(r.selected.periodHistory.length,1);assert.equal(r.selected.document.date,'2025-05-02');
r=homeLabHistory({...data,labs:[{...old,method:null},latest]},status,m);assert.equal(r.selected.comparable,false);assert.equal(r.selected.history.length,2);assert.equal(r.selected.delta,2);
r=homeLabHistory({...data,labs:[{...old,unit:'g/dL'},latest]},status,m);assert.equal(r.selected.previous,null);
r=homeLabHistory({...data,labs:[old,latest,{...latest,source_record_id:'duplicate'}]},status,m);assert.equal(r.selected,null);
r=homeLabHistory(data,status,m,{homeLabKey:'absent'});assert.equal(r.selected,null);assert.equal(r.requestedMissing,true);
r=homeLabHistory(data,{...status,labs:'error'},m);assert.equal(r.selected,null);assert.equal(r.available,false);
r=homeLabHistory(data,{...status,waterReferences:'error'},m);assert.equal(r.selected.document,null);
r=homeLabHistory({...data,waterReferences:[{...data.waterReferences[0],clinical_baseline:{collection_date:'2025-05-01',hematocrit_pct:999}}]},status,m);assert.equal(r.selected.document,null);
assert.equal(JSON.stringify(data),original);console.log('Lab history: exact marker/unit/lab identity, method evidence, outside-period context, ambiguity, documentary match, explicit missing selection and immutability passed.');

r=homeLabHistory({...data,labs:[old,{...latest,result_raw:'<42'}]},status,m);assert.equal(r.selected,null);
for(const patch of [{confidence:'low'},{extraction_status:'pending'},{document_date:'2025-04-30'},{document_date:'2025-05-10'}]){r=homeLabHistory({...data,waterReferences:[{...data.waterReferences[0],...patch}]},status,m);assert.equal(r.selected.document,null);}
const other={...latest,source_record_id:'other',collection_date:'2025-05-02',biomarker:'Other'};r=homeLabHistory({...data,labs:[old,latest,other]},status,{...m,labs:{latestRows:[other]}},{homeLabKey:JSON.stringify(['hematocrito','synthetic lab','%','old method'])});assert.equal(r.selected.row.collection_date,'2025-05-01');

r=homeLabHistory({...data,labs:[{...old,unit:'mU/L'},{...latest,unit:'MU/L'}]},status,{...m,labs:{latestRows:[{...latest,unit:'MU/L'}]}});assert.equal(r.selected.previous,null,'SI prefix case cannot collapse');
