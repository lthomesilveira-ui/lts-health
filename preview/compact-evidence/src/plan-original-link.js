// Called only with a source-validated, selected plan. Never turn document
// inventory metadata or an arbitrary URL into an original-file link.
const suffixes={documented_training_plan:'training-plan',documented_nutrition_plan:'nutrition-plan'};
export function planOriginalUrl(plan){
  const suffix=suffixes[plan?.type];
  if(!suffix||plan.verification?.status!=='source_verified'||!Number.isSafeInteger(plan.page_count)||plan.page_count<1)return null;
  if(!Array.isArray(plan.verification.pages)||plan.verification.pages.length!==plan.page_count||new Set(plan.verification.pages).size!==plan.page_count||!plan.verification.pages.every(p=>Number.isSafeInteger(p)&&p>0&&p<=plan.page_count))return null;
  if(typeof plan.source_sha256!=='string'||!/^[a-f0-9]{64}$/.test(plan.source_sha256)||typeof plan.source_file!=='string'||!/\.pdf$/i.test(plan.source_file))return null;
  const match=typeof plan.source_record_id==='string'&&plan.source_record_id.match(/^library:(libfile_[a-f0-9]{32}):(training-plan|nutrition-plan)$/);
  if(!match||match[2]!==suffix)return null;
  return `https://chatgpt.com/library?file_id=${match[1]}&account_id=personal`;
}
export function renderPlanOriginalLink(plan){
  const url=planOriginalUrl(plan);
  return url?`<div class="planOriginal"><a href="${url.replaceAll('&','&amp;')}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" data-plan-original="${suffixes[plan.type]}">Abrir PDF original no ChatGPT <span aria-hidden="true">↗</span></a><small>Abre em outra janela e pode pedir acesso à sua conta do ChatGPT.</small></div>`:'';
}
