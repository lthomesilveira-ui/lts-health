import {healthDashboardCalendar,healthDashboardModel} from './health-dashboard-model.js';
import {nutritionSourceReview} from './nutrition-source-review.js';
import {nutritionPlanFields,selectDocumentedNutritionPlan} from './documented-nutrition-plan.js';

// Pure, read-only descriptive comparison. No personal goals, prescription
// validity, adherence score, expenditure, writes, browser state or pooled origins.
const DAY=86400000;
const norm=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const scalar=value=>value==null||!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0?null:Number(value);
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const day=value=>{
  const text=String(value??'');if(!/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(text))return null;
  const date=text.slice(0,10),parsed=new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:null;
};
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&day(value)&&Number.isFinite(Date.parse(value))?value:null;
const latestTimestamp=values=>values.filter(value=>timestamp(value)).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)||null;
const displayDate=value=>value.split('-').reverse().join('/');
const foodFields=nutritionPlanFields.filter(field=>field.key!=='water_ml');
const metricFields={dietary_energy_kcal:'calories_kcal',dietary_protein_g:'protein_g',dietary_carbs_g:'carbs_g',dietary_carbohydrates_g:'carbs_g',dietary_fat_g:'fat_g',dietary_fiber_g:'fiber_g'};
const sourceView=source=>source?{key:source.key,label:source.label,status:source.status,domain:source.domain,sourceFamily:source.sourceFamily||null}:null;
const group=(values,key)=>{const result=new Map();for(const value of values){const k=key(value);if(!result.has(k))result.set(k,[]);result.get(k).push(value);}return result;};
const partial=row=>row?.partial===true||row?.knownPartial===true||row?.known_partial===true||row?.is_partial===true||row?.excludeFromClosedMeans===true||row?.source_payload?.partial===true||row?.source_payload?.knownPartial===true;
const requestedKey=value=>typeof value==='object'&&value!==null?value.key:value;

function collectFood(data,status,today){
  const observations=[];
  for(const domain of ['nutrition','sourceMetrics']){
    if(status[domain]!=='ready')continue;
    for(const row of data[domain]||[]){
      const date=day(domain==='nutrition'?row.nutrition_date:row.metric_date);
      if(!date||date>today)continue;
      const statusName=domain==='nutrition'?'canonical':norm(row.canonical_status);
      if(!['canonical','candidate','held'].includes(statusName))continue;
      const label=String((domain==='nutrition'?row.source:row.source_name||row.source)||'').trim();if(!label)continue;
      const review=domain==='sourceMetrics'?nutritionSourceReview(row):null;
      const key=domain==='nutrition'?JSON.stringify(['nutrition',norm(label),'canonical']):JSON.stringify(['sourceMetrics',norm(row.source_family),norm(label),statusName,...(review?.verified?[review.sourceHash]:[])]);
      const fields=domain==='nutrition'?foodFields.filter(field=>Object.hasOwn(row,field.key)):foodFields.filter(field=>field.key===metricFields[row.metric_type]&&norm(row.unit)===norm(field.unit));
      for(const field of fields){
        const knownPartial=partial(row)||Boolean(review?.partial),reviewInvalid=review?.state==='review_invalid';
        observations.push({date,key,label,status:statusName,domain,sourceFamily:row.source_family||null,field:field.key,value:scalar(domain==='nutrition'?row[field.key]:row.value),
          partial:knownPartial||date===today,knownPartial,reviewInvalid,excludeFromClosedMeans:knownPartial||Boolean(review?.excludeFromClosedMeans),exportedAt:review?.exportedAt||null,updatedAt:timestamp(row.updated_at)});
      }
    }
  }
  return [...group(observations,row=>row.key)].map(([key,items])=>{
    const rowsByField=new Map(foodFields.map(field=>[field.key,[...group(items.filter(row=>row.field===field.key),row=>row.date)].map(([date,list])=>{
      const ambiguous=list.length>1,knownPartial=list.some(row=>row.knownPartial),reviewInvalid=list.some(row=>row.reviewInvalid);
      const value=ambiguous?null:list[0].value;
      return {date,value,partial:knownPartial||date===today,knownPartial,ambiguous,reviewInvalid,exportedAt:list.find(row=>row.exportedAt)?.exportedAt||null,updatedAt:latestTimestamp(list.map(row=>row.updatedAt)),
        eligible:value!=null&&!ambiguous&&!reviewInvalid&&date<today&&!list.some(row=>row.excludeFromClosedMeans)};
    }).sort((a,b)=>a.date.localeCompare(b.date))]));
    const rows=[...rowsByField.values()].flat(),valid=rows.filter(row=>row.value!=null);
    return {...sourceView(items[0]),key,rowsByField,lastDate:valid.map(row=>row.date).sort().at(-1)||null,eligibleDays:new Set(rows.filter(row=>row.eligible).map(row=>row.date)).size};
  }).sort((a,b)=>a.key.localeCompare(b.key));
}
function selectFood(sources,requested){
  if(requested){
    const exact=sources.find(source=>source.key===requested);if(exact)return exact;
    const matching=sources.filter(source=>norm(source.label)===norm(requested));return matching.length===1?matching[0]:null;
  }
  const rank={canonical:0,candidate:1,held:2};
  return sources.slice().sort((a,b)=>(b.lastDate||'').localeCompare(a.lastDate||'')||rank[a.status]-rank[b.status]||b.eligibleDays-a.eligibleDays||a.key.localeCompare(b.key))[0]||null;
}
function calendarPoints(rows,calendar){
  const byDate=new Map((rows||[]).map(row=>[row.date,row]));
  return Array.from({length:calendar.bounds.days},(_,index)=>{
    const date=new Date(Date.parse(`${calendar.bounds.start}T12:00:00Z`)+index*DAY).toISOString().slice(0,10);
    return byDate.get(date)||{date,value:null,partial:date===calendar.today,knownPartial:false,ambiguous:false,reviewInvalid:false,eligible:false,exportedAt:null,updatedAt:null};
  });
}

function waterUpdates(data,status,source,today){
  const updates=new Map();if(!source)return updates;
  for(const domain of ['nutrition','sourceMetrics']){
    if(status[domain]!=='ready')continue;
    for(const row of data[domain]||[]){
      if(domain==='nutrition'?!Object.hasOwn(row,'water_ml'):row.metric_type!=='dietary_water_ml')continue;
      const date=day(domain==='nutrition'?row.nutrition_date:row.metric_date),label=String((domain==='nutrition'?row.source:row.source_name||row.source)||'').trim();
      if(!date||date>today||!label)continue;
      const key=domain==='nutrition'?JSON.stringify(['nutrition',norm(label),'canonical','ml']):JSON.stringify(['sourceMetrics',norm(row.source_family),norm(label),norm(row.canonical_status),norm(row.unit)]);
      if(key!==source.key)continue;
      updates.set(date,latestTimestamp([updates.get(date),row.updated_at]));
    }
  }
  return updates;
}

function detailAvailability(data,status,source,calendar){
  if(status.meals!=='ready')return {latestMealDate:null,hasRecentMeals:false,note:status.meals==='error'?'O detalhamento de refeições não carregou nesta atualização. A comparação por alimento ou refeição está indisponível.':'O detalhamento de refeições ainda não está disponível; a comparação por alimento ou refeição está indisponível.'};
  const rows=(data.meals||[]).map(row=>({row,date:day(row.meal_date)})).filter(item=>item.date&&item.date<=calendar.today);
  const latestMealDate=rows.map(item=>item.date).sort().at(-1)||null;
  // The meal table supplies direct-food details, not a verified join to a
  // source-metric export. A matching display label alone cannot bridge domains.
  const matched=source?.domain==='nutrition'?rows.filter(item=>norm(item.row.source)===norm(source.label)&&item.date>=calendar.bounds.start&&item.date<=calendar.bounds.end):[];
  const hasRecentMeals=matched.length>0;
  const note=hasRecentMeals?'Há totais por refeição da origem escolhida nesta janela; eles não comprovam alimentos ou quantidades consumidos. Comparação por item prescrito indisponível.':`A origem alimentar escolhida não forneceu refeições detalhadas nesta janela. Comparação por alimento ou refeição indisponível.${latestMealDate?` Último detalhamento recebido: ${displayDate(latestMealDate)}; pode pertencer a outra origem.`:''}`;
  return {latestMealDate,hasRecentMeals,note};
}
function metricModel(definition,target,source,rows,calendar,requestedMissing,blocked){
  const points=calendarPoints(rows,calendar),eligible=points.filter(point=>point.eligible),observed=points.filter(point=>point.value!=null&&!point.reviewInvalid);
  const dayPoint=calendar.mode==='day'?points[0]:null;
  let value=calendar.mode==='day'?(dayPoint?.reviewInvalid?null:dayPoint?.value??null):mean(eligible.map(point=>point.value));
  const days=calendar.mode==='day'?(value!=null?1:0):eligible.length,expectedDays=calendar.mode==='day'?1:calendar.bounds.closedDays;
  const ambiguity=points.filter(point=>point.ambiguous).length,knownPartial=points.some(point=>point.knownPartial),invalidReview=points.some(point=>point.reviewInvalid);
  let reason=requestedMissing?'A origem escolhida está indisponível; nenhuma outra origem foi usada.':!source?'Sem origem com registros para esta variável.':ambiguity?'Dias com registros duplicados ou ambíguos foram excluídos desta variável.':invalidReview?'Registros sem conferência válida foram excluídos desta variável.':calendar.mode==='period'&&knownPartial?'Dias sabidamente parciais foram excluídos da média.':value==null?'Sem valor inequívoco da origem escolhida nesta janela.':null;
  if(blocked){value=null;reason='Ative a comparação retrospectiva para usar este plano como referência nesta janela.';}
  return {...definition,target,value,delta:value==null||target==null?null:value-target,percent:value==null||target==null?null:value/target*100,
    days:blocked?0:days,expectedDays,partial:calendar.mode==='day'?Boolean(dayPoint?.partial):knownPartial,
    latestDate:observed.at(-1)?.date||null,sourceLabel:source?.label||null,sourceKey:source?.key||null,reason,
    points:blocked?[]:points.map(point=>({...point})),aggregation:calendar.mode==='day'?'recorded_day':'observed_mean',
    knownPartial,ambiguousDays:ambiguity,exportedAt:observed.at(-1)?.exportedAt||null,updatedAt:latestTimestamp(points.map(point=>point.updatedAt))};
}

/** One documentary reference, one stable food origin, and independent water.
 * The existing calendar and dashboard source choices remain authoritative.
 * Period values use observed closed days only; missing dates never become zero.
 * Earlier windows require explicit opt-in and are never historical adherence. */
export function nutritionPlanComparison(data={},status={},ui={},today){
  const calendar=healthDashboardCalendar(data,status,ui,today),selection=selectDocumentedNutritionPlan(data.nutritionPlans||[],calendar.today,status.nutritionPlans),plan=selection.plan;
  const base={state:selection.state,plan,calendar,isRetrospective:false,comparisonLabel:plan?`Comparação com o plano recebido ${displayDate(plan.received_on)}`:'Plano alimentar documentado',
    clinicalStartNote:'Início de uso não informado',lastUpdatedAt:null,foodSource:null,waterSource:null,foodSources:[],metrics:[],detailAvailability:{latestMealDate:null,hasRecentMeals:false,note:'Comparação por alimento ou refeição indisponível.'},notes:selection.reason?[selection.reason]:[]};
  if(!plan)return base;
  const isRetrospective=calendar.bounds.start<plan.referenceDate,blocked=isRetrospective&&ui.nutritionPlanRetrospective!==true;
  const dashboard=healthDashboardModel(data,status,ui,calendar.today),energy=dashboard.metricsByKey.energy,water=dashboard.metricsByKey.water;
  const foods=collectFood(data,status,calendar.today);
  // A missing explicit dashboard selection is still a selection; never replace
  // it with another source merely because that source has more nutrients.
  const requested=requestedKey(ui.nutritionPlanFoodSource)||energy.requestedSource||energy.source?.key||null;
  const food=selectFood(foods,requested),foodSource=sourceView(food),waterSource=sourceView(water.source);
  const waterUpdatedAt=waterUpdates(data,status,waterSource,calendar.today);
  const metrics=nutritionPlanFields.map(definition=>{
    const isWater=definition.key==='water_ml',source=isWater?waterSource:foodSource;
    const rows=isWater?water.points.map(point=>({...point,updatedAt:waterUpdatedAt.get(point.date)||null})):food?.rowsByField.get(definition.key)||[];
    return metricModel(definition,plan.daily_targets[definition.key].value,source,rows,calendar,isWater?water.requestedSourceMissing:Boolean(requested&&!food),blocked);
  });
  const notes=[
    'Referência documental, sem confirmação de início de uso ou adesão ao plano.',
    calendar.mode==='day'?'O valor é o registro do dia; hoje é parcial. Registros observados não comprovam diário completo.':'Média por dia encerrado com valor, com cobertura própria por nutriente. Dias ausentes não são zero; dias sabidamente parciais ficam fora da média.',
    'Os cinco nutrientes usam a mesma origem alimentar. Água mantém a origem escolhida no painel; fontes espelhadas não são somadas.'
  ];
  if(isRetrospective)notes.unshift(`Esta janela inclui datas anteriores ao plano recebido ${displayDate(plan.received_on)}. A comparação é retrospectiva com a versão mais recente; não indica adesão passada e não combina metas de versões anteriores.`);
  if(['nutrition','sourceMetrics'].some(domain=>status[domain]!=='ready'))notes.push('Parte das origens de consumo ainda não está disponível nesta atualização. Somente origens carregadas são exibidas.');
  return {...base,state:blocked?'retrospective_required':'ready',isRetrospective,
    comparisonLabel:isRetrospective?`Retrospectiva com o plano recebido ${displayDate(plan.received_on)}; não indica adesão passada`:base.comparisonLabel,
    foodSource,waterSource,foodSources:foods.map(sourceView),metrics,lastUpdatedAt:latestTimestamp(metrics.map(metric=>metric.updatedAt)),detailAvailability:detailAvailability(data,status,foodSource,calendar),notes};
}
