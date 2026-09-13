import {state,esc,fmtDate,fmtNum,num,workoutRows,day} from './core.js';

const latest=(rows,key)=>[...(rows||[])].filter(row=>row?.[key]).sort((a,b)=>String(a[key]).localeCompare(String(b[key]))).at(-1)||null;
const safe=(value,fallback='—')=>value==null||value===''?fallback:value;
const dateKey=value=>day(value);

function displayName(){
  const metadata=state.session?.user?.user_metadata||{};
  const raw=metadata.full_name||metadata.name||metadata.display_name||'';
  return String(raw).trim().split(/\s+/)[0]||'';
}
function greeting(){const hour=new Date().getHours();const base=hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';const name=displayName();return name?`${base}, ${name}`:base;}
function longDate(value=new Date()){try{return new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(value).replace(/^./,letter=>letter.toUpperCase());}catch{return'';}}
function comparableBody(){const rows=[...(state.data.body||[])].filter(row=>row?.measured_at&&num(row.weight_kg)!=null).sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at)));const anchor=rows.at(-1)||null;if(!anchor)return[];const source=anchor.source||null;const coherent=source?rows.filter(row=>row.source===source):rows.length===1?rows:[];const unique=[];const seen=new Set();for(const row of coherent){const key=dateKey(row.measured_at);if(!key||seen.has(key))continue;seen.add(key);unique.push(row);}return unique;}
function metricDelta(rows,key,digits=1,unit=''){const current=rows.at(-1)||null,prior=rows.at(-2)||null;const a=num(current?.[key]),b=num(prior?.[key]);if(a==null||b==null)return{value:'—',label:'sem comparação'};const delta=a-b;return{value:`${delta>0?'+':''}${fmtNum(delta,digits)}${unit}`,label:'vs. medição anterior'};}
function metricCard(label,value,delta,route='bio'){const direction=String(delta.value).startsWith('+')?'↑':String(delta.value).startsWith('-')?'↓':'•';return `<button class="ltsRefMetric" data-route="${route}"><span>${esc(label)}</span><strong>${esc(value)}</strong><div><b>${direction} ${esc(delta.value)}</b><small>${esc(delta.label)}</small></div></button>`;}
function latestWater(){return[...(state.data.nutrition||[])].filter(row=>num(row.water_ml)>0&&row?.nutrition_date).sort((a,b)=>String(a.nutrition_date).localeCompare(String(b.nutrition_date))).at(-1)||null;}
function treatmentRows(){return[...(state.data.treatments||[])].filter(row=>row?.event_date&&row?.medication).sort((a,b)=>String(b.event_date).localeCompare(String(a.event_date)));}
function statusIcon(kind){return `<span class="ltsRefTodayIcon ${kind}" aria-hidden="true">${kind==='training'?'↔':kind==='medication'?'✦':kind==='water'?'◌':'⌁'}</span>`;}
function statusRow({kind,title,subtitle,route,entry=false,current=false}){const attrs=entry?`data-entry="${entry}"`:`data-route="${route}"`;const stateClass=entry?'entry':current?'current':'historical';const stateMark=entry?'+':current?'✓':'›';return `<button class="ltsRefTodayRow" ${attrs}>${statusIcon(kind)}<span class="ltsRefTodayCopy"><b>${esc(title)}</b><small>${esc(subtitle)}</small></span><span class="ltsRefTodayState ${stateClass}" aria-hidden="true">${stateMark}</span></button>`;}
function uniqueDays(rows,key,predicate=()=>true,anchor=new Date()){const end=new Date(anchor);end.setHours(23,59,59,999);const start=new Date(end);start.setDate(start.getDate()-6);start.setHours(0,0,0,0);const set=new Set();for(const row of rows||[]){if(!predicate(row))continue;const raw=row?.[key];if(!raw)continue;const parsed=new Date(String(raw).length===10?`${raw}T12:00:00`:raw);if(Number.isNaN(parsed.getTime())||parsed<start||parsed>end)continue;set.add(dateKey(raw));}return Math.min(7,set.size);}
function progressRing(label,count,kind){const percent=Math.max(0,Math.min(100,(count/7)*100));return `<div class="ltsRefProgressItem ${kind}"><div class="ltsRefRing" style="--progress:${percent}%"><span><b>${count}/7</b></span></div><small>${esc(label)}</small></div>`;}
function recentRow(kind,label,row,dateField,detail,route){if(!row)return'';return `<button class="ltsRefRecentRow" data-route="${route}">${statusIcon(kind)}<span><small>${esc(label)}</small><b>${esc(detail)}</b><em>${esc(fmtDate(row[dateField]))}</em></span><strong aria-hidden="true">›</strong></button>`;}

export function renderProductHomeReference(){
  const bodyRows=comparableBody(),body=bodyRows.at(-1)||null;
  const workouts=workoutRows(),workout=workouts[0]||null;
  const nutrition=latest(state.data.nutrition,'nutrition_date');
  const water=latestWater();
  const treatments=treatmentRows();
  const weight=num(body?.weight_kg),fat=num(body?.body_fat_pct),muscle=num(body?.skeletal_muscle_mass_kg);
  const weightDelta=metricDelta(bodyRows,'weight_kg',1,' kg'),fatDelta=metricDelta(bodyRows,'body_fat_pct',1,' p.p.'),muscleDelta=metricDelta(bodyRows,'skeletal_muscle_mass_kg',1,' kg');
  const today=new Date(),todayKey=dateKey(today.toISOString());
  const todayLabel=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit'}).format(today);
  const todayWorkout=workouts.find(row=>dateKey(row.workout_date)===todayKey)||null;
  const todayNutrition=[...(state.data.nutrition||[])].filter(row=>dateKey(row.nutrition_date)===todayKey).sort((a,b)=>String(a.nutrition_date).localeCompare(String(b.nutrition_date))).at(-1)||null;
  const todayWater=[...(state.data.nutrition||[])].filter(row=>dateKey(row.nutrition_date)===todayKey&&num(row.water_ml)>0).sort((a,b)=>String(a.nutrition_date).localeCompare(String(b.nutrition_date))).at(-1)||null;
  const todayTreatments=treatments.filter(row=>dateKey(row.event_date)===todayKey);
  const weeklyTraining=uniqueDays(state.data.workouts,'workout_date',row=>row?.is_canonical===true&&row?.record_status!=='quarantined',today);
  const weeklyNutrition=uniqueDays(state.data.nutrition,'nutrition_date',row=>num(row.calories_kcal)!=null,today);
  const weeklyWater=uniqueDays(state.data.nutrition,'nutrition_date',row=>num(row.water_ml)>0,today);
  const weeklySleep=uniqueDays(state.data.metrics,'measured_at',row=>String(row?.metric_type||'').includes('sleep'),today);
  const todayWorkoutSubtitle=todayWorkout?`${num(todayWorkout.duration_minutes)!=null?`${fmtNum(todayWorkout.duration_minutes,0)} min`:safe(todayWorkout.location,'registro')}${num(todayWorkout.calories_kcal)!=null?` · ${fmtNum(todayWorkout.calories_kcal,0)} kcal`:''}`:'Nenhum treino registrado hoje';
  const todayNutritionSubtitle=todayNutrition?`${num(todayNutrition.calories_kcal)!=null?`${fmtNum(todayNutrition.calories_kcal,0)} kcal`:''}${num(todayNutrition.protein_g)!=null?` · ${fmtNum(todayNutrition.protein_g,0)} g proteína`:''}`:'Nenhuma alimentação estruturada hoje';
  const todayWaterSubtitle=todayWater?`${fmtNum(num(todayWater.water_ml)/1000,1)} L registrados hoje`:'Nenhuma hidratação estruturada hoje';
  const medicationRows=todayTreatments.length?todayTreatments.map(row=>statusRow({kind:'medication',title:safe(row.medication,'Medicação registrada'),subtitle:'Aplicação registrada hoje',route:'tratamentos',current:true})).join(''):statusRow({kind:'medication',title:'Medicações',subtitle:'Nenhuma aplicação registrada hoje',route:'tratamentos'});
  const recentWorkoutDetail=workout?safe(workout.workout_type,'Treino de força'):'';
  const recentNutritionDetail=nutrition?`${num(nutrition.calories_kcal)!=null?`${fmtNum(nutrition.calories_kcal,0)} kcal`:''}${num(nutrition.protein_g)!=null?` · ${fmtNum(nutrition.protein_g,0)} g proteína`:''}`:'';

  return `<section class="ltsHomeV2 ltsHomeReference">
    <header class="ltsRefHeader"><div class="ltsRefBrand"><span class="ltsRefPulse">⌁</span><b>LTS <em>Health</em></b></div><button class="ltsRefAvatar" data-route="dados" aria-label="Dados e fontes">${esc((displayName()||'L').slice(0,1).toUpperCase())}</button></header>
    <section class="ltsRefGreeting"><h1 tabindex="-1">${esc(greeting())}</h1><p>${esc(longDate(today))}</p><div class="ltsRefMotto"><span>ϟ</span><b>Disciplina hoje, evolução sempre.</b></div></section>
    <section class="ltsRefMetrics" aria-label="Composição corporal atual">${metricCard('Peso',weight!=null?`${fmtNum(weight,1)} kg`:'—',weightDelta)}${metricCard('Gordura',fat!=null?`${fmtNum(fat,1)}%`:'—',fatDelta)}${metricCard('Massa muscular',muscle!=null?`${fmtNum(muscle,1)} kg`:'—',muscleDelta)}</section>
    <section class="ltsRefCard ltsRefToday"><header><div><h2>Hoje</h2><span>${esc(todayLabel)}</span></div><button data-route="timeline">Ver dia completo ›</button></header>
      ${statusRow({kind:'training',title:todayWorkout?safe(todayWorkout.workout_type,'Treino de força'):'Treino',subtitle:todayWorkoutSubtitle,route:'treinos',current:Boolean(todayWorkout)})}
      ${medicationRows}
      ${statusRow({kind:'water',title:'Água',subtitle:todayWaterSubtitle,route:'nutricao',entry:todayWater?false:'water-import',current:Boolean(todayWater)})}
      ${statusRow({kind:'nutrition',title:'Dieta',subtitle:todayNutritionSubtitle,route:'nutricao',current:Boolean(todayNutrition)})}
    </section>
    ${(workout||nutrition)?`<section class="ltsRefRecent"><header><h2>Últimos registros</h2><button data-route="timeline">Ver histórico ›</button></header><div>${recentRow('training','Último treino',workout,'workout_date',recentWorkoutDetail,'treinos')}${recentRow('nutrition','Última alimentação',nutrition,'nutrition_date',recentNutritionDetail,'nutricao')}</div></section>`:''}
    <section class="ltsRefCard ltsRefProgress"><header><div><h2>Progresso semanal</h2><span>cobertura dos últimos 7 dias</span></div><button data-route="analise">Ver mais ›</button></header><div class="ltsRefProgressGrid">${progressRing('Treinos',weeklyTraining,'training')}${progressRing('Dieta',weeklyNutrition,'nutrition')}${progressRing('Hidratação',weeklyWater,'water')}${progressRing('Sono',weeklySleep,'sleep')}</div></section>
  </section>`;
}
