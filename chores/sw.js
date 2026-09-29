/* Service worker.
   - The PAGE and the MANIFEST are served NETWORK-FIRST (bypassing the HTTP cache),
     so the latest version, name and icon always win; cached copies are an offline fallback.
   - Other static assets (icons) are cache-first for speed.
   - API calls to Apps Script are never touched — always live.
   Bump CACHE whenever icons/manifest change so installed devices re-fetch them. */
var CACHE = 'chores-v2';
var SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = req.url;

  // Never cache the Apps Script API — always go to the network.
  if (url.indexOf('script.google.com') !== -1 || url.indexOf('googleusercontent.com') !== -1) {
    return;
  }

  var isPage = req.mode === 'navigate' || req.destination === 'document' ||
               url.indexOf('index.html') !== -1 || url.replace(/[?#].*$/, '').endsWith('/');
  var isManifest = url.indexOf('manifest.json') !== -1;

  if (isPage || isManifest) {
    // NETWORK-FIRST, bypassing the HTTP cache so the newest deploy/name/icon always wins.
    var target = isManifest ? './manifest.json' : './index.html';
    e.respondWith(
      fetch(target, { cache: 'no-store' }).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(target, copy); });
        return res;
      }).catch(function () {
        return caches.match(target).then(function (hit) { return hit || caches.match('./'); });
      })
    );
    return;
  }

  // Static assets (icons): cache-first, fall back to network.
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
