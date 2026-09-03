import {state,esc,fmtDate,norm,unique} from './core.js';

const title=(name,description='')=>`<div class="screenTitle"><div><h1>${esc(name)}</h1><p>${esc(description)}</p></div></div>`;
const empty=text=>`<div class="empty">${esc(text)}</div>`;
const failed=key=>state.domainStatus?.[key]==='error';

function query(){return norm(state.ui.treatmentQuery||'');}
function events(){
  const q=query();
  return [...(state.data.treatments||[])].filter(r=>!q||norm(`${r.medication} ${r.source} ${r.event_type}`).includes(q)).sort((a,b)=>String(b.event_date).localeCompare(String(a.event_date)));
}
function regimens(){
  const q=query();
  return [...(state.data.regimens||[])].filter(r=>!q||norm(`${r.medication} ${r.source} ${r.source_file}`).includes(q)).sort((a,b)=>String(a.medication||'').localeCompare(String(b.medication||''),'pt-BR'));
}
function monthKey(date){return String(date||'').slice(0,7);}
function monthLabel(key){if(!key)return' sem data';const[y,m]=key.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});}
function itemSummary(name,allEvents,regimen){
  const related=allEvents.filter(r=>r.medication===name).sort((a,b)=>String(a.event_date).localeCompare(String(b.event_date))),first=related[0]?.event_date||null,last=related.at(-1)?.event_date||null;
  const origins=unique([regimen?.source,regimen?.source_file,...related.map(r=>r.source)].filter(Boolean));
  return `<article class="protocolSummaryCard"><div class="protocolSummaryHead"><div><span>Contexto registrado</span><h3>${esc(name)}</h3></div></div><div class="protocolSummaryFacts"><div><b>${related.length}</b><span>evento(s) histórico(s)</span></div><div><b>${first?fmtDate(first):'—'}</b><span>primeiro evento</span></div><div><b>${last?fmtDate(last):'—'}</b><span>último evento</span></div></div><p>${origins.length?`Origem: ${esc(origins.join(' · '))}`:'Origem não detalhada.'}</p><em>Situação atual não inferida.</em></article>`;
}

export function renderTreatmentHub(){
  if(failed('treatments')||failed('regimens'))return `${title('Protocolos','Histórico de protocolos, tratamentos e suplementação registrados ao longo do tempo.')}<div class="errorState"><b>O histórico de protocolos não carregou completamente.</b><span>Os demais dados continuam disponíveis. Tente atualizar para carregar esta área novamente.</span></div>`;
  const allEvents=state.data.treatments||[],allRegimens=state.data.regimens||[],filteredEvents=events(),filteredRegimens=regimens(),names=unique([...allRegimens.map(r=>r.medication),...allEvents.map(r=>r.medication)]).filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),'pt-BR')),filteredNames=names.filter(name=>{const q=query();return !q||norm(name).includes(q)||filteredEvents.some(r=>r.medication===name)||filteredRegimens.some(r=>r.medication===name);}),dates=unique(allEvents.map(r=>r.event_date)).filter(Boolean).sort(),groups=new Map();
  for(const r of filteredEvents){const k=monthKey(r.event_date);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
  const regimenByName=new Map(allRegimens.map(r=>[r.medication,r]));
  return `${title('Protocolos','Contexto temporal dos registros existentes. Cadastros de contexto e eventos históricos ficam separados; o LTS Health não orienta uso nem infere situação atual.')}
    <div class="grid cols4">
      <div class="card metric"><span>Cadastros de contexto</span><strong>${allRegimens.length}</strong><em>registros estruturados</em></div>
      <div class="card metric"><span>Eventos históricos</span><strong>${allEvents.length}</strong><em>ocorrências preservadas</em></div>
      <div class="card metric"><span>Itens</span><strong>${names.length}</strong><em>nomes distintos no histórico</em></div>
      <div class="card metric"><span>Último evento</span><strong>${dates.length?fmtDate(dates.at(-1)):'—'}</strong><em>não indica situação atual</em></div>
    </div>
    <section class="card sectionGap"><div class="cardHead"><div><b>Mapa de protocolos</b><small>Resumo por item, sem reconstruir orientação de uso ou situação atual.</small></div></div><input id="treatmentQuery" class="fullInput" type="search" placeholder="Buscar protocolo ou origem" value="${esc(state.ui.treatmentQuery||'')}"><div class="protocolSummaryGrid">${filteredNames.map(name=>itemSummary(name,allEvents,regimenByName.get(name))).join('')||empty('Nenhum protocolo corresponde à busca.')}</div></section>
    <section class="card sectionGap"><div class="cardHead"><div><b>Linha do tempo de eventos</b><small>Somente ocorrências históricas efetivamente registradas.</small></div></div><div class="timelineGroups">${[...groups.entries()].map(([month,items])=>`<section class="timelineDay"><div class="timelineDate"><b>${esc(monthLabel(month))}</b><span>${items.length} registro(s)</span></div><div class="card timelineDayCard">${items.map(r=>`<div class="timelineItem rich"><span>${fmtDate(r.event_date)}</span><div><b>${esc(r.medication||'Registro de protocolo')}</b><em>${esc(r.source||'origem registrada')}</em></div></div>`).join('')}</div></section>`).join('')||empty('Nenhum evento histórico corresponde à busca.')}</div></section>
    <p class="footerNote">Protocolos são usados apenas como contexto temporal. Cadastro de contexto não significa uso atual, e o aplicativo não fornece instruções de uso ou mudança de tratamento.</p>`;
}
