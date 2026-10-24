import {healthDashboardModel} from './health-dashboard-model.js';
import {dashboardContext} from './health-dashboard-context.js';
import {dashboardBody} from './health-dashboard-body.js';
import {workingLoadChanges,loadInsightUnits} from './evidence-insights.js';
import {labCohorts} from './labs-layout-v2.js';
import {norm} from './core.js';

// Pure, descriptive readings. Direction is not clinical improvement, a target,
// tissue change or strength gain. Navigation is rebuilt from current evidence.
const list=v=>Array.isArray(v)?v:[];
const n=v=>v!=null&&typeof v!=='boolean'&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
const fmt=v=>n(v)==null?'Sem valor':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:10});
const date=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'Data não informada';
const direction=v=>v===0?'sem mudança numérica':v>0?'aumentou':'diminuiu';
const delta=(v,u)=>`${direction(v)} ${v===0?'':fmt(Math.abs(v))+' '+u}`.trim();
const unknown=new Set(['unknown','unknown model','unknown source','not informed','not provided','not available','não informado','não informada','não disponível','origem não informada','modelo não informado','desconhecido','desconhecida','n/a','na','null','none','—','-'].map(norm));
const known=v=>typeof v==='string'&&Boolean(norm(v)&&!unknown.has(norm(v))&&!/^(unknown(?: |$)|nao (?:informad|identificad|registrad)|sem informacao|unreported$|not documented$)/.test(norm(v)));
const labValue=i=>i.rawValue?String(i.rawValue)+(i.unit&&!String(i.rawValue).trim().endsWith(i.unit)?' '+i.unit:''):unitValue(i.value,i.unit);
const id=r=>r?.source_record_id||r?.id?String(r.source_record_id||r.id):null;
const recordAction=(key,label,route,ui)=>({key,label,route,ui});
const unitValue=(v,u)=>`${fmt(v)}${u?' '+u:''}`;

function bodyReading(data,status,d,b){
  const base={key:'body',title:'Composição corporal',rows:[],actions:[],note:'Diferenças entre medições não comprovam mudança de tecido; as condições de medição não estão confirmadas.'};
  if(!b.available||status.body!=='ready')return {...base,state:'unavailable',summary:'As avaliações não carregaram. Nenhuma mudança foi calculada.'};
  if(b.latestKnownAmbiguous||!b.latest)return {...base,state:'missing',summary:b.text||'Não há avaliação sem conflito até a data selecionada.'};
  const a=b.first,z=b.latest,knownModels=known(a?.device_name)&&known(z.device_name);
  const sameOrigin=knownModels&&norm(a.device_name)===norm(z.device_name)&&known(a.source)&&known(z.source)&&norm(a.source)===norm(z.source);
  const uniqueDates=[a,z].filter(Boolean).every(row=>list(data.body).filter(r=>String(r.measured_at||'').slice(0,10)===row.date).length===1);
  const uniqueId=row=>id(row)&&list(data.body).filter(r=>id(r)===id(row)).length===1;
  const identityConflict=[a,z].filter(Boolean).some(row=>id(row)&&!uniqueId(row));
  const comparable=b.pair&&sameOrigin&&uniqueDates&&!b.ambiguousDates?.length&&!identityConflict;
  const rows=Object.values(b.metrics||{}).filter(m=>n(m.latest)!=null).map(m=>({key:m.key,label:m.label,
    current:unitValue(m.latest,m.unit),previous:comparable&&n(m.first)!=null?unitValue(m.first,m.unit):null,
    change:comparable&&n(m.delta)!=null?delta(m.delta,m.unit):null,currentDate:z.date,previousDate:comparable?a.date:null}));
  const actions=[...(comparable&&uniqueId(a)?[recordAction('body:'+id(a),'Abrir avaliação de '+date(a.date),'bio',{productCompositionRecord:id(a)})]:[]),
    ...(uniqueId(z)?[recordAction('body:'+id(z),'Abrir avaliação de '+date(z.date),'bio',{productCompositionRecord:id(z)})]:[])];
  return {...base,state:comparable?'comparison':'current',rows,actions,
    summary:comparable?`${date(a.date)} → ${date(z.date)} · mesma origem e modelo registrados.`:`Última avaliação conhecida: ${date(z.date)}${b.outsidePeriod?' · fora do período':''}.`,
    note:comparable?base.note:identityConflict?'Um identificador está repetido entre avaliações; confira os registros antes de comparar.':!b.pair?'Uma avaliação isolada não permite calcular mudança.':!sameOrigin?'Origem ou modelo diferente ou não informado. Os valores não viram uma tendência única.':'Há mais de uma avaliação em uma das datas; a diferença fica suspensa.',
    source:[z.source,z.device_name].filter(Boolean).join(' · ')};
}

function trainingReading(data,status,d,c){
  const base={key:'training',title:'Treinos',rows:[],actions:[],note:'Comparação de cargas registradas, não comprovação de ganho de força, execução igual ou mesma estação física.'};
  const model=workingLoadChanges(data,status,d.bounds,d.today);
  // A nonempty placeholder is not a recorded condition, even when repeated.
  const item=model.rows.find(row=>row.records?.every(({workout,exercise,set})=>[exercise.exercise,exercise.machine,workout.location,set.technique,workout.source_recorded??workout.source,exercise.source,set.source].every(known)));
  if(!model.available)return {...base,state:'unavailable',summary:'Treinos, exercícios ou séries não carregaram. A mudança de carga não foi calculada.'};
  if(!item)return {...base,state:'missing',summary:c.training?.latest?`Última sessão conhecida: ${date(c.training.latest.date)}. Não há duas sessões com condições registradas equivalentes nesta janela.`:'Não há sessão registrada até a data selecionada.',
    note:'Exercício, aparelho, local, origem, unidade, fase, técnica, esforço e repetições precisam ser compatíveis. Informação ausente permanece desconhecida.'};
  const unit=loadInsightUnits[item.unit]||item.unit;
  const actions=[['previous','anterior'],['latest','mais recente']].flatMap(([key,label])=>{
    const point=item[key],workoutId=point.workoutId;
    return workoutId?[recordAction('training:'+workoutId+':'+point.exerciseId,'Abrir sessão '+label+' · '+date(point.date),'treinos',{openWorkout:workoutId,productTrainingView:'exercises'})]:[];
  });
  return {...base,state:'comparison',summary:`${item.exercise} · ${item.reps} repetições`,
    rows:[{key:item.key,label:'Carga registrada',previous:unitValue(item.previous.weight,unit),current:unitValue(item.latest.weight,unit),change:delta(item.delta,unit),previousDate:item.previous.date,currentDate:item.latest.date}],
    source:[item.machine,item.location,data.workouts?.find(row=>row.source_record_id===item.latest.workoutId)?.source].filter(Boolean).join(' · '),actions,
    note:`${base.note} Exemplo mais recente com comparação disponível na janela; não é uma avaliação de todo o treino.`};
}

function labsReading(status,c){
  const labs=c.labs,base={key:'labs',title:'Exames',rows:[],actions:[],note:'A direção do número e a posição na referência do laudo não definem melhora, piora clínica ou necessidade de tratamento.'};
  if(status.labs!=='ready'||!labs?.available)return {...base,state:'unavailable',summary:'Os exames não carregaram. Nenhuma tendência foi calculada.'};
  const items=list(labs.latestCollectionItems).slice().sort((a,b)=>Number(b.comparable)-Number(a.comparable)||a.biomarker.localeCompare(b.biomarker,'pt-BR')).slice(0,3);
  if(!items.length)return {...base,state:'missing',summary:'Não há coleta registrada até a data selecionada.'};
  const rows=items.map(item=>({key:item.key,label:item.biomarker,current:item.ambiguous?'Mais de um resultado':labValue(item),
    previous:item.comparable?labValue(item.previous):null,
    change:item.comparable?delta(item.delta,item.unit==='%'?'p.p.':item.unit):null,currentDate:item.date,previousDate:item.comparable?item.previous?.date:null,
    context:item.comparable?item.currentReferenceLabel||'Referência do laudo não classificada':item.comparisonReasonLabel||'Sem comparação segura entre estas coletas.',
    priorOutside:item.priorOutside,source:[item.laboratory,item.method].filter(Boolean).join(' · ')}));
  const actions=items.filter(item=>!item.ambiguous).flatMap(item=>{
    const raw={biomarker:item.biomarker,unit:item.unit,laboratory:item.laboratory,method:item.method,source:item.source,source_file:item.sourceFile},cohort=labCohorts({rows:[raw]})[0];
    if(!cohort)return [];
    return [recordAction('labs:'+item.key+':'+item.date+':'+(item.sourceRecordId||''),'Abrir '+item.biomarker+' · '+date(item.date),'saude',{productLabMarker:norm(item.biomarker),productLabCohort:cohort.key,productLabPeriod:'all',productLabAsOf:item.date,productLabCollection:item.date,productLabPoint:item.date,productLabPage:1,productLabQuery:''})];
  });
  return {...base,state:items.some(item=>item.comparable)?'comparison':'current',rows,actions,
    summary:`Última coleta conhecida: ${date(labs.latestCollectionDate)}${items.every(item=>!item.inPeriod)?' · fora do período':''}.`,
    note:base.note+' Até três marcadores da última coleta: comparáveis primeiro, depois ordem alfabética. Não é ordem de gravidade.'};
}

export function dashboardChanges(data={},status={},ui={},today,models={}){
  const d=models.dashboard||healthDashboardModel(data,status,ui,today),c=models.context||dashboardContext(data,status,{bounds:d.bounds,today:d.today,mode:d.mode}),b=models.body||dashboardBody(data,status,d,ui);
  // Fixed domain slots: goals or missing data can never suppress training.
  return {bounds:d.bounds,domains:[bodyReading(data,status,d,b),trainingReading(data,status,d,c),labsReading(status,c)]};
}
export function dashboardChangeAction(key,data,status,ui,today){
  return dashboardChanges(data,status,ui,today).domains.flatMap(item=>item.actions).find(action=>action.key===key)||null;
}
