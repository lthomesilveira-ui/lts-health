import assert from 'node:assert/strict';
import {documentedTrainingPlan,documentedTreatmentStatus,selectPlanRecord,trainingPlanComparison} from '../src/documented-training-plan.js';
import {renderTrainingPlan,renderCurrentTreatmentStatus} from '../src/training-plan-view.js';
import {PLAN_TODAY,syntheticTrainingPlan,syntheticTreatmentStatus,syntheticPlanData} from './training-plan-fixture.mjs';
const clone=structuredClone;
const f=syntheticPlanData(),before=JSON.stringify(f),m=trainingPlanComparison(f.data,f.status,{},PLAN_TODAY);
assert.equal(m.state,'ready');assert.equal(m.plan.clinical_start,null);assert.equal(m.weeklyCount,0);assert.equal(m.rows[0].working,2);assert.deepEqual(m.rows[0].reps,[10,6]);assert.equal(m.rows[0].outsideRange,1);assert.equal(m.rows[1].working,null);assert.equal(m.rows[1].unknownPhases,1);assert.equal(m.failure,1);assert.equal(m.extensions,1);assert.equal(JSON.stringify(f),before);
assert.match(renderTrainingPlan(f.data,f.status,{},PLAN_TODAY),/início não confirmado/);
for(const key of ['workouts','exercises','sets','trainingPlans']){
  const fail=trainingPlanComparison(f.data,{...f.status,[key]:'error'},{},PLAN_TODAY);
  if(key==='trainingPlans')assert.equal(fail.plan,null);
  else if(key==='workouts')assert.equal(fail.weeklyCount,null);
  else assert.ok(fail.rows.every(r=>r.working===null));
}
for(const mutate of [p=>p.source_sha256='a'.repeat(64),p=>p.verification.pages=[1],p=>p.clinical_start='2026-01-26',p=>p.sessions[0].exercises[0].sets=-2]){
  const r=syntheticTrainingPlan();mutate(r.training_plan);assert.equal(documentedTrainingPlan(r),null);
  assert.equal(selectPlanRecord([r],'ready',PLAN_TODAY,'training_plan',documentedTrainingPlan).state,'invalid');
}
const old=syntheticTrainingPlan(),bad=clone(old);bad.source_record_id='synthetic-newest';bad.document_date=PLAN_TODAY;bad.training_plan.source_sha256='f'.repeat(64);
assert.equal(selectPlanRecord([old,bad],'ready',PLAN_TODAY,'training_plan',documentedTrainingPlan).value,null);
assert.equal(selectPlanRecord([old,clone(old)],'ready',PLAN_TODAY,'training_plan',documentedTrainingPlan).state,'invalid');
const conflict=clone(f);conflict.data.exercises.push({...conflict.data.exercises[0],machine:'conflicting machine'});assert.equal(trainingPlanComparison(conflict.data,conflict.status,{},PLAN_TODAY).rows[0].exercise,null);
const sameLink=trainingPlanComparison(f.data,f.status,{trainingPlanLinks:{A1:'synthetic-ex-a',A2:'synthetic-ex-a'}},PLAN_TODAY);assert.ok(sameLink.rows.every(r=>r.exercise===null));
const wrongParent=clone(f);wrongParent.data.sets[1].workout_source_record_id='wrong';assert.equal(trainingPlanComparison(wrongParent.data,wrongParent.status,{},PLAN_TODAY).rows[0].working,1);
const manual=clone(f);manual.data.exercises[0].exercise='Different literal name';assert.equal(trainingPlanComparison(manual.data,manual.status,{},PLAN_TODAY).rows[0].exercise,null);assert.equal(trainingPlanComparison(manual.data,manual.status,{trainingPlanLinks:{A1:'synthetic-ex-a'}},PLAN_TODAY).rows[0].working,2);
const historic=trainingPlanComparison(f.data,f.status,{trainingPlanWeek:'2026-01-12'},PLAN_TODAY);assert.equal(historic.historical,true);assert.equal(historic.plan.initial_rir[0],3);
const chosenMissing=trainingPlanComparison(f.data,f.status,{trainingPlanWorkout:'missing'},PLAN_TODAY);assert.equal(chosenMissing.workout,null);assert.ok(chosenMissing.rows.every(r=>!r.exercise));
const p=syntheticTrainingPlan();p.training_plan.raw_secret='Synthetic private field';p.training_plan.sessions[0].raw_secret='Synthetic private field';assert.ok(!JSON.stringify(documentedTrainingPlan(p)).includes('raw_secret'));
const status=syntheticTreatmentStatus();assert.deepEqual(documentedTreatmentStatus(status).in_use,['Item Alpha','Item Beta','Item Gama']);assert.equal(documentedTreatmentStatus(status).effective_start,null);
status.treatment_status.effective_start='2020-01-01';assert.equal(documentedTreatmentStatus(status),null);
assert.match(renderCurrentTreatmentStatus(f.data,f.status,PLAN_TODAY),/ainda não iniciadas/);assert.match(renderCurrentTreatmentStatus(f.data,{...f.status,treatmentStatuses:'error'},PLAN_TODAY),/não carregou/);
const injection=clone(f);injection.data.trainingPlans[0].training_plan.author='<img src=x onerror=alert(1)>';assert.doesNotMatch(renderTrainingPlan(injection.data,injection.status,{},PLAN_TODAY),/<img src=x/);
console.log('Documentary training comparison: source/date binding, no automatic start, exact/manual matches, duplicate/parent failures, phases, extensions, missing data, status snapshot and escaping passed.');
