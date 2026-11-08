import assert from 'node:assert/strict';
import {test} from 'node:test';
import {checkGoogleHealthConfiguration,validGoogleHealthConfigurationHints} from '../supabase/functions/_shared/google-health-configuration-check.mjs';
const hints={action:'configuration_check',client_id:'123-synthetic.apps.googleusercontent.com',secret_suffixes:['demo','test']};
const secret='synthetic-private-client-secret-demo',privateMarker='synthetic-provider-private-marker';
const config={url:'https://abcdefghijklmnopqrst.supabase.co',clientId:hints.client_id,clientSecret:secret,serviceKey:privateMarker};
const reply=(error='invalid_grant',status=400)=>new Response(JSON.stringify({error,error_description:privateMarker,access_token:privateMarker}),{status});

test('configuration hints reject complete secrets, owner/grant inputs, unbounded lists and arbitrary actions',()=>{
  assert.equal(validGoogleHealthConfigurationHints(hints),true);
  for(const body of [null,[],{...hints,action:'read'},{...hints,client_id:'https://untrusted.example/'},
    {...hints,secret_suffixes:[]},{...hints,secret_suffixes:['demo','test','more']},{...hints,secret_suffixes:['demo','demo']},
    {...hints,secret_suffixes:[secret]},{...hints,secret_suffixes:[1234]},
    {...hints,code:privateMarker},{...hints,user_id:privateMarker},{...hints,client_secret:secret}])assert.ok(!validGoogleHealthConfigurationHints(body));
});
test('missing credentials or a different client are compared privately without contacting a provider',async()=>{
  for(const c of [{...config,clientSecret:undefined},{...config,clientId:undefined},{...config,clientId:'456-other.apps.googleusercontent.com'}]){
    let calls=0;const r=await checkGoogleHealthConfiguration(c,hints,{fetcher:async()=>{calls++;throw Error(privateMarker);}});
    assert.equal(calls,0);assert.equal(r.provider_attempted,false);assert.equal(r.provider_status,null);assert.equal(r.provider_error,null);
    assert.equal(r.connection_verified,false);assert.equal(r.canonical_updated,false);
    assert.ok(!JSON.stringify(r).includes(secret));assert.ok(!JSON.stringify(r).includes(hints.client_id));assert.ok(!JSON.stringify(r).includes(privateMarker));
  }
});
test('a masked metadata mismatch cannot replace direct provider evidence for the actual configured credential',async()=>{
  for(const [error,status] of [['invalid_grant',400],['invalid_client',401]]){
    let calls=0;const actual={...config,clientSecret:'synthetic-different-credential-tail'};
    const r=await checkGoogleHealthConfiguration(actual,hints,{fetcher:async(url,init)=>{
      calls++;assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(init.body.get('client_secret'),actual.clientSecret);return reply(error,status);
    }});
    assert.equal(calls,1);assert.equal(r.secret_matches_listed_suffix,false);assert.equal(r.provider_attempted,true);
    assert.equal(r.provider_status,status);assert.equal(r.provider_error,error);assert.equal(r.connection_verified,false);assert.equal(r.canonical_updated,false);
    assert.ok(!JSON.stringify(r).includes(actual.clientSecret));assert.ok(!JSON.stringify(r).includes(privateMarker));
  }
});
test('a matching masked hint permits only one fixed Google POST with an invented grant and bounded timeout',async()=>{
  let calls=0;const r=await checkGoogleHealthConfiguration(config,hints,{fetcher:async(url,init)=>{
    calls++;assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(init.method,'POST');assert.equal(init.redirect,'error');
    assert.ok(init.signal instanceof AbortSignal);assert.equal(init.headers['Content-Type'],'application/x-www-form-urlencoded');
    assert.equal(init.body.get('client_id'),hints.client_id);assert.equal(init.body.get('client_secret'),secret);
    assert.equal(init.body.get('grant_type'),'authorization_code');assert.equal(init.body.get('code'),'synthetic-configuration-check-no-user-grant');
    assert.equal(init.body.get('redirect_uri'),'https://abcdefghijklmnopqrst.supabase.co/functions/v1/health-google-callback');
    assert.equal(init.body.has('refresh_token'),false);assert.equal(init.body.has('access_token'),false);
    return reply();
  }});
  assert.equal(calls,1);assert.equal(r.client_id_matches,true);assert.equal(r.secret_matches_listed_suffix,true);
  assert.equal(r.provider_error,'invalid_grant');assert.equal(r.provider_status,400);assert.equal(r.connection_verified,false);assert.equal(r.canonical_updated,false);
  for(const value of [secret,hints.client_id,privateMarker,'error_description','access_token'])assert.ok(!JSON.stringify(r).includes(value));
});
test('a matching suffix never converts an actual invalid_client rejection into valid authentication',async()=>{
  const r=await checkGoogleHealthConfiguration(config,hints,{fetcher:async()=>reply('invalid_client',401)});
  assert.equal(r.secret_matches_listed_suffix,true);assert.equal(r.provider_error,'invalid_client');assert.equal(r.provider_status,401);
  assert.equal(r.connection_verified,false);assert.equal(r.canonical_updated,false);
});
test('a successful or redirected-looking response cannot return any tokens or establish a connection',async()=>{
  for(const status of [200,302]){
    const r=await checkGoogleHealthConfiguration(config,hints,{fetcher:async()=>new Response(JSON.stringify({access_token:privateMarker,refresh_token:secret}),{status})});
    assert.equal(r.provider_error,'unexpected_response');assert.equal(r.connection_verified,false);assert.equal(r.canonical_updated,false);
    assert.ok(!JSON.stringify(r).includes(privateMarker));assert.ok(!JSON.stringify(r).includes(secret));
  }
});
test('large, malformed, invalid UTF8 and arbitrary provider errors remain fixed, bounded classifications',async()=>{
  const bodies=['x'.repeat(4097),'{',JSON.stringify({error:privateMarker}),new Uint8Array([0xff])];
  for(const body of bodies){
    const r=await checkGoogleHealthConfiguration(config,hints,{fetcher:async()=>new Response(body,{status:400})});
    assert.equal(r.provider_error,'unclassified');assert.ok(!JSON.stringify(r).includes(privateMarker));
  }
});
test('request failures never return exceptions, secrets, endpoint details or private marker text',async()=>{
  const r=await checkGoogleHealthConfiguration(config,hints,{fetcher:async()=>{throw Error(privateMarker+secret);}});
  assert.equal(r.provider_error,'request_failed');assert.equal(r.provider_status,null);assert.equal(r.connection_verified,false);
  assert.ok(!JSON.stringify(r).includes(privateMarker));assert.ok(!JSON.stringify(r).includes(secret));
});
