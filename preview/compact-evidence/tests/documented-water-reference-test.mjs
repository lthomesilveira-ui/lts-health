import assert from 'node:assert/strict';
import {test} from 'node:test';
import {documentedWaterProjection,documentedWaterReference,documentedWaterReferenceForDate,recordedWaterDifference} from '../src/documented-water-reference.js';

const hash='a'.repeat(64),docDate='2025-03-13',today='2025-03-20';
const payload={schema_version:1,type:'documented_water_base',base_ml_per_day:3000,source_page:3,source_sha256:hash,documented_on:docDate,date_basis:'document_update',clinical_start:'not_explicit',exercise_addition:'Synthetic exercise context; not calculated automatically.'};
const row={source_record_id:'synthetic:document:version-1',document_date:docDate,document_type:'medical_plan',source_file:'Synthetic prescription.pdf',source:'Synthetic physician',checksum:hash,water_reference:payload};
const select=(rows=[row],day=today,status='ready')=>documentedWaterReferenceForDate(rows,day,status);

test('The loader projection is bounded and excludes raw clinical payload',()=>{
  assert.equal(documentedWaterProjection,'source_record_id,document_date,document_type,source_file,source,checksum,water_reference:source_payload->water_reference_ui');
  assert.doesNotMatch(documentedWaterProjection,/(?:^|,)source_payload(?:,|$)|raw_text|plan|physician|library_file_id|care_ui/);
});
test('Document identity, checksum, date and page survive normalization without clinical effective date',()=>{
  const r=documentedWaterReference(row);assert.equal(r.value,3000);assert.equal(r.sourceRecordId,row.source_record_id);assert.equal(r.checksum,hash);assert.equal(r.sourcePage,3);assert.equal(r.documentDate,docDate);assert.equal(r.documentedOn,docDate);assert.equal(r.dateBasis,'document_update');assert.equal(r.clinicalStart,'not_explicit');assert.equal(r.sourceFile,row.source_file);assert.match(r.notes,/início clínico não explicitado/);
  assert.equal('effectiveFrom' in r,false);assert.equal('effective_from' in r,false);assert.equal('goal' in r,false);assert.equal('row' in r,false);
});
test('Reference displays without any intake record; a difference does not',()=>{
  assert.equal(select().value,3000);assert.equal(recordedWaterDifference(null,select()),null);
});
test('Ready status is explicit, independent of goal-loading state',()=>{
  for(const status of [undefined,null,'error','loading','unavailable'])assert.equal(documentedWaterReferenceForDate([row],today,status),null);
  assert.equal(documentedWaterReferenceForDate([row],today),null);
});
test('No future document or retroactive difference is introduced',()=>{
  assert.equal(select([row],'2025-03-12'),null);assert.equal(select([row],docDate).value,3000);
  assert.equal(recordedWaterDifference({date:'2025-03-12',value:2000},select()),null);
  assert.equal(recordedWaterDifference({date:'2025-03-21',value:2000},select()),null);
});
test('Numeric difference is only a documented reference, not adequacy or exercise need',()=>{
  const diff=recordedWaterDifference({date:'2025-03-15',value:1800},select());assert.deepEqual(diff,{recordedDate:'2025-03-15',recordedValue:1800,documentDate:docDate,baseValue:3000,delta:-1200,basis:'documentary_reference',partialRecordPossible:true});
  for(const key of ['adequate','achieved','remaining','percentage','clinicalTarget','exerciseTarget'])assert.equal(key in diff,false);
  assert.equal(recordedWaterDifference({date:today,value:1800,duration_minutes:180},select()).baseValue,3000);
});
test('Explicit zero is preserved, missing/invalid values never become zero',()=>{
  assert.equal(recordedWaterDifference({date:today,value:0},select()).delta,-3000);
  for(const value of [null,undefined,'',true,false,-1,Infinity,NaN,'1800'])assert.equal(recordedWaterDifference({date:today,value},select()),null);
});
test('Source metadata is required and care_followup is not used as a prescription',()=>{
  for(const patch of [{source_record_id:''},{source_file:' '},{checksum:''},{checksum:'x'.repeat(64)},{document_date:'invalid'},{document_date:'2025-03-13T00:00:00Z'},{document_type:'care_followup'}])assert.equal(documentedWaterReference({...row,...patch}),null);
  assert.equal(documentedWaterReference({...row,source:null}).source,row.source_file);
});
test('Malformed projection, mismatched checksum/date and unsupported clinical interpretation fail closed',()=>{
  for(const patch of [{schema_version:2},{type:'personal_target'},{base_ml_per_day:true},{base_ml_per_day:'3000'},{base_ml_per_day:0},{base_ml_per_day:-1},{base_ml_per_day:NaN},{source_page:'3'},{source_page:0},{source_page:-1},{source_page:1.5},{source_sha256:'b'.repeat(64)},{documented_on:'2025-03-14'},{date_basis:'clinical_start'},{clinical_start:'2025-03-13'},{exercise_addition:''}])assert.equal(documentedWaterReference({...row,water_reference:{...payload,...patch}}),null);
  for(const water_reference of [null,undefined,[],true,'{}'])assert.equal(documentedWaterReference({...row,water_reference}),null);
});
test('Latest eligible documentary version is chosen, without accepting ambiguous same-day records',()=>{
  const newer={...row,source_record_id:'synthetic:document:version-2',document_date:'2025-03-16',checksum:'b'.repeat(64),water_reference:{...payload,base_ml_per_day:2800,documented_on:'2025-03-16',source_sha256:'b'.repeat(64)}};
  assert.equal(select([row,newer],'2025-03-15').value,3000);assert.equal(select([row,newer]).value,2800);
  assert.equal(select([row,row]),null);assert.equal(select([row,{...row,source_record_id:'another-document'}]),null);
  assert.equal(select([row,{...newer,source_record_id:row.source_record_id}]),null);
});
test('Malformed newer water projection blocks fallback; unrelated follow-up and plan are separate',()=>{
  const newer={...row,source_record_id:'synthetic:newer',document_date:'2025-03-17',water_reference:{}};
  assert.equal(select([row,newer]),null);
  const followup={...row,document_type:'care_followup',document_date:'2025-03-19',water_reference:{}};
  const unrelated={...row,document_date:'2025-03-19',water_reference:null};
  assert.equal(select([row,followup,unrelated]).value,3000);
});
test('Source strings are data, and all inputs remain unchanged',()=>{
  const hostile={...row,source_file:'<script>synthetic</script>.pdf'},before=structuredClone(hostile);const normalized=documentedWaterReference(hostile);
  assert.match(normalized.notes,/<script>/,'renderer must escape plain text, never interpret it as HTML');
  select([hostile]);recordedWaterDifference({date:today,value:2000},select([hostile]));assert.deepEqual(hostile,before);
});
test('Malformed selection inputs return no reference',()=>{
  for(const rows of [null,undefined,{},''])assert.equal(documentedWaterReferenceForDate(rows,today,'ready'),null);
  for(const day of [null,undefined,'','2025-02-30','2025-03-20T12:00:00Z'])assert.equal(documentedWaterReferenceForDate([row],day,'ready'),null);
});
