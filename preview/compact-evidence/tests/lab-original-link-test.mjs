import assert from 'node:assert/strict';
import {attachLabOriginals,labOriginalUrl,renderLabOriginalLink,labOriginalDocumentColumns} from '../src/lab-original-link.js';
import {labOriginalFixture,einsteinOriginalFixture,LAB_ORIGINAL_ID,EINSTEIN_ORIGINAL_ID} from './lab-original-fixture.mjs';
globalThis.location={search:'?fixture=1'};
const {fetchLaboratoryRows}=await import('../src/data-layer.js');
const {state}=await import('../src/core.js');
const {renderProductLabs}=await import('../src/labs-layout-v2.js');
const {row,document}=labOriginalFixture(),before=structuredClone({row,document});
const [valid]=attachLabOriginals([row],[document]);
assert.equal(labOriginalUrl(valid),`https://chatgpt.com/library?file_id=${LAB_ORIGINAL_ID}&account_id=personal`);
for(const token of ['data-lab-original','target="_blank"','rel="noopener noreferrer"','referrerpolicy="no-referrer"','Página 3 de 8','pode pedir acesso à sua conta'])assert.ok(renderLabOriginalLink(valid).includes(token));
const cases=[
 ['row',r=>r.source='Inventory'],['row',r=>r.laboratory='Other'],['row',r=>r.confidence='medium'],['row',r=>r.source_record_id='inventory-row'],
 ['row',r=>r.collection_date='2026-02-30'],['row',r=>r.original_date_kind='historical_table'],['row',r=>r.original_import_version='unreviewed'],
 ['row',r=>r.original_file_id='https://example.test/private'],['row',r=>r.original_file_id+='?token=secret'],['row',r=>r.original_sha256='b'.repeat(64)],
 ['row',r=>r.original_page=0],['row',r=>r.original_page=9],['row',r=>r.original_page='3'],['row',r=>r.original_page_count=8.5],['row',r=>r.original_page_count=10001],
 ['row',r=>r.source_file='inventory.txt'],['row',r=>r.source_file='different.pdf'],
 ['document',d=>d.document_type='lab_report'],['document',d=>d.extraction_status='extracted'],['document',d=>d.confidence='low'],
 ['document',d=>d.original_import_version='unknown'],['document',d=>d.source_record_id='inventory'],['document',d=>d.checksum='b'.repeat(64)],
 ['document',d=>d.original_file_id='libfile_'+'f'.repeat(32)],['document',d=>d.original_page_count='8'],['document',d=>d.document_date='2025-01-01']
];
for(const [kind,change]of cases){const f=labOriginalFixture();change(f[kind]);const [r]=attachLabOriginals([f.row],[f.document]);assert.equal(labOriginalUrl(r),null);assert.equal(renderLabOriginalLink(r),'');}
assert.equal(labOriginalUrl(attachLabOriginals([row],[])[0]),null,'missing document cannot fall back to filename');
assert.equal(labOriginalUrl(attachLabOriginals([row],[document,structuredClone(document)])[0]),null,'duplicate original identity is held');
assert.equal(labOriginalUrl(attachLabOriginals([row],[document,{...document,extraction_status:'failed'}])[0]),null,'conflicting document cannot fall back to an earlier valid row');
assert.equal(labOriginalUrl(attachLabOriginals([valid],[document],false)[0]),null,'failed fresh read retires an old derived link');
assert.equal(attachLabOriginals([row],[],false)[0].original_pdf_status,'error');
assert.equal(labOriginalUrl({...valid,original_pdf:{...valid.original_pdf,library_file_id:'bad'}}),null);
assert.deepEqual({row,document},before,'source rows and document metadata never mutate');
const e=einsteinOriginalFixture(),[einstein]=attachLabOriginals([e.row],[e.document]);
assert.equal(labOriginalUrl(einstein),`https://chatgpt.com/library?file_id=${EINSTEIN_ORIGINAL_ID}&account_id=personal`);
assert.match(renderLabOriginalLink(einstein),/Coleta: 02\/01\/2020 · Liberação no laudo: 12\/01\/2020/);
for(const change of [f=>f.row.original_release_date='2020-02-30',f=>f.row.original_release_date='2019-01-01',f=>f.row.original_date_kind='report_release_date',f=>f.row.source_record_id='einstein-inventory',f=>f.document.document_date='2020-01-02',f=>f.document.original_collection_dates=['2021-01-02'],f=>f.document.original_collection_dates=['2020-01-02','2020-01-02'],f=>f.document.original_collection_dates='2020-01-02',f=>f.document.source='Fleury laboratory report',f=>f.document.original_import_version='unreviewed']){
 const f=einsteinOriginalFixture();change(f);assert.equal(labOriginalUrl(attachLabOriginals([f.row],[f.document])[0]),null);
}
const released=einsteinOriginalFixture();released.row.report_date=released.row.original_release_date;released.row.original_date_kind='report_release_date';assert.ok(labOriginalUrl(attachLabOriginals([released.row],[released.document])[0]));

function client({labsError=false,docsError=false}={}){
 const calls=[];return {calls,from(table){let columns,filters={},range;const q={select(v){columns=v;return q;},eq(k,v){filters[k]=v;return q;},range(a,b){range=[a,b];return q;},order(){return q;},then(resolve,reject){calls.push({table,columns,filters,range});const error=table==='health_lab_results'?labsError:docsError;const rows=table==='health_lab_results'?[row]:[document,{...document,document_type:'inventory'}];return Promise.resolve(error?{data:null,error:new Error('synthetic read unavailable')}:{data:rows.filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v)),error:null}).then(resolve,reject);}};return q;}};
}
const c=client(),loaded=await fetchLaboratoryRows(c);assert.equal(loaded.length,1);assert.ok(labOriginalUrl(loaded[0]));
const docCall=c.calls.find(x=>x.table==='health_documents');assert.deepEqual(docCall.filters,{document_type:'laboratory_report'});assert.equal(docCall.columns,labOriginalDocumentColumns);
for(const forbidden of ['contacts','care_ui','raw_text','treatment','*'])assert.ok(!docCall.columns.includes(forbidden),'only bounded original-document metadata is requested');
const partial=await fetchLaboratoryRows(client({docsError:true}));assert.equal(partial[0].result_raw,row.result_raw);assert.equal(partial[0].result_numeric,row.result_numeric);assert.equal(partial[0].original_pdf_status,'error');assert.equal(labOriginalUrl(partial[0]),null);
await assert.rejects(()=>fetchLaboratoryRows(client({labsError:true})),/synthetic read unavailable/);
Object.assign(state.ui,{productLabPeriod:'all',productLabMarker:null,productLabQuery:'',productLabAsOf:null,productLabPage:1});state.domainStatus={labs:'ready'};
state.data={labs:loaded};let html=renderProductLabs();assert.match(html,/data-lab-original/);assert.match(html,/5,25/);
state.data={labs:partial};html=renderProductLabs();assert.doesNotMatch(html,/data-lab-original(?:\s|>)/);assert.match(html,/laudos originais não carregaram agora/);assert.match(html,/5,25/);
state.data={labs:loaded};state.domainStatus.labs='error';assert.doesNotMatch(renderProductLabs(),/data-lab-original/);
console.log('Laboratory originals:26 metadata rejection cases, unique row/document agreement, failed-reader preservation, fixed private destination, bounded projections, source nonmutation and rendered history passed.');
