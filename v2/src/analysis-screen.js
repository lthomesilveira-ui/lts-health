import {state,esc,day,fmtDate,fmtNum,num,unique,bodyRows,workoutRows,neutralDelta,since} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const metric=(label,value,sub='')=>`<div class="card metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<em>${esc(sub)}</em>`:''}</div>`;
const empty=text=>`<div class="empty">${esc(text)}</div>`;
const failed=key=>state.domainStatus[key]==='error';
const unavailable=text=>`<div class="errorState"><b>${esc(text)}</b><span>Esta análise não usa zero como substituto para dados que não carregaram. Tente atualizar.</span></div>`;

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
function prevDay(date){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);}
function filterPeriod(rows,key,period){if(period==='all')return rows;const cut=since(Number(period));return rows.filter(r=>day(r[key])>=cut);}
function periodLabel(period){return period==='30'?'30 dias':period==='90'?'90 dias':period==='365'?'1 ano':'todo o histórico';}
function rangeOf(rows,key){const dates=rows.map(r=>day(r[key])).filter(Boolean).sort();return dates.length?`${fmtDate(dates[0])} → ${fmtDate(dates.at(-1))}`:'sem registros';}
function evidenceRow(label,value,detail){return`<div class="evidenceRow"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(detail)}</small></div>`;}

export function renderAnalysisHub(){
  const wf=failed('workouts'),bf=failed('body'),nf=failed('nutrition'),lf=failed('labs'),mf=failed('metrics');
  const workouts=wf?[]:workoutRows(),body=bf?[]:bodyRows(),nutrition=nf?[]:(state.data.nutrition||[]),labs=lf?[]:(state.data.labs||[]),metrics=mf?[]:(state.data.metrics||[]);
  const period=state.ui.analysisPeriod||'90',periodText=periodLabel(period);
  const wPeriod=filterPeriod(workouts,'workout_date',period),nPeriod=filterPeriod(nutrition,'nutrition_date',period),labPeriod=filterPeriod(labs,'collection_date',period),metricPeriod=filterPeriod(metrics,'measured_at',period),bodyPeriod=filterPeriod(body,'measured_at',period);
  const sleep=sleepByDay(),sleepDays=unique(metricPeriod.filter(m=>m.metric_type==='sleep_duration_h').map(m=>day(m.measured_at)));
  const nutritionDays=new Set(nPeriod.map(n=>day(n.nutrition_date))),workoutDays=new Set(wPeriod.map(w=>day(w.workout_date))),sameDay=[...workoutDays].filter(d=>nutritionDays.has(d));
  const sleepCandidates=wPeriod.map(w=>({workout:w,night:prevDay(day(w.workout_date)),records:sleep.get(prevDay(day(w.workout_date)))||[]}));
  const sleepPairs=sleepCandidates.filter(x=>x.records.length===1);
  const ambiguousSleepPairs=sleepCandidates.filter(x=>x.records.length>1);
  const missingSleepPairs=sleepCandidates.filter(x=>x.records.length===0);
  const labDates=unique(labPeriod.map(l=>l.collection_date)),allLabDates=unique(labs.map(l=>l.collection_date)),last=body.at(-1),prev=body.at(-2);
  const between=last&&prev&&!wf?workouts.filter(w=>day(w.workout_date)>day(prev.measured_at)&&day(w.workout_date)<=day(last.measured_at)):[];
  const betweenNutrition=last&&prev&&!nf?unique(nutrition.filter(n=>day(n.nutrition_date)>day(prev.measured_at)&&day(n.nutrition_date)<=day(last.measured_at)).map(n=>day(n.nutrition_date))):[];
  const sleepValues=sleepPairs.map(x=>x.records[0].value),avgSleep=sleepValues.length?sleepValues.reduce((a,b)=>a+b,0)/sleepValues.length:null;
  const failures=[wf?'Treinos':null,bf?'Bio':null,nf?'Alimentação':null,mf?'Sono e métricas':null,lf?'Exames':null].filter(Boolean);
  const narrative=[];
  if(!wf)narrative.push(`${wPeriod.length} sessão(ões) de treino registrada(s)`);
  if(!nf)narrative.push(`${unique(nPeriod.map(n=>day(n.nutrition_date))).length} dia(s) com alimentação`);
  if(!mf)narrative.push(`${sleepDays.length} dia(s) com duração de sono`);
  if(!lf)narrative.push(`${labDates.length} coleta(s) laboratorial(is)`);
  const gaps=[];
  if(!lf&&allLabDates.length<2)gaps.push('Exames: há menos de duas coletas estruturadas, então a comparação longitudinal de biomarcadores ainda é limitada.');
  if(!mf&&ambiguousSleepPairs.length)gaps.push(`Sono: ${ambiguousSleepPairs.length} treino(s) têm mais de um registro de sono na noite anterior; esses casos ficam fora da média até existir uma regra validada de seleção entre fontes.`);
  if(!mf&&missingSleepPairs.length)gaps.push(`Sono: ${missingSleepPairs.length} treino(s) do período não têm duração de sono registrada na noite anterior.`);
  if(!nf&&wPeriod.length&&sameDay.length<wPeriod.length)gaps.push(`Alimentação: ${sameDay.length} de ${wPeriod.length} treino(s) do período têm registro de alimentação no mesmo dia.`);
  if(!bf&&bodyPeriod.length<2)gaps.push(`Composição: há ${bodyPeriod.length} medição(ões) corporal(is) dentro de ${periodText}; comparações corporais abaixo usam as duas últimas medições disponíveis no histórico completo.`);

  return `${title('Análise','Uma leitura longitudinal dos registros disponíveis. Relações temporais são contexto, não prova de causa e efeito.')}
    <div class="controls"><select id="analysisPeriod"><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="all">Todo histórico</option></select></div>
    ${failures.length?`<div class="errorState sectionGap"><b>Algumas análises estão incompletas agora.</b><span>Não foi possível carregar: ${esc(failures.join(', '))}. Os demais resultados continuam disponíveis.</span></div>`:''}
    <div class="analysisNarrative sectionGap"><span>Resumo observado · ${esc(periodText)}</span><b>${narrative.length?esc(narrative.join(' · ')):'Ainda não há domínios suficientes carregados para resumir o período.'}</b><small>As contagens refletem somente registros existentes nas fontes carregadas.</small></div>
    <div class="grid cols4 sectionGap">
      ${metric(`Treinos · ${periodText}`,wf?'—':String(wPeriod.length),wf?'dados indisponíveis agora':rangeOf(wPeriod,'workout_date'))}
      ${metric(`Alimentação · ${periodText}`,nf?'—':String(unique(nPeriod.map(n=>day(n.nutrition_date))).length),nf?'dados indisponíveis agora':rangeOf(nPeriod,'nutrition_date'))}
      ${metric(`Sono · ${periodText}`,mf?'—':String(sleepDays.length),mf?'dados indisponíveis agora':rangeOf(metricPeriod.filter(m=>m.metric_type==='sleep_duration_h'),'measured_at'))}
      ${metric(`Coletas · ${periodText}`,lf?'—':String(labDates.length),lf?'dados indisponíveis agora':rangeOf(labPeriod,'collection_date'))}
    </div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Treino × alimentação</b><small>Dias em que os dois registros existem dentro de ${esc(periodText)}.</small></div></div>${wf||nf?unavailable('Treinos ou alimentação não carregaram; o cruzamento não pode ser calculado agora.'):`<div class="analysisPair"><strong>${sameDay.length}</strong><div><b>dias em comum</b><small>${wPeriod.length?`${Math.round(sameDay.length/wPeriod.length*100)}% das sessões do período têm alimentação registrada no mesmo dia`:'não há sessões registradas no período'}</small></div></div><p class="footerNote">Isso mede cobertura de dados, não efeito da alimentação sobre o treino.</p>`}</div>
      <div class="card"><div class="cardHead"><div><b>Sono antes do treino</b><small>Noite anterior com um único registro estruturado de duração de sono.</small></div></div>${wf||mf?unavailable('Treinos ou sono não carregaram; o pareamento não pode ser calculado agora.'):`<div class="analysisPair"><strong>${sleepPairs.length}</strong><div><b>treinos com sono comparável</b><small>${avgSleep==null?'sem pares suficientes':`média registrada ${fmtNum(avgSleep)} h nas noites comparáveis`}</small></div></div><p class="footerNote">Noites com mais de um registro de sono ficam fora da média para evitar combinar fontes sobrepostas por suposição.</p>`}</div>
    </div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Entre as duas últimas bios</b><small>${bf?'Medições corporais indisponíveis agora.':`Contexto registrado entre ${prev?fmtDate(prev.measured_at):'—'} e ${last?fmtDate(last.measured_at):'—'}.`}</small></div></div>${bf?unavailable('As medições corporais não carregaram; este contexto não pode ser montado agora.'):last&&prev?`<div class="grid cols4 compact">${metric('Peso',neutralDelta(last.weight_kg,prev.weight_kg,1,'kg'))}${metric('MME',neutralDelta(last.skeletal_muscle_mass_kg,prev.skeletal_muscle_mass_kg,1,'kg'))}${metric('Treinos',wf?'—':String(between.length),wf?'dados indisponíveis':'no intervalo')}${metric('Alimentação',nf?'—':String(betweenNutrition.length),nf?'dados indisponíveis':'dias registrados')}</div><p class="footerNote">As mudanças corporais e os registros do intervalo aparecem juntos para contexto; o app não atribui causalidade entre eles.</p>`:empty('São necessárias pelo menos duas medições corporais para montar este contexto.')}</div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Cobertura por domínio</b><small>O que está disponível para cruzar no período selecionado.</small></div></div><div class="evidenceList">${evidenceRow('Composição',bf?'indisponível':`${bodyPeriod.length} medição(ões)`,bf?'tente atualizar':rangeOf(bodyPeriod,'measured_at'))}${evidenceRow('Treinos',wf?'indisponíveis':`${wPeriod.length} sessão(ões)`,wf?'tente atualizar':rangeOf(wPeriod,'workout_date'))}${evidenceRow('Alimentação',nf?'indisponível':`${unique(nPeriod.map(n=>day(n.nutrition_date))).length} dia(s)`,nf?'tente atualizar':rangeOf(nPeriod,'nutrition_date'))}${evidenceRow('Sono',mf?'indisponível':`${sleepDays.length} dia(s)`,mf?'tente atualizar':rangeOf(metricPeriod.filter(m=>m.metric_type==='sleep_duration_h'),'measured_at'))}${evidenceRow('Exames',lf?'indisponíveis':`${labDates.length} coleta(s)`,lf?'tente atualizar':rangeOf(labPeriod,'collection_date'))}</div></div>
      <div class="card"><div class="cardHead"><div><b>Limitações desta leitura</b><small>Lacunas que reduzem o que pode ser comparado com segurança.</small></div></div><div class="limitationList">${gaps.map(g=>`<div>${esc(g)}</div>`).join('')||'<div>Não há uma lacuna adicional identificada pelos critérios desta tela no período selecionado.</div>'}</div><p class="footerNote">Nenhuma lacuna é preenchida por estimativa e nenhuma coincidência temporal é usada para afirmar causalidade.</p></div>
    </div>`;
}
