import {state,esc,fmtDate,norm,countLabel} from './core.js';
import {sourceStatusFor,sourceCoverageFor,uploadBucket} from './source-status.js';
import {historicalMyFitnessPalWaterStatus} from './hydration.js';
import {screenTitle as title} from './product-shell.js';
import {renderConnections} from './polar-connection.js';

const empty=text=>`<div class="empty">${esc(text)}</div>`;
const pill=(text,kind='')=>`<span class="pill ${kind}">${esc(text)}</span>`;
const failed=key=>state.domainStatus[key]==='error';
const dateValue=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||'').slice(0,10))?String(value).slice(0,10):null;

function sourceState(){
  return [
    {key:'apple_health',name:'Apple Saúde',status:sourceStatusFor('apple_health'),...sourceCoverageFor('apple_health'),readyDetail:'Há registros do Apple Saúde no seu histórico.',candidateDetail:'Há registros adicionais do Apple Saúde. Eles mantêm sua origem e suas limitações nos detalhes.',missingDetail:'Configure o Health Auto Export abaixo ou envie um arquivo do app Saúde.',action:'Enviar Apple Saúde',scope:'Entram automaticamente em Atividade: energia ativa, minutos de exercício e horas em pé. Passos, frequência cardíaca em repouso, variabilidade da frequência cardíaca, frequência respiratória, peso, volume de água e sono ficam separados até conferência. Fontes diferentes de sono e hidratação continuam separadas. Com o Health Auto Export, alimentação e água registradas entram nos relatórios com sua origem.'},
    {key:'polar_flow',name:'Polar Flow',status:sourceStatusFor('polar_flow'),...sourceCoverageFor('polar_flow'),readyDetail:'Há dados do Polar Flow no histórico.',candidateDetail:'Há registros adicionais do Polar Flow. Eles mantêm sua origem e suas limitações nos detalhes.',missingDetail:'Envie um arquivo do Polar Flow ou permita o compartilhamento pelo Apple Saúde.',action:'Enviar Polar',scope:'O Polar complementa atividade e detalhes de treino. Quando um treino já está registrado por outra fonte, ele não é contado novamente só por aparecer no Polar.'},
    {key:'myfitnesspal',name:'MyFitnessPal',status:sourceStatusFor('myfitnesspal'),...sourceCoverageFor('myfitnesspal'),readyDetail:'Há alimentação do MyFitnessPal no histórico principal.',candidateDetail:'Há totais do MyFitnessPal enviados por outro aplicativo. Eles permanecem separados do histórico alimentar principal.',missingDetail:'Envie um arquivo do MyFitnessPal ou conecte-o ao Apple Saúde.',action:'Enviar MyFitnessPal',scope:'O arquivo direto do MyFitnessPal é a fonte preferida. Importações antigas recebidas pelo Apple Saúde ficam separadas até conferência. O Health Auto Export permite atualizar os totais diários, mantendo a origem e a prioridade dos arquivos originais; alimentos, refeições e horários não são inventados.'},
    {key:'fleury',name:'Fleury',status:sourceStatusFor('fleury'),...sourceCoverageFor('fleury'),readyDetail:'Há resultados do Fleury no histórico.',missingDetail:'Envie CSV, PDF ou imagem do exame.',action:'Enviar Fleury',scope:'O arquivo original é preservado. Um resultado só entra nas comparações quando a leitura é segura; valor, unidade ou referência ambíguos ficam para revisão.'},
    {key:'einstein',name:'Einstein',status:sourceStatusFor('einstein'),...sourceCoverageFor('einstein'),readyDetail:'Há resultados do Einstein no histórico.',missingDetail:'Ainda não há resultado identificado como Einstein. Envie CSV, PDF ou imagem quando quiser incluir essa origem.',action:'Enviar Einstein',scope:'O arquivo original é preservado. Um resultado só entra nas comparações quando a leitura é segura; valor, unidade ou referência ambíguos ficam para revisão.'}
  ];
}

function statusCard(source){
  const labels={ready:'com dados',candidate:'registros adicionais',processing:'processando',attention:'aguardando leitura',received:'arquivo recebido',unknown:'não foi possível verificar',missing:'ainda não conectado'};
  const detail=source.status==='ready'?source.readyDetail:source.status==='candidate'?(source.candidateDetail||'Há registros adicionais desta origem, mantidos separadamente.'):source.status==='processing'?'O arquivo foi recebido e ainda está sendo processado.':source.status==='attention'?'O arquivo está guardado e ainda não entrou nas análises.':source.status==='received'?'O arquivo foi recebido e ainda não foi incluído nos resumos.':source.status==='unknown'?'Não foi possível verificar essa origem agora.':source.missingDetail;
  const kind=source.status==='ready'?'ok':source.status==='attention'||source.status==='unknown'?'warn':'';
  const coverage=[];
  if(source.status==='ready'&&source.confirmedDate)coverage.push(`Registros disponíveis até: ${fmtDate(source.confirmedDate)}`);
  if((source.status==='ready'||source.status==='candidate')&&source.preservedDate&&(!source.confirmedDate||source.preservedDate>source.confirmedDate))coverage.push(`${source.confirmedDate?'Registros adicionais guardados até':'Registros guardados até'}: ${fmtDate(source.preservedDate)}`);
  const freshness=coverage.length?`<small class="sourceFreshness">${coverage.map(esc).join('<br>')}</small>`:'';
  return `<article class="sourceStatus ${source.status==='ready'?'ready':''}"><div class="sourceStatusTop"><b>${esc(source.name)}</b>${pill(labels[source.status]||'não verificado',kind)}</div><p>${esc(detail)}</p>${freshness}<button type="button" data-source-upload="${esc(source.key)}">${esc(source.action)}</button><details class="sourceMore"><summary>O que entra dessa fonte</summary><small class="sourceScope">${esc(source.scope)}</small></details></article>`;
}

const areaDefs=[
  ['Bioimpedâncias','body'],['Treinos','workouts'],['Alimentação por dia','nutrition'],['Refeições','meals'],['Atividade','activity'],['Métricas de saúde','metrics'],['Exames','labs'],['Documentos','docs'],['Tratamentos','treatments']
];
function areaCard(label,key){
  if(failed(key))return`<div class="sourceCard"><div><b>${esc(label)}</b><small>não carregou agora</small></div><span>—</span></div>`;
  const count=(state.data[key]||[]).length;
  return`<div class="sourceCard"><div><b>${esc(label)}</b><small>${count?'no histórico carregado':'nenhum registro encontrado'}</small></div><span>${count}</span></div>`;
}

const sourceLabels={apple_health:'Apple Saúde',polar_flow:'Polar Flow',myfitnesspal:'MyFitnessPal',fleury:'Fleury',einstein:'Einstein',lab:'Exame laboratorial',other:'Outra origem'};
const sourceFamilyLabels={apple_activity_summary:'Apple Saúde',apple_watch:'Apple Watch',iphone:'iPhone',polar_flow:'Polar Flow',myfitnesspal:'MyFitnessPal',ringconn:'RingConn',healthkit_candidate:'Apple Saúde',health_auto_export:'Saúde do iPhone'};
const uploadStatusLabels={uploaded:'recebido',processing:'processando',processed:'processado',imported:'importado',review_required:'aguardando leitura segura',rejected:'não processado',failed:'falha no processamento'};
const issueCategoryLabels={limited_longitudinal_coverage:'Histórico ainda limitado',metadata_only:'Arquivo original ainda não disponível',migration_integrity:'Conferência de histórico',missing_data:'Informação ainda ausente',parsing:'Leitura do arquivo precisa de revisão',source_date_conflict_risk:'Data da fonte precisa de conferência',workout_normalization:'Nome do treino precisa de conferência',workout_parsing:'Detalhe do treino precisa de revisão',missing_event_dose:'Contexto histórico de tratamento'};
const metricTopicLabels={sleep_duration_h:'Sono',steps:'Passos',resting_heart_rate_bpm:'Frequência cardíaca em repouso',hrv_sdnn_ms:'Variabilidade da frequência cardíaca',respiratory_rate_bpm:'Frequência respiratória',oxygen_saturation_pct:'Saturação de oxigênio',weight_kg:'Peso',dietary_energy_kcal:'Alimentação',dietary_protein_g:'Alimentação',dietary_carbs_g:'Alimentação',dietary_fat_g:'Alimentação',dietary_fiber_g:'Alimentação',dietary_water_ml:'Hidratação'};
const metricCoverageLabels={...metricTopicLabels,dietary_energy_kcal:'Energia alimentar',dietary_protein_g:'Proteína alimentar',dietary_carbs_g:'Carboidratos alimentares',dietary_fat_g:'Gordura alimentar',dietary_fiber_g:'Fibra alimentar',dietary_water_ml:'Volume de água'};
const sensitiveQualityPattern=/(^|_)(dose|dosage|frequency|injection|application|aplicacao|medication|medicacao|treatment|tratamento)(_|$)/i;
const internalTextPattern=/(RAW_|STACK_TRACE|INTERNAL_|SENSITIVE_|backend_|source_payload|storage_path|secret|private_field)/i;
// Quality metadata is not a clinical result. Keep its original technical text
// available only on request; never rewrite the underlying record.
const technicalQualityPattern=/\b(can[oô]nic[ao]s?|candidat[ao]s?|retid[ao]s?|payloads?|source_record_id|canonical_status|RPC|SQLSTATE|PostgREST|canonical|candidate|held|quarantined|parser|backlog|backend)\b|dados (?:n[aã]o conferidos|recebidos)|column .*does not exist|relation .*does not exist|\b[a-z]+(?:_[a-z]+){1,}\b/i;
function sourceLabel(value){return sourceLabels[value]||'Outra origem';}
function sourceFamilyLabel(value){return sourceFamilyLabels[value]||'Outra origem';}
function uploadStatus(value){return uploadStatusLabels[value]||'situação não informada';}
function sensitiveQuality(issue){return [issue?.category,issue?.issue_code,issue?.entity_name].some(value=>sensitiveQualityPattern.test(norm(value).replaceAll(' ','_')));}
function issueTitle(issue){return sensitiveQuality(issue)?'Contexto histórico de tratamento':issueCategoryLabels[issue?.category]||'Revisão de qualidade';}
function safeIssueText(value,fallback){const text=String(value||'').trim();return text&&!internalTextPattern.test(text)?text:fallback;}
function safeQualityDescription(issue,fallback){const text=sensitiveQuality(issue)?fallback:safeIssueText(issue?.description,fallback);return technicalQualityPattern.test(text)?fallback:text;}
function qualityDiagnostics(issue){
  if(sensitiveQuality(issue))return'';
  const parts=[['Observação original',safeIssueText(issue?.description,'')],['Resolução original',safeIssueText(issue?.resolution_notes,'')]].filter(([,text])=>technicalQualityPattern.test(text));
  return parts.length?`<details class="sourceMore technicalDiagnostic"><summary>Diagnóstico técnico</summary>${parts.map(([label,text])=>`<p><b>${esc(label)}</b></p><p>${esc(text)}</p>`).join('')}</details>`:'';
}

function previewStatus(status){return({inspected:'processado',ready_for_parser:'arquivo reconhecido',needs_specialized_parser:'aguardando leitura segura',review_required:'aguardando leitura segura',failed:'falha no processamento'})[status]||'situação não detalhada';}
function previewFor(upload,previews){return previews.find(p=>String(p.upload_id)===String(upload.id))||null;}
function previewNotice(preview){
  if(preview?.status==='failed')return'O processamento não foi concluído. O arquivo original continua guardado.';
  if(['review_required','needs_specialized_parser','ready_for_parser'].includes(preview?.status))return'O arquivo está guardado e ainda não entrou nas análises. Você não precisa revisar linha por linha.';
  if(Array.isArray(preview?.warnings)&&preview.warnings.length)return'O arquivo foi preservado com observações para uma leitura posterior.';
  return'';
}
function previewDetail(preview){
  if(!preview)return'<span class="processingMuted">Sem detalhe adicional do processamento.</span>';
  const facts=[preview.detected_format?`Formato: ${String(preview.detected_format).toUpperCase()}`:null,preview.row_count!=null?countLabel(preview.row_count,'registro','registros'):null,preview.date_min||preview.date_max?`${fmtDate(preview.date_min)} → ${fmtDate(preview.date_max)}`:null].filter(Boolean),notice=previewNotice(preview);
  return `<div class="processingDetail"><div>${pill(previewStatus(preview.status),preview.status==='failed'?'warn':preview.status==='inspected'?'ok':'')} ${facts.length?`<span>${esc(facts.join(' · '))}</span>`:''}</div>${notice?`<small>${esc(notice)}</small>`:''}</div>`;
}
function uploadRows(uploads,previews){return uploads.slice(0,40).map(u=>`<div class="uploadAuditRow"><time>${fmtDate(u.created_at)}</time><div><b>${esc(u.original_filename||'Arquivo')}</b><small>${esc(sourceLabel(u.source_type))} · ${esc(uploadStatus(u.status))}</small>${previewDetail(previewFor(u,previews))}</div></div>`).join('')||empty('Nenhum arquivo corresponde aos filtros.');}

function filteredUploads(uploads){const status=state.ui.dataUploadStatus||'all',source=state.ui.dataUploadSource||'all';return uploads.filter(upload=>(status==='all'||uploadBucket(upload)===status)&&(source==='all'||String(upload.source_type||'other')===source));}
function uploadFilters(uploads){const sources=[...new Set(uploads.map(u=>String(u.source_type||'other')).filter(Boolean))].sort((a,b)=>sourceLabel(a).localeCompare(sourceLabel(b),'pt-BR'));return `<div class="controls"><label>Situação<select id="dataUploadStatus"><option value="all">Todos</option><option value="attention">Precisa de atenção</option><option value="in_progress">Em andamento</option><option value="done">Concluídos</option></select></label><label>Origem<select id="dataUploadSource"><option value="all">Todas</option>${sources.map(source=>`<option value="${esc(source)}">${esc(sourceLabel(source))}</option>`).join('')}</select></label></div>`;}

function processingCounts(uploads){
  const counts={waiting:0,done:0,safeReview:0,failed:0};
  for(const upload of uploads){
    const status=String(upload.status||'').toLowerCase();
    if(status==='uploaded'||status==='processing')counts.waiting++;
    else if(status==='processed'||status==='imported')counts.done++;
    else if(status==='review_required')counts.safeReview++;
    else if(status==='rejected'||status==='failed')counts.failed++;
  }
  return counts;
}
function actionableIssues(issues){return issues.filter(issue=>['open','in_progress'].includes(String(issue.status||'').toLowerCase()));}
function actionableUploads(uploads){return uploads.filter(upload=>['rejected','failed'].includes(String(upload.status||'').toLowerCase()));}
function reviewRows(rows){return (rows||[]).filter(row=>['candidate','held'].includes(String(row.canonical_status||'').toLowerCase()));}

function reviewTopics(rows){
  const groups=new Map();
  for(const row of reviewRows(rows)){
    const topic=metricTopicLabels[row.metric_type]||'Outras métricas';
    if(!groups.has(topic))groups.set(topic,{count:0,sources:new Set(),latest:null});
    const group=groups.get(topic);group.count++;group.sources.add(sourceFamilyLabel(row.source_family));
    const date=dateValue(row.metric_date);if(date&&(!group.latest||date>group.latest))group.latest=date;
  }
  return [...groups.entries()].sort((a,b)=>b[1].count-a[1].count||a[0].localeCompare(b[0],'pt-BR'));
}
function reviewTopicCards(rows){
  if(failed('sourceMetrics'))return'<div class="errorState"><b>Não foi possível carregar os registros adicionais agora.</b><span>O histórico já disponível continua guardado.</span></div>';
  const groups=reviewTopics(rows);
  if(!groups.length)return empty('Nenhum registro adicional para mostrar agora.');
  return `<div class="reviewTopicGrid">${groups.map(([topic,group])=>`<div class="reviewTopic"><div><b>${esc(topic)}</b><small>${esc([...group.sources].join(' + '))}${group.latest?` · até ${esc(fmtDate(group.latest))}`:''}</small></div><strong>${group.count}</strong></div>`).join('')}</div>`;
}

function complementaryCoverageGroups(rows){
  const groups=new Map();
  for(const row of reviewRows(rows)){
    const family=String(row.source_family||'unknown'),metric=String(row.metric_type||'unknown'),unit=String(row.unit||'').trim()||'unidade não informada',key=`${family}\u0000${metric}\u0000${unit}`;
    if(!groups.has(key))groups.set(key,{family,metric,unit,count:0,first:null,last:null});
    const group=groups.get(key),date=dateValue(row.metric_date);group.count++;
    if(date&&(!group.first||date<group.first))group.first=date;
    if(date&&(!group.last||date>group.last))group.last=date;
  }
  return [...groups.values()].sort((a,b)=>sourceFamilyLabel(a.family).localeCompare(sourceFamilyLabel(b.family),'pt-BR')||(metricCoverageLabels[a.metric]||a.metric).localeCompare(metricCoverageLabels[b.metric]||b.metric,'pt-BR')||a.unit.localeCompare(b.unit,'pt-BR'));
}
function complementaryCoverage(rows){
  const groups=complementaryCoverageGroups(rows);
  if(!groups.length)return '<div class="complementaryCoverage" data-complementary-coverage><div class="coverageHead"><div><h3>Períodos dos registros adicionais</h3><p>Nenhum registro adicional para mostrar agora.</p></div></div></div>';
  return `<div class="complementaryCoverage" data-complementary-coverage><div class="coverageHead"><div><h3>Períodos dos registros adicionais</h3><p>Veja as datas disponíveis em cada origem. Estes registros ficam separados e não entram juntos em médias ou tendências.</p></div>${pill(countLabel(groups.length,'série','séries'))}</div><div class="coverageList">${groups.map(group=>`<div class="coverageRow"><div class="coverageIdentity"><b>${esc(sourceFamilyLabel(group.family))}</b><small>${esc(metricCoverageLabels[group.metric]||'Outra métrica')}</small></div><div class="coveragePeriod"><span>Período</span><b>${group.first&&group.last?`${esc(fmtDate(group.first))} → ${esc(fmtDate(group.last))}`:'data não informada'}</b></div><div class="coverageUnit"><span>Unidade</span><b>${esc(group.unit)}</b></div><div class="coverageCount"><strong>${group.count}</strong><span>${group.count===1?'registro':'registros'}</span></div></div>`).join('')}</div><p class="footerNote">As contagens mostram quantos registros existem em cada origem, sem avaliar os resultados de saúde.</p></div>`;
}

function reviewInbox(uploads,previews,issues,sourceMetrics){
  const uploadCounts=processingCounts(uploads),internalActions=failed('quality')?[]:actionableIssues(issues),uploadActions=failed('uploads')?[]:actionableUploads(uploads),manualCount=uploadActions.length,internalCount=internalActions.length,userActionKnown=!failed('uploads');
  const heldRows=failed('sourceMetrics')?null:reviewRows(sourceMetrics),safeCount=(heldRows?.length||0)+uploadCounts.safeReview;
  const headline=!userActionKnown?'Não foi possível verificar seus arquivos agora':manualCount?`${manualCount} ${manualCount===1?'arquivo precisa':'arquivos precisam'} de atenção`:'Nenhuma ação sua é necessária';
  const explanation=!userActionKnown?'Os arquivos continuam guardados. Atualize para verificar se algum envio precisa de atenção.':manualCount?'Os arquivos abaixo não puderam ser lidos. Você pode enviá-los novamente para tentar outra leitura.':internalCount?`Há ${internalCount} ${internalCount===1?'observação':'observações'} em análise. Os registros com limitações ficam guardados separadamente, sem alterar seus resumos.`:safeCount?`Há ${safeCount} ${safeCount===1?'registro adicional':'registros adicionais'} fora dos resumos. Eles não entram em médias nem são somados entre fontes.`:'Seus arquivos e registros disponíveis aparecem abaixo.';
  const manualRows=uploadActions.map(upload=>`<div class="reviewActionRow"><div><b>${esc(upload.original_filename||'Arquivo')}</b><small>${esc(sourceLabel(upload.source_type))} · envie novamente se quiser tentar outra leitura.</small></div>${pill('sua atenção','warn')}</div>`);
  const internalRows=internalActions.slice(0,8).map(issue=>`<div class="reviewActionRow"><div><b>${esc(issueTitle(issue))}</b><small>${esc(safeQualityDescription(issue,'Esta observação está em análise. Você não precisa revisar o registro.'))}</small>${qualityDiagnostics(issue)}</div>${pill('em análise')}</div>`);
  const userActionBlock=!userActionKnown?'<div class="errorState"><b>Não foi possível verificar seus envios agora.</b><span>Os arquivos já recebidos continuam guardados; atualize para tentar novamente.</span></div>':manualRows.length?`<div class="reviewActionList" data-user-actions><h3>Arquivos para tentar novamente</h3>${manualRows.join('')}</div>`:'';
  const internalBlock=internalRows.length?`<div class="reviewActionList" data-internal-quality><h3>Observações em análise</h3>${internalRows.join('')}</div>`:'';
  return `<section class="card reviewInbox" data-review-inbox>
    <div class="reviewInboxHero"><div><span class="reviewEyebrow">Seus arquivos</span><h2>${esc(headline)}</h2><p>${esc(explanation)}</p></div>${pill(!userActionKnown?'indisponível agora':manualCount?'atenção':'sem ação pendente',!userActionKnown||manualCount?'warn':'ok')}</div>
    ${userActionBlock}
    <details class="sourceMore" data-disclosure="data-record-status"><summary>Ver situação dos registros</summary>
    <div class="reviewInboxStats">
      <div class="reviewStat ${userActionKnown&&manualCount?'attention':''}"><span>Sua atenção</span><strong>${userActionKnown?manualCount:'—'}</strong><small>${!userActionKnown?'não foi possível verificar':manualCount?'arquivos que pedem ação':'nenhuma decisão pendente'}</small></div>
      <div class="reviewStat"><span>Em análise</span><strong>${failed('quality')?'—':internalCount}</strong><small>observações sobre os registros</small></div>
      <div class="reviewStat"><span>Registros adicionais</span><strong>${failed('sourceMetrics')||failed('uploads')?'—':safeCount}</strong><small>guardados fora dos resumos</small></div>
      <div class="reviewStat"><span>Em processamento</span><strong>${failed('uploads')?'—':uploadCounts.waiting}</strong><small>arquivos sendo lidos</small></div>
    </div>
    ${internalBlock}
    <div class="reviewQueue"><div class="reviewQueueHead"><div><h3>Registros adicionais por assunto</h3><p>Estes registros continuam separados e não entram juntos nos resumos.</p></div>${heldRows?pill(countLabel(heldRows.length,'registro','registros')):''}</div>${reviewTopicCards(sourceMetrics)}</div>
    </details>
  </section>`;
}

function provenanceOverview(metricRows,workoutEvidenceRows){
  const metricsFailed=failed('sourceMetrics'),evidenceFailed=failed('workoutEvidence');
  if(metricsFailed&&evidenceFailed)return'<div class="errorState"><b>Não foi possível carregar as origens agora.</b><span>O histórico continua guardado. Atualize para tentar novamente.</span></div>';
  const groups=new Map();
  const add=(family,status,date,kind)=>{
    family=String(family||'unknown');
    if(!groups.has(family))groups.set(family,{total:0,confirmed:0,review:0,preserved:0,latest:null,kinds:new Set()});
    const group=groups.get(family);group.total++;group.kinds.add(kind);
    status=String(status||'').toLowerCase();
    if(status==='canonical'||status==='confirmed')group.confirmed++;else if(['candidate','held'].includes(status))group.review++;else group.preserved++;
    date=dateValue(date);if(date&&(!group.latest||date>group.latest))group.latest=date;
  };
  if(!metricsFailed)for(const row of metricRows||[])add(row.source_family,row.canonical_status,row.metric_date,'métricas');
  if(!evidenceFailed)for(const row of workoutEvidenceRows||[])add(row.source_family,row.evidence_status,row.workout_date,'registros do treino');
  const cards=[...groups.entries()].sort((a,b)=>b[1].total-a[1].total||sourceFamilyLabel(a[0]).localeCompare(sourceFamilyLabel(b[0]),'pt-BR')).map(([family,group])=>`<div class="sourceCard provenanceCard"><div><b>${esc(sourceFamilyLabel(family))}</b><small>${group.latest?`dados até ${esc(fmtDate(group.latest))} · `:''}${group.confirmed} com leitura confirmada · ${group.review} registros adicionais${group.preserved?` · ${countLabel(group.preserved,'guardado','guardados')} fora dos resumos`:''} · ${esc([...group.kinds].join(' + '))}</small></div><span>${group.total}</span></div>`).join('');
  const partial=metricsFailed?'<p class="footerNote">As origens das medidas não carregaram agora; os registros adicionais de treino continuam disponíveis.</p>':evidenceFailed?'<p class="footerNote">Os registros adicionais de treino não carregaram agora; as origens das medidas continuam disponíveis.</p>':'';
  const coverage=metricsFailed?'':complementaryCoverage(metricRows);
  return `${partial}<div class="sourceGrid provenanceGrid">${cards||'<div class="sourceCard"><div><b>Sem registros separados por origem</b><small>Nenhum registro desse tipo foi carregado.</small></div><span>0</span></div>'}</div>${coverage}<p class="footerNote">Os registros adicionais ficam separados dos resumos. Uma origem não é somada a outra automaticamente.</p>`;
}

function qualityRow(issue,mode){
  const known=!!issueCategoryLabels[issue?.category],sensitive=sensitiveQuality(issue);
  const fallback=sensitive?'O registro histórico permanece guardado.':!known?'Este registro tem uma observação em análise.':'Há uma observação sobre este registro.';
  const detail=safeQualityDescription(issue,fallback),resolution=sensitive?'':safeIssueText(issue?.resolution_notes,'');
  return `<div class="qualityRow"><div><b>${esc(issueTitle(issue))}</b><small>${esc(detail)}</small>${resolution&&!technicalQualityPattern.test(resolution)?`<em>${esc(resolution)}</em>`:''}${qualityDiagnostics(issue)}</div>${pill(mode==='resolved'?'resolvido':mode==='known'?'limitação conhecida':'em análise',mode==='resolved'?'ok':'')}</div>`;
}
function qualitySections(issues){
  if(failed('quality'))return '<div class="errorState"><b>Não foi possível verificar a qualidade dos dados agora.</b><span>Os registros continuam preservados; atualize para tentar novamente.</span></div>';
  const action=actionableIssues(issues),known=issues.filter(issue=>['accepted','known','ignored'].includes(String(issue.status||'').toLowerCase())),resolved=issues.filter(issue=>String(issue.status||'').toLowerCase()==='resolved');
  return `<div class="sourceGrid"><div class="sourceCard"><div><b>Em análise</b><small>nenhuma ação sua é necessária</small></div><span>${action.length}</span></div><div class="sourceCard"><div><b>Limitações conhecidas</b><small>preservadas no histórico</small></div><span>${known.length}</span></div><div class="sourceCard"><div><b>Resolvidos</b><small>já tratados</small></div><span>${resolved.length}</span></div></div><div class="qualityColumns sectionGap"><div><h3>Em análise</h3>${action.map(issue=>qualityRow(issue,'action')).join('')||empty('Nenhuma observação em análise.')}</div><div><h3>Limitações conhecidas</h3>${known.map(issue=>qualityRow(issue,'known')).join('')||empty('Nenhuma limitação registrada.')}</div><div><h3>Resolvidos</h3>${resolved.map(issue=>qualityRow(issue,'resolved')).join('')||empty('Nenhum item resolvido registrado.')}</div></div>`;
}

function waterSourceBridge(){
  const status=historicalMyFitnessPalWaterStatus(state.data,state.domainStatus);
  const dates=status==='imported'?(state.data.sourceMetrics||[]).filter(row=>norm(row?.source_family)==='myfitnesspal'&&row?.metric_type==='dietary_water_ml'&&norm(row?.canonical_status)==='canonical'&&norm(row?.unit)==='ml'&&norm(row?.confidence)==='account_authenticated_export').map(row=>dateValue(row.metric_date)).filter(Boolean).sort():[];
  const detail=status==='unknown'?'Não foi possível verificar o histórico adicional de água agora. Atualize a tela para tentar novamente.':status==='imported'?`Há um histórico adicional de água do MyFitnessPal${dates.length?' de '+fmtDate(dates[0])+' a '+fmtDate(dates.at(-1)):''}. Ele permanece separado dos registros de outras origens.`:'Ainda não há histórico adicional de água importado diretamente do MyFitnessPal. Os registros enviados pelo Saúde continuam na sua própria origem.';
  return `<section class="card sectionGap waterSourceBridge" ${status==='pending'?'data-water-import-pending':''}><details><summary>Histórico adicional</summary><div><span>Água · MyFitnessPal</span><p>${esc(detail)}</p><p>Esta opção é para acrescentar datas antigas. Não é necessário repetir a importação para consultar os registros já disponíveis, e ela não ativa a sincronização da conta.</p></div>${status==='unknown'?'':'<button type="button" data-entry="water-import">Ver opção de importação</button>'}</details></section>`;
}

export function renderDataHub(){
  const uploads=failed('uploads')?[]:[...(state.data.uploads||[])].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))),previews=failed('previews')?[]:(state.data.previews||[]),issues=failed('quality')?[]:(state.data.quality||[]),sourceMetrics=state.data.sourceMetrics||[],workoutEvidence=state.data.workoutEvidence||[],filtered=filteredUploads(uploads);
  return `${title('Dados & fontes','Conecte seus aplicativos, envie arquivos e acompanhe as atualizações do seu histórico.','Seu histórico')}
    ${renderConnections()}
    ${reviewInbox(uploads,previews,issues,sourceMetrics)}

    ${waterSourceBridge()}

    <section class="grid cols2 sectionGap dataActions">
      <div class="card"><div class="cardHead"><div><b>Adicionar arquivo</b><small>O original fica em uma área privada. O que puder ser lido com segurança entra no histórico; o restante fica guardado sem inventar informação.</small></div></div><form id="uploadForm" class="uploadForm"><label>Origem<select id="uploadType"><option value="apple_health">Apple Saúde</option><option value="polar_flow">Polar Flow</option><option value="myfitnesspal">MyFitnessPal</option><option value="fleury">Fleury</option><option value="einstein">Einstein</option><option value="other">Outra origem</option></select></label><label>Arquivo<input id="uploadFile" type="file" required></label><button type="submit">Enviar arquivo</button><p id="uploadMsg" class="footerNote" aria-live="polite"></p></form></div>
      <div class="card"><div class="cardHead"><div><b>Backup dos dados</b><small>Baixe uma cópia dos registros disponíveis na sua conta. O backup não inclui os arquivos originais nem as informações de acesso.</small></div></div><button type="button" id="backupExportBtn">Criar backup</button><p id="backupExportMsg" class="footerNote" aria-live="polite"></p><p class="footerNote">Se alguma área não carregar, o backup não será criado.</p></div>
    </section>

    <section class="card sectionGap"><div class="cardHead"><div><b>O que já está no seu histórico</b><small>Veja quantos registros estão disponíveis em cada área.</small></div></div><div class="sourceGrid">${areaDefs.map(([label,key])=>areaCard(label,key)).join('')}</div></section>

    <section class="sectionGap"><div class="sectionHeading"><div><h2>Fontes</h2><p>Veja quais aplicativos e laboratórios já têm registros e como adicionar novas informações.</p></div></div><div class="sourceStatusGrid">${sourceState().map(statusCard).join('')}</div></section>

    <details class="card sectionGap reviewDetails provenancePanel"><summary><span><b>Detalhes por origem</b><small>Abra se quiser entender de qual dispositivo ou aplicativo vieram os registros.</small></span><span>Ver detalhes</span></summary><div class="reviewDetailsBody">${provenanceOverview(sourceMetrics,workoutEvidence)}</div></details>

    <section class="card sectionGap"><div class="cardHead"><div><b>Histórico de arquivos</b><small>Veja o que foi recebido e filtre por situação ou origem.</small></div></div>${failed('uploads')?'<div class="errorState"><b>Não foi possível verificar os arquivos agora.</b><span>Atualize para tentar novamente.</span></div>':`${uploadFilters(uploads)}<div class="uploadAuditList">${uploadRows(filtered,previews)}</div>`}</section>

    <details class="card sectionGap reviewDetails"><summary><span><b>Qualidade e limitações</b><small>Observações sobre os registros e o que já foi resolvido.</small></span><span>Ver detalhes</span></summary><div class="reviewDetailsBody">${qualitySections(issues)}</div></details>`;
}
