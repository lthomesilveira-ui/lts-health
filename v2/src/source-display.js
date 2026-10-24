// Presentation only. Source identities, selection keys, statuses and clinical
// text are never rewritten. Use this helper only for source metadata labels.
const normalized=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function displaySource(value,family=''){
  const label=String(value??'').trim(),key=normalized(label);
  const exact={apple_health:'Apple Saúde',healthkit_candidate:'Apple Saúde',apple_activity_summary:'Apple Saúde',polar_flow:'Polar Flow',myfitnesspal:'MyFitnessPal',nutrition:'Histórico alimentar',sourceMetrics:'Diário importado'};
  const names={'Apple Saúde · MyFitnessPal (Health Auto Export)':'MyFitnessPal via Saúde','MyFitnessPal export':'MyFitnessPal · histórico','Apple Saúde · Health Sync':'Água do Saúde'};
  if(names[label])return names[label];
  if(exact[label])return exact[label];
  if(key==='apple_watch')return'Apple Watch';
  if(/^[a-z][a-z0-9]*_[a-z0-9_]+$/i.test(label))return'Origem importada';
  if(key==='apple health activitysummary')return'Apple Saúde';
  if(key==='claude migration'||key==='projeto'||key==='conversa')return'Histórico LTS Health';
  if(key==='user-reported completed workout'||key==='workout log')return'Registro de treino';
  if(!label)return exact[family]||'Origem não informada';
  return label;
}
function sourceKind(source){
  if(source?.status==='held')return'Registro com limitações';
  if(source?.status==='candidate')return'Registro adicional';
  if(source?.domain==='nutrition')return'Histórico alimentar';
  if(source?.domain==='sourceMetrics')return'Diário importado';
  if(source?.domain==='metrics')return'Histórico de atividade';
  return'';
}
function basicLabel(source){
  if(typeof source==='string')return displaySource(source);
  const name=displaySource(source?.label||source?.source_name||source?.source,source?.sourceFamily||source?.source_family),kind=sourceKind(source);
  return kind?`${name} · ${kind}`:name;
}
export function sourceDisplayLabel(source,sources=[]){
  const label=basicLabel(source);
  // Keep distinct original identities selectable even when their display labels
  // coincide. The stable ordering never chooses, combines or ranks their values.
  const peers=(Array.isArray(sources)?sources:[]).filter(item=>basicLabel(item)===label);
  const keys=[...new Set(peers.map(item=>String(item?.key||'')))].sort();
  return source?.key&&keys.length>1?`${label} ${keys.indexOf(String(source.key))+1}`:label;
}
export function sourceDisplayNote(source){
  const original=String(source?.label||source?.source_name||source?.source||'').trim();
  const name=original&&displaySource(original,source?.sourceFamily||source?.source_family)!==original?`Nome informado pela origem: ${original}. `:'';
  if(source?.status==='held')return name+'Este registro tem limitações para comparação e permanece separado das outras versões. Consulte as datas e os valores disponíveis.';
  if(source?.status==='candidate')return name+'Esta é uma versão adicional do registro. Ela permanece separada das outras fontes e não confirma um dia completo.';
  return name+'Cada origem mantém seu próprio histórico. Um dia com valores pode estar incompleto; fontes diferentes não são somadas.';
}
