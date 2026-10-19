// These predicates intentionally return booleans synchronously. Playwright
// 1.56.1 polls predicate() without awaiting it; a Promise is immediately truthy
// even if it later resolves false. Imports belong in page.evaluate, not here.
export function consumerRouteSettled({route,selector,afterRefresh=false}){
  const {state,isRouteReady}=window.__languageApp,root=document.querySelector(selector);
  if(!root||state.loading||!state.loaded||!isRouteReady(route)||state.route!==route||location.hash!==`#${route}`||document.querySelector('#screenHost .loadingState')||(afterRefresh&&root===window.__languageBeforeRefreshRoot)){
    window.__languageStableRoot=null;window.__languageFrames=0;return false;
  }
  if(window.__languageStableRoot!==root){window.__languageStableRoot=root;window.__languageFrames=0;}
  if(++window.__languageFrames<3)return false;
  window.__languageRecord?.('stable-return',{route,afterRefresh,frames:window.__languageFrames});
  return true;
}
export function consumerDomainSettled({domain,status}){
  const {state}=window.__languageApp;
  return state.domainStatus[domain]===status&&!state.loading;
}
