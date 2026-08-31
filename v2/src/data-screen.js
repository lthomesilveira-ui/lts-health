import {state,esc,fmtDate,norm} from './core.js';
import {sourceStatusFor,latestSourceEvidenceDateFor,uploadBucket} from './source-status.js';

const empty=text=>`<div class="empty">${esc(text)}</div>`;
const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const pill=(text,kind='')=>`<span class="pill ${kind}">${esc(text)}</span>`;
const failed=key=>state.domainStatus[key]==='error';

function sourceState(){
  return [
    {key:'apple_health',name:'Apple Saúde',status:sourceStatusFor('apple_health'),latestDate:latestSourceEvidenceDateFor('apple_health'),readyDetail:'Há dados confirmados do Apple Saúde no histórico.',candidateDetail:'Há registros do Apple Saúde aguardando conferência antes de entrar nas leituras principais.',missingDetail:'Conecte o app complementar ou envie um export do app Saúde.',action:'Enviar Apple Saúde',scope:'Entram automaticamente em Atividade: energia ativa, minutos de exercício e horas em pé. Passos, frequência cardíaca em repouso, variabilidade da frequência cardíaca, frequência respiratória, peso e sono ficam separados até conferência. Fontes diferentes de sono continuam separadas.'},
    {key:'polar_flow',name:'Polar Flow',status:sourceStatusFor('polar_flow'),latestDate:latestSourceEvidenceDateFor('polar_flow'),readyDetail:'Há dados do Polar Flow no histórico.',candidateDetail:'Há registros do Polar Flow preservados por origem e aguardando conferência.',missingDetail:'Envie um export do Polar Flow ou permita a origem pelo Apple Saúde.',action:'Enviar Polar',scope:'O Polar complementa atividade e detalhes de treino. Quando um treino já está registrado por outra fonte, ele não é contado novamente só por aparecer no Polar.'},
    {key:'myfitnesspal',name:'MyFitnessPal',status:sourceStatusFor('myfitnesspal'),latestDate:latestSourceEvidenceDateFor('myfitnesspal'),readyDetail:'Há alimentação do MyFitnessPal no histórico principal.',candidateDetail:'Há totais diários do MyFitnessPal recebidos pelo Apple Saúde aguardando conferência.',missingDetail:'Envie o export do MyFitnessPal ou conecte-o ao Apple Saúde.',action:'Enviar MyFitnessPal',scope:'O arquivo direto do MyFitnessPal é a fonte preferida. Totais recebidos pelo Apple Saúde ficam separados até conferência; alimentos, refeições e horários não são inventados.'},
    {key:'fleury',name:'Fleury',status:sourceStatusFor('fleury'),latestDate:latestSourceEvidenceDateFor('fleury'),readyDetail:'Há resultados do Fleury no histórico.',missingDetail:'Envie CSV, PDF ou imagem do exame.',action:'Enviar Fleury',scope:'O arquivo original é preservado. Um resultado só entra como valor estruturado quando a leitura é segura; valor, unidade ou referência ambíguos ficam para revisão.'},
    {key:'einstein',name:'Einstein',status:sourceStatusFor('einstein'),latestDate:latestSourceEvidenceDateFor('einstein'),readyDetail:'Há resultados do Einstein no histórico.',missingDetail:'Ainda não há resultado identificado como Einstein. Envie CSV, PDF ou imagem quando quiser incluir essa origem.',action:'Enviar Einstein',scope:'O arquivo original é preservado. Um resultado só entra como valor estruturado quando a leitura é segura; valor, unidade ou referência ambíguos ficam para revisão.'}
  ];
}

function statusCard(source){
  const labels={ready:'com dados',candidate:'aguardando conferência',processing:'processando',attention:'precisa de revisão',received:'arquivo recebido',unknown:'não foi possível verificar',missing:'ainda não conectado'};
  const detail=source.status==='ready'?source.readyDetail:source.status==='candidate'?(source.candidateDetail||'Há registros desta origem aguardando conferência.'):source.status==='processing'?'O arquivo foi recebido e ainda está sendo processado.':source.status==='attention'?'O arquivo está guardado, mas precisa de revisão antes de concluir a leitura.':source.status==='received'?'O arquivo foi recebido; ainda não há dados confirmados derivados dele.':source.status==='unknown'?'Não foi possível verificar essa origem agora.':source.missingDetail;
  const kind=source.status==='ready'?'ok':source.status==='attention'||source.status==='unknown'?'warn':'';
  const freshness=source.latestDate&&(source.status==='ready'||source.status==='candidate')?`<small class="sourceFreshness">Última data disponível: ${esc(fmtDate(source.latestDate))}</small>`:'';
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
const sourceFamilyLabels={apple_activity_summary:'Apple Saúde',apple_watch:'Apple Watch',iphone:'iPhone',polar_flow:'Polar Flow',myfitnesspal:'MyFitnessPal',ringconn:'RingConn',healthkit_candidate:'Outra origem do Apple Saúde'};
const uploadStatusLabels={uploaded:'recebido',processing:'processando',processed:'processado',imported:'importado',review_required:'revisão necessária',rejected:'não processado',failed:'falha no processamento'};
const issueCategoryLabels={limited_longitudinal_coverage:'Histórico ainda limitado',metadata_only:'Arquivo original ainda não disponível',migration_integrity:'Conferência de histórico',missing_data:'Informação ainda ausente',parsing:'Leitura do arquivo precisa de revisão',source_date_conflict_risk:'Data da fonte precisa de conferência',workout_normalization:'Nome do treino precisa de conferência',workout_parsing:'Detalhe do treino precisa de revisão',missing_event_dose:'Contexto histórico de tratamento'};
const sensitiveQualityPattern=/(^|_)(dose|dosage|frequency|injection|application|aplicacao|medication|medicacao|treatment|tratamento)(_|$)/i;
const internalTextPattern=/(RAW_|STACK_TRACE|INTERNAL_|backend_|source_payload|storage_path|secret|private_field)/i;
function sourceLabel(value){return sourceLabels[value]||'Outra origem';}
function sourceFamilyLabel(value){return sourceFamilyLabels[value]||'Outra origem';}
function uploadStatus(value){return uploadStatusLabels[value]||'situação não informada';}
function sensitiveQuality(issue){return [issue?.category,issue?.issue_code,issue?.entity_name].some(value=>sensitiveQualityPattern.test(norm(value).replaceAll(' ','_')));}
function issueTitle(issue){return sensitiveQuality(issue)?'Contexto histórico de tratamento':issueCategoryLabels[issue?.category]||'Revisão de qualidade';}
function safeIssueText(value,fallback){const text=String(value||'').trim();return text&&!internalTextPattern.test(text)?text:fallback;}

function previewStatus(status){return({inspected:'processado',ready_for_parser:'arquivo reconhecido',needs_specialized_parser:'aguarda leitura',review_required:'revisão necessária',failed:'falha no processamento'})[status]||'situação não detalhada';}
function previewFor(upload,previews){return previews.find(p=>String(p.upload_id)===String(upload.id))||null;}
function previewNotice(preview){
  if(preview?.status==='failed')return'O processamento não foi concluído. O arquivo original continua guardado.';
  if(preview?.status==='review_required'||preview?.status==='needs_specialized_parser')return'Há detalhes que precisam de revisão antes de concluir a leitura.';
  if(Array.isArray(preview?.warnings)&&preview.warnings.length)return'Há observações do processamento para revisão.';
  return'';
}
function previewDetail(preview){
  if(!preview)return'<span class="processingMuted">Sem detalhe adicional do processamento.</span>';
  const facts=[preview.detected_format?`Formato: ${String(preview.detected_format).toUpperCase()}`:null,preview.row_count!=null?`${preview.row_count} registro(s)`:null,preview.date_min||preview.date_max?`${fmtDate(preview.date_min)} → ${fmtDate(preview.date_max)}`:null].filter(Boolean),notice=previewNotice(preview);
  return `<div class="processingDetail"><div>${pill(previewStatus(preview.status),preview.status==='failed'||preview.status==='review_required'||preview.status==='needs_specialized_parser'?'warn':'ok')} ${facts.length?`<span>${esc(facts.join(' · '))}</span>`:''}</div>${notice?`<small>${esc(notice)}</small>`:''}</div>`;
}
function uploadRows(uploads,previews){return uploads.slice(0,40).map(u=>`<div class="uploadAuditRow"><time>${fmtDate(u.created_at)}</time><div><b>${esc(u.original_filename||'Arquivo')}</b><small>${esc(sourceLabel(u.source_type))} · ${esc(uploadStatus(u.status))}</small>${previewDetail(previewFor(u,previews))}</div></div>`).join('')||empty('Nenhum arquivo corresponde aos filtros.')}

function filteredUploads(uploads){const status=state.ui.dataUploadStatus||'all',source=state.ui.dataUploadSource||'all';return uploads.filter(upload=>(status==='all'||uploadBucket(upload)===status)&&(source==='all'||String(upload.source_type||'other')===source));}
function uploadFilters(uploads){const sources=[...new Set(uploads.map(u=>String(u.source_type||'other')).filter(Boolean))].sort((a,b)=>sourceLabel(a).localeCompare(sourceLabel(b),'pt-BR'));return `<div class="controls"><label>Situação<select id="dataUploadStatus"><option value="all">Todos</option><option value="attention">Precisa de atenção</option><option value="in_progress">Em andamento</option><option value="done">Concluídos</option></select></label><label>Origem<select id="dataUploadSource"><option value="all">Todas</option>${sources.map(source=>`<option value="${esc(source)}">${esc(sourceLabel(source))}</option>`).join('')}</select></label></div>`;}

function processingCounts(uploads){
  const counts={waiting:0,done:0,review:0,failed:0};
  for(const upload of uploads){const status=String(upload.status||'').toLowerCase();if(status==='uploaded'||status==='processing')counts.waiting+=1;else if(status==='processed'||status==='imported')counts.done+=1;else if(status==='review_required'||status==='rejected')counts.review+=1;else if(status==='failed')counts.failed+=1;}
  return counts;
}
function processingOverview(uploads){
  if(failed('uploads'))return `<div class="sourceGrid"><div class="sourceCard"><div><b>Em andamento</b><small>indisponível agora</small></div><span>—</span></div><div class="sourceCard"><div><b>Concluídos</b><small>indisponível agora</small></div><span>—</span></div><div class="sourceCard"><div><b>Para revisar</b><small>indisponível agora</small></div><span>—</span></div><div class="sourceCard"><div><b>Com falha</b><small>indisponível agora</small></div><span>—</span></div></div>`;
  const c=processingCounts(uploads);
  return `<div class="sourceGrid"><div class="sourceCard"><div><b>Em andamento</b><small>recebidos ou processando</small></div><span>${c.waiting}</span></div><div class="sourceCard"><div><b>Concluídos</b><small>processados ou importados</small></div><span>${c.done}</span></div><div class="sourceCard"><div><b>Para revisar</b><small>pedem conferência</small></div><span>${c.review}</span></div><div class="sourceCard"><div><b>Com falha</b><small>original permanece guardado</small></div><span>${c.failed}</span></div></div>`;
}
function nextStep(uploads,actionIssues){
  if(failed('uploads'))return'<div class="note warn"><b>Não foi possível verificar os arquivos agora.</b><span>Atualize para acompanhar os envios. Os outros dados continuam disponíveis.</span></div>';
  const c=processingCounts(uploads);
  if(c.review||(!failed('quality')&&actionIssues.length))return'<div class="note warn"><b>Há algo para revisar.</b><span>Confira os itens abaixo. O app não completa automaticamente uma informação ambígua.</span></div>';
  if(c.failed)return'<div class="note warn"><b>Há arquivo com processamento incompleto.</b><span>O original continua guardado e pode ser processado novamente depois.</span></div>';
  if(c.waiting)return'<div class="note"><b>Há arquivo em processamento.</b><span>Atualize depois para acompanhar o resultado.</span></div>';
  if(!uploads.length)return'<div class="note"><b>Você pode adicionar uma nova fonte abaixo.</b><span>O arquivo original é guardado antes do processamento.</span></div>';
  return'<div class="note"><b>Nenhuma revisão interna está pendente.</b><span>Limitações que dependem de outro arquivo ou de uma conferência aparecem separadamente abaixo.</span></div>';
}

function provenanceOverview(rows){
  if(failed('sourceMetrics'))return'<div class="errorState"><b>Não foi possível carregar as origens das métricas agora.</b><span>Os dados já confirmados continuam disponíveis. Atualize para tentar novamente.</span></div>';
  const groups=new Map();
  for(const row of rows||[]){
    const family=String(row.source_family||'unknown');
    if(!groups.has(family))groups.set(family,{total:0,confirmed:0,review:0,preserved:0,latest:null});
    const group=groups.get(family);group.total++;
    const status=String(row.canonical_status||'').toLowerCase();
    if(status==='canonical')group.confirmed++;else if(status==='candidate')group.review++;else group.preserved++;
    const date=String(row.metric_date||'');if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&(!group.latest||date>group.latest))group.latest=date;
  }
  const cards=[...groups.entries()].sort((a,b)=>b[1].total-a[1].total||sourceFamilyLabel(a[0]).localeCompare(sourceFamilyLabel(b[0]),'pt-BR')).map(([family,group])=>`<div class="sourceCard provenanceCard"><div><b>${esc(sourceFamilyLabel(family))}</b><small>${group.latest?`dados até ${esc(fmtDate(group.latest))} · `:''}${group.confirmed} confirmado(s) · ${group.review} aguardando conferência${group.preserved?` · ${group.preserved} preservado(s) sem uso automático`:''}</small></div><span>${group.total}</span></div>`).join('');
  return `<div class="sourceGrid provenanceGrid">${cards||'<div class="sourceCard"><div><b>Sem registros separados por origem</b><small>Nenhum registro desse tipo foi carregado.</small></div><span>0</span></div>'}</div><p class="footerNote">Registros aguardando conferência permanecem separados dos dados confirmados. Uma fonte não é somada a outra automaticamente.</p>`;
}

function qualityRow(issue,mode){
  const known=!!issueCategoryLabels[issue?.category],sensitive=sensitiveQuality(issue);
  const fallback=sensitive?'Registro histórico preservado sem detalhe operacional nesta tela.':!known?'Revisão registrada sem detalhe exibido nesta tela.':'Detalhe disponível para revisão.';
  const detail=safeIssueText(issue?.description,fallback),resolution=safeIssueText(issue?.resolution_notes,'');
  return `<div class="qualityRow"><div><b>${esc(issueTitle(issue))}</b><small>${esc(detail)}</small>${resolution?`<em>${esc(resolution)}</em>`:''}</div>${pill(mode==='resolved'?'resolvido':mode==='known'?'limitação conhecida':'revisar',mode==='resolved'?'ok':mode==='action'?'warn':'')}</div>`;
}
function qualitySections(issues){
  if(failed('quality'))return '<div class="errorState"><b>Não foi possível verificar a qualidade dos dados agora.</b><span>Os registros continuam preservados; atualize para tentar novamente.</span></div>';
  const action=issues.filter(issue=>['open','in_progress'].includes(String(issue.status||'').toLowerCase())),known=issues.filter(issue=>['accepted','known','ignored'].includes(String(issue.status||'').toLowerCase())),resolved=issues.filter(issue=>String(issue.status||'').toLowerCase()==='resolved');
  return `<div class="sourceGrid"><div class="sourceCard"><div><b>Ação necessária</b><small>itens para conferir</small></div><span>${action.length}</span></div><div class="sourceCard"><div><b>Limitações conhecidas</b><small>preservadas no histórico</small></div><span>${known.length}</span></div><div class="sourceCard"><div><b>Resolvidos</b><small>já tratados</small></div><span>${resolved.length}</span></div></div><div class="qualityColumns sectionGap"><div><h3>Ação necessária</h3>${action.map(issue=>qualityRow(issue,'action')).join('')||empty('Nenhum item exige revisão agora.')}</div><div><h3>Limitações conhecidas</h3>${known.map(issue=>qualityRow(issue,'known')).join('')||empty('Nenhuma limitação registrada.')}</div><div><h3>Resolvidos</h3>${resolved.map(issue=>qualityRow(issue,'resolved')).join('')||empty('Nenhum item resolvido registrado.')}</div></div>`;
}

export function renderDataHub(){
  const uploads=failed('uploads')?[]:[...(state.data.uploads||[])].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))),previews=failed('previews')?[]:(state.data.previews||[]),issues=failed('quality')?[]:(state.data.quality||[]),filtered=filteredUploads(uploads),actionIssues=issues.filter(issue=>['open','in_progress'].includes(String(issue.status||'').toLowerCase()));
  return `${title('Dados','Veja o que já existe no LTS Health, de onde veio e o que ainda precisa de conferência. Termos internos de processamento ficam fora da interface principal.')}
    <section class="card"><div class="cardHead"><div><b>O que já está no seu histórico</b><small>Contagens do que foi realmente carregado. Uma falha de leitura aparece como indisponível, nunca como zero.</small></div></div><div class="sourceGrid">${areaDefs.map(([label,key])=>areaCard(label,key)).join('')}</div></section>

    <section class="sectionGap"><div class="sectionHeading"><div><h2>Fontes</h2><p>O status abaixo mostra se cada origem já tem dados utilizáveis, se há algo aguardando conferência ou se ainda não foi conectada.</p></div></div><div class="sourceStatusGrid">${sourceState().map(statusCard).join('')}</div></section>

    <section class="card sectionGap provenancePanel"><div class="cardHead"><div><b>Registros preservados por origem</b><small>Alguns dados chegam de mais de um dispositivo ou aplicativo. Eles ficam separados até existir uma regra segura para usá-los.</small></div></div>${provenanceOverview(state.data.sourceMetrics||[])}</section>

    <section class="card sectionGap"><div class="cardHead"><div><b>Acompanhamento dos arquivos</b><small>Recebidos, concluídos, aguardando revisão ou com processamento incompleto.</small></div></div>${processingOverview(uploads)}${nextStep(uploads,actionIssues)}</section>

    <section class="card sectionGap"><div class="cardHead"><div><b>Arquivos recebidos</b><small>Filtre por situação ou origem. Mensagens internas do processamento não são exibidas aqui.</small></div></div>${failed('uploads')?'<div class="errorState"><b>Não foi possível verificar os arquivos agora.</b><span>Atualize para tentar novamente.</span></div>':`${uploadFilters(uploads)}<div class="uploadAuditList">${uploadRows(filtered,previews)}</div>`}</section>

    <section class="card sectionGap"><div class="cardHead"><div><b>Qualidade dos dados</b><small>O que precisa de ação, o que é uma limitação conhecida e o que já foi resolvido.</small></div></div>${qualitySections(issues)}</section>

    <section class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Adicionar arquivo</b><small>O original fica em uma área privada. Se a leitura automática não for segura, o arquivo permanece para revisão.</small></div></div><form id="uploadForm" class="uploadForm"><label>Origem<select id="uploadType"><option value="apple_health">Apple Saúde</option><option value="polar_flow">Polar Flow</option><option value="myfitnesspal">MyFitnessPal</option><option value="fleury">Fleury</option><option value="einstein">Einstein</option><option value="other">Outra origem</option></select></label><label>Arquivo<input id="uploadFile" type="file" required></label><button type="submit">Enviar arquivo</button><p id="uploadMsg" class="footerNote" aria-live="polite"></p></form></div>
      <div class="card"><div class="cardHead"><div><b>Backup dos dados</b><small>Cria um arquivo com os registros estruturados que a sua sessão consegue acessar. Arquivos privados originais e credenciais ficam de fora.</small></div></div><button type="button" id="backupExportBtn">Criar backup</button><p id="backupExportMsg" class="footerNote" aria-live="polite"></p><p class="footerNote">Se qualquer área falhar durante a leitura, o backup não é criado como se estivesse completo.</p></div>
    </section>`;
}