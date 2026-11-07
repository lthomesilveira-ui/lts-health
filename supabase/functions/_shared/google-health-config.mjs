import {validKey} from './polar-contract.mjs';

// Server-only configuration. This object must never be returned by a route or logged.
// A false environment switch wins over Vault; RPC failures never enable a fallback.
export async function resolveGoogleHealthServerConfig(base, load){
  const disabled={...base,enabled:false,encryptionKey:null};
  if(base.disabledByEnv===true)return disabled;
  let rows;
  try{rows=await load();}catch{return disabled;}
  if(!Array.isArray(rows)||rows.length>1)return disabled;
  if(rows.length===0)return base; // Preserve an explicitly configured environment-only installation.
  const row=rows[0];
  if(!row||typeof row!=='object'||Object.keys(row).length!==2||
    typeof row.enabled!=='boolean'||row.enabled!==true||!validKey(row.token_encryption_key))return disabled;
  return {...base,enabled:true,encryptionKey:row.token_encryption_key};
}
