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
['./v10.css','./v11.css'].forEach(href=>{
  if(!document.querySelector(`link[href="${href}"]`)){
    const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);
  }
});
window.addEventListener('load',()=>{
  if(document.querySelector('script[data-lts-health-v11]'))return;
  const s=document.createElement('script');s.src='./app-v11.js';s.dataset.ltsHealthV11='1';document.body.appendChild(s);
});
