import {normalizeWaterMl,validLocalDate} from './hydration.js';

export const MFP_WATER_EXPORT_SCHEMA='lts-health-mfp-water-export';
export const MFP_WATER_EXPORT_VERSION=1;
export const MFP_WATER_EXPORT_METHOD='mfp_food_water_v1';
export const MFP_WATER_ENTRY_METHOD='mfp_authenticated_water_export_v1';
export const MAX_MFP_WATER_DAYS=10000;

function transferError(code){return new Error(code);}
function integer(value){return Number.isInteger(value)?value:null;}
function utcDayNumber(value){
  if(!validLocalDate(value))return null;
  const[y,m,d]=value.split('-').map(Number);
  return Math.floor(Date.UTC(y,m-1,d)/86400000);
}

export function inclusiveDayCount(from,to){
  const first=utcDayNumber(from),last=utcDayNumber(to);
  if(first==null||last==null||last<first)throw transferError('mfp_export_invalid_period');
  return last-first+1;
}

export function buildIsoDateRange(from,to){
  const total=inclusiveDayCount(from,to);
  if(total>MAX_MFP_WATER_DAYS)throw transferError('mfp_export_period_too_large');
  const first=utcDayNumber(from);
  return Array.from({length:total},(_,index)=>new Date((first+index)*86400000).toISOString().slice(0,10));
}

export function parseMfpWaterEndpoint(payload,expectedDate){
  const item=payload?.item;
  if(!item||!validLocalDate(item.date)||item.date!==expectedDate)throw transferError('mfp_endpoint_invalid_date');
  const value=Number(item.milliliters);
  if(!Number.isFinite(value)||value<0||value>100000)throw transferError('mfp_endpoint_invalid_water');
  return Math.round(value);
}

export function parseMyFitnessPalWaterExport(input){
  let documentValue=input;
  if(typeof input==='string'){
    try{documentValue=JSON.parse(input);}catch{throw transferError('mfp_export_invalid_json');}
  }
  if(!documentValue||typeof documentValue!=='object'||Array.isArray(documentValue))throw transferError('mfp_export_invalid_document');
  if(documentValue.schema!==MFP_WATER_EXPORT_SCHEMA||documentValue.version!==MFP_WATER_EXPORT_VERSION)throw transferError('mfp_export_wrong_schema');
  if(documentValue.method!==MFP_WATER_EXPORT_METHOD)throw transferError('mfp_export_wrong_method');
  if(documentValue.status!=='complete'||!documentValue.completed_at)throw transferError('mfp_export_incomplete');

  const from=String(documentValue.period?.from||''),to=String(documentValue.period?.to||'');
  const expectedDays=inclusiveDayCount(from,to);
  if(expectedDays>MAX_MFP_WATER_DAYS)throw transferError('mfp_export_period_too_large');
  if(integer(documentValue.days_scanned)!==expectedDays)throw transferError('mfp_export_incomplete');
  if(!Array.isArray(documentValue.rows)||documentValue.rows.length>MAX_MFP_WATER_DAYS)throw transferError('mfp_export_invalid_rows');

  const byDate=new Map();
  for(const row of documentValue.rows){
    const date=String(row?.date||'');
    if(!validLocalDate(date)||date<from||date>to)throw transferError('mfp_export_invalid_row_date');
    let value;
    try{value=normalizeWaterMl(row?.water_ml);}catch{throw transferError('mfp_export_invalid_row_value');}
    if(byDate.has(date)&&byDate.get(date)!==value)throw transferError('mfp_export_conflicting_duplicate');
    byDate.set(date,value);
  }
  const rows=[...byDate].sort(([a],[b])=>a.localeCompare(b)).map(([date,water_ml])=>({date,water_ml}));
  const positiveDays=integer(documentValue.positive_days),withoutPositive=integer(documentValue.days_without_positive_total);
  if(positiveDays!==rows.length||withoutPositive!==expectedDays-rows.length)throw transferError('mfp_export_invalid_counts');

  return{
    schema:MFP_WATER_EXPORT_SCHEMA,
    version:MFP_WATER_EXPORT_VERSION,
    method:MFP_WATER_EXPORT_METHOD,
    source:'MyFitnessPal authenticated web',
    status:'complete',
    started_at:String(documentValue.started_at||''),
    completed_at:String(documentValue.completed_at),
    period:{from,to},
    days_scanned:expectedDays,
    positive_days:rows.length,
    days_without_positive_total:withoutPositive,
    rows
  };
}

export function myFitnessPalWaterRecords(parsedExport,userId){
  if(!userId)throw transferError('authentication_required');
  const parsed=parseMyFitnessPalWaterExport(parsedExport);
  return parsed.rows.map(row=>({
    user_id:userId,
    source_record_id:`mfp-water:${row.date}`,
    metric_date:row.date,
    metric_type:'dietary_water_ml',
    value:row.water_ml,
    unit:'mL',
    source_name:'MyFitnessPal',
    source_family:'myfitnesspal',
    canonical_status:'canonical',
    confidence:'account_authenticated_export',
    source_file:null,
    source_payload:{
      entry_method:MFP_WATER_ENTRY_METHOD,
      export_schema:MFP_WATER_EXPORT_SCHEMA,
      export_version:MFP_WATER_EXPORT_VERSION,
      export_period_from:parsed.period.from,
      export_period_to:parsed.period.to
    }
  }));
}
