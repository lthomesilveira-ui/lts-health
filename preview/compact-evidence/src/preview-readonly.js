/* Preview-only application guard. Server authentication and RLS are unchanged. */
(function installPreviewReadOnly(global){
  'use strict';
  if(global.LTSPreviewReadOnly)return;
  const message='Prévia somente leitura: registros, arquivos e integrações não podem ser alterados aqui.';
  const denied=new Set(['insert','update','upsert','delete','rpc','upload','uploadToSignedUrl','createSignedUploadUrl','remove','move','copy','createBucket','updateBucket','emptyBucket','deleteBucket','invoke']);
  const proxies=new WeakMap();
  const block=()=>{const error=new Error(message);error.code='preview_read_only';throw error;};
  function wrapClient(value){
    if(!value||typeof value!=='object')return value;
    if(proxies.has(value))return proxies.get(value);
    const proxy=new Proxy(value,{get(target,key){
      if(denied.has(key))return block;
      // Preserve the existing login, logout, session refresh and subscription.
      // The guard never reads a session or token itself.
      if(key==='auth')return Reflect.get(target,key,target);
      const member=Reflect.get(target,key,target);
      if(typeof member==='function'){
        if(['then','catch','finally'].includes(key))return member.bind(target);
        return (...args)=>wrapClient(Reflect.apply(member,target,args));
      }
      return wrapClient(member);
    }});
    proxies.set(value,proxy);proxies.set(proxy,proxy);return proxy;
  }
  const forms=['bodyEntryForm','workoutEntryForm','waterEntryForm','mfpWaterImportForm','personalGoalsForm','uploadForm'];
  const formSelector=forms.map(id=>'form#'+id).join(',');
  const actionSelector='button[data-polar-action],button[data-hae-action]';
  function protectForms(){
    if(!global.document)return;
    for(const form of document.querySelectorAll(formSelector)){
      if(!form.querySelector('[data-preview-readonly-warning]')){
        const note=document.createElement('p');note.dataset.previewReadonlyWarning='';note.className='previewReadonlyWarning';note.textContent=message;form.prepend(note);
      }
      for(const control of form.querySelectorAll('input,select,textarea,button')){
        if(!control.disabled)control.disabled=true;
        if(control.title!==message)control.title=message;
      }
    }
    for(const button of document.querySelectorAll(actionSelector)){
      if(!button.disabled)button.disabled=true;
      if(button.title!==message)button.title=message;
    }
    for(const heading of document.querySelectorAll('.refHeading h1')){
      if(!heading.parentElement.querySelector('[data-preview-readonly-banner]')){
        const note=document.createElement('small');note.dataset.previewReadonlyBanner='';note.className='previewReadonlyBanner';note.textContent='Prévia · somente leitura';heading.insertAdjacentElement('afterend',note);
      }
    }
  }
  if(global.document){
    document.addEventListener('submit',event=>{
      if(!event.target?.matches?.(formSelector))return;
      event.preventDefault();event.stopImmediatePropagation();protectForms();
    },true);
    document.addEventListener('click',event=>{
      const target=event.target?.closest?.('button,input,select,textarea,a');
      if(!target||( !target.closest(formSelector)&&!target.matches(actionSelector)))return;
      event.preventDefault();event.stopImmediatePropagation();protectForms();
    },true);
    const observe=()=>{
      protectForms();
      const observer=new MutationObserver(protectForms);
      observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
  }
  const api=Object.freeze({wrapClient,protectForms,blockedMessage:message});
  Object.defineProperty(global,'LTSPreviewReadOnly',{value:api});
  if(global.supabase?.createClient){
    const namespace=global.supabase,create=namespace.createClient;
    const factory=(...args)=>wrapClient(Reflect.apply(create,namespace,args));
    const guardedNamespace=new Proxy(namespace,{get(target,key){return key==='createClient'?factory:Reflect.get(target,key,target);}});
    Object.defineProperty(global,'supabase',{value:guardedNamespace,writable:false,configurable:false});
  }else if(!new URLSearchParams(global.location?.search||'').has('fixture')){
    // Missing SDK remains a normal unavailable-login error, never demo data.
    Object.defineProperty(global,'supabase',{value:{createClient(){throw new Error('Não foi possível carregar a prévia. Atualize para tentar novamente.');}},writable:false,configurable:false});
  }
})(globalThis);
