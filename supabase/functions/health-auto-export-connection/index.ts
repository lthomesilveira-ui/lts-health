import {config,service,authenticatedUser} from '../_shared/health-auto-export-runtime.mjs';
import {randomToken,digest,KEY_HEADER} from '../_shared/health-auto-export-contract.mjs';
import {boundedJson} from '../_shared/health-auto-export-handler.mjs';
const origin='https://lthomesilveira-ui.github.io';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const columns='active,key_revision,created_at,last_received_at,last_metric_date,last_metric_count,last_water_date';
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return json({error:'forbidden_origin'},403);
  try{
    const c=config(),user=await authenticatedUser(req,c);if(!user)return json({error:'authentication_required'},401);
    const body=await boundedJson(req,2048),action=body?.action||'status';
    if(!['status','create','rotate','disconnect'].includes(action))return json({error:'invalid_action'},400);
    const db=service(c);let token;
    if(action!=='status'){
      if(action!=='disconnect')token=randomToken();
      const {data,error}=await db.rpc('health_auto_export_manage',{p_user_id:user.id,p_action:action,p_key_hash:token?await digest(token):null,p_expected_revision:body.key_revision||null});
      if(error)return json({error:'connection_unavailable'},503);
      if(data?.error)return json({error:data.error==='revision_changed'?'revision_changed':'already_configured'},409);
    }
    const {data:row,error}=await db.from('health_auto_export_connections').select(columns).eq('user_id',user.id).maybeSingle();
    if(error)return json({error:'connection_unavailable'},503);
    const result={configured:Boolean(row?.active),received:Boolean(row?.active&&row?.last_received_at),key_revision:row?.key_revision||null,last_received_at:row?.last_received_at||null,last_metric_date:row?.last_metric_date||null,last_metric_count:row?.last_metric_count||0,last_water_date:row?.last_water_date||null,endpoint_url:`${c.url}/functions/v1/health-auto-export-receive`,header_name:KEY_HEADER};
    return json(token?{...result,setup_key:token}:result);
  }catch{return json({error:'connection_unavailable'},503);}
});
