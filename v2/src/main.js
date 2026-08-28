import {state,routes,loadData,signIn,signOut,restoreSession,subscribeAuth,uploadFile} from './core.js';
import {screenRenderers} from './screens.js';
import {openEntry,setupEntryController} from './entry.js';

const $=id=>document.getElementById(id);
let authSubscription=null;
let renderQueued=false;
const secondaryRoutes=new Set(['hoje','timeline','saude','nutricao','dados']);

function setSync(text){ const el=$('syncText'); if(el) el.textContent=text; }

function showLogin(message=''){
  $('login').classList.remove('hidden');
  $('app').classList.add('hidden');
  $('moreSheet').classList.add('hidden');
  $('entryModal').classList.add('hidden');
  $('loginMsg').textContent=message;
}

function showApp(){
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
}

function syncNav(){
  document.querySelectorAll('[data-route]').forEach(b=>{
    const r=b.dataset.route;
    b.classList.toggle('active',r===state.route || (r==='mais'&&secondaryRoutes.has(state.route)));
  });
  const action=$('routeAction');
  if(state.route==='bio'){ action.textContent='Registrar bio'; action.dataset.entry='body'; action.classList.remove('hidden'); }
  else if(state.route==='treinos'){ action.textContent='Registrar treino'; action.dataset.entry='workout'; action.classList.remove('hidden'); }
  else{ action.classList.add('hidden'); action.dataset.entry=''; }
}

function setRoute(route,{replace=true}={}){
  if(route==='mais'){
    $('moreSheet').classList.remove('hidden');
    return;
  }
  if(!routes.has(route)) route='bio';
  state.route=route;
  $('moreSheet').classList.add('hidden');
  try{ localStorage.setItem('lts-health-v2-route',route); }catch{}
  const url=`#${route}`;
  if(replace) history.replaceState(null,'',url); else history.pushState(null,'',url);
  syncNav();
  scheduleRender();
  requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'auto'}));
}

function routeFromLocation(){
  const hash=location.hash.replace(/^#/,'');
  if(routes.has(hash)) return hash;
  try{ const saved=localStorage.getItem('lts-health-v2-route'); if(routes.has(saved)) return saved; }catch{}
  return 'bio';
}

function loadingView(){
  return '<div class="loadingState"><div class="spinner"></div><b>Carregando seus dados</b><span>Isso pode levar alguns segundos na primeira abertura.</span></div>';
}

function render(){
  renderQueued=false;
  if(!$('app')||$('app').classList.contains('hidden')) return;
  const host=$('screenHost');
  if(!state.loaded){ host.innerHTML=loadingView(); syncNav(); return; }
  const renderer=screenRenderers[state.route]||screenRenderers.bio;
  try{ host.innerHTML=renderer(); }
  catch(error){
    console.error(error);
    host.innerHTML='<div class="errorState"><b>Não foi possível abrir esta área.</b><span>Os outros dados continuam disponíveis. Tente atualizar ou abra outra aba.</span></div>';
  }
  applyControlState();
  syncNav();
}

function scheduleRender(){
  if(renderQueued) return;
  renderQueued=true;
  requestAnimationFrame(render);
}

function applyControlState(){
  const values={trainingPeriod:state.ui.trainingPeriod,timelineDomain:state.ui.timelineDomain,nutritionPeriod:state.ui.nutritionPeriod,compareA:state.ui.compareA,compareB:state.ui.compareB,collectionSelect:state.ui.selectedCollection};
  for(const [id,value] of Object.entries(values)){ const el=$(id); if(el&&value!=null) el.value=value; }
}

async function refresh(){
  if(state.loading) return;
  setSync('Atualizando…');
  scheduleRender();
  await loadData(setSync);
  scheduleRender();
}

async function doLogin(){
  const email=$('email').value.trim(),password=$('password').value;
  $('loginMsg').textContent='Entrando…';
  try{
    await signIn(email,password);
    $('loginMsg').textContent='';
    showApp();
    setRoute(routeFromLocation());
    await refresh();
  }catch(error){ $('loginMsg').textContent='Não foi possível entrar. Confira e tente novamente.'; }
}

function bindStaticEvents(){
  document.addEventListener('click',event=>{
    const entryButton=event.target.closest('[data-entry]');
    if(entryButton?.dataset.entry){ openEntry(entryButton.dataset.entry); return; }
    const routeButton=event.target.closest('[data-route]');
    if(routeButton){ event.preventDefault(); setRoute(routeButton.dataset.route,{replace:false}); return; }
    const metricButton=event.target.closest('[data-bio-metric]');
    if(metricButton){ state.ui.bioMetric=metricButton.dataset.bioMetric; scheduleRender(); return; }
    const workoutButton=event.target.closest('[data-workout]');
    if(workoutButton){ const id=workoutButton.dataset.workout; state.ui.openWorkout=state.ui.openWorkout===id?null:id; scheduleRender(); return; }
    const exerciseButton=event.target.closest('[data-exercise]');
    if(exerciseButton){ state.ui.selectedExercise=exerciseButton.dataset.exercise; scheduleRender(); return; }
    const markerButton=event.target.closest('[data-marker]');
    if(markerButton){ state.ui.selectedBiomarker=markerButton.dataset.marker; scheduleRender(); return; }
  });

  document.addEventListener('input',event=>{
    if(event.target.id==='trainingQuery'){ state.ui.trainingQuery=event.target.value; scheduleRender(); }
    if(event.target.id==='exerciseQuery'){ state.ui.exerciseQuery=event.target.value; scheduleRender(); }
    if(event.target.id==='timelineQuery'){ state.ui.timelineQuery=event.target.value; scheduleRender(); }
    if(event.target.id==='labQuery'){ state.ui.labQuery=event.target.value; scheduleRender(); }
  });

  document.addEventListener('change',event=>{
    if(event.target.id==='trainingPeriod'){ state.ui.trainingPeriod=event.target.value; scheduleRender(); }
    if(event.target.id==='timelineDomain'){ state.ui.timelineDomain=event.target.value; scheduleRender(); }
    if(event.target.id==='nutritionPeriod'){ state.ui.nutritionPeriod=event.target.value; scheduleRender(); }
    if(event.target.id==='compareA'){ state.ui.compareA=event.target.value; scheduleRender(); }
    if(event.target.id==='compareB'){ state.ui.compareB=event.target.value; scheduleRender(); }
    if(event.target.id==='collectionSelect'){ state.ui.selectedCollection=event.target.value; scheduleRender(); }
  });

  document.addEventListener('submit',async event=>{
    if(event.target.id!=='uploadForm') return;
    event.preventDefault();
    const file=$('uploadFile')?.files?.[0],type=$('uploadType')?.value||'other',msg=$('uploadMsg'),button=event.target.querySelector('button[type="submit"]');
    if(msg) msg.textContent='Enviando…';
    if(button) button.disabled=true;
    try{
      await uploadFile(file,type);
      if(msg) msg.textContent='Arquivo recebido. O processamento foi iniciado.';
      await refresh();
    }catch(error){
      console.error(error);
      if(msg) msg.textContent='Não foi possível enviar este arquivo agora.';
    }finally{ if(button) button.disabled=false; }
  });

  $('loginBtn').addEventListener('click',doLogin);
  $('password').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });
  $('refreshBtn').addEventListener('click',refresh);
  $('logoutBtn').addEventListener('click',async()=>{ await signOut(); state.loaded=false; state.data={}; showLogin(); });
  $('closeMore').addEventListener('click',()=>$('moreSheet').classList.add('hidden'));
  $('moreSheet').addEventListener('click',e=>{ if(e.target===$('moreSheet')) $('moreSheet').classList.add('hidden'); });
  window.addEventListener('popstate',()=>setRoute(routeFromLocation()));
  window.addEventListener('hashchange',()=>{ const route=routeFromLocation(); if(route!==state.route) setRoute(route); });
  window.addEventListener('online',()=>setSync(state.loaded?'Online':'Conectado'));
  window.addEventListener('offline',()=>setSync('Sem conexão'));
}

async function boot(){
  bindStaticEvents();
  setupEntryController({onSaved:refresh});
  state.route=routeFromLocation();
  try{
    const session=await restoreSession();
    if(!session){ showLogin(); }
    else{ showApp(); setRoute(state.route); await refresh(); }
  }catch(error){
    console.error(error);
    showLogin('Não foi possível restaurar sua sessão.');
  }
  authSubscription=subscribeAuth(session=>{
    state.session=session;
    if(!session){ state.loaded=false; state.data={}; showLogin(); }
  });
}

window.addEventListener('beforeunload',()=>authSubscription?.unsubscribe?.());
boot();
