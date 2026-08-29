const $=id=>document.getElementById(id);
let moreReturnFocus=null;
let entryReturnFocus=null;

function visible(id){const el=$(id);return !!el&&!el.classList.contains('hidden');}
function entrySaving(){return $('entryModal')?.dataset.saving==='true';}
function restoreFocus(target){if(!target?.isConnected)return;requestAnimationFrame(()=>target.focus?.());}
function restoreEntryFocusIfClosed(){
  requestAnimationFrame(()=>{
    if(visible('entryModal'))return;
    const target=entryReturnFocus;entryReturnFocus=null;restoreFocus(target);
  });
}
function focusDialog(id){
  requestAnimationFrame(()=>{
    const dialog=$(id);if(!dialog||dialog.classList.contains('hidden'))return;
    const preferred=dialog.querySelector('input:not([type="hidden"]),select,textarea,button');
    preferred?.focus?.();
  });
}

document.addEventListener('click',event=>{
  const moreTrigger=event.target.closest('[data-route="mais"]');
  if(moreTrigger){moreReturnFocus=moreTrigger;focusDialog('moreSheet');return;}

  const entryTrigger=event.target.closest('[data-entry]');
  if(entryTrigger?.dataset.entry){entryReturnFocus=entryTrigger;focusDialog('entryModal');return;}

  if(event.target.closest('#closeMore')){const target=moreReturnFocus;moreReturnFocus=null;restoreFocus(target);return;}
  if(event.target.closest('#closeEntry')){restoreEntryFocusIfClosed();return;}

  if(event.target===$('moreSheet')){const target=moreReturnFocus;moreReturnFocus=null;restoreFocus(target);return;}
  if(event.target===$('entryModal')){restoreEntryFocusIfClosed();}
},true);

document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  if(visible('entryModal')){
    event.preventDefault();
    if(entrySaving())return;
    $('closeEntry')?.click();return;
  }
  if(visible('moreSheet')){event.preventDefault();$('closeMore')?.click();}
});
