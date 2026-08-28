import {state,esc,day,fmtNum,fmtDate,norm,unique,since} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const empty=text=>`<div class="empty">${esc(text)}</div>`;
const failed=key=>state.domainStatus[key]==='error';
const metricLabels={sleep_duration_h:'Sono',active_energy_kcal:'Energia ativa',exercise_minutes:'Minutos de exercício',stand_hours:'Horas em pé',steps:'Passos',resting_heart_rate:'FC de repouso',weight_kg:'Peso'};
const domainMap={workouts:'Treinos',body:'Composição',labs:'Exames',docs:'Documentos',nutrition:'Alimentação',activity:'Atividade',metrics:'Sono e métricas',treatments:'Tratamentos'};
function unavailable(){return Object.entries(domainMap).filter(([key])=>failed(key)).map(([,label])=>label);}

function events(){
  const out=[];
  if(!failed('workouts'))for(const w of state.data.workouts||[])out.push({date:w.workout_date,domain:'Treinos',title:w.workout_type||'Treino',sub:w.location||'',source:w.source||''});
  if(!failed('body'))for(const b of state.data.body||[])out.push({date:b.measured_at,domain:'Composição',title:`Peso ${fmtNum(b.weight_kg)} kg · MME ${fmtNum(b.skeletal_muscle_mass_kg)} kg`,sub:`Gordura registrada ${fmtNum(b.body_fat_pct)}%`,source:b.source||''});
  if(!failed('labs'))for(const d of unique((state.data.labs||[]).map(l=>l.collection_date))){const rows=(state.data.labs||[]).filter(l=>l.collection_date===d);out.push({date:d,domain:'Exames',title:'Coleta laboratorial',sub:`${rows.length} resultado(s)`,source:unique(rows.map(r=>r.laboratory)).join(', ')});}
  if(!failed('docs'))for(const d of state.data.docs||[])out.push({date:d.document_date,domain:'Documentos',title:d.title||d.document_type||'Documento',sub:d.document_type||'',source:d.source||''});
  if(!failed('nutrition'))for(const n of state.data.nutrition||[])out.push({date:n.nutrition_date,domain:'Alimentação',title:n.calories_kcal==null?'Alimentação registrada':`${fmtNum(n.calories_kcal,0)} kcal registradas`,sub:n.protein_g!=null?`${fmtNum(n.protein_g,0)} g proteína`:'' ,source:n.source||''});
  if(!failed('activity'))for(const a of state.data.activity||[]){const detail=[a.duration_minutes!=null?`${fmtNum(a.duration_minutes,0)} min`:null,a.steps!=null?`${fmtNum(a.steps,0)} passos`:null,a.calories_kcal!=null?`${fmtNum(a.calories_kcal,0)} kcal`:null].filter(Boolean).join(' · ');out.push({date:a.activity_date,domain:'Atividade',title:a.activity_name||a.activity_type||'Atividade registrada',sub:detail,source:a.source||''});}
  if(!failed('metrics'))for(const m of state.data.metrics||[]){const label=metricLabels[m.metric_type];if(!label)continue;const domain=m.metric_type==='sleep_duration_h'?'Sono':'Métricas';out.push({date:day(m.measured_at),domain,title:label,sub:`${fmtNum(m.value,m.metric_type==='steps'?0:1)} ${m.unit||''}`.trim(),source:m.source||''});}
  if(!failed('treatments'))for(const t of state.data.treatments||[])out.push({date:t.event_date,domain:'Tratamentos',title:t.medication||'Tratamento registrado',sub:'Confirmação registrada',source:t.source||''});
  return out.filter(e=>e.date).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(a.domain).localeCompare(String(b.domain),'pt-BR'));
}

export function renderTimelineHub(){
  const all=events(),missing=unavailable(),domain=state.ui.timelineDomain||'all',q=norm(state.ui.timelineQuery),period=state.ui.timelinePeriod||'365',limit=Number(state.ui.timelineLimit||250),cut=period==='all'?null:since(Number(period));
  const domains=['all',...unique(all.map(e=>e.domain)).sort((a,b)=>a.localeCompare(b,'pt-BR'))];
  const matching=all.filter(e=>(!cut||e.date>=cut)&&(domain==='all'||e.domain===domain)&&(!q||norm(`${e.domain} ${e.title} ${e.sub} ${e.source}`).includes(q)));
  const filtered=matching.slice(0,limit),grouped=new Map();for(const e of filtered){if(!grouped.has(e.date))grouped.set(e.date,[]);grouped.get(e.date).push(e);}
  return `${title('Timeline','Seu histórico em ordem de data. Atividade geral e treinos continuam separados para evitar dupla contagem.')}
    ${missing.length?`<div class="errorState"><b>Parte da Timeline está indisponível agora.</b><span>Não foi possível carregar: ${esc(missing.join(', '))}. Os registros das outras áreas continuam visíveis; atualize para tentar completar a Timeline.</span></div>`:''}
    <div class="controls sectionGap"><select id="timelinePeriod"><option value="90">90 dias</option><option value="365">1 ano</option><option value="all">Todo histórico</option></select><select id="timelineDomain">${domains.map(d=>`<option value="${esc(d)}">${d==='all'?'Todas as áreas':esc(d)}</option>`).join('')}</select><input id="timelineQuery" type="search" placeholder="Buscar no histórico" value="${esc(state.ui.timelineQuery)}"></div>
    <div class="timelineSummary"><b>${filtered.length}</b><span>de ${matching.length} registro(s) encontrados${cut?' no período':''}</span></div>
    <div class="timelineGroups sectionGap">${[...grouped.entries()].map(([date,rows])=>`<section class="timelineDay"><div class="timelineDate"><b>${fmtDate(date)}</b><span>${rows.length} registro(s)</span></div><div class="card timelineDayCard">${rows.map(e=>`<div class="timelineItem rich"><span>${esc(e.domain)}</span><div><b>${esc(e.title)}</b>${e.sub?`<small>${esc(e.sub)}</small>`:''}${e.source?`<em>${esc(e.source)}</em>`:''}</div></div>`).join('')}</div></section>`).join('')||empty(missing.length?'Nenhum dos registros carregados corresponde aos filtros.':'Nenhum registro corresponde aos filtros.')}</div>
    ${matching.length>filtered.length?`<div class="loadMore"><button type="button" data-timeline-more>Mostrar mais ${Math.min(250,matching.length-filtered.length)} registros</button></div>`:''}`;
}
