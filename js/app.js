// Start-up and screen router.
import { DEMO } from './config.js';
import { auth } from './auth.js';
import { db } from './db.js';
import { store, onChange } from './store.js';
import { syncNow, startSync, syncState } from './sync.js';
import { loadRefs } from './refs.js';
import { shell, wireShell, guard, setDirty, modal, confirmBox, toast, esc, $ } from './ui.js';
import { loginHtml } from './views/login.js';
import { dashboard } from './views/dashboard.js';
import { audits } from './views/audits.js';
import { setup } from './views/setup.js';
import { users } from './views/users.js';
import { lgus } from './views/lgus.js';
import { findings } from './views/findings.js';
import { aoms } from './views/aoms.js';
import { print } from './views/print.js';
import { review, reviewList, reviewQueue } from './views/review.js';
import { pool } from './views/library.js';
import { drafts } from './views/drafts.js';
import { ST } from './aom.js';

const app = document.getElementById('app');
let lastRoute = '';
let started = false, lastHash = location.hash, skipGuard = false, renderTimer = null;

function route(hash) {
  const [path, qs] = (hash.replace(/^#/, '') || '/dashboard').split('?');
  const q = new URLSearchParams(qs || '');
  const p = path.split('/').filter(Boolean);
  if (p[0] === 'audits' && p[1] === 'new') return [setup, {}, q];
  if (p[0] === 'audits' && p[1] && p[2] === 'setup') return [setup, { id: p[1] }, q];
  if (p[0] === 'audits' && p[1] && p[2] === 'findings') return [findings, { id: p[1] }, q];
  if (p[0] === 'audits' && p[1] && p[2] === 'aoms') return [aoms, { id: p[1] }, q];
  if (p[0] === 'audits' && p[1] && p[2] === 'print') return [print, { id: p[1] }, q];
  if (p[0] === 'review' && p[1]) return [review, { id: p[1] }, q];
  if (p[0] === 'review') return [reviewList, {}, q];
  if (p[0] === 'library') return [pool, {}, q];
  if (p[0] === 'drafts') return [drafts, {}, q];
  if (p[0] === 'audits') return [audits, {}, q];
  if (p[0] === 'users') return [users, {}, q];
  if (p[0] === 'lgus') return [lgus, {}, q];
  return [dashboard, {}, q];
}

async function render() {
  const refs = await loadRefs();
  if (!refs.me) return showLogin('Your Gmail is not in the user list on this device yet. Connect to the internet and sign in again.');
  const [view, params, q] = route(location.hash);
  const sameRoute = lastRoute === location.hash.split('?')[0];
  const team = refs.team[(refs.me.teamIds || [])[0]];
  const v = await view(refs, params, q);
  const y = window.scrollY;
  const counts = await navCounts(refs);
  app.innerHTML = shell({ me: refs.me, team, active: v.active, crumbs: v.crumbs, body: v.body, counts });
  guard.dirty = false; guard.save = null;
  wireShell(signOut);
  app.addEventListener('click', clickGo);
  if (v.mount) v.mount($('#page'));
  if (v.keepScroll || sameRoute) window.scrollTo(0, y);
  lastRoute = location.hash.split('?')[0];
  const h = $('#page h1'); document.title = (h ? h.textContent + ' · ' : '') + 'Annual Audit Report System';
}
async function navCounts(refs) {
  const all = await store.list('aoms');
  const mine = all.filter((a) => (a.data.memberId === refs.me.id) && [ST.DRAFT, ST.RETURNED].includes(a.data.status || ST.DRAFT));
  const q = await reviewQueue(refs);
  return { drafts: mine.length, review: q.reduce((n, x) => n + x.list.length, 0) };
}
function clickGo(e) {
  const t = e.target.closest('[data-go]');
  if (t && !e.target.closest('a[href]:not([data-go]), button:not([data-go]), select, input')) location.hash = t.dataset.go;
}

window.addEventListener('hashchange', async () => {
  if (skipGuard) { skipGuard = false; lastHash = location.hash; return; }
  if (guard.dirty) {
    const target = location.hash;
    skipGuard = true; location.hash = lastHash;           // stay until the user decides
    const choice = await modal({
      title: 'Unsaved Changes',
      body: '<p style="margin:0;font-size:15px">You have changes that are not saved yet. Save them before leaving?</p>',
      buttons: [{ label: 'Stay', cls: 'ghost', value: 'stay' }, { label: 'Leave Without Saving', cls: 'ghost', value: 'leave' }, { label: 'Save and Leave', cls: 'primary', value: 'save' }]
    });
    if (choice === 'save' && guard.save) { const ok = await guard.save(); if (ok === false) return; }
    if (choice === 'save' || choice === 'leave') { guard.dirty = false; location.hash = target; }
    return;
  }
  lastHash = location.hash;
  window.scrollTo(0, 0);
  render();
});
window.addEventListener('beforeunload', (e) => { if (guard.dirty) { e.preventDefault(); e.returnValue = ''; } });

onChange(() => {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => { if (started && !guard.dirty && !document.querySelector('.modal-bg')) render().then(() => {}); }, 150);
});

/* ── Sign in / out ── */
async function showLogin(error = '') {
  started = false;
  app.innerHTML = loginHtml(error);
  document.title = 'Sign In · Annual Audit Report System';
  if (DEMO) {
    app.querySelectorAll('[data-demo]').forEach((b) => { b.onclick = async () => { await enter(b.dataset.demo, () => auth.demoSignIn(b.dataset.demo)); }; });
  } else {
    try { await auth.renderButton(document.getElementById('gsi-btn')); }
    catch (e) { document.getElementById('gsi-btn').innerHTML = `<div class="note warn">${esc(e.message)}</div>`; }
  }
}

async function enter(email, signIn) {
  const owner = await db.get('meta', 'owner');
  if (owner && owner !== email) await store.wipe();      // another person's data never mixes with yours
  if (signIn) await signIn();
  await db.put('meta', email, 'owner');
  await boot();
}

window.addEventListener('signed-in', (e) => { if (!started) enter(e.detail.email); else syncNow(); });
window.addEventListener('need-signin', async () => {
  await modal({ title: 'Sign In Again', body: '<p style="margin:0">Google needs you to sign in again before syncing. Your work is safe on this device.</p><div id="gsi-again" style="min-height:44px"></div>',
    onOpen: (bg) => auth.renderButton(bg.querySelector('#gsi-again')).catch(() => {}) });
});

async function signOut() {
  let n = await store.pendingCount();
  if (n && navigator.onLine) { toast('Syncing your saved work before signing out…'); await syncNow(); n = await store.pendingCount(); }
  if (n && !(await confirmBox('Sign Out', `${n} saved change${n > 1 ? 's have' : ' has'} not reached the server yet. Signing out removes ${n > 1 ? 'them' : 'it'} from this device. Sync first if you can.`, 'Sign Out Anyway', 'primary'))) return;
  if (guard.dirty && !(await confirmBox('Unsaved Changes', 'You have unsaved changes on this screen. Sign out anyway?', 'Sign Out'))) return;
  setDirty(false);
  await store.wipe(); await db.del('meta', 'owner');
  await auth.signOut();
  location.hash = '';
  showLogin();
}

async function boot() {
  let refs = await loadRefs();
  if (!refs.me) {
    app.innerHTML = '<div class="login"><div class="login-card"><img class="brand-logo" src="img/coa-logo.png" alt=""><p>Getting your data ready…</p></div></div>';
    const problems = await syncNow();
    refs = await loadRefs();
    if (!refs.me) {
      const msg = (problems && problems[0]) || syncState.message || (navigator.onLine ? 'Your Gmail is not registered. Ask the Admin to add you in Users & Roles.' : 'You are offline. The first sign-in on a device needs internet.');
      await auth.signOut(); await db.del('meta', 'owner');
      return showLogin(msg);
    }
  }
  started = true;
  if (!startSync.done) { startSync.done = true; startSync(); } else syncNow();
  await render();
}

(async function main() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  const s = await auth.restore();
  if (s && s.email) boot(); else showLogin();
})().catch((e) => { app.innerHTML = `<div class="page"><div class="note bad">The app could not start: ${esc(e.message)}</div></div>`; });
window.addEventListener('error', (e) => toast('Something went wrong: ' + (e.message || 'error'), 'bad'));
