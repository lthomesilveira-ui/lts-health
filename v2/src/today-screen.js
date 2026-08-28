import {state,esc,day,fmtDate,fmtNum,num,workoutRows,bodyRows,unique,norm} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1>${description?`<p>${esc(description)}</p>`:''}</div></div>`;
const localDay=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;};
const card=(label,main,sub='',kind='')=>`<article class="todayCard ${kind}"><span>${esc(label)}</span><b>${esc(main)}</b>${sub?`<small>${esc(sub)}</small>`:''}</article>`;
const failed=key=>state.domainStatus[key]==='error';

function latestLab(){
  const rows=state.data.labs||[];if(!rows.length)return null;const date=[...rows].map(r=>r.collection_date).filter(Boolean).sort().at(-1),same=rows.filter(r=>r.collection_date===date);return{date,count:same.length,lab:unique(same.map(r=>r.laboratory)).join(', ')};
}
function hasSource(term,rows,fields){return(rows||[]).some(r=>fields.some(f=>norm(r?.[f]).includes(term)));}
function sourceState(found,unknown){return found?'ready':unknown?'unknown':'missing';}
function sourceRow(label,stateValue,missingText){
  if(stateValue==='ready')return'';
  if(stateValue==='unknown')return`<div><span>${esc(label)}</span><b>Não foi possível confirmar agora</b><small>Atualize o app para tentar carregar essa fonte novamente.</small></div>`;
  return`<div><span>${esc(label)}</span><b>${esc(missingText)}</b><small>Use a área Dados para trazer essa fonte.</small></div>`;
}

export function renderTodayHub(){
  const today=localDay(),workouts=workoutRows(),body=bodyRows(),lastWorkout=workouts[0],lastBody=body.at(-1),nutrition=(state.data.nutrition||[]).find(n=>day(n.nutrition_date)===today),sleep=[...(state.data.metrics||[])].filter(m=>m.metric_type==='sleep_duration_h').sort((a,b)=>String(b.measured_at).localeCompare(String(a.measured_at)))[0],lab=latestLab();
  const uploads=state.data.uploads||[],metrics=state.data.metrics||[],labs=state.data.labs||[];
  const appleFound=uploads.some(u=>norm(u.source_type)==='apple_health')||hasSource('apple',metrics,['source','source_file']);
  const einsteinFound=uploads.some(u=>norm(u.source_type)==='einstein')||hasSource('einstein',labs,['laboratory','source','source_file']);
  const apple=sourceState(appleFound,failed('uploads')||failed('metrics'));
  const einstein=sourceState(einsteinFound,failed('uploads')||failed('labs'));
  return `${title('Hoje',fmtDate(today))}
    <div class="todayGrid">
      ${failed('workouts')?card('Último treino','Indisponível agora','Tente atualizar para carregar os treinos'):lastWorkout?card('Último treino',lastWorkout.workout_type||'Treino',`${fmtDate(lastWorkout.workout_date)}${lastWorkout.location?` · ${lastWorkout.location}`:''}`):card('Último treino','Sem treino registrado')}
      ${failed('body')?card('Última bio','Indisponível agora','Tente atualizar para carregar as medições'):lastBody?card('Última bio',`${fmtNum(lastBody.weight_kg)} kg`,`MME ${fmtNum(lastBody.skeletal_muscle_mass_kg)} kg · ${fmtDate(lastBody.measured_at)}`):card('Última bio','Sem bio registrada')}
      ${failed('nutrition')?card('Alimentação hoje','Indisponível agora','Tente atualizar para carregar a alimentação'):nutrition?card('Alimentação hoje',num(nutrition.calories_kcal)!=null?`${fmtNum(nutrition.calories_kcal,0)} kcal`:'Registro disponível',num(nutrition.protein_g)!=null?`${fmtNum(nutrition.protein_g,0)} g proteína`:''):card('Alimentação hoje','Sem registro para hoje')}
      ${failed('metrics')?card('Sono','Indisponível agora','Tente atualizar para carregar as métricas'):sleep?card('Sono mais recente',`${fmtNum(sleep.value)} ${sleep.unit||'h'}`,fmtDate(sleep.measured_at)):card('Sono','Ainda sem dado importado')}
    </div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Últimos registros</b><small>O que entrou mais recentemente no seu histórico.</small></div></div><div class="quickList">
        ${failed('workouts')?'<div><span>Treino</span><b>Indisponível agora</b><small>Os registros de treino não foram substituídos por zero.</small></div>':lastWorkout?`<div><span>Treino</span><b>${fmtDate(lastWorkout.workout_date)}</b><small>${esc(lastWorkout.workout_type||'Treino')}</small></div>`:''}
        ${failed('body')?'<div><span>Bio</span><b>Indisponível agora</b><small>As medições corporais não foram substituídas por zero.</small></div>':lastBody?`<div><span>Bio</span><b>${fmtDate(lastBody.measured_at)}</b><small>${fmtNum(lastBody.weight_kg)} kg · MME ${fmtNum(lastBody.skeletal_muscle_mass_kg)} kg</small></div>`:''}
        ${failed('labs')?'<div><span>Exames</span><b>Indisponíveis agora</b><small>Tente atualizar para carregar as coletas novamente.</small></div>':lab?`<div><span>Exames</span><b>${fmtDate(lab.date)}</b><small>${lab.count} resultado(s) · ${esc(lab.lab||'laboratório registrado')}</small></div>`:''}
      </div></div>
      <div class="card"><div class="cardHead"><div><b>Fontes ainda a trazer</b><small>Quando uma fonte não pode ser verificada, ela aparece como indisponível em vez de ausente.</small></div></div><div class="quickList">
        ${sourceRow('Apple Saúde',apple,'Export ainda não importado')}
        ${sourceRow('Einstein',einstein,'Exames ainda não importados')}
        ${apple==='ready'&&einstein==='ready'?'<div><b>As fontes principais já têm algum dado relacionado.</b></div>':''}
      </div></div>
    </div>`;
}
