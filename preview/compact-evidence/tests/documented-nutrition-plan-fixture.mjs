// Synthetic test inputs only. Never use a real document, person or source hash.
export const testToday='2024-03-08';
export function syntheticNutritionPlanRow(documentDate='2024-03-01',id='synthetic-plan-v1',hash='a'.repeat(64)){
  const totals={calories_kcal:500,protein_g:30,carbs_g:70,fat_g:15,fiber_g:8};
  return {source_record_id:id,document_date:documentDate,document_type:'nutrition_plan',source_file:'Synthetic nutrition plan.pdf',source:'Synthetic documentary source',checksum:hash,extraction_status:'reviewed',confidence:1,
    nutrition_plan:{schema_version:1,type:'documented_nutrition_plan',documented_on:documentDate,received_on:documentDate,source_record_id:id,source_sha256:hash,page_count:2,clinical_start:null,clinical_start_status:'not_documented',
      verification:{status:'source_verified',pages:[1,2]},author:{name:'Synthetic printed logo',identification_basis:'printed_logo',source_pages:[1],signature_verified:false},
      daily_targets:Object.fromEntries([['calories_kcal',2000,'kcal'],['protein_g',120,'g'],['carbs_g',250,'g'],['fat_g',60,'g'],['fiber_g',30,'g'],['water_ml',2400,'mL']].map(([key,value,unit])=>[key,{value,unit,pages:[1]}])),
      meals:[{id:'meal-a',name:'Synthetic morning meal',time:'08:00',source_pages:[1],items:[{name:'Synthetic food',quantity:80,unit:'g',note:'Synthetic item note'}],totals:{...totals},notes:['Synthetic meal note']},
        {id:'meal-b',name:'Synthetic evening meal',time:'19:30',source_pages:[2],items:[{name:'Synthetic food B',quantity:100,unit:'g'}],totals:{...totals},notes:[]}],
      alternatives:[{name:'Synthetic substitute meal',replaces_meal_id:'meal-a',source_pages:[2],items:[{name:'Synthetic substitute food',quantity:75,unit:'g'}],totals:{...totals,fiber_g:null},notes:['Fiber not stated in this alternative.']}],
      substitutions:[{text:'Synthetic substitution statement.',source_pages:[2]}],notes:[{text:'Synthetic documentary observation.',source_pages:[1]}],arithmetic_notes:['Declared totals are preserved; no inferred reconciliation.']}}
}
export const syntheticStatus=()=>Object.fromEntries(['nutritionPlans','nutrition','sourceMetrics','metrics','meals','body','workouts','exercises','sets','labs','treatments','regimens','goals','polarSessions'].map(key=>[key,'ready']));
export const syntheticData=()=>({...Object.fromEntries(Object.keys(syntheticStatus()).map(key=>[key,[]])),nutritionPlans:[syntheticNutritionPlanRow()]});
export const syntheticDate=(age,today=testToday)=>new Date(Date.parse(`${today}T12:00:00Z`)-age*86400000).toISOString().slice(0,10);
export const foodRow=(date,extra={})=>({nutrition_date:date,source:'Synthetic food origin',calories_kcal:1800,protein_g:100,carbs_g:200,fat_g:50,fiber_g:20,water_ml:1500,...extra});
export const sourceMetric=(date,type,value,extra={})=>({metric_date:date,metric_type:type,value,unit:type==='dietary_energy_kcal'||type.endsWith('energy_kcal')?'kcal':type==='dietary_water_ml'?'mL':'g',source_name:'Synthetic metric origin',source_family:'synthetic',canonical_status:'candidate',...extra});
