import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
globalThis.location={search:'?fixture=1'};
const {renderBodyInterval}=await import('../src/body-interval-view.js');
const status=Object.fromEntries(['body','segmental','nutrition','sourceMetrics','metrics','workouts','exercises','sets','labs'].map(k=>[k,'ready']));
const data={body:[{source_record_id:'b1',measured_at:'2025-01-01',weight_kg:80,source:'<scan>'},{source_record_id:'b2',measured_at:'2025-02-01',weight_kg:79,source:'Other',device_name:'B'}],nutrition:[{nutrition_date:'2025-01-02',source:'Food<script>',protein_g:100},{nutrition_date:'2025-01-03',source:'Food<script>',protein_g:120}],workouts:[],exercises:[],sets:[],sourceMetrics:[],labs:[],segmental:[]};
const html=renderBodyInterval(data,status,{},'2025-02-02');
assert.match(html,/31 dias/);assert.match(html,/2\/31 dias/);assert.match(html,/110 g/);assert.match(html,/-1,0 kg/);assert.match(html,/Diferenças não confirmam ganho ou perda de tecido/);assert.doesNotMatch(html,/<script>/);assert.match(html,/Food&lt;script&gt;/);assert.match(html,/Sem água registrada/);assert.match(html,/sem interpretar|não explica/);
const failed=renderBodyInterval(data,{...status,body:'error'},{},'2025-02-02');assert.doesNotMatch(failed,/-1,0 kg/);assert.match(failed,/não carregaram/);
const mixed=renderBodyInterval({...data,nutrition:[...data.nutrition,{nutrition_date:'2025-01-04',source:'Second food',protein_g:300}]},status,{},'2025-02-02');assert.match(mixed,/110 g/);assert.match(mixed,/300 g/);assert.doesNotMatch(mixed,/173 g/);
console.log('Interval renderer: sparse denominators, observed deltas, independent sources, missing/error states and escaping passed.');

const held=renderBodyInterval({...data,sourceMetrics:[{metric_date:'2025-01-04',metric_type:'dietary_protein_g',unit:'g',value:180,source_name:'Review source',canonical_status:'held'}]},status,{},'2025-02-02');assert.match(held,/Origem em revisão/);assert.doesNotMatch(held,/Origem ainda não validada/);

const openData={...data,body:[data.body[0],{...data.body[1],measured_at:'2025-02-02'}],nutrition:[
 {nutrition_date:'2025-01-02',source:'Daily food',protein_g:100,calories_kcal:2000,water_ml:1000},
 {nutrition_date:'2025-02-02',source:'Daily food',protein_g:17,calories_kcal:321,water_ml:123}
],sourceMetrics:[
 {metric_date:'2025-01-02',metric_type:'sleep_duration_h',unit:'h',value:8,source_name:'Watch',canonical_status:'candidate'},
 {metric_date:'2025-02-02',metric_type:'sleep_duration_h',unit:'h',value:1.5,source_name:'Watch',canonical_status:'candidate'},
 {metric_date:'2025-01-02',metric_type:'dietary_protein_g',unit:'g',value:180,source_name:'Food bridge',canonical_status:'candidate'},
 {metric_date:'2025-02-02',metric_type:'dietary_protein_g',unit:'g',value:23,source_name:'Food bridge',canonical_status:'candidate'}
]};
const openHtml=renderBodyInterval(openData,status,{},'2025-02-02');
assert.match(openHtml,/Hoje · dia aberto/);assert.match(openHtml,/17 g em 02\/02\/2025/);
assert.match(openHtml,/321 kcal em 02\/02\/2025/);assert.match(openHtml,/23 g em 02\/02\/2025/);
assert.match(openHtml,/123 mL em 02\/02\/2025/);assert.match(openHtml,/1,5 h em 02\/02\/2025/);
assert.match(openHtml,/>100 g<\/strong>/);assert.match(openHtml,/>8,0 h<\/strong>/);
assert.match(openHtml,/Fora da média acima/);assert.match(openHtml,/1\/31 dias encerrados com valor/);
const onlyTodayHtml=renderBodyInterval({...openData,body:[{...data.body[0],measured_at:'2025-02-01'},openData.body[1]]},status,{},'2025-02-02');
assert.match(onlyTodayHtml,/0\/0 dias encerrados/);assert.match(onlyTodayHtml,/17 g em 02\/02\/2025/);
assert.doesNotMatch(onlyTodayHtml,/NaN|Infinity|undefined/);
const regionalData={...data,segmental:[
 {measured_at:'2025-01-01',body_source_record_id:'b1',lean_right_arm_kg:4.5,lean_left_arm_kg:4.2},
 {measured_at:'2025-02-01',body_source_record_id:'b2',lean_right_arm_kg:4.3,lean_left_arm_kg:4.1}
]};
const regionalHtml=renderBodyInterval(regionalData,{...status,workouts:'error'},{},'2025-02-02');
assert.match(regionalHtml,/Treinos não carregaram/);assert.match(regionalHtml,/Massa magra por região/);
assert.match(regionalHtml,/Braço direito/);assert.match(regionalHtml,/Braço esquerdo/);assert.match(regionalHtml,/4,50 kg/);assert.match(regionalHtml,/4,10 kg/);
assert.ok(regionalHtml.indexOf('Massa magra por região')<regionalHtml.indexOf('Treinos não carregaram'),'regions are outside the failed training section');
const allLabs=Array.from({length:115},(_,index)=>({collection_date:'2025-02-01',biomarker:`Marker ${String(index).padStart(3,'0')}`,result_numeric:index,unit:'u',reference_range:'1 a 5 u',laboratory:'Source <img>',method:'Method <script>'}));
const labData={...data,labs:[...allLabs,{collection_date:'2024-12-01',biomarker:'Marker 114',result_raw:'< 3',unit:'u',laboratory:'Old origin',method:'Other method'}]};
const allLabHtml=renderBodyInterval(labData,status,{reportLabMarker:'marker 114'},'2025-02-02');
assert.match(allLabHtml,/115 registros de 115 marcadores/);assert.match(allLabHtml,/ordem alfabética, sem prioridade clínica/);
assert.match(allLabHtml,/value="marker 000"/);assert.match(allLabHtml,/value="marker 114" selected/);
assert.equal((allLabHtml.match(/class="ltsIntervalLab"/g)||[]).length,2,'only the selected marker plus collapsed historical context are rendered, never all 115 rows');
assert.match(allLabHtml,/114,00 u/);assert.match(allLabHtml,/Referência do laudo: 1 a 5 u/);assert.match(allLabHtml,/Anterior fora da janela · 01\/12\/2024/);
assert.match(allLabHtml,/Source &lt;img&gt;/);assert.match(allLabHtml,/Method &lt;script&gt;/);assert.doesNotMatch(allLabHtml,/<script>|<img>/);
const unavailableMarker=renderBodyInterval(labData,status,{reportLabMarker:'unknown'},'2025-02-02');
assert.match(unavailableMarker,/Marcador sem resultado nesta janela/);assert.match(unavailableMarker,/nenhuma substituição/);
assert.equal((unavailableMarker.match(/class="ltsIntervalLab"/g)||[]).length,0);
console.log('Interval renderer regressions: visible open-day values, averages excluding today, independent regions after training errors, complete marker selection, bounded lab display and safe historical context passed.');

// Refresh cannot replace a now-ambiguous chosen date with the first option.
const {bodyIntervalModel}=await import('../src/body-interval-model.js');
const chosen={bodyIntervalStart:'2025-01-01',bodyIntervalEnd:'2025-02-01'};
const threeDates={...data,body:[{...data.body[0],source_record_id:'older',measured_at:'2024-12-01'},...data.body]};
const ambiguousStart={...threeDates,body:[...threeDates.body,{...data.body[0],source_record_id:'duplicate-start'}]};
const selector=(markup,id)=>markup.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`))?.[1]||'';
const ambiguousHtml=renderBodyInterval(ambiguousStart,status,chosen,'2025-02-02');
assert.match(selector(ambiguousHtml,'bodyIntervalStart'),/<option value="2025-01-01" selected disabled>01\/01\/2025 · mais de uma avaliação<\/option>/);
assert.equal((selector(ambiguousHtml,'bodyIntervalStart').match(/ selected/g)||[]).length,1);
assert.match(selector(ambiguousHtml,'bodyIntervalEnd'),/<option value="2025-02-01" selected>/);
assert.doesNotMatch(ambiguousHtml,/class="ltsIntervalMetrics"/,'invalid pair never produces descriptive deltas');
const deletedStart=renderBodyInterval({...threeDates,body:threeDates.body.filter(row=>row.measured_at!==chosen.bodyIntervalStart)},status,chosen,'2025-02-02');
assert.match(selector(deletedStart,'bodyIntervalStart'),/<option value="2025-01-01" selected disabled>01\/01\/2025 · avaliação indisponível<\/option>/);
const failedChosen=renderBodyInterval(threeDates,{...status,body:'error'},chosen,'2025-02-02');
assert.match(selector(failedChosen,'bodyIntervalStart'),/value="2025-01-01" selected disabled/);
assert.match(selector(failedChosen,'bodyIntervalEnd'),/value="2025-02-01" selected disabled/);
const emptyChoice=renderBodyInterval({...data,body:[]},status,{},'2025-02-02');
assert.match(selector(emptyChoice,'bodyIntervalStart'),/<option value="" selected disabled>Escolha uma avaliação<\/option>/);

// Execute only the actual synchronous selection handler as a pure unit. This
// is not browser/DOM emulation or visual evidence; no document is supplied.
const mainSource=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const changeSource=mainSource.match(/if\(\['bodyIntervalStart','bodyIntervalEnd'\]\.includes\(event\.target\.id\)\)\{[^\n]+\}/)?.[0];
assert.ok(changeSource,'interval selection handler exists');
assert.doesNotMatch(changeSource,/querySelector|bodyIntervalStart\s*=/,'handler must not copy the untouched DOM control');
const change=new Function('state','event','render',changeSource);
let renders=0;
const eventState={ui:{...chosen,homeNutritionSource:'global-source'}};
change(eventState,{target:{id:'bodyIntervalEnd',value:'2024-12-01'}},()=>renders++);
assert.deepEqual(eventState.ui,{bodyIntervalStart:'2025-01-01',bodyIntervalEnd:'2024-12-01',homeNutritionSource:'global-source'});
assert.equal(bodyIntervalModel(ambiguousStart,status,eventState.ui,'2025-02-02').available,false);
change(eventState,{target:{id:'bodyIntervalStart',value:'2024-12-01'}},()=>renders++);
assert.equal(eventState.ui.bodyIntervalEnd,'2024-12-01','editing start leaves the chosen end unchanged');
assert.equal(renders,2);

// The displayed default pair is pinned once before the first single-field edit.
const initializeSource=mainSource.match(/if\(state\.route==='analise'&&state\.ui\.reviewView==='interval'&&!state\.ui\.bodyIntervalStart&&!state\.ui\.bodyIntervalEnd\)\{\n[^\n]+\n[^\n]+\n  \}/)?.[0];
assert.ok(initializeSource,'default pair initialization remains explicit');
const initialize=new Function('state','bodyIntervalModel',initializeSource);
const defaultState={route:'analise',data:threeDates,domainStatus:status,ui:{reviewView:'interval'}};
initialize(defaultState,(...args)=>bodyIntervalModel(...args,'2025-02-02'));
assert.equal(defaultState.ui.bodyIntervalStart,chosen.bodyIntervalStart);assert.equal(defaultState.ui.bodyIntervalEnd,chosen.bodyIntervalEnd);
change(defaultState,{target:{id:'bodyIntervalStart',value:'2024-12-01'}},()=>{});
assert.equal(defaultState.ui.bodyIntervalEnd,'2025-02-01','first edit preserves the model-selected default on the other side');
defaultState.data=ambiguousStart;defaultState.ui={reviewView:'interval',...chosen};
initialize(defaultState,()=>{throw new Error('an explicit pair must not be defaulted again');});
assert.deepEqual(defaultState.ui,{reviewView:'interval',...chosen});
console.log('Interval integration regression: ambiguous/deleted/unavailable dates remain explicit; handler changes one field; initial model pair is pinned without refresh fallback.');

const plainOrigin=renderBodyInterval({...data,sourceMetrics:[{metric_date:'2025-01-04',metric_type:'sleep_duration_h',unit:'h',value:7,source_name:'Synthetic watch',source_family:'healthkit_candidate',canonical_status:'candidate'}]},status,{},'2025-02-02');assert.match(plainOrigin,/Origem ainda não validada/);assert.match(plainOrigin,/Via Apple Saúde/);assert.doesNotMatch(plainOrigin,/class="source-label">[^<]*healthkit_candidate/);

const distinctFamilies=renderBodyInterval({...data,sourceMetrics:['Unmapped A','Unmapped B'].map(source_family=>({metric_date:'2025-01-04',metric_type:'sleep_duration_h',unit:'h',value:7,source_name:'Same watch label',source_family,canonical_status:'candidate'}))},status,{},'2025-02-02');assert.match(distinctFamilies,/Unmapped A/);assert.match(distinctFamilies,/Unmapped B/);
