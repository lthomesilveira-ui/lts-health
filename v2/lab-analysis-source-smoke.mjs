import assert from 'node:assert/strict';
import {labSeriesModel} from './src/integrated-analysis.js';

const ready={labs:'ready'};
const row=(collection_date,laboratory,result_numeric,source='lab report')=>({collection_date,laboratory,biomarker:'Glicose',result_numeric,unit:'mg/dL',source});

const model=labSeriesModel({labs:[
  row('2026-01-10','Fleury',92),
  row('2026-02-10','Einstein',88),
  row('2026-03-10','Fleury',90),
]},ready);
assert.equal(model.safe,true,'latest Fleury collection should compare with prior Fleury collection');
assert.equal(model.latest,'2026-03-10');
assert.equal(model.previous,'2026-01-10','intermediate Einstein date must not replace the prior same-source collection');
assert.equal(model.currentLab,'Fleury');
assert.equal(model.previousLab,'Fleury');
assert.equal(model.comparable,1);

const noPriorSameSource=labSeriesModel({labs:[
  row('2026-01-10','Einstein',88),
  row('2026-03-10','Fleury',90),
]},ready);
assert.equal(noPriorSameSource.safe,false,'different sources must not be treated as one longitudinal series');
assert.equal(noPriorSameSource.reason,'no_prior_same_source');
assert.equal(noPriorSameSource.comparable,0);
assert.equal(noPriorSameSource.previous,null,'a different-origin date must not be exposed as the previous comparable collection');

const ambiguousLatest=labSeriesModel({labs:[
  row('2026-01-10','Fleury',92),
  row('2026-03-10','Fleury',90),
  row('2026-03-10','Einstein',89),
]},ready);
assert.equal(ambiguousLatest.safe,false,'multiple latest origins must remain unresolved');
assert.equal(ambiguousLatest.reason,'ambiguous_source');

console.log('lab analysis source smoke: ok');
