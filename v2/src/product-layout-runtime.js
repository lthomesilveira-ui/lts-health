import {state,fixtureMode} from './core.js';
import {isRouteReady} from './data-layer.js';
import {renderProductHome,renderProductTraining} from './product-layout-v2.js';
import {renderProductComposition} from './composition-layout-v2.js';
import {renderProductLabs} from './labs-layout-v2.js';

if(!fixtureMode){
  const renderers={hoje:renderProductHome,treinos:renderProductTraining,bio:renderProductComposition,saude:renderProductLabs};
  const markers={hoje:'.ltsHomeV2',treinos:'.ltsTrainingV2',bio:'.ltsCompositionV2',saude:'.ltsLabsV2'};
  let applying=false,pollTimer=null,pollStarted=0,hostObserver=null,lastData=null,lastRoute=null;
  const route=()=>location.hash.replace(/^#/,'')||state.route||'hoje';
  const pageFields=new Set(['productTrainingPage','productLabPage','productCompositionPage','productExercisePage']);
  const textFields=new Set(['productTrainingQuery','productLabQuery']);
  const selectFields=new Set(['productTrainingYear','productLabCohort','productLabMarkerSelect','productCompositionSource','productCompositionYear','productCompareA','productCompareB','productExerciseUnit','productLabPoint','productCompositionPoint','productExercisePoint']);
  function ownRouteAction(key){
    const action=document.getElementById('routeAction');if(!renderers[key]||!action)return;
    action.classList.add('hidden');action.setAttribute('aria-hidden','true');action.tabIndex=-1;
  }
  function capture(host){
    const focused=host.contains(document.activeElement)?document.activeElement:null;
    let start=null,end=null;try{start=focused?.selectionStart;end=focused?.selectionEnd;}catch{}
    return{top:host.scrollTop,id:focused?.id,start,end,disclosures:[...host.querySelectorAll('details[open][data-disclosure]')].map(d=>d.dataset.disclosure)};
  }
  function restore(host,context){
    for(const d of host.querySelectorAll('details[data-disclosure]'))d.open=context.disclosures.includes(d.dataset.disclosure);
    host.scrollTop=context.top;
    const el=context.id?document.getElementById(context.id):null;
    if(el){el.focus({preventScroll:true});try{if(context.start!=null)el.setSelectionRange(context.start,context.end);}catch{}}
  }
  function dataInputs(key){return[key,...Object.entries(state.data).flatMap(([k,v])=>[k,v]),JSON.stringify(state.domainStatus),JSON.stringify(state.errors)];}
  function dataChanged(next){return !lastData||next.length!==lastData.length||next.some((v,i)=>v!==lastData[i]);}
  function renderIntoHost(key,{force=false,scroll='preserve'}={}){
    const renderer=renderers[key];if(!renderer)return true;
    const host=document.getElementById('screenHost');if(!host||!state.loaded||!isRouteReady(key))return false;
    const next=dataInputs(key);ownRouteAction(key);
    if(!force&&host.querySelector(markers[key])&&!dataChanged(next))return true;
    const context=lastRoute===key?capture(host):{top:0,id:null,disclosures:[]};
    applying=true;
    try{
      host.innerHTML=renderer();host.dataset.productLayout='v2';host.dataset.productLayoutRoute=key;ownRouteAction(key);
      lastData=next;lastRoute=key;restore(host,context);
      if(scroll==='top'){
        host.scrollTo({top:0,left:0,behavior:'auto'});
        host.querySelector('h1[tabindex]')?.focus({preventScroll:true});
      }else if(scroll!=='preserve')host.querySelector(scroll)?.scrollIntoView({block:'start',behavior:'auto'});
      return true;
    }catch(error){console.error('product-layout-v2 render failed',error?.name||'Error');return false;}
    finally{applying=false;}
  }
  const apply=()=>applying||!state.loaded?false:renderIntoHost(route());
  function settle(){
    if(pollTimer)clearInterval(pollTimer);pollStarted=Date.now();apply();
    pollTimer=setInterval(()=>{apply();if(Date.now()-pollStarted>30000){clearInterval(pollTimer);pollTimer=null;}},250);
  }
  const redraw=scroll=>renderIntoHost(route(),{force:true,scroll:scroll||'preserve'});
  function selectMarker(value){
    if(!value)return;state.ui.productLabMarker=value;state.ui.productLabCohort=null;state.ui.productLabPage=1;state.ui.productLabPoint=null;redraw('top');
  }
  function fieldChanged(target){
    const key=target.dataset.depthField;
    if(!textFields.has(key)&&!selectFields.has(key))return;
    const value=target.value;
    if(key==='productLabMarkerSelect'){selectMarker(value);return;}
    state.ui[key]=value;
    if(key==='productTrainingQuery'||key==='productTrainingYear')state.ui.productTrainingPage=1;
    if(key==='productCompositionYear')state.ui.productCompositionPage=1;
    if(key==='productLabCohort')state.ui.productLabPoint=null;
    if(key==='productCompositionSource'){state.ui.productCompositionPoint=null;state.ui.productCompareA=null;state.ui.productCompareB=null;}
    if(key==='productExerciseUnit')state.ui.productExercisePoint=null;
    redraw();
  }
  function boot(){
    const host=document.getElementById('screenHost');if(!host){setTimeout(boot,80);return;}
    hostObserver=new MutationObserver(()=>{const key=route();if(!applying&&renderers[key]&&state.loaded&&(!host.querySelector(markers[key])||dataChanged(dataInputs(key))))queueMicrotask(apply);});
    hostObserver.observe(host,{childList:true});
    window.addEventListener('hashchange',settle);window.addEventListener('online',settle);
    document.addEventListener('input',event=>{if(textFields.has(event.target.dataset?.depthField))fieldChanged(event.target);});
    document.addEventListener('change',event=>{if(selectFields.has(event.target.dataset?.depthField))fieldChanged(event.target);});
    document.addEventListener('click',event=>{
      const target=event.target instanceof Element?event.target:null;if(!target)return;
      const metric=target.closest('[data-composition-metric]');
      if(metric&&route()==='bio'){state.ui.productCompositionMetric=metric.dataset.compositionMetric;state.ui.productCompositionPoint=null;redraw();return;}
      const marker=target.closest('[data-lab-marker]');if(marker&&route()==='saude'){selectMarker(marker.dataset.labMarker);return;}
      const view=target.closest('[data-depth-training-view]');
      if(view){state.ui.productTrainingView=view.dataset.depthTrainingView;redraw('top');return;}
      const workout=target.closest('[data-depth-workout]');
      if(workout){state.ui.openWorkout=workout.dataset.depthWorkout;state.ui.productTrainingView='session';redraw('top');return;}
      const exercise=target.closest('[data-depth-exercise]');
      if(exercise){state.ui.productExerciseId=exercise.dataset.depthExercise;state.ui.productExerciseUnit=null;state.ui.productExercisePage=1;state.ui.productExercisePoint=null;state.ui.productTrainingView='exercise';redraw('top');return;}
      const record=target.closest('[data-depth-composition-record]');
      if(record){state.ui.productCompositionRecord=record.dataset.depthCompositionRecord;redraw('top');return;}
      if(target.closest('[data-depth-composition-back]')){state.ui.productCompositionRecord=null;redraw('#productCompositionHistory');return;}
      const page=target.closest('[data-depth-page]');
      if(page&&pageFields.has(page.dataset.depthPage)&&!page.disabled){state.ui[page.dataset.depthPage]=Math.max(1,Number(page.dataset.page)||1);redraw();return;}
      const period=target.closest('[data-depth-period]');
      if(period&&['productLabPeriod','productCompositionPeriod'].includes(period.dataset.depthPeriod)&&['recent','90','365','all'].includes(period.dataset.value)){
        const key=period.dataset.depthPeriod;state.ui[key]=period.dataset.value;state.ui[key.replace('Period','Point')]=null;redraw();return;
      }
      if(target.closest('[data-depth-clear="training"]')){state.ui.productTrainingQuery='';state.ui.productTrainingYear='all';state.ui.productTrainingPage=1;redraw();return;}
      const nav=target.closest('[data-route]');
      if(nav?.dataset.route==='bio')state.ui.productCompositionRecord=null;
      if(target.closest('[data-workout],[data-route],[data-entry],[data-timeline-jump],#refreshBtn'))settle();
    });
    settle();
  }
  boot();
}
