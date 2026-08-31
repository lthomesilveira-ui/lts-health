import {state,esc,fmtDate,norm} from './core.js';
import {sourceStatusFor,sourceCoverageFor,uploadBucket} from './source-status.js';

const empty=text=>`<div class="empty">${esc(text)}</div>`;
const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const pill=(text,kind='')=>`<span class="pill ${kind}">${esc(text)}</span>`;
const failed=key=>state.domainStatus[key]==='error';
const dateValue=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||'').slice(0,10))?String(value).slice(0,10):null;

function sourceState(){
  return [
    {key:'apple_health',name:'Apple Saúde',status:sourceStatusFor('apple_health'),...sourceCoverageFor('apple_health'),readyDetail:'Há dados confirmados do Apple Saúde no histórico.',candidateDetail:'Há registros do Apple Saúde guardados por origem e aguardando uma regra segura antes de entrar nas leituras principais.',missingDetail:'Conecte o app complementar ou envie um export do app Saúde.',action:'Enviar Apple Saúde',scope:'Entram automaticamente em Atividade: energia ativa, minutos de exercício e horas em pé. Passos, frequência cardíaca em repouso, variabilidade da frequência cardíaca, frequência respiratória, peso e sono ficam separados até conferência. Fontes diferentes de sono continuam separadas.'},
    {key:'polar_flow',name:'Polar Flow',status:sourceStatusFor('polar_flow'),...sourceCoverageFor('polar_flow'),readyDetail:'Há dados do Polar Flow no histórico.',candidateDetail:'Há registros do Polar Flow guardados por origem e aguardando uma regra segura.',missingDetail:'Envie um export do Polar Flow ou permita a origem pelo Apple Saúde.',action:'Enviar Polar',scope:'O Polar complementa atividade e detalhes de treino. Quando um treino já está registrado por outra fonte, ele não é contado novamente só por aparecer no Polar.'},
    {key:'myfitnesspal',name:'MyFitnessPal',status:sourceStatusFor('myfitnesspal'),...sourceCoverageFor('myfitnesspal'),readyDetail:'Há alimentação do MyFitnessPal no histórico principal.',candidateDetail:'Há totais do MyFitnessPal recebidos por outra origem e aguardando conferência.',missingDetail:'Envie o export do MyFitnessPal ou conecte-o ao Apple Saúde.',action:'Enviar MyFitnessPal',scope:'O arquivo direto do MyFitnessPal é a fonte preferida. Totais recebidos pelo Apple Saúde ficam separados até conferência; alimentos, refeições e horários não são inventados.'},
    {key:'fleury',name:'Fleury',status:sourceStatusFor('fleury'),...sourceCoverageFor('fleury'),readyDetail:'Há resultados do Fleury no histórico.',missingDetail:'Envie CSV, PDF ou imagem do exame.',action:'Enviar Fleury',scope:'O arquivo original é preservado. Um resultado só entra como valor estruturado quando a leitura é segura; valor, unidade ou referência ambíguos ficam para revisão.'},
    {key:'einstein',name:'Einstein',status:sourceStatusFor('einstein'),...sourceCoverageFor('einstein'),readyDetail:'Há resultados do Einstein no histórico.',missingDetail:'Ainda não há resultado identificado como Einstein. Envie CSV, PDF ou imagem quando quiser incluir essa origem.',action:'Enviar Einstein',scope:'O arquivo original é preservado. Um resultado só entra como valor estruturado quando a leitura é segura; valor, unidade ou referência ambíguos ficam para revisão.'}
  ];
}

function statusCard(source){
  const labels={ready:'com dados',candidate:'aguardando conferência',processing:'processando',attention:'aguardando leitura',received:'arquivo recebido',unknown:'não foi possível verificar',missing:'ainda não conectado'};
  const detail=source.status==='ready'?source.readyDetail:source.status==='candidate'?(source.candidateDetail||'Há registros desta origem aguardando conferência.'):source.status==='processing'?'O arquivo foi recebido e ainda está sendo processado.':source.status==='attention'?'O arquivo está guardado e ainda não entrou nas análises.':source.status==='received'?'O arquivo foi recebido; ainda não há dados confirmados derivados dele.':source.status==='unknown'?'Não foi possível verificar essa origem agora.':source.missingDetail;
  const kind=source.status==='ready'?'ok':source.status==='attention'||source.status==='unknown'?'warn':'';
  const coverage=[];
  if(source.status==='ready'&&source.confirmedDate)coverage.push(`Confirmado até: ${fmtDate(source.confirmedDate)}`);
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
const sourceFamilyLabels={apple_activity_summary:'Apple Saúde',apple_watch:'Apple Watch',iphone:'iPhone',polar_flow:'Polar Flow',myfitnesspal:'MyFitnessPal',ringconn:'RingConn',healthkit_candidate:'Apple Saúde'};
const uploadStatusLabels={uploaded:'recebido',processing:'processando',processed:'processado',imported:'importado',review_required:'aguardando leitura segura',rejected:'não processado',failed:'falha no processamento'};
const issueCategoryLabels={limited_longitudinal_coverage:'Histórico ainda limitado',metadata_only:'Arquivo original ainda não disponível',migration_integrity:'Conferência de histórico',missing_data:'Informação ainda ausente',parsing:'Leitura do arquivo precisa de revisão',source_date_conflict_risk:'Data da fonte precisa de conferência',workout_normalization:'Nome do treino precisa de conferência',workout_parsing:'Detalhe do treino precisa de revisão',missing_event_dose:'Contexto histórico de tratamento'};
const metricTopicLabels={sleep_duration_h:'Sono',steps:'Passos',resting_heart_rate_bpm:'Frequência cardíaca em repouso',hrv_sdnn_ms:'Variabilidade da frequência cardíaca',respiratory_rate_bpm:'Frequência respiratória',oxygen_saturation_pct:'Saturação de oxigênio',weight_kg:'Peso',dietary_energy_kcal:'Alimentação',dietary_protein_g:'Alimentação',dietary_carbs_g:'Alimentação',dietary_fat_g:'Alimentação'};
const sensitiveQualityPattern=/(^|_)(dose|dosage|frequency|injection|application|aplicacao|medication|medicacao|treatment|tratamento)(_|$)/i;
const internalTextPattern=/(RAW_|STACK_TRACE|INTERNAL_|SENSITIVE_|backend_|source_payload|storage_path|secret|private_field)/i;
function sourceLabel(value){return sourceLabels[value]||'Outra origem';}
function sourceFamilyLabel(value){return sourceFamilyLabels[value]||'Outra origem';}
function uploadStatus(value){return uploadStatusLabels[value]||'situação não informada';}
function sensitiveQuality(issue){return [issue?.category,issue?.issue_code,issue?.entity_name].some(value=>sensitiveQualityPattern.test(norm(value).replaceAll(' ','_')));}
function issueTitle(issue){return sensitiveQuality(issue)?'Contexto histórico de tratamento':issueCategoryLabels[issue?.category]||'Revisão de qualidade';}
function safeIssueText(value,fallback){const text=String(value||'').trim();return text&&!internalTextPattern.test(text)?text:fallback;}
function safeQualityDescription(issue,fallback){return sensitiveQuality(issue)?fallback:safeIssueText(issue?.description,fallback);}

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
  const facts=[preview.detected_format?`Formato: ${String(preview.detected_format).toUpperCase()}`:null,preview.row_count!=null?`${preview.row_count} registro(s)`:null,preview.date_min||preview.date_max?`${fmtDate(preview.date_min)} → ${fmtDate(preview.date_max)}`:null].filter(Boolean),notice=previewNotice(preview);
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
  if(failed('sourceMetrics'))return'<div class="errorState"><b>Não foi possível verificar os dados aguardando conferência agora.</b><span>Os dados já confirmados continuam disponíveis.</span></div>';
  const groups=reviewTopics(rows);
  if(!groups.length)return empty('Nenhum registro está aguardando uma regra segura agora.');
  return `<div class="reviewTopicGrid">${groups.map(([topic,group])=>`<div class="reviewTopic"><div><b>${esc(topic)}</b><small>${esc([...group.sources].join(' + '))}${group.latest?` · até ${esc(fmtDate(group.latest))}`:''}</small></div><strong>${group.count}</strong></div>`).join('')}</div>`;
}

function reviewInbox(uploads,previews,issues,sourceMetrics){
  const uploadCounts=processingCounts(uploads),issueActions=failed('quality')?[]:actionableIssues(issues),uploadActions=failed('uploads')?[]:actionableUploads(uploads),manualCount=issueActions.length+uploadActions.length;
  const heldRows=failed('sourceMetrics')?null:reviewRows(sourceMetrics),safeCount=(heldRows?.length||0)+uploadCounts.safeReview;
  const headline=manualCount?`${manualCount} ${manualCount===1?'item realmente precisa':'itens realmente precisam'} de você`:'Nada exige sua ação agora';
  const explanation=manualCount?'Só os itens abaixo pedem uma decisão ou um novo arquivo. O restante fica guardado sem entrar nas análises até existir uma regra segura.':`O LTS Health está guardando ${safeCount} ${safeCount===1?'registro':'registros'} com cautela. Eles não entram em médias nem são somados entre fontes e você não precisa revisar um por um.`;
  const manualRows=[...uploadActions.map(upload=>`<div class="reviewActionRow"><div><b>${esc(upload.original_filename||'Arquivo')}</b><small>${esc(sourceLabel(upload.source_type))} · envie novamente se quiser tentar outra leitura.</small></div>${pill('sua atenção','warn')}</div>`),...issueActions.slice(0,8).map(issue=>`<div class="reviewActionRow"><div><b>${esc(issueTitle(issue))}</b><small>${esc(safeQualityDescription(issue,'Há um ponto que precisa de conferência.'))}</small></div>${pill('sua atenção','warn')}</div>`)];
  return `<section class="card reviewInbox" data-review-inbox>
    <div class="reviewInboxHero"><div><span class="reviewEyebrow">Conferências</span><h2>${esc(headline)}</h2><p>${esc(explanation)}</p></div>${pill(manualCount?'ação necessária':'tudo sob controle',manualCount?'warn':'ok')}</div>
    <div class="reviewInboxStats">
      <div class="reviewStat ${manualCount?'attention':''}"><span>Sua atenção</span><strong>${failed('quality')||failed('uploads')?'—':manualCount}</strong><small>${manualCount?'itens que pedem decisão':'nenhuma decisão pendente'}</small></div>
      <div class="reviewStat"><span>Aguardando regra segura</span><strong>${failed('sourceMetrics')||failed('uploads')?'—':safeCount}</strong><small>guardados sem uso automático</small></div>
      <div class="reviewStat"><span>Em processamento</span><strong>${failed('uploads')?'—':uploadCounts.waiting}</strong><small>arquivos sendo lidos</small></div>
      <div class="reviewStat"><span>Arquivos concluídos</span><strong>${failed('uploads')?'—':uploadCounts.done}</strong><small>processados ou incorporados</small></div>
    </div>
    ${manualRows.length?`<div class="reviewActionList"><h3>O que precisa de você</h3>${manualRows.join('')}</div>`:'<div class="reviewSafeNote"><b>Nenhum clique ou decisão sua é necessário agora.</b><span>O sistema continua preservando as fontes e só vai usar automaticamente o que passar pelas regras de segurança.</span></div>'}
    <div class="reviewQueue"><div class="reviewQueueHead"><div><h3>O que está guardado aguardando uma regra segura</h3><p>Resumo por assunto. Fontes sobrepostas continuam separadas e não são somadas.</p></div>${heldRows?pill(`${heldRows.length} registro(s)`):''}</div>${reviewTopicCards(sourceMetrics)}</div>
  </section>`;
}

function provenanceOverview(rows){
  if(failed('sourceMetrics'))return'<div class="errorState"><b>Não foi possível carregar as origens das métricas agora.</b><span>Os dados já confirmados continuam disponíveis. Atualize para tentar novamente.</span></div>';
  const groups=new Map();
  for(const row of rows||[]){
    const family=String(row.source_family||'unknown');
    if(!groups.has(family))groups.set(family,{total:0,confirmed:0,review:0,preserved:0,latest:null});
    const group=groups.get(family);group.total++;
    const status=String(row.canonical_status||'').toLowerCase();
    if(status==='canonical')group.confirmed++;else if(['candidate','held'].includes(status))group.review++;else group.preserved++;
    const date=dateValue(row.metric_date);if(date&&(!group.latest||date>group.latest))group.latest=date;
  }
  const cards=[...groups.entries()].sort((a,b)=>b[1].total-a[1].total||sourceFamilyLabel(a[0]).localeCompare(sourceFamilyLabel(b[0]),'pt-BR')).map(([family,group])=>`<div class="sourceCard provenanceCard"><div><b>${esc(sourceFamilyLabel(family))}</b><small>${group.latest?`dados até ${esc(fmtDate(group.latest))} · `:''}${group.confirmed} confirmado(s) · ${group.review} aguardando conferência${group.preserved?` · ${group.preserved} preservado(s) sem uso automático`:''}</small></div><span>${group.total}</span></div>`).join('');
  return `<div class="sourceGrid provenanceGrid">${cards||'<div class="sourceCard"><div><b>Sem registros separados por origem</b><small>Nenhum registro desse tipo foi carregado.</small></div><span>0</span></div>'}</div><p class="footerNote">Registros aguardando conferência permanecem separados dos dados confirmados. Uma fonte não é somada a outra automaticamente.</p>`;
}

function qualityRow(issue,mode){
  const known=!!issueCategoryLabels[issue?.category],sensitive=sensitiveQuality(issue);
  const fallback=sensitive?'Registro histórico preservado sem detalhe operacional nesta tela.':!known?'Revisão registrada sem detalhe exibido nesta tela.':'Detalhe disponível para revisão.';
  const detail=sensitive?fallback:safeIssueText(issue?.description,fallback),resolution=sensitive?'':safeIssueText(issue?.resolution_notes,'');
  return `<div class="qualityRow"><div><b>${esc(issueTitle(issue))}</b><small>${esc(detail)}</small>${resolution?`<em>${esc(resolution)}</em>`:''}</div>${pill(mode==='resolved'?'resolvido':mode==='known'?'limitação conhecida':'revisar',mode==='resolved'?'ok':mode==='action'?'warn':'')}</div>`;
}
function qualitySections(issues){
  if(failed('quality'))return '<div class="errorState"><b>Não foi possível verificar a qualidade dos dados agora.</b><span>Os registros continuam preservados; atualize para tentar novamente.</span></div>';
  const action=actionableIssues(issues),known=issues.filter(issue=>['accepted','known','ignored'].includes(String(issue.status||'').toLowerCase())),resolved=issues.filter(issue=>String(issue.status||'').toLowerCase()==='resolved');
  return `<div class="sourceGrid"><div class="sourceCard"><div><b>Ação necessária</b><small>itens para conferir</small></div><span>${action.length}</span></div><div class="sourceCard"><div><b>Limitações conhecidas</b><small>preservadas no histórico</small></div><span>${known.length}</span></div><div class="sourceCard"><div><b>Resolvidos</b><small>já tratados</small></div><span>${resolved.length}</span></div></div><div class="qualityColumns sectionGap"><div><h3>Ação necessária</h3>${action.map(issue=>qualityRow(issue,'action')).join('')||empty('Nenhum item exige revisão agora.')}</div><div><h3>Limitações conhecidas</h3>${known.map(issue=>qualityRow(issue,'known')).join('')||empty('Nenhuma limitação registrada.')}</div><div><h3>Resolvidos</h3>${resolved.map(issue=>qualityRow(issue,'resolved')).join('')||empty('Nenhum item resolvido registrado.')}</div></div>`;
}

export function renderDataHub(){
  const uploads=failed('uploads')?[]:[...(state.data.uploads||[])].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))),previews=failed('previews')?[]:(state.data.previews||[]),issues=failed('quality')?[]:(state.data.quality||[]),sourceMetrics=state.data.sourceMetrics||[],filtered=filteredUploads(uploads);
  return `${title('Dados','Envie arquivos, acompanhe o que já entrou no histórico e veja apenas as conferências que realmente precisam de você.')}
    ${reviewInbox(uploads,previews,issues,sourceMetrics)}

    <section class="grid cols2 sectionGap dataActions">
      <div class="card"><div class="cardHead"><div><b>Adicionar arquivo</b><small>O original fica em uma área privada. O que puder ser lido com segurança entra no histórico; o restante fica guardado sem inventar informação.</small></div></div><form id="uploadForm" class="uploadForm"><label>Origem<select id="uploadType"><option value="apple_health">Apple Saúde</option><option value="polar_flow">Polar Flow</option><option value="myfitnesspal">MyFitnessPal</option><option value="fleury">Fleury</option><option value="einstein">Einstein</option><option value="other">Outra origem</option></select></label><label>Arquivo<input id="uploadFile" type="file" required></label><button type="submit">Enviar arquivo</button><p id="uploadMsg" class="footerNote" aria-live="polite"></p></form></div>
      <div class="card"><div class="cardHead"><div><b>Backup dos dados</b><small>Cria um arquivo com os registros estruturados que a sua sessão consegue acessar. Arquivos privados originais e credenciais ficam de fora.</small></div></div><button type="button" id="backupExportBtn">Criar backup</button><p id="backupExportMsg" class="footerNote" aria-live="polite"></p><p class="footerNote">Se qualquer área falhar durante a leitura, o backup não é criado como se estivesse completo.</p></div>
    </section>

    <section class="card sectionGap"><div class="cardHead"><div><b>O que já está no seu histórico</b><small>Contagens do que foi realmente carregado. Uma falha de leitura aparece como indisponível, nunca como zero.</small></div></div><div class="sourceGrid">${areaDefs.map(([label,key])=>areaCard(label,key)).join('')}</div></section>

    <section class="sectionGap"><div class="sectionHeading"><div><h2>Fontes</h2><p>Veja quais origens já têm dados, quais ainda estão aguardando uma regra segura e quais ainda não foram conectadas.</p></div></div><div class="sourceStatusGrid">${sourceState().map(statusCard).join('')}</div></section>

    <details class="card sectionGap reviewDetails provenancePanel"><summary><span><b>Detalhes por origem</b><small>Abra se quiser entender de qual dispositivo ou aplicativo vieram os registros.</small></span><span>Ver detalhes</span></summary><div class="reviewDetailsBody">${provenanceOverview(sourceMetrics)}</div></details>

    <section class="card sectionGap"><div class="cardHead"><div><b>Histórico de arquivos</b><small>Veja o que foi recebido e filtre por situação ou origem.</small></div></div>${failed('uploads')?'<div class="errorState"><b>Não foi possível verificar os arquivos agora.</b><span>Atualize para tentar novamente.</span></div>':`${uploadFilters(uploads)}<div class="uploadAuditList">${uploadRows(filtered,previews)}</div>`}</section>

    <details class="card sectionGap reviewDetails"><summary><span><b>Qualidade e limitações</b><small>Detalhes de conferências, limitações conhecidas e itens já resolvidos.</small></span><span>Ver detalhes</span></summary><div class="reviewDetailsBody">${qualitySections(issues)}</div></details>`;
}
