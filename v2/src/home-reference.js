import {state} from './core.js';
import {renderReferenceHome} from './home-reference-experience.js';

// The entire primary experience shares one selected calendar. Deep histories,
// goals and source settings remain on their existing routes.
export function renderProductHomeReference(){
  return `<section class="ltsHomeV2 ltsHomeReference ltsProductExperience ltsEvolutionHome">${renderReferenceHome(state.data,state.domainStatus,state.ui.homePeriod||'90',state.ui)}</section>`;
}
