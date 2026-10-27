import {state,esc,fmtDate,fmtNum,num,workoutRows} from './core.js';
import {trainingSessionSummary} from './training-session-summary.js';

// Descriptive views of accepted records only. No estimated volume, HR zones,
// inferred effort, cross-device average or missing-day interpolation.
export function sessionGroupChart(model){
  const rows=[...model.muscleGroups,...(model.unknownMuscleGroup.exercises?[{...model.unknownMuscleGroup,label:'Grupo não informado'}]:[])];
  const usable=model.setsAvailable&&rows.some(row=>row.primary>0);
  const maximum=Math.max(1,...rows.map(row=>row.primary||0));
  return `<section class="ltsRefTrainPanel ltsTrainingGroupChart" data-training-chart="groups"><header><div><span>Como a sessão foi distribuída</span><h2>Séries por grupo registrado</h2></div></header>${usable?`<div class="ltsTrainingScale"><span>Séries principais</span><span>0–${maximum}</span></div><div class="ltsTrainingGroupBars">${rows.map(row=>`<div class="ltsTrainingBarRow" data-training-group="${esc(row.label)}" data-primary="${row.primary}"><span>${esc(row.label)}</span><svg viewBox="0 0 200 16" preserveAspectRatio="none" role="img" aria-label="${esc(`${row.label}: ${row.primary} séries principais; escala de 0 a ${maximum}`)}"><rect class="ltsTrainingBarTrack" width="200" height="16" rx="4"/><rect class="ltsTrainingBarMark" width="${row.primary/maximum*200}" height="16" rx="4"/></svg><b>${row.primary}</b></div>`).join('')}</div>`:`<p class="ltsTrainingChartEmpty">${model.setsAvailable?'As séries deste treino ainda não têm detalhe estruturado para este gráfico.':'Os detalhes das séries não carregaram nesta atualização.'}</p>`}<p class="ltsTrainingChartNote">Contagem das séries registradas, incluindo aquecimentos. Prolongamentos ficam separados. Não mede o estímulo recebido por cada músculo.</p></section>`;
}

export function sessionHistoryChart(selected){
  const unique=new Map();
  for(const row of workoutRows()){
    if(String(row.workout_date)>String(selected.workout_date)||unique.has(row.source_record_id))continue;
    if(trainingSessionSummary(row,state.data,state.domainStatus).sessionAvailable)unique.set(row.source_record_id,row);
  }
  const rows=[...unique.values()].slice(0,6).reverse();
  const maximum=Math.max(1,...rows.map(row=>num(row.duration_minutes)||0));
  return `<section class="ltsRefTrainPanel ltsTrainingRecentChart" data-training-chart="sessions"><header><div><span>Seu ritmo registrado</span><h2>Sessões recentes</h2></div><button type="button" data-depth-training-view="history">Ver todas ›</button></header><div class="ltsTrainingScale"><span>Duração · minutos</span><span>0–${fmtNum(maximum,0)}</span></div><div class="ltsTrainingRecentBars">${rows.map(row=>{const value=num(row.duration_minutes);return `<button type="button" class="${row.source_record_id===selected.source_record_id?'selected':''}" data-depth-workout="${esc(row.source_record_id)}" data-training-duration="${value==null?'':value}" aria-label="${esc(`${fmtDate(row.workout_date)} · ${row.workout_type||'Treino'} · ${value==null?'duração não informada':fmtNum(value,1)+' minutos'}; abrir sessão`)}"><b>${value==null?'—':fmtNum(value,0)}</b><span class="ltsTrainingRecentTrack">${value==null?'<i class="missing"></i>':`<i style="height:${value/maximum*100}%"></i>`}</span><small>${fmtDate(row.workout_date).slice(0,5)}</small></button>`;}).join('')}</div><p class="ltsTrainingChartNote">Até seis sessões anteriores ou iguais à selecionada. Toque numa data para abrir. Dias sem treino registrado não entram como zero.</p></section>`;
}
