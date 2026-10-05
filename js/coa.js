// Chart of Accounts: the official accounts (data-coa.json) plus the accounts added by the team (Admin and SA),
// the statement line each account goes to, and the matching of a trial balance row to an account.
import { store } from './store.js';

export const COA_ID = 'coa-added';

// The lines of the financial statements (Balligui form), with their Note numbers.
// side: 'dr' lines are debit balances (assets, expenses); 'cr' lines are credit balances.
export const LINES = [
  { k: 'rev_tax', st: 'perf', cls: 'Revenue', label: 'Tax Revenue', note: 3, side: 'cr' },
  { k: 'rev_ira', st: 'perf', cls: 'Revenue', label: 'Share from Internal Revenue Collections', note: 4, side: 'cr' },
  { k: 'rev_svc', st: 'perf', cls: 'Revenue', label: 'Service and Business Revenue', note: 5, side: 'cr' },
  { k: 'rev_misc', st: 'perf', cls: 'Revenue', label: 'Miscellaneous Income', note: 6, side: 'cr' },
  { k: 'rev_grant', st: 'perf', cls: 'Revenue', label: 'Grants and Donations', note: 7, side: 'cr' },
  { k: 'exp_ps', st: 'perf', cls: 'Expenses', label: 'Personnel Services', note: 8, side: 'dr' },
  { k: 'exp_mooe', st: 'perf', cls: 'Expenses', label: 'Maintenance and Other Operating Expenses', note: 9, side: 'dr' },
  { k: 'exp_fin', st: 'perf', cls: 'Expenses', label: 'Financial Expenses', note: 0, side: 'dr', opt: true },
  { k: 'exp_nc', st: 'perf', cls: 'Expenses', label: 'Non-Cash Expenses', note: 10, side: 'dr' },
  { k: 'tr_from', st: 'perf', cls: 'Revenue', label: 'Transfers, Assistance and Subsidy From', note: 11, side: 'cr' },
  { k: 'tr_to', st: 'perf', cls: 'Expenses', label: 'Transfers, Assistance and Subsidy To', note: 12, side: 'dr' },
  { k: 'cash', st: 'pos', cls: 'Assets', label: 'Cash and Cash Equivalents', note: 13, side: 'dr', cur: true },
  { k: 'invest', st: 'pos', cls: 'Assets', label: 'Investments', note: 0, side: 'dr', cur: true, opt: true },
  { k: 'recv', st: 'pos', cls: 'Assets', label: 'Receivables', note: 14, side: 'dr', cur: true },
  { k: 'inv', st: 'pos', cls: 'Assets', label: 'Inventories', note: 15, side: 'dr', cur: true },
  { k: 'prepay', st: 'pos', cls: 'Assets', label: 'Prepayments and Deferred Charges', note: 0, side: 'dr', cur: true, opt: true },
  { k: 'invprop', st: 'pos', cls: 'Assets', label: 'Investment Property', note: 0, side: 'dr', opt: true },
  { k: 'ppe', st: 'pos', cls: 'Assets', label: 'Property, Plant and Equipment', note: 16, side: 'dr' },
  { k: 'bio', st: 'pos', cls: 'Assets', label: 'Biological Assets', note: 17, side: 'dr' },
  { k: 'finl', st: 'pos', cls: 'Liabilities', label: 'Financial Liabilities', note: 18, side: 'cr', cur: true },
  { k: 'inter', st: 'pos', cls: 'Liabilities', label: 'Inter-Agency Payables', note: 19, side: 'cr', cur: true },
  { k: 'intra', st: 'pos', cls: 'Liabilities', label: 'Intra-Agency Payables', note: 20, side: 'cr', cur: true },
  { k: 'trust', st: 'pos', cls: 'Liabilities', label: 'Trust Liabilities', note: 21, side: 'cr', cur: true },
  { k: 'othpay', st: 'pos', cls: 'Liabilities', label: 'Other Payables', note: 0, side: 'cr', cur: true, opt: true },
  { k: 'eq', st: 'pos', cls: 'Equity', label: 'Government Equity', note: 0, side: 'cr' },
  { k: 'eq_ppa', st: 'pos', cls: 'Equity', label: "Prior Years' Adjustments", note: 0, side: 'cr' }
];
export const LINE = Object.fromEntries(LINES.map((l) => [l.k, l]));

// The line an official account goes to, from its code.
export function officialLine(code) {
  const c = String(code);
  const p = (x) => c.startsWith(x);
  if (p('1-01')) return 'cash'; if (p('1-02')) return 'invest'; if (p('1-03')) return 'recv'; if (p('1-04')) return 'inv';
  if (p('1-05')) return 'prepay'; if (p('1-06')) return 'invprop'; if (p('1-07')) return 'ppe'; if (p('1-08')) return 'bio';
  if (p('2-01')) return 'finl'; if (p('2-02')) return 'inter'; if (p('2-03')) return 'trust'; if (p('2-')) return 'othpay';
  if (c === '3-01-01-020') return 'eq_ppa'; if (p('3-')) return 'eq';
  if (c === '4-01-04-010') return 'rev_ira'; if (p('4-01-06')) return 'rev_svc'; if (p('4-01')) return 'rev_tax';
  if (p('4-02')) return 'tr_from'; if (p('4-03-02')) return 'rev_grant'; if (p('4-04')) return 'rev_svc'; if (p('4-')) return 'rev_misc';
  if (p('5-01')) return 'exp_ps'; if (p('5-02-10')) return 'tr_to'; if (p('5-02')) return 'exp_mooe'; if (p('5-03')) return 'exp_fin'; if (p('5-04')) return 'exp_nc';
  return '';
}

let official = null;
async function loadOfficial() {
  if (official) return official;
  const res = await fetch('data-coa.json');
  if (!res.ok) throw new Error('The Chart of Accounts could not be loaded. Open the app online once so it is saved for offline use.');
  official = (await res.json()).map((a) => ({ ...a, line: officialLine(a.code), official: true }));
  return official;
}
export async function loadAdded() {
  const r = await store.get('letters', COA_ID);
  return r && !r.deleted && Array.isArray(r.data.list) ? r.data.list : [];
}
// The whole chart: official accounts, then the added ones. Also { byCode } for lookups.
export async function loadChart() {
  const off = await loadOfficial();
  const added = (await loadAdded()).map((a) => ({ ...a, cls: (LINE[a.line] || {}).cls || a.cls || '', group: (LINE[a.line] || {}).label || '', official: false }));
  const list = [...off, ...added].sort((a, b) => a.code.localeCompare(b.code));
  const byCode = Object.fromEntries(list.map((a) => [a.code, a]));
  list.forEach((a) => { a.n = normTitle(a.title); });
  return { list, byCode, added };
}
export const validCode = (c) => /^\d-\d{2}-\d{2}-\d{3}(-\d{1,3})?$/.test(String(c || '').trim());

/* ── Matching a trial balance row to an account ── */
const ABBR = { equip: 'equipment', eqpt: 'equipment', tech: 'technology', ict: 'information communication technology', ppe: 'property plant equipment',
  machineries: 'machinery', machinerie: 'machinery', furnitures: 'furniture', lgu: 'local government unit', lgus: 'local government unit', ad: 'accumulated depreciation',
  accum: 'accumulated', depn: 'depreciation', dep: 'depreciation', bldg: 'building', bldgs: 'building', govt: 'government', exp: 'expense', expenses: 'expense', rm: 'repair maintenance' };
const STOP = new Set(['and', 'of', 'the', 'for', 'to', 'in', 'on', 'a', 'an', 'from', 'with']);
const single = (w) => (w.length > 3 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && /(xes|sses|ches)$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
export function normTitle(t) {
  const words = String(t || '').toLowerCase().replace(/&/g, ' and ').replace(/['’]s\b/g, '').replace(/['’]/g, '').replace(/[^a-z0-9%]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const out = [];
  words.forEach((w) => { (ABBR[w] || w).split(' ').forEach((x) => { const s = single(x); if (!STOP.has(s) && !STOP.has(x)) out.push(s); }); });
  return out;
}
function lev1(a, b) {          // true when a and b differ by at most one letter (for typing slips like "Susidy")
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 5) return false;
  let i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++d > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return d + (a.length - i) + (b.length - j) <= 1;
}
export function similar(x, y) {
  if (!x.length || !y.length) return 0;
  const used = new Array(y.length).fill(false);
  let m = 0;
  x.forEach((w) => { const i = y.findIndex((v, k) => !used[k] && lev1(w, v)); if (i >= 0) { used[i] = true; m++; } });
  return (2 * m) / (x.length + y.length);
}
const bestBy = (n, list, skip) => {
  let best = null;
  list.forEach((a) => { if (a.code === skip) return; const s = similar(n, a.n); if (!best || s > best.s) best = { a, s }; });
  return best;
};

/**
 * Matches one row: { code, title } → { st: 'ok'|'check'|'none', acct (the code's account), sugg (the title's account), score }.
 * ok: the code is in the chart and the title agrees (or no other account fits the title better).
 * check: the code belongs to an account other than the title says, or the code is not in the chart but the title is.
 * none: neither the code nor the title is in the chart.
 */
export function matchRow(row, chart) {
  const n = normTitle(row.title);
  const acct = chart.byCode[String(row.code || '').trim()] || null;
  const best = bestBy(n, chart.list, acct ? acct.code : null);
  if (acct) {
    const s = similar(n, acct.n);
    if (best && best.s >= 0.8 && best.s > s + 0.15) return { st: 'check', acct, sugg: best.a, score: s };
    return { st: 'ok', acct, score: s };
  }
  if (best && best.s >= 0.8) return { st: 'check', acct: null, sugg: best.a, score: best.s };
  return { st: 'none', acct: null, sugg: best && best.s >= 0.5 ? best.a : null, score: best ? best.s : 0 };
}
export const rowKey = (row) => `${String(row.code || '').trim()}|${normTitle(row.title).join(' ')}`;
