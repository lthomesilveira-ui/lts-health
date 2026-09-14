import {state,fixtureMode,exercisesFor,workoutRows} from './core.js';
import {isRouteReady} from './data-layer.js';
import {renderProductTraining} from './training-reference-v2.js?v=ux-coherence-training-tabs-20260913.12';

if(!fixtureMode){
  let applying=false;
  const route=()=>location.hash.replace(/^#/,'')||state.route||'hoje';
  function captureContext(host){
    const focused=host.contains(document.activeElement)?document.activeElement:null;
    let start=null,end=null;
    try{start=focused?.selectionStart;end=focused?.selectionEnd;}catch{}
    return{top:host.scrollTop,id:focused?.id||null,start,end};
  }
  function restoreContext(host,context){
    host.scrollTop=context.top;
    if(!context.id)return;
    const el=document.getElementById(context.id);
    if(!el)return;
    try{
      el.focus({preventScroll:true});
      if(context.start!=null&&typeof el.setSelectionRange==='function')el.setSelectionRange(context.start,context.end);
    }catch{}
  }
  function wirePreview(host){
    const preview=host.querySelector('.ltsRefExercisePreview button');
    if(preview){
      const selected=workoutRows().find(w=>w.source_record_id===state.ui.openWorkout)||workoutRows()[0]||null;
      const exercise=selected?exercisesFor(selected)[0]:null;
      if(exercise?.source_record_id){
        preview.removeAttribute('data-depth-training-view');
        preview.dataset.depthExercise=exercise.source_record_id;
        preview.textContent='Abrir histórico ›';
      }
    }
    const exerciseNav=host.querySelector('.ltsRefExerciseNav');
    if(exerciseNav){exerciseNav.style.display='grid';exerciseNav.style.gridTemplateColumns='repeat(2,minmax(0,1fr))';}
  }
  function apply(){
    if(applying||route()!=='treinos'||!state.loaded||!isRouteReady('treinos'))return false;
    const host=document.getElementById('screenHost');
    if(!host)return false;
    if(host.querySelector('.ltsTrainingReference')){wirePreview(host);return true;}
    const context=captureContext(host);
    applying=true;
    try{
      host.innerHTML=renderProductTraining();
      host.dataset.productLayout='training-reference-v2';
      host.dataset.productLayoutRoute='treinos';
      wirePreview(host);
      restoreContext(host,context);
      return true;
    }catch(error){console.error('training-reference-v2 render failed',error?.name||'Error');return false;}
    finally{applying=false;}
  }
  function settle(){
    if(route()!=='treinos')return;
    apply();
    let tries=0;
    const timer=setInterval(()=>{tries+=1;apply();if(tries>=80||hostReady())clearInterval(timer);},125);
  }
  function hostReady(){return!!document.querySelector('#screenHost .ltsTrainingReference');}
  function boot(){
    const host=document.getElementById('screenHost');
    if(!host){setTimeout(boot,80);return;}
    new MutationObserver(()=>{if(!applying&&route()==='treinos'&&!host.querySelector('.ltsTrainingReference'))queueMicrotask(apply);else if(route()==='treinos')wirePreview(host);}).observe(host,{childList:true});
    window.addEventListener('hashchange',settle);
    document.addEventListener('click',event=>{
      const target=event.target instanceof Element?event.target:null;
      if(!target)return;
      if(target.closest('[data-depth-training-view],[data-depth-workout],[data-depth-exercise],[data-route="treinos"],#refreshBtn'))setTimeout(apply,0);
    });
    settle();
  }
  boot();
}
