(function(){
  'use strict';
  const GROUPS=['Costas','Peito','Quadríceps','Posterior','Adutor/Abdutor','Bíceps','Tríceps','Ombro','Abdômen','Panturrilha'];
  let exSeq=0,installLock=false;
  const safe=v=>esc(v??'');
  const localDate=()=>{const d=new Date(),m=String(d.getMonth()+1).padStart(2,'0'),x=String(d.getDate()).padStart(2,'0');return`${d.getFullYear()}-${m}-${x}`};
  const val=(root,sel)=>root.querySelector(sel)?.value?.trim?.()||'';
  const numberOrNull=v=>{if(v==null||String(v).trim()==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:null};

  function installButton(){
    if(installLock)return;installLock=true;
    try{
      const title=document.querySelector('#productTraining .tpTitle');if(!title)return;
      let actions=title.querySelector('.sweActions');
      const simple=title.querySelector('#tpAdd');
      if(!actions){actions=document.createElement('div');actions.className='sweActions';if(simple){simple.insertAdjacentElement('beforebegin',actions);actions.appendChild(simple)}else title.appendChild(actions)}
      if(simple){simple.textContent='Registro simples';simple.classList.remove('primary')}
      if(!actions.querySelector('#sweOpen')){const b=document.createElement('button');b.id='sweOpen';b.type='button';b.className='productBtn primary';b.textContent='Registrar detalhado';b.onclick=open;actions.prepend(b)}
    }finally{installLock=false}
  }
  function modal(){
    let m=document.getElementById('sweModal');if(m)return m;
    m=document.createElement('div');m.id='sweModal';m.className='sweModal hidden';m.innerHTML='<div class="sweSheet"><div id="sweContent"></div></div>';document.body.appendChild(m);m.onclick=e=>{if(e.target===m)close()};return m;
  }
  function close(){document.getElementById('sweModal')?.classList.add('hidden')}
  function exerciseTemplate(){
    const id=++exSeq;
    return `<section class="sweExercise" data-swe-ex="${id}"><div class="sweExHead"><div><b>Exercício</b><small>Nome e pelo menos uma série registrada.</small></div><button type="button" data-remove-ex>Remover</button></div><div class="sweExFields"><label>Nome *<input data-ex-name placeholder="Ex.: Supino máquina"></label><label>Grupo<select data-ex-group><option value="">Não informado</option>${GROUPS.map(g=>`<option>${safe(g)}</option>`).join('')}</select></label><label>Máquina / variação<input data-ex-machine placeholder="Opcional"></label></div><div class="sweSets" data-sets></div><div class="sweExActions"><button type="button" data-add-set>+ Série</button></div></section>`;
  }
  function setTemplate(){return `<div class="sweSet"><label>Série<span data-set-index></span></label><input data-set-weight inputmode="decimal" placeholder="carga"><select data-set-unit><option value="kg">kg</option><option value="lb">lb</option><option value="plate_index">placa/índice</option><option value="unitless">sem carga comparável</option></select><input data-set-reps inputmode="decimal" placeholder="reps *"><select data-set-phase><option value="working">série</option><option value="warmup">aquecimento</option><option value="other">outro</option></select><button type="button" data-remove-set aria-label="Remover série">×</button></div>`}
  function reindex(ex){ex.querySelectorAll('.sweSet').forEach((r,i)=>{const s=r.querySelector('[data-set-index]');if(s)s.textContent=` ${i+1}`})}
  function addSet(ex){const host=ex.querySelector('[data-sets]');host.insertAdjacentHTML('beforeend',setTemplate());const row=host.lastElementChild;row.querySelector('[data-remove-set]').onclick=()=>{row.remove();reindex(ex)};reindex(ex)}
  function wireExercise(ex){ex.querySelector('[data-remove-ex]').onclick=()=>ex.remove();ex.querySelector('[data-add-set]').onclick=()=>addSet(ex);addSet(ex)}
  function addExercise(){const host=document.getElementById('sweExercises');host.insertAdjacentHTML('beforeend',exerciseTemplate());wireExercise(host.lastElementChild)}
  function open(){
    const m=modal();m.classList.remove('hidden');exSeq=0;
    document.getElementById('sweContent').innerHTML=`<div class="sweHead"><div><span>TREINO · REGISTRO ESTRUTURADO</span><h2>Registrar sessão detalhada</h2><p>Salva sessão, exercícios e séries em uma única operação. Campos não informados ficam ausentes e unidades diferentes nunca são convertidas entre si.</p></div><button type="button" id="sweClose">×</button></div><div class="sweBase"><label>Data *<input id="sweDate" type="date" value="${localDate()}"></label><label>Tipo *<input id="sweType" placeholder="Ex.: Peito + Ombros"></label><label>Local<input id="sweLocation" placeholder="Academia/local"></label><label>Duração (min)<input id="sweDuration" inputmode="decimal"></label><label>Calorias registradas<input id="sweCalories" inputmode="decimal"></label><label>FC média<input id="sweHrAvg" inputmode="decimal"></label><label>FC mínima<input id="sweHrMin" inputmode="decimal"></label><label>FC máxima<input id="sweHrMax" inputmode="decimal"></label></div><div class="sweSectionHead"><div><b>Exercícios e séries</b><small>Carga é opcional; repetições são exigidas neste modo detalhado. Use o registro simples quando a fonte estiver incompleta.</small></div><button type="button" id="sweAddExercise">+ Exercício</button></div><div id="sweExercises"></div><label class="sweNotes">Observação da sessão<textarea id="sweNotes" placeholder="Contexto opcional da sessão"></textarea></label><div class="sweGuard">Este formulário registra o que aconteceu. Ele não recomenda intensidade, falha, técnicas de esforço ou metas de treino.</div><div id="sweMsg" class="sweMsg"></div><div class="sweFooter"><button type="button" id="sweCancel">Cancelar</button><button type="button" id="sweSave" class="primary">Salvar sessão detalhada</button></div>`;
    document.getElementById('sweClose').onclick=close;document.getElementById('sweCancel').onclick=close;document.getElementById('sweAddExercise').onclick=addExercise;document.getElementById('sweSave').onclick=save;addExercise();
  }
  function collect(){
    const root=document.getElementById('sweContent'),date=val(root,'#sweDate'),type=val(root,'#sweType');if(!date||!type)throw new Error('Informe data e tipo do treino.');
    const exercises=[...root.querySelectorAll('.sweExercise')].map((ex,ei)=>{const name=val(ex,'[data-ex-name]');if(!name)throw new Error(`Informe o nome do exercício ${ei+1}.`);const sets=[...ex.querySelectorAll('.sweSet')].map((s,si)=>{const reps=numberOrNull(val(s,'[data-set-reps]')),weight=numberOrNull(val(s,'[data-set-weight]'));if(reps==null)throw new Error(`Informe as repetições do exercício ${ei+1}, série ${si+1}.`);if(reps<0||weight!=null&&weight<0)throw new Error('Carga e repetições não podem ser negativas.');return{weight,weight_unit:val(s,'[data-set-unit]')||'unitless',reps,phase:val(s,'[data-set-phase]')||'working'}});if(!sets.length)throw new Error(`Adicione pelo menos uma série ao exercício ${ei+1}.`);return{name,muscle_group:val(ex,'[data-ex-group]')||null,machine:val(ex,'[data-ex-machine]')||null,sets}});
    if(!exercises.length)throw new Error('Adicione pelo menos um exercício.');
    return{workout_date:date,workout_type:type,location:val(root,'#sweLocation')||null,duration_minutes:numberOrNull(val(root,'#sweDuration')),calories_kcal:numberOrNull(val(root,'#sweCalories')),heart_rate_avg:numberOrNull(val(root,'#sweHrAvg')),heart_rate_min:numberOrNull(val(root,'#sweHrMin')),heart_rate_max:numberOrNull(val(root,'#sweHrMax')),notes:val(root,'#sweNotes')||null,exercises};
  }
  function message(text,kind=''){const e=document.getElementById('sweMsg');if(!e)return;e.className='sweMsg '+kind;e.textContent=text}
  async function save(){
    let payload;try{payload=collect()}catch(e){message(e.message,'bad');return}
    const b=document.getElementById('sweSave');b.disabled=true;b.textContent='Salvando…';message('');
    try{const r=await sb.rpc('health_log_structured_workout',{p_payload:payload});if(r.error)throw r.error;const x=r.data||{};message(`Sessão salva: ${x.exercise_count||payload.exercises.length} exercício(s) e ${x.set_count||payload.exercises.reduce((n,e)=>n+e.sets.length,0)} série(s).`,'ok');setTimeout(async()=>{close();await loadAll();activateTab('training')},600)}catch(e){message(`Não foi possível salvar: ${e.message||e}`,'bad')}finally{b.disabled=false;b.textContent='Salvar sessão detalhada'}
  }
  const watch=()=>{installButton();const root=document.getElementById('productTraining');if(root&&!root.dataset.sweWatch){root.dataset.sweWatch='1';new MutationObserver(()=>requestAnimationFrame(installButton)).observe(root,{childList:true,subtree:false})}};
  const prior=loadAll;loadAll=async function(){const out=await prior();watch();return out};
  window.addEventListener('load',()=>setTimeout(watch,2600));
})();
