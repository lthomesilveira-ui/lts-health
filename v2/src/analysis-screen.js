import {state,esc,day,fmtDate,fmtNum,num,unique,bodyRows,workoutRows,neutralDelta,since} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const metric=(label,value,sub='')=>`<div class="card metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<em>${esc(sub)}</em>`:''}</div>`;
const empty=text=>`<div class="empty">${esc(text)}</div>`;
const failed=key=>state.domainStatus[key]==='error';
const unavailable=text=>`<div class="errorState"><b>${esc(text)}</b><span>Esta análise não usa zero como substituto para dados que não carregaram. Tente atualizar.</span></div>`;

function sleepByDay(){
  const map=new Map();if(failed('metrics'))return map;for(const m of state.data.metrics||[]){if(m.metric_type!=='sleep_duration_h')continue;const d=day(m.measured_at),v=num(m.value);if(!d||v==null)continue;if(!map.has(d))map.set(d,[]);map.get(d).push(v);}return map;
}
function prevDay(date){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);}
function periodRows(rows,key,days=90){const cut=since(days);return rows.filter(r=>day(r[key])>=cut);}
function safeCount(key,count,sub){return metric(key,sub?'—':String(count),sub||'');}

export function renderAnalysisHub(){
  const wf=failed('workouts'),bf=failed('body'),nf=failed('nutrition'),lf=failed('labs'),mf=failed('metrics');
  const workouts=wf?[]:workoutRows(),body=bf?[]:bodyRows(),nutrition=nf?[]:(state.data.nutrition||[]),labs=lf?[]:(state.data.labs||[]),metrics=mf?[]:(state.data.metrics||[]);
  const w90=periodRows(workouts,'workout_date'),n90=periodRows(nutrition,'nutrition_date'),sleep=sleepByDay(),sleep90=[...sleep.keys()].filter(d=>d>=since(90));
  const nutritionDays=new Set(n90.map(n=>day(n.nutrition_date))),workoutDays=new Set(w90.map(w=>day(w.workout_date))),sameDay=[...workoutDays].filter(d=>nutritionDays.has(d));
  const sleepPairs=w90.map(w=>({workout:w,night:prevDay(day(w.workout_date)),values:sleep.get(prevDay(day(w.workout_date)))||[]})).filter(x=>x.values.length);
  const labDates=unique(labs.map(l=>l.collection_date)),last=body.at(-1),prev=body.at(-2);
  const between=last&&prev&&!wf?workouts.filter(w=>day(w.workout_date)>day(prev.measured_at)&&day(w.workout_date)<=day(last.measured_at)):[];
  const betweenNutrition=last&&prev&&!nf?unique(nutrition.filter(n=>day(n.nutrition_date)>day(prev.measured_at)&&day(n.nutrition_date)<=day(last.measured_at)).map(n=>day(n.nutrition_date))):[];
  const sleepValues=sleepPairs.flatMap(x=>x.values),avgSleep=sleepValues.length?sleepValues.reduce((a,b)=>a+b,0)/sleepValues.length:null;
  const failures=[wf?'Treinos':null,bf?'Bio':null,nf?'Alimentação':null,mf?'Sono e métricas':null,lf?'Exames':null].filter(Boolean);
  return `${title('Análise','Cruza apenas registros disponíveis. Coincidência temporal não é tratada como causa e efeito.')}
    ${failures.length?`<div class="errorState"><b>Algumas análises estão incompletas agora.</b><span>Não foi possível carregar: ${esc(failures.join(', '))}. Os demais resultados continuam disponíveis.</span></div>`:''}
    <div class="grid cols4 sectionGap">
      ${metric('Treinos · 90 dias',wf?'—':String(w90.length),wf?'dados indisponíveis agora':'sessões registradas')}
      ${metric('Alimentação · 90 dias',nf?'—':String(unique(n90.map(n=>day(n.nutrition_date))).length),nf?'dados indisponíveis agora':'dias com registro')}
      ${metric('Sono · 90 dias',mf?'—':String(sleep90.length),mf?'dados indisponíveis agora':'dias disponíveis')}
      ${metric('Coletas laboratoriais',lf?'—':String(labDates.length),lf?'dados indisponíveis agora':'datas estruturadas')}
    </div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Treino × alimentação</b><small>Dias em que os dois registros existem.</small></div></div>${wf||nf?unavailable('Treinos ou alimentação não carregaram; o cruzamento não pode ser calculado agora.'):`<div class="analysisPair"><strong>${sameDay.length}</strong><div><b>dias em comum</b><small>${w90.length?`${Math.round(sameDay.length/w90.length*100)}% das sessões do período têm alimentação registrada no mesmo dia`:'não há sessões registradas no período'}</small></div></div><p class="footerNote">Isso mede cobertura de dados, não efeito da alimentação sobre o treino.</p>`}</div>
      <div class="card"><div class="cardHead"><div><b>Sono antes do treino</b><small>Noite anterior com duração de sono registrada.</small></div></div>${wf||mf?unavailable('Treinos ou sono não carregaram; o pareamento não pode ser calculado agora.'):`<div class="analysisPair"><strong>${sleepPairs.length}</strong><div><b>treinos com sono pareado</b><small>${avgSleep==null?'sem pares suficientes':`média registrada ${fmtNum(avgSleep)} h nas noites pareadas`}</small></div></div><p class="footerNote">A média é descritiva e não é uma meta ou nota de recuperação.</p>`}</div>
    </div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Entre as duas últimas bios</b><small>${bf?'Medições corporais indisponíveis agora.':`Contexto registrado entre ${prev?fmtDate(prev.measured_at):'—'} e ${last?fmtDate(last.measured_at):'—'}.`}</small></div></div>${bf?unavailable('As medições corporais não carregaram; este contexto não pode ser montado agora.'):last&&prev?`<div class="grid cols4 compact">${metric('Peso',neutralDelta(last.weight_kg,prev.weight_kg,1,'kg'))}${metric('MME',neutralDelta(last.skeletal_muscle_mass_kg,prev.skeletal_muscle_mass_kg,1,'kg'))}${metric('Treinos',wf?'—':String(between.length),wf?'dados indisponíveis':'no intervalo')}${metric('Alimentação',nf?'—':String(betweenNutrition.length),nf?'dados indisponíveis':'dias registrados')}</div><p class="footerNote">As mudanças corporais e os registros do intervalo aparecem juntos para contexto; o app não atribui causalidade entre eles.</p>`:empty('São necessárias pelo menos duas medições corporais para montar este contexto.')}</div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Dados disponíveis para acompanhar</b></div></div><div class="quickList"><div><span>Composição</span><b>${bf?'indisponível agora':`${body.length} medições`}</b><small>${bf?'tente atualizar':'comparação entre datas disponível'}</small></div><div><span>Treinos</span><b>${wf?'indisponíveis agora':`${workouts.length} sessões`}</b><small>${wf?'tente atualizar':'exercícios e séries quando estruturados'}</small></div><div><span>Alimentação</span><b>${nf?'indisponível agora':`${nutrition.length} dias`}</b><small>${nf?'tente atualizar':'histórico importado disponível'}</small></div></div></div>
      <div class="card"><div class="cardHead"><div><b>Cobertura ainda limitada</b></div></div><div class="quickList"><div><span>Exames</span><b>${lf?'indisponíveis agora':labDates.length===1?'1 coleta estruturada':`${labDates.length} coletas`}</b><small>${lf?'tente atualizar':labDates.length<2?'novas coletas permitem comparação longitudinal':'há datas para comparação longitudinal'}</small></div><div><span>Sono e atividade</span><b>${mf?'indisponíveis agora':metrics.length?'dados parciais':'ainda sem dados importados'}</b><small>${mf?'tente atualizar':'a cobertura depende das fontes já enviadas'}</small></div></div></div>
    </div>`;
}
