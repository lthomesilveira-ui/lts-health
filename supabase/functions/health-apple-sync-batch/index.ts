import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import md5 from 'https://esm.sh/blueimp-md5@2.19.0';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const allowed=new Set(['active_energy_kcal','exercise_minutes','stand_hours','steps','sleep_duration_h','sleep_in_bed_h','sleep_awake_h','sleep_core_h','sleep_deep_h','sleep_rem_h','sleep_asleep_unspecified_h','resting_heart_rate_bpm','heart_rate_avg_bpm','hrv_sdnn_ms','respiratory_rate_bpm','oxygen_saturation_pct','weight_kg','dietary_energy_kcal','dietary_protein_g','dietary_carbs_g','dietary_fat_g','dietary_fiber_g','dietary_water_ml']);
const canonicalActivity=new Set(['active_energy_kcal','exercise_minutes','stand_hours']);
const historicalExportFamilies=new Set(['apple_watch','iphone','polar_flow']);
const maxRequestBytes=1_000_000;
const maxSourcePayloadBytes=8_192;
function day(v:unknown){const s=String(v||'');return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null}
function n(v:unknown){const x=Number(v);return Number.isFinite(x)&&x>=0?x:null}
function clean(v:unknown,max=160){const s=String(v||'').trim();return s?s.slice(0,max):null}
function sourceId(sourceFamily:string,metric:string,d:string,sourceName:string){
  if(sourceFamily==='apple_activity_summary')return `activity_summary:${metric}:${d}`;
  if(historicalExportFamilies.has(sourceFamily))return `apple_export:${sourceFamily}:${metric}:${d}:${md5(sourceName)}`;
  return `apple_bridge:${JSON.stringify([sourceFamily,metric,d,sourceName])}`;
}
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
  const bridgeVersion=clean(body?.bridge_version,80);
  const rows=Array.isArray(body?.metrics)?body.metrics:[];
  if(!batchId)return json({error:'batch_id_required'},400);
  if(!rows.length)return json({error:'metrics_required'},400);
  if(rows.length>1000)return json({error:'batch_too_large',max:1000},400);

  const normalized:any[]=[];
  const canonicalSourceIds:string[]=[];
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
        bridge_version:bridgeVersion,
        original_source:sourceName
      },
      updated_at:new Date().toISOString()
    };
    normalized.push(base);
    if(sourceFamily==='apple_activity_summary'&&canonicalActivity.has(metric))canonicalSourceIds.push(sid);
  }
  if(!normalized.length)return json({error:'no_valid_metrics',rejected},400);

  for(let i=0;i<normalized.length;i+=500){
    const {error}=await sb.from('health_source_daily_metrics').upsert(normalized.slice(i,i+500),{onConflict:'user_id,source_record_id'});
    if(error)return json({error:'source_metric_write_failed',detail:error.message},400);
  }

  let promotion:any={promoted:0,blocked:0,missing:0,invalid:0};
  const sourceIds=[...new Set(canonicalSourceIds)];
  if(sourceIds.length){
    const {data,error}=await sb.rpc('health_promote_apple_activity_summary',{
      p_source_record_ids:sourceIds,
      p_batch_id:batchId,
      p_bridge_version:bridgeVersion
    });
    if(error)return json({error:'canonical_promotion_failed',detail:error.message},400);
    if(data&&typeof data==='object')promotion=data;
  }

  return json({
    ok:true,
    batch_id:batchId,
    accepted:normalized.length,
    rejected:rejected.length,
    canonicalized:Number(promotion.promoted||0),
    review_blocked:Number(promotion.blocked||0),
    promotion_missing:Number(promotion.missing||0),
    promotion_invalid:Number(promotion.invalid||0),
    rejected_rows:rejected.slice(0,20)
  });
});