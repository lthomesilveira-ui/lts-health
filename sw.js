// Retire the former root shell cache without affecting Wealth or other apps.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('lts-health-shell-')).map(key=>caches.delete(key)))).then(()=>self.registration.unregister())));
