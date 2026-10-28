import {esc,fmtDate,fmtNum} from './core.js';

// Presentation only. All readings come from the existing, source-isolated
// dashboard/context models. This module neither loads nor changes health data.
const number=v=>v!=null&&typeof v!=='boolean'&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
const value=(v,unit='',digits=0)=>number(v)==null?'—':`${fmtNum(v,digits)}${unit?' '+unit:''}`;
const date=v=>v?fmtDate(v):'Sem data';
const count=(n,one,many)=>`${n} ${n===1?one:many}`;
const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>';
const glyphs={body:'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4M8 10l-3 6m11-6 3 6M9 9h6l-1 7 2 6m-6-6-2 6m4-6v6',training:'M3 8v8m3-11v14m12-14v14m3-11v8M6 12h12',nutrition:'M12 8c-7-5-11 3-7 11 2 4 5 3 7 2 2 1 5 2 7-2 4-8 0-16-7-11m0-2c0-3 2-4 4-4',sleep:'M19 15A9 9 0 0 1 9 3a9 9 0 1 0 10 12',labs:'M9 2h6m-5 0v7L5 18q-2 4 3 4h8q5 0 3-4l-5-9V2M8 15h8',water:'M12 2C9 7 4 11 4 16a8 8 0 0 0 16 0c0-5-5-9-8-14',care:'M6 4h12v18H6zM9 2h6v5H9M9 12h6m-6 4h6'};
const icon=key=>`<span class="healthCockpitIcon ${key}" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${glyphs[key]||glyphs.care}"/></svg></span>`;
const action=(route,label,attrs='')=>`<button type="button" class="healthCockpitAction" data-route="${route}" ${attrs}>${esc(label)}${arrow}</button>`;
const unavailable=text=>`<p class="healthCockpitEmpty">${esc(text)}</p>`;
const flagged=metric=>metric?.source&&['candidate','held'].includes(metric.source.status);
const review=metric=>flagged(metric)?'Em conferência':metric?.availability==='partial'?'Leitura parcial':'';
const actualMetric=m=>m&&!['error','unavailable'].includes(m.availability)&&number(m.value)!=null;
const periodLabel=d=>d.mode==='day'?'neste dia':'no período';
const changeLabel=(m,d)=>{
 if(d.mode!=='period'||!m?.comparison?.comparable)return null;
 const delta=m.comparison.delta,precision=m.key==='sleep'?1:0,minimum=10**-precision;
 if(delta===0)return 'Sem mudança numérica vs. período anterior';
 if(Math.abs(delta)<minimum/2)return `Variação menor que ${value(minimum,m.unit,precision)} vs. período anterior`;
 return `${delta>0?'+':''}${value(delta,m.unit,precision)} vs. período anterior`;
};

function summaryCard(key,route,label,reading,context,detail,caution=false){
 return `<button type="button" class="healthCockpitSummaryCard ${key}" data-route="${route}" data-cockpit-summary="${key}"><span class="healthCockpitSummaryLabel">${icon(key)}${esc(label)}</span><strong>${esc(reading)}</strong><span class="healthCockpitSummaryContext">${esc(context)}</span>${detail?`<small>${esc(detail)}</small>`:''}${caution?`<span class="healthCockpitReview">${esc(typeof caution==='string'?caution:'Em conferência')}</span>`:''}</button>`;
}

function overview(d,c,b){
 const metrics=d.metricsByKey,body=b.available&&!b.latestKnownAmbiguous?b.latest:null,t=c.training,l=c.labs,s=l.latestCollectionSummary||{},food=metrics.protein,sleep=metrics.sleep;
 const attention=l.available?number(s.attention):null;
 return `<nav class="healthCockpitSummary" aria-label="Panorama da sua saúde">${[
  summaryCard('body','bio','Corpo',body?value(body.weight_kg,'kg',1):b.latestKnownAmbiguous?'Conferir avaliações':b.available?'Sem avaliação':'Indisponível',body?`Avaliação de ${date(body.date)}`:b.latestKnownAmbiguous?'Mais de uma avaliação na última data':b.available?'Sem avaliação até esta data':'Não carregou',body?`Gordura ${number(body.body_fat_pct)!=null?value(body.body_fat_pct,'%',1):value(body.fat_mass_kg,'kg',1)} · Músculo ${value(body.skeletal_muscle_mass_kg,'kg',1)}`:null),
  summaryCard('training','treinos','Treinos',t.available?(t.sessions===0&&t.partial?'Conferir sessões':count(t.sessions||0,'treino','treinos')):'Indisponível',periodLabel(d),t.latest?`Último ${date(t.latest.date)}`:t.partial?'Resumo em conferência':t.available?'Nenhuma sessão até esta data':null,t.partial?'Leitura parcial':''),
  summaryCard('nutrition','nutricao','Alimentação',actualMetric(food)?value(food.value,d.mode==='day'?'g':'g/dia'):'Sem informação','Proteína registrada',[actualMetric(metrics.energy)?value(metrics.energy.value,d.mode==='day'?'kcal':'kcal/dia'):null,changeLabel(food,d)].filter(Boolean).join(' · '),review(food)),
  summaryCard('sleep','analise','Sono',actualMetric(sleep)?value(sleep.value,'h',1):'Sem informação',d.mode==='day'?'Neste dia':'Média por noite registrada',changeLabel(sleep,d)||(sleep.count?count(sleep.count,'dia com registro','dias com registro'):null),review(sleep)),
  summaryCard('labs','saude','Exames',attention!=null?count(attention,'sinalizado','sinalizados'):l.available?'Sem coleta':'Indisponível',l.latestCollectionDate?`Coleta de ${date(l.latestCollectionDate)}`:'Até a data selecionada',attention!=null?(s.unclassified?`${s.unclassified} sem faixa classificada`:'Pelas referências do laudo'):null)
 ].join('')}</nav>`;
}

function priorities(d,c,g){
 const water=d.metricsByKey.water,labs=c.labs,items=[];
 if(['error','unavailable'].includes(water.availability))items.push({key:'water',title:'Água não carregou',text:'Atualize os dados para consultar este período.',route:'dados',action:'Ver conexão'});
 else if(water.value==null){const last=water.latestRecorded;items.push({key:'water',title:'Água sem atualização',text:last?`Último registro: ${date(last.date)}. O consumo atual não está disponível.`:'O consumo de água não está disponível neste período.',route:'dados',action:'Ver situação'});}
 if(labs.available&&labs.latestCollectionSummary?.attention)items.push({key:'labs',title:'Exames para revisar',text:`${count(labs.latestCollectionSummary.attention,'resultado sinalizado','resultados sinalizados')} no laudo de ${date(labs.latestCollectionDate)}.`,route:'saude',action:'Ver resultados'});
 const care=g.protocols?.care;
 if(care?.available&&care.pendingCount)items.push({key:'care',title:'Acompanhamento da consulta',text:`${count(care.pendingCount,'pendência documentada','pendências documentadas')} em ${date(care.date)}; confira a situação atual.`,route:'tratamentos',action:'Rever acompanhamento'});
 if(!items.length)items.push({key:'body',title:'Explore sua evolução',text:'Compare avaliações, treino e rotina nos históricos.',route:'analise',action:'Abrir análise'});
 return `<section class="healthCockpitPriorities" aria-label="Pontos para acompanhar"><header><span>SEU FOCO</span><h2>O que merece atenção</h2></header><div style="--priority-count:${Math.min(3,items.length)}">${items.slice(0,3).map(item=>`<article>${icon(item.key)}<div><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p>${action(item.route,item.action)}</div></article>`).join('')}</div></section>`;
}

function bodyPanel(b,changes){
 const body=b.available&&!b.latestKnownAmbiguous?b.latest:null,reading=changes.domains.find(x=>x.key==='body'),rows=reading?.rows||[];
 return `<article class="healthCockpitPanel body" data-cockpit-panel="body"><header>${icon('body')}<div><h2>Seu corpo</h2><p>${body?`Última avaliação · ${date(body.date)}`:'Avaliações corporais'}</p></div></header>${body?`<dl class="healthCockpitBody">${[['weight_kg','Peso'],['fat_mass_kg','Gordura estimada'],['skeletal_muscle_mass_kg','Músculo estimado']].map(([key,label])=>`<div><dt>${label}</dt><dd>${key==='fat_mass_kg'&&number(body.body_fat_pct)!=null?value(body.body_fat_pct,'%',1):value(body[key],'kg',1)}</dd>${key==='fat_mass_kg'&&number(body.body_fat_pct)!=null&&number(body.fat_mass_kg)!=null?`<small class="healthCockpitMass">${value(body.fat_mass_kg,'kg',1)}</small>`:''}${reading?.state==='comparison'&&rows.find(r=>r.key===key)?.change?`<small>${esc(rows.find(r=>r.key===key).change)}</small>`:''}</div>`).join('')}</dl><p class="healthCockpitNote">${reading?.state==='comparison'?`Comparação entre ${date(b.first?.date)} e ${date(body.date)}.`:b.outsidePeriod?'Sem nova avaliação neste período.':b.pair?'A comparação entre estas avaliações precisa ser conferida.':'Uma nova avaliação permitirá acompanhar a mudança.'}</p>`:unavailable(!b.available?'As avaliações não carregaram.':b.latestKnownAmbiguous?'Há mais de uma avaliação na última data. Abra o histórico para conferir.':'Ainda não há avaliação disponível até esta data.')}${action('bio','Ver evolução corporal')}</article>`;
}

function trainingChart(t,d){
 const days=new Map();for(const row of t.rows||[]){const day=row.date||row.workout_date;if(day>=d.bounds.start&&day<=d.bounds.end)days.set(day,(days.get(day)||0)+1);}
 const points=[...days].sort(([a],[b])=>a.localeCompare(b)).slice(-10);if(!points.length)return '';
 const max=Math.max(...points.map(([,v])=>v));
 return `<div class="healthCockpitTrainingChart" role="img" aria-label="Sessões por dia com treino registrado; escala de zero a ${max}">${points.map(([day,n])=>`<div><strong>${n}</strong><i style="height:${Math.round(n/max*52)}px"></i><span>${date(day).slice(0,5)}</span></div>`).join('')}</div><p class="healthCockpitChartCaption">${days.size>10?'Últimos 10 dias':'Dias'} com treino registrado</p>`;
}

function trainingPanel(t,d){
 const w=t.latest;
 return `<article class="healthCockpitPanel training" data-cockpit-panel="training"><header>${icon('training')}<div><h2>Seu ritmo de treino</h2><p>${d.mode==='day'?'Na data selecionada':'No período selecionado'}</p></div></header>${!t.available?unavailable('Os treinos não carregaram.'):t.sessions?`<div class="healthCockpitTrainingTotal"><strong>${t.sessions}</strong><span>${t.sessions===1?'treino registrado':'treinos registrados'}${number(t.recordedMinutes)!=null?`<small>${value(t.recordedMinutes,'min')} com duração informada</small>`:''}</span></div>${trainingChart(t,d)}`:unavailable(t.partial?'O resumo deste período precisa ser conferido.':'Nenhum treino registrado neste período.')}${t.partial||t.detailsPartial?'<p class="healthCockpitNote">Parte do histórico precisa de conferência. Os detalhes disponíveis estão preservados.</p>':''}${w?`<div class="healthCockpitLastSession"><span>Último treino · ${date(w.date)}</span><strong>${esc(w.workout_type||w.type||'Treino registrado')}</strong><small>${w.exerciseCount!=null?count(w.exerciseCount,'exercício','exercícios'):''}${w.setCount!=null?` · ${count(w.setCount,'série','séries')}`:''}${w.inPeriod===false?' · anterior ao período':''}</small></div>${action('treinos','Abrir último treino',`data-home-workout="${esc(w.source_record_id||w.sourceRecordId||w.key)}"`)}`:action('treinos','Ver histórico de treinos')}</article>`;
}

function labPanel(l,labAction,labValue){
 const latest=l.latestCollectionItems||[],attention=latest.filter(x=>x.attention),featured=(attention.length?attention:latest).slice().sort((a,b)=>a.biomarker.localeCompare(b.biomarker,'pt-BR')).slice(0,3);
 const position=item=>item.ambiguous?'Conferir resultados':item.referencePosition==='above'?'Acima da referência':item.referencePosition==='below'?'Abaixo da referência':item.reportedFlag?'Sinalizado no laudo':item.referencePosition==='within'?'Na referência do laudo':'Referência não classificada';
 return `<article class="healthCockpitPanel labs" data-cockpit-panel="labs"><header>${icon('labs')}<div><h2>${attention.length?'Exames para acompanhar':'Seus exames'}</h2><p>${l.latestCollectionDate?`Última coleta · ${date(l.latestCollectionDate)}`:'Resultados e referências'}</p></div></header>${!l.available?unavailable('Os exames não carregaram.'):featured.length?`<div class="healthCockpitLabList">${featured.map(item=>`<section><div><h3>${esc(item.biomarker)}</h3><strong>${item.ambiguous?'Conferir':labValue(item)}</strong><span>${position(item)}</span></div>${labAction(item,'Ver histórico')}</section>`).join('')}</div><p class="healthCockpitNote">${attention.length?'Sinalização do próprio laudo; não define diagnóstico.':'As referências não classificadas continuam disponíveis no histórico.'}</p>`:unavailable('Ainda não há coleta disponível até esta data.')}${action('saude','Abrir todos os exames')}</article>`;
}

export function renderHealthCockpit(d,c,g,b,changes,{labAction,labValue}){
 return `<div class="healthCockpit" data-health-cockpit>${overview(d,c,b)}${priorities(d,c,g)}<section class="healthCockpitPanels" aria-label="Corpo, treino e exames">${bodyPanel(b,changes)}${trainingPanel(c.training,d)}${labPanel(c.labs,labAction,labValue)}</section></div>`;
}
