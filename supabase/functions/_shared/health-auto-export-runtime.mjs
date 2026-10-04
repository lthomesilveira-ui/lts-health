import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.117.2';
export const config=()=>({url:Deno.env.get('SUPABASE_URL'),publicKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')});
const options={auth:{persistSession:false,autoRefreshToken:false}};
export const service=c=>createClient(c.url,c.serviceKey,options);
export async function authenticatedUser(req,c){
  const auth=req.headers.get('authorization');if(!/^Bearer \S+$/.test(auth||''))return null;
  const {data,error}=await createClient(c.url,c.publicKey,options).auth.getUser(auth.slice(7));
  return !error&&!data.user?.is_anonymous?data.user:null;
}
