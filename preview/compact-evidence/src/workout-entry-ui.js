import {esc,state} from './core.js';
import {parseWorkoutText,searchWorkoutCatalog,workoutCatalog} from './workout-composer.js';

const drafts=new WeakMap();
const field=(root,name)=>root.querySelector('[name="'+name+'"]');
const message=(form,text)=>{form.querySelector('[data-composer-status]').textContent=text;};
const units={kg:'kg',lb:'lb',plate_index:'nível',unitless:''};
const phases={working:'Série',warmup:'Aquecimento',other:'Outra série',rest_pause:'Rest-pause',drop:'Drop'};
const clean=value=>String(value??'').trim();
const blankCard=card=>!['exercise_name','machine','muscle_group','effort','exercise_notes','weight','reps','set_notes'].some(key=>[...card.querySelectorAll('[name="'+key+'"]')].some(input=>clean(input.value)))&&!card.querySelector('[name="failure"]:checked');
const labelRow=item=>[item.name,item.machine,item.group].filter(Boolean).join(' · ');

export function workoutComposerFields(){
 return `<div class="workoutComposerModes" role="group" aria-label="Como registrar o treino">
  <button type="button" data-workout-mode="picker" aria-pressed="true">Escolher exercícios</button>
  <button type="button" data-workout-mode="text" aria-pressed="false">Escrever treino</button></div>
  <details data-polar-day class="workoutPolarDay" hidden><summary>Registros do Polar nesta data</summary><ul></ul></details>
  <section data-composer-text hidden><label>Descreva seu treino<textarea name="training_text" maxlength="16000" rows="5" placeholder="Supino: 60 kg x 10, 70 kg x 8. Remada: 3 séries de 10 com 40 kg."></textarea></label>
  <button type="button" class="ghostSmall" data-interpret-workout>Interpretar e revisar</button></section>
  <section data-composer-picker><label>Buscar exercício<input type="search" name="exercise_search" autocomplete="off" placeholder="Nome, máquina ou grupo muscular"></label>
  <div data-exercise-options class="workoutComposerChoices"></div></section>
  <p data-composer-status role="status" aria-live="polite"></p>`;
}
export function workoutComposerReview(){
 return `<section data-workout-review hidden class="workoutComposerReview" aria-label="Revisão do treino"></section>
  <p data-present-workouts role="status"></p>
  <div class="entryFooter"><span id="entryMsg" class="msg" role="status"></span>
  <button class="primary" type="button" data-review-workout>Revisar treino</button>
  <button class="primary" type="submit" hidden>Salvar treino</button></div>`;
}

function clearReview(form){
 const draft=drafts.get(form);if(!draft||!draft.reviewed)return;
 draft.reviewed=false;const review=form.querySelector('[data-workout-review]');review.hidden=true;review.replaceChildren();
 form.querySelector('[data-review-workout]').hidden=false;form.querySelector('button[type="submit"]').hidden=true;
}
function setMode(form,mode){
 const text=mode==='text';
 form.querySelector('[data-composer-text]').hidden=!text;
 form.querySelector('[data-composer-picker]').hidden=text;
 for(const b of form.querySelectorAll('[data-workout-mode]'))b.setAttribute('aria-pressed',String(b.dataset.workoutMode===mode));
 if(text)field(form,'training_text').focus();
}
function showChoices(form,term){
 const draft=drafts.get(form),out=form.querySelector('[data-exercise-options]');
 draft.choices=searchWorkoutCatalog(draft.catalog,term,term?12:6);
 out.innerHTML=draft.choices.map((item,i)=>`<button type="button" class="ghostSmall" data-pick-exercise="${i}">${esc(labelRow(item))}</button>`).join('');
 if(!draft.choices.length)out.textContent='Exercício novo? Digite o nome na ficha abaixo.';
}
function addExercise(form,record,hooks){
 const cards=[...form.querySelectorAll('.exerciseEntry')],list=form.querySelector('#exerciseEntries');
 let card=cards.find(blankCard);
 if(!card){list.insertAdjacentHTML('beforeend',hooks.exerciseCard());card=list.lastElementChild;}
 for(const [key,value] of [['exercise_name',record.name],['machine',record.machine],['muscle_group',record.muscle_group],['exercise_notes',record.notes]])field(card,key).value=clean(value);
 const rows=record.sets||[];
 if(rows.length){
  const sets=card.querySelector('.setEntryList');
  sets.innerHTML=rows.map((_,i)=>hooks.setRow(card.dataset.exerciseId,i+1)).join('');
  [...sets.children].forEach((row,i)=>{
   const set=rows[i];
   for(const key of ['phase','weight','weight_unit','reps'])field(row,key).value=String(set[key]??'');
   field(row,'set_notes').value=set.notes||'';field(row,'failure').checked=set.failure===true;
  });
 }
 return card;
}
function sameDay(form){
 const date=field(form,'workout_date').value;
 return (state.data.workouts||[]).filter(w=>w.is_canonical===true&&w.record_status!=='quarantined'&&w.workout_date===date);
}
function polarClock(stamp){
 const time=String(stamp||'').match(/^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})(?::(\d{2}))?/);
 return time?time[1]+(time[2]?':'+time[2]:''):'';
}
function polarDay(form,date){
 const panel=form.querySelector('[data-polar-day]');
 const rows=state.domainStatus?.polarSessions==='ready'?(state.data.polarSessions||[]).filter(row=>row.workout_date===date):[];
 panel.hidden=!rows.length;
 const value=(v,u)=>v==null||v===''||!Number.isFinite(Number(v))?'':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:1})+' '+u;
 const list=rows.slice().sort((a,b)=>String(a.recorded_start||'').localeCompare(String(b.recorded_start||'')));
 panel.querySelector('ul').innerHTML=list.map(row=>{
   const start=polarClock(row.recorded_start),stop=polarClock(row.recorded_stop);
   const time=start&&stop?start+' a '+stop:start||'Horário não informado';
   return '<li>'+esc([time,value(row.duration_minutes,'min de atividade'),value(row.recorded_calories,'kcal do aparelho'),value(row.heart_rate_avg,'bpm de média')].filter(Boolean).join(' · '))+'</li>';
 }).join('');
}
function dayMessage(form){
 const n=sameDay(form).length,out=form.querySelector('[data-present-workouts]');
 polarDay(form,field(form,'workout_date').value);
 out.textContent=n?(n===1?'Já existe um treino nesta data.':'Já existem '+n+' treinos nesta data.'):'';
}
function describeSet(set){
 const weight=clean(set.weight),reps=clean(set.reps);
 return [phases[set.phase]||'Série',weight?[weight,units[set.weight_unit]].filter(Boolean).join(' '):'',reps?reps+' rep.':'',set.failure?'até a falha':'',set.notes].filter(Boolean).join(' · ');
}
function draftSummary(form,payload){
 const d=drafts.get(form),rows=payload.exercises.filter(ex=>clean(ex.name)),raw=d.blocks.join('\n\n');
 const list=rows.map(ex=>`<li><strong>${esc(ex.name)}</strong><small>${esc([ex.machine,ex.muscle_group].filter(Boolean).join(' · '))}</small><ul>${ex.sets.map(s=>'<li>'+esc(describeSet(s))+'</li>').join('')}</ul></li>`).join('');
 return `<h3>Confira antes de salvar</h3><p>${esc([payload.workout_date.split('-').reverse().join('/'),payload.start_clock,payload.workout_type,payload.location,payload.duration_minutes?payload.duration_minutes+' min':'',payload.calories_kcal?payload.calories_kcal+' kcal':''].filter(Boolean).join(' · '))}</p>
  ${rows.length?'<ul>'+list+'</ul>':'<p>Este treino será salvo como relato, sem séries estruturadas.</p>'}
  ${raw?'<details><summary>Relato original</summary><p class="workoutOriginal">'+esc(raw)+'</p></details>':''}
  ${d.unknown.length?'<p><b>Trechos mantidos no relato original</b></p><ul>'+d.unknown.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>':''}
  ${sameDay(form).length?'<label class="workoutChoice"><input type="checkbox" name="another_session" required> Este é outro treino nessa data.</label>':''}
  <button type="button" class="ghostSmall" data-edit-workout>Voltar e editar</button>`;
}
export function workoutSubmitExtras(form){
 const d=drafts.get(form);
 if(!d?.reviewed)throw new Error('workout_review_required');
 return {entry_id:d.id, original_text:d.blocks.join('\n\n')||null,text_only:d.textOnly};
}
export function initWorkoutComposer(form,hooks){
 const d={id:crypto.randomUUID(),blocks:[],unknown:[],reviewed:false,textOnly:false,catalog:workoutCatalog(state.data.workouts,state.data.exercises),choices:[]};
 drafts.set(form,d);showChoices(form,'');dayMessage(form);
 form.addEventListener('input',e=>{
   if(e.target.name==='exercise_search'){showChoices(form,e.target.value);return;}
   if(e.target.name!=='another_session')clearReview(form);
   if(e.target.name==='workout_date')dayMessage(form);
 });
 form.addEventListener('change',e=>{if(e.target.name!=='another_session'&&e.target.name!=='exercise_search')clearReview(form);});
 form.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.matches('[data-workout-mode]')){setMode(form,b.dataset.workoutMode);return;}
  if(b.matches('[data-edit-workout]')){clearReview(form);field(form,'workout_type').focus();return;}
  if(b.matches('[data-add-exercise],[data-remove-exercise],[data-add-set],[data-remove-set]')){clearReview(form);return;}
  if(b.matches('[data-pick-exercise]')){
   const item=d.choices[Number(b.dataset.pickExercise)];if(!item)return;
   const card=[...form.querySelectorAll('.exerciseEntry')].find(c=>field(c,'exercise_name').value===item.name&&field(c,'machine').value===item.machine&&field(c,'muscle_group').value===item.group);
   const target=card||addExercise(form,{name:item.name,machine:item.machine,muscle_group:item.group},hooks);
   if(!card){clearReview(form);hooks.markDirty();}
   message(form,card?'O exercício já está na ficha. Você pode acrescentar outra série.':'Exercício adicionado.');
   field(target,'weight').focus();return;
  }
  if(b.matches('[data-interpret-workout]')){
   const input=field(form,'training_text'),parsed=parseWorkoutText(input.value,field(form,'workout_date').value);
   if(parsed.error){message(form,'Escreva o treino antes de interpretar (até 16.000 caracteres).');return;}
   if(d.blocks.includes(parsed.raw)){message(form,'Esse relato já está na ficha.');setMode(form,'picker');input.value='';return;}
   if([...d.blocks,parsed.raw].join('\n\n').length>16000){message(form,'O relato completo pode ter até 16.000 caracteres.');return;}
   clearReview(form);
   for(const [key,value] of Object.entries(parsed.metadata))if(field(form,key))field(form,key).value=value;
   if(parsed.exercises.length+form.querySelectorAll('.exerciseEntry').length-([...form.querySelectorAll('.exerciseEntry')].some(blankCard)?1:0)>99){message(form,'Revise os exercícios antes de acrescentar este relato.');return;}
   for(const ex of parsed.exercises)addExercise(form,ex,hooks);
   d.blocks.push(parsed.raw);d.unknown.push(...parsed.unresolved);input.value='';setMode(form,'picker');dayMessage(form);hooks.markDirty();
   message(form,parsed.exercises.length?parsed.exercises.length+' exercício(s) identificado(s). Confira cargas e repetições abaixo.'+(parsed.unresolved.length?' Os trechos pendentes aparecem na revisão.':''):'Relato preservado. Você pode incluir séries ou salvar apenas o texto.');
   return;
  }
  if(b.matches('[data-review-workout]')){
   if(clean(field(form,'training_text').value)){setMode(form,'text');message(form,'Use Interpretar e revisar para incluir o texto digitado.');return;}
   const untouched=[...form.querySelectorAll('.exerciseEntry')].filter(blankCard);
   const filled=[...form.querySelectorAll('.exerciseEntry')].filter(card=>!blankCard(card));
   if(!filled.length&&!d.blocks.length){message(form,'Escolha um exercício ou escreva o treino.');return;}
   for(const card of untouched)card.remove();
   if(!form.reportValidity())return;
   const payload=hooks.collect(form);
   for(const exercise of payload.exercises){
    if(exercise.sets.some(set=>!clean(set.weight)&&!clean(set.reps)&&!clean(set.notes)&&!set.failure)){
     message(form,'Informe a carga, as repetições ou uma observação em cada série de '+exercise.name+'.');return;
    }
   }
   d.textOnly=!filled.length&&d.blocks.length>0;
   const review=form.querySelector('[data-workout-review]');review.innerHTML=draftSummary(form,payload);review.hidden=false;d.reviewed=true;
   b.hidden=true;form.querySelector('button[type="submit"]').hidden=false;review.setAttribute('tabindex','-1');review.focus();
  }
 });
}
