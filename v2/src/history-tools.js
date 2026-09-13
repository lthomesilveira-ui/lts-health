import {esc,fmtDate,fmtNum,num} from './core.js';

// Presentation-only utilities. No conversion, imputation, writes, or clinical scoring.
export function validDay(value){
  const day=String(value||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return '';
  const date=new Date(`${day}T12:00:00Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day?day:'';
}
export function rowKey(row,index=0){return String(row?.source_record_id||row?.id||`row-${index}`);}
export function pageOf(rows,requested=1,size=12){
  const pages=Math.max(1,Math.ceil(rows.length/size));
  const p=Number(requested),page=Math.min(pages,Math.max(1,Number.isFinite(p)?Math.floor(p):1));
  const start=(page-1)*size;
  return{rows:rows.slice(start,start+size),page,pages,total:rows.length,start,end:Math.min(start+size,rows.length)};
}
export function pager(info,key){
  return `<nav class="ltsPager" aria-label="Paginação do histórico"><button type="button" data-depth-page="${esc(key)}" data-page="${info.page-1}" ${info.page===1?'disabled':''} aria-label="Página anterior">‹ Anterior</button><span role="status">${info.total?`${info.start+1}–${info.end}`:'0'} de ${info.total}<small>Página ${info.page} de ${info.pages}</small></span><button type="button" data-depth-page="${esc(key)}" data-page="${info.page+1}" ${info.page===info.pages?'disabled':''} aria-label="Próxima página">Próxima ›</button></nav>`;
}
export function years(rows,dateKey){return [...new Set(rows.map(r=>validDay(r[dateKey]).slice(0,4)).filter(Boolean))].sort().reverse();}
export function yearFilter(key,value,options){
  return `<label class="ltsField">Ano<select id="${esc(key)}" data-depth-field="${esc(key)}"><option value="all">Todo o histórico</option>${options.map(year=>`<option value="${year}" ${year===value?'selected':''}>${year}</option>`).join('')}</select></label>`;
}
export function searchField(key,value,placeholder,label='Buscar'){
  return `<label class="ltsField ltsSearch">${esc(label)}<input id="${esc(key)}" data-depth-field="${esc(key)}" type="search" value="${esc(value||'')}" placeholder="${esc(placeholder)}" autocomplete="off"></label>`;
}
export function periodControl(key,value){
  const options=[['recent','12 recentes'],['90','90 dias'],['365','1 ano'],['all','Todo o histórico']];
  return `<div class="ltsPeriodControl" role="group" aria-label="Período da série">${options.map(([v,label])=>`<button type="button" data-depth-period="${esc(key)}" data-value="${v}" class="${value===v?'active':''}" aria-pressed="${value===v}">${label}</button>`).join('')}</div>`;
}
export function seriesWindow(rows,dateKey,period='recent'){
  const ordered=rows.filter(r=>validDay(r[dateKey])).sort((a,b)=>validDay(a[dateKey]).localeCompare(validDay(b[dateKey])));
  if(period==='all')return ordered;
  if(period==='recent')return ordered.slice(-12);
  if(!['90','365'].includes(String(period))||!ordered.length)return ordered.slice(-12);
  const last=validDay(ordered.at(-1)[dateKey]);
  const start=new Date(`${last}T12:00:00Z`);start.setUTCDate(start.getUTCDate()-Number(period)+1);
  return ordered.filter(r=>validDay(r[dateKey])>=start.toISOString().slice(0,10));
}
export const emptyCard=text=>`<div class="ltsEmptyCard" role="status">${esc(text)}</div>`;
export const errorCard=text=>`<div class="ltsDepthError" role="alert"><b>${esc(text)}</b><span>Os dados não foram substituídos por zero. Use Atualizar para tentar novamente.</span></div>`;
export const sourceLabel=row=>String(row?.source_name||row?.source||row?.laboratory||'Origem não informada').trim();
export const failed=(state,key)=>state.domainStatus?.[key]==='error'||Boolean(state.errors?.[key]);
export const valueText=(value,unit='',digits=1)=>num(value)==null?'Não informado':`${fmtNum(value,digits)}${unit?` ${unit}`:''}`;
export const differenceText=(a,b,unit='',digits=1)=>num(a)==null||num(b)==null?'Sem comparação':`${num(a)-num(b)>0?'+':''}${fmtNum(num(a)-num(b),digits)}${unit?` ${unit}`:''}`;

export function pointChart(points,{unit='',label='Evolução',scope='',selected=null}={}){
  const clean=points.filter(p=>validDay(p.date)&&num(p.value)!=null).sort((a,b)=>validDay(a.date).localeCompare(validDay(b.date)));
  if(clean.length<2)return emptyCard('Ainda não há dois pontos inequívocos nesta série e período. Os resultados continuam disponíveis no histórico.');
  const values=clean.map(p=>Number(p.value)),low=Math.min(...values),high=Math.max(...values);
  const span=high-low||Math.max(Math.abs(high)*.1,1),min=low-span*.12,max=high+span*.12;
  const w=660,h=190,l=12,r=12,t=12,b=12;
  const time=p=>Date.parse(`${validDay(p.date)}T12:00:00Z`),start=time(clean[0]),end=time(clean.at(-1));
  const x=p=>l+(time(p)-start)/(end-start||1)*(w-l-r),y=v=>t+(max-v)/(max-min)*(h-t-b);
  const line=clean.map((p,i)=>`${i?'L':'M'}${x(p).toFixed(2)} ${y(p.value).toFixed(2)}`).join(' ');
  const mid=(min+max)/2,ticks=[max,mid,min];
  const index=selected!=null&&Number.isInteger(Number(selected))&&Number(selected)>=0&&Number(selected)<clean.length?Number(selected):clean.length-1;
  const focus=clean[index];
  const digits=span<.1?3:span<1?2:1;
  return `<div class="ltsDepthChart" data-chart-scope="${esc(scope)}"><div class="ltsDepthPlot"><div class="ltsDepthScale">${ticks.map(v=>`<span>${fmtNum(v,digits)}</span>`).join('')}</div><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}; ${clean.length} pontos; ${esc(unit)}"><path class="ltsDepthGrid" d="${ticks.map(v=>`M${l} ${y(v).toFixed(2)}H${w-r}`).join(' ')}"/><path class="ltsDepthLine" d="${line}"/>${clean.map((p,i)=>`<circle class="${i===index?'selected':''}" cx="${x(p).toFixed(2)}" cy="${y(p.value).toFixed(2)}" r="${i===index?5:3}"><title>${esc(fmtDate(p.date))}: ${esc(valueText(p.value,unit,digits))}</title></circle>`).join('')}</svg></div><div class="ltsDepthAxis"><span>${esc(fmtDate(clean[0].date))}</span><b>${esc(unit)}</b><span>${esc(fmtDate(clean.at(-1).date))}</span></div><div class="ltsPointReadout"><label class="ltsField">Consultar ponto<select id="${esc(scope)}Point" data-depth-field="${esc(scope)}Point">${clean.map((p,i)=>`<option value="${i}" ${i===index?'selected':''}>${esc(fmtDate(p.date))}</option>`).join('')}</select></label><p role="status"><b>${esc(valueText(focus.value,unit,digits))}</b><span>${esc(focus.context||fmtDate(focus.date))}</span></p></div></div>`;
}
