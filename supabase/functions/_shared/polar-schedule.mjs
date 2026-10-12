import {digest} from './polar-contract.mjs';

export const normalizeSyncTrigger=value=>value==='scheduled'?'scheduled':value==='app_open'?'app_open':'manual';
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export const scheduledCandidates=(rows,now=Date.now())=>rows.filter(row=>row?.user_id&&(!row.last_scheduled_attempt_at||!Number.isFinite(Date.parse(row.last_scheduled_attempt_at))||now-Date.parse(row.last_scheduled_attempt_at)>=50*60000));

// A five-minute, single-use credential is generated only by the private database
// job. It is not a browser session, user token, provider token or public API key.
export async function handleScheduledSync(req,{db,sync,now=Date.now()}){
  if(req.method!=='POST')return response({error:'method_not_allowed'},405);
  if(req.headers.get('Origin'))return response({error:'origin_not_allowed'},403);
  const key=req.headers.get('x-lts-polar-scheduler')||'';
  if(!/^[a-f0-9]{64}$/.test(key))return response({error:'unauthorized'},401);
  try{
    const auth=await db.rpc('health_polar_scheduler_authorized',{p_key_hash:await digest(key)});
    if(auth.error)return response({error:'scheduler_unavailable'},503);
    if(auth.data!==true)return response({error:'unauthorized'},401);
    if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return response({error:'invalid_content_type'},415);
    const raw=await req.text();if(raw.length>1024)return response({error:'payload_too_large'},413);
    let body;try{body=JSON.parse(raw);}catch{return response({error:'invalid_json'},400);}
    if(!body||body.action!=='tick'||Object.keys(body).some(k=>k!=='action'))return response({error:'invalid_action'},400);
    const listed=await db.from('health_polar_connections').select('user_id,last_scheduled_attempt_at').limit(51);
    if(listed.error||!Array.isArray(listed.data)||listed.data.length>50)return response({error:'scheduler_unavailable'},503);
    const due=scheduledCandidates(listed.data,now),counts={attempted:due.length,completed:0,skipped:listed.data.length-due.length,failed:0};
    for(let i=0;i<due.length;i+=3){
      const results=await Promise.all(due.slice(i,i+3).map(async row=>{try{return await sync(row.user_id);}catch{return {synced:false};}}));
      for(const result of results){if(result?.synced===true)counts.completed++;else if(result?.in_progress||result?.connected===false)counts.skipped++;else counts.failed++;}
    }
    return response(counts,counts.failed?503:200);
  }catch{return response({error:'scheduler_unavailable'},503);}
}
