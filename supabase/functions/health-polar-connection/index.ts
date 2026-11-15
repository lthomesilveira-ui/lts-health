import {activitySnapshot,hasActivityScope} from '../_shared/polar-activity.mjs';
import {json,cors,config,configured,service,authenticatedUser,connection,publicStatus,schedulerStatus,startAuthorization,syncPolar} from '../_shared/polar-runtime.mjs';

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  if(req.headers.get('Origin')&&req.headers.get('Origin')!=='https://lthomesilveira-ui.github.io')return json({error:'origin_not_allowed'},403);
  try{
    const c=config(),user=await authenticatedUser(req,c);if(!user)return json({error:'unauthorized'},401);
    const text=await req.text();if(text.length>2048)return json({error:'payload_too_large'},413);
    let body;try{body=JSON.parse(text);}catch{return json({error:'invalid_json'},400);}
    const db=service(c),action=body?.action;
    if(action==='status'){
      const row=await connection(db,user.id,'scopes,connected_at,last_sync_at,last_attempt_at,sync_error,last_sync_trigger,last_scheduled_sync_at,last_scheduled_attempt_at');
      let observations=[],activityUnavailable=false;
      if(hasActivityScope(row)){try{observations=await activitySnapshot(db,user.id);}catch{activityUnavailable=true;}}
      return json({...publicStatus(c,row,await schedulerStatus(db),observations),activity_status_unavailable:activityUnavailable});
    }
    if(action==='disconnect'){
      const states=await db.from('health_polar_oauth_states').delete().eq('user_id',user.id);if(states.error)throw Error();
      const result=await db.from('health_polar_connections').delete().eq('user_id',user.id);if(result.error)throw Error();
      return json(publicStatus(c,null));
    }
    if(!['start','start_activity','sync','activity'].includes(action))return json({error:'invalid_action'},400);
    if(!configured(c))return json({error:'configuration_required'},409);
    if(action==='start'||action==='start_activity'){const row=await connection(db,user.id,'scopes');return json({authorization_url:await startAuthorization(db,c,user.id,{activity:action==='start_activity'||hasActivityScope(row)})});}
    if(action==='activity')return json(await syncPolar(db,c,user.id,{activityOnly:true}));
    return json(await syncPolar(db,c,user.id,{trigger:body?.trigger==='app_open'?'app_open':'manual'}));
  }catch{return json({error:'connection_unavailable'},503);}
});
