import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {join,basename} from 'node:path';
import {createDecipheriv,privateDecrypt,constants} from 'node:crypto';
const [input,output,keyPath]=process.argv.slice(2);
if(!input||!output||!keyPath)throw new Error('Usage: node v2/unseal-visual-evidence.mjs ENCRYPTED_DIRECTORY PRIVATE_OUTPUT_DIRECTORY PRIVATE_KEY_PATH');
const privatePem=readFileSync(keyPath);mkdirSync(output,{recursive:true,mode:0o700});
let count=0;
for(const name of readdirSync(input)){
  if(!name.endsWith('.sealed.json'))continue;
  const e=JSON.parse(readFileSync(join(input,name),'utf8'));
  if(e.format!=='lts-health-private-visual-v1'||!/^[a-zA-Z0-9_.-]+\.png$/.test(e.file)||basename(e.file)!==e.file)throw new Error('Invalid visual envelope');
  const key=privateDecrypt({key:privatePem,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(e.wrapped_key,'base64'));
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(e.iv,'base64'));decipher.setAAD(Buffer.from(e.file));decipher.setAuthTag(Buffer.from(e.tag,'base64'));
  const data=Buffer.concat([decipher.update(Buffer.from(e.ciphertext,'base64')),decipher.final()]);
  writeFileSync(join(output,e.file),data,{mode:0o600});key.fill(0);count++;
}
console.log(`Private visual evidence restored: ${count} files.`);
