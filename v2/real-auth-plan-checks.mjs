// Read-only checks in the existing protected real-auth workflow. Never log
// source text, medication names, documentary targets or private record IDs.
export async function verifyDocumentedPlanFlows(page,navigate){
 await navigate('treinos');await page.locator('[data-depth-training-view="plan"]').click();await page.waitForSelector('[data-training-plan-state="ready"]');
 const training=await page.evaluate(async()=>{const {state}=await import('./src/core.js'),{documentedTrainingPlan}=await import('./src/documented-training-plan.js');const rows=state.data.trainingPlans||[],latest=rows.slice().sort((a,b)=>b.document_date.localeCompare(a.document_date))[0],p=documentedTrainingPlan(latest);return Boolean(p&&p.clinical_start===null&&document.querySelector('.planReview')?.textContent.includes(p.author)&&document.querySelectorAll('.planReviewExercise').length===p.sessions[0].exercises.length&&state.domainStatus.trainingPlans==='ready');});
 if(!training)throw Error('Real received training plan did not match the protected source projection');
 await navigate('nutricao');await page.waitForSelector('.nutritionPlanExpanded');
 if(!await page.locator('[data-plan-metric="protein_g"]').isVisible()||await page.locator('[data-plan-metric]').count()!==6)throw Error('Real dietary comparison is not visible');
 await navigate('tratamentos');await page.waitForSelector('[data-current-treatment-status="ready"]');
 const status=await page.evaluate(async()=>{const {state}=await import('./src/core.js'),{documentedTreatmentStatus}=await import('./src/documented-training-plan.js');const rows=state.data.treatmentStatuses||[],latest=rows.slice().sort((a,b)=>b.document_date.localeCompare(a.document_date))[0],s=documentedTreatmentStatus(latest),root=document.querySelector('[data-current-treatment-status="ready"]');return Boolean(s&&s.in_use.every(name=>root?.textContent.includes(name))&&root?.querySelectorAll('.planReviewFacts article').length===s.in_use.length&&s.other_protocol_medications==='not_started'&&s.effective_start===null);});
 if(!status)throw Error('Real current-use statement is not reflected independently of prescriptions and applications');
}
