import {state,fixtureMode} from './core.js';
import {renderProductHome,renderProductTraining} from './product-layout-v2.js';

if(!fixtureMode){
  const renderers={hoje:renderProductHome,treinos:renderProductTraining};
  let applying=false;
  let scheduled=false;

  function route(){return location.hash.replace(/^#/,'')||state.route||'hoje';}
  function apply(){
    if(applying||!state.loaded)return false;
    const key=route(),renderer=renderers[key];
    if(!renderer)return false;
    const host=document.getElementById('screenHost');
    if(!host)return false;
    const marker=key==='hoje'?'.ltsHomeV2':'.ltsTrainingV2';
    if(host.querySelector(marker))return true;
    applying=true;
    try{host.innerHTML=renderer();host.dataset.productLayout='v2';host.dataset.productLayoutRoute=key;return true;}
    catch(error){console.error('product-layout-v2',error);return false;}
    finally{applying=false;}
  }
  function schedule(delay=0){
    if(delay){setTimeout(()=>schedule(),delay);return;}
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;apply();});
  }
  function settle(){schedule();schedule(120);schedule(360);schedule(900);schedule(1800);}

  const boot=()=>{
    if(!document.getElementById('screenHost')){setTimeout(boot,80);return;}
    window.addEventListener('hashchange',settle);
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-workout],[data-route],[data-entry],#refreshBtn'))settle();
    });
    settle();
  };
  boot();
}
