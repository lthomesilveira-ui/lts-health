import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const index=read('./index.html');
const main=read('./src/main.js');
const runtime=read('./src/product-layout-runtime.js');
const home=read('./src/home-reference.js');
const homeCss=read('./home-reference.css');
const training=read('./src/training-reference-v2.js');
const trainingCss=read('./training-reference-v2.css');
const internalCss=read('./public-audit-remediation.css');
const core=read('./src/core.js');
const timeline=read('./src/timeline-screen.js');
const analysis=read('./src/analysis-screen.js');
const evolution=read('./src/evolution-screen.js');
const realAuth=read('./real-auth-e2e.mjs');
const realAuthDepth=read('./real-auth-depth-checks.mjs');

assert.match(index,/name="lts-build" content="ux-coherence-route-render-stability-20260915\.24"/);
for(const asset of ['home-reference.css','training-reference-v2.css','public-audit-remediation.css']){
  assert.ok(index.includes(`./${asset}?v=ux-coherence-route-render-stability-20260915.24`),`${asset} is not tied to the audited build`);
}
for(const retired of ['training-reference.css','visual-convergence-20260914.css','reference-parity-20260914.css']){
  assert.ok(!index.includes(`href="./${retired}`),`${retired} is still active in the public document`);
}
assert.ok(!index.includes('src="./src/training-reference-runtime.js'),'training-reference-runtime.js is still active in the public document');

assert.match(main,/fixtureMode\?legacyScreenRenderers:\{\.\.\.legacyScreenRenderers,bio:renderProductComposition,treinos:renderProductTraining,analise:renderRecoveryDepth,saude:renderProductLabs,hoje:renderProductHomeReference\}/);
assert.doesNotMatch(main,/state\.route==='nutricao'\|\|state\.route==='hoje'/);
assert.match(runtime,/from '\.\/training-reference-v2\.js'/);
assert.doesNotMatch(runtime,/from '\.\/product-layout-v2\.js'/);
assert.match(runtime,/treinos:'\.ltsTrainingReference'/);

assert.match(home,/Disciplina hoje, evolução sempre\./);
assert.match(home,/metric\('Massa magra'/);
assert.match(home,/class="ltsRefCoreGrid">\$\{todayCard\}\$\{progressCard\}<\/div>\$\{panorama\(model\)\}\$\{changes\(model,rows\)\}/);
assert.doesNotMatch(home,/integrityStyle|lts-home-information-integrity/);
assert.match(home,/weight-fatMass/);
assert.match(homeCss,/\.ltsRefCoreGrid\s*\{/);

assert.match(training,/ltsRefTrainTabs ltsRefTrainPrimaryTabs/);
assert.match(trainingCss,/\.ltsRefExerciseCard\s*\{[^}]*display:\s*block;/s);
assert.match(trainingCss,/\.ltsRefExercisePreview\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/s);
assert.match(trainingCss,/data-training-view="exercise"\] \.ltsRefTrainPrimaryTabs/);

assert.match(core,/timelineLimit:\s*50/);
assert.match(timeline,/timelineLimit\|\|50/);
assert.match(timeline,/Math\.min\(50,matching\.length-filtered\.length\)/);
assert.match(analysis,/option value="365"\$\{selected\('365'\)\}/);
assert.match(evolution,/grid cols2 sectionGap evolutionLowerGrid/);

for(const selector of ['.timelineContextCard','.protocolSummaryCard','.reviewInbox','.analysisDigestCard']){
  assert.ok(internalCss.includes(selector),`audited readability reset is missing ${selector}`);
}
for(const selector of ['body[data-product-route="nutricao"] .nutritionMonthHead b','body[data-product-route="nutricao"] .nutritionDays small','body[data-product-route="evolucao"] [data-evolution-metric]','body[data-product-route="evolucao"] .changeRow','.topActionIcon']){
  assert.ok(internalCss.includes(selector),`internal legibility contract is missing ${selector}`);
}
assert.match(internalCss,/body:has\(\.ltsHomeReference\) \.topbar #routeAction,[\s\S]*body\[data-product-route="nutricao"\] \.topbar #routeAction\s*\{[^}]*display:\s*none !important;/s);
assert.match(internalCss,/body\[data-product-route="evolucao"\] \.evolutionLowerGrid\s*\{[^}]*align-items:\s*start;/s);
assert.match(realAuth,/locator\('\.nutritionDays'\)\.scrollIntoViewIfNeeded\(\)/);
assert.doesNotMatch(realAuth,/locator\('\.nutritionMonth'\)(?:\.first\(\))?\.scrollIntoViewIfNeeded\(\)/);
assert.match(realAuth,/document\.body\.dataset\.productRoute===value/);
assert.match(realAuth,/mobileButtons\.length===5/);
assert.match(realAuth,/page\.locator\(direct\)\.click\(\)/);
assert.match(realAuth,/page\.locator\(more\)\.click\(\)/);
assert.match(realAuth,/#moreSheet:not\(\.hidden\)/);
assert.doesNotMatch(realAuth,/page\.evaluate\(value=>\{location\.hash=/);
assert.match(realAuth,/dados:'\[data-review-inbox\]'/);
assert.match(realAuth,/Boolean\(document\.querySelector\(readySelector\)\)/);
assert.match(realAuth,/!document\.querySelector\('#screenHost \.loadingState'\)/);
assert.match(realAuth,/assertStableMobileShell\('mobile Timeline'\)/);
assert.match(realAuth,/desktop-evolution-lower\.png/);
assert.match(realAuthDepth,/const goto=async\(route,selector\)=>\{await waitForRoute\(route\)/);
assert.match(index,/id="refreshBtn" aria-label="Atualizar dados"[^>]*><svg class="topActionIcon"/);
assert.match(index,/id="logoutBtn" aria-label="Sair do LTS Health"[^>]*><svg class="topActionIcon"/);

const canonicalSizes=[...`${homeCss}\n${trainingCss}`.matchAll(/font-size:\s*([0-9.]+)px/g)].map(match=>Number(match[1]));
assert.ok(canonicalSizes.length>30,'canonical responsive typography was not found');
assert.ok(Math.min(...canonicalSizes)>=9.5,`canonical Home/Training contains type below 9.5px: ${Math.min(...canonicalSizes)}px`);

console.log('LTS Health public-audit contract smoke passed');
