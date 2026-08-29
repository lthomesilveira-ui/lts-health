import {state,esc,fmtDate,norm} from './core.js';

const empty=text=>`<div class="empty">${esc(text)}</div>`;
const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const pill=(text,kind='')=>`<span class="pill ${kind}">${esc(text)}</span>`;
const failed=key=>state.domainStatus[key]==='error';

function contains(rows,fields,term){
  term=norm(term);
  return (rows||[]).some(row=>fields.some(field=>norm(row?.[field]).includes(term)));
}
function sourceStatus(found,keys=[]){return found?'ready':keys.some(failed)?'unknown':'missing';}

function sourceState(){
  const uploads=state.data.uploads||[],workouts=state.data.workouts||[],labs=state.data.labs||[],nutrition=state.data.nutrition||[],meals=state.data.meals||[],metrics=state.data.metrics||[];
  const hasUpload=t=>uploads.some(u=>norm(u.source_type)===norm(t));
  const mfp=!!(nutrition.length||meals.length||hasUpload('myfitnesspal'));
  const apple=hasUpload('apple_health')||contains(metrics,['source','source_file'],'apple');
  const polar=hasUpload('polar_flow')||contains(workouts,['source','source_file'],'polar');
  const fleury=hasUpload('fleury')||contains(labs,['laboratory','source','source_file'],'fleury');
  const einstein=hasUpload('einstein')||contains(labs,['laboratory','source','source_file'],'einstein');
  return [
    {key:'apple_health',name:'Apple Saúde',status:sourceStatus(apple,['uploads','metrics']),capability:'Leitura automática parcial',readyDetail:'Dados do Apple Saúde encontrados.',missingDetail:'Envie o export do app Saúde.',action:'Enviar Apple Saúde',scope:'A leitura automática validada inclui energia ativa, minutos de exercício, horas em pé e duração do sono. Passos e FC de repouso não são importados automaticamente por este fluxo; só aparecem quando já existem como registros válidos de outra origem.'},
    {key:'polar_flow',name:'Polar Flow',status:sourceStatus(polar,['uploads','workouts']),capability:'Arquivo + revisão',readyDetail:'Há dados ou arquivo do Polar.',missingDetail:'Envie um export do Polar Flow.',action:'Enviar Polar',scope:'O arquivo é preservado e pode complementar detalhes de treino. O mesmo treino não é contado duas vezes quando outra fonte já o representa.'},
    {key:'myfitnesspal',name:'MyFitnessPal',status:sourceStatus(mfp,['nutrition','meals','uploads']),capability:'Leitura automática de nutrição',readyDetail:'Histórico de alimentação encontrado.',missingDetail:'Envie o export do MyFitnessPal.',action:'Enviar MyFitnessPal',scope:'CSV reconhecido consolida calorias e macros por dia. Campo ausente continua ausente.'},
    {key:'fleury',name:'Fleury',status:sourceStatus(fleury,['labs','uploads']),capability:'Arquivo preservado + revisão',readyDetail:'Há exames ou arquivo do Fleury.',missingDetail:'Envie CSV, PDF ou imagem do exame.',action:'Enviar Fleury',scope:'CSV, PDF ou imagem são preservados. Resultados só são estruturados quando a leitura for validada; valor, unidade ou faixa ambíguos ficam para revisão.'},
    {key:'einstein',name:'Einstein',status:sourceStatus(einstein,['labs','uploads']),capability:'Arquivo preservado + revisão',readyDetail:'Há exames ou arquivo do Einstein.',missingDetail:'Envie CSV, PDF ou imagem do exame.',action:'Enviar Einstein',scope:'CSV, PDF ou imagem são preservados. Resultados só são estruturados quando a leitura for validada; valor, unidade ou faixa ambíguos ficam para revisão.'}
  ];
}

function statusCard(source){
  const ready=source.status==='ready',unknown=source.status==='unknown';
  const label=ready?'com dados':unknown?'não verificado':'a importar';
  const detail=ready?source.readyDetail:unknown?'Não foi possível verificar esta fonte agora.':source.missingDetail;
  return `<article class="sourceStatus ${ready?'ready':''}"><div class="sourceStatusTop"><b>${esc(source.name)}</b>${pill(label,ready?'ok':unknown?'warn':'')}</div><span class="sourceCapability">${esc(source.capability)}</span><p>${esc(detail)}</p><button type="button" data-source-upload="${esc(source.key)}">${esc(source.action)}</button><details class="sourceMore"><summary>Como funciona</summary><small class="sourceScope">${esc(source.scope)}</small></details></article>`;
}
function area(label,key){return [label,failed(key)?'—':String((state.data[key]||[]).length),failed(key)?'indisponível agora':'registros'];}

const sourceLabels={apple_health:'Apple Saúde',polar_flow:'Polar Flow',myfitnesspal:'MyFitnessPal',fleury:'Fleury',einstein:'Einstein',lab:'Exame laboratorial',other:'Outra origem'};
const uploadStatusLabels={uploaded:'recebido',processing:'processando',processed:'processado',review_required:'revisão necessária',failed:'falha no processamento'};
const issueCategoryLabels={
  limited_longitudinal_coverage:'Histórico ainda limitado',
  metadata_only:'Arquivo original ainda não disponível',
  migration_integrity:'Conferência de histórico',
  missing_data:'Informação ainda ausente',
  parsing:'Leitura do arquivo precisa de revisão',
  source_date_conflict_risk:'Data da fonte precisa de conferência',
  workout_normalization:'Nome do treino precisa de conferência',
  workout_parsing:'Detalhe do treino precisa de revisão'
};
function sourceLabel(value){return sourceLabels[value]||String(value||'Origem não informada').replaceAll('_',' ');}
function uploadStatus(value){return uploadStatusLabels[value]||String(value||'status não informado').replaceAll('_',' ');}
function issueTitle(issue){return issueCategoryLabels[issue?.category]||issue?.entity_name||'Pendência de revisão';}

function previewStatus(status){
  return ({inspected:'processado',ready_for_parser:'arquivo reconhecido',needs_specialized_parser:'aguarda leitura',review_required:'revisão necessária',failed:'falha no processamento'})[status]||String(status||'sem detalhe').replaceAll('_',' ');
}
function previewFor(upload,previews){return previews.find(p=>String(p.upload_id)===String(upload.id))||null;}
function previewDetail(preview){
  if(!preview)return '<span class="processingMuted">Processamento sem detalhe disponível.</span>';
  const facts=[preview.detected_format?`Formato: ${preview.detected_format}`:null,preview.row_count!=null?`${preview.row_count} registro(s)`:null,preview.date_min||preview.date_max?`${fmtDate(preview.date_min)} → ${fmtDate(preview.date_max)}`:null].filter(Boolean);
  const warnings=Array.isArray(preview.warnings)?preview.warnings.slice(0,2):[];
  return `<div class="processingDetail"><div>${pill(previewStatus(preview.status),preview.status==='failed'?'warn':preview.status==='review_required'||preview.status==='needs_specialized_parser'?'warn':'ok')} ${facts.length?`<span>${esc(facts.join(' · '))}</span>`:''}</div>${warnings.length?`<ul>${warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`:''}${preview.error_message?`<small>${esc(preview.error_message)}</small>`:''}</div>`;
}
function uploadRows(uploads,previews){
  return uploads.slice(0,40).map(u=>`<div class="uploadAuditRow"><time>${fmtDate(u.created_at)}</time><div><b>${esc(u.original_filename||'Arquivo')}</b><small>${esc(sourceLabel(u.source_type))} · ${esc(uploadStatus(u.status))}</small>${previewDetail(previewFor(u,previews))}</div></div>`).join('')||empty('Nenhum arquivo enviado.');
}

export function renderDataHub(){
  const uploads=[...(state.data.uploads||[])].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))),previews=state.data.previews||[],issues=(state.data.quality||[]).filter(q=>String(q.status).toLowerCase()==='open'),sources=sourceState();
  const areas=[area('Bio','body'),area('Treinos','workouts'),area('Alimentação','nutrition'),area('Refeições','meals'),area('Exames','labs'),area('Documentos','docs'),area('Atividade','activity'),area('Métricas','metrics')];
  return `${title('Dados','Importe, acompanhe e faça backup das suas fontes.')}
    <div class="sourceStatusGrid">${sources.map(statusCard).join('')}</div>
    <section class="backupPanel sectionGap"><div><span>Backup</span><b>Exportar registros organizados</b><p>Gera um JSON com os dados estruturados disponíveis. Arquivos privados e credenciais ficam de fora.</p><small>O arquivo contém dados de saúde; guarde-o com segurança.</small></div><div class="backupActions"><button id="backupExportBtn" type="button" class="primary">Exportar backup</button><span id="backupExportMsg" role="status"></span></div></section>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Enviar arquivo</b><small>Escolha a origem e envie.</small></div></div><form id="uploadForm" class="uploadForm"><label>Origem<select id="uploadType"><option value="apple_health">Apple Saúde</option><option value="polar_flow">Polar Flow</option><option value="myfitnesspal">MyFitnessPal</option><option value="fleury">Fleury</option><option value="einstein">Einstein</option><option value="other">Outro</option></select></label><label>Arquivo<input id="uploadFile" type="file" accept=".zip,.csv,.xml,.json,.pdf,image/*"></label><button class="primary" type="submit">Enviar</button><div id="uploadMsg" class="msg" role="status"></div></form></div>
      <div class="card"><div class="cardHead"><div><b>Dados disponíveis</b><small>“—” significa que a área não carregou agora.</small></div></div><div class="sourceGrid">${areas.map(([label,count,sub])=>`<div class="sourceCard"><div><b>${esc(label)}</b><small>${esc(sub)}</small></div><span>${esc(count)}</span></div>`).join('')}</div></div>
    </div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Arquivos recebidos</b><small>Status de cada envio.</small></div>${failed('uploads')?pill('indisponível','warn'):pill(`${uploads.length}`)}</div>${failed('uploads')?'<div class="errorState"><b>Arquivos indisponíveis agora.</b><span>Tente atualizar.</span></div>':failed('previews')?`<div class="note warn">Os arquivos carregaram, mas o processamento está indisponível agora.</div><div class="uploadAudit">${uploadRows(uploads,[])}</div>`:`<div class="uploadAudit">${uploadRows(uploads,previews)}</div>`}</div>
      <div class="card"><div class="cardHead"><div><b>Pendências</b><small>Itens que precisam de revisão.</small></div>${failed('quality')?pill('indisponível','warn'):pill(`${issues.length}`)}</div>${failed('quality')?'<div class="errorState"><b>Pendências indisponíveis agora.</b><span>Tente atualizar.</span></div>':`<div class="list">${issues.slice(0,40).map(i=>`<div class="row"><div style="grid-column:1/3"><b>${esc(issueTitle(i))}</b><small>${esc(i.description||'Revisão necessária.')}</small></div></div>`).join('')||empty('Nenhuma pendência aberta.')}</div>`}</div>
    </div>`;
}
