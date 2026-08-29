import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const allowed=new Set(['active_energy_kcal','exercise_minutes','stand_hours','steps','sleep_duration_h','resting_heart_rate_bpm','heart_rate_avg_bpm','hrv_sdnn_ms','respiratory_rate_bpm','oxygen_saturation_pct','weight_kg']);
const canonicalActivity=new Set(['active_energy_kcal','exercise_minutes','stand_hours']);
const maxRequestBytes=1_000_000;
const maxSourcePayloadBytes=8_192;
function day(v:unknown){const s=String(v||'');return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null}
function n(v:unknown){const x=Number(v);return Number.isFinite(x)&&x>=0?x:null}
function clean(v:unknown,max=160){const s=String(v||'').trim();return s?s.slice(0,max):null}
function sourceId(sourceFamily:string,metric:string,d:string,sourceName:string){return `apple_bridge:${JSON.stringify([sourceFamily,metric,d,sourceName])}`}
function payloadSize(value:unknown){try{return new TextEncoder().encode(JSON.stringify(value??{})).length}catch{return Infinity}}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  const auth=req.headers.get('Authorization');
  if(!auth)return json({error:'missing_authorization'},401);
  const declaredLength=Number(req.headers.get('content-length')||0);
  if(Number.isFinite(declaredLength)&&declaredLength>maxRequestBytes)return json({error:'payload_too_large',max_bytes:maxRequestBytes},413);
  const sb=createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {global:{headers:{Authorization:auth}},auth:{persistSession:false}}
  );
  const {data:{user},error:userError}=await sb.auth.getUser();
  if(userError||!user)return json({error:'invalid_user'},401);
  let body:any;
  let raw='';
  try{
    raw=await req.text();
    if(new TextEncoder().encode(raw).length>maxRequestBytes)return json({error:'payload_too_large',max_bytes:maxRequestBytes},413);
    body=JSON.parse(raw);
  }catch{return json({error:'invalid_json'},400)}
  const batchId=clean(body?.batch_id,120);
  const rows=Array.isArray(body?.metrics)?body.metrics:[];
  if(!batchId)return json({error:'batch_id_required'},400);
  if(!rows.length)return json({error:'metrics_required'},400);
  if(rows.length>1000)return json({error:'batch_too_large',max:1000},400);

  const normalized:any[]=[];
  const canonical:any[]=[];
  const rejected:any[]=[];
  for(let i=0;i<rows.length;i++){
    const r=rows[i]||{};
    const d=day(r.date),metric=clean(r.metric_type,80),value=n(r.value),sourceName=clean(r.source_name,160),sourceFamily=clean(r.source_family,80),unit=clean(r.unit,40);
    if(!d||!metric||!allowed.has(metric)||value==null||!sourceName||!sourceFamily){
      rejected.push({index:i,reason:'invalid_metric'});
      continue;
    }
    if(payloadSize(r.source_payload)>maxSourcePayloadBytes){
      rejected.push({index:i,reason:'source_payload_too_large'});
      continue;
    }
    const clientSourceRecordId=clean(r.source_record_id,220);
    const sid=sourceId(sourceFamily,metric,d,sourceName);
    const base={
      user_id:user.id,
      source_record_id:sid,
      metric_date:d,
      metric_type:metric,
      value,
      unit,
      source_name:sourceName,
      source_family:sourceFamily,
      canonical_status:'candidate',
      confidence:'high',
      source_file:clean(body?.source_file,180),
      source_payload:{
        ...(r.source_payload&&typeof r.source_payload==='object'?r.source_payload:{}),
        client_source_record_id:clientSourceRecordId,
        batch_id:batchId,
        bridge_version:clean(body?.bridge_version,80),
        original_source:sourceName
      },
      updated_at:new Date().toISOString()
    };
    normalized.push(base);
    if(sourceFamily==='apple_activity_summary'&&canonicalActivity.has(metric)){
      canonical.push({
        user_id:user.id,
        source_record_id:`apple_health:${metric}:${d}`,
        measured_at:`${d}T12:00:00Z`,
        metric_type:metric,
        value,
        unit,
        source:'Apple Health ActivitySummary',
        source_file:clean(body?.source_file,180),
        confidence:'high',
        notes:'Métrica diária canônica proveniente do ActivitySummary do Apple Saúde.',
        source_payload:{batch_id:batchId,bridge_version:clean(body?.bridge_version,80),method:'ActivitySummary'}
      });
    }
  }
  if(!normalized.length)return json({error:'no_valid_metrics',rejected},400);

  for(let i=0;i<normalized.length;i+=500){
    const {error}=await sb.from('health_source_daily_metrics').upsert(normalized.slice(i,i+500),{onConflict:'user_id,source_record_id'});
    if(error)return json({error:'source_metric_write_failed',detail:error.message},400);
  }
  if(canonical.length){
    for(let i=0;i<canonical.length;i+=500){
      const {error}=await sb.from('health_metrics').upsert(canonical.slice(i,i+500),{onConflict:'user_id,source_record_id'});
      if(error)return json({error:'canonical_metric_write_failed',detail:error.message},400);
    }
    const ids=new Set(canonical.map(x=>x.metric_type+'|'+String(x.measured_at).slice(0,10)));
    for(const row of normalized){
      if(row.source_family==='apple_activity_summary'&&ids.has(row.metric_type+'|'+row.metric_date))row.canonical_status='canonical';
    }
    for(let i=0;i<normalized.length;i+=500){
      const patch=normalized.slice(i,i+500).filter(x=>x.canonical_status==='canonical');
      if(patch.length){
        const {error}=await sb.from('health_source_daily_metrics').upsert(patch,{onConflict:'user_id,source_record_id'});
        if(error)return json({error:'canonical_status_write_failed',detail:error.message},400);
      }
    }
  }
  return json({ok:true,batch_id:batchId,accepted:normalized.length,rejected:rejected.length,canonicalized:canonical.length,rejected_rows:rejected.slice(0,20)});
});
