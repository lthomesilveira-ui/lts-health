import {state,routes,signIn,signOut,restoreSession,subscribeAuth,uploadFile} from './core.js';
import {loadInitialData,ensureRouteData,isRouteReady,refreshData,downloadStructuredBackup} from './data-layer.js';
import {renderBioHub} from './bio-screen.js';
import {renderTrainingScreen} from './training-screen.js';
import {renderEvolutionHub} from './evolution-screen.js';
import {renderAnalysisHub} from './analysis-screen.js';
import {renderTreatmentHub} from './treatment-screen.js';
import {renderHealthHub} from './health-screen.js';
import {renderNutritionHub} from './nutrition-screen.js';
import {renderTodayHub} from './today-screen.js';
import {renderDataHub} from './data-screen.js';
import {renderTimelineHub} from './timeline-screen.js';
import {openEntry,setupEntryController} from './entry.js';

const screenRenderers={bio:renderBioHub,treinos:renderTrainingScreen,evolucao:renderEvolutionHub,analise:renderAnalysisHub,tratamentos:renderTreatmentHub,saude:renderHealthHub,nutricao:renderNutritionHub,hoje:renderTodayHub,dados:renderDataHub,timeline:renderTimelineHub};
const $=id=>document.getElementById(id);
let authSubscription=null;
let renderQueued=false;
const secondaryRoutes=new Set(['hoje','timeline','saude','nutricao','dados']);

function setSync(text){const el=$('syncText');if(el)el.textContent=text;}
function showLogin(message=''){$('login').classList.remove('hidden');$('app').classList.add('hidden');$('moreSheet').classList.add('hidden');$('entryModal').classList.add('hidden');$('loginMsg').textContent=message;}
function showApp(){$('login').classList.add('hidden');$('app').classList.remove('hidden');}

function syncNav(){
  document.querySelectorAll('[data-route]').forEach(b=>{const r=b.dataset.route;b.classList.toggle('active',r===state.route||(r==='mais'&&secondaryRoutes.has(state.route)));});
  const action=$('routeAction');
  if(state.route==='bio'){action.textContent='Registrar bio';action.dataset.entry='body';action.classList.remove('hidden');}
  else if(state.route==='treinos'){action.textContent='Registrar treino';action.dataset.entry='workout';action.classList.remove('hidden');}
  else{action.classList.add('hidden');action.dataset.entry='';}
}

function setRoute(route,{replace=true}={}){
  if(route==='mais'){$('moreSheet').classList.remove('hidden');return;}
  if(!routes.has(route))route='bio';
  state.route=route;$('moreSheet').classList.add('hidden');
  try{localStorage.setItem('lts-health-v2-route',route);}catch{}
  const url=`#${route}`;if(replace)history.replaceState(null,'',url);else history.pushState(null,'',url);
  syncNav();scheduleRender();
  if(state.loaded)ensureRouteData(route,setSync).then(scheduleRender);
  requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'auto'}));
}

function routeFromLocation(){
  const hash=location.hash.replace(/^#/,'');if(routes.has(hash))return hash;
  try{const saved=localStorage.getItem('lts-health-v2-route');if(routes.has(saved))return saved;}catch{}
  return'bio';
}

function loadingView(text='Carregando seus dados'){return`<div class="loadingState"><div class="spinner"></div><b>${text}</b><span>Os dados já carregados continuam preservados enquanto esta área é preparada.</span></div>`;}

function render(){
  renderQueued=false;if(!$('app')||$('app').classList.contains('hidden'))return;
  const host=$('screenHost');
  if(!state.loaded){host.innerHTML=loadingView();syncNav();return;}
  if(!isRouteReady(state.route)){host.innerHTML=loadingView('Carregando esta área');syncNav();return;}
  const renderer=screenRenderers[state.route]||screenRenderers.bio;
  try{host.innerHTML=renderer();}
  catch(error){console.error(error);host.innerHTML='<div class="errorState"><b>Não foi possível abrir esta área.</b><span>Os outros dados continuam disponíveis. Tente atualizar ou abra outra aba.</span></div>';}
  applyControlState();syncNav();
}

function scheduleRender(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(render);}
function applyControlState(){
  const values={trainingPeriod:state.ui.trainingPeriod,analysisPeriod:state.ui.analysisPeriod,timelinePeriod:state.ui.timelinePeriod,timelineYear:state.ui.timelineYear,timelineDomain:state.ui.timelineDomain,nutritionPeriod:state.ui.nutritionPeriod,nutritionYear:state.ui.nutritionYear,compareA:state.ui.compareA,compareB:state.ui.compareB,segmentalCompareDate:state.ui.segmentalCompareDate,collectionSelect:state.ui.selectedCollection,dataUploadStatus:state.ui.dataUploadStatus,dataUploadSource:state.ui.dataUploadSource};
  for(const[id,value]of Object.entries(values)){const el=$(id);if(el&&value!=null)el.value=value;}
}

async function refresh(){if(state.loading)return;setSync('Atualizando…');scheduleRender();await refreshData(state.route,setSync);scheduleRender();}

export function uploadOutcomeMessage(result){
  if(result?.processing==='review_required')return'Arquivo recebido e preservado. O processamento automático não terminou; ficou para revisão.';
  if(result?.processing==='status_unknown')return'Arquivo recebido e preservado. Não foi possível atualizar o status do processamento agora; confira em Dados antes de reenviar.';
  return'Arquivo recebido. O processamento foi iniciado.';
}

async function doLogin(){
  const email=$('email').value.trim(),password=$('password').value;$('loginMsg').textContent='Entrando…';
  try{await signIn(email,password);$('loginMsg').textContent='';showApp();setRoute(routeFromLocation());await loadInitialData(setSync);await ensureRouteData(state.route,setSync);scheduleRender();}
  catch(error){console.error(error);$('loginMsg').textContent='Não foi possível entrar. Confira e tente novamente.';}
}

function openTimelineTarget(button){
  const route=button.dataset.timelineRoute,kind=button.dataset.timelineKind,ref=button.dataset.timelineRef||'',date=button.dataset.timelineDate||'';
  if(kind==='workout'){state.ui.trainingPeriod='all';state.ui.openWorkout=ref;}
  else if(kind==='body'){state.ui.selectedBodyDate=ref||date;}
  else if(kind==='nutrition'){state.ui.nutritionPeriod='all';state.ui.nutritionYear=String(date).slice(0,4);state.ui.nutritionDate=date;}
  else if(kind==='labs'){state.ui.selectedCollection=ref;state.ui.labQuery='';}
  if(route)setRoute(route,{replace:false});
}

function bindStaticEvents(){
  document.addEventListener('click',async event=>{
    const backupButton=event.target.closest('#backupExportBtn');
    if(backupButton){
      const msg=$('backupExportMsg');backupButton.disabled=true;if(msg)msg.textContent='Preparando backup…';
      try{const result=await downloadStructuredBackup(text=>{if(msg)msg.textContent=text;setSync(text);});if(msg)msg.textContent=`Backup criado: ${result.filename}`;setSync('Atualizado');}
      catch(error){console.error(error);if(msg)msg.textContent='Não foi possível criar o backup agora.';setSync('Falha no backup');}
      finally{backupButton.disabled=false;}
      return;
    }
    const sourceButton=event.target.closest('[data-source-upload]');
    if(sourceButton){const select=$('uploadType');if(select)select.value=sourceButton.dataset.sourceUpload;$('uploadFile')?.focus();return;}
    const timelineMore=event.target.closest('[data-timeline-more]');if(timelineMore){state.ui.timelineLimit=Number(state.ui.timelineLimit||250)+250;scheduleRender();return;}
    const timelineJump=event.target.closest('[data-timeline-jump]');if(timelineJump){openTimelineTarget(timelineJump);return;}
    const entryButton=event.target.closest('[data-entry]');if(entryButton?.dataset.entry){openEntry(entryButton.dataset.entry);return;}
    const routeButton=event.target.closest('[data-route]');if(routeButton){event.preventDefault();setRoute(routeButton.dataset.route,{replace:false});return;}
    const metricButton=event.target.closest('[data-bio-metric]');if(metricButton){state.ui.bioMetric=metricButton.dataset.bioMetric;scheduleRender();return;}
    const bodyDate=event.target.closest('[data-body-date]');if(bodyDate){state.ui.selectedBodyDate=bodyDate.dataset.bodyDate;scheduleRender();return;}
    const evolutionMetric=event.target.closest('[data-evolution-metric]');if(evolutionMetric){state.ui.evolutionMetric=evolutionMetric.dataset.evolutionMetric;scheduleRender();return;}
    const segmentDate=event.target.closest('[data-segmental-date]');if(segmentDate){state.ui.segmentalDate=segmentDate.dataset.segmentalDate;scheduleRender();return;}
    const nutritionDate=event.target.closest('[data-nutrition-date]');if(nutritionDate){state.ui.nutritionDate=nutritionDate.dataset.nutritionDate;scheduleRender();return;}
    const nutritionYear=event.target.closest('[data-nutrition-year]');if(nutritionYear){state.ui.nutritionPeriod='all';state.ui.nutritionYear=nutritionYear.dataset.nutritionYear;state.ui.nutritionDate=null;scheduleRender();return;}
    const workoutButton=event.target.closest('[data-workout]');if(workoutButton){const id=workoutButton.dataset.workout;state.ui.openWorkout=state.ui.openWorkout===id?null:id;scheduleRender();return;}
    const exerciseButton=event.target.closest('[data-exercise]');if(exerciseButton){state.ui.selectedExercise=exerciseButton.dataset.exercise;scheduleRender();return;}
    const markerButton=event.target.closest('[data-marker]');if(markerButton){state.ui.selectedBiomarker=markerButton.dataset.marker;scheduleRender();return;}
  });

  document.addEventListener('input',event=>{
    if(event.target.id==='trainingQuery'){state.ui.trainingQuery=event.target.value;scheduleRender();}
    if(event.target.id==='exerciseQuery'){state.ui.exerciseQuery=event.target.value;scheduleRender();}
    if(event.target.id==='timelineQuery'){state.ui.timelineQuery=event.target.value;state.ui.timelineLimit=250;scheduleRender();}
    if(event.target.id==='labQuery'){state.ui.labQuery=event.target.value;scheduleRender();}
    if(event.target.id==='treatmentQuery'){state.ui.treatmentQuery=event.target.value;scheduleRender();}
  });

  document.addEventListener('change',event=>{
    if(event.target.id==='trainingPeriod'){state.ui.trainingPeriod=event.target.value;scheduleRender();}
    if(event.target.id==='analysisPeriod'){state.ui.analysisPeriod=event.target.value;scheduleRender();}
    if(event.target.id==='timelinePeriod'){state.ui.timelinePeriod=event.target.value;state.ui.timelineLimit=250;if(event.target.value!=='all')state.ui.timelineYear=null;scheduleRender();}
    if(event.target.id==='timelineYear'){state.ui.timelineYear=event.target.value;state.ui.timelineLimit=250;scheduleRender();}
    if(event.target.id==='timelineDomain'){state.ui.timelineDomain=event.target.value;state.ui.timelineLimit=250;scheduleRender();}
    if(event.target.id==='nutritionPeriod'){state.ui.nutritionPeriod=event.target.value;state.ui.nutritionDate=null;scheduleRender();}
    if(event.target.id==='nutritionYear'){state.ui.nutritionYear=event.target.value;state.ui.nutritionDate=null;scheduleRender();}
    if(event.target.id==='compareA'){state.ui.compareA=event.target.value;scheduleRender();}
    if(event.target.id==='compareB'){state.ui.compareB=event.target.value;scheduleRender();}
    if(event.target.id==='segmentalCompareDate'){state.ui.segmentalCompareDate=event.target.value;scheduleRender();}
    if(event.target.id==='collectionSelect'){state.ui.selectedCollection=event.target.value;scheduleRender();}
    if(event.target.id==='dataUploadStatus'){state.ui.dataUploadStatus=event.target.value;scheduleRender();}
    if(event.target.id==='dataUploadSource'){state.ui.dataUploadSource=event.target.value;scheduleRender();}
  });

  document.addEventListener('submit',async event=>{
    if(event.target.id!=='uploadForm')return;event.preventDefault();
    const file=$('uploadFile')?.files?.[0],type=$('uploadType')?.value||'other',msg=$('uploadMsg'),button=event.target.querySelector('button[type="submit"]');
    if(msg)msg.textContent='Enviando…';if(button)button.disabled=true;
    let result;
    try{
      result=await uploadFile(file,type);
      if(msg)msg.textContent=uploadOutcomeMessage(result);
    }catch(error){
      console.error(error);if(msg)msg.textContent='Não foi possível enviar este arquivo agora.';if(button)button.disabled=false;return;
    }
    try{
      await refresh();
    }catch(error){
      console.warn('upload_refresh_failed',error);
      if(msg)msg.textContent=`${uploadOutcomeMessage(result)} A tela não pôde ser atualizada agora.`;
    }finally{if(button)button.disabled=false;}
  });

  $('loginBtn').addEventListener('click',doLogin);
  $('password').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
  $('refreshBtn').addEventListener('click',refresh);
  $('logoutBtn').addEventListener('click',async()=>{await signOut();state.loaded=false;state.data={};state.domainStatus={};showLogin();});
  $('closeMore').addEventListener('click',()=>$('moreSheet').classList.add('hidden'));
  $('moreSheet').addEventListener('click',e=>{if(e.target===$('moreSheet'))$('moreSheet').classList.add('hidden');});
  window.addEventListener('popstate',()=>setRoute(routeFromLocation()));
  window.addEventListener('hashchange',()=>{const route=routeFromLocation();if(route!==state.route)setRoute(route);});
  window.addEventListener('online',()=>setSync(state.loaded?'Online':'Conectado'));
  window.addEventListener('offline',()=>setSync('Sem conexão'));
}

async function boot(){
  bindStaticEvents();setupEntryController({onSaved:refresh});state.route=routeFromLocation();
  try{const session=await restoreSession();if(!session){showLogin();}else{showApp();setRoute(state.route);await loadInitialData(setSync);await ensureRouteData(state.route,setSync);scheduleRender();}}
  catch(error){console.error(error);showLogin('Não foi possível restaurar sua sessão.');}
  authSubscription=subscribeAuth(session=>{state.session=session;if(!session){state.loaded=false;state.data={};state.domainStatus={};showLogin();}});
}

window.addEventListener('beforeunload',()=>authSubscription?.unsubscribe?.());
boot();
