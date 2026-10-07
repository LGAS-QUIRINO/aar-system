// Start-up and screen router.
import { DEMO } from './config.js';
import { auth } from './auth.js';
import { db } from './db.js';
import { store, onChange } from './store.js';
import { syncNow, startSync, syncState } from './sync.js';
import { loadRefs, writeBlock, staffOnly, viewOnly } from './refs.js';
import { oversightQueue } from './views/review.js';
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
import { baarReview, baarFinal, baarQueue } from './views/baarreview.js';
import { pool } from './views/library.js';
import { drafts } from './views/drafts.js';
import { exitconf } from './views/exitconf.js';
import { saorview } from './views/saorview.js';
import { saorReview, saorQueue } from './views/saorreview.js';
import { comments } from './views/comments.js';
import { baar, baarList } from './views/baar.js';
import { coaView } from './views/coa.js';
import { fsStep } from './views/fsstep.js';
import { flagRulesView } from './views/fsflags.js';
import { ST } from './aom.js';
import { amtText } from './fs.js';

const app = document.getElementById('app');
let lastRoute = '';
let started = false, lastHash = location.hash, skipGuard = false, renderTimer = null;

function route(hash) {
  const [path, qs] = (hash.replace(/^#/, '') || '/dashboard').split('?');
  const q = new URLSearchParams(qs || '');
  const p = path.split('/').filter(Boolean);
  if (p[0] === 'audits' && p[1] === 'new') return [setup, {}, q];
  if (p[0] === 'audits' && p[1] && p[2] === 'setup') return [setup, { id: p[1] }, q];
  if (p[0] === 'audits' && p[1] && p[2] === 'fs') return [fsStep, { id: p[1] }, q];
  if (p[0] === 'audits' && p[1] && p[2] === 'findings') return [findings, { id: p[1] }, q];
  if (p[0] === 'audits' && p[1] && p[2] === 'aoms') return [aoms, { id: p[1] }, q];
  if (p[0] === 'audits' && p[1] && p[2] === 'print') return [print, { id: p[1] }, q];
  if (p[0] === 'baar-review' && p[1]) return [baarReview, { id: p[1] }, q];
  if (p[0] === 'baar-final' && p[1]) return [baarFinal, { id: p[1] }, q];
  if (p[0] === 'review' && p[1]) return [review, { id: p[1] }, q];
  if (p[0] === 'review') return [reviewList, {}, q];
  if (p[0] === 'library') return [pool, {}, q];
  if (p[0] === 'drafts') return [drafts, {}, q];
  if (p[0] === 'exit') return [exitconf, {}, q];
  if (p[0] === 'saor') return [saorview, {}, q];
  if (p[0] === 'saor-review') return [saorReview, {}, q];
  if (p[0] === 'baar' && p[1]) return [baar, { id: p[1] }, q];
  if (p[0] === 'baar') return [baarList, {}, q];
  if (p[0] === 'audits' && p[1] && p[2] === 'comments') return [comments, { id: p[1] }, q];
  if (p[0] === 'audits') return [audits, {}, q];
  if (p[0] === 'users') return [users, {}, q];
  if (p[0] === 'lgus') return [lgus, {}, q];
  if (p[0] === 'coa') return [coaView, {}, q];
  if (p[0] === 'flags') return [flagRulesView, {}, q];
  return [dashboard, {}, q];
}

async function render() {
  const refs = await loadRefs();
  if (!refs.me) return showLogin('Your Gmail is not in the user list on this device yet. Connect to the internet and sign in again.');
  store.policy = (t, d) => writeBlock(refs.me, t, d);
  document.body.classList.toggle('ro-staff', staffOnly(refs.me));
  document.body.classList.toggle('ro-osa', viewOnly(refs.me));
  const [view, params, q] = route(location.hash);
  const sameRoute = lastRoute === location.hash.split('?')[0];
  const team = refs.team[(refs.me.teamIds || [])[0]];
  // Team Staff: the printed AOMs are the auditor's.
  const v = staffOnly(refs.me) && view === print ? { active: '#/audits', crumbs: '<b>Print</b>', body: '<div class="note warn">Printing is the auditor\'s work. Team Staff can encode the Setup, the officials and the trial balance.</div>' } : await view(refs, params, q);
  const roNote = roleNote(refs.me, view, q);
  if (roNote) v.body = roNote + v.body;
  const y = window.scrollY;
  const counts = await navCounts(refs);
  app.innerHTML = shell({ me: refs.me, team, active: v.active, crumbs: v.crumbs, body: v.body, counts });
  guard.dirty = false; guard.save = null; guard.touched = false;
  wireShell(signOut);
  app.addEventListener('click', clickGo);
  if (v.mount) v.mount($('#page'));
  if (roNote) lockControls($('#page'));
  if (v.keepScroll || sameRoute) window.scrollTo(0, y);
  lastRoute = location.hash.split('?')[0];
  const h = $('#page h1'); document.title = (h ? h.textContent + ' · ' : '') + 'Annual Audit Report System';
}
// On a view-only screen: boxes cannot be typed in and save buttons are hidden; moving around and printing still work.
function lockControls(root) {
  const nav = (el) => el.closest('.page-head, .mc-filt, .seg, .rv-bar, .rv-nav, [role=group], .steptabs, .modal-bg') || /^(find|p-find|s-m|s-y)$/.test(el.id || '');
  root.querySelectorAll('textarea, input, select, [contenteditable=true]').forEach((el) => { if (nav(el) || el.type === 'search') return; if (el.isContentEditable) el.contentEditable = 'false'; else el.disabled = true; });
  root.querySelectorAll('button.btn.primary, button.btn.success, button.btn.dashed, .savebar').forEach((el) => { if (nav(el) || /print|word|trail/i.test(el.id || '')) return; el.hidden = true; });
}
// One note at the top of a screen that is view only for this person.
function roleNote(me, view, q) {
  if (viewOnly(me) && ![dashboard].includes(view)) return '<div class="note info ro-note">View only. As OSA Staff you can view and print everything, but not change it.</div>';
  if (staffOnly(me)) {
    const allowed = view === setup || (view === fsStep && (!q.get('s') || q.get('s') === 'input')) || [dashboard, audits, print].includes(view);
    if (!allowed) return '<div class="note warn ro-note">View only. Findings, AOMs, the SAOR and the BAAR are the auditor\'s work. As Team Staff you can encode the Setup, the officials and the trial balance.</div>';
  }
  return '';
}
async function navCounts(refs) {
  if (viewOnly(refs.me)) return { drafts: 0, review: (await oversightQueue(refs)).length };
  const all = await store.list('aoms');
  const mine = all.filter((a) => (a.data.memberId === refs.me.id) && [ST.DRAFT, ST.RETURNED].includes(a.data.status || ST.DRAFT));
  const q = await reviewQueue(refs);
  const bq = await baarQueue(refs).catch(() => []);
  const sq = await saorQueue(refs).catch(() => []);
  return { drafts: mine.length, review: q.reduce((n, x) => n + x.list.length, 0) + bq.length + sq.length };
}
function clickGo(e) {
  const t = e.target.closest('[data-go]');
  if (t && !e.target.closest('a[href]:not([data-go]), button:not([data-go]), select, input')) location.hash = t.dataset.go;
}

/* ── Never lose what the person is typing (every screen, every phase) ── */
// Anything typed or ticked on a screen marks it as touched until it is saved or the screen is redrawn.
// Search boxes don't count. A field can opt out with data-transient.
function markTouched(e) {
  const t = e.target;
  if (!t || !t.closest || !t.closest('#page') || t.closest('[data-transient]') || /find|search/i.test(t.id || '')) return;
  guard.touched = true;
}
app.addEventListener('input', markTouched, true);
app.addEventListener('change', markTouched, true);

/* ── Amount boxes: on leaving the box, 4500 becomes 4,500.00 (every screen) ── */
// Runs before the screen's own change handler, so that handler reads and saves the tidied amount.
document.addEventListener('change', (e) => {
  const el = e.target;
  if (!el || !el.matches || !el.matches('input.amt, input.amt-in, input.fixin, input[data-amt]') || el.disabled || el.readOnly) return;
  const t = amtText(el.value.trim());
  if (t !== el.value) { el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); }
}, true);

// Busy = redrawing now would wipe or interrupt something.
function isBusy() {
  if (guard.dirty || guard.touched || document.querySelector('.modal-bg')) return true;
  const a = document.activeElement;
  if (a && a.closest && a.closest('#page') && (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes(a.type)))) return true;
  const sel = window.getSelection();
  return !!(sel && !sel.isCollapsed && sel.anchorNode && app.contains(sel.anchorNode));
}

// Ask before unsaved work is lost. verb: 'Leave' or 'Refresh'. Returns true to go ahead.
async function okToDrop(verb) {
  if (guard.dirty) {
    const choice = await modal({
      title: 'Unsaved Changes',
      body: `<p style="margin:0;font-size:15px">You have changes that are not saved yet. Save them first?</p>`,
      buttons: [{ label: 'Stay', cls: 'ghost', value: 'stay' }, { label: `${verb} Without Saving`, cls: 'ghost', value: 'drop' }, { label: `Save and ${verb}`, cls: 'primary', value: 'save' }]
    });
    if (choice === 'save') { if (guard.save) { const ok = await guard.save(); if (ok === false) return false; } }
    else if (choice !== 'drop') return false;
  } else if (guard.touched) {
    const choice = await modal({
      title: 'Not Saved Yet',
      body: `<p style="margin:0;font-size:15px">Something you typed or ticked on this screen is not saved yet. ${verb === 'Leave' ? 'Leave' : 'Refresh'} anyway?</p>`,
      buttons: [{ label: 'Stay', cls: 'primary', value: 'stay' }, { label: `${verb} Anyway`, cls: 'ghost', value: 'drop' }]
    });
    if (choice !== 'drop') return false;
  }
  guard.dirty = false; guard.touched = false;
  return true;
}

// Updates from others arrived while the person was busy: show a bar instead of redrawing under them.
function showUpdatesBar() {
  if (document.getElementById('upd-bar')) return;
  const page = document.getElementById('page'); if (!page) return;
  const bar = document.createElement('div');
  bar.id = 'upd-bar'; bar.className = 'upd-bar'; bar.setAttribute('role', 'status');
  bar.innerHTML = '<span><b>New updates are ready.</b> Refresh when you\'re done.</span><button class="btn sm primary" type="button">Refresh</button>';
  bar.querySelector('button').onclick = async () => { if (await okToDrop('Refresh')) render(); };
  page.prepend(bar);
}

window.addEventListener('hashchange', async () => {
  if (skipGuard) { skipGuard = false; lastHash = location.hash; return; }
  if (guard.dirty || guard.touched) {
    const target = location.hash;
    skipGuard = true; location.hash = lastHash;           // stay until the user decides
    if (await okToDrop('Leave')) location.hash = target;
    return;
  }
  lastHash = location.hash;
  window.scrollTo(0, 0);
  render();
});
window.addEventListener('beforeunload', (e) => { if (guard.dirty || guard.touched) { e.preventDefault(); e.returnValue = ''; } });

// Redraw when data changes. The person's own saves ('local') redraw right away unless they still have unsaved
// changes; changes from syncing redraw only when the person is not in the middle of something.
let localChange = false;
onChange((src) => {
  if (src === 'local') localChange = true;
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    const mine = localChange; localChange = false;
    if (!started) return;
    if (mine ? (guard.dirty || document.querySelector('.modal-bg')) : isBusy()) { if (!mine || guard.dirty) showUpdatesBar(); return; }
    render().then(() => {});
  }, 150);
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
  if (owner !== email) await store.wipe();               // a different (or unknown) account: start from a clean copy
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
    let problems = await syncNow();
    refs = await loadRefs();
    if (!refs.me && navigator.onLine) {
      // The copy on this computer may be incomplete (e.g. right after switching accounts): download everything once more.
      await db.del('meta', 'lastSync');
      problems = await syncNow();
      refs = await loadRefs();
    }
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

window.addEventListener('save-blocked', (e) => toast(e.detail, 'bad'));
window.addEventListener('unhandledrejection', (e) => { if (e.reason && /can (encode|view and print) only|Team Staff can|OSA Staff can/.test(String(e.reason.message || ''))) e.preventDefault(); });
// New versions: when a new release is published, the device switches to it by itself. If something is being typed,
// it waits and shows a bar to save and reload, so nothing is lost and nobody keeps running an old version.
function watchUpdates() {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  const showBar = () => {
    if (document.getElementById('upd-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'upd-bar'; bar.className = 'upd-bar';
    bar.innerHTML = '<span title="Save your work first; Reload saves it for you">New version ready</span><button class="btn sm primary" type="button">Reload</button>';
    bar.querySelector('button').onclick = () => { if (guard.dirty && guard.save) guard.save(); setTimeout(() => location.reload(), 600); };
    document.body.appendChild(bar);
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;            // the very first visit: nothing to switch from
    if (isBusy()) { showBar(); return; }   // something is being typed or not yet saved: never reload over it
    reloading = true; location.reload();
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    // Look for a new version when the app is opened again and every few minutes while it is open.
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 5 * 60 * 1000);
  }).catch(() => {});
}
(async function main() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') watchUpdates();
  const s = await auth.restore();
  if (s && s.email) boot(); else showLogin();
})().catch((e) => { app.innerHTML = `<div class="page"><div class="note bad">The app could not start: ${esc(e.message)}</div></div>`; });
window.addEventListener('error', (e) => toast('Something went wrong: ' + (e.message || 'error'), 'bad'));
