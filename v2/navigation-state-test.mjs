import assert from 'node:assert/strict';
import {navigationState,canNavigateBack} from './src/navigation-history.js';
const scope='/v2/';
let state=navigationState({unrelated:'preserved'},scope,'hoje');
assert.equal(canNavigateBack(state,scope,'hoje'),false,'a direct entry cannot leave the app');
assert.equal(state.unrelated,'preserved');
const home=state;
state=navigationState(state,scope,'treinos',{replace:false});
const training=state;
assert.equal(canNavigateBack(state,scope,'treinos'),true);
state=navigationState(state,scope,'bio',{replace:false});
assert.equal(canNavigateBack(state,scope,'bio'),true);
assert.deepEqual(navigationState(state,scope,'bio'),state,'restoring a session preserves app history');
assert.deepEqual(navigationState(training,scope,'treinos'),training,'browser Back keeps its destination entry');
assert.equal(canNavigateBack(home,scope,'hoje'),false);
for(const foreign of [null,{}, {ltsHealthNavigation:{scope:'/other/',route:'bio',depth:20}},{ltsHealthNavigation:{scope,route:'bio',depth:-1}},{ltsHealthNavigation:{scope,route:'bio',depth:'1'}}]){
  assert.equal(canNavigateBack(foreign,scope,'bio'),false);
  assert.equal(canNavigateBack(navigationState(foreign,scope,'bio'),scope,'bio'),false);
}
assert.equal(canNavigateBack(state,scope,'saude'),false,'stale route metadata is not used');
assert.equal(canNavigateBack(navigationState(state,scope,'saude'),scope,'saude'),false,'external hash entries are bounded');
console.log('Navigation: direct/foreign/stale entries stay in the app, real returns and reloads preserve scoped history.');
