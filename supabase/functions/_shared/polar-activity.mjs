import {digest,validDay,addDays} from './polar-contract.mjs';
import {providerRead} from './polar-provider.mjs';

export const POLAR_ACTIVITY_SCOPE='activity:read';
export const POLAR_ACTIVITY_FILE='Polar AccessLink v4 · amostras de passos';
export const hasActivityScope=row=>Array.isArray(row?.scopes)&&row.scopes.includes(POLAR_ACTIVITY_SCOPE);
const METHOD='polar_activity_samples_v1';
const schemaError=()=>{throw Error('provider_activity_schema');};
function activityDays(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||!Array.isArray(payload.activities?.activityDays))schemaError();
  const days=payload.activities.activityDays;
  if(days.length>90||days.some(day=>!day||validDay(day.date)!==day.date))schemaError();
  return days;
}
function startMillis(value,date){
  if(typeof value!=='string')schemaError();
  const time=value.startsWith(date+'T')?value.slice(11):value;
  const match=/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(time);
  if(!match||Number(match[1])>23||Number(match[2])>59||Number(match[3])>59)schemaError();
  return Number(match[1])*3600000+Number(match[2])*60000+Number(match[3])*1000+Number((match[4]||'').padEnd(3,'0'));
}
// These are observed buckets, never a reconstructed complete daily total.
// Missing samples do not produce zero; devices and overlapping buckets cannot be summed.
export async function normalizeActivitySamples(payload,userId,date){
  const days=activityDays(payload),rows=[],seenDevices=new Set();
  if(days.some(day=>day.date!==date)||days.length>1)schemaError();
  for(const day of days){
    const devices=day.activitiesPerDevice??[];
    if(!Array.isArray(devices)||devices.length>8)schemaError();
    for(const device of devices){
      const deviceId=device?.deviceReference?.deviceId;
      if(typeof deviceId!=='string'||!deviceId.trim()||deviceId.length>180||/[\u0000-\u001f]/.test(deviceId)||seenDevices.has(deviceId))schemaError();
      seenDevices.add(deviceId);
      if(device.activitySamples!=null&&!Array.isArray(device.activitySamples))schemaError();
      const slots=new Map(),original=[];
      for(const part of device.activitySamples||[]){
        const block=part?.stepSamples;if(block==null)continue;
        if(block.steps==null)continue;
        if(!Array.isArray(block.steps))schemaError();
        if(!block.steps.length)continue;
        const start=startMillis(block.startTime,date),rawInterval=block.interval;
        const interval=typeof rawInterval==='number'?rawInterval:typeof rawInterval==='string'&&/^\d+$/.test(rawInterval)?Number(rawInterval):NaN;
        if(!Number.isSafeInteger(interval)||interval<=0||interval>86400000||block.steps.length>86400||start+interval*block.steps.length>86400000)schemaError();
        const values=[];
        for(let i=0;i<block.steps.length;i++){
          const steps=block.steps[i];
          if(!Number.isSafeInteger(steps)||steps<0||steps>200000)schemaError();
          const at=start+i*interval,previous=slots.get(at);
          if(previous&&(previous.interval!==interval||previous.steps!==steps))throw Error('provider_activity_conflicting_samples');
          slots.set(at,{at,interval,steps});values.push(steps);
        }
        original.push({startTime:block.startTime,interval:rawInterval,steps:values});
      }
      if(!slots.size)continue;
      const buckets=[...slots.values()].sort((a,b)=>a.at-b.at);
      let observedSteps=0;
      for(let i=0;i<buckets.length;i++){
        if(i&&buckets[i].at<buckets[i-1].at+buckets[i-1].interval)throw Error('provider_activity_conflicting_samples');
        observedSteps+=buckets[i].steps;
      }
      if(!Number.isSafeInteger(observedSteps)||observedSteps>200000)schemaError();
      const alias=(await digest(deviceId)).slice(0,10),fingerprint=await digest(JSON.stringify({date,deviceId,buckets}));
      rows.push({user_id:userId,source_record_id:`polar_v4:step_samples:${date}:${alias}`,metric_date:date,metric_type:'polar_step_samples_count',value:observedSteps,unit:'count',source_name:`Polar Flow · aparelho ${alias}`,source_family:'polar_flow',canonical_status:'held',confidence:'provider_authenticated_samples',source_file:POLAR_ACTIVITY_FILE,
        source_payload:{schema:'polar_accesslink_v4',entry_method:METHOD,aggregation:'observed_step_samples',coverage_verified:false,original_unit:'count',original_device_id:deviceId,original_samples:original,sample_count:buckets.length,fingerprint}});
    }
  }
  return rows;
}
export function projectActivityRows(rows=[]){
  return rows.filter(row=>row?.metric_type==='polar_step_samples_count'&&row?.source_payload?.entry_method===METHOD&&Number.isSafeInteger(row.source_payload.sample_count)&&row.source_payload.sample_count>0&&row.value!=null&&String(row.value).trim()!==''&&row.unit==='count'&&Number.isSafeInteger(Number(row.value))&&Number(row.value)>=0&&validDay(row.metric_date)===row.metric_date)
    .map(row=>({date:row.metric_date,observed_steps:Number(row.value),unit:'count',source_name:row.source_name,sample_count:row.source_payload.sample_count,received_at:row.updated_at,received_trigger:row.source_payload.received_trigger,coverage_verified:false}));
}
export async function activitySnapshot(db,userId){
  const result=await db.from('health_source_daily_metrics').select('source_record_id,metric_type,metric_date,value,unit,source_name,updated_at,source_payload').eq('user_id',userId).eq('source_family','polar_flow').eq('metric_type','polar_step_samples_count').eq('canonical_status','held').eq('source_file',POLAR_ACTIVITY_FILE).order('metric_date',{ascending:false}).limit(28);
  if(result.error)throw Error('write_failed');
  return projectActivityRows(result.data||[]);
}
export async function receiveActivitySamples(db,{userId,revision,accessToken,from,to,trigger='manual',read=providerRead,now=()=>new Date().toISOString()}){
  if(validDay(from)!==from||validDay(to)!==to||from>=to||to>addDays(from,7))throw Error('invalid_date_window');
  const list=activityDays(await read(accessToken,'activity/list',{from,to}));
  if(list.some(day=>day.date<from||day.date>=to))schemaError();
  const dates=[...new Set(list.map(day=>day.date))].sort();
  const rows=[];
  for(let i=0;i<dates.length;i+=3){
    const parts=await Promise.all(dates.slice(i,i+3).map(async date=>normalizeActivitySamples(await read(accessToken,'activity/list',{from:date,to:addDays(date,1),features:'samples'}),userId,date)));
    for(const part of parts)rows.push(...part);
  }
  const owner=await db.from('health_polar_connections').select('revision').eq('user_id',userId).maybeSingle();
  if(owner.error)throw Error('write_failed');
  if(owner.data?.revision!==revision)return {authorized:true,read:false,superseded:true};
  let changed=[];
  if(rows.length){
    const previous=await db.from('health_source_daily_metrics').select('source_record_id,source_family,source_file,canonical_status,source_payload').eq('user_id',userId).in('source_record_id',rows.map(row=>row.source_record_id));
    if(previous.error)throw Error('write_failed');
    const existing=new Map((previous.data||[]).map(row=>[row.source_record_id,row]));
    for(const row of rows){
      const old=existing.get(row.source_record_id);
      if(old&&(old.source_family!=='polar_flow'||old.source_file!==POLAR_ACTIVITY_FILE||old.canonical_status!=='held'||old.source_payload?.entry_method!==METHOD))throw Error('write_failed');
      if(old?.source_payload?.fingerprint===row.source_payload.fingerprint)continue;
      changed.push({...row,source_payload:{...row.source_payload,received_trigger:trigger==='scheduled'?'scheduled':'manual'},updated_at:now()});
    }
    if(changed.length){const result=await db.from('health_source_daily_metrics').upsert(changed,{onConflict:'user_id,source_record_id'});if(result.error)throw Error('write_failed');}
  }
  const result={authorized:true,read:true,status:rows.length?'received':dates.length?'no_step_samples':'empty',provider_days:dates.length,observations:rows.length,written:changed.length,unchanged:rows.length-changed.length,from,to,coverage_verified:false};
  console.info('polar_activity_read',JSON.stringify(result)); // fixed keys/counts/dates only
  return result;
}
