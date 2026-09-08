import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFile(new URL(path,root),'utf8');
const [architecture,feedback,index,today,homeCss,shellCss,productShell,analysisScreen,healthScreen,dataScreen,evolutionScreen,stateRaw]=await Promise.all([
  read('v2/PRODUCT_ARCHITECTURE.md'),
  read('v2/FEEDBACK_LEDGER.md'),
  read('v2/index.html'),
  read('v2/src/today-screen.js'),
  read('v2/cockpit.css'),
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
assert.ok(build,'public build identifier is missing');
for(const asset of ['executive-shell.css','cockpit.css'])assert.ok(index.includes(`./${asset}?v=${build}`),`canonical asset is not tied to build ${build}: ${asset}`);

for(const phrase of [
  'assistente longitudinal privado de saúde',
  'o que está documentado agora',
  'o que mudou no período',
  'quão completa e confiável é essa leitura',
  'Leitura e prioridades',
  'CI verde comprova regressões técnicas cobertas'
])assert.match(architecture,new RegExp(phrase,'i'),`architecture missing: ${phrase}`);

for(const id of Array.from({length:15},(_,index)=>`FB-${String(index+1).padStart(3,'0')}`))assert.match(feedback,new RegExp(`\\| ${id} \\|`),`feedback missing: ${id}`);
for(const debt of ['D-001','D-002','D-003','D-004','D-005','D-006'])assert.match(feedback,new RegExp(`\\| ${debt} \\|`),`debt missing: ${debt}`);
assert.match(feedback,/Nenhuma alegação antiga de “10\/10” substitui feedback posterior/);

for(const legacy of ['dashboard-parity.css','dashboard-reference-contract.css','executive-cockpit.js','dashboard-reference-runtime.js'])assert.ok(!index.includes(legacy),`legacy presentation layer still active: ${legacy}`);
for(const group of ['Acompanhar','Áreas','Contexto','Sistema'])assert.match(index,new RegExp(`navGroupLabel[^>]*>${group}<`),`navigation group missing: ${group}`);
assert.ok(!index.includes('data-route="evolucao">Evolução</button>'),'Evolução remains a competing primary destination');
assert.match(index,/data-route="evolucao">Evolução detalhada<\/button>/);

for(const action of ['Abrir detalhes','Abrir análise integrada','Gerenciar fontes','Abrir Timeline'])assert.match(today,new RegExp(action),`specific action missing: ${action}`);
assert.ok(!today.includes("textContent='Ver mais"),'generic postprocessed actions returned');
for(const surface of ['cockpitStatusGrid','cockpitWorkspace','cockpitTrend','cockpitWindowBrief','cockpitLowerGrid','cockpitRecent'])assert.match(today,new RegExp(surface),`home product surface missing: ${surface}`);
assert.match(today,/data-home-metric/,'interactive longitudinal metric selector is missing');
assert.match(today,/\['weight','Peso'\].*\['water','Água'\]/s,'longitudinal domains are not represented in the main chart');
assert.match(today,/slice\(0,3\)/,'review priorities are not bounded');
assert.match(today,/Trazer histórico de água do MFP/);

assert.match(homeCss,/\.cockpitWelcome p\{[^}]*font-size:15px/);
assert.match(homeCss,/\.cockpitStatusText small\{[^}]*font-size:14px/);
assert.match(homeCss,/\.cockpitTrendTabs button\{[^}]*font-size:13px/);
assert.match(homeCss,/scroll-snap-type:x proximity/,'mobile domain rail is not intentionally horizontal');
assert.match(homeCss,/body:has\(\.cockpitV3\) \.topActions #routeAction\{display:none!important\}/);
assert.match(shellCss,/grid-template-columns:244px minmax\(0,1fr\)/);
assert.match(shellCss,/body:has\(#login:not\(\.hidden\)\) #app\{display:none!important\}/);
assert.match(productShell,/domainHomeAction/);
assert.match(productShell,/Voltar à visão geral/);
for(const [screen,title]of [[analysisScreen,'Recuperação & análises'],[healthScreen,'Exames'],[dataScreen,'Dados & fontes'],[evolutionScreen,'Evolução detalhada']])assert.match(screen,new RegExp(title.replace('&','&')),`destination title is not aligned: ${title}`);

for(const document of ['product_architecture','feedback_ledger'])assert.ok(state.authoritative_documents?.[document],`execution state does not point to ${document}`);
console.log('LTS Health product architecture contract passed');
