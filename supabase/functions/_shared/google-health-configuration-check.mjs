const clientId=/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;
const suffix=/^[A-Za-z0-9_-]{4}$/;
const providerErrors=new Set(['invalid_client','unauthorized_client','invalid_grant','invalid_request','unsupported_grant_type']);

// Only the already ticket-authenticated server route accepts these public/masked
// comparison hints. Complete credentials, grants and owner IDs are never inputs.
export function validGoogleHealthConfigurationHints(body){
  return body&&typeof body==='object'&&!Array.isArray(body)&&
    Object.keys(body).length===3&&body.action==='configuration_check'&&
    typeof body.client_id==='string'&&body.client_id.length<=200&&clientId.test(body.client_id)&&
    Array.isArray(body.secret_suffixes)&&body.secret_suffixes.length>=1&&body.secret_suffixes.length<=2&&
    body.secret_suffixes.every(value=>typeof value==='string'&&suffix.test(value))&&
    new Set(body.secret_suffixes).size===body.secret_suffixes.length;
}

async function boundedProviderError(response){
  if(!response.body)return 'unclassified';
  const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let text='',size=0;
  try{
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>4096){try{await reader.cancel();}catch{}return 'unclassified';}
      text+=decoder.decode(value,{stream:true});}
    text+=decoder.decode();const body=JSON.parse(text);
    return providerErrors.has(body?.error)?body.error:'unclassified';
  }catch{return 'unclassified';}finally{reader.releaseLock();}
}

// This does not verify a user connection or recover hydration. The deliberately
// invented grant is never taken from an owner callback, store or HTTP input.
export async function checkGoogleHealthConfiguration(config,hints,{fetcher=fetch}={}){
  if(!validGoogleHealthConfigurationHints(hints))throw Error('invalid_action');
  const result={check:'client_configuration',client_id_present:typeof config.clientId==='string'&&config.clientId.length>0,
    client_secret_present:typeof config.clientSecret==='string'&&config.clientSecret.length>0,
    client_id_matches:config.clientId===hints.client_id,
    secret_matches_listed_suffix:typeof config.clientSecret==='string'&&config.clientSecret.length>=16&&hints.secret_suffixes.some(value=>config.clientSecret.endsWith(value)),
    provider_attempted:false,provider_status:null,provider_error:null,connection_verified:false,canonical_updated:false};
  // Report masked-metadata disagreement without treating it as authentication
  // evidence. The provider can still evaluate the actual configured credential.
  if(!result.client_id_matches||!result.client_secret_present)return result;
  result.provider_attempted=true;
  try{
    const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
      headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,
        grant_type:'authorization_code',code:'synthetic-configuration-check-no-user-grant',
        redirect_uri:new URL('/functions/v1/health-google-callback',config.url).href,
        code_verifier:'synthetic_configuration_check_no_user_verifier_000000'})});
    result.provider_status=response.status;
    if(response.status>=400)result.provider_error=await boundedProviderError(response);
    else{try{await response.body?.cancel();}catch{}result.provider_error='unexpected_response';}
  }catch{result.provider_error='request_failed';}
  return result;
}
