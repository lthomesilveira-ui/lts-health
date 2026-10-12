import {state,routes,fixtureMode,signIn,signOut,restoreSession,subscribeAuth,uploadFile,setGlobalPeriod} from './core.js';
import {loadInitialData,ensureRouteData,isRouteReady,refreshData,downloadStructuredBackup} from './data-layer.js';
import {renderBioHub} from './bio-screen.js';
import {renderTrainingScreen} from './training-screen.js';
import {renderEvolutionHub} from './evolution-screen.js';
import {renderAnalysisHub} from './analysis-screen.js';
import {renderTreatmentHub} from './treatment-screen.js';
import {renderHealthHub} from './health-screen.js';
import {renderNutritionHub} from './nutrition-screen.js';
import {renderProductNutrition} from './nutrition-product.js';
import {renderTodayHub} from './today-screen.js';
import {renderDataHub} from './data-screen.js';
import {renderTimelineHub} from './timeline-screen.js';
import {renderProductHomeReference} from './home-reference.js';
import {renderProductTraining} from './training-reference-v2.js';
import {renderProductComposition} from './composition-layout-v2.js';
import {renderProductLabs} from './labs-layout-v2.js';
import {renderRecoveryDepth} from './recovery-layout-v2.js';
import {mountEvidencePanels} from './evidence-priority.js';
import {openEntry,setupEntryController} from './entry.js';
import {checkPolarConnection,actOnPolar,resetPolarConnection} from './polar-connection.js';
import {checkAutoExportConnection,actOnAutoExport,copyAutoExport,resetAutoExportConnection} from './health-auto-export-connection.js';
import {downloadIntegratedSummary} from './integrated-review-view.js';
import {saveGoals} from './personal-goals.js';

const legacyScreenRenderers={bio:renderBioHub,treinos:renderTrainingScreen,evolucao:renderEvolutionHub,analise:renderAnalysisHub,tratamentos:renderTreatmentHub,saude:renderHealthHub,nutricao:renderNutritionHub,hoje:renderTodayHub,dados:renderDataHub,timeline:renderTimelineHub};
const screenRenderers=fixtureMode?legacyScreenRenderers:{...legacyScreenRenderers,bio:renderProductComposition,treinos:renderProductTraining,analise:renderRecoveryDepth,saude:renderProductLabs,nutricao:renderProductNutrition,hoje:renderProductHomeReference};
const $=id=>document.getElementById(id);
let authSubscription=null;
let renderQueued=false;
let loginBusy=false;
let renderedRoute=null;
const mobileMoreRoutes=new Set(['timeline','nutricao','analise','tratamentos','evolucao','dados']);

function setSync(text){const el=$('syncText'),rail=$('railSyncText');if(el)el.textContent=text;if(rail)rail.textContent=text;}
function showLogin(message=''){$('login').classList.remove('hidden');$('app').classList.add('hidden');$('moreSheet').classList.add('hidden');$('entryModal').classList.add('hidden');$('loginMsg').textContent=message;}
function showApp(){$('login').classList.add('hidden');$('app').classList.remove('hidden');}

function syncNav(){
  document.querySelectorAll('#primaryNav [data-route]').forEach(button=>{const route=button.dataset.route;button.classList.toggle('active',route===state.route||(route==='mais'&&state.route==='evolucao'));});
  document.querySelectorAll('#moreSheet [data-route]').forEach(button=>button.classList.toggle('active',button.dataset.route===state.route));
  document.querySelectorAll('#mobileNav [data-route]').forEach(button=>{const route=button.dataset.route;button.classList.toggle('active',route===state.route||(route==='mais'&&mobileMoreRoutes.has(state.route)));});
  const action=$('routeAction');
  if(state.route==='bio'){action.textContent='Registrar bio';action.dataset.entry='body';action.classList.remove('hidden');}
  else if(state.route==='treinos'){action.textContent='Registrar treino';action.dataset.entry='workout';action.classList.remove('hidden');}
  else{action.classList.add('hidden');action.dataset.entry='';}
}

function resetRouteScroll(){
  const host=$('screenHost');
  window.scrollTo({top:0,left:0,behavior:'auto'});
  host?.scrollTo({top:0,left:0,behavior:'auto'});
  if(host){host.scrollTop=0;host.scrollLeft=0;}
}

function settleRouteScroll(route){
  const reset=()=>{if(state.route===route)resetRouteScroll();};
  reset();
  requestAnimationFrame(()=>{reset();requestAnimationFrame(reset);});
}

function setRoute(route,{replace=true}={}){
  if(route==='mais'){$('moreSheet').classList.remove('hidden');return;}
  if(!routes.has(route))route='hoje';
  state.route=route;$('moreSheet').classList.add('hidden');
  try{localStorage.setItem('lts-health-v2-route',route);}catch{}
  const url=`#${route}`;if(replace)history.replaceState(null,'',url);else history.pushState(null,'',url);
  syncNav();scheduleRender();
  if(state.loaded)ensureRouteData(route,setSync).then(scheduleRender);
  if(route==='dados'&&state.session&&!state.polarConnection)checkPolarConnection().then(scheduleRender);
  if(route==='dados'&&state.session&&!state.autoExportConnection)checkAutoExportConnection().then(scheduleRender);
  settleRouteScroll(route);
}

function routeFromLocation(){
  const hash=location.hash.replace(/^#/,'');if(routes.has(hash))return hash;
  try{const saved=localStorage.getItem('lts-health-v2-route');if(routes.has(saved))return saved;}catch{}
  return'hoje';
}

function loadingView(text='Carregando seus dados'){return`<div class="loadingState"><div class="spinner"></div><b>${text}</b><span>Os dados já carregados continuam preservados enquanto esta área é preparada.</span></div>`;}

function disclosureKey(details){
  const explicit=details?.dataset?.disclosure;
  if(explicit)return explicit;
  const summary=details?.querySelector(':scope > summary');
  return String(summary?.querySelector('b')?.textContent||summary?.textContent||'').trim();
}

function captureRenderContext(host){
  const openDisclosures=[...host.querySelectorAll('details[open]')].map(disclosureKey).filter(Boolean);
  const active=host.contains(document.activeElement)?document.activeElement:null;
  if(!active?.id)return{openDisclosures,focus:null};
  let selectionStart=null,selectionEnd=null;
  try{selectionStart=active.selectionStart;selectionEnd=active.selectionEnd;}catch{}
  return{openDisclosures,focus:{id:active.id,selectionStart,selectionEnd}};
}

function restoreRenderContext(host,context){
  const open=new Set(context.openDisclosures||[]);
  for(const details of host.querySelectorAll('details'))if(open.has(disclosureKey(details)))details.open=true;
  if(!context.focus?.id)return;
  const active=$(context.focus.id);if(!active)return;
  try{
    active.focus({preventScroll:true});
    if(context.focus.selectionStart!=null&&typeof active.setSelectionRange==='function')active.setSelectionRange(context.focus.selectionStart,context.focus.selectionEnd);
  }catch{}
}

function render(){
  renderQueued=false;if(!$('app')||$('app').classList.contains('hidden'))return;
  const host=$('screenHost');
  if(!state.loaded){host.innerHTML=loadingView();syncNav();return;}
  if(!isRouteReady(state.route)){host.innerHTML=loadingView('Carregando esta área');syncNav();return;}
  const renderer=screenRenderers[state.route]||screenRenderers.hoje;
  const routeChanged=renderedRoute!==state.route;
  const context=routeChanged?{openDisclosures:[],focus:null}:captureRenderContext(host);
  try{host.innerHTML=renderer();}
  catch(error){console.error(error);host.innerHTML='<div class="errorState"><b>Não foi possível abrir esta área.</b><span>Os outros dados continuam disponíveis. Tente atualizar ou abra outra aba.</span></div>';}
  applyControlState();mountEvidencePanels();restoreRenderContext(host,context);
  if(routeChanged)settleRouteScroll(state.route);
  syncNav();renderedRoute=state.route;
}

function scheduleRender(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(render);}
function applyControlState(){
  const values={trainingPeriod:state.ui.trainingPeriod,analysisPeriod:state.ui.analysisPeriod,timelinePeriod:state.ui.timelinePeriod,timelineYear:state.ui.timelineYear,timelineMonth:state.ui.timelineMonth,timelineDate:state.ui.timelineDate,timelineDomain:state.ui.timelineDomain,nutritionPeriod:state.ui.nutritionPeriod,nutritionYear:state.ui.nutritionYear,compareA:state.ui.compareA,compareB:state.ui.compareB,segmentalCompareDate:state.ui.segmentalCompareDate,collectionSelect:state.ui.selectedCollection,dataUploadStatus:state.ui.dataUploadStatus,dataUploadSource:state.ui.dataUploadSource};
  for(const[id,value]of Object.entries(values)){const el=$(id);if(el&&value!=null)el.value=value;}
}

async function refresh(){if(state.loading)return;setSync('Atualizando…');scheduleRender();await refreshData(state.route,setSync);scheduleRender();}
async function updatePolarOnOpen(){const updated=await checkPolarConnection({syncOnOpen:true});if(updated)await refreshData(state.route,setSync);scheduleRender();}

export function uploadOutcomeMessage(result){
  if(result?.processing==='review_required')return'Arquivo recebido e preservado. A leitura automática não terminou; ficou aguardando leitura segura.';
  if(result?.processing==='status_unknown')return'Arquivo recebido e preservado. Não foi possível atualizar o resultado da leitura agora; confira em Arquivos & fontes antes de reenviar.';
  return'Arquivo recebido. A leitura foi iniciada.';
}

export function uploadOutcomeMessageFromState(result){
  const id=String(result?.id||'');
  if(!id)return uploadOutcomeMessage(result);
  const upload=(state.data.uploads||[]).find(row=>String(row.id)===id);
  const preview=(state.data.previews||[]).find(row=>String(row.upload_id)===id);
  const status=String(upload?.status||'').toLowerCase(),source=String(upload?.source_type||'').toLowerCase();
  if(status==='imported'){
    if(source==='apple_health')return'Arquivo incorporado ao histórico. Dados com regra segura entraram; sono e outras métricas sem regra segura continuam separados aguardando conferência.';
    return'Arquivo incorporado ao histórico.';
  }
  if(status==='review_required'){
    const format=preview?.detected_format?` (${String(preview.detected_format).toUpperCase()})`:'';
    return`Arquivo recebido e guardado${format}. Ainda não entrou nas análises e você não precisa revisar linha por linha.`;
  }
  if(status==='processed')return'Arquivo processado e guardado. O histórico de arquivos já registra a conclusão.';
  if(status==='rejected'||status==='failed')return'O arquivo foi guardado, mas não foi possível concluir o processamento. Para tentar novamente, envie outra versão do arquivo.';
  if(status==='uploaded'||status==='processing')return'Arquivo recebido e guardado. A leitura ainda está em andamento.';
  return uploadOutcomeMessage(result);
}

async function doLogin(){
  if(loginBusy)return;
  const button=$('loginBtn'),email=$('email').value.trim(),password=$('password').value;
  loginBusy=true;if(button){button.disabled=true;button.setAttribute('aria-busy','true');}$('loginMsg').textContent='Entrando…';
  try{await signIn(email,password);$('loginMsg').textContent='';showApp();setRoute(routeFromLocation());await loadInitialData(setSync);await ensureRouteData(state.route,setSync);scheduleRender();void updatePolarOnOpen();}
  catch(error){console.error(error);$('loginMsg').textContent='Não foi possível entrar. Confira e tente novamente.';}
  finally{loginBusy=false;if(button){button.disabled=false;button.removeAttribute('aria-busy');}}
}

function openTimelineTarget(button){
  const route=button.dataset.timelineRoute,kind=button.dataset.timelineKind,ref=button.dataset.timelineRef||'',date=button.dataset.timelineDate||'';
  if(kind==='workout'){setGlobalPeriod('all');state.ui.openWorkout=ref;}
  else if(kind==='body'){state.ui.selectedBodyDate=ref||date;}
  else if(kind==='nutrition'){setGlobalPeriod('all');state.ui.nutritionYear=String(date).slice(0,4);state.ui.nutritionDate=date;}
  else if(kind==='labs'){state.ui.selectedCollection=ref;state.ui.labQuery='';}
  if(route)setRoute(route,{replace:false});
}

function bindStaticEvents(){
  document.addEventListener('click',async event=>{
    const haeCheck=event.target.closest('[data-hae-check]');
    if(haeCheck){haeCheck.disabled=true;await checkAutoExportConnection();if(state.autoExportConnection?.received)await refreshData(state.route,setSync);scheduleRender();return;}
    const haeAction=event.target.closest('[data-hae-action]');
    if(haeAction){haeAction.disabled=true;await actOnAutoExport(haeAction.dataset.haeAction);scheduleRender();return;}
    const haeCopy=event.target.closest('[data-hae-copy]');
    if(haeCopy){await copyAutoExport(haeCopy.dataset.haeCopy);scheduleRender();return;}
    const polarCheck=event.target.closest('[data-polar-check]');
    if(polarCheck){polarCheck.disabled=true;await checkPolarConnection();scheduleRender();return;}
    const polarAction=event.target.closest('[data-polar-action]');
    if(polarAction){polarAction.disabled=true;const updated=await actOnPolar(polarAction.dataset.polarAction);if(updated)await refreshData(state.route,setSync);scheduleRender();return;}
    const homeInsight=event.target.closest('[data-home-insight-details]');
    if(homeInsight){setGlobalPeriod(state.ui.homePeriod||'90');state.ui.reportLoadPage=1;state.ui.reviewView='overview';setRoute('analise');return;}
    if(event.target.closest('[data-home-refresh]')){refresh();return;}
    if(event.target.closest('[data-home-consultation]')){setGlobalPeriod(state.ui.homePeriod||'90');state.ui.reviewView='consultation';setRoute('analise');return;}
    if(event.target.closest('[data-home-goals]')){const details=document.querySelector('.ltsGoalSettings');if(details){details.open=true;details.scrollIntoView({block:'start',behavior:'auto'});details.querySelector('input')?.focus({preventScroll:true});}return;}
    const homeWorkout=event.target.closest('[data-home-workout]');
    if(homeWorkout){state.ui.openWorkout=homeWorkout.dataset.homeWorkout;state.ui.productTrainingView='summary';setRoute('treinos');return;}
    const bodyMetric=event.target.closest('[data-home-body-metric]');
    if(bodyMetric&&['fat_mass_kg','skeletal_muscle_mass_kg','weight_kg','body_fat_pct'].includes(bodyMetric.dataset.homeBodyMetric)){state.ui.homeBodyMetric=bodyMetric.dataset.homeBodyMetric;render();return;}
    const reportPage=event.target.closest('[data-report-page]');
    if(reportPage&&['reportLabPage','reportPolarPage','reportLoadPage','reviewDayPage'].includes(reportPage.dataset.reportPage)&&!reportPage.disabled){state.ui[reportPage.dataset.reportPage]=Math.max(1,Number(reportPage.dataset.page)||1);scheduleRender();return;}
    const reviewView=event.target.closest('[data-review-view]');
    if(reviewView&&['overview','day','consultation'].includes(reviewView.dataset.reviewView)){state.ui.reviewView=reviewView.dataset.reviewView;scheduleRender();return;}
    const reviewDate=event.target.closest('[data-review-date]');
    if(reviewDate&&!reviewDate.disabled&&reviewDate.dataset.reviewDate){state.ui.reviewDate=reviewDate.dataset.reviewDate;state.ui.healthContextDate=state.ui.reviewDate;scheduleRender();return;}
    if(event.target.closest('[data-review-export]')){downloadIntegratedSummary();return;}
    const sectionLink=event.target.closest('[data-report-section]');
    if(sectionLink){event.preventDefault();const section=document.getElementById(sectionLink.dataset.reportSection);if(section){for(let ancestor=section.parentElement;ancestor;ancestor=ancestor.parentElement){if(ancestor.tagName==='DETAILS')ancestor.open=true;}section.scrollIntoView({block:'start',behavior:'auto'});section.tabIndex=-1;section.focus({preventScroll:true});}return;}
    const reportExercise=event.target.closest('[data-report-exercise]');
    if(reportExercise){state.ui.productExerciseId=reportExercise.dataset.reportExercise;state.ui.productExerciseUnit=reportExercise.dataset.reportLoadUnit;state.ui.productExercisePage=1;state.ui.productExercisePoint=null;state.ui.productTrainingView='exercise';setRoute('treinos');return;}
    const reportMarker=event.target.closest('[data-report-marker]');
    if(reportMarker){state.ui.reportLabMarker=reportMarker.dataset.reportMarker;state.ui.reportLabPoint=null;scheduleRender();return;}
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
    const timelineMore=event.target.closest('[data-timeline-more]');if(timelineMore){state.ui.timelineLimit=Number(state.ui.timelineLimit||50)+50;scheduleRender();return;}
    const timelineJump=event.target.closest('[data-timeline-jump]');if(timelineJump){openTimelineTarget(timelineJump);return;}
    const entryButton=event.target.closest('[data-entry]');if(entryButton?.dataset.entry){openEntry(entryButton.dataset.entry);return;}
    const evidenceButton=event.target.closest('[data-evidence-route]');if(evidenceButton){event.preventDefault();setRoute(evidenceButton.dataset.evidenceRoute,{replace:false});return;}
    const homePeriod=event.target.closest('button[data-home-period]');if(homePeriod){event.preventDefault();setGlobalPeriod(homePeriod.dataset.homePeriod);render();return;}
    const periodButton=event.target.closest('button[data-period]');if(periodButton){event.preventDefault();setGlobalPeriod(periodButton.dataset.period);scheduleRender();return;}
    const homeMetric=event.target.closest('[data-home-metric]');if(homeMetric){event.preventDefault();state.ui.homeMetric=homeMetric.dataset.homeMetric;render();return;}
    const healthDate=event.target.closest('[data-health-date]');if(healthDate){event.preventDefault();state.ui.healthContextDate=healthDate.dataset.healthDate;scheduleRender();return;}
    const routeButton=event.target.closest('[data-route]');if(routeButton){event.preventDefault();setRoute(routeButton.dataset.route,{replace:false});return;}
    const metricButton=event.target.closest('[data-bio-metric]');if(metricButton){state.ui.bioMetric=metricButton.dataset.bioMetric;scheduleRender();return;}
    const bodyDate=event.target.closest('[data-body-date]');if(bodyDate){state.ui.selectedBodyDate=bodyDate.dataset.bodyDate;scheduleRender();return;}
    const evolutionMetric=event.target.closest('[data-evolution-metric]');if(evolutionMetric){state.ui.evolutionMetric=evolutionMetric.dataset.evolutionMetric;scheduleRender();return;}
    const segmentDate=event.target.closest('[data-segmental-date]');if(segmentDate){state.ui.segmentalDate=segmentDate.dataset.segmentalDate;scheduleRender();return;}
    const nutritionDate=event.target.closest('[data-nutrition-date]');if(nutritionDate){state.ui.nutritionDate=nutritionDate.dataset.nutritionDate;scheduleRender();return;}
    const nutritionYear=event.target.closest('[data-nutrition-year]');if(nutritionYear){setGlobalPeriod('all');state.ui.nutritionYear=nutritionYear.dataset.nutritionYear;state.ui.nutritionDate=null;scheduleRender();return;}
    const workoutButton=event.target.closest('[data-workout]');if(workoutButton){const id=workoutButton.dataset.workout;state.ui.openWorkout=state.ui.openWorkout===id?null:id;scheduleRender();return;}
    const exerciseButton=event.target.closest('[data-exercise]');if(exerciseButton){state.ui.selectedExercise=exerciseButton.dataset.exercise;scheduleRender();return;}
    const markerButton=event.target.closest('[data-marker]');if(markerButton){state.ui.selectedBiomarker=markerButton.dataset.marker;scheduleRender();return;}
  });

  document.addEventListener('input',event=>{
    if(event.target.matches('[data-report-search]')){state.ui.reportLabQuery=event.target.value;state.ui.reportLabPage=1;scheduleRender();}
    if(event.target.id==='trainingQuery'){state.ui.trainingQuery=event.target.value;scheduleRender();}
    if(event.target.id==='exerciseQuery'){state.ui.exerciseQuery=event.target.value;scheduleRender();}
    if(event.target.id==='timelineQuery'){state.ui.timelineQuery=event.target.value;state.ui.timelineLimit=50;scheduleRender();}
    if(event.target.id==='labQuery'){state.ui.labQuery=event.target.value;scheduleRender();}
    if(event.target.id==='treatmentQuery'){state.ui.treatmentQuery=event.target.value;scheduleRender();}
  });

  document.addEventListener('change',event=>{
    if(event.target.id==='nutritionDateProduct'){state.ui.nutritionDate=event.target.value;render();return;}
    if(['reportNutritionSource','reviewWaterSource','reviewSleepSource','reportLabMarker'].includes(event.target.dataset?.homeField)){state.ui[event.target.dataset.homeField]=event.target.value;render();return;}
    const reportFields=new Set(['reportBodySource','reportSegmentSource','reportRegion','reportSegmentMetric','reportLabMarker','reportLabPoint','reportRecoverySource','reportNutritionSource','reviewWaterSource','reviewSleepSource','reviewDate']);
    if(reportFields.has(event.target.dataset?.reportField)){state.ui[event.target.dataset.reportField]=event.target.value;if(event.target.dataset.reportField==='reportLabMarker')state.ui.reportLabPoint=null;if(event.target.dataset.reportField==='reviewDate')state.ui.healthContextDate=event.target.value;scheduleRender();return;}
    if(event.target.id==='healthContextDate'){state.ui.healthContextDate=event.target.value;state.ui.reviewDate=event.target.value;scheduleRender();}
    if(event.target.id==='homeLabMarker'){state.ui.homeLabMarker=event.target.value;scheduleRender();}
    if(event.target.id==='trainingPeriod'){setGlobalPeriod(event.target.value);scheduleRender();}
    if(event.target.id==='analysisPeriod'){setGlobalPeriod(event.target.value);state.ui.reportLabPage=1;state.ui.reportLoadPage=1;state.ui.reviewDayPage=1;state.ui.reportLabPoint=null;scheduleRender();}
    if(event.target.id==='timelinePeriod'){
      state.ui.timelinePeriod=event.target.value;state.ui.timelineLimit=50;state.ui.timelineMonth=null;state.ui.timelineDate=null;
      if(event.target.value!=='all')state.ui.timelineYear=null;
      scheduleRender();
    }
    if(event.target.id==='timelineYear'){state.ui.timelineYear=event.target.value;state.ui.timelineMonth='all';state.ui.timelineDate=null;state.ui.timelineLimit=50;scheduleRender();}
    if(event.target.id==='timelineMonth'){state.ui.timelineMonth=event.target.value;state.ui.timelineDate=null;state.ui.timelineLimit=50;scheduleRender();}
    if(event.target.id==='timelineDate'){state.ui.timelineDate=event.target.value||null;state.ui.timelineLimit=50;scheduleRender();}
    if(event.target.id==='timelineDomain'){state.ui.timelineDomain=event.target.value;state.ui.timelineLimit=50;scheduleRender();}
    if(event.target.id==='nutritionPeriod'){setGlobalPeriod(event.target.value);state.ui.nutritionDate=null;scheduleRender();}
    if(event.target.id==='nutritionYear'){state.ui.nutritionYear=event.target.value;state.ui.nutritionDate=null;scheduleRender();}
    if(event.target.id==='compareA'){state.ui.compareA=event.target.value;scheduleRender();}
    if(event.target.id==='compareB'){state.ui.compareB=event.target.value;scheduleRender();}
    if(event.target.id==='segmentalCompareDate'){state.ui.segmentalCompareDate=event.target.value;scheduleRender();}
    if(event.target.id==='collectionSelect'){state.ui.selectedCollection=event.target.value;scheduleRender();}
    if(event.target.id==='dataUploadStatus'){state.ui.dataUploadStatus=event.target.value;scheduleRender();}
    if(event.target.id==='dataUploadSource'){state.ui.dataUploadSource=event.target.value;scheduleRender();}
  });

  document.addEventListener('submit',async event=>{
    if(event.target.id==='personalGoalsForm'){
      event.preventDefault();const form=event.target,button=form.querySelector('[type="submit"]'),msg=form.querySelector('#personalGoalsMessage');button.disabled=true;msg.textContent='Salvando metas…';
      try{await saveGoals(form);state.ui.personalGoalsMessage='Metas salvas. As comparações usam a versão vigente em cada data.';render();const details=document.querySelector('.ltsGoalSettings');if(details)details.open=true;}
      catch(error){msg.textContent=error.message;button.disabled=false;}return;
    }
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
      if(msg)msg.textContent=uploadOutcomeMessageFromState(result);
    }catch(error){
      console.warn('upload_refresh_failed',error);
      if(msg)msg.textContent=`${uploadOutcomeMessage(result)} A tela não pôde ser atualizada agora.`;
    }finally{if(button)button.disabled=false;}
  });

  $('loginBtn').addEventListener('click',doLogin);
  $('password').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
  $('refreshBtn').addEventListener('click',refresh);
  $('logoutBtn').addEventListener('click',async()=>{await signOut();resetPolarConnection();resetAutoExportConnection();state.loaded=false;state.data={};state.domainStatus={};showLogin();});
  $('closeMore').addEventListener('click',()=>$('moreSheet').classList.add('hidden'));
  $('moreSheet').addEventListener('click',e=>{if(e.target===$('moreSheet'))$('moreSheet').classList.add('hidden');});
  window.addEventListener('popstate',()=>setRoute(routeFromLocation()));
  window.addEventListener('hashchange',()=>{const route=routeFromLocation();if(route!==state.route)setRoute(route);});
  window.addEventListener('online',()=>setSync(state.loaded?'Online':'Conectado'));
  window.addEventListener('offline',()=>setSync('Sem conexão'));
}

async function boot(){
  bindStaticEvents();setupEntryController({onSaved:refresh});state.route=routeFromLocation();
  if(!fixtureMode)setGlobalPeriod('90');
  try{const session=await restoreSession();if(!session){showLogin();}else{showApp();setRoute(state.route);await loadInitialData(setSync);await ensureRouteData(state.route,setSync);scheduleRender();void updatePolarOnOpen();}}
  catch(error){console.error(error);showLogin('Não foi possível restaurar sua sessão.');}
  authSubscription=subscribeAuth(session=>{state.session=session;if(!session){resetPolarConnection();resetAutoExportConnection();state.loaded=false;state.data={};state.domainStatus={};showLogin();}});
}

window.addEventListener('beforeunload',()=>authSubscription?.unsubscribe?.());
boot();
