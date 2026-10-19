import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {waterReferenceForDate,goalForDate,documentedWaterBase}=await import('../src/personal-goals.js');
const {waterReferenceContext}=await import('../src/water-reference-context.js');
const {documentedWaterReferenceForDate}=await import('../src/documented-water-reference.js');
const {waterGoal}=await import('../src/home-evidence-insights.js');
const {homeCockpitModel,waterPanel}=await import('../src/home-cockpit.js');
const status=Object.fromEntries(['body','segmental','nutrition','sourceMetrics','metrics','workouts','exercises','sets','labs','treatments','polarSessions','goals','meals','waterReferences'].map(k=>[k,'ready']));
const metadata={type:'documented_water_base',source:'Synthetic plan.pdf',source_page:3,documented_on:'2025-03-13',date_basis:'document_update',clinical_start:'not_explicit',exercise_addition:'Adicional individual conforme exercício; não calculado automaticamente.'};
const legacyDocumented={effective_from:'2025-03-13',water_ml:3000,notes:JSON.stringify(metadata)};
const historical={effective_from:'2025-01-01',water_ml:3500,notes:JSON.stringify({type:'historical_protocol',documented_on:'2025-01-01',current_validity:'unconfirmed'})};
const hash='a'.repeat(64),documented={source_record_id:'synthetic-prescription',document_type:'medical_plan',document_date:metadata.documented_on,source_file:metadata.source,source:'Synthetic document',checksum:hash,water_reference:{...metadata,schema_version:1,base_ml_per_day:3000,source_sha256:hash}};
const data={body:[],segmental:[],nutrition:[{nutrition_date:'2025-03-15',source:'Synthetic water diary',water_ml:2000}],sourceMetrics:[],metrics:[],workouts:[],exercises:[],sets:[],labs:[],treatments:[],goals:[historical],waterReferences:[documented],meals:[]};
const snapshot=structuredClone(data),today='2025-03-20';
const reference=documentedWaterReferenceForDate(data.waterReferences,'2025-03-15','ready');assert.deepEqual(reference,waterGoal(data,status,'2025-03-15'));assert.equal(reference.dateBasis,'document_update');
assert.equal(goalForDate([...data.goals,legacyDocumented],'2025-03-15'),null,'documentary and historical values never become clinical goals');
const html=waterPanel(homeCockpitModel(data,status,'30',{},today));assert.match(html,/Base documentada em 13\/03\/2025/);assert.match(html,/3\.000 mL\/dia/);assert.match(html,/diferença do consumo registrado/);assert.match(html,/início clínico não explicitado/);assert.doesNotMatch(html,/Meta vigente|vigente desde|1 L\/h.*[0-9] minutos/);
const before={...data,nutrition:[{nutrition_date:'2025-03-12',source:'Synthetic water diary',water_ml:2000}]};assert.equal(waterGoal(before,status,'2025-03-12'),null);assert.match(waterPanel(homeCockpitModel(before,status,'30',{},today)),/Base documentada/);assert.doesNotMatch(waterPanel(homeCockpitModel(before,status,'30',{},today)),/diferença do consumo registrado/);
// Preserve rejection/protection of the legacy representation, but never use it
// as an accepted documentary input to current consumers.
for(const patch of [{source:{}},{source_page:-1},{source_page:'3'},{documented_on:'invalid'}]){const row={...legacyDocumented,notes:JSON.stringify({...metadata,...patch})};assert.equal(documentedWaterBase(row),null);assert.equal(waterReferenceForDate([row],'2025-03-15','ready'),null);}
for(const patch of [{effective_from:'invalid'},{effective_from:'2025-03-12'},{water_ml:true}])assert.equal(documentedWaterBase({...legacyDocumented,...patch}),null);
const legacyOnly={...data,goals:[historical,legacyDocumented],waterReferences:[]};
assert.equal(waterGoal(legacyOnly,status,'2025-03-15'),null);assert.equal(waterReferenceContext(legacyOnly,status,'2025-03-15').personal,null);
for(const waterReferences of ['error','loading',undefined])assert.equal(waterGoal({...data,goals:[legacyDocumented]},{...status,waterReferences},'2025-03-15'),null,'goals cannot bypass documentary loading status');
assert.equal(waterReferenceForDate(data.goals,'2025-03-15'),null);assert.equal(waterGoal(data,{},'2025-03-15'),null);
const {consultationLines}=await import('../src/integrated-review.js');
const cockpit=homeCockpitModel(data,status,'30',{},today),summary=consultationLines(cockpit.r,cockpit.m,cockpit.evo).join('\n');assert.match(summary,/BASE DOCUMENTAL DE ÁGUA/);assert.match(summary,/Synthetic plan.pdf, página 3/);assert.match(summary,/Não aplicada como meta clínica nem à média de toda a janela/);
const beforeCockpit=homeCockpitModel(before,status,'30',{},today);assert.match(consultationLines(beforeCockpit.r,beforeCockpit.m,beforeCockpit.evo).join('\n'),/BASE DOCUMENTAL DE ÁGUA/,'documentary context can be shown without applying it to earlier intake');
assert.deepEqual(data,snapshot);console.log('Water reference consumers: separate document domain, legacy-bypass rejection, ready-status isolation, historical preservation and descriptive consultation context passed.');
