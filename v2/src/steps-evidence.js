// Read-only validation. A daily source quantity is not a consolidated total.
// Keep fractional/invalid source evidence; never round it into a step count.
export function stepCountReview(raw){
  const decimal=typeof raw==='string'?raw.trim().match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i):null;
  const numeric=raw!=null&&['number','string'].includes(typeof raw)&&(typeof raw!=='string'||decimal)&&Number.isFinite(Number(raw))?Number(raw):null;
  const digits=decimal?decimal[2]+(decimal[3]||''):'';
  const places=decimal?(decimal[3]||'').length-Number(decimal[4]||0):0;
  // Check decimal strings before Number can erase a tiny fractional part.
  const exactFraction=Boolean(decimal&&places>0&&/[1-9]/.test(digits.slice(-places)));
  const exactNegative=Boolean(decimal&&decimal[1]==='-'&&/[1-9]/.test(digits));
  const reason=numeric==null||numeric<0||exactNegative?'invalid_value':exactFraction||!Number.isInteger(numeric)?'fractional_count':!Number.isSafeInteger(numeric)?'unsafe_count':null;
  return {receivedValue:numeric,receivedRaw:typeof raw==='string'?raw.trim():numeric,value:reason?null:numeric,reason};
}

export function stepEvidence(sources=[],bounds={},today=null){
  const byDate=new Map();
  for(const source of sources)for(const point of source.rows||source.points||[]){
    if((bounds.start&&point.date<bounds.start)||(bounds.end&&point.date>bounds.end)||(today&&point.date>today))continue;
    for(const observation of point.observations||[]){
      if(!byDate.has(point.date))byDate.set(point.date,[]);
      byDate.get(point.date).push({date:point.date,source:source.key,label:source.label,status:source.status,
        value:observation.value,receivedValue:observation.receivedValue??observation.value,receivedRaw:observation.receivedRaw??observation.receivedValue??observation.value,reason:observation.stepReviewReason||null,
        receivedAt:observation.receivedAt||null,partial:point.open||observation.partial||observation.knownPartial,ambiguous:Boolean(point.ambiguous)});
    }
  }
  const days=[...byDate].map(([date,observations])=>{
    const sourceCount=new Set(observations.map(row=>row.source)).size;
    const values=new Set(observations.map(row=>row.receivedValue).filter(value=>value!=null));
    return {date,observations,sourceCount,differingSources:sourceCount>1&&values.size>1,invalidCount:observations.some(row=>row.reason),partial:date===today||observations.some(row=>row.partial)};
  }).sort((a,b)=>a.date.localeCompare(b.date));
  return {days,differingSourceDays:days.filter(row=>row.differingSources).length,invalidCountDays:days.filter(row=>row.invalidCount).length};
}

export function stepValueText(raw){
  const review=stepCountReview(raw);
  const rawText=typeof review.receivedRaw==='string'?review.receivedRaw:null;
  // String evidence keeps every digit, even beyond Intl or Number precision.
  const exact=review.receivedValue==null?'Valor inválido':rawText?( /e/i.test(rawText)?rawText.replace('.',','):rawText.split('.').map((part,index)=>index?part:part.replace(/\B(?=(\d{3})+(?!\d))/g,'.')).join(',') ):review.receivedValue.toLocaleString('pt-BR',{maximumSignificantDigits:21});
  return review.reason?`${exact} · contagem em revisão${review.reason==='fractional_count'?' (fracionada)':''}`:`${exact} passos`;
}
