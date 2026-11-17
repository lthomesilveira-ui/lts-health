// Explicit one-time protected CI evaluation; never called by app navigation,
// schedules, ordinary pushes, or the normal stable hydration reader.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash,createCipheriv,randomBytes,publicEncrypt,constants} from 'node:crypto';

const fail=()=>{throw Error('channel_diagnostic_incomplete');};
const dayPattern=/^\d{4}-\d{2}-\d{2}$/;
const addDay=(day,count)=>new Date(Date.parse(day+'T00:00:00Z')+count*86400000).toISOString().slice(0,10);
export function validateChannelComparison(value,{from,to}){
  if(!dayPattern.test(from)||!dayPattern.test(to)||from>=to||Date.parse(to)-Date.parse(from)>7*86400000)fail();
  if(value?.connected!==true||value?.inspected!==true||value?.mode!=='read_only'||value?.bounded!==true||value?.experimental_channel_evaluation!==true||value?.data_type!=='hydration-log'||value?.from!==from||value?.to_exclusive!==to||value?.max_points_per_channel!==100||value?.canonical_updated!==false||value?.water_received!==false||!Array.isArray(value?.probes)||value.probes.length!==2)fail();
  const safe=[];
  for(const [index,p] of value.probes.entries()){
    if(p?.channel!==['v4','v4beta'][index])fail();
    if(p.status==='unavailable'){
      if(!['permission_denied','provider_request_rejected'].includes(p.error_code)||Object.keys(p).some(k=>!['channel','status','error_code'].includes(k)))fail();
      safe.push({channel:p.channel,status:p.status,error_code:p.error_code});continue;
    }
    const numbers=['observations','positive_observations','zero_observations','undated_observations','source_identified_positive_observations'];
    if(p.status!=='ok'||typeof p.truncated!=='boolean'||numbers.some(k=>!Number.isInteger(p[k])||p[k]<0||p[k]>100)||p.positive_observations+p.zero_observations+p.undated_observations!==p.observations||p.source_identified_positive_observations>p.positive_observations||Object.keys(p).some(k=>!['channel','status',...numbers,'first_day','last_day','truncated'].includes(k)))fail();
    if(p.observations===p.undated_observations){if(p.first_day!==null||p.last_day!==null)fail();}
    else if(!dayPattern.test(p.first_day)||!dayPattern.test(p.last_day)||p.first_day<from||p.last_day>=to||p.first_day>p.last_day)fail();
    safe.push(Object.fromEntries(['channel','status',...numbers,'first_day','last_day','truncated'].map(k=>[k,p[k]])));
  }
  return {from,to_exclusive:to,probes:safe};
}

export function sealChannelEvidence(payload,publicPem){
  const file='google-hydration-channel-comparison.json',key=randomBytes(32),iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(file));
  try{
    const ciphertext=Buffer.concat([cipher.update(Buffer.from(JSON.stringify(payload))),cipher.final()]);
    return {format:'lts-health-private-diagnostic-v1',algorithm:'RSA-OAEP-SHA256+A256GCM',file,
      public_key_sha256:createHash('sha256').update(publicPem).digest('hex'),
      wrapped_key:publicEncrypt({key:publicPem,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key).toString('base64'),
      iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
  }finally{key.fill(0);}
}

async function main(){
  const tokenHash=readFileSync('/tmp/lts-health-channels-token-hash','utf8').trim();if(!tokenHash)fail();
  const core=readFileSync(new URL('./src/core.js',import.meta.url),'utf8');
  const url=/url:\s*'([^']+)'/.exec(core)?.[1],key=/key:\s*'([^']+)'/.exec(core)?.[1];
  if(url!=='https://plztdqyuqcjohiimudnr.supabase.co'||!key)fail();
  const verify=await fetch(url+'/auth/v1/verify',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify({token_hash:tokenHash,type:'email'})});
  if(!verify.ok)fail();const auth=await verify.json();if(!auth?.access_token||!auth?.user?.id)fail();
  const headers={apikey:key,Authorization:`Bearer ${auth.access_token}`,'content-type':'application/json'};
  const request=async(path,body)=>{
    const response=await fetch(url+path,{method:body===undefined?'GET':'POST',headers,redirect:'error',signal:AbortSignal.timeout(60000),...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!response.ok)fail();return response.json();
  };
  let evidence={complete:false,integrity_preserved:false,comparisons:[]};
  try{
    const readRows=async()=>{
      const rows=await request('/rest/v1/health_source_daily_metrics?metric_type=eq.dietary_water_ml&select=*&order=source_record_id.asc&limit=1000');
      if(!Array.isArray(rows)||!rows.length||rows.length>=1000||rows.some(r=>r.user_id!==auth.user.id))fail();return rows;
    };
    const before=await readRows(),fingerprint=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    const history=before.filter(r=>r.source_family==='google_health_takeout'&&r.canonical_status==='canonical'&&Number(r.value)>0).map(r=>r.metric_date).filter(d=>dayPattern.test(d)).sort().slice(-2);
    if(!history.length)fail();
    const todayParts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
    const today=`${todayParts.year}-${todayParts.month}-${todayParts.day}`;
    const ranges=[{kind:'historical_control',from:history[0],to:addDay(history.at(-1),1)},{kind:'recent_closed_days',from:addDay(today,-6),to:today}];
    for(const range of ranges){
      const result=validateChannelComparison(await request('/functions/v1/health-google-connection',{action:'inspect-hydration-channels',from:range.from,to:range.to}),range);
      evidence.comparisons.push({kind:range.kind,...result});
    }
    const after=await readRows();evidence.integrity_preserved=fingerprint(before)===fingerprint(after);evidence.hydration_fingerprint=fingerprint(after);
    evidence.historical_control_verified=evidence.comparisons[0].probes[0].status==='ok'&&evidence.comparisons[0].probes[0].positive_observations>0;
    evidence.complete=evidence.integrity_preserved&&evidence.historical_control_verified;
    if(!evidence.complete)fail();
  }finally{
    mkdirSync('v2/real-auth-encrypted',{recursive:true});
    writeFileSync(join('v2/real-auth-encrypted','google-hydration-channels.sealed.json'),JSON.stringify(sealChannelEvidence(evidence,readFileSync(new URL('./qa-visual-public.pem',import.meta.url)))),{mode:0o600});
    await fetch(url+'/auth/v1/logout?scope=local',{method:'POST',headers,redirect:'error',signal:AbortSignal.timeout(30000)}).catch(()=>{});
  }
  console.log('One-time Google channel comparison completed; private results encrypted and hydration integrity verified.');
}
if(process.argv[1]===fileURLToPath(import.meta.url))await main().catch(()=>{console.error('One-time channel comparison did not complete; no private response or credential is printed.');process.exitCode=1;});
