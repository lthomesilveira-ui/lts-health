import {makeDashboardFixture,FIXED_TODAY} from './health-dashboard-render-test.mjs';
import {syntheticNutritionPlanRow} from './documented-nutrition-plan-fixture.mjs';
import {nutritionHistoryService} from './nutrition-history-access-fixture.mjs';

// Public, deterministic, invented records only. No health export or user login.
export const LANGUAGE_TODAY=FIXED_TODAY;
export const LANGUAGE_NOTE='Nota sintética original: payload, source_record_id e canonical_status são palavras deste documento; preservar <4 e 1,2345.';
export const LANGUAGE_ERROR='SQLSTATE 42703: column source_record_id does not exist; RPC payload canonical_status synthetic-diagnostic-only';
export const LANGUAGE_ROUTES=['hoje','nutricao','timeline','treinos','saude','tratamentos','dados','bio','evolucao','analise'];
export const LANGUAGE_TABLES={nutrition:'health_daily_nutrition',sourceMetrics:'health_source_daily_metrics',metrics:'health_metrics',body:'health_body_composition',segmental:'health_segmental_composition',workouts:'health_workouts',workoutEvidence:'health_workout_source_evidence',exercises:'health_workout_exercises',sets:'health_workout_sets',labs:'health_lab_results',treatments:'health_medication_events',regimens:'health_medication_regimens',docs:'health_documents',goals:'health_personal_goals',polarSessions:'health_polar_sessions',meals:'health_nutrition_meals',uploads:'health_uploads',activity:'health_activity_records',previews:'health_ingestion_previews',quality:'health_data_quality_issues'};
export const foodSourceKey=source=>JSON.stringify(['nutrition',source.toLowerCase(),'canonical']);
export const candidateSourceKey=status=>JSON.stringify(['sourceMetrics','synthetic language','origem sintetica em revisao',status]);
export function languageDatabase(data){
  const db=Object.fromEntries(Object.entries(LANGUAGE_TABLES).map(([domain,table])=>[table,structuredClone(data[domain]||[])]));
  db.health_documents.push(...structuredClone(data.nutritionPlans||[]));
  return db;
}
export function makeConsumerLanguageFixture(kind='complete'){
  const f=makeDashboardFixture(LANGUAGE_TODAY,{sparse:kind==='partial'});
  for(const key of ['activity','previews','quality']){f.data[key]=[];f.status[key]='ready';}f.data.nutritionPlans=[];f.status.nutritionPlans='ready';
  if(kind==='empty'){
    for(const key of Object.keys(f.data))f.data[key]=[];
    f.db=languageDatabase(f.data);return {...f,kind};
  }
  for(const row of f.data.nutrition){const age=Math.round((Date.parse(f.today)-Date.parse(row.nutrition_date))/86400000);Object.assign(row,{carbs_g:age===2?null:210+age,fat_g:57+age,fiber_g:age===1?0:23.25,knownPartial:kind==='partial'&&age===6});}
  f.data.quality=[{source_record_id:'synthetic-language-quality',issue_code:'synthetic_read_problem',category:'parsing',severity:'warning',status:'open',entity_name:'synthetic_record',record_ref:'synthetic-language-record',description:LANGUAGE_ERROR,detected_at:`${f.today}T12:00:00Z`}];
  f.data.nutritionPlans=[syntheticNutritionPlanRow(f.date(30),'synthetic-language-plan','c'.repeat(64))];
  f.data.nutritionPlans[0].nutrition_plan.notes=[{text:LANGUAGE_NOTE,source_pages:[1]}];
  f.data.meals=[{source_record_id:'synthetic-language-meal',meal_date:f.date(1),meal_name:'Refeição sintética registrada',source:'Synthetic A food',calories_kcal:423.75,protein_g:24.25,carbs_g:38.5,fat_g:12.5,record_status:'validated'}];
  for(const [status,value] of [['candidate',9101],['held',9201]])for(const [type,unit,amount] of [['dietary_energy_kcal','kcal',value],['dietary_protein_g','g',value/10]])f.data.sourceMetrics.push({source_record_id:`synthetic-language-${status}-${type}`,metric_date:f.date(1),metric_type:type,value:amount,unit,source_name:'Origem sintética em revisão',source_family:'synthetic language',canonical_status:status});
  const lab=(id,date,result_numeric,result_raw,extra={})=>({source_record_id:id,collection_date:date,report_date:date,biomarker:'Hemoglobina',result_numeric,result_raw,unit:'g/dL',reference_range:'12 a 16',method:'Método sintético',laboratory:'Laboratório sintético',source:'Laudo sintético',...extra});
  f.data.labs=[lab('synthetic-language-lab-prior',f.date(20),1.2345,'1,2345'),lab('synthetic-language-lab-current',f.date(2),4,'<4'),lab('synthetic-language-lab-secondary',f.date(2),5,'5',{biomarker:'Ferritina',unit:'ng/mL'})];
  f.data.workouts=[{source_record_id:'synthetic-language-workout',workout_date:f.date(1),workout_type:'Treino sintético',location:'Academia sintética',source:'Diário sintético',is_canonical:true,record_status:'validated',duration_minutes:40,muscle_groups:['Peito']}];
  f.data.exercises=[{source_record_id:'synthetic-language-exercise',workout_source_record_id:'synthetic-language-workout',workout_date:f.date(1),exercise:'Exercício sintético',machine:'Equipamento sintético com descrição longa para conferir quebra de linha',muscle_group:'Peito',order_index:1,notes:LANGUAGE_NOTE}];
  f.data.sets=[{source_record_id:'synthetic-language-set',workout_source_record_id:'synthetic-language-workout',exercise_source_record_id:'synthetic-language-exercise',workout_date:f.date(1),set_index:1,phase:'working',weight:42.5,reps_numeric:8,reps_raw:'8 + 2 assistidas',weight_unit:'kg',notes:LANGUAGE_NOTE}];
  f.data.regimens=[{source_record_id:'synthetic-language-regimen',medication:'Plano sintético documentado',document_date:f.date(5),recorded_status:'documented',source:'Documento sintético',start_date:null,started_by_user_confirmation:false}];
  f.data.treatments=[{source_record_id:'synthetic-language-event',event_date:f.date(2),medication:'Registro sintético de aplicação',event_type:'reported',local_time:'08:30',recorded_site:'Local sintético',recorded_side:'lado registrado',source:'Diário sintético'}];
  if(kind==='conflict'){
    const daily=f.data.nutrition.find(row=>row.source==='Synthetic A food'&&row.nutrition_date===f.date(1));
    f.data.nutrition.push({...daily,source_record_id:'synthetic-language-food-conflict',calories_kcal:6666,water_ml:9999});
    f.data.workouts.push({...f.data.workouts[0],duration_minutes:45});
    f.data.labs.push({...f.data.labs[1],source_record_id:'synthetic-language-lab-conflict',result_raw:'7,8901',result_numeric:7.8901});
  }
  f.db=languageDatabase(f.data);return {...f,kind};
}
// Reuse the production-path QA SDK. Override only the synthetic error text so
// raw SQL/transport diagnostics can be tested separately from human messages.
export function consumerLanguageService(db,options={}){
  return nutritionHistoryService(db,options).replace("message:'Synthetic historical read failure'",`message:${JSON.stringify(LANGUAGE_ERROR)}`);
}
