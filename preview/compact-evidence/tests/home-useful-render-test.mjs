import assert from 'node:assert/strict';globalThis.location={search:'?fixture=1'};
const {renderReferenceHome}=await import('../src/home-reference-experience.js');
const status=Object.fromEntries(['body','workouts','exercises','sets','nutrition','sourceMetrics','metrics','labs','treatments','polarSessions','waterReferences'].map(k=>[k,'ready']));
const base={body:[],nutrition:[],workouts:[],exercises:[],sets:[],sourceMetrics:[],metrics:[],labs:[],treatments:[],polarSessions:[]};
const lab=(date,value,patch={})=>({source_record_id:`s:${date}`,collection_date:date,biomarker:'Synthetic marker',laboratory:'Synthetic lab',unit:'u',method:'method one',result_numeric:value,result_raw:String(value),reference_range:'0 a 5',...patch});
const data={...base,labs:[lab('2025-01-01',-1),lab('2025-04-15',0),lab('2025-05-01',2,{biomarker:'Other marker'})]};
const key=JSON.stringify(['synthetic marker','synthetic lab','u']);
const render=(d,ui={})=>renderReferenceHome(d,status,'90',ui,'2025-05-03');
let html=render(data,{homeLabKey:key}),card=html.split('<article class="refPanel labs">')[1].split('</article>')[0];
assert.match(card,/Resultado anterior fora do período selecionado/);assert.match(card,/data-period-start="2025-02-03"/);assert.match(card,/data-axis-start="2025-01-01"/);assert.match(card,/Diferença registrada: \+1,0 u/);assert.match(card,/15\/04\/2025/);
html=render(data,{homeLabKey:'missing'});card=html.split('<article class="refPanel labs">')[1].split('</article>')[0];assert.match(card,/<select data-home-lab-select/);assert.match(card,/Marcador escolhido sem resultado nesta janela/);
const uncertain={...data,labs:[lab('2025-01-01',-1,{method:' '}),lab('2025-04-15',0,{method:' '})]};
card=render(uncertain).split('<article class="refPanel labs">')[1].split('</article>')[0];assert.match(card,/Método não informado; valores separados/);assert.doesNotMatch(card,/<polyline/);assert.doesNotMatch(card,/Diferença registrada/);
const censored={...base,labs:[lab('2025-04-15',5,{result_raw:'<5'})]};card=render(censored).split('<article class="refPanel labs">')[1].split('</article>')[0];assert.doesNotMatch(card,/data-value="5"/);assert.doesNotMatch(card,/Diferença registrada/);
console.log('Useful Home renderer: prior context separate from global period, selection recovery, censored values and unconfirmed method without line/delta passed.');

const twoWithin={...base,labs:[lab('2025-03-01',1,{method:' '}),lab('2025-04-15',2,{method:' '})]};const signal=render(twoWithin).split('<button class="refSignal labs"')[1].split('</button>')[0];assert.doesNotMatch(signal,/<polyline/);
const selectedCard=render(data,{homeLabKey:key}).split('<article class="refPanel labs">')[1].split('</article>')[0];assert.match(selectedCard,/<h2>Exames<\/h2><p>15\/04\/2025<\/p>/);

const bodyData={...base,body:[{measured_at:'2025-03-01',source_record_id:'body1',source:'Synthetic',weight_kg:80,fat_mass_kg:20,skeletal_muscle_mass_kg:30},{measured_at:'2025-04-01',source_record_id:'body2',source:'Synthetic',weight_kg:79,fat_mass_kg:21,skeletal_muscle_mass_kg:29}]};assert.match(render(bodyData),/data-home-insight-details data-body-start="2025-03-01" data-body-end="2025-04-01"/);
