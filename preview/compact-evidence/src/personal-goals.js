import {state,sb,fixtureMode,num,esc,fmtDate,fmtNum} from './core.js';
import {validDay} from './history-tools.js';
import {localHealthDay} from './health-context.js';

export const goalFields=[['calories_kcal','Energia diária','kcal',20000],['protein_g','Proteína diária','g',2000],['carbs_g','Carboidratos diários','g',3000],['fat_g','Gorduras diárias','g',2000],['fiber_g','Fibra diária','g',500],['water_ml','Água diária','mL',30000]];
export function documentedWaterBase(row){
  try{const m=JSON.parse(row?.notes||'');return m.type==='documented_water_base'&&validDay(m.documented_on)&&validDay(row.effective_from)===validDay(m.documented_on)&&m.date_basis==='document_update'&&m.clinical_start==='not_explicit'&&typeof m.source==='string'&&m.source.trim()&&Number.isInteger(m.source_page)&&m.source_page>0&&typeof row.water_ml!=='boolean'&&num(row.water_ml)>0?m:null;}catch{return null;}
}
export function waterReferenceForDate(rows,date,status){
  const dateKey=validDay(date);if(status!=='ready'||!dateKey)return null;
  const numeric=v=>v==null||typeof v==='boolean'||String(v).trim()===''||!Number.isFinite(Number(v))?null:Number(v);
  const eligible=(rows||[]).filter(r=>validDay(r.effective_from)&&validDay(r.effective_from)<=dateKey).sort((a,b)=>validDay(b.effective_from).localeCompare(validDay(a.effective_from)));
  if(!eligible.length)return null;const latest=eligible.filter(r=>validDay(r.effective_from)===validDay(eligible[0].effective_from));
  if(latest.length!==1||goalReferenceMeta(latest[0])||numeric(latest[0].water_ml)==null||numeric(latest[0].water_ml)<=0)return null;
  const row=latest[0],doc=documentedWaterBase(row);if(isProtectedGoalReference(row)&&!doc)return null;
  return {value:numeric(row.water_ml),effectiveFrom:validDay(row.effective_from),dateBasis:doc?'document_update':'personal_target',documentedOn:doc?.documented_on||null,notes:doc?`${doc.source}, página ${doc.source_page}. Data de atualização do documento; início clínico não explicitado. ${doc.exercise_addition||''}`:String(row.notes||''),row};
}
export function goalReferenceMeta(row){
  try{const m=JSON.parse(row?.notes||'');return m.type==='historical_protocol'&&validDay(m.documented_on)&&m.current_validity==='unconfirmed'?m:null;}catch{return null;}
}
export function historicalGoalReference(rows,date=localHealthDay()){
  const row=(rows||[]).filter(r=>goalReferenceMeta(r)&&r.effective_from<=date).sort((a,b)=>a.effective_from.localeCompare(b.effective_from)).at(-1);
  return row?{row,meta:goalReferenceMeta(row)}:null;
}
export function goalForDate(rows,date){return (rows||[]).filter(r=>!isProtectedGoalReference(r)&&validDay(r.effective_from)&&r.effective_from<=date).sort((a,b)=>a.effective_from.localeCompare(b.effective_from)).at(-1)||null;}
export function validateGoals(input,today=localHealthDay()){
  const effective_from=validDay(input.effective_from);
  if(!effective_from||effective_from>today)throw new Error('Informe uma data de início válida, até hoje.');
  const result={effective_from};
  for(const[key,label,,max]of goalFields){const raw=input[key];const v=raw==null||String(raw).trim()===''?null:num(String(raw).replace(',','.'));if(raw!=null&&String(raw).trim()!==''&&(v==null||v<=0||v>max))throw new Error(`${label}: informe um valor positivo válido ou deixe em branco.`);result[key]=v;}
  result.notes=String(input.notes||'').trim().slice(0,500);
  return result;
}
// Preserve source records even when their metadata is incomplete. Presentation
// validation must not turn a damaged reference into an editable personal goal.
export function isProtectedGoalReference(row){
  try{return ['historical_protocol','documented_water_base'].includes(JSON.parse(row?.notes||'').type);}catch{return false;}
}
export async function saveGoals(form){
  const values=validateGoals(Object.fromEntries(new FormData(form)));
  if(!state.session?.user?.id)throw new Error('Entre novamente para salvar suas metas.');
  if(fixtureMode)throw new Error('Metas não são salvas no modo de demonstração.');
  if(state.domainStatus.goals!=='ready')throw new Error('Aguarde o carregamento das metas ou atualize a página antes de salvar.');
  const protectedMessage='Esta data contém uma referência histórica ou documentada que deve ser preservada. Escolha outra data para suas metas; alterar a fonte exige uma revisão específica.';
  if((state.data.goals||[]).some(row=>row.effective_from===values.effective_from&&isProtectedGoalReference(row)))throw new Error(protectedMessage);
  const userId=state.session.user.id;
  let current;
  try{
    const result=await sb.from('health_personal_goals').select('effective_from,notes').eq('user_id',userId).eq('effective_from',values.effective_from).maybeSingle();
    if(result.error)throw result.error;
    current=result.data;
    if(current&&(current.effective_from!==values.effective_from||(current.notes!==null&&typeof current.notes!=='string')))throw new Error('Invalid goal reference');
  }catch{throw new Error('Não foi possível conferir a referência atual desta data. Nenhuma meta foi salva; atualize e tente novamente.');}
  if(isProtectedGoalReference(current))throw new Error(protectedMessage);
  // Never upsert a reference by date. A concurrent insert must fail rather than
  // overwrite it; an update must still match the source metadata just checked.
  let query;
  if(current){
    query=sb.from('health_personal_goals').update(values).eq('user_id',userId).eq('effective_from',values.effective_from);
    query=current.notes===null?query.is('notes',null):query.eq('notes',current.notes);
  }else query=sb.from('health_personal_goals').insert({...values,user_id:userId});
  const {data,error}=await query.select('effective_from,calories_kcal,protein_g,carbs_g,fat_g,fiber_g,water_ml,notes').single();
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
  const historical=historicalGoalReference(state.data.goals);
  const unavailable=state.domainStatus.goals!=='ready';
  const documented=(state.data.goals||[]).filter(r=>documentedWaterBase(r)).sort((a,b)=>a.effective_from.localeCompare(b.effective_from)).at(-1),doc=documentedWaterBase(documented);
  return `<details class="ltsGoalSettings" data-disclosure="personal-goals"><summary><span><b>Suas metas</b><small>${unavailable?'Metas indisponíveis nesta atualização':row.effective_from?`Vigentes desde ${fmtDate(row.effective_from)}`:historical?`Protocolo histórico de ${fmtDate(historical.meta.documented_on)} preservado`:'Use os valores definidos com seu profissional'}</small></span><i>＋</i></summary>${historical?`<p>Referências recuperadas de ${esc(historical.meta.source)} · ${fmtDate(historical.meta.documented_on)}. A vigência atual não foi confirmada; elas não são aplicadas como metas atuais ou retroativas.</p>`:''}${doc?`<p><b>Base de água documentada em ${fmtDate(doc.documented_on)}: ${fmtNum(documented.water_ml,0)} mL/dia.</b> ${esc(doc.source)}, página ${esc(doc.source_page)}. A data é a atualização do documento; início clínico não explicitado. Há adicional conforme exercício, não calculado automaticamente.</p>`:''}<form id="personalGoalsForm"><p>As metas são referências informadas por você. Campos em branco ficam sem meta. Uma nova data preserva o histórico; salvar na mesma data atualiza essa versão.</p><label>Válidas desde<input name="effective_from" type="date" required max="${localHealthDay()}" value="${esc(row.effective_from||localHealthDay())}"></label><div class="ltsGoalsGrid">${goalFields.map(([key,label,unit,max])=>`<label>${label} · ${unit}<input name="${key}" type="number" min="0.1" max="${max}" step="0.1" inputmode="decimal" value="${esc(row[key]??'')}" aria-label="${label} em ${unit}"></label>`).join('')}</div><label>Referência da meta<input name="notes" maxlength="500" value="${esc(row.notes||'')}" placeholder="Ex.: plano alimentar e data da consulta"></label><button type="submit" ${unavailable?'disabled':''}>Salvar metas</button><p id="personalGoalsMessage" role="status" aria-live="polite">${esc(state.ui.personalGoalsMessage||'')}</p></form>${state.data.goals?.length?`<details><summary>Histórico de metas</summary>${[...state.data.goals].sort((a,b)=>b.effective_from.localeCompare(a.effective_from)).map(r=>`<p><b>${fmtDate(r.effective_from)}</b>${goalReferenceMeta(r)?' · referência histórica, vigência atual não confirmada':documentedWaterBase(r)?' · base documentada; início clínico não explicitado':''} · ${goalFields.filter(([k])=>num(r[k])!=null).map(([k,l,u])=>`${l}: ${fmtNum(r[k],0)} ${u}`).map(esc).join(' · ')||'Sem metas a partir desta data'}</p>`).join('')}</details>`:''}</details>`;
}
