import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.117.2';
import {POLAR_SCOPES,validKey,encryptTokens,decryptTokens,digest,randomState,localDay,addDays,polarSessions,polarSleep,validDay} from './polar-contract.mjs';
import {providerRead,providerItems,syncFailure,dayWindows,trainingWindowParams} from './polar-provider.mjs';

export const APP_URL='https://lthomesilveira-ui.github.io/lts-health/v2/';
export const cors={'Access-Control-Allow-Origin':'https://lthomesilveira-ui.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
export const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
export const config=()=>({url:Deno.env.get('SUPABASE_URL'),publicKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),clientId:Deno.env.get('POLAR_CLIENT_ID'),clientSecret:Deno.env.get('POLAR_CLIENT_SECRET'),encryptionKey:Deno.env.get('POLAR_TOKEN_ENCRYPTION_KEY')});
export const configured=c=>Boolean(c.clientId&&c.clientSecret&&validKey(c.encryptionKey));
export const callbackUrl=c=>`${c.url}/functions/v1/health-polar-callback`;
export const service=c=>createClient(c.url,c.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
export async function authenticatedUser(req,c){
  const auth=req.headers.get('Authorization');if(!/^Bearer \S+$/.test(auth||''))return null;
  const client=createClient(c.url,c.publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.getUser(auth.slice(7));return !error&&!data.user?.is_anonymous?data.user:null;
}
export async function connection(db,userId,select='*'){
  const {data,error}=await db.from('health_polar_connections').select(select).eq('user_id',userId).maybeSingle();if(error)throw Error('write_failed');return data;
}
export function publicStatus(c,row){return {configured:configured(c),connected:Boolean(row),last_sync_at:row?.last_sync_at||null,last_attempt_at:row?.last_attempt_at||null,sync_error:row?.sync_error||null,update_mode:'on_open',callback_url:callbackUrl(c)};}
export async function startAuthorization(db,c,userId){
  const state=randomState(),hash=await digest(state),now=new Date().toISOString();
  const cleanup=await db.from('health_polar_oauth_states').delete().eq('user_id',userId).lt('expires_at',now);if(cleanup.error)throw Error('write_failed');
  const {error}=await db.from('health_polar_oauth_states').insert({state_hash:hash,user_id:userId,expires_at:new Date(Date.now()+600000).toISOString()});if(error)throw Error('write_failed');
  const url=new URL('https://auth.polar.com/oauth/authorize');url.search=new URLSearchParams({client_id:c.clientId,response_type:'code',scope:POLAR_SCOPES.join(' '),redirect_uri:callbackUrl(c),state}).toString();return url.href;
}
export async function consumeState(db,state){
  if(!/^[A-Za-z0-9_-]{43}$/.test(state||''))return null;
  // DELETE ... RETURNING is atomic. An expired or consumed state cannot link any account.
  const {data,error}=await db.from('health_polar_oauth_states').delete().eq('state_hash',await digest(state)).gt('expires_at',new Date().toISOString()).select('user_id').maybeSingle();
  if(error)throw Error('write_failed');return data?.user_id||null;
}
async function responseJson(response,max=2000000){
  if(!response.ok)throw Error(response.status===401||response.status===403?'authorization_expired':'provider_unavailable');
  const text=await response.text();if(new TextEncoder().encode(text).length>max)throw Error('provider_unavailable');
  try{return JSON.parse(text);}catch{throw Error('provider_unavailable');}
}
export async function tokenExchange(c,params){
  const response=await fetch('https://auth.polar.com/oauth/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Basic ${btoa(`${c.clientId}:${c.clientSecret}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
  const token=await responseJson(response,32000),scopes=String(token.scope||'').split(/\s+/).filter(Boolean);
  if(!token.access_token||!token.refresh_token||!Number.isFinite(Number(token.expires_in))||Number(token.expires_in)<=0||!POLAR_SCOPES.every(s=>scopes.includes(s)))throw Error('authorization_expired');
  return {access_token:token.access_token,refresh_token:token.refresh_token,expires_at:Date.now()+Number(token.expires_in)*1000,scopes};
}
export async function saveAuthorization(db,c,userId,token){
  const {error}=await db.from('health_polar_connections').upsert({user_id:userId,tokens_encrypted:await encryptTokens(token,c.encryptionKey,userId),scopes:token.scopes,revision:crypto.randomUUID(),connected_at:new Date().toISOString(),last_sync_at:null,last_attempt_at:null,sync_error:null,sync_lease_until:'1970-01-01T00:00:00Z'});if(error)throw Error('write_failed');
}
async function writeRows(db,table,rows){for(let i=0;i<rows.length;i+=500){const {error}=await db.from(table).upsert(rows.slice(i,i+500),{onConflict:'user_id,source_record_id'});if(error)throw Error('write_failed');}}
export async function syncPolar(db,c,userId){
  const row=await connection(db,userId);if(!row)return {connected:false,synced:false};
  const now=new Date().toISOString(),lease=new Date(Date.now()+300000).toISOString();
  const claim=await db.from('health_polar_connections').update({sync_lease_until:lease,last_attempt_at:now}).eq('user_id',userId).eq('revision',row.revision).lte('sync_lease_until',now).select('user_id').maybeSingle();
  if(claim.error)throw Error('write_failed');if(!claim.data)return {connected:true,synced:false,in_progress:true};
  let phase='token';
  try{
    let token=await decryptTokens(row.tokens_encrypted,c.encryptionKey,userId);
    if(!token.access_token||!token.refresh_token)throw Error('authorization_expired');
    if(token.expires_at<Date.now()+60000){
      phase='refresh';
      token=await tokenExchange(c,{grant_type:'refresh_token',refresh_token:token.refresh_token});
      const update=await db.from('health_polar_connections').update({tokens_encrypted:await encryptTokens(token,c.encryptionKey,userId),scopes:token.scopes}).eq('user_id',userId).eq('revision',row.revision).select('user_id').maybeSingle();
      if(update.error||!update.data)throw Error('authorization_expired');
    }
    phase='calendar';
    const today=localDay(),end=addDays(today,1),start=addDays(today,row.last_sync_at?-6:-29);
    phase='lists';
    const sessionsPayload={trainingSessions:[]};
    for(const window of dayWindows(addDays(today,row.last_sync_at?-6:-89),end)){
      const payload=await providerRead(token.access_token,'training-sessions/list',trainingWindowParams(window));
      sessionsPayload.trainingSessions.push(...providerItems(payload,'trainingSessions','sessions'));
    }
    const sleepList=await providerRead(token.access_token,'sleeps',{from:start,to:end});
    phase='sleep_dates';
    const dates=[...new Set(providerItems(sleepList,'nightSleeps','sleep').map(r=>validDay(r.sleepDate)).filter(d=>d&&d>=start&&d<=today))];
    const metrics=[];
    for(let i=0;i<dates.length;i+=3){
      phase='sleep_details';
      const results=await Promise.all(dates.slice(i,i+3).map(d=>providerRead(token.access_token,'sleeps',{from:d,to:addDays(d,1),features:'sleep-result,sleep-evaluation'})));
      for(const payload of results){providerItems(payload,'nightSleeps','sleep');metrics.push(...await polarSleep(payload,userId));}
    }
    phase='sessions';
    providerItems(sessionsPayload,'trainingSessions','sessions');
    const sessions=(await polarSessions(sessionsPayload,userId)).filter(r=>r.workout_date<=today&&r.workout_date>=addDays(today,row.last_sync_at?-6:-89));
    phase='ownership';
    const stillLinked=await connection(db,userId,'revision');if(stillLinked?.revision!==row.revision)return {connected:false,synced:false};
    phase='write';
    await writeRows(db,'health_polar_sessions',sessions);await writeRows(db,'health_source_daily_metrics',metrics);
    const updated=await db.from('health_polar_connections').update({last_sync_at:new Date().toISOString(),sync_error:null,sync_lease_until:'1970-01-01T00:00:00Z'}).eq('user_id',userId).eq('revision',row.revision);
    if(updated.error)throw Error('write_failed');return {connected:true,synced:true};
  }catch(error){
    const detail=syncFailure(error,phase),reason=['authorization_expired','write_failed'].includes(detail)?detail:'provider_unavailable';
    console.info('polar_sync_failure',detail);
    const released=await db.from('health_polar_connections').update({sync_error:reason,sync_lease_until:'1970-01-01T00:00:00Z'}).eq('user_id',userId).eq('revision',row.revision).eq('sync_lease_until',lease);
    if(released.error)throw Error('write_failed');
    return {connected:true,synced:false,sync_error:reason};
  }
}
