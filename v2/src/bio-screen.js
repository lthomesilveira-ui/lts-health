import {state,esc,num,fmtNum,fmtDate,neutralDelta,bodyRows} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1>${description?`<p>${esc(description)}</p>`:''}</div></div>`;
const metric=(label,value,unit='',sub='')=>`<div class="card metric"><span>${esc(label)}</span><strong>${esc(value)}${unit?` <small>${esc(unit)}</small>`:''}</strong>${sub?`<em>${esc(sub)}</em>`:''}</div>`;
const empty=text=>`<div class="empty">${esc(text)}</div>`;
const bodyFailed=()=>state.domainStatus.body==='error';

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

function compare(rows){
  if(rows.length<2)return empty('São necessárias pelo menos duas medições para comparar datas.');
  if(!state.ui.compareA||!rows.some(r=>r.measured_at===state.ui.compareA))state.ui.compareA=rows.at(-2).measured_at;
  if(!state.ui.compareB||!rows.some(r=>r.measured_at===state.ui.compareB))state.ui.compareB=rows.at(-1).measured_at;
  const a=rows.find(r=>r.measured_at===state.ui.compareA),b=rows.find(r=>r.measured_at===state.ui.compareB),opts=rows.map(r=>`<option value="${esc(r.measured_at)}">${fmtDate(r.measured_at)}</option>`).join('');
  return `<div class="compareSelectors"><label>De<select id="compareA">${opts}</select></label><label>Até<select id="compareB">${opts}</select></label></div><div class="grid cols2 compact">${metric('Peso',neutralDelta(b?.weight_kg,a?.weight_kg,1,'kg'))}${metric('MME',neutralDelta(b?.skeletal_muscle_mass_kg,a?.skeletal_muscle_mass_kg,1,'kg'))}${metric('Gordura',neutralDelta(b?.body_fat_pct,a?.body_fat_pct,1,'%'))}${metric('InBody',neutralDelta(b?.score,a?.score,0,''))}</div>`;
}

export function renderBioHub(){
  if(bodyFailed())return `${title('Bio','Composição corporal e histórico de bioimpedância.')}<div class="errorState"><b>As medições corporais não carregaram agora.</b><span>O app não substitui essa falha por números zerados. Tente atualizar para carregar o histórico novamente.</span></div>`;
  const rows=bodyRows(),last=rows.at(-1),prev=rows.at(-2),first=rows[0];
  if(!rows.length)return `${title('Bio','Composição corporal e histórico de bioimpedância.')}${empty('Nenhuma medição corporal registrada.')}`;
  const key=state.ui.bioMetric||'weight_kg',meta=metrics[key]||metrics.weight_kg;
  return `${title('Bio','Sua composição corporal, comparação entre datas e histórico completo.')}
    <div class="grid cols4">
      ${metric('Peso',fmtNum(last.weight_kg),'kg',prev?`desde a anterior ${neutralDelta(last.weight_kg,prev.weight_kg,1,'kg')}`:`primeiro registro ${fmtDate(first.measured_at)}`)}
      ${metric('MME',fmtNum(last.skeletal_muscle_mass_kg),'kg',prev?`desde a anterior ${neutralDelta(last.skeletal_muscle_mass_kg,prev.skeletal_muscle_mass_kg,1,'kg')}`:'')}
      ${metric('Gordura',fmtNum(last.body_fat_pct),'%',prev?`desde a anterior ${neutralDelta(last.body_fat_pct,prev.body_fat_pct,1,'%')}`:'')}
      ${metric('Visceral',num(last.visceral_fat_level)==null?'—':fmtNum(last.visceral_fat_level,0),'nível',`medição de ${fmtDate(last.measured_at)}`)}
    </div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Evolução corporal</b><small>Escolha uma medida para acompanhar ao longo do tempo.</small></div><div class="segmented">${Object.entries(metrics).map(([k,m])=>`<button type="button" data-bio-metric="${k}" class="${key===k?'active':''}">${esc(m.label)}${k==='body_fat_pct'?' %':''}</button>`).join('')}</div></div>${lineChart(rows,key,`${meta.label} (${meta.unit})`)}</div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Comparar duas medições</b><small>Diferenças observadas entre as datas escolhidas.</small></div></div>${compare(rows)}</div>
      <div class="card"><div class="cardHead"><div><b>Primeiro e último registro</b><small>Visão descritiva do período completo.</small></div></div><div class="summaryPair"><div><span>${fmtDate(first.measured_at)}</span><b>${fmtNum(first.weight_kg)} kg</b><small>MME ${fmtNum(first.skeletal_muscle_mass_kg)} kg</small></div><div class="arrow">→</div><div><span>${fmtDate(last.measured_at)}</span><b>${fmtNum(last.weight_kg)} kg</b><small>MME ${fmtNum(last.skeletal_muscle_mass_kg)} kg</small></div></div></div>
    </div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Histórico</b><small>Mais recente primeiro. As variações são apresentadas sem classificação estética.</small></div><span class="pill">${rows.length} medições</span></div><div class="list">${[...rows].reverse().map(r=>`<div class="historyRow"><time>${fmtDate(r.measured_at)}</time><div><b>${fmtNum(r.weight_kg)} kg</b><small>MME ${fmtNum(r.skeletal_muscle_mass_kg)} kg · gordura ${fmtNum(r.body_fat_pct)}%${num(r.score)!=null?` · InBody ${fmtNum(r.score,0)}`:''}</small></div><span>${esc(r.source||'origem registrada')}</span></div>`).join('')}</div></div>`;
}
