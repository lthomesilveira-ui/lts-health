import {state,esc,fmtDate,fmtNum,num,since,day,unique} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const empty=text=>`<div class="empty">${esc(text)}</div>`;
const avg=(rows,key)=>{const vals=rows.map(r=>num(r[key])).filter(v=>v!=null);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;};
const sum=(rows,key)=>rows.map(r=>num(r[key])).filter(v=>v!=null).reduce((a,b)=>a+b,0);
const failed=key=>state.domainStatus[key]==='error';
const yearOf=v=>String(v||'').slice(0,4);

function allNutrition(){return[...(state.data.nutrition||[])].sort((a,b)=>String(b.nutrition_date).localeCompare(String(a.nutrition_date)));}
function availableYears(all){return unique(all.map(r=>yearOf(r.nutrition_date))).filter(Boolean).sort((a,b)=>b.localeCompare(a));}
function periodRows(all){
  const p=state.ui.nutritionPeriod||'90';
  if(p==='all'){
    const years=availableYears(all);if(!state.ui.nutritionYear||!years.includes(state.ui.nutritionYear))state.ui.nutritionYear=years[0]||null;
    return state.ui.nutritionYear?all.filter(r=>yearOf(r.nutrition_date)===state.ui.nutritionYear):all;
  }
  const cut=since(Number(p));return all.filter(r=>day(r.nutrition_date)>=cut);
}
function mealsFor(date){return (state.data.meals||[]).filter(m=>day(m.meal_date)===date).sort((a,b)=>String(a.meal_name||'').localeCompare(String(b.meal_name||''),'pt-BR'));}
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

export function renderNutritionHub(){
  if(failed('nutrition'))return `${title('Nutrição','Histórico de alimentação registrado.')}<div class="errorState"><b>Os dados de alimentação não carregaram agora.</b><span>O app não substitui essa falha por dias ou valores zerados. Tente atualizar.</span></div>`;
  const all=allNutrition(),years=availableYears(all),p=state.ui.nutritionPeriod||'90',rows=periodRows(all);
  if(!state.ui.nutritionDate||!rows.some(r=>r.nutrition_date===state.ui.nutritionDate))state.ui.nutritionDate=rows[0]?.nutrition_date||null;
  const selected=rows.find(r=>r.nutrition_date===state.ui.nutritionDate),range=rows.length?`${fmtDate(rows.at(-1).nutrition_date)} → ${fmtDate(rows[0].nutrition_date)}`:'sem registros';
  const visible=rows.slice(0,370),coverage=all.reduce((acc,r)=>{const y=yearOf(r.nutrition_date);if(y)acc[y]=(acc[y]||0)+1;return acc;},{});
  return `${title('Nutrição','Histórico de alimentação registrado. Médias usam somente os dias que possuem dados; dias ausentes não são tratados como zero.')}
    <div class="controls"><select id="nutritionPeriod"><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">1 ano</option><option value="all">Navegar por ano</option></select>${p==='all'?`<select id="nutritionYear">${years.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join('')}</select>`:''}</div>
    <div class="grid cols4 sectionGap">
      <div class="card metric"><span>Dias registrados</span><strong>${rows.length}</strong><em>${esc(range)}</em></div>
      <div class="card metric"><span>Calorias · média</span><strong>${avg(rows,'calories_kcal')==null?'—':fmtNum(avg(rows,'calories_kcal'),0)}</strong><em>kcal nos dias com valor</em></div>
      <div class="card metric"><span>Proteína · média</span><strong>${avg(rows,'protein_g')==null?'—':fmtNum(avg(rows,'protein_g'),0)}</strong><em>g nos dias com valor</em></div>
      <div class="card metric"><span>Histórico total</span><strong>${all.length}</strong><em>${years.length?`${years.at(-1)} → ${years[0]}`:'dias estruturados disponíveis'}</em></div>
    </div>
    <div class="grid split sectionGap">
      <div class="card"><div class="cardHead"><div><b>Dias com registro</b><small>${p==='all'?`Ano ${esc(state.ui.nutritionYear||'')}.`:'Mais recente primeiro.'}</small></div><span class="pill">${visible.length}${rows.length>visible.length?' de '+rows.length:''}</span></div><div class="nutritionDays">${visible.map(r=>`<button type="button" data-nutrition-date="${esc(r.nutrition_date)}" class="${r.nutrition_date===state.ui.nutritionDate?'active':''}"><time>${fmtDate(r.nutrition_date)}</time><div><b>${num(r.calories_kcal)!=null?`${fmtNum(r.calories_kcal,0)} kcal`:'calorias não registradas'}</b><small>${[num(r.protein_g)!=null?`${fmtNum(r.protein_g,0)}g proteína`:null,num(r.carbs_g)!=null?`${fmtNum(r.carbs_g,0)}g carbo`:null,num(r.fat_g)!=null?`${fmtNum(r.fat_g,0)}g gordura`:null].filter(Boolean).join(' · ')}</small></div></button>`).join('')||empty('Nenhum dia registrado neste período.')}</div></div>
      <div class="card"><div class="cardHead"><div><b>Detalhe do dia</b><small>Valores preservados do histórico importado.</small></div></div>${daySummary(selected)}</div>
    </div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Cobertura do histórico</b><small>Escolha um ano para navegar pelos registros disponíveis.</small></div></div><div class="yearGrid">${Object.entries(coverage).sort((a,b)=>b[0].localeCompare(a[0])).map(([y,n])=>`<button type="button" data-nutrition-year="${esc(y)}" class="${p==='all'&&state.ui.nutritionYear===y?'active':''}"><b>${esc(y)}</b><span>${n} dias</span></button>`).join('')||empty('Sem histórico anual.')}</div></div>`;
}
