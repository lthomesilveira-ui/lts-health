import {state,esc,fmtDate,fmtNum,num} from './core.js';
import {integratedReview,consultationLines} from './integrated-review.js';
import {usefulReports} from './reports-model.js';
import {bodySourceLabel,medicationContext} from './health-context.js';
import {labResultText} from './labs-layout-v2.js';
import {pageOf,pager} from './history-tools.js';
import {evolutionModel} from './evolution-model.js';

const value=(v,unit='',digits=1)=>num(v)==null?'Sem valor registrado':`${fmtNum(v,digits)}${unit?` ${unit}`:''}`;
const select=(id,label,sources,selected)=>`<label class="ltsField">${esc(label)}<select id="${id}" data-report-field="${id}" ${sources.length?'':'disabled'}>${sources.length?sources.map(s=>`<option value="${esc(s.key)}" ${s.key===selected?.key?'selected':''}>${esc(s.label)} · ${s.rows.length} dias</option>`).join(''):'<option value="">Sem origem disponível</option>'}</select></label>`;
const note=text=>`<p class="ltsReviewNote">${esc(text)}</p>`;
const unavailable='Leitura indisponível nesta atualização.';

function coverageCard(label,domain,count){
  return `<article><span>${label}</span><b>${domain.available?`${count} dias`:'Indisponível'}</b><small>${esc(domain.available?domain.source?.label||(label==='Treino'?'Treinos confirmados':'Sem origem com registros'):unavailable)}</small></article>`;
}
function contrastCard(label,c,source,unit,digits){
  return `<article class="ltsReviewContrast"><h3>${label} × treino registrado</h3>${!c.available?note('Comparação bloqueada: as fontes necessárias não carregaram.'):c.comparable?`<p><b>${value(c.withMean,unit,digits)}</b> com treino · <b>${value(c.withoutMean,unit,digits)}</b> sem treino registrado</p><small>${c.withTraining.length} e ${c.withoutTraining.length} dias com valor, respectivamente.</small>`:`<p class="ltsReviewPending">Ainda não há base suficiente</p><small>${c.withTraining.length} dias com treino e ${c.withoutTraining.length} sem treino registrado. Mínimo descritivo: 5 dias por grupo.</small>`}<details data-disclosure="review-${unit}"><summary>Base e limites</summary><p>${esc(source?.label||'Sem origem disponível')}. Hoje não entra; sem registro de treino não significa descanso. A diferença não prova efeito do treino nem adequação. O mínimo de dias não é um teste estatístico.</p>${c.available?`<p>Datas com treino: ${c.withTraining.map(r=>fmtDate(r.date)).join(', ')||'nenhuma'}.<br>Datas sem treino registrado: ${c.withoutTraining.map(r=>fmtDate(r.date)).join(', ')||'nenhuma'}.</p>`:''}</details></article>`;
}
function overview(r,m){
  const e=evolutionModel(state.data,state.domainStatus,m,r,state.ui);
  const findings=e.findings.map(f=>`<article class="ltsReviewContrast"><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p><small>${esc(f.detail)}</small><button data-route="${f.route}">Abrir evidência ↗</button></article>`).join('');
  const validContrasts=[['water','Água','mL',0],['sleep','Sono','h',1]].filter(([key])=>r.contrasts[key].comparable).map(([key,label,unit,digits])=>contrastCard(label,r.contrasts[key],r[key].source,unit,digits)).join('');
  return `<div class="ltsReviewContrasts">${findings||note('Ainda não há uma mudança comparável confirmada nesta janela e nas origens escolhidas. Consulte valores, datas e referências nos detalhes.')}${validContrasts}</div>${note('Cada leitura acima responde a uma comparação concreta. Coincidência de datas não prova causa. Sono mantém a data fornecida pela origem; fontes e aparelhos não são combinados.')}<details><summary>Base e limites da leitura</summary><p>${r.nutrition.ambiguousDays} datas alimentares ambíguas e ${r.water.conflicts.length} datas de água em conflito ficaram fora dos cálculos. Comparações entre dias com e sem treino exigem ao menos 5 dias observados por grupo.</p></details>`;
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
  const food=d.nutrition?`${value(d.nutrition.calories_kcal,'kcal',0)} · ${value(d.nutrition.protein_g,'g proteína',0)} · ${d.nutrition.source}`:'Sem alimentação registrada nesta origem e data.';
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
  const views=[['overview','Visão cruzada'],['day','Contexto do dia'],['consultation','Resumo para consulta']];
  const selected=views.some(([key])=>key===state.ui.reviewView)?state.ui.reviewView:'overview';
  return `<section class="ltsReportSection ltsIntegratedReview" id="reportIntegratedReview"><header><span>LEITURA INTEGRADA</span><h2>Entender a evolução</h2><p>Mudanças observadas, comparações e perguntas para a próxima consulta.</p></header><div class="ltsReviewTabs" role="group" aria-label="Exploração integrada">${views.map(([key,label])=>`<button id="reviewTab-${key}" type="button" data-review-view="${key}" aria-pressed="${key===selected}" aria-controls="reviewPanel" class="${key===selected?'active':''}">${label}</button>`).join('')}</div><details class="ltsReviewSources" data-disclosure="review-sources"><summary>Origens desta leitura</summary><div class="ltsReportControls">${select('reportNutritionSourceReview','Alimentação',r.nutrition.sources,r.nutrition.source).replaceAll('data-report-field="reportNutritionSourceReview"','data-report-field="reportNutritionSource"')}${select('reviewWaterSource','Água',r.water.sources,r.water.source)}${select('reviewSleepSource','Sono e aparelho/origem',r.sleep.sources,r.sleep.source)}</div>${note(`${r.nutrition.ambiguousDays} datas alimentares ambíguas, ${r.nutrition.unknownDays} sem origem e ${r.water.conflicts.length} datas de água em conflito foram excluídas. Uma origem por vez; a escolha de alimentação também vale para os insights abaixo.`)}</details><div id="reviewPanel" aria-labelledby="reviewTab-${selected}">${selected==='day'?dayPanel(r,state.domainStatus):selected==='consultation'?consultation(r,m):overview(r,m)}</div></section>`;
}
export function downloadIntegratedSummary(){
  const m=usefulReports(state.data,state.domainStatus,state.ui),r=integratedReview(state.data,state.domainStatus,m.current,state.ui,m.today);
  const blob=new Blob([consultationLines(r,m,evolutionModel(state.data,state.domainStatus,m,r,state.ui)).join('\n')+'\n'],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download=`LTS_Health_Resumo_${r.today}.txt`;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
