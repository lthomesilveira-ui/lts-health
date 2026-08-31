import {state,esc,day,fmtDate,fmtNum,num,unique,bodyRows,workoutRows,neutralDelta,since,norm} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const metric=(label,value,sub='')=>`<div class="card metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<em>${esc(sub)}</em>`:''}</div>`;
const empty=text=>`<div class="empty">${esc(text)}</div>`;
const failed=key=>state.domainStatus[key]==='error';
const unavailable=text=>`<div class="errorState"><b>${esc(text)}</b><span>Esta análise não usa zero no lugar de dados que não carregaram. Tente atualizar.</span></div>`;
const pendingStatuses=new Set(['candidate','held']);

function sleepByDay(){
  const map=new Map();
  if(failed('metrics'))return map;
  for(const m of state.data.metrics||[]){
    if(m.metric_type!=='sleep_duration_h')continue;
    const d=day(m.measured_at),v=num(m.value);
    if(!d||v==null)continue;
    if(!map.has(d))map.set(d,[]);
    map.get(d).push({value:v,source:m.source||'',sourceFile:m.source_file||''});
  }
  return map;
}
function pendingSleepByDay(){
  const map=new Map();
  if(failed('sourceMetrics'))return map;
  for(const row of state.data.sourceMetrics||[]){
    if(row.metric_type!=='sleep_duration_h'||!pendingStatuses.has(norm(row.canonical_status)))continue;
    const d=day(row.metric_date),v=num(row.value);if(!d||v==null)continue;
    if(!map.has(d))map.set(d,[]);
    map.get(d).push({value:v,source:row.source_name||row.source_family||'Origem registrada'});
  }
  return map;
}
function prevDay(date){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);}
function filterPeriod(rows,key,period){if(period==='all')return rows;const cut=since(Number(period));return rows.filter(r=>day(r[key])>=cut);}
function periodLabel(period){return period==='30'?'30 dias':period==='90'?'90 dias':period==='365'?'1 ano':'todo o histórico';}
function rangeOf(rows,key){const dates=rows.map(r=>day(r[key])).filter(Boolean).sort();return dates.length?`${fmtDate(dates[0])} → ${fmtDate(dates.at(-1))}`:'sem registros';}
function evidenceRow(label,value,detail){return`<div class="evidenceRow"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(detail)}</small></div>`;}
function distinctCollectionDays(rows){return unique(rows.map(l=>day(l.collection_date)).filter(Boolean));}
function daysInPeriod(map,period){const cut=period==='all'?null:since(Number(period));return [...map.keys()].filter(date=>!cut||date>=cut).sort();}

export function renderAnalysisHub(){
  const wf=failed('workouts'),bf=failed('body'),nf=failed('nutrition'),lf=failed('labs'),mf=failed('metrics'),sf=failed('sourceMetrics');
  const workouts=wf?[]:workoutRows(),body=bf?[]:bodyRows(),nutrition=nf?[]:(state.data.nutrition||[]),labs=lf?[]:(state.data.labs||[]),metrics=mf?[]:(state.data.metrics||[]);
  const period=state.ui.analysisPeriod||'365',periodText=periodLabel(period);
  const wPeriod=filterPeriod(workouts,'workout_date',period),nPeriod=filterPeriod(nutrition,'nutrition_date',period),labPeriod=filterPeriod(labs,'collection_date',period),metricPeriod=filterPeriod(metrics,'measured_at',period),bodyPeriod=filterPeriod(body,'measured_at',period);
  const sleep=sleepByDay(),pendingSleep=pendingSleepByDay(),sleepDays=unique(metricPeriod.filter(m=>m.metric_type==='sleep_duration_h').map(m=>day(m.measured_at))),pendingSleepDays=sf?[]:daysInPeriod(pendingSleep,period);
  const nutritionDays=new Set(nPeriod.map(n=>day(n.nutrition_date))),workoutDays=new Set(wPeriod.map(w=>day(w.workout_date))),sameDay=[...workoutDays].filter(d=>nutritionDays.has(d)),matchedWorkoutCount=wPeriod.filter(w=>nutritionDays.has(day(w.workout_date))).length;
  const sleepCandidates=wPeriod.map(w=>({workout:w,night:prevDay(day(w.workout_date)),records:sleep.get(prevDay(day(w.workout_date)))||[],pending:pendingSleep.get(prevDay(day(w.workout_date)))||[]}));
  const sleepPairs=sleepCandidates.filter(x=>x.records.length===1);
  const ambiguousSleepPairs=sleepCandidates.filter(x=>x.records.length>1);
  const pendingSleepPairs=sleepCandidates.filter(x=>x.records.length===0&&x.pending.length>0);
  const missingSleepPairs=sleepCandidates.filter(x=>x.records.length===0&&x.pending.length===0);
  const labDates=distinctCollectionDays(labPeriod),allLabDates=distinctCollectionDays(labs),last=body.at(-1),prev=body.at(-2);
  const between=last&&prev&&!wf?workouts.filter(w=>day(w.workout_date)>day(prev.measured_at)&&day(w.workout_date)<=day(last.measured_at)):[];
  const betweenNutrition=last&&prev&&!nf?unique(nutrition.filter(n=>day(n.nutrition_date)>day(prev.measured_at)&&day(n.nutrition_date)<=day(last.measured_at)).map(n=>day(n.nutrition_date))):[];
  const sleepValues=sleepPairs.map(x=>x.records[0].value),avgSleep=sleepValues.length?sleepValues.reduce((a,b)=>a+b,0)/sleepValues.length:null;
  const failures=[wf?'Treinos':null,bf?'Composição corporal':null,nf?'Alimentação':null,mf?'Métricas confirmadas':null,sf?'Registros de sono por origem':null,lf?'Exames':null].filter(Boolean);
  const narrative=[];
  if(!wf)narrative.push(`${wPeriod.length} sessão(ões) de treino registrada(s)`);
  if(!nf)narrative.push(`${unique(nPeriod.map(n=>day(n.nutrition_date))).length} dia(s) com alimentação`);
  if(!mf&&sleepDays.length)narrative.push(`${sleepDays.length} dia(s) com sono confirmado`);
  else if(!sf&&pendingSleepDays.length)narrative.push(`${pendingSleepDays.length} dia(s) com sono registrado, ainda em validação`);
  else if(!mf&&!sf)narrative.push('nenhum registro de sono encontrado no período');
  if(!lf)narrative.push(`${labDates.length} data(s) de exames`);
  const gaps=[];
  if(!lf&&allLabDates.length<2)gaps.push('Exames: há resultados de uma única data de coleta, então ainda não existe uma segunda data para comparar a evolução dos marcadores.');
  if(!mf&&ambiguousSleepPairs.length)gaps.push(`Sono: ${ambiguousSleepPairs.length} treino(s) têm mais de um registro confirmado na noite anterior; esses casos ficam fora da média para evitar combinar fontes sem uma regra validada.`);
  if(!sf&&pendingSleepDays.length)gaps.push(`Sono: há ${pendingSleepDays.length} dia(s) com registros preservados por origem aguardando validação. Eles contam como dados existentes, mas ainda não entram em médias ou relações com treino.`);
  if(!mf&&!sf&&missingSleepPairs.length)gaps.push(`Sono: ${missingSleepPairs.length} treino(s) do período não têm registro de duração de sono na noite anterior, nem confirmado nem aguardando validação.`);
  if(!nf&&wPeriod.length&&matchedWorkoutCount<wPeriod.length)gaps.push(`Alimentação: ${matchedWorkoutCount} de ${wPeriod.length} treino(s) do período têm registro de alimentação no mesmo dia.`);
  if(!bf&&bodyPeriod.length<2)gaps.push(`Composição corporal: há ${bodyPeriod.length} medição(ões) dentro de ${periodText}; a comparação corporal abaixo usa as duas últimas medições disponíveis no histórico completo.`);

  const sleepMetricValue=mf?'—':sleepDays.length?String(sleepDays.length):sf?'—':String(pendingSleepDays.length);
  const sleepMetricSub=mf?'dados confirmados indisponíveis agora':sleepDays.length?`${rangeOf(metricPeriod.filter(m=>m.metric_type==='sleep_duration_h'),'measured_at')} · confirmados`:sf?'registros por origem indisponíveis agora':pendingSleepDays.length?'registros existentes, ainda fora das médias':'nenhum registro encontrado no período';
  const sleepCoverageValue=mf&&sf?'indisponível':sleepDays.length?`${sleepDays.length} dia(s) confirmados`:pendingSleepDays.length?`${pendingSleepDays.length} dia(s) em validação`:'sem registros no período';
  const sleepCoverageDetail=mf&&sf?'tente atualizar':sleepDays.length?rangeOf(metricPeriod.filter(m=>m.metric_type==='sleep_duration_h'),'measured_at'):pendingSleepDays.length?`${fmtDate(pendingSleepDays[0])} → ${fmtDate(pendingSleepDays.at(-1))} · não usados em médias`:'nenhum registro encontrado';
  const sleepPairBody=wf||mf||sf?unavailable('Treinos ou registros de sono não carregaram por completo; o pareamento não pode ser calculado agora.'):`<div class="analysisPair"><strong>${sleepPairs.length}</strong><div><b>treinos com sono confirmado comparável</b><small>${avgSleep==null?(pendingSleepPairs.length?`${pendingSleepPairs.length} treino(s) têm sono registrado aguardando validação`:'sem pares confirmados suficientes'):`média registrada ${fmtNum(avgSleep)} h nas noites comparáveis`}</small></div></div>${pendingSleepPairs.length?`<div class="note"><b>${pendingSleepPairs.length} noite(s) têm registro de sono aguardando validação.</b><span>Esses registros existem e ficam visíveis como cobertura, mas não entram na média até a origem ser validada.</span></div>`:''}<p class="footerNote">Fontes sobrepostas não são somadas nem escolhidas automaticamente.</p>`;

  return `${title('Análise','Uma leitura do seu histórico disponível. Registros ainda em validação aparecem como existentes, mas ficam fora de médias e comparações até serem confirmados.')}
    <div class="controls"><select id="analysisPeriod"><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="all">Todo histórico</option></select></div>
    ${failures.length?`<div class="errorState sectionGap"><b>Algumas partes não carregaram agora.</b><span>Não foi possível carregar: ${esc(failures.join(', '))}. Os demais resultados continuam disponíveis.</span></div>`:''}
    <div class="analysisNarrative sectionGap"><span>Resumo observado · ${esc(periodText)}</span><b>${narrative.length?esc(narrative.join(' · ')):'Ainda não há áreas suficientes carregadas para resumir o período.'}</b><small>As contagens refletem somente registros existentes; dados em validação são identificados separadamente.</small></div>
    <div class="grid cols4 sectionGap">
      ${metric(`Treinos · ${periodText}`,wf?'—':String(wPeriod.length),wf?'dados indisponíveis agora':rangeOf(wPeriod,'workout_date'))}
      ${metric(`Alimentação · ${periodText}`,nf?'—':String(unique(nPeriod.map(n=>day(n.nutrition_date))).length),nf?'dados indisponíveis agora':rangeOf(nPeriod,'nutrition_date'))}
      ${metric(`Sono registrado · ${periodText}`,sleepMetricValue,sleepMetricSub)}
      ${metric(`Datas de exames · ${periodText}`,lf?'—':String(labDates.length),lf?'dados indisponíveis agora':rangeOf(labPeriod,'collection_date'))}
    </div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Treino × alimentação</b><small>Dias em que os dois registros existem dentro de ${esc(periodText)}.</small></div></div>${wf||nf?unavailable('Treinos ou alimentação não carregaram; o cruzamento não pode ser calculado agora.'):`<div class="analysisPair"><strong>${sameDay.length}</strong><div><b>dias em comum</b><small>${wPeriod.length?`${Math.round(matchedWorkoutCount/wPeriod.length*100)}% das sessões do período têm alimentação registrada no mesmo dia`:'não há sessões registradas no período'}</small></div></div><p class="footerNote">Isso mede cobertura de dados, não efeito da alimentação sobre o treino.</p>`}</div>
      <div class="card"><div class="cardHead"><div><b>Sono antes do treino</b><small>Usa apenas noites com um único registro de sono já confirmado.</small></div></div>${sleepPairBody}</div>
    </div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Entre as duas últimas medições corporais</b><small>${bf?'Medições corporais indisponíveis agora.':`Contexto registrado entre ${prev?fmtDate(prev.measured_at):'—'} e ${last?fmtDate(last.measured_at):'—'}.`}</small></div></div>${bf?unavailable('As medições corporais não carregaram; este contexto não pode ser montado agora.'):last&&prev?`<div class="grid cols4 compact">${metric('Peso',neutralDelta(last.weight_kg,prev.weight_kg,1,'kg'))}${metric('Massa muscular',neutralDelta(last.skeletal_muscle_mass_kg,prev.skeletal_muscle_mass_kg,1,'kg'))}${metric('Treinos',wf?'—':String(between.length),wf?'dados indisponíveis':'no intervalo')}${metric('Alimentação',nf?'—':String(betweenNutrition.length),nf?'dados indisponíveis':'dias registrados')}</div><p class="footerNote">As mudanças corporais e os registros do intervalo aparecem juntos para contexto; o app não atribui causalidade entre eles.</p>`:empty('São necessárias pelo menos duas medições corporais para montar este contexto.')}</div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Cobertura dos dados</b><small>O que está disponível para consulta no período selecionado.</small></div></div><div class="evidenceList">${evidenceRow('Composição corporal',bf?'indisponível':`${bodyPeriod.length} medição(ões)`,bf?'tente atualizar':rangeOf(bodyPeriod,'measured_at'))}${evidenceRow('Treinos',wf?'indisponíveis':`${wPeriod.length} sessão(ões)`,wf?'tente atualizar':rangeOf(wPeriod,'workout_date'))}${evidenceRow('Alimentação',nf?'indisponível':`${unique(nPeriod.map(n=>day(n.nutrition_date))).length} dia(s)`,nf?'tente atualizar':rangeOf(nPeriod,'nutrition_date'))}${evidenceRow('Sono',sleepCoverageValue,sleepCoverageDetail)}${evidenceRow('Exames',lf?'indisponíveis':`${labDates.length} data(s) de coleta`,lf?'tente atualizar':rangeOf(labPeriod,'collection_date'))}</div></div>
      <div class="card"><div class="cardHead"><div><b>O que ainda limita a análise</b><small>Lacunas ou registros em validação que reduzem o que pode ser comparado com segurança.</small></div></div><div class="limitationList">${gaps.map(g=>`<div>${esc(g)}</div>`).join('')||'<div>Não há uma limitação adicional identificada pelos critérios desta tela no período selecionado.</div>'}</div><p class="footerNote">Nenhuma lacuna é preenchida por estimativa e nenhuma coincidência temporal é usada para afirmar causalidade.</p></div>
    </div>`;
}
