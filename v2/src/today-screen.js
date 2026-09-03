import {state,esc,day,fmtDate,fmtNum,num,unique} from './core.js';
import {buildIntegratedAnalysis} from './integrated-analysis.js';

const failed=key=>state.domainStatus?.[key]==='error'||!!state.errors?.[key];
const action=(route,label)=>`<button class="todayAction" data-route="${esc(route)}">${esc(label)}</button>`;
const routeCard=(route,label,value,detail,status='')=>`<button class="dashboardCurrent cockpitMetric ${status}" data-route="${esc(route)}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(detail)}</small><i>→</i></button>`;
const noteCard=(label,title,body,route)=>`<article class="dashboardInsight"><span>${esc(label)}</span><h3>${esc(title)}</h3><p>${esc(body)}</p>${route?`<button data-route="${esc(route)}">Abrir →</button>`:''}</article>`;

function dateRows(rows,dateKey){
  const map=new Map();
  for(const row of rows||[]){const d=day(row?.[dateKey]);if(!d)continue;if(!map.has(d))map.set(d,[]);map.get(d).push(row);}
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}
function latestSingle(rows,dateKey){
  const groups=dateRows(rows,dateKey);if(!groups.length)return{date:null,row:null,ambiguous:false};
  const [date,items]=groups.at(-1);return{date,row:items.length===1?items[0]:null,ambiguous:items.length>1};
}
function latestBodySnapshot(){return latestSingle(state.data.body||[],'measured_at');}
function distinctCount(rows,key){return unique((rows||[]).map(r=>String(r?.[key]||'').trim()).filter(Boolean)).length;}
function nutritionSafeRows(){return dateRows(state.data.nutrition||[],'nutrition_date').filter(([,items])=>items.length===1).map(([,items])=>items[0]);}
function hydrationRows(){return nutritionSafeRows().map(r=>({date:day(r.nutrition_date),value:num(r.water_ml)})).filter(r=>r.date&&r.value!=null&&r.value>0).sort((a,b)=>a.date.localeCompare(b.date));}
function labStats(){
  const rows=state.data.labs||[],dates=unique(rows.map(r=>day(r.collection_date)).filter(Boolean)).sort();
  return{rows:rows.length,markers:distinctCount(rows,'biomarker'),dates,first:dates[0]||null,last:dates.at(-1)||null};
}
function protocolStats(){
  const events=state.data.treatments||[],contexts=state.data.regimens||[],dates=unique(events.map(r=>day(r.event_date)).filter(Boolean)).sort(),names=unique([...events,...contexts].map(r=>String(r?.medication||'').trim()).filter(Boolean));
  return{events:events.length,contexts:contexts.length,names:names.length,first:dates[0]||null,last:dates.at(-1)||null};
}
function canonicalWorkouts(){return(state.data.workouts||[]).filter(r=>r?.is_canonical===true&&r?.record_status!=='quarantined');}
function weeklyWorkouts(weeks=8){
  const workouts=canonicalWorkouts(),dates=workouts.map(r=>day(r.workout_date)).filter(Boolean).sort(),reference=dates.at(-1)||new Date().toISOString().slice(0,10),ref=new Date(`${reference}T12:00:00Z`),out=[];
  for(let i=weeks-1;i>=0;i--){const end=new Date(ref);end.setDate(ref.getDate()-i*7);const start=new Date(end);start.setDate(end.getDate()-6);const a=start.toISOString().slice(0,10),b=end.toISOString().slice(0,10);out.push({date:b,value:workouts.filter(r=>day(r.workout_date)>=a&&day(r.workout_date)<=b).length});}
  return out;
}
function labCollectionSeries(){
  const map=new Map();for(const row of state.data.labs||[]){const d=day(row.collection_date);if(!d)continue;map.set(d,(map.get(d)||0)+1);}
  return[...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-14).map(([date,value])=>({date,value}));
}
function scaledChart(points,{unit='',digits=0,label='Série histórica',bar=false}={}){
  const rows=(points||[]).filter(p=>p?.date&&num(p?.value)!=null).map(p=>({date:p.date,value:num(p.value)}));
  if(rows.length<2)return`<div class="dashboardChartEmpty">Ainda não há pontos suficientes para este gráfico.</div>`;
  const values=rows.map(r=>r.value),lo=bar?0:Math.min(...values),hi=Math.max(...values),span=Math.max(hi-lo,1),pad=bar?0:span*.12,min=bar?0:lo-pad,max=bar?Math.max(hi,1):hi+pad,w=620,h=170,left=58,right=16,top=16,bottom=28,plotW=w-left-right,plotH=h-top-bottom;
  const x=i=>left+i*plotW/Math.max(1,rows.length-1),y=v=>top+(max-v)*plotH/Math.max(max-min,1e-9);
  const ticks=[max,max-(max-min)/3,max-2*(max-min)/3,min];
  const grid=ticks.map(v=>`<line x1="${left}" y1="${y(v).toFixed(1)}" x2="${w-right}" y2="${y(v).toFixed(1)}"/>`).join('');
  const labels=ticks.map(v=>`<text x="${left-8}" y="${(y(v)+3).toFixed(1)}" text-anchor="end">${esc(fmtNum(v,digits))}${esc(unit)}</text>`).join('');
  let marks='';
  if(bar){const bw=Math.max(6,Math.min(28,plotW/Math.max(rows.length,1)*.55));marks=rows.map((r,i)=>`<rect x="${(x(i)-bw/2).toFixed(1)}" y="${y(r.value).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1,y(min)-y(r.value)).toFixed(1)}" rx="3"><title>${esc(fmtDate(r.date))}: ${esc(fmtNum(r.value,digits))}${esc(unit)}</title></rect>`).join('');}
  else{const path=rows.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(r.value).toFixed(1)}`).join(' ');marks=`<path class="cockpitLine" d="${path}"/>${rows.map((r,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(r.value).toFixed(1)}" r="3.5"><title>${esc(fmtDate(r.date))}: ${esc(fmtNum(r.value,digits))}${esc(unit)}</title></circle>`).join('')}`;}
  return`<div class="cockpitChart" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><g class="cockpitGrid">${grid}</g><g class="cockpitAxisLabels">${labels}</g><g class="cockpitMarks">${marks}</g></svg><div class="cockpitXAxis"><span>${fmtDate(rows[0].date)}</span><span>${fmtDate(rows[Math.floor((rows.length-1)/2)].date)}</span><span>${fmtDate(rows.at(-1).date)}</span></div></div>`;
}
function compositionPanel(model){
  if(failed('body'))return`<article class="dashboardPanel cockpitComposition"><div class="dashboardPanelHead"><div><span>Composição</span><h2>Evolução corporal</h2></div><button data-route="evolucao">Evolução →</button></div><div class="dashboardChartEmpty">As medições corporais não carregaram agora.</div></article>`;
  if(model.trend.reason==='source_changed'&&!model.trend.available)return`<article class="dashboardPanel cockpitComposition"><div class="dashboardPanelHead"><div><span>Composição</span><h2>Evolução corporal</h2></div><button data-route="evolucao">Evolução →</button></div><div class="dashboardChartEmpty"><b>Sem comparação entre origens diferentes.</b><br>A medição mais recente continua preservada; o gráfico volta quando houver dois pontos comparáveis da mesma origem.</div></article>`;
  if(!model.trend.available)return`<article class="dashboardPanel cockpitComposition"><div class="dashboardPanelHead"><div><span>Composição</span><h2>Evolução corporal</h2></div><button data-route="evolucao">Evolução →</button></div><div class="dashboardChartEmpty">Ainda não há duas medições comparáveis da mesma origem.</div></article>`;
  const points=model.trend.points.filter(p=>p.muscleKg!=null).map(p=>({date:p.date,value:p.muscleKg}));
  return`<article class="dashboardPanel cockpitComposition"><div class="dashboardPanelHead"><div><span>Composição</span><h2>Evolução corporal</h2></div><button data-route="evolucao">Evolução →</button></div><div class="cockpitPanelStat"><b>Massa muscular</b><span>${points.length?`${fmtNum(points.at(-1).value,1)} kg · ${fmtDate(points.at(-1).date)}`:'sem pontos comparáveis'}</span></div>${scaledChart(points,{unit:' kg',digits:1,label:'Evolução de massa muscular'})}${model.trend.sourceChanged?'<p class="dashboardFootnote">Uma mudança de origem anterior foi preservada e ficou fora desta série.</p>':''}</article>`;
}
function hydrationPanel(){
  if(failed('nutrition'))return`<section class="dashboardPanel"><div class="dashboardPanelHead"><div><span>Hidratação</span><h2>Água registrada</h2></div><button data-route="nutricao">Nutrição →</button></div><div class="dashboardChartEmpty">Os dados de alimentação não carregaram agora.</div></section>`;
  const rows=hydrationRows();
  if(!rows.length)return`<section class="dashboardPanel cockpitHydration missing"><div class="dashboardPanelHead"><div><span>Hidratação</span><h2>Água registrada</h2></div><button data-route="nutricao">Nutrição →</button></div><div class="cockpitMissing"><b>Nenhum registro de água foi importado.</b><p>O histórico do MyFitnessPal está no LTS Health, mas os registros atuais de nutrição não trazem volume de água. O app não estima nem preenche esse campo.</p></div></section>`;
  const latest=rows.at(-1),last=rows.slice(-30),avg=last.reduce((s,r)=>s+r.value,0)/last.length;
  return`<section class="dashboardPanel cockpitHydration"><div class="dashboardPanelHead"><div><span>Hidratação</span><h2>Água registrada</h2></div><button data-route="nutricao">Nutrição →</button></div><div class="cockpitPanelStat"><b>${fmtNum(latest.value,0)} mL</b><span>${fmtDate(latest.date)} · média dos últimos ${last.length} registros: ${fmtNum(avg,0)} mL/dia</span></div>${scaledChart(last,{unit:' mL',digits:0,label:'Água registrada por dia'})}</section>`;
}
function labPanel(){
  if(failed('labs'))return`<section class="dashboardPanel"><div class="dashboardPanelHead"><div><span>Exames</span><h2>Histórico laboratorial</h2></div><button data-route="saude">Exames →</button></div><div class="dashboardChartEmpty">Os resultados laboratoriais não carregaram agora.</div></section>`;
  const s=labStats(),series=labCollectionSeries();
  if(!s.rows)return`<section class="dashboardPanel"><div class="dashboardPanelHead"><div><span>Exames</span><h2>Histórico laboratorial</h2></div><button data-route="saude">Exames →</button></div><div class="dashboardChartEmpty">Nenhum resultado laboratorial estruturado.</div></section>`;
  return`<section class="dashboardPanel cockpitLabs"><div class="dashboardPanelHead"><div><span>Exames</span><h2>Histórico laboratorial</h2></div><button data-route="saude">Abrir exames →</button></div><div class="cockpitFactGrid"><div><b>${s.rows}</b><span>resultados</span></div><div><b>${s.markers}</b><span>marcadores</span></div><div><b>${s.dates.length}</b><span>datas de coleta</span></div></div>${scaledChart(series,{digits:0,label:'Quantidade de resultados por coleta',bar:true})}<p class="dashboardFootnote">O gráfico mostra quantidade de resultados por coleta, não interpretação clínica. Tendências de cada marcador ficam em Exames.</p></section>`;
}
function trainingPanel(){
  if(failed('workouts'))return`<section class="dashboardPanel"><div class="dashboardPanelHead"><div><span>Treinos</span><h2>Ritmo recente</h2></div><button data-route="treinos">Treinos →</button></div><div class="dashboardChartEmpty">Os treinos não carregaram agora.</div></section>`;
  return`<section class="dashboardPanel cockpitTraining"><div class="dashboardPanelHead"><div><span>Treinos</span><h2>Sessões por semana</h2></div><button data-route="treinos">Abrir treinos →</button></div>${scaledChart(weeklyWorkouts(8),{digits:0,label:'Sessões canônicas por semana',bar:true})}</section>`;
}
function insightCards(model){
  const cards=[],work=weeklyWorkouts(8),labs=labStats(),hydration=hydrationRows(),protocol=protocolStats();
  if(model.body.available&&num(model.body.latest?.skeletal_muscle_mass_kg)!=null&&num(model.body.previous?.skeletal_muscle_mass_kg)!=null){const delta=num(model.body.latest.skeletal_muscle_mass_kg)-num(model.body.previous.skeletal_muscle_mass_kg);cards.push(noteCard('Composição',`Massa muscular: ${fmtNum(model.body.latest.skeletal_muscle_mass_kg,1)} kg`,`Diferença registrada desde ${fmtDate(model.body.previous.measured_at)}: ${delta>=0?'+':''}${fmtNum(delta,1)} kg. Leitura descritiva, sem atribuir causa.`,'evolucao'));}
  else if(model.body.reason==='source_changed')cards.push(noteCard('Composição','Origem de medição mudou','A medição mais recente foi preservada, mas a variação entre origens diferentes não é calculada automaticamente.','bio'));
  const recent=work.slice(-4).reduce((s,r)=>s+r.value,0),prior=work.slice(0,4).reduce((s,r)=>s+r.value,0);cards.push(noteCard('Treino','Ritmo das últimas 4 semanas',`${recent} sessão(ões) registradas nas 4 semanas mais recentes versus ${prior} nas 4 anteriores.`,'analise'));
  if(labs.rows)cards.push(noteCard('Exames',`${labs.rows} resultados estruturados`,`${labs.markers} marcador(es) em ${labs.dates.length} data(s) de coleta, de ${fmtDate(labs.first)} a ${fmtDate(labs.last)}.`,'saude'));
  cards.push(hydration.length?noteCard('Hidratação',`${hydration.length} dia(s) com água registrada`,`Último registro em ${fmtDate(hydration.at(-1).date)}. Abra Nutrição para consultar o histórico.`,'nutricao'):noteCard('Hidratação','Cobertura ainda ausente','Nenhum dia tem água estruturada no histórico nutricional atual. O app mantém essa lacuna explícita em vez de estimar consumo.','nutricao'));
  if(protocol.contexts||protocol.events)cards.push(noteCard('Protocolos',`${protocol.contexts} cadastro(s) de contexto + ${protocol.events} evento(s) histórico(s)`,`${protocol.names} item(ns) distintos preservados. ${protocol.last?`Último evento em ${fmtDate(protocol.last)}.`:'Ainda não há evento histórico datado.'} Situação atual não inferida.`,'tratamentos'));
  return cards.slice(0,6).join('');
}

export function renderTodayHub(){
  const model=buildIntegratedAnalysis(state.data,state.domainStatus),body=latestBodySnapshot(),workout=model.training.lastWorkout,nutrition={date:model.lastNutritionDate,row:model.lastNutrition,ambiguous:model.nutritionLatestAmbiguous},labs=labStats(),protocol=protocolStats(),water=hydrationRows(),reference=unique([model.referenceDay,protocol.last,water.at(-1)?.date].filter(Boolean)).sort().at(-1)||null;
  const latestBody=body.row;
  const bodyCard=failed('body')?routeCard('bio','Composição','Indisponível agora','As medições não carregaram.','error'):body.ambiguous?routeCard('bio','Composição','Revisão necessária',`Há mais de uma medição corporal em ${fmtDate(body.date)}; nenhuma foi escolhida como atual.`,'warn'):latestBody&&model.body.reason==='source_changed'?routeCard('bio','Composição',num(latestBody.skeletal_muscle_mass_kg)!=null?`${fmtNum(latestBody.skeletal_muscle_mass_kg,1)} kg de massa muscular`:num(latestBody.weight_kg)!=null?`${fmtNum(latestBody.weight_kg,1)} kg`:'Medição mais recente preservada',`${num(latestBody.body_fat_pct)!=null?`${fmtNum(latestBody.body_fat_pct,1)}% de gordura corporal · `:''}${fmtDate(body.date)} · sem comparação entre origens diferentes`,'warn'):latestBody?routeCard('bio','Composição',num(latestBody.skeletal_muscle_mass_kg)!=null?`${fmtNum(latestBody.skeletal_muscle_mass_kg,1)} kg de massa muscular`:num(latestBody.weight_kg)!=null?`${fmtNum(latestBody.weight_kg,1)} kg`:'Medição disponível',`${num(latestBody.body_fat_pct)!=null?`${fmtNum(latestBody.body_fat_pct,1)}% de gordura corporal · `:''}${fmtDate(body.date)}`):routeCard('bio','Composição','Sem medição','Abra o histórico corporal.');
  const workoutCard=failed('workouts')?routeCard('treinos','Treino','Indisponível agora','O histórico não carregou.','error'):workout?routeCard('treinos','Último treino',workout.workout_type||'Treino registrado',`${fmtDate(workout.workout_date)}${workout.location?` · ${workout.location}`:''}`):routeCard('treinos','Treino','Sem sessão','Nenhum treino canônico disponível.');
  const nutritionCard=failed('nutrition')?routeCard('nutricao','Nutrição','Indisponível agora','Os dados não carregaram.','error'):nutrition.ambiguous?routeCard('nutricao','Nutrição','Revisão necessária',`Mais de um total em ${fmtDate(nutrition.date)}; nenhum foi escolhido como atual.`,'warn'):nutrition.row?routeCard('nutricao','Nutrição',fmtDate(nutrition.date),num(nutrition.row.protein_g)!=null?`${fmtNum(nutrition.row.protein_g,0)} g proteína registrada`:'Total diário disponível'):routeCard('nutricao','Nutrição','Sem registro','Nenhum total diário estruturado.');
  const hydrationCard=failed('nutrition')?routeCard('nutricao','Hidratação','Indisponível agora','Os dados nutricionais não carregaram.','error'):water.length?routeCard('nutricao','Hidratação',`${fmtNum(water.at(-1).value,0)} mL`,`Último registro: ${fmtDate(water.at(-1).date)}`):routeCard('nutricao','Hidratação','Sem água importada','O histórico atual não contém volume de água.','warn');
  const labsCard=failed('labs')?routeCard('saude','Exames','Indisponível agora','Os resultados não carregaram.','error'):labs.rows?routeCard('saude','Exames',`${labs.rows} resultados`,`${labs.markers} marcadores · última coleta ${fmtDate(labs.last)}`):routeCard('saude','Exames','Sem resultados','Nenhum exame estruturado.');
  const protocolReady=state.domainStatus?.treatments==='ready'&&state.domainStatus?.regimens==='ready',protocolFailed=failed('treatments')||failed('regimens'),protocolCard=protocolFailed?routeCard('tratamentos','Protocolos','Indisponível agora','O contexto de protocolos não carregou completamente.','error'):protocolReady&&(protocol.contexts||protocol.events)?routeCard('tratamentos','Protocolos',`${protocol.contexts} cadastro(s) · ${protocol.events} evento(s)`,`${protocol.names} item(ns) distintos${protocol.last?` · último evento ${fmtDate(protocol.last)}`:''}`):protocolReady?routeCard('tratamentos','Protocolos','Sem registros','Nenhum contexto estruturado.'):routeCard('tratamentos','Protocolos','Carregando contexto','Aguardando registros estruturados.');

  return`<div class="dashboardScreen cockpitScreen" data-executive-dashboard>
    <section class="dashboardHeader cockpitHero"><div><span class="dashboardEyebrow">Cockpit LTS Health</span><h1>Seu estado de saúde em uma tela</h1><p>${reference?`Dados estruturados disponíveis até ${fmtDate(reference)}.`:'Ainda sem data de referência.'} Composição, treino, nutrição, hidratação, exames e protocolos ficam lado a lado, com lacunas explícitas e sem preencher dados por estimativa.</p></div><div class="dashboardHeaderActions">${action('analise','Abrir Insights')}${action('dados','Adicionar dados')}</div></section>
    <section class="dashboardCurrentGrid cockpitCurrentGrid">${bodyCard}${workoutCard}${nutritionCard}${hydrationCard}${labsCard}${protocolCard}</section>
    <section class="dashboardSection cockpitSection"><div class="dashboardSectionHead"><div><span>Visão executiva</span><h2>Evolução e cobertura</h2></div><small>Escalas e datas explícitas</small></div><div class="cockpitDashboardGrid">${compositionPanel(model)}${trainingPanel()}${hydrationPanel()}${labPanel()}</div></section>
    <section class="dashboardSection cockpitSection"><div class="dashboardSectionHead"><div><span>Insights</span><h2>Leituras sustentadas pelos dados</h2></div><button class="todayAction" data-route="analise">Ver todos</button></div><div class="dashboardInsightGrid cockpitInsightGrid">${insightCards(model)}</div></section>
    <p class="dashboardFootnote cockpitFooter">O LTS Health organiza e compara registros existentes. Protocolos aparecem apenas como contexto temporal e os exames não recebem interpretação clínica automática.</p>
  </div>`;
}