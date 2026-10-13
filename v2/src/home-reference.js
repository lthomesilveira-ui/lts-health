import {state} from './core.js';
import {healthContextModel,renderHealthContext} from './health-context.js';
import {renderHomeDaySignals} from './integrated-review-view.js';
import {renderHomeOverview} from './home-overview.js?v=overview-20261013.53';
import {homeCockpitModel,renderHomeCockpit} from './home-cockpit.js?v=mobile-insight-20261013.51';

export function renderProductHomeReference(){
  const period=state.ui.homePeriod||'90';
  const c=homeCockpitModel(state.data,state.domainStatus,period,state.ui);
  // The calendar shares the cockpit's real bounds and selected food source.
  // Unavailable domains cannot leave stale points or facts in the day reader.
  const contextData=Object.fromEntries(['body','labs','treatments'].map(key=>[key,state.domainStatus[key]==='ready'?state.data[key]||[]:[]]));
  contextData.workouts=c.r.training.rows;
  contextData.nutrition=c.r.nutrition.rows.map(row=>({...row,nutrition_date:row.date}));
  const context=healthContextModel(contextData,c.m.current,state.ui.homeLabMarker,state.ui.healthContextDate,c.r.dates);
  const picker=`<div class="ltsCockpitWindow"><span>Janela de análise</span><div class="ltsHomePeriod" role="group" aria-label="Janela de análise">${[['30','30 dias'],['90','90 dias'],['365','1 ano'],['all','Histórico']].map(([key,label])=>`<button id="home-period-${key}" data-home-period="${key}" aria-pressed="${period===key}">${label}</button>`).join('')}</div></div>`;
  return `<section class="ltsHomeV2 ltsHomeReference ltsProductExperience ltsEvolutionHome">${renderHomeOverview(c,picker)}<details class="ltsHomeAdvanced" data-disclosure="home-advanced"><summary>Explorar painéis detalhados e metas</summary>${renderHomeCockpit(c)}</details><details class="ltsHomeExplore" data-disclosure="home-history"><summary><span><b>Investigar um dia no histórico</b><small>Treino, alimentação, corpo, exames e protocolos na mesma data</small></span><i aria-hidden="true">＋</i></summary>${renderHealthContext(context,state.domainStatus,renderHomeDaySignals(c.r,context.selectedDate))}</details></section>`;
}

