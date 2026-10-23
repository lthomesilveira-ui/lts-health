import assert from 'node:assert/strict';
import http from 'node:http';
import {Readable} from 'node:stream';
import {receiveHealthExport} from '../functions/_shared/health-auto-export-handler.mjs';
import {KEY_HEADER,randomToken,digest} from '../functions/_shared/health-auto-export-contract.mjs';

// Real loopback HTTP requests through the production handler. This adapter is a
// controlled RPC double; PostgreSQL/role/concurrency tests are a separate gate.
const token=randomToken(),hash=await digest(token),events=[],calls=[];
let active=true,lookupError=false,rpcResponse=null,groups=0;
const db={from:table=>{
  assert.equal(table,'health_auto_export_connections');
  return {select:column=>{
    assert.equal(column,'active');
    return {eq:(key,value)=>{
      assert.equal(key,'key_hash');assert.equal(value,hash);
      return {eq:(key,value)=>{
        assert.equal(key,'active');assert.equal(value,true);
        return {maybeSingle:async()=>({data:active?{active:true}:null,error:lookupError?{message:'PRIVATE_LOOKUP_ERROR'}:null})};
      }};
    }};
  }};
},rpc:async(name,args)=>{
  calls.push(structuredClone({name,args}));
  if(rpcResponse)return rpcResponse;
  return {data:{received:true,accepted_metrics:args.p_metrics.length,...(args.p_basal_candidates?{accepted_basal_candidates:args.p_basal_candidates.length,already_captured:false}:{})}};
}};
const server=http.createServer(async(req,res)=>{
  try{
    const request=new Request(`http://127.0.0.1${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
    const response=await receiveHealthExport(request,db,{emit:e=>events.push(e)});
    // The Node test host must drain an unread request (e.g. 415/413); Deno's
    // production HTTP host owns this transport concern outside the handler.
    req.resume();
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('test server failure');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/receive`;
const p={qty:1732.567,date:'2026-10-18 00:00:00 -0300',source:'PRIVATE_BASAL_SOURCE'};
const basal=(points=[p])=>({name:'basal_energy_burned',units:'kcal',data:points});
const food={name:'protein',units:'g',data:[{qty:120,date:'2026-10-18',source:'PRIVATE_FOOD_SOURCE'}]};
async function request(metrics,{key=token,headers={},method='POST',raw}={}){
  const response=await fetch(url,{method,headers:{'content-type':'application/json','connection':'close',[KEY_HEADER]:key,'automation-aggregation':'Day',...headers},...(!['GET','HEAD'].includes(method)?{body:raw??JSON.stringify({data:{metrics}})}:{})});
  const text=await response.text();return {response,body:text?JSON.parse(text):null,text};
}
async function check(name,fn){try{await fn();groups++;}catch(error){error.message=`${name}: ${error.message}`;throw error;}}
try{
  await check('bad key rejected before RPC/logging',async()=>{const x=await request([basal()],{key:'bad'});assert.equal(x.response.status,401);assert.equal(calls.length,0);assert.equal(events.length,0);});
  await check('inactive connection rejected',async()=>{active=false;assert.equal((await request([basal()])).response.status,401);active=true;assert.equal(calls.length,0);});
  await check('lookup error sanitized',async()=>{lookupError=true;const x=await request([basal()]);assert.equal(x.response.status,503);assert.ok(!x.text.includes('PRIVATE'));lookupError=false;});
  await check('CORS and method boundaries',async()=>{assert.equal((await request([],{method:'OPTIONS'})).response.status,204);assert.equal((await request([],{method:'GET'})).response.status,405);});
  await check('basal-only capture through distinct RPC',async()=>{
    const x=await request([basal()]),c=calls.at(-1);assert.equal(x.response.status,200);assert.equal(x.body.received,true);assert.equal(x.body.accepted_metrics,0);assert.equal(x.body.accepted_basal_candidates,1);assert.equal(x.body.coverage_verified,false);assert.equal(x.body.outcome,'accepted_without_nutrition');assert.equal(x.body.ignored_points,0);
    assert.equal(c.name,'health_auto_export_ingest_candidates');assert.deepEqual(c.args.p_metrics,[]);assert.equal(c.args.p_basal_candidates[0].quantity,p.qty);assert.equal(c.args.p_receipt_id,x.body.correlation_id);assert.equal(c.args.p_key_hash,hash);assert.ok(!x.text.includes('PRIVATE'));assert.ok(!x.text.includes(String(p.qty)));
    const e=events.at(-1);assert.equal(e.accepted_basal_candidates,1);assert.equal(e.basal_candidate_points_observed,1);assert.equal(e.basal_coverage_verified,false);
  });
  await check('same source/day revisions retained separately',async()=>{await request([basal([p,{...p,qty:1900},p])]);assert.deepEqual(calls.at(-1).args.p_basal_candidates.map(x=>x.quantity),[p.qty,1900,p.qty]);});
  await check('mixed batch is one RPC with separated arrays',async()=>{const n=calls.length;const x=await request([food,basal()]);assert.equal(calls.length,n+1);assert.equal(x.body.accepted_metrics,1);assert.equal(x.body.accepted_basal_candidates,1);assert.equal(calls.at(-1).args.p_metrics[0].metric_type,'dietary_protein_g');assert.ok(!calls.at(-1).args.p_metrics.some(x=>/basal/.test(x.metric_type)));});
  await check('legacy-only request unchanged',async()=>{const x=await request([food]);assert.equal(calls.at(-1).name,'health_auto_export_ingest');assert.ok(!('accepted_basal_candidates' in x.body));assert.ok(!('basal_candidate_points_observed' in events.at(-1)));});
  await check('invalid basal cannot poison legacy',async()=>{const x=await request([food,basal([null,{...p,date:'invalid'},{...p,qty:-1}])]);assert.equal(x.response.status,200);assert.equal(calls.at(-1).name,'health_auto_export_ingest');assert.equal(x.body.ignored_points,3);assert.equal(events.at(-1).ignored_basal_points,3);});
  await check('partial candidates retain truthful counts',async()=>{const x=await request([basal([p,null,p])]);assert.equal(x.body.accepted_basal_candidates,2);assert.equal(x.body.ignored_points,1);assert.equal(events.at(-1).ignored_basal_blocks,1);assert.equal(events.at(-1).ignored_basal_points,1);});
  await check('invalid legacy rejects entire request before RPC',async()=>{const n=calls.length;const x=await request([{...food,units:'bad'},basal()]);assert.equal(x.response.status,422);assert.equal(calls.length,n);});
  await check('unknown aggregation never ingested',async()=>{const n=calls.length;const x=await request([basal()],{headers:{'automation-aggregation':'hour'}});assert.equal(x.response.status,422);assert.equal(calls.length,n);});
  await check('invalid-only basal has no write',async()=>{const n=calls.length;const x=await request([basal([null])]);assert.equal(x.body.received,false);assert.equal(x.body.outcome,'no_supported_data');assert.equal(calls.length,n);});
  await check('revocation between auth and RPC fails closed',async()=>{rpcResponse={data:{error:'unauthorized'}};const x=await request([basal()]);assert.equal(x.response.status,401);rpcResponse=null;});
  await check('rate-limited response has no accepted counts',async()=>{rpcResponse={data:{error:'rate_limited'}};const x=await request([basal()]);assert.equal(x.response.status,429);assert.equal(events.at(-1).accepted_basal_candidates,0);rpcResponse=null;});
  await check('database failure is sanitized',async()=>{rpcResponse={error:{message:'PRIVATE_DB_ERROR'}};const x=await request([basal()]);assert.equal(x.response.status,503);assert.ok(!x.text.includes('PRIVATE'));assert.equal(events.at(-1).accepted_basal_candidates,0);rpcResponse=null;});
  await check('ambiguous nonreceipt is not accepted',async()=>{rpcResponse={data:{received:false}};assert.equal((await request([basal()])).response.status,503);rpcResponse=null;});
  await check('missing or partial candidate acknowledgement fails closed',async()=>{for(const count of [undefined,0,'1',2]){rpcResponse={data:{received:true,accepted_metrics:0,accepted_basal_candidates:count}};assert.equal((await request([basal()])).response.status,503);}rpcResponse=null;});
  await check('oversized envelope fails before any RPC',async()=>{const n=calls.length;assert.equal((await request([],{raw:JSON.stringify({padding:'x'.repeat(1024*1024)})})).response.status,413);assert.equal(calls.length,n);});
  await check('too many points rejected by legacy envelope',async()=>{const n=calls.length;assert.equal((await request([basal(Array(2501).fill(p))])).response.status,422);assert.equal(calls.length,n);});
  await check('wrong media type rejected',async()=>assert.equal((await request([basal()],{headers:{'content-type':'text/plain'}})).response.status,415));
  await check('malformed JSON rejected',async()=>assert.equal((await request([],{raw:'{'})).response.status,422));
  await check('logs contain no private quantity, source or token',async()=>{const text=JSON.stringify(events);for(const s of [token,hash,'PRIVATE_BASAL_SOURCE','PRIVATE_FOOD_SOURCE','PRIVATE_DB_ERROR',String(p.qty)])assert.ok(!text.includes(s),s);});
  const water=(units='mL',qty=765.4321,extra={})=>({name:'dietary_water',units,data:[{qty,date:'2026-09-15 00:00:00 -0300',...extra}]});
  const waterFields=['water_observation','water_blocks_observed','water_metrics_observed','water_dates_observed'];
  const privateWaterOnly=x=>{for(const key of waterFields)assert.ok(!Object.hasOwn(x.body,key));assert.equal(x.body.coverage_verified,false);};
  await check('water absent versus empty is private and changes no writes',async()=>{
    const plain=await request([food]),original=calls.at(-1);assert.equal(events.at(-1).water_observation,'absent');
    const empty=await request([food,{name:'dietary_water',units:'PRIVATE_EMPTY_UNIT',data:[]}]);
    assert.equal(events.at(-1).water_observation,'empty');assert.equal(events.at(-1).water_blocks_observed,1);assert.equal(events.at(-1).water_metrics_observed,0);assert.deepEqual(calls.at(-1),original);
    const withoutId=({correlation_id,...rest})=>rest;assert.deepEqual(withoutId(empty.body),withoutId(plain.body));privateWaterOnly(empty);
  });
  await check('all supported water units and missing source remain canonical',async()=>{
    for(const [unit,qty,expected] of [['mL',765.4321,765.4321],[' L ',1.25,1250],['fl oz',2,59.147059],['fl. oz.',2,59.147059],['us fl oz',2,59.147059],['mL',0,0]]){
      const x=await request([water(unit,qty)]),row=calls.at(-1).args.p_metrics[0],event=events.at(-1);
      assert.equal(x.response.status,200);assert.equal(row.value,expected);assert.equal(row.unit,'mL');assert.equal(row.metric_date,'2026-09-15');assert.equal(row.metric_type,'dietary_water_ml');assert.equal(row.canonical_status,'canonical');assert.match(row.source_name,/Origem não informada/);
      assert.equal(calls.at(-1).name,'health_auto_export_ingest');assert.equal(event.water_observation,'present');assert.equal(event.water_metrics_observed,1);assert.equal(event.water_dates_observed,1);privateWaterOnly(x);
    }
  });
  await check('water and basal stay in their distinct arrays in one transaction',async()=>{
    const n=calls.length,x=await request([water('mL',765.4321,{source:'PRIVATE_WATER_SOURCE'}),basal()]);
    assert.equal(x.response.status,200);assert.equal(calls.length,n+1);assert.equal(calls.at(-1).name,'health_auto_export_ingest_candidates');assert.equal(calls.at(-1).args.p_metrics.length,1);assert.equal(calls.at(-1).args.p_metrics[0].metric_type,'dietary_water_ml');assert.equal(calls.at(-1).args.p_basal_candidates.length,1);assert.equal(events.at(-1).water_observation,'present');privateWaterOnly(x);
  });
  await check('only documented water name counts, no speculative aliases',async()=>{
    for(const name of ['water','Dietary_water','dietary_water_PRIVATE']){const x=await request([{...water(),name}]);assert.equal(x.body.received,false);assert.equal(events.at(-1).water_observation,'absent');assert.equal(events.at(-1).water_metrics_observed,0);privateWaterOnly(x);}
  });
  await check('rejected water remains unobserved and never partially writes',async()=>{
    const cases=[[water('g')],[water('mL',-1)],[water('mL',100001)],[water('mL',1,{date:'invalid'})],[water(),water()],[water('mL',1,{startDate:'2026-10-18'})]];
    for(const metrics of cases){const n=calls.length,x=await request([food,...metrics]);assert.equal(x.response.status,422);assert.equal(calls.length,n);for(const key of waterFields)assert.ok(!Object.hasOwn(events.at(-1),key));}
  });
  await check('water observation does not claim successful persistence',async()=>{
    for(const response of [{error:{message:'PRIVATE_DB_ERROR'}},{data:{error:'rate_limited'}},{data:{received:true,accepted_metrics:0}}]){rpcResponse=response;const x=await request([water()]);assert.equal(events.at(-1).water_observation,'present');assert.equal(events.at(-1).accepted_metrics,0);assert.ok(!Object.hasOwn(events.at(-1),'water_metrics_persisted'));assert.ok(!Object.hasOwn(x.body,'water_observation'));}rpcResponse=null;
  });
  await check('unauthenticated water creates no diagnostic',async()=>{const n=events.length,c=calls.length;assert.equal((await request([water()],{key:'bad'})).response.status,401);assert.equal(events.length,n);assert.equal(calls.length,c);});
  await check('water logs reveal no quantity, source, raw date or input strings',async()=>{const text=JSON.stringify(events);for(const secret of ['PRIVATE_WATER_SOURCE','PRIVATE_EMPTY_UNIT','dietary_water_PRIVATE','765.4321','2026-09-15'])assert.ok(!text.includes(secret),secret);});
  console.log(`Basal loopback HTTP handler: ${groups} groups passed (RPC double; real PostgreSQL gate is separate).`);
}finally{await new Promise(resolve=>server.close(resolve));}
