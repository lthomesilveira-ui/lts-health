import {config,configured,service,consumeState,tokenExchange,saveAuthorization,callbackUrl,APP_URL} from '../_shared/polar-runtime.mjs';

const redirect=()=>new Response(null,{status:303,headers:{Location:`${APP_URL}#dados`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const invalid=()=>new Response('A autorização Polar não foi concluída. Volte a Dados & fontes e inicie novamente.',{status:400,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
// OAuth callbacks cannot carry a Supabase JWT. Single-use hashed state binds them to an authenticated start.
Deno.serve(async req=>{
  if(req.method!=='GET')return invalid();
  try{
    const c=config();if(!configured(c))return invalid();
    const query=new URL(req.url).searchParams,db=service(c),userId=await consumeState(db,query.get('state'));
    if(!userId)return invalid();
    if(query.has('error'))return redirect();
    const code=query.get('code');if(!code||code.length>2048)return invalid();
    const token=await tokenExchange(c,{grant_type:'authorization_code',code,redirect_uri:callbackUrl(c)});
    await saveAuthorization(db,c,userId,token);return redirect();
  }catch{return invalid();}
});
