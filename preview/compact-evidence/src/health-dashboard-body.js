import {homeUsefulContent} from './home-useful-content.js';
const norm=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const day=value=>{const raw=String(value??'');if(!/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(raw))return null;const d=raw.slice(0,10),p=new Date(`${d}T12:00:00Z`);return Number.isFinite(p.getTime())&&p.toISOString().slice(0,10)===d?d:null;};
const origin=row=>JSON.stringify([norm(row.source),norm(row.device_name)]);
/** Latest-known context stays separate from the selected period. Never pick an
 * older record when the newest date is ambiguous, or replace an explicit source. */
export function dashboardBody(data={},status={},dashboard={},ui={}){
 const snapshot=dashboard.snapshot||{},base=homeUsefulContent(data,status,snapshot,ui).body;
 if(!base.available||status.body!=='ready')return base;
 const lastAmbiguousDate=base.ambiguousDates.at(-1);
 if(lastAmbiguousDate&&(!base.latest||lastAmbiguousDate>base.latest.date)){
  const latestRows=(snapshot.body?.rows||[]).filter(row=>day(row.date||row.measured_at)===lastAmbiguousDate);
  const blocked=homeUsefulContent(data,status,{...snapshot,body:{...snapshot.body,rows:latestRows}},ui).body;
  return {...blocked,ambiguousDates:base.ambiguousDates,excludedDates:base.excludedDates,
   text:`A última data recebida, ${lastAmbiguousDate.split('-').reverse().join('/')}, tem ${latestRows.length} avaliações; confira os registros originais.`,latestKnownDate:lastAmbiguousDate,latestKnownAmbiguous:true};
 }
 if(base.latest||base.ambiguousDates.length)return base;
 const requested=ui.homeBodySource||ui.reportBodySource,rows=(data.body||[]).map(row=>({...row,date:day(row.measured_at)})).filter(row=>row.date&&row.date<=dashboard.bounds?.end&&(!requested||requested==='all'||origin(row)===requested));
 const latestDate=rows.map(row=>row.date).sort().at(-1);if(!latestDate)return base;
 const latestRows=rows.filter(row=>row.date===latestDate);
 if(latestRows.length!==1)return {...base,text:`A última data recebida, ${latestDate.split('-').reverse().join('/')}, tem ${latestRows.length} avaliações; confira os registros originais.`,latestKnownDate:latestDate,latestKnownAmbiguous:true};
 const result=homeUsefulContent(data,status,{...snapshot,bounds:{start:latestDate,end:latestDate},body:{...snapshot.body,available:true,rows:latestRows}},ui).body;
 return {...result,outsidePeriod:true,latestKnownDate:latestDate,periodLabel:'Última avaliação conhecida · fora do período selecionado.',context:`Última avaliação conhecida até ${dashboard.bounds.end.split('-').reverse().join('/')}; fora do período selecionado. ${result.context}`};
}
