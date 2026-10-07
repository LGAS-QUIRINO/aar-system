// Sync: send the outbox, then fetch what changed since the last sync.
// The first save to reach the server wins; a later save based on an older copy is reported as a conflict.
import { CONFIG } from './config.js';
import { db } from './db.js';
import { call } from './api.js';
import { emitChange } from './store.js';
import { auth } from './auth.js';

// A short fingerprint of a save, to recognize it again when it comes back from the server.
const fp = (data, deleted) => {
  const s = JSON.stringify({ d: data === undefined ? null : data, x: !!deleted });
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36) + ':' + s.length;
};
// Changes set aside (could not be saved) that the person has not yet restored or discarded.
export async function setAside() { return ((await db.get('meta', 'rejected')) || []).filter((x) => !x.done); }
export async function resolveSetAside(at, how) {
  const kept = (await db.get('meta', 'rejected')) || [];
  kept.forEach((x) => { if (x.at === at) { x.done = how; x.doneAt = new Date().toISOString(); } });
  await db.put('meta', kept.slice(-50), 'rejected');
  publish({ aside: kept.filter((x) => !x.done).length });
}

let running = null, timer = null;
export const syncState = { status: 'idle', lastSync: null, pending: 0, message: '', aside: 0 };
let fails = 0;            // sync rounds in a row that could not reach the server

function publish(patch) {
  Object.assign(syncState, patch);
  window.dispatchEvent(new CustomEvent('sync-status', { detail: { ...syncState } }));
}

async function refreshPending() { publish({ pending: (await db.all('outbox')).length }); }

async function doSync() {
  await refreshPending();
  if (!navigator.onLine) { publish({ status: 'offline', message: '' }); return; }
  publish({ status: 'syncing', message: '' });
  let changed = false;
  const problems = [];

  const outbox = await db.all('outbox');
  let again = false;
  if (outbox.length) {
    // Remember what is being sent. If the server saves it but its reply is lost, the next send is refused
    // as "already changed"; the fingerprint shows that the newer copy on the server is this very save.
    const inflight = (await db.get('meta', 'inflight')) || {};
    outbox.forEach((o) => { const k = o.table + '|' + o.id; inflight[k] = [...(inflight[k] || []), { base: o.baseVersion, h: fp(o.data, o.deleted) }].slice(-6); });
    await db.put('meta', inflight, 'inflight');
    const me = String(auth.email || '').toLowerCase();
    const res = await call('push', { changes: outbox.map(({ table, id, baseVersion, data, deleted }) => ({ table, id, baseVersion, data, deleted })) });
    for (const r of res.results) {
      const sent = outbox.find((o) => o.table === r.table && o.id === r.id);
      const still = await db.get('outbox', [r.table, r.id]);
      const untouched = still && sent && still.queuedAt === sent.queuedAt;
      const key = r.table + '|' + r.id;
      // Our own earlier save that reached the server although its reply was lost.
      const own = r.status === 'conflict' && r.record && String(r.record.updatedBy || '').toLowerCase() === me
        && (inflight[key] || []).some((x) => r.record.version === Number(x.base || 0) + 1 && x.h === fp(r.record.data, r.record.deleted));
      if (r.status === 'ok' || own) delete inflight[key];
      if (own) {
        if (!still || fp(still.data, still.deleted) === fp(r.record.data, r.record.deleted)) {
          if (still) await db.del('outbox', [r.table, r.id]);          // the server already has exactly this
          await db.put('records', { table: r.table, ...r.record, pending: false });
          changed = true;
        } else {
          // More was typed after that save: send the newest copy on top of it.
          still.baseVersion = r.record.version; await db.put('outbox', still);
          const local = await db.get('records', [r.table, r.id]);
          if (local) await db.put('records', { ...local, version: r.record.version });
          again = true;
        }
        continue;
      }
      if (r.status === 'ok') {
        if (untouched) { await db.del('outbox', [r.table, r.id]); await db.put('records', { table: r.table, ...r.record, pending: false }); }
        else if (still) { still.baseVersion = r.record.version; await db.put('outbox', still); }
        continue;            // our own change reached the server: nothing new to show on screen
      } else {
        // Keep a copy of the change that could not be saved, so nothing typed is lost.
        const kept = (await db.get('meta', 'rejected')) || [];
        // A conflict keeps the newest copy typed on this device (it would only be refused again if left in the outbox).
        const mine = r.status === 'conflict' && still ? still : sent;
        kept.push({ ...mine, status: r.status, error: r.error || '', by: r.record ? r.record.updatedBy : '', at: new Date().toISOString() });
        await db.put('meta', kept.slice(-50), 'rejected');
        if (untouched || (r.status === 'conflict' && still)) { await db.del('outbox', [r.table, r.id]); delete inflight[key]; }
        if (r.record) await db.put('records', { table: r.table, ...r.record, pending: false });
        else if (r.status === 'conflict' || r.status === 'error') {
          const local = await db.get('records', [r.table, r.id]);
          if (local && local.version === 0) await db.del('records', [r.table, r.id]);
        }
        problems.push(r.status === 'conflict' ? `${r.record && r.record.updatedBy ? r.record.updatedBy : 'Someone else'} saved this first. Your copy was set aside: see Not Saved below.` : r.error);
      }
      changed = true;
    }
    await db.put('meta', inflight, 'inflight');
  }

  const last = await db.get('meta', 'lastSync');
  const res = await call('pull', { since: last || '' });
  const queued = new Set((await db.all('outbox')).map((o) => o.table + '|' + o.id));
  for (const [table, recs] of Object.entries(res.records)) {
    for (const rec of recs) {
      if (queued.has(table + '|' + rec.id)) continue;         // local unsaved-to-server change wins until it is pushed
      const local = await db.get('records', [table, rec.id]);
      if (local && !local.pending && local.version === rec.version) continue;   // already have this copy (often our own save)
      await db.put('records', { table, ...rec, pending: false });
      changed = true;
    }
  }
  // Once a day: drop records this device still has but the server no longer has (rows deleted directly in the
  // Google Sheet never reach a device as a change, so without this they would stay on screen).
  const lastFull = await db.get('meta', 'lastFullCheck');
  if (!last) await db.put('meta', new Date().toISOString(), 'lastFullCheck');   // this sync already downloaded everything
  else if (!lastFull || Date.now() - new Date(lastFull).getTime() > 24 * 3600e3) {
    const all = await call('pull', { since: '' });
    const pend = new Set((await db.all('outbox')).map((o) => o.table + '|' + o.id));
    for (const [table, recs] of Object.entries(all.records)) {
      const onServer = new Set(recs.map((r) => r.id));
      for (const local of await db.all('records', table)) {
        if (onServer.has(local.id) || local.pending || pend.has(table + '|' + local.id)) continue;
        await db.del('records', [table, local.id]);
        changed = true;
      }
    }
    await db.put('meta', new Date().toISOString(), 'lastFullCheck');
  }
  // Step back a few seconds so a save landing during this pull is not missed.
  const since = new Date(new Date(res.serverTime).getTime() - 5000).toISOString();
  await db.put('meta', since, 'lastSync');
  await db.put('meta', new Date().toISOString(), 'lastSyncLocal');
  if (changed) emitChange('sync');
  await refreshPending();
  fails = 0;
  publish({ status: problems.length ? 'error' : 'synced', lastSync: new Date().toISOString(), message: problems[0] || '', aside: (await setAside()).length });
  if (again) setTimeout(syncNow, 1500);
  return problems;
}

export function syncNow() {
  if (!running) {
    running = doSync().catch((e) => {
      const m = String(e.message || e);
      if (m === 'SIGNIN_NEEDED') publish({ status: 'signin', message: 'Sign in again to sync. Your work is safe on this device.' });
      else if (m === 'OFFLINE' || !navigator.onLine || /Failed to fetch|NetworkError/i.test(m)) publish({ status: 'offline', message: '' });
      else {
        // One missed round is usually Google being busy: say it is retrying; report a problem when it keeps failing.
        fails++;
        const busy = /^Server error (404|408|429|5\d\d)$|Lock timeout|too many times|timed out|not valid JSON|Unexpected token/i.test(m);
        publish(busy && fails < 3 ? { status: 'retry', message: '' } : { status: 'error', message: busy ? 'The server did not answer. Your work is saved on this device and will be sent automatically.' : m });
      }
      return [m];
    }).finally(() => { running = null; });
  }
  return running;
}

export async function startSync() {
  publish({ lastSync: await db.get('meta', 'lastSyncLocal'), aside: (await setAside()).length });
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => publish({ status: 'offline' }));
  window.addEventListener('outbox-changed', () => { refreshPending(); clearTimeout(timer); timer = setTimeout(syncNow, 800); });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, CONFIG.SYNC_EVERY_MS);
  return syncNow();
}
