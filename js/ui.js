import { syncState, syncNow } from './sync.js';
import { ROLE_NAMES, nice, initials, timeAgo } from './format.js';
import { DEMO, CONFIG } from './config.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ── Unsaved changes guard ── */
// dirty: this screen has unsaved changes and knows how to save them (guard.save).
// touched: something was typed or ticked on this screen that is not saved yet (any field, on every screen).
export const guard = { dirty: false, save: null, touched: false };
export function setDirty(on, saveFn) {
  guard.dirty = on; if (saveFn !== undefined) guard.save = saveFn;
  if (!on) guard.touched = false;
  $$('.save-state').forEach((el) => {
    el.className = 'save-state ' + (on ? 'dirty' : 'saved');
    el.innerHTML = on ? '<span class="d"></span>Unsaved Changes' : '<span class="d"></span>All Changes Saved';
  });
}

/* ── Toasts and dialogs ── */
export function toast(msg, kind = '') {
  let box = $('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; box.appendChild(t);
  setTimeout(() => t.remove(), kind === 'bad' ? 7000 : 3800);
}

// modal({ title, body (html), buttons: [{ label, cls, value }] , onOpen }) → resolves with the clicked value (null if closed)
export function modal({ title, body, buttons = [{ label: 'Close', cls: 'ghost', value: null }], onOpen, wide = false }) {
  return new Promise((resolve) => {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" style="${wide ? 'max-width:760px' : ''}">
      <div class="modal-head"><h2>${esc(title)}</h2><button class="x" aria-label="Close">×</button></div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    const close = (v) => { bg.remove(); document.removeEventListener('keydown', key); resolve(v); };
    const key = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', key);
    $('.x', bg).onclick = () => close(null);
    $$('.modal-foot .btn', bg).forEach((b) => {
      b.onclick = async () => {
        const btn = buttons[+b.dataset.i];
        if (btn.check) { const ok = await btn.check(bg); if (!ok) return; }
        close(btn.value !== undefined ? btn.value : btn.label);
      };
    });
    document.body.appendChild(bg);
    if (onOpen) onOpen(bg);
    const first = $('input, select, textarea', bg) || $('.modal-foot .btn', bg); if (first) first.focus();
  });
}
export const confirmBox = (title, text, okLabel = 'OK', cls = 'primary') =>
  modal({ title, body: `<p style="margin:0;font-size:15px;line-height:1.5">${text}</p>`, buttons: [{ label: 'Cancel', cls: 'ghost', value: false }, { label: okLabel, cls, value: true }] });

/* ── App shell ── */
const NAV = [
  { href: '#/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '#/audits', label: 'My Audit', icon: '▤' },
  { href: '#/drafts', label: 'AOM Drafts', icon: '✎', count: 'drafts' },
  { href: '#/review', label: 'For My Review', icon: '✓', count: 'review', reviewer: true },
  { href: '#/saor', label: 'SAOR', icon: '☰' },
  { href: '#/exit', label: 'Exit Conference', icon: '✉' },
  { href: '#/baar', label: 'BAAR Reports', icon: '▣' },
  { href: '#/library', label: 'AOM Library', icon: '❏' }
];
const ADMIN_NAV = [
  { href: '#/users', label: 'Users & Roles', icon: '◉' },
  { href: '#/lgus', label: 'LGU Master List', icon: '⌂' }
];

export function roleLine(me) {
  if (!me) return '';
  const r = me.roles || [];
  const main = r.includes('sa') ? 'Supervising Auditor' : r.includes('atl') ? 'Audit Team Leader' : r.includes('member') ? 'Team Member' : '';
  return [me.position, [main, r.includes('admin') ? 'Admin' : ''].filter(Boolean).join(' + ')].filter(Boolean).join(' · ');
}

export function shell({ me, team, active, crumbs, body, counts = {} }) {
  const isAdmin = (me.roles || []).includes('admin');
  const reviewer = (me.roles || []).some((r) => r === 'atl' || r === 'sa');
  const link = (n) => n.reviewer && !reviewer ? '' : n.href
    ? `<a href="${n.href}" class="${active === n.href ? 'active' : ''}"><span aria-hidden="true">${n.icon}</span>${esc(n.label)}${n.count && counts[n.count] ? `<span class="count">${counts[n.count]}</span>` : ''}</a>`
    : `<a class="disabled" aria-disabled="true"><span aria-hidden="true">${n.icon}</span>${esc(n.label)}<span class="soon">Phase ${n.phase}</span></a>`;
  return `<div class="layout">
    <aside class="side">
      <div class="brand"><img class="brand-logo" src="img/coa-logo.png" alt="COA logo"><div><b>Annual Audit Report System</b><span>Commission on Audit${team && team.officeCode ? ' · Team ' + esc(team.officeCode) : ''}</span></div></div>
      <nav class="nav" aria-label="Main">${NAV.map(link).join('')}
        ${isAdmin ? `<div class="nav-label">Admin</div>${ADMIN_NAV.map(link).join('')}` : ''}</nav>
      <div class="sync-box" id="sync-box">${syncBox()}</div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="crumbs">${crumbs}</div>
        <div class="me">
          ${DEMO ? '<span class="pill violet">Demo Mode</span>' : ''}${CONFIG.LABEL ? `<span class="pill warn">${esc(CONFIG.LABEL)}</span>` : ''}
          <div class="avatar" aria-hidden="true">${esc(initials(me.name))}</div>
          <div class="who"><b>${esc(nice(me.name))}</b><span>${esc(roleLine(me))}</span></div>
          <button class="btn ghost sm" id="sign-out">Sign Out</button>
        </div>
      </header>
      <main class="page" id="page">${body}</main>
    </div></div>`;
}

export function syncBox(s = syncState) {
  const map = {
    synced: ['', s.pending ? `Online · ${s.pending} Waiting` : 'Online · All Synced'],
    idle: ['', 'Online · All Synced'],
    syncing: ['busy', 'Syncing…'],
    offline: ['off', s.pending ? `Offline · ${s.pending} Saved on Device` : 'Offline'],
    signin: ['off', 'Sign In Needed'],
    error: ['off', 'Sync Problem']
  };
  const [dot, text] = map[s.status] || map.idle;
  const detail = s.message ? esc(s.message)
    : s.status === 'offline' ? 'Keep working. Saved work stays on this device and syncs when you are back online.'
      : `Last sync ${esc(timeAgo(s.lastSync))}. Work saves on this device even without signal.`;
  return `<div class="state"><span class="dot ${dot}"></span>${esc(text)}</div><small>${detail}</small>
    <button type="button" id="sync-now">${s.status === 'signin' ? 'Sign In Again' : 'Sync Now'}</button>`;
}

let syncListen = false;
export function wireShell(onSignOut) {
  if (!syncListen) {
    syncListen = true;
    window.addEventListener('sync-status', () => { const b = $('#sync-box'); if (b) { b.innerHTML = syncBox(); wireSyncBtn(); } });
  }
  wireSyncBtn();
  const so = $('#sign-out'); if (so) so.onclick = onSignOut;
}
function wireSyncBtn() {
  const b = $('#sync-now');
  if (b) b.onclick = () => (syncState.status === 'signin' ? window.dispatchEvent(new Event('need-signin')) : syncNow());
}

export const pill = (text, kind = 'grey') => `<span class="pill ${kind}">${esc(text)}</span>`;
