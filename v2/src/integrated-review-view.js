import {sourceDisplayLabel} from './source-display.js';
import {state,esc,fmtDate,fmtNum,num} from './core.js';
import {integratedReview,consultationLines} from './integrated-review.js';
import {usefulReports} from './reports-model.js';
import {bodySourceLabel,medicationContext} from './health-context.js';
import {labResultText} from './labs-layout-v2.js';
import {pageOf,pager} from './history-tools.js';
import {evolutionModel} from './evolution-model.js';
import {renderBodyInterval} from './body-interval-view.js';
import {loadInsightUnits} from './evidence-insights.js';

const value=(v,unit='',digits=1)=>num(v)==null?'Sem valor registrado':`${fmtNum(v,digits)}${unit?` ${unit}`:''}`;
const sourceLabel=(source,sources=[])=>sourceDisplayLabel(source,sources);
const select=(id,label,sources,selected,domain={})=>`<label class="ltsField">${esc(label)}<select id="${id}" data-report-field="${id}" ${sources.length?'':'disabled'}>${domain.requestedSourceMissing?`<option value="${esc(domain.requestedSource)}" selected disabled>Origem sem dados nesta janela</option>`:''}${sources.length?sources.map(s=>`<option value="${esc(s.key)}" ${s.key===selected?.key?'selected':''}>${esc(sourceLabel(s,sources))} · ${s.rows.length} dias</option>`).join(''):domain.requestedSourceMissing?'':'<option value="">Sem origem disponível</option>'}</select></label>`;
const note=text=>`<p class="ltsReviewNote">${esc(text)}</p>`;
const unavailable='Leitura indisponível nesta atualização.';

function coverageCard(label,domain,count){
  return `<article><span>${label}</span><b>${domain.available?`${count} dias`:'Indisponível'}</b><small>${esc(domain.available?domain.source?.label||(label==='Treino'?'Treinos confirmados':'Sem origem com registros'):unavailable)}</small></article>`;
}
function contrastCard(label,c,source,unit,digits){
  return `<article class="ltsReviewContrast"><h3>${label} × treino registrado</h3>${!c.available?note('Não foi possível atualizar os registros necessários para esta comparação.'):c.comparable?`<p><b>${value(c.withMean,unit,digits)}</b> com treino · <b>${value(c.withoutMean,unit,digits)}</b> sem treino registrado</p><small>${c.withTraining.length} e ${c.withoutTraining.length} dias com valor, respectivamente.</small>`:`<p class="ltsReviewPending">Ainda não há base suficiente</p><small>${c.withTraining.length} dias com treino e ${c.withoutTraining.length} sem treino registrado. Mínimo descritivo: 5 dias por grupo.</small>`}<details data-disclosure="review-${unit}"><summary>Sobre estes dados</summary><p>${esc(source?.label||'Sem origem disponível')}. Hoje não entra; sem registro de treino não significa descanso. A diferença não prova efeito do treino nem adequação. O mínimo de dias não é um teste estatístico.</p>${c.available?`<p>Datas com treino: ${c.withTraining.map(r=>fmtDate(r.date)).join(', ')||'nenhuma'}.<br>Datas sem treino registrado: ${c.withoutTraining.map(r=>fmtDate(r.date)).join(', ')||'nenhuma'}.</p>`:''}</details></article>`;
}
// Presentation only: every value below comes from the already selected,
// source-aware review. The original interpretation stays available in full.
const readingDomains={labs:['Exames','＋'],body:['Composição','◇'],training:['Treino','↗'],nutrition:['Alimentação','◉'],sleep:['Sono','☾'],water:['Água','◒']};
function readingFacts(rows){
  return `<dl class="ltsReadingFacts">${rows.map(([label,n,unit,digits=1,caption=''])=>`<div><dt>${esc(label)}</dt><dd>${num(n)==null?'—':fmtNum(n,digits)}${num(n)==null?'':`<span>${esc(unit)}</span>`}</dd>${caption?`<small>${esc(caption)}</small>`:''}</div>`).join('')}</dl>`;
}
function readingVisual(kind,e,m,r){
  if(kind==='labs'){
    const rows=e.labReferenceRows.slice(0,3);
    if(rows.length)return `<div class="ltsReadingLabValues">${rows.map(row=>`<div><span>${esc(row.group.label)}</span><strong>${esc(labResultText(row.current))}</strong></div>`).join('')}</div><p class="ltsReadingContext">${fmtDate(rows[0].current.collection_date)} · fora da faixa do laudo</p>`;
    const row=e.domainReadings.labs?.rows?.[0];
    return row?`<div class="ltsReadingPair"><span>${esc(labResultText(row.previous))}</span><i aria-hidden="true">→</i><strong>${esc(labResultText(row.current))}</strong></div><p class="ltsReadingContext">${fmtDate(row.previous.collection_date)} → ${fmtDate(row.current.collection_date)} · coletas comparáveis</p>`:'';
  }
  if(kind==='body'){
    const change=key=>e.bodyPairs&&num(e.bodyPairs.changes[key])!=null?`${e.bodyPairs.changes[key]>0?'+':''}${value(e.bodyPairs.changes[key],'kg')}`:'';
    return readingFacts([['Peso',e.body?.weight_kg,'kg',1,change('weight_kg')],['Gordura estimada',e.body?.fat_mass_kg,'kg',1,change('fat_mass_kg')],['Músculo estimado',e.body?.skeletal_muscle_mass_kg,'kg',1,change('skeletal_muscle_mass_kg')]])+`<p class="ltsReadingContext">${e.bodyPairs?`${fmtDate(e.bodyPairs.start)} → ${fmtDate(e.bodyPairs.end)} · diferenças registradas`:`${fmtDate(e.body.measured_at)} · sem comparação confirmada`}</p>`;
  }
  if(kind==='training'){
    const s=e.latestSession,l=e.freshLoad;
    return (l?`<div class="ltsReadingPair"><span>${value(l.previous.weight,'',1)}</span><i aria-hidden="true">→</i><strong>${value(l.latest.weight,'',1)} <small>${esc(loadInsightUnits[l.unit]||l.unit)}</small></strong></div><p class="ltsReadingContext">${esc(l.exercise)} · ${l.reps} repetições</p>`:readingFacts([['Exercícios',s?.exerciseCount,'',0],['Séries principais',s?.setCount,'',0],['Duração',s?.duration_minutes,'min',0]]))+`<p class="ltsReadingContext">Última sessão · ${fmtDate(s.workout_date)}${l?'':' · sem par de cargas equivalente'}</p>`;
  }
  if(kind==='nutrition')return readingFacts([['Energia média',e.recent.nutrition.calories_kcal.current,'kcal',0,`${e.recent.nutrition.calories_kcal.currentDays} dias com valor`],['Proteína média',e.recent.nutrition.protein_g.current,'g',0,`${e.recent.nutrition.protein_g.currentDays} dias com valor`]])+`<p class="ltsReadingContext">Dias encerrados · ${e.recent.nutrition.protein_g.comparable||e.recent.nutrition.calories_kcal.comparable?'comparação disponível':'sem comparação equivalente'}</p>`;
  if(kind==='sleep'){
    const c=e.recent.sleep,mean=num(c.current)!=null;
    return readingFacts([[mean?'Duração média':'Última duração',mean?c.current:e.latestSleep.value,'h',1,mean?`${c.currentDays}/${c.currentBounds.closedDays} dias encerrados`:fmtDate(e.latestSleep.date)]])+`<p class="ltsReadingContext">${c.comparable?`${value(c.previous,'h')} no período anterior`:'Sem comparação equivalente'} · duração registrada</p>`;
  }
  if(kind==='water')return readingFacts([['Último registro',e.latestWater.value,'mL',0,fmtDate(e.latestWater.date)],...(e.waterMean==null?[]:[['Média registrada',e.waterMean,'mL',0,`${r.water.closedRows.length} dias com valor`]])])+`<p class="ltsReadingContext">Registro pode ser parcial · ausência não é zero</p>`;
  return '';
}
function readingCard(f,e,m,r){
  const [label,icon]=readingDomains[f.kind]||['Histórico','◷'];
  const lab=e.labReferenceRows[0]?.current||e.domainReadings.labs?.rows?.[0]?.current;
  const origin={labs:lab?.laboratory||lab?.source,body:e.body?bodySourceLabel(e.body):null,training:e.latestSession?.source,nutrition:r.nutrition.source?.label,sleep:r.sleep.source?.label,water:r.water.source?.label}[f.kind];
  return `<article class="ltsReviewContrast ltsReviewReading" data-reading-kind="${esc(f.kind)}"><header><span class="ltsReadingIcon" aria-hidden="true">${icon}</span><span>${label}</span></header><h3>${esc(f.title)}</h3>${readingVisual(f.kind,e,m,r)}${origin?`<p class="ltsReadingOrigin">${esc(origin)}</p>`:''}<details class="ltsReadingEvidence" data-disclosure="review-reading-${esc(f.kind)}"><summary>Leitura e referências</summary><p>${esc(f.meaning)}</p><p>${esc(f.evidence)}</p><small>${esc(f.limit)}</small></details><button type="button" data-route="${esc(f.route)}">${esc(f.action)} <span aria-hidden="true">↗</span></button></article>`;
}
function overview(r,m){
  const e=evolutionModel(state.data,state.domainStatus,m,r,state.ui);
  const takeaways=e.takeaways.map(f=>readingCard(f,e,m,r)).join('');
  const findings=e.findings.map(f=>`<article class="ltsReviewContrast"><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p><small>${esc(f.detail)}</small><button data-route="${f.route}">Abrir evidência ↗</button></article>`).join('');
  const validContrasts=[['water','Água','mL',0],['sleep','Sono','h',1]].filter(([key])=>r.contrasts[key].comparable).map(([key,label,unit,digits])=>contrastCard(label,r.contrasts[key],r[key].source,unit,digits)).join('');
  return `<div class="ltsReviewContrasts">${takeaways||note('Ainda não há uma mudança comparável confirmada nesta janela e nas origens escolhidas. Consulte valores, datas e referências nos detalhes.')}</div><details data-disclosure="review-numeric-contrasts"><summary>Comparações numéricas e cruzamentos</summary><div class="ltsReviewContrasts">${findings}${validContrasts}</div></details>${note('Cada leitura acima responde a uma comparação concreta. Coincidência de datas não prova causa. Sono mantém a data fornecida pela origem; fontes e aparelhos não são combinados.')}`;
}
export function renderHomeDaySignals(review,date){
  const d=review.days.find(row=>row.date===date);
  const water=!review.water.available?unavailable:d?.water?`${value(d.water.value,'mL',0)} · ${d.water.source}`:review.water.conflicts.some(r=>r.date===date)?'Totais em conflito; nenhum foi escolhido.':'Sem ingestão registrada nesta origem e data.';
  const sleep=!review.sleep.available?unavailable:d?.sleep?`${value(d.sleep.value,'h')} · ${d.sleep.source}`:'Sem sono registrado nesta origem e data.';
  return `<button data-route="nutricao" class="ltsDayWater"><b>Água ingerida</b><span>${esc(water)}</span></button><button data-route="analise" class="ltsDaySleep"><b>Sono registrado</b><span>${esc(sleep)}</span></button>`;
}
function dayFacts(r,d,status){
  if(!d)return note('Nenhum registro nas origens e janela escolhidas. Os históricos continuam disponíveis.');
  const workouts=d.workouts.map(row=>`${row.workout_type||'Treino'} · ${value(row.duration_minutes,'min',0)} · ${row.source||'origem não informada'}`).join('; ');
  const body=d.body.length===1?`${value(d.body[0].weight_kg,'kg')} · ${value(d.body[0].body_fat_pct,'%')} · ${bodySourceLabel(d.body[0])}`:d.body.length?'Mais de uma medição; consulte os detalhes.':'Sem medição nesta data.';
  const food=d.nutrition?`${value(d.nutrition.calories_kcal,'kcal',0)} · ${value(d.nutrition.protein_g,'g proteína',0)} · ${d.nutrition.context||d.nutrition.source}`:'Sem alimentação registrada nesta origem e data.';
  const facts=[['Treino',r.training.available?workouts||'Sem treino registrado nesta data.':unavailable,'treinos'],['Alimentação',r.nutrition.available?food:unavailable,'nutricao'],['Composição',status.body==='ready'?body:unavailable,'bio'],['Exames',status.labs==='ready'?d.labs.length?`${d.labs.length} resultados nesta data; consulte valores e referências.`:'Sem coleta nesta data.':unavailable,'saude'],['Medicações',status.treatments==='ready'?d.treatments.map(row=>`${row.medication} · ${medicationContext(row)}`).join('; ')||'Nenhuma aplicação registrada nesta data.':unavailable,'tratamentos']];
  return `<div class="ltsReviewDayFacts">${facts.map(([label,text,route])=>`<button data-route="${route}"><b>${label}</b><span>${esc(text)}</span></button>`).join('')}${renderHomeDaySignals(r,d.date)}</div>${d.labs.length?`<details data-disclosure="review-day-labs"><summary>Resultados da data</summary><ul>${d.labs.map(row=>`<li>${esc(row.biomarker)}: ${esc(labResultText(row))} · ${esc(row.laboratory||row.source||'origem não informada')} · referência ${esc(row.reference_range||'não informada')}</li>`).join('')}</ul></details>`:''}`;
}
function dayPanel(r,status){
  const i=r.dates.indexOf(r.selectedDate),page=pageOf([...r.days].reverse(),state.ui.reviewDayPage,7);
  const cell=(present,available)=>available?present?'Registrado':'—':'Indisponível';
  return `<div class="ltsReviewDay"><div class="ltsReviewDayControls"><button id="reviewPrevDate" data-review-date="${esc(r.dates[i-1]||'')}" ${i>0?'':'disabled'} aria-label="Dia anterior com registros">‹</button><label class="ltsField">Consultar dia com registros<select id="reviewDate" data-report-field="reviewDate" ${r.dates.length?'':'disabled'}>${r.dates.length?[...r.dates].reverse().map(date=>`<option value="${date}" ${date===r.selectedDate?'selected':''}>${fmtDate(date)}${date>=r.today?' · em andamento':''}</option>`).join(''):'<option>Sem registros</option>'}</select></label><button id="reviewNextDate" data-review-date="${esc(r.dates[i+1]||'')}" ${i>=0&&i<r.dates.length-1?'':'disabled'} aria-label="Próximo dia com registros">›</button></div>${r.selected?.open?note('Dia em andamento: os totais podem mudar. Este dia não entra nas médias ou comparações cruzadas.'):''}${dayFacts(r,r.selected,status)}<details class="ltsReviewCalendar" data-disclosure="review-calendar"><summary>Mapa de registros · ${r.days.length} datas</summary><p>Somente datas com algum registro; “—” significa ausência, não zero. Toque na data para abrir seu contexto.</p><div class="ltsReportTableWrap"><table class="ltsReportTable"><thead><tr><th>Data</th><th>Treino</th><th>Alimentação</th><th>Água</th><th>Sono</th></tr></thead><tbody>${page.rows.map(d=>`<tr><th><button data-review-date="${d.date}" aria-pressed="${d.date===r.selectedDate}">${fmtDate(d.date)}${d.open?' · parcial':''}</button></th><td>${cell(d.workouts.length,r.training.available)}</td><td>${cell(d.nutrition,r.nutrition.available)}</td><td>${cell(d.water,r.water.available)}</td><td>${cell(d.sleep,r.sleep.available)}</td></tr>`).join('')}</tbody></table></div>${pager(page,'reviewDayPage').replaceAll('data-depth-page','data-report-page')}</details></div>`;
}
function consultation(r,m){
  const lines=consultationLines(r,m,evolutionModel(state.data,state.domainStatus,m,r,state.ui)),blocks=[];let block={title:lines[0],lines:[]};
  for(const line of lines.slice(1)){if(line&&line===line.toUpperCase()&&/[A-Z]/.test(line)){blocks.push(block);block={title:line,lines:[]};}else if(line)block.lines.push(line);}blocks.push(block);
  return `<div class="ltsConsultation"><div class="ltsReviewExport"><div><h3>Resumo para sua próxima consulta</h3><p>Usa a janela e as origens escolhidas. O arquivo é criado no seu dispositivo; você decide se e com quem compartilhar.</p></div><button type="button" data-review-export>Baixar resumo (.txt)</button></div>${blocks.map(b=>`<section><h3>${esc(b.title)}</h3>${b.lines.map(line=>`<p>${esc(line)}</p>`).join('')}</section>`).join('')}</div>`;
}
export function renderIntegratedReview(m){
  const r=integratedReview(state.data,state.domainStatus,m.current,state.ui,m.today);
  const views=[['interval','Entre avaliações'],['overview','Visão cruzada'],['day','Contexto do dia'],['consultation','Resumo para consulta']];
  const selected=views.some(([key])=>key===state.ui.reviewView)?state.ui.reviewView:'overview';
  return `<section class="ltsReportSection ltsIntegratedReview" id="reportIntegratedReview"><header><span>LEITURA INTEGRADA</span><h2>Entender a evolução</h2><p>Valores, mudanças e contexto — por tema.</p></header><div class="ltsReviewTabs" role="group" aria-label="Exploração integrada">${views.map(([key,label])=>`<button id="reviewTab-${key}" type="button" data-review-view="${key}" aria-pressed="${key===selected}" aria-controls="reviewPanel" class="${key===selected?'active':''}">${label}</button>`).join('')}</div>${selected!=='interval'&&r.nutrition.requestedSourceMissing?note(r.nutrition.selectionMessage):''}<div id="reviewPanel" aria-labelledby="reviewTab-${selected}">${selected==='interval'?renderBodyInterval(state.data,state.domainStatus,state.ui,m.today):selected==='day'?dayPanel(r,state.domainStatus):selected==='consultation'?consultation(r,m):overview(r,m)}</div>${selected==='interval'?'':`<details class="ltsReviewSources" data-disclosure="review-sources"><summary>Sobre estes dados</summary><div class="ltsReportControls">${select('reportNutritionSourceReview','Alimentação',r.nutrition.sources,r.nutrition.source,r.nutrition).replaceAll('data-report-field="reportNutritionSourceReview"','data-report-field="reportNutritionSource"')}${select('reviewWaterSource','Água',r.water.sources,r.water.source)}${select('reviewSleepSource','Sono e aparelho/origem',r.sleep.sources,r.sleep.source)}</div>${note(`${r.nutrition.ambiguousDays} datas alimentares ambíguas, ${r.nutrition.unknownDays} registros sem origem e ${r.water.conflicts.length} datas de água em conflito foram excluídas. Uma origem por vez; a escolha de alimentação também vale para os insights abaixo. Comparações entre dias com e sem treino exigem ao menos 5 dias observados por grupo.`)}</details>`}</section>`;
}
export function downloadIntegratedSummary(){
  const m=usefulReports(state.data,state.domainStatus,state.ui),r=integratedReview(state.data,state.domainStatus,m.current,state.ui,m.today);
  const blob=new Blob([consultationLines(r,m,evolutionModel(state.data,state.domainStatus,m,r,state.ui)).join('\n')+'\n'],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download=`LTS_Health_Resumo_${r.today}.txt`;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
