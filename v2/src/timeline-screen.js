import {state,esc,day,fmtNum,fmtDate,norm,unique,since,num,workoutRows} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const empty=text=>`<div class="empty">${esc(text)}</div>`;
const failed=key=>state.domainStatus[key]==='error';
const metricLabels={sleep_duration_h:'Sono',sleep_in_bed_h:'Tempo na cama',sleep_awake_h:'Tempo acordado',sleep_core_h:'Sono leve/Core',sleep_deep_h:'Sono profundo',sleep_rem_h:'Sono REM',sleep_asleep_unspecified_h:'Sono sem estágio informado',active_energy_kcal:'Energia ativa',exercise_minutes:'Minutos de exercício',stand_hours:'Horas em pé',steps:'Passos',resting_heart_rate_bpm:'Frequência cardíaca em repouso',hrv_sdnn_ms:'Variabilidade da frequência cardíaca',respiratory_rate_bpm:'Frequência respiratória',weight_kg:'Peso',dietary_energy_kcal:'Calorias',dietary_protein_g:'Proteína',dietary_carbs_g:'Carboidratos',dietary_fat_g:'Gorduras',dietary_fiber_g:'Fibras'};
const domainMap={workouts:'Treinos',body:'Composição corporal',labs:'Exames',docs:'Documentos',nutrition:'Alimentação',activity:'Atividade',metrics:'Métricas confirmadas',sourceMetrics:'Registros aguardando conferência',treatments:'Tratamentos'};
const preservedStatuses=new Set(['candidate','held']);
const sourceMetricOrder=['sleep_duration_h','sleep_in_bed_h','sleep_awake_h','sleep_core_h','sleep_deep_h','sleep_rem_h','sleep_asleep_unspecified_h','steps','resting_heart_rate_bpm','hrv_sdnn_ms','respiratory_rate_bpm','weight_kg','dietary_energy_kcal','dietary_protein_g','dietary_carbs_g','dietary_fat_g','dietary_fiber_g'];
const yearOf=value=>String(value||'').slice(0,4);
function unavailable(){return Object.entries(domainMap).filter(([key])=>failed(key)).map(([,label])=>label);}
function sourceDisplay(source='',family=''){
  const text=norm(`${source} ${family}`);
  if(text.includes('myfitnesspal'))return text.includes('apple')?'MyFitnessPal (via Apple Saúde)':'MyFitnessPal';
  if(text.includes('polar'))return'Polar Flow';
  if(text.includes('apple watch')||text.includes('apple_watch'))return'Apple Watch';
  if(text.includes('iphone'))return'iPhone';
  if(text.includes('activitysummary')||text.includes('apple_activity_summary'))return'Apple Saúde';
  if(text.includes('inbody'))return'InBody';
  if(text.includes('workout log')||text.includes('user-reported'))return'Registro de treino';
  if(text.includes('claude migration')||text.includes('lab report'))return'Exame importado';
  if(text==='projeto'||text==='conversa'||text.includes('chatgpt'))return'Histórico LTS Health';
  return String(source||family||'Origem registrada');
}
function bodyEventTitle(row){
  const parts=[];
  if(num(row.weight_kg)!=null)parts.push(`Peso ${fmtNum(row.weight_kg)} kg`);
  if(num(row.skeletal_muscle_mass_kg)!=null)parts.push(`Massa muscular ${fmtNum(row.skeletal_muscle_mass_kg)} kg`);
  return parts.join(' · ')||'Composição corporal registrada';
}
function bodyEventSub(row){return num(row.body_fat_pct)!=null?`Gordura corporal ${fmtNum(row.body_fat_pct)}%`:'';}
function metricValueText(row){
  const value=num(row.value),type=String(row.metric_type||'');
  if(value==null)return'Registro disponível';
  if(type==='steps')return`${fmtNum(value,0)} passos`;
  if(type==='resting_heart_rate_bpm')return`${fmtNum(value,0)} bpm`;
  if(type==='hrv_sdnn_ms')return`${fmtNum(value,0)} ms`;
  if(type==='respiratory_rate_bpm')return`${fmtNum(value,1)} resp./min`;
  if(type.startsWith('sleep_'))return`${fmtNum(value,1)} h`;
  if(type==='weight_kg')return`${fmtNum(value,1)} kg`;
  if(type==='dietary_energy_kcal'||type==='active_energy_kcal')return`${fmtNum(value,0)} kcal`;
  if(type==='exercise_minutes')return`${fmtNum(value,0)} min`;
  if(type==='stand_hours')return`${fmtNum(value,1)} h`;
  if(type.startsWith('dietary_'))return`${fmtNum(value,1)} g`;
  return row.unit?`${fmtNum(value,1)} ${row.unit}`:fmtNum(value,1);
}
function sourceMetricDomain(type){
  type=String(type||'');
  if(type.startsWith('sleep_'))return'Sono em conferência';
  if(type.startsWith('dietary_'))return'Alimentação em conferência';
  return'Métricas em conferência';
}
function sourceMetricTitle(domain){
  if(domain==='Sono em conferência')return'Sono registrado';
  if(domain==='Alimentação em conferência')return'Alimentação registrada';
  return'Métrica registrada';
}
function sourceMetricDetail(row){
  const label=metricLabels[row.metric_type]||'Métrica registrada';
  return`${label} ${metricValueText(row)}`;
}
function sourceMetricEvents(rows=[]){
  const groups=new Map();
  for(const row of rows){
    if(!preservedStatuses.has(norm(row.canonical_status))||!row.metric_date)continue;
    const domain=sourceMetricDomain(row.metric_type),rawSource=row.source_name||row.source_family||'Origem registrada',source=sourceDisplay(row.source_name,row.source_family),key=`${row.metric_date}__${rawSource}__${domain}`;
    if(!groups.has(key))groups.set(key,{date:row.metric_date,domain,title:sourceMetricTitle(domain),source,rows:[]});
    groups.get(key).rows.push(row);
  }
  return[...groups.values()].map(group=>{
    const ordered=[...group.rows].sort((a,b)=>{
      const ai=sourceMetricOrder.indexOf(a.metric_type),bi=sourceMetricOrder.indexOf(b.metric_type),ar=ai<0?999:ai,br=bi<0?999:bi;
      return ar-br||String(a.metric_type).localeCompare(String(b.metric_type));
    });
    const preview=ordered.slice(0,4).map(sourceMetricDetail),more=ordered.length>preview.length?` · + ${ordered.length-preview.length} outro(s) registro(s)`:'';
    return{date:group.date,domain:group.domain,title:group.title,sub:`${preview.join(' · ')}${more} · aguardando conferência; mantido separado dos dados confirmados`,source:group.source};
  });
}
function labCollectionIdentity(row,index){
  const lab=String(row.laboratory||'').trim(),source=String(row.source||'').trim();
  const origin=lab||source||String(row.source_record_id||row.id||`registro-${index}`);
  return{lab,source,origin};
}
function ambiguousDateSet(rows=[],dateKey){
  const counts=new Map();
  for(const row of rows){
    const value=row?.[dateKey];
    if(!value)continue;
    const date=String(value);
    counts.set(date,(counts.get(date)||0)+1);
  }
  return new Set([...counts.entries()].filter(([,count])=>count>1).map(([date])=>date));
}

function events(){
  const out=[];
  if(!failed('workouts'))for(const w of workoutRows())out.push({date:w.workout_date,domain:'Treinos',title:w.workout_type||'Treino',sub:w.location||'',source:sourceDisplay(w.source),route:'treinos',kind:'workout',ref:w.source_record_id});
  if(!failed('body')){
    const rows=state.data.body||[],ambiguous=ambiguousDateSet(rows,'measured_at');
    for(const b of rows){
      const review=ambiguous.has(String(b.measured_at||''));
      out.push({date:b.measured_at,domain:'Composição corporal',title:review?'Composição em revisão':bodyEventTitle(b),sub:review?'Mais de um registro nesta data; valores preservados sem escolha automática.':bodyEventSub(b),source:sourceDisplay(b.source),route:'bio',kind:'body',ref:b.measured_at});
    }
  }
  if(!failed('labs')){
    const collections=new Map();
    for(const [index,row] of (state.data.labs||[]).entries()){
      const {lab,source,origin}=labCollectionIdentity(row,index),key=`${row.collection_date||''}__${origin}`;
      if(!collections.has(key))collections.set(key,{date:row.collection_date,lab,source,rows:[]});
      collections.get(key).rows.push(row);
    }
    for(const [key,c] of collections)out.push({date:c.date,domain:'Exames',title:'Coleta de exames',sub:`${c.rows.length} resultado(s)`,source:c.lab||sourceDisplay(c.source),route:'saude',kind:'labs',ref:key});
  }
  if(!failed('docs'))for(const d of state.data.docs||[])out.push({date:d.document_date,domain:'Documentos',title:d.title||d.document_type||'Documento',sub:d.document_type||'',source:sourceDisplay(d.source),route:'saude',kind:'document',ref:d.source_record_id||''});
  if(!failed('nutrition')){
    const rows=state.data.nutrition||[],ambiguous=ambiguousDateSet(rows,'nutrition_date');
    for(const n of rows){
      const review=ambiguous.has(String(n.nutrition_date||''));
      out.push({date:n.nutrition_date,domain:'Alimentação',title:review?'Alimentação em revisão':n.calories_kcal==null?'Alimentação registrada':`${fmtNum(n.calories_kcal,0)} kcal registradas`,sub:review?'Mais de um total diário nesta data; valores preservados sem escolha automática.':n.protein_g!=null?`${fmtNum(n.protein_g,0)} g de proteína`:'',source:sourceDisplay(n.source),route:'nutricao',kind:'nutrition',ref:n.nutrition_date});
    }
  }
  if(!failed('activity'))for(const a of state.data.activity||[]){const detail=[a.duration_minutes!=null?`${fmtNum(a.duration_minutes,0)} min`:null,a.steps!=null?`${fmtNum(a.steps,0)} passos`:null,a.calories_kcal!=null?`${fmtNum(a.calories_kcal,0)} kcal`:null].filter(Boolean).join(' · ');out.push({date:a.activity_date,domain:'Atividade',title:a.activity_name||a.activity_type||'Atividade registrada',sub:detail,source:sourceDisplay(a.source)});}
  if(!failed('metrics'))for(const m of state.data.metrics||[]){const label=metricLabels[m.metric_type];if(!label)continue;const domain=m.metric_type==='sleep_duration_h'?'Sono':'Métricas confirmadas';out.push({date:day(m.measured_at),domain,title:label,sub:metricValueText(m),source:sourceDisplay(m.source)});}
  if(!failed('sourceMetrics'))out.push(...sourceMetricEvents(state.data.sourceMetrics||[]));
  if(!failed('treatments'))for(const t of state.data.treatments||[])out.push({date:t.event_date,domain:'Tratamentos',title:t.medication||'Tratamento registrado',source:sourceDisplay(t.source),route:'tratamentos',kind:'treatment',ref:t.source_record_id||''});
  return out.filter(e=>e.date).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(a.domain).localeCompare(String(b.domain),'pt-BR'));
}

function item(e){
  const body=`<span>${esc(e.domain)}</span><div><b>${esc(e.title)}</b>${e.sub?`<small>${esc(e.sub)}</small>`:''}${e.source?`<em>${esc(e.source)}</em>`:''}</div>`;
  return e.route?`<button type="button" class="timelineItem rich timelineLink" data-timeline-jump data-timeline-route="${esc(e.route)}" data-timeline-kind="${esc(e.kind||'')}" data-timeline-ref="${esc(e.ref||'')}" data-timeline-date="${esc(e.date)}">${body}</button>`:`<div class="timelineItem rich">${body}</div>`;
}

function crossDomainDays(rows){
  const confirmedRows=rows.filter(e=>!String(e.domain||'').endsWith(' em conferência'));
  const byDate=new Map();
  for(const e of confirmedRows){if(!byDate.has(e.date))byDate.set(e.date,[]);byDate.get(e.date).push(e);}
  return [...byDate.entries()].map(([date,dayRows])=>({date,rows:dayRows,domains:unique(dayRows.map(r=>r.domain)).sort((a,b)=>a.localeCompare(b,'pt-BR'))})).filter(x=>x.domains.length>=2).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}

function contextRow(e){
  const body=`<strong>${esc(e.domain)}</strong><span>${esc(e.title)}</span>`;
  return e.route?`<button type="button" class="timelineContextJump" data-timeline-jump data-timeline-route="${esc(e.route)}" data-timeline-kind="${esc(e.kind||'')}" data-timeline-ref="${esc(e.ref||'')}" data-timeline-date="${esc(e.date)}" aria-label="Abrir ${esc(e.domain)} de ${esc(fmtDate(e.date))}">${body}</button>`:`<div>${body}</div>`;
}
function crossDomainCard(entry){
  const preview=[...entry.rows].sort((a,b)=>Number(!!b.route)-Number(!!a.route)||String(a.domain).localeCompare(String(b.domain),'pt-BR')).slice(0,4);
  return `<article class="timelineContextCard"><div class="timelineContextHead"><div><b>${fmtDate(entry.date)}</b><span>${entry.domains.length} áreas com registros</span></div><div class="timelineDomainChips">${entry.domains.map(d=>`<span>${esc(d)}</span>`).join('')}</div></div><div class="timelineContextRows">${preview.map(contextRow).join('')}</div>${entry.rows.length>preview.length?`<small>+ ${entry.rows.length-preview.length} registro(s) neste dia</small>`:''}</article>`;
}

function domainSummary(rows,missing){
  const counts=new Map();for(const row of rows)counts.set(row.domain,(counts.get(row.domain)||0)+1);
  const cards=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR')).map(([domain,count])=>`<div class="timelineStat"><b>${count}</b><span>${esc(domain)}</span></div>`).join('');
  return `<div class="timelineStats">${cards||'<div class="timelineStat muted"><b>—</b><span>Nenhum registro carregado neste período</span></div>'}${missing.length?'<div class="timelineStat muted"><b>—</b><span>Resumo parcial</span></div>':''}</div>`;
}

export function renderTimelineHub(){
  const all=events(),missing=unavailable(),domain=state.ui.timelineDomain||'all',q=norm(state.ui.timelineQuery),period=state.ui.timelinePeriod||'365',limit=Number(state.ui.timelineLimit||250),cut=period==='all'?null:since(Number(period));
  const domains=['all',...unique(all.map(e=>e.domain)).sort((a,b)=>a.localeCompare(b,'pt-BR'))],years=unique(all.map(e=>yearOf(e.date))).filter(Boolean).sort((a,b)=>b.localeCompare(a));
  if(period==='all'&&(!state.ui.timelineYear||!years.includes(state.ui.timelineYear)))state.ui.timelineYear=years[0]||null;
  const periodRows=all.filter(e=>(!cut||e.date>=cut)&&(period!=='all'||!state.ui.timelineYear||yearOf(e.date)===state.ui.timelineYear));
  const matching=periodRows.filter(e=>(domain==='all'||e.domain===domain)&&(!q||norm(`${e.domain} ${e.title} ${e.sub} ${e.source}`).includes(q)));
  const filtered=matching.slice(0,limit),grouped=new Map();for(const e of filtered){if(!grouped.has(e.date))grouped.set(e.date,[]);grouped.get(e.date).push(e);}
  const contextDays=crossDomainDays(periodRows).slice(0,6);
  return `${title('Timeline','Seu histórico em ordem de data. Registros que ainda precisam de conferência aparecem como existentes, mas ficam separados dos dados já confirmados.')}
    ${missing.length?`<div class="errorState"><b>Parte da Timeline está indisponível agora.</b><span>Não foi possível carregar: ${esc(missing.join(', '))}. Os registros das outras áreas continuam visíveis; atualize para tentar completar a Timeline.</span></div>`:''}
    ${domainSummary(periodRows,missing)}
    <section class="timelineContext sectionGap"><div class="sectionHeading"><div><h2>Visão cruzada por dia</h2><p>Dias em que existem registros de duas ou mais áreas. Toque em um registro para abrir o detalhe. A proximidade na data ajuda a consultar o contexto, mas não demonstra causa entre os registros.</p></div></div>${contextDays.length?`<div class="timelineContextGrid">${contextDays.map(crossDomainCard).join('')}</div>`:empty(missing.length?'Não há dias cruzados entre as áreas que foram carregadas.':'Ainda não há dias com registros em mais de uma área neste período.')}</section>
    <div class="controls sectionGap"><select id="timelinePeriod"><option value="90">90 dias</option><option value="365">1 ano</option><option value="all">Navegar por ano</option></select>${period==='all'?`<select id="timelineYear">${years.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join('')}</select>`:''}<select id="timelineDomain">${domains.map(d=>`<option value="${esc(d)}">${d==='all'?'Todas as áreas':esc(d)}</option>`).join('')}</select><input id="timelineQuery" type="search" placeholder="Buscar no histórico" value="${esc(state.ui.timelineQuery)}"></div>
    <div class="timelineSummary"><b>${filtered.length}</b><span>de ${matching.length} registro(s) encontrados${period==='all'&&state.ui.timelineYear?` em ${esc(state.ui.timelineYear)}`:cut?' no período':''}${missing.length?' entre as áreas carregadas':''}</span></div>
    <div class="timelineGroups sectionGap">${[...grouped.entries()].map(([date,rows])=>`<section class="timelineDay"><div class="timelineDate"><b>${fmtDate(date)}</b><span>${rows.length} registro(s)</span></div><div class="card timelineDayCard">${rows.map(item).join('')}</div></section>`).join('')||empty(missing.length?'Nenhum dos registros carregados corresponde aos filtros.':'Nenhum registro corresponde aos filtros.')}</div>
    ${matching.length>filtered.length?`<div class="loadMore"><button type="button" data-timeline-more>Mostrar mais ${Math.min(250,matching.length-filtered.length)} registros</button></div>`:''}`;
}
