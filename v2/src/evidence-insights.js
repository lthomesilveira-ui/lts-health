import {num,fmtNum,fmtDate} from './core.js';
import {nutritionPeriodModel} from './home-period-model.js';
import {validDay} from './history-tools.js';
import {localHealthDay} from './health-context.js';
import {trainingComparability,recordedLoadUnits} from './training-comparability.js';

const ready=(status,keys)=>keys.every(key=>status?.[key]==='ready');
const inside=(date,bounds,today)=>Boolean(date&&date<today&&(!bounds.start||date>=bounds.start)&&(!bounds.end||date<=bounds.end));
const average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const canonical=data=>(data.workouts||[]).filter(row=>row.is_canonical===true&&row.record_status!=='quarantined');
export const nutritionInsightMetrics=[['protein_g','Proteína','g'],['calories_kcal','Energia alimentar','kcal'],['carbs_g','Carboidratos','g'],['fat_g','Gorduras','g']];
export const loadInsightUnits=recordedLoadUnits;

// A descriptive display rule, not a significance test or proof of complete diaries.
export function nutritionTrainingContrast(data={},status={},bounds={},requestedSource='',today=localHealthDay()){
  const nutrition=nutritionPeriodModel(data,status,bounds,{reportNutritionSource:requestedSource},today);
  const availability=nutrition.available&&ready(status,['workouts']);
  const trainingDays=new Set((ready(status,['workouts'])?canonical(data):[]).map(row=>validDay(row.workout_date)).filter(date=>inside(date,bounds,today)));
  const ordered=nutrition.sources.map(origin=>{
    const source={...origin,days:origin.closedRows.map(row=>({date:row.date,row,withTraining:trainingDays.has(row.date)}))};
    const rows=nutritionInsightMetrics.map(([key,label,unit])=>{
      const observed=source.days.filter(item=>num(item.row[key])!=null&&num(item.row[key])>=0);
      const withTraining=observed.filter(item=>item.withTraining),withoutTraining=observed.filter(item=>!item.withTraining);
      const a=average(withTraining.map(item=>num(item.row[key]))),b=average(withoutTraining.map(item=>num(item.row[key])));
      const comparable=withTraining.length>=5&&withoutTraining.length>=5;
      return{key,label,unit,withMean:a,withoutMean:b,withDays:withTraining.length,withoutDays:withoutTraining.length,comparable,delta:comparable?a-b:null};
    });
    return{...source,rows,comparisonCount:rows.filter(row=>row.comparable).length};
  }).sort((a,b)=>b.comparisonCount-a.comparisonCount||b.days.length-a.days.length||a.key.localeCompare(b.key));
  const selected=ordered.find(source=>source.key===nutrition.source?.key)||null;
  return{available:availability,reason:availability?null:'unavailable',sources:ordered,selected,
    rows:availability?selected?.rows||[]:[],ambiguousDays:new Set(nutrition.duplicates.map(row=>row.date)).size,unknownSourceDays:nutrition.unknownRows,
    requestedSource:nutrition.requestedSource,requestedSourceMissing:nutrition.requestedSourceMissing,selectionMessage:nutrition.selectionMessage,bounds,today};
}

// Equivalent recorded working-load conditions only. No maximum selection,
// inferred technique/effort, strength estimate, alias or physical-station claim.
export function workingLoadChanges(data={},status={},bounds={},today=localHealthDay()){
  if(!ready(status,['workouts','exercises','sets']))return{available:false,reason:'unavailable',rows:[],singleSessionCohorts:0,ambiguousDays:0};
  const comparison=trainingComparability(data,{bounds,today,closedOnly:true});
  const rows=comparison.comparable.map(cohort=>({...cohort,sessions:undefined}));
  rows.sort((a,b)=>b.latest.date.localeCompare(a.latest.date)||a.exercise.localeCompare(b.exercise,'pt-BR')||a.key.localeCompare(b.key));
  const singleSessionCohorts=comparison.comparableCohorts.filter(cohort=>cohort.points.length<2).length;
  const ambiguousDays=new Set(comparison.cohorts.flatMap(cohort=>cohort.ambiguousDates)).size;
  const excludedSets=comparison.history.filter(row=>!row.comparableEligible).length;
  return{available:true,rows,singleSessionCohorts,ambiguousDays,excludedSets,bounds,today,
    history:comparison.history,observed:comparison.observed,indeterminate:comparison.indeterminate,comparisonPending:comparison.comparisonPending};
}

export function evidenceInsights(data={},status={},bounds={},requestedSource='',today=localHealthDay()){
  const nutrition=nutritionTrainingContrast(data,status,bounds,requestedSource,today),loads=workingLoadChanges(data,status,bounds,today);
  const protein=nutrition.rows.find(row=>row.key==='protein_g'&&row.comparable),energy=nutrition.rows.find(row=>row.key==='calories_kcal'&&row.comparable);
  // Freshness comes before the direction of the change. An old changed load
  // must not displace a more recent, unchanged comparison.
  const load=loads.rows[0]||null;
  return{nutrition,loads,highlightNutrition:protein||energy||null,highlightLoad:load};
}

export function insightSummaries(model){
  const output=[],n=model.highlightNutrition,l=model.highlightLoad;
  if(n)output.push({title:`${n.label} nos dias com treino registrado`,text:`${fmtNum(n.withMean,0)} ${n.unit}/dia nos ${n.withDays} dias com treino registrado, versus ${fmtNum(n.withoutMean,0)} nos ${n.withoutDays} dias sem treino registrado.`,detail:`${model.nutrition.selected.label}. Médias apenas dos dias com valor; sem registro de treino não significa descanso. A diferença não prova efeito do treino nem adequação da ingestão.`,route:'nutricao'});
  if(l)output.push({title:`Carga registrada: ${l.exercise}`,text:`${fmtNum(l.previous.weight,1)} → ${fmtNum(l.latest.weight,1)} ${loadInsightUnits[l.unit]} em séries de ${l.reps} repetições, entre ${fmtDate(l.previous.date)} e ${fmtDate(l.latest.date)}.`,detail:`${l.machine} · ${l.location}. Duas últimas sessões com condições registradas equivalentes dentre ${l.points.length}; cargas nas mesmas repetições, sem escolha automática do maior valor. Não confirma a mesma estação física, execução equivalente ou ganho de força.`,route:'treinos'});
  return output;
}
