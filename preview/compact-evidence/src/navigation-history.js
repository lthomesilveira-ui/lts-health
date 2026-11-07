// Only entries created by this app can be used by an in-app Back action.
const key='ltsHealthNavigation';
function currentEntry(value,scope){
  const entry=value?.[key];
  return entry?.scope===scope&&typeof entry.route==='string'&&Number.isSafeInteger(entry.depth)&&entry.depth>=0?entry:null;
}
export function navigationState(value,scope,route,{replace=true}={}){
  const prior=currentEntry(value,scope);
  const depth=replace?(prior?.route===route?prior.depth:0):(prior?prior.depth+1:1);
  return {...value,[key]:{scope,route,depth}};
}
export function canNavigateBack(value,scope,route){
  const entry=currentEntry(value,scope);
  return Boolean(entry&&entry.route===route&&entry.depth>0);
}
