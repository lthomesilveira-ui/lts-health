import assert from 'node:assert/strict';
import {test} from 'node:test';
import {syntheticNutritionPlanRow} from './documented-nutrition-plan-fixture.mjs';
globalThis.location={search:'?fixture=1'};
const {renderCareFollowup}=await import('../src/care-followup.js');
const today='2024-03-08',care=()=>({source_record_id:'synthetic-care',document_type:'care_followup',document_date:'2024-03-01',source:'Synthetic consultation source',care_context:{schema_version:1,consultation_date:'2024-03-01',pending_nutrition:'Synthetic nutrition plan awaited.',followups:[{key:'nutrition_plan',label:'Receive nutrition plan',resolved:false}]}});
const run=(rows=[syntheticNutritionPlanRow('2024-03-05')],status='ready',document=care())=>renderCareFollowup([document],'ready',{nutritionPlans:rows,nutritionPlanStatus:status,today});
test('Later verified receipt annotates the historical note without resolving or activating it',()=>{
 const document=care(),plan=syntheticNutritionPlanRow('2024-03-05'),before=structuredClone({document,plan}),html=run([plan],'ready',document);
 assert.match(html,/data-care-plan-received/);assert.match(html,/Plano alimentar recebido em 05\/03\/2024/);assert.match(html,/Documento de 05\/03\/2024/);assert.match(html,/Synthetic documentary source/);assert.match(html,/Synthetic nutrition plan\.pdf/);
 assert.match(html,/Registro histórico do documento de 01\/03\/2024 · Synthetic consultation source: “Synthetic nutrition plan awaited\.”/);
 assert.match(html,/Início de uso não informado; recebimento não confirma vigência nem adesão/);assert.match(html,/1 pendências registradas na consulta/);
 assert.deepEqual({document,plan},before);assert.equal(document.care_context.followups[0].resolved,false);
 assert.doesNotMatch(html,/2000|120 g|plano vigente|adesão confirmada|Iniciar|Aplicar/);
});
test('Unavailable and ambiguous newest evidence cannot reveal stale receipt or fallback',()=>{
 const good=syntheticNutritionPlanRow('2024-03-05');
 assert.doesNotMatch(renderCareFollowup([care()],'ready',{nutritionPlans:[good],today}),/data-care-plan-received/,'unspecified reader status cannot expose a receipt');
 for(const status of ['error','loading','idle',null]){const html=run([good],status);assert.doesNotMatch(html,/data-care-plan-received/);assert.match(html,/Registro histórico/);assert.match(html,/não confirma a situação atual/);}
 for(const rows of [[],[{...good,checksum:'invalid'}],[good,{...good,source_record_id:'synthetic-duplicate'}],[good,{...syntheticNutritionPlanRow('2024-03-06'),nutrition_plan:null}],[good,{...syntheticNutritionPlanRow('2024-03-06'),document_date:null}]])assert.doesNotMatch(run(rows),/data-care-plan-received/);
 assert.match(run([]),/data-care-plan-status="empty"/);assert.match(run([{...good,checksum:'invalid'}]),/data-care-plan-status="invalid"/);
});
test('Receipt must be strictly later than a known historical date and no later than today',()=>{
 for(const received of ['2024-02-29','2024-03-01','2024-03-09']){const plan=syntheticNutritionPlanRow('2024-03-05');plan.nutrition_plan.received_on=received;assert.doesNotMatch(run([plan]),/data-care-plan-received/);}
 for(const historical of [null,'unknown','2024-02-30']){const document=care();document.document_date=historical;assert.doesNotMatch(run(undefined,'ready',document),/data-care-plan-received/);assert.match(run(undefined,'ready',document),/unknown_history_date/);}
 const plan=syntheticNutritionPlanRow('2024-03-02');plan.nutrition_plan.received_on='2024-03-07';assert.match(run([plan]),/recebido em 07\/03\/2024/);
});
test('Original document failure, absent note, escaping and nonmutation remain safe',()=>{
 assert.doesNotMatch(renderCareFollowup([care()],'error',{nutritionPlans:[syntheticNutritionPlanRow()],nutritionPlanStatus:'ready',today}),/data-care-plan-received|careBaseline/);
 assert.equal(renderCareFollowup([],'ready'), '');
 const document=care();delete document.care_context.pending_nutrition;assert.match(run([],'ready',document),/sem nota sobre recebimento/);assert.doesNotMatch(run([],'ready',document),/aguardado|awaited/);
 document.care_context.pending_nutrition='<script>syntheticUnsafe</script>';document.source='<img src=x>';const plan=syntheticNutritionPlanRow('2024-03-05');plan.source='<script>source</script>';
 const html=run([plan],'ready',document);assert.doesNotMatch(html,/<script>|<img/);assert.match(html,/&lt;script&gt;syntheticUnsafe/);
});
