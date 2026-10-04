// Health Auto Export JSON v2, summarized by local calendar day.
// Contract: https://help.healthyapps.dev/en/health-auto-export/export-format/health-metrics/
export const KEY_HEADER='x-lts-health-key';
export const MAX_BODY_BYTES=1024*1024;
export const FAMILY='health_auto_export';
export const CONFIDENCE='authenticated_auto_export';
const definitions={
  dietary_energy:['dietary_energy_kcal','kcal','energy',20000],
  protein:['dietary_protein_g','g','mass',2000],
  carbohydrates:['dietary_carbs_g','g','mass',5000],
  total_fat:['dietary_fat_g','g','mass',2000],
  fiber:['dietary_fiber_g','g','mass',1000],
  dietary_water:['dietary_water_ml','mL','water',100000],
  step_count:['steps','count','count',200000],
  active_energy:['active_energy_kcal','kcal','energy',20000],
  apple_exercise_time:['exercise_minutes','min','minutes',1440],
  apple_stand_hour:['stand_hours','h','standHours',24],
  resting_heart_rate:['resting_heart_rate_bpm','bpm','bpm',300],
  heart_rate:['heart_rate_avg_bpm','bpm','bpm',300],
  heart_rate_variability:['hrv_sdnn_ms','ms','milliseconds',2000],
  respiratory_rate:['respiratory_rate_bpm','breaths/min','respiration',100],
  blood_oxygen_saturation:['oxygen_saturation_pct','%','percentage',100],
  'weight_&_body_mass':['weight_kg','kg','weight',500]
};
const nutritionTypes=new Set(['dietary_energy_kcal','dietary_protein_g','dietary_carbs_g','dietary_fat_g','dietary_fiber_g']);
const sleepFields={totalSleep:'sleep_duration_h',inBed:'sleep_in_bed_h',core:'sleep_core_h',deep:'sleep_deep_h',rem:'sleep_rem_h',awake:'sleep_awake_h'};
export const validToken=token=>typeof token==='string'&&/^hae_[A-Za-z0-9_-]{43}$/.test(token);
export function randomToken(){return 'hae_'+btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export async function digest(value){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function validDay(day){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))return false;
  const [y,m,d]=day.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));
  return y>=2000&&date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}
export function localToday(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
function pointDay(value,today){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?: [0-2]\d:[0-5]\d:[0-5]\d [+-]\d{4})?$/.test(value))throw Error('invalid_date');
  const day=value.slice(0,10);if(!validDay(day)||day>today)throw Error('invalid_date');
  if(value.length>10){const hour=Number(value.slice(11,13)),offsetHour=Number(value.slice(21,23)),offsetMin=Number(value.slice(23,25));if(hour>23||offsetHour>14||offsetMin>59)throw Error('invalid_date');}
  return day; // Keep the phone's calendar day; never reinterpret midnight as UTC.
}
function source(point){
  if(point.source==null||point.source==='')return 'Origem não informada pelo Saúde';
  if(typeof point.source!=='string'||point.source.length>160||/[\u0000-\u001f]/.test(point.source))throw Error('invalid_source');
  return point.source.trim()||'Origem não informada pelo Saúde';
}
function converted(qty,unit,kind,max){
  if(typeof qty!=='number'||!Number.isFinite(qty)||qty<0)throw Error('invalid_value');
  const u=String(unit||'').trim().toLowerCase();let factor;
  if(kind==='energy')factor={kcal:1,kj:1/4.184}[u];
  if(kind==='mass')factor={g:1,mg:.001,kg:1000}[u];
  if(kind==='water')factor={ml:1,l:1000,'fl oz':29.5735295625,'fl. oz.':29.5735295625,'us fl oz':29.5735295625}[u];
  if(kind==='weight')factor={kg:1,lb:.45359237,lbs:.45359237}[u];
  if(kind==='hours')factor={h:1,hr:1,hrs:1,min:1/60}[u];
  if(kind==='standHours')factor={count:1,h:1,hr:1,hrs:1}[u];
  if(kind==='minutes')factor={min:1,h:60,hr:60}[u];
  if(kind==='milliseconds')factor={ms:1,s:1000}[u];
  if(kind==='count')factor=u==='count'?1:undefined;
  if(kind==='bpm')factor=u==='bpm'?1:undefined;
  if(kind==='respiration')factor=['count/min','breaths/min','br/min'].includes(u)?1:undefined;
  if(kind==='percentage')factor=u==='%'?1:undefined;
  if(factor===undefined)throw Error('unsupported_unit');
  const value=Math.round(qty*factor*1000000)/1000000;if(value>max)throw Error('invalid_value');return value;
}
export function normalizeExport(payload,{aggregation,today=localToday()}={}){
  // Missing/unknown grouping cannot establish that qty is a daily total.
  if(!['day','days','daily'].includes(String(aggregation||'').trim().toLowerCase()))throw Error('daily_aggregation_required');
  const metrics=payload?.data?.metrics;
  if(!Array.isArray(metrics)||metrics.length>80)throw Error('invalid_payload');
  for(const [type,entries] of Object.entries(payload.data))if(type!=='metrics'&&(!Array.isArray(entries)||entries.length))throw Error('health_metrics_only');
  const rows=new Map();let ignored=0,points=0;
  function add(type,unit,value,date,originalSource,name){
    const id='health_auto_export:'+JSON.stringify([type,date,originalSource]);
    const row={source_record_id:id,metric_date:date,metric_type:type,value,unit,source_name:`Apple Saúde · ${originalSource}`,source_family:FAMILY,canonical_status:(nutritionTypes.has(type)||type==='dietary_water_ml')?'canonical':'candidate',confidence:CONFIDENCE,source_payload:{transport:'health_auto_export',export_version:2,aggregation:'day',original_source:originalSource,export_metric:name}};
    if(rows.has(id)){
      // Even equal repeated samples might be two events: don't turn them into a daily total.
      throw Error('duplicate_daily_metric');
    }
    rows.set(id,row);if(rows.size>2500)throw Error('too_many_points');
  }
  for(const metric of metrics){
    if(!metric||typeof metric.name!=='string'||!Array.isArray(metric.data))throw Error('invalid_payload');
    points+=metric.data.length;if(points>2500)throw Error('too_many_points');
    const def=definitions[metric.name];
    if(!def&&metric.name!=='sleep_analysis'){ignored+=metric.data.length;continue;}
    for(const point of metric.data){
      if(!point||typeof point!=='object'||point.startDate||point.endDate)throw Error('daily_aggregation_required');
      const date=pointDay(point.date,today),originalSource=source(point);
      if(metric.name==='sleep_analysis'){
        if(point.totalSleep==null)throw Error('daily_aggregation_required');
        for(const [field,type] of Object.entries(sleepFields))if(point[field]!=null)add(type,'h',converted(point[field],metric.units,'hours',24),date,originalSource,metric.name);
      }else{
        const [type,unit,kind,max]=def,qty=metric.name==='heart_rate'?(point.Avg??point.qty):point.qty;
        add(type,unit,converted(qty,metric.units,kind,max),date,originalSource,metric.name);
      }
    }
  }
  return {metrics:[...rows.values()],ignored_points:ignored};
}
