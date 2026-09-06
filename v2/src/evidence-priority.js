import {state,esc,day,num,norm} from './core.js';
import {
  buildIntegratedAnalysis,bodyChangeModel,trainingDistributionModel,
  comparablePerformanceModel,nutritionPeriodModel,sleepCoverageModel,periodBounds
} from './integrated-analysis.js';

const failed=(status,key)=>status?.[key]==='error';
const inBounds=(value,bounds)=>{
  const d=day(value);
  return Boolean(d&&(!bounds?.start||d>=bounds.start)&&(!bounds?.end||d<=bounds.end));
};
const levelWeight={block:3,limit:2,context:1};
const levelLabel={block:'Bloqueia esta leitura',limit:'Limita a comparação',context:'Contexto preservado'};
const domainOrder={hydration:90,composition:80,nutrition:75,labs:70,sleep:65,training:60,sources:40};

function nutritionEvidence(rows,bounds){
  const groups=new Map();
  for(const row of rows||[]){
    const date=day(row?.nutrition_date);
    if(!date||!inBounds(date,bounds))continue;
    if(!groups.has(date))groups.set(date,[]);
    groups.get(date).push(row);
  }
  let safeDays=0,reviewDays=0,waterDays=0;
  for(const items of groups.values()){
    if(items.length!==1){reviewDays++;continue;}
    safeDays++;
    const water=num(items[0]?.water_ml);
    if(water!=null&&water>0)waterDays++;
  }
  return{safeDays,reviewDays,waterDays,totalDays:groups.size};
}
function preservedSeriesCount(rows,bounds){
  const groups=new Set();
  for(const row of rows||[]){
    if(!['candidate','held'].includes(norm(row?.canonical_status)))continue;
    if(!inBounds(row?.metric_date,bounds))continue;
    const family=String(row?.source_family||'unknown');
    const metric=String(row?.metric_type||'unknown');
    const unit=String(row?.unit||'').trim()||'unidade não informada';
    groups.add(`${family}\u0000${metric}\u0000${unit}`);
  }
  return groups.size;
}
function sleepSourceCount(rows,bounds){
  const groups=new Set();
  for(const row of rows||[]){
    if(row?.metric_type!=='sleep_duration_h')continue;
    if(!['candidate','held'].includes(norm(row?.canonical_status)))continue;
    if(!inBounds(row?.metric_date,bounds))continue;
    groups.add(`${String(row?.source_family||'unknown')}\u0000${String(row?.source_name||row?.source_family||'unknown')}`);
  }
  return groups.size;
}
function labRowsInBounds(data,status,bounds){
  if(failed(status,'labs'))return[];
  return (data?.labs||[]).filter(row=>inBounds(row?.collection_date,bounds));
}
function addPriority(rows,key,level,title,detail,route){
  rows.push({key,level,title,detail,route,score:levelWeight[level]*100+(domainOrder[key]||0)});
}

export function coveragePriorityModel(data={},status={},period='365'){
  const integrated=buildIntegratedAnalysis(data,status);
  const bounds=periodBounds(period,integrated.referenceDay);
  const body=bodyChangeModel(data,status,bounds.start,bounds.end);
  const training=trainingDistributionModel(data,status,bounds.start,bounds.end);
  const performance=comparablePerformanceModel(data,status,1,bounds.start,bounds.end);
  const nutrition=nutritionPeriodModel(data,status,bounds.start,bounds.end);
  const sleep=sleepCoverageModel(data,status,bounds.start,bounds.end);
  const nutritionEvidenceModel=nutritionEvidence(data.nutrition||[],bounds);
  const labs=labRowsInBounds(data,status,bounds);
  const sourceSeries=failed(status,'sourceMetrics')?null:preservedSeriesCount(data.sourceMetrics||[],bounds);
  const sleepSources=failed(status,'sourceMetrics')?null:sleepSourceCount(data.sourceMetrics||[],bounds);
  const rows=[];

  if(failed(status,'nutrition')){
    addPriority(rows,'hydration','block','Hidratação não verificável','A fonte de nutrição não carregou; a ingestão de água não é convertida em zero nem estimada.','dados');
  }else if(!nutritionEvidenceModel.waterDays){
    addPriority(rows,'hydration','block','Sem registro de ingestão de água','Nenhum dia desta janela contém volume real de água estruturado. O LTS Health não estima hidratação.','dados');
  }

  if(failed(status,'body')){
    addPriority(rows,'composition','block','Composição não carregou','A leitura de mudança corporal fica indisponível até os dados voltarem a carregar.','bio');
  }else if(!body.available){
    const detail=body.reason==='source_changed'
      ?'As medições recentes têm origens diferentes e não são tratadas como continuidade automática.'
      :body.reason==='ambiguous'
        ?'Há mais de uma medição em uma data relevante; nenhuma foi escolhida por suposição.'
        :'Faltam duas medições comparáveis, da mesma continuidade de origem, dentro desta janela.';
    addPriority(rows,'composition',body.reason==='source_changed'||body.reason==='ambiguous'?'limit':'block','Composição sem mudança comparável',detail,'bio');
  }

  if(failed(status,'nutrition')){
    addPriority(rows,'nutrition','block','Nutrição não carregou','Energia e macros não podem ser resumidos nesta janela enquanto a fonte estiver indisponível.','nutricao');
  }else if(!nutrition.available||!nutrition.days){
    addPriority(rows,'nutrition','block','Nutrição sem dias comparáveis','Não há total diário inequívoco suficiente para resumir alimentação nesta janela.','nutricao');
  }else{
    if(nutrition.coveragePct!=null&&nutrition.coveragePct<50){
      addPriority(rows,'nutrition','limit','Cobertura nutricional parcial',`${nutrition.coveragePct}% dos dias possíveis têm total diário comparável nesta janela.`,'nutricao');
    }
    if(nutritionEvidenceModel.reviewDays){
      addPriority(rows,'nutrition','limit','Dias de nutrição em revisão',`${nutritionEvidenceModel.reviewDays} dia(s) têm mais de um total preservado e ficam fora das médias.`,'nutricao');
    }
  }

  if(failed(status,'labs')){
    addPriority(rows,'labs','block','Exames não carregaram','A cobertura laboratorial desta janela não pode ser verificada agora.','saude');
  }else if(!labs.length){
    addPriority(rows,'labs','block','Sem coleta de exames na janela','O histórico completo continua preservado, mas não há coleta dentro do período selecionado.','saude');
  }else if(integrated?.labs?.available&&!integrated.labs.safe){
    addPriority(rows,'labs','limit','Exames sem comparação segura','Os resultados permanecem separados quando origem, unidade ou biomarcador não formam uma série comparável.','saude');
  }

  if(failed(status,'sourceMetrics')){
    addPriority(rows,'sleep','block','Sono por origem não carregou','Nenhum valor é inferido quando os registros complementares estão indisponíveis.','dados');
  }else if(!sleep.available||!sleep.days){
    addPriority(rows,'sleep','block','Sono sem cobertura na janela','Não há registro preservado de sono que possa ser mostrado neste período.','dados');
  }else if((sleepSources||0)>1){
    addPriority(rows,'sleep','context','Sono preservado em mais de uma origem',`${sleepSources} origens permanecem separadas; o sistema não calcula média consolidada entre dispositivos.`,'dados');
  }

  if(failed(status,'workouts')){
    addPriority(rows,'training','block','Treinos não carregaram','A distribuição de treino desta janela fica indisponível sem converter falha em zero.','treinos');
  }else if(!training.available||!training.totalSessions){
    addPriority(rows,'training','block','Sem treino estruturado na janela','Não há sessão estruturada suficiente para analisar distribuição no período.','treinos');
  }else if(!performance.length){
    addPriority(rows,'training','limit','Performance sem par comparável','Há treinos, mas ainda não há dois registros do mesmo exercício, máquina e unidade para comparar carga.','treinos');
  }

  if(sourceSeries!=null&&sourceSeries>0){
    addPriority(rows,'sources','context','Séries complementares aguardam regra segura',`${sourceSeries} série(s) Apple, Polar ou de outras origens ficam preservadas e separadas até existir mapeamento validado.`,'dados');
  }

  rows.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title,'pt-BR'));
  return{period,bounds,referenceDay:integrated.referenceDay,rows,sourceSeries,sleepSources};
}

export function traceabilityModel(data={},status={}){
  const uploadsFailed=failed(status,'uploads'),qualityFailed=failed(status,'quality'),sourceFailed=failed(status,'sourceMetrics'),workoutEvidenceFailed=failed(status,'workoutEvidence');
  const uploads=uploadsFailed?[]:(data.uploads||[]);
  const quality=qualityFailed?[]:(data.quality||[]);
  const sourceMetrics=sourceFailed?[]:(data.sourceMetrics||[]);
  const processed=uploads.filter(row=>['processed','imported'].includes(norm(row?.status))).length;
  const inProgress=uploads.filter(row=>['uploaded','processing'].includes(norm(row?.status))).length;
  const uploadAttention=uploads.filter(row=>['review_required','rejected','failed'].includes(norm(row?.status))).length;
  const qualityOpen=quality.filter(row=>['open','in_progress'].includes(norm(row?.status))).length;
  const qualityKnown=quality.filter(row=>['accepted','known','ignored'].includes(norm(row?.status))).length;
  const qualityResolved=quality.filter(row=>norm(row?.status)==='resolved').length;
  const structuredKeys=['body','workouts','nutrition','metrics','labs','docs','treatments'];
  const structuredDomains=structuredKeys.filter(key=>!failed(status,key)&&(data[key]||[]).length>0).length;
  const preservedSeries=sourceFailed?null:preservedSeriesCount(sourceMetrics,{start:null,end:null});
  const workoutEvidence=workoutEvidenceFailed?null:(data.workoutEvidence||[]).length;
  return{
    uploads:uploadsFailed?null:uploads.length,processed:uploadsFailed?null:processed,
    inProgress:uploadsFailed?null:inProgress,uploadAttention:uploadsFailed?null:uploadAttention,
    structuredDomains,preservedSeries,workoutEvidence,
    qualityOpen:qualityFailed?null:qualityOpen,qualityKnown:qualityFailed?null:qualityKnown,
    qualityResolved:qualityFailed?null:qualityResolved,
    partial:uploadsFailed||qualityFailed||sourceFailed||workoutEvidenceFailed
  };
}

const metricValue=value=>value==null?'—':String(value);
function priorityRow(row,index){
  return `<article class="coveragePriorityRow ${esc(row.level)}">
    <div class="coveragePriorityOrder">${index+1}</div>
    <div class="coveragePriorityCopy"><span>${esc(levelLabel[row.level]||'Cobertura')}</span><b>${esc(row.title)}</b><p>${esc(row.detail)}</p></div>
    <button type="button" data-evidence-route="${esc(row.route)}">Abrir →</button>
  </article>`;
}
export function renderCoveragePriorityPanel(model){
  const rows=model?.rows||[];
  return `<section class="coveragePriority sectionGap" data-coverage-priority>
    <div class="coveragePriorityHead">
      <div><span>Cobertura da análise</span><h2>O que mais limita esta leitura agora</h2><p>A ordem mede apenas quanto uma lacuna impede análise ou comparação de dados. Não é classificação de saúde e não gera recomendação clínica.</p></div>
      <small>${rows.length?`${rows.length} ponto(s) de cobertura`:'sem lacunas adicionais pelos critérios atuais'}</small>
    </div>
    <div class="coveragePriorityList">${rows.length?rows.slice(0,6).map(priorityRow).join(''):'<div class="coveragePriorityEmpty">A janela atual tem cobertura suficiente para as leituras suportadas pelos critérios existentes.</div>'}</div>
  </section>`;
}
export function renderTraceabilityPanel(model){
  const partial=model?.partial;
  return `<section class="card evidenceTraceability sectionGap" data-evidence-traceability>
    <div class="evidenceTraceabilityHead"><div><span>Rastreabilidade</span><h2>Do arquivo recebido ao dado analisável</h2><p>Visão agregada da cadeia de dados. Conteúdo bruto, identificadores internos e informações sensíveis não aparecem aqui.</p></div>${partial?'<small>algumas fontes não carregaram</small>':'<small>cadeia verificada</small>'}</div>
    <div class="evidenceTraceabilityMetrics">
      <div><span>Arquivos recebidos</span><b>${metricValue(model?.uploads)}</b></div>
      <div><span>Processados/importados</span><b>${metricValue(model?.processed)}</b></div>
      <div><span>Domínios estruturados</span><b>${metricValue(model?.structuredDomains)}</b></div>
      <div><span>Séries complementares preservadas</span><b>${metricValue(model?.preservedSeries)}</b></div>
    </div>
    <div class="evidenceTraceabilityFlow">
      <div><i>1</i><span><b>Originais</b><small>${model?.uploads==null?'origem indisponível agora':`${model.uploads} arquivo(s) preservado(s)`}</small></span></div>
      <div><i>2</i><span><b>Processamento</b><small>${model?.processed==null?'situação indisponível agora':`${model.processed} concluído(s) · ${model.inProgress} em andamento · ${model.uploadAttention} com atenção`}</small></span></div>
      <div><i>3</i><span><b>Estrutura e origem</b><small>${model?.preservedSeries==null?'cobertura complementar indisponível agora':`${model.structuredDomains} domínio(s) com dados · ${model.preservedSeries} série(s) complementares mantidas separadas${model.workoutEvidence==null?'':` · ${model.workoutEvidence} vínculo(s) complementares de treino`}`}</small></span></div>
      <div><i>4</i><span><b>Qualidade</b><small>${model?.qualityOpen==null?'qualidade indisponível agora':`${model.qualityOpen} aberto(s) · ${model.qualityKnown} limitação(ões) conhecida(s) · ${model.qualityResolved} resolvido(s)`}</small></span></div>
    </div>
    <div class="evidenceBoundary"><b>Separação de fontes preservada</b><span>Apple, Polar e outras origens complementares só avançam para uma leitura consolidada quando existir regra validada. Até lá, permanecem separadas e não geram registros duplicados no histórico principal.</span></div>
  </section>`;
}

function routeTitle(){
  return document.querySelector('#screenHost h1')?.textContent?.trim()||'';
}
export function mountEvidencePanels(){
  if(typeof document==='undefined')return;
  const host=document.querySelector('#screenHost');
  if(!host)return;
  const heading=routeTitle();
  if(heading==='Insights'&&!host.querySelector('[data-coverage-priority]')){
    const period=state.ui.analysisPeriod||'365';
    const holder=document.createElement('div');
    holder.innerHTML=renderCoveragePriorityPanel(coveragePriorityModel(state.data,state.domainStatus,period));
    const panel=holder.firstElementChild;
    const anchor=host.querySelector('.analysisDigest');
    if(anchor&&panel)anchor.after(panel);
  }
  if(heading==='Dados'&&!host.querySelector('[data-evidence-traceability]')){
    const holder=document.createElement('div');
    holder.innerHTML=renderTraceabilityPanel(traceabilityModel(state.data,state.domainStatus));
    const panel=holder.firstElementChild;
    const anchor=host.querySelector('[data-review-inbox]');
    if(anchor&&panel)anchor.after(panel);
  }
}
