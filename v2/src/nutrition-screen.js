import {state,esc,fmtDate,fmtNum,num,since,day,unique} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const empty=text=>`<div class="empty">${esc(text)}</div>`;
const avg=(rows,key)=>{const vals=rows.map(r=>num(r[key])).filter(v=>v!=null);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;};
const sum=(rows,key)=>rows.map(r=>num(r[key])).filter(v=>v!=null).reduce((a,b)=>a+b,0);
const failed=key=>state.domainStatus[key]==='error';
const yearOf=v=>String(v||'').slice(0,4);
const monthOf=v=>String(v||'').slice(0,7);
const monthLabel=v=>{if(!v)return'—';const[y,m]=v.split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{month:'short',year:'2-digit'}).format(new Date(y,m-1,1));};
const mfpMetricLabels={dietary_energy_kcal:['Calorias','kcal'],dietary_protein_g:['Proteína','g'],dietary_carbs_g:['Carboidratos','g'],dietary_fat_g:['Gorduras','g'],dietary_fiber_g:['Fibras','g']};
const mfpMetricTypes=new Set(Object.keys(mfpMetricLabels));
const candidateStatuses=new Set(['candidate','held']);

function allNutrition(){return[...(state.data.nutrition||[])].sort((a,b)=>String(b.nutrition_date).localeCompare(String(a.nutrition_date)));}
function nutritionDayGroups(rows=[]){
  const groups=new Map();
  for(const row of rows){const date=day(row?.nutrition_date);if(!date)continue;if(!groups.has(date))groups.set(date,[]);groups.get(date).push(row);}
  return [...groups.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([date,items])=>({date,items,row:items.length===1?items[0]:null,ambiguous:items.length!==1}));
}
function unambiguousNutrition(rows=[]){return nutritionDayGroups(rows).filter(group=>!group.ambiguous).map(group=>group.row);}
function availableYears(all){return unique(all.map(r=>yearOf(r.nutrition_date))).filter(Boolean).sort((a,b)=>b.localeCompare(a));}
function historyYears(all){
  const values=availableYears(all).map(Number).filter(Number.isFinite);if(!values.length)return[];
  const min=Math.min(...values),max=Math.max(...values),out=[];for(let y=max;y>=min;y--)out.push(String(y));return out;
}
function coverageByYear(all){
  const map={};
  for(const row of all){const y=yearOf(row.nutrition_date);if(!y)continue;if(!map[y])map[y]={dates:new Set(),first:row.nutrition_date,last:row.nutrition_date};map[y].dates.add(day(row.nutrition_date));if(row.nutrition_date<map[y].first)map[y].first=row.nutrition_date;if(row.nutrition_date>map[y].last)map[y].last=row.nutrition_date;}
  return Object.fromEntries(Object.entries(map).map(([year,item])=>[year,{count:item.dates.size,first:item.first,last:item.last}]));
}
function periodRows(all){
  const p=state.ui.nutritionPeriod||'90';
  if(p==='all'){
    const years=availableYears(all);if(!state.ui.nutritionYear||!years.includes(state.ui.nutritionYear))state.ui.nutritionYear=years[0]||null;
    return state.ui.nutritionYear?all.filter(r=>yearOf(r.nutrition_date)===state.ui.nutritionYear):all;
  }
  const cut=since(Number(p));return all.filter(r=>day(r.nutrition_date)>=cut);
}
function calendarCoverage(rows,period){
  const dates=new Set(rows.map(r=>day(r.nutrition_date)).filter(Boolean));
  let expected=0;
  if(period==='all'){
    const year=Number(state.ui.nutritionYear),now=new Date(),currentYear=now.getFullYear();
    if(Number.isFinite(year)){
      const start=new Date(year,0,1,12),end=year===currentYear?new Date(now.getFullYear(),now.getMonth(),now.getDate(),12):new Date(year,11,31,12);
      if(year<=currentYear)expected=Math.floor((end-start)/86400000)+1;
    }
  }else expected=Math.max(0,Number(period)||0);
  const recorded=expected?Math.min(dates.size,expected):dates.size,missing=Math.max(0,expected-recorded),pct=expected?Math.round(recorded/expected*100):null;
  return{recorded,expected,missing,pct};
}
function mealsFor(date){return (state.data.meals||[]).filter(m=>day(m.meal_date)===date).sort((a,b)=>String(a.meal_name||'').localeCompare(String(b.meal_name||''),'pt-BR'));}
function monthlySummary(rows){
  const map=new Map();
  for(const row of rows){const key=monthOf(row.nutrition_date);if(!key)continue;if(!map.has(key))map.set(key,{key,rows:[]});map.get(key).rows.push(row);}
  return [...map.values()].sort((a,b)=>a.key.localeCompare(b.key)).map(group=>({key:group.key,count:new Set(group.rows.map(r=>day(r.nutrition_date))).size,calories:avg(group.rows,'calories_kcal'),protein:avg(group.rows,'protein_g'),carbs:avg(group.rows,'carbs_g'),fat:avg(group.rows,'fat_g')}));
}
function mealDistribution(rows){
  if(failed('meals'))return null;
  const dates=new Set(rows.map(r=>day(r.nutrition_date)).filter(Boolean)),map=new Map();
  for(const meal of state.data.meals||[]){if(!dates.has(day(meal.meal_date)))continue;const label=String(meal.meal_name||'Refeição').trim()||'Refeição',key=label.toLocaleLowerCase('pt-BR');if(!map.has(key))map.set(key,{label,count:0,calories:0,withCalories:0});const item=map.get(key);item.count++;const kcal=num(meal.calories_kcal);if(kcal!=null){item.calories+=kcal;item.withCalories++;}}
  return [...map.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'pt-BR')).slice(0,10);
}
function monthlyPanel(rows){
  const months=monthlySummary(rows);if(!months.length)return empty('Não há meses com dados comparáveis neste período.');
  const maxDays=Math.max(1,...months.map(m=>m.count));
  return `<div class="nutritionTrend">${months.slice(-18).map(m=>`<div class="nutritionMonth"><div class="nutritionMonthHead"><b>${esc(monthLabel(m.key))}</b><span>${m.count} dia(s)</span></div><div class="nutritionMonthTrack"><i style="width:${Math.max(4,Math.round(m.count/maxDays*100))}%"></i></div><div class="nutritionMonthStats"><span>${m.calories==null?'kcal —':`${fmtNum(m.calories,0)} kcal/dia`}</span><span>${m.protein==null?'proteína —':`${fmtNum(m.protein,0)} g proteína/dia`}</span></div></div>`).join('')}</div><p class="footerNote">Cada linha usa somente dias com um único total diário. Datas com totais repetidos ficam fora das médias até revisão.</p>`;
}
function distributionPanel(rows){
  const distribution=mealDistribution(rows);if(distribution===null)return `<div class="errorState"><b>Os detalhes das refeições estão indisponíveis agora.</b><span>Os totais diários continuam disponíveis.</span></div>`;
  if(!distribution.length)return empty('Não há refeições estruturadas neste período.');
  const max=Math.max(1,...distribution.map(x=>x.count));
  return `<div class="mealDistribution">${distribution.map(x=>`<div class="mealDistributionRow"><div><b>${esc(x.label)}</b><small>${x.count} registro(s)${x.withCalories?` · média ${fmtNum(x.calories/x.withCalories,0)} kcal nos itens com valor`:''}</small></div><div class="mealDistributionTrack"><i style="width:${Math.max(4,Math.round(x.count/max*100))}%"></i></div></div>`).join('')}</div><p class="footerNote">A frequência mostra quantas entradas existem no histórico importado. Ela não mede qualidade da alimentação nem regularidade de refeições.</p>`;
}
function mfpCandidateGroups(){
  if(failed('sourceMetrics'))return null;
  const rows=(state.data.sourceMetrics||[]).filter(row=>String(row?.source_family||'').toLowerCase()==='myfitnesspal'&&candidateStatuses.has(String(row?.canonical_status||'').toLowerCase())&&mfpMetricTypes.has(String(row?.metric_type||''))&&num(row?.value)!=null&&/^\d{4}-\d{2}-\d{2}$/.test(String(row?.metric_date||'')));
  const groups=new Map();
  for(const row of rows){
    const date=String(row.metric_date),type=String(row.metric_type);
    if(!groups.has(date))groups.set(date,{date,values:{},counts:{},sources:new Set()});
    const group=groups.get(date);
    group.counts[type]=(group.counts[type]||0)+1;
    if(group.counts[type]===1)group.values[type]=num(row.value);else delete group.values[type];
    if(row.source_name)group.sources.add(String(row.source_name));
  }
  return [...groups.values()].map(group=>({...group,ambiguousTypes:new Set(Object.entries(group.counts).filter(([,count])=>count>1).map(([type])=>type))})).sort((a,b)=>b.date.localeCompare(a.date));
}
function mfpCandidatePanel(){
  const groups=mfpCandidateGroups();
  if(groups===null)return `<div class="card sectionGap mfpCandidatePanel"><div class="cardHead"><div><b>MyFitnessPal via Apple Saúde</b><small>Totais diários separados da alimentação principal.</small></div><span class="pill">em validação</span></div><div class="errorState"><b>Não foi possível verificar estes totais agora.</b><span>A alimentação principal continua disponível e nenhum valor ausente é tratado como zero.</span></div></div>`;
  const rows=groups.slice(0,30).map(group=>{
    const calories=group.values.dietary_energy_kcal,caloriesAmbiguous=group.ambiguousTypes.has('dietary_energy_kcal');
    const macros=[['dietary_protein_g','P'],['dietary_carbs_g','C'],['dietary_fat_g','G'],['dietary_fiber_g','Fibra']].map(([type,label])=>group.ambiguousTypes.has(type)?`${label} em revisão`:group.values[type]!=null?`${fmtNum(group.values[type],0)}g ${label}`:null).filter(Boolean);
    const source=[...group.sources].join(', ')||'MyFitnessPal',review=group.ambiguousTypes.size?' · valores repetidos para revisão':'';
    return `<div class="mealRow mfpCandidateDay"><div><b>${fmtDate(group.date)}</b><small>${esc(source)}${esc(review)}</small></div><span>${caloriesAmbiguous?'calorias em revisão':calories!=null?`${fmtNum(calories,0)} kcal`:'calorias não disponíveis'}</span><em>${macros.join(' · ')||'macros não disponíveis'}</em></div>`;
  }).join('');
  return `<div class="card sectionGap mfpCandidatePanel"><div class="cardHead"><div><b>MyFitnessPal via Apple Saúde</b><small>Totais diários preservados por origem. Não entram nas médias nem no histórico principal até validação.</small></div><span class="pill">em validação</span></div>${rows?`<div class="mealList">${rows}</div><p class="footerNote">Estes dados não criam alimentos, refeições ou horários. Quando há mais de um candidato para a mesma métrica no mesmo dia, nenhum valor é escolhido ou somado automaticamente. O export direto do MyFitnessPal continua sendo a fonte preferida para histórico detalhado.</p>`:empty('Nenhum total diário do MyFitnessPal via Apple Saúde aguardando validação.')}</div>`;
}
function daySummary(row){
  if(!row)return empty('Selecione um dia com registro.');
  if(failed('meals'))return `<div class="nutritionDayHead"><div><span>${fmtDate(row.nutrition_date)}</span><b>${num(row.calories_kcal)!=null?`${fmtNum(row.calories_kcal,0)} kcal`:'calorias não registradas'}</b><small>${esc(row.source||'origem registrada')}</small></div></div><div class="macroGrid"><div><span>Proteína</span><b>${num(row.protein_g)!=null?`${fmtNum(row.protein_g,0)} g`:'—'}</b></div><div><span>Carboidratos</span><b>${num(row.carbs_g)!=null?`${fmtNum(row.carbs_g,0)} g`:'—'}</b></div><div><span>Gorduras</span><b>${num(row.fat_g)!=null?`${fmtNum(row.fat_g,0)} g`:'—'}</b></div><div><span>Fibras</span><b>${num(row.fiber_g)!=null?`${fmtNum(row.fiber_g,0)} g`:'—'}</b></div></div><div class="errorState"><b>Os detalhes das refeições estão indisponíveis agora.</b><span>O total diário continua visível; tente atualizar para carregar as refeições.</span></div>`;
  const meals=mealsFor(row.nutrition_date),mealCalories=sum(meals,'calories_kcal');
  return `<div class="nutritionDayHead"><div><span>${fmtDate(row.nutrition_date)}</span><b>${num(row.calories_kcal)!=null?`${fmtNum(row.calories_kcal,0)} kcal`:'calorias não registradas'}</b><small>${esc(row.source||'origem registrada')}</small></div></div>
    <div class="macroGrid">
      <div><span>Proteína</span><b>${num(row.protein_g)!=null?`${fmtNum(row.protein_g,0)} g`:'—'}</b></div>
      <div><span>Carboidratos</span><b>${num(row.carbs_g)!=null?`${fmtNum(row.carbs_g,0)} g`:'—'}</b></div>
      <div><span>Gorduras</span><b>${num(row.fat_g)!=null?`${fmtNum(row.fat_g,0)} g`:'—'}</b></div>
      <div><span>Fibras</span><b>${num(row.fiber_g)!=null?`${fmtNum(row.fiber_g,0)} g`:'—'}</b></div>
    </div>
    <div class="mealList"><div class="cardHead"><div><b>Refeições registradas</b><small>${meals.length} item(ns) encontrado(s) para o dia.</small></div></div>${meals.map(m=>`<div class="mealRow"><div><b>${esc(m.meal_name||'Refeição')}</b><small>${esc(m.source||'origem registrada')}</small></div><span>${num(m.calories_kcal)!=null?`${fmtNum(m.calories_kcal,0)} kcal`:'—'}</span><em>${[num(m.protein_g)!=null?`${fmtNum(m.protein_g,0)}g P`:null,num(m.carbs_g)!=null?`${fmtNum(m.carbs_g,0)}g C`:null,num(m.fat_g)!=null?`${fmtNum(m.fat_g,0)}g G`:null].filter(Boolean).join(' · ')}</em></div>`).join('')||empty('Não há refeições estruturadas para este dia.')}</div>
    ${meals.length&&num(row.calories_kcal)!=null?`<p class="footerNote">A soma das refeições estruturadas é ${fmtNum(mealCalories,0)} kcal; ela pode diferir do total diário quando o export contém registros incompletos ou agregações diferentes.</p>`:''}`;
}
function daySummaryGroup(group){
  if(!group)return empty('Selecione um dia com registro.');
  if(!group.ambiguous)return daySummary(group.row);
  const sources=unique(group.items.map(row=>String(row.source||'').trim()).filter(Boolean));
  return `<div class="nutritionDayHead"><div><span>${fmtDate(group.date)}</span><b>Totais do dia em revisão</b><small>${group.items.length} registros diários preservados${sources.length?` · ${esc(sources.join(', '))}`:''}</small></div></div><div class="errorState"><b>Nenhum total foi escolhido.</b><span>Há mais de um total diário para esta data. Esses valores ficam fora das médias até revisão.</span></div>`;
}

export function renderNutritionHub(){
  if(failed('nutrition'))return `${title('Nutrição','Histórico de alimentação registrado.')}<div class="errorState"><b>Os dados de alimentação não carregaram agora.</b><span>O app não substitui essa falha por dias ou valores zerados. Tente atualizar.</span></div>`;
  const all=allNutrition(),years=availableYears(all),spanYears=historyYears(all),coverage=coverageByYear(all),p=state.ui.nutritionPeriod||'90',rawRows=periodRows(all),dayGroups=nutritionDayGroups(rawRows),rows=unambiguousNutrition(rawRows),calendar=calendarCoverage(rawRows,p);
  if(!state.ui.nutritionDate||!dayGroups.some(group=>group.date===state.ui.nutritionDate))state.ui.nutritionDate=dayGroups[0]?.date||null;
  const selected=dayGroups.find(group=>group.date===state.ui.nutritionDate),range=dayGroups.length?`${fmtDate(dayGroups.at(-1).date)} → ${fmtDate(dayGroups[0].date)}`:'sem registros';
  const visible=dayGroups.slice(0,370),coverageText=calendar.expected?`${calendar.recorded} de ${calendar.expected} dias`:calendar.recorded?`${calendar.recorded} dias registrados`:'sem dias registrados',coverageSub=calendar.expected?`${calendar.pct}% coberto · ${calendar.missing} dia(s) sem registro`:'Sem período comparável';
  return `${title('Nutrição','Histórico de alimentação registrado. Médias usam somente dias com um total diário inequívoco; dias ausentes ou em revisão não viram zero.')}
    <div class="controls"><select id="nutritionPeriod"><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="all">Navegar por ano</option></select>${p==='all'?`<select id="nutritionYear">${years.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join('')}</select>`:''}</div>
    <div class="grid cols4 sectionGap">
      <div class="card metric"><span>Dias registrados</span><strong>${dayGroups.length}</strong><em>${esc(range)}</em></div>
      <div class="card metric"><span>Cobertura do período</span><strong>${esc(coverageText)}</strong><em>${esc(coverageSub)}</em></div>
      <div class="card metric"><span>Calorias · média</span><strong>${avg(rows,'calories_kcal')==null?'—':fmtNum(avg(rows,'calories_kcal'),0)}</strong><em>kcal nos dias comparáveis</em></div>
      <div class="card metric"><span>Proteína · média</span><strong>${avg(rows,'protein_g')==null?'—':fmtNum(avg(rows,'protein_g'),0)}</strong><em>g nos dias comparáveis</em></div>
    </div>
    ${mfpCandidatePanel()}
    <div class="grid split sectionGap">
      <div class="card"><div class="cardHead"><div><b>Evolução por mês</b><small>Cobertura e médias dos registros disponíveis.</small></div></div>${monthlyPanel(rows)}</div>
      <div class="card"><div class="cardHead"><div><b>Refeições mais registradas</b><small>Distribuição descritiva das entradas importadas.</small></div></div>${distributionPanel(rawRows)}</div>
    </div>
    <div class="grid split sectionGap">
      <div class="card"><div class="cardHead"><div><b>Dias com registro</b><small>${p==='all'?`Ano ${esc(state.ui.nutritionYear||'')}.`:'Mais recente primeiro.'}</small></div><span class="pill">${visible.length}${dayGroups.length>visible.length?' de '+dayGroups.length:''}</span></div><div class="nutritionDays">${visible.map(group=>group.ambiguous?`<button type="button" data-nutrition-date="${esc(group.date)}" class="${group.date===state.ui.nutritionDate?'active':''}"><time>${fmtDate(group.date)}</time><div><b>Em revisão</b><small>Mais de um total diário; nenhum valor foi escolhido.</small></div></button>`:`<button type="button" data-nutrition-date="${esc(group.date)}" class="${group.date===state.ui.nutritionDate?'active':''}"><time>${fmtDate(group.date)}</time><div><b>${num(group.row.calories_kcal)!=null?`${fmtNum(group.row.calories_kcal,0)} kcal`:'calorias não registradas'}</b><small>${[num(group.row.protein_g)!=null?`${fmtNum(group.row.protein_g,0)}g proteína`:null,num(group.row.carbs_g)!=null?`${fmtNum(group.row.carbs_g,0)}g carbo`:null,num(group.row.fat_g)!=null?`${fmtNum(group.row.fat_g,0)}g gordura`:null].filter(Boolean).join(' · ')}</small></div></button>`).join('')||empty('Nenhum dia registrado neste período.')}</div></div>
      <div class="card"><div class="cardHead"><div><b>Detalhe do dia</b><small>Valores preservados do histórico importado.</small></div></div>${daySummaryGroup(selected)}</div>
    </div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Cobertura do histórico</b><small>Os anos sem registros ficam visíveis como lacunas; ausência de registro não significa consumo zero.</small></div></div><div class="yearGrid">${spanYears.map(y=>{const c=coverage[y];return c?`<button type="button" data-nutrition-year="${esc(y)}" class="${p==='all'&&state.ui.nutritionYear===y?'active':''}"><b>${esc(y)}</b><span>${c.count} dias registrados</span><small>${fmtDate(c.first)} → ${fmtDate(c.last)}</small></button>`:`<div class="yearGap"><b>${esc(y)}</b><span>sem registros disponíveis</span><small>Nenhum dia importado neste ano.</small></div>`;}).join('')||empty('Sem histórico anual.')}</div></div>`;
}
