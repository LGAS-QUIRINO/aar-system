// Everything a screen needs about one audit: the Barangay, team, reviewers, its AOMs and their numbers.
import { store } from './store.js';
import { setupVars, formatVar, numberAoms, SETUP_VAR_NAMES, ST } from './aom.js';
import { has } from './refs.js';
import { esc } from './ui.js';
import { periodYears } from './format.js';

export async function loadAudit(refs, auditId) {
  const rec = await store.get('audits', auditId);
  if (!rec || rec.deleted) return null;
  const audit = rec.data;
  const lgu = refs.lgu[audit.lguId]?.data || { name: '?' };
  const mun = refs.lgu[refs.lgu[audit.lguId]?.data.parentId]?.data || { name: '' };
  const teamRec = refs.team[audit.teamId];
  const team = teamRec ? teamRec.data : {};
  const userOf = (id) => (refs.user[id] ? { id, ...refs.user[id].data } : null);
  const atl = userOf(team.atlUserId), sa = userOf(team.saUserId), member = userOf(audit.memberId);
  const aoms = (await store.list('aoms')).filter((a) => a.data.auditId === auditId).sort((a, b) => (a.data.seq || 0) - (b.data.seq || 0));
  const nums = numberAoms(aoms);
  const base = setupVars(audit, lgu, mun);
  const varsFor = (a) => {
    const v = {};
    const wp = (a.data || a).wpData;
    if (wp && wp.vars) Object.entries(wp.vars).forEach(([k, x]) => { v[k] = formatVar(k, x.raw); });
    SETUP_VAR_NAMES.forEach((k) => { if (base[k]) v[k] = base[k]; });
    return v;
  };
  const me = refs.me;
  const oneStep = !!(team.atlUserId && team.atlUserId === team.saUserId);
  const isMember = me.id === audit.memberId || (has(me, 'member') && (me.teamIds || []).includes(audit.teamId));
  const canEdit = (a) => {
    const s = a.data.status || ST.DRAFT;
    if (s === ST.DRAFT || s === ST.RETURNED) return isMember || has(me, 'atl') || has(me, 'sa');
    if (s === ST.ATL) return me.id === team.atlUserId;
    if (s === ST.SA) return me.id === team.saUserId;
    return false;
  };
  return { rec, audit, lgu, mun, team, teamId: audit.teamId, atl, sa, member, aoms, nums, varsFor, oneStep, isMember, canEdit, title: `${lgu.name} · ${periodYears(audit.periodFrom, audit.periodTo)}` };
}

const STEPS = ['Setup', 'Findings and AOMs', 'AOM Review', 'SAOR and Exit Conference', 'BAAR', 'Final'];
export function stepsBar(ctx, active) {
  const stage = Math.max(0, STEPS.indexOf(ctx.audit.stage || 'Setup'));
  const links = { Setup: `#/audits/${ctx.rec.id}/setup`, 'Findings and AOMs': `#/audits/${ctx.rec.id}/findings`, 'AOM Review': `#/audits/${ctx.rec.id}/aoms`, 'SAOR and Exit Conference': `#/audits/${ctx.rec.id}/comments` };
  const anyFinal = (ctx.aoms || []).some((a) => a.data.status === ST.FINAL);
  return `<nav class="stepsbar" aria-label="Audit stages">${STEPS.map((s, i) => {
    const cls = s === active ? 'now' : i < stage ? 'done' : '';
    const label = (i < stage ? '✓ ' : '') + s.replace(' and ', ' & ');
    return links[s] && (i <= Math.max(stage, 1) || (s === 'SAOR and Exit Conference' && anyFinal)) ? `<a class="${cls}" href="${links[s]}">${esc(label)}</a>` : `<span class="${cls}">${esc(label)}</span>`;
  }).join('')}</nav>`;
}

// Move the audit to a later stage (never back).
export async function advanceStage(ctx, stage) {
  const cur = STEPS.indexOf(ctx.audit.stage || 'Setup');
  if (STEPS.indexOf(stage) > cur) {
    ctx.audit.stage = stage;
    await store.save('audits', ctx.rec.id, ctx.audit, { silent: true });
  }
}
export { STEPS };
