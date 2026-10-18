import {nutritionPeriodModel} from './home-period-model.js';
import {nutritionSourceReview} from './nutrition-source-review.js';

const norm=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const validDay=value=>{const text=String(value||'');if(!/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(text))return null;const date=text.slice(0,10);const parsed=new Date(`${date}T12:00:00Z`);return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:null;};
const localToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const ready=(status,key)=>status?.[key]==='ready';
const unique=values=>[...new Set(values)].sort();
export const nutritionArchiveSourceKey=label=>JSON.stringify(['nutrition',norm(label),'canonical']);

/** Full read-only archive; summary windows never remove selectable old dates.
 * Source identity includes the domain. Same-labelled metric mirrors cannot inherit meals.
 */
export function nutritionArchiveModel(data={},status={},ui={},today=localToday()){
  const history=nutritionPeriodModel(data,status,{},ui,today),catalog=new Map();
  for(const source of history.sources)catalog.set(source.key,{...source,dates:new Set([...source.receivedDates,...source.rows.map(row=>row.date),...source.duplicates.map(row=>row.date)]),dailyRecords:[],metricRecords:[],meals:[]});
  for(const [domain,dateField] of [['nutrition','nutrition_date'],['meals','meal_date']])if(ready(status,domain))for(const row of data[domain]||[]){
    const date=validDay(row[dateField]),label=String(row.source||'').trim();if(!date||date>today||!label)continue;
    const key=nutritionArchiveSourceKey(label);
    if(!catalog.has(key))catalog.set(key,{key,label,domain:'nutrition',status:'canonical',rows:[],duplicates:[],dates:new Set(),dailyRecords:[],metricRecords:[],meals:[]});
    const source=catalog.get(key);source.dates.add(date);source[domain==='nutrition'?'dailyRecords':'meals'].push(row);
  }
  if(ready(status,'sourceMetrics'))for(const row of data.sourceMetrics||[]){
    if(!['dietary_energy_kcal','dietary_protein_g','dietary_carbohydrates_g','dietary_carbs_g','dietary_fat_g','dietary_fiber_g'].includes(row.metric_type))continue;
    const review=nutritionSourceReview(row),key=JSON.stringify(['sourceMetrics',norm(row.source_family),norm(row.source_name||row.source),norm(row.canonical_status),...(review.verified?[review.sourceHash]:[])]),source=catalog.get(key);
    if(source)source.metricRecords.push(row);
  }
  const sources=[...catalog.values()].map(source=>({...source,dates:[...source.dates].sort()})).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR')||a.key.localeCompare(b.key));
  const requested=ui.homeNutritionSource||ui.reportNutritionSource||null;
  let source=requested?sources.find(item=>item.key===requested):sources.find(item=>item.key===history.source?.key);
  if(requested&&!source){const matches=sources.filter(item=>norm(item.label)===norm(requested));if(matches.length===1)source=matches[0];}
  if(!requested&&!source)source=sources.slice().sort((a,b)=>(b.dates.at(-1)||'').localeCompare(a.dates.at(-1)||'')||a.key.localeCompare(b.key))[0];
  const requestedDate=validDay(ui.nutritionDate),dateRequest=requestedDate&&requestedDate<=today?requestedDate:null;
  const year=String(ui.nutritionYear||dateRequest?.slice(0,4)||source?.dates.at(-1)?.slice(0,4)||'');
  const yearDates=(source?.dates||[]).filter(date=>date.slice(0,4)===year),months=unique(yearDates.map(date=>date.slice(0,7)));
  const month=String(ui.nutritionMonth||(dateRequest?.slice(0,4)===year?dateRequest.slice(0,7):null)||months.at(-1)||'');
  const dates=yearDates.filter(date=>date.slice(0,7)===month),date=dateRequest||dates.at(-1)||null;
  const food=source?.rows.find(row=>row.date===date)||null;
  const dailyRecords=(source?.dailyRecords||[]).filter(row=>validDay(row.nutrition_date)===date);
  const metricRecords=(source?.metricRecords||[]).filter(row=>validDay(row.metric_date)===date);
  const meals=source?.domain==='nutrition'&&ready(status,'meals')?(source.meals||[]).filter(row=>validDay(row.meal_date)===date&&norm(row.source)===norm(source.label)):[];
  const duplicates=(source?.duplicates||[]).filter(row=>row.date===date);
  const otherSources=date?sources.filter(item=>item.key!==source?.key&&item.dates.includes(date)):[];
  return {sources,source:source||null,requestedSource:requested,requestedSourceMissing:Boolean(requested&&!source),today,
    years:unique((source?.dates||[]).map(date=>date.slice(0,4))).reverse(),year,months:months.reverse(),month,dates:dates.slice().reverse(),date,requestedDate:dateRequest,
    food,dailyRecords,metricRecords,meals,duplicates,otherSources,firstDate:source?.dates[0]||null,lastDate:source?.dates.at(-1)||null,
    unavailable:['nutrition','sourceMetrics','meals'].filter(key=>!ready(status,key)),hasDate:Boolean(date&&source?.dates.includes(date))};
}

/** Explicit UI actions only; rendering never rewrites an absent source or day. */
export function nutritionArchiveSelection(archive,field,value){
  if(field==='source'&&archive.sources.some(source=>source.key===value))return {homeNutritionSource:value,reportNutritionSource:value};
  if(field==='year'&&archive.years.includes(value))return {nutritionYear:value,nutritionMonth:null,nutritionDate:null};
  if(field==='month'&&archive.months.includes(value))return {nutritionYear:value.slice(0,4),nutritionMonth:value,nutritionDate:null};
  const date=validDay(value);
  if(field==='date'&&date&&date<=archive.today)return {nutritionYear:date.slice(0,4),nutritionMonth:date.slice(0,7),nutritionDate:date};
  return null;
}

/** A timeline target must match a loaded source and date, never a display alias. */
export function nutritionTimelineSelection(data,status,sourceKey,date,recordId='',today=localToday()){
  date=validDay(date);if(!ready(status,'nutrition')||!date||date>today||!sourceKey)return null;
  const rows=(data.nutrition||[]).filter(row=>validDay(row.nutrition_date)===date&&String(row.source||'').trim()&&nutritionArchiveSourceKey(row.source)===sourceKey&&(!recordId||row.source_record_id===recordId));
  return rows.length?{homeNutritionSource:sourceKey,reportNutritionSource:sourceKey,nutritionDate:date,nutritionYear:date.slice(0,4),nutritionMonth:date.slice(0,7)}:null;
}
