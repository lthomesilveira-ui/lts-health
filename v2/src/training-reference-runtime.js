import {state,fixtureMode} from './core.js';
import {isRouteReady} from './data-layer.js';
import {renderProductTraining} from './training-reference-v2.js?v=ux-coherence-training-tabs-20260913.12';

if(!fixtureMode){
  let applying=false;
  const route=()=>location.hash.replace(/^#/,'')||state.route||'hoje';
  function apply(){
    if(applying||route()!=='treinos'||!state.loaded||!isRouteReady('treinos'))return false;
    const host=document.getElementById('screenHost');
    if(!host)return false;
    if(host.querySelector('.ltsTrainingReference'))return true;
    applying=true;
    try{
      const top=host.scrollTop;
      host.innerHTML=renderProductTraining();
      host.dataset.productLayout='training-reference-v2';
      host.dataset.productLayoutRoute='treinos';
      host.scrollTop=top;
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
    new MutationObserver(()=>{if(!applying&&route()==='treinos'&&!host.querySelector('.ltsTrainingReference'))queueMicrotask(apply);}).observe(host,{childList:true});
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
