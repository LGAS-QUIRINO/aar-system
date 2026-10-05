// BAAR Part 07 · Notes to Financial Statements, in the form of Annex 40 of the Manual on the Financial Management of Barangays.
// Notes 1 and 2 are standard wording (with the barangay's details). The policies under 2.2 are numbered 1) to 6), and the
// account notes continue that numbering, as in the Manual: 7) Real Property Tax, and so on. Only notes with amounts are printed,
// so the numbers follow on without gaps; the statements' Note column shows the same numbers.
// Every account of a statement line goes to one note of that line, so each line's notes add up to the statement.
import { loadScript } from './wp.js';
import { money, cents, parseAmt } from './fs.js';
import { LINE } from './coa.js';
import { FS_CSS } from './baar-fs.js';

const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const amtOf = (v) => { const n = parseAmt(v); return n === null || isNaN(n) ? null : cents(n); };

/* ── Standard wording (Annex 40) ── */
export const N1_SERVICES = 'agricultural support services; health and social welfare services; services and facilities related to general hygiene and sanitation, beautification, and solid waste collection; maintenance of katarungan pambarangay; maintenance of barangay roads and bridges and water supply systems; infrastructure facilities; information and reading center; and satellite or public market';
const N21 = [
  'The financial statements have been prepared in accordance with and comply with the Philippine Public Sector Accounting Standards. The financial statements are presented in Peso and the figures are rounded to the nearest pesos.',
  'The financial statements are prepared on the basis of historical cost. The cash flow statement is prepared using the direct method. The Statement of Comparison of Budget and Actual Amounts is presented according to the classification adopted for budgeting purposes.'
];
const POLICIES = [
  { t: 'Revenue Recognition', p: [{ x: 'Revenues are recorded when received.' },
    { h: 'Revenue from non-exchange transactions', x: 'Taxes, fees, grants and donations are recognized when the event occurs. Transfers of funds from other government agencies without specific purpose for which the fund will be utilized are recognized as non-exchange transactions.' },
    { h: 'Revenue from exchange transactions', x: 'Revenues from fees on issuance of certifications and clearances and other services rendered, sale of goods are recognized as exchange transactions.' }] },
  { t: 'Expenses', p: [{ x: 'Expenses are recognized and taken up in the accounts when incurred.' }] },
  { t: 'Inventories', p: [{ x: 'Inventories are recorded following the asset method, cost at moving average method and measured at the lower of cost and net realizable value. Inventories acquired thru non-exchange transactions are recognized at its fair value at the time of transfer.' }] },
  { t: 'Recognition of Liabilities', p: [{ x: 'Liabilities are recognized at the time goods and services are accepted or rendered.' }] },
  { t: 'Property, Plant and Equipment', p: [{ x: 'All property, plant and equipment except donated property without declared value are stated at cost less accumulated depreciation. Major repairs, which extends the life of the asset are capitalized and depreciated together with the asset.' },
    { x: 'Depreciation is charged on the depreciable value of assets following the straight-line method over the useful life of the asset.' },
    { x: 'PPEs are derecognized upon disposal. Any gain or loss arising from the derecognition is recognized in the surplus or deficit. PPEs except public infrastructure which become unserviceable or no future economic benefit or service potential is expected from its continued use are transferred to the Other Assets.' }] },
  { t: 'Public infrastructure', p: [{ x: 'Public infrastructure assets are recorded in the books at cost. Replacement of parts required at regular intervals is recognized in the carrying amount of the Public Infrastructure when the costs incurred meet the recognition criteria. The carrying amount of those parts replaced is derecognized.' }] }
];

/* ── The account notes, in the Manual's order. line: the statement line the note belongs to; m: which accounts (by title);
   a note without m takes the rest of its line. Notes marked extra are not in Annex 40 but hold accounts the Manual has no note for. ── */
const t = (re) => (a) => re.test(a.title.toLowerCase());
const NOTES = [
  { id: 'rpt', line: 'rev_tax', title: 'Real Property Tax', m: t(/real property tax/), text: (c) => `Real Property Tax represents the 30% share of the barangay from the Municipality's collection of the basic real property tax and its penalties.` },
  { id: 'bus', line: 'rev_tax', title: 'Business Tax', m: t(/business tax|sand, gravel|quarry/), text: () => 'Business tax represents the taxes levied by the barangay on stores or retailers with fixed establishments within the barangay area.' },
  { id: 'ira', line: 'rev_ira', title: 'Share from Internal Revenue Collections', text: () => 'This represents the share of the barangay from the 40% allocation for the local governments from the national internal revenue taxes based on the collection of the third fiscal year preceding the current fiscal year.' },
  { id: 'permit', line: 'rev_tax', title: 'Tax Revenue - Permit Fees', m: t(/fees and charges on|permit fee/) },
  { id: 'fines', line: 'rev_tax', title: 'Tax Revenue - Fines and Penalties', m: t(/fines and penalties/) },
  { id: 'othtax', line: 'rev_tax', title: 'Other Taxes', extra: true },
  { id: 'grants', line: 'rev_grant', title: 'Shares, Grants and Donations' },
  { id: 'svc', line: 'rev_svc', title: 'Service and Business Revenue' },
  { id: 'misc', line: 'rev_misc', title: 'Miscellaneous Income', extra: true },
  { id: 'trfrom', line: 'tr_from', title: 'Transfers, Assistance and Subsidy From', extra: true },
  { id: 'ps', line: 'exp_ps', title: 'Salaries and Wages', km: true },
  { id: 'travel', line: 'exp_mooe', title: 'Travelling Expenses', m: t(/travel/), extra: true },
  { id: 'train', line: 'exp_mooe', title: 'Training and Scholarship Expenses', m: t(/training|scholarship/), extra: true },
  { id: 'supp', line: 'exp_mooe', title: 'Supplies and Materials Expenses', m: t(/suppl|accountable forms|welfare goods|drugs and medicines|fuel, oil/) },
  { id: 'util', line: 'exp_mooe', title: 'Utility Expenses', m: t(/water expense|electricity/) },
  { id: 'comm', line: 'exp_mooe', title: 'Communication Expenses', m: t(/postage|courier|telephone|internet|cable, satellite|telegraph/) },
  { id: 'demol', line: 'exp_mooe', title: 'Demolition/Relocation and Desilting/Dredging Expenses', m: t(/demolition|relocation|desilting|dredging/) },
  { id: 'prof', line: 'exp_mooe', title: 'Professional Services', m: t(/auditing serv|consultancy|professional serv|legal serv/) },
  { id: 'gen', line: 'exp_mooe', title: 'General Services', m: t(/sanitary|janitorial|security serv|general serv/) },
  { id: 'rep', line: 'exp_mooe', title: 'Repairs and Maintenance', m: t(/^repairs?\b/) },
  { id: 'taxes', line: 'exp_mooe', title: 'Taxes, Insurance Premiums and Other Fees', m: t(/fidelity|insurance|taxes, duties|licenses/) },
  { id: 'omooe', line: 'exp_mooe', title: 'Other Maintenance and Operating Expenses' },
  { id: 'fa', line: 'tr_to', title: 'Financial Assistance/Subsidy' },
  { id: 'fin', line: 'exp_fin', title: 'Financial Expenses' },
  { id: 'dep', line: 'exp_nc', title: 'Depreciation Expense', m: t(/depreciation/) },
  { id: 'imp', line: 'exp_nc', title: 'Impairment Losses', m: t(/impairment/), extra: true },
  { id: 'loss', line: 'exp_nc', title: 'Losses' },
  { id: 'cash', line: 'cash', title: 'Cash and cash equivalents', text: () => 'Cash and cash equivalents comprise cash in the local treasury and cash in bank current and time deposit accounts.' },
  { id: 'invest', line: 'invest', title: 'Investments', extra: true },
  { id: 'recv', line: 'recv', title: 'Receivables' },
  { id: 'inv', line: 'inv', title: 'Inventories', inv: true },
  { id: 'prepay', line: 'prepay', title: 'Prepayments and Deferred Charges', extra: true },
  { id: 'invprop', line: 'invprop', title: 'Investment Property', extra: true },
  { id: 'ppe', line: 'ppe', title: 'Property, Plant and Equipment', ppe: true },
  { id: 'bio', line: 'bio', title: 'Biological Assets', extra: true },
  { id: 'intang', line: 'intang', title: 'Intangible Assets', extra: true },
  { id: 'finl', line: 'finl', title: 'Financial Liabilities', extra: true },
  { id: 'inter', line: 'inter', title: 'Inter-Agency Payables', extra: true },
  { id: 'intra', line: 'intra', title: 'Intra-Agency Payables', extra: true },
  { id: 'trust', line: 'trust', title: 'Trust Liabilities', extra: true },
  { id: 'defcr', line: 'defcr', title: 'Deferred Credits/Unearned Income', extra: true },
  { id: 'othpay', line: 'othpay', title: 'Other Payables', extra: true }
];
const FIRST = POLICIES.length + 1;     // the first account note is 7)

// Key management personnel (Note on Salaries and Wages, b.)
export const KM = [['pb', 'Punong Barangay'], ['kag', 'Barangay Kagawads'], ['sk', 'SK Representative'], ['treas', 'Barangay Treasurer'], ['sec', 'Barangay Secretary']];

/* ── PPE classes (columns of the movement schedule) ── */
export const PPE_CLS = [['land', 'Land'], ['li', 'Land Improvements'], ['infra', 'Infrastructure Assets'], ['bldg', 'Buildings and Other Structures'], ['me', 'Machinery and Equipment'],
  ['te', 'Transportation Equipment'], ['ff', 'Furniture, Fixtures and Books'], ['lease', 'Leased Assets'], ['cip', 'Construction in Progress'], ['oth', 'Other Property, Plant and Equipment']];
export function ppeClass(title) {
  const s = String(title || '').toLowerCase();
  if (/leased/.test(s)) return 'lease';
  if (/construction in progress/.test(s)) return 'cip';
  if (/other property, plant/.test(s)) return 'oth';
  if (/land improvement/.test(s)) return 'li';
  if (/\bland\b/.test(s)) return 'land';
  if (/road network|flood control|sewer|water supply|park|plaza|monument|infrastructure|power supply/.test(s)) return 'infra';
  if (/motor vehicle|watercraft|transportation|aircraft/.test(s)) return 'te';
  if (/furniture|books/.test(s)) return 'ff';
  if (/building|structure|hospital|health center|market|school/.test(s)) return 'bldg';
  if (/machinery|equipment/.test(s)) return 'me';
  return 'oth';
}

/* ── Building ── */
function accountsOf(F) {
  const keys = new Set([...Object.keys(F.figY.accts || {}), ...Object.keys(F.figP.accts || {})]);
  return [...keys].map((k) => {
    const a = F.chart.byKey[k]; if (!a) return null;
    const cy = (F.figY.accts || {})[k] || 0, py = (F.figP.accts || {})[k] || 0;
    if (!cy && !py) return null;
    return { k, a, line: a.line, cy, py };
  }).filter(Boolean).sort((x, y) => x.a.code.localeCompare(y.a.code));
}
// Each account to one note of its line: the first note whose accounts it matches, else the note that takes the rest of the line.
function place(F) {
  const by = Object.fromEntries(NOTES.map((n) => [n.id, []]));
  const other = {};
  accountsOf(F).forEach((x) => {
    const own = NOTES.filter((n) => n.line === x.line);
    if (!own.length) { (other[x.line] = other[x.line] || []).push(x); return; }
    const n = own.find((m) => m.m && m.m(x.a)) || own.find((m) => !m.m) || own[own.length - 1];
    by[n.id].push(x);
  });
  return { by, other };
}
const sum = (rows, i) => rows.reduce((s, r) => s + (r.v[i] || 0), 0);
const NOTE_NUM = (list) => Object.fromEntries(list.map((n, i) => [n.id, FIRST + i]));

// The notes that are printed (those with amounts), with their numbers.
function presentNotes(F) {
  const { by } = place(F);
  const list = NOTES.filter((n) => by[n.id].length);
  return { list, by, num: NOTE_NUM(list) };
}

// The Note column of the statements: each line's note numbers, e.g. { rev_tax: '7, 8, 10', exp_mooe: '15–23' }.
export function noteRefs(F) {
  if (!F || !F.figY || !F.chart) return null;
  const { list, num } = presentNotes(F);
  const out = {};
  Object.keys(LINE).concat(['tr_from', 'tr_to']).forEach((k) => {
    const ns = list.filter((n) => n.line === k).map((n) => num[n.id]);
    out[k] = fmtNums(ns);
  });
  return out;
}
function fmtNums(ns) {
  if (!ns.length) return '';
  const runs = []; let a = ns[0], b = ns[0];
  ns.slice(1).forEach((x) => { if (x === b + 1) b = x; else { runs.push([a, b]); a = b = x; } });
  runs.push([a, b]);
  return runs.map(([x, y]) => (y - x >= 2 ? `${x}–${y}` : x === y ? `${x}` : `${x}, ${y}`)).join(', ');
}

// The PPE movement schedule: per class, cost and accumulated depreciation as at each date. P: the typed movements.
export function ppeSchedule(F, P = {}) {
  const C = Object.fromEntries(PPE_CLS.map(([k]) => [k, { cpy: 0, ccy: 0, apy: 0, acy: 0, dpy: 0, dcy: 0 }]));
  accountsOf(F).forEach((x) => {
    if (x.line === 'ppe') {
      const c = C[ppeClass(x.a.title)];
      if (/accumulated/i.test(x.a.title)) { c.apy += -x.py; c.acy += -x.cy; } else { c.cpy += x.py; c.ccy += x.cy; }
    } else if (x.line === 'exp_nc' && /depreciation/i.test(x.a.title)) {
      const c = C[ppeClass(x.a.title.replace(/^.*?depreciation\s*-?\s*/i, ''))];
      c.dpy += x.py; c.dcy += x.cy;
    }
  });
  const cols = PPE_CLS.filter(([k]) => { const c = C[k], p = P[k] || {}; return c.cpy || c.ccy || c.apy || c.acy || c.dpy || c.dcy || Object.values(p).some((v) => amtOf(v)); })
    .map(([k, label]) => {
      const c = C[k], p = P[k] || {}, g = (f) => amtOf(p[f]) || 0;
      const cost = { pa: g('pa'), pd: g('pd'), pt: g('pt'), ca: g('ca'), cd: g('cd'), ct: g('ct') };
      const dep = { dd: g('dd'), dt: g('dt') };
      const open = c.cpy - cost.pa + cost.pd - cost.pt;
      const openA = c.apy - c.dpy;
      const costCalc = c.cpy + cost.ca - cost.cd + cost.ct, depCalc = c.apy + c.dcy - dep.dd + dep.dt;
      return { k, label, ...c, ...cost, ...dep, open, openA, costDiff: c.ccy - costCalc, depDiff: c.acy - depCalc };
    });
  return cols;
}

/**
 * The whole Part 07. N: the typed details { loc, hall, issued, km: { pb: { cy, py }, … }, inv: { rec, wd }, ppe: { land: { pa, … } } }.
 * Returns { blocks (portrait), ppe (landscape schedule or null), checks, ctx }.
 */
export function buildNotes(F, N = {}, { lgu, mun }) {
  const y = F.y, yp = F.yp, name = `Barangay ${lgu.name}`;
  const { list, by, num } = presentNotes(F);
  const blocks = [];
  blocks.push({ k: 'title', t: 'Notes to the Financial Statements' });
  blocks.push({ k: 'h', t: '1. General Information' });
  const issued = String(N.issued || '').trim(), loc = String(N.loc || '').trim(), hall = String(N.hall || '').trim() || `${name}, ${mun.name}, Quirino`;
  blocks.push({ k: 'p', t: `The financial statements of ${name} ${issued ? `were issued on ${issued}` : 'were issued'}. ${name} is located ${loc ? `in ${loc}` : `in ${mun.name}, Quirino`}, and the barangay hall is located in ${hall}. The barangay exercises the functions and responsibilities necessary for the efficient and effective provision of the following basic services: ${N1_SERVICES}.` });
  blocks.push({ k: 'h', t: '2.1 Statement of compliance and basis of preparation' });
  N21.forEach((x) => blocks.push({ k: 'p', t: x }));
  blocks.push({ k: 'h', t: '2.2 Summary of Significant Accounting Policies' });
  POLICIES.forEach((p, i) => {
    blocks.push({ k: 'h2', t: `${i + 1})  ${p.t}`, keep: true });
    p.p.forEach((x) => { if (x.h) blocks.push({ k: 'pi', t: x.h, keep: true }); blocks.push({ k: 'p', t: x.x, tight: !!x.h || x === p.p[0] }); });
  });
  const tbl = (rows, total) => ({ k: 'table', cols: [y, yp], rows: [...rows, ...(total ? [{ t: 'Total', v: [sum(rows, 0), sum(rows, 1)], tot: true }] : [])] });
  const acctRows = (xs) => xs.map((x) => ({ t: x.a.title, v: [x.cy, x.py] }));
  let ppe = null;
  list.forEach((n) => {
    const no = num[n.id], xs = by[n.id];
    if (n.ppe) {
      blocks.push({ k: 'h2', t: `${no})  ${n.title}`, keep: true });
      blocks.push({ k: 'p', t: `The details of Property, Plant and Equipment are shown in the schedule of movements at the end of these notes.`, ppeRef: true });
      ppe = { no, title: n.title, cols: ppeSchedule(F, N.ppe || {}), y, yp, total: [sum(acctRows(xs), 0), sum(acctRows(xs), 1)] };
      return;
    }
    blocks.push({ k: 'h2', t: `${no})  ${n.title}`, keep: true });
    if (n.text) blocks.push({ k: 'p', t: n.text(), keep: true });
    if (n.km) {
      blocks.push({ k: 'pc', t: 'a. Employees', keep: true });
      blocks.push({ k: 'pc', t: 'This includes the cost of personal services for employees of the barangay', keep: true });
      blocks.push(tbl(acctRows(xs), true));
      blocks.push({ k: 'pi2', t: 'b. Remuneration of key management personnel', keep: true });
      blocks.push({ k: 'p', t: "This represents the honoraria, year-end bonus, cash gift, Other Bonuses and Allowances and Terminal Leave Benefits of the agency's key management personnel." });
      const km = N.km || {};
      blocks.push(tbl(KM.map(([k, label]) => ({ t: label, v: [amtOf((km[k] || {}).cy), amtOf((km[k] || {}).py)] })), true));
      return;
    }
    blocks.push(tbl(acctRows(xs), true));
    if (n.inv) {
      const rec = amtOf((N.inv || {}).rec), wd = amtOf((N.inv || {}).wd);
      if (rec !== null) blocks.push({ k: 'pc', t: `Amount of inventories recognized during the period totaled ₱${money(rec, { dash: '0.00' })}.` });
      if (wd !== null) blocks.push({ k: 'pc', t: `The amount of write-down of inventories recognized as an expense is ₱${money(wd, { dash: '0.00' })}, which is recognized under the Inventory expense.` });
    }
  });
  // Results
  const checks = [];
  if (!F.figY.any) checks.push({ st: 'wait', t: 'Runs once the trial balances are entered and confirmed' });
  else {
    checks.push(issued ? { st: 'ok', t: `Note 1: date issued (${issued})` } : { st: 'warn', t: 'Note 1: type the date the financial statements were issued' });
    checks.push(loc ? { st: 'ok', t: 'Note 1: location of the barangay' } : { st: 'warn', t: 'Note 1: type where the barangay is located' });
    if (by.ps.length) {
      const km = N.km || {}, filled = KM.filter(([k]) => amtOf((km[k] || {}).cy) !== null).length;
      checks.push(filled === KM.length ? { st: 'ok', t: `Note ${num.ps} b: remuneration of key management personnel` } : { st: 'warn', t: `Note ${num.ps} b: remuneration of key management personnel, ${KM.length - filled} of ${KM.length} not yet typed for CY ${y}` });
    }
    if (ppe) {
      ppe.cols.forEach((c) => {
        if (c.costDiff) checks.push({ st: 'warn', t: `Note ${ppe.no}: ${c.label} cost, the CY ${y} movements leave ₱${money(c.costDiff, { paren: false })} unexplained` });
        if (c.depDiff) checks.push({ st: 'warn', t: `Note ${ppe.no}: ${c.label} accumulated depreciation, ₱${money(c.depDiff, { paren: false })} unexplained (CY ${y} depreciation is from the trial balance)` });
      });
      if (!ppe.cols.some((c) => c.costDiff || c.depDiff)) checks.push({ st: 'ok', t: `Note ${ppe.no}: the movements explain the CY ${y} balances of every class` });
    }
    const other = Object.keys(place(F).other);
    if (other.length) checks.push({ st: 'info', t: `No note for: ${other.map((k) => (LINE[k] || {}).label || k).join(', ')}` });
    checks.push({ st: 'ok', t: 'Each statement line equals the total of its notes' });
  }
  return { blocks, ppe, checks, lgu, mun, y, yp, list, num };
}

/* ── Pages ── */
export const NOTES_CSS = `${FS_CSS}
.nts{font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.3;color:#000}
.nts .title{font-weight:700;margin:0 0 10pt}
.nts .h{font-weight:700;margin:10pt 0 6pt}
.nts .h2{margin:8pt 0 4pt}
.nts p{margin:0 0 6pt;text-align:justify}
.nts p.tight{margin-top:0}
.nts .pi{font-style:italic;margin:4pt 0 0}
.nts .pc{text-align:center;margin:2pt 0 4pt}
.nts .pi2{margin:6pt 0 4pt;padding-left:.3in}
.nts table{width:100%;border-collapse:collapse;margin:2pt 0 8pt;table-layout:fixed}
.nts td,.nts th{border:1px solid #000;padding:1pt 4pt;font-weight:400}
.nts th{text-align:center}
.nts td.a{text-align:right;white-space:nowrap}
.nts tr.tot td{font-weight:700}
.fsp.land{width:11in;height:8.5in;padding:.75in .7in .8in}
.ppe{font-family:Arial,Helvetica,sans-serif;font-size:8pt;line-height:1.2;color:#000}
.ppe .h2{font-size:10pt;margin:0 0 8pt}
.ppe table{width:100%;border-collapse:collapse;table-layout:fixed}
.ppe td,.ppe th{border:1px solid #000;padding:1pt 3pt;font-weight:400;vertical-align:bottom}
.ppe th{text-align:left}
.ppe td.a{text-align:right;white-space:nowrap}
.ppe tr.b td{font-weight:700}
.paper-wrap .sheet.fsheet.land{width:11in;height:8.5in}
`;
// Lines a block takes, to lay out pages (about 48 lines a page).
const CAP = 48, W = 92;
const lines = (b) => {
  if (b.k === 'table') return 1.4 + b.rows.reduce((s, r) => s + Math.max(1, Math.ceil(r.t.length / 52)) * 1.25, 0);
  const n = Math.max(1, Math.ceil(String(b.t).length / W));
  return n + (b.k === 'h' ? 1.6 : b.k === 'title' ? 1.6 : b.k === 'h2' ? 1 : 0.5);
};
// Splits the blocks into pages; a heading stays with what follows; a long table is split by rows.
export function notesPages(blocks) {
  const pages = []; let cur = [], used = 0;
  const flush = () => { if (cur.length) pages.push(cur); cur = []; used = 0; };
  for (let i = 0; i < blocks.length; i++) {
    let b = blocks[i];
    if (b.k === 'table') {
      let rows = b.rows;
      while (rows.length) {
        const room = Math.floor((CAP - used - 1.4) / 1.25);
        if (room < 3 && cur.length) { flush(); continue; }
        let n = Math.max(room, 3);
        if (rows.length > n && rows.length - n < 2) n = rows.length - 2;   // never leave only one or two rows (or just the Total) for the next page
        const take = rows.slice(0, n);
        cur.push({ ...b, rows: take, cont: rows !== b.rows }); used += lines({ ...b, rows: take });
        rows = rows.slice(take.length);
        if (rows.length) flush();
      }
      continue;
    }
    // keep a heading with the next block
    // a heading (and a note's text) stays with what follows: the whole chain of kept blocks plus the start of the next one
    let need = 0, j = i;
    while (blocks[j]) {
      const x = blocks[j];
      need += x.k === 'table' ? 1.4 + Math.min(x.rows.length, 3) * 1.25 : lines(x);
      if (!x.keep || x.k === 'table') break;
      j++;
    }
    if (used + need > CAP && cur.length) flush();
    cur.push(b); used += lines(b);
  }
  flush();
  return pages.length ? pages : [[]];
}
const blockHTML = (b, ppePage) => {
  const tx = escH(b.ppeRef ? b.t.replace('[PPE_PAGE]', ppePage || '') : b.t);
  if (b.k === 'title') return `<div class="title">${tx}</div>`;
  if (b.k === 'h') return `<div class="h">${tx}</div>`;
  if (b.k === 'h2') return `<div class="h2">${tx}</div>`;
  if (b.k === 'pi') return `<div class="pi">${tx}</div>`;
  if (b.k === 'pc') return `<div class="pc">${tx}</div>`;
  if (b.k === 'pi2') return `<div class="pi2">${tx}</div>`;
  if (b.k === 'table') return `<table><colgroup><col><col style="width:1.45in"><col style="width:1.45in"></colgroup><thead><tr><th></th><th>${b.cols[0]}</th><th>${b.cols[1]}</th></tr></thead><tbody>${b.rows.map((r) => `<tr class="${r.tot ? 'tot' : ''}"><td>${escH(r.t)}</td><td class="a">${r.v[0] === null ? '' : money(r.v[0], { dash: '-' })}</td><td class="a">${r.v[1] === null ? '' : money(r.v[1], { dash: '-' })}</td></tr>`).join('')}</tbody></table>`;
  return `<p class="${b.tight ? 'tight' : ''}">${tx}</p>`;
};
const date = (m, d, yr) => `${m}/${d}/${String(yr).slice(-2)}`;
export function ppeRows(p) {
  const a = (f) => p.cols.map((c) => f(c));
  const tot = (vals) => [...vals, vals.reduce((s, v) => s + (v || 0), 0)];
  return [
    { t: 'Cost', head: true },
    { t: `As at ${date('01', '01', p.yp)}`, v: tot(a((c) => c.open)), b: true },
    { t: 'Additions', v: tot(a((c) => c.pa)) }, { t: 'Disposals', v: tot(a((c) => -c.pd)) }, { t: 'Transfers/Adj', v: tot(a((c) => c.pt)) },
    { t: `As at ${date('12', '31', p.yp)}`, v: tot(a((c) => c.cpy)), b: true },
    { t: 'Additions', v: tot(a((c) => c.ca)) }, { t: 'Disposals', v: tot(a((c) => -c.cd)) }, { t: 'Transfers/Adj', v: tot(a((c) => c.ct)) },
    { t: `As at ${date('12', '31', p.y)}`, v: tot(a((c) => c.ccy)), b: true },
    { t: 'Depreciation', head: true, b: true },
    { t: `As at ${date('01', '01', p.yp)}`, v: tot(a((c) => c.openA)) }, { t: 'Depreciation', v: tot(a((c) => c.dpy)) },
    { t: `As at ${date('12', '31', p.yp)}`, v: tot(a((c) => c.apy)), b: true },
    { t: 'Depreciation', v: tot(a((c) => c.dcy)) }, { t: 'Disposals', v: tot(a((c) => -c.dd)) }, { t: 'Transfers/Adj', v: tot(a((c) => c.dt)) },
    { t: `As at ${date('12', '31', p.y)}`, v: tot(a((c) => c.acy)), b: true },
    { t: 'Net book values', head: true },
    { t: `As at ${date('12', '31', p.yp)}`, v: tot(a((c) => c.cpy - c.apy)), b: true },
    { t: `As at ${date('12', '31', p.y)}`, v: tot(a((c) => c.ccy - c.acy)), b: true }
  ];
}
function ppeHTML(p, page) {
  const head = `<tr><th>Cost</th>${p.cols.map((c) => `<th>${escH(c.label)}</th>`).join('')}<th>Total</th></tr>`;
  const body = ppeRows(p).slice(1).map((r) => r.head ? `<tr class="b"><td colspan="${p.cols.length + 2}">${escH(r.t)}</td></tr>`
    : `<tr class="${r.b ? 'b' : ''}"><td>${escH(r.t)}</td>${r.v.map((v) => `<td class="a">${v ? money(v, { dash: '' }) : ''}</td>`).join('')}</tr>`).join('');
  return `<div class="fsp land"><div class="ppe"><div class="h2">${p.no})  ${escH(p.title)}</div><table><colgroup><col style="width:1.25in"></colgroup><thead>${head}</thead><tbody>${body}</tbody></table></div>${page ? `<div class="pno" style="left:.7in;right:.7in">${page}</div>` : ''}</div>`;
}
// All of Part 07 as pages: { html: [page…], count, ppePage }.
export function notesPagesHTML(doc, start) {
  const pages = notesPages(doc.blocks);
  const ppePage = doc.ppe && start ? start + pages.length : '';
  const out = pages.map((p, i) => `<div class="fsp"><div class="nts">${p.map((b) => blockHTML(b, ppePage)).join('')}</div>${start ? `<div class="pno">${start + i}</div>` : ''}</div>`);
  if (doc.ppe) out.push(ppeHTML(doc.ppe, ppePage));
  return { html: out, count: out.length, land: doc.ppe ? out.length - 1 : -1 };
}
export const notesPageCount = (doc) => notesPages(doc.blocks).length + (doc.ppe ? 1 : 0);
export function notesPrint(doc, start) {
  const { html, land } = notesPagesHTML(doc, start);
  return { css: `${NOTES_CSS} @page nt { size: 8.5in 11in; margin: 0; } @page ntl { size: 11in 8.5in; margin: 0; } .pg-nt { page: nt; } .pg-ntl { page: ntl; }`,
    html: html.map((x, i) => `<div class="pg ${i === land ? 'pg-ntl' : 'pg-nt'}">${x}</div>`).join('') };
}

/* ── Word ── */
export async function notesSections(doc, start) {
  const D = await loadScript('lib/docx.min.js', 'docx');
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, Footer, PageNumber, PageOrientation } = D;
  const A = (tx, o = {}) => new TextRun({ text: tx, font: 'Arial', size: o.size || 20, bold: !!o.b, italics: !!o.i });
  const line = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const all = { top: line, bottom: line, left: line, right: line };
  const footer = () => new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: 'Times New Roman', size: 22 })] })] });
  const pages = notesPages(doc.blocks);
  const ppePage = doc.ppe && start ? start + pages.length : '';
  const cell = (tx, w, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: all, margins: { left: 60, right: 60 }, columnSpan: o.span,
    children: [new Paragraph({ alignment: o.al || AlignmentType.LEFT, children: [A(tx, { b: o.b, size: o.size })] })] });
  const kids = [];
  doc.blocks.forEach((b) => {
    const tx = b.ppeRef ? b.t.replace('[PPE_PAGE]', ppePage || '') : b.t;
    if (b.k === 'table') {
      const Wd = [5400, 1800, 1800];
      const rows = [new TableRow({ tableHeader: true, children: [cell('', Wd[0]), cell(String(b.cols[0]), Wd[1], { al: AlignmentType.CENTER }), cell(String(b.cols[1]), Wd[2], { al: AlignmentType.CENTER })] }),
        ...b.rows.map((r) => new TableRow({ cantSplit: true, children: [cell(r.t, Wd[0], { b: r.tot }), ...r.v.map((v, i) => cell(v === null ? '' : money(v, { dash: '-' }), Wd[i + 1], { al: AlignmentType.RIGHT, b: r.tot }))] }))];
      kids.push(new Table({ width: { size: 9000, type: WidthType.DXA }, columnWidths: Wd, rows }), new Paragraph({ spacing: { after: 120 }, children: [] }));
      return;
    }
    const sp = { title: { after: 200 }, h: { before: 200, after: 120 }, h2: { before: 160, after: 80 } }[b.k] || { after: 120 };
    kids.push(new Paragraph({ keepNext: !!b.keep, spacing: sp, alignment: b.k === 'pc' ? AlignmentType.CENTER : b.k === 'p' ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
      indent: b.k === 'pi2' ? { left: 432 } : undefined, children: [A(tx, { b: b.k === 'title' || b.k === 'h', i: b.k === 'pi' })] }));
  });
  const out = [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1152, right: 1440, bottom: 1296, left: 1800, header: 0, footer: 720 }, pageNumbers: start ? { start } : undefined } },
    footers: start ? { default: footer() } : undefined, children: kids }];
  if (doc.ppe) {
    const p = doc.ppe, n = p.cols.length;
    const first = 2000, rest = Math.floor((14400 - 1440 - first) / (n + 1));
    const Wd = [first, ...Array(n + 1).fill(rest)];
    const c = (tx, w, o = {}) => cell(tx, w, { ...o, size: 16 });
    const rows = [new TableRow({ tableHeader: true, children: [c('Cost', Wd[0]), ...p.cols.map((x, i) => c(x.label, Wd[i + 1])), c('Total', Wd[n + 1])] }),
      ...ppeRows(p).slice(1).map((r) => r.head ? new TableRow({ children: [c(r.t, Wd.reduce((s, w) => s + w, 0), { b: true, span: n + 2 })] })
        : new TableRow({ cantSplit: true, children: [c(r.t, Wd[0], { b: r.b }), ...r.v.map((v, i) => c(v ? money(v, { dash: '' }) : '', Wd[i + 1], { al: AlignmentType.RIGHT, b: r.b }))] }))];
    out.push({ properties: { page: { size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1080, right: 720, bottom: 1080, left: 720, header: 0, footer: 576 } } },
      footers: start ? { default: footer() } : undefined,
      children: [new Paragraph({ spacing: { after: 160 }, children: [A(`${p.no})  ${p.title}`)] }), new Table({ width: { size: Wd.reduce((s, w) => s + w, 0), type: WidthType.DXA }, columnWidths: Wd, rows })] });
  }
  return out;
}
export const notesFileName = (audit, lgu, mun) => `${String(lgu.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_${String(mun.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_BAAR_${audit.auditYear}_07_Notes_to_FS`;
