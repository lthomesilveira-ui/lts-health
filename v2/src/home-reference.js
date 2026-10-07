import {state} from './core.js';
import {healthContextModel,renderHealthContext} from './health-context.js';
import {renderHomeDaySignals} from './integrated-review-view.js';
import {homeCockpitModel,renderHomeCockpit} from './home-cockpit.js';

export function renderProductHomeReference(){
  const period=state.ui.homePeriod||'90';
  const c=homeCockpitModel(state.data,state.domainStatus,period,state.ui);
  const context=healthContextModel(state.data,{...state.ui,homePeriod:period},state.domainStatus);
  const picker=`<div class="ltsCockpitWindow"><span>Janela de análise</span><div class="ltsHomePeriod" role="group" aria-label="Janela de análise">${[['30','30 dias'],['90','90 dias'],['365','1 ano'],['all','Histórico']].map(([key,label])=>`<button data-home-period="${key}" aria-pressed="${period===key}">${label}</button>`).join('')}</div></div>`;
  return `<section class="ltsHomeV2 ltsHomeReference ltsProductExperience ltsEvolutionHome">${picker}${renderHomeCockpit(c)}<details class="ltsHomeExplore" data-disclosure="home-history"><summary><span><b>Investigar um dia no histórico</b><small>Treino, alimentação, corpo, exames e protocolos na mesma data</small></span><i aria-hidden="true">＋</i></summary>${renderHealthContext(context,state.domainStatus,renderHomeDaySignals(c.r,context.selectedDate))}</details></section>`;
}
