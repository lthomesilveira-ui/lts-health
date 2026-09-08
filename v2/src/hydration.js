import {day,num,norm} from './core.js';

const datePattern=/^\d{4}-\d{2}-\d{2}$/;

export function validLocalDate(value){
  const date=String(value||'').trim();
  if(!datePattern.test(date))return false;
  const[y,m,d]=date.split('-').map(Number),check=new Date(Date.UTC(y,m-1,d));
  return check.getUTCFullYear()===y&&check.getUTCMonth()===m-1&&check.getUTCDate()===d;
}

export function normalizeWaterMl(value){
  if(value===null||value===undefined||String(value).trim()==='')throw new Error('water_required');
  let raw=String(value).trim().replace(/\s/g,'');
  if(raw.includes(','))raw=raw.replace(/\./g,'').replace(',','.');
  else if(/^\d{1,3}(\.\d{3})+$/.test(raw))raw=raw.replace(/\./g,'');
  const parsed=Number(raw);
  if(!Number.isFinite(parsed))throw new Error('invalid_number');
  if(parsed<=0)throw new Error('water_must_be_positive');
  if(parsed>100000)throw new Error('water_value_too_large');
  return Math.round(parsed);
}

function addValue(map,date,value,source){
  if(!date||value==null||value<=0)return;
  if(!map.has(date))map.set(date,[]);
  map.get(date).push({value,source});
}

export function hydrationModel(data={}){
  const byDate=new Map();
  const nutritionGroups=new Map();
  for(const row of data.nutrition||[]){
    const date=day(row?.nutrition_date);
    if(!date)continue;
    if(!nutritionGroups.has(date))nutritionGroups.set(date,[]);
    nutritionGroups.get(date).push(row);
  }
  for(const[date,rows]of nutritionGroups){
    if(rows.length!==1)continue;
    addValue(byDate,date,num(rows[0]?.water_ml),String(rows[0]?.source||'Nutrição importada'));
  }

  const sourceGroups=new Map();
  for(const row of data.sourceMetrics||[]){
    if(norm(row?.source_family)!=='myfitnesspal'||row?.metric_type!=='dietary_water_ml'||norm(row?.canonical_status)!=='canonical'||norm(row?.unit)!=='ml')continue;
    const date=day(row?.metric_date),value=num(row?.value);
    if(!date||value==null||value<=0)continue;
    if(!sourceGroups.has(date))sourceGroups.set(date,[]);
    sourceGroups.get(date).push({value,source:String(row?.source_name||'MyFitnessPal')});
  }
  for(const[date,rows]of sourceGroups){
    const values=[...new Set(rows.map(row=>row.value))];
    if(values.length===1)addValue(byDate,date,values[0],rows[0].source);
    else addValue(byDate,date,NaN,'conflito');
  }

  const rows=[],conflicts=[];
  for(const[date,items]of byDate){
    const values=[...new Set(items.map(item=>item.value).filter(Number.isFinite))];
    const hasInvalid=items.some(item=>!Number.isFinite(item.value));
    if(hasInvalid||values.length!==1){conflicts.push({date,count:items.length});continue;}
    rows.push({date,value:values[0],source:items.map(item=>item.source).filter(Boolean).join(' + ')});
  }
  rows.sort((a,b)=>a.date.localeCompare(b.date));
  conflicts.sort((a,b)=>a.date.localeCompare(b.date));
  return{rows,conflicts};
}

export function hydrationRows(data={}){return hydrationModel(data).rows;}
