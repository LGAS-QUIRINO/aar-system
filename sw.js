// Keeps the app working offline. Bump VERSION on every release so devices pick up the new files.
const RELEASE = 'v2.14.2';
const VERSION = 'aar|' + self.registration.scope + '|' + RELEASE;   // each copy of the app has its own cache
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'img/coa-logo.png', 'img/icon-192.png', 'img/icon-512.png', 'data-coa.json', 'data-coa-2015.json',
  'js/app.js', 'js/config.js', 'js/db.js', 'js/store.js', 'js/sync.js', 'js/api.js', 'js/auth.js', 'js/demo-server.js', 'js/seed.js', 'js/ui.js', 'js/format.js', 'js/refs.js',
  'js/views/login.js', 'js/views/dashboard.js', 'js/views/audits.js', 'js/views/setup.js', 'js/views/users.js', 'js/views/lgus.js',
  'js/aom.js', 'js/auditctx.js', 'js/blockeditor.js', 'js/reviewpane.js', 'js/exitletter.js', 'js/views/exitconf.js', 'js/reviewtrail.js', 'js/saor.js', 'js/saor-wording.js', 'js/views/saorview.js', 'js/views/comments.js', 'js/baar-transmittal.js', 'js/views/baar.js', 'js/views/reportwording.js', 'js/baar-cover.js', 'js/baar-toc.js', 'js/baar-doc.js', 'js/baar-iar.js', 'js/baar-smr.js', 'js/files.js', 'js/coa.js', 'js/fs.js', 'js/tbimport.js', 'js/baar-fs.js', 'js/views/baarfs.js', 'js/views/coa.js', 'js/rao.js', 'js/views/fsstep.js', 'js/views/fsbudget.js', 'js/views/fsmgmt.js', 'js/views/fsleads.js', 'js/views/fsflags.js', 'js/views/wpfill.js', 'js/baar-notes.js', 'js/docx-aom.js', 'js/wp.js', 'js/library-seed.js',
  'js/views/findings.js', 'js/views/aoms.js', 'js/views/print.js', 'js/views/review.js', 'js/views/library.js', 'js/views/drafts.js',
  'img/letterhead.jpg', 'img/lh-seal.jpg', 'img/lh-name.jpg', 'img/cover-seal.png', 'img/cover-name.png', 'img/lh-central.png', 'lib/xlsx.full.min.js', 'lib/docx.min.js', 'lib/pdf.min.js', 'lib/pdf.worker.min.js'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && (k.startsWith('aar|' + self.registration.scope + '|') || k.startsWith('aar-v'))).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;                              // sync calls go straight to the server
  if (url.origin === location.origin) {
    // App files: cached copy first (works offline), refreshed in the background.
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      const net = fetch(e.request).then((res) => { if (res.ok) caches.open(VERSION).then((c) => c.put(e.request, res.clone())); return res; }).catch(() => hit);
      return hit || net;
    }));
  } else if (url.hostname.includes('fonts.g')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => { caches.open(VERSION).then((c) => c.put(e.request, res.clone())); return res; })));
  }
});
