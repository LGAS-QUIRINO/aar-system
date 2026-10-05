// BAAR Part 07 · Notes to Financial Statements, in the form of Annex 40 of the Manual on the Financial Management of Barangays.
// Notes 1 and 2 are standard wording (with the barangay's details). The policies under 2.2 are numbered 1) to 6), and the
// account notes continue that numbering, as in the Manual: 7) Real Property Tax, and so on. Only notes with amounts are printed,
// so the numbers follow on without gaps; the statements' Note column shows the same numbers.
// Every account of a statement line goes to one note of that line, so each line's notes add up to the statement.
import { loadScript } from './wp.js';
import { money, cents, parseAmt } from './fs.js';
import { LINE } from './coa.js';
import { FS_CSS } from './baar-fs.js';
import { punongBarangay } from './baar-transmittal.js';
import { longDate } from './format.js';

const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const amtOf = (v) => { const n = parseAmt(v); return n === null || isNaN(n) ? null : cents(n); };

/* ── Standard wording (Annex 40) ── */
export const N1_SERVICES = 'Agricultural support services; Health and Social welfare service; Services and facilities related to general Hygiene and Sanitation, Beautification, and Solid Waste Collection; Maintenance of Katarungang Pambarangay; maintenance of Barangay roads and Bridges and Water Supply Systems; Infrastructure facilities; Information and Reading Center; and Satellite or Public Market within the premises of the Barangay hall';
export const N1_WORKFORCE = "a Barangay Secretary, a Barangay Treasurer, BPAT's, Driver, BHW/BNS, Utility Workers";
const N21 = [
  'The financial statements have been prepared in accordance with and comply with the International Public Sector Accounting Standards (IPSAS). The financial statements are presented in Peso and the figures are rounded to the nearest pesos.',
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

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const inWords = (n) => `${WORDS[n] || n} (${n})`;
// The Sanggunian from Setup: the Kagawads and the SK Chairperson with names, as encoded.
export function sanggunian(audit) {
  return (audit.kagawads || []).filter((k) => String(k.name || '').trim()).map((k) => ({ name: String(k.name).trim(), pos: k.pos || 'Barangay Kagawad' }));
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
export function buildNotes(F, N = {}, { lgu, mun, audit }) {
  const y = F.y, yp = F.yp, name = `Barangay ${lgu.name}`;
  const { list, by, num } = presentNotes(F);
  const blocks = [];
  blocks.push({ k: 'head', lines: [`${name}, ${mun.name}, Quirino`, 'Notes to Financial Statements'], sub: `For the Year Ended December 31, ${y}` });
  blocks.push({ k: 'h', t: '1. General Information' });
  // Balligui form: where the barangay is, its services, its workforce, the Punong Barangay and the Sanggunian (from Setup).
  // From Audit Setup (step 4), with what was typed in Part 07 before as the fallback.
  const NI = { ...N, ...Object.fromEntries(Object.entries((audit && audit.notesInfo) || {}).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')) };
  const iss = String(NI.issued || '').trim(), issued = /^\d{4}-\d{2}-\d{2}$/.test(iss) ? longDate(iss) : iss, loc = String(NI.loc || '').trim();
  const wf = String(NI.workforce ?? '').trim() || N1_WORKFORCE;
  const pb = punongBarangay(audit || {}), pbName = [pb.title, pb.name].filter(Boolean).join(' ').trim();
  const sg = sanggunian(audit || {});
  const elective = 1 + sg.filter((k) => /kagawad/i.test(k.pos)).length;
  blocks.push({ k: 'p', t: `The financial statements of ${name} were issued${issued ? ` on ${issued}` : ''}. ${lgu.name} is located ${loc ? `in ${loc}` : `in ${mun.name}, Quirino`}. The Barangay exercises the following functions and responsibilities for the efficient and effective delivery of basic services such as: ${N1_SERVICES}. The total workforce of the Barangay consists of ${inWords(elective)} elective officials, ${wf}. It is headed by ${pbName || 'the Punong Barangay'}${sg.length ? ' and the Barangay Sanggunian are as follows:' : '.'}`, keep: !!sg.length });
  if (sg.length) blocks.push({ k: 'list', rows: sg.map((k, i) => ({ n: i + 1, t: k.name, pos: k.pos })) });
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
      blocks.push({ k: 'h3', t: `${no})  ${n.title}`, keep: true });
      blocks.push({ k: 'p', t: `The details of Property, Plant and Equipment are shown in the schedule of movements at the end of these notes.`, });
      ppe = { no, title: n.title, cols: ppeSchedule(F, N.ppe || {}), y, yp, total: [sum(acctRows(xs), 0), sum(acctRows(xs), 1)] };
      return;
    }
    blocks.push({ k: 'h3', t: `${no})  ${n.title}`, keep: true });
    if (n.text) blocks.push({ k: 'p', t: n.text(), keep: true });
    if (n.km) {
      blocks.push({ k: 'pc', t: 'a. Employees', keep: true });
      blocks.push({ k: 'pc', t: 'This includes the cost of personal services for employees of the barangay', keep: true });
      blocks.push(tbl(acctRows(xs), true));
      blocks.push({ k: 'pi2', t: 'b. Remuneration of key management personnel', keep: true });
      blocks.push({ k: 'p', t: "This represents the honoraria, year-end bonus, cash gift, Other Bonuses and Allowances and Terminal Leave Benefits of the agency's key management personnel.", keep: true });
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
    checks.push(issued ? { st: 'ok', t: `Note 1: date issued (${issued})` } : { st: 'warn', t: 'Note 1: date the financial statements were issued, not yet in Setup' });
    checks.push(loc ? { st: 'ok', t: 'Note 1: location of the barangay' } : { st: 'warn', t: 'Note 1: location of the barangay, not yet in Setup' });
    checks.push(pbName && pb.name ? { st: 'ok', t: `Note 1: headed by ${pbName} (from Setup)` } : { st: 'warn', t: 'Note 1: no Punong Barangay in Setup' });
    checks.push(sg.length ? { st: 'ok', t: `Note 1: ${sg.length} members of the Sanggunian (from Setup)` } : { st: 'warn', t: 'Note 1: no Kagawads in Setup' });
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
.nts{font-family:'Times New Roman',Tinos,Times,serif;font-size:11pt;line-height:1.3;color:#000}
.nts .head{text-align:center;margin:0 0 .25in}.nts .head b{display:block}
.nts .h{font-weight:700;margin:10pt 0 6pt}
.nts .h2{margin:8pt 0 3pt}
.nts .h3{font-weight:700;margin:10pt 0 4pt}
.nts p{margin:0 0 6pt;text-align:justify}
.nts p.tight{margin-top:0}
.nts .pi{font-style:italic;margin:4pt 0 0}
.nts .pc{margin:2pt 0 4pt}
.nts .pi2{margin:8pt 0 4pt}
.nts table.amt{width:100%;border-collapse:collapse;table-layout:fixed;margin:2pt 0 10pt}
.nts table.amt th,.nts table.amt td{border:1px solid #000;padding:2pt 5pt;vertical-align:middle}
.nts table.amt th{font-weight:700;text-align:center;background:#F2F2F2}
.nts table.amt td.py{border-right:0;padding-right:0}
.nts table.amt td.a{border-left:0;text-align:right;white-space:nowrap}
.nts table.amt tr.tot td{font-weight:700}
.nts table.lst{width:auto;margin:0 0 8pt .3in;border-collapse:collapse}.nts table.lst td{padding:0 12pt 0 0}
.fsp.land{width:11in;height:8.5in;padding:.75in .7in .8in}
.ppe{font-family:'Times New Roman',Tinos,Times,serif;font-size:8.5pt;line-height:1.2;color:#000}
.ppe .h3{font-size:11pt;font-weight:700;margin:0 0 8pt}
.ppe table{width:100%;border-collapse:collapse;table-layout:fixed}
.ppe td,.ppe th{border:1px solid #000;padding:1.5pt 3pt;font-weight:400;vertical-align:bottom}
.ppe th{text-align:center;font-weight:700}
.ppe td.a{text-align:right;white-space:nowrap}
.ppe tr.b td{font-weight:700}
.paper-wrap .sheet.fsheet.land{width:11in;height:8.5in}
`;
// Lines a block takes, to lay out pages (about 48 lines a page).
const CAP = 43, W = 92;
const lines = (b) => {
  if (b.k === 'list') return b.rows.length + 0.5;
  if (b.k === 'head') return 4.5;
  if (b.k === 'table') return 1.6 + b.rows.reduce((s, r) => s + Math.max(1, Math.ceil(r.t.length / 52)) * 1.1, 0);
  const n = Math.max(1, Math.ceil(String(b.t).length / W));
  return n + (b.k === 'h' || b.k === 'h3' ? 1.2 : b.k === 'h2' ? 0.8 : 0.5);
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
        const room = Math.floor((CAP - used - 1.6) / 1.1);
        if ((room < Math.min(3, rows.length) || (b.rows.length <= 8 && rows === b.rows && room < rows.length)) && cur.length) { flush(); continue; }
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
      need += x.k === 'table' ? 1.6 + (x.rows.length <= 8 ? x.rows.length : 3) * 1.1 : lines(x);
      if (!x.keep || x.k === 'table') break;
      j++;
    }
    if (used + need > CAP && cur.length) flush();
    cur.push(b); used += lines(b);
  }
  flush();
  return pages.length ? pages : [[]];
}
// Amounts like the statements (Balligui form): ₱ on the first amount and on the total; the total ruled above and double-ruled below.
const amtRow = (r, i) => {
  const peso = (i === 0 || r.tot) ? '₱' : '';
  const cell = (v) => `<td class="py">${v === null || v === undefined ? '' : peso}</td><td class="a">${v === null || v === undefined ? '' : money(v, { dash: '-' })}</td>`;
  return `<tr class="${r.tot ? 'tot' : ''}"><td>${escH(r.t)}</td>${cell(r.v[0])}${cell(r.v[1])}</tr>`;
};
const blockHTML = (b) => {
  const tx = escH(b.t);
  if (b.k === 'head') return `<div class="head">${b.lines.map((x) => `<b>${escH(x)}</b>`).join('')}${escH(b.sub)}</div>`;
  if (b.k === 'h') return `<div class="h">${tx}</div>`;
  if (b.k === 'h2') return `<div class="h2">${tx}</div>`;
  if (b.k === 'h3') return `<div class="h3">${tx}</div>`;
  if (b.k === 'pi') return `<div class="pi">${tx}</div>`;
  if (b.k === 'pc') return `<div class="pc">${tx}</div>`;
  if (b.k === 'pi2') return `<div class="pi2">${tx}</div>`;
  if (b.k === 'list') return `<table class="lst"><tbody>${b.rows.map((r) => `<tr><td>${r.n}.</td><td>${escH(r.t)}</td><td>${escH(r.pos)}</td></tr>`).join('')}</tbody></table>`;
  if (b.k === 'table') return `<table class="amt"><colgroup><col><col style="width:.22in"><col style="width:1.15in"><col style="width:.22in"><col style="width:1.15in"></colgroup>
    <thead><tr><th></th><th colspan="2">${b.cols[0]}</th><th colspan="2">${b.cols[1]}</th></tr></thead><tbody>
    ${b.rows.map((r, i) => amtRow(r, b.cont ? -1 : i)).join('')}</tbody></table>`;
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
  return `<div class="fsp land"><div class="ppe"><div class="h3">${p.no})  ${escH(p.title)}</div><table><colgroup><col style="width:1.25in"></colgroup><thead>${head}</thead><tbody>${body}</tbody></table></div>${page ? `<div class="pno" style="left:.7in;right:.7in">${page}</div>` : ''}</div>`;
}
// All of Part 07 as pages: { html: [page…], count, ppePage }.
export function notesPagesHTML(doc, start) {
  const pages = notesPages(doc.blocks);
  const ppePage = doc.ppe && start ? start + pages.length : '';
  const out = pages.map((p, i) => `<div class="fsp"><div class="nts">${p.map((b) => blockHTML(b)).join('')}</div>${start ? `<div class="pno">${start + i}</div>` : ''}</div>`);
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
  const A = (tx, o = {}) => new TextRun({ text: tx, font: 'Times New Roman', size: o.size || 22, bold: !!o.b, italics: !!o.i });
  const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const nob = { top: NONE, bottom: NONE, left: NONE, right: NONE };
  const dbl = { style: BorderStyle.DOUBLE, size: 6, color: '000000' };
  const line = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const all = { top: line, bottom: line, left: line, right: line };
  const footer = () => new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: 'Times New Roman', size: 22 })] })] });
  const pages = notesPages(doc.blocks);
  const ppePage = doc.ppe && start ? start + pages.length : '';
  const cell = (tx, w, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: all, margins: { left: 60, right: 60 }, columnSpan: o.span,
    children: [new Paragraph({ alignment: o.al || AlignmentType.LEFT, children: [A(tx, { b: o.b, size: o.size })] })] });
  const kids = [];
  const pc = (kids, w, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: { ...nob, ...(o.bd || {}) }, margins: { top: 10, bottom: 10, left: 0, right: 0 },
    children: [new Paragraph({ keepNext: !!o.keep, alignment: o.al || AlignmentType.LEFT, indent: o.ind ? { left: o.ind } : undefined, children: kids })] });
  doc.blocks.forEach((b) => {
    const tx = b.t;
    if (b.k === 'head') {
      b.lines.forEach((x) => kids.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [A(x, { b: true })] })));
      kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [A(b.sub)] }));
      return;
    }
    if (b.k === 'list') {
      const Wd = [500, 4200, 3600];
      const c = (t2, w) => pc([A(t2)], w);
      kids.push(new Table({ width: { size: 8300, type: WidthType.DXA }, columnWidths: Wd, indent: { size: 432, type: WidthType.DXA }, borders: { ...nob, insideHorizontal: NONE, insideVertical: NONE },
        rows: b.rows.map((r) => new TableRow({ cantSplit: true, children: [c(`${r.n}.`, Wd[0]), c(r.t, Wd[1]), c(r.pos, Wd[2])] })) }), new Paragraph({ spacing: { after: 120 }, children: [] }));
      return;
    }
    if (b.k === 'table') {
      const Wd = [5140, 300, 1630, 300, 1630];   // 9,000 = 6.25"
      const K = { keep: true };   // a table stays on one page in Word (each row kept with the next)
      const g = (o = {}) => ({ top: line, bottom: line, left: o.l === false ? NONE : line, right: o.r === false ? NONE : line });
      const gc = (kids2, w, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: g(o), columnSpan: o.span, shading: o.fill ? { fill: o.fill } : undefined, margins: { top: 30, bottom: 30, left: o.l === false ? 0 : 90, right: o.r === false ? 0 : 90 },
        children: [new Paragraph({ keepNext: !!o.keep, alignment: o.al || AlignmentType.LEFT, children: kids2 })] });
      const rows = [new TableRow({ tableHeader: true, cantSplit: true, children: [gc([], Wd[0], { fill: 'F2F2F2', ...K }), gc([A(String(b.cols[0]), { b: true })], Wd[1] + Wd[2], { span: 2, al: AlignmentType.CENTER, fill: 'F2F2F2', ...K }), gc([A(String(b.cols[1]), { b: true })], Wd[3] + Wd[4], { span: 2, al: AlignmentType.CENTER, fill: 'F2F2F2', ...K })] })];
      b.rows.forEach((r, i) => {
        const peso = (i === 0 && !b.cont) || r.tot, kp = i < b.rows.length - 1 && b.rows.length <= 20;
        const cells = [gc([A(r.t, { b: r.tot })], Wd[0], { keep: kp })];
        r.v.forEach((v, j) => {
          const has = v !== null && v !== undefined;
          cells.push(gc([A(has && peso ? '₱' : '', { b: r.tot })], Wd[1 + j * 2], { r: false, keep: kp }));
          cells.push(gc([A(has ? money(v, { dash: '-' }) : '', { b: r.tot })], Wd[2 + j * 2], { l: false, al: AlignmentType.RIGHT, keep: kp }));
        });
        rows.push(new TableRow({ cantSplit: true, children: cells }));
      });
      kids.push(new Table({ width: { size: 9000, type: WidthType.DXA }, columnWidths: Wd, rows }), new Paragraph({ spacing: { after: 160 }, children: [] }));
      return;
    }
    const sp = { h: { before: 200, after: 120 }, h2: { before: 160, after: 60 }, h3: { before: 200, after: 80 } }[b.k] || { after: 120 };
    kids.push(new Paragraph({ keepNext: !!b.keep, spacing: sp, alignment: b.k === 'p' ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
      children: [A(tx, { b: b.k === 'h' || b.k === 'h3', i: b.k === 'pi' })] }));
  });
  const out = [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1152, right: 1440, bottom: 1296, left: 1800, header: 0, footer: 720 }, pageNumbers: start ? { start } : undefined } },
    footers: start ? { default: footer() } : undefined, children: kids }];
  if (doc.ppe) {
    const p = doc.ppe, n = p.cols.length;
    const first = 2000, rest = Math.floor((14400 - 1440 - first) / (n + 1));
    const Wd = [first, ...Array(n + 1).fill(rest)];
    const c = (tx, w, o = {}) => cell(tx, w, { ...o, size: 17 });
    const rows = [new TableRow({ tableHeader: true, children: [c('Cost', Wd[0]), ...p.cols.map((x, i) => c(x.label, Wd[i + 1])), c('Total', Wd[n + 1])] }),
      ...ppeRows(p).slice(1).map((r) => r.head ? new TableRow({ children: [c(r.t, Wd.reduce((s, w) => s + w, 0), { b: true, span: n + 2 })] })
        : new TableRow({ cantSplit: true, children: [c(r.t, Wd[0], { b: r.b }), ...r.v.map((v, i) => c(v ? money(v, { dash: '' }) : '', Wd[i + 1], { al: AlignmentType.RIGHT, b: r.b }))] }))];
    out.push({ properties: { page: { size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1080, right: 720, bottom: 1080, left: 720, header: 0, footer: 576 } } },
      footers: start ? { default: footer() } : undefined,
      children: [new Paragraph({ spacing: { after: 160 }, children: [A(`${p.no})  ${p.title}`, { b: true })] }), new Table({ width: { size: Wd.reduce((s, w) => s + w, 0), type: WidthType.DXA }, columnWidths: Wd, rows })] });
  }
  return out;
}
export const notesFileName = (audit, lgu, mun) => `${String(lgu.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_${String(mun.name).toUpperCase().replace(/[^A-Z0-9]+/g, '')}_BAAR_${audit.auditYear}_07_Notes_to_FS`;
