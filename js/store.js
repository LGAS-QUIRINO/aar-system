// Records on this device. Every Save goes here first, then waits in the outbox until it reaches the server.
import { db } from './db.js';

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const emitChange = (src) => listeners.forEach((fn) => fn(src));

export const newId = (prefix) => prefix + '-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export const store = {
  policy: null,      // set at sign-in: (table, data) => reason this person may not save it, or ''
  async get(table, id) { return db.get('records', [table, id]); },
  async list(table, { withDeleted = false } = {}) {
    const all = await db.all('records', table);
    return withDeleted ? all : all.filter((r) => !r.deleted);
  },
  async save(table, id, data, { deleted = false, silent = false } = {}) {
    const why = this.policy ? this.policy(table, data) : '';
    if (why) { window.dispatchEvent(new CustomEvent('save-blocked', { detail: why })); throw new Error(why); }
    const cur = await db.get('records', [table, id]);
    const queued = await db.get('outbox', [table, id]);
    const baseVersion = queued ? queued.baseVersion : cur ? cur.version : 0;
    const queuedAt = new Date().toISOString();
    await db.put('outbox', { table, id, baseVersion, data, deleted, queuedAt });
    const rec = { table, id, version: cur ? cur.version : 0, updatedAt: queuedAt, updatedBy: cur ? cur.updatedBy : '', deleted,
      scope: cur ? cur.scope : '', data, pending: true };
    await db.put('records', rec);
    if (!silent) emitChange('local');
    window.dispatchEvent(new Event('outbox-changed'));
    return rec;
  },
  async pendingCount() { return (await db.all('outbox')).length; },
  async log(action, detail, teamId = '', by = '') {
    const at = new Date().toISOString();
    return this.save('auditlog', newId('log'), { at, by, action, detail, teamId }, { silent: true });
  },
  async wipe() { await db.clear('records'); await db.clear('outbox'); await db.del('meta', 'lastSync'); await db.del('meta', 'me'); }
};
