import assert from 'node:assert/strict';
import {planOriginalUrl,renderPlanOriginalLink} from '../src/plan-original-link.js';
import {documentedTrainingPlan} from '../src/documented-training-plan.js';
import {documentedNutritionPlan} from '../src/documented-nutrition-plan.js';
import {renderTrainingPlan} from '../src/training-plan-view.js';
import {syntheticTrainingPlan,syntheticPlanData,PLAN_TODAY} from './training-plan-fixture.mjs';
import {syntheticNutritionPlanRow} from './documented-nutrition-plan-fixture.mjs';

const id='libfile_'+'0'.repeat(31)+'1',training=syntheticTrainingPlan();
training.source_record_id=`library:${id}:training-plan`;
training.training_plan.source_record_id=training.source_record_id;
const plan=documentedTrainingPlan(training),before=JSON.stringify(plan);
assert.equal(planOriginalUrl(plan),`https://chatgpt.com/library?file_id=${id}&account_id=personal`);
const html=renderPlanOriginalLink(plan);
for(const token of ['target="_blank"','rel="noopener noreferrer"','referrerpolicy="no-referrer"','&amp;account_id=personal','Abrir PDF original no ChatGPT','pode pedir acesso à sua conta'])assert.ok(html.includes(token));
assert.equal(JSON.stringify(plan),before,'link generation never mutates the source-backed plan');
const nutrition=documentedNutritionPlan(syntheticNutritionPlanRow('2024-03-01',`library:${id}:nutrition-plan`));
assert.ok(planOriginalUrl(nutrition)?.endsWith('&account_id=personal'));
for(const change of [
 p=>p.type='patient_confirmed_treatment_status',p=>p.source_record_id=`library:${id}:nutrition-plan`,
 p=>p.source_record_id='https://example.test/private.pdf',p=>p.source_record_id=`library:${id}:training-plan?redirect=https://example.test`,
 p=>p.source_record_id=`library:${id}:training-plan\"><script>`,p=>p.source_sha256=null,p=>p.source_file='inventory.csv',
 p=>p.verification.status='pending',p=>p.verification.pages=[1,1],p=>p.verification.pages=[0,2],p=>p.page_count=0
]){
 const broken=structuredClone(plan);change(broken);assert.equal(planOriginalUrl(broken),null);assert.equal(renderPlanOriginalLink(broken),'');
}
assert.equal(renderPlanOriginalLink(undefined),'');
assert.equal(renderPlanOriginalLink(documentedTrainingPlan(syntheticTrainingPlan())),'','inventory or a non-Library source has no guessed link');
const fixture=syntheticPlanData();fixture.data.trainingPlans=[training];
assert.match(renderTrainingPlan(fixture.data,fixture.status,{},PLAN_TODAY),/data-plan-original="training-plan"/);
assert.doesNotMatch(renderTrainingPlan(fixture.data,{...fixture.status,trainingPlans:'error'},{},PLAN_TODAY),/data-plan-original/);
fixture.data.trainingPlans.push({...structuredClone(training),document_date:PLAN_TODAY,training_plan:{...training.training_plan,source_sha256:'f'.repeat(64)}});
assert.doesNotMatch(renderTrainingPlan(fixture.data,fixture.status,{},PLAN_TODAY),/data-plan-original/,'invalid newest plan never leaks an older original link');
console.log('Private original-plan links: validated identity, fixed destination, external-account notice, invalid/latest/read-failure guards and nonmutation passed.');
