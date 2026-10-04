import assert from 'node:assert/strict';
import {providerRead,providerItems,syncFailure,dayWindows,trainingWindowParams,validationKeywords} from '../supabase/functions/_shared/polar-provider.mjs';
const params={from:'2025-02-01',to:'2025-02-02'},token='synthetic-only';
assert.equal(validationKeywords('From date invalid: synthetic-secret-token-0123456789; https://private.invalid/secret'), 'from,date,invalid');
const read=(response,path='sleeps')=>providerRead(token,path,params,async()=>response);
assert.deepEqual(await read(new Response('{"nightSleeps":[]}')), {nightSleeps:[]});
assert.deepEqual(providerItems({nightSleeps:[]},'nightSleeps','sleep'),[]);
assert.throws(()=>providerItems({error:'synthetic private body'},'nightSleeps','sleep'),/provider_sleep_schema/);
await assert.rejects(read(new Response('synthetic private body',{status:400})),/provider_sleep_http_400/);
await assert.rejects(read(new Response('synthetic private body',{status:503}),'training-sessions/list'),/provider_sessions_http_503/);
for(const status of [401,403])await assert.rejects(read(new Response('synthetic private body',{status})),/authorization_expired/);
await assert.rejects(read(new Response('not json')),/provider_sleep_invalid_response/);
await assert.rejects(read(new Response('x'.repeat(2000001))),/provider_sleep_invalid_response/);
await assert.rejects(providerRead(token,'sleeps',params,async()=>{throw Error('synthetic private URL');}),/provider_sleep_network/);
for(const reason of ['provider_sleep_http_400','provider_sessions_network','provider_sessions_schema','authorization_expired','write_failed'])assert.equal(syncFailure(Error(reason)),reason);
for(const reason of ['synthetic private body','provider_sleep_http_400?token=synthetic','provider_unknown_schema'])assert.equal(syncFailure(Error(reason)),'provider_unavailable');
assert.equal(syncFailure(Error('synthetic private body'),'token'),'sync_token_failed');
assert.equal(syncFailure(Error('synthetic private body'),'synthetic private phase'),'provider_unavailable');
assert.deepEqual(dayWindows('2025-01-01','2025-04-01'),[{from:'2025-01-01',to:'2025-01-31'},{from:'2025-01-31',to:'2025-03-02'},{from:'2025-03-02',to:'2025-04-01'}]);
assert.deepEqual(dayWindows('2024-02-28','2024-03-02'),[{from:'2024-02-28',to:'2024-03-02'}]);
assert.throws(()=>dayWindows('2025-02-30','2025-03-02'));
assert.deepEqual(trainingWindowParams({from:'2025-02-28',to:'2025-03-01'}),{from:'2025-02-28T00:00:00',to:'2025-03-01T00:00:00'});
for(const [errorMessage,suffix] of [['Invalid date range, synthetic-private','range'],['Date format invalid, synthetic-private','date'],['Future date, synthetic-private','future']]){
  await assert.rejects(read(new Response(JSON.stringify({errorMessage}),{status:400})),new RegExp(`provider_sleep_http_400_${suffix}`));
}
console.log('Polar provider boundaries passed: errors expose only fixed stage/status codes, never request or response secrets.');
