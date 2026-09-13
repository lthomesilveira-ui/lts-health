import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync} from 'node:fs';
import {join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createCipheriv,publicEncrypt,constants,createHash} from 'node:crypto';

export function sealEvidence(input,output,publicPem){
  mkdirSync(output,{recursive:true});
  if(!existsSync(input))return 0;
  let count=0;
  for(const file of readdirSync(input)){
    if(!/^[a-zA-Z0-9_.-]+\.png$/.test(file)||basename(file)!==file)continue;
    const data=readFileSync(join(input,file)),key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
    cipher.setAAD(Buffer.from(file));
    const ciphertext=Buffer.concat([cipher.update(data),cipher.final()]);
    const envelope={format:'lts-health-private-visual-v1',algorithm:'RSA-OAEP-SHA256+A256GCM',file,public_key_sha256:createHash('sha256').update(publicPem).digest('hex'),wrapped_key:publicEncrypt({key:publicPem,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key).toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
    writeFileSync(join(output,`${file}.sealed.json`),JSON.stringify(envelope));key.fill(0);count++;
  }
  return count;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const count=sealEvidence('v2/real-auth-evidence','v2/real-auth-encrypted',readFileSync('v2/qa-visual-public.pem'));
  console.log(`Encrypted visual evidence files: ${count}. No plaintext images are eligible for public artifact upload.`);
}
