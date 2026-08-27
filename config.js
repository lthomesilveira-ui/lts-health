// LTS Health dedicated production backend.
// No LTS Wealth backend reference belongs in this repository.
// Publishable keys are client-safe only when paired with Row Level Security.
window.LTS_HEALTH_CONFIG = Object.freeze({
  mode: 'dedicated',
  backend: Object.freeze({
    label: 'lts-health-production',
    projectRef: 'plztdqyuqcjohiimudnr',
    url: 'https://plztdqyuqcjohiimudnr.supabase.co',
    publishableKey: 'sb_publishable_7SdlV1H52wVVbPEsN7i7hg_jbluJ8aI'
  }),
  storageBucket: 'health-inbox',
  inspectFunction: 'health-inspect-upload'
});

// Product layers are loaded from the dedicated Health repository only.
['./v10.css','./v11.css','./v12.css','./v13.css'].forEach(href=>{
  if(!document.querySelector(`link[href="${href}"]`)){
    const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);
  }
});
function loadHealthLayer(src,marker){
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[${marker}]`);if(existing){resolve();return}
    const s=document.createElement('script');s.src=src;s.setAttribute(marker,'1');s.onload=resolve;s.onerror=reject;document.body.appendChild(s);
  });
}
window.addEventListener('load',async()=>{
  try{
    await loadHealthLayer('./app-v11.js','data-lts-health-v11');
    await loadHealthLayer('./app-v12.js','data-lts-health-v12');
    await loadHealthLayer('./app-v13.js','data-lts-health-v13');
  }catch(e){console.error('LTS Health product layer load failed',e)}
});
