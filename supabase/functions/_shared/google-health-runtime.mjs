import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.117.2';
import {createGoogleHealthHandlers} from './google-health-connection.mjs';
import {resolveGoogleHealthServerConfig} from './google-health-config.mjs';
export const googleHealthConfig=()=>({url:Deno.env.get('SUPABASE_URL'),publicKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  enabled:Deno.env.get('GOOGLE_HEALTH_ENABLED')==='true',disabledByEnv:Deno.env.get('GOOGLE_HEALTH_ENABLED')==='false',clientId:Deno.env.get('GOOGLE_HEALTH_CLIENT_ID'),
  clientSecret:Deno.env.get('GOOGLE_HEALTH_CLIENT_SECRET'),encryptionKey:Deno.env.get('GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY')});
async function authenticate(request,c){
  const header=request.headers.get('Authorization');if(!/^Bearer \S+$/.test(header||''))return null;
  const client=createClient(c.url,c.publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.getUser(header.slice(7));
  return error||!data.user||data.user.is_anonymous===true?null:data.user;
}
const checked=result=>{if(result.error)throw Error('write_failed');return result.data;};
export const googleHealthService=c=>createClient(c.url,c.serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{
  fetch:(input,init)=>fetch(input,{...init,signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000)})
}});
function storeFactory(c,{trigger='manual'}={}){
  const db=googleHealthService(c);
  const owned=(values,user,generation,lease)=>db.from('health_google_connections').update(values)
    .eq('user_id',user).eq('generation',generation).eq('lease_token',lease).eq('status','connected');
  return {
    async connection(user){return checked(await db.from('health_google_connections').select('user_id,generation,status,health_user_id,tokens_encrypted,last_read_at,last_attempt_at,last_error').eq('user_id',user).maybeSingle());},
    async begin(user,hash,payload,expires){return checked(await db.rpc('health_google_begin_authorization',{p_user_id:user,p_state_hash:hash,p_payload_encrypted:payload,p_expires_at:expires}));},
    async consume(hash){const rows=checked(await db.rpc('health_google_consume_state',{p_state_hash:hash}));return rows?.[0]??null;},
    async save(user,generation,hash,healthUserId,tokens){return checked(await db.rpc('health_google_save_authorization',{p_user_id:user,p_generation:generation,p_state_hash:hash,p_health_user_id:healthUserId,p_tokens_encrypted:tokens}));},
    async disconnect(user){return checked(await db.rpc('health_google_disconnect',{p_user_id:user}));},
    async claim(user,generation,lease,now,until){
      if(trigger==='scheduled')return checked(await db.rpc('health_google_claim_scheduled_read',{p_user_id:user,p_generation:generation,p_lease_token:lease}))===true;
      const row=checked(await db.from('health_google_connections').update({lease_token:lease,lease_until:until,last_attempt_at:now})
        .eq('user_id',user).eq('generation',generation).eq('status','connected').lte('lease_until',now).select('user_id').maybeSingle());
      return Boolean(row);
    },
    async refresh(user,generation,lease,tokens){return Boolean(checked(await owned({tokens_encrypted:tokens},user,generation,lease).select('user_id').maybeSingle()));},
    async finish(user,generation,lease,result){return checked(await db.rpc(trigger==='scheduled'?'health_google_finish_scheduled_read':'health_google_finish_read',{p_user_id:user,p_generation:generation,p_lease_token:lease,p_result:result}));},
    async release(user,generation,lease,reason){checked(await owned({lease_token:null,lease_until:'1970-01-01T00:00:00Z',last_error:reason},user,generation,lease));}
  };
}
async function resolveConfig(c){
  return resolveGoogleHealthServerConfig(c,async()=>{
    const db=googleHealthService(c);
    return checked(await db.rpc('health_google_server_configuration').abortSignal(AbortSignal.timeout(5000)));
  });
}
export const googleHealthHandlers=createGoogleHealthHandlers({config:googleHealthConfig,authenticate,storeFactory,resolveConfig});
