// Home Screen shell only. It never imports the health client or reads sessions.
const root=new URL('./',import.meta.url);
const build=document.querySelector('meta[name="lts-build"]')?.content;
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const mode=()=>{document.documentElement.dataset.healthDisplay=standalone()?'standalone':'browser';};
mode();window.matchMedia('(display-mode: standalone)').addEventListener?.('change',mode);
const guide=document.getElementById('healthInstallGuide');
for(const button of document.querySelectorAll('[data-health-install]'))button.addEventListener('click',()=>guide?.showModal());
document.querySelector('[data-health-install-close]')?.addEventListener('click',()=>guide?.close());
const update=document.getElementById('healthAppUpdate');
document.querySelector('[data-health-update]')?.addEventListener('click',()=>location.reload());
document.querySelector('[data-health-update-later]')?.addEventListener('click',()=>{update.hidden=true;});
let lastCheck=-Infinity,checking=false,offered=null;
function newerBuild(value){
  const parse=text=>/^health-integrated-(\d{8})\.(\d+)$/.exec(text||''),a=parse(value),b=parse(build);
  return Boolean(a&&b&&(Number(a[1])>Number(b[1])||a[1]===b[1]&&Number(a[2])>Number(b[2])));
}
async function checkVersion(){
  if(!navigator.onLine||document.hidden||checking||Date.now()-lastCheck<60000)return;
  checking=true;lastCheck=Date.now();
  try{
    const url=new URL('./',root);url.searchParams.set('health_refresh',String(Date.now()));
    const response=await fetch(url,{cache:'no-store'});if(!response.ok)return;
    const html=new DOMParser().parseFromString(await response.text(),'text/html');
    const latest=html.querySelector('meta[name="lts-build"]')?.content;
    // Offer an update; never reload an open health form in the background.
    if(newerBuild(latest)&&latest!==offered){offered=latest;update.hidden=false;}
  }catch{}finally{checking=false;}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkVersion();});
window.addEventListener('pageshow',event=>{if(event.persisted)checkVersion();});
window.addEventListener('online',()=>{lastCheck=-Infinity;checkVersion();});
if(standalone())checkVersion();
if(isSecureContext&&'serviceWorker' in navigator&&!new URL(location.href).searchParams.has('fixture')){
  // Only the Health legacy registration is retired; other apps are untouched.
  navigator.serviceWorker.getRegistrations().then(registrations=>{
    const oldScope=new URL('../',root).href;
    for(const registration of registrations)if(registration.scope===oldScope)registration.update().catch(()=>{});
  }).catch(()=>{});
  navigator.serviceWorker.register(new URL('sw.js',root),{scope:root.pathname,updateViaCache:'none'}).catch(()=>{});
}
