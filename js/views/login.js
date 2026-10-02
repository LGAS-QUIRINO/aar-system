import { DEMO, CONFIG } from '../config.js';
import { DEMO_USERS } from '../seed.js';
import { esc } from '../ui.js';
import { nice } from '../format.js';

export function loginHtml(error = '') {
  return `<div class="login"><div class="login-card">
    <img class="brand-logo" src="img/coa-logo.png" alt="Commission on Audit logo">
    <div><h1>Annual Audit Report System</h1><p>Commission on Audit · Province of Quirino</p>${CONFIG.LABEL ? `<p style="margin-top:8px"><span class="pill warn">${esc(CONFIG.LABEL)}</span></p>` : ''}</div>
    ${error ? `<div class="note bad" role="alert" style="text-align:left">${esc(error)}</div>` : ''}
    ${DEMO ? `<p>Demo Mode: no Google account needed. Choose who to sign in as.</p>
      <div class="demo-roles">${DEMO_USERS.map((u) => `<button class="btn ${u.id === 'user-cess' ? 'primary' : 'ghost'}" data-demo="${esc(u.email)}">${esc(nice(u.name))} · ${esc(u.roles.includes('sa') ? 'Supervising Auditor' : u.roles.includes('atl') ? 'Audit Team Leader' : 'Team Member + Admin')}</button>`).join('')}</div>
      <p style="font-size:12px">Demo data stays in this browser only.</p>`
    : `<p>Sign in with the Gmail the Admin registered for you.</p><div id="gsi-btn" style="min-height:44px"></div>
      <p style="font-size:12px">After the first sign-in, you can keep working on this device even without internet.</p>`}
  </div></div>`;
}
