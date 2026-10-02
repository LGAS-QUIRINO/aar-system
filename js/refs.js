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
export const seesAll = (me) => has(me, 'admin') || has(me, 'sa');
export const myTeamIds = (me, teams) => (seesAll(me) ? teams.map((t) => t.id) : me.teamIds || []);
export const canEditAudits = (me) => has(me, 'member') || has(me, 'atl') || has(me, 'sa');
