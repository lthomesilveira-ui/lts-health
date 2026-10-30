import {consumerLanguageService} from './consumer-language-fixture.mjs';
// Only the production startup status read is simulated. Sync/connect and every
// other invocation stay forbidden and are recorded by the shared mutation guard.
export function sourceWindowService(db,options){
 const original="functions:{invoke:name=>mutation('invoke',name)}";
 const replacement="functions:{invoke:(name,options)=>{if(name==='health-polar-connection'&&options&&Object.keys(options).length===1&&options.body&&Object.keys(options.body).length===1&&options.body.action==='status'){window.__historyQA.reads.push({kind:'invoke',target:name,action:'status'});return Promise.resolve({data:{configured:false,connected:false},error:null});}return mutation('invoke',name);}}";
 const sdk=consumerLanguageService(db,options);
 if(!sdk.includes(original))throw Error('Shared synthetic invocation guard changed; review the bounded status mock');
 return sdk.replace(original,replacement);
}
