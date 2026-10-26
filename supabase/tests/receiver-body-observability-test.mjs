import assert from 'node:assert/strict';
import {boundedJson,receiveHealthExport} from '../functions/_shared/health-auto-export-handler.mjs';
import {receiveSummary} from '../functions/_shared/receive-summary.mjs';
import {MAX_BODY_BYTES,KEY_HEADER,randomToken} from '../functions/_shared/health-auto-export-contract.mjs';

const token=randomToken(),events=[];let writes=0,reads=0,cancels=0,active=true;
const db={from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:active?{active:true}:null})})})})}),rpc:async()=>{writes++;return{data:{received:true,accepted_metrics:1}};}};
const request=(body,{key=token,length}={})=>new Request('https://example.test',{method:'POST',headers:{'content-type':'application/json','automation-aggregation':'Day',[KEY_HEADER]:key,...(length==null?{}:{'content-length':length})},body});
const metric={name:'protein',units:'g',data:[{qty:246.75,date:'2001-04-02',source:'PRIVATE_BODY_SOURCE'}]};
const payload=JSON.stringify({data:{metrics:[metric]}});
const execute=async req=>{const response=await receiveHealthExport(req,db,{emit:event=>events.push(event)});return{status:response.status,body:await response.json(),event:events.at(-1)};};
const bytes=value=>new TextEncoder().encode(value);

let facts;
const unicode='{"label":"ação"}';
assert.deepEqual(await boundedJson(request(unicode),1000,value=>{facts=value;}),{label:'ação'});
assert.equal(facts.observed_bytes,bytes(unicode).byteLength,'measure bytes, not UTF-16 characters');
assert.notEqual(facts.observed_bytes,unicode.length);
assert.deepEqual(facts,{limit_bytes:1000,declared_bytes:null,observed_bytes:bytes(unicode).byteLength,complete:true,limit_trigger:null});
assert.deepEqual(await boundedJson(request('{}'),10,()=>{throw Error('diagnostics unavailable');}),{});

let result=await execute(request(payload,{length:String(bytes(payload).byteLength)}));
assert.equal(result.status,200);assert.equal(writes,1);
assert.equal(result.event.request_declared_bytes,bytes(payload).byteLength);
assert.equal(result.event.request_bytes_observed,bytes(payload).byteLength);
assert.equal(result.event.request_body_complete,true);assert.equal(result.event.request_limit_trigger,null);
assert.equal(result.event.request_body_limit_bytes,MAX_BODY_BYTES);
for(const key of ['request_declared_bytes','request_bytes_observed','request_body_complete','request_body_limit_bytes','request_limit_trigger'])assert.ok(!Object.hasOwn(result.body,key),'transport details remain private');

const unread={method:'POST',headers:new Headers({'content-type':'application/json',[KEY_HEADER]:token,'content-length':String(MAX_BODY_BYTES+123)}),body:{getReader(){reads++;throw Error('must not read body');}}};
result=await execute(unread);
assert.equal(result.status,413);assert.equal(reads,0);assert.equal(writes,1);
assert.deepEqual(result.body,{error:'payload_too_large',correlation_id:result.body.correlation_id});
assert.equal(result.event.request_declared_bytes,MAX_BODY_BYTES+123);
assert.equal(result.event.request_bytes_observed,null,'unread is unknown, not empty');
assert.equal(result.event.request_body_complete,false);assert.equal(result.event.request_limit_trigger,'declared_length');
assert.ok(!Object.hasOwn(result.event,'water_observation'),'a rejected body cannot establish absent water');

const streamRequest=(cancelThrows=false)=>{
 let index=0;const chunks=[new Uint8Array(MAX_BODY_BYTES),new Uint8Array(17),new Uint8Array(500)];
 return{method:'POST',headers:new Headers({'content-type':'application/json',[KEY_HEADER]:token}),body:{getReader(){return{async read(){reads++;return index<chunks.length?{done:false,value:chunks[index++]}:{done:true};},async cancel(){cancels++;if(cancelThrows)throw Error('PRIVATE_CANCEL_ERROR');}};}}};
};
reads=0;result=await execute(streamRequest());
assert.equal(result.status,413);assert.equal(reads,2);assert.equal(cancels,1);assert.equal(writes,1);
assert.equal(result.event.request_declared_bytes,null);assert.equal(result.event.request_bytes_observed,MAX_BODY_BYTES+17);
assert.equal(result.event.request_body_complete,false,'the observed size is only a lower bound after stopping');
assert.equal(result.event.request_limit_trigger,'stream');
result=await execute(streamRequest(true));assert.equal(result.status,413,'cancellation failure must not replace the limit result');assert.equal(writes,1);

result=await execute(request('{"PRIVATE_BODY_CONTENT":'));
assert.equal(result.status,422);assert.equal(result.body.error,'invalid_payload');
assert.equal(result.event.request_body_complete,true,'invalid JSON can still have a fully observed body');assert.equal(writes,1);
result=await execute(request(payload,{length:'PRIVATE_LENGTH_HEADER'}));assert.equal(result.status,200);
assert.equal(result.event.request_declared_bytes,null);assert.equal(writes,2);

const eventCount=events.length;active=false;reads=0;
result=await execute(unread);assert.equal(result.status,401);assert.equal(reads,0);assert.equal(events.length,eventCount);assert.equal(writes,2);
active=true;const badKey={...unread,headers:new Headers({'content-type':'application/json',[KEY_HEADER]:'bad','content-length':String(MAX_BODY_BYTES+123)})};
result=await execute(badKey);assert.equal(result.status,401);assert.equal(events.length,eventCount);assert.equal(reads,0);

const noBody=new Request('https://example.test',{method:'POST',headers:{'content-type':'application/json',[KEY_HEADER]:token}});
result=await execute(noBody);assert.equal(result.status,422);assert.equal(result.event.request_bytes_observed,null);
assert.equal(result.event.request_body_complete,false);
assert.equal((await receiveHealthExport(request(payload),db,{emit:()=>{throw Error('diagnostics unavailable');}})).status,200);

const summary=receiveSummary({transport:{limit_bytes:100,declared_bytes:'PRIVATE_SIZE',observed_bytes:NaN,complete:false,limit_trigger:'PRIVATE_TRIGGER',raw:'PRIVATE_BODY_CONTENT'}});
assert.equal(summary.request_declared_bytes,null);assert.equal(summary.request_bytes_observed,null);assert.equal(summary.request_limit_trigger,null);
assert.ok(!Object.hasOwn(receiveSummary(),'request_body_limit_bytes'),'legacy summaries do not invent transport measurements');
for(const transport of [null,{},'PRIVATE_TRANSPORT',{limit_bytes:-1,complete:true},{limit_bytes:100,complete:'yes'}])assert.ok(!Object.hasOwn(receiveSummary({transport}),'request_body_limit_bytes'));
const logged=JSON.stringify([...events,summary]);
for(const secret of [token,'PRIVATE_BODY_SOURCE','246.75','PRIVATE_BODY_CONTENT','PRIVATE_LENGTH_HEADER','PRIVATE_TRIGGER','PRIVATE_CANCEL_ERROR'])assert.ok(!logged.includes(secret),'private payload/header/error is not logged');
console.log('Receiver byte diagnostics: complete UTF-8 body, unread header rejection, bounded stream, cancellation failure, auth-before-read, logger isolation, no payload or response expansion passed.');
