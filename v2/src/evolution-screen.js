import {state,esc,fmtDate,fmtNum,num,bodyRows,workoutRows,neutralDelta,day} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const empty=text=>`<div class="empty">${esc(text)}</div>`;
const metric=(label,value,sub='')=>`<div class="card metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<em>${esc(sub)}</em>`:''}</div>`;
const failed=key=>state.domainStatus[key]==='error';
const unavailable=text=>`<div class="errorState"><b>${esc(text)}</b><span>Os demais dados continuam disponíveis. Tente atualizar para carregar esta parte novamente.</span></div>`;

const metrics={
  weight_kg:{label:'Peso',unit:'kg'},
  skeletal_muscle_mass_kg:{label:'MME',unit:'kg'},
  fat_mass_kg:{label:'Gordura',unit:'kg'},
  body_fat_pct:{label:'Gordura',unit:'%'}
};

function lineChart(rows,key,label){
  const pts=rows.map(r=>({date:r.measured_at,value:num(r[key])})).filter(p=>p.value!=null);
  if(pts.length<2)return empty('Ainda não há pontos suficientes para este gráfico.');
  const values=pts.map(p=>p.value),min0=Math.min(...values),max0=Math.max(...values),span=max0-min0||1,pad=span*.12,min=min0-pad,max=max0+pad,w=960,h=230,p=28;
  const x=i=>p+i*(w-p*2)/Math.max(1,pts.length-1),y=v=>p+(max-v)*(h-p*2)/(max-min||1);
  const path=pts.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(r.value).toFixed(1)}`).join(' ');
  const dots=pts.map((r,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(r.value).toFixed(1)}" r="3.5"/>`).join('');
  return `<div class="evoChart"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path class="gridline" d="M28 58H932 M28 115H932 M28 172H932"/><path class="evoLine" d="${path}"/>${dots}</svg></div><div class="evoAxis"><span>${fmtDate(pts[0].date)}</span><b>${esc(label)}</b><span>${fmtDate(pts.at(-1).date)}</span></div>`;
}

function weeklyCounts(weeks=12){
  const rows=failed('workouts')?[]:workoutRows(),now=new Date();now.setHours(12,0,0,0);const out=[];
  for(let i=weeks-1;i>=0;i--){
    const end=new Date(now);end.setDate(end.getDate()-i*7);const start=new Date(end);start.setDate(start.getDate()-6);
    const a=start.toISOString().slice(0,10),b=end.toISOString().slice(0,10);
    out.push({a,b,label:a.slice(5).replace('-','/'),count:rows.filter(w=>day(w.workout_date)>=a&&day(w.workout_date)<=b).length});
  }
  return out;
}

function segmentBlock(label,right,left,unit='kg'){
  return `<div class="segmentPair"><div><span>Direito</span><b>${fmtNum(right,2)} ${esc(unit)}</b></div><strong>${esc(label)}</strong><div><span>Esquerdo</span><b>${fmtNum(left,2)} ${esc(unit)}</b></div></div>`;
}

function sideDiff(right,left){
  const r=num(right),l=num(left);if(r==null||l==null)return'—';const d=r-l;return`${d>0?'+':''}${fmtNum(d,2)} kg`;
}

function sideDifferences(current){
  return `<div class="sideDifference"><div class="sideDifferenceHead"><b>Diferença entre lados</b><small>D−E, apenas descritivo. Sinal positivo indica valor maior à direita; negativo, à esquerda.</small></div><div class="sideDifferenceGrid">
    <div><span>Braços · massa magra</span><b>${sideDiff(current.lean_right_arm_kg,current.lean_left_arm_kg)}</b></div>
    <div><span>Pernas · massa magra</span><b>${sideDiff(current.lean_right_leg_kg,current.lean_left_leg_kg)}</b></div>
    <div><span>Braços · gordura</span><b>${sideDiff(current.fat_right_arm_kg,current.fat_left_arm_kg)}</b></div>
    <div><span>Pernas · gordura</span><b>${sideDiff(current.fat_right_leg_kg,current.fat_left_leg_kg)}</b></div>
  </div></div>`;
}

function segmentComparison(current,previous){
  if(failed('segmental'))return unavailable('As medições segmentares não carregaram agora.');
  if(!current)return empty('Ainda não há análise segmentar estruturada.');
  const leanRows=[['Braço D','lean_right_arm_kg'],['Braço E','lean_left_arm_kg'],['Tronco','lean_trunk_kg'],['Perna D','lean_right_leg_kg'],['Perna E','lean_left_leg_kg']];
  const fatRows=[['Braço D','fat_right_arm_kg'],['Braço E','fat_left_arm_kg'],['Tronco','fat_trunk_kg'],['Perna D','fat_right_leg_kg'],['Perna E','fat_left_leg_kg']];
  return `<div class="segmentKinds">
    <section><div class="segmentKindTitle"><b>Massa magra segmentar</b><small>Valores registrados em kg.</small></div><div class="segmentSummary">
      ${segmentBlock('Braços',current.lean_right_arm_kg,current.lean_left_arm_kg)}
      ${segmentBlock('Pernas',current.lean_right_leg_kg,current.lean_left_leg_kg)}
      <div class="segmentTrunk"><span>Tronco · massa magra</span><b>${fmtNum(current.lean_trunk_kg,2)} kg</b></div>
    </div></section>
    <section><div class="segmentKindTitle"><b>Gordura segmentar</b><small>Valores registrados em kg.</small></div><div class="segmentSummary">
      ${segmentBlock('Braços',current.fat_right_arm_kg,current.fat_left_arm_kg)}
      ${segmentBlock('Pernas',current.fat_right_leg_kg,current.fat_left_leg_kg)}
      <div class="segmentTrunk"><span>Tronco · gordura</span><b>${fmtNum(current.fat_trunk_kg,2)} kg</b></div>
    </div></section>
  </div>
  ${sideDifferences(current)}
  ${previous?`<div class="segmentDeltaGroup"><div><b>Mudança de massa magra desde ${fmtDate(previous.measured_at)}</b><div class="segmentDelta">${leanRows.map(([label,key])=>`<span>${esc(label)} ${neutralDelta(current[key],previous[key],2,'kg')}</span>`).join('')}</div></div><div><b>Mudança de gordura segmentar desde ${fmtDate(previous.measured_at)}</b><div class="segmentDelta">${fatRows.map(([label,key])=>`<span>${esc(label)} ${neutralDelta(current[key],previous[key],2,'kg')}</span>`).join('')}</div></div></div>`:''}`;
}

function bodyChangeTable(rows){
  if(rows.length<2)return empty('São necessárias pelo menos duas medições corporais para comparar mudanças entre medições.');
  const pairs=rows.slice(1).map((current,i)=>({current,previous:rows[i]})).slice(-12).reverse();
  return `<div class="evolutionChangeTable" role="table" aria-label="Mudança entre medições corporais">
    <div class="changeRow changeHead" role="row"><span>Data</span><span>Peso</span><span>MME</span><span>Δ MME</span><span>Gordura</span><span>Δ gordura</span></div>
    ${pairs.map(({current,previous})=>`<div class="changeRow" role="row"><time>${fmtDate(current.measured_at)}</time><span>${fmtNum(current.weight_kg)} kg</span><span>${fmtNum(current.skeletal_muscle_mass_kg)} kg</span><strong>${neutralDelta(current.skeletal_muscle_mass_kg,previous.skeletal_muscle_mass_kg,1,'kg')}</strong><span>${fmtNum(current.fat_mass_kg)} kg</span><strong>${neutralDelta(current.fat_mass_kg,previous.fat_mass_kg,1,'kg')}</strong></div>`).join('')}
  </div>`;
}

export function renderEvolutionHub(){
  const bodyFailed=failed('body'),segFailed=failed('segmental'),workoutFailed=failed('workouts');
  const body=bodyFailed?[]:bodyRows(),workouts=workoutFailed?[]:workoutRows(),segmental=segFailed?[]:[...(state.data.segmental||[])].sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at)));
  const first=body[0],last=body.at(-1),metricKey=state.ui.evolutionMetric||'weight_kg',meta=metrics[metricKey]||metrics.weight_kg;
  if(!state.ui.segmentalDate||!segmental.some(s=>s.measured_at===state.ui.segmentalDate))state.ui.segmentalDate=segmental.at(-1)?.measured_at||null;
  const currentSeg=segmental.find(s=>s.measured_at===state.ui.segmentalDate),idx=segmental.findIndex(s=>s.measured_at===state.ui.segmentalDate),previousSeg=idx>0?segmental[idx-1]:null;
  const weeks=weeklyCounts(),maxWeek=Math.max(1,...weeks.map(w=>w.count)),failures=[bodyFailed?'composição corporal':null,segFailed?'análise segmentar':null,workoutFailed?'treinos':null].filter(Boolean);
  return `${title('Evolução','Composição corporal, análise segmentar e ritmo de treinos ao longo do tempo.')}
    ${failures.length?`<div class="errorState"><b>Parte da evolução está indisponível agora.</b><span>Não foi possível carregar: ${esc(failures.join(', '))}. O restante continua visível.</span></div>`:''}
    <div class="grid cols4 sectionGap">
      ${metric('Medições corporais',bodyFailed?'—':String(body.length),bodyFailed?'indisponíveis agora':body.length?`${fmtDate(first?.measured_at)} → ${fmtDate(last?.measured_at)}`:'sem registros')}
      ${metric('Análises segmentares',segFailed?'—':String(segmental.length),segFailed?'indisponíveis agora':segmental.length?`última ${fmtDate(segmental.at(-1).measured_at)}`:'sem registros')}
      ${metric('Treinos',workoutFailed?'—':String(workouts.length),workoutFailed?'indisponíveis agora':workouts[0]?`último ${fmtDate(workouts[0].workout_date)}`:'sem registros')}
      ${metric('Intervalo corporal',bodyFailed?'—':first&&last?`${Math.round((new Date(last.measured_at)-new Date(first.measured_at))/86400000)} dias`:'—',bodyFailed?'indisponível agora':'entre primeiro e último registro')}
    </div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Composição corporal</b><small>Escolha uma medida para acompanhar. O gráfico é descritivo.</small></div><div class="segmented">${Object.entries(metrics).map(([key,m])=>`<button type="button" data-evolution-metric="${key}" class="${key===metricKey?'active':''}" ${bodyFailed?'disabled':''}>${esc(m.label)}${key==='body_fat_pct'?' %':''}</button>`).join('')}</div></div>${bodyFailed?unavailable('As medições corporais não carregaram agora.'):lineChart(body,metricKey,`${meta.label} (${meta.unit})`)}${!bodyFailed&&first&&last?`<div class="evoDelta"><span>Primeiro ${fmtNum(first[metricKey])} ${esc(meta.unit)}</span><b>Diferença ${neutralDelta(last[metricKey],first[metricKey],1,meta.unit)}</b><span>Último ${fmtNum(last[metricKey])} ${esc(meta.unit)}</span></div>`:''}</div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Mudança entre medições</b><small>Últimas mudanças consecutivas registradas. Sem classificação de melhor ou pior.</small></div></div>${bodyFailed?unavailable('As medições corporais não carregaram agora.'):bodyChangeTable(body)}</div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Análise segmentar</b><small>Escolha uma das medições disponíveis.</small></div><div class="segmented compactSeg">${segFailed?'':segmental.map(s=>`<button type="button" data-segmental-date="${esc(s.measured_at)}" class="${s.measured_at===state.ui.segmentalDate?'active':''}">${fmtDate(s.measured_at)}</button>`).join('')}</div></div>${segmentComparison(currentSeg,previousSeg)}<p class="footerNote">Diferenças entre datas e lados são descritivas; o app não atribui julgamento estético nem meta a esses valores.</p></div>
      <div class="card"><div class="cardHead"><div><b>Treinos por semana</b><small>Frequência registrada nas últimas 12 semanas.</small></div></div>${workoutFailed?unavailable('Os treinos não carregaram; a frequência semanal não pode ser calculada agora.'):`<div class="weekBars detailed">${weeks.map(w=>`<div><i style="height:${Math.max(4,w.count/maxWeek*100)}%"></i><b>${w.count}</b><span>${esc(w.label)}</span></div>`).join('')}</div>`}</div>
    </div>`;
}
