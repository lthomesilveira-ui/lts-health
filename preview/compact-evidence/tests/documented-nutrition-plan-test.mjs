import assert from 'node:assert/strict';
import {test} from 'node:test';
import {documentedNutritionPlanProjection,documentedNutritionPlan,documentedNutritionPlanForDate,selectDocumentedNutritionPlan} from '../src/documented-nutrition-plan.js';
import {syntheticNutritionPlanRow,testToday} from './documented-nutrition-plan-fixture.mjs';
const validate=mutate=>{const row=syntheticNutritionPlanRow();mutate(row);return documentedNutritionPlan(row);};
const select=(rows,day=testToday,status='ready')=>selectDocumentedNutritionPlan(rows,day,status);

test('Loader projection has one bounded display payload and no raw document',()=>{
  assert.equal(documentedNutritionPlanProjection,'source_record_id,document_date,document_type,source_file,source,checksum,extraction_status,confidence,nutrition_plan:source_payload->nutrition_plan_ui');
  assert.doesNotMatch(documentedNutritionPlanProjection,/(?:^|,)source_payload(?:,|$)|raw_text|clinical_context|medication|library_file_id/);
});
test('Validation preserves exact declared values, references and unknown clinical start',()=>{
  const row=syntheticNutritionPlanRow(),plan=documentedNutritionPlan(row);assert.ok(plan);
  for(const key of ['daily_targets','meals','alternatives','substitutions','notes','arithmetic_notes','author','verification'])assert.deepEqual(plan[key],row.nutrition_plan[key]);
  assert.equal(plan.sourceRecordId,row.source_record_id);assert.equal(plan.source_file,row.source_file);assert.equal(plan.checksum,row.checksum);assert.equal(plan.documentDate,row.document_date);
  assert.equal(plan.clinical_start,null);assert.equal(plan.clinicalStart,null);assert.equal(plan.clinicalStartNote,'Início de uso não informado');assert.equal(plan.dateBasis,'received_document');
  assert.equal(plan.daily_targets.calories_kcal.value,2000,'Do not replace source targets by meal sums');
  for(const key of ['effectiveFrom','effective_from','goal','row','source_payload','medical_context','clinicalValidity'])assert.equal(Object.hasOwn(plan,key),false);
});
test('Row identity, document type, date, source file and checksum are mandatory',()=>{
  for(const [key,values]of Object.entries({source_record_id:['',' ',null,4],source_file:['',' ',null],checksum:['','x'.repeat(64),'A'.repeat(64),null],document_date:['2024-02-30','2024-03-01T12:00:00Z','',null],document_type:['medical_plan','care_followup',null]}))for(const value of values)assert.equal(validate(row=>row[key]=value),null,`${key} ${value}`);
  for(const value of [undefined,null,{},[],true,'{}'])assert.equal(validate(row=>row.nutrition_plan=value),null);
  assert.equal(validate(row=>row.source=null).source,'Synthetic nutrition plan.pdf');
});
test('Payload identity/date/hash bindings and documentary-only semantics fail closed',()=>{
  const changes={schema_version:[2,'1'],type:['personal_goal'],source_record_id:['another-id',''],source_sha256:['b'.repeat(64),''],documented_on:['2024-03-02','2024-02-30'],received_on:[null,'','2024-02-30'],clinical_start:['2024-03-01','not_explicit',undefined],clinical_start_status:['active','unknown',undefined],page_count:[0,-1,1.5,'2',Infinity]};
  for(const [key,values]of Object.entries(changes))for(const value of values)assert.equal(validate(row=>row.nutrition_plan[key]=value),null,`${key} ${value}`);
});
test('Source verification covers every page exactly once and all refs stay in range',()=>{
  for(const pages of [[],[1],[1,1],[0,1],[1,3],['1',2],[1,2,3],null])assert.equal(validate(row=>row.nutrition_plan.verification.pages=pages),null);
  assert.equal(validate(row=>row.nutrition_plan.verification.status='unverified'),null);
  for(const get of [plan=>plan.author.source_pages,plan=>plan.daily_targets.protein_g.pages,plan=>plan.meals[0].source_pages,plan=>plan.alternatives[0].source_pages,plan=>plan.notes[0].source_pages,plan=>plan.substitutions[0].source_pages]){
    assert.equal(validate(row=>get(row.nutrition_plan).push(3)),null);
    assert.equal(validate(row=>get(row.nutrition_plan).push(get(row.nutrition_plan)[0])),null);
  }
  assert.ok(validate(row=>row.nutrition_plan.verification.pages.reverse()),'Page order does not alter coverage');
});
test('Printed logo attribution cannot become a verified signature',()=>{
  for(const patch of [{name:''},{identification_basis:'signature'},{signature_verified:true},{signature_verified:null},{source_pages:[]}])assert.equal(validate(row=>Object.assign(row.nutrition_plan.author,patch)),null);
});
test('Six strictly positive documentary targets keep their declared units and decimals',()=>{
  const keys=Object.keys(syntheticNutritionPlanRow().nutrition_plan.daily_targets);
  for(const key of keys){
    for(const value of [0,-1,null,'12',false,true,Infinity,NaN,[],{}])assert.equal(validate(row=>row.nutrition_plan.daily_targets[key].value=value),null,`${key} ${value}`);
    assert.equal(validate(row=>delete row.nutrition_plan.daily_targets[key]),null);
    assert.equal(validate(row=>row.nutrition_plan.daily_targets[key].unit='wrong'),null);
  }
  const plan=validate(row=>row.nutrition_plan.daily_targets.protein_g.value=123.4567);assert.equal(plan.daily_targets.protein_g.value,123.4567);
});
test('Meals, items, totals and alternative replacement identities are fully checked',()=>{
  for(const change of [p=>p.meals=[],p=>p.meals[0].id='',p=>p.meals.push(structuredClone(p.meals[0])),p=>p.meals[0].time='25:00',p=>p.meals[0].time='8:00',p=>delete p.meals[0].time,p=>p.meals[0].items=[],p=>p.meals[0].items[0].quantity=0,p=>p.meals[0].items[0].quantity='80',p=>p.meals[0].items[0].unit='kg',p=>p.meals[0].items[0].name='',p=>p.meals[0].totals.protein_g=null,p=>p.meals[0].totals.calories_kcal=-1,p=>p.meals[0].notes='text',p=>p.alternatives[0].replaces_meal_id='missing',p=>p.alternatives[0].totals.protein_g=null,p=>p.alternatives[0].totals.fiber_g=-1,p=>p.substitutions[0].text='',p=>p.notes[0].text=3,p=>p.arithmetic_notes=[null]])assert.equal(validate(row=>change(row.nutrition_plan)),null);
  assert.ok(validate(row=>row.nutrition_plan.meals[0].time=null));
  assert.ok(validate(row=>row.nutrition_plan.meals[0].totals.fiber_g=0));
  assert.equal(validate(row=>row.nutrition_plan.alternatives[0].totals.fiber_g=null).alternatives[0].totals.fiber_g,null);
});
test('Unknown/raw payload and extra clinical fields never survive normalization',()=>{
  const row=syntheticNutritionPlanRow();row.source_payload={private_context:'Do not return'};row.nutrition_plan.raw_text='Do not return';row.nutrition_plan.medication_advice='Do not return';row.nutrition_plan.author.private_id='Do not return';row.nutrition_plan.meals[0].items[0].private_context='Do not return';
  assert.doesNotMatch(JSON.stringify(documentedNutritionPlan(row)),/Do not return|private_context|private_id|raw_text|medication_advice/);
});
test('Latest eligible version is selected; future documents and future receipts are excluded',()=>{
  const older=syntheticNutritionPlanRow('2024-02-01','synthetic-old'),latest=syntheticNutritionPlanRow('2024-03-05','synthetic-new','b'.repeat(64)),future=syntheticNutritionPlanRow('2024-03-09','synthetic-future');
  assert.equal(select([older,latest,future]).plan.sourceRecordId,'synthetic-new');assert.equal(select([older,latest],'2024-03-04').plan.sourceRecordId,'synthetic-old');
  assert.equal(select([future]).state,'empty');latest.nutrition_plan.received_on='2024-03-09';assert.equal(select([older,latest]).plan.sourceRecordId,'synthetic-old');
});
test('Malformed newest version, unorderable dates and duplicate identities never fall back',()=>{
  const older=syntheticNutritionPlanRow('2024-02-01','synthetic-old'),newer=syntheticNutritionPlanRow('2024-03-05','synthetic-new');
  for(const change of [row=>row.nutrition_plan={},row=>row.nutrition_plan=null,row=>row.source_file='',row=>row.document_date=null,row=>row.nutrition_plan.source_record_id='bad']){const bad=structuredClone(newer);change(bad);const result=select([older,bad]);assert.equal(result.state,'invalid');assert.equal(result.plan,null);}
  for(const rows of [[newer,newer],[newer,{...newer,source_record_id:'another'}],[older,syntheticNutritionPlanRow('2024-03-05','synthetic-old')]])assert.equal(select(rows).state,'invalid');
  assert.equal(select([older,{...newer,document_type:'medical_plan',nutrition_plan:null}]).plan.sourceRecordId,'synthetic-old');
});
test('Domain state is explicit and input data is not mutated or aliased',()=>{
  const row=syntheticNutritionPlanRow(),before=structuredClone(row);for(const status of [undefined,null,'loading','idle'])assert.equal(selectDocumentedNutritionPlan([row],testToday,status).state,'loading');
  assert.equal(select([row],testToday,'error').state,'error');assert.equal(select([]).state,'empty');assert.equal(select({},testToday).state,'invalid');assert.equal(select([row],'invalid').state,'invalid');
  assert.equal(documentedNutritionPlanForDate([row],testToday,'ready').sourceRecordId,row.source_record_id);assert.equal(documentedNutritionPlanForDate([row],testToday,'error'),null);
  const plan=documentedNutritionPlan(row);plan.meals[0].items[0].name='Changed normalized copy';plan.verification.pages.push(99);plan.daily_targets.protein_g.pages.push(99);assert.deepEqual(row,before);
});
