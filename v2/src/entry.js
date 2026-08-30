import {saveBodyRecord,saveWorkout} from './writes.js';

const $=id=>document.getElementById(id);
let refreshCallback=async()=>{};
let exerciseCounter=0;

export function localDateValue(value=new Date()){
  const d=value instanceof Date?value:new Date(value);
  const year=d.getFullYear(),month=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${year}-${month}-${day}`;
}
const today=()=>localDateValue();

function bodyForm(){
  return `<form id="bodyEntryForm" class="entryForm">
    <div class="entryGrid cols2">
      <label>Data<input name="measured_at" type="date" value="${today()}" required></label>
      <label>Peso (kg)<input name="weight_kg" inputmode="decimal" placeholder="ex.: 90,0"></label>
      <label>MME (kg)<input name="skeletal_muscle_mass_kg" inputmode="decimal"></label>
      <label>Gordura (kg)<input name="fat_mass_kg" inputmode="decimal"></label>
      <label>Gordura (%)<input name="body_fat_pct" inputmode="decimal"></label>
      <label>Gordura visceral<input name="visceral_fat_level" inputmode="decimal"></label>
      <label>InBody / score<input name="score" inputmode="decimal"></label>
      <label>Água corporal (L)<input name="body_water_l" inputmode="decimal"></label>
      <label>Relação cintura/quadril<input name="waist_hip_ratio" inputmode="decimal"></label>
      <label>Metabolismo basal (kcal)<input name="bmr_kcal" inputmode="decimal"></label>
    </div>
    <label>Observação<textarea name="notes" rows="2" placeholder="Opcional"></textarea></label>
    <div class="entryFooter"><span id="entryMsg" class="msg"></span><button class="primary" type="submit">Salvar bio</button></div>
  </form>`;
}

function setRow(exId,setId){
  return `<div class="setEntry" data-set-id="${setId}">
    <select name="phase"><option value="working">Série</option><option value="warmup">Aquecimento</option><option value="other">Outro</option></select>
    <input name="weight" inputmode="decimal" placeholder="Carga">
    <select name="weight_unit"><option value="kg">kg</option><option value="lb">lb</option><option value="plate_index">índice da placa</option><option value="unitless">sem unidade</option></select>
    <input name="reps" inputmode="decimal" placeholder="Reps">
    <button type="button" class="iconBtn" data-remove-set aria-label="Remover série">×</button>
  </div>`;
}

function exerciseCard(){
  const id=++exerciseCounter;
  return `<section class="exerciseEntry" data-exercise-id="${id}">
    <div class="exerciseEntryHead"><b>Exercício</b><button type="button" class="ghostSmall" data-remove-exercise>Remover</button></div>
    <div class="entryGrid cols3">
      <label>Nome<input name="exercise_name" required placeholder="Nome do exercício"></label>
      <label>Grupo<input name="muscle_group" placeholder="Peito, costas..."></label>
      <label>Máquina / equipamento<input name="machine" placeholder="Opcional"></label>
    </div>
    <div class="setEntryHead"><span>Séries registradas</span><button type="button" class="ghostSmall" data-add-set>+ Série</button></div>
    <div class="setEntryList">${setRow(id,1)}</div>
  </section>`;
}

function workoutForm(){
  exerciseCounter=0;
  return `<form id="workoutEntryForm" class="entryForm">
    <div class="entryGrid cols3">
      <label>Data<input name="workout_date" type="date" value="${today()}" required></label>
      <label>Treino<input name="workout_type" required placeholder="Ex.: Peito + ombros"></label>
      <label>Local<input name="location" placeholder="Opcional"></label>
      <label>Duração (min)<input name="duration_minutes" inputmode="decimal"></label>
      <label>Calorias<input name="calories_kcal" inputmode="decimal"></label>
    </div>
    <div class="entrySectionHead"><div><b>Exercícios</b><small>Registre apenas o que você realmente fez; campos desconhecidos podem ficar em branco.</small></div><button type="button" class="ghostSmall" data-add-exercise>+ Exercício</button></div>
    <div id="exerciseEntries">${exerciseCard()}</div>
    <label>Observação<textarea name="notes" rows="2" placeholder="Opcional"></textarea></label>
    <div class="entryFooter"><span id="entryMsg" class="msg"></span><button class="primary" type="submit">Salvar treino</button></div>
  </form>`;
}

function entryModal(){return $('entryModal');}
function markEntryDirty(){const modal=entryModal();if(modal&&!modal.classList.contains('hidden')&&modal.dataset.saving!=='true')modal.dataset.dirty='true';}
export function shouldWarnEntryUnload(){
  const modal=entryModal();
  return !!modal&&!modal.classList.contains('hidden')&&(modal.dataset.dirty==='true'||modal.dataset.saving==='true');
}

export function openEntry(type){
  const modal=entryModal();
  modal.dataset.saving='false';modal.dataset.dirty='false';
  modal.classList.remove('hidden');
  $('entryTitle').textContent=type==='workout'?'Registrar treino':'Registrar bio';
  $('entryHost').innerHTML=type==='workout'?workoutForm():bodyForm();
}

function closeEntry(){
  const modal=entryModal();
  if(modal?.dataset.saving==='true')return false;
  if(modal?.dataset.dirty==='true'&&!window.confirm('Descartar alterações não salvas?'))return false;
  modal.dataset.dirty='false';modal.classList.add('hidden');
  $('entryHost').innerHTML='';
  document.dispatchEvent(new Event('lts-health-entry-closed'));
  return true;
}

function formObject(form){ return Object.fromEntries(new FormData(form).entries()); }

function collectWorkout(form){
  const root=formObject(form);
  const exercises=[...form.querySelectorAll('.exerciseEntry')].map(ex=>({
    name:ex.querySelector('[name="exercise_name"]')?.value||'',
    muscle_group:ex.querySelector('[name="muscle_group"]')?.value||'',
    machine:ex.querySelector('[name="machine"]')?.value||'',
    sets:[...ex.querySelectorAll('.setEntry')].map(set=>({
      phase:set.querySelector('[name="phase"]')?.value||'working',
      weight:set.querySelector('[name="weight"]')?.value||'',
      weight_unit:set.querySelector('[name="weight_unit"]')?.value||'kg',
      reps:set.querySelector('[name="reps"]')?.value||''
    }))
  }));
  return {...root,exercises};
}

const validationMessages={
  negative_number_not_allowed:'Use apenas valores iguais ou maiores que zero.',
  invalid_number:'Há um número inválido. Confira os campos numéricos.',
  date_required:'Informe a data da medição.',
  metric_required:'Informe pelo menos uma medida corporal.',
  workout_fields_required:'Informe data, tipo de treino e pelo menos um exercício com série.',
  authentication_required:'Sua sessão terminou. Entre novamente para salvar.'
};
function entryErrorMessage(error){return validationMessages[error?.message]||'Não foi possível salvar. Confira os campos e tente novamente.';}

export function setupEntryController({onSaved}={}){
  refreshCallback=onSaved||refreshCallback;
  $('closeEntry').addEventListener('click',closeEntry);
  $('entryModal').addEventListener('click',e=>{ if(e.target===$('entryModal')) closeEntry(); });
  $('entryModal').addEventListener('input',e=>{if(e.target.closest('form'))markEntryDirty();});
  $('entryModal').addEventListener('change',e=>{if(e.target.closest('form'))markEntryDirty();});
  window.addEventListener('beforeunload',e=>{
    if(!shouldWarnEntryUnload())return;
    e.preventDefault();e.returnValue='';
  });

  document.addEventListener('click',e=>{
    const addExercise=e.target.closest('[data-add-exercise]');
    if(addExercise){ $('exerciseEntries').insertAdjacentHTML('beforeend',exerciseCard());markEntryDirty();return; }
    const removeExercise=e.target.closest('[data-remove-exercise]');
    if(removeExercise){ const cards=[...document.querySelectorAll('.exerciseEntry')];if(cards.length>1){removeExercise.closest('.exerciseEntry')?.remove();markEntryDirty();}return; }
    const addSet=e.target.closest('[data-add-set]');
    if(addSet){ const card=addSet.closest('.exerciseEntry'),list=card.querySelector('.setEntryList'),next=list.querySelectorAll('.setEntry').length+1;list.insertAdjacentHTML('beforeend',setRow(card.dataset.exerciseId,next));markEntryDirty();return; }
    const removeSet=e.target.closest('[data-remove-set]');
    if(removeSet){ const list=removeSet.closest('.setEntryList');if(list.querySelectorAll('.setEntry').length>1){removeSet.closest('.setEntry')?.remove();markEntryDirty();} }
  });

  document.addEventListener('submit',async e=>{
    if(e.target.id!=='bodyEntryForm'&&e.target.id!=='workoutEntryForm') return;
    e.preventDefault();
    const form=e.target,msg=$('entryMsg'),button=form.querySelector('button[type="submit"]'),modal=entryModal();
    modal.dataset.saving='true';
    msg.textContent='Salvando…';button.disabled=true;

    try{
      if(form.id==='bodyEntryForm')await saveBodyRecord(formObject(form));
      else await saveWorkout(collectWorkout(form));
    }catch(error){
      modal.dataset.saving='false';
      if(!validationMessages[error?.message])console.error(error);
      msg.textContent=entryErrorMessage(error);
      if(button.isConnected)button.disabled=false;
      return;
    }

    modal.dataset.dirty='false';
    msg.textContent='Salvo.';
    try{
      await refreshCallback();
    }catch(error){
      console.warn('entry_refresh_failed',error);
      msg.textContent='Salvo. A tela não pôde ser atualizada agora.';
    }
    setTimeout(()=>{modal.dataset.saving='false';closeEntry();},450);
  });
}
