import {state,esc,fmtDate,norm,unique} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const empty=text=>`<div class="empty">${esc(text)}</div>`;
const failed=()=>state.domainStatus.treatments==='error';

function rows(){
  const q=norm(state.ui.treatmentQuery||'');
  return [...(state.data.treatments||[])].filter(r=>!q||norm(`${r.medication} ${r.source}`).includes(q)).sort((a,b)=>String(b.event_date).localeCompare(String(a.event_date)));
}
function monthKey(date){return String(date||'').slice(0,7);}
function monthLabel(key){if(!key)return' sem data';const[y,m]=key.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});}

export function renderTreatmentHub(){
  if(failed())return `${title('Protocolos','Histórico de protocolos, tratamentos e suplementação registrados ao longo do tempo.')}<div class="errorState"><b>O histórico de protocolos não carregou agora.</b><span>Os demais dados continuam disponíveis. Tente atualizar para carregar esta área novamente.</span></div>`;
  const all=state.data.treatments||[],filtered=rows(),names=unique(all.map(r=>r.medication)).filter(Boolean),sources=unique(all.map(r=>r.source)).filter(Boolean);
  const groups=new Map();for(const r of filtered){const k=monthKey(r.event_date);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
  return `${title('Protocolos','Contexto temporal dos registros existentes. O LTS Health organiza o histórico sem recomendar início, interrupção ou alteração de uso.')}
    <div class="grid cols3">
      <div class="card metric"><span>Registros</span><strong>${all.length}</strong><em>eventos preservados no histórico</em></div>
      <div class="card metric"><span>Itens</span><strong>${names.length}</strong><em>nomes distintos registrados</em></div>
      <div class="card metric"><span>Origens</span><strong>${sources.length}</strong><em>fontes distintas do histórico</em></div>
    </div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Linha do tempo</b><small>Busque por nome ou origem. A tela mostra somente o que já está registrado.</small></div></div><input id="treatmentQuery" class="fullInput" type="search" placeholder="Buscar protocolo ou origem" value="${esc(state.ui.treatmentQuery||'')}"><div class="timelineGroups">${[...groups.entries()].map(([month,items])=>`<section class="timelineDay"><div class="timelineDate"><b>${esc(monthLabel(month))}</b><span>${items.length} registro(s)</span></div><div class="card timelineDayCard">${items.map(r=>`<div class="timelineItem rich"><span>${fmtDate(r.event_date)}</span><div><b>${esc(r.medication||'Registro de protocolo')}</b>${r.source?`<em>${esc(r.source)}</em>`:''}</div></div>`).join('')}</div></section>`).join('')||empty('Nenhum registro corresponde à busca.')}</div></div>
    <p class="footerNote">Protocolos são usados apenas como contexto temporal para organizar o histórico. O aplicativo não recomenda doses, mudanças ou decisões de tratamento.</p>`;
}
