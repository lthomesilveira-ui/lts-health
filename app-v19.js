(function(){
  const V19={exercise:null};
  const ensure=(id,parent,before=null)=>{let e=q(id);if(e)return e;e=document.createElement('div');e.id=id;if(before)parent.insertBefore(e,before);else parent.appendChild(e);return e};
  const day=v=>String(v||'').slice(0,10);
  const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const unique=a=>[...new Set(a.filter(Boolean))];
  function install(){
    document.body.classList.add('healthV19');
    const training=q('training');const t=ensure('v19Training',training,q('v14Volume')||q('v12ExerciseExplorer')||training?.querySelector('.grid2'));t.className='v19Panel';
    const nutrition=q('nutrition');const nu=ensure('v19Nutrition',nutrition,q('nutritionList')||nutrition?.lastChild);nu.className='v19Panel';
  }
  function weekBuckets(){const out=[];const now=new Date();now.setHours(12,0,0,0);for(let i=7;i>=0;i--){const end=new Date(now);end.setDate(end.getDate()-i*7);const start=new Date(end);start.setDate(start.getDate()-6);out.push({start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10),label:start.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})})}return out}
  function exerciseGroups(){const m=new Map();for(const e of state.exercises||[]){const k=norm(e.exercise);if(!k)continue;const g=m.get(k)||{key:k,label:e.exercise,rows:[]};g.rows.push(e);m.set(k,g)}return [...m.values()].sort((a,b)=>String(a.label).localeCompare(String(b.label),'pt-BR'))}
  function renderTraining(){
    const weeks=weekBuckets(),w=state.canonicalWorkouts||[],sets=state.sets||[],ex=state.exercises||[];
    const maxSessions=Math.max(1,...weeks.map(x=>w.filter(r=>day(r.workout_date)>=x.start&&day(r.workout_date)<=x.end).length));
    const maxSets=Math.max(1,...weeks.map(x=>sets.filter(r=>day(r.workout_date)>=x.start&&day(r.workout_date)<=x.end).length));
    const groups=exerciseGroups();if(!V19.exercise&&groups.length)V19.exercise=groups[0].key;if(V19.exercise&&!groups.some(g=>g.key===V19.exercise))V19.exercise=groups[0]?.key||null;
    const opts=groups.map(g=>`<option value="${esc(g.key)}" ${g.key===V19.exercise?'selected':''}>${esc(g.label)}</option>`).join('');
    const selected=groups.find(g=>g.key===V19.exercise),rows=selected?.rows||[],selectedSets=sets.filter(s=>rows.some(r=>r.source_record_id===s.exercise_source_record_id));
    q('v19Training').innerHTML=`<div class="v19Head"><div><b>Ritmo de treino e histórico por exercício</b><small>Leitura das sessões e séries registradas. Volume observado não é tratado como meta ou recomendação.</small></div>${groups.length?`<select id="v19ExerciseSelect">${opts}</select>`:''}</div><div class="v19WeekGrid">${weeks.map(x=>{const sc=w.filter(r=>day(r.workout_date)>=x.start&&day(r.workout_date)<=x.end).length,st=sets.filter(r=>day(r.workout_date)>=x.start&&day(r.workout_date)<=x.end).length;return`<div class="v19Week"><div class="v19WeekChart"><i style="height:${Math.max(4,sc/maxSessions*100)}%"></i><i class="secondary" style="height:${Math.max(4,st/maxSets*100)}%"></i></div><b>${sc} sessão(ões)</b><small>${st} séries estruturadas · sem. ${x.label}</small></div>`}).join('')}</div>${selected?renderExercise(selected,selectedSets):'<div class="v19Empty">Sem exercícios estruturados para leitura histórica.</div>'}`;
    q('v19ExerciseSelect')?.addEventListener('change',e=>{V19.exercise=e.target.value;renderTraining()});
  }
  function renderExercise(group,sets){
    const sessions=unique(group.rows.map(r=>day(r.workout_date))).sort(),units={};for(const s of sets){const wt=n(s.weight);if(wt==null)continue;const u=String(s.weight_unit||'unidade não informada');const d=day(s.workout_date);(units[u]??={})[d]=Math.max(units[u]?.[d]??-Infinity,wt)}
    const unitBlocks=Object.entries(units).map(([unit,map])=>{const pts=Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0])),max=Math.max(...pts.map(x=>x[1]),1);return`<div class="v19UnitBlock"><b>Maior carga registrada por sessão · ${esc(unit)}</b><div class="v19SessionBars">${pts.map(([d,v])=>`<div class="v19SessionBar"><em>${fmtNum(v,1)}</em><i style="height:${Math.max(5,v/max*76)}%"></i><span>${d.slice(5).replace('-','/')}</span></div>`).join('')}</div></div>`}).join('');
    const recent=sessions.at(-1),first=sessions[0];
    return `<div class="v19ExerciseSummary"><div class="v19Mini"><span>Exercício</span><strong>${esc(group.label)}</strong></div><div class="v19Mini"><span>Sessões estruturadas</span><strong>${sessions.length}</strong></div><div class="v19Mini"><span>Séries estruturadas</span><strong>${sets.length}</strong></div></div><div class="v19Context"><strong>Período:</strong> ${first?fmtDate(first):'—'} → ${recent?fmtDate(recent):'—'}. Cargas só são comparadas dentro da mesma unidade; kg, lb por lado, índice de placa e valores sem unidade permanecem separados.</div>${unitBlocks||'<div class="v19Empty" style="margin-top:10px">Este exercício tem sessões estruturadas, mas sem carga numérica comparável por unidade.</div>'}`;
  }
  function renderNutrition(){
    const rows=(state.mfp?.trendNutrition?.length?state.mfp.trendNutrition:state.nutrition)||[],weeks=weekBuckets(),workouts=state.canonicalWorkouts||[];
    const cards=weeks.map(x=>{const r=rows.filter(v=>day(v.nutrition_date)>=x.start&&day(v.nutrition_date)<=x.end),days=unique(r.map(v=>day(v.nutrition_date))).length,cal=r.map(v=>n(v.calories_kcal)).filter(v=>v!=null),avg=cal.length?cal.reduce((a,b)=>a+b,0)/cal.length:null;return{...x,days,avg}});
    const overlap=unique(workouts.filter(w=>rows.some(r=>day(r.nutrition_date)===day(w.workout_date))).map(w=>day(w.workout_date))).length;
    const recent=rows.slice(0,30),cals=recent.map(x=>n(x.calories_kcal)).filter(x=>x!=null),min=cals.length?Math.min(...cals):null,max=cals.length?Math.max(...cals):null;
    q('v19Nutrition').innerHTML=`<div class="v19Head"><div><b>Cobertura nutricional por semana</b><small>Mostra apenas dias realmente registrados. Ausência de registro não é interpretada como jejum, baixa ingestão ou aderência.</small></div></div><div class="v19NutritionGrid">${cards.map(x=>`<div class="v19NutritionWeek"><div class="v19CoverageTrack"><i style="height:${Math.max(3,x.days/7*100)}%"></i></div><b>${x.days}/7 dias</b><small>${x.avg!=null?fmtNum(x.avg,0)+' kcal médias registradas':'energia sem dados'} · sem. ${x.label}</small></div>`).join('')}</div><div class="v19Context"><strong>Últimos registros:</strong> ${cals.length?`energia registrada entre ${fmtNum(min,0)} e ${fmtNum(max,0)} kcal nos últimos ${cals.length} dias com valor`: 'sem energia estruturada suficiente'}. <strong>Sobreposição treino + nutrição:</strong> ${overlap} dia(s) no conjunto carregado, útil para futuras comparações descritivas sem assumir causalidade.</div>`;
  }
  function renderV19(){renderTraining();renderNutrition();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v19 · training rhythm + nutrition coverage analytics · dedicated GitHub / Supabase · provenance first'}
  install();
  const prior=loadAll;
  loadAll=async function(){await prior();renderV19()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(renderV19,2500)});
})();
