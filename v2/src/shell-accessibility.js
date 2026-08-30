const $=id=>document.getElementById(id);
let moreReturnFocus=null;
let entryReturnFocus=null;
const focusableSelector='button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function visible(id){const el=$(id);return !!el&&!el.classList.contains('hidden');}
function entrySaving(){return $('entryModal')?.dataset.saving==='true';}
function restoreFocus(target){if(!target?.isConnected)return;requestAnimationFrame(()=>target.focus?.());}
function activeDialog(){if(visible('entryModal'))return $('entryModal');if(visible('moreSheet'))return $('moreSheet');return null;}
function focusableItems(dialog){return [...(dialog?.querySelectorAll(focusableSelector)||[])].filter(el=>el.tabIndex>=0&&!el.hasAttribute('hidden')&&!el.closest('[hidden]'));}
function setAppIsolated(isolated){
  const app=$('app');if(!app)return;
  app.inert=isolated;
  if(isolated)app.setAttribute('aria-hidden','true');else app.removeAttribute('aria-hidden');
}
function syncModalIsolation(){requestAnimationFrame(()=>setAppIsolated(!!activeDialog()));}
function releaseIsolationAndRestore(target){
  requestAnimationFrame(()=>{
    if(activeDialog())return;
    setAppIsolated(false);
    if(target?.isConnected)target.focus?.();
  });
}
function restoreEntryFocusIfClosed(){
  const target=entryReturnFocus;entryReturnFocus=null;
  releaseIsolationAndRestore(target);
}
function focusDialog(id){
  requestAnimationFrame(()=>{
    const dialog=$(id);if(!dialog||dialog.classList.contains('hidden'))return;
    setAppIsolated(true);
    focusableItems(dialog)[0]?.focus?.();
  });
}
function trapFocus(event,dialog){
  const items=focusableItems(dialog);if(!items.length){event.preventDefault();return;}
  const first=items[0],last=items[items.length-1],current=document.activeElement;
  if(event.shiftKey&&(current===first||!dialog.contains(current))){event.preventDefault();last.focus();return;}
  if(!event.shiftKey&&(current===last||!dialog.contains(current))){event.preventDefault();first.focus();}
}

document.addEventListener('click',event=>{
  if(event.target.closest('#loginBtn'))setAppIsolated(false);

  const moreTrigger=event.target.closest('[data-route="mais"]');
  if(moreTrigger){moreReturnFocus=moreTrigger;focusDialog('moreSheet');return;}

  const entryTrigger=event.target.closest('[data-entry]');
  if(entryTrigger?.dataset.entry){entryReturnFocus=entryTrigger;focusDialog('entryModal');return;}

  if(event.target.closest('#closeMore')){const target=moreReturnFocus;moreReturnFocus=null;releaseIsolationAndRestore(target);return;}
  if(event.target.closest('#closeEntry')){restoreEntryFocusIfClosed();return;}

  if(event.target===$('moreSheet')){const target=moreReturnFocus;moreReturnFocus=null;releaseIsolationAndRestore(target);return;}
  if(event.target===$('entryModal')){restoreEntryFocusIfClosed();return;}
  if(event.target.closest('#moreSheet [data-route]')){moreReturnFocus=null;syncModalIsolation();}
},true);

document.addEventListener('lts-health-entry-closed',restoreEntryFocusIfClosed);
window.addEventListener('popstate',syncModalIsolation);
window.addEventListener('hashchange',syncModalIsolation);

document.addEventListener('keydown',event=>{
  const dialog=activeDialog();
  if(event.key==='Tab'&&dialog){trapFocus(event,dialog);return;}
  if(event.key!=='Escape')return;
  if(visible('entryModal')){
    event.preventDefault();
    if(entrySaving())return;
    $('closeEntry')?.click();return;
  }
  if(visible('moreSheet')){event.preventDefault();$('closeMore')?.click();}
});
