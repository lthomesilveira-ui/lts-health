// Documentary, read-only projection. Dates describe a received document, never
// clinical validity, use, a personal-goal update, or a recommendation.
export const documentedNutritionPlanProjection='source_record_id,document_date,document_type,source_file,source,checksum,extraction_status,confidence,nutrition_plan:source_payload->nutrition_plan_ui';
export const nutritionPlanFields=Object.freeze([
  Object.freeze({key:'calories_kcal',label:'Energia ingerida',unit:'kcal'}),
  Object.freeze({key:'protein_g',label:'Proteína',unit:'g'}),
  Object.freeze({key:'carbs_g',label:'Carboidratos',unit:'g'}),
  Object.freeze({key:'fat_g',label:'Gorduras',unit:'g'}),
  Object.freeze({key:'fiber_g',label:'Fibra',unit:'g'}),
  Object.freeze({key:'water_ml',label:'Água',unit:'mL'})
]);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'?value.trim():'';
const date=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const parsed=new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value?value:null;
};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)?value:null;
const nonnegative=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const positive=value=>nonnegative(value)&&value>0;
const strings=value=>Array.isArray(value)&&value.every(item=>Boolean(text(item)));
const foodFields=nutritionPlanFields.filter(field=>field.key!=='water_ml');
const pages=(value,count)=>Array.isArray(value)&&value.length>0&&new Set(value).size===value.length&&value.every(page=>Number.isSafeInteger(page)&&page>=1&&page<=count);
const sourceText=(value,count)=>object(value)&&Boolean(text(value.text))&&pages(value.source_pages,count);
const item=value=>object(value)&&Boolean(text(value.name))&&positive(value.quantity)&&value.unit==='g'&&(value.note===undefined||Boolean(text(value.note)));
const totals=(value,alternative)=>object(value)&&foodFields.every(({key})=>nonnegative(value[key])||(alternative&&key==='fiber_g'&&value[key]===null));
const meal=(value,count,alternative)=>object(value)&&Boolean(text(value.name))&&pages(value.source_pages,count)&&Array.isArray(value.items)&&value.items.length>0&&value.items.every(item)&&totals(value.totals,alternative)&&strings(value.notes);
const copyItems=items=>items.map(value=>({name:value.name,quantity:value.quantity,unit:value.unit,...(value.note===undefined?{}:{note:value.note})}));
const copyTotals=value=>Object.fromEntries(foodFields.map(({key})=>[key,value[key]]));
const copySourceText=value=>({text:value.text,source_pages:[...value.source_pages]});

/** Verify the entire supported display projection against its stored source
 * identity. Do not return raw payload, unknown clinical fields, or inferred sums.
 * Arithmetic differences remain source notes; declared numbers are unchanged. */
export function documentedNutritionPlan(row){
  if(!object(row)||row.document_type!=='nutrition_plan')return null;
  const plan=row.nutrition_plan,documentDate=date(row.document_date),sourceRecordId=text(row.source_record_id),sourceFile=text(row.source_file),checksum=hash(row.checksum);
  if(!object(plan)||plan.schema_version!==1||plan.type!=='documented_nutrition_plan'||!documentDate||!sourceRecordId||!sourceFile||!checksum)return null;
  if(plan.source_record_id!==sourceRecordId||plan.source_sha256!==checksum||date(plan.documented_on)!==documentDate||!date(plan.received_on))return null;
  const count=plan.page_count;
  if(!Number.isSafeInteger(count)||count<1||plan.clinical_start!==null||plan.clinical_start_status!=='not_documented')return null;
  if(!object(plan.verification)||plan.verification.status!=='source_verified'||!pages(plan.verification.pages,count)||plan.verification.pages.length!==count)return null;
  if(!object(plan.author)||!text(plan.author.name)||plan.author.identification_basis!=='printed_logo'||plan.author.signature_verified!==false||!pages(plan.author.source_pages,count))return null;
  if(!object(plan.daily_targets)||!nutritionPlanFields.every(({key,unit})=>object(plan.daily_targets[key])&&positive(plan.daily_targets[key].value)&&plan.daily_targets[key].unit===unit&&pages(plan.daily_targets[key].pages,count)))return null;
  if(!Array.isArray(plan.meals)||!plan.meals.length||!plan.meals.every(value=>meal(value,count,false)&&Boolean(text(value.id))&&(value.time===null||(typeof value.time==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.time)))))return null;
  const mealIds=new Set(plan.meals.map(value=>value.id));if(mealIds.size!==plan.meals.length)return null;
  if(!Array.isArray(plan.alternatives)||!plan.alternatives.every(value=>meal(value,count,true)&&mealIds.has(value.replaces_meal_id)))return null;
  if(!Array.isArray(plan.substitutions)||!plan.substitutions.every(value=>sourceText(value,count))||!Array.isArray(plan.notes)||!plan.notes.every(value=>sourceText(value,count))||!strings(plan.arithmetic_notes))return null;
  return {
    schema_version:1,type:'documented_nutrition_plan',documented_on:documentDate,received_on:plan.received_on,
    source_record_id:sourceRecordId,source_sha256:checksum,page_count:count,clinical_start:null,clinical_start_status:'not_documented',
    verification:{status:'source_verified',pages:[...plan.verification.pages]},
    author:{name:plan.author.name,identification_basis:'printed_logo',source_pages:[...plan.author.source_pages],signature_verified:false},
    daily_targets:Object.fromEntries(nutritionPlanFields.map(({key})=>[key,{value:plan.daily_targets[key].value,unit:plan.daily_targets[key].unit,pages:[...plan.daily_targets[key].pages]}])),
    meals:plan.meals.map(value=>({id:value.id,name:value.name,time:value.time,source_pages:[...value.source_pages],items:copyItems(value.items),totals:copyTotals(value.totals),notes:[...value.notes]})),
    alternatives:plan.alternatives.map(value=>({name:value.name,replaces_meal_id:value.replaces_meal_id,source_pages:[...value.source_pages],items:copyItems(value.items),totals:copyTotals(value.totals),notes:[...value.notes]})),
    substitutions:plan.substitutions.map(copySourceText),notes:plan.notes.map(copySourceText),arithmetic_notes:[...plan.arithmetic_notes],
    source_file:sourceFile,source:text(row.source)||sourceFile,checksum,document_date:documentDate,
    documentDate,receivedOn:plan.received_on,sourceRecordId,sourceFile,referenceDate:documentDate>plan.received_on?documentDate:plan.received_on,
    dateBasis:'received_document',clinicalStart:null,clinicalStartNote:'Início de uso não informado'
  };
}

/** Select the newest document known by today, independently of the chart window.
 * A malformed/ambiguous newest record blocks fallback. An undated plan cannot
 * be ordered safely and also blocks selection. Unrelated documents are ignored. */
export function selectDocumentedNutritionPlan(rows,asOfDate,status){
  const end=date(asOfDate),result=(state,reason,plan=null)=>({state,reason,plan});
  if(status==='error')return result('error','O plano alimentar não carregou nesta atualização.');
  if(status!=='ready')return result('loading','Carregando o plano alimentar documentado.');
  if(!end||!Array.isArray(rows))return result('invalid','Não foi possível confirmar a origem e a data do plano.');
  const plans=rows.filter(row=>object(row)&&row.document_type==='nutrition_plan');
  if(plans.some(row=>!date(row.document_date)))return result('invalid','Há um plano sem data documental válida; nenhuma versão foi escolhida.');
  const eligible=plans.filter(row=>row.document_date<=end&&(!date(row.nutrition_plan?.received_on)||row.nutrition_plan.received_on<=end));
  if(!eligible.length)return result('empty','Nenhum plano alimentar documentado recebido até esta data.');
  const newest=eligible.map(row=>row.document_date).sort().at(-1),latest=eligible.filter(row=>row.document_date===newest);
  if(latest.length!==1)return result('invalid','Há versões ambíguas do plano mais recente; nenhuma versão foi escolhida.');
  const plan=documentedNutritionPlan(latest[0]);
  if(!plan)return result('invalid','A origem ou o conteúdo do plano mais recente não passou na conferência; nenhuma versão anterior foi usada.');
  if(eligible.filter(row=>text(row.source_record_id)===plan.sourceRecordId).length!==1)return result('invalid','A identidade do plano está duplicada; nenhuma versão foi escolhida.');
  return result('ready',null,plan);
}
export function documentedNutritionPlanForDate(rows,asOfDate,status){return selectDocumentedNutritionPlan(rows,asOfDate,status).plan;}
