import {consumerLanguageService} from './consumer-language-fixture.mjs';
// Only the requested connection status reads are simulated. Sync/connect and every
// other invocation stay forbidden and are recorded by the shared mutation guard.
export function sourceWindowService(db,options){
 const original="functions:{invoke:name=>mutation('invoke',name)}";
 const replacement="functions:{invoke:(name,options)=>{if(name==='health-polar-connection'&&options&&Object.keys(options).length===1&&options.body&&Object.keys(options.body).length===1&&options.body.action==='status'){window.__historyQA.reads.push({kind:'invoke',target:name,action:'status'});return Promise.resolve({data:{configured:false,connected:false},error:null});}return mutation('invoke',name);}}";
 const extra=options?.connectionStatusReads?`if(options&&Object.keys(options).length===1&&options.body?.action==='status'&&((name==='health-google-connection'&&Object.keys(options.body).length===1)||(name==='health-auto-export-connection'&&options.body.key_revision===null&&Object.keys(options.body).length===2))){window.__historyQA.reads.push({kind:'invoke',target:name,action:'status'});return Promise.resolve({data:{configured:false,connected:false,received:false},error:null});}`:'';
 const sdk=consumerLanguageService(db,options);
 if(!sdk.includes(original))throw Error('Shared synthetic invocation guard changed; review the bounded status mock');
 return sdk.replace(original,replacement.replace("return mutation('invoke',name);",extra+"return mutation('invoke',name);"));
}
