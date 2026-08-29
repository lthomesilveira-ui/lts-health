import {state,esc,fmtDate,norm} from './core.js';

const empty=text=>`<div class="empty">${esc(text)}</div>`;
const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const pill=(text,kind='')=>`<span class="pill ${kind}">${esc(text)}</span>`;
const failed=key=>state.domainStatus[key]==='error';
const stableAppleMetricTypes=new Set(['active_energy_kcal','exercise_minutes','stand_hours','sleep_duration_h']);

function contains(rows,fields,term){term=norm(term);return(rows||[]).some(row=>fields.some(field=>norm(row?.[field]).includes(term)));}
function uploadBucket(upload){const status=String(upload?.status||'').toLowerCase();if(status==='uploaded'||status==='processing')return'in_progress';if(status==='processed'||status==='imported')return'done';if(status==='review_required'||status==='rejected'||status==='failed')return'attention';return'other';}
function latestUploadFor(source,uploads){return [...(uploads||[])].filter(u=>norm(u.source_type)===norm(source)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0]||null;}
function sourceStatus({dataFound=false,upload=null,domainKeys=[]}){
  const bucket=uploadBucket(upload);
  if(bucket==='attention')return'attention';
  if(bucket==='in_progress')return'processing';
  if(dataFound)return'ready';
  if(domainKeys.some(failed)||failed('uploads'))return'unknown';
  if(upload)return'received';
  return'missing';
}

function sourceState(){
  const uploads=state.data.uploads||[],workouts=state.data.workouts||[],labs=state.data.labs||[],nutrition=state.data.nutrition||[],meals=state.data.meals||[],metrics=state.data.metrics||[];
  const appleData=metrics.some(m=>stableAppleMetricTypes.has(m.metric_type)&&contains([m],['source','source_file'],'apple'));
  const polarData=contains(workouts,['source','source_file'],'polar');
  const mfpData=contains(nutrition,['source','source_file'],'myfitnesspal')||contains(meals,['source','source_file'],'myfitnesspal');
  const fleuryData=contains(labs,['laboratory','source','source_file'],'fleury');
  const einsteinData=contains(labs,['laboratory','source','source_file'],'einstein');
  return [
    {key:'apple_health',name:'Apple Saúde',status:sourceStatus({dataFound:appleData,upload:latestUploadFor('apple_health',uploads),domainKeys:['metrics']}),capability:'Leitura automática parcial',readyDetail:'Dados compatíveis do Apple Saúde encontrados.',missingDetail:'Envie o export do app Saúde.',action:'Enviar Apple Saúde',scope:'A leitura automática validada inclui energia ativa, minutos de exercício, horas em pé e duração do sono. Passos e FC de repouso não são importados automaticamente por este fluxo; só aparecem quando já existem como registros válidos de outra origem.'},
    {key:'polar_flow',name:'Polar Flow',status:sourceStatus({dataFound:polarData,upload:latestUploadFor('polar_flow',uploads),domainKeys:['workouts']}),capability:'Arquivo + revisão',readyDetail:'Dados do Polar encontrados.',missingDetail:'Envie um export do Polar Flow.',action:'Enviar Polar',scope:'O arquivo é preservado e pode complementar detalhes de treino. O mesmo treino não é contado duas vezes quando outra fonte já o representa.'},
    {key:'myfitnesspal',name:'MyFitnessPal',status:sourceStatus({dataFound:mfpData,upload:latestUploadFor('myfitnesspal',uploads),domainKeys:['nutrition','meals']}),capability:'Leitura automática de nutrição',readyDetail:'Dados do MyFitnessPal encontrados.',missingDetail:'Envie o export do MyFitnessPal.',action:'Enviar MyFitnessPal',scope:'CSV reconhecido consolida calorias e macros por dia. Campo ausente continua ausente.'},
    {key:'fleury',name:'Fleury',status:sourceStatus({dataFound:fleuryData,upload:latestUploadFor('fleury',uploads),domainKeys:['labs']}),capability:'Arquivo preservado + revisão',readyDetail:'Resultados estruturados do Fleury encontrados.',missingDetail:'Envie CSV, PDF ou imagem do exame.',action:'Enviar Fleury',scope:'CSV, PDF ou imagem são preservados. Resultados só são estruturados quando a leitura for validada; valor, unidade ou faixa ambíguos ficam para revisão.'},
    {key:'einstein',name:'Einstein',status:sourceStatus({dataFound:einsteinData,upload:latestUploadFor('einstein',uploads),domainKeys:['labs']}),capability:'Arquivo preservado + revisão',readyDetail:'Resultados estruturados do Einstein encontrados.',missingDetail:'Envie CSV, PDF ou imagem do exame.',action:'Enviar Einstein',scope:'CSV, PDF ou imagem são preservados. Resultados só são estruturados quando a leitura for validada; valor, unidade ou faixa ambíguos ficam para revisão.'}
  ];
}

function statusCard(source){
  const labels={ready:'com dados',processing:'processando',attention:'precisa de atenção',received:'arquivo recebido',unknown:'não verificado',missing:'a importar'};
  const detail=source.status==='ready'?source.readyDetail:source.status==='processing'?'Arquivo recebido e ainda em processamento.':source.status==='attention'?'O arquivo foi preservado, mas precisa de revisão.':source.status==='received'?'Há arquivo desta fonte, sem dado estruturado confirmado nesta tela.':source.status==='unknown'?'Não foi possível confirmar esta fonte agora.':source.missingDetail;
  const kind=source.status==='ready'?'ok':source.status==='attention'||source.status==='unknown'?'warn':'';
  return `<article class="sourceStatus ${source.status==='ready'?'ready':''}"><div class="sourceStatusTop"><b>${esc(source.name)}</b>${pill(labels[source.status]||'não verificado',kind)}</div><span class="sourceCapability">${esc(source.capability)}</span><p>${esc(detail)}</p><button type="button" data-source-upload="${esc(source.key)}">${esc(source.action)}</button><details class="sourceMore"><summary>Como funciona</summary><small class="sourceScope">${esc(source.scope)}</small></details></article>`;
}
function area(label,key){return[label,failed(key)?'—':String((state.data[key]||[]).length),failed(key)?'indisponível agora':'registros'];}

const sourceLabels={apple_health:'Apple Saúde',polar_flow:'Polar Flow',myfitnesspal:'MyFitnessPal',fleury:'Fleury',einstein:'Einstein',lab:'Exame laboratorial',other:'Outra origem'};
const sourceFamilyLabels={apple_activity_summary:'Apple Saúde · ActivitySummary',apple_watch:'Apple Watch',iphone:'iPhone',polar_flow:'Polar Flow'};
const uploadStatusLabels={uploaded:'recebido',processing:'processando',processed:'processado',imported:'importado',review_required:'revisão necessária',rejected:'não processado',failed:'falha no processamento'};
const issueCategoryLabels={limited_longitudinal_coverage:'Histórico ainda limitado',metadata_only:'Arquivo original ainda não disponível',migration_integrity:'Conferência de histórico',missing_data:'Informação ainda ausente',parsing:'Leitura do arquivo precisa de revisão',source_date_conflict_risk:'Data da fonte precisa de conferência',workout_normalization:'Nome do treino precisa de conferência',workout_parsing:'Detalhe do treino precisa de revisão',missing_event_dose:'Contexto histórico de tratamento'};
const sensitiveQualityPattern=/(^|_)(dose|dosage|frequency|injection|application|aplicacao|medication|medicacao|treatment|tratamento)(_|$)/i;
function sourceLabel(value){return sourceLabels[value]||String(value||'Origem não informada').replaceAll('_',' ');}
function sourceFamilyLabel(value){return sourceFamilyLabels[value]||String(value||'Origem não informada').replaceAll('_',' ');}
function uploadStatus(value){return uploadStatusLabels[value]||String(value||'status não informado').replaceAll('_',' ');}
function sensitiveQuality(issue){return [issue?.category,issue?.issue_code,issue?.entity_name].some(value=>sensitiveQualityPattern.test(norm(value).replaceAll(' ','_')));}
function issueTitle(issue){return sensitiveQuality(issue)?'Contexto histórico de tratamento':issueCategoryLabels[issue?.category]||'Revisão de qualidade';}

function previewStatus(status){return({inspected:'processado',ready_for_parser:'arquivo reconhecido',needs_specialized_parser:'aguarda leitura',review_required:'revisão necessária',failed:'falha no processamento'})[status]||'status não detalhado';}
function previewFor(upload,previews){return previews.find(p=>String(p.upload_id)===String(upload.id))||null;}
function previewNotice(preview){
  if(preview?.status==='failed')return'O processamento não foi concluído. O arquivo original continua guardado.';
  if(preview?.status==='review_required'||preview?.status==='needs_specialized_parser')return'Há detalhes que precisam de revisão antes de concluir a leitura.';
  if(Array.isArray(preview?.warnings)&&preview.warnings.length)return'Há observações do processamento para revisão.';
  return'';
}
function previewDetail(preview){
  if(!preview)return'<span class="processingMuted">Processamento sem detalhe disponível.</span>';
  const facts=[preview.detected_format?`Formato: ${preview.detected_format}`:null,preview.row_count!=null?`${preview.row_count} registro(s)`:null,preview.date_min||preview.date_max?`${fmtDate(preview.date_min)} → ${fmtDate(preview.date_max)}`:null].filter(Boolean),notice=previewNotice(preview);
  return `<div class="processingDetail"><div>${pill(previewStatus(preview.status),preview.status==='failed'?'warn':preview.status==='review_required'||preview.status==='needs_specialized_parser'?'warn':'ok')} ${facts.length?`<span>${esc(facts.join(' · '))}</span>`:''}</div>${notice?`<small>${esc(notice)}</small>`:''}</div>`;
}
function uploadRows(uploads,previews){return uploads.slice(0,40).map(u=>`<div class="uploadAuditRow"><time>${fmtDate(u.created_at)}</time><div><b>${esc(u.original_filename||'Arquivo')}</b><small>${esc(sourceLabel(u.source_type))} · ${esc(uploadStatus(u.status))}</small>${previewDetail(previewFor(u,previews))}</div></div>`).join('')||empty('Nenhum arquivo corresponde aos filtros.');}

function filteredUploads(uploads){const status=state.ui.dataUploadStatus||'all',source=state.ui.dataUploadSource||'all';return uploads.filter(upload=>(status==='all'||uploadBucket(upload)===status)&&(source==='all'||String(upload.source_type||'other')===source));}
function uploadFilters(uploads){const sources=[...new Set(uploads.map(u=>String(u.source_type||'other')).filter(Boolean))].sort((a,b)=>sourceLabel(a).localeCompare(sourceLabel(b),'pt-BR'));return `<div class="controls"><label>Status<select id="dataUploadStatus"><option value="all">Todos</option><option value="attention">Precisa de atenção</option><option value="in_progress">Em andamento</option><option value="done">Concluídos</option></select></label><label>Origem<select id="dataUploadSource"><option value="all">Todas</option>${sources.map(source=>`<option value="${esc(source)}">${esc(sourceLabel(source))}</option>`).join('')}</select></label></div>`;}

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
  if(failed('uploads'))return'<div class="note warn"><b>Não foi possível verificar os arquivos agora.</b><span>Atualize para acompanhar os envios. As outras áreas continuam disponíveis.</span></div>';
  const c=processingCounts(uploads);
  if(c.review||(!failed('quality')&&actionIssues.length))return'<div class="note warn"><b>Há ação necessária.</b><span>Confira os itens abaixo. Nenhum campo ambíguo é preenchido automaticamente.</span></div>';
  if(c.failed)return'<div class="note warn"><b>Há arquivo com processamento incompleto.</b><span>O original continua guardado. Você pode tentar novamente depois sem perder o envio.</span></div>';
  if(c.waiting)return'<div class="note"><b>Há arquivo em processamento.</b><span>Atualize em alguns instantes para acompanhar o resultado.</span></div>';
  if(!uploads.length)return'<div class="note"><b>Comece por uma fonte.</b><span>Escolha a origem do arquivo. O original é guardado antes do processamento.</span></div>';
  return'<div class="note"><b>Sem ação interna pendente.</b><span>Limitações que dependem de arquivos ou evidência externa aparecem separadas abaixo.</span></div>';
}

function provenanceOverview(rows){
  if(failed('sourceMetrics'))return'<div class="errorState"><b>Proveniência indisponível agora.</b><span>As métricas consolidadas continuam disponíveis. Atualize para tentar carregar as origens novamente.</span></div>';
  const groups=new Map();
  for(const row of rows||[]){const family=String(row.source_family||'unknown');if(!groups.has(family))groups.set(family,{total:0,canonical:0,candidate:0,held:0});const g=groups.get(family);g.total++;const status=String(row.canonical_status||'candidate').toLowerCase();if(status==='canonical')g.canonical++;else if(status==='candidate')g.candidate++;else g.held++;}
  const cards=[...groups.entries()].sort((a,b)=>b[1].total-a[1].total||sourceFamilyLabel(a[0]).localeCompare(sourceFamilyLabel(b[0]),'pt-BR')).map(([family,g])=>`<div class="sourceCard provenanceCard"><div><b>${esc(sourceFamilyLabel(family))}</b><small>${g.canonical} canônico(s) · ${g.candidate} candidato(s)${g.held?` · ${g.held} preservado(s)`:''}</small></div><span>${g.total}</span></div>`).join('');
  return `<div class="sourceGrid provenanceGrid">${cards||'<div class="sourceCard"><div><b>Sem métricas por origem</b><small>Nenhum registro de proveniência foi carregado.</small></div><span>0</span></div>'}</div><p class="footerNote">Candidatos permanecem separados das métricas canônicas. Estas contagens servem para rastreabilidade e não são somadas à Timeline.</p>`;
}

function qualityRow(issue,mode){
  const known=!!issueCategoryLabels[issue?.category],detail=sensitiveQuality(issue)?'Registro histórico preservado sem detalhe operacional nesta tela.':!known?'Revisão registrada sem detalhe exibido nesta tela.':mode==='accepted'?(issue.resolution_notes||issue.description||'Limitação conhecida.'):(issue.description||'Revisão necessária.');
  return `<div class="row"><div style="grid-column:1/3"><b>${esc(issueTitle(issue))}</b><small>${esc(detail)}</small></div></div>`;
}
function qualityOverview(all){
  const actions=all.filter(q=>String(q.status).toLowerCase()==='open');
  const accepted=all.filter(q=>String(q.status).toLowerCase()==='accepted');
  const resolved=all.filter(q=>String(q.status).toLowerCase()==='resolved');
  return {actions,accepted,resolved,html:`<div class="sourceGrid"><div class="sourceCard"><div><b>Ação necessária</b><small>algo que o app pode resolver agora</small></div><span>${actions.length}</span></div><div class="sourceCard"><div><b>Limitações conhecidas</b><small>dependem de evidência externa ou foram preservadas de propósito</small></div><span>${accepted.length}</span></div><div class="sourceCard"><div><b>Resolvidos</b><small>ações concluídas e auditáveis</small></div><span>${resolved.length}</span></div></div>`};
}

export function renderDataHub(){
  const uploads=[...(state.data.uploads||[])].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))),visibleUploads=filteredUploads(uploads),previews=state.data.previews||[],quality=state.data.quality||[],sourceMetrics=state.data.sourceMetrics||[],q=qualityOverview(quality),sources=sourceState();
  const areas=[area('Bio','body'),area('Treinos','workouts'),area('Alimentação','nutrition'),area('Refeições','meals'),area('Exames','labs'),area('Documentos','docs'),area('Atividade','activity'),area('Métricas','metrics'),area('Métricas por origem','sourceMetrics')];
  return `${title('Dados','Importe, acompanhe e faça backup das suas fontes.')}
    <div class="sourceStatusGrid">${sources.map(statusCard).join('')}</div>
    <section class="card sectionGap"><div class="cardHead"><div><b>Acompanhamento dos arquivos</b><small>Veja rapidamente o que terminou e o que ainda precisa de atenção.</small></div></div>${processingOverview(uploads)}${nextStep(uploads,q.actions)}</section>
    <section class="backupPanel sectionGap"><div><span>Backup</span><b>Exportar registros organizados</b><p>Gera um JSON com os dados estruturados disponíveis. Arquivos privados e credenciais ficam de fora.</p><small>O arquivo contém dados de saúde; guarde-o com segurança.</small></div><div class="backupActions"><button id="backupExportBtn" type="button" class="primary">Exportar backup</button><span id="backupExportMsg" role="status"></span></div></section>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Enviar arquivo</b><small>Escolha a origem e envie.</small></div></div><form id="uploadForm" class="uploadForm"><label>Origem<select id="uploadType"><option value="apple_health">Apple Saúde</option><option value="polar_flow">Polar Flow</option><option value="myfitnesspal">MyFitnessPal</option><option value="fleury">Fleury</option><option value="einstein">Einstein</option><option value="other">Outro</option></select></label><label>Arquivo<input id="uploadFile" type="file" accept=".zip,.csv,.xml,.json,.pdf,image/*"></label><button class="primary" type="submit">Enviar</button><div id="uploadMsg" class="msg" role="status"></div></form></div>
      <div class="card"><div class="cardHead"><div><b>Dados disponíveis</b><small>“—” significa que a área não carregou agora.</small></div></div><div class="sourceGrid">${areas.map(([label,count,sub])=>`<div class="sourceCard"><div><b>${esc(label)}</b><small>${esc(sub)}</small></div><span>${esc(count)}</span></div>`).join('')}</div></div>
    </div>
    <section class="card sectionGap provenancePanel"><div class="cardHead"><div><b>Proveniência das métricas</b><small>Origem e status dos registros preservados separadamente da visão consolidada.</small></div>${failed('sourceMetrics')?pill('indisponível','warn'):pill(`${sourceMetrics.length} registros`)}</div>${provenanceOverview(sourceMetrics)}</section>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Arquivos recebidos</b><small>Filtre por situação ou origem.</small></div>${failed('uploads')?pill('indisponível','warn'):pill(`${visibleUploads.length} de ${uploads.length}`)}</div>${failed('uploads')?'<div class="errorState"><b>Arquivos indisponíveis agora.</b><span>Tente atualizar.</span></div>':`${uploadFilters(uploads)}${failed('previews')?`<div class="note warn">Os arquivos carregaram, mas o processamento está indisponível agora.</div><div class="uploadAudit">${uploadRows(visibleUploads,[])}</div>`:`<div class="uploadAudit">${uploadRows(visibleUploads,previews)}</div>`}`}</div>
      <div class="card"><div class="cardHead"><div><b>Qualidade dos dados</b><small>Ação interna e limitações externas ficam separadas.</small></div>${failed('quality')?pill('indisponível','warn'):pill(`${quality.length} registros`)}</div>${failed('quality')?'<div class="errorState"><b>Qualidade indisponível agora.</b><span>Tente atualizar.</span></div>':`${q.html}<div class="sectionGap"><b>Ação necessária</b><div class="list">${q.actions.slice(0,40).map(i=>qualityRow(i,'open')).join('')||empty('Nenhuma ação interna pendente.')}</div></div><details class="sourceMore sectionGap"><summary>Limitações conhecidas (${q.accepted.length})</summary><div class="list">${q.accepted.slice(0,40).map(i=>qualityRow(i,'accepted')).join('')||empty('Nenhuma limitação conhecida.')}</div></details><details class="sourceMore sectionGap"><summary>Resolvidos (${q.resolved.length})</summary><div class="list">${q.resolved.slice(0,40).map(i=>qualityRow(i,'resolved')).join('')||empty('Nenhum item resolvido registrado.')}</div></details>`}</div>
    </div>`;
}
