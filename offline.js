// Registers the offline service worker (/sw.js) and hands it everything this page already loaded.
if ('serviceWorker' in navigator) addEventListener('load', () => {
  navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(reg => {
    const urls = [location.href, ...performance.getEntriesByType('resource').map(e => e.name)];
    reg.active?.postMessage({cache: urls});
  }).catch(e => console.warn('Offline mode unavailable:', e));
});
