(function(){
  const GROUPS=['Costas','Peito','Quadríceps','Posterior','Adutor/Abdutor','Bíceps','Tríceps','Ombro','Abdômen','Panturrilha'];
  const V14={volumeDays:'90'};
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const day=v=>String(v||'').slice(0,10);
  const cutoff=days=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-Number(days));return d.toISOString().slice(0,10)};
  const inPeriod=(date,days)=>days==='all'||day(date)>=cutoff(days);
  const ensure=(id,parent,before=null)=>{let e=q(id);if(e)return e;e=document.createElement('div');e.id=id;if(before)parent.insertBefore(e,before);else parent.appendChild(e);return e};
  const uid=prefix=>`${prefix}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
  const val=id=>q(id)?.value?.trim?.()||'';
  const numeric=id=>{const x=Number(String(val(id)).replace(',','.'));return Number.isFinite(x)?x:null};
  function install(){
    document.body.classList.add('healthV14');
    const today=q('today');
    const quick=ensure('v14Quick',today,q('v13Freshness')||q('v12Coverage')||today?.querySelector('.hero'));quick.className='v14Quick';
    quick.innerHTML='<button class="primary" id="v14AddBody">Registrar bioimpedância</button><button id="v14AddWorkout">Registrar treino</button>';

    const training=q('training');
    const trBefore=q('v13TrainingTrend')||q('v12ExerciseExplorer')||training?.querySelector('.grid2');
    const vol=ensure('v14Volume',training,trBefore);vol.className='v14Panel';
    vol.innerHTML=`<div class="v14Head"><div><b>Volume por grupo muscular</b><small>Somatório das séries registradas por grupo. É uma leitura histórica, não uma meta de treino.</small></div><div class="v14Controls"><select id="v14VolumeDays"><option value="28">28 dias</option><option value="90" selected>90 dias</option><option value="365">1 ano</option><option value="all">Todo histórico</option></select></div></div><div id="v14VolumeGrid" class="v14VolumeGrid"></div><div id="v14PolarCal" class="v14CalRow"></div><div class="v14Foot">Quando um registro histórico identifica calorias Polar brutas, a visualização mostra também a calibração histórica de exibição (-20%) sem alterar o valor armazenado.</div>`;

    const evo=q('evolution');
    const evoBefore=q('v12BodyCompare')||q('evolutionLens')||evo?.querySelector('.grid2');
    const seg=ensure('v14Segmental',evo,evoBefore);seg.className='v14Panel';
    seg.innerHTML='<div class="v14Head"><div><b>Evolução segmentar</b><small>Massa magra e gordura por segmento a partir das medições disponíveis. Diferenças D/E são descritivas.</small></div></div><div id="v14SegmentalBody"></div>';

    const modal=document.createElement('div');modal.id='v14Modal';modal.className='v14Modal hidden';modal.innerHTML='<div class="v14Sheet"><div id="v14ModalContent"></div></div>';document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
    q('v14AddBody')?.addEventListener('click',openBodyForm);
    q('v14AddWorkout')?.addEventListener('click',openWorkoutForm);
    q('v14VolumeDays')?.addEventListener('change',e=>{V14.volumeDays=e.target.value;renderVolume()});
  }
  function closeModal(){q('v14Modal')?.classList.add('hidden');q('v14ModalContent').innerHTML=''}
  function openBodyForm(){
    q('v14Modal').classList.remove('hidden');
    q('v14ModalContent').innerHTML=`<div class="v14SheetHead"><div><b>Registrar bioimpedância</b><small>Entrada manual auditável. Campos vazios permanecem vazios; percentual de gordura só é calculado se peso e gordura em kg forem informados.</small></div><button class="v14Close" id="v14Close">×</button></div><div class="v14FormGrid"><div class="v14Field"><label>Data</label><input id="v14BDate" type="date"></div><div class="v14Field"><label>Peso (kg)</label><input id="v14BWeight" inputmode="decimal"></div><div class="v14Field"><label>Massa muscular esquelética (kg)</label><input id="v14BMuscle" inputmode="decimal"></div><div class="v14Field"><label>Gordura (kg)</label><input id="v14BFat" inputmode="decimal"></div><div class="v14Field"><label>Água corporal (L)</label><input id="v14BWater" inputmode="decimal"></div><div class="v14Field"><label>Gordura visceral (nível)</label><input id="v14BVisceral" inputmode="decimal"></div><div class="v14Field"><label>Score InBody</label><input id="v14BScore" inputmode="decimal"></div><div class="v14Field"><label>Cintura/quadril</label><input id="v14BWaist" inputmode="decimal"></div><div class="v14Field"><label>TMB (kcal)</label><input id="v14BBmr" inputmode="decimal"></div><div class="v14Field full"><label>Observação</label><textarea id="v14BNote" placeholder="Contexto da medição, se houver"></textarea></div></div><div id="v14Msg" class="v14Msg"></div><div class="v14Actions"><button id="v14Cancel">Cancelar</button><button class="primary" id="v14SaveBody">Salvar medição</button></div>`;
    q('v14Close').onclick=closeModal;q('v14Cancel').onclick=closeModal;q('v14SaveBody').onclick=saveBody;
  }
  async function saveBody(){
    const date=val('v14BDate'),weight=numeric('v14BWeight');if(!currentSession?.user||!date||weight==null){msg('Informe data e peso.','bad');return}
    const fat=numeric('v14BFat');const pct=fat!=null&&weight>0?Math.round(fat/weight*1000)/10:null;
    const payload={user_id:currentSession.user.id,source_record_id:uid('manual-body'),measured_at:date,weight_kg:weight,skeletal_muscle_mass_kg:numeric('v14BMuscle'),fat_mass_kg:fat,body_fat_pct:pct,body_water_l:numeric('v14BWater'),visceral_fat_level:numeric('v14BVisceral'),score:numeric('v14BScore'),waist_hip_ratio:numeric('v14BWaist'),bmr_kcal:numeric('v14BBmr'),source:'LTS Health manual entry',confidence:'user_reported',notes:[val('v14BNote'),pct!=null?'Percentual de gordura calculado como gordura_kg/peso_kg×100 a partir dos valores informados.':null].filter(Boolean).join(' '),source_payload:{entry_method:'manual_form_v14'}};
    q('v14SaveBody').disabled=true;const r=await sb.from('health_body_composition').insert(payload);q('v14SaveBody').disabled=false;
    if(r.error){msg(r.error.message,'bad');return}msg('Medição salva.','ok');setTimeout(async()=>{closeModal();await loadAll()},450)
  }
  function openWorkoutForm(){
    q('v14Modal').classList.remove('hidden');
    const groupHtml=GROUPS.map((g,i)=>`<div class="v14Group"><label><input type="checkbox" data-v14-group="${esc(g)}"> ${esc(g)}</label><input id="v14GS${i}" inputmode="numeric" placeholder="séries" disabled></div>`).join('');
    q('v14ModalContent').innerHTML=`<div class="v14SheetHead"><div><b>Registrar treino</b><small>Registro manual da sessão. Carga/repetições detalhadas podem ficar no texto bruto quando não estiverem estruturadas.</small></div><button class="v14Close" id="v14Close">×</button></div><div class="v14FormGrid"><div class="v14Field"><label>Data</label><input id="v14TDate" type="date"></div><div class="v14Field"><label>Tipo</label><input id="v14TType" placeholder="Ex.: Push, Pull, Lower"></div><div class="v14Field"><label>Local</label><input id="v14TLocation" placeholder="Academia/local"></div><div class="v14Field"><label>Duração (min)</label><input id="v14TDuration" inputmode="decimal"></div><div class="v14Field"><label>Calorias registradas</label><input id="v14TCalories" inputmode="decimal"></div><div class="v14Field"><label>FC média</label><input id="v14THrAvg" inputmode="decimal"></div><div class="v14Field"><label>FC mínima</label><input id="v14THrMin" inputmode="decimal"></div><div class="v14Field"><label>FC máxima</label><input id="v14THrMax" inputmode="decimal"></div><div class="v14Field full"><label>Grupos e séries</label><div class="v14Groups">${groupHtml}</div></div><div class="v14Field full"><label>Exercícios / observações brutas</label><textarea id="v14TRaw" placeholder="Texto livre da sessão; unidades ficam exatamente como informadas"></textarea></div><div class="v14Field full"><label>Observação</label><textarea id="v14TNote" placeholder="Contexto opcional"></textarea></div></div><div id="v14Msg" class="v14Msg"></div><div class="v14Actions"><button id="v14Cancel">Cancelar</button><button class="primary" id="v14SaveWorkout">Salvar treino</button></div>`;
    q('v14Close').onclick=closeModal;q('v14Cancel').onclick=closeModal;q('v14SaveWorkout').onclick=saveWorkout;
    document.querySelectorAll('[data-v14-group]').forEach((cb,i)=>cb.addEventListener('change',()=>{q('v14GS'+i).disabled=!cb.checked;if(!cb.checked)q('v14GS'+i).value=''}));
  }
  async function saveWorkout(){
    const date=val('v14TDate'),type=val('v14TType');if(!currentSession?.user||!date||!type){msg('Informe data e tipo do treino.','bad');return}
    const groups=[],setsBy={};document.querySelectorAll('[data-v14-group]').forEach((cb,i)=>{if(cb.checked){const g=cb.dataset.v14Group;groups.push(g);const x=Number(q('v14GS'+i).value);if(Number.isFinite(x)&&x>=0)setsBy[g]=x}});
    const payload={user_id:currentSession.user.id,source_record_id:uid('manual-workout'),workout_date:date,workout_type:type,location:val('v14TLocation')||null,duration_minutes:numeric('v14TDuration'),calories_kcal:numeric('v14TCalories'),heart_rate_avg:numeric('v14THrAvg'),heart_rate_min:numeric('v14THrMin'),heart_rate_max:numeric('v14THrMax'),muscle_groups:groups,sets_by_group:Object.keys(setsBy).length?setsBy:null,raw_exercises:val('v14TRaw')||null,source:'LTS Health manual entry',confidence:'user_reported',notes:val('v14TNote')||null,record_status:'validated',is_canonical:true,source_payload:{entry_method:'manual_form_v14'}};
    q('v14SaveWorkout').disabled=true;const r=await sb.from('health_workouts').insert(payload);q('v14SaveWorkout').disabled=false;
    if(r.error){msg(r.error.message,'bad');return}msg('Treino salvo.','ok');setTimeout(async()=>{closeModal();await loadAll()},450)
  }
  function msg(text,kind){const e=q('v14Msg');if(!e)return;e.className='v14Msg '+(kind||'');e.textContent=text}
  function workoutSetMap(workout){
    const direct=workout.sets_by_group&&typeof workout.sets_by_group==='object'?workout.sets_by_group:null;if(direct&&Object.keys(direct).length)return direct;
    const ex=(state.exercises||[]).filter(e=>e.workout_source_record_id===workout.source_record_id),out={};
    for(const e of ex){const g=e.muscle_group;if(!g)continue;const count=(state.sets||[]).filter(s=>s.exercise_source_record_id===e.source_record_id).length;if(count)out[g]=(out[g]||0)+count}
    return out;
  }
  function renderVolume(){
    const days=q('v14VolumeDays')?.value||V14.volumeDays,V=(state.canonicalWorkouts||[]).filter(w=>inPeriod(w.workout_date,days)),tot={};GROUPS.forEach(g=>tot[g]=0);
    for(const w of V){const m=workoutSetMap(w);for(const [g,x] of Object.entries(m||{})){if(tot[g]!=null&&n(x)!=null)tot[g]+=n(x)}}
    q('v14VolumeGrid').innerHTML=GROUPS.map(g=>`<div class="v14Volume"><span>${esc(g)}</span><strong>${fmtNum(tot[g],0)}</strong><small>séries registradas</small></div>`).join('');
    const withCal=V.filter(w=>n(w.calories_kcal)!=null),polar=withCal.filter(w=>/polar/i.test(`${w.source||''} ${w.notes||''}`));const raw=withCal.reduce((s,w)=>s+(n(w.calories_kcal)||0),0),polarRaw=polar.reduce((s,w)=>s+(n(w.calories_kcal)||0),0);
    q('v14PolarCal').innerHTML=`<div class="v14Cal"><span>Sessões no período</span><strong>${V.length}</strong></div><div class="v14Cal"><span>kcal registradas · bruto</span><strong>${withCal.length?fmtNum(raw,0):'—'}</strong></div><div class="v14Cal"><span>Polar identificado · exibição -20%</span><strong>${polar.length?fmtNum(polarRaw*.8,0):'—'}</strong></div>`;
  }
  function asym(a,b){const x=n(a),y=n(b);if(x==null||y==null||x+y===0)return null;return Math.abs(x-y)/((x+y)/2)*100}
  function segmentCard(label,lean,fat,prevLean,prevFat){const dl=n(lean)!=null&&n(prevLean)!=null?n(lean)-n(prevLean):null,df=n(fat)!=null&&n(prevFat)!=null?n(fat)-n(prevFat):null;return `<div class="v14Segment"><b>${esc(label)}</b><strong>${lean!=null?fmtNum(lean,2)+' kg':'—'}</strong><small>massa magra${dl!=null?` · Δ ${dl>0?'+':''}${fmtNum(dl,2)} kg`:''}</small><strong style="font-size:12px;margin-top:7px">${fat!=null?fmtNum(fat,2)+' kg':'—'}</strong><small>gordura${df!=null?` · Δ ${df>0?'+':''}${fmtNum(df,2)} kg`:''}</small></div>`}
  function renderSegmental(){
    const a=[...(state.segmental||[])].sort((x,y)=>String(y.measured_at).localeCompare(String(x.measured_at))),cur=a[0],prev=a[1];if(!cur){q('v14SegmentalBody').innerHTML='<div class="v13Empty">Sem análise segmentar estruturada.</div>';return}
    const cards=[segmentCard('Braço direito',cur.lean_right_arm_kg,cur.fat_right_arm_kg,prev?.lean_right_arm_kg,prev?.fat_right_arm_kg),segmentCard('Braço esquerdo',cur.lean_left_arm_kg,cur.fat_left_arm_kg,prev?.lean_left_arm_kg,prev?.fat_left_arm_kg),segmentCard('Tronco',cur.lean_trunk_kg,cur.fat_trunk_kg,prev?.lean_trunk_kg,prev?.fat_trunk_kg),segmentCard('Perna direita',cur.lean_right_leg_kg,cur.fat_right_leg_kg,prev?.lean_right_leg_kg,prev?.fat_right_leg_kg),segmentCard('Perna esquerda',cur.lean_left_leg_kg,cur.fat_left_leg_kg,prev?.lean_left_leg_kg,prev?.fat_left_leg_kg)];
    const arm=asym(cur.lean_right_arm_kg,cur.lean_left_arm_kg),leg=asym(cur.lean_right_leg_kg,cur.lean_left_leg_kg);
    q('v14SegmentalBody').innerHTML=`<div class="v14Foot" style="margin:0 0 9px">Última análise: ${fmtDate(cur.measured_at)}${prev?` · comparação com ${fmtDate(prev.measured_at)}`:''}</div><div class="v14SegmentGrid">${cards.join('')}</div><div class="v14Asym"><div class="v14AsymCard"><span>Assimetria registrada · braços (massa magra)</span><strong>${arm!=null?fmtNum(arm,1)+'%':'—'}</strong><small>diferença relativa D/E, descritiva</small></div><div class="v14AsymCard"><span>Assimetria registrada · pernas (massa magra)</span><strong>${leg!=null?fmtNum(leg,1)+'%':'—'}</strong><small>diferença relativa D/E, descritiva</small></div></div>`;
  }
  function renderV14(){renderVolume();renderSegmental();const f=document.querySelector('.footer');if(f)f.textContent='LTS Health · v14 · manual capture + volume + segmental parity · dedicated GitHub / Supabase · provenance first'}
  install();
  const prior=loadAll;
  loadAll=async function(){await prior();renderV14()};
  sb.auth.getSession().then(({data})=>{if(data?.session)setTimeout(renderV14,1400)});
})();
