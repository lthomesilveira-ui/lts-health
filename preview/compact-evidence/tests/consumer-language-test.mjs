import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {makeConsumerLanguageFixture,LANGUAGE_TODAY,LANGUAGE_NOTE,LANGUAGE_ERROR,LANGUAGE_ROUTES,foodSourceKey,candidateSourceKey,consumerLanguageService} from './consumer-language-fixture.mjs';
import {htmlText,technicalMatches} from './consumer-language-html.mjs';
import {visibleTextGeometry,contrastRatio} from './consumer-language-geometry.mjs';
import {consumerRouteSettled,consumerDomainSettled} from './consumer-language-readiness.mjs';
import {healthDashboardModel} from '../src/health-dashboard-model.js';
import {nutritionArchiveModel} from '../src/nutrition-archive.js';

const NativeDate=Date;
globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[`${LANGUAGE_TODAY}T15:00:00Z`]));}static now(){return NativeDate.parse(`${LANGUAGE_TODAY}T15:00:00Z`);}};
globalThis.location={search:'?fixture=1'};
const {state}=await import('../src/core.js');
const {isRouteReady}=await import('../src/data-layer.js');
const renderers={hoje:(await import('../src/health-dashboard.js')).renderProductHomeReference,nutricao:(await import('../src/nutrition-product.js')).renderProductNutrition,timeline:(await import('../src/timeline-screen.js')).renderTimelineHub,treinos:(await import('../src/training-reference-v2.js')).renderProductTraining,saude:(await import('../src/labs-layout-v2.js')).renderProductLabs,tratamentos:(await import('../src/treatment-screen.js')).renderTreatmentHub,dados:(await import('../src/data-screen.js')).renderDataHub,bio:(await import('../src/composition-layout-v2.js')).renderProductComposition,evolucao:(await import('../src/evolution-screen.js')).renderEvolutionHub,analise:(await import('../src/recovery-layout-v2.js')).renderRecoveryDepth};
const initial=structuredClone(state.ui),inventory=[];
const renderUsefulReports=(await import('../src/reports-screen.js')).renderUsefulReports;
const label=date=>date.split('-').reverse().join('/');
const value=(number,digits=0)=>number.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits});
function setup(f,ui={}){state.data=f.data;state.domainStatus=f.status;state.errors={};state.ui={...initial,productLabPeriod:'all',timelinePeriod:'all',nutritionPeriod:'all',productLabMarker:'hemoglobina',...ui};}
function inspect(route,kind,html){const primary=htmlText(html),options=htmlText(html,{allOptions:true,optionsOnly:true});assert.deepEqual(technicalMatches(primary),[],`${kind}/${route}: primary language has no backend vocabulary`);assert.deepEqual(technicalMatches(options),[],`${kind}/${route}: all source/control options, including closed sections, have no backend vocabulary`);assert.doesNotMatch(primary,/\b(?:NaN|undefined|Infinity)\b/);inventory.push({route,kind,primary,options});return primary;}
assert.equal(htmlText('<p>Principal</p><details><summary>Abrir</summary><p>source_record_id</p></details>'),'Principal\nAbrir');
assert.match(htmlText('<details><summary>Abrir</summary><p>&lt;4 e 1,2345</p></details>',{expanded:true}),/<4 e 1,2345/);
assert.equal(htmlText('<details><summary>Abrir</summary><p>Nota original: payload</p><select><option>Origem A</option><option>Origem B</option></select></details>',{allOptions:true,optionsOnly:true}),'Origem A\nOrigem B');
const box=(nodeId,left,right,clips=[])=>({nodeId,text:`synthetic ${nodeId}`,rect:{left,right,top:10,bottom:20},clips});
const clipping={x:true,y:false,left:0,right:100};
assert.equal(visibleTextGeometry([box(1,0,150,[clipping]),box(1,0,90,[clipping]),box(2,110,140)],320).overlaps.length,0,'ellipsis does not overlap itself or paint its hidden tail over another node');
assert.equal(visibleTextGeometry([box(1,0,100),box(2,90,140)],320).overlaps.length,1,'distinct text really overlapping still fails');
const duplicateWord=box(2,90,140);duplicateWord.text='synthetic 1';
assert.equal(visibleTextGeometry([box(1,0,100),duplicateWord],320).overlaps.length,1,'identical wording from different DOM nodes cannot be deduplicated');
assert.equal(visibleTextGeometry([box(1,0,100),box(1,0,100)],320).visibleText.length,1,'only duplicate boxes of the same DOM node are removed');
assert.equal(visibleTextGeometry([box(1,300,350)],320).overflowingText.length,1,'unclipped text outside the viewport still fails');
assert.equal(visibleTextGeometry([box(1,300,350,[clipping])],320).visibleText.length,0,'offscreen scroll content is retained as clipped evidence, not counted as painted ink');
assert.equal(visibleTextGeometry([box(1,300,350,[clipping])],320).clippedText.length,1);
assert.equal(contrastRatio([0,0,0],[255,255,255]),21);
assert.ok(contrastRatio([240,170,170],[255,247,248])<4.5,'the previous light error text fails normal-text contrast');
const accessibility=readFileSync(new URL('../accessibility.css',import.meta.url),'utf8');
const bannerRules=[...accessibility.matchAll(/(body\[data-product-route="timeline"\][^{]+)\{([^}]+)\}/g)];
assert.equal(bannerRules.length,2);
for(const [index,[,selectors,declaration]] of bannerRules.entries()){
  const suffix=index?' span':'';
  assert.deepEqual(selectors.split(',').map(value=>value.trim()),['timeline','tratamentos'].map(route=>`body[data-product-route="${route}"] #screenHost .errorState${suffix}`),'contrast change is restricted to the two observed error banners');
  const hex=index?'654f56':'632e36';assert.equal(declaration,`color:#${hex}`,'contrast patch changes color only, never geometry or visibility');
  const rgb=hex.match(/../g).map(value=>parseInt(value,16));assert.ok(contrastRatio(rgb,[255,247,248])>=4.5);
}
assert.ok(consumerLanguageService({}).includes(LANGUAGE_ERROR),'synthetic SQL failure is actually injected into the replacement SDK');
// The initial loader clears state.loading before lazy route domains settle.
// A failed meal request must not make the remaining loading domains look ready.
const previousLoad={loaded:state.loaded,loading:state.loading,status:state.domainStatus};
state.loaded=true;state.loading=false;state.domainStatus={nutrition:'loading',meals:'error',sourceMetrics:'ready',goals:'ready',waterReferences:'ready',nutritionPlans:'ready'};
assert.equal(isRouteReady('nutricao'),false,'route remains pending after one request fails while another still loads');
state.domainStatus.nutrition='ready';assert.equal(isRouteReady('nutricao'),true,'settled error is a displayable route, not an endless loading state');
state.loaded=previousLoad.loaded;state.loading=previousLoad.loading;state.domainStatus=previousLoad.status;
// Guard the actual functions serialized into Playwright, including the exact
// false/false/true polling sequence. No browser or socket is needed for this.
const savedGlobals={window:globalThis.window,document:globalThis.document,location:globalThis.location};
const syntheticRoot={},oldRoot={},mockState={loaded:true,loading:false,route:'nutricao',domainStatus:{meals:'loading'}};
let routeReady=false,loadingNode=null;
globalThis.window={__languageApp:{state:mockState,isRouteReady:()=>routeReady},__languageBeforeRefreshRoot:oldRoot};
globalThis.document={querySelector:selector=>selector==='#screenHost .loadingState'?loadingNode:syntheticRoot};
globalThis.location={hash:'#nutricao'};
const predicateArgs={route:'nutricao',selector:'.ltsNutritionProduct',afterRefresh:true};
assert.equal(consumerRouteSettled.constructor.name,'Function');assert.equal(consumerDomainSettled.constructor.name,'Function');
assert.equal(consumerDomainSettled({domain:'meals',status:'error'}),false);
mockState.domainStatus.meals='error';assert.equal(consumerDomainSettled({domain:'meals',status:'error'}),true);
assert.equal(consumerRouteSettled(predicateArgs),false,'settled domain does not imply settled route');
routeReady=true;
assert.equal(consumerRouteSettled(predicateArgs),false);assert.equal(consumerRouteSettled(predicateArgs),false);assert.equal(consumerRouteSettled(predicateArgs),true,'only the third real polling call succeeds');
window.__languageBeforeRefreshRoot=syntheticRoot;assert.equal(consumerRouteSettled(predicateArgs),false,'old root never qualifies after refresh');
window.__languageBeforeRefreshRoot=oldRoot;loadingNode={};assert.equal(consumerRouteSettled(predicateArgs),false,'loading view cannot be accepted as an error state');
for(const [key,value] of Object.entries(savedGlobals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
const workflow=readFileSync(new URL('../../../.github/workflows/health-compact-preview.yml',import.meta.url),'utf8');
const workflowScripts=[...workflow.matchAll(/\brun:\s*node\s+(preview\/compact-evidence\/tests\/[\w-]+\.mjs)/g)].map(match=>match[1]);
assert.ok(workflowScripts.some(path=>path.endsWith('consumer-language-browser.mjs')));
for(const path of workflowScripts)assert.doesNotMatch(readFileSync(new URL(`../../../${path}`,import.meta.url),'utf8'),/\bwaitForFunction\s*\(\s*async\b/,`${path}: Promise predicates bypass Playwright polling; import first, then poll synchronously`);

for(const kind of ['complete','partial','empty','conflict']){
  const f=makeConsumerLanguageFixture(kind),before=structuredClone(f.data);
  for(const route of LANGUAGE_ROUTES){setup(f);const html=renderers[route](),primary=inspect(route,kind,html);assert.deepEqual(f.data,before,`${kind}/${route}: rendering never changes original records`);if(kind==='empty')assert.match(primary,/sem|nenhum|ainda n[aã]o|n[aã]o h[aá]/i);}
  setup(f,{productTrainingView:'exercises'});inspect('treinos-exercises',kind,renderers.treinos());
  setup(f,{productTrainingView:'history'});inspect('treinos-history',kind,renderers.treinos());
  setup(f,{dashboardMode:'day'});inspect('hoje-day',kind,renderers.hoje());
  // fixtureMode selects the legacy Analysis wrapper. Check the production
  // report renderer separately; browser QA still verifies actual startup.
  setup(f);inspect('analise-production-report',kind,renderUsefulReports());
}

const f=makeConsumerLanguageFixture(),before=structuredClone(f.data);
setup(f);let html=renderers.hoje(),primary=htmlText(html),all=htmlText(html,{expanded:true});
assert.equal((html.match(/data-dashboard-card=/g)||[]).length,7,'approved seven-card layout remains present');
const dashboard=healthDashboardModel(f.data,f.status,{},LANGUAGE_TODAY);
for(const metric of dashboard.metrics){assert.ok(primary.includes(`${metric.count}/${dashboard.bounds.days}`),`${metric.key}: n/N coverage stays visible`);assert.ok(html.includes(`<strong>${value(metric.value,metric.key==='sleep'?1:0)}</strong>`),`${metric.key}: numeric value is preserved`);}
assert.ok(primary.includes(label(dashboard.bounds.start))&&primary.includes(label(dashboard.bounds.end)),'selected calendar is visible');
assert.ok(all.includes('<4 g/dL')&&all.includes('1,2345 g/dL'),'censored and exact original lab values remain readable in detailed history');
assert.match(all,/Início de uso não informado|início.*não.*informado/i,'document receipt is not treatment start');
assert.ok(all.includes(LANGUAGE_NOTE));assert.ok(!primary.includes(LANGUAGE_NOTE),'original documentary notes are preserved under expansion');
assert.doesNotMatch(primary,/(?:[↑↓]|Diferença registrada:).*3[,.]7655/,'censored lab result cannot become exact comparison');
setup(f,{productTrainingView:'exercises'});html=renderers.treinos();assert.ok(htmlText(html,{expanded:true}).includes(LANGUAGE_NOTE),'original exercise and set notes remain intact');assert.ok(!htmlText(html).includes(LANGUAGE_NOTE));assert.match(htmlText(html),/42,5|42\.5/);assert.match(htmlText(html),/8 \+ 2 assistidas/,'raw repetition qualification is not converted to numeric reps');
setup(f,{homeNutritionSource:foodSourceKey('Synthetic A food'),nutritionDate:f.date(1)});html=renderers.nutricao();primary=htmlText(html);all=htmlText(html,{expanded:true});assert.match(primary,/2\.010 kcal/,'daily total remains independent from the meal total');assert.match(primary,/0 g/,'literal zero fiber remains a value');assert.match(primary,/424 kcal/,'existing meal rounding is unchanged');assert.equal(f.data.meals[0].calories_kcal,423.75,'fractional original is not rewritten by display rounding');assert.ok(all.includes(LANGUAGE_NOTE));
for(const status of ['candidate','held']){
  const ui={homeNutritionSource:candidateSourceKey(status),nutritionDate:f.date(1),dashboardMode:'day',dashboardDate:f.date(1),dashboardSources:{energy:candidateSourceKey(status),protein:candidateSourceKey(status)}};
  setup(f,ui);const archive=nutritionArchiveModel(f.data,f.status,ui,LANGUAGE_TODAY);assert.equal(archive.source.status,status);assert.equal(archive.source.key,candidateSourceKey(status));assert.deepEqual(archive.meals,[],'unreviewed source never inherits confirmed meals');
  primary=inspect('nutricao',status,renderers.nutricao());assert.match(primary,/revis[aã]o|confer[eê]ncia|n[aã]o confirmad|n[aã]o comparad/i,'human warning remains visible for unreviewed values');
  const m=healthDashboardModel(f.data,f.status,ui,LANGUAGE_TODAY);assert.equal(m.metricsByKey.energy.source.status,status);assert.equal(m.metricsByKey.energy.source.key,candidateSourceKey(status));const home=renderers.hoje();primary=inspect('hoje',status,home);const selectedCard=home.match(/<article[^>]+data-dashboard-card="energy"[^>]*>([\s\S]*?)<\/article>/)?.[1];assert.ok(selectedCard);assert.match(htmlText(selectedCard),/adicional|limita|confer|confirma|revis/i,'each selected candidate or held metric has its own visible qualification');
}
setup(f);html=renderers.dados();assert.ok(!htmlText(html).includes(LANGUAGE_ERROR));assert.ok(htmlText(html,{expanded:true}).includes(LANGUAGE_ERROR),'technical quality original remains under diagnostic expansion');
const conflict=makeConsumerLanguageFixture('conflict');setup(conflict,{dashboardMode:'day',dashboardDate:conflict.date(1),homeNutritionSource:foodSourceKey('Synthetic A food'),nutritionDate:conflict.date(1),dashboardSources:{water:JSON.stringify(['nutrition','synthetic a food','canonical','ml']),energy:foodSourceKey('Synthetic A food')}});
const conflictModel=healthDashboardModel(conflict.data,conflict.status,state.ui,LANGUAGE_TODAY);assert.equal(conflictModel.metricsByKey.water.value,null);assert.equal(conflictModel.metricsByKey.energy.value,null);primary=inspect('hoje','selected-conflict',renderers.hoje());assert.match(primary,/diferentes|conflit|repetid|diverg/i,'conflict cannot be silently hidden');
const archive=nutritionArchiveModel(conflict.data,conflict.status,state.ui,LANGUAGE_TODAY);assert.equal(archive.food,null);html=renderers.nutricao();primary=inspect('nutricao','selected-conflict',html);assert.match(primary,/diferentes|conflit|repetid|diverg/i);assert.ok(htmlText(html,{expanded:true}).includes('6666'),'both conflicting originals are available, not selected or summed');

const failed=makeConsumerLanguageFixture();failed.status=Object.fromEntries(Object.keys(failed.status).map(key=>[key,'error']));
for(const route of LANGUAGE_ROUTES){setup(failed);state.errors=Object.fromEntries(Object.keys(failed.status).map(key=>[key,LANGUAGE_ERROR]));primary=inspect(route,'failed-refresh',renderers[route]());assert.match(primary,/n[aã]o.*carreg|indispon[ií]v|atualiz|parcial|n[aã]o.*poss[ií]vel/i);assert.ok(!primary.includes(LANGUAGE_ERROR));assert.ok(Object.values(state.errors).every(error=>error===LANGUAGE_ERROR),'diagnostics remain available internally, not erased');}
setup(failed);inspect('analise-production-report','failed-refresh',renderUsefulReports());
assert.deepEqual(f.data,before,'consumer language never mutates synthetic source records');
if(process.env.LTS_CONSUMER_LANGUAGE_EVIDENCE_DIR){mkdirSync(process.env.LTS_CONSUMER_LANGUAGE_EVIDENCE_DIR,{recursive:true});writeFileSync(`${process.env.LTS_CONSUMER_LANGUAGE_EVIDENCE_DIR}/render-inventory.json`,JSON.stringify({syntheticOnly:true,fixedDate:LANGUAGE_TODAY,inventory},null,2));}
globalThis.Date=NativeDate;
console.log(`Consumer language: ${inventory.length} synthetic rendered cases; clinical originals, documentary notes, candidate/held identities, conflicts, n/N coverage and refresh errors preserved.`);
