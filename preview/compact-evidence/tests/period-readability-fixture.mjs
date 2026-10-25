// Invented fixtures only: long human-readable origins, gaps, unavailable water,
// unconfirmed activity, fractional steps and separate disagreeing origins.
import {fixture as stepFixture,status,today} from './steps-evidence-fixture.mjs';
export {status,today};
export const day=age=>new Date(Date.parse(today+'T12:00:00Z')-age*86400000).toISOString().slice(0,10);
export function periodReadabilityFixture({sparse=false}={}){
 const data=stepFixture(),ages=sparse?[1,2,4,6]:[1,2,3,4,5,6,7];
 const food='Diário sintético · Aplicativo de origem não informado';
 const watch='Relógio sintético · Aplicativo de origem não informado';
 data.sourceMetrics=data.sourceMetrics.map(row=>({...row,source_name:row.source_name.includes('|')?'Outro relógio sintético|Outro telefone sintético':watch}));
 data.nutrition=ages.concat(0).map(age=>({source_record_id:`synthetic-period-food-${age}`,nutrition_date:day(age),source:food,protein_g:120+age,calories_kcal:1900+age*10}));
 data.nutrition.push({source_record_id:'synthetic-period-older-food',nutrition_date:day(20),source:'Outro diário sintético',protein_g:150,calories_kcal:1800});
 for(const age of ages.concat(0))for(const [metric_type,unit,value]of [['active_energy_kcal','kcal',300+age],['total_energy_kcal','kcal',2200+age],['sleep_duration_h','h',7+age/10]]){
  data.sourceMetrics.push({source_record_id:`synthetic-period-${metric_type}-${age}`,metric_date:day(age),metric_type,unit,value,source_name:watch,source_family:'synthetic-period',canonical_status:metric_type==='active_energy_kcal'?'candidate':'canonical'});
 }
 data.sourceMetrics.push({source_record_id:'synthetic-period-old-water',metric_date:day(15),metric_type:'dietary_water_ml',unit:'mL',value:1800,source_name:'Diário sintético de hidratação',source_family:'synthetic-period',canonical_status:'canonical'});
 return {data,status,today,day,sparse};
}
