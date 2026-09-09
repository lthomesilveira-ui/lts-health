import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFile(new URL(path,root),'utf8');
const files=['today-screen','training-screen','nutrition-screen','bio-screen','health-screen','analysis-screen'];
const [index,core,main,css,contract,browserGate,rawState,...screens]=await Promise.all([
  read('v2/index.html'),read('v2/src/core.js'),read('v2/src/main.js'),read('v2/ux-coherence.css'),read('v2/UX_COHERENCE_CONTRACT.md'),read('v2/ux-coherence-browser-smoke.mjs'),read('v2/EXECUTION_STATE.json'),...files.map(file=>read(`v2/src/${file}.js`))
]);
const state=JSON.parse(rawState),screenText=screens.join('\n');

assert.match(index,/lts-build" content="ux-coherence-/);
assert.match(index,/ux-coherence\.css\?v=ux-coherence-/);
assert.match(index,/main\.js\?v=ux-coherence-/);
assert.doesNotMatch(index,/longitudinal-story/);
assert.match(core,/export function setGlobalPeriod/);
assert.match(main,/function resetRouteScroll\(\)/);
assert.match(main,/host\?\.scrollTo\(\{top:0,left:0,behavior:'auto'\}\)/);
assert.match(main,/requestAnimationFrame\(\(\)=>\{reset\(\);requestAnimationFrame\(reset\);\}\)/);
for(const target of ['analysisPeriod','trainingPeriod','nutritionPeriod'])assert.match(core,new RegExp(`state\\.ui\\.${target}=next`));
for(const id of ['trainingPeriod','analysisPeriod','nutritionPeriod'])assert.match(main,new RegExp(`id==='${id}'[^\n]+setGlobalPeriod`));

for(const file of ['training-screen','nutrition-screen']){
  const source=screens[files.indexOf(file)];
  assert.match(source,/state\.ui\.analysisPeriod/);
  assert.match(source,/periodBounds\((?:period|p),referenceDayFor\(state\.data\)\)/);
  assert.match(source,/domainHero/);
  assert.match(source,/uxDisclosure/);
}
for(const file of ['bio-screen','health-screen','analysis-screen']){
  const source=screens[files.indexOf(file)];
  assert.match(source,/domainHero/);
  assert.match(source,/uxDisclosure/);
}

for(const forbidden of ['sessão(ões)','dia(s)','resultado(s)','origem(ns)','medição(ões)','registro(s)','item(ns)','numérico(s)','textual(is)'])assert.ok(!screenText.includes(forbidden),`mechanical copy returned: ${forbidden}`);
assert.match(css,/\.domainHero/);
assert.match(css,/\.domainStatStrip/);
assert.match(css,/\.uxDisclosure/);
assert.match(css,/--surface:#fff/);
assert.match(css,/\.uxDisclosure\{[^}]*background:#fff/);
for(const legacyDark of ['#0a151e','rgba(10,21,30','.domainHero{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;padding:24px 26px;border:1px solid rgba(36,199,217'])assert.ok(!css.includes(legacyDark),`legacy dark surface returned: ${legacyDark}`);
assert.match(css,/@media\(max-width:720px\)/);
assert.match(css,/min-height:44px/);
assert.match(css,/overflow-x:auto/);
assert.match(css,/\.topbar\{position:relative;top:auto;grid-row:1/);
assert.match(css,/\.screenHost\{grid-row:2;/);
assert.match(css,/overflow-anchor:none/);
assert.match(css,/\.mobileNav\{position:relative;inset:auto;grid-row:3\}/);
assert.match(main,/if\(routeChanged\)settleRouteScroll\(state\.route\)/);
assert.match(browserGate,/async function captureFreshRoute/);
assert.match(browserGate,/const browser=await chromium\.launch\(launchOptions\)/);
assert.match(browserGate,/layout-evidence\.json/);
assert.match(browserGate,/eyebrowHit/);
assert.match(contract,/Uma janela do produto/);
assert.match(contract,/Um estado vazio/);
assert.match(contract,/Mobile como produto/);
assert.match(contract,/Contraste verificável/);
assert.match(contract,/Uma arquitetura ativa/);

const task=state.tasks.find(item=>item.id==='LTS-UX-COHERENCE-001');
assert.ok(task);
assert.equal(task.status,'done');
const executiveDensity=state.tasks.find(item=>item.id==='LTS-UX-DENSITY-002');
assert.ok(executiveDensity);
assert.ok(['in_progress','done'].includes(executiveDensity.status));
assert.equal(state.current_package.id,'PKG-EXECUTIVE-DENSITY-002');
assert.deepEqual(state.current_package.task_ids,[executiveDensity.id]);

console.log('LTS Health UX coherence contract passed');
