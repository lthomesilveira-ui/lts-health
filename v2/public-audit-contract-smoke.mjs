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

assert.match(index,/name="lts-build" content="ux-coherence-public-audit-20260915\.19"/);
for(const asset of ['home-reference.css','training-reference-v2.css','public-audit-remediation.css']){
  assert.ok(index.includes(`./${asset}?v=ux-coherence-public-audit-20260915.19`),`${asset} is not tied to the audited build`);
}
for(const retired of ['training-reference.css','visual-convergence-20260914.css','reference-parity-20260914.css']){
  assert.ok(!index.includes(`href="./${retired}`),`${retired} is still active in the public document`);
}
assert.ok(!index.includes('src="./src/training-reference-runtime.js'),'training-reference-runtime.js is still active in the public document');

assert.match(main,/fixtureMode\?legacyScreenRenderers:\{\.\.\.legacyScreenRenderers,bio:renderProductComposition,treinos:renderProductTraining,analise:renderRecoveryDepth,saude:renderProductLabs,hoje:renderProductHomeReference\}/);
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

for(const selector of ['.timelineContextCard','.protocolSummaryCard','.reviewInbox','.analysisDigestCard']){
  assert.ok(internalCss.includes(selector),`audited readability reset is missing ${selector}`);
}

const canonicalSizes=[...`${homeCss}\n${trainingCss}`.matchAll(/font-size:\s*([0-9.]+)px/g)].map(match=>Number(match[1]));
assert.ok(canonicalSizes.length>30,'canonical responsive typography was not found');
assert.ok(Math.min(...canonicalSizes)>=9.5,`canonical Home/Training contains type below 9.5px: ${Math.min(...canonicalSizes)}px`);

console.log('LTS Health public-audit contract smoke passed');
