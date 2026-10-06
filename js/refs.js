// Loads the shared lists every screen needs, and answers "who am I / what may I see".
import { store } from './store.js';
import { auth } from './auth.js';

export async function loadRefs() {
  const [users, teams, lgus] = await Promise.all([store.list('users'), store.list('teams'), store.list('lgus')]);
  const meRec = users.find((u) => String(u.data.email).toLowerCase() === auth.email);
  const me = meRec ? { id: meRec.id, ...meRec.data } : null;
  const byId = (arr) => Object.fromEntries(arr.map((r) => [r.id, r]));
  return { users, teams, lgus, me, user: byId(users), team: byId(teams), lgu: byId(lgus) };
}

export const has = (me, role) => !!me && (me.roles || []).includes(role);
// OSA Staff see every team, like the SA, but only to view and print.
export const seesAll = (me) => has(me, 'admin') || has(me, 'sa') || has(me, 'osa');
export const myTeamIds = (me, teams) => (seesAll(me) ? teams.map((t) => t.id) : me.teamIds || []);
export const canEditAudits = (me) => has(me, 'member') || has(me, 'atl') || has(me, 'sa');
// Auditor work (findings, AOMs, comments, SAOR, BAAR, printing): not Team Staff or OSA Staff.
export const canWork = (me) => has(me, 'member') || has(me, 'atl') || has(me, 'sa') || has(me, 'admin');
// Team Staff encode only the Setup, the officials and the trial balance.
export const staffOnly = (me) => has(me, 'staff') && !canWork(me);
export const canEditSetup = (me) => canEditAudits(me) || has(me, 'staff');
// OSA Staff: view and print only.
export const viewOnly = (me) => !!me && !canWork(me) && !has(me, 'staff');
// What this person may save on this device (the server applies the same rules). Returns the reason when not allowed.
export function writeBlock(me, table, data) {
  if (!me || canWork(me)) return '';
  if (table === 'auditlog') return '';
  if (staffOnly(me) && (table === 'audits' || (table === 'letters' && data && ['tb', 'raomap'].includes(data.type)))) return '';
  return staffOnly(me) ? 'Team Staff can encode the Setup, the officials and the trial balance only.' : 'OSA Staff can view and print only.';
}
