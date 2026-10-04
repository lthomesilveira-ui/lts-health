export const POLAR_SCOPES=['training_sessions:read','sleep:read'];
const encoder=new TextEncoder();
const encode=bytes=>btoa(String.fromCharCode(...bytes));
const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function randomState(){return encode(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export function validKey(value){try{return decode(value).length===32;}catch{return false;}}
async function keyFor(secret){if(!validKey(secret))throw Error('invalid_encryption_key');return crypto.subtle.importKey('raw',decode(secret),'AES-GCM',false,['encrypt','decrypt']);}
export async function encryptTokens(value,secret,userId){
  const iv=crypto.getRandomValues(new Uint8Array(12)),key=await keyFor(secret);
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(userId)},key,encoder.encode(JSON.stringify(value))));
  return `v1.${encode(iv)}.${encode(encrypted)}`;
}
export async function decryptTokens(value,secret,userId){
  const [version,iv,encrypted]=String(value).split('.');if(version!=='v1')throw Error('unsupported_encryption');
  const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:encoder.encode(userId)},await keyFor(secret),decode(encrypted));
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function validDay(value){const s=String(value||'').slice(0,10);try{return /^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(`${s}T12:00:00Z`).toISOString().slice(0,10)===s?s:null;}catch{return null;}}
export const addDays=(value,n)=>new Date(Date.parse(`${value}T12:00:00Z`)+n*86400000).toISOString().slice(0,10);
export function localDay(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  return ['year','month','day'].map(k=>parts.find(p=>p.type===k)?.value).join('-');
}
const numeric=(v,max=Infinity)=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=max?Number(v):null;
const seconds=value=>/^\d+(?:\.\d{1,9})?s$/.test(String(value))?numeric(String(value).slice(0,-1),86400):null;
const clean=(value,max=120)=>String(value||'').trim().slice(0,max);
export async function polarSessions(payload,userId){
  if(!Array.isArray(payload?.trainingSessions))throw Error('unexpected_provider_schema');
  const rows=[],seen=new Set(),duplicates=new Set();
  for(const r of payload.trainingSessions){
    const id=clean(r.identifier?.id,180),date=validDay(r.startTime);
    if(seen.has(id)){duplicates.add(`polar_v4:session:${id}`);continue;}
    if(!id||!date||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(String(r.startTime)))continue;
    seen.add(id);const duration=numeric(r.durationMillis),device=clean(r.deviceId),alias=device?(await digest(device)).slice(0,10):null;
    const hr=numeric(r.hrAvg,300),max=numeric(r.hrMax,300);
    rows.push({user_id:userId,source_record_id:`polar_v4:session:${id}`,workout_date:date,recorded_start:clean(r.startTime,60),session_name:clean(r.name)||'Sessão Polar',duration_minutes:duration==null?null:duration/60000,heart_rate_avg:hr>0?hr:null,heart_rate_max:max>0?max:null,source_name:alias?`Polar Flow · aparelho ${alias}`:'Polar Flow · aparelho não informado',source_payload:{schema:'polar_accesslink_v4',timezone_offset_minutes:r.timezoneOffsetMinutes!=null&&Number.isInteger(Number(r.timezoneOffsetMinutes))&&Math.abs(Number(r.timezoneOffsetMinutes))<=840?Number(r.timezoneOffsetMinutes):null},updated_at:new Date().toISOString()});
  }
  return rows.filter(r=>!duplicates.has(r.source_record_id));
}
export async function polarSleep(payload,userId){
  if(!Array.isArray(payload?.nightSleeps))throw Error('unexpected_provider_schema');
  const rows=[],seen=new Set(),duplicates=new Set();
  for(const r of payload.nightSleeps){
    const date=validDay(r.sleepDate),duration=seconds(r.sleepEvaluation?.asleepDuration),device=clean(r.sleepResult?.hypnogram?.deviceReference?.uuid,180);
    // Span is time in bed, not asleep duration. No fallback between the two.
    if(!date||duration==null||!device)continue;
    const alias=(await digest(device)).slice(0,10),id=`polar_v4:sleep_duration_h:${date}:${alias}`;
    if(seen.has(id)){duplicates.add(id);continue;}seen.add(id);
    rows.push({user_id:userId,source_record_id:id,metric_date:date,metric_type:'sleep_duration_h',value:duration/3600,unit:'h',source_name:`Polar Flow · aparelho ${alias}`,source_family:'polar_flow',canonical_status:'candidate',confidence:'high',source_file:'Polar AccessLink v4',source_payload:{schema:'polar_accesslink_v4',measure:'asleepDuration'},updated_at:new Date().toISOString()});
  }
  return rows.filter(r=>!duplicates.has(r.source_record_id));
}
