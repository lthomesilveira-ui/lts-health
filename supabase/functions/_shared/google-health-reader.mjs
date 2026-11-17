// Server-only, read-only preparation. No persistence or canonical promotion here.
export const GOOGLE_HEALTH_NUTRITION_SCOPE='https://www.googleapis.com/auth/googlehealth.nutrition.readonly';
export const GOOGLE_HEALTH_SOURCE_FAMILY='users/me/dataSourceFamilies/all-sources';
const origin='https://health.googleapis.com';
const userId=/^[a-zA-Z0-9-]{1,63}$/;
const maxPageBytes=2000000,maxReadBytes=10000000,maxPages=32,maxPoints=10000;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=code=>{throw new GoogleHealthReadError(code);};

export class GoogleHealthReadError extends Error{
  constructor(code,retryAfterSeconds=null){
    super(code);this.name='GoogleHealthReadError';this.code=code;
    this.retryAfterSeconds=retryAfterSeconds;
  }
}
export function hasHydrationReadScope(scopes){
  return typeof scopes==='string'&&scopes.split(/\s+/).includes(GOOGLE_HEALTH_NUTRITION_SCOPE);
}
export function validGoogleHealthDay(day){
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
  const ms=Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===day;
}
export function hydrationReadParameters(from,to){
  if(!validGoogleHealthDay(from)||!validGoogleHealthDay(to)||from>=to||
      (Date.parse(to)-Date.parse(from))/86400000>31)fail('invalid_date_window');
  return {
    filter:`hydration_log.interval.civil_start_time >= "${from}" AND hydration_log.interval.civil_start_time < "${to}"`,
    dataSourceFamily:GOOGLE_HEALTH_SOURCE_FAMILY,pageSize:'1000'
  };
}
function instant(value){
  if(typeof value!=='string')fail('invalid_interval');
  const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if(!m||!validGoogleHealthDay(m[1])||+m[2]>23||+m[3]>59||+m[4]>59||+m[8]>23||+m[9]>59)fail('invalid_interval');
  const offset=m[6]==='Z'?0:(m[7]==='-'?-1:1)*(+m[8]*60 + +m[9]);
  const milliseconds=Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`)-offset*60000;
  return BigInt(milliseconds)*1000000n+BigInt((m[5]||'').padEnd(9,'0')||'0');
}
function offsetNs(value){
  const m=typeof value==='string'&&/^(-?)(\d+)(?:\.(\d{1,9}))?s$/.exec(value);
  if(!m)return null;
  const magnitude=BigInt(m[2])*1000000000n+BigInt((m[3]||'').padEnd(9,'0')||'0');
  if(magnitude>64800000000000n)return null;
  return m[1]==='-'?-magnitude:magnitude;
}
function dayAt(nanoseconds){
  const whole=nanoseconds/1000000n-(nanoseconds<0n&&nanoseconds%1000000n!==0n?1n:0n);
  try{return new Date(Number(whole)).toISOString().slice(0,10);}catch{fail('invalid_interval');}
}
function civilDay(value){
  if(!object(value)||!object(value.date))return null;
  const {year,month,day}=value.date;
  if(![year,month,day].every(Number.isInteger))return null;
  const text=`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  return validGoogleHealthDay(text)?text:null;
}
function stable(value,depth=0){
  if(depth>24)fail('invalid_response');
  if(typeof value==='number'&&!Number.isFinite(value))fail('invalid_response');
  if(Array.isArray(value))return '['+value.map(v=>stable(v,depth+1)).join(',')+']';
  if(object(value))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k],depth+1)).join(',')+'}';
  return JSON.stringify(value);
}
function observation(point,healthUserId,from,to,enforceWindow=true){
  if(!object(point)||typeof point.name!=='string')fail('invalid_hydration_record');
  const m=/^users\/([A-Za-z0-9-]{1,63})\/dataTypes\/hydration-log\/dataPoints\/([a-z0-9-]{4,63})$/.exec(point.name);
  if(!m||(m[1]!==healthUserId&&m[1]!=='me'))fail('record_account_mismatch');
  const log=point.hydrationLog;
  if(!object(log)||!object(log.interval)||!object(log.amountConsumed))fail('invalid_hydration_record');
  const ml=log.amountConsumed.milliliters;
  if(typeof ml!=='number'||!Number.isFinite(ml)||ml<0||ml>100000)fail('invalid_volume');
  const start=instant(log.interval.startTime),end=instant(log.interval.endTime);
  if(end<start)fail('invalid_interval');
  const startOffset=offsetNs(log.interval.startUtcOffset),endOffset=offsetNs(log.interval.endUtcOffset);
  const held=[];
  if(startOffset===null||endOffset===null)held.push('missing_offset');
  const localDay=startOffset===null?null:dayAt(start+startOffset);
  for(const [field,ns,offset] of [['civilStartTime',start,startOffset],['civilEndTime',end,endOffset]]){
    if(log.interval[field]!==undefined){
      const civil=civilDay(log.interval[field]);
      if(!civil||(offset!==null&&civil!==dayAt(ns+offset)))fail('inconsistent_civil_date');
    }
  }
  if(enforceWindow&&localDay!==null&&(localDay<from||localDay>=to))fail('record_outside_window');
  const source=point.dataSource;
  if(source!==undefined&&!object(source))fail('invalid_source');
  const app=source?.application,device=source?.device;
  if((app!==undefined&&!object(app))||(device!==undefined&&!object(device)))fail('invalid_source');
  const originalApp=object(app)&&['packageName','webClientId','googleWebClientId'].some(k=>typeof app[k]==='string'&&app[k].trim());
  const originalDevice=object(device)&&['manufacturer','displayName'].some(k=>typeof device[k]==='string'&&device[k].trim());
  if(!originalApp&&!originalDevice)held.push('source_identity_missing');
  // All-source records may be mirrors. Even known source IDs require an independently reviewed mapping.
  held.push('source_mapping_unverified');
  return {
    resource_name:point.name,health_user_id:healthUserId,local_day:localDay,
    milliliters:ml,unit:'mL',source:source===undefined?null:structuredClone(source),
    interval:structuredClone(log.interval),user_provided_unit:log.amountConsumed.userProvidedUnit??null,
    canonical_eligible:false,held_reasons:held,raw:structuredClone(point)
  };
}
async function readJson(response,budget){
  if(!response.headers.get('Content-Type')?.toLowerCase().includes('json')){await cancel(response);fail('invalid_response');}
  const length=response.headers.get('Content-Length');
  if(length!==null&&Number(length)>maxPageBytes){await cancel(response);fail('response_too_large');}
  if(!response.body)fail('invalid_response');
  const reader=response.body.getReader(),chunks=[];let bytes=0;
  try{
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      bytes+=value.byteLength;budget.bytes+=value.byteLength;
      if(bytes>maxPageBytes||budget.bytes>maxReadBytes){await reader.cancel();fail('response_too_large');}
      chunks.push(value);
    }
  }catch(error){if(error instanceof GoogleHealthReadError)throw error;fail('network_error');}
  finally{reader.releaseLock();}
  const buffer=new Uint8Array(bytes);let at=0;for(const chunk of chunks){buffer.set(chunk,at);at+=chunk.byteLength;}
  let parsed;try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer));}catch{fail('invalid_response');}
  if(!object(parsed))fail('invalid_response');
  return parsed;
}
async function providerJson(path,params,token,fetcher,budget,signal,body=null){
  const url=new URL(path,origin);url.search=new URLSearchParams(params).toString();
  let response;
  try{response=await fetcher(url,{method:body===null?'GET':'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/json',...(body===null?{}:{'Content-Type':'application/json'})},...(body===null?{}:{body:JSON.stringify(body)}),redirect:'error',signal});}
  catch{fail('network_error');}
  if(!response.ok){
    const status=response.status;
    const retryAfter=response.headers.get('Retry-After');
    const seconds=retryAfter!==null&&/^\d{1,4}$/.test(retryAfter)?Math.min(Number(retryAfter),3600):null;
    await cancel(response);
    if(status===401)fail('authorization_expired');
    if(status===403)fail('permission_denied');
    if(status===429)throw new GoogleHealthReadError('rate_limited',seconds);
    throw new GoogleHealthReadError(status>=500?'provider_unavailable':'provider_request_rejected');
  }
  return readJson(response,budget);
}
const get=(path,params,token,fetcher,budget,signal)=>providerJson(path,params,token,fetcher,budget,signal);
async function cancel(response){try{await response.body?.cancel();}catch{}}
function credential(accessToken,grantedScopes,expectedHealthUserId){
  if(typeof accessToken!=='string'||!accessToken||accessToken.length>8192||/[^\x21-\x7e]/.test(accessToken))fail('invalid_access_token');
  if(!hasHydrationReadScope(grantedScopes))fail('read_scope_required');
  if(expectedHealthUserId!==null&&(typeof expectedHealthUserId!=='string'||!userId.test(expectedHealthUserId)))fail('invalid_expected_identity');
}
async function verifiedIdentity(accessToken,grantedScopes,expectedHealthUserId,fetcher,budget,deadline){
  credential(accessToken,grantedScopes,expectedHealthUserId);
  const identity=await get('/v4/users/me/identity',{},accessToken,fetcher,budget,deadline);
  if(typeof identity.healthUserId!=='string'||!userId.test(identity.healthUserId)||
      !['users/me/identity',`users/${identity.healthUserId}/identity`].includes(identity.name))fail('identity_not_verified');
  if(expectedHealthUserId!==null&&identity.healthUserId!==expectedHealthUserId)fail('account_changed');
  return {name:identity.name,healthUserId:identity.healthUserId};
}
export async function verifyGoogleHealthIdentity({accessToken,grantedScopes,expectedHealthUserId=null,fetcher=fetch}){
  return verifiedIdentity(accessToken,grantedScopes,expectedHealthUserId,fetcher,{bytes:0},AbortSignal.timeout(30000));
}

// A separate, owner-requested source check. It never reads hydration as a food
// nutrient, returns meal contents, infers an app name or writes clinical data.
export async function inspectGoogleHealthNutrition({accessToken,grantedScopes,from,to,expectedHealthUserId=null,fetcher=fetch}){
  hydrationReadParameters(from,to);
  const budget={bytes:0},deadline=AbortSignal.timeout(30000);
  const identity=await verifiedIdentity(accessToken,grantedScopes,expectedHealthUserId,fetcher,budget,deadline);
  const seen=new Map(),seenTokens=new Set(),groups=new Map(),days=[];
  let pageToken='',pages=0,received=0,undated=0;
  for(;;){
    if(pages>=maxPages)fail('pagination_limit');
    const payload=await get('/v4/users/me/dataTypes/nutrition-log/dataPoints',{
      filter:`nutrition_log.interval.civil_start_time >= "${from}" AND nutrition_log.interval.civil_start_time < "${to}"`,
      dataSourceFamily:GOOGLE_HEALTH_SOURCE_FAMILY,pageSize:'1000',...(pageToken?{pageToken}:{})
    },accessToken,fetcher,budget,deadline);
    pages++;
    const omitted=!Object.hasOwn(payload,'dataPoints')&&Object.keys(payload).every(key=>key==='nextPageToken');
    if(!omitted&&!Array.isArray(payload.dataPoints))fail('invalid_response');
    const points=omitted?[]:payload.dataPoints;
    received+=points.length;if(received>maxPoints)fail('record_limit');
    for(const point of points){
      const fingerprint=stable(point),match=object(point)&&typeof point.name==='string'&&/^users\/([A-Za-z0-9-]{1,63})\/dataTypes\/nutrition-log\/dataPoints\/([a-z0-9-]{4,63})$/.exec(point.name);
      if(!match||!object(point.nutritionLog)||!object(point.nutritionLog.interval))fail('invalid_response');
      if(match[1]!==identity.healthUserId&&match[1]!=='me')fail('record_account_mismatch');
      if(seen.has(point.name)){if(seen.get(point.name)!==fingerprint)fail('duplicate_identity_conflict');continue;}
      seen.set(point.name,fingerprint);
      const interval=point.nutritionLog.interval,start=instant(interval.startTime),end=instant(interval.endTime);
      if(end<start)fail('invalid_interval');
      const offset=offsetNs(interval.startUtcOffset),day=offset===null?null:dayAt(start+offset);
      if(day!==null&&(day<from||day>=to))fail('record_outside_window');
      if(interval.civilStartTime!==undefined){const civil=civilDay(interval.civilStartTime);if(!civil||(day!==null&&civil!==day))fail('inconsistent_civil_date');}
      if(day===null)undated++;else days.push(day);
      const source=point.dataSource;
      if(source!==undefined&&!object(source))fail('invalid_source');
      if(source?.application!==undefined&&!object(source.application))fail('invalid_source');
      const metadata={};
      for(const [key,value] of Object.entries({platform:source?.platform,package_name:source?.application?.packageName,web_client_id:source?.application?.webClientId,google_web_client_id:source?.application?.googleWebClientId})){
        if(value!==undefined){if(typeof value!=='string'||!value||value.length>256||/[\x00-\x1f\x7f]/.test(value))fail('invalid_source');metadata[key]=value;}
      }
      const key=stable(metadata),group=groups.get(key)||{source:metadata,observations:0,first_day:null,last_day:null};
      group.observations++;if(day!==null){if(group.first_day===null||day<group.first_day)group.first_day=day;if(group.last_day===null||day>group.last_day)group.last_day=day;}
      groups.set(key,group);
    }
    const next=payload.nextPageToken;
    if(next===undefined||next==='')break;
    if(typeof next!=='string'||next.length>4096||/[^\x21-\x7e]/.test(next)||seenTokens.has(next))fail('invalid_pagination');
    seenTokens.add(next);pageToken=next;
  }
  days.sort();
  return {complete:true,mode:'read_only',data_type:'nutrition-log',source_family:GOOGLE_HEALTH_SOURCE_FAMILY,from,to_exclusive:to,
    observations:seen.size,undated_observations:undated,first_day:days[0]??null,last_day:days.at(-1)??null,
    sources:[...groups.values()],canonical_updated:false,water_received:false};
}

// A bounded owner-requested comparison for a native-app/API discrepancy. The
// two latest-record probes intentionally omit dates, but inspect only one page
// of at most 25 water points. No volumes, point IDs or raw payload leave here.
// No probe changes the normal reader, grants, snapshots or canonical totals.
export async function inspectGoogleHealthHydrationAvailability({accessToken,grantedScopes,from,to,expectedHealthUserId=null,fetcher=fetch}){
  const civil=hydrationReadParameters(from,to);
  if((Date.parse(to)-Date.parse(from))/86400000>7)fail('invalid_date_window');
  const budget={bytes:0},deadline=AbortSignal.timeout(30000);
  const identity=await verifiedIdentity(accessToken,grantedScopes,expectedHealthUserId,fetcher,budget,deadline);
  const probes=[];
  for(const [kind,params] of [
    ['civil_window',{...civil,pageSize:'25'}],
    ['latest_all_sources',{dataSourceFamily:GOOGLE_HEALTH_SOURCE_FAMILY,pageSize:'25'}],
    ['latest_default_sources',{pageSize:'25'}]
  ]){
    const payload=await get('/v4/users/me/dataTypes/hydration-log/dataPoints',params,accessToken,fetcher,budget,deadline);
    const omitted=!Object.hasOwn(payload,'dataPoints')&&Object.keys(payload).every(key=>key==='nextPageToken');
    if(!omitted&&!Array.isArray(payload.dataPoints))fail('invalid_response');
    const points=omitted?[]:payload.dataPoints;
    if(points.length>25)fail('record_limit');
    const next=payload.nextPageToken;
    if(next!==undefined&&next!==''&&(typeof next!=='string'||next.length>4096||/[^\x21-\x7e]/.test(next)))fail('invalid_pagination');
    const seen=new Map(),groups=new Map(),days=[];let recent=0,undated=0;
    for(const point of points){
      const fingerprint=stable(point);
      const row=observation(point,identity.healthUserId,from,to,kind==='civil_window');
      if(seen.has(point.name)){if(seen.get(point.name)!==fingerprint)fail('duplicate_identity_conflict');continue;}
      seen.set(point.name,fingerprint);
      const inWindow=row.local_day!==null&&row.local_day>=from&&row.local_day<to;
      if(row.local_day===null)undated++;else days.push(row.local_day);
      if(inWindow)recent++;
      const source={};
      for(const [key,value] of Object.entries({platform:row.source?.platform,package_name:row.source?.application?.packageName,web_client_id:row.source?.application?.webClientId,google_web_client_id:row.source?.application?.googleWebClientId})){
        if(value!==undefined){if(typeof value!=='string'||!value||value.length>256||/[\x00-\x1f\x7f]/.test(value))fail('invalid_source');source[key]=value;}
      }
      const key=stable(source),group=groups.get(key)||{source,observations:0,recent_observations:0};
      group.observations++;if(inWindow)group.recent_observations++;groups.set(key,group);
    }
    days.sort();
    probes.push({kind,observations:seen.size,recent_observations:recent,undated_observations:undated,
      first_day:days[0]??null,last_day:days.at(-1)??null,truncated:Boolean(next),sources:[...groups.values()]});
  }
  return {mode:'read_only',bounded:true,data_type:'hydration-log',from,to_exclusive:to,max_points_per_probe:25,
    probes,canonical_updated:false,water_received:false};
}

// Read-only alternative views of the same water data. A rollup is a query,
// despite its POST verb; it never creates or modifies a provider data point.
// Return presence metadata only. Daily buckets, raw points and overlapping
// views must never be added together or promoted into clinical totals here.
export async function inspectGoogleHealthHydrationStreams({accessToken,grantedScopes,from,to,expectedHealthUserId=null,fetcher=fetch}){
  const civil=hydrationReadParameters(from,to),dayCount=(Date.parse(to)-Date.parse(from))/86400000;
  if(dayCount>7)fail('invalid_date_window');
  const budget={bytes:0},deadline=AbortSignal.timeout(30000);
  const identity=await verifiedIdentity(accessToken,grantedScopes,expectedHealthUserId,fetcher,budget,deadline);
  const query=async run=>{
    try{return await run();}catch(e){
      if(['provider_request_rejected','provider_unavailable','permission_denied','rate_limited','network_error'].includes(e?.code))return {status:e.code};
      throw e;
    }
  };
  const envelope=(payload,key,max)=>{
    const omitted=!Object.hasOwn(payload,key)&&Object.keys(payload).every(k=>k==='nextPageToken');
    if(!omitted&&!Array.isArray(payload[key]))fail('invalid_response');
    const rows=omitted?[]:payload[key],next=payload.nextPageToken;
    if(rows.length>max)fail('record_limit');
    if(next!==undefined&&next!==''&&(typeof next!=='string'||next.length>4096||/[^\x21-\x7e]/.test(next)))fail('invalid_pagination');
    return {rows,truncated:Boolean(next)};
  };
  const reconciled=await query(async()=>{
    const payload=await get('/v4/users/me/dataTypes/hydration-log/dataPoints:reconcile',{...civil,pageSize:'25'},accessToken,fetcher,budget,deadline);
    const {rows,truncated}=envelope(payload,'dataPoints',25),seen=new Map(),days=[];
    let undated=0,positive=0;
    for(const point of rows){
      if(!object(point))fail('invalid_hydration_record');
      const row=observation({...point,name:point.dataPointName},identity.healthUserId,from,to),fingerprint=stable(point);
      if(seen.has(point.dataPointName)){if(seen.get(point.dataPointName)!==fingerprint)fail('duplicate_identity_conflict');continue;}
      seen.set(point.dataPointName,fingerprint);
      if(row.local_day===null)undated++;else{days.push(row.local_day);if(row.milliliters>0)positive++;}
    }
    days.sort();return {status:'ok',observations:seen.size,undated_observations:undated,positive_observations:positive,first_day:days[0]??null,last_day:days.at(-1)??null,truncated};
  });
  const date=day=>{const [year,month,date]=day.split('-').map(Number);return {date:{year,month,day:date}};};
  const daily=await query(async()=>{
    const payload=await providerJson('/v4/users/me/dataTypes/hydration-log/dataPoints:dailyRollUp',{},accessToken,fetcher,budget,deadline,
      {range:{start:date(from),end:date(to)},windowSizeDays:1,pageSize:7,dataSourceFamily:GOOGLE_HEALTH_SOURCE_FAMILY});
    const {rows,truncated}=envelope(payload,'rollupDataPoints',dayCount),seen=new Set(),positiveDays=[];
    let empty=0,zero=0,unquantified=0;
    const midnight=value=>object(value)&&civilDay(value)!==null&&(value.time===undefined||object(value.time)&&['hours','minutes','seconds','nanos'].every(k=>value.time[k]===undefined||value.time[k]===0));
    for(const bucket of rows){
      if(!object(bucket)||!midnight(bucket.civilStartTime)||!midnight(bucket.civilEndTime))fail('invalid_interval');
      const day=civilDay(bucket.civilStartTime),end=civilDay(bucket.civilEndTime);
      if(day<from||day>=to||Date.parse(end)-Date.parse(day)!==86400000)fail('record_outside_window');
      if(seen.has(day))fail('duplicate_identity_conflict');seen.add(day);
      if(bucket.hydrationLog===undefined){empty++;continue;}
      if(!object(bucket.hydrationLog))fail('invalid_response');
      const amount=bucket.hydrationLog.amountConsumed;
      if(amount===undefined){unquantified++;continue;}
      if(!object(amount))fail('invalid_response');
      const ml=amount.millilitersSum;
      if(ml===undefined){unquantified++;continue;}
      if(typeof ml!=='number'||!Number.isFinite(ml)||ml<0||ml>100000)fail('invalid_volume');
      if(ml===0)zero++;else positiveDays.push(day);
    }
    positiveDays.sort();return {status:'ok',buckets:seen.size,positive_buckets:positiveDays.length,zero_buckets:zero,empty_buckets:empty,unquantified_buckets:unquantified,
      first_positive_day:positiveDays[0]??null,last_positive_day:positiveDays.at(-1)??null,truncated};
  });
  return {mode:'read_only',bounded:true,data_type:'hydration-log',from,to_exclusive:to,reconciled,daily,canonical_updated:false,water_received:false};
}

// Caller supplies a server-held OAuth token and the grant returned by Google.
// This module neither obtains consent nor marks a connection/persistence as complete.
export async function readGoogleHealthHydration({accessToken,grantedScopes,from,to,expectedHealthUserId=null,fetcher=fetch,reportDiagnostic=()=>{}}){
  const params=hydrationReadParameters(from,to);
  const budget={bytes:0},deadline=AbortSignal.timeout(30000);
  const identity=await verifiedIdentity(accessToken,grantedScopes,expectedHealthUserId,fetcher,budget,deadline);
  const records=new Map(),seenTokens=new Set();let pageToken='',pages=0,received=0;
  for(;;){
    if(pages>=maxPages)fail('pagination_limit');
    const payload=await get('/v4/users/me/dataTypes/hydration-log/dataPoints',pageToken?{...params,pageToken}:params,accessToken,fetcher,budget,deadline);
    pages++;
    // ProtoJSON omits empty repeated fields. Accept only the documented empty
    // list envelope; an error object or an explicitly malformed list stays fatal.
    const omitted=!Object.hasOwn(payload,'dataPoints')&&Object.keys(payload).every(key=>key==='nextPageToken');
    if(!omitted&&!Array.isArray(payload.dataPoints))fail('invalid_response');
    if(omitted){try{reportDiagnostic({event:'google_health_empty_list_omitted'});}catch{}}
    const points=omitted?[]:payload.dataPoints;
    received+=points.length;if(received>maxPoints)fail('record_limit');
    for(const point of points){
      stable(point); // Bound depth and JSON numeric values before cloning private provider data.
      const normalized=observation(point,identity.healthUserId,from,to),previous=records.get(point.name);
      if(previous&&stable(previous.raw)!==stable(point))fail('duplicate_identity_conflict');
      if(!previous)records.set(point.name,normalized);
    }
    const next=payload.nextPageToken;
    if(next===undefined||next==='')break;
    if(typeof next!=='string'||next.length>4096||/[^\x21-\x7e]/.test(next)||seenTokens.has(next))fail('invalid_pagination');
    seenTokens.add(next);pageToken=next;
  }
  return {
    format:'lts-google-health-hydration-read',complete:true,mode:'read_only',
    source_family:GOOGLE_HEALTH_SOURCE_FAMILY,health_user_id:identity.healthUserId,
    from,to_exclusive:to,pages,received_count:received,unique_count:records.size,
    status:records.size?'observations_unverified':'empty',canonical_eligible:false,
    records:[...records.values()]
  };
}
