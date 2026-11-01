import assert from 'node:assert/strict';
import {labAccessRows} from './lab-history-access-fixture.mjs';
globalThis.location={search:'?fixture=1'};
const {state}=await import('../src/core.js');
const {labsModel,renderProductLabs,labCohortComparison}=await import('../src/labs-layout-v2.js');
state.data={labs:labAccessRows()};state.domainStatus={labs:'ready'};state.errors={};state.ui={homePeriod:'7',productLabMarker:'marcador sintetico 01'};
const original=structuredClone(state.data);
let model=labsModel();
assert.equal(model.period,'all');assert.equal(model.rows.length,828,'full history has no 809-row/display cap');
assert.equal(model.groups.length,34);assert.equal(model.history.total,27,'history retains foreign source/unit');
const cohort=model.item.cohorts.find(c=>c.origin==='Laboratório sintético A'&&c.unit==='u/L');
assert.equal(cohort.rows.length,25);assert.equal(labCohortComparison(cohort).comparable,true);
state.ui.productLabCohort=cohort.key;
let html=renderProductLabs();
const positions=['id="productLabQuery"','id="productLabMarkerSelect"','id="productLabsTrend"','id="productLabsHistory"','id="productLabsCollection"'].map(x=>html.indexOf(x));
assert.ok(positions.every((p,i)=>p>=0&&(!i||p>positions[i-1])),'search/select/graph/history precede long collection panels');
for(const id of ['productLabsTrend','productLabsHistory','productLabsCollection'])assert.ok(html.includes(`data-ux-scroll="${id}"`));
assert.match(html,/Período de Exames/);assert.match(html,/independente da Visão geral/);assert.doesNotMatch(html,/mesma janela selecionada|período global/);
assert.match(html,/828 resultados/);assert.match(html,/data-lab-history-total="27"/);
assert.equal(state.ui.homePeriod,'7');
state.ui.homePeriod='90';assert.equal(labsModel().rows.length,828,'changing Home alone leaves laboratory history open');
state.ui.productLabPeriod='30';model=labsModel();assert.equal(model.item,null);assert.match(renderProductLabs(),/Nenhum resultado laboratorial nesta janela/);assert.equal(state.ui.homePeriod,'90');
state.ui.productLabPeriod='all';state.ui.productLabQuery='textual';model=labsModel();assert.equal(model.matches.length,1);assert.equal(model.matches[0].label,'Marcador textual sintético');
state.ui.productLabMarker=model.matches[0].key;state.ui.productLabCohort=null;model=labsModel();assert.equal(model.recent.length,0);assert.match(renderProductLabs(),/Não reagente/,'text results remain available without manufacturing graph values');
state.ui.productLabQuery='';state.ui.productLabMarker='marcador sintetico 01';state.ui.productLabAsOf='2024-01-12';model=labsModel();
assert.equal(model.asOf,'2024-01-12');assert.equal(model.bounds.end,'2024-01-12');assert.equal(model.history.total,12);assert.ok(model.rows.every(r=>r.collection_date<='2024-01-12'));
assert.match(renderProductLabs(),/data-lab-clear-asof/);assert.match(renderProductLabs(),/corte da leitura selecionada/);
state.ui.productLabAsOf=null;state.ui.productLabPage=3;model=labsModel();assert.equal(model.history.rows.length,7,'older records remain reachable through existing pagination');
state.domainStatus.labs='error';assert.match(renderProductLabs(),/não carregaram agora/);assert.doesNotMatch(renderProductLabs(),/828 resultados/);
assert.deepEqual(state.data,original,'read-only presentation cannot change clinical data or provenance');
console.log('Exames access: independent full-history default, 828 synthetic rows, top controls/graph/history, exact as-of, text results, source/unit cohorts, pagination, errors and immutable data passed.');

// Collection overview includes markers outside the curated panels, without
// replacing distinct results or importing another collection's values.
state.domainStatus={labs:'ready'};state.ui={productLabPeriod:'all',productLabCollection:'2025-05-20'};
state.data={labs:[
 {source_record_id:'synthetic-collection-known',collection_date:'2025-05-20',biomarker:'Glicose',result_raw:'90',result_numeric:90,unit:'u',laboratory:'Synthetic A'},
 {source_record_id:'synthetic-collection-other',collection_date:'2025-05-20',biomarker:'Synthetic uncommon marker',result_raw:'12',result_numeric:12,unit:'u',laboratory:'Synthetic A'},
 {source_record_id:'synthetic-collection-text',collection_date:'2025-05-20',biomarker:'Synthetic text marker',result_raw:'Não reagente',unit:'',laboratory:'Synthetic A'},
 {source_record_id:'synthetic-collection-distinct-a',collection_date:'2025-05-20',biomarker:'Synthetic distinct marker',result_raw:'3',result_numeric:3,unit:'u',laboratory:'Synthetic A'},
 {source_record_id:'synthetic-collection-distinct-b',collection_date:'2025-05-20',biomarker:'Synthetic distinct marker',result_raw:'4',result_numeric:4,unit:'other u',laboratory:'Synthetic B'},
 {source_record_id:'synthetic-collection-other-day',collection_date:'2025-04-20',biomarker:'Synthetic other date only',result_raw:'999',result_numeric:999,unit:'u',laboratory:'Synthetic A'}
]};
const collectionSnapshot=structuredClone(state.data);
const collectionHtml=renderProductLabs().match(/<section class="ltsLabCollection"[\s\S]*?<\/section>/)[0];
for(const name of ['Glicose','Synthetic uncommon marker','Synthetic text marker','Synthetic distinct marker'])assert.ok(collectionHtml.includes(name),name+' remains reachable in its collection');
assert.match(collectionHtml,/Outros resultados da coleta/);assert.match(collectionHtml,/Não reagente/);
assert.match(collectionHtml,/Resultados distintos/,'different origins and units are never chosen or summed');
assert.doesNotMatch(collectionHtml,/Synthetic other date only|999/);
assert.equal((collectionHtml.match(/data-lab-marker=/g)||[]).length,4,'one navigation card per marker; original results stay in history');
assert.deepEqual(state.data,collectionSnapshot,'collection rendering preserves original rows and units');
