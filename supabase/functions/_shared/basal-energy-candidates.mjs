// Prospective evidence only. A dated quantity is not proof of interval coverage.
// Keep raw units and distinct snapshots; never sum or promote these observations.
import {validDay,localToday} from './health-auto-export-contract.mjs';

const controls=/[\u0000-\u001f\u007f-\u009f]/;
// With Unicode matching, valid surrogate pairs are one non-surrogate codepoint.
// PostgreSQL JSONB rejects lone surrogates; filter them before a mixed RPC.
const loneSurrogate=/[\uD800-\uDFFF]/u;
export function validCandidateDate(value,today=localToday()){
  if(typeof value!=='string'||![10,25].includes(value.length)||!/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2} [+-]\d{4})?$/.test(value))return false;
  const day=value.slice(0,10);
  if(!validDay(day)||day>today)return false;
  if(value.length===10)return true;
  const h=Number(value.slice(11,13)),m=Number(value.slice(14,16)),s=Number(value.slice(17,19)),oh=Number(value.slice(21,23)),om=Number(value.slice(23,25));
  return h<24&&m<60&&s<60&&oh<=14&&om<60&&(oh<14||om===0);
}
function optionalDate(point,key,today){
  if(point[key]==null)return null;
  if(!validCandidateDate(point[key],today))throw Error('invalid_candidate');
  return point[key];
}
function candidate(point,unit,index,today){
  if(!point||typeof point!=='object'||Array.isArray(point))throw Error('invalid_candidate');
  if(typeof point.qty!=='number'||!Number.isFinite(point.qty)||point.qty<0||point.qty>1e9)throw Error('invalid_candidate');
  if(typeof unit!=='string'||unit.length>32||!unit.trim()||controls.test(unit)||loneSurrogate.test(unit))throw Error('invalid_candidate');
  if(!validCandidateDate(point.date,today))throw Error('invalid_candidate');
  let source=point.source;
  if(source==null||source==='')source=null;
  else if(typeof source!=='string'||source.length>160||controls.test(source)||loneSurrogate.test(source))throw Error('invalid_candidate');
  return {point_index:index,quantity:point.qty,unit,source_date:point.date,metric_date:point.date.slice(0,10),original_source:source,
    source_start_date:optionalDate(point,'startDate',today),source_end_date:optionalDate(point,'endDate',today),source_creation_date:optionalDate(point,'creationDate',today)};
}
// Call only after normalizeExport has validated the common envelope/size limits.
// Invalid formerly ignored points must not reject otherwise valid legacy metrics.
export function captureBasalCandidates(payload,{today=localToday()}={}){
  const candidates=[];let rejected=0,ignoredBlocks=0;
  for(const metric of payload.data.metrics){
    if(metric.name!=='basal_energy_burned')continue;
    let invalid=0;
    for(const point of metric.data){
      try{candidates.push(candidate(point,metric.units,candidates.length,today));}
      catch{rejected++;invalid++;}
    }
    if(invalid||!metric.data.length)ignoredBlocks++;
  }
  return {candidates,rejected_points:rejected,ignored_blocks:ignoredBlocks};
}
