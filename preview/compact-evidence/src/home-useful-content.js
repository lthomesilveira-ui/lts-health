// Pure descriptions for the selected Home period. No clinical interpretation,
// browser state, database calls, source pooling or load-based selection.
const normalize=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
const numeric=value=>value==null||typeof value==='boolean'||String(value).trim()===''||!Number.isFinite(Number(value))?null:Number(value);
const nonnegative=value=>numeric(value)!=null&&numeric(value)>=0?numeric(value):null;
const unique=values=>[...new Set(values)];
const groups=(rows,key)=>{const result=new Map();for(const row of rows){const k=key(row);if(!result.has(k))result.set(k,[]);result.get(k).push(row);}return result;};
const day=value=>{const text=String(value??'');if(!/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(text))return null;const date=text.slice(0,10),parsed=new Date(`${date}T12:00:00Z`);return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:null;};
const inside=(date,bounds={})=>Boolean(date&&(!bounds.start||date>=bounds.start)&&(!bounds.end||date<=bounds.end));
const format=(value,digits=1)=>value==null?'Sem valor':value.toLocaleString('pt-BR',{maximumFractionDigits:digits});
const dateLabel=date=>date?date.split('-').reverse().join('/'):'sem data';
const dateRange=dates=>!dates.length?'sem datas':dates.length===1?dateLabel(dates[0]):`${dateLabel(dates[0])} a ${dateLabel(dates.at(-1))}`;
const difference=(a,b)=>a==null||b==null?null:Number((b-a).toFixed(10));
const sourceId=row=>row?.source_record_id??row?.id??null;
const bodyDefinitions=[['weight_kg','Peso','kg'],['fat_mass_kg','Gordura estimada','kg'],['skeletal_muscle_mass_kg','Músculo estimado','kg']];
const foodDefinitions=[['calories_kcal','Energia','kcal',0],['protein_g','Proteína','g',0],['carbs_g','Carboidratos','g',0],['fat_g','Gordura alimentar','g',0],['fiber_g','Fibra','g',0]];
const bodyOrigin=row=>[row?.source||'Origem não informada',row?.device_name||'Modelo não informado'].join(' · ');

function bodyContent(m,ui){
  const b=m.body||{},available=b.available!==false,rows=available?(b.rows||[]).map(row=>({...row,date:day(row.date||row.measured_at)})).filter(row=>inside(row.date,m.bounds)):[];
  const byDate=groups(rows,row=>row.date),ambiguousDates=[...byDate].filter(([,list])=>list.length!==1).map(([date])=>date).sort();
  const unambiguous=[...byDate.values()].filter(list=>list.length===1).map(([row])=>row).sort((a,b)=>a.date.localeCompare(b.date));
  const first=unambiguous[0]||null,latest=unambiguous.at(-1)||null,pair=Boolean(first&&latest&&first.date!==latest.date);
  const metrics=Object.fromEntries(bodyDefinitions.map(([key,label,unit])=>{
    const initial=nonnegative(first?.[key]),last=nonnegative(latest?.[key]),delta=pair?difference(initial,last):null;
    return [key,{key,label,unit,first:initial,latest:last,delta,hasPair:delta!=null,firstDate:first?.date||null,lastDate:latest?.date||null,
      firstId:sourceId(first),lastId:sourceId(latest),firstSource:first?bodyOrigin(first):null,lastSource:latest?bodyOrigin(latest):null,
      formula:delta==null?null:`${last} - ${initial}`,meaning:'recorded_difference_only'}];
  }));
  const comparableMetrics=Object.values(metrics).filter(metric=>metric.hasPair),latestMetrics=Object.values(metrics).filter(metric=>metric.latest!=null);
  const requestedSource=ui.homeBodySource||ui.reportBodySource||null,requestedSourceMissing=Boolean(requestedSource&&requestedSource!=='all'&&!rows.length);
  let text;
  if(!available)text='Avaliações corporais não carregaram.';
  else if(requestedSourceMissing)text='A origem corporal escolhida não tem avaliação nesta janela.';
  else if(comparableMetrics.length)text=comparableMetrics.map(metric=>`${metric.label}: ${format(metric.first)} → ${format(metric.latest)} ${metric.unit}`).join('; ')+'.';
  else if(latestMetrics.length)text=`Registro de ${dateLabel(latest.date)}: ${latestMetrics.map(metric=>`${metric.label.toLowerCase()} ${format(metric.latest)} ${metric.unit}`).join('; ')}.`;
  else text=ambiguousDates.length?'As datas com avaliações duplicadas precisam ser conferidas.':'Sem avaliação corporal inequívoca nesta janela.';
  const origins=unique([first,latest].filter(Boolean).map(bodyOrigin));
  const context=[pair?`${dateLabel(first.date)} → ${dateLabel(latest.date)}.`:latest?`Avaliação de ${dateLabel(latest.date)}.`:'',origins.join(' / '),
    'Condições das avaliações não confirmadas; estimativas de composição não comprovam mudança de tecido.',
    ambiguousDates.length?`${ambiguousDates.length} data(s) com mais de uma avaliação ficaram fora desta comparação: ${ambiguousDates.map(dateLabel).join(', ')}.`:''].filter(Boolean).join(' ');
  return {available,first,latest,pair,metrics,changes:Object.fromEntries(Object.entries(metrics).map(([key,metric])=>[key,metric.delta])),
    dates:unambiguous.map(row=>row.date),ambiguousDates,excludedDates:ambiguousDates,requestedSource,requestedSourceMissing,
    title:comparableMetrics.length?'Entre as avaliações do período':'Avaliações no período',text,context,evidence:context,
    selectionRule:'Primeira e última avaliações em datas inequívocas dentro do filtro e da origem escolhida; cada variável exige valor nas duas.',
    sourceRecordIds:unique([sourceId(first),sourceId(latest)].filter(Boolean)),conditionsConfirmed:false};
}

/** Persistent UI value: descriptions only, never an assertion of station ID. */
export function homeTrainingContextKey(exercise,machine,location){
  return JSON.stringify([normalize(exercise),normalize(machine),normalize(location)]);
}
const contextOf=cohort=>homeTrainingContextKey(cohort.exercise,cohort.machine,cohort.location);
const historyContextOf=row=>homeTrainingContextKey(row.exercise?.exercise,row.exercise?.machine,row.workout?.location);
const byRecurrence=(a,b)=>b.dateCount-a.dateCount||(b.lastDate||'').localeCompare(a.lastDate||'')||a.key.localeCompare(b.key);
const truth=value=>value===true?'sim':value===false?'não':'não informado';
function trainingContent(m,ui){
  const training=m.training||{},e=m.evidence?.training||{},available=training.available!==false&&e.available===true;
  const history=available?(e.history||[]).filter(row=>inside(day(row.date),m.bounds)):[];
  const examples=available?(e.examples||[]).map(cohort=>{
    const points=(cohort.points||[]).map(point=>({...point,date:day(point.date)})).filter(point=>inside(point.date,m.bounds)).sort((a,b)=>a.date.localeCompare(b.date));
    // The upstream contract adjudicates ambiguous loads and occurrences. This
    // module does not add maxima, merge repetition cohorts or select a best set.
    return {...cohort,points,records:(cohort.records||[]).filter(row=>inside(day(row.date),m.bounds))};
  }).filter(cohort=>unique(cohort.points.map(point=>point.date)).length>=2):[];
  const contexts=[...groups(examples,contextOf)].map(([key,cohorts])=>{
    const first=cohorts[0],dates=unique(cohorts.flatMap(cohort=>cohort.points.map(point=>point.date))).sort();
    cohorts.sort((a,b)=>Number(a.reps)-Number(b.reps)||String(a.unit).localeCompare(String(b.unit))||a.key.localeCompare(b.key));
    const contextHistory=history.filter(row=>historyContextOf(row)===key);
    const summaries=cohorts.map(cohort=>{
      const a=cohort.points[0],z=cohort.points.at(-1),records=cohort.records||[],sample=records[0]?.set||{};
      return {key:cohort.key,reps:cohort.reps,unit:cohort.unit,phase:cohort.phase,technique:cohort.technique??null,
        first:a,latest:z,delta:difference(numeric(a.value),numeric(z.value)),dates:cohort.points.map(point=>point.date),points:cohort.points,
        text:`${format(a.value)} → ${format(z.value)} ${cohort.unit} × ${format(cohort.reps,2)} (${dateLabel(a.date)} → ${dateLabel(z.date)})`,
        phaseLabel:cohort.phase==='working'?'Fase de trabalho conforme registro':'Fase não informada',
        effortLabel:`Falha: ${truth(sample.failure)}; proximidade da falha: ${truth(sample.near_failure)}`,
        phaseConfirmedFromOriginal:false,effortConfirmedFromOriginal:false};
    });
    return {key,exerciseKey:normalize(first.exercise),exercise:first.exercise,machine:first.machine,location:first.location,
      label:`${first.exercise} · ${first.machine} · ${first.location}`,cohorts,summaries,dates,dateCount:dates.length,firstDate:dates[0],lastDate:dates.at(-1),history:contextHistory,
      sourceSetIds:unique(cohorts.flatMap(cohort=>cohort.points.flatMap(point=>point.setIds||[point.setId])).filter(Boolean)),
      sources:unique(contextHistory.flatMap(row=>[row.workout?.source_recorded||row.workout?.source,row.exercise?.source,row.set?.source]).filter(Boolean)),
      text:summaries.map(summary=>summary.text).join('; '),
      shortText:summaries.map(summary=>`${format(summary.first.value)} → ${format(summary.latest.value)} ${summary.unit} × ${format(summary.reps,2)}`).join('; '),
      dateText:dateRange(dates),conditionsConfirmed:false,physicalStationConfirmed:false};
  }).sort(byRecurrence);
  // Every source row for each recurring exercise stays in detail, including
  // other machines/places, repetitions, extensions and indeterminate contexts.
  const exercises=[...groups(contexts,row=>row.exerciseKey)].map(([key,items])=>{
    const exerciseHistory=history.filter(row=>normalize(row.exercise?.exercise)===key);
    const allContextKeys=unique([...items.map(item=>item.key),...exerciseHistory.map(historyContextOf)]);
    return {key,exercise:items[0].exercise,contexts:allContextKeys.map(contextKey=>({key:contextKey,
      observed:items.find(item=>item.key===contextKey)||null,history:exerciseHistory.filter(row=>historyContextOf(row)===contextKey)})),history:exerciseHistory};
  });
  for(const context of contexts){
    const exercise=exercises.find(item=>item.key===context.exerciseKey);
    context.details={exercise:context.exercise,contexts:(exercise?.contexts||[]).map(item=>({key:item.key,
      exercise:item.observed?.exercise||item.history[0]?.exercise?.exercise||context.exercise,
      machine:item.observed?.machine||item.history[0]?.exercise?.machine||null,
      location:item.observed?.location||item.history[0]?.workout?.location||null,
      cohorts:item.observed?.cohorts||[],history:item.history})),history:exercise?.history||[]};
  }
  const requestedContext=ui.homeTrainingContext||null,selected=requestedContext?contexts.find(context=>context.key===requestedContext)||null:contexts[0]||null;
  const requestedContextMissing=Boolean(requestedContext&&!selected),summary=[];
  if(selected){summary.push(selected);const second=contexts.find(context=>context.exerciseKey!==selected.exerciseKey);if(second)summary.push(second);}
  const selectionMessage=requestedContextMissing?'O contexto de exercício escolhido não tem duas datas inequívocas nesta janela. Amplie o período ou escolha outro contexto; nenhuma substituição foi feita.':null;
  const note='Aparelho e local informados não confirmam a estação física. Fase e esforço conforme o registro; confirmação documental e condições equivalentes não estabelecidas. Diferenças de carga não estimam força.';
  return {available,contexts,exercises,history,selected,summary,requestedContext,requestedContextMissing,selectedByUser:Boolean(requestedContext&&selected),selectionMessage,
    text:selectionMessage||summary.map(context=>`${context.exercise}: ${context.text}`).join(' / ')||(!available?'Detalhes dos treinos não carregaram.':'Sem exercício com duas datas inequívocas sob o mesmo contexto registrado nesta janela.'),
    shortText:selectionMessage||summary.map(context=>`${context.exercise}: ${context.shortText}`).join(' / ')||null,
    context:note,notes:note,selectionRule:'Número de datas registradas, depois data mais recente e chave estável; no máximo dois exercícios distintos. A escolha não usa variação de carga.',
    detail:selected?exercises.find(exercise=>exercise.key===selected.exerciseKey)||null:null};
}

function sampleStats(rows,field){
  const samples=[],ambiguousDates=[];
  for(const[date,items]of groups(rows,row=>row.date)){
    const valid=items.filter(row=>nonnegative(row[field])!=null);
    if(valid.length>1){ambiguousDates.push(date);continue;}
    if(valid.length===1)samples.push({date,value:nonnegative(valid[0][field]),sourceRecordId:sourceId(valid[0])});
  }
  samples.sort((a,b)=>a.date.localeCompare(b.date));
  const dates=samples.map(sample=>sample.date),count=samples.length,total=count?samples.reduce((sum,sample)=>sum+sample.value,0):null;
  return {mean:count?total/count:null,count,dates,firstDate:dates[0]||null,lastDate:dates.at(-1)||null,samples,ambiguousDates:ambiguousDates.sort(),formula:count?{sum:total,denominator:count}:null};
}
function nutritionContent(data,m){
  const n=m.nutrition||{},source=n.source||null,available=n.available!==false,trainingAvailable=m.training?.available===true;
  const selectedRows=available&&source&&!n.requestedSourceMissing?(n.closedRows||source.closedRows||[]):[];
  const excludedRows=[],rows=[];
  for(const row of selectedRows){
    const date=day(row.date),differentSource=row.source!=null&&row.source!==source.key;
    if(!inside(date,m.bounds)||(m.today&&date>=m.today)||row.open||row.knownPartial||row.excludeFromClosedMeans||differentSource){excludedRows.push({...row,date});continue;}
    rows.push({...row,date});
  }
  // Presence of a dated canonical workout is sufficient for this partition.
  // Duplicate session IDs cannot inflate days or turn a recorded date into an
  // alleged day without training merely because session counting was ambiguous.
  const workoutDates=trainingAvailable?unique([...(m.training.rows||[]).map(row=>day(row.date||row.workout_date)),
    ...(data.workouts||[]).filter(row=>row.is_canonical===true&&row.record_status!=='quarantined').map(row=>day(row.workout_date))].filter(date=>inside(date,m.bounds))):[];
  const trainingDates=new Set(workoutDates),withTraining=trainingAvailable?rows.filter(row=>trainingDates.has(row.date)):[],other=trainingAvailable?rows.filter(row=>!trainingDates.has(row.date)):[];
  const metrics=Object.fromEntries(foodDefinitions.map(([key,label,unit,digits])=>{
    const overall=sampleStats(rows,key),training=sampleStats(withTraining,key),withoutTraining=sampleStats(other,key);
    const comparisonEligible=trainingAvailable&&training.count>=5&&withoutTraining.count>=5;
    return [key,{key,label,unit,digits,overall,training,other:withoutTraining,comparisonEligible,
      difference:comparisonEligible?difference(withoutTraining.mean,training.mean):null,
      reason:!available?'nutrition_unavailable':n.requestedSourceMissing?'requested_source_missing':!source?'source_unavailable':!trainingAvailable?'training_unavailable':comparisonEligible?'descriptive_groups':'insufficient_group_values'}];
  }));
  const primary=[metrics.calories_kcal,metrics.protein_g].filter(metric=>metric.overall.count),sentences=primary.map(metric=>metric.comparisonEligible?
    `${metric.label}: ${format(metric.training.mean,metric.digits)} ${metric.unit}/dia nos dias com treino registrado (n=${metric.training.count}) e ${format(metric.other.mean,metric.digits)} nos demais dias com diário (n=${metric.other.count}).`:
    `${metric.label} média observada: ${format(metric.overall.mean,metric.digits)} ${metric.unit}/dia em ${metric.overall.count} dia(s) com valor (${dateRange(metric.overall.dates)}).`);
  const text=!available?'Registros alimentares não carregaram.':n.requestedSourceMissing?'A origem alimentar escolhida não tem dados nesta janela.':sentences.join(' ')||'Sem valores alimentares elegíveis na origem e no período escolhidos.';
  const dates=unique(rows.filter(row=>foodDefinitions.some(([field])=>nonnegative(row[field])!=null)).map(row=>row.date)).sort();
  const groupLabels={training:'Dias com treino registrado',other:'Demais dias com diário, sem treino registrado'};
  const context=[source?`${source.label||'Origem selecionada'} · ${dateRange(dates)}.`:'',
    trainingAvailable?'Os demais dias com diário não confirmam descanso.':'Treinos não carregaram; a separação dos dias não foi realizada.',
    'Médias descritivas da mesma origem, por variável; comparação exige ao menos cinco valores em cada grupo. Hoje e parciais conhecidos ficam fora. Não estabelece causa. Falta de integração não indica ausência de consumo.'].filter(Boolean).join(' ');
  return {available,source,sourceKey:source?.key||null,sourceLabel:source?.label||null,sourceStatus:source?.status||null,reviewVerified:source?.reviewVerified||false,
    requestedSourceMissing:Boolean(n.requestedSourceMissing),trainingAvailable,metrics,dates,workoutDates:workoutDates.sort(),groupLabels,
    comparisonEligible:primary.some(metric=>metric.comparisonEligible),minimumValuesPerGroup:5,text,
    shortText:primary.map(metric=>metric.comparisonEligible?`${metric.label}: ${format(metric.training.mean,metric.digits)} / ${format(metric.other.mean,metric.digits)} ${metric.unit}/dia`:`${metric.label} média: ${format(metric.overall.mean,metric.digits)} ${metric.unit}/dia (n=${metric.overall.count})`).join('; ')||text,
    comparisonLabel:'Com treino registrado / demais dias com diário',context,evidence:context,excludedRows,
    knownPartialDates:unique((source?.knownPartialRows||[]).map(row=>day(row.date)).filter(date=>inside(date,m.bounds))).sort(),pooledMean:null};
}

/**
 * Input m is the selected homePeriodModel snapshot with m.evidence=homeEvidence.
 * Results are plain data/text; renderers must escape text and persist context
 * choices themselves. No input is mutated. Labs intentionally remain separate.
 */
export function homeUsefulContent(data={},status={},m={},ui={}){
  return {body:bodyContent(m,ui),training:trainingContent(m,ui),nutrition:nutritionContent(data,m)};
}
