import {config,configured,service,syncPolar} from '../_shared/polar-runtime.mjs';
import {handleScheduledSync} from '../_shared/polar-schedule.mjs';

// Custom authentication is checked by the handler before selecting connections.
// JWT verification is intentionally disabled only for this ticket-authenticated
// server-to-server endpoint; owner-facing connection routes keep JWT protection.
Deno.serve(async req=>{
  const c=config();
  if(!configured(c))return new Response(JSON.stringify({error:'configuration_required'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  return handleScheduledSync(req,{db:service(c),sync:userId=>syncPolar(service(c),c,userId,{trigger:'scheduled'})});
});
