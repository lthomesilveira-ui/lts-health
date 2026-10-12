import {day,num,norm,fmtDate,fmtNum} from './core.js';
import {validDay} from './history-tools.js';
import {hydrationModel} from './hydration.js';
import {localHealthDay,bodySourceLabel,medicationContext} from './health-context.js';
import {recoveryReport} from './reports-model.js';
import {labResultText} from './labs-layout-v2.js';

const ready=(status,key)=>status?.[key]==='ready';
const inside=(date,bounds)=>Boolean(date&&(!bounds.start||date>=bounds.start)&&(!bounds.end||date<=bounds.end));
const average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const numeric=value=>num(value)!=null&&num(value)>=0?num(value):null;
const order=rows=>rows.sort((a,b)=>a.date.localeCompare(b.date));
const nutritionMetrics=['calories_kcal','protein_g','carbs_g','fat_g','fiber_g'];

function sourcesOf(rows,today){
  const groups=new Map();
  for(const row of rows){
    const key=norm(row.source);if(!key)continue;
    if(!groups.has(key))groups.set(key,{key,label:row.source,rows:[]});
    groups.get(key).rows.push(row);
  }
  return [...groups.values()].map(s=>({...s,rows:order(s.rows),closedDays:s.rows.filter(r=>r.date<today).length}))
    .sort((a,b)=>b.closedDays-a.closedDays||b.rows.length-a.rows.length||a.key.localeCompare(b.key));
}
function selectSource(sources,requested){
  // A large legacy import must not hide a newer connected source. Preserve an
  // explicit selection; otherwise start with the most recently observed source.
  return sources.find(s=>s.key===requested)||[...sources].sort((a,b)=>(b.rows.at(-1)?.date||'').localeCompare(a.rows.at(-1)?.date||'')||b.closedDays-a.closedDays)[0]||null;
}

// Date joins are exact. Missing days are not zeroes; neither source interpolation
// nor device pooling is allowed. The current calendar day is context, not a cohort.
export function integratedReview(data={},status={},bounds={},ui={},today=localHealthDay()){
  const nutritionDays=new Map();let ambiguousNutrition=0,unknownNutrition=0;
  if(ready(status,'nutrition'))for(const row of data.nutrition||[]){
    const date=validDay(row.nutrition_date);if(!inside(date,bounds))continue;
    if(!nutritionDays.has(date))nutritionDays.set(date,[]);nutritionDays.get(date).push(row);
  }
  const food=[];
  for(const[date,rows]of nutritionDays){
    if(rows.length!==1){ambiguousNutrition++;continue;}
    const row=rows[0];if(!norm(row.source)){unknownNutrition++;continue;}
    const values=Object.fromEntries(nutritionMetrics.map(key=>[key,numeric(row[key])]));
    if(Object.values(values).some(v=>v!=null))food.push({date,source:String(row.source).trim(),...values});
  }
  const nutritionSources=sourcesOf(food,today);
  const nutritionSource=selectSource(nutritionSources,ui.reportNutritionSource);
  const nutritionRows=nutritionSource?.rows||[];
  const waterAvailable=ready(status,'nutrition')&&ready(status,'sourceMetrics');
  const hydration=waterAvailable?hydrationModel(data):{rows:[],conflicts:[]};
  const waterSources=sourcesOf(hydration.rows.filter(row=>inside(validDay(row.date),bounds)),today);
  const waterSource=selectSource(waterSources,ui.reviewWaterSource),waterRows=waterSource?.rows||[];
  const recovery=recoveryReport(data,status,bounds);
  const sleepSources=recovery.series.filter(s=>s.metric==='sleep_duration_h'&&norm(s.unit)==='h')
    .map(s=>({key:s.key,label:s.label,rows:s.points.filter(p=>p.value>=0&&p.value<=24).map(p=>({...p,source:s.label}))}))
    .map(s=>({...s,closedDays:s.rows.filter(r=>r.date<today).length}))
    .sort((a,b)=>b.closedDays-a.closedDays||b.rows.length-a.rows.length||a.key.localeCompare(b.key));
  const sleepSource=selectSource(sleepSources,ui.reviewSleepSource),sleepRows=sleepSource?.rows||[];
  const trainingRows=ready(status,'workouts')?(data.workouts||[]).filter(r=>r.is_canonical===true&&r.record_status!=='quarantined'&&inside(validDay(r.workout_date),bounds)):[];
  const trainingDays=new Map();
  for(const row of trainingRows){const date=day(row.workout_date);if(!trainingDays.has(date))trainingDays.set(date,[]);trainingDays.get(date).push(row);}
  const contextRows=(key,dateKey)=>ready(status,key)?(data[key]||[]).filter(r=>inside(validDay(r[dateKey]),bounds)):[];
  const body=contextRows('body','measured_at'),labs=contextRows('labs','collection_date'),treatments=contextRows('treatments','event_date');
  const dates=[...new Set([...nutritionRows.map(r=>r.date),...waterRows.map(r=>r.date),...sleepRows.map(r=>r.date),...trainingDays.keys(),...body.map(r=>day(r.measured_at)),...labs.map(r=>day(r.collection_date)),...treatments.map(r=>day(r.event_date))])].sort();
  const selectedDate=dates.includes(ui.reviewDate)?ui.reviewDate:dates.at(-1)||null;
  const byDate=rows=>new Map(rows.map(r=>[r.date,r]));
  const nutritionByDate=byDate(nutritionRows),waterByDate=byDate(waterRows),sleepByDate=byDate(sleepRows);
  const days=dates.map(date=>({date,open:date>=today,nutrition:nutritionByDate.get(date)||null,water:waterByDate.get(date)||null,sleep:sleepByDate.get(date)||null,workouts:trainingDays.get(date)||[],body:body.filter(r=>day(r.measured_at)===date),labs:labs.filter(r=>day(r.collection_date)===date),treatments:treatments.filter(r=>day(r.event_date)===date)}));
  const closed=days.filter(d=>!d.open),closedNutrition=nutritionRows.filter(r=>r.date<today),closedWater=waterRows.filter(r=>r.date<today),closedSleep=sleepRows.filter(r=>r.date<today);
  const contrast=(rows,available)=>{
    const withTraining=rows.filter(r=>r.date<today&&trainingDays.has(r.date)),withoutTraining=rows.filter(r=>r.date<today&&!trainingDays.has(r.date));
    const comparable=available&&withTraining.length>=5&&withoutTraining.length>=5;
    const a=average(withTraining.map(r=>r.value)),b=average(withoutTraining.map(r=>r.value));
    return{available,withTraining,withoutTraining,withMean:a,withoutMean:b,comparable,delta:comparable?a-b:null};
  };
  const intervalDays=bounds.start&&bounds.end?Math.max(1,Math.round((Date.parse(bounds.end)-Date.parse(bounds.start))/86400000)+1):null;
  return{bounds,today,intervalDays,dates,days,closed,selectedDate,selected:days.find(d=>d.date===selectedDate)||null,
    nutrition:{available:ready(status,'nutrition'),sources:nutritionSources,source:nutritionSource,rows:nutritionRows,closedRows:closedNutrition,ambiguousDays:ambiguousNutrition,unknownDays:unknownNutrition,means:Object.fromEntries(nutritionMetrics.map(key=>[key,average(closedNutrition.map(r=>r[key]).filter(v=>v!=null))])),counts:Object.fromEntries(nutritionMetrics.map(key=>[key,closedNutrition.filter(r=>r[key]!=null).length]))},
    water:{available:waterAvailable,sources:waterSources,source:waterSource,rows:waterRows,closedRows:closedWater,mean:average(closedWater.map(r=>r.value)),conflicts:hydration.conflicts.filter(r=>inside(validDay(r.date),bounds))},
    sleep:{available:ready(status,'sourceMetrics'),sources:sleepSources,source:sleepSource,rows:sleepRows,closedRows:closedSleep,mean:average(closedSleep.map(r=>r.value))},
    training:{available:ready(status,'workouts'),rows:trainingRows,days:trainingDays.size,closedDays:closed.filter(d=>d.workouts.length).length},
    overlaps:{foodWater:waterAvailable?closed.filter(d=>d.nutrition&&d.water).length:null,foodWaterTraining:waterAvailable&&ready(status,'workouts')?closed.filter(d=>d.nutrition&&d.water&&d.workouts.length).length:null,foodWaterSleep:waterAvailable?closed.filter(d=>d.nutrition&&d.water&&d.sleep).length:null},
    contrasts:{water:contrast(waterRows,waterAvailable&&ready(status,'workouts')),sleep:contrast(sleepRows,ready(status,'sourceMetrics')&&ready(status,'workouts'))}};
}

export function consultationLines(review,reports,evolution=null){
  const v=(value,unit='',digits=1)=>num(value)==null?'Sem dado':`${fmtNum(value,digits)}${unit?` ${unit}`:''}`;
  const coverage=(label,domain)=>`${label}: ${domain.closedRows.length} dias encerrados com registro · ${domain.source?.label||'sem origem disponível'}`;
  const lines=['LTS Health · resumo para consulta',`Gerado em ${fmtDate(review.today)} · janela ${fmtDate(review.bounds.start)} a ${fmtDate(review.bounds.end)}`,
    'Resumo pessoal descritivo. Não é laudo, diagnóstico ou recomendação de tratamento. Nenhum envio a terceiros é feito pelo aplicativo.',
    '', 'EVOLUÇÃO OBSERVADA',...(evolution?.findings.length?evolution.findings.map(f=>`${f.title}. ${f.text} ${f.detail}`):['Sem mudança comparável confirmada na janela escolhida. Valores e datas seguem abaixo.']),
    '', 'ALIMENTAÇÃO, ÁGUA E SONO',
    review.nutrition.available?coverage('Alimentação',review.nutrition):'Alimentação: leitura indisponível.',
    `Energia média: ${v(review.nutrition.means.calories_kcal,'kcal',0)} · ${review.nutrition.counts.calories_kcal} dias com valor.`,
    `Proteína média: ${v(review.nutrition.means.protein_g,'g',0)} · ${review.nutrition.counts.protein_g} dias com valor.`,
    review.water.available?`Água: último total ${v(review.water.rows.at(-1)?.value,'mL',0)} em ${fmtDate(review.water.rows.at(-1)?.date)} · ${review.water.source?.label||'sem origem'}.${review.water.closedRows.length>=5?` Média dos dias encerrados com valor: ${v(review.water.mean,'mL',0)}.`:' Histórico curto; sem média de período.'}`:'Água: fontes não verificadas; valores ocultos.',
    review.sleep.available?`${coverage('Sono',review.sleep)} · ${review.sleep.closedRows.length>=5?`média ${v(review.sleep.mean,'h',1)}`:`último sono ${v(review.sleep.rows.at(-1)?.value,'h')} em ${fmtDate(review.sleep.rows.at(-1)?.date)}`}.`:'Sono: leitura indisponível.',
    '', 'CRUZAMENTOS DESCRITIVOS'];
  for(const[key,label,unit]of [['water','Água','mL'],['sleep','Sono','h']]){
    const c=review.contrasts[key];
    lines.push(!c.available?`${label}: comparação bloqueada por leitura indisponível.`:c.comparable?`${label}: ${v(c.withMean,unit)} em ${c.withTraining.length} dias com treino registrado versus ${v(c.withoutMean,unit)} em ${c.withoutTraining.length} dias sem treino registrado.`:`${label}: base insuficiente (${c.withTraining.length} dias com treino e ${c.withoutTraining.length} sem treino registrado; mínimo descritivo de 5 por grupo).`);
  }
  const body=reports.body.latest;
  lines.push('', 'COMPOSIÇÃO E EXAMES',body?`Última medição na janela: ${fmtDate(body.measured_at)} · ${bodySourceLabel(body)} · peso ${v(body.weight_kg,'kg')} · gordura ${v(body.body_fat_pct,'%')}.`:reports.body.reason==='unavailable'?'Composição: leitura indisponível.':'Composição: sem medição inequívoca disponível nesta janela.');
  if(body)lines.push(`Músculo esquelético: ${v(body.skeletal_muscle_mass_kg,'kg')} · massa de gordura ${v(body.fat_mass_kg,'kg')}.`,reports.body.available?`Mudanças entre medições compatíveis: peso ${v(reports.body.changes.weight_kg,'kg')}; gordura ${v(reports.body.changes.fat_mass_kg,'kg')}; músculo ${v(reports.body.changes.skeletal_muscle_mass_kg,'kg')}; anterior ${fmtDate(reports.body.previous?.measured_at)}.`:'Diferença corporal automática indisponível: confira origem, aparelho e datas nos detalhes.');
  const comparisons=reports.labs.comparisons||[];
  lines.push(reports.labs.available?`${comparisons.length} marcadores presentes na janela; ${comparisons.filter(r=>r.comparable).length} com anterior comparável por origem, método e unidade.`:'Exames: leitura indisponível.');
  for(const row of comparisons.slice(0,4))if(row.current)lines.push(`${row.group.label}: ${labResultText(row.current)} · ${fmtDate(row.current.collection_date)} · ${row.current.laboratory||row.current.source||'origem não informada'} · ${row.current.method||'método não informado'}.`);
  if(evolution){
    lines.push('','METAS INFORMADAS');
    for(const[key,label,unit]of [['calories_kcal','Energia','kcal'],['protein_g','Proteína','g']]){const g=evolution.nutritionTargets[key];lines.push(g.count?`${label}: consumo médio ${v(g.actual,unit,0)} versus meta média vigente ${v(g.target,unit,0)} nos mesmos ${g.count} dias.`:`${label}: sem meta informada para os dias observados.`);}
    const w=evolution.latestSession;if(w)lines.push('','ÚLTIMA SESSÃO',`${fmtDate(w.workout_date)} · ${w.workout_type||'Treino'} · ${w.location||'local não informado'} · ${v(w.duration_minutes,'min')} · ${w.exerciseCount??'—'} exercícios · ${w.setCount??'—'} séries anotadas.`,w.notes||'');
    lines.push('','PROTOCOLOS NO CONTEXTO',...(evolution.recentTreatments.length?evolution.recentTreatments.map(t=>`${fmtDate(t.event_date)} · ${t.medication} · ${medicationContext(t)} · ${t.notes||''}`):['Sem evento de aplicação na janela ou fonte indisponível.']));
  }
  lines.push('', 'LIMITES E PERGUNTAS PARA A CONSULTA','Médias e cruzamentos excluem hoje; registros de hoje podem estar incompletos. Dias sem registro não significam zero, descanso confirmado ou diário completo.',
    'Sono usa a data fornecida pela origem: coincidir com o treino não identifica a noite anterior ou posterior. Polar e musculação não são somados.',
    'Diferenças entre grupos descrevem estes registros, sem provar causa, efeito ou adequação. O mínimo de 5 dias não é um teste de significância.',
    `Totais alimentares ambíguos excluídos: ${review.nutrition.ambiguousDays}; origem alimentar desconhecida: ${review.nutrition.unknownDays}; datas de água em conflito: ${review.water.conflicts.length}.`,
    'As condições das medições corporais são comparáveis? O registro alimentar representa o dia completo? Os exames precisam de contexto clínico ou confirmação?');
  return lines;
}
