import assert from 'node:assert/strict';
import {captureBasalCandidates,validCandidateDate} from '../functions/_shared/basal-energy-candidates.mjs';
import {normalizeExport} from '../functions/_shared/health-auto-export-contract.mjs';
const today='2026-10-20',options={today,aggregation:'Day'};
const point={qty:1800.25,date:'2026-10-19 00:00:00 -0300',source:'Synthetic source'};
const basal=(data=[point],units='kcal',name='basal_energy_burned')=>({name,units,data});
const payload=(...metrics)=>({data:{metrics}});
const capture=(...metrics)=>captureBasalCandidates(payload(...metrics),options);
let groups=0;
function check(name,fn){fn();groups++;}
check('preserve exact quantity, unit, source and local day',()=>assert.deepEqual(capture(basal()).candidates,[{
  point_index:0,quantity:1800.25,unit:'kcal',source_date:point.date,metric_date:'2026-10-19',original_source:point.source,
  source_start_date:null,source_end_date:null,source_creation_date:null
}]));
check('no conversion of kJ',()=>assert.equal(capture(basal([{...point,qty:4184}],'kJ')).candidates[0].quantity,4184));
check('unknown bounded units remain unvalidated evidence',()=>assert.equal(capture(basal([point],'unrecognized energy unit')).candidates[0].unit,'unrecognized energy unit'));
check('zero is not missing',()=>assert.equal(capture(basal([{...point,qty:0}])).candidates[0].quantity,0));
check('empty and missing sources are null, never invented',()=>{
  for(const source of [undefined,null,''])assert.equal(capture(basal([{...point,source}])).candidates[0].original_source,null);
});
check('original whitespace retained',()=>{
  const c=capture(basal([{...point,source:' source '}],' kcal ')).candidates[0];assert.equal(c.original_source,' source ');assert.equal(c.unit,' kcal ');
});
check('optional timestamps retained without coverage inference',()=>{
  const x={...point,startDate:'2026-10-19 00:00:00 -0300',endDate:'2026-10-19 01:00:00 -0300',creationDate:'2026-10-20 00:00:00 -0300'};
  const c=capture(basal([x])).candidates[0];assert.equal(c.source_start_date,x.startDate);assert.equal(c.source_end_date,x.endDate);assert.equal(c.source_creation_date,x.creationDate);assert.ok(!('coverage_verified' in c));assert.ok(!('value_kcal' in c));
});
check('revisions and equal points are never summed or deduplicated',()=>{
  const c=capture(basal([point,point,{...point,qty:1900}]));assert.equal(c.candidates.length,3);assert.deepEqual(c.candidates.map(x=>x.quantity),[1800.25,1800.25,1900]);assert.deepEqual(c.candidates.map(x=>x.point_index),[0,1,2]);
});
check('sources remain distinct',()=>assert.equal(capture(basal([point,{...point,source:'Other synthetic source'}])).candidates.length,2));
check('only exact basal identifier',()=>{for(const name of ['basal_energy','Basal_energy_burned','basal_energy_burned_extra','active_energy'])assert.equal(capture(basal([point],'kcal',name)).candidates.length,0);});
check('nonobjects rejected individually',()=>{const c=capture(basal([null,[],false,42,'bad',point]));assert.equal(c.rejected_points,5);assert.equal(c.candidates.length,1);assert.equal(c.candidates[0].point_index,0);});
check('quantity type and bounds',()=>{for(const qty of [null,undefined,'1800',true,-1,Infinity,NaN,1e9+1])assert.equal(capture(basal([{...point,qty}])).rejected_points,1);assert.equal(capture(basal([{...point,qty:1e9}])).candidates.length,1);});
check('unit type and bounds',()=>{for(const unit of [undefined,null,2,'',' ','a'.repeat(33),'kcal\n','kcal\u007f','kcal\u0085','kcal\u009f'])assert.equal(capture({...basal(),units:unit}).rejected_points,1);});
check('source type and bounds',()=>{for(const source of [3,{},true,'a'.repeat(161),'bad\n','bad\u007f','bad\u0085','bad\u009f'])assert.equal(capture(basal([{...point,source}])).rejected_points,1);});
check('lone UTF-16 surrogates rejected, valid pairs preserved',()=>{
  for(const bad of ['\ud800','\udfff','a\ud800b','a\udc00b','\ud800\ud800','\udc00\udc00']){
    assert.equal(capture(basal([{...point,source:bad}])).rejected_points,1);
    assert.equal(capture(basal([point],bad)).rejected_points,1);
  }
  const good='Synthetic 😀 source';const c=capture(basal([{...point,source:good}],'k😀J')).candidates[0];
  assert.equal(c.original_source,good);assert.equal(c.unit,'k😀J');
});
check('strict calendar and timestamp bounds',()=>{
  for(const date of ['2026-02-29','2026-04-31','2026-00-01','2026-13-01','1999-12-31','2026-10-21','2026-10-19T00:00:00Z','2026-10-19 00:00:00 -0300\n','2026-10-19\n','2026-10-19 24:00:00 -0300','2026-10-19 12:60:00 -0300','2026-10-19 12:00:60 -0300','2026-10-19 12:00:00 +1401','2026-10-19 12:00:00 -1500','2026-10-19 12:00:00 +0060',null,42])assert.equal(validCandidateDate(date,today),false,String(date));
  for(const date of ['2024-02-29','2000-01-01','2026-10-20','2026-10-19 23:59:59 +1400','2026-10-19 23:59:59 -1400'])assert.equal(validCandidateDate(date,today),true,date);
});
check('invalid optional timestamps cannot inject provenance',()=>{for(const key of ['startDate','endDate','creationDate'])assert.equal(capture(basal([{...point,[key]:'bad'}])).rejected_points,1);});
check('arbitrary metadata never retained',()=>{const c=capture(basal([{...point,device:'not authorized',nested:{extra:true},user_id:'forged',coverage_verified:true}])).candidates[0];assert.equal(Object.keys(c).length,9);assert.ok(!('device' in c));assert.ok(!('user_id' in c));});
check('block counters remain truthful for partial acceptance',()=>{
  const c=capture(basal([point,{}]),basal([]),basal([point]));assert.equal(c.candidates.length,2);assert.equal(c.rejected_points,1);assert.equal(c.ignored_blocks,2);
});
check('2500-point outer boundary unchanged',()=>{
  const p=payload(basal(Array(2500).fill(point)));assert.equal(normalizeExport(p,options).ignored_points,2500);assert.equal(captureBasalCandidates(p,options).candidates.length,2500);
  assert.throws(()=>normalizeExport(payload(basal(Array(2501).fill(point))),options),/too_many_points/);
});
check('legacy parser never routes basal into daily metrics',()=>{
  const x=normalizeExport(payload(basal()),options);assert.equal(x.metrics.length,0);assert.equal(x.ignored_basal_points,1);
});
check('legacy batch remains byte-equivalent when basal is added',()=>{
  const cases=[['dietary_energy','kcal',1500],['protein','g',100],['dietary_water','mL',2000],['step_count','count',5000],['active_energy','kcal',500],['resting_heart_rate','bpm',60]];
  for(const [name,units,qty] of cases){const m={name,units,data:[{...point,qty}]};const before=normalizeExport(payload(m),options).metrics;
    for(const extra of [basal(),basal([point,point]),basal([null,{}]),basal([{...point,source:null}]),basal([{...point,qty:1900}])]){
      const p=payload(m,extra);assert.deepEqual(normalizeExport(p,options).metrics,before);captureBasalCandidates(p,options);assert.deepEqual(normalizeExport(p,options).metrics,before);
    }
  }
});
console.log(`Basal candidate parser: ${groups} groups passed; 30 legacy differential cases; original fields retained and no daily promotion.`);
