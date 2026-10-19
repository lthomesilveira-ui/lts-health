import {LANGUAGE_TODAY,LANGUAGE_TABLES,languageDatabase} from './consumer-language-fixture.mjs';

// Entirely invented QA records. Nothing here is a real session, a user comment,
// an authenticated export, or a recommendation about training.
export const SUMMARY_TODAY=LANGUAGE_TODAY;
export const SUMMARY_IDS={current:'synthetic-summary-current',old:'synthetic-summary-old',empty:'synthetic-summary-empty'};
export const SUMMARY_GROUPS=['Grupo sintético Alfa','Grupo sintético Beta'];
export const SUMMARY_LONG_TOKEN=`SINTETICOSEMESPACO${'q'.repeat(120)}`;
export const SUMMARY_COMMENT=[
  'Comentário inteiramente inventado para testar a leitura do resumo. Esta frase comprida existe somente para conferir a quebra de linha em uma tela estreita, sem cortar nenhuma palavra nem substituir o registro original.',
  'HTML deve continuar sendo texto: <img src="data:," onerror="window.__trainingSummaryExecuted=\'comment\'"> & "aspas" <4.',
  SUMMARY_LONG_TOKEN
].join('\n');
export const SUMMARY_REPORT=[
  'Relato original inteiramente inventado para QA. Não descreve um treino de pessoa real.',
  'Linha original 2: <svg onload="window.__trainingSummaryExecuted=\'report\'"></svg> & "texto" <4.',
  `Texto contínuo de teste: ${SUMMARY_LONG_TOKEN}`
].join('\n');
export const SUMMARY_OLD_REPORT='Relato antigo inventado e independente. O campo genérico de notas não é um comentário explícito da sessão.';
export const SUMMARY_GENERIC_NOTE='Nota genérica inventada: não deve aparecer como comentário explícito.';
export const SUMMARY_EXPECTED={
  exercises:4,primary:8,extensions:2,total:10,
  phases:{working:4,warmup:1,other:1,unknown:2},failure:1,
  groups:[
    {label:SUMMARY_GROUPS[0],exercises:2,primary:4,extensions:2},
    {label:SUMMARY_GROUPS[1],exercises:1,primary:3,extensions:0},
    {label:'Grupo não informado',exercises:1,primary:1,extensions:0}
  ]
};

export function makeTrainingSessionSummaryFixture(){
  const date=age=>new Date(Date.parse(`${SUMMARY_TODAY}T12:00:00Z`)-age*86400000).toISOString().slice(0,10);
  const data=Object.fromEntries([...Object.keys(LANGUAGE_TABLES),'nutritionPlans','waterReferences'].map(key=>[key,[]]));
  const status=Object.fromEntries(Object.keys(data).map(key=>[key,'ready']));
  const workout=(id,age,title,extra={})=>({
    source_record_id:id,workout_date:date(age),workout_type:title,
    location:'Local sintético de QA',source:'Diário sintético de QA',
    is_canonical:true,record_status:'validated',duration_minutes:47,
    calories_kcal:123,heart_rate_min:89,heart_rate_avg:117,heart_rate_max:141,
    notes:SUMMARY_GENERIC_NOTE,...extra
  });
  data.workouts=[
    workout(SUMMARY_IDS.current,1,'Sessão sintética atual',{
      // This is the SQL alias returned by the real loader's restricted
      // session_comment:source_payload->>user_reported_completion_note projection.
      session_comment:SUMMARY_COMMENT,raw_exercises:SUMMARY_REPORT
    }),
    workout(SUMMARY_IDS.old,8,'Sessão sintética antiga',{raw_exercises:SUMMARY_OLD_REPORT}),
    workout(SUMMARY_IDS.empty,14,'Sessão sintética sem detalhes')
  ];
  const exercise=(suffix,index,group,workoutId=SUMMARY_IDS.current)=>({
    source_record_id:`${workoutId}-${suffix}`,workout_source_record_id:workoutId,
    workout_date:workoutId===SUMMARY_IDS.current?date(1):date(8),order_index:index,
    exercise:`Exercício sintético ${suffix}`,machine:'Equipamento sintético',
    muscle_group:group,source:'Diário sintético de QA'
  });
  data.exercises=[
    exercise('alfa-1',1,SUMMARY_GROUPS[0]),exercise('alfa-2',2,SUMMARY_GROUPS[0]),
    exercise('beta-1',3,SUMMARY_GROUPS[1]),exercise('unknown-1',4,null),
    exercise('old-1',1,SUMMARY_GROUPS[1],SUMMARY_IDS.old)
  ];
  const set=(exerciseIndex,index,phase,extra={})=>{
    const parent=data.exercises[exerciseIndex];
    return {source_record_id:`${parent.source_record_id}-set-${index}`,
      workout_source_record_id:parent.workout_source_record_id,
      exercise_source_record_id:parent.source_record_id,workout_date:parent.workout_date,
      set_index:index,phase,weight:12,weight_unit:'kg',reps_numeric:7,reps_raw:'7',
      failure:false,near_failure:false,source:'Diário sintético de QA',...extra};
  };
  data.sets=[
    set(0,1,'warmup'),set(0,2,'working'),set(0,3,'working',{failure:true}),
    set(0,4,'drop',{failure:true}),
    set(1,1,'working'),set(1,2,'rest_pause'),
    set(2,1,'working',{near_failure:true}),set(2,2,'other'),set(2,3,null),
    set(3,1,'unknown'),set(4,1,'working')
  ];
  // A small independent nutrition row keeps the real, visible mobile refresh
  // route usable without inheriting any other suite's health-record fixture.
  data.nutrition=[{source_record_id:'synthetic-summary-nutrition',nutrition_date:date(1),source:'Diário alimentar sintético de QA',calories_kcal:2000,protein_g:100,carbs_g:210,fat_g:60,fiber_g:20,water_ml:1600}];
  return {today:SUMMARY_TODAY,date,data,status,db:languageDatabase(data)};
}
