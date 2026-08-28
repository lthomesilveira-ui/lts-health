import {state,esc,fmtDate,norm,unique} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const empty=text=>`<div class="empty">${esc(text)}</div>`;
const failed=()=>state.domainStatus.treatments==='error';

function rows(){
  const q=norm(state.ui.treatmentQuery||'');
  return [...(state.data.treatments||[])].filter(r=>!q||norm(`${r.medication} ${r.event_type} ${r.source}`).includes(q)).sort((a,b)=>String(b.event_date).localeCompare(String(a.event_date)));
}

function monthKey(date){return String(date||'').slice(0,7);}
function monthLabel(key){if(!key)return' sem data';const[y,m]=key.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});}

export function renderTreatmentHub(){
  if(failed())return `${title('Tratamentos','Histórico de tratamentos registrados ao longo do tempo.')}<div class="errorState"><b>O histórico de tratamentos não carregou agora.</b><span>Os demais dados continuam disponíveis. Tente atualizar para carregar esta área novamente.</span></div>`;
  const all=state.data.treatments||[],filtered=rows(),names=unique(all.map(r=>r.medication)).filter(Boolean),sources=unique(all.map(r=>r.source)).filter(Boolean);
  const groups=new Map();for(const r of filtered){const k=monthKey(r.event_date);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
  return `${title('Tratamentos','Contexto histórico por data e origem. Esta área não substitui orientação médica.')}
    <div class="grid cols3">
      <div class="card metric"><span>Registros</span><strong>${all.length}</strong><em>eventos preservados no histórico</em></div>
      <div class="card metric"><span>Tratamentos</span><strong>${names.length}</strong><em>nomes distintos registrados</em></div>
      <div class="card metric"><span>Origens</span><strong>${sources.length}</strong><em>fontes distintas do histórico</em></div>
    </div>
    <div class="card sectionGap"><div class="cardHead"><div><b>Histórico</b><small>Busque por nome ou origem. A tela mostra somente informações temporais e de registro.</small></div></div><input id="treatmentQuery" class="fullInput" type="search" placeholder="Buscar tratamento ou origem" value="${esc(state.ui.treatmentQuery||'')}"><div class="timelineGroups">${[...groups.entries()].map(([month,items])=>`<section class="timelineDay"><div class="timelineDate"><b>${esc(monthLabel(month))}</b><span>${items.length} registro(s)</span></div><div class="card timelineDayCard">${items.map(r=>`<div class="timelineItem rich"><span>${fmtDate(r.event_date)}</span><div><b>${esc(r.medication||'Tratamento registrado')}</b><small>${esc(r.event_type||'evento registrado')}</small>${r.source?`<em>${esc(r.source)}</em>`:''}</div></div>`).join('')}</div></section>`).join('')||empty('Nenhum registro corresponde à busca.')}</div></div>
    <p class="footerNote">O LTS Health usa esse histórico apenas como contexto temporal para organizar informações de saúde. Decisões sobre tratamento devem ser feitas com o profissional responsável.</p>`;
}
