import {KEY_HEADER,MAX_BODY_BYTES,validToken,digest,normalizeExport,unitErrorDetails} from './health-auto-export-contract.mjs';

const cors={'Access-Control-Allow-Origin':'https://lthomesilveira-ui.github.io','Access-Control-Allow-Headers':`content-type,${KEY_HEADER},automation-aggregation`,'Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const validationErrors=new Set(['daily_aggregation_required','invalid_date','invalid_source','invalid_value','unsupported_unit','invalid_payload','health_metrics_only','duplicate_daily_metric','too_many_points','payload_too_large']);
export async function boundedJson(req,max=MAX_BODY_BYTES){
  if(Number(req.headers.get('content-length'))>max)throw Error('payload_too_large');
  const reader=req.body?.getReader();if(!reader)throw Error('invalid_payload');
  const chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('payload_too_large');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw Error('invalid_payload');}
}
export async function receiveHealthExport(req,db){
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  const token=req.headers.get(KEY_HEADER);if(!validToken(token))return json({error:'unauthorized'},401);
  try{
    const keyHash=await digest(token);
    const lookup=await db.from('health_auto_export_connections').select('active').eq('key_hash',keyHash).eq('active',true).maybeSingle();
    if(lookup.error)return json({error:'temporarily_unavailable'},503);
    if(!lookup.data)return json({error:'unauthorized'},401);
    if(!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))return json({error:'json_required'},415);
    const payload=await boundedJson(req),batch=normalizeExport(payload,{aggregation:req.headers.get('automation-aggregation')});
    if(!batch.metrics.length)return json({received:false,accepted_metrics:0,ignored_points:batch.ignored_points,message:'no_supported_data'},200);
    const result=await db.rpc('health_auto_export_ingest',{p_key_hash:keyHash,p_metrics:batch.metrics});
    if(result.error)return json({error:'temporarily_unavailable'},503);
    if(result.data?.error==='unauthorized')return json({error:'unauthorized'},401);
    if(result.data?.error==='rate_limited')return json({error:'rate_limited'},429);
    if(!result.data?.received)return json({error:'temporarily_unavailable'},503);
    return json({...result.data,ignored_points:batch.ignored_points});
  }catch(error){
  const code=validationErrors.has(error?.message)?error.message:'temporarily_unavailable';
  const details=unitErrorDetails(error);
  if(details)console.warn(JSON.stringify({event:'health_auto_export_validation',error:code,...details}));
  return json({error:code,...(details||{})},code==='payload_too_large'?413:validationErrors.has(code)?422:503);
  }
}
