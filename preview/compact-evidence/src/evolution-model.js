import {num,day,norm,fmtNum,fmtDate} from './core.js';
import {homePeriodModel} from './home-period-model.js';
import {evidenceInsights,loadInsightUnits} from './evidence-insights.js';
import {waterReferenceContext} from './water-reference-context.js';
import {goalComparison,goalForDate,historicalGoalReference} from './personal-goals.js';
import {normalizeMuscleGroup,addDays} from './integrated-analysis.js';
import {bodySourceLabel} from './health-context.js';
import {labReferenceStatus,labResultText} from './labs-layout-v2.js';
import {trainingSetCounts,isSetExtension} from './training-session.js';

const average=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const inWindow=(date,b)=>date&&(!b.start||date>=b.start)&&date<=b.end;
const signed=(v,d=1)=>`${v>0?'+':''}${fmtNum(v,d)}`;
// Legacy local-week utility, retained for explicit local analyses only.
// The global evolution model below never calls this function.
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
const direction=delta=>delta>0?'aumentou':delta<0?'diminuiu':'ficou estável';
const routineChange=(label,d,unit)=>d.delta===0?`${label} não mudou entre os períodos`:`${label} ${direction(d.delta)} ${fmtNum(Math.abs(d.delta),0)} ${unit}`;
function evolutionReadings(m,r,e){
  const readings={};
  const currentLabs=(m.labs.comparisons||[]).filter(row=>row.current),lastCollection=currentLabs.map(row=>day(row.current.collection_date)).sort().at(-1);
  const priority=['Testosterona Total','Hemoglobina','Hematócrito'];
  const outside=currentLabs.filter(row=>day(row.current.collection_date)===lastCollection&&['above','below'].includes(labReferenceStatus(row.current).status)).sort((a,b)=>{
    const rank=row=>priority.includes(row.group.label)?priority.indexOf(row.group.label):priority.length;
    return rank(a)-rank(b)||a.group.label.localeCompare(b.group.label,'pt-BR');
  });
  if(outside.length){
    const rows=outside.slice(0,3);
    readings.labs={kind:'labs',priority:0,title:'Exames para discutir na consulta',meaning:`${rows.map(row=>`${row.group.label}: ${labReferenceStatus(row.current).status==='above'?'acima':'abaixo'} da faixa exibida no laudo`).join('; ')}.`,evidence:rows.map(row=>`${labResultText(row.current)} · faixa ${labReferenceStatus(row.current).lowRaw}–${labReferenceStatus(row.current).highRaw} ${row.current.unit} · ${fmtDate(row.current.collection_date)}`).join('; '),limit:'Faixas de referência não são metas do protocolo. Leve os valores e o contexto dos medicamentos ao médico, sem ajustar doses por este painel.',route:'saude',action:'Ver exames e referências'};
  }else{
    const row=currentLabs.find(row=>row.comparable);
    if(row)readings.labs={kind:'labs',priority:4,title:`${row.group.label}: valor ${direction(row.delta)}`,meaning:'A mudança é observada em coletas comparáveis; seu significado depende da referência e do contexto clínico, não apenas da direção.',evidence:`${labResultText(row.previous)} → ${labResultText(row.current)} · ${fmtDate(row.previous.collection_date)} → ${fmtDate(row.current.collection_date)}`,limit:'Uma mudança isolada não confirma melhora ou piora da saúde.',route:'saude',action:'Ver histórico dos exames',rows:[row]};
  }
  if(e.body){
    const fat=num(e.bodyPairs?.changes.fat_mass_kg),muscle=num(e.bodyPairs?.changes.skeletal_muscle_mass_kg);
    readings.body=e.bodyPairs?{kind:'body',priority:1,title:'O que as avaliações corporais mostram',meaning:fat!=null&&muscle!=null?`A gordura estimada ${direction(fat)} e o músculo estimado ${direction(muscle)} nas duas avaliações da mesma série.`:'Há uma diferença registrada entre as avaliações; sem gordura e músculo comparáveis, não se atribui a mudança a um tecido.',evidence:fat!=null&&muscle!=null?`Gordura ${signed(fat)} kg · músculo ${signed(muscle)} kg · ${fmtDate(e.bodyPairs.start)} → ${fmtDate(e.bodyPairs.end)}`:`Peso ${signed(e.bodyPairs.changes.weight_kg)} kg · ${fmtDate(e.bodyPairs.start)} → ${fmtDate(e.bodyPairs.end)}`,limit:'Bioimpedância é uma estimativa. Aparelho, água corporal e condições de medição precisam ser considerados.',route:'bio',action:'Ver as avaliações'}:{kind:'body',priority:8,title:'Ganho ou perda de tecido ainda não confirmados',meaning:e.bodyPrevious?'Os valores anteriores e atuais estão lado a lado, mas a comparação entre avaliações não está confirmada. Não há conclusão segura de ganho de gordura ou perda de músculo.':'Há uma avaliação disponível; falta outra compatível para concluir a evolução de gordura e músculo.',evidence:`Última avaliação: ${fmtDate(e.body.measured_at)} · ${bodySourceLabel(e.body)}`,limit:'Confirme o aparelho e as condições das duas medições antes de interpretar diferenças.',route:'bio',action:'Conferir composição corporal'};
  }
  const p=e.recent.nutrition.protein_g,k=e.recent.nutrition.calories_kcal;
  if(p.comparable||k.comparable){
    const combinations=p.comparable&&k.comparable;
    const stable=combinations&&p.delta===0&&k.delta===0;
    const title=stable?'Proteína e energia registradas estáveis':combinations&&p.delta<0&&k.delta>0?'Menos proteína, mais energia registrada':combinations&&p.delta>0&&k.delta<0?'Mais proteína, menos energia registrada':combinations?'Seu registro alimentar mudou':`${p.comparable?'Proteína':'Energia'} registrada ${direction(p.comparable?p.delta:k.delta)}`;
    const d=p.comparable?p:k;
    readings.nutrition={kind:'nutrition',priority:stable?6:2,title,meaning:[p.comparable?routineChange('A proteína média',p,'g/dia'):null,k.comparable?routineChange('a energia média',k,'kcal/dia'):null].filter(Boolean).join('; ')+'.',evidence:[p.comparable?`Proteína ${fmtNum(p.previous,0)} → ${fmtNum(p.current,0)} g/dia (${p.previousDays}/${p.previousBounds.closedDays} e ${p.currentDays}/${p.currentBounds.closedDays} dias)`:null,k.comparable?`energia ${fmtNum(k.previous,0)} → ${fmtNum(k.current,0)} kcal/dia (${k.previousDays}/${k.previousBounds.closedDays} e ${k.currentDays}/${k.currentBounds.closedDays} dias)`:null].filter(Boolean).join('; ')+`. ${fmtDate(d.previousBounds.start)}–${fmtDate(d.previousBounds.end)} → ${fmtDate(d.currentBounds.start)}–${fmtDate(d.currentBounds.end)} · ${d.sourceLabel}.`,limit:`${d.rule.description} Os diários podem ser parciais.${e.currentGoal?' Compare com o plano vigente nos mesmos dias.':' O plano atual ainda não tem vigência confirmada; não se conclui adequação ou déficit.'}`,route:'nutricao',action:'Ver alimentação e plano'};
  }
  if(!readings.nutrition&&(p.current!=null||k.current!=null)){
    readings.nutrition={kind:'nutrition',priority:8,title:'Alimentação observada no período',meaning:[p.current!=null?`Proteína média ${fmtNum(p.current,0)} g em ${p.currentDays}/${p.currentBounds.closedDays} dias encerrados`:null,k.current!=null?`energia média ${fmtNum(k.current,0)} kcal em ${k.currentDays}/${k.currentBounds.closedDays} dias encerrados`:null].filter(Boolean).join('; ')+'.',evidence:`${fmtDate(p.currentBounds.start)}–${fmtDate(p.currentBounds.end)} · ${p.sourceLabel||k.sourceLabel||'origem indisponível'}.`,limit:'Sem base equivalente suficiente para comparar períodos. Os diários observados podem estar incompletos.',route:'nutricao',action:'Ver alimentação e cobertura'};
  }
  if(e.latestSleep){
    const d=e.recent.sleep;
    readings.sleep=d.comparable?{kind:'sleep',priority:3,title:d.delta<0?'Sono registrado mais curto':d.delta>0?'Sono registrado mais longo':'Duração média do sono estável',meaning:d.delta?`A média ${d.delta<0?'caiu':'subiu'} cerca de ${fmtNum(Math.abs(d.delta)*60,0)} minutos por registro entre os dois períodos.`:'A duração média não mudou entre os períodos observados.',evidence:`${fmtNum(d.previous,1)} → ${fmtNum(d.current,1)} h · ${d.previousDays}/${d.previousBounds.closedDays} e ${d.currentDays}/${d.currentBounds.closedDays} dias · ${fmtDate(d.previousBounds.start)}–${fmtDate(d.previousBounds.end)} → ${fmtDate(d.currentBounds.start)}–${fmtDate(d.currentBounds.end)} · ${d.sourceLabel}.`,limit:`${d.rule.description} É duração registrada, não uma medida de qualidade ou prontidão. Não se atribui a ela a mudança no treino.`,route:'analise',action:'Ver rotina de sono'}:{kind:'sleep',priority:9,title:'Sono: falta base para comparar períodos',meaning:d.current!=null?`Média observada de ${fmtNum(d.current,1)} h em ${d.currentDays}/${d.currentBounds.closedDays} dias encerrados. Falta base equivalente suficiente para comparar os períodos.`:'A última duração está disponível; falta uma origem equivalente verificada para comparar os períodos.',evidence:`${fmtNum(e.latestSleep.value,1)} h · ${fmtDate(e.latestSleep.date)} · ${r.sleep.source.label}`,limit:'Dias sem registro não são zero horas de sono.',route:'analise',action:'Ver registros de sono'};
  }
  if(e.latestSession){
    const l=e.freshLoad;
    readings.training=l?{kind:'training',priority:1,title:`Carga de trabalho ${direction(l.delta)} neste exercício`,meaning:`${l.exercise}: a comparação usa ${l.reps} repetições com a mesma descrição registrada de aparelho e local. Isso descreve este exercício, não melhora ou piora global do treino.`,evidence:`${fmtNum(l.previous.weight,1)} → ${fmtNum(l.latest.weight,1)} ${loadInsightUnits[l.unit]} · ${fmtDate(l.previous.date)} → ${fmtDate(l.latest.date)}`,limit:'Execução e esforço podem variar; a diferença de carga registrada não confirma execução idêntica nem ganho de força.',route:'treinos',action:'Ver cargas registradas'}:{kind:'training',priority:8,title:'Comparação recente ainda limitada',meaning:'As cargas e repetições da última sessão estão disponíveis. Falta um par recente de séries de trabalho com condições registradas equivalentes.',evidence:`${fmtDate(e.latestSession.workout_date)} · ${e.latestSession.workout_type||'Treino'} · ${e.latestSession.location||'Local não informado'}`,limit:'Uma carga maior em outro aparelho, com outras repetições ou fase desconhecida não comprova melhora.',route:'treinos',action:'Conferir a sessão recente'};
  }
  if(e.latestWater)readings.water={kind:'water',priority:9,title:'O registro de água pode ser parcial',meaning:'O total recebido não comprova o consumo completo do dia. Ainda não é possível afirmar se a hidratação atingiu o plano.',evidence:`${fmtNum(e.latestWater.value,0)} mL · ${fmtDate(e.latestWater.date)} · ${r.water.source.label}`,limit:'Confira a completude do registro e a vigência da meta; dias ausentes ficam fora das médias.',route:'nutricao',action:'Conferir água e meta'};
  return {domainReadings:readings,takeaways:Object.values(readings).sort((a,b)=>a.priority-b.priority),labReferenceRows:outside};
}
export function evolutionModel(data,status,m,r,ui={}){
  const insights=evidenceInsights(data,status,m.current,r.nutrition.source?.key||r.nutrition.requestedSource||'__no_selected_origin__',m.today);
  // The selected global calendar and its equal-duration predecessor are the
  // only time windows feeding synthesis. Never fall back to a fixed fortnight.
  const period=['30','90','365','all'].includes(String(m.period))?String(m.period):String(m.current.days||'all');
  const available=homePeriodModel(data,status,period,{},m.today);
  const exactSource=(domain,legacy)=>{
    if(!legacy)return '__no_selected_origin__';
    const exact=available[domain].sources.find(source=>source.key===legacy.key);if(exact)return exact.key;
    let matches=available[domain].sources.filter(source=>norm(source.label)===norm(legacy.label));
    if(domain==='nutrition')matches=matches.filter(source=>source.domain==='nutrition');
    if(domain==='sleep'){
      // Recovery's legacy key carries raw source identity even when its display
      // label is a friendly device alias. Canonical/held/candidate are not pooled.
      try{const [metric,family,name,unit]=JSON.parse(legacy.key);if(metric==='sleep_duration_h')matches=available.sleep.sources.filter(source=>source.domain==='sourceMetrics'&&norm(source.sourceFamily)===norm(family)&&norm(source.label)===norm(name)&&norm(source.unit)===norm(unit));}catch{}
    }
    return matches.length===1?matches[0].key:'__ambiguous_or_missing_origin__';
  };
  const periodModel=homePeriodModel(data,status,period,{...ui,homeNutritionSource:r.nutrition.source?.key||r.nutrition.requestedSource||'__no_selected_origin__',homeSleepSource:exactSource('sleep',r.sleep.source),homeWaterSource:exactSource('water',r.water.source)},m.today);
  const matchingWindow=periodModel.bounds.start===m.current.start&&periodModel.bounds.end===m.current.end;
  const align=comparison=>matchingWindow?comparison:{...comparison,comparable:false,delta:null,reason:'window_mismatch'};
  const body=m.body.latest||null;
  const bodyPairs=m.body.available?m.body:null;
  const bodyPrevious=m.body.previous||null;
  const latestFood=r.nutrition.rows.at(-1)||null,latestWater=r.water.rows.at(-1)||null,latestSleep=r.sleep.rows.at(-1)||null;
  const goals=status.goals==='ready'?data.goals||[]:[];
  const nutritionTargets=Object.fromEntries(['calories_kcal','protein_g','carbs_g','fat_g','fiber_g'].map(k=>[k,goalComparison(r.nutrition.closedRows,goals,k)]));
  const currentGoal=goalForDate(goals,m.today);
  const goalReference=historicalGoalReference(goals,m.today);
  const recent={nutrition:Object.fromEntries(Object.entries(periodModel.nutrition.comparison).map(([key,value])=>[key,align(value)])),sleep:align(periodModel.sleep.comparison),water:align(periodModel.water.comparison)};
  const foodChange=key=>recent.nutrition[key]?.comparable?recent.nutrition[key]:null;
  const sleepChange=recent.sleep.comparable?recent.sleep:null;
  const workouts=new Map((m.training.rows||[]).map(w=>[w.source_record_id,w]));
  const exercises=status.exercises==='ready'?(data.exercises||[]).filter(e=>workouts.has(e.workout_source_record_id)):[];
  const exMap=new Map(exercises.map(e=>[e.source_record_id,e]));
  const sets=status.sets==='ready'&&status.exercises==='ready'?(data.sets||[]).filter(s=>workouts.has(s.workout_source_record_id)&&exMap.get(s.exercise_source_record_id)?.workout_source_record_id===s.workout_source_record_id):null;
  const groups=new Map();
  for(const s of sets||[]){if(isSetExtension(s))continue;const group=normalizeMuscleGroup(exMap.get(s.exercise_source_record_id)?.muscle_group);groups.set(group,(groups.get(group)||0)+1);}
  const trainingGroups=[...groups].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label));
  const lastWorkout=[...(m.training.rows||[])].sort((a,b)=>day(a.workout_date).localeCompare(day(b.workout_date))).at(-1)||null;
  const latestCounts=sets&&lastWorkout?trainingSetCounts(sets.filter(s=>s.workout_source_record_id===lastWorkout.source_record_id)):null;
  const latestSession=lastWorkout?{...lastWorkout,exerciseCount:status.exercises==='ready'?exercises.filter(e=>e.workout_source_record_id===lastWorkout.source_record_id).length:null,setCount:latestCounts?.primary??null,extensionCount:latestCounts?.extensions??null}:null;
  const latestExercises=latestSession?exercises.filter(e=>e.workout_source_record_id===latestSession.source_record_id).sort((a,b)=>(num(a.order_index)||0)-(num(b.order_index)||0)).map(exercise=>({...exercise,recordedSets:sets?.filter(s=>s.exercise_source_record_id===exercise.source_record_id).sort((a,b)=>(num(a.set_index)||0)-(num(b.set_index)||0))||[]})):[];
  const load=insights.highlightLoad;
  const freshLoad=load&&(!latestSession||load.latest.date>=addDays(day(latestSession.workout_date),-14))?load:null;
  const meals=status.meals==='ready'?(data.meals||[]).filter(row=>inWindow(day(row.meal_date),m.current)&&day(row.meal_date)<m.today&&r.nutrition.source?.domain==='nutrition'&&norm(row.source)===norm(r.nutrition.source.label)&&r.nutrition.closedRows.some(d=>d.date===day(row.meal_date))&&row.meal_name):[];
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
    const d=recent.nutrition[key];if(d.comparable)findings.push({kind:'nutrition',title:`${label}: ${fmtNum(d.previous,0)} → ${fmtNum(d.current,0)} ${unit}`,text:`${fmtDate(d.previousBounds.start)}–${fmtDate(d.previousBounds.end)} versus ${fmtDate(d.currentBounds.start)}–${fmtDate(d.currentBounds.end)}.`,summary:`${d.previousDays} e ${d.currentDays} dias · ${r.nutrition.source.label}`,detail:`${d.previousDays}/${d.previousBounds.closedDays} e ${d.currentDays}/${d.currentBounds.closedDays} dias com valor · ${d.sourceLabel}. ${d.rule.description} Médias dos diários recebidos, sem inferir adequação ou déficit.`,route:'nutricao'});
  }
  for(const[key,label,unit,digits,route]of [['sleep','Sono registrado','h',1,'analise'],['water','Água registrada','mL/dia',0,'nutricao']]){
    const d=recent[key];if(d.comparable)findings.push({kind:key,title:`${label}: ${fmtNum(d.previous,digits)} → ${fmtNum(d.current,digits)} ${unit}`,text:`${fmtDate(d.previousBounds.start)}–${fmtDate(d.previousBounds.end)} versus ${fmtDate(d.currentBounds.start)}–${fmtDate(d.currentBounds.end)}.`,summary:`${d.previousDays} e ${d.currentDays} dias · ${r[key].source.label}`,detail:`${d.previousDays}/${d.previousBounds.closedDays} e ${d.currentDays}/${d.currentBounds.closedDays} dias com valor · ${d.sourceLabel}. ${d.rule.description} Dias ausentes não são zero.`,route});
  }
  const foodContrast=insights.highlightNutrition;
  if(foodContrast)findings.push({kind:'nutrition',title:`${foodContrast.label}: ${fmtNum(foodContrast.withMean,0)} versus ${fmtNum(foodContrast.withoutMean,0)} ${foodContrast.unit}/dia`,text:'Dias com treino versus dias sem treino registrado, na mesma fonte alimentar.',detail:`${foodContrast.withDays} e ${foodContrast.withoutDays} dias com valor. Associação descritiva; ausência de treino não confirma descanso.`,route:'nutricao'});
  const energyChange=foodChange('calories_kcal');
  if(energyChange)findings.push({kind:'nutrition',title:`Energia registrada ${signed(energyChange.delta,0)} kcal/dia`,text:'Média dos dias encerrados versus a janela anterior de mesma duração.',detail:`${r.nutrition.source.label}. Os diários podem estar incompletos; não é estimativa de déficit energético.`,route:'nutricao'});
  for(const lab of m.labs.comparisons.filter(x=>x.comparable).slice(0,3))findings.push({kind:'labs',title:`${lab.group.label}: ${lab.previous.result_raw||fmtNum(lab.previous.result_numeric,2)} → ${lab.current.result_raw||fmtNum(lab.current.result_numeric,2)} ${lab.current.unit||''}`,text:`${fmtDate(lab.previous.collection_date)} → ${fmtDate(lab.current.collection_date)} · mesma origem, unidade e método declarado.`,summary:`${lab.current.laboratory||lab.current.source||'Origem no detalhe'} · método declarado`,detail:`${lab.baselineOutsideWindow?'A coleta anterior é contexto fora da janela. ':''}Referência do laboratório no detalhe; variação isolada não define diagnóstico.`,route:'saude'});
  const next=[];
  if(body&&!bodyPairs)next.push({title:'Condições da avaliação corporal',text:`${fmtDate(body.measured_at)} · ${bodySourceLabel(body)}. Confira o aparelho das avaliações anteriores antes de atribuir a diferença a gordura ou músculo.`,route:'bio'});
  if(recent.sleep.comparable)next.push({title:'Sono nos períodos comparados',text:`${fmtNum(recent.sleep.previous,1)} → ${fmtNum(recent.sleep.current,1)} h em média. Abra as datas e a origem para conferir a rotina registrada.`,route:'analise'});
  if(latestSession&&!freshLoad)next.push({title:'Contexto do treino mais recente',text:`${fmtDate(latestSession.workout_date)} · ${latestSession.location||'Local não informado'}. Compare exercícios no mesmo aparelho; o histórico de carga pode ser anterior a esta sessão.`,route:'treinos'});
  else if(freshLoad)next.push({title:`Conferir ${freshLoad.exercise}`,text:`${fmtNum(freshLoad.previous.weight,1)} → ${fmtNum(freshLoad.latest.weight,1)} ${loadInsightUnits[freshLoad.unit]} em ${freshLoad.reps} reps. Confira execução e esforço nas duas sessões.`,route:'treinos'});
  if(!currentGoal&&status.goals==='ready')next.push({title:goalReference?'Vigência do plano alimentar':'Conferir suas metas',text:goalReference?`As referências do protocolo de ${fmtDate(goalReference.meta.documented_on)} foram recuperadas. A data de vigência do plano atual continua sem confirmação.`:'Registrar as referências do seu plano alimentar permite comparar consumo e objetivo.',kind:'goals'});
  next.push({title:'Preparar a próxima consulta',text:'Gerar um resumo de evolução com exames e contexto dos protocolos.',kind:'consultation'});
  const waterContext=waterReferenceContext(data,status,latestWater?.date||m.today);
  const currentWaterDocument=waterReferenceContext(data,status,m.today).documented;
  const waterReference=waterContext?.selected||currentWaterDocument||null,documentedWaterReference=currentWaterDocument||null;
  const result={waterReference,documentedWaterReference,periodModel,insights,body,bodyPairs,bodyPrevious,latestFood,latestWater,latestSleep,nutritionTargets,currentGoal,goalReference,recent,foodChange,sleepChange,trainingGroups,latestSession,latestExercises,freshLoad,mealDistribution,recentTreatments,findings,next:next.slice(0,3),goalsAvailable:status.goals==='ready',waterMean:r.water.closedRows.length>=5?r.water.mean:null};
  return {...result,...evolutionReadings(m,r,result)};
}

