import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFile(new URL(path,root),'utf8');
const [rawState,brief,architecture,feedback,protocol,master,parity,dataScreen,todayScreen,migration,hardeningMigration,workflow,publicPayloadGuard,browserGateRunner,legacySmoke,timelineSmoke]=await Promise.all([
  read('v2/EXECUTION_STATE.json'),
  read('v2/PROJECT_BRIEF.md'),
  read('v2/PRODUCT_ARCHITECTURE.md'),
  read('v2/FEEDBACK_LEDGER.md'),
  read('v2/CONTINUITY_PROTOCOL.md'),
  read('v2/PROJECT_MASTER.md'),
  read('v2/PARITY_MATRIX.md'),
  read('v2/src/data-screen.js'),
  read('v2/src/today-screen.js'),
  read('supabase/migrations/20260908234500_reconcile_quality_ledger_and_hydration_request.sql'),
  read('supabase/migrations/20260908235500_restrict_mfp_water_request_trigger.sql'),
  read('.github/workflows/architecture-v2.yml'),
  read('v2/public-payload-guard.mjs'),
  read('v2/run-browser-gate.sh'),
  read('.github/workflows/smoke.yml'),
  read('.github/workflows/timeline-smoke.yml')
]);

const state=JSON.parse(rawState),allowed=new Set(['done','in_progress','ready','blocked_user','blocked_external','accepted_gap']);
assert.equal(state.format,'lts-health-execution-state');
assert.equal(state.schema_version,1);
assert.equal(state.scope,'public_project_metadata_only');
assert.ok(Array.isArray(state.tasks)&&state.tasks.length>0);
assert.equal(new Set(state.tasks.map(task=>task.id)).size,state.tasks.length,'task IDs must be unique');
assert.equal([...rawState.matchAll(/"owner"\s*:/g)].length,state.tasks.length,'task owner keys must not be duplicated');

for(const task of state.tasks){
  for(const key of ['id','area','priority','status','owner','summary','acceptance','evidence','next_action','blocker'])assert.ok(Object.hasOwn(task,key),`${task.id||'unknown'} missing ${key}`);
  assert.ok(/^LTS-[A-Z0-9-]+$/.test(task.id),`invalid task ID ${task.id}`);
  assert.ok(allowed.has(task.status),`${task.id} has invalid status ${task.status}`);
  assert.ok(Array.isArray(task.acceptance)&&task.acceptance.length>0,`${task.id} needs acceptance criteria`);
  assert.ok(Array.isArray(task.evidence)&&task.evidence.length>0,`${task.id} needs evidence`);
  if(Object.hasOwn(task,'external_references')){
    assert.ok(Array.isArray(task.external_references)&&task.external_references.length>0,`${task.id} external references must be a non-empty array`);
    for(const reference of task.external_references)assert.match(reference,/^https:\/\/github\.com\/lthomesilveira-ui\/lts-health\/issues\/\d+$/);
  }
  if(task.status==='done')assert.equal(task.blocker,null,`${task.id} done but blocked`);
  if(task.status.startsWith('blocked_')||task.status==='accepted_gap'){
    assert.ok(task.blocker,`${task.id} needs a blocker`);
    assert.ok(task.next_action,`${task.id} needs a next action`);
  }
}

const executable=state.tasks.filter(task=>['ready','in_progress'].includes(task.status));
for(const task of executable)assert.ok(state.current_package.task_ids.includes(task.id),`${task.id} is executable but not owned by the current package`);
if(executable.length)assert.equal(state.current_package.status,'in_progress','executable work requires an in-progress package');
else assert.equal(state.current_package.status,'done','a package without executable work must be done');
const water=state.tasks.find(task=>task.id==='LTS-HYD-IMPORT-001');
assert.equal(water?.status,'blocked_user');
assert.equal(water?.priority,'P0');
assert.match(water?.next_action||'',/notebook/i);
assert.equal(state.reminder.task_id,water.id);
assert.equal(state.reminder.surface_on_each_project_checkpoint,true);
const longitudinal=state.tasks.find(task=>task.id==='LTS-LONGITUDINAL-001');
assert.equal(longitudinal?.status,'done');
assert.equal(longitudinal?.acceptance?.length,6);
assert.deepEqual(longitudinal?.external_references,['https://github.com/lthomesilveira-ui/lts-health/issues/200']);
const notebookUx=state.tasks.find(task=>task.id==='LTS-HYD-NOTEBOOK-UX-001');
assert.equal(notebookUx?.status,'done');
const productArchitecture=state.tasks.find(task=>task.id==='LTS-PRODUCT-ARCH-001');
const experience=state.tasks.find(task=>task.id==='LTS-UX-P0-001');
const domainJourneys=state.tasks.find(task=>task.id==='LTS-DOMAIN-JOURNEYS-001');
for(const task of [productArchitecture,experience,domainJourneys]){
  assert.equal(task?.status,'done',`${task?.id||'product task'} must remain completed`);
}
const longitudinalHome=state.tasks.find(task=>task.id==='LTS-HOME-LONGITUDINAL-001');
assert.equal(longitudinalHome?.status,'in_progress');
assert.equal(state.current_package.id,'PKG-LONGITUDINAL-HOME-UX');
assert.deepEqual(state.current_package.task_ids,[longitudinalHome.id]);
const visualSource=state.tasks.find(task=>task.id==='LTS-VISUAL-SOURCE-001');
assert.equal(visualSource?.status,'blocked_external');
assert.match(visualSource?.blocker||'',/original approved image/i);
assert.equal(state.authoritative_documents.product_architecture,'v2/PRODUCT_ARCHITECTURE.md');
assert.equal(state.authoritative_documents.feedback_ledger,'v2/FEEDBACK_LEDGER.md');

for(const text of [brief,feedback,protocol]){
  assert.match(text,/EXECUTION_STATE\.json/);
}
for(const text of [brief,protocol])assert.match(text,/não depend|sem depender/i);
assert.match(architecture,/assistente longitudinal privado de saúde/i);
assert.match(feedback,/FB-014/);
for(const phrase of ['falta desktop','Somente então promover','validar sessão autenticada com o treino mais recente'])assert.ok(!parity.includes(phrase),`stale parity phrase: ${phrase}`);
assert.match(dataScreen,/data-water-import-pending/);
assert.match(dataScreen,/data-entry="water-import"/);
assert.match(dataScreen,/não é necessário digitar dia a dia/);
assert.ok(!dataScreen.includes('informe no LTS o total diário'), 'stale manual-water instruction remains');
assert.match(todayScreen,/data-entry="water-import"/);
assert.match(todayScreen,/sem digitar dia a dia/);
assert.match(protocol,/Reconciliação de rastreadores externos/);
assert.match(protocol,/external_references/);

for(const code of ['DQ-NUTRITION-EMPTY-001','DQ-WORKOUT-NORMALIZATION-002','DQ-LABS-COVERAGE-001','health_complete_mfp_water_request','account_authenticated_export'])assert.ok(migration.includes(code),`migration missing ${code}`);
for(const role of ['public','anon','authenticated','service_role'])assert.ok(hardeningMigration.includes(role),`trigger hardening missing ${role}`);
assert.match(master,/PROJECT_BRIEF\.md/);
assert.match(master,/EXECUTION_STATE\.json/);
assert.match(workflow,/node v2\/continuity-contract-smoke\.mjs/);
assert.match(workflow,/node v2\/product-architecture-contract-smoke\.mjs/);
assert.match(workflow,/product-architecture-browser-smoke\.mjs/);
assert.match(workflow,/node v2\/public-payload-guard\.mjs/);
for(const legacyWorkflow of [legacySmoke,timelineSmoke]){
  assert.match(legacyWorkflow,/node v2\/public-payload-guard\.mjs/);
  assert.match(legacyWorkflow,/node v2\/continuity-contract-smoke\.mjs/);
  assert.ok(!legacyWorkflow.includes("-name '*.json'"),'legacy workflow still rejects all JSON metadata');
}
assert.match(publicPayloadGuard,/allowedMetadataFiles=new Set\(\['v2\/EXECUTION_STATE\.json'\]\)/);
assert.match(publicPayloadGuard,/public_project_metadata_only/);
assert.match(publicPayloadGuard,/public_health_data_allowed/);
assert.match(workflow,/bash v2\/run-browser-gate\.sh "\$test_file"/);
assert.match(browserGateRunner,/TimeoutError\|ERR_CONNECTION_REFUSED\|page\\\.goto: Timeout/);
assert.match(browserGateRunner,/retrying once/);
assert.match(browserGateRunner,/if ! grep/,'deterministic failures must not be retried');

const publicContinuity=[brief,architecture,feedback,protocol,rawState,master,parity].join('\n');
for(const privateLiteral of ['700 mL','2.289','4.901','3.794','1.096'])assert.ok(!publicContinuity.includes(privateLiteral),`private operational value leaked: ${privateLiteral}`);

console.log('LTS Health continuity contract passed');
