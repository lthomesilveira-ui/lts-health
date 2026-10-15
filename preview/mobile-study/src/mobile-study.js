// Isolated read-only study. All data and authorization come from the existing preview.
import {state,esc,fmtNum,fmtDate} from '../../compact-evidence/src/core.js';
import {homePeriodModel} from '../../compact-evidence/src/home-period-model.js';
import {homeEvidence} from '../../compact-evidence/src/home-evidence-insights.js';
import {homeUsefulContent} from '../../compact-evidence/src/home-useful-content.js';
import {homeLabHistory} from '../../compact-evidence/src/home-lab-history.js';
const number=x=>x!=null&&Number.isFinite(Number(x))?Number(x):null;
const value=(x,unit='',digits=1)=>number(x)==null?'Sem valor':`${fmtNum(Number(x),digits)}${unit?' '+esc(unit):''}`;
const signed=(x,unit='kg')=>number(x)==null?'Sem comparação':`${x>0?'+':''}${value(Math.abs(x)<.00001?0:x,unit)}`;
const date=x=>x?fmtDate(x):'Sem data';
const button=(route,label)=>`<button type="button" class="studyAction" data-route="${route}">${esc(label)} <span aria-hidden="true">↗</span></button>`;
const detail=(title,body,id)=>`<details ${id?`data-disclosure="study-${id}"`:''}><summary>${esc(title)}</summary>${body}</details>`;
const empty=text=>`<p class="studyEmpty">${esc(text)}</p>`;
const card=(key,title,tag,body)=>`<article class="studyCard ${key}" data-study-domain="${key}"><header><span class="studyIcon" aria-hidden="true">${{body:'◉',training:'↔',nutrition:'♧',sleep:'☾',labs:'⌁',water:'♧'}[key]}</span><h2>${title}</h2>${tag?`<small>${esc(tag)}</small>`:''}</header>${body}</article>`;
const points=rows=>(rows||[]).filter(r=>r.date&&number(r.value)!=null).map(r=>({...r,value:Number(r.value)})).sort((a,b)=>a.date.localeCompare(b.date));
const deltaDays=(a,b)=>(Date.parse(b)-Date.parse(a))/86400000;
function chart(input,color,unit,{bars=false,daily=true}={}){
 const rows=points(input);if(!rows.length)return empty('Sem valores recebidos nesta janela.');
 const width=330,height=92,start=rows[0].date,end=rows.at(-1).date,span=Math.max(1,deltaDays(start,end));
 const max=Math.max(...rows.map(r=>r.value),1),min=Math.min(...rows.map(r=>r.value),0),range=max-min;
 const xy=r=>[rows.length===1?165:8+314*deltaDays(start,r.date)/span,82-70*(r.value-min)/range];
 const groups=[];for(const row of rows){const previous=groups.at(-1)?.at(-1);if(!previous||(daily&&deltaDays(previous.date,row.date)>1))groups.push([]);groups.at(-1).push(row);}
 const marks=bars?rows.map(r=>{const[x,y]=xy(r);return `<rect x="${x-4}" y="${y}" width="8" height="${82-y}" rx="2" fill="${color}" data-date="${r.date}" data-value="${r.value}"><title>${date(r.date)}: ${value(r.value,unit)}</title></rect>`;}).join(''):groups.map(group=>group.length>1?`<polyline points="${group.map(r=>xy(r).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5"/>`:'').join('')+rows.map(r=>{const[x,y]=xy(r);return `<circle cx="${x}" cy="${y}" r="3" fill="${color}" data-date="${r.date}" data-value="${r.value}"><title>${date(r.date)}: ${value(r.value,unit)}</title></circle>`;}).join('');
 return `<div class="studyChart"><div class="studyScale"><span>${value(max,unit,0)}</span><span>${value(min,unit,0)}</span></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(unit)} por data; lacunas permanecem sem registros"><path d="M0 12H330 M0 47H330 M0 82H330" stroke="#e5edf5"/>${marks}</svg></div><div class="studyAxis"><span>${date(start)}</span><span>${date(end)}</span></div>`;
}
function reading(b){
 const w=b.metrics.weight_kg,f=b.metrics.fat_mass_kg,s=b.metrics.skeletal_muscle_mass_kg;
 if(w.hasPair&&f.hasPair&&w.delta<0&&f.delta>=0)return 'O peso caiu. A gordura estimada não acompanhou.';
 if(f.hasPair&&s.hasPair&&f.delta<0&&s.delta<0)return 'Gordura e músculo estimados caíram entre as avaliações.';
 if(w.hasPair)return w.delta===0?'O peso registrado se manteve entre as avaliações.':`O peso registrado ${w.delta<0?'caiu':'subiu'} ${value(Math.abs(w.delta),'kg')} entre as avaliações.`;
 return b.latest?'Uma avaliação disponível nesta janela.':'Ainda não há uma comparação corporal nesta janela.';
}
function bodyCard(b){
 const rows=Object.values(b.metrics);
 if(!b.latest)return card('body','Corpo','',empty(b.text));
 if(!b.pair)return card('body','Corpo',date(b.latest.date),rows.map(r=>`<div class="studySingle"><b>${esc(r.label)}</b><strong>${value(r.latest,'kg')}</strong></div>`).join('')+`<p class="studyMeta">Uma avaliação nesta janela.</p>`+detail('Avaliação original',`<p>${esc(b.context)}</p>${button('bio','Abrir avaliação')}`,'body'));
 return card('body','Corpo','Antes → depois',
 `<div class="studyPairDates"><span></span><span>${date(b.first.date).slice(0,5)}</span><span>${date(b.latest.date).slice(0,5)}</span><span>Diferença</span></div>${rows.map(r=>`<div class="studyPair ${r.key}"><b>${esc(r.label)}</b><span>${value(r.first,'kg')}</span><strong>${value(r.latest,'kg')}</strong><em>${signed(r.delta)}</em></div>`).join('')}<p class="studyCaution">Condições das avaliações não confirmadas.</p>`+detail('Avaliações e contexto',`<p>${esc(b.context)}</p>${button('bio','Abrir avaliações originais')}`,'body'));
}
function trainingCard(m){
 const t=m.useful.training,c=t.selected;
 const picker=t.contexts.length?`<label class="studySelect">Exercício<select data-home-field="homeTrainingContext" aria-label="Exercício recorrente">${t.requestedContextMissing?'<option disabled selected>Escolha sem par nesta janela</option>':''}${t.contexts.map(x=>`<option value="${esc(x.key)}" ${x.key===c?.key?'selected':''}>${esc(x.exercise)} · ${esc(x.machine)}</option>`).join('')}</select></label>`:'';
 const allSame=c?.summaries.every(x=>x.delta===0);
 const maxima=Object.fromEntries((c?.summaries||[]).map(x=>[x.unit,Math.max(1,...c.summaries.filter(y=>y.unit===x.unit).flatMap(y=>[y.first.value,y.latest.value]))]));
 const visual=c?`<h3>${esc(c.exercise)}</h3><p class="studyLead">${allSame?'As cargas registradas se mantiveram.':'As cargas registradas mudaram entre as datas.'}</p><p class="studyMeta">${date(c.firstDate)} → ${date(c.lastDate)} · ${esc(c.machine)}</p><p class="studyLoadLegend"><span>Claro: ${date(c.firstDate)}</span><span>Escuro: ${date(c.lastDate)}</span></p>${c.summaries.map(x=>{const max=maxima[x.unit];return `<div class="studyLoad"><b>${value(x.reps,'repetições',0)}</b><div><span style="width:${Math.max(1,100*x.first.value/max)}%">${value(x.first.value,x.unit,0)}</span><span style="width:${Math.max(1,100*x.latest.value/max)}%">${value(x.latest.value,x.unit,0)}</span></div></div>`;}).join('')}<p class="studyCaution">Fase e esforço não confirmados; não mede ganho de força.</p>`:empty(t.selectionMessage||'Não há duas datas sob o mesmo contexto registrado nesta janela.');
 return card('training','Treinos','Registros recorrentes',visual+detail('Exercícios, séries e contexto',picker+`<p>${esc(t.context)}</p>${t.summary.map(x=>`<p><b>${esc(x.exercise)}</b> · ${esc(x.machine)} · ${esc(x.location)}<br>${esc(x.text)}</p>`).join('')}${button('treinos','Ver treinos e séries')}`,'training'));
}
function nutritionCard(m){
 const n=m.useful.nutrition,e=m.evidence.nutrition,k=n.metrics.calories_kcal.overall,p=n.metrics.protein_g.overall;
 const samples=k.samples,range=samples.length?`${value(Math.min(...samples.map(x=>x.value)),'',0)} a ${value(Math.max(...samples.map(x=>x.value)),'kcal/dia',0)}`:null;
 const origin=m.nutrition.source,sourceText=origin?.reviewVerified?'Arquivo conferido':origin?.status==='candidate'?'Origem ainda não validada':origin?.status==='held'?'Origem em revisão':'Origem selecionada';
 const sourceName=(s,i)=>/auto export/i.test(s.label)?'Apple · automático':/myfitnesspal.*export|myfitnesspal.*arquivo/i.test(s.label)?'MyFitnessPal · arquivo':/apple|saúde/i.test(s.label)?'Saúde · arquivo':`Diário ${i+1}`;
 const names=e.sources.map(sourceName);
 const options=e.sources.map((s,i)=>`<option value="${esc(s.key)}" ${s.key===origin?.key?'selected':''}>${esc(names[i])}${names.filter(n=>n===names[i]).length>1?` ${i+1}`:''} · ${s.observedDates.length} dias</option>`).join('');
 const picker=`<label class="studySelect">Período e origem do diário<select data-home-field="reportNutritionSource" aria-label="Origem alimentar">${n.requestedSourceMissing?'<option selected disabled>Origem sem dados nesta janela</option>':''}${options}</select></label>`;
 const visual=k.count?`<div class="studyMetric"><strong>${value(k.mean,'',0)}</strong><span>kcal/dia · média registrada</span></div><p class="studyLead"><b>${value(p.mean,'g de proteína/dia',0)}</b>${range?` · energia de ${range}`:''}</p>${chart(samples,'#e99854','kcal',{bars:true})}<p class="studyMeta">Média dos ${k.count} dias registrados · ${date(k.firstDate)} a ${date(k.lastDate)}. ${origin?.status==='candidate'&&!origin?.reviewVerified?'Origem ainda não validada.':''}</p>`:empty(n.text);
 return card('nutrition','Alimentação',`${k.count} dias observados`,visual+detail('Diário, origens e cobertura',picker+`<p>${esc(n.context)}</p><p>${e.receivedDays??'—'} dias recebidos no conjunto; ${e.missingDays??'—'} ainda não recebidos. A ausência de integração não significa ausência de alimentação.</p>${e.sources.map(s=>`<p><b>${esc(s.label)}</b>: ${s.observedDates.length} dias · ${value(s.means.calories_kcal,'kcal/dia',0)} · ${value(s.means.protein_g,'g de proteína/dia',0)}</p>`).join('')}<p>Origens sobrepostas não são somadas. Médias permanecem separadas.</p>${button('nutricao','Ver diário completo')}`,'nutrition')); 
}
function labsCard(m){
 const h=m.labsHistory,e=h.selected;
 const picker=`<label class="studySelect">Marcador<select data-home-lab-select aria-label="Marcador laboratorial">${h.requestedMissing?'<option disabled selected>Escolha fora desta janela</option>':''}${h.candidates.map(x=>`<option value="${esc(x.key)}" ${x.key===e?.key?'selected':''}>${esc(x.row.biomarker)}</option>`).join('')}</select></label>`;
 const visual=e?`<h3>${esc(e.row.biomarker)}</h3><div class="studyLabPair">${e.previous?`<div><small>${date(e.previous.collection_date)}</small><b>${value(e.previous.result_numeric,e.previous.unit)}</b></div><span aria-hidden="true">→</span>`:''}<div><small>${date(e.row.collection_date)}</small><b>${value(e.row.result_numeric,e.row.unit)}</b></div></div><p class="studyLead">${e.comparable&&e.previous?`Diferença registrada: ${signed(e.delta,e.row.unit==='%'?'p.p.':e.row.unit)}.`:esc(e.comparisonLabel)}</p>${e.priorOutside?'<p class="studyMeta">A coleta anterior está fora do período selecionado.</p>':''}`:empty(h.requestedMissing?'O marcador escolhido não tem resultado nesta janela.':'Sem resultado numérico nesta janela.');
 return card('labs','Exames',e?.document?'Acompanhamento documentado':'Histórico',visual+detail('Laudo, marcador e contexto',picker+(e?`<p>Referência do laudo: ${esc(e.row.reference_range||'Não informada')}.</p><p>${esc(e.comparisonLabel)}. A diferença isolada não define melhora ou piora clínica.</p>${e.history.map(r=>`<p>${date(r.collection_date)}: ${value(r.result_numeric,r.unit)} · ${esc(r.laboratory||'Laboratório não informado')} · ${esc(r.method||'Método não informado')}</p>`).join('')}`:'')+button('saude','Abrir resultados e tendências'),'labs'));
}
function sleepCard(m){
 const s=m.sleep,rows=points(s.points||s.rows),range=rows.length?`${value(Math.min(...rows.map(r=>r.value)),'',1)} a ${value(Math.max(...rows.map(r=>r.value)),'h',1)}`:null;
 return card('sleep','Sono',`${s.count??0} noites registradas`,rows.length?`<div class="studyMetric"><strong>${value(s.mean,'h')}</strong><span>por noite registrada</span></div><p class="studyLead">${range} nas noites observadas.</p>${chart(rows,'#9170ce','h')}<p class="studyMeta">${s.source?.status==='candidate'?'Origem ainda não validada · ':''}${s.count} noites em ${m.bounds.closedDays} dias encerrados.</p>`+detail('Noites e contexto',`<p>Duração registrada, sem estimar qualidade do sono, HRV ou prontidão. Lacunas não são noites sem sono.</p>${button('analise','Ver sono e rotina')}`,'sleep'):empty('Sono indisponível nesta janela.'));
}
function waterCard(m){
 const w=m.water,e=m.evidence.water,last=w.latest,goal=e.goal;
 const validBase=goal&&last&&(!goal.documentedOn||last.date>=goal.documentedOn)&&(!goal.effectiveFrom||last.date>=goal.effectiveFrom);
 const percent=validBase&&goal.value>0?Math.min(100,Math.max(0,100*last.value/goal.value)):null;
 return card('water','Água',last?date(last.date):'',last?`<div class="studyMetric"><strong>${value(last.value,'',0)}</strong><span>mL registrados</span></div>${percent!=null?`<div class="studyWaterFill" aria-label="${value(last.value,'mL',0)} registrados para base de ${value(goal.value,'mL',0)}"><i style="width:${percent}%"></i></div>`:''}${goal?`<p class="studyMeta">Base ${goal.dateBasis==='document_update'?'documentada':'informada'}: ${value(goal.value,'mL',0)}; confira adicionais.</p>`:''}<p class="studyCaution">Registros podem estar incompletos.</p>${chart(e.points,'#3696ee','mL')}`+detail('Consumo e orientação documental',`<p>${esc(goal?.notes||'Não há meta com vigência confirmada para esta janela.')}</p>${goal?`<p>Documento registrado em ${date(goal.documentedOn||goal.effectiveFrom)}. Data de registro não comprova início clínico; referência não aplicada retroativamente.</p>`:''}<p>Valor baixo recebido não comprova baixa ingestão real.</p>${button('nutricao','Ver consumo diário')}`,'water'):empty('Sem água recebida nesta janela.'));
}
export function renderMobileStudy(data,status,period,ui={},today){
 const m=homePeriodModel(data,status,period,ui,today);m.evidence=homeEvidence(data,status,m,ui);m.useful=homeUsefulContent(data,status,m,ui);m.labsHistory=homeLabHistory(data,status,m,ui);
 const b=m.useful.body;
 return `<section class="studyHome" data-mobile-study><header class="studyHeading"><div class="studyBrand">LTS Health <small>Estudo · somente leitura</small></div><div><h1>Sua evolução</h1><select data-home-period-select aria-label="Período da visão geral">${[['30','30 dias'],['90','90 dias'],['365','1 ano'],['all','Histórico']].map(([v,l])=>`<option value="${v}" ${m.period===v?'selected':''}>${l}</option>`).join('')}</select></div><p>${date(m.bounds.start)} a ${date(m.bounds.end)} · hoje parcial</p></header><section class="studyInsight"><small>${b.pair?`Entre avaliações · ${date(b.first.date)} → ${date(b.latest.date)}`:'Avaliações do período'}</small><strong>${esc(reading(b))}</strong><span>Condições das avaliações não confirmadas.</span><button class="studyAction" data-home-insight-details ${b.pair?`data-body-start="${b.first.date}" data-body-end="${b.latest.date}"`:''}>Comparar avaliações e rotina ↗</button></section><div class="studyCards">${bodyCard(b)}${trainingCard(m)}${nutritionCard(m)}${labsCard(m)}${sleepCard(m)}${waterCard(m)}</div><footer class="studyFooter"><button class="studyAction" data-home-consultation>Preparar resumo para consulta ↗</button><small>Estudo de experiência. Os detalhes preservam fontes, datas e limites de cada comparação.</small></footer></section>`;
}
export function renderProductHomeReference(){return renderMobileStudy(state.data,state.domainStatus,state.ui.homePeriod||'90',state.ui);}
