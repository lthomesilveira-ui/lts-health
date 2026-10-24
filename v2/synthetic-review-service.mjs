// Browser-test transport only. Not imported by the application or its entry.
// All data is supplied by deterministic test fixtures; no network is used.
function installReviewService(db){
 const user='synthetic-review-user';
 const readStored=(key,fallback)=>JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));
 window.__reviewDb=db;
 window.__reviewDb.health_personal_goals=readStored('synthetic-review-goals',(db.health_personal_goals||[]).map(row=>({...row,user_id:user})));
 window.__reviewWrites=readStored('synthetic-review-writes',[]);
 window.__reviewDenied=[];
 const deny=target=>{window.__reviewDenied.push(target);throw Error('Synthetic QA forbids '+target);};
 const failure=message=>({data:null,error:{message}});
 function query(table){
  let start=0,end=999,mode='read',payload;const filters=[],orders=[];
  const rows=()=>[...(window.__reviewDb[table]||[])].filter(row=>filters.every(([key,value])=>row[key]===value)).sort((a,b)=>{for(const [key,asc]of orders){const result=String(a[key]??'').localeCompare(String(b[key]??''));if(result)return asc?result:-result;}return 0;});
  const read=()=>window.__failTable===table?failure('Synthetic read failure'):{data:rows().slice(start,end+1),error:null};
  const write=()=>{
   if(table!=='health_personal_goals')return deny(table+' '+mode);
   const all=window.__reviewDb[table]||[],matching=rows();let saved;
   if(mode==='insert'){
    if(payload.user_id!==user)return failure('Wrong owner');
    if(all.some(row=>row.user_id===user&&row.effective_from===payload.effective_from))return failure('Duplicate goal date');
    saved={...payload};window.__reviewDb[table]=[...all,saved];
   }else if(mode==='update'){
    if(!filters.some(([key,value])=>key==='user_id'&&value===user)||!filters.some(([key])=>key==='effective_from')||!filters.some(([key])=>key==='notes')||matching.length!==1)return failure('Optimistic update found no unique row');
    saved={...matching[0],...payload};window.__reviewDb[table]=all.map(row=>row===matching[0]?saved:row);
   }else return deny(table+' '+mode);
   window.__reviewWrites.push({table,mode,effective_from:saved.effective_from});
   localStorage.setItem('synthetic-review-goals',JSON.stringify(window.__reviewDb[table]));localStorage.setItem('synthetic-review-writes',JSON.stringify(window.__reviewWrites));
   return {data:saved,error:null};
  };
  const q={select(){return q;},eq(key,value){filters.push([key,value]);return q;},is(key,value){filters.push([key,value]);return q;},order(key,options={}){orders.push([key,options.ascending!==false]);return q;},range(a,b){start=a;end=b;return q;},limit(count){end=start+count-1;return q;},
   insert(row){if(table!=='health_personal_goals')return deny(table+' insert');mode='insert';payload=row;return q;},update(row){if(table!=='health_personal_goals')return deny(table+' update');mode='update';payload=row;return q;},
   upsert(){return deny(table+' upsert');},delete(){return deny(table+' delete');},
   async maybeSingle(){const result=read();return result.error?result:result.data.length>1?failure('Multiple rows'):{data:result.data[0]||null,error:null};},
   async single(){if(mode!=='read')return write();const result=read();return result.error?result:result.data.length===1?{data:result.data[0],error:null}:failure('Missing unique row');},
   then(resolve,reject){return Promise.resolve(mode==='read'?read():write()).then(resolve,reject);}};
  return q;
 }
 window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:user}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:query,
  functions:{invoke:async(name,args)=>args?.body?.action==='status'?{data:{configured:false,connected:false,received:false},error:null}:deny('invoke '+name)},rpc:()=>deny('rpc'),storage:{from:()=>({upload:()=>deny('upload'),remove:()=>deny('remove')})}})};
}
export const reviewService=db=>`(${installReviewService.toString()})(${JSON.stringify(db)});`;
