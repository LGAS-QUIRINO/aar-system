// A pretend server that lives in this browser, so the app can be tried without the Google backend.
// Same rules as backend/Code.gs: versions, conflicts, team scope, Admin-only reference tables.
import { db } from './db.js';
import { seedData, DEMO_USERS } from './seed.js';

const TABLES = ['users', 'teams', 'lgus', 'audits', 'auditlog', 'aom_library', 'aoms', 'letters'];
const REFERENCE = ['users', 'teams', 'lgus', 'aom_library'];
const ADMIN_ONLY = ['users', 'teams', 'lgus'];
let clock = 0;
const now = () => { const t = Math.max(Date.now(), clock + 1); clock = t; return new Date(t).toISOString(); };

async function load() {
  let state = await db.get('demo', 'state');
  if (!state) {
    state = {};
    TABLES.forEach((t) => { state[t] = {}; });
    const put = (t, id, data) => { state[t][id] = { id, version: 1, updatedAt: now(), updatedBy: 'setup', deleted: false, scope: '*', data }; };
    const s = seedData();
    s.teams.forEach((t) => put('teams', t.id, t));
    state.teams['team-2'].data.atlUserId = 'user-gringo';
    state.teams['team-2'].data.saUserId = 'user-masangcay';
    state.teams['team-1'].data.atlUserId = 'user-masangcay';
    state.teams['team-1'].data.saUserId = 'user-masangcay';
    s.lgus.forEach((l) => put('lgus', l.id, l));
    DEMO_USERS.forEach((u) => put('users', u.id, { ...u }));
    // An earlier (2025) record for Cabaruan, so the officials carry over in New Audit.
    put('audits', 'audit-demo-cabaruan-2025', { lguId: 'brgy-maddela-cabaruan', teamId: 'team-2', auditYear: 2025, periodFrom: 2024, periodTo: 2024, imported: true, status: 'Final', stage: 'Final',
      officials: [
        { title: 'Hon.', name: 'WALTER S. MIGUEL', pos: 'Punong Barangay', acting: false, role: 'For' },
        { title: 'Ms.', name: 'FLORETA G. BAUTISTA', pos: 'Municipal Accountant', acting: false, role: 'Attention' },
        { title: 'Ms.', name: 'ELAINE G. MORALES', pos: 'Barangay Bookkeeper', acting: false, role: 'Attention' },
        { title: 'Ms.', name: 'CHERRY ANNE J. VILLANUEVA', pos: 'Barangay Treasurer', acting: false, role: 'Attention' }],
      kagawads: [1, 2, 3, 4, 5, 6, 7].map(() => ({ name: '', pos: 'Barangay Kagawad' })).concat([{ name: '', pos: 'SK Chairperson' }]) });
    state.audits['audit-demo-cabaruan-2025'].scope = 'team-2';
    await db.put('demo', state, 'state');
  }
  TABLES.forEach((t) => { if (!state[t]) state[t] = {}; });
  return state;
}

const roles = (u) => u.data.roles || [];
const seesAll = (u) => roles(u).includes('admin') || roles(u).includes('sa') || roles(u).includes('osa');
const manages = (u) => roles(u).includes('admin') || roles(u).includes('sa');
const auditor = (u) => ['member', 'atl', 'sa', 'admin'].some((r) => roles(u).includes(r));
const staffOnly = (u) => roles(u).includes('staff') && !auditor(u);
const munLimit = (u) => (['atl', 'sa', 'osa', 'admin'].some((r) => roles(u).includes(r)) ? null : (u.data.munIds || []).length ? u.data.munIds : null);
function munOf(state, table, id, d = {}) {
  const lguMun = (lid) => { const l = state.lgus[lid]?.data; return !l ? '' : l.kind === 'municipality' ? lid : l.kind === 'barangay' ? l.parentId || '' : ''; };
  if (table === 'lgus') return d.kind === 'province' ? '' : d.kind === 'municipality' ? id : d.parentId || '';
  if (table === 'audits') return lguMun(d.lguId);
  if (d.munId) return d.munId;
  if (d.lguId) return lguMun(d.lguId);
  if (d.auditId && state.audits[d.auditId]) return lguMun(state.audits[d.auditId].data.lguId);
  return '';
}

export const demoServer = {
  async handle(action, payload, email) {
    await new Promise((r) => setTimeout(r, 120));
    const state = await load();
    const user = Object.values(state.users).find((u) => !u.deleted && u.data.email === email);
    if (!user || user.data.status === 'disabled') throw new Error('Your Gmail (' + email + ') is not registered. Ask the Admin to add you in Users & Roles.');
    const pub = { id: user.id, email: user.data.email, name: user.data.name, position: user.data.position, designation: user.data.designation, roles: roles(user), teamIds: user.data.teamIds || [], munIds: user.data.munIds || [] };
    if (action === 'bootstrap') return { ok: true, me: pub, serverTime: now() };
    if (action === 'pull') {
      const records = {};
      TABLES.forEach((t) => {
        const muns = munLimit(user);
        records[t] = Object.values(state[t]).filter((r) => {
          if (payload.since && r.updatedAt <= payload.since) return false;
          if (muns) {
            if (t === 'auditlog' && r.data.by !== email) return false;
            if (!['auditlog', 'users', 'teams', 'aom_library'].includes(t)) { const m = munOf(state, t, r.id, r.data); if (m && !muns.includes(m)) return false; }
          }
          if (REFERENCE.includes(t) || r.scope === '*') return true;
          if (t === 'letters' && r.scope === '') return true;
          return seesAll(user) || (user.data.teamIds || []).includes(r.scope);
        });
      });
      return { ok: true, serverTime: now(), records };
    }
    if (action === 'push') {
      const results = (payload.changes || []).map((c) => {
        try {
          if (!TABLES.includes(c.table)) throw new Error('Unknown table');
          if (!auditor(user) && c.table !== 'auditlog') {
            const ok = staffOnly(user) && (c.table === 'audits' || (c.table === 'letters' && c.data && ['tb', 'raomap'].includes(c.data.type)));
            if (!ok) throw new Error(staffOnly(user) ? 'Team Staff can encode the Setup, the officials and the trial balance only.' : 'OSA Staff can view and print only.');
          }
          if (ADMIN_ONLY.includes(c.table) && !roles(user).includes('admin')) throw new Error('Only the Admin can change ' + c.table + '.');
          if (c.table === 'aom_library' && !roles(user).some((r) => r === 'admin' || r === 'sa')) throw new Error('Only the Supervising Auditor or Admin can change the AOM Library.');
          let scope = REFERENCE.includes(c.table) ? '*' : String((c.data && c.data.teamId) || '');
          if (c.table === 'letters' && c.data && ['coa', 'gaa', 'wording', 'flagrules'].includes(c.data.type)) {
            if (!manages(user)) throw new Error('Only the Supervising Auditor or Admin can change this.');
            scope = '*';
          }
          if (scope !== '*' && !seesAll(user) && !(user.data.teamIds || []).includes(scope)) throw new Error('This record belongs to another team.');
          const cur = state[c.table][c.id];
          const muns = munLimit(user);
          if (muns && c.table !== 'auditlog' && !REFERENCE.includes(c.table)) {
            const mNew = munOf(state, c.table, c.id, c.data), mOld = cur ? munOf(state, c.table, c.id, cur.data) : '';
            if ((mNew && !muns.includes(mNew)) || (mOld && !muns.includes(mOld))) throw new Error('This record belongs to a municipality not assigned to you.');
          }
          if (staffOnly(user) && c.table === 'audits') {
            if (c.deleted) throw new Error('Team Staff cannot delete an audit.');
            if (cur && cur.data.memberId && c.data && c.data.memberId !== cur.data.memberId) throw new Error('Only the Supervising Auditor or Admin can change the auditor.');
          }
          const base = Number(c.baseVersion || 0);
          if ((cur && cur.version !== base) || (!cur && base !== 0)) return { table: c.table, id: c.id, status: 'conflict', record: cur || null };
          if (c.table === 'auditlog' && cur) throw new Error('Activity entries cannot be changed.');
          const rec = { id: c.id, version: (cur ? cur.version : 0) + 1, updatedAt: now(), updatedBy: email, deleted: !!c.deleted, scope, data: c.data };
          state[c.table][c.id] = rec;
          return { table: c.table, id: c.id, status: 'ok', record: rec };
        } catch (e) {
          return { table: c.table, id: c.id, status: 'error', error: e.message };
        }
      });
      await db.put('demo', state, 'state');
      return { ok: true, serverTime: now(), results };
    }
    // Files: kept in this browser for Demo Mode (the real backend keeps them in Google Drive).
    const canTeam = (t) => seesAll(user) || (user.data.teamIds || []).includes(String(t || ''));
    if (action === 'uploadFile') {
      if (!auditor(user)) throw new Error('Signed copies are uploaded by the auditor.');
      if (!canTeam(payload.teamId)) throw new Error('This audit belongs to another team.');
      if (!String(payload.data || '').startsWith('JVBER')) throw new Error('Only PDF files can be uploaded.');
      const id = 'file-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      await db.put('demo', { name: payload.name, data: payload.data, teamId: payload.teamId, by: email, at: now() }, 'file:' + id);
      return { ok: true, fileId: id, name: payload.name, size: Math.round(String(payload.data).length * 0.75) };
    }
    if (action === 'getFile' || action === 'deleteFile') {
      const f = await db.get('demo', 'file:' + payload.fileId);
      if (!f) throw new Error('The file was not found.');
      if (!canTeam(f.teamId)) throw new Error('This file belongs to another team.');
      if (action === 'getFile') return { ok: true, name: f.name, data: f.data };
      await db.del('demo', 'file:' + payload.fileId); return { ok: true };
    }
    throw new Error('Unknown action');
  },
  async reset() { await db.del('demo', 'state'); }
};
