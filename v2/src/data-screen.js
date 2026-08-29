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
    {key:'apple_health',name:'Apple Saúde',status:sourceStatus(apple,['uploads','metrics']),capability:'Leitura automática parcial',readyDetail:'Há dados ou arquivo relacionado ao Apple Saúde.',missingDetail:'Exporte o arquivo ZIP pelo app Saúde do iPhone e envie aqui.',action:'Enviar export do Apple Saúde',scope:'A leitura automática validada inclui energia ativa, minutos de exercício, horas em pé e duração do sono. Passos e frequência cardíaca de repouso entram somente em dias com uma única fonte no export; dias ambíguos ficam retidos para evitar dupla contagem.'},
    {key:'polar_flow',name:'Polar Flow',status:sourceStatus(polar,['uploads','workouts']),capability:'Arquivo + revisão',readyDetail:'Há evidência de Polar nos treinos ou arquivos.',missingDetail:'Quando houver export do Polar, envie para preservar detalhes de sessão sem duplicar o Apple Saúde.',action:'Enviar arquivo do Polar',scope:'O arquivo é preservado; detalhes adicionais só entram depois de leitura validada e comparação com fontes sobrepostas.'},
    {key:'myfitnesspal',name:'MyFitnessPal',status:sourceStatus(mfp,['nutrition','meals','uploads']),capability:'Leitura automática de nutrição',readyDetail:'Histórico de alimentação disponível.',missingDetail:'Envie o export do MyFitnessPal para carregar dias e refeições.',action:'Enviar export do MyFitnessPal',scope:'CSV de nutrição reconhecido pode consolidar calorias e macros por dia sem preencher campos ausentes.'},
    {key:'fleury',name:'Fleury',status:sourceStatus(fleury,['labs','uploads']),capability:'CSV estruturado + documento preservado',readyDetail:'Há resultados ou documentos identificados como Fleury.',missingDetail:'Envie um CSV estruturado ou o PDF/imagem do exame para organizar essa fonte.',action:'Enviar exame do Fleury',scope:'CSV com biomarcador, resultado e data reconhecidos pode ser estruturado automaticamente. Resultados textuais permanecem textuais. Documento preservado: PDF e imagem aguardam leitura especializada validada.'},
    {key:'einstein',name:'Einstein',status:sourceStatus(einstein,['labs','uploads']),capability:'CSV estruturado + documento preservado',readyDetail:'Há resultados ou documentos identificados como Einstein.',missingDetail:'Envie um CSV estruturado ou o PDF/imagem do exame para organizar essa fonte.',action:'Enviar exame do Einstein',scope:'CSV com biomarcador, resultado e data reconhecidos pode ser estruturado automaticamente. Resultados textuais permanecem textuais. Documento preservado: PDF e imagem aguardam leitura especializada validada.'}
  ];
}

function statusCard(source){
  const ready=source.status==='ready',unknown=source.status==='unknown';
  const label=ready?'com dados':unknown?'não verificado':'a importar';
  const detail=ready?source.readyDetail:unknown?'Não foi possível verificar esta fonte agora. Atualize para tentar carregar os dados relacionados.':source.missingDetail;
  return `<article class="sourceStatus ${ready?'ready':''}"><div class="sourceStatusTop"><b>${esc(source.name)}</b>${pill(label,ready?'ok':unknown?'warn':'')}</div><span class="sourceCapability">${esc(source.capability)}</span><p>${esc(detail)}</p><small class="sourceScope">${esc(source.scope)}</small><button type="button" data-source-upload="${esc(source.key)}">${esc(source.action)}</button></article>`;
}
function area(label,key){return [label,failed(key)?'—':String((state.data[key]||[]).length),failed(key)?'indisponível agora':'registros carregados'];}

function previewStatus(status){
  return ({inspected:'processado',ready_for_parser:'arquivo reconhecido',needs_specialized_parser:'aguarda leitura especializada',review_required:'revisão necessária',failed:'falha no processamento'})[status]||status||'sem detalhe';
}
function previewFor(upload,previews){return previews.find(p=>String(p.upload_id)===String(upload.id))||null;}
function previewDetail(preview){
  if(!preview)return '<span class="processingMuted">Detalhes do processamento ainda não disponíveis.</span>';
  const facts=[preview.detected_format?`Formato: ${preview.detected_format}`:null,preview.row_count!=null?`${preview.row_count} registro(s) detectado(s)`:null,preview.date_min||preview.date_max?`Período: ${fmtDate(preview.date_min)} → ${fmtDate(preview.date_max)}`:null].filter(Boolean);
  const warnings=Array.isArray(preview.warnings)?preview.warnings.slice(0,2):[];
  return `<div class="processingDetail"><div>${pill(previewStatus(preview.status),preview.status==='failed'?'warn':preview.status==='review_required'||preview.status==='needs_specialized_parser'?'warn':'ok')} ${facts.length?`<span>${esc(facts.join(' · '))}</span>`:''}</div>${warnings.length?`<ul>${warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`:''}${preview.error_message?`<small>${esc(preview.error_message)}</small>`:''}</div>`;
}
function uploadRows(uploads,previews){
  return uploads.slice(0,40).map(u=>`<div class="uploadAuditRow"><time>${fmtDate(u.created_at)}</time><div><b>${esc(u.original_filename||'Arquivo')}</b><small>${esc(u.source_type||'origem não informada')} · ${esc(u.status||'status não informado')}</small>${previewDetail(previewFor(u,previews))}</div></div>`).join('')||empty('Nenhum arquivo enviado ainda.');
}

export function renderDataHub(){
  const uploads=[...(state.data.uploads||[])].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))),previews=state.data.previews||[],issues=(state.data.quality||[]).filter(q=>String(q.status).toLowerCase()==='open'),sources=sourceState();
  const areas=[area('Bio','body'),area('Treinos','workouts'),area('Alimentação','nutrition'),area('Refeições','meals'),area('Exames','labs'),area('Documentos','docs'),area('Atividade','activity'),area('Métricas','metrics')];
  return `${title('Dados','Traga suas fontes para o mesmo histórico. O app mantém as origens separadas para evitar contagem duplicada.')}
    <div class="sourceStatusGrid">${sources.map(statusCard).join('')}</div>
    <div class="note sectionGap">Cada arquivo permanece ligado à origem. Quando a leitura automática não é segura, o app preserva o original e sinaliza revisão em vez de completar dados por estimativa.</div>
    <section class="backupPanel sectionGap"><div><span>Backup estruturado</span><b>Leve uma cópia dos registros normalizados com você.</b><p>O JSON reúne as áreas estruturadas acessíveis à sua sessão e preserva origem e campos ausentes. Arquivos originais privados, credenciais e segredos não entram no pacote.</p><small>O arquivo contém dados pessoais de saúde. Guarde-o em local seguro.</small></div><div class="backupActions"><button id="backupExportBtn" type="button" class="primary">Exportar backup</button><span id="backupExportMsg" role="status"></span></div></section>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Enviar arquivo</b><small>Escolha a origem antes de enviar. O arquivo original fica na área privada de importação.</small></div></div><form id="uploadForm" class="uploadForm"><label>Origem<select id="uploadType"><option value="apple_health">Apple Saúde</option><option value="polar_flow">Polar Flow</option><option value="myfitnesspal">MyFitnessPal</option><option value="fleury">Fleury</option><option value="einstein">Einstein</option><option value="other">Outro</option></select></label><label>Arquivo<input id="uploadFile" type="file" accept=".zip,.csv,.xml,.json,.pdf,image/*"></label><button class="primary" type="submit">Enviar</button><div id="uploadMsg" class="msg" role="status"></div></form></div>
      <div class="card"><div class="cardHead"><div><b>Dados disponíveis</b><small>Quantidade atualmente carregada em cada área. “—” indica que aquela área não pôde ser consultada agora.</small></div></div><div class="sourceGrid">${areas.map(([label,count,sub])=>`<div class="sourceCard"><div><b>${esc(label)}</b><small>${esc(sub)}</small></div><span>${esc(count)}</span></div>`).join('')}</div></div>
    </div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Arquivos recebidos</b><small>Origem, estado e resultado da leitura de cada envio.</small></div>${failed('uploads')?pill('indisponível','warn'):pill(`${uploads.length}`)}</div>${failed('uploads')?'<div class="errorState"><b>Os arquivos recebidos não carregaram agora.</b><span>Tente atualizar. Nenhum arquivo foi removido por esta falha de consulta.</span></div>':failed('previews')?`<div class="note warn">Os arquivos carregaram, mas os detalhes do processamento estão indisponíveis agora.</div><div class="uploadAudit">${uploadRows(uploads,[])}</div>`:`<div class="uploadAudit">${uploadRows(uploads,previews)}</div>`}</div>
      <div class="card"><div class="cardHead"><div><b>Pendências</b><small>Itens que ainda precisam de revisão ou de uma fonte melhor.</small></div>${failed('quality')?pill('indisponível','warn'):pill(`${issues.length}`)}</div>${failed('quality')?'<div class="errorState"><b>As pendências não carregaram agora.</b><span>Tente atualizar para consultar essa lista novamente.</span></div>':`<div class="list">${issues.slice(0,40).map(i=>`<div class="row"><div style="grid-column:1/3"><b>${esc(i.entity_name||i.category||'Pendência')}</b><small>${esc(i.description||'Revisão necessária.')}</small></div></div>`).join('')||empty('Nenhuma pendência aberta.')}</div>`}</div>
    </div>`;
}
