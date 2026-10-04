import {json,cors,config,configured,service,authenticatedUser,connection,publicStatus,startAuthorization,syncPolar} from '../_shared/polar-runtime.mjs';

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  if(req.headers.get('Origin')&&req.headers.get('Origin')!=='https://lthomesilveira-ui.github.io')return json({error:'origin_not_allowed'},403);
  try{
    const c=config(),user=await authenticatedUser(req,c);if(!user)return json({error:'unauthorized'},401);
    const text=await req.text();if(text.length>2048)return json({error:'payload_too_large'},413);
    let body;try{body=JSON.parse(text);}catch{return json({error:'invalid_json'},400);}
    const db=service(c),action=body?.action;
    if(action==='status')return json(publicStatus(c,await connection(db,user.id,'connected_at,last_sync_at,last_attempt_at,sync_error')));
    if(action==='disconnect'){
      const states=await db.from('health_polar_oauth_states').delete().eq('user_id',user.id);if(states.error)throw Error();
      const result=await db.from('health_polar_connections').delete().eq('user_id',user.id);if(result.error)throw Error();
      return json(publicStatus(c,null));
    }
    if(!['start','sync'].includes(action))return json({error:'invalid_action'},400);
    if(!configured(c))return json({error:'configuration_required'},409);
    if(action==='start')return json({authorization_url:await startAuthorization(db,c,user.id)});
    return json(await syncPolar(db,c,user.id));
  }catch{return json({error:'connection_unavailable'},503);}
});
