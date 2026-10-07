import {num,day,norm,fmtNum,fmtDate} from './core.js';
import {compositionReport} from './reports-model.js';
import {integratedReview} from './integrated-review.js';
import {evidenceInsights,loadInsightUnits} from './evidence-insights.js';
import {goalComparison,goalForDate} from './personal-goals.js';
import {normalizeMuscleGroup} from './integrated-analysis.js';
import {bodySourceLabel} from './health-context.js';

const average=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const inWindow=(date,b)=>date&&(!b.start||date>=b.start)&&date<=b.end;
const signed=(v,d=1)=>`${v>0?'+':''}${fmtNum(v,d)}`;
export function evolutionModel(data,status,m,r,ui={}){
  const insights=evidenceInsights(data,status,m.current,r.nutrition.source?.key,m.today);
  const prior=m.previous?integratedReview(data,status,m.previous,{...ui,reportNutritionSource:r.nutrition.source?.key,reviewSleepSource:r.sleep.source?.key,reviewWaterSource:r.water.source?.key},m.today):null;
  const bodyHistory=compositionReport(data,status,{start:null,end:m.today},ui.reportBodySource);
  const body=m.body.latest||bodyHistory.latest||null;
  const bodyPairs=m.body.available?m.body:null;
  const latestFood=r.nutrition.rows.at(-1)||null,latestWater=r.water.rows.at(-1)||null,latestSleep=r.sleep.rows.at(-1)||null;
  const goals=status.goals==='ready'?data.goals||[]:[];
  const nutritionTargets=Object.fromEntries(['calories_kcal','protein_g','carbs_g','fat_g','fiber_g'].map(k=>[k,goalComparison(r.nutrition.closedRows,goals,k)]));
  const currentGoal=goalForDate(goals,m.today);
  const foodChange=key=>{
    const a=r.nutrition,b=prior?.nutrition;
    return a.available&&b?.available&&a.source?.key&&a.source.key===b.source?.key&&a.counts[key]>=5&&b.counts[key]>=5?{current:a.means[key],previous:b.means[key],delta:a.means[key]-b.means[key]}:null;
  };
  const sleepChange=r.sleep.available&&prior?.sleep.available&&r.sleep.source?.key===prior.sleep.source?.key&&r.sleep.closedRows.length>=5&&prior.sleep.closedRows.length>=5?{current:r.sleep.mean,previous:prior.sleep.mean,delta:r.sleep.mean-prior.sleep.mean}:null;
  const workouts=new Map((m.training.rows||[]).map(w=>[w.source_record_id,w]));
  const exercises=status.exercises==='ready'?(data.exercises||[]).filter(e=>workouts.has(e.workout_source_record_id)):[];
  const exMap=new Map(exercises.map(e=>[e.source_record_id,e]));
  const sets=status.sets==='ready'&&status.exercises==='ready'?(data.sets||[]).filter(s=>workouts.has(s.workout_source_record_id)&&exMap.get(s.exercise_source_record_id)?.workout_source_record_id===s.workout_source_record_id):null;
  const groups=new Map();
  for(const s of sets||[]){const group=normalizeMuscleGroup(exMap.get(s.exercise_source_record_id)?.muscle_group);groups.set(group,(groups.get(group)||0)+1);}
  const trainingGroups=[...groups].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label));
  const lastWorkout=[...(m.training.rows||[])].sort((a,b)=>day(a.workout_date).localeCompare(day(b.workout_date))).at(-1)||null;
  const latestSession=lastWorkout?{...lastWorkout,exerciseCount:status.exercises==='ready'?exercises.filter(e=>e.workout_source_record_id===lastWorkout.source_record_id).length:null,setCount:sets?sets.filter(s=>s.workout_source_record_id===lastWorkout.source_record_id).length:null}:null;
  const meals=status.meals==='ready'?(data.meals||[]).filter(row=>inWindow(day(row.meal_date),m.current)&&day(row.meal_date)<m.today&&norm(row.source)===r.nutrition.source?.key&&r.nutrition.closedRows.some(d=>d.date===day(row.meal_date))&&row.meal_name):[];
  const mealsByDay=new Map();for(const row of meals){const key=JSON.stringify([day(row.meal_date),norm(row.meal_name)]);if(!mealsByDay.has(key))mealsByDay.set(key,[]);mealsByDay.get(key).push(row);}
  const mealNames=new Map();for(const rows of mealsByDay.values()){if(rows.length!==1)continue;const row=rows[0];if(num(row.protein_g)==null)continue;const key=norm(row.meal_name);if(!mealNames.has(key))mealNames.set(key,{label:row.meal_name,values:[]});mealNames.get(key).values.push(num(row.protein_g));}
  const mealDistribution=[...mealNames.values()].map(g=>({label:g.label,value:average(g.values),days:g.values.length}));
  const recentTreatments=status.treatments==='ready'?(data.treatments||[]).filter(row=>inWindow(day(row.event_date),m.current)).sort((a,b)=>day(b.event_date).localeCompare(day(a.event_date))).slice(0,3):[];
  const findings=[];
  if(bodyPairs){const fat=num(bodyPairs.changes.fat_mass_kg),muscle=num(bodyPairs.changes.skeletal_muscle_mass_kg),weight=num(bodyPairs.changes.weight_kg);
    if(fat!=null&&muscle!=null)findings.push({kind:'body',title:`Gordura ${signed(fat)} kg; músculo ${signed(muscle)} kg`,text:`Entre ${fmtDate(bodyPairs.start)} e ${fmtDate(bodyPairs.end)}, na mesma origem e aparelho.`,detail:'Estimativas de bioimpedância; condições da medição podem influenciar os valores.',route:'bio'});
    else if(weight!=null)findings.push({kind:'body',title:`Peso ${signed(weight)} kg entre avaliações`,text:`${fmtDate(bodyPairs.start)} → ${fmtDate(bodyPairs.end)} · ${bodySourceLabel(bodyPairs.latest)}.`,detail:'Sem dados de gordura e músculo comparáveis, não se atribui a mudança a um tecido.',route:'bio'});
  }
  for(const l of insights.loads.rows.slice(0,3))findings.push({kind:'training',title:`${l.exercise}: ${fmtNum(l.previous.weight,1)} → ${fmtNum(l.latest.weight,1)} ${loadInsightUnits[l.unit]}`,text:`${l.reps} repetições · ${l.machine} · ${l.location}`,detail:`${fmtDate(l.previous.date)} → ${fmtDate(l.latest.date)}. Maior carga de trabalho nessas repetições; esforço pode variar.`,route:'treinos',exerciseId:l.latest.exerciseId,unit:l.unit});
  const foodContrast=insights.highlightNutrition;
  if(foodContrast)findings.push({kind:'nutrition',title:`${foodContrast.label}: ${fmtNum(foodContrast.withMean,0)} versus ${fmtNum(foodContrast.withoutMean,0)} ${foodContrast.unit}/dia`,text:'Dias com treino versus dias sem treino registrado, na mesma fonte alimentar.',detail:`${foodContrast.withDays} e ${foodContrast.withoutDays} dias com valor. Associação descritiva; ausência de treino não confirma descanso.`,route:'nutricao'});
  const energyChange=foodChange('calories_kcal');
  if(energyChange)findings.push({kind:'nutrition',title:`Energia registrada ${signed(energyChange.delta,0)} kcal/dia`,text:'Média dos dias encerrados versus a janela anterior de mesma duração.',detail:`${r.nutrition.source.label}. Os diários podem estar incompletos; não é estimativa de déficit energético.`,route:'nutricao'});
  const lab=m.labs.selected;
  if(lab?.comparable)findings.push({kind:'labs',title:`${lab.group.label}: ${lab.previous.result_raw||fmtNum(lab.previous.result_numeric,2)} → ${lab.current.result_raw||fmtNum(lab.current.result_numeric,2)} ${lab.current.unit||''}`,text:`${fmtDate(lab.previous.collection_date)} → ${fmtDate(lab.current.collection_date)} · método e origem compatíveis.`,detail:'Referência do laboratório no detalhe; variação isolada não define diagnóstico.',route:'saude'});
  const next=[];
  if(!currentGoal&&status.goals==='ready')next.push({title:'Conferir suas metas',text:'Registrar as referências do seu plano alimentar permite comparar consumo e objetivo.',kind:'goals'});
  if(body&&!bodyPairs)next.push({title:'Comparar suas avaliações',text:'Escolha a mesma origem para investigar gordura, músculo e regiões corporais.',route:'bio'});
  if(insights.loads.rows.length)next.push({title:'Rever progressão dos exercícios',text:'Consulte cargas, repetições e execução nas sessões compatíveis.',route:'treinos'});
  next.push({title:'Preparar a próxima consulta',text:'Gerar um resumo de evolução com exames e contexto dos protocolos.',kind:'consultation'});
  return {insights,body,bodyPairs,latestFood,latestWater,latestSleep,nutritionTargets,currentGoal,foodChange,sleepChange,trainingGroups,latestSession,mealDistribution,recentTreatments,findings,next:next.slice(0,3),goalsAvailable:status.goals==='ready',waterMean:r.water.closedRows.length>=5?r.water.mean:null};
}
