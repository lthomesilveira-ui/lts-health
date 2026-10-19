import {documentedWaterReferenceForDate} from './documented-water-reference.js';
import {selectDocumentedNutritionPlan} from './documented-nutrition-plan.js';

// Read-only guidance: dates and recorded values are evidence, never proof of
// intake completeness, adherence, current medication use or clinical adequacy.
const list=value=>Array.isArray(value)?value:[];
const text=value=>typeof value==='string'?value.trim():'';
const day=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const date=new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:null;
};
const eventDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(value)?day(value.slice(0,10)):null;
const numeric=value=>value==null||typeof value==='boolean'||!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))?null:Number(value);
const fmt=value=>Number(value).toLocaleString('pt-BR',{maximumFractionDigits:1});
const fmtDate=value=>day(value)?value.split('-').reverse().join('/'):'Data não informada';
const source=value=>typeof value==='string'?text(value)||'Origem não informada':text(value?.label)||text(value?.source_name)||text(value?.source)||text(value?.source_file)||'Origem não informada';
const distinct=values=>[...new Set(values)];
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const inside=(date,bounds)=>Boolean(date&&bounds.end&&date<=bounds.end&&(!bounds.start||date>=bounds.start));
const asOf=(date,bounds)=>Boolean(date&&bounds.end&&date<=bounds.end);
const dateRange=bounds=>bounds.start===bounds.end?fmtDate(bounds.end):`${bounds.start?fmtDate(bounds.start):'Histórico'} a ${fmtDate(bounds.end)}`;
const fields={water:{field:'water_ml',label:'Água',unit:'mL',maximum:30000},protein:{field:'protein_g',label:'Proteína',unit:'g',maximum:2000}};
function referenceType(row){
  try{const metadata=JSON.parse(row?.notes||'');return ['historical_protocol','documented_water_base'].includes(metadata?.type)?metadata.type:null;}catch{return null;}
}
function goalSource(row){
  const notes=text(row?.notes);
  if(!notes)return 'Meta pessoal cadastrada';
  try{const metadata=JSON.parse(notes);return text(metadata?.source)||'Meta pessoal cadastrada';}catch{return notes;}
}
function historicalGoalReference(row,definition,date){
  if(referenceType(row)!=='historical_protocol')return null;
  let metadata;try{metadata=JSON.parse(row.notes);}catch{return null;}
  const value=numeric(row[definition.field]),documentedOn=day(metadata.documented_on),source=text(metadata.source);
  if(value==null||value<=0||value>definition.maximum||!documentedOn||documentedOn>date||!source)return null;
  const rule=definition.field==='protein_g'?metadata.protein_rule:null;
  return {value,unit:definition.unit,documentedOn,source,rule:rule==='gt'?'gt':'reference',isDailyTarget:false,currentValidity:'unconfirmed'};
}
function goalAt(rows,status,date,definition){
  if(status!=='ready')return {status:'unavailable',reason:'goals_unavailable',value:null};
  if(!day(date))return {status:'unconfirmed',reason:'invalid_date',value:null};
  const eligible=list(rows).filter(row=>day(row?.effective_from)&&row.effective_from<=date);
  const latestDate=eligible.map(row=>row.effective_from).sort().at(-1);
  if(!latestDate)return {status:'unconfirmed',reason:'no_goal',value:null};
  const latest=eligible.filter(row=>row.effective_from===latestDate);
  // A blank, protected or ambiguous newer version must never resurrect a
  // previous target. Each date is evaluated independently across the period.
  if(latest.length!==1)return {status:'unconfirmed',reason:'ambiguous_goal',value:null,effectiveFrom:latestDate};
  const row=latest[0],protectedType=referenceType(row),value=numeric(row[definition.field]);
  if(protectedType)return {status:'unconfirmed',reason:protectedType,value:null,effectiveFrom:latestDate,reference:historicalGoalReference(row,definition,date)};
  if(value==null||value<=0||value>definition.maximum)return {status:'unconfirmed',reason:'missing_or_invalid_target',value:null,effectiveFrom:latestDate};
  return {status:'confirmed',reason:null,value,effectiveFrom:latestDate,source:goalSource(row),unit:definition.unit};
}
function metricPoints(metric,bounds,today,definition){
  if(!metric||metric.available===false||['error','loading','unavailable'].includes(metric.status||metric.availability))return {points:[],ambiguousDates:[],available:false};
  const grouped=new Map();
  for(const point of list(metric.points)){
    const date=day(point?.date);
    if(!inside(date,bounds)||(today&&date>today))continue;
    if(!grouped.has(date))grouped.set(date,[]);
    grouped.get(date).push(point);
  }
  const ambiguousDates=[],points=[];
  for(const [date,rows]of grouped){
    if(rows.length!==1){ambiguousDates.push(date);continue;}
    const point=rows[0],value=numeric(point.value),unit=text(point.unit||metric.unit).toLowerCase();
    if(value==null||value<0||point.ambiguous===true||(unit&&unit!==definition.unit.toLowerCase()))continue;
    points.push({date,value,source:source(point.sourceLabel||point.context||metric.source||point.source),eligible:point.eligible!==false,partial:date===today||point.partial===true||point.isPartial===true||point.knownPartial===true});
  }
  return {points:points.sort((a,b)=>a.date.localeCompare(b.date)),ambiguousDates:ambiguousDates.sort(),available:true};
}
function expectedDays(dashboard,metric,bounds){
  if(dashboard.mode==='day')return 1;
  const supplied=numeric(metric?.expectedDays??bounds.closedDays??bounds.days);
  if(supplied!=null&&Number.isSafeInteger(supplied)&&supplied>=0)return supplied;
  if(!bounds.start||!bounds.end||bounds.start>bounds.end)return 0;
  return Math.round((Date.parse(`${bounds.end}T12:00:00Z`)-Date.parse(`${bounds.start}T12:00:00Z`))/86400000)+1;
}
function goalComparison(data,status,dashboard,key,bounds,today){
  const definition=fields[key],metric=dashboard.metricsByKey?.[key]||(Array.isArray(dashboard.metrics)?dashboard.metrics.find(item=>item.key===key):dashboard.metrics?.[key]),observed=metricPoints(metric,bounds,today,definition);
  const current=goalAt(data.goals,status.goals,bounds.end,definition),partialDates=observed.points.filter(point=>point.partial).map(point=>point.date);
  const eligible=dashboard.mode==='day'?observed.points:observed.points.filter(point=>!point.partial&&point.eligible);
  const evaluations=eligible.map(point=>({...point,goal:goalAt(data.goals,status.goals,point.date,definition)}));
  const pairs=evaluations.filter(point=>point.goal.status==='confirmed').map(point=>({date:point.date,actual:point.value,target:point.goal.value,unit:definition.unit,source:point.source,goalSource:point.goal.source,effectiveFrom:point.goal.effectiveFrom,partial:point.partial,achieved:point.value>=point.goal.value}));
  const targetDays=expectedDays(dashboard,metric,bounds),actual=mean(pairs.map(pair=>pair.actual)),target=mean(pairs.map(pair=>pair.target));
  const unconfirmedDates=evaluations.filter(point=>point.goal.status!=='confirmed').map(point=>({date:point.date,reason:point.goal.reason}));
  const comparisonStatus=status.goals!=='ready'?'unavailable':pairs.length?(pairs.length<eligible.length?'partial':'confirmed'):current.status;
  return {key,...definition,available:observed.available,status:comparisonStatus,current,reason:current.reason,
    target:dashboard.mode==='day'?current.value:target,actual,meanActual:actual,meanTarget:target,delta:pairs.length?actual-target:null,
    count:pairs.length,expectedDays:targetDays,observedCount:eligible.length,coverageLabel:`${pairs.length}/${targetDays} dias pareados`,
    points:observed.points,pairs,paired:pairs,partialDates,ambiguousDates:observed.ambiguousDates,unconfirmedDates,
    achievedCount:pairs.filter(pair=>pair.achieved).length,sources:distinct(eligible.map(point=>point.source)),
    versions:distinct(pairs.map(pair=>JSON.stringify([pair.effectiveFrom,pair.target,pair.goalSource]))).map(version=>{const[effectiveFrom,value,source]=JSON.parse(version);return {effectiveFrom,value,source,unit:definition.unit};}),
    missingRecordDays:observed.available?Math.max(0,targetDays-observed.points.length):null,excludedRecordedDays:observed.points.length-eligible.length};
}
function nutritionInsight(goal,dashboard,bounds,context={}){
  const {key,label,unit,current,pairs}=goal,period=dashboard.mode==='period';
  const windowLabel=dateRange(bounds),point=goal.points[0],paired=pairs[0];
  const evidenceItems=pairs.length?pairs.map(pair=>({date:pair.date,value:pair.actual,unit,source:pair.source,target:pair.target,effectiveFrom:pair.effectiveFrom,goalSource:pair.goalSource,partial:pair.partial})):goal.points.map(point=>({date:point.date,value:point.value,unit,source:point.source,target:null,partial:point.partial}));
  const versions=goal.versions.map(version=>`${fmt(version.value)} ${unit}/dia desde ${fmtDate(version.effectiveFrom)} (${version.source})`).join('; ');
  const periodEvidence=`${windowLabel} · ${goal.coverageLabel} · Valores em ${unit} · ${goal.sources.join(' / ')||'Sem origem com valor para comparação'}${versions?` · Metas: ${versions}`:''}${goal.partialDates.length?` · ${goal.partialDates.length} dia(s) parcial(is) fora da comparação`:''}`;
  const dayEvidence=`${windowLabel} · ${point?`${fmt(point.value)} ${unit} · ${point.source}`:'Sem valor registrado'}${current.status==='confirmed'?` · Meta: ${fmt(current.value)} ${unit}/dia desde ${fmtDate(current.effectiveFrom)} · ${current.source}`:''}`;
  const base={id:`${key}-goal`,tone:'neutral',title:`${label}: meta não confirmada`,text:'',evidence:period?periodEvidence:dayEvidence,evidenceItems,action:{route:'nutricao',label:'Revisar plano e registros'},metric:key};
  if(!goal.available)return {...base,title:`${label}: registro indisponível`,text:'O registro não carregou nesta atualização. Atualize os dados antes de comparar com o plano.',action:{route:'dados',label:'Conferir dados'}};
  if(goal.status==='unavailable')return {...base,text:'Meta não confirmada nesta atualização: as metas não carregaram. Revise o plano após atualizar os dados.'};
  if(!pairs.length){
    if(!period&&current.status==='confirmed')return {...base,title:`${label}: confira o registro`,text:`Nenhum valor numérico único foi registrado para este dia. A meta cadastrada é ${fmt(current.value)} ${unit}/dia; ausência de registro não significa zero.`};
    if(period&&goal.observedCount===0&&current.status==='confirmed')return {...base,title:`${label}: confira os registros`,text:'Sem dias completos com valor único para comparar nesta janela. Ausência de registro não significa zero; confira o diário.'};
    const historical=current.reference,water=key==='water'?context.documentedWater:null,care=context.care;
    const historicalLabel=historical?`${historical.rule==='gt'?'mais de ':''}${fmt(historical.value)} ${unit}/dia`:null;
    const historyText=historical?`Referência histórica: ${historicalLabel}, documentada em ${fmtDate(historical.documentedOn)}. `:'';
    const historyEvidence=historical?` · Referência histórica: ${historicalLabel} · ${fmtDate(historical.documentedOn)} · ${historical.source}; vigência atual não confirmada`:'';
    const pendingNutrition=key==='protein'&&care?.available&&care.nutritionPlanPending;
    const receivedNutrition=pendingNutrition&&context.receivedNutritionPlan?.referenceDate>care.date?context.receivedNutritionPlan:null;
    if(water)return {...base,title:'Água: referência no plano',text:`O documento de ${fmtDate(water.documentedOn)} registra ${fmt(water.value)} mL/dia como base, com ajuste por exercício. A data de início não está explícita. Meta não confirmada para calcular cumprimento nos dias selecionados.${!point&&!period?' Ausência de registro não significa zero.':''}`,evidence:`${base.evidence} · Referência documental: ${fmt(water.value)} mL/dia · ${fmtDate(water.documentedOn)} · ${water.sourceFile}, página ${water.sourcePage}.${historyEvidence}`,action:{route:'nutricao',label:'Ver referência e registros'}};
    if(receivedNutrition)return {...base,title:'Proteína: plano alimentar recebido',text:`Plano recebido em ${fmtDate(receivedNutrition.received_on)}; início de uso não informado. O acompanhamento anterior de ${fmtDate(care.date)} registrava o plano como aguardado. ${historyText}A comparação documental aparece separadamente; o recebimento não confirma uma meta clínica para os dias selecionados.`,evidence:`${base.evidence}${historyEvidence} · Plano aguardado conforme documento de ${fmtDate(care.date)} · ${care.source} · Plano recebido em ${fmtDate(receivedNutrition.received_on)} · ${receivedNutrition.source_file}`,action:{route:'nutricao',label:'Ver plano recebido e registros'}};
    if(historical||pendingNutrition)return {...base,title:pendingNutrition?'Proteína: plano alimentar aguardado':`${label}: referência histórica`,text:`${historyText}${pendingNutrition?`O acompanhamento de ${fmtDate(care.date)} registra o plano alimentar como aguardado. `:''}Meta não confirmada para os dias selecionados; ${historical?'a referência histórica não foi marcada como vigente':'não há valor diário vigente cadastrado'}.${!point&&!period?' Ausência de registro não significa zero.':''}`,evidence:`${base.evidence}${historyEvidence}${pendingNutrition?` · Plano alimentar aguardado conforme ${fmtDate(care.date)} · ${care.source}`:''}`,action:{route:pendingNutrition?'tratamentos':'nutricao',label:pendingNutrition?'Ver acompanhamento do plano':'Ver referência e registros'}};
    return {...base,text:`Meta não confirmada ${period?'para os dias com registros usados na comparação nesta janela':'para este dia'}: não há um único valor vigente cadastrado.${!point&&!period?' Ausência de registro não significa zero.':''}`,action:{route:'nutricao',label:'Conferir meta e registros'}};
  }
  if(!period){
    if(paired.achieved)return {...base,tone:'positive',title:`${label}: registro alcança a meta`,text:`O registro de ${fmt(paired.actual)} ${unit}${dashboard.date===dashboard.today?' até agora':''} alcança a meta cadastrada de ${fmt(paired.target)} ${unit}. Isso descreve o diário, sem avaliar adequação clínica.`};
    if(paired.partial)return {...base,tone:'attention',title:`${label}: registro parcial`,text:dashboard.date===dashboard.today?`${fmt(paired.actual)} ${unit} registrados até agora, abaixo da referência cadastrada de ${fmt(paired.target)} ${unit}. Confira o registro e distribua ao longo do dia conforme seu plano.`:`O registro parcial de ${fmt(paired.actual)} ${unit} está abaixo da meta cadastrada de ${fmt(paired.target)} ${unit}. Confira o diário antes de avaliar o total desse dia.`};
    return {...base,tone:'attention',title:`${label}: confira o diário`,text:`O registro de ${fmt(paired.actual)} ${unit} está abaixo da meta cadastrada de ${fmt(paired.target)} ${unit}. Confira se o diário está completo e revise o plano se a diferença se repetir.`};
  }
  const all=goal.achievedCount===pairs.length;
  return {...base,tone:all?'positive':'attention',title:all?`${label}: registros alcançam as metas`:`${label}: compare com o plano`,text:`${goal.achievedCount}/${pairs.length} dias pareados alcançam a meta vigente naquele dia. Média registrada: ${fmt(goal.meanActual)} ${unit}/dia; média das metas dos mesmos dias: ${fmt(goal.meanTarget)} ${unit}/dia.${goal.unconfirmedDates.length?` ${goal.unconfirmedDates.length} dia(s) com valor e sem meta confirmada ficaram fora.`:''} ${all?'Isso descreve os registros, sem avaliar adequação clínica.':'Confira os registros e revise o plano se a diferença se repetir.'}`};
}
const eventLabels={taken:'Uso registrado',application:'Aplicação registrada',administered:'Aplicação registrada',applied:'Aplicação registrada',injection:'Aplicação registrada',started:'Início relatado',stopped:'Interrupção registrada',prescribed:'Prescrição registrada',planned:'Planejamento registrado',skipped:'Omissão registrada',missed:'Omissão registrada',reported:'Relato registrado'};
const documentLabels={medical_plan:'Plano documentado',care_followup:'Acompanhamento documentado',prescription:'Prescrição documentada',treatment_plan:'Plano de tratamento documentado',medication_protocol:'Protocolo documentado'};
function documentItem(row,bounds){
  const date=day(row?.document_date),type=text(row?.document_type);
  if(!asOf(date,bounds)||!documentLabels[type])return null;
  return {id:text(row.source_record_id)||`document:${date}:${type}`,kind:'document',name:text(row.title)||documentLabels[type],title:text(row.title)||documentLabels[type],date,type,eventType:type,eventLabel:documentLabels[type],source:source(row),sourceFile:text(row.source_file)||null,inPeriod:inside(date,bounds),temporalContext:inside(date,bounds)?'Documento no período':'Último contexto documentado antes do período'};
}
function careContext(documents,bounds){
  const eligible=documents.filter(row=>row.document_type==='care_followup'&&row.care_context?.schema_version===1&&asOf(day(row.document_date),bounds));
  const latest=eligible.map(row=>row.document_date).sort().at(-1),candidates=eligible.filter(row=>row.document_date===latest);
  if(candidates.length!==1)return {available:false,status:candidates.length>1?'ambiguous':'empty',date:null,followups:[],pending:[],products:[],baseline:[]};
  const document=candidates[0],care=document.care_context,date=document.document_date;
  // Preserve the dated documentary status; do not promote it to current use.
  const followups=list(care.followups).map((item,index)=>({id:text(item.key)||`care:${index}`,label:text(item.label)||'Pendência documentada',status:text(item.status)||'Registro pendente',resolved:item.resolved===true,dueDate:day(item.due_date),window:text(item.window)||null,documentDate:date}));
  const products=list(care.products).map(item=>({name:text(item.name)||'Item documentado',status:text(item.status)||'Situação não informada',purchaseStatus:text(item.purchase_status)||null,receivedDate:asOf(day(item.received_date),bounds)?item.received_date:null,startDate:asOf(day(item.start_date),bounds)?item.start_date:null,documentDate:date}));
  const baseline=list(care.baseline).filter(item=>!day(item.source_date)||asOf(day(item.source_date),bounds)).map(item=>({name:text(item.name)||'Protocolo relatado',date:day(item.source_date),type:'reported_history'}));
  const nutritionPlanPending=followups.some(item=>item.id==='nutrition_plan'&&!item.resolved);
  return {available:true,status:'documented',date,consultationDate:asOf(day(care.consultation_date),bounds)?care.consultation_date:null,title:text(care.title)||'Acompanhamento da consulta',source:source(document),inPeriod:inside(date,bounds),followups,pending:followups.filter(item=>!item.resolved),pendingCount:followups.filter(item=>!item.resolved).length,nutritionPlanPending,products,baseline,temporalContext:`Situação conforme documento de ${fmtDate(date)}; atualização posterior não confirmada.`};
}
function protocolContext(data,status,bounds){
  const domains=['treatments','regimens','docs'],availableDomains=domains.filter(key=>status[key]==='ready'),available=availableDomains.length>0;
  const rows=status.treatments==='ready'?list(data.treatments):[];
  const events=rows.flatMap(row=>{
    const date=eventDay(row?.event_date);if(!asOf(date,bounds))return [];
    const eventType=text(row.event_type)||'unknown';
    return [{id:text(row.source_record_id)||`event:${date}:${text(row.medication)}:${eventType}`,kind:'event',name:text(row.medication)||'Tratamento registrado',title:text(row.medication)||'Tratamento registrado',date,type:eventType,eventType,eventLabel:eventLabels[eventType]||`Evento registrado: ${eventType}`,source:source(row),sourceFile:text(row.source_file)||null,inPeriod:inside(date,bounds)}];
  }).sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name,'pt-BR')||a.id.localeCompare(b.id));
  const names=distinct(events.map(event=>event.name));
  const items=names.map(name=>{
    const history=events.filter(event=>event.name===name),latest=history[0],latestEvents=history.filter(event=>event.date===latest.date);
    return {...latest,id:`protocol:${name}`,kind:'protocol',events:latestEvents,eventLabel:distinct(latestEvents.map(event=>event.eventLabel)).join(' · '),eventCount:history.length,inPeriodCount:history.filter(event=>event.inPeriod).length,temporalContext:latest.inPeriod?'Última ocorrência no período':'Última ocorrência antes do período',currentUseConfirmed:false};
  });
  if(status.regimens==='ready')for(const row of list(data.regimens)){
    const confirmedStart=row.started_by_user_confirmation===true?day(row.start_date):null;
    const date=day(row.document_date)||day(row.effective_from)||confirmedStart,name=text(row.medication)||'Protocolo cadastrado';
    if((date&&!asOf(date,bounds))||names.includes(name))continue;
    const recordedStatus=text(row.recorded_status),startDate=asOf(confirmedStart,bounds)?confirmedStart:null;
    const eventLabel=startDate?'Início relatado; contexto documentado':recordedStatus==='planned_start_unconfirmed'?'Plano documentado · início não registrado':recordedStatus.startsWith('documented_')?'Plano documentado · atualização de uso não confirmada':'Cadastro de protocolo';
    items.push({id:text(row.source_record_id)||`regimen:${name}`,kind:'regimen',name,title:name,date,type:'regimen',eventType:'regimen',eventLabel,recordedStatus:recordedStatus||null,startDate,source:source(row),sourceFile:text(row.source_file)||null,inPeriod:date?inside(date,bounds):false,temporalContext:day(row.document_date)?`Documento de ${fmtDate(date)}; não é data de início de uso`:date?(inside(date,bounds)?'Cadastro no período':'Cadastro anterior ao período'):'Cadastro sem data; vigência no período não confirmada',events:[],eventCount:0,inPeriodCount:0,currentUseConfirmed:false});
  }
  const documents=status.docs==='ready'?list(data.docs).map(row=>documentItem(row,bounds)).filter(Boolean).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id)):[];
  const care=status.docs==='ready'?careContext(list(data.docs),bounds):{available:false,status:status.docs||'unavailable',date:null,followups:[],pending:[],products:[],baseline:[]};
  const latestDocuments=documents.filter(document=>documents.find(other=>other.type===document.type)?.date===document.date);
  const combined=[...items,...latestDocuments].sort((a,b)=>(b.date||'').localeCompare(a.date||'')||a.name.localeCompare(b.name,'pt-BR'));
  return {available,status:availableDomains.length===domains.length?'ready':available?'partial':domains.some(key=>status[key]==='error')?'error':'unavailable',items:combined,events,documents,care,availableDomains,missingDomains:domains.filter(key=>status[key]!=='ready'),asOfDate:bounds.end,inPeriodCount:events.filter(event=>event.inPeriod).length,context:'Ocorrências e documentos até a data selecionada. Ausência de registro não confirma dose omitida; o histórico não confirma uso atual, adesão ou ajuste de dose.'};
}
function careInsight(protocols){
  const care=protocols.care;
  if(!care.available||!care.pending.length)return null;
  return {id:'care-followup',tone:'neutral',title:'Confira o acompanhamento documentado',text:`${care.pending.length} pendência(s) constam no documento de ${fmtDate(care.date)}. Confira o que já foi resolvido antes de planejar o próximo passo.`,evidence:`${care.pending.slice(0,2).map(item=>item.label).join(' · ')} · ${fmtDate(care.date)} · ${care.source}. Situação atual não confirmada.`,evidenceItems:care.pending.map(item=>({date:care.date,label:item.label,source:care.source})),action:{route:'tratamentos',label:'Revisar acompanhamento'}};
}
function laboratoryInsight(data,status,bounds,context){
  if(status.labs!=='ready'||context?.labs?.available===false)return null;
  const rows=Array.isArray(context?.labs?.history)?context.labs.history.map(row=>({...row,collection_date:row.date,result_numeric:row.value,result_raw:row.rawValue,reference_range:row.reference})).filter(row=>asOf(day(row.collection_date),bounds)):list(data.labs).filter(row=>asOf(day(row?.collection_date),bounds)),date=rows.map(row=>row.collection_date).sort().at(-1);
  if(!date)return null;
  const latest=rows.filter(row=>row.collection_date===date),sources=distinct(latest.map(row=>text(row.laboratory)||source(row)));
  return {id:'laboratory-context',tone:'neutral',title:'Use os exames na revisão do plano',text:`${latest.length} resultado(s) na última coleta até a data selecionada. Confira as referências do próprio laudo e leve as dúvidas à consulta. Os resultados isolados não definem diagnóstico nem ajuste de medicação.`,evidence:`Coleta: ${fmtDate(date)} · ${sources.join(' / ')} · ${inside(date,bounds)?'Dentro do período':'Coleta anterior ao período'}`,evidenceItems:latest.map(row=>({date,biomarker:text(row.biomarker),value:numeric(row.result_numeric),raw:text(row.result_raw)||null,unit:text(row.unit)||'Unidade não informada',reference:text(row.reference_range)||null,source:text(row.laboratory)||source(row)})),action:{route:'saude',label:'Ver exames e referências'}};
}

function trainingInsight(context,bounds){
  const training=context?.training;
  if(!training?.available||!training.latest||!asOf(day(training.latest.date),bounds))return null;
  const missing=list(training.missingGroups),latest=training.latest;
  const text=missing.length?`${missing.map(item=>item.label).join(', ')}: sem registro nesta janela, embora apareça(m) no histórico. Confira o diário e a organização do seu plano; ausência de registro não confirma que o grupo deixou de ser treinado.`:`${training.sessions??0} sessão(ões) e ${training.recordedDays??0} dia(s) com treino registrado nesta janela. Confira a distribuição no diário; esses registros não confirmam adesão ao plano.`;
  return {id:'training-context',tone:'neutral',title:missing.length?'Confira a distribuição registrada':'Treino: confira a rotina registrada',text,evidence:`${dateRange(bounds)} · Última sessão até o fim da janela: ${fmtDate(latest.date)} · ${source(latest)}`,evidenceItems:[{date:latest.date,source:source(latest),recordedDays:training.recordedDays,sessions:training.sessions}],action:{route:'treinos',label:'Ver rotina de treinos'}};
}

export function dashboardGuidance(data={},status={},dashboard={},context={}){
  const today=day(dashboard.today),selectedDate=day(dashboard.date);
  const bounds={...dashboard.bounds,start:day(dashboard.bounds?.start)||(dashboard.mode==='day'?selectedDate:null),end:day(dashboard.bounds?.end)||selectedDate||today};
  if(dashboard.mode==='day'&&selectedDate){bounds.start=selectedDate;bounds.end=selectedDate;}
  const goals={available:status.goals==='ready',status:status.goals||'unavailable',water:goalComparison(data,status,dashboard,'water',bounds,today),protein:goalComparison(data,status,dashboard,'protein',bounds,today),documentedWater:documentedWaterReferenceForDate(data.waterReferences,bounds.end,status.waterReferences)};
  if(goals.documentedWater)goals.documentedWater={...goals.documentedWater,unit:'mL/dia',isDailyTarget:false,context:'Referência documental separada. Data de atualização do documento; início clínico não explicitado. Não é meta diária confirmada.'};
  const protocols=protocolContext(data,status,bounds);
  const receivedNutritionPlan=selectDocumentedNutritionPlan(data.nutritionPlans||[],today,status.nutritionPlans).plan;
  const nutritionContext={documentedWater:goals.documentedWater,care:protocols.care,receivedNutritionPlan};
  const insights=[nutritionInsight(goals.water,dashboard,bounds,nutritionContext),nutritionInsight(goals.protein,dashboard,bounds,nutritionContext),careInsight(protocols),laboratoryInsight(data,status,bounds,context),trainingInsight(context,bounds)].filter(Boolean).slice(0,4);
  return {protocols,insights,goals,bounds,contextOnly:true};
}
