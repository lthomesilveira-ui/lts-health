(function(){
  'use strict';
  const X={days:'90',query:'',exerciseKey:null,exerciseQuery:'',open:null};
  const day=v=>String(v||'').slice(0,10);
  const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
  const num=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const unique=a=>[...new Set(a.filter(Boolean))];
  const cutoff=days=>{if(days==='all')return null;const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-Number(days)+1);return d.toISOString().slice(0,10)};
  const inDays=(v,days)=>days==='all'||day(v)>=cutoff(days);
  const safe=v=>esc(v??'');

  function exercisesFor(w){
    const all=state.exercises||[],direct=all.filter(e=>e.workout_source_record_id&&e.workout_source_record_id===w.source_record_id);
    return (direct.length?direct:all.filter(e=>day(e.workout_date)===day(w.workout_date))).sort((a,b)=>(a.order_index??999)-(b.order_index??999));
  }
  function setsFor(e){return (state.sets||[]).filter(s=>s.exercise_source_record_id===e.source_record_id).sort((a,b)=>(a.set_index??999)-(b.set_index??999))}
  function status(w){const s=String(w.record_status||'validated');if(s==='review_required')return{label:'registro parcial',cls:'review'};if(s==='quarantined')return{label:'quarentena',cls:'bad'};return{label:'validado',cls:'ok'}}
  function setText(s){
    const bits=[],weight=num(s.weight),reps=s.reps_raw??s.reps_numeric??s.reps??null,unit=s.weight_unit||'';
    if(weight!=null)bits.push(`${fmtNum(weight,Number.isInteger(weight)?0:1)}${unit?' '+safe(unit):''}`);
    if(reps!=null&&reps!=='')bits.push(`${safe(reps)} reps`);
    if(s.phase==='warmup')bits.push('aquecimento');else if(s.phase==='drop')bits.push('drop registrado');
    return bits.join(' · ')||'série preservada sem carga/repetições estruturadas';
  }
  function missingExerciseText(e){
    const bits=[];if(num(e.weight_kg)!=null)bits.push(`carga mencionada ${fmtNum(e.weight_kg,Number.isInteger(num(e.weight_kg))?0:1)} kg`);if(e.reps)bits.push(`${safe(e.reps)} reps`);
    return bits.length?bits.join(' · ')+' · séries detalhadas não disponíveis':safe(e.notes||'Séries detalhadas não disponíveis na fonte.')
  }
  function sessionHtml(w,index){
    const ex=exercisesFor(w),count=ex.reduce((n,e)=>n+setsFor(e).length,0),st=status(w),open=X.open===w.source_record_id||(!X.open&&index===0);
    return `<article class="tpSession ${open?'open':''} ${st.cls}" data-session-id="${safe(w.source_record_id||day(w.workout_date))}">
      <button class="tpSessionHead" type="button" data-session-toggle>
        <div class="tpDate"><strong>${fmtDate(w.workout_date)}</strong><small>${safe(w.location||'local não informado')}</small></div>
        <div class="tpSessionTitle"><b>${safe(w.workout_type||'Treino')}</b><small>${ex.length} exercício(s) · ${count} série(s) estruturada(s)</small></div>
        <span class="tpStatus ${st.cls}">${st.label}</span>
      </button>
      <div class="tpSessionBody">
        ${w.record_status==='review_required'?`<div class="tpPartial"><b>Fonte incompleta preservada</b><span>${safe(w.notes||'Há informações faltantes neste treino; o app não completa as lacunas por inferência.')}</span></div>`:''}
        ${ex.length?ex.map(e=>{const sets=setsFor(e);return `<section class="tpExercise"><div class="tpExerciseHead"><div><b>${safe(e.exercise||'Exercício')}</b><small>${[e.muscle_group,e.machine].filter(Boolean).map(safe).join(' · ')}</small></div><span>${sets.length?sets.length+' série(s)':'detalhe parcial'}</span></div>${sets.length?`<div class="tpSets">${sets.map((s,i)=>`<div class="tpSet"><em>S${s.set_index??i+1}</em><span>${setText(s)}</span></div>`).join('')}</div>`:`<div class="tpMissing">${missingExerciseText(e)}</div>`}</section>`}).join(''):'<div class="tpEmpty">Sessão preservada sem exercícios estruturados.</div>'}
      </div>
    </article>`;
  }
  function weekly(workouts){
    const now=new Date();now.setHours(12,0,0,0);const buckets=[];for(let i=7;i>=0;i--){const end=new Date(now);end.setDate(end.getDate()-i*7);const start=new Date(end);start.setDate(start.getDate()-6);const a=start.toISOString().slice(0,10),b=end.toISOString().slice(0,10),count=workouts.filter(w=>day(w.workout_date)>=a&&day(w.workout_date)<=b).length;buckets.push({a,count})}const max=Math.max(1,...buckets.map(x=>x.count));return `<div class="tpWeeks">${buckets.map(x=>`<div><em>${x.count}</em><i style="height:${Math.max(5,x.count/max*74)}%"></i><span>${x.a.slice(5).replace('-','/')}</span></div>`).join('')}</div>`
  }
  function volume(days){const totals={};for(const e of state.exercises||[]){if(!inDays(e.workout_date,days)||!e.muscle_group)continue;const c=setsFor(e).length;if(c)totals[e.muscle_group]=(totals[e.muscle_group]||0)+c}const rows=Object.entries(totals).sort((a,b)=>b[1]-a[1]);return rows.length?rows.map(([g,v])=>`<div class="tpVolume"><span>${safe(g)}</span><strong>${v}</strong></div>`).join(''):'<div class="tpEmpty">Sem séries estruturadas por grupo no período.</div>'}
  function exerciseGroups(){const map=new Map();for(const e of state.exercises||[]){const key=norm(e.exercise);if(!key)continue;const g=map.get(key)||{key,label:e.exercise,rows:[]};g.rows.push(e);map.set(key,g)}return [...map.values()].sort((a,b)=>String(a.label).localeCompare(String(b.label),'pt-BR'))}
  function exerciseDetail(g){
    const rows=[...g.rows].sort((a,b)=>String(b.workout_date).localeCompare(String(a.workout_date))),allSets=(state.sets||[]).filter(s=>rows.some(e=>e.source_record_id===s.exercise_source_record_id)),sessions=unique(rows.map(e=>day(e.workout_date))).sort().reverse(),bySession=[];
    for(const d of sessions){const es=rows.filter(e=>day(e.workout_date)===d),ss=allSets.filter(s=>day(s.workout_date)===d),units=unique(ss.map(s=>s.weight_unit||'unidade não informada'));const unitParts=units.map(u=>{const us=ss.filter(s=>(s.weight_unit||'unidade não informada')===u&&num(s.weight)!=null),top=us.length?Math.max(...us.map(s=>num(s.weight))):null;return top==null?null:`${fmtNum(top,Number.isInteger(top)?0:1)} ${safe(u)}`}).filter(Boolean);const reps=ss.map(s=>num(s.reps_numeric)).filter(v=>v!=null).reduce((a,b)=>a+b,0);bySession.push({d,sets:ss.length,top:unitParts.join(' · '),reps,partial:es.some(e=>!setsFor(e).length)});}
    return `<div class="tpExerciseTitle"><b>${safe(g.label)}</b><small>${sessions.length} sessão(ões) · ${allSets.length} série(s) estruturada(s) · cargas nunca são combinadas entre unidades diferentes</small></div><div class="tpHistory">${bySession.slice(0,18).map(x=>`<div class="tpHistoryRow"><time>${fmtDate(x.d)}</time><div><b>${x.top||'carga comparável indisponível'}</b><small>${x.sets} série(s) estruturada(s)${x.reps?` · ${fmtNum(x.reps,1)} repetições registradas`:''}${x.partial?' · registro parcial':''}</small></div></div>`).join('')||'<div class="tpEmpty">Sem histórico estruturado para este exercício.</div>'}</div>`
  }
  function render(){
    const root=q('productTraining');if(!root)return;const all=state.canonicalWorkouts||[],term=norm(X.query),workouts=all.filter(w=>inDays(w.workout_date,X.days)&&(!term||norm(`${w.workout_type} ${w.location} ${(w.muscle_groups||[]).join(' ')}`).includes(term))).sort((a,b)=>String(b.workout_date).localeCompare(String(a.workout_date))),review=workouts.filter(w=>w.record_status==='review_required'),sets=(state.sets||[]).filter(s=>inDays(s.workout_date,X.days)),exercises=(state.exercises||[]).filter(e=>inDays(e.workout_date,X.days)),quality=(state.quality||[]).filter(x=>String(x.status).toLowerCase()==='open'&&String(x.category||'').toLowerCase()==='training'),groups=exerciseGroups(),f=groups.filter(g=>!norm(X.exerciseQuery)||norm(g.label).includes(norm(X.exerciseQuery)));if(!X.exerciseKey||!f.some(g=>g.key===X.exerciseKey))X.exerciseKey=f[0]?.key||null;const selected=f.find(g=>g.key===X.exerciseKey)||null;
    root.innerHTML=`<div class="tpTitle"><div><div class="tpKicker">HISTÓRICO DE TREINO</div><h1>Treino</h1><p>Do resumo à série individual, mantendo a fonte e mostrando explicitamente quando um registro está incompleto.</p></div><button class="productBtn primary" id="tpAdd">Registrar treino</button></div>
      ${review.length?`<div class="tpAlert"><div><b>${review.length} sessão(ões) do período com revisão pendente</b><span>A sessão continua visível no histórico; somente os campos realmente informados entram nos cálculos.</span></div><button id="tpShowPartial">Ver mais recente</button></div>`:''}
      <div class="tpControls"><select id="tpDays"><option value="28" ${X.days==='28'?'selected':''}>28 dias</option><option value="90" ${X.days==='90'?'selected':''}>90 dias</option><option value="365" ${X.days==='365'?'selected':''}>1 ano</option><option value="all" ${X.days==='all'?'selected':''}>Todo histórico</option></select><input id="tpQuery" type="search" value="${safe(X.query)}" placeholder="Buscar sessão, local ou grupo"></div>
      <div class="tpMetrics"><div><span>Sessões</span><strong>${workouts.length}</strong><small>${review.length} parcial(is)</small></div><div><span>Exercícios</span><strong>${exercises.length}</strong><small>registros estruturados</small></div><div><span>Séries</span><strong>${sets.length}</strong><small>somente séries realmente registradas</small></div><div><span>Qualidade</span><strong>${quality.length}</strong><small>questão(ões) aberta(s) de treino</small></div></div>
      <div class="tpGrid"><section class="tpPanel"><div class="tpPanelHead"><div><b>Ritmo por semana</b><small>Contagem observada de sessões, não meta de frequência.</small></div></div>${weekly(all)}</section><section class="tpPanel"><div class="tpPanelHead"><div><b>Séries por grupo</b><small>Volume estruturado dentro do filtro atual.</small></div></div><div class="tpVolumes">${volume(X.days)}</div></section></div>
      <div class="tpGrid main"><section class="tpPanel"><div class="tpPanelHead"><div><b>Sessões</b><small>Abra uma sessão para ver exercícios e séries.</small></div></div><div class="tpSessions">${workouts.length?workouts.slice(0,80).map(sessionHtml).join(''):'<div class="tpEmpty">Nenhuma sessão corresponde aos filtros.</div>'}</div></section><section class="tpPanel"><div class="tpPanelHead"><div><b>Evolução por exercício</b><small>Maior carga é apenas uma descrição do registro da sessão; unidades permanecem separadas.</small></div></div><input id="tpExerciseQuery" type="search" value="${safe(X.exerciseQuery)}" placeholder="Buscar exercício"><div class="tpExercisePicker"><div class="tpExerciseList">${f.slice(0,100).map(g=>`<button data-exercise-key="${safe(g.key)}" class="${g.key===X.exerciseKey?'active':''}"><b>${safe(g.label)}</b><small>${unique(g.rows.map(r=>day(r.workout_date))).length} sessão(ões)</small></button>`).join('')||'<div class="tpEmpty">Nenhum exercício encontrado.</div>'}</div><div class="tpExerciseDetail">${selected?exerciseDetail(selected):'<div class="tpEmpty">Selecione um exercício.</div>'}</div></div></section></div>`;
    q('tpDays').onchange=e=>{X.days=e.target.value;render()};q('tpQuery').oninput=e=>{X.query=e.target.value;render()};q('tpExerciseQuery').oninput=e=>{X.exerciseQuery=e.target.value;render()};q('tpAdd').onclick=()=>q('v14AddWorkout')?.click();q('tpShowPartial')?.addEventListener('click',()=>{const w=review[0];if(w){X.open=w.source_record_id;render();setTimeout(()=>document.querySelector(`[data-session-id="${CSS.escape(w.source_record_id)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),40)}});root.querySelectorAll('[data-session-toggle]').forEach(b=>b.onclick=()=>{const card=b.closest('.tpSession');const id=card?.dataset.sessionId;X.open=X.open===id?null:id;card?.classList.toggle('open')});root.querySelectorAll('[data-exercise-key]').forEach(b=>b.onclick=()=>{X.exerciseKey=b.dataset.exerciseKey;render()});
  }
  const prior=loadAll;
  loadAll=async function(){const out=await prior();render();return out};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(render,1750)});
})();
