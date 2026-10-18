import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {nutritionPlanComparison} from '../src/nutrition-plan-comparison.js';
import {renderNutritionPlanComparison} from '../src/nutrition-plan-view.js';
import {syntheticData,syntheticStatus,syntheticNutritionPlanRow,foodRow,testToday} from './documented-nutrition-plan-fixture.mjs';

const fixture=()=>{const data=syntheticData();data.nutrition=[foodRow(testToday,{fiber_g:0}),foodRow('2024-03-07')];return{data,status:syntheticStatus()};};
const dayUi={dashboardMode:'day',dashboardDate:testToday};
const model=()=>{const{data,status}=fixture();return nutritionPlanComparison(data,status,dayUi,testToday);};

test('Compact summary preserves six references; details use neutral comparisons and native disclosures',()=>{
  const m=model(),snapshot=structuredClone(m),html=renderNutritionPlanComparison(m);
  assert.equal((html.match(/data-plan-metric=/g)||[]).length,6);
  for(const key of ['calories_kcal','protein_g','carbs_g','fat_g','fiber_g','water_ml'])assert.ok(html.includes(`data-plan-metric="${key}"`));
  assert.match(html,/Comparação com o plano recebido 01\/03\/2024/);
  assert.match(html,/Início de uso não informado/);assert.match(html,/hoje parcial/);
  assert.match(html,/90% da referência/);assert.match(html,/diferença -200 kcal/);
  assert.match(html,/0% da referência · diferença -30 g/);assert.match(html,/>0 g<\/b>/,'zero is an observation');
  assert.match(html,/1\/1 dias com valor elegível · parcial/);
  assert.match(html,/<details data-disclosure="nutrition-plan-comparison">/,'comparison is initially collapsed');
  assert.match(html,/<details data-disclosure="nutrition-plan-meals">/);
  assert.match(html,/<details data-disclosure="nutrition-plan-provenance">/);
  assert.match(html,/Assinatura não verificada/);assert.match(html,/Identificação no logotipo impresso/);
  assert.match(html,/Fibra|Fibras/);assert.match(html,/Fibras: não informado/,'missing alternative fiber does not become zero');
  assert.match(html,/não somada à refeição principal/);assert.match(html,/Synthetic substitution statement/);
  assert.match(html,/data-disclosure="nutrition-plan-notes"/);assert.match(html,/Synthetic documentary observation\. <small>· página\(s\) 1/);
  assert.doesNotMatch(html,/type="date"|<progress|diagnóstico|Meta vigente|plano vigente|\b(?:NaN|undefined|Infinity)\b/);
  assert.deepEqual(m,snapshot,'renderer is pure');
});

test('Historical comparison is opt-in, has no inferred values, and remains visibly retrospective',()=>{
  const{data,status}=fixture(),ui={dashboardMode:'period',dashboardPeriod:'30'};
  const blocked=renderNutritionPlanComparison(nutritionPlanComparison(data,status,ui,testToday));
  assert.match(blocked,/data-plan-state="retrospective_required"/);assert.match(blocked,/data-plan-retrospective="true" aria-pressed="false"/);
  assert.match(blocked,/não indica adesão passada/);assert.match(blocked,/2\.000 kcal/);
  assert.doesNotMatch(blocked,/[\d,]+% da referência|diferença -/);
  const enabled=renderNutritionPlanComparison(nutritionPlanComparison(data,status,{...ui,nutritionPlanRetrospective:true},testToday));
  assert.match(enabled,/data-plan-state="ready"/);assert.match(enabled,/data-plan-retrospective="false" aria-pressed="true"/);
  assert.match(enabled,/Retrospectiva com o plano recebido/);assert.match(enabled,/não indica adesão passada/);
  assert.match(enabled,/1\/30 dias com valor elegível/);assert.match(enabled,/Média dos dias observados/);
});

test('All unavailable states fail closed, with no stale source plan or comparison values',()=>{
  for(const state of ['loading','error','empty','invalid']){
    const html=renderNutritionPlanComparison({...model(),state});
    assert.match(html,new RegExp(`data-plan-state="${state}"`));assert.match(html,/role="status"/);
    assert.doesNotMatch(html,/data-plan-metric|Synthetic morning meal|2\.000 kcal|data-plan-food-source/);
  }
  assert.match(renderNutritionPlanComparison({state:'invalid'}),/Nenhum plano anterior foi escolhido/);
});

test('Every supported document and consumption string is escaped; unknown clinical fields are not displayed',()=>{
  const m=model(),unsafe='<img src=x onerror="alert(1)">';
  m.comparisonLabel=unsafe;m.clinicalStartNote=unsafe;m.plan.source_file=unsafe;m.plan.source=unsafe;m.plan.author.name=unsafe;
  m.plan.meals[0].name=unsafe;m.plan.meals[0].items[0].name=unsafe;m.plan.meals[0].items[0].note=unsafe;m.plan.meals[0].notes=[unsafe];
  m.plan.alternatives[0].name=unsafe;m.plan.substitutions[0].text=unsafe;m.plan.arithmetic_notes=[unsafe];
  m.plan.notes[0].text=unsafe;
  m.plan.medical_context='PRIVATE CLINICAL CONTEXT';m.plan.medication='PRIVATE MEDICATION';
  m.metrics[0].label=unsafe;m.metrics[0].reason=unsafe;m.metrics[0].sourceLabel=unsafe;m.notes=[unsafe];
  m.foodSource.label=unsafe;m.waterSource.label=unsafe;m.foodSources=[{key:'"><script>unsafe</script>',label:unsafe,status:'candidate'}];
  m.detailAvailability.note=unsafe;
  const html=renderNutritionPlanComparison(m);
  assert.match(html,/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html,/&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<img|<script|PRIVATE CLINICAL CONTEXT|PRIVATE MEDICATION/);
});

test('Record update and source export timestamps remain distinct, timezone-qualified and validated',()=>{
  const m=model();m.lastUpdatedAt='2024-03-08T18:42:00Z';m.metrics[0].updatedAt=m.lastUpdatedAt;m.metrics[0].exportedAt='2024-03-08T18:00:00Z';
  const html=renderNutritionPlanComparison(m);
  assert.match(html,/Registros atualizados em 08\/03 15:42 \(Brasília\)/);
  assert.match(html,/arquivo da origem exportado em 08\/03 15:00 \(Brasília\)/);
  assert.match(html,/Recebido em 01\/03\/2024/,'document receipt is separate');
  m.lastUpdatedAt='<img src=x>';m.metrics[0].updatedAt='not-a-date';m.metrics[0].exportedAt='not-a-date';
  assert.doesNotMatch(renderNutritionPlanComparison(m),/Registros atualizados em|arquivo da origem exportado em|not-a-date|Invalid Date/);
});

test('Documentary quantities retain decimal precision and exclusions stay visible with available averages',()=>{
  const m=model();m.plan.meals[0].items[0].quantity=1.234567;m.metrics[0].reason='Dias ambíguos excluídos desta variável.';
  assert.match(renderNutritionPlanComparison(m),/1,234567 g/);assert.match(renderNutritionPlanComparison(m),/Dias ambíguos excluídos desta variável/);
  m.metrics[1].target=187.3;m.plan.daily_targets.protein_g.value=187.3;m.metrics[1].value=100/3;m.metrics[1].delta=100/3-187.3;
  const html=renderNutritionPlanComparison(m);assert.match(html,/Referência diária: 187,3 g/);assert.match(html,/≈ 33,33 g/);
  assert.match(html,/diferença <span[^>]+>≈ -153,97 g/);assert.match(html,/data-disclosure="nutrition-plan-precision"/);
  assert.match(html,/33,333333333333336 g/,'full numeric value remains accessible in a disclosure');
  assert.match(html,/title="Valor sem arredondamento:/);
});

test('Meal detail absence is explicit and the last detailed date remains visible',()=>{
  const m=model();m.detailAvailability={latestMealDate:'2024-01-02',hasRecentMeals:false,note:'Sem refeições detalhadas na origem atual. Comparação por item indisponível.'};
  const html=renderNutritionPlanComparison(m);assert.match(html,/Comparação por item indisponível/);assert.match(html,/Última data de refeições detalhadas recebida: 02\/01\/2024/);
});

globalThis.location={search:'?fixture=1'};
const {state}=await import('../src/core.js');
const {renderHealthDashboard}=await import('../src/health-dashboard.js');
const {renderProductNutrition}=await import('../src/nutrition-product.js');
test('Dashboard summary remains byte-identical; the new card follows insights and nutrition uses its own period',()=>{
  const{data,status}=fixture(),before=structuredClone(data),withPlan=renderHealthDashboard(data,status,dayUi,testToday);
  const withoutPlan=renderHealthDashboard({...data,nutritionPlans:[]},status,dayUi,testToday);
  const summary=html=>html.match(/<section class="healthMetricGrid"[\s\S]*?<\/section>/)[0];
  assert.equal(summary(withPlan),summary(withoutPlan));
  assert.ok(withPlan.indexOf('data-nutrition-plan')>withPlan.indexOf('class="healthGuidance"'));
  assert.ok(withPlan.indexOf('data-nutrition-plan')<withPlan.indexOf('class="studyCards healthContextGrid"'));
  assert.deepEqual(data,before);
  const previous={data:state.data,domainStatus:state.domainStatus,ui:state.ui};
  try{
    state.data=data;state.domainStatus=status;state.ui={nutritionPeriod:'365',dashboardMode:'day',nutritionPlanRetrospective:true};
    const html=renderProductNutrition();assert.match(html,/data-nutrition-plan/);assert.match(html,/médias por dia observado/);
    assert.equal(state.ui.dashboardMode,'day','nutrition-route calendar adaptation never changes the dashboard choice');
  }finally{Object.assign(state,previous);}
  const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(source,/nutritionPlanRetrospective=planRetrospective.dataset.planRetrospective==='true'/);
  assert.match(source,/nutritionPlanFoodSource=event.target.value;render\(\);return/);
  assert.doesNotMatch(source,/nutritionPlanRetrospective\s*=\s*true/,'only an explicit button can opt in');
});
