import {day,num,norm,unique} from './core.js';
import {stableAppleMetricTypes} from './source-status.js';

const loaded=(status,key)=>status?.[key]!=='error';
const sortAsc=(rows,key)=>[...(rows||[])].sort((a,b)=>String(a?.[key]||'').localeCompare(String(b?.[key]||'')));
const uniqueDays=(rows,key)=>unique((rows||[]).map(r=>day(r?.[key])).filter(Boolean));
const addDays=(date,delta)=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+delta);return d.toISOString().slice(0,10);};
const inRange=(value,start,end)=>{const d=day(value);return d&&d>=start&&d<=end;};
const pct=(a,b)=>b>0?Math.round(a/b*100):0;
const signed=(value,digits=1,unit='')=>{const n=num(value);if(n==null)return null;const text=n.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits});return`${n>0?'+':''}${text}${unit?` ${unit}`:''}`;};
const maxDate=(values)=>values.filter(Boolean).sort().at(-1)||null;
const prettyDate=value=>{const s=day(value);if(!s)return'—';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`;};
const canonicalActivityRows=rows=>(rows||[]).filter(row=>stableAppleMetricTypes.has(row?.metric_type));

function referenceDay(data){
  return maxDate([
    maxDate((data.body||[]).map(r=>day(r.measured_at))),
    maxDate((data.workouts||[]).map(r=>day(r.workout_date))),
    maxDate((data.nutrition||[]).map(r=>day(r.nutrition_date))),
    maxDate(canonicalActivityRows(data.metrics).map(r=>day(r.measured_at))),
    maxDate((data.labs||[]).map(r=>day(r.collection_date)))
  ]);
}

function bodyChange(data,status){
  if(!loaded(status,'body'))return{kind:'unavailable',title:'Composição corporal indisponível',summary:'As medições corporais não carregaram nesta atualização.',route:'evolucao',priority:95};
  const rows=sortAsc(data.body,'measured_at');
  if(rows.length<2)return{kind:'coverage',title:'Composição ainda sem comparação',summary:'São necessárias pelo menos duas medições corporais estruturadas para comparar períodos.',route:'bio',priority:55};
  const previous=rows.at(-2),latest=rows.at(-1),parts=[];
  const fields=[['weight_kg','peso',1,'kg'],['skeletal_muscle_mass_kg','massa muscular esquelética',1,'kg'],['body_fat_pct','gordura corporal',1,'p.p.']];
  for(const[key,label,digits,unit]of fields){const a=num(previous[key]),b=num(latest[key]);if(a==null||b==null)continue;parts.push(`${label} ${signed(b-a,digits,unit)}`);}
  return{kind:'change',title:'Nova comparação de composição disponível',summary:parts.length?`Entre ${prettyDate(previous.measured_at)} e ${prettyDate(latest.measured_at)}: ${parts.join(' · ')}.`:`Existem duas medições comparáveis entre ${prettyDate(previous.measured_at)} e ${prettyDate(latest.measured_at)}.`,route:'evolucao',priority:86,evidence:[day(previous.measured_at),day(latest.measured_at)]};
}

function workoutRhythm(data,status,ref){
  if(!loaded(status,'workouts'))return{kind:'unavailable',title:'Treinos indisponíveis',summary:'O histórico de treinos não carregou nesta atualização.',route:'treinos',priority:94};
  const rows=data.workouts||[];
  if(!rows.length)return{kind:'coverage',title:'Sem treino estruturado',summary:'Ainda não há sessões canônicas suficientes para analisar ritmo de treino.',route:'treinos',priority:50};
  const recentStart=addDays(ref,-27),previousEnd=addDays(recentStart,-1),previousStart=addDays(previousEnd,-27);
  const recent=rows.filter(r=>inRange(r.workout_date,recentStart,ref)).length;
  const previous=rows.filter(r=>inRange(r.workout_date,previousStart,previousEnd)).length;
  const delta=recent-previous;
  const direction=delta===0?'permaneceu igual':delta>0?'aumentou':'diminuiu';
  return{kind:'change',title:'Ritmo de treino em períodos equivalentes',summary:`A frequência registrada ${direction}: ${previous} sessão(ões) nos 28 dias anteriores e ${recent} nos 28 dias mais recentes.`,route:'treinos',priority:delta===0?68:82,meta:{recent,previous,delta}};
}

function bestComparablePerformance(data,status){
  if(!loaded(status,'workouts')||!loaded(status,'exercises')||!loaded(status,'sets'))return null;
  const workouts=new Map((data.workouts||[]).map(w=>[w.source_record_id,w]));
  const exerciseRows=(data.exercises||[]).filter(e=>workouts.has(e.workout_source_record_id));
  const groups=new Map();
  for(const e of exerciseRows){const key=`${norm(e.exercise)}|${norm(e.machine)}`;if(!norm(e.exercise))continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
  const candidates=[];
  for(const exercises of groups.values()){
    const ordered=[...exercises].sort((a,b)=>String(b.workout_date||'').localeCompare(String(a.workout_date||'')));if(ordered.length<2)continue;
    const pair=[];
    for(const ex of ordered){const sets=(data.sets||[]).filter(s=>s.exercise_source_record_id===ex.source_record_id&&num(s.weight)!=null&&s.weight_unit);const units=unique(sets.map(s=>norm(s.weight_unit)));if(units.length!==1||!sets.length)continue;pair.push({exercise:ex,value:Math.max(...sets.map(s=>num(s.weight))),unit:sets[0].weight_unit,date:day(ex.workout_date)});if(pair.length===2)break;}
    if(pair.length<2||norm(pair[0].unit)!==norm(pair[1].unit))continue;candidates.push({latest:pair[0],previous:pair[1],delta:pair[0].value-pair[1].value});
  }
  if(!candidates.length)return null;
  candidates.sort((a,b)=>String(b.latest.date).localeCompare(String(a.latest.date))||Math.abs(b.delta)-Math.abs(a.delta));
  const c=candidates[0],name=c.latest.exercise.exercise;
  return{kind:'change',title:'Performance comparável registrada',summary:`${name}: ${c.previous.value.toLocaleString('pt-BR')} → ${c.latest.value.toLocaleString('pt-BR')} ${c.latest.unit}, comparando o mesmo exercício, máquina e unidade.`,route:'treinos',priority:78};
}

function bodyIntervalContext(data,status){
  if(!loaded(status,'body')||!loaded(status,'workouts')||!loaded(status,'nutrition'))return null;
  const body=sortAsc(data.body,'measured_at');if(body.length<2)return null;
  const previous=body.at(-2),latest=body.at(-1),start=day(previous.measured_at),end=day(latest.measured_at);
  const workouts=(data.workouts||[]).filter(w=>day(w.workout_date)>start&&day(w.workout_date)<=end);
  const nutritionDays=uniqueDays((data.nutrition||[]).filter(n=>day(n.nutrition_date)>start&&day(n.nutrition_date)<=end),'nutrition_date');
  return{kind:'cross',title:'Contexto entre as duas últimas medições',summary:`No intervalo de ${prettyDate(start)} a ${prettyDate(end)}, há ${workouts.length} treino(s) e ${nutritionDays.length} dia(s) com alimentação registrada. Esses dados ficam juntos como contexto, sem atribuir causa às mudanças corporais.`,route:'analise',priority:91};
}

function workoutNutritionContext(data,status,ref){
  if(!loaded(status,'workouts')||!loaded(status,'nutrition'))return null;
  const start=addDays(ref,-55),workouts=(data.workouts||[]).filter(w=>inRange(w.workout_date,start,ref));if(!workouts.length)return null;
  const nutritionDays=new Set(uniqueDays((data.nutrition||[]).filter(n=>inRange(n.nutrition_date,start,ref)),'nutrition_date'));
  const paired=workouts.filter(w=>nutritionDays.has(day(w.workout_date))).length,coverage=pct(paired,workouts.length);
  return{kind:coverage>=70?'cross':'coverage',title:coverage>=70?'Treino × alimentação tem boa cobertura':'Alimentação limita o cruzamento com treinos',summary:`${paired} de ${workouts.length} sessão(ões) nas últimas 8 semanas têm alimentação registrada no mesmo dia (${coverage}%). Isso mede cobertura de dados, não efeito sobre performance.`,route:'analise',priority:coverage>=70?84:88};
}

function labContext(data,status){
  if(!loaded(status,'labs'))return{kind:'unavailable',title:'Exames indisponíveis',summary:'Os resultados laboratoriais não carregaram nesta atualização.',route:'saude',priority:93};
  const rows=data.labs||[],dates=uniqueDays(rows,'collection_date').sort();
  if(!dates.length)return{kind:'coverage',title:'Sem exames estruturados',summary:'Ainda não há coleta laboratorial estruturada para leitura longitudinal.',route:'saude',priority:56};
  if(dates.length<2)return{kind:'coverage',title:'Exames ainda não formam uma série longitudinal',summary:`Há resultados estruturados em ${prettyDate(dates[0])}, mas é necessária outra coleta comparável para identificar mudanças ao longo do tempo.`,route:'saude',priority:89};
  const latest=dates.at(-1),previous=dates.at(-2),a=rows.filter(r=>day(r.collection_date)===previous),b=rows.filter(r=>day(r.collection_date)===latest),old=new Map(a.map(r=>[norm(r.biomarker),r]));
  const comparable=b.filter(r=>{const p=old.get(norm(r.biomarker));return p&&num(p.result_numeric)!=null&&num(r.result_numeric)!=null&&norm(p.unit)===norm(r.unit);});
  return{kind:'change',title:'Exames têm nova comparação disponível',summary:`As coletas de ${prettyDate(previous)} e ${prettyDate(latest)} têm ${comparable.length} biomarcador(es) comparável(is) com a mesma unidade.`,route:'saude',priority:88};
}

function metricCoverage(data,status,ref){
  if(!loaded(status,'metrics'))return{kind:'unavailable',title:'Atividade indisponível',summary:'As métricas de atividade não carregaram nesta atualização.',route:'timeline',priority:92};
  const start=addDays(ref,-13),rows=canonicalActivityRows(data.metrics).filter(m=>inRange(m.measured_at,start,ref));
  const activity=uniqueDays(rows,'measured_at').length;
  return{kind:activity>=7?'cross':'coverage',title:'Cobertura recente de atividade',summary:`Nos 14 dias mais recentes com dados, há atividade canônica em ${activity} dia(s). Sono permanece fora desta leitura até a política de sobreposição entre fontes ser validada.`,route:'timeline',priority:74};
}

function pendingData(data){
  const uploads=(data.uploads||[]).filter(u=>['review_required','failed','uploaded','processing'].includes(String(u.status||'')));
  const candidates=(data.sourceMetrics||[]).filter(r=>['candidate','held'].includes(String(r.canonical_status||'').toLowerCase()));
  if(!uploads.length&&!candidates.length)return null;
  const parts=[];if(uploads.length)parts.push(`${uploads.length} arquivo(s) ainda em processamento ou revisão`);if(candidates.length)parts.push(`${candidates.length} registro(s) por origem ainda não consolidados`);
  return{kind:'coverage',title:'Há dados recebidos ainda fora da visão principal',summary:`${parts.join(' · ')}. Eles não entram nos insights até serem confirmados.`,route:'dados',priority:90};
}

function coverageRows(data,status,ref){
  const body=loaded(status,'body')?(data.body||[]):null,workouts=loaded(status,'workouts')?(data.workouts||[]):null,nutrition=loaded(status,'nutrition')?(data.nutrition||[]):null,metrics=loaded(status,'metrics')?canonicalActivityRows(data.metrics):null,labs=loaded(status,'labs')?(data.labs||[]):null;
  const start56=addDays(ref,-55),start28=addDays(ref,-27);
  return[
    {key:'body',label:'Composição',route:'evolucao',state:body==null?'unavailable':body.length>=2?'strong':body.length?'partial':'limited',detail:body==null?'indisponível':`${body.length} medição(ões) no histórico`},
    {key:'workouts',label:'Treinos',route:'treinos',state:workouts==null?'unavailable':workouts.filter(w=>inRange(w.workout_date,start56,ref)).length>=4?'strong':workouts.length?'partial':'limited',detail:workouts==null?'indisponível':`${workouts.filter(w=>inRange(w.workout_date,start56,ref)).length} sessão(ões) nas últimas 8 semanas`},
    {key:'nutrition',label:'Alimentação',route:'nutricao',state:nutrition==null?'unavailable':uniqueDays(nutrition.filter(n=>inRange(n.nutrition_date,start28,ref)),'nutrition_date').length>=14?'strong':nutrition.length?'partial':'limited',detail:nutrition==null?'indisponível':`${uniqueDays(nutrition.filter(n=>inRange(n.nutrition_date,start28,ref)),'nutrition_date').length} dia(s) nos últimos 28 dias`},
    {key:'metrics',label:'Atividade',route:'timeline',state:metrics==null?'unavailable':uniqueDays(metrics.filter(m=>inRange(m.measured_at,start28,ref)),'measured_at').length>=14?'strong':metrics.length?'partial':'limited',detail:metrics==null?'indisponível':`${uniqueDays(metrics.filter(m=>inRange(m.measured_at,start28,ref)),'measured_at').length} dia(s) com atividade canônica nos últimos 28 dias`},
    {key:'labs',label:'Exames',route:'saude',state:labs==null?'unavailable':uniqueDays(labs,'collection_date').length>=2?'strong':labs.length?'partial':'limited',detail:labs==null?'indisponíveis':`${uniqueDays(labs,'collection_date').length} data(s) de coleta estruturada(s)`}
  ];
}

function headline(model){
  const strong=model.coverage.filter(c=>c.state==='strong').length,limited=model.coverage.filter(c=>c.state==='limited'||c.state==='unavailable').length;
  const changeCount=model.changes.filter(i=>i.kind==='change').length;
  if(changeCount>=2&&strong>=3)return{eyebrow:'LTS Health Intelligence',title:'Seu histórico já mostra mudanças que merecem contexto, não apenas gráficos.',subtitle:`Há ${changeCount} mudanças recentes com evidência estruturada e ${strong} domínios com cobertura forte.`};
  if(strong>=3)return{eyebrow:'LTS Health Intelligence',title:'Há base suficiente para uma leitura integrada do seu histórico.',subtitle:`${strong} domínios têm cobertura forte; ${limited?`${limited} ainda limitam algumas conclusões.`:'as principais fontes estão comparáveis.'}`};
  return{eyebrow:'LTS Health Intelligence',title:'O histórico está sendo consolidado, mas algumas conclusões ainda seriam prematuras.',subtitle:'O dashboard mostra o que já é comparável e deixa explícito onde faltam dados.'};
}

export function buildHealthIntelligence(data={},domainStatus={},now=new Date()){
  const ref=referenceDay(data)||new Date(now).toISOString().slice(0,10);
  const changes=[bodyChange(data,domainStatus),workoutRhythm(data,domainStatus,ref),bestComparablePerformance(data,domainStatus),labContext(data,domainStatus)].filter(Boolean);
  const cross=[bodyIntervalContext(data,domainStatus),workoutNutritionContext(data,domainStatus,ref),metricCoverage(data,domainStatus,ref)].filter(Boolean);
  const pending=pendingData(data),attention=[...changes,...cross,pending].filter(Boolean).filter(i=>['coverage','unavailable'].includes(i.kind)).sort((a,b)=>b.priority-a.priority).slice(0,4);
  const insights=[...changes,...cross].filter(i=>['change','cross'].includes(i.kind)).sort((a,b)=>b.priority-a.priority).slice(0,5);
  const coverage=coverageRows(data,domainStatus,ref);
  const model={referenceDay:ref,changes:changes.filter(Boolean),cross:cross.filter(Boolean),insights,attention,coverage,pending};
  return{...model,headline:headline(model),strongDomains:coverage.filter(c=>c.state==='strong').length,comparableDomains:coverage.filter(c=>c.state==='strong'||c.state==='partial').length};
}
