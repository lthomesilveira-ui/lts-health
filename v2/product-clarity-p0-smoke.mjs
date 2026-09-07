import {consolidatedWeightSeries,labNarrativeSeries,sampleSeries} from './src/longitudinal-model.js';

function assert(condition,message){if(!condition)throw new Error(message);}

const body=[
  {measured_at:'2024-01-01',weight_kg:100,source:'InBody'},
  {measured_at:'2024-02-01',weight_kg:98,source:'InBody'},
  {measured_at:'2024-03-01',weight_kg:97,source:'InBody'},
  {measured_at:'2024-04-01',weight_kg:96,source:'InBody duplicate A'},
  {measured_at:'2024-04-01',weight_kg:95.5,source:'InBody duplicate B'}
];
const metrics=[
  {measured_at:'2023-12-15T12:00:00Z',metric_type:'weight_kg',value:101,unit:'kg',source:'MyFitnessPal export'},
  {measured_at:'2024-01-01T12:00:00Z',metric_type:'weight_kg',value:99.5,unit:'kg',source:'MyFitnessPal export'},
  {measured_at:'2024-01-15T12:00:00Z',metric_type:'weight_kg',value:99,unit:'kg',source:'MyFitnessPal export'},
  {measured_at:'2024-04-01T12:00:00Z',metric_type:'weight_kg',value:95.8,unit:'kg',source:'MyFitnessPal export'},
  {measured_at:'2024-05-01T12:00:00Z',metric_type:'weight_kg',value:95,unit:'lb',source:'MyFitnessPal export'}
];
const weight=consolidatedWeightSeries(body,metrics);
assert(weight.points.find(point=>point.date==='2024-01-01')?.value===100,'InBody must prevail on same-day MFP overlap');
assert(weight.points.find(point=>point.date==='2024-01-01')?.sourceKind==='body_composition','same-day source must be body composition');
assert(weight.points.find(point=>point.date==='2024-01-15')?.sourceKind==='myfitnesspal','MFP must fill a day without InBody');
assert(weight.overlap.total===1,'only safe body dates may resolve an MFP overlap');
assert(weight.blockedDates.includes('2024-04-01'),'ambiguous body dates must stay out of the consolidated series');
assert(!weight.points.some(point=>point.date==='2024-05-01'),'non-kg MFP values must not enter the kg series');
assert(weight.first?.date==='2023-12-15'&&weight.last?.date==='2024-03-01','consolidated series must preserve chronological span');

const labs=[
  {collection_date:'2022-01-10',laboratory:'Lab A',biomarker:'Ferritina',result_numeric:40,unit:'ng/mL'},
  {collection_date:'2023-01-10',laboratory:'Lab A',biomarker:'Ferritina',result_numeric:55,unit:'ng/mL'},
  {collection_date:'2024-01-10',laboratory:'Lab A',biomarker:'Ferritina',result_numeric:60,unit:'ng/mL'},
  {collection_date:'2024-01-10',laboratory:'Lab B',biomarker:'Ferritina',result_numeric:999,unit:'ng/mL'},
  {collection_date:'2025-01-10',laboratory:'Lab A',biomarker:'Ferritina',result_numeric:7,unit:'ug/L'},
  {collection_date:'2022-02-01',laboratory:'Lab A',biomarker:'Testosterona Total',result_numeric:400,unit:'ng/dL'},
  {collection_date:'2025-02-01',laboratory:'Lab A',biomarker:'Testosterona Total',result_numeric:520,unit:'ng/dL'},
  {collection_date:'2025-02-01',laboratory:'Lab A',biomarker:'Marcador ambíguo',result_numeric:1,unit:'u'},
  {collection_date:'2025-02-01',laboratory:'Lab A',biomarker:'Marcador ambíguo',result_numeric:2,unit:'u'},
  {collection_date:'2024-02-01',laboratory:'Lab A',biomarker:'Marcador ambíguo',result_numeric:0,unit:'u'}
];
const series=labNarrativeSeries(labs);
const ferritin=series.find(item=>item.key==='ferritina');
const testosterone=series.find(item=>item.key==='testosterona total');
assert(ferritin?.pointCount===3,'ferritin series must stay inside one origin and one unit');
assert(ferritin?.firstDate==='2022-01-10'&&ferritin?.lastDate==='2024-01-10','ferritin longitudinal span must be preserved');
assert(ferritin?.delta===20,'ferritin delta must be descriptive within the comparable series');
assert(testosterone?.pointCount===2&&testosterone?.delta===120,'testosterone longitudinal series must be available when supported');
assert(!series.some(item=>item.key==='marcador ambiguo'),'an ambiguous same-date cohort must not become a two-point trend');

const sampled=sampleSeries(Array.from({length:1096},(_,index)=>({date:String(index),value:index})),72);
assert(sampled.length<=72&&sampled[0].value===0&&sampled.at(-1).value===1095,'long history sampling must retain endpoints without inventing points');

console.log('Product clarity longitudinal model smoke passed');
