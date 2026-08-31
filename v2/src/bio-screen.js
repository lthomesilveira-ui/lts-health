import {state,esc,num,fmtNum,fmtDate,neutralDelta,bodyRows,norm} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1>${description?`<p>${esc(description)}</p>`:''}</div></div>`;
const metric=(label,value,unit='',sub='')=>`<div class="card metric"><span>${esc(label)}</span><strong>${esc(value)}${unit?` <small>${esc(unit)}</small>`:''}</strong>${sub?`<em>${esc(sub)}</em>`:''}</div>`;
const empty=text=>`<div class="empty">${esc(text)}</div>`;
const bodyFailed=()=>state.domainStatus.body==='error';

const metrics={
  weight_kg:{label:'Peso',unit:'kg'},
  skeletal_muscle_mass_kg:{label:'Massa muscular',unit:'kg'},
  fat_mass_kg:{label:'Massa de gordura',unit:'kg'},
  body_fat_pct:{label:'Gordura corporal',unit:'%'}
};
function sourceDisplay(source=''){
  const text=norm(source);
  if(text.includes('inbody'))return'InBody';
  if(text.includes('bioimpedance'))return'Bioimpedância';
  return source||'Origem registrada';
}

function chartGeometry(rows,key,{width=960,height=238,padLeft=54,padRight=22,padY=24}={}){
  const pts=rows.map(r=>({date:r.measured_at,value:num(r[key])})).filter(p=>p.value!=null);
  if(pts.length<2)return null;
  const values=pts.map(p=>p.value),rawMin=Math.min(...values),rawMax=Math.max(...values),span=rawMax-rawMin||Math.max(Math.abs(rawMax)*.08,.5),pad=span*.14,min=rawMin-pad,max=rawMax+pad;
  const x=i=>padLeft+i*(width-padLeft-padRight)/Math.max(1,pts.length-1),y=v=>padY+(max-v)*(height-padY*2)/(max-min||1);
  return{pts,values,rawMin,rawMax,min,max,width,height,padLeft,padRight,padY,x,y};
}

function lineChart(rows,key,label,unit){
  const g=chartGeometry(rows,key);if(!g)return empty('Ainda não há pontos suficientes para este gráfico.');
  const{pts,rawMin,rawMax,width,height,padLeft,padRight,x,y}=g,mid=(rawMax+rawMin)/2;
  const path=pts.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(r.value).toFixed(1)}`).join(' ');
  const dots=pts.map((r,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(r.value).toFixed(1)}" r="3.8"><title>${esc(fmtDate(r.date))}: ${esc(fmtNum(r.value,1))} ${esc(unit)}</title></circle>`).join('');
  const last=pts.at(-1),first=pts[0];
  return `<div class="bioChartWrap">
    <div class="bioChartY"><span>${fmtNum(rawMax,1)} ${esc(unit)}</span><span>${fmtNum(mid,1)} ${esc(unit)}</span><span>${fmtNum(rawMin,1)} ${esc(unit)}</span></div>
    <div class="evoChart bioChart"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${esc(label)} ao longo do tempo"><path class="gridline" d="M${padLeft} 58H${width-padRight} M${padLeft} 119H${width-padRight} M${padLeft} 180H${width-padRight}"/><path class="evoLine" d="${path}"/>${dots}<text class="bioPointLabel" x="${x(0)+7}" y="${Math.max(15,y(first.value)-8)}">${esc(fmtNum(first.value,1))}</text><text class="bioPointLabel last" x="${Math.max(padLeft,x(pts.length-1)-48)}" y="${Math.max(15,y(last.value)-8)}">${esc(fmtNum(last.value,1))}</text></svg></div>
  </div><div class="evoAxis"><span>${fmtDate(first.date)}</span><b>${esc(label)} (${esc(unit)})</b><span>${fmtDate(last.date)}</span></div>`;
}

function miniSeries(rows,key,label,unit){
  const g=chartGeometry(rows,key,{width:380,height:92,padLeft:12,padRight:12,padY:12});
  if(!g)return'';
  const{pts,x,y}=g,path=pts.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(r.value).toFixed(1)}`).join(' '),first=pts[0],last=pts.at(-1),change=last.value-first.value;
  return `<article class="bioMiniSeries"><div><span>${esc(label)}</span><b>${fmtNum(last.value,1)} ${esc(unit)}</b><small>${change>0?'+':''}${fmtNum(change,1)} ${esc(unit)} no período exibido</small></div><svg viewBox="0 0 380 92" preserveAspectRatio="none"><path class="bioMiniGrid" d="M12 46H368"/><path class="bioMiniLine" d="${path}"/>${pts.map((p,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="2.8"><title>${esc(fmtDate(p.date))}: ${esc(fmtNum(p.value,1))} ${esc(unit)}</title></circle>`).join('')}</svg><div class="bioMiniAxis"><span>${fmtDate(first.date)}</span><span>${fmtDate(last.date)}</span></div></article>`;
}

function combinedView(rows){
  const recent=rows.slice(-12);
  const cards=[
    miniSeries(recent,'skeletal_muscle_mass_kg','Massa muscular','kg'),
    miniSeries(recent,'fat_mass_kg','Massa de gordura','kg'),
    miniSeries(recent,'body_fat_pct','Gordura corporal','%'),
    miniSeries(recent,'weight_kg','Peso','kg')
  ].filter(Boolean);
  return cards.length?`<div class="bioCombinedGrid">${cards.join('')}</div><p class="footerNote">As quatro séries compartilham as mesmas datas, mas cada gráfico usa sua própria escala para não misturar kg e percentual.</p>`:empty('Ainda não há pontos suficientes para a visão combinada.');
}

function daysBetween(a,b){
  const start=Date.parse(`${String(a||'').slice(0,10)}T12:00:00Z`),end=Date.parse(`${String(b||'').slice(0,10)}T12:00:00Z`);
  if(!Number.isFinite(start)||!Number.isFinite(end))return null;
  return Math.round((end-start)/86400000);
}
function compareOptions(rows,selected){return rows.map(r=>`<option value="${esc(r.measured_at)}"${r.measured_at===selected?' selected':''}>${fmtDate(r.measured_at)}</option>`).join('');}
function compare(rows){
  if(rows.length<2)return empty('São necessárias pelo menos duas medições para comparar datas.');
  if(!state.ui.compareA||!rows.some(r=>r.measured_at===state.ui.compareA))state.ui.compareA=rows.at(-2).measured_at;
  if(!state.ui.compareB||!rows.some(r=>r.measured_at===state.ui.compareB))state.ui.compareB=rows.at(-1).measured_at;
  const selectors=`<div class="compareSelectors"><label>De<select id="compareA">${compareOptions(rows,state.ui.compareA)}</select></label><label>Até<select id="compareB">${compareOptions(rows,state.ui.compareB)}</select></label></div>`;
  if(state.ui.compareA===state.ui.compareB)return `${selectors}<p class="compareContext">Mesma data</p>${empty('Escolha duas datas diferentes para comparar.')}`;
  const a=rows.find(r=>r.measured_at===state.ui.compareA),b=rows.find(r=>r.measured_at===state.ui.compareB),interval=daysBetween(state.ui.compareA,state.ui.compareB);
  const intervalText=interval==null?'':`${Math.abs(interval)} dia${Math.abs(interval)===1?'':'s'} entre as medições${interval<0?' · ordem invertida':''}`;
  return `${selectors}${intervalText?`<p class="compareContext">${esc(intervalText)}</p>`:''}<div class="grid cols2 compact">${metric('Peso',neutralDelta(b?.weight_kg,a?.weight_kg,1,'kg'))}${metric('Massa muscular',neutralDelta(b?.skeletal_muscle_mass_kg,a?.skeletal_muscle_mass_kg,1,'kg'))}${metric('Massa de gordura',neutralDelta(b?.fat_mass_kg,a?.fat_mass_kg,1,'kg'))}${metric('Gordura corporal',neutralDelta(b?.body_fat_pct,a?.body_fat_pct,1,'%'))}${metric('Pontuação InBody',neutralDelta(b?.score,a?.score,0,''))}</div>`;
}
function detailValue(label,value,unit=''){return `<div><span>${esc(label)}</span><b>${value==null?'—':`${fmtNum(value,Number.isInteger(num(value))?0:1)}${unit?` ${esc(unit)}`:''}`}</b></div>`;}
function measurementDetail(row){
  if(!row)return empty('Selecione uma medição no histórico.');
  return `<div class="bioDetailHead"><div><span>${fmtDate(row.measured_at)}</span><b>Detalhes da medição</b><small>${esc(sourceDisplay(row.source))}</small></div></div>
    <div class="bioDetailGrid">
      ${detailValue('Peso',row.weight_kg,'kg')}${detailValue('Massa muscular',row.skeletal_muscle_mass_kg,'kg')}${detailValue('Massa de gordura',row.fat_mass_kg,'kg')}${detailValue('Gordura corporal',row.body_fat_pct,'%')}
      ${detailValue('Água corporal',row.body_water_l,'L')}${detailValue('Gordura visceral',row.visceral_fat_level,'nível')}${detailValue('Relação cintura/quadril',row.waist_hip_ratio,'')}${detailValue('Metabolismo basal',row.bmr_kcal,'kcal')}${detailValue('Pontuação InBody',row.score,'')}
    </div>${row.notes?`<p class="footerNote">${esc(row.notes)}</p>`:''}`;
}

export function renderBioHub(){
  if(bodyFailed())return `${title('Composição corporal','Histórico de bioimpedância e evolução das medições.')}<div class="errorState"><b>As medições corporais não carregaram agora.</b><span>O app não substitui essa falha por números zerados. Tente atualizar para carregar o histórico novamente.</span></div>`;
  const rows=bodyRows(),last=rows.at(-1),prev=rows.at(-2),first=rows[0];
  if(!rows.length)return `${title('Composição corporal','Histórico de bioimpedância e evolução das medições.')}${empty('Nenhuma medição corporal foi encontrada no histórico carregado.')}`;
  const key=state.ui.bioMetric||'weight_kg',meta=metrics[key]||metrics.weight_kg;
  if(!state.ui.selectedBodyDate||!rows.some(r=>r.measured_at===state.ui.selectedBodyDate))state.ui.selectedBodyDate=last.measured_at;
  const selected=rows.find(r=>r.measured_at===state.ui.selectedBodyDate);
  return `${title('Composição corporal','Valores, escalas e comparação entre medidas ao longo do tempo.')}
    <div class="note"><b>Última medição · ${fmtDate(last.measured_at)}</b><span>${rows.length} medição(ões) no histórico. Os números dos gráficos agora aparecem na escala e nos pontos.</span></div>
    <div class="grid cols4 sectionGap">
      ${metric('Peso',fmtNum(last.weight_kg),'kg',prev?`desde a anterior ${neutralDelta(last.weight_kg,prev.weight_kg,1,'kg')}`:`primeiro registro ${fmtDate(first.measured_at)}`)}
      ${metric('Massa muscular',fmtNum(last.skeletal_muscle_mass_kg),'kg',prev?`desde a anterior ${neutralDelta(last.skeletal_muscle_mass_kg,prev.skeletal_muscle_mass_kg,1,'kg')}`:'')}
      ${metric('Massa de gordura',fmtNum(last.fat_mass_kg),'kg',prev?`desde a anterior ${neutralDelta(last.fat_mass_kg,prev.fat_mass_kg,1,'kg')}`:'')}
      ${metric('Gordura corporal',fmtNum(last.body_fat_pct),'%',prev?`desde a anterior ${neutralDelta(last.body_fat_pct,prev.body_fat_pct,1,'%')}`:'')}
    </div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Evolução corporal</b><small>Escolha uma medida; escala, datas e valores ficam explícitos.</small></div><div class="segmented">${Object.entries(metrics).map(([k,m])=>`<button type="button" data-bio-metric="${k}" class="${key===k?'active':''}">${esc(m.label)}${k==='body_fat_pct'?' %':''}</button>`).join('')}</div></div>${lineChart(rows,key,meta.label,meta.unit)}</div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Visão combinada</b><small>Massa muscular, massa de gordura, percentual de gordura e peso nas mesmas datas.</small></div><span class="pill">últimas ${Math.min(12,rows.length)}</span></div>${combinedView(rows)}</div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Comparar duas medições</b><small>Diferenças observadas entre as datas escolhidas.</small></div></div>${compare(rows)}</div>
      <div class="card"><div class="cardHead"><div><b>Primeiro e último registro</b><small>Visão descritiva do período completo.</small></div></div><div class="summaryPair"><div><span>${fmtDate(first.measured_at)}</span><b>${fmtNum(first.weight_kg)} kg</b><small>Massa muscular ${fmtNum(first.skeletal_muscle_mass_kg)} kg</small></div><div class="arrow">→</div><div><span>${fmtDate(last.measured_at)}</span><b>${fmtNum(last.weight_kg)} kg</b><small>Massa muscular ${fmtNum(last.skeletal_muscle_mass_kg)} kg</small></div></div></div>
    </div>
    <div class="grid split sectionGap">
      <div class="card"><div class="cardHead"><div><b>Histórico</b><small>Toque em uma data para abrir todos os campos registrados.</small></div><span class="pill">${rows.length} medições</span></div><div class="list bodyHistory">${[...rows].reverse().map(r=>`<button type="button" class="historyRow ${r.measured_at===state.ui.selectedBodyDate?'active':''}" data-body-date="${esc(r.measured_at)}"><time>${fmtDate(r.measured_at)}</time><div><b>${fmtNum(r.weight_kg)} kg</b><small>Massa muscular ${fmtNum(r.skeletal_muscle_mass_kg)} kg · gordura corporal ${fmtNum(r.body_fat_pct)}%${num(r.score)!=null?` · InBody ${fmtNum(r.score,0)}`:''}</small></div><span>${esc(sourceDisplay(r.source))}</span></button>`).join('')}</div></div>
      <div class="card bioDetail">${measurementDetail(selected)}<p class="footerNote">Os valores são apresentados de forma descritiva, sem classificação estética ou meta corporal.</p></div>
    </div>`;
}
