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

// Modular product surfaces may extend the consolidated shell without reviving
// the deprecated version-stack runtime.
if (!document.querySelector('link[data-lts-training-product]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './training-product.css';
  link.setAttribute('data-lts-training-product', '1');
  document.head.appendChild(link);
}
window.addEventListener('load', () => {
  if (document.querySelector('script[data-lts-training-product]')) return;
  const script = document.createElement('script');
  script.src = './training-product.js';
  script.setAttribute('data-lts-training-product', '1');
  document.body.appendChild(script);
});
