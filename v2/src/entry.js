import {saveBodyRecord,saveWorkout,saveMyFitnessPalWater,importMyFitnessPalWaterExport} from './writes.js';
import {parseMyFitnessPalWaterExport} from './mfp-water-transfer.js';

const $=id=>document.getElementById(id);
let refreshCallback=async()=>{};
let exerciseCounter=0;
let pendingWaterImport=null;

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

function waterForm(){
  return `<form id="waterEntryForm" class="entryForm">
    <div class="waterEntryIntro">
      <span aria-hidden="true">◌</span>
      <div><b>Registro manual de um único dia</b><p>Use esta opção apenas para corrigir ou acrescentar uma data isolada. Para o histórico desde 2018, use a importação automática.</p></div>
    </div>
    <div class="entryGrid cols2">
      <label>Data no MyFitnessPal<input name="metric_date" type="date" value="${today()}" required></label>
      <label>Total de água (mL)<input name="water_ml" inputmode="decimal" autocomplete="off" placeholder="ex.: 2500" required></label>
    </div>
    <label class="entryConfirm"><input name="confirmed" type="checkbox" required><span>Confirmei este total no diário do MyFitnessPal.</span></label>
    <p class="entryHint">Salvar novamente a mesma data substitui apenas esse total de água. Nenhum outro dado de nutrição é alterado.</p>
    <div class="entryFooter"><span id="entryMsg" class="msg" role="status"></span><button class="primary" type="submit">Salvar água</button></div>
  </form>`;
}

function waterImportForm(){
  return `<form id="mfpWaterImportForm" class="entryForm">
    <div class="waterTransferIntro">
      <div><span>Etapa 1 · notebook</span><b>Extraia na sessão aberta do MyFitnessPal</b><p>No notebook, o Chrome, Edge ou Safari consulta todas as datas automaticamente, com pausa e retomada. Você não precisa digitar os dias nem instalar um aplicativo.</p></div>
      <a class="primary" href="./mfp-water-extractor.html" target="_blank" rel="noopener">Ver passo a passo no notebook</a>
    </div>
    <div class="waterTransferFile">
      <label>Etapa 2 · Arquivo gerado pelo extrator<input id="mfpWaterImportFile" name="mfp_water_file" type="file" accept="application/json,.json" required></label>
      <p>O arquivo é validado localmente. Somente data e total em mL entram no histórico; o JSON original não é enviado nem armazenado.</p>
    </div>
    <div id="mfpWaterImportPreview" class="waterImportPreview" role="status"><b>Aguardando arquivo</b><span>Selecione o JSON criado ao final da extração.</span></div>
    <label class="entryConfirm"><input id="mfpWaterImportConfirm" name="confirmed" type="checkbox" required disabled><span>Confirmo a importação das datas e dos totais mostrados na prévia.</span></label>
    <p class="entryHint">Reimportar o mesmo arquivo é seguro. A mesma data é atualizada, sem criar duplicata e sem alterar refeições ou outros dados de nutrição.</p>
    <div class="waterImportFooter"><button type="button" class="ghostSmall" data-water-manual>Registrar apenas um dia</button><div class="entryFooter"><span id="entryMsg" class="msg" role="status"></span><button id="mfpWaterImportSubmit" class="primary" type="submit" disabled>Importar histórico</button></div></div>
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
  pendingWaterImport=null;
  modal.dataset.saving='false';modal.dataset.dirty='false';
  modal.classList.remove('hidden');
  $('entryTitle').textContent=type==='workout'?'Registrar treino':type==='water-import'?'Importar água do MyFitnessPal':type==='water'?'Registrar água manualmente':'Registrar bio';
  $('entryHost').innerHTML=type==='workout'?workoutForm():type==='water-import'?waterImportForm():type==='water'?waterForm():bodyForm();
}

function closeEntry(){
  const modal=entryModal();
  if(modal?.dataset.saving==='true')return false;
  if(modal?.dataset.dirty==='true'&&!window.confirm('Descartar alterações não salvas?'))return false;
  pendingWaterImport=null;modal.dataset.dirty='false';modal.classList.add('hidden');
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
  water_required:'Informe o total de água mostrado no MyFitnessPal.',
  water_must_be_positive:'O total de água precisa ser maior que zero.',
  water_value_too_large:'O valor parece estar em outra unidade. Informe o total em mililitros.',
  water_confirmation_required:'Confirme que o valor foi conferido no diário do MyFitnessPal.',
  water_import_confirmation_required:'Confirme a prévia antes de importar.',
  mfp_export_invalid_json:'O arquivo não contém um JSON válido.',
  mfp_export_invalid_document:'O arquivo não tem a estrutura esperada.',
  mfp_export_wrong_schema:'Este não é um arquivo do extrator de água do LTS.',
  mfp_export_wrong_method:'O método de extração do arquivo não é reconhecido.',
  mfp_export_incomplete:'A extração ainda não terminou. Volte ao MyFitnessPal e execute o favorito para retomar.',
  mfp_export_invalid_period:'O período do arquivo é inválido.',
  mfp_export_period_too_large:'O arquivo ultrapassa o limite seguro de 10.000 dias.',
  mfp_export_invalid_rows:'A lista de datas do arquivo é inválida.',
  mfp_export_invalid_row_date:'Há uma data inválida ou fora do período no arquivo.',
  mfp_export_invalid_row_value:'Há um total de água inválido no arquivo.',
  mfp_export_conflicting_duplicate:'O arquivo contém dois totais diferentes para a mesma data.',
  mfp_export_invalid_counts:'A contagem do arquivo não corresponde ao período extraído.',
  authentication_required:'Sua sessão terminou. Entre novamente para salvar.'
};
function entryErrorMessage(error){
  if(Number(error?.importedCount)>0)return`${error.importedCount} data(s) foram salvas antes da interrupção. Tente novamente o mesmo arquivo para concluir sem duplicar.`;
  return validationMessages[error?.message]||'Não foi possível salvar. Confira os campos e tente novamente.';
}

function transferDate(value){const[y,m,d]=String(value||'').split('-');return y&&m&&d?`${d}/${m}/${y}`:String(value||'');}

function showWaterImportPreview(parsed,error){
  const preview=$('mfpWaterImportPreview'),confirm=$('mfpWaterImportConfirm'),submit=$('mfpWaterImportSubmit');
  if(!preview||!confirm||!submit)return;
  confirm.checked=false;
  if(error){preview.className='waterImportPreview error';preview.innerHTML=`<b>Arquivo recusado</b><span>${entryErrorMessage(error)}</span>`;confirm.disabled=true;submit.disabled=true;return;}
  const ready=parsed.rows.length>0;
  preview.className=`waterImportPreview ${ready?'ready':'empty'}`;
  preview.innerHTML=`<b>${ready?`${parsed.rows.length.toLocaleString('pt-BR')} data(s) com água encontradas`:'Nenhum total positivo encontrado'}</b><span>${transferDate(parsed.period.from)} a ${transferDate(parsed.period.to)} · ${parsed.days_scanned.toLocaleString('pt-BR')} dias verificados · ${parsed.days_without_positive_total.toLocaleString('pt-BR')} sem total positivo</span><small>Dias sem total positivo não serão gravados como zero.</small>`;
  confirm.disabled=!ready;submit.disabled=!ready;
}

export function setupEntryController({onSaved}={}){
  refreshCallback=onSaved||refreshCallback;
  $('closeEntry').addEventListener('click',closeEntry);
  $('entryModal').addEventListener('click',e=>{ if(e.target===$('entryModal')) closeEntry(); });
  $('entryModal').addEventListener('input',e=>{if(e.target.closest('form'))markEntryDirty();});
  $('entryModal').addEventListener('change',e=>{if(e.target.closest('form'))markEntryDirty();});
  $('entryModal').addEventListener('change',async e=>{
    if(e.target.id!=='mfpWaterImportFile')return;
    pendingWaterImport=null;
    const file=e.target.files?.[0],preview=$('mfpWaterImportPreview');
    if(!file){showWaterImportPreview(null,new Error('mfp_export_invalid_document'));return;}
    if(preview){preview.className='waterImportPreview';preview.innerHTML='<b>Validando arquivo…</b><span>A prévia aparecerá antes de qualquer gravação.</span>';}
    try{pendingWaterImport=parseMyFitnessPalWaterExport(await file.text());showWaterImportPreview(pendingWaterImport,null);}
    catch(error){pendingWaterImport=null;showWaterImportPreview(null,error);}
  });
  window.addEventListener('beforeunload',e=>{
    if(!shouldWarnEntryUnload())return;
    e.preventDefault();e.returnValue='';
  });

  document.addEventListener('click',e=>{
    const manualWater=e.target.closest('[data-water-manual]');
    if(manualWater){openEntry('water');return;}
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
    if(e.target.id!=='bodyEntryForm'&&e.target.id!=='workoutEntryForm'&&e.target.id!=='waterEntryForm'&&e.target.id!=='mfpWaterImportForm') return;
    e.preventDefault();
    const form=e.target,msg=$('entryMsg'),button=form.querySelector('button[type="submit"]'),modal=entryModal();
    modal.dataset.saving='true';
    msg.textContent='Salvando…';button.disabled=true;

    let importResult=null;
    try{
      if(form.id==='bodyEntryForm')await saveBodyRecord(formObject(form));
      else if(form.id==='waterEntryForm')await saveMyFitnessPalWater(formObject(form));
      else if(form.id==='mfpWaterImportForm'){
        if(!pendingWaterImport)throw new Error('mfp_export_invalid_document');
        if(!form.querySelector('[name="confirmed"]')?.checked)throw new Error('water_import_confirmation_required');
        importResult=await importMyFitnessPalWaterExport(pendingWaterImport,{onProgress:({imported,total})=>{msg.textContent=`Importando ${imported.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} datas…`;}});
      }
      else await saveWorkout(collectWorkout(form));
    }catch(error){
      modal.dataset.saving='false';
      if(!validationMessages[error?.message])console.error(error);
      msg.textContent=entryErrorMessage(error);
      if(button.isConnected)button.disabled=false;
      return;
    }

    modal.dataset.dirty='false';
    msg.textContent=importResult?`${importResult.imported.toLocaleString('pt-BR')} data(s) importadas.`:'Salvo.';
    try{
      await refreshCallback();
    }catch(error){
      console.warn('entry_refresh_failed',error);
      msg.textContent='Salvo. A tela não pôde ser atualizada agora.';
    }
    setTimeout(()=>{modal.dataset.saving='false';closeEntry();},450);
  });
}
