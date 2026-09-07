const text=value=>String(value??'').trim();
const norm=value=>text(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const date=value=>{const m=text(value).match(/^(\d{4}-\d{2}-\d{2})/);return m?.[1]||null;};
const numeric=value=>{if(value==null||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;};
const rounded=value=>Math.round(value*1000)/1000;

function groupByDate(rows,key){
  const groups=new Map();
  for(const row of rows||[]){const d=date(row?.[key]);if(!d)continue;if(!groups.has(d))groups.set(d,[]);groups.get(d).push(row);}
  return groups;
}

export function isDirectMyFitnessPalWeight(row){
  const type=norm(row?.metric_type),source=norm(row?.source),unit=norm(row?.unit),value=numeric(row?.value);
  return type==='weight kg'&&source.includes('myfitnesspal')&&(!unit||unit==='kg')&&value!=null&&value>0;
}

export function consolidatedWeightSeries(bodyRows=[],metricRows=[]){
  const bodyGroups=groupByDate(bodyRows,'measured_at'),mfpGroups=groupByDate((metricRows||[]).filter(isDirectMyFitnessPalWeight),'measured_at');
  const points=[],blockedDates=new Set(),bodyDates=new Set(),overlap={total:0,exact:0,different:0};

  for(const [d,rows] of bodyGroups){
    if(rows.length!==1){blockedDates.add(d);continue;}
    const value=numeric(rows[0]?.weight_kg);
    if(value==null||value<=0)continue;
    bodyDates.add(d);
    const source=text(rows[0]?.source)||'Bioimpedância';
    points.push({date:d,value,source,sourceKind:'body_composition'});
  }

  for(const [d,rows] of mfpGroups){
    const values=[...new Set(rows.map(row=>numeric(row?.value)).filter(v=>v!=null&&v>0).map(rounded))];
    if(bodyDates.has(d)){
      overlap.total++;
      const selected=points.find(point=>point.date===d&&point.sourceKind==='body_composition');
      if(selected&&values.some(value=>Math.abs(value-selected.value)<0.01))overlap.exact++;else overlap.different++;
      continue;
    }
    if(blockedDates.has(d)||values.length!==1){if(values.length>1)blockedDates.add(d);continue;}
    points.push({date:d,value:values[0],source:'MyFitnessPal',sourceKind:'myfitnesspal'});
  }

  points.sort((a,b)=>a.date.localeCompare(b.date));
  const sourceCounts=points.reduce((acc,point)=>{acc[point.sourceKind]=(acc[point.sourceKind]||0)+1;return acc;},{});
  return{points,blockedDates:[...blockedDates].sort(),overlap,sourceCounts,first:points[0]||null,last:points.at(-1)||null};
}

function labOrigin(row){return text(row?.laboratory||row?.source||row?.source_file);}
function labUnit(row){return text(row?.unit);}

export function labNarrativeSeries(rows=[]){
  const groups=new Map();
  for(const row of rows||[]){
    const key=norm(row?.biomarker),value=numeric(row?.result_numeric),d=date(row?.collection_date),origin=labOrigin(row),unit=labUnit(row);
    if(!key||value==null||!d||!origin||!unit)continue;
    if(!groups.has(key))groups.set(key,{key,label:text(row.biomarker),cohorts:new Map()});
    const group=groups.get(key),cohortKey=`${norm(origin)}__${norm(unit)}`;
    if(!group.cohorts.has(cohortKey))group.cohorts.set(cohortKey,{origin,unit,byDate:new Map()});
    const cohort=group.cohorts.get(cohortKey);if(!cohort.byDate.has(d))cohort.byDate.set(d,[]);cohort.byDate.get(d).push({date:d,value,row});
  }

  const output=[];
  for(const group of groups.values()){
    const series=[];
    for(const cohort of group.cohorts.values()){
      const points=[...cohort.byDate.entries()].filter(([,items])=>items.length===1).map(([,items])=>items[0]).sort((a,b)=>a.date.localeCompare(b.date));
      const ambiguousDates=[...cohort.byDate.entries()].filter(([,items])=>items.length>1).map(([d])=>d).sort();
      if(points.length<2)continue;
      const first=points[0],last=points.at(-1);
      series.push({origin:cohort.origin,unit:cohort.unit,points,ambiguousDates,first,last,delta:last.value-first.value});
    }
    if(!series.length)continue;
    series.sort((a,b)=>b.points.length-a.points.length||b.last.date.localeCompare(a.last.date)||a.origin.localeCompare(b.origin,'pt-BR'));
    const best=series[0];
    output.push({key:group.key,label:group.label,seriesCount:series.length,best,pointCount:best.points.length,firstDate:best.first.date,lastDate:best.last.date,lastValue:best.last.value,delta:best.delta,unit:best.unit,origin:best.origin});
  }
  return output.sort((a,b)=>b.pointCount-a.pointCount||b.lastDate.localeCompare(a.lastDate)||a.label.localeCompare(b.label,'pt-BR'));
}

export function sampleSeries(points=[],limit=72){
  if(points.length<=limit)return [...points];
  const result=[],used=new Set();
  for(let i=0;i<limit;i++){const index=Math.round(i*(points.length-1)/(limit-1));if(used.has(index))continue;used.add(index);result.push(points[index]);}
  return result;
}
