import {state,esc,num,fmtNum,fmtDate,neutralDelta,bodyRows,norm,day} from './core.js';

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
function bodyDayGroups(rows){
  const groups=new Map();
  for(const row of rows||[]){const date=day(row?.measured_at);if(!date)continue;if(!groups.has(date))groups.set(date,[]);groups.get(date).push(row);}
  return groups;
}
function comparableBodyRows(rows){return [...bodyDayGroups(rows).entries()].filter(([,items])=>items.length===1).sort((a,b)=>a[0].localeCompare(b[0])).map(([,items])=>items[0]);}
function ambiguousBodyDays(rows){return new Set([...bodyDayGroups(rows).entries()].filter(([,items])=>items.length>1).map(([date])=>date));}

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
function historyRow(row,ambiguousDays){
  const content=`<time>${fmtDate(row.measured_at)}</time><div><b>${fmtNum(row.weight_kg)} kg</b><small>Massa muscular ${fmtNum(row.skeletal_muscle_mass_kg)} kg · gordura corporal ${fmtNum(row.body_fat_pct)}%${num(row.score)!=null?` · InBody ${fmtNum(row.score,0)}`:''}</small></div><span>${esc(sourceDisplay(row.source))}</span>`;
  if(ambiguousDays.has(day(row.measured_at)))return `<div class="historyRow">${content}</div>`;
  return `<button type="button" class="historyRow ${row.measured_at===state.ui.selectedBodyDate?'active':''}" data-body-date="${esc(row.measured_at)}">${content}</button>`;
}

export function renderBioHub(){
  if(bodyFailed())return `${title('Composição corporal','Histórico de bioimpedância e evolução das medições.')}<div class="errorState"><b>As medições corporais não carregaram agora.</b><span>O app não substitui essa falha por números zerados. Tente atualizar para carregar o histórico novamente.</span></div>`;
  const allRows=bodyRows(),ambiguousDays=ambiguousBodyDays(allRows),rows=comparableBodyRows(allRows);
  if(!allRows.length)return `${title('Composição corporal','Histórico de bioimpedância e evolução das medições.')}${empty('Nenhuma medição corporal foi encontrada no histórico carregado.')}`;
  if(!rows.length)return `${title('Composição corporal','Histórico de bioimpedância e evolução das medições.')}<div class="note"><b>Medições preservadas, comparação em revisão</b><span>As datas carregadas têm mais de um registro. Nenhuma delas será escolhida automaticamente para evolução ou comparação.</span></div>${empty(`${allRows.length} medição(ões) permanecem preservadas no histórico.`)}`;
  const last=rows.at(-1),prev=rows.at(-2),first=rows[0],key=state.ui.bioMetric||'weight_kg',meta=metrics[key]||metrics.weight_kg;
  if(!state.ui.selectedBodyDate||!rows.some(r=>r.measured_at===state.ui.selectedBodyDate))state.ui.selectedBodyDate=last.measured_at;
  const selected=rows.find(r=>r.measured_at===state.ui.selectedBodyDate);
  const ambiguityNote=ambiguousDays.size?`<div class="note sectionGap"><b>${ambiguousDays.size} ${ambiguousDays.size===1?'data com mais de uma medição ficou':'datas com mais de uma medição ficaram'} fora da evolução</b><span>Os registros continuam no histórico, mas não entram em gráficos, comparação ou “última medição” até revisão.</span></div>`:'';
  return `${title('Composição corporal','Valores, escalas e comparação entre medidas ao longo do tempo.')}
    <div class="note"><b>${ambiguousDays.size?'Última medição comparável':'Última medição'} · ${fmtDate(last.measured_at)}</b><span>${allRows.length} medição(ões) no histórico. Os números dos gráficos aparecem na escala e nos pontos.</span></div>
    ${ambiguityNote}
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
      <div class="card"><div class="cardHead"><div><b>Primeiro e último registro comparável</b><small>Visão descritiva do período sem datas ambíguas.</small></div></div><div class="summaryPair"><div><span>${fmtDate(first.measured_at)}</span><b>${fmtNum(first.weight_kg)} kg</b><small>Massa muscular ${fmtNum(first.skeletal_muscle_mass_kg)} kg</small></div><div class="arrow">→</div><div><span>${fmtDate(last.measured_at)}</span><b>${fmtNum(last.weight_kg)} kg</b><small>Massa muscular ${fmtNum(last.skeletal_muscle_mass_kg)} kg</small></div></div></div>
    </div>
    <div class="grid split sectionGap">
      <div class="card"><div class="cardHead"><div><b>Histórico</b><small>Datas com mais de um registro ficam preservadas, mas aguardam revisão antes de entrar na evolução.</small></div><span class="pill">${allRows.length} medições</span></div><div class="list bodyHistory">${[...allRows].reverse().map(r=>historyRow(r,ambiguousDays)).join('')}</div></div>
      <div class="card bioDetail">${measurementDetail(selected)}<p class="footerNote">Os valores são apresentados de forma descritiva, sem classificação estética ou meta corporal.</p></div>
    </div>`;
}
