import {digest} from './polar-contract.mjs';
import {validGoogleHealthConfigurationHints} from './google-health-configuration-check.mjs';
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function googleHydrationWindow(now=Date.now()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));
  const today=Date.UTC(+parts.year,+parts.month-1,+parts.day),date=days=>new Date(today+days*86400000).toISOString().slice(0,10);
  return {from:date(-29),to:date(1)};
}
async function tickBody(req){
  if(!req.body)return {error:'invalid_json',status:400};
  const reader=req.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let size=0,text='';
  try{
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>1024){try{await reader.cancel();}catch{}return {error:'payload_too_large',status:413};}
      text+=decoder.decode(value,{stream:true});}
    text+=decoder.decode();const body=JSON.parse(text);
    if(body&&!Array.isArray(body)&&body.action==='tick'&&Object.keys(body).length===1)return {action:'tick'};
    return validGoogleHealthConfigurationHints(body)?{action:'configuration_check',hints:body}:{error:'invalid_action',status:400};
  }catch{return {error:'invalid_json',status:400};}finally{reader.releaseLock();}
}

// The private database agenda issues a five-minute, single-use invocation ticket.
// No owner, provider token, permanent key or data range is accepted from HTTP input.
export async function handleGoogleHydrationSchedule(req,{db,ready,read,configurationCheck,now=()=>Date.now()}){
  if(req.method!=='POST')return response({error:'method_not_allowed'},405);
  if(req.headers.has('Origin'))return response({error:'origin_not_allowed'},403);
  const key=req.headers.get('x-lts-google-scheduler')||'';
  if(!/^[a-f0-9]{64}$/.test(key))return response({error:'unauthorized'},401);
  try{
    const auth=await db.rpc('health_google_scheduler_authorized',{p_key_hash:await digest(key)});
    if(auth.error)return response({error:'scheduler_unavailable'},503);
    if(auth.data!==true)return response({error:'unauthorized'},401);
    if(!/^application\/json(?:\s*;|\s*$)/i.test(req.headers.get('Content-Type')||''))return response({error:'invalid_content_type'},415);
    const body=await tickBody(req);if(body.error)return response({error:body.error},body.status);
    // Same consumed single-use ticket, before configuration lookup or owner
    // selection. Normal cron keeps sending only tick; no new agenda or key.
    if(body.action==='configuration_check'){
      if(typeof configurationCheck!=='function')return response({error:'scheduler_unavailable'},503);
      return response(await configurationCheck(body.hints));
    }
    if(!await ready())return response({disabled:true,attempted:0,completed:0,skipped:0,failed:0});
    const listed=await db.rpc('health_google_scheduled_candidates');
    if(listed.error||!Array.isArray(listed.data)||listed.data.length>2||
        listed.data.some(row=>!row||!uuid.test(row.user_id||''))||new Set(listed.data.map(row=>row.user_id.toLowerCase())).size!==listed.data.length)return response({error:'scheduler_unavailable'},503);
    const window=googleHydrationWindow(now()),counts={attempted:listed.data.length,completed:0,skipped:0,failed:0};
    const results=await Promise.all(listed.data.map(async row=>{try{return await read(row.user_id,window.from,window.to);}catch{return null;}}));
    for(const result of results){
      if(result?.read===true&&result.canonical_updated===false)counts.completed++;
      else if(result?.read===false&&(result.in_progress===true||result.connected===false||result.configured===false||result.superseded===true))counts.skipped++;
      else counts.failed++;
    }
    return response(counts,counts.failed?503:200);
  }catch{return response({error:'scheduler_unavailable'},503);}
}
