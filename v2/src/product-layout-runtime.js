import {state} from './core.js';
import {renderProductHome,renderProductTraining} from './product-layout-v2.js';

const renderers={hoje:renderProductHome,treinos:renderProductTraining};
let applying=false;
let scheduled=false;

function route(){return location.hash.replace(/^#/,'')||state.route||'hoje';}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply();});}
function apply(){
  if(applying||!state.loaded)return;
  const key=route(),renderer=renderers[key];
  if(!renderer)return;
  const host=document.getElementById('screenHost');
  if(!host)return;
  const marker=key==='hoje'?'.ltsHomeV2':'.ltsTrainingV2';
  if(host.querySelector(marker))return;
  applying=true;
  try{host.innerHTML=renderer();host.dataset.productLayout='v2';host.dataset.productLayoutRoute=key;}
  catch(error){console.error('product-layout-v2',error);}
  finally{applying=false;}
}

const boot=()=>{
  const host=document.getElementById('screenHost');
  if(!host){setTimeout(boot,80);return;}
  new MutationObserver(schedule).observe(host,{childList:true,subtree:true});
  window.addEventListener('hashchange',schedule);
  document.addEventListener('click',event=>{if(event.target.closest('[data-workout],[data-route]'))setTimeout(schedule,0);});
  schedule();
  setTimeout(schedule,250);
  setTimeout(schedule,900);
};
boot();
