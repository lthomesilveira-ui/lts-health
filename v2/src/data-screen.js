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
    {key:'apple_health',name:'Apple Saúde',status:sourceStatus(apple,['uploads','metrics']),readyDetail:'Há dados ou arquivo relacionado ao Apple Saúde.',missingDetail:'Exporte o arquivo ZIP pelo app Saúde do iPhone e envie aqui.',action:'Enviar export do Apple Saúde'},
    {key:'polar_flow',name:'Polar Flow',status:sourceStatus(polar,['uploads','workouts']),readyDetail:'Há evidência de Polar nos treinos ou arquivos.',missingDetail:'Quando houver export do Polar, envie para preservar detalhes de sessão sem duplicar o Apple Saúde.',action:'Enviar arquivo do Polar'},
    {key:'myfitnesspal',name:'MyFitnessPal',status:sourceStatus(mfp,['nutrition','meals','uploads']),readyDetail:'Histórico de alimentação disponível.',missingDetail:'Envie o export do MyFitnessPal para carregar dias e refeições.',action:'Enviar export do MyFitnessPal'},
    {key:'fleury',name:'Fleury',status:sourceStatus(fleury,['labs','uploads']),readyDetail:'Há resultados ou documentos identificados como Fleury.',missingDetail:'Envie os PDFs dos exames para organizar resultados por coleta.',action:'Enviar exame do Fleury'},
    {key:'einstein',name:'Einstein',status:sourceStatus(einstein,['labs','uploads']),readyDetail:'Há resultados ou documentos identificados como Einstein.',missingDetail:'Envie os PDFs dos exames para adicionar essa fonte ao histórico.',action:'Enviar exame do Einstein'}
  ];
}

function statusCard(source){
  const ready=source.status==='ready',unknown=source.status==='unknown';
  const label=ready?'com dados':unknown?'não verificado':'a importar';
  const detail=ready?source.readyDetail:unknown?'Não foi possível verificar esta fonte agora. Atualize para tentar carregar os dados relacionados.':source.missingDetail;
  return `<article class="sourceStatus ${ready?'ready':''}"><div class="sourceStatusTop"><b>${esc(source.name)}</b>${pill(label,ready?'ok':unknown?'warn':'')}</div><p>${esc(detail)}</p><button type="button" data-source-upload="${esc(source.key)}">${esc(source.action)}</button></article>`;
}
function area(label,key){return [label,failed(key)?'—':String((state.data[key]||[]).length),failed(key)?'indisponível agora':'registros carregados'];}

export function renderDataHub(){
  const uploads=[...(state.data.uploads||[])].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))),issues=(state.data.quality||[]).filter(q=>String(q.status).toLowerCase()==='open'),sources=sourceState();
  const areas=[area('Bio','body'),area('Treinos','workouts'),area('Alimentação','nutrition'),area('Refeições','meals'),area('Exames','labs'),area('Documentos','docs'),area('Atividade','activity'),area('Métricas','metrics')];
  return `${title('Dados','Traga suas fontes para o mesmo histórico. O app mantém as origens separadas para evitar contagem duplicada.')}
    <div class="sourceStatusGrid">${sources.map(statusCard).join('')}</div>
    <div class="note sectionGap">No Apple Saúde, o processamento automático atual organiza energia ativa, minutos de exercício, horas em pé e duração do sono quando os registros podem ser consolidados sem ambiguidade. O arquivo original continua preservado para ampliar a cobertura depois.</div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Enviar arquivo</b><small>Escolha a origem antes de enviar. O arquivo original fica na área privada de importação.</small></div></div><form id="uploadForm" class="uploadForm"><label>Origem<select id="uploadType"><option value="apple_health">Apple Saúde</option><option value="polar_flow">Polar Flow</option><option value="myfitnesspal">MyFitnessPal</option><option value="fleury">Fleury</option><option value="einstein">Einstein</option><option value="other">Outro</option></select></label><label>Arquivo<input id="uploadFile" type="file" accept=".zip,.csv,.xml,.json,.pdf,image/*"></label><button class="primary" type="submit">Enviar</button><div id="uploadMsg" class="msg" role="status"></div></form></div>
      <div class="card"><div class="cardHead"><div><b>Dados disponíveis</b><small>Quantidade atualmente carregada em cada área. “—” indica que aquela área não pôde ser consultada agora.</small></div></div><div class="sourceGrid">${areas.map(([label,count,sub])=>`<div class="sourceCard"><div><b>${esc(label)}</b><small>${esc(sub)}</small></div><span>${esc(count)}</span></div>`).join('')}</div></div>
    </div>
    <div class="grid cols2 sectionGap">
      <div class="card"><div class="cardHead"><div><b>Arquivos recebidos</b><small>Últimos envios para processamento.</small></div>${failed('uploads')?pill('indisponível','warn'):pill(`${uploads.length}`)}</div>${failed('uploads')?'<div class="errorState"><b>Os arquivos recebidos não carregaram agora.</b><span>Tente atualizar. Nenhum arquivo foi removido por esta falha de consulta.</span></div>':`<div class="list">${uploads.slice(0,40).map(u=>`<div class="row"><time>${fmtDate(u.created_at)}</time><div><b>${esc(u.original_filename||'Arquivo')}</b><small>${esc(u.source_type||'origem não informada')} · ${esc(u.status||'status não informado')}</small></div></div>`).join('')||empty('Nenhum arquivo enviado ainda.')}</div>`}</div>
      <div class="card"><div class="cardHead"><div><b>Pendências</b><small>Itens que ainda precisam de revisão ou de uma fonte melhor.</small></div>${failed('quality')?pill('indisponível','warn'):pill(`${issues.length}`)}</div>${failed('quality')?'<div class="errorState"><b>As pendências não carregaram agora.</b><span>Tente atualizar para consultar essa lista novamente.</span></div>':`<div class="list">${issues.slice(0,40).map(i=>`<div class="row"><div style="grid-column:1/3"><b>${esc(i.entity_name||i.category||'Pendência')}</b><small>${esc(i.description||'Revisão necessária.')}</small></div></div>`).join('')||empty('Nenhuma pendência aberta.')}</div>`}</div>
    </div>`;
}
