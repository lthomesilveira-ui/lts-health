import {receiveSummary} from './receive-summary.mjs';
import {captureBasalCandidates} from './basal-energy-candidates.mjs';
import {KEY_HEADER,MAX_BODY_BYTES,validToken,digest,normalizeExport,unitErrorDetails} from './health-auto-export-contract.mjs';

const cors={'Access-Control-Allow-Origin':'https://lthomesilveira-ui.github.io','Access-Control-Allow-Headers':`content-type,${KEY_HEADER},automation-aggregation`,'Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const validationErrors=new Set(['daily_aggregation_required','invalid_date','invalid_source','invalid_value','unsupported_unit','invalid_payload','health_metrics_only','duplicate_daily_metric','too_many_points','payload_too_large']);
export async function boundedJson(req,max=MAX_BODY_BYTES,observe=()=>{}){
  const header=req.headers.get('content-length');
  const declared=typeof header==='string'&&/^\d{1,16}$/.test(header)&&Number.isSafeInteger(Number(header))?Number(header):null;
  let size=null,complete=false,trigger=null;
  try{
    if(Number(header)>max){trigger='declared_length';throw Error('payload_too_large');}
    const reader=req.body?.getReader();if(!reader)throw Error('invalid_payload');
    const chunks=[];size=0;
    for(;;){
      const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>max){trigger='stream';try{await reader.cancel();}catch{/* Preserve the limit response even if cancellation fails. */}throw Error('payload_too_large');}
      chunks.push(value);
    }
    complete=true;
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw Error('invalid_payload');}
  }finally{
    // Numeric transport facts only; an unconsumed body is unknown, not empty.
    // A stopped stream gives a lower bound, never the complete rejected size.
    try{observe({limit_bytes:max,declared_bytes:declared,observed_bytes:size,complete,limit_trigger:trigger});}catch{/* Diagnostics cannot change ingestion. */}
  }
}
export async function receiveHealthExport(req,db,{emit=event=>console.info(JSON.stringify(event))}={}){
  let authenticated=false,batch=null,transport=null;
  const correlationId=crypto.randomUUID();
  const record=(outcome,acceptedMetrics=0,validationCode=null,acceptedBasalCandidates=0)=>{if(authenticated)try{emit(receiveSummary({outcome,transport,metrics:batch?.metrics||[],ignoredPoints:batch?.ignored_points||0,ignoredBasalBlocks:batch?.ignored_basal_blocks,ignoredBasalPoints:batch?.ignored_basal_points,waterBlocks:batch?.water_blocks_observed,acceptedMetrics,acceptedBasalCandidates,basalCandidatePoints:batch?.basal_candidates?.length,correlationId,validationCode,automationPeriod:req.headers.get('automation-period')}));}catch{/* Logging cannot change ingestion. */}};
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  const token=req.headers.get(KEY_HEADER);if(!validToken(token))return json({error:'unauthorized'},401);
  try{
    const keyHash=await digest(token);
    const lookup=await db.from('health_auto_export_connections').select('active').eq('key_hash',keyHash).eq('active',true).maybeSingle();
    if(lookup.error)return json({error:'temporarily_unavailable'},503);
    if(!lookup.data)return json({error:'unauthorized'},401);
    authenticated=true;
    if(!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||'')){record('validation_rejected',0,'json_required');return json({error:'json_required',correlation_id:correlationId},415);}
    const payload=await boundedJson(req,MAX_BODY_BYTES,value=>{transport=value;});batch=normalizeExport(payload,{aggregation:req.headers.get('automation-aggregation')});
    // Count only the exact documented water identifier after full validation.
    batch.water_blocks_observed=payload.data.metrics.filter(metric=>metric.name==='dietary_water').length;
    const basal=captureBasalCandidates(payload);batch.basal_candidates=basal.candidates;
    batch.ignored_points-=basal.candidates.length;batch.ignored_basal_points=basal.rejected_points;batch.ignored_basal_blocks=basal.ignored_blocks;
    if(!batch.metrics.length&&!batch.basal_candidates.length){record('no_supported_data');return json({received:false,accepted_metrics:0,ignored_points:batch.ignored_points,message:'no_supported_data',outcome:'no_supported_data',nutrition_metrics_observed:0,coverage_verified:false,correlation_id:correlationId,nutrition_dates_observed:0},200);}
    // One RPC transaction for mixed batches. Never double-consume the rate limit,
    // partially write nutrition, or send basal snapshots through the daily router.
    const result=batch.basal_candidates.length
      ?await db.rpc('health_auto_export_ingest_candidates',{p_key_hash:keyHash,p_metrics:batch.metrics,p_basal_candidates:batch.basal_candidates,p_receipt_id:correlationId})
      :await db.rpc('health_auto_export_ingest',{p_key_hash:keyHash,p_metrics:batch.metrics});
    if(result.error){record('ingestion_failed');return json({error:'temporarily_unavailable',correlation_id:correlationId},503);}
    if(result.data?.error==='unauthorized')return json({error:'unauthorized'},401);
    if(result.data?.error==='rate_limited'){record('rate_limited');return json({error:'rate_limited',correlation_id:correlationId},429);}
    if(!result.data?.received){record('ingestion_failed');return json({error:'temporarily_unavailable',correlation_id:correlationId},503);}
    if(batch.basal_candidates.length&&result.data.accepted_basal_candidates!==batch.basal_candidates.length){record('ingestion_failed');return json({error:'temporarily_unavailable',correlation_id:correlationId},503);}
    record('accepted',result.data.accepted_metrics,null,result.data.accepted_basal_candidates||0);
    const summary=receiveSummary({outcome:'accepted',metrics:batch.metrics,acceptedMetrics:result.data.accepted_metrics,acceptedBasalCandidates:result.data.accepted_basal_candidates||0,correlationId});
    return json({...result.data,ignored_points:batch.ignored_points,correlation_id:correlationId,outcome:summary.outcome,nutrition_metrics_observed:summary.nutrition_metrics_observed,nutrition_dates_observed:summary.nutrition_dates_observed,nutrition_first_date_observed:summary.nutrition_first_date_observed,nutrition_last_date_observed:summary.nutrition_last_date_observed,coverage_verified:false});
  }catch(error){
  const code=validationErrors.has(error?.message)?error.message:'temporarily_unavailable';
  record(validationErrors.has(code)?'validation_rejected':'ingestion_failed',0,code);
  const details=unitErrorDetails(error);
  if(details)try{console.warn(JSON.stringify({event:'health_auto_export_validation',error:code,correlation_id:authenticated?correlationId:null,...details}));}catch{/* Diagnostics must not change the response. */}
  return json({error:code,...(details||{}),...(authenticated?{correlation_id:correlationId}:{})},code==='payload_too_large'?413:validationErrors.has(code)?422:503);
  }
}
