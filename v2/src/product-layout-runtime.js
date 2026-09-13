import {state,fixtureMode} from './core.js';
import {renderProductHome,renderProductTraining} from './product-layout-v2.js';
import {renderProductComposition} from './composition-layout-v2.js';

if(!fixtureMode){
  const renderers={hoje:renderProductHome,treinos:renderProductTraining,bio:renderProductComposition};
  const markers={hoje:'.ltsHomeV2',treinos:'.ltsTrainingV2',bio:'.ltsCompositionV2'};
  let applying=false;
  let pollTimer=null;
  let pollStarted=0;

  function route(){return location.hash.replace(/^#/,'')||state.route||'hoje';}
  function renderIntoHost(key,{force=false}={}){
    const renderer=renderers[key];
    if(!renderer)return true;
    const host=document.getElementById('screenHost');
    if(!host)return false;
    if(!force&&host.querySelector(markers[key]))return true;
    applying=true;
    try{
      host.innerHTML=renderer();
      host.dataset.productLayout='v2';
      host.dataset.productLayoutRoute=key;
      if(!force)host.scrollTo({top:0,left:0,behavior:'auto'});
      return true;
    }catch(error){console.error('product-layout-v2',error);return false;}
    finally{applying=false;}
  }
  function apply(){
    if(applying||!state.loaded)return false;
    return renderIntoHost(route());
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
      const metric=event.target.closest('[data-composition-metric]');
      if(metric&&route()==='bio'){
        state.ui.productCompositionMetric=metric.dataset.compositionMetric;
        renderIntoHost('bio',{force:true});
        return;
      }
      if(event.target.closest('[data-workout],[data-route],[data-entry],#refreshBtn'))settle();
    });
    settle();
  };
  boot();
}
