import {esc,fmtNum,fmtDate,num,day} from './core.js';
import {usefulReports} from './reports-model.js';
import {integratedReview} from './integrated-review.js';
import {contextChart,bodySourceLabel} from './health-context.js';

const value=(n,unit='',digits=1)=>num(n)==null?'Sem dado':`${fmtNum(n,digits)}${unit?` ${unit}`:''}`;
const change=(n,unit)=>num(n)==null?'Sem comparação':`${n>0?'+':''}${value(n,unit)}`;
const count=(available,n,noun)=>available?`${n} ${noun}`:'Indisponível';
const sourcePoints=(rows,read,cohort)=>rows.filter(r=>num(read(r))!=null).map(r=>({date:r.date,value:num(read(r)),cohort,context:r.source}));
const bodyLimits={
  unavailable:['Dados indisponíveis','A composição não carregou nesta atualização.'],
  empty:['Sem medição na janela','Não há medição nesta janela; consulte Histórico.'],
  single:['Uma medição na janela','Falta uma medição anterior na janela para comparar.'],
  source_changed:['Origem ou aparelho diferentes','Medições de origens ou aparelhos diferentes não são comparadas.'],
  ambiguous:['Medições em revisão','Há mais de uma medição candidata na mesma data.']
};
function mainReading(m,r,failures){
  const bodyLimit=bodyLimits[m.body.reason]||['Sem comparação segura','Não há um par corporal compatível nesta janela.'];
  const delta=num(m.body.changes?.weight_kg);
  let title;
  if(m.body.available&&delta!=null)title=delta===0?'Peso estável entre duas medições compatíveis.':`Peso ${change(delta,'kg')} entre medições compatíveis.`;
  else if(m.training.available&&m.prior?.training.available){
    const difference=m.training.sessions-m.prior.training.sessions;
    title=difference===0?'Mesmo número de treinos que na janela anterior.':`Treinos: ${difference>0?'+':''}${difference} ${Math.abs(difference)===1?'sessão':'sessões'} frente à janela anterior.`;
  }else title=failures.length?'Parte dos dados não carregou nesta atualização.':r.training.available&&r.nutrition.available?`${r.training.rows.length} sessões confirmadas; alimentação em ${r.nutrition.closedRows.length} dias.`:'Leitura disponível nos registros desta janela.';
  const detail=m.body.available&&delta!=null
    ?`${fmtDate(m.body.start)} → ${fmtDate(m.body.end)} · ${bodySourceLabel(m.body.latest)}. Diferença observada, sem atribuir causa à rotina.`
    :`${bodyLimit[1]} Dias sem registro não significam zero ou descanso.`;
  const overlap=r.training.available&&r.nutrition.available&&r.water.available
    ?`${r.overlaps.foodWater} datas com alimentação e água; ${r.overlaps.foodWaterTraining} também com treino. Coincidência no calendário, não causa e efeito.`
    :'Cruzamentos incompletos: uma das fontes não carregou. Os demais registros continuam disponíveis.';
  return {title,detail,summary:overlap,bodyLimit};
}

// Uses the same source-aware models as Reports. No mock values, goals or inferred
// clinical classifications are introduced by the visual presentation.
export function homeCockpitModel(data,status,period,ui={},today){
  const m=usefulReports(data,status,{...ui,analysisPeriod:period},today);
  const r=integratedReview(data,status,m.current,ui,m.today);
  const trainingByDate=new Map();
  for(const row of m.training.rows||[]){const d=day(row.workout_date);trainingByDate.set(d,(trainingByDate.get(d)||0)+1);}
  const trainingPoints=[...trainingByDate].sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({date,value,cohort:'confirmed-sessions'}));
  const foodPoints=sourcePoints(r.nutrition.rows,row=>row.calories_kcal,r.nutrition.source?.key);
  const sleepPoints=sourcePoints(r.sleep.rows,row=>row.value,r.sleep.source?.key);
  const waterPoints=sourcePoints(r.water.rows,row=>row.value,r.water.source?.key);
  const body=m.body.latest||null;
  const foodDays=r.nutrition.closedRows.length;
  const labRows=(m.labs.groups||[]).flatMap(group=>group.rows);
  const labDates=[...new Set(labRows.map(row=>day(row.collection_date)))].sort();
  const known=[['Composição',status.body],['Treinos',status.workouts],['Nutrição',status.nutrition],['Recuperação',status.sourceMetrics],['Exames',status.labs]];
  const failures=known.filter(([,s])=>s!=='ready').map(([label])=>label);
  const reading=mainReading(m,r,failures);
  return {m,r,body,foodDays,trainingPoints,foodPoints,sleepPoints,waterPoints,labRows,labDates,failures,...reading};
}

function executiveCard(kind,label,main,context,detail,route){
  const glyph={body:'◈',training:'↔',nutrition:'⌁',sleep:'☾',labs:'◇'}[kind];
  return `<button class="ltsExecutiveCard ${kind}" data-route="${route}"><span><i aria-hidden="true">${glyph}</i>${label}<em aria-hidden="true">↗</em></span><strong>${esc(main)}</strong><b>${esc(context)}</b><small>${esc(detail)}</small></button>`;
}
function facts(rows){return `<div class="ltsCockpitFacts">${rows.map(([label,v])=>`<div><b>${esc(v)}</b><small>${esc(label)}</small></div>`).join('')}</div>`;}
function panel(kind,title,route,points,options,factRows,caption,available=true){
  const chart=available?contextChart(points,{...options,selectable:false}):'<div class="ltsContextEmpty" role="status">Dados não carregaram. Use Atualizar dados.</div>';
  return `<article class="ltsCockpitPanel ${kind}"><header><h2>${title}</h2><button data-route="${route}" aria-label="Abrir ${title}">Ver mais ↗</button></header><p class="ltsCockpitCaption">${esc(available?caption:'Fonte indisponível nesta atualização')}</p>${chart}${facts(factRows)}</article>`;
}
export function renderHomeCockpit(c){
  const {m,r,body,foodDays,trainingPoints,foodPoints,sleepPoints,waterPoints,labRows,labDates,failures}=c;
  const latestSleep=sleepPoints.at(-1),latestWater=waterPoints.at(-1);
  const bodyAvailable=m.body.reason!=='unavailable';
  const bodyContext=m.body.available?`${change(m.body.changes.weight_kg,'kg')} · medição anterior`:c.bodyLimit[0];
  const cards=executiveCard('body','Composição',bodyAvailable?value(body?.weight_kg,'kg'):'Indisponível',bodyContext,body?`${fmtDate(body.measured_at)} · ${bodySourceLabel(body)}`:c.bodyLimit[1],'bio')
    +executiveCard('training','Treinos',count(m.training.available,m.training.sessions,'sessões'),m.training.available&&m.prior?.training.available?`${m.prior.training.sessions} no período anterior`:'Somente sessões confirmadas',m.training.available?`${m.training.sets==null?'Séries indisponíveis':`${m.training.sets} séries registradas`} · sem somar Polar novamente`:'A fonte precisa carregar.','treinos')
    +executiveCard('nutrition','Nutrição',count(r.nutrition.available,foodDays,'dias'),r.nutrition.available?value(r.nutrition.means.calories_kcal,'kcal/dia',0):'Média indisponível',r.nutrition.available?(r.nutrition.source?.label?`${r.nutrition.source.label} · dias encerrados`:'Sem origem com registros na janela.'):'A fonte precisa carregar.','nutricao')
    +executiveCard('sleep','Recuperação',r.sleep.available?value(r.sleep.mean,'h/registro'):'Indisponível',r.sleep.available?`${r.sleep.closedRows.length} registros de sono`:'Contagem indisponível',r.sleep.available?(r.sleep.source?.label||'Sem série de sono nessa janela.'):'A fonte precisa carregar.','analise')
    +executiveCard('labs','Exames',statusValue(m.labs,labRows),m.labs.available?`${labDates.length} ${labDates.length===1?'coleta':'coletas'} na janela`:'Contagem indisponível',m.labs.available?(labDates.length?`Última ${fmtDate(labDates.at(-1))}`:'Consulte o histórico de resultados.'):'A fonte precisa carregar.','saude');
  const bodyPoints=m.body.series.weight_kg||[];
  const common={bounds:m.current};
  const panels=panel('training','Treino','treinos',trainingPoints,{...common,label:'Sessões confirmadas por dia',unit:'sessões',digits:0,bar:true},[['Sessões',value(m.training.sessions,'',0)],['Séries',value(m.training.sets,'',0)],['Dias',value(r.training.available?r.training.days:null,'',0)]],'Sessões confirmadas por dia',m.training.available)
    +panel('nutrition','Nutrição','nutricao',foodPoints,{...common,label:'Energia registrada',unit:'kcal',digits:0,bar:true},[['kcal / dia com valor',value(r.nutrition.means.calories_kcal,'',0)],['g proteína / dia com valor',value(r.nutrition.means.protein_g,'',0)],['Dias encerrados',r.nutrition.available?String(foodDays):'—']],r.nutrition.source?.label||'Energia registrada · uma origem por vez',r.nutrition.available)
    +panel('body','Composição corporal','bio',bodyPoints,{...common,label:'Peso corporal',unit:'kg',digits:1},[['Peso',value(body?.weight_kg,'kg')],['Gordura',value(body?.body_fat_pct,'%')],['Músculo esquelético',value(body?.skeletal_muscle_mass_kg,'kg')]],'Peso · curvas separadas por origem e aparelho',bodyAvailable);
  const secondary=panel('sleep','Sono e recuperação','analise',sleepPoints,{...common,label:'Duração do sono',unit:'h',digits:1},[['Média registrada',value(r.sleep.mean,'h')],['Último registro',latestSleep?fmtDate(latestSleep.date):'—']],r.sleep.source?.label||'Sem série selecionada',r.sleep.available)
    +`<article class="ltsCockpitPanel labs ltsCockpitLabBrief"><header><h2>Exames</h2><button data-route="saude" aria-label="Abrir Exames">Ver mais ↗</button></header><p>${esc(statusValue(m.labs,labRows))}</p><small>${m.labs.available?(labDates.length?`Última coleta ${fmtDate(labDates.at(-1))}`:'Sem coleta na janela selecionada'):'Dados não carregaram. Use Atualizar dados.'}</small>${facts([['Coletas',m.labs.available?String(labDates.length):'—'],['Comparações compatíveis',m.labs.available?String(m.labs.comparisons.filter(x=>x.comparable).length):'—']])}<span>Resultados, métodos e referências no detalhe.</span></article>`
    +panel('water','Hidratação','nutricao',waterPoints,{...common,label:'Água ingerida',unit:'mL',digits:0,bar:true},[['Último total',r.water.available?(latestWater?value(latestWater.value,'mL',0):'Sem registro'):'Indisponível'],['Dias encerrados',r.water.available?String(r.water.closedRows.length):'—']],r.water.source?.label||'Sem origem com ingestão registrada',r.water.available);
  const issues=[failures.length?`${failures.join(', ')}: dados indisponíveis nesta atualização.`:null,r.water.available&&r.water.closedRows.length<5?'Água: histórico curto; cruzamentos ainda limitados.':null,!m.body.available&&bodyAvailable?`Composição: ${c.bodyLimit[1]}`:null,r.nutrition.ambiguousDays?`${r.nutrition.ambiguousDays} datas alimentares ambíguas excluídas.`:null].filter(Boolean);
  const sources=[['Corpo','Composição'],['Treino','Treinos'],['Alimentação','Nutrição'],['Saúde','Recuperação'],['Exames','Exames']].map(([label,domain])=>{const loaded=!failures.includes(domain);return `<span class="${loaded?'ready':'pending'}" aria-label="${label}: ${loaded?'dados carregados':'dados indisponíveis'}" title="${label}: ${loaded?'dados carregados':'dados indisponíveis'}">${label} ${loaded?'✓':'—'}</span>`;}).join('');
  return `<div class="ltsDesktopCockpit"><header class="ltsCockpitHeading"><h1>Visão geral da sua saúde</h1><p>Seu histórico em contexto · ${fmtDate(m.current.start)} a ${fmtDate(m.current.end)}</p></header><div class="ltsExecutiveCards">${cards}</div>${renderHomeReading(c)}<div class="ltsCockpitGrid">${panels}</div><div class="ltsCockpitGrid secondary">${secondary}</div><footer class="ltsCockpitFooter"><article><h2>Registros em conjunto</h2><p>${esc(c.summary)}</p><button data-route="analise">Explorar informações cruzadas ↗</button></article><article><h2>Pontos a revisar</h2><p>${esc(issues[0]||'Origens e cobertura disponíveis nos detalhes.')}</p>${issues.length>1?`<details data-disclosure="home-review-points"><summary>Ver ${issues.length-1} outros pontos</summary>${issues.slice(1).map(s=>`<p>${esc(s)}</p>`).join('')}</details>`:''}</article><article><h2>Dados carregados</h2><div class="ltsCockpitSources">${sources}</div><p>Consulta atual; não confirma sincronização.</p><button data-route="dados">Gerenciar conexões e arquivos ↗</button></article></footer></div>`;
}
const statusValue=(labs,rows)=>labs.available===false?'Indisponível':`${rows.length} ${rows.length===1?'resultado':'resultados'}`;
export function renderHomeReading(c,extraClass=''){
  return `<section class="ltsCockpitReading ${extraClass}"><div><span>LEITURA PRINCIPAL DA JANELA</span><h2>${esc(c.title)}</h2><p>${esc(c.detail)}</p></div><button data-home-insight-details>Explorar análise ↗</button></section>`;
}
