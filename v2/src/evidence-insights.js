import {num,norm,fmtNum,fmtDate} from './core.js';
import {validDay} from './history-tools.js';
import {localHealthDay} from './health-context.js';

const ready=(status,keys)=>keys.every(key=>status?.[key]==='ready');
const inside=(date,bounds,today)=>Boolean(date&&date<today&&(!bounds.start||date>=bounds.start)&&(!bounds.end||date<=bounds.end));
const average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const canonical=data=>(data.workouts||[]).filter(row=>row.is_canonical===true&&row.record_status!=='quarantined');
export const nutritionInsightMetrics=[['protein_g','Proteína','g'],['calories_kcal','Energia alimentar','kcal'],['carbs_g','Carboidratos','g'],['fat_g','Gorduras','g']];
export const loadInsightUnits={kg:'kg',lb:'lb',lb_per_side:'lb por lado',plate_index:'placas (sem conversão para kg)'};

// A descriptive display rule, not a significance test or proof of complete diaries.
export function nutritionTrainingContrast(data={},status={},bounds={},requestedSource='',today=localHealthDay()){
  if(!ready(status,['nutrition','workouts']))return{available:false,reason:'unavailable',sources:[],rows:[]};
  const trainingDays=new Set(canonical(data).map(row=>validDay(row.workout_date)).filter(date=>inside(date,bounds,today)));
  const byDay=new Map();
  for(const row of data.nutrition||[]){const date=validDay(row.nutrition_date);if(!inside(date,bounds,today))continue;if(!byDay.has(date))byDay.set(date,[]);byDay.get(date).push(row);}
  const sources=new Map();let ambiguousDays=0,unknownSourceDays=0;
  for(const [date,items] of byDay){
    if(items.length!==1){ambiguousDays++;continue;}
    const row=items[0],key=norm(row.source);if(!key){unknownSourceDays++;continue;}
    if(!sources.has(key))sources.set(key,{key,label:String(row.source).trim(),days:[]});
    sources.get(key).days.push({date,row,withTraining:trainingDays.has(date)});
  }
  const ordered=[...sources.values()].map(source=>{
    const rows=nutritionInsightMetrics.map(([key,label,unit])=>{
      const observed=source.days.filter(item=>num(item.row[key])!=null&&num(item.row[key])>=0);
      const withTraining=observed.filter(item=>item.withTraining),withoutTraining=observed.filter(item=>!item.withTraining);
      const a=average(withTraining.map(item=>num(item.row[key]))),b=average(withoutTraining.map(item=>num(item.row[key])));
      const comparable=withTraining.length>=5&&withoutTraining.length>=5;
      return{key,label,unit,withMean:a,withoutMean:b,withDays:withTraining.length,withoutDays:withoutTraining.length,comparable,delta:comparable?a-b:null};
    });
    return{...source,rows,comparisonCount:rows.filter(row=>row.comparable).length};
  }).sort((a,b)=>b.comparisonCount-a.comparisonCount||b.days.length-a.days.length||a.key.localeCompare(b.key));
  const latest=[...ordered].sort((a,b)=>b.days.map(d=>d.date).sort().at(-1).localeCompare(a.days.map(d=>d.date).sort().at(-1))||b.days.length-a.days.length)[0];
  const selected=requestedSource?ordered.find(source=>source.key===requestedSource)||null:latest||null;
  return{available:true,sources:ordered,selected,rows:selected?.rows||[],ambiguousDays,unknownSourceDays,bounds,today};
}

// Compare recorded working loads at the SAME repetitions; never estimate strength,
// convert machine scales, pool locations, or promote warmups/unknown units.
export function workingLoadChanges(data={},status={},bounds={},today=localHealthDay()){
  if(!ready(status,['workouts','exercises','sets']))return{available:false,reason:'unavailable',rows:[],singleSessionCohorts:0,ambiguousDays:0};
  const workouts=new Map(canonical(data).filter(row=>inside(validDay(row.workout_date),bounds,today)).map(row=>[row.source_record_id,row]));
  const exercises=new Map((data.exercises||[]).filter(row=>workouts.has(row.workout_source_record_id)).map(row=>[row.source_record_id,row]));
  const groups=new Map();let excludedSets=0;
  for(const set of data.sets||[]){
    const exercise=exercises.get(set.exercise_source_record_id),workout=workouts.get(set.workout_source_record_id);
    const date=validDay(workout?.workout_date),weight=num(set.weight),reps=num(set.reps_numeric),unit=String(set.weight_unit||'').trim();
    if(!exercise||!workout||exercise.workout_source_record_id!==workout.source_record_id||set.phase!=='working'||weight==null||weight<0||reps==null||reps<=0||!Number.isInteger(reps)||!Object.hasOwn(loadInsightUnits,unit)||!norm(exercise.exercise)||!norm(exercise.machine)||!norm(workout.location)||!norm(workout.source)||!norm(exercise.source)||!norm(set.source)||(set.workout_date&&validDay(set.workout_date)!==date)||(exercise.workout_date&&validDay(exercise.workout_date)!==date)){
      excludedSets++;continue;
    }
    const key=JSON.stringify([norm(exercise.exercise),norm(exercise.machine),norm(workout.location),unit,reps,norm(set.technique),norm(workout.source),norm(exercise.source),norm(set.source)]);
    if(!groups.has(key))groups.set(key,{key,exercise:exercise.exercise,machine:exercise.machine,location:workout.location,unit,reps,technique:String(set.technique||'').trim(),sessions:new Map()});
    const group=groups.get(key),id=workout.source_record_id;
    if(!group.sessions.has(id))group.sessions.set(id,{date,weight,workoutId:id,exerciseId:exercise.source_record_id});
    const session=group.sessions.get(id);if(weight>session.weight){session.weight=weight;session.exerciseId=exercise.source_record_id;}
  }
  const rows=[];let singleSessionCohorts=0,ambiguousDays=0;
  for(const group of groups.values()){
    const dateCounts=new Map();for(const session of group.sessions.values())dateCounts.set(session.date,(dateCounts.get(session.date)||0)+1);
    ambiguousDays+=[...dateCounts.values()].filter(count=>count>1).length;
    const points=[...group.sessions.values()].filter(session=>dateCounts.get(session.date)===1).sort((a,b)=>a.date.localeCompare(b.date));
    if(points.length<2){singleSessionCohorts++;continue;}
    const previous=points.at(-2),latest=points.at(-1);
    rows.push({...group,sessions:undefined,points,previous,latest,delta:latest.weight-previous.weight});
  }
  rows.sort((a,b)=>b.latest.date.localeCompare(a.latest.date)||a.exercise.localeCompare(b.exercise,'pt-BR')||a.key.localeCompare(b.key));
  return{available:true,rows,singleSessionCohorts,ambiguousDays,excludedSets,bounds,today};
}

export function evidenceInsights(data={},status={},bounds={},requestedSource='',today=localHealthDay()){
  const nutrition=nutritionTrainingContrast(data,status,bounds,requestedSource,today),loads=workingLoadChanges(data,status,bounds,today);
  const protein=nutrition.rows.find(row=>row.key==='protein_g'&&row.comparable),energy=nutrition.rows.find(row=>row.key==='calories_kcal'&&row.comparable);
  const load=loads.rows.find(row=>row.delta!==0)||loads.rows[0]||null;
  return{nutrition,loads,highlightNutrition:protein||energy||null,highlightLoad:load};
}

export function insightSummaries(model){
  const output=[],n=model.highlightNutrition,l=model.highlightLoad;
  if(n)output.push({title:`${n.label} nos dias com treino registrado`,text:`${fmtNum(n.withMean,0)} ${n.unit}/dia nos ${n.withDays} dias com treino registrado, versus ${fmtNum(n.withoutMean,0)} nos ${n.withoutDays} dias sem treino registrado.`,detail:`${model.nutrition.selected.label}. Médias apenas dos dias com valor; sem registro de treino não significa descanso. A diferença não prova efeito do treino nem adequação da ingestão.`,route:'nutricao'});
  if(l)output.push({title:`Carga registrada: ${l.exercise}`,text:`${fmtNum(l.previous.weight,1)} → ${fmtNum(l.latest.weight,1)} ${loadInsightUnits[l.unit]} em séries de ${l.reps} repetições, entre ${fmtDate(l.previous.date)} e ${fmtDate(l.latest.date)}.`,detail:`${l.machine} · ${l.location}. Duas últimas sessões comparáveis dentre ${l.points.length}; maior carga de trabalho nessas repetições, sem estimativa de força. Técnica, execução e esforço podem não estar completamente registrados.`,route:'treinos'});
  return output;
}
