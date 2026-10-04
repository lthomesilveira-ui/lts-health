import {validDay,addDays} from './polar-contract.mjs';
const domains=new Map([['training-sessions/list','sessions'],['sleeps','sleep']]);
const failurePattern=/^provider_(sessions|sleep)_(network|invalid_response|schema|empty_object|http_[1-5][0-9]{2}(?:_range|_date|_future)?)$/;
const phases=new Set(['token','refresh','calendar','lists','sleep_dates','sleep_details','sessions','ownership','write']);
const validationWords=new Set('from to date dates format parse parsing parsed valid invalid required missing must should expected provided start end before after time datetime timestamp timezone offset utc iso iso8601 rfc3339 yyyy-mm-dd yyyy-mm-ddthh:mm:ss yyyymmdd yyyy-mm-ddthh:mm:ssz milliseconds seconds epoch query parameter parameters range interval days future integer string client request failed error unknown unsupported bad accepted not cannot be both present include included'.split(' '));
export function validationKeywords(text){return [...new Set((String(text).match(/[a-z][a-z0-9:_-]*/gi)||[]).map(x=>x.toLowerCase()).filter(x=>validationWords.has(x)))].join(',');}

// Only fixed endpoint names and status codes may cross the error boundary.
// Never retain provider bodies, URLs, request headers, identifiers or credentials.
export function syncFailure(error,phase){
  const message=error?.message;
  return ['authorization_expired','write_failed'].includes(message)||failurePattern.test(message||'')?message:phases.has(phase)?`sync_${phase}_failed`:'provider_unavailable';
}
export function providerItems(payload,key,domain){
  if(payload&&typeof payload==='object'&&!Array.isArray(payload)&&Object.keys(payload).length===0)throw Error(`provider_${domain}_empty_object`);
  if(!Array.isArray(payload?.[key]))throw Error(`provider_${domain}_schema`);
  return payload[key];
}
export function dayWindows(start,end){
  if(validDay(start)!==start||validDay(end)!==end||start>=end)throw Error('invalid_date_window');
  const windows=[];
  for(let from=start;from<end;){const to=addDays(from,30)<end?addDays(from,30):end;windows.push({from,to});from=to;}
  return windows;
}
export function trainingWindowParams(window){
  if(validDay(window?.from)!==window?.from||validDay(window?.to)!==window?.to)throw Error('invalid_date_window');
  return Object.fromEntries(['from','to'].map(k=>[k,`${window[k]}T00:00:00`]));
}
async function parameterFailure(response){
  if(response.status!==400)return '';
  try{
    const text=await response.text();if(text.length>32000)return '';
    console.info('polar_provider_validation',validationKeywords(text)||'unclassified');
    // Match only fixed categories. Error text is never emitted or retained.
    if(/future/i.test(text))return '_future';
    if(/range|interval|maximum.*days|too many days/i.test(text))return '_range';
    if(/date|from|to parameter|ISO|RFC|format/i.test(text))return '_date';
  }catch{}
  return '';
}
export async function providerRead(token,path,params,fetcher=fetch){
  const domain=domains.get(path);if(!domain)throw Error('provider_unavailable');
  const url=new URL(`https://www.polaraccesslink.com/v4/data/${path}`);url.search=new URLSearchParams(params).toString();
  let response;
  try{response=await fetcher(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});}
  catch{throw Error(`provider_${domain}_network`);}
  if(!response.ok)throw Error(response.status===401||response.status===403?'authorization_expired':`provider_${domain}_http_${response.status}${await parameterFailure(response)}`);
  try{
    const text=await response.text();if(new TextEncoder().encode(text).length>2000000)throw Error();
    return JSON.parse(text);
  }catch{throw Error(`provider_${domain}_invalid_response`);}
}
