import {state,sb,fixtureMode,num,esc,fmtDate,fmtNum} from './core.js';
import {validDay} from './history-tools.js';
import {localHealthDay} from './health-context.js';

export const goalFields=[['calories_kcal','Energia diária','kcal',20000],['protein_g','Proteína diária','g',2000],['carbs_g','Carboidratos diários','g',3000],['fat_g','Gorduras diárias','g',2000],['fiber_g','Fibra diária','g',500],['water_ml','Água diária','mL',30000]];
export function goalForDate(rows,date){return (rows||[]).filter(r=>validDay(r.effective_from)&&r.effective_from<=date).sort((a,b)=>a.effective_from.localeCompare(b.effective_from)).at(-1)||null;}
export function validateGoals(input,today=localHealthDay()){
  const effective_from=validDay(input.effective_from);
  if(!effective_from||effective_from>today)throw new Error('Informe uma data de início válida, até hoje.');
  const result={effective_from};
  for(const[key,label,,max]of goalFields){const raw=input[key];const v=raw==null||String(raw).trim()===''?null:num(String(raw).replace(',','.'));if(raw!=null&&String(raw).trim()!==''&&(v==null||v<=0||v>max))throw new Error(`${label}: informe um valor positivo válido ou deixe em branco.`);result[key]=v;}
  result.notes=String(input.notes||'').trim().slice(0,500);
  return result;
}
export async function saveGoals(form){
  const values=validateGoals(Object.fromEntries(new FormData(form)));
  if(!state.session?.user?.id)throw new Error('Entre novamente para salvar suas metas.');
  if(fixtureMode)throw new Error('Metas não são salvas no modo de demonstração.');
  const {data,error}=await sb.from('health_personal_goals').upsert({...values,user_id:state.session.user.id},{onConflict:'user_id,effective_from'}).select('effective_from,calories_kcal,protein_g,carbs_g,fat_g,fiber_g,water_ml,notes').single();
  if(error)throw new Error('Não foi possível salvar. Suas metas anteriores continuam preservadas.');
  state.data.goals=[...(state.data.goals||[]).filter(r=>r.effective_from!==data.effective_from),data];state.domainStatus.goals='ready';return data;
}
export function goalComparison(rows,goals,key,dateField='date'){
  const paired=rows.flatMap(r=>{const actual=num(r[key]),target=num(goalForDate(goals,r[dateField])?.[key]);return actual!=null&&target>0?[{date:r[dateField],actual,target}]:[];});
  if(!paired.length)return {count:0,actual:null,target:null,delta:null,paired};
  const actual=paired.reduce((s,r)=>s+r.actual,0)/paired.length,target=paired.reduce((s,r)=>s+r.target,0)/paired.length;
  return {count:paired.length,actual,target,delta:actual-target,paired};
}
export function renderGoals(){
  const row=goalForDate(state.data.goals,localHealthDay())||{};
  const unavailable=state.domainStatus.goals==='error';
  return `<details class="ltsGoalSettings" data-disclosure="personal-goals"><summary><span><b>Suas metas</b><small>${unavailable?'Metas indisponíveis nesta atualização':row.effective_from?`Vigentes desde ${fmtDate(row.effective_from)}`:'Use os valores definidos com seu profissional'}</small></span><i>＋</i></summary><form id="personalGoalsForm"><p>As metas são referências informadas por você. Campos em branco ficam sem meta. Uma nova data preserva o histórico; salvar na mesma data atualiza essa versão.</p><label>Válidas desde<input name="effective_from" type="date" required max="${localHealthDay()}" value="${esc(row.effective_from||localHealthDay())}"></label><div class="ltsGoalsGrid">${goalFields.map(([key,label,unit,max])=>`<label>${label} · ${unit}<input name="${key}" type="number" min="0.1" max="${max}" step="0.1" inputmode="decimal" value="${esc(row[key]??'')}" aria-label="${label} em ${unit}"></label>`).join('')}</div><label>Referência da meta<input name="notes" maxlength="500" value="${esc(row.notes||'')}" placeholder="Ex.: plano alimentar e data da consulta"></label><button type="submit" ${unavailable?'disabled':''}>Salvar metas</button><p id="personalGoalsMessage" role="status" aria-live="polite">${esc(state.ui.personalGoalsMessage||'')}</p></form>${state.data.goals?.length?`<details><summary>Histórico de metas</summary>${[...state.data.goals].sort((a,b)=>b.effective_from.localeCompare(a.effective_from)).map(r=>`<p><b>${fmtDate(r.effective_from)}</b> · ${goalFields.filter(([k])=>num(r[k])!=null).map(([k,l,u])=>`${l}: ${fmtNum(r[k],0)} ${u}`).map(esc).join(' · ')||'Sem metas a partir desta data'}</p>`).join('')}</details>`:''}</details>`;
}
