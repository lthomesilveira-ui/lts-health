const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','X-LTS-Lab-Parser-Mode':'quarantine'}});

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);

  const authorization=req.headers.get('Authorization');
  if(!authorization)return json({error:'missing_authorization'},401);

  let body:unknown;
  try{body=await req.json()}catch{return json({error:'invalid_json'},400)}
  const uploadId=String((body as {upload_id?:unknown})?.upload_id||'');
  if(!uploadId)return json({error:'upload_id_required'},400);

  const supabaseUrl=Deno.env.get('SUPABASE_URL');
  if(!supabaseUrl)return json({error:'supabase_url_missing'},500);

  const headers:Record<string,string>={Authorization:authorization,'Content-Type':'application/json'};
  const apiKey=req.headers.get('apikey');
  if(apiKey)headers.apikey=apiKey;

  try{
    const response=await fetch(`${supabaseUrl}/functions/v1/health-inspect-upload`,{
      method:'POST',headers,body:JSON.stringify({upload_id:uploadId})
    });
    const text=await response.text();
    return new Response(text,{status:response.status,headers:{...cors,'Content-Type':response.headers.get('Content-Type')||'application/json','X-LTS-Lab-Parser-Mode':'quarantine'}});
  }catch(error){
    console.error('lab_quarantine_forward_failed',error instanceof Error?error.message:String(error));
    return json({error:'generic_inspector_unavailable'},503);
  }
});
