import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFile(new URL(path,root),'utf8');
const [architecture,feedback,index,home,homeCss,shellCss,productShell,analysisScreen,healthScreen,dataScreen,evolutionScreen,stateRaw]=await Promise.all([
  read('v2/PRODUCT_ARCHITECTURE.md'),
  read('v2/FEEDBACK_LEDGER.md'),
  read('v2/index.html'),
  read('v2/src/home-reference.js'),
  read('v2/home-reference.css'),
  read('v2/executive-shell.css'),
  read('v2/src/product-shell.js'),
  read('v2/src/analysis-screen.js'),
  read('v2/src/health-screen.js'),
  read('v2/src/data-screen.js'),
  read('v2/src/evolution-screen.js'),
  read('v2/EXECUTION_STATE.json')
]);
const state=JSON.parse(stateRaw);
const build=index.match(/<meta name="lts-build" content="([^"]+)">/)?.[1];
const experienceCss=await read('v2/product-experience.css');
assert.ok(index.includes(`./product-experience.css?v=${build}`),'responsive product stylesheet must match the active build');
assert.match(experienceCss,/\.ltsExecutiveCards\{[^}]*grid-template-columns:repeat\(5/);
assert.match(experienceCss,/\.ltsCockpitGrid\{[^}]*grid-template-columns:repeat\(3/);
assert.match(home,/data-disclosure="home-history"/);
assert.match(home,/renderHomeCockpit\(c\)/);
assert.ok(build,'public build identifier is missing');
for(const asset of ['executive-shell.css','cockpit.css','home-reference.css'])assert.ok(index.includes(`./${asset}?v=${build}`),`canonical asset is not tied to build ${build}: ${asset}`);

for(const phrase of [
  'assistente longitudinal privado de saúde',
  'o que está documentado agora',
  'o que mudou no período',
  'quão completa e confiável é essa leitura',
  'Evolução longitudinal',
  'CI verde comprova regressões técnicas cobertas'
])assert.match(architecture,new RegExp(phrase,'i'),`architecture missing: ${phrase}`);

for(const id of Array.from({length:15},(_,index)=>`FB-${String(index+1).padStart(3,'0')}`))assert.match(feedback,new RegExp(`\\| ${id} \\|`),`feedback missing: ${id}`);
for(const debt of ['D-001','D-002','D-003','D-004','D-005','D-006'])assert.match(feedback,new RegExp(`\\| ${debt} \\|`),`debt missing: ${debt}`);
assert.match(feedback,/Nenhuma alegação antiga de “10\/10” substitui feedback posterior/);

for(const legacy of ['dashboard-parity.css','dashboard-reference-contract.css','executive-cockpit.js','dashboard-reference-runtime.js'])assert.ok(!index.includes(legacy),`legacy presentation layer still active: ${legacy}`);
for(const group of ['Acompanhar','Áreas','Contexto','Sistema'])assert.match(index,new RegExp(`navGroupLabel[^>]*>${group}<`),`navigation group missing: ${group}`);
assert.ok(!index.includes('data-route="evolucao">Evolução</button>'),'Evolução remains a competing primary destination');
assert.match(index,/data-route="evolucao">Evolução detalhada<\/button>/);

const cockpit=await read('v2/src/home-cockpit.js'),evolutionCss=await read('v2/evolution-product.css');
assert.match(home,/data-home-period/);assert.match(home,/ltsEvolutionHome/);assert.match(home,/renderHealthContext/);
for(const phrase of ['Gordura, músculo e peso','Progressão no treino','Consumo e plano alimentar','Água consumida','Sono em contexto','Evolução dos exames','Preparar resumo de consulta'])assert.ok(cockpit.includes(phrase),phrase);
assert.match(cockpit,/data-home-body-metric/);assert.match(cockpit,/data-home-goals/);assert.doesNotMatch(cockpit,/ltsRefRing|ltsReviewOverlap/);
assert.match(evolutionCss,/repeat\(5/);assert.match(evolutionCss,/repeat\(3/);assert.match(evolutionCss,/ltsDesktopCockpit\{display:block!important/);
assert.match(evolutionCss,/background:#f4f7fb!important/);assert.match(evolutionCss,/@media\(max-width:840px\)/);
assert.match(shellCss,/grid-template-columns:244px minmax\(0,1fr\)/);
assert.match(shellCss,/body:has\(#login:not\(\.hidden\)\) #app\{display:none!important\}/);
assert.match(productShell,/domainHomeAction/);
assert.match(productShell,/Voltar à visão geral/);
for(const [screen,title]of [[analysisScreen,'Recuperação & análises'],[healthScreen,'Exames'],[dataScreen,'Dados & fontes'],[evolutionScreen,'Evolução detalhada']])assert.match(screen,new RegExp(title.replace('&','&')),`destination title is not aligned: ${title}`);

for(const document of ['product_architecture','feedback_ledger'])assert.ok(state.authoritative_documents?.[document],`execution state does not point to ${document}`);
console.log('LTS Health product architecture contract passed');
