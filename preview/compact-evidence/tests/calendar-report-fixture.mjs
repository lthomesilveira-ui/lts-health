import {makeDashboardFixture} from './health-dashboard-render-test.mjs';
import {languageDatabase,consumerLanguageService} from './consumer-language-fixture.mjs';
import {syntheticNutritionPlanRow} from './documented-nutrition-plan-fixture.mjs';

// Entirely invented records. No patient, account, source document, real hash,
// private conversation or credentials are used by these acceptance tests.
export const CALENDAR_TODAY='2026-10-17';
export const CALENDAR_INJECTION='<img src="synthetic-invalid" onerror="globalThis.__calendarInjection=1">';
export const CALENDAR_KEYS=['water','protein','energy','carbs','fat','fiber','steps','activeEnergy'];
export const CALENDAR_SOURCES={food:'Synthetic A food',watch:'Synthetic A watch'};
export const CALENDAR_DATES={missing:'2026-10-06',partial:'2026-10-07',conflict:'2026-10-08',zero:'2026-10-05',future:'2026-10-18'};
export const CALENDAR_WINDOWS={
  lastWeek:{start:'2026-10-05',end:'2026-10-11',days:7},
  priorWeek:{start:'2026-09-28',end:'2026-10-04',days:7},
  currentWeek:{start:'2026-10-12',end:'2026-10-17',days:6},
  lastMonth:{start:'2026-09-01',end:'2026-09-30',days:30},
  currentMonth:{start:'2026-10-01',end:'2026-10-17',days:17},
  leapMonth:{start:'2024-02-01',end:'2024-02-29',days:29},
  yearWeek:{start:'2025-12-29',end:'2026-01-04',days:7}
};
const ageOf=date=>Math.round((Date.parse(`${CALENDAR_TODAY}T12:00:00Z`)-Date.parse(`${date}T12:00:00Z`))/86400000);
const lab=(id,date,marker,raw,numeric,extra={})=>({id:`synthetic-calendar-lab-id-${id}`,source_record_id:`synthetic-calendar-lab-${id}`,collection_date:date,report_date:date,
  biomarker:marker,result_raw:raw,result_numeric:numeric,unit:'u/L',reference_range:'10 a 90 u/L',method:'Método sintético A',laboratory:'Laboratório sintético',source:'Laudo inteiramente inventado',...extra});

export function makeCalendarReportFixture(kind='complete'){
  if(!['complete','empty','error'].includes(kind))throw new Error(`Unknown calendar fixture: ${kind}`);
  const f=makeDashboardFixture(CALENDAR_TODAY);
  for(const domain of ['activity','previews','quality','nutritionPlans']){f.data[domain]=[];f.status[domain]='ready';}
  for(const row of f.data.nutrition){
    const age=ageOf(row.nutrition_date),offset=row.source==='Synthetic B food'?400:0;
    Object.assign(row,{carbs_g:210+age+offset,fat_g:55+age/10,fiber_g:24.5,knownPartial:row.nutrition_date===CALENDAR_DATES.partial});
    if(row.source===CALENDAR_SOURCES.food&&row.nutrition_date===CALENDAR_DATES.zero)row.water_ml=0;
  }
  f.data.nutrition=f.data.nutrition.filter(row=>!(row.source===CALENDAR_SOURCES.food&&row.nutrition_date===CALENDAR_DATES.missing)&&!(row.source==='Synthetic B food'&&row.nutrition_date===CALENDAR_TODAY));
  f.data.sourceMetrics=f.data.sourceMetrics.filter(row=>!(row.source_name==='Synthetic B watch'&&row.metric_date===CALENDAR_TODAY));
  const conflict=f.data.nutrition.find(row=>row.source===CALENDAR_SOURCES.food&&row.nutrition_date===CALENDAR_DATES.conflict);
  f.data.nutrition.push({...conflict,source_record_id:'synthetic-calendar-conflicting-food',water_ml:8888,protein_g:888,calories_kcal:8888});
  // A future row and an unselected origin must never leak into closed means.
  f.data.nutrition.push({source_record_id:'synthetic-calendar-future-food',nutrition_date:CALENDAR_DATES.future,source:CALENDAR_SOURCES.food,water_ml:987654,protein_g:98765,calories_kcal:987654});
  for(const status of ['candidate','held'])for(const [type,value,unit] of [['dietary_water_ml',77777,'mL'],['dietary_protein_g',7777,'g'],['dietary_energy_kcal',77777,'kcal']]){
    f.data.sourceMetrics.push({source_record_id:`synthetic-calendar-${status}-${type}`,metric_date:CALENDAR_TODAY,metric_type:type,value,unit,source_name:'Origem sintética em revisão',source_family:'synthetic calendar',canonical_status:status});
  }
  for(const row of f.data.sourceMetrics)if(row.source_name===CALENDAR_SOURCES.watch&&row.metric_date===CALENDAR_DATES.partial)row.knownPartial=true;
  f.data.workouts=[];f.data.exercises=[];f.data.sets=[];f.data.workoutEvidence=[];f.data.polarSessions=[];
  const sessionDates=['2024-02-29','2025-12-29','2026-01-04',...Array.from({length:12},(_,index)=>`2026-09-${String(2+index*2).padStart(2,'0')}`),'2026-10-02','2026-10-05','2026-10-10','2026-10-11','2026-10-13','2026-10-15',CALENDAR_TODAY,CALENDAR_DATES.future];
  for(const [index,date] of sessionDates.entries()){
    const id=`synthetic-calendar-session-${index}`;
    f.data.workouts.push({source_record_id:id,workout_date:date,workout_type:`Sessão sintética ${String(index+1).padStart(2,'0')}`,location:'Academia sintética',source:'Diário sintético',is_canonical:true,record_status:'validated',duration_minutes:date==='2026-10-10'?null:40,muscle_groups:['Peito','Ombros']});
    for(let j=0;j<3;j++){
      const eid=`${id}-exercise-${j}`;
      f.data.exercises.push({source_record_id:eid,workout_source_record_id:id,workout_date:date,exercise:`Exercício sintético ${j+1} com descrição longa para verificar a quebra de linha`,machine:'Equipamento sintético',muscle_group:j===2?'Ombros':'Peito',order_index:j+1});
      for(let k=0;k<3;k++)f.data.sets.push({source_record_id:`${eid}-set-${k}`,workout_source_record_id:id,exercise_source_record_id:eid,workout_date:date,set_index:k+1,phase:k===2?'drop':'working',weight:35+j*5+index/10,weight_unit:'kg',reps_numeric:8,reps_raw:'8',notes:'Registro inteiramente inventado.'});
    }
    // Deliberately overlapping date/duration: still a separate device record.
    f.data.polarSessions.push({source_record_id:`synthetic-calendar-polar-${index}`,workout_date:date,recorded_start:`${date}T12:00:00Z`,session_name:`Registro Polar sintético ${index+1}`,duration_minutes:40,heart_rate_avg:120,heart_rate_max:160,source_name:'Synthetic Polar'});
  }
  f.data.labs=[
    lab('precise-prior','2026-09-03','Marcador preciso sintético','12,3456',12.3456),
    lab('precise-last','2026-10-09','Marcador preciso sintético','13,4567',13.4567),
    lab('limit-prior','2026-09-03','Marcador com limite sintético','5',5),
    lab('limit-last','2026-10-09','Marcador com limite sintético','<4',4),
    lab('method-prior','2026-09-03','Marcador com método diferente','22',22),
    lab('method-last','2026-10-09','Marcador com método diferente','23',23,{method:'Método sintético B'}),
    lab('reference-prior','2026-09-03','Marcador com referência diferente','30',30),
    lab('reference-last','2026-10-09','Marcador com referência diferente','31',31,{reference_range:'20 a 95 u/L'}),
    lab('future-only',CALENDAR_DATES.future,'MARCADOR FUTURO NÃO DEVE APARECER','987654',987654)
  ];
  for(let index=0;index<8;index++)for(const date of ['2026-09-03','2026-10-09'])f.data.labs.push(lab(`stress-${index}-${date}`,date,`Marcador sintético de cobertura ${String(index+1).padStart(2,'0')}`,String(20+index+(date==='2026-10-09'?1:0)),20+index+(date==='2026-10-09'?1:0)));
  f.data.regimens=[{source_record_id:'synthetic-calendar-regimen',medication:'Plano sintético documentado',document_date:'2026-09-01',source:'Documento sintético',start_date:null,started_by_user_confirmation:false,recorded_status:'documented'}];
  f.data.treatments=[{source_record_id:'synthetic-calendar-event',event_date:'2026-10-09',medication:`Evento sintético relatado ${CALENDAR_INJECTION}`,event_type:'reported',source:'Diário sintético'},
    {source_record_id:'synthetic-calendar-future-event',event_date:CALENDAR_DATES.future,medication:'EVENTO FUTURO NÃO DEVE APARECER',event_type:'reported',source:'Diário sintético'}];
  const plan=syntheticNutritionPlanRow(CALENDAR_TODAY,'synthetic-calendar-plan','d'.repeat(64));
  plan.nutrition_plan.author.name=`Responsável sintético ${CALENDAR_INJECTION}`;
  f.data.nutritionPlans=[plan];
  f.data.meals=[{source_record_id:'synthetic-calendar-meal',meal_date:'2026-09-04',meal_name:'Refeição sintética',source:CALENDAR_SOURCES.food,calories_kcal:450,protein_g:25,carbs_g:50,fat_g:15,record_status:'validated'}];
  if(kind==='empty')for(const domain of Object.keys(f.data))f.data[domain]=[];
  f.db=languageDatabase(f.data);
  return {...f,kind};
}

export const calendarReportService=(fixture,options={})=>consumerLanguageService(fixture.db,{failTable:fixture.kind==='error'?'health_source_daily_metrics':null,...options});

// Independent arithmetic oracle: known incomplete, conflicting, absent and
// current-day observations are not eligible; zero is a recorded observation.
export function expectedCalendarMetric(fixture,key,bounds,origin='A'){
  const fields={water:'water_ml',protein:'protein_g',energy:'calories_kcal',carbs:'carbs_g',fat:'fat_g',fiber:'fiber_g'},types={steps:'steps',activeEnergy:'active_energy_kcal'};
  const observations=fields[key]?fixture.data.nutrition.filter(row=>row.source===`Synthetic ${origin} food`).map(row=>({date:row.nutrition_date,value:row[fields[key]],partial:row.knownPartial})):
    fixture.data.sourceMetrics.filter(row=>row.source_name===`Synthetic ${origin} watch`&&row.metric_type===types[key]).map(row=>({date:row.metric_date,value:row.value,partial:row.knownPartial}));
  const byDate=new Map();for(const row of observations){if(!byDate.has(row.date))byDate.set(row.date,[]);byDate.get(row.date).push(row);}
  const rows=[...byDate.values()].filter(rows=>rows.length===1).map(rows=>rows[0]).filter(row=>row.date>=bounds.start&&row.date<=bounds.end&&row.date<CALENDAR_TODAY&&!row.partial&&row.value!=null);
  return {count:rows.length,value:rows.length?rows.reduce((total,row)=>total+row.value,0)/rows.length:null,dates:rows.map(row=>row.date).sort()};
}
