import {state,esc,day,fmtDate,fmtNum,num,workoutRows,bodyRows,unique,norm} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1>${description?`<p>${esc(description)}</p>`:''}</div></div>`;
const localDay=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;};
const card=(label,main,sub='',kind='')=>`<article class="todayCard ${kind}"><span>${esc(label)}</span><b>${esc(main)}</b>${sub?`<small>${esc(sub)}</small>`:''}</article>`;

function latestLab(){
  const rows=state.data.labs||[];if(!rows.length)return null;const date=[...rows].map(r=>r.collection_date).filter(Boolean).sort().at(-1),same=rows.filter(r=>r.collection_date===date);return{date,count:same.length,lab:unique(same.map(r=>r.laboratory)).join(', ')};
}
function hasSource(term,rows,fields){return(rows||[]).some(r=>fields.some(f=>norm(r?.[f]).includes(term)));}

export function renderTodayHub(){
  const today=localDay(),workouts=workoutRows(),body=bodyRows(),lastWorkout=workouts[0],lastBody=body.at(-1),nutrition=(state.data.nutrition||[]).find(n=>day(n.nutrition_date)===today),sleep=[...(state.data.metrics||[])].filter(m=>m.metric_type==='sleep_duration_h').sort((a,b)=>String(b.measured_at).localeCompare(String(a.measured_at)))[0],lab=latestLab();
  const uploads=state.data.uploads||[],metrics=state.data.metrics||[],labs=state.data.labs||[];
  const apple=uploads.some(u=>norm(u.source_type)==='apple_health')||hasSource('apple',metrics,['source','source_file']);
  const einstein=uploads.some(u=>norm(u.source_type)==='einstein')||hasSource('einstein',labs,['laboratory','source','source_file']);
  return `${title('Hoje',fmtDate(today))}
    <div class="todayGrid">
      ${lastWorkout?card('Último treino',lastWorkout.workout_type||'Treino',`${fmtDate(lastWorkout.workout_date)}${lastWorkout.location?` · ${lastWorkout.location}`:''}`):card('Último treino','Sem treino registrado')}
      ${lastBody?card('Última bio',`${fmtNum(lastBody.weight_kg)} kg`,`MME ${fmtNum(lastBody.skeletal_muscle_mass_kg)} kg · ${fmtDate(lastBody.measured_at)}`):card('Última bio','Sem bio registrada')}
      ${nutrition?card('Alimentação hoje',num(nutrition.calories_kcal)!=null?`${fmtNum(nutrition.calories_kcal,0)} kcal`:'Registro disponível',num(nutrition.protein_g)!=null?`${fmtNum(nutrition.protein_g,0)} g proteína`:''):card('Alimentação hoje','Sem registro para hoje')}
      ${sleep?card('Sono mais recente',`${fmtNum(sleep.value)} ${sleep.unit||'h'}`,fmtDate(sleep.measured_at)):card('Sono','Ainda sem dado importado')}
    </div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Últimos registros</b><small>O que entrou mais recentemente no seu histórico.</small></div></div><div class="quickList">
        ${lastWorkout?`<div><span>Treino</span><b>${fmtDate(lastWorkout.workout_date)}</b><small>${esc(lastWorkout.workout_type||'Treino')}</small></div>`:''}
        ${lastBody?`<div><span>Bio</span><b>${fmtDate(lastBody.measured_at)}</b><small>${fmtNum(lastBody.weight_kg)} kg · MME ${fmtNum(lastBody.skeletal_muscle_mass_kg)} kg</small></div>`:''}
        ${lab?`<div><span>Exames</span><b>${fmtDate(lab.date)}</b><small>${lab.count} resultado(s) · ${esc(lab.lab||'laboratório registrado')}</small></div>`:''}
      </div></div>
      <div class="card"><div class="cardHead"><div><b>Fontes ainda a trazer</b><small>Só aparecem aqui as fontes que ainda não estão presentes.</small></div></div><div class="quickList">
        ${!apple?'<div><span>Apple Saúde</span><b>Export ainda não importado</b><small>Quando enviado, entra na área Dados.</small></div>':''}
        ${!einstein?'<div><span>Einstein</span><b>Exames ainda não importados</b><small>Envie os PDFs pela área Dados.</small></div>':''}
        ${apple&&einstein?'<div><b>As fontes principais já têm algum dado relacionado.</b></div>':''}
      </div></div>
    </div>`;
}
