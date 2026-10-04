import {esc,fmtDate,fmtNum,num,norm,day} from './core.js';
import {labGroups,labCohorts,labResultText} from './labs-layout-v2.js';

export const healthTimeZone='America/Sao_Paulo';
export function localHealthDay(value=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:healthTimeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);
  const get=type=>parts.find(part=>part.type===type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export const inHealthWindow=(value,bounds)=>Boolean(day(value)&&(!bounds?.start||day(value)>=bounds.start)&&(!bounds?.end||day(value)<=bounds.end));
export function bodySourceLabel(row){
  const device=String(row?.device_name||'').trim();
  if(device)return device;
  const source=String(row?.source_name||row?.source||'').trim();
  return norm(source).includes('inbody')?'InBody · modelo não informado':source||'Origem não informada';
}
export function medicationContext(row){
  const site={abdomen:'abdômen',glute:'glúteo'}[row?.recorded_site]||'',side={left:'esquerdo',right:'direito'}[row?.recorded_side]||'';
  return [row?.local_time?`${row.local_time}${row.recorded_timezone===healthTimeZone?' · Brasília':''}`:'Horário não informado',site&&side?`${site} ${side}`:'Local/lado não informado'].join(' · ');
}
export const labHighlights=['Hemoglobina Glicada (A1C)','LDL-Colesterol','HDL-Colesterol','Triglicérides','Hemoglobina','Hematócrito','Ferritina','25-OH Vitamina D Total','Testosterona Total','Estradiol','TGO (AST)','TGP (ALT)'];
export function latestLabRows(rows=[]){
  const date=rows.map(r=>day(r.collection_date)).filter(Boolean).sort().at(-1)||null;
  return {date,rows:rows.filter(r=>day(r.collection_date)===date)};
}
export function highlightedLabs(rows=[],date=null){
  const collection=date||latestLabRows(rows).date;
  return labHighlights.map(label=>{
    const matching=rows.filter(r=>norm(r.biomarker)===norm(label)&&day(r.collection_date)===collection);
    return matching.length===1?matching[0]:null;
  }).filter(Boolean);
}
export function labTrend(rows=[],requested,bounds){
  const groups=labGroups(rows),preferred=labHighlights.map(label=>groups.find(g=>g.key===norm(label))).filter(Boolean),available=[...preferred,...groups.filter(g=>!preferred.includes(g))];
  const group=groups.find(g=>g.key===requested)||available[0];
  if(!group)return {label:'Exames',unit:'',points:[],available};
  const cohorts=labCohorts(group),current=cohorts[0],points=cohorts.filter(c=>c.unit===current.unit).flatMap(c=>c.rows.map(r=>({date:day(r.collection_date),value:num(r.result_numeric),cohort:c.method?c.key:null,context:`${c.origin} · ${c.method||'método não informado'}`,raw:labResultText(r)}))).filter(p=>inHealthWindow(p.date,bounds)).sort((a,b)=>a.date.localeCompare(b.date));
  return {label:group.label,key:group.key,unit:current?.unit||'',points,available};
}
function dailyUnique(rows,dateKey,valueKey,bounds,cohort=()=>null){
  const dates=new Map();
  for(const row of rows){if(!inHealthWindow(row[dateKey],bounds))continue;const key=day(row[dateKey]);if(!dates.has(key))dates.set(key,[]);dates.get(key).push(row);}
  return [...dates].filter(([,list])=>list.length===1&&num(list[0][valueKey])!=null).map(([date,[row]])=>({date,value:num(row[valueKey]),cohort:cohort(row),context:bodySourceLabel(row)})).sort((a,b)=>a.date.localeCompare(b.date));
}
export const bodyMetricSeries=(rows,key,bounds)=>dailyUnique(rows,'measured_at',key,bounds,row=>norm(row.source)?JSON.stringify([row.source,row.device_name||'']):null);
export function healthContextModel(data,bounds,requestedLab,requestedDate){
  const body=bodyMetricSeries(data.body||[],'body_fat_pct',bounds);
  const protein=dailyUnique(data.nutrition||[],'nutrition_date','protein_g',bounds,()=> 'daily-nutrition');
  const workouts=(data.workouts||[]).filter(r=>r.is_canonical===true&&r.record_status!=='quarantined'&&inHealthWindow(r.workout_date,bounds));
  const dates=new Map();for(const row of workouts){const key=day(row.workout_date);if(!dates.has(key))dates.set(key,[]);dates.get(key).push(row);}
  const training=[...dates].filter(([,list])=>list.every(r=>num(r.duration_minutes)!=null)).map(([date,list])=>({date,value:list.reduce((sum,r)=>sum+num(r.duration_minutes),0),cohort:'canonical-training'})).sort((a,b)=>a.date.localeCompare(b.date));
  const lab=labTrend(data.labs||[],requestedLab,bounds);
  const eventDates=[...(data.body||[]).map(r=>r.measured_at),...(data.nutrition||[]).map(r=>r.nutrition_date),...workouts.map(r=>r.workout_date),...(data.labs||[]).map(r=>r.collection_date),...(data.treatments||[]).map(r=>r.event_date)].map(day).filter(d=>inHealthWindow(d,bounds));
  const availableDates=[...new Set(eventDates)].sort();
  // An unbounded history still needs one shared calendar axis, not four
  // independent starts that make the same date appear in different places.
  const sharedBounds={...bounds,start:bounds?.start||availableDates[0]||null};
  const selectedDate=availableDates.includes(requestedDate)?requestedDate:availableDates.at(-1)||null;
  const dateRows=(key,dateKey)=>(data[key]||[]).filter(r=>day(r[dateKey])===selectedDate);
  return {bounds:sharedBounds,body,protein,training,lab,availableDates,selectedDate,selected:{body:dateRows('body','measured_at'),nutrition:dateRows('nutrition','nutrition_date'),workouts:workouts.filter(r=>day(r.workout_date)===selectedDate),labs:dateRows('labs','collection_date'),treatments:dateRows('treatments','event_date')}};
}

// Calendar-proportional axes; absent days are not zeroes. Never connect different cohorts.
export function contextChart(points,{label='',unit='',digits=1,bounds=null,selectedDate=null,selectable=true,bar=false}={}){
  const rows=points.filter(p=>p.date&&num(p.value)!=null).sort((a,b)=>a.date.localeCompare(b.date));
  if(!rows.length)return '<div class="ltsContextEmpty" role="status">Nenhum registro nesta janela.</div>';
  const values=rows.map(p=>p.value),low=bar?0:Math.min(...values),high=Math.max(...values),span=high-low||Math.max(Math.abs(high)*.05,.1),min=bar?0:low-span*.15,max=high+span*.15;
  const width=600,height=160,left=55,right=12,top=12,bottom=25;
  const start=bounds?.start||rows[0].date,end=bounds?.end||rows.at(-1).date,time=d=>Date.parse(`${day(d)}T12:00:00Z`),duration=time(end)-time(start);
  const x=p=>duration?left+(time(p.date)-time(start))/duration*(width-left-right):(left+width-right)/2;
  const y=v=>top+(max-v)/(max-min)*(height-top-bottom);
  const lines=bar?'':rows.slice(1).map((p,i)=>{const previous=rows[i];return p.cohort&&p.cohort===previous.cohort&&p.date!==previous.date?`<path class="ltsContextLine" d="M${x(previous).toFixed(1)} ${y(previous.value).toFixed(1)}L${x(p).toFixed(1)} ${y(p.value).toFixed(1)}"/>`:'';}).join('');
  const ticks=[high,(low+high)/2,low].filter((value,index,list)=>list.indexOf(value)===index);
  const marks=rows.map(p=>`${selectable?`<a href="#" data-health-date="${esc(p.date)}" aria-label="${esc(`${fmtDate(p.date)}: ${fmtNum(p.value,digits)} ${unit}; consultar este dia`)}">`:'<g>'}<circle class="${p.date===selectedDate?'selected':''}" cx="${x(p).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="${p.date===selectedDate?5:3.5}"><title>${esc(`${fmtDate(p.date)}: ${p.raw||`${fmtNum(p.value,digits)} ${unit}`} · ${p.context||label}`)}</title></circle>${selectable?'</a>':'</g>'}`).join('');
  const guide=selectedDate&&inHealthWindow(selectedDate,{start,end})?`<line class="ltsContextGuide" x1="${x({date:selectedDate})}" x2="${x({date:selectedDate})}" y1="${top}" y2="${height-bottom}"/>`:'';
  const bars=bar?rows.map(p=>`${selectable?`<a href="#" data-health-date="${esc(p.date)}" aria-label="${esc(`${fmtDate(p.date)}: ${fmtNum(p.value,digits)} ${unit}`)}">`:'<g>'}<rect x="${x(p)-9}" y="${y(p.value)}" width="18" height="${Math.max(1,y(0)-y(p.value))}" rx="3"><title>${esc(`${fmtDate(p.date)}: ${fmtNum(p.value,digits)} ${unit}`)}</title></rect>${selectable?'</a>':'</g>'}`).join(''):marks;
  return `<div class="ltsContextPlot"><svg viewBox="0 0 ${width} ${height}" role="${selectable?'group':'img'}" aria-label="${esc(`${label}; ${rows.length} registros; ${unit}; intervalos proporcionais às datas`)}">${ticks.map(v=>`<line class="ltsContextGrid" x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-7}" y="${y(v)+4}" text-anchor="end">${esc(fmtNum(v,digits))}</text>`).join('')}${guide}${lines}<g class="ltsRefTrendMarks">${bars}</g></svg><div class="ltsContextAxis"><span>${fmtDate(start)}</span><span>${fmtDate(end)}</span></div></div>`;
}
export function renderHealthContext(m,status={}){
  const panels=[['body','Gordura corporal',m.body,'%',1,'bio'],['nutrition','Proteína registrada',m.protein,'g',0,'nutricao'],['workouts','Tempo de treino',m.training,'min',0,'treinos'],['labs',m.lab.label,m.lab.points,m.lab.unit,2,'saude']];
  const panel=([key,label,points,unit,digits,route])=>{const last=points.at(-1);return `<article class="ltsContextPanel ${key}"><header><h3>${esc(label)}</h3><button data-route="${route}" aria-label="Abrir detalhes de ${esc(label)}">Detalhes ›</button></header><p><b>${status[key]==='error'?'Indisponível':last?`${fmtNum(last.value,digits)} ${esc(unit)}`:'Sem dados'}</b><small>${last?fmtDate(last.date):'No período selecionado'}</small></p>${status[key]==='error'?'<div class="ltsContextEmpty" role="alert">Falha ao carregar; use Atualizar.</div>':contextChart(points,{label,unit,digits,bounds:m.bounds,selectedDate:m.selectedDate})}</article>`;};
  const selected=m.selected,b=selected.body.length===1?selected.body[0]:null,n=selected.nutrition.length===1?selected.nutrition[0]:null;
  const facts=[['Composição',b?`${fmtNum(b.weight_kg,1)} kg · ${fmtNum(b.body_fat_pct,1)}% gordura · ${bodySourceLabel(b)}`:selected.body.length?'Mais de uma medição: consulte os detalhes.':'Sem medição neste dia.','bio','body'],['Alimentação',n?`${fmtNum(n.calories_kcal,0)} kcal · ${fmtNum(n.protein_g,0)} g proteína`:selected.nutrition.length?'Totais conflitantes: consulte os detalhes.':'Sem alimentação registrada neste dia.','nutricao','nutrition'],['Treino',selected.workouts.length?selected.workouts.map(r=>`${r.workout_type||'Treino'} · ${num(r.duration_minutes)==null?'duração não informada':`${fmtNum(r.duration_minutes,0)} min`}`).join('; '):'Sem treino registrado neste dia.','treinos','workouts'],['Medicações',selected.treatments.length?selected.treatments.map(r=>`${r.medication} · ${medicationContext(r)}`).join('; '):'Nenhuma aplicação registrada neste dia.','tratamentos','treatments']];
  const labs=highlightedLabs(selected.labs,m.selectedDate).slice(0,4);
  return `<section class="ltsHealthContext"><header><div><span>MESMA JANELA · MESMA LINHA DO TEMPO</span><h2>Seu histórico, lado a lado</h2><p>Toque em um ponto para consultar o mesmo dia nos outros domínios. Proximidade no tempo não indica causa e efeito.</p></div></header><label class="ltsField">Marcador no painel<select id="homeLabMarker">${m.lab.available.map(g=>`<option value="${esc(g.key)}" ${g.key===m.lab.key?'selected':''}>${esc(g.label)}</option>`).join('')}</select></label><div class="ltsContextGridPanels">${panels.map(panel).join('')}</div><div class="ltsContextDay"><label class="ltsField">Consultar dia com registros<select id="healthContextDate" ${m.availableDates.length?'':'disabled'}>${m.availableDates.length?[...m.availableDates].reverse().map(d=>`<option value="${d}" ${d===m.selectedDate?'selected':''}>${fmtDate(d)}</option>`).join(''):'<option>Sem registros nesta janela</option>'}</select></label><div class="ltsContextFacts">${facts.map(([title,text,route,key])=>`<button data-route="${route}"><b>${title}</b><span>${status[key]==='error'?'Dados indisponíveis nesta atualização.':esc(text)}</span></button>`).join('')}${selected.labs.length?`<button data-route="saude"><b>Exames deste dia</b><span>${esc(labs.length?labs.map(r=>`${r.biomarker}: ${labResultText(r)}`).join(' · '):'Resultados disponíveis na tela Exames.')}</span></button>`:''}</div></div><p class="ltsDepthNote">Último valor dentro da janela em cada painel, com sua data. Pontos isolados continuam visíveis. Para pontos muito próximos, use o seletor de dia ou o teclado. Curvas não unem métodos ou origens diferentes; ausência de registro não significa zero.</p></section>`;
}
