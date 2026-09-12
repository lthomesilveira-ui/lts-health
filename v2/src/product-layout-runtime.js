import {state,fixtureMode} from './core.js';
import {renderProductHome,renderProductTraining} from './product-layout-v2.js';

if(!fixtureMode){
  const renderers={hoje:renderProductHome,treinos:renderProductTraining};
  let applying=false;
  let pollTimer=null;
  let pollStarted=0;

  function route(){return location.hash.replace(/^#/,'')||state.route||'hoje';}
  function apply(){
    if(applying||!state.loaded)return false;
    const key=route(),renderer=renderers[key];
    if(!renderer)return true;
    const host=document.getElementById('screenHost');
    if(!host)return false;
    const marker=key==='hoje'?'.ltsHomeV2':'.ltsTrainingV2';
    if(host.querySelector(marker))return true;
    applying=true;
    try{
      host.innerHTML=renderer();
      host.dataset.productLayout='v2';
      host.dataset.productLayoutRoute=key;
      host.scrollTo({top:0,left:0,behavior:'auto'});
      return true;
    }catch(error){console.error('product-layout-v2',error);return false;}
    finally{applying=false;}
  }

  function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}
  function startPolling(){
    stopPolling();
    pollStarted=Date.now();
    apply();
    pollTimer=setInterval(()=>{
      const done=apply();
      if(done||Date.now()-pollStarted>30000)stopPolling();
    },250);
  }
  function settle(){startPolling();setTimeout(startPolling,1200);setTimeout(startPolling,3200);}

  const boot=()=>{
    if(!document.getElementById('screenHost')){setTimeout(boot,80);return;}
    window.addEventListener('hashchange',settle);
    window.addEventListener('online',settle);
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-workout],[data-route],[data-entry],#refreshBtn'))settle();
    });
    settle();
  };
  boot();
}
