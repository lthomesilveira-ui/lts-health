import {num,day,norm,fmtNum,fmtDate} from './core.js';
import {compositionReport} from './reports-model.js';
import {integratedReview} from './integrated-review.js';
import {evidenceInsights,loadInsightUnits} from './evidence-insights.js';
import {goalComparison,goalForDate,historicalGoalReference} from './personal-goals.js';
import {normalizeMuscleGroup,addDays} from './integrated-analysis.js';
import {bodySourceLabel} from './health-context.js';

const average=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const inWindow=(date,b)=>date&&(!b.start||date>=b.start)&&date<=b.end;
const signed=(v,d=1)=>`${v>0?'+':''}${fmtNum(v,d)}`;
// Two adjacent calendar weeks inside the selected window, from ONE selected
// source. Five observed closed days per week is a display threshold, not proof
// of complete diaries or statistical significance. Missing values stay null.
export function recentObservedChange(rows,key,bounds,today){
  const end=bounds.end<today?bounds.end:addDays(today,-1);
  const current={start:addDays(end,-6),end},previous={start:addDays(end,-13),end:addDays(end,-7)};
  const pick=b=>rows.filter(r=>inWindow(r.date,b)&&r.date<today&&num(r[key])!=null);
  const a=pick(current),b=pick(previous),eligible=(!bounds.start||previous.start>=bounds.start)&&a.length>=5&&b.length>=5;
  return {comparable:eligible,current:average(a.map(r=>num(r[key]))),previous:average(b.map(r=>num(r[key]))),delta:eligible?average(a.map(r=>num(r[key])))-average(b.map(r=>num(r[key]))):null,currentDays:a.length,previousDays:b.length,currentBounds:current,previousBounds:previous};
}
export function evolutionModel(data,status,m,r,ui={}){
  const insights=evidenceInsights(data,status,m.current,r.nutrition.source?.key,m.today);
  const prior=m.previous?integratedReview(data,status,m.previous,{...ui,reportNutritionSource:r.nutrition.source?.key,reviewSleepSource:r.sleep.source?.key,reviewWaterSource:r.water.source?.key},m.today):null;
  const bodyHistory=compositionReport(data,status,{start:null,end:m.today},ui.reportBodySource);
  const body=m.body.latest||bodyHistory.latest||null;
  const bodyPairs=m.body.available?m.body:null;
  const priorBodyRows=body?bodyHistory.rows.filter(row=>day(row.measured_at)<day(body.measured_at)):[],priorBodyDate=day(priorBodyRows.at(-1)?.measured_at);
  const bodyPrevious=m.body.previous||(priorBodyRows.filter(row=>day(row.measured_at)===priorBodyDate).length===1?priorBodyRows.at(-1):null);
  const latestFood=r.nutrition.rows.at(-1)||null,latestWater=r.water.rows.at(-1)||null,latestSleep=r.sleep.rows.at(-1)||null;
  const goals=status.goals==='ready'?data.goals||[]:[];
  const nutritionTargets=Object.fromEntries(['calories_kcal','protein_g','carbs_g','fat_g','fiber_g'].map(k=>[k,goalComparison(r.nutrition.closedRows,goals,k)]));
  const currentGoal=goalForDate(goals,m.today);
  const goalReference=historicalGoalReference(goals,m.today);
  const recent={nutrition:Object.fromEntries(['calories_kcal','protein_g','fiber_g'].map(key=>[key,recentObservedChange(r.nutrition.closedRows,key,m.current,m.today)])),sleep:recentObservedChange(r.sleep.closedRows,'value',m.current,m.today),water:recentObservedChange(r.water.closedRows,'value',m.current,m.today)};
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
  const latestExercises=latestSession?exercises.filter(e=>e.workout_source_record_id===latestSession.source_record_id).sort((a,b)=>(num(a.order_index)||0)-(num(b.order_index)||0)).map(exercise=>({...exercise,recordedSets:sets?.filter(s=>s.exercise_source_record_id===exercise.source_record_id).sort((a,b)=>(num(a.set_index)||0)-(num(b.set_index)||0))||[]})):[];
  const load=insights.highlightLoad;
  const freshLoad=load&&(!latestSession||load.latest.date>=addDays(day(latestSession.workout_date),-14))?load:null;
  const meals=status.meals==='ready'?(data.meals||[]).filter(row=>inWindow(day(row.meal_date),m.current)&&day(row.meal_date)<m.today&&norm(row.source)===r.nutrition.source?.key&&r.nutrition.closedRows.some(d=>d.date===day(row.meal_date))&&row.meal_name):[];
  const mealsByDay=new Map();for(const row of meals){const key=JSON.stringify([day(row.meal_date),norm(row.meal_name)]);if(!mealsByDay.has(key))mealsByDay.set(key,[]);mealsByDay.get(key).push(row);}
  const mealNames=new Map();for(const rows of mealsByDay.values()){if(rows.length!==1)continue;const row=rows[0];if(num(row.protein_g)==null)continue;const key=norm(row.meal_name);if(!mealNames.has(key))mealNames.set(key,{label:row.meal_name,values:[]});mealNames.get(key).values.push(num(row.protein_g));}
  const mealDistribution=[...mealNames.values()].map(g=>({label:g.label,value:average(g.values),days:g.values.length}));
  const recentTreatments=status.treatments==='ready'?(data.treatments||[]).filter(row=>inWindow(day(row.event_date),m.current)).sort((a,b)=>day(b.event_date).localeCompare(day(a.event_date))).slice(0,3):[];
  const findings=[];
  if(bodyPairs){const fat=num(bodyPairs.changes.fat_mass_kg),muscle=num(bodyPairs.changes.skeletal_muscle_mass_kg),weight=num(bodyPairs.changes.weight_kg);
    if(fat!=null&&muscle!=null)findings.push({kind:'body',title:`Gordura ${signed(fat)} kg; músculo ${signed(muscle)} kg`,text:`Entre ${fmtDate(bodyPairs.start)} e ${fmtDate(bodyPairs.end)}, na mesma série de origem${bodyPairs.latest.device_name?' e aparelho':'; modelo do aparelho não informado'}.`,detail:'Estimativas de bioimpedância; condições da medição podem influenciar os valores.',route:'bio'});
    else if(weight!=null)findings.push({kind:'body',title:`Peso ${signed(weight)} kg entre avaliações`,text:`${fmtDate(bodyPairs.start)} → ${fmtDate(bodyPairs.end)} · ${bodySourceLabel(bodyPairs.latest)}.`,detail:'Sem dados de gordura e músculo comparáveis, não se atribui a mudança a um tecido.',route:'bio'});
  }
  for(const l of insights.loads.rows.filter(l=>!latestSession||l.latest.date>=addDays(day(latestSession.workout_date),-14)).slice(0,3))findings.push({kind:'training',title:`${l.exercise}: ${fmtNum(l.previous.weight,1)} → ${fmtNum(l.latest.weight,1)} ${loadInsightUnits[l.unit]}`,text:`${l.reps} repetições · ${l.machine} · ${l.location}`,detail:`${fmtDate(l.previous.date)} → ${fmtDate(l.latest.date)}. Variação da carga de trabalho nessas repetições; esforço e execução podem variar.`,route:'treinos',exerciseId:l.latest.exerciseId,unit:l.unit});
  for(const[key,label,unit]of [['protein_g','Proteína','g/dia'],['calories_kcal','Energia registrada','kcal/dia']]){
    const d=recent.nutrition[key];if(d.comparable)findings.push({kind:'nutrition',title:`${label}: ${fmtNum(d.previous,0)} → ${fmtNum(d.current,0)} ${unit}`,text:`${fmtDate(d.previousBounds.start)}–${fmtDate(d.previousBounds.end)} versus ${fmtDate(d.currentBounds.start)}–${fmtDate(d.currentBounds.end)}.`,summary:`${d.previousDays} e ${d.currentDays} dias · ${r.nutrition.source.label}`,detail:`${d.previousDays} e ${d.currentDays} dias com valor · ${r.nutrition.source.label}. Médias dos diários recebidos, sem inferir adequação ou déficit.`,route:'nutricao'});
  }
  for(const[key,label,unit,digits,route]of [['sleep','Sono registrado','h',1,'analise'],['water','Água registrada','mL/dia',0,'nutricao']]){
    const d=recent[key];if(d.comparable)findings.push({kind:key,title:`${label}: ${fmtNum(d.previous,digits)} → ${fmtNum(d.current,digits)} ${unit}`,text:`${fmtDate(d.previousBounds.start)}–${fmtDate(d.previousBounds.end)} versus ${fmtDate(d.currentBounds.start)}–${fmtDate(d.currentBounds.end)}.`,summary:`${d.previousDays} e ${d.currentDays} dias · ${r[key].source.label}`,detail:`${d.previousDays} e ${d.currentDays} dias com valor · ${r[key].source.label}. Dias ausentes não são zero.`,route});
  }
  const foodContrast=insights.highlightNutrition;
  if(foodContrast)findings.push({kind:'nutrition',title:`${foodContrast.label}: ${fmtNum(foodContrast.withMean,0)} versus ${fmtNum(foodContrast.withoutMean,0)} ${foodContrast.unit}/dia`,text:'Dias com treino versus dias sem treino registrado, na mesma fonte alimentar.',detail:`${foodContrast.withDays} e ${foodContrast.withoutDays} dias com valor. Associação descritiva; ausência de treino não confirma descanso.`,route:'nutricao'});
  const energyChange=foodChange('calories_kcal');
  if(energyChange)findings.push({kind:'nutrition',title:`Energia registrada ${signed(energyChange.delta,0)} kcal/dia`,text:'Média dos dias encerrados versus a janela anterior de mesma duração.',detail:`${r.nutrition.source.label}. Os diários podem estar incompletos; não é estimativa de déficit energético.`,route:'nutricao'});
  for(const lab of m.labs.comparisons.filter(x=>x.comparable).slice(0,3))findings.push({kind:'labs',title:`${lab.group.label}: ${lab.previous.result_raw||fmtNum(lab.previous.result_numeric,2)} → ${lab.current.result_raw||fmtNum(lab.current.result_numeric,2)} ${lab.current.unit||''}`,text:`${fmtDate(lab.previous.collection_date)} → ${fmtDate(lab.current.collection_date)} · mesma origem, unidade e método declarado.`,summary:`${lab.current.laboratory||lab.current.source||'Origem no detalhe'} · método declarado`,detail:`${lab.baselineOutsideWindow?'A coleta anterior é contexto fora da janela. ':''}Referência do laboratório no detalhe; variação isolada não define diagnóstico.`,route:'saude'});
  const next=[];
  if(body&&!bodyPairs)next.push({title:'Condições da avaliação corporal',text:`${fmtDate(body.measured_at)} · ${bodySourceLabel(body)}. Confira o aparelho das avaliações anteriores antes de atribuir a diferença a gordura ou músculo.`,route:'bio'});
  if(recent.sleep.comparable)next.push({title:'Sono nas últimas duas semanas',text:`${fmtNum(recent.sleep.previous,1)} → ${fmtNum(recent.sleep.current,1)} h em média. Abra as datas e a origem para conferir a rotina registrada.`,route:'analise'});
  if(latestSession&&!freshLoad)next.push({title:'Contexto do treino mais recente',text:`${fmtDate(latestSession.workout_date)} · ${latestSession.location||'Local não informado'}. Compare exercícios no mesmo aparelho; o histórico de carga pode ser anterior a esta sessão.`,route:'treinos'});
  else if(freshLoad)next.push({title:`Conferir ${freshLoad.exercise}`,text:`${fmtNum(freshLoad.previous.weight,1)} → ${fmtNum(freshLoad.latest.weight,1)} ${loadInsightUnits[freshLoad.unit]} em ${freshLoad.reps} reps. Confira execução e esforço nas duas sessões.`,route:'treinos'});
  if(!currentGoal&&status.goals==='ready')next.push({title:goalReference?'Vigência do plano alimentar':'Conferir suas metas',text:goalReference?`As referências do protocolo de ${fmtDate(goalReference.meta.documented_on)} foram recuperadas. A data de vigência do plano atual continua sem confirmação.`:'Registrar as referências do seu plano alimentar permite comparar consumo e objetivo.',kind:'goals'});
  next.push({title:'Preparar a próxima consulta',text:'Gerar um resumo de evolução com exames e contexto dos protocolos.',kind:'consultation'});
  return {insights,body,bodyPairs,bodyPrevious,latestFood,latestWater,latestSleep,nutritionTargets,currentGoal,goalReference,recent,foodChange,sleepChange,trainingGroups,latestSession,latestExercises,freshLoad,mealDistribution,recentTreatments,findings,next:next.slice(0,3),goalsAvailable:status.goals==='ready',waterMean:r.water.closedRows.length>=5?r.water.mean:null};
}
