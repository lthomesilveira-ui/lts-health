import {state,esc,day,fmtDate,fmtNum,num,unique,bodyRows,workoutRows,neutralDelta,since} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const metric=(label,value,sub='')=>`<div class="card metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<em>${esc(sub)}</em>`:''}</div>`;
const empty=text=>`<div class="empty">${esc(text)}</div>`;

function sleepByDay(){
  const map=new Map();for(const m of state.data.metrics||[]){if(m.metric_type!=='sleep_duration_h')continue;const d=day(m.measured_at),v=num(m.value);if(!d||v==null)continue;if(!map.has(d))map.set(d,[]);map.get(d).push(v);}return map;
}
function prevDay(date){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);}
function periodRows(rows,key,days=90){const cut=since(days);return rows.filter(r=>day(r[key])>=cut);}

export function renderAnalysisHub(){
  const workouts=workoutRows(),body=bodyRows(),nutrition=state.data.nutrition||[],labs=state.data.labs||[],metrics=state.data.metrics||[];
  const w90=periodRows(workouts,'workout_date'),n90=periodRows(nutrition,'nutrition_date'),sleep=sleepByDay(),sleep90=[...sleep.keys()].filter(d=>d>=since(90));
  const nutritionDays=new Set(n90.map(n=>day(n.nutrition_date))),workoutDays=new Set(w90.map(w=>day(w.workout_date))),sameDay=[...workoutDays].filter(d=>nutritionDays.has(d));
  const sleepPairs=w90.map(w=>({workout:w,night:prevDay(day(w.workout_date)),values:sleep.get(prevDay(day(w.workout_date)))||[]})).filter(x=>x.values.length);
  const labDates=unique(labs.map(l=>l.collection_date)),last=body.at(-1),prev=body.at(-2);
  const between=last&&prev?workouts.filter(w=>day(w.workout_date)>day(prev.measured_at)&&day(w.workout_date)<=day(last.measured_at)):[];
  const betweenNutrition=last&&prev?unique(nutrition.filter(n=>day(n.nutrition_date)>day(prev.measured_at)&&day(n.nutrition_date)<=day(last.measured_at)).map(n=>day(n.nutrition_date))):[];
  const avgSleep=sleepPairs.length?sleepPairs.flatMap(x=>x.values).reduce((a,b)=>a+b,0)/sleepPairs.flatMap(x=>x.values).length:null;
  return `${title('Análise','Cruza apenas registros disponíveis. Coincidência temporal não é tratada como causa e efeito.')}
    <div class="grid cols4">
      ${metric('Treinos · 90 dias',String(w90.length),'sessões registradas')}
      ${metric('Alimentação · 90 dias',String(unique(n90.map(n=>day(n.nutrition_date))).length),'dias com registro')}
      ${metric('Sono · 90 dias',String(sleep90.length),'dias disponíveis')}
      ${metric('Coletas laboratoriais',String(labDates.length),'datas estruturadas')}
    </div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Treino × alimentação</b><small>Dias em que os dois registros existem.</small></div></div><div class="analysisPair"><strong>${sameDay.length}</strong><div><b>dias em comum</b><small>${w90.length?`${Math.round(sameDay.length/w90.length*100)}% das sessões do período têm alimentação registrada no mesmo dia`:''}</small></div></div><p class="footerNote">Isso mede cobertura de dados, não efeito da alimentação sobre o treino.</p></div>
      <div class="card"><div class="cardHead"><div><b>Sono antes do treino</b><small>Noite anterior com duração de sono registrada.</small></div></div><div class="analysisPair"><strong>${sleepPairs.length}</strong><div><b>treinos com sono pareado</b><small>${avgSleep==null?'sem pares suficientes':`média registrada ${fmtNum(avgSleep)} h nas noites pareadas`}</small></div></div><p class="footerNote">A média é descritiva e não é uma meta ou nota de recuperação.</p></div>
    </div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Entre as duas últimas bios</b><small>Contexto registrado entre ${prev?fmtDate(prev.measured_at):'—'} e ${last?fmtDate(last.measured_at):'—'}.</small></div></div>${last&&prev?`<div class="grid cols4 compact">${metric('Peso',neutralDelta(last.weight_kg,prev.weight_kg,1,'kg'))}${metric('MME',neutralDelta(last.skeletal_muscle_mass_kg,prev.skeletal_muscle_mass_kg,1,'kg'))}${metric('Treinos',String(between.length),'no intervalo')}${metric('Alimentação',String(betweenNutrition.length),'dias registrados')}</div><p class="footerNote">As mudanças corporais e os registros do intervalo aparecem juntos para contexto; o app não atribui causalidade entre eles.</p>`:empty('São necessárias pelo menos duas medições corporais para montar este contexto.')}</div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Já há base para acompanhar</b></div></div><div class="quickList"><div><span>Composição</span><b>${body.length} medições</b><small>comparação entre datas disponível</small></div><div><span>Treinos</span><b>${workouts.length} sessões</b><small>exercícios e séries quando estruturados</small></div><div><span>Alimentação</span><b>${nutrition.length} dias</b><small>histórico importado disponível</small></div></div></div>
      <div class="card"><div class="cardHead"><div><b>Ainda limitado</b></div></div><div class="quickList"><div><span>Exames</span><b>${labDates.length===1?'1 coleta estruturada':`${labDates.length} coletas`}</b><small>${labDates.length<2?'novas coletas são necessárias para tendência laboratorial':'há datas para comparação longitudinal'}</small></div><div><span>Sono e atividade</span><b>${metrics.length?'dados parciais':'ainda sem importação contínua'}</b><small>a cobertura depende das fontes já enviadas</small></div></div></div>
    </div>`;
}
