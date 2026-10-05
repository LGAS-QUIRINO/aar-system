// Part 06 · Audited Financial Statements: the trial balances (FS Input) and the five statements built from them.
// Amounts are kept in centavos (whole numbers) so totals never drift.
import { store } from './store.js';
import { LINE, matchRow } from './coa.js';
import { FUND_NAMES } from './format.js';

export const tbId = (lguId, fund, year) => `tb-${lguId}-${fund}-${year}`;
export const fsId = (lguId, year) => `fs-${lguId}-${year}`;

// The funds of a barangay (LGU Master List), General Fund first.
export function fundsOf(lgu) {
  const codes = (lgu.funds && lgu.funds.length ? lgu.funds : ['GF', 'BDRRMF']);
  const custom = Object.fromEntries((lgu.customFunds || []).map((f) => [f.code, f.name]));
  return [...new Set(['GF', ...codes])].map((k) => ({ k, label: FUND_NAMES[k] || custom[k] || k }));
}

/* ── Numbers ── */
// Rounded half up to the centavo, as Excel shows it (37,732.645 → 37,732.65, not the 37,732.64 a plain float rounding gives).
export const cents = (v) => {
  const n = typeof v === 'number' ? v : parseAmt(v);
  if (n === null || n === undefined || isNaN(n)) return 0;
  const x = Number((Math.abs(n) * 100).toPrecision(15));
  return Math.sign(n) * Math.round(x);
};
export const hasDec = (v) => { if (typeof v !== 'number') return false; const x = Number((v * 100).toPrecision(15)); return Math.abs(x - Math.round(x)) > 1e-6; };
// "1,234.50", "(1,234.50)", "-1234.5", "₱ 1,234", "-" → number (or null when blank)
export function parseAmt(s) {
  if (typeof s === 'number') return s;
  let t = String(s ?? '').replace(/[₱P\s,]/g, '').trim();
  if (!t || t === '-' || t === '–') return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  const n = Number(t);
  return isNaN(n) ? NaN : neg ? -n : n;
}
// 123456 (centavos) → "1,234.56"; negatives in parentheses; zero → "-"
export function money(c, { dash = '-', paren = true } = {}) {
  if (!c) return dash;
  const s = (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return c < 0 ? (paren ? `(${s})` : '-' + s) : s;
}
export const shown = (v) => (v === null || v === undefined ? '' : (cents(v) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const rawText = (v) => (v === null || v === undefined ? '' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }));

/* ── Loading ── */
export async function loadTb(lguId, fund, year) {
  const r = await store.get('letters', tbId(lguId, fund, year));
  return r && !r.deleted ? r.data : null;
}
export async function loadFsRec(lguId, year) {
  const r = await store.get('letters', fsId(lguId, year));
  return r && !r.deleted ? r.data : null;
}
// Remembered choices for this barangay from every trial balance saved before: { rowKey: accountCode }.
export async function rememberedChoices(lguId) {
  const out = {};
  (await store.list('letters')).filter((l) => l.data.type === 'tb' && l.data.lguId === lguId).forEach((l) => {
    (l.data.rows || []).forEach((r) => { if (r.use && r.key) out[r.key] = r.use; });
  });
  return out;
}

/* ── One trial balance row ── */
// The row's amounts as used: a chosen amount for a row with more than 2 decimals, otherwise the amount shown (rounded).
export const decSide = (r) => (hasDec(r.dr) ? 'dr' : hasDec(r.cr) ? 'cr' : null);
export function rowCents(r) {
  const side = decSide(r), f = r.fix !== undefined && r.fix !== null && side;
  return { dr: f && side === 'dr' ? cents(r.fix) : cents(r.dr), cr: f && side === 'cr' ? cents(r.fix) : cents(r.cr) };
}
export const needsFix = (r) => (hasDec(r.dr) || hasDec(r.cr)) && (r.fix === undefined || r.fix === null);
// Resolves the account of a row: { m (the match), acct (the account used, or null), open (true while a choice is still needed) }.
export function resolveRow(r, chart) {
  const m = matchRow(r, chart);
  if (r.use) { const a = chart.byCode[r.use]; return { m, acct: a || null, open: !a }; }
  if (m.st === 'ok') return { m, acct: m.acct, open: false };
  return { m, acct: null, open: true };
}

// The state of one trial balance: totals, what is left to fix, and the amounts by line and by account.
export function tbState(tb, chart) {
  const out = { rows: [], dr: 0, cr: 0, open: 0, dec: 0, decOpen: 0, check: 0, none: 0, ok: 0, lines: {}, accts: {}, revexp: false, fix: 0, balanced: true };
  if (!tb || !tb.rows) return out;
  tb.rows.forEach((r, i) => {
    const res = resolveRow(r, chart);
    const c = rowCents(r);
    out.dr += c.dr; out.cr += c.cr;
    out[res.m.st]++;
    if (res.open) out.open++;
    if (hasDec(r.dr) || hasDec(r.cr)) { out.dec++; if (needsFix(r)) out.decOpen++; }
    const acct = res.acct || (res.m.acct && res.m.st !== 'none' ? res.m.acct : null);
    if (acct && acct.line && LINE[acct.line]) {
      const v = LINE[acct.line].side === 'dr' ? c.dr - c.cr : c.cr - c.dr;
      out.lines[acct.line] = (out.lines[acct.line] || 0) + v;
      out.accts[acct.code] = (out.accts[acct.code] || 0) + v;
      if (/^[45]/.test(acct.code) || ['Revenue', 'Expenses'].includes(acct.cls)) out.revexp = true;
    }
    out.rows.push({ i, r, res, c });
  });
  out.balanced = out.dr === out.cr;
  out.fix = out.open + out.decOpen;
  return out;
}

// The heading of an imported file checked against the barangay and the year.
export function headingCheck(tb, lguName, year) {
  const h = (tb && tb.file && tb.file.heading || []).join(' ').toUpperCase();
  if (!h) return { known: false };
  const name = String(lguName || '').toUpperCase();
  const okName = name && h.includes(name);
  const okYear = h.includes(String(year));
  const pre = /PRE[\s-]*CLOSING/.test(h), post = /POST[\s-]*CLOSING/.test(h);
  return { known: true, okName, okYear, pre, post, text: (tb.file.heading || []).join(' · ') };
}

/* ── One year, all funds combined ── */
// tbs: { fund: tbData|null }. Accounts marked "between funds" are left out once every fund is entered.
export function yearFigures(tbs, funds, chart) {
  const st = {}, lines = {}, accts = {}, inter = {};
  const entered = funds.filter((f) => tbs[f.k] && (tbs[f.k].none || (tbs[f.k].rows || []).length));
  const all = entered.length === funds.length;
  // Transfers between funds cancel out only when more than one fund has its own trial balance.
  const kept = funds.filter((f) => tbs[f.k] && !tbs[f.k].none && (tbs[f.k].rows || []).length).length;
  const cancel = all && kept > 1;
  funds.forEach((f) => {
    const tb = tbs[f.k];
    if (!tb || tb.none) return;
    const s = st[f.k] = tbState(tb, chart);
    inter[f.k] = { from: 0, to: 0 };
    s.rows.forEach(({ res, c }) => {
      const a = res.acct || (res.m.st !== 'none' ? res.m.acct : null);
      if (!a || !a.interfund) return;
      if (LINE[a.line] && LINE[a.line].side === 'cr') inter[f.k].from += c.cr - c.dr; else inter[f.k].to += c.dr - c.cr;
    });
  });
  Object.entries(st).forEach(([fk, s]) => {
    s.rows.forEach(({ res, c }) => {
      const a = res.acct || (res.m.st !== 'none' ? res.m.acct : null);
      if (!a || !LINE[a.line]) return;
      if (a.interfund && cancel) return;
      const v = LINE[a.line].side === 'dr' ? c.dr - c.cr : c.cr - c.dr;
      lines[a.line] = (lines[a.line] || 0) + v;
      accts[a.code] = (accts[a.code] || 0) + v;
    });
  });
  const interTo = Object.values(inter).reduce((x, v) => x + v.to, 0), interFrom = Object.values(inter).reduce((x, v) => x + v.from, 0);
  return { st, lines, accts, entered: entered.map((f) => f.k), all, cancel, any: kept > 0, inter, interTo, interFrom, eliminated: cancel ? interTo + interFrom : 0 };
}

/* ── The statements ── */
const L = (fig, k) => (fig && fig.lines[k]) || 0;
const sum = (fig, ks) => ks.reduce((x, k) => x + L(fig, k), 0);
export function perfTotals(fig) {
  const rev = sum(fig, ['rev_tax', 'rev_ira', 'rev_svc', 'rev_misc', 'rev_grant']);
  const opx = sum(fig, ['exp_ps', 'exp_mooe', 'exp_fin', 'exp_nc']);
  const cur = rev - opx;
  const surplus = cur + L(fig, 'tr_from') - L(fig, 'tr_to');
  return { rev, opx, cur, surplus };
}
export function posTotals(fig) {
  const ca = sum(fig, ['cash', 'invest', 'recv', 'inv', 'prepay']);
  const nca = sum(fig, ['invprop', 'ppe', 'bio']);
  const cl = sum(fig, ['finl', 'inter', 'intra', 'trust', 'othpay']);
  const ncl = 0;
  const p = perfTotals(fig);
  const eq = L(fig, 'eq') + L(fig, 'eq_ppa') + p.surplus;
  return { ca, nca, ta: ca + nca, cl, ncl, tl: cl + ncl, eq, tle: cl + ncl + eq };
}
// A statement: { title, period, cols: [y, y-1], rows: [{ t, k: 'h'|'sub'|'row'|'tot'|'grand'|'blank', note, v: [a, b], cur, ind }] }
const shows = (figs, k) => figs.some((f) => L(f, k));
export function buildPerf(fy, fp, y) {
  const F = [fy, fp], v = (k) => F.map((f) => (f ? L(f, k) : null));
  const t = F.map((f) => (f ? perfTotals(f) : null));
  const line = (k, ind = 1) => ({ k: 'row', t: LINE[k].label, note: LINE[k].note, v: v(k), ind });
  const rows = [{ k: 'h', t: 'Revenue' }, { ...line('rev_tax'), cur: true }, line('rev_ira'), line('rev_svc'), line('rev_misc'), line('rev_grant'),
    { k: 'tot', t: 'Total Revenue', v: t.map((x) => x && x.rev), cur: true }, { k: 'blank' },
    { k: 'h', t: 'Less: Current Operating Expenses' }, line('exp_ps'), line('exp_mooe')];
  if (shows(F, 'exp_fin')) rows.push(line('exp_fin'));
  rows.push(line('exp_nc'), { k: 'tot', t: 'Current Operating Expenses', v: t.map((x) => x && x.opx) }, { k: 'blank' },
    { k: 'grand1', t: 'Surplus (Deficit) from Current Operation', v: t.map((x) => x && x.cur), cur: true },
    { k: 'h', t: 'Add (Deduct):', plain: true },
    { k: 'row', t: 'Transfers, Assistance and Subsidy From', note: 11, v: v('tr_from'), ind: 2 },
    { k: 'row', t: 'Transfers, Assistance and Subsidy To', note: 12, v: F.map((f) => (f ? -L(f, 'tr_to') : null)), ind: 2 },
    { k: 'grand', t: 'Surplus (Deficit) for the period', v: t.map((x) => x && x.surplus), cur: true });
  return { key: 'sfperf', title: 'Statement of Financial Performance', period: `For the Year Ended December 31, ${y}`, cmp: `(With Comparative Figures for CY ${y - 1})`, cols: [y, y - 1], note: true, rows };
}
export function buildPos(fy, fp, y) {
  const F = [fy, fp], v = (k) => F.map((f) => (f ? L(f, k) : null));
  const t = F.map((f) => (f ? posTotals(f) : null));
  const line = (k, cur) => ({ k: 'row', t: LINE[k].label, note: LINE[k].note, v: v(k), ind: 2, cur });
  const opt = (k) => (shows(F, k) ? [line(k)] : []);
  const rows = [{ k: 'h', t: 'ASSETS' }, { k: 'sub', t: 'Current Assets' }, line('cash', true), ...opt('invest'), line('recv'), line('inv'), ...opt('prepay'),
    { k: 'tot', t: 'Total Current Assets', v: t.map((x) => x && x.ca), cur: true, ind: 2 }, { k: 'blank' },
    { k: 'sub', t: 'Non-Current Assets' }, ...opt('invprop'), line('ppe'), line('bio'),
    { k: 'tot', t: 'Total Non-Current Assets', v: t.map((x) => x && x.nca), ind: 2 }, { k: 'blank' },
    { k: 'grand', t: 'Total Assets', v: t.map((x) => x && x.ta), cur: true }, { k: 'blank' },
    { k: 'h', t: 'LIABILITIES' }, { k: 'sub', t: 'Current Liabilities' }, line('finl', true), line('inter'), line('intra'), line('trust'), ...opt('othpay'),
    { k: 'tot', t: 'Total Current Liabilities', v: t.map((x) => x && x.cl), cur: true, ind: 2 }, { k: 'blank' },
    { k: 'tot', t: 'Total Non-Current Liabilities', v: t.map((x) => x && x.ncl), ind: 2 }, { k: 'blank' },
    { k: 'tot', t: 'Total Liabilities', v: t.map((x) => x && x.tl) }, { k: 'blank' },
    { k: 'h', t: 'NET ASSETS/EQUITY' }, { k: 'row', t: 'Government Equity', v: t.map((x) => x && x.eq), ind: 2 }, { k: 'blank' },
    { k: 'grand', t: 'Total Liabilities and Net Assets/Equity', v: t.map((x) => x && x.tle), cur: true }];
  return { key: 'sfpos', title: 'Statement of Financial Position', period: `As at December 31, ${y}`, cmp: `(With Comparative Figures for CY ${y - 1})`, cols: [y, y - 1], note: true, rows };
}
export function equityMoves(fig) {
  if (!fig) return null;
  const jan1 = L(fig, 'eq'), ppa = L(fig, 'eq_ppa'), restated = jan1 + ppa, sur = perfTotals(fig).surplus;
  return { jan1, ppa, restated, sur, dec31: restated + sur };
}
export function buildScne(fy, fp, y) {
  const m = [equityMoves(fy), equityMoves(fp)], v = (k) => m.map((x) => (x ? x[k] : null));
  const rows = [{ k: 'row', t: 'Balance at January 1', v: v('jan1'), cur: true, ind: 0 }, { k: 'h', t: 'Add (Deduct):', plain: true },
    { k: 'row', t: 'Change in Accounting Policy', v: m.map((x) => (x ? 0 : null)), ind: 1 },
    { k: 'row', t: 'Prior Period Errors/Adjustments', v: v('ppa'), ind: 1 },
    { k: 'tot', t: 'Restated Balance', v: v('restated'), cur: true, ind: 0 },
    { k: 'h', t: 'Add (Deduct) Changes in net assets/equity during the year', plain: true },
    { k: 'row', t: 'Adjustment of net revenue recognized directly in net assets/equity', v: m.map((x) => (x ? 0 : null)), ind: 1 },
    { k: 'row', t: 'Surplus (deficit) for the period', v: v('sur'), ind: 1 },
    { k: 'tot', t: 'Total recognized revenue and expenses for the period', v: v('sur'), ind: 1 },
    { k: 'grand', t: 'Balance at December 31', v: v('dec31'), cur: true, ind: 0 }];
  return { key: 'scne', title: 'Statement of Changes in Net Assets/Equity', period: `For the Year Ended December 31, ${y}`, cmp: `(With Comparative Figures for CY ${y - 1})`, cols: [y, y - 1], colHead: 'Accumulated Surpluses/(Deficits)', rows };
}

/* ── Cash flows (Balligui lines). in: true for inflows. from: the line a starting figure comes from. ── */
export const SCF = [
  { h: 'Cash Flows from Operating Activities' }, { h2: 'Cash Inflows' },
  { k: 'op_tax', t: 'Collection from taxpayers', in: true }, { k: 'op_ira', t: 'Share from Internal Revenue Allotment', in: true, from: 'rev_ira' },
  { k: 'op_svc', t: 'Receipts from business/service income', in: true }, { k: 'op_oth', t: 'Other Receipts', in: true },
  { tot: 'opIn', t: 'Total Cash Inflows' }, { h2: 'Cash Outflows' },
  { k: 'op_exp', t: 'Payment of expenses' }, { k: 'op_sup', t: 'Payments to suppliers and creditors' },
  { k: 'op_emp', t: 'Payments to employees', from: 'exp_ps' }, { k: 'op_othx', t: 'Other Expenses', from: 'exp_mooe' },
  { tot: 'opOut', t: 'Total Cash Outflows' }, { net: 'op', t: 'Net Cash Flows from Operating Activities' },
  { h: 'Cash Flows from Investing Activities' }, { h2: 'Cash Inflows' },
  { k: 'in_ppe', t: 'Proceeds from Sale/Disposal of Property, Plant and Equipment', in: true }, { tot: 'inIn', t: 'Total Cash Inflows' },
  { h2: 'Cash Outflows' }, { k: 'in_buy', t: 'Purchase/Construction of Property, Plant and Equipment' }, { k: 'in_oth', t: 'Other Outflows' },
  { tot: 'inOut', t: 'Total Cash Outflows' }, { net: 'in', t: 'Net Cash Flows from Investing Activities' },
  { h: 'Cash Flows from Financing Activities' }, { h2: 'Cash Inflows' },
  { k: 'fi_loan', t: 'Proceeds from Loans', in: true }, { tot: 'fiIn', t: 'Total Cash Inflows' },
  { h2: 'Cash Outflows' }, { k: 'fi_debt', t: 'Retirement/Redemption of debt securities' }, { k: 'fi_lt', t: 'Payment of Long-Term Liabilities' },
  { k: 'fi_amort', t: 'Payment of Loan Amortization' }, { k: 'fi_oth', t: 'Other Outflows' },
  { tot: 'fiOut', t: 'Total Cash Outflows' }, { net: 'fi', t: 'Net Cash Flows from Financing Activities' }
];
const SEC = { op: ['op_tax', 'op_ira', 'op_svc', 'op_oth'], opOut: ['op_exp', 'op_sup', 'op_emp', 'op_othx'], in: ['in_ppe'], inOut: ['in_buy', 'in_oth'], fi: ['fi_loan'], fiOut: ['fi_debt', 'fi_lt', 'fi_amort', 'fi_oth'] };
// The amount of a cash flow line: typed, or the starting figure from the trial balance.
export function scfVal(scf, k, fig) {
  const typed = scf && scf[k];
  if (typed !== undefined && typed !== null && typed !== '') return cents(typed);
  const def = SCF.find((x) => x.k === k);
  return def && def.from && fig ? L(fig, def.from) : 0;
}
export const scfFromTb = (scf, k) => { const d = SCF.find((x) => x.k === k); return !!(d && d.from) && (scf == null || scf[k] === undefined || scf[k] === null || scf[k] === ''); };
// Totals of one year's cash flows. beg: cash at the beginning (centavos or null when unknown).
export function scfTotals(scf, fig, beg) {
  const s = (ks) => ks.reduce((x, k) => x + scfVal(scf, k, fig), 0);
  const t = { opIn: s(SEC.op), opOut: s(SEC.opOut), inIn: s(SEC.in), inOut: s(SEC.inOut), fiIn: s(SEC.fi), fiOut: s(SEC.fiOut) };
  t.op = t.opIn - t.opOut; t.in = t.inIn - t.inOut; t.fi = t.fiIn - t.fiOut; t.all = t.op + t.in + t.fi;
  t.beg = beg; t.end = beg === null || beg === undefined ? null : beg + t.all;
  return t;
}
export function buildScf(sy, sp, fy, fp, begY, begP, y) {
  const S = [sy, sp], F = [fy, fp], B = [begY, begP];
  const T = S.map((s, i) => (F[i] || s ? scfTotals(s, F[i], B[i]) : null));
  const rows = [];
  SCF.forEach((d) => {
    if (d.h) rows.push({ k: 'h', t: d.h });
    else if (d.h2) rows.push({ k: 'sub2', t: d.h2 });
    else if (d.k) rows.push({ k: 'row', t: d.t, v: S.map((s, i) => (T[i] ? scfVal(s, d.k, F[i]) * (d.in ? 1 : 1) : null)), ind: 2, cur: d.k === 'op_tax' });
    else if (d.tot) rows.push({ k: 'tot', t: d.t, v: T.map((x) => x && x[d.tot]), ind: 2 });
    else if (d.net) rows.push({ k: 'tot', t: d.t, v: T.map((x) => x && x[d.net]), cur: d.net === 'op' });
  });
  rows.push({ k: 'tot', t: 'Total Cash Provided by Operating, Investing and Financing Activities', v: T.map((x) => x && x.all), cur: true },
    { k: 'row', t: 'Add: Cash at the Beginning of the year', v: T.map((x) => x && x.beg), ind: 0 },
    { k: 'grand', t: 'Cash Balance at the End of the Year', v: T.map((x) => x && x.end), cur: true });
  return { key: 'scf', title: 'Statement of Cash Flows', period: `For the Year Ended December 31, ${y}`, cmp: `(With Comparative Figures for CY ${y - 1})`, cols: [y, y - 1], rows, totals: T };
}

/* ── Statement of Comparison of Budget and Actual Amounts (newer Manual format) ── */
// codes: accounts that show this row has an amount in the trial balance (prefixes allowed). fn: footnote number.
export const SCBAA = [
  { h: 'Revenue' },
  ...[['Real Property Tax', '4-01-01-010'], ['Business Tax', '4-01-02-010'], ['Share on the tax from sand, gravel and other quarry products', '4-01-02-020'],
    ['Fees and Charges on commercial breeding of fighting cocks, cockfights and cockpits', '4-01-03-010'], ['Fees and Charges on places of recreation which charge admission fees', '4-01-03-020'],
    ['Fees and Charges on billboards, signboards, neon signs and outdoor advertisements', '4-01-03-030'], ['Share from Internal Revenue Collections', '4-01-04-010'], ['Other Taxes', '4-01-04-990'],
    ['Tax Revenue - Fines and Penalties', '4-01-05'], ['Share from National Wealth', '4-03-01-010'], ['Grants and Donations in Cash', '4-03-02-010'], ['Grants and Donations in Kind', '4-03-02-020'],
    ['Clearance and Certification Fees', '4-04-01-010'], ['Other Service Revenue', '4-04-01-990'], ['Gain on Sale of Property, Plant and Equipment', '4-05-01-010']].map(([t, c]) => ({ t, codes: [c], sec: 'rev' })),
  { h: 'Expenses' }, { h: 'Personal Services', sub: true },
  ...[['Salaries and Wages - Regular', '5-01-01-010'], ['Salaries and Wages - Casual/Contractual', '5-01-01-020'], ['Personal Economic Relief Allowance (PERA)', '5-01-02-010'],
    ['Clothing/Uniform Allowance', '5-01-02-020'], ['Subsistence Allowance', '5-01-02-030'], ['Productivity Incentive Allowance', '5-01-02-040'], ['Honoraria', '5-01-02-050'],
    ['Year End Bonus', '5-01-02-060'], ['Cash Gift', '5-01-02-070'], ['Other Bonuses and Allowances', '5-01-02-990'], ['Personnel Benefit Contributions', '5-01-03'],
    ['Terminal Leave Benefits', '5-01-04-010'], ['Other Personnel Benefits', '5-01-04-990']].map(([t, c]) => ({ t, codes: [c], sec: 'ps' })),
  { h: 'Maintenance and Other Operating Expenses', sub: true },
  ...[['Traveling Expenses', '5-02-01'], ['Training Expenses', '5-02-02'], ['Office Supplies Expenses', '5-02-03-010'], ['Accountable Forms Expenses', '5-02-03-020'], ['Food Supplies Expenses', ''],
    ['Welfare Goods Expenses', '5-02-03-030'], ['Drugs and Medicines Expenses', '5-02-03-040'], ['Fuel, Oil and Lubricant Expenses', '5-02-03-050'], ['Other Supplies and Materials Expenses', '5-02-03-990'],
    ['Water Expenses', '5-02-04-010'], ['Electricity Expenses', '5-02-04-020'], ['Postage and Courier Services', '5-02-05-010'], ['Telephone Expenses', '5-02-05-020'],
    ['Internet Subscription Expenses', '5-02-05-030'], ['Cable, Satellite, Telegraph and Radio Expenses', '5-02-05-040'], ['Demolition and Relocation Expenses', '5-02-06-010'],
    ['Desilting and Dredging Expenses', '5-02-06-020'], ['Auditing Services', '5-02-07-010'], ['Consultancy Services', '5-02-07-020'], ['Other Professional Services', '5-02-07-990'],
    ['Environment/Sanitary Services', '5-02-08-010'], ['Janitorial Services', '5-02-08-020'], ['Security Services', '5-02-08-030'], ['Other General Services', '5-02-08-990'],
    ['Repairs and Maintenance - Land Improvements', '5-02-09-010'], ['Repairs and Maintenance - Infrastructure Assets', '5-02-09-020'], ['Repairs and Maintenance - Buildings and Other Structures', '5-02-09-030'],
    ['Repairs and Maintenance - Machinery and Equipment', '5-02-09-040'], ['Repairs and Maintenance - Transportation Equipment', '5-02-09-050'], ['Repairs and Maintenance - Furniture and Fixtures', '5-02-09-060'],
    ['Repairs and Maintenance - Leased Assets', '5-02-09-070'], ['Repairs and Maintenance - Leased Assets Improvements', '5-02-09-080'], ['Repairs and Maintenance - Other Property, Plant and Equipment', '5-02-09-990'],
    ['LGU Equity on National/Foreign Funded Projects', '5-02-10-010'], ['Fidelity Bond Premiums', '5-02-11-010'], ['Insurance Expenses', '5-02-11-020'], ['Labor and Wages', ''],
    ['Advertising Expense', '5-02-99-010'], ['Representation Expenses', '5-02-99-020'], ['Transportation and Delivery Expenses', '5-02-99-030'], ['Rent/Lease Expenses', '5-02-99-040'],
    ['Membership Dues and Contributions to Organizations', '5-02-99-050'], ['Subscription Expenses', '5-02-99-060'], ['Donations', '5-02-99-070'],
    ['Other Maintenance and Operating Expenses', '5-02-99-990']].map(([t, c]) => ({ t, codes: c ? [c] : [], sec: 'mooe' })),
  { h: 'Financial Expenses', sub: true, screenOnly: true },
  ...[['Interest Expenses', '5-03-01-010'], ['Bank Charges', '5-03-01-020'], ['Other Financial Charges', '5-03-01-990']].map(([t, c]) => ({ t, codes: [c], sec: 'fin' })),
  { h: 'Statutory Allocations', sub: true, screenOnly: true },
  { t: '5% LDRRMF', fn: 1, sec: 'stat', always: true }, { t: '10% SK allocation', fn: 2, sec: 'stat', always: true }, { t: '20% Development Fund', fn: 3, sec: 'stat', always: true },
  { t: '1% for the Elderly and Disabled', fn: 4, sec: 'stat', always: true }, { t: '1% Barangay Council for the Protection of Children', sec: 'stat', always: true },
  { h: 'Capital Outlays' },
  ...['Land', 'Repairs and Maintenance - Land Improvements', 'Infrastructure Assets', 'Buildings and Other Structures', 'Machinery and Equipment', 'Transportation Equipment',
    'Furniture, Fixtures and Books', 'Leased Assets', 'Leased Assets Improvements', 'Other Property Plant and Equipment'].map((t) => ({ t, codes: [], sec: 'co', always: true }))
];
SCBAA.forEach((r, i) => { if (!r.h) r.k = 's' + i; });
export const SCBAA_NOTE = 'The presentation adopted reflects the presentation adopted for budgeting purposes.';

// The rows of the SCBAA for this BAAR: the Manual rows, plus a row for any revenue or expense account in the
// trial balance that the Manual rows do not cover (so nothing is left out). accts: { code: centavos } for the year.
export function scbaaRows(accts, chart) {
  const covered = (code) => SCBAA.some((r) => (r.codes || []).some((c) => c && code.startsWith(c)));
  const extra = { rev: [], ps: [], mooe: [], fin: [] };
  Object.entries(accts || {}).forEach(([code, v]) => {
    if (!v || covered(code)) return;
    const a = chart.byCode[code]; if (!a) return;
    const sec = /^4/.test(code) || a.cls === 'Revenue' ? 'rev' : /^5-01/.test(code) ? 'ps' : /^5-03/.test(code) ? 'fin' : /^5-02/.test(code) || a.line === 'exp_mooe' || a.line === 'tr_to' ? 'mooe' : '';
    if (sec) extra[sec].push({ k: 'a' + code, t: a.title, codes: [code], sec, extra: true });
  });
  const out = [];
  SCBAA.forEach((r, i) => {
    out.push(r);
    const next = SCBAA[i + 1];
    if (r.sec && (!next || next.sec !== r.sec)) extra[r.sec] && out.push(...extra[r.sec]);
  });
  return out;
}
export const inTb = (r, accts) => (r.codes || []).some((c) => c && Object.entries(accts || {}).some(([code, v]) => v && code.startsWith(c)));
export function scbaaLine(row, data) {
  const d = (data && data.rows && data.rows[row.k]) || {};
  const ob = cents(d.ob), adj = cents(d.adj), act = cents(d.act);
  return { ob, adj, fin: ob + adj, act, diff: ob + adj - act, any: !!(ob || adj || act), typed: [d.ob, d.adj, d.act].some((x) => x !== undefined && x !== null && x !== '') };
}
// The rows that print: with amounts only (unless all rows are asked for), and each heading only when a row under it prints.
export function scbaaPrintRows(rows, data) {
  const all = !!(data && data.printAll);
  const keep = rows.map((r) => (r.h ? false : all || scbaaLine(r, data).any));
  const out = [];
  rows.forEach((r, i) => {
    if (r.h) {
      if (r.screenOnly) return;
      // a main heading prints when a row under it prints (up to the next main heading); a sub-heading, up to the next heading
      let j = i + 1, any = false;
      while (j < rows.length && !(rows[j].h && (r.sub || !rows[j].sub))) { if (keep[j]) any = true; j++; }
      if (any) out.push(r);
    } else if (keep[i]) out.push(r);
  });
  return out;
}
