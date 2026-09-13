import {state,fixtureMode} from './core.js';
import {renderProductHome,renderProductTraining} from './product-layout-v2.js';
import {renderProductComposition} from './composition-layout-v2.js';
import {renderProductLabs} from './labs-layout-v2.js';

if(!fixtureMode){
  const renderers={hoje:renderProductHome,treinos:renderProductTraining,bio:renderProductComposition,saude:renderProductLabs};
  const markers={hoje:'.ltsHomeV2',treinos:'.ltsTrainingV2',bio:'.ltsCompositionV2',saude:'.ltsLabsV2'};
  let applying=false;
  let pollTimer=null;
  let pollStarted=0;
  let hostObserver=null;

  function route(){return location.hash.replace(/^#/,'')||state.route||'hoje';}
  function ownRouteAction(key){
    if(!renderers[key])return;
    const action=document.getElementById('routeAction');
    if(!action)return;
    action.classList.add('hidden');
    action.setAttribute('aria-hidden','true');
    action.tabIndex=-1;
  }
  function renderIntoHost(key,{force=false}={}){
    const renderer=renderers[key];
    if(!renderer)return true;
    const host=document.getElementById('screenHost');
    if(!host)return false;
    ownRouteAction(key);
    if(!force&&host.querySelector(markers[key]))return true;
    applying=true;
    try{
      host.innerHTML=renderer();
      host.dataset.productLayout='v2';
      host.dataset.productLayoutRoute=key;
      ownRouteAction(key);
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
      apply();
      if(Date.now()-pollStarted>30000)stopPolling();
    },250);
  }
  function settle(){startPolling();setTimeout(startPolling,1200);setTimeout(startPolling,3200);}
  function observeHost(){
    const host=document.getElementById('screenHost');
    if(!host||hostObserver)return;
    hostObserver=new MutationObserver(()=>{
      const key=route();
      if(applying||!state.loaded||!renderers[key]||host.querySelector(markers[key]))return;
      queueMicrotask(()=>apply());
    });
    hostObserver.observe(host,{childList:true});
  }

  const boot=()=>{
    if(!document.getElementById('screenHost')){setTimeout(boot,80);return;}
    observeHost();
    window.addEventListener('hashchange',settle);
    window.addEventListener('online',settle);
    document.addEventListener('click',event=>{
      const metric=event.target.closest('[data-composition-metric]');
      if(metric&&route()==='bio'){
        state.ui.productCompositionMetric=metric.dataset.compositionMetric;
        renderIntoHost('bio',{force:true});
        return;
      }
      const marker=event.target.closest('[data-lab-marker]');
      if(marker&&route()==='saude'){
        state.ui.productLabMarker=marker.dataset.labMarker;
        renderIntoHost('saude',{force:true});
        return;
      }
      if(event.target.closest('[data-workout],[data-route],[data-entry],#refreshBtn'))settle();
    });
    settle();
  };
  boot();
}
