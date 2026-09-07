import {readFileSync,writeFileSync} from 'node:fs';

const tokenHash=readFileSync('/tmp/lts-health-audit-token-hash','utf8').trim();
if(!tokenHash)throw new Error('MFP water audit token hash missing');
const coreSource=readFileSync(new URL('./src/core.js',import.meta.url),'utf8');
const supabaseUrl=/url:\s*'([^']+)'/.exec(coreSource)?.[1];
const supabaseKey=/key:\s*'([^']+)'/.exec(coreSource)?.[1];
if(!supabaseUrl||!supabaseKey)throw new Error('public Supabase configuration not resolved');

const verify=await fetch(`${supabaseUrl}/auth/v1/verify`,{
  method:'POST',
  headers:{apikey:supabaseKey,'content-type':'application/json'},
  body:JSON.stringify({token_hash:tokenHash,type:'email'})
});
if(!verify.ok)throw new Error(`audit auth failed: ${verify.status}`);
const auth=await verify.json();
if(!auth?.access_token)throw new Error('audit access token missing');

const response=await fetch(`${supabaseUrl}/functions/v1/health-mfp-audit`,{
  method:'POST',
  headers:{apikey:supabaseKey,Authorization:`Bearer ${auth.access_token}`,'content-type':'application/json'},
  body:'{}'
});
const audit=await response.json();
if(!response.ok||!audit?.ok)throw new Error(`MFP water audit failed: ${response.status} ${JSON.stringify(audit)}`);
const summary={csv_count:audit.csv_count,entries:(audit.entries||[]).map(entry=>({name:entry.name,row_count:entry.row_count,headers:entry.headers,water_fields:entry.water_fields}))};
writeFileSync('/tmp/lts-health-mfp-water-audit.json',JSON.stringify(audit));
console.log(`MFP_WATER_AUDIT=${JSON.stringify(summary)}`);
