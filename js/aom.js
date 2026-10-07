// AOM core: blocks, placeholders, numbering, checks, and the document layout shared by
// the on-screen page, the printout and the Word file. Layout follows the issued Maddela AOMs
// (long bond 8.5" × 13", Times New Roman 12, 1" margins).
import { aomNo, aomRange, periodPhrase, upper, fullName, longDate, pad3, nice } from './format.js';

export const BLOCK_LABELS = {
  topic: 'Topic Sentence', criteria: 'Criteria', condition: 'Condition', paragraph: 'Paragraph', table: 'Table',
  subheading: 'Sub-heading', cause: 'Cause', effect: 'Effect', recommendation: 'Recommendation'
};
export const ADDABLE = ['criteria', 'condition', 'paragraph', 'table', 'subheading', 'cause', 'effect', 'recommendation'];

export const ST = { DRAFT: 'Draft', WITH_ATL: 'With ATL', ATL: 'Under ATL Review', WITH_SA: 'With SA', SA: 'Under SA Review', RETURNED: 'Returned', FINAL: 'Final' };
export const statusPill = (s) => ({ Draft: 'grey', 'With ATL': 'violet', 'Under ATL Review': 'violet', 'With SA': 'violet', 'Under SA Review': 'violet', Returned: 'warn', Final: 'ok' }[s] || 'grey');

export const clone = (x) => JSON.parse(JSON.stringify(x));
export const SECTIONS = { A: 'A · Financial Audit', B: 'B · Other Financial Related Issues' };

/* ───────── Values for [PLACEHOLDERS] ───────── */

export function setupVars(audit, lgu, mun) {
  const f = Number(audit.periodFrom), t = Number(audit.periodTo);
  const period = f === t ? String(t) : `${f} to ${t}`;
  // PERIOD_END_YEAR: the last year the audit covers (e.g. 2025 for Audit Year 2026). AUDIT_YEAR gives the same value and stays for older templates.
  // Years count back from the last year, so a template means the same years in a two- or three-year audit.
  const len = t - f + 1;
  return { PERIOD_END_YEAR: String(t), PRIOR_YEAR: String(t - 1), PRIOR_YEAR_2: String(t - 2), PERIOD_LENGTH: `${countWords(len)} year${len === 1 ? '' : 's'}`, AUDIT_YEAR: String(t), AUDIT_PERIOD: period, AUDIT_YEARS: period, BARANGAY: lgu ? lgu.name : '', MUNICIPALITY: mun ? mun.name : '' };
}
// Filled in by the app (not typed in the working paper): from Audit Setup, and TABLEn_ITEMS from the AOM Tables.
export const SETUP_VAR_NAMES = ['PERIOD_END_YEAR', 'PRIOR_YEAR', 'PRIOR_YEAR_2', 'AUDIT_YEAR', 'AUDIT_PERIOD', 'AUDIT_YEARS', 'PERIOD_LENGTH', 'BARANGAY', 'MUNICIPALITY', 'TABLE1_ITEMS', 'TABLE2_ITEMS', 'TABLE3_ITEMS'];
export const isTableVar = (n) => /^TABLE\d+_ITEMS$/.test(n);
// COA style for small numbers: 0 to 9 in words with the numeral, e.g. "two (2)"; 10 and up in numerals.
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
export const countWords = (n) => (n >= 0 && n <= 9 ? `${WORDS[n]} (${n})` : String(n));
// "A", "A and B", "A, B and C"
export const joinAnd = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
// Rows the app adds to a table it fills in: a "CY 2024" year heading, Sub-Total and Total rows.
export const isYearHead = (r) => /^CY \d{4}$/.test(String((r || [])[0] ?? '').trim()) && (r || []).slice(1).every((c) => !String(c ?? '').trim());
export const isCalcRow = (r) => isYearHead(r) || (r || []).some((c) => /^(sub-?total|total)$/i.test(String(c ?? '').trim()));
// A fixed table typed in the template (same in every AOM, e.g. a circular's sample format): one row per line,
// cells separated by a tab (pasted from Excel or Word) or by " | ".
export function fixedRows(b) {
  const lines = String((b && b.fixed) || '').split('\n').filter((l) => l.trim());
  if (!lines.length) return null;
  const rows = lines.map((l) => (l.includes('\t') ? l.split('\t') : l.split('|')).map((c) => c.trim()));
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => [...r, ...Array(w - r.length).fill('')]);
}
export const isFixedTable = (b) => !!fixedRows(b);
// The rows a table block prints: its fixed rows, or the working paper's table.
export function tableData(aom, b) {
  const fx = fixedRows(b);
  if (fx) return { rows: fx, sheet: 'fixed in the template', fixed: true };
  return ((aom && aom.wpData && aom.wpData.tables) || {})[b.n] || null;
}
// "Repeat for each year of AOM Table 1": a paragraph printed once per year group of the table (a., b., c.),
// with values worked out from that year's rows: [YEAR], [ROW_COUNT], [COUNT_<REMARK>] and [SUM_<COLUMN>].
export const isYearVar = (n) => /^(YEAR|ROW_COUNT|COUNT_[A-Z0-9_]+|SUM_[A-Z0-9_]+)$/.test(n);
const keyOf = (s) => String(s || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const amtOf = (c) => { const s = String(c ?? '').replace(/[₱,\s]/g, ''); const neg = /^\(.*\)$/.test(s); const v = Number(s.replace(/[()]/g, '')); return isNaN(v) || s === '' ? null : (neg ? -v : v); };
export function yearGroups(aom, n = 1) {
  const t = tableData(aom, { type: 'table', n });
  if (!t) return [];
  const cols = t.cols || (t.rows || [])[0] || [];
  let rows;
  if (t.data) rows = t.data.map((r) => ({ r, y: (/(?:19|20)\d\d/.exec(String(r[0] ?? '')) || [])[0] || '' }));
  else {   // a table read from Excel: years from its "CY 2024" headings or from its first column
    let cur = '';
    rows = [];
    (t.rows || []).slice(1).forEach((r) => {
      if (isYearHead(r)) { cur = /\d{4}/.exec(r[0])[0]; return; }
      if (isCalcRow(r)) return;
      rows.push({ r, y: (/(?:19|20)\d\d/.exec(String(r[0] ?? '')) || [])[0] || cur });
    });
  }
  const amtIdx = cols.map((h, i) => (/amount|total|balance|appropriation|disburs|utiliz|cost|₱/i.test(h) ? i : -1)).filter((i) => i >= 0);
  const remIdx = (() => { const i = cols.findIndex((h) => /remark|status/i.test(h)); return i >= 0 ? i : cols.length - 1; })();
  const remKeys = [...new Set(rows.map(({ r }) => keyOf(r[remIdx])).filter(Boolean))];
  const years = [...new Set(rows.map((x) => x.y))].filter(Boolean).sort();
  return years.map((y) => {
    const rs = rows.filter((x) => x.y === y).map((x) => x.r);
    const v = { YEAR: y, ROW_COUNT: countWords(rs.length) };
    remKeys.forEach((k) => { v['COUNT_' + k] = countWords(rs.filter((r) => keyOf(r[remIdx]) === k).length); });
    amtIdx.forEach((i) => { v['SUM_' + keyOf(cols[i])] = peso(rs.reduce((s, r) => s + (amtOf(r[i]) || 0), 0)); });
    return v;
  });
}
// [TABLE1_ITEMS] etc.: the first-column entries of each AOM Table (without the Total row), so the wording names
// exactly what the table shows.
export function tableVars(d) {
  const out = {};
  const tables = (d && d.wpData && d.wpData.tables) || {};
  Object.keys(tables).forEach((n) => {
    const rows = (tables[n].rows || []).slice(1).filter((r) => !isCalcRow(r)).map((r) => String((r || [])[0] ?? '').trim()).filter(Boolean);
    if (rows.length) out[`TABLE${n}_ITEMS`] = joinAnd(rows);
  });
  return out;
}
// The years of the audit period, oldest first, read from the Setup values.
export function periodYearList(vars) {
  const m = /(\d{4})(?:\s*to\s*(\d{4}))?/.exec(String((vars && vars.AUDIT_PERIOD) || (vars && vars.PERIOD_END_YEAR) || ''));
  if (!m) return [];
  const f = Number(m[1]), t = Number(m[2] || m[1]), out = [];
  for (let y = f; y <= t; y++) out.push(String(y));
  return out;
}
// A table block's planned columns ("Account, [EACH_YEAR]"): [EACH_YEAR] becomes one column per year of the period,
// other [PLACEHOLDERS] are filled from Setup. Returns null when the block has none.
export function plannedCols(block, vars) {
  const raw = String((block && block.cols) || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!raw.length) return null;
  return raw.flatMap((h) => (/^\[EACH_YEAR\]$/i.test(h) ? periodYearList(vars) : [fillText(h, vars || {})]));
}

const money = (n) => '₱' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Same rules as the workbook macro (FormatWPVariableValue), plus a few more money words.
export function formatVar(name, raw) {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim();
  const num = typeof raw === 'number' ? raw : (/^-?[\d,]+(\.\d+)?$/.test(s) ? Number(s.replace(/,/g, '')) : NaN);
  if (isNaN(num)) return s;
  const u = name.toUpperCase();
  if (u.includes('YEAR')) return String(Math.round(num));
  if (/NO_OF_|COUNT|DAYS|NUMBER|PPA_IMPLEMENTED|PPA_BUDGETED/.test(u)) return Math.round(num).toLocaleString('en-US');
  if (/RATE|PERCENT|PCT/.test(u)) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (/AMOUNT|BALANCE|COST|VALUE|TOTAL|BUDGET|UTILIZED|TAX|RECEIVABLE|APPROPRIATION|FUND/.test(u)) return money(num);
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ───────── The AOM's amount (title of the AOM and of BAAR Part II) ───────── */
const MONEY = /AMOUNT|BALANCE|COST|VALUE|TOTAL|BUDGET|UTILIZED|TAX|RECEIVABLE|APPROPRIATION|FUND/i;
const isMoneyName = (n) => MONEY.test(n) && !/YEAR|DAYS|NO_OF|COUNT|RATE|PERCENT/.test(n);
// Values for the title and the topic sentence: amounts follow the COA figures rule (see titleAmount).
export function topicVars(vars) {
  const out = { ...(vars || {}) };
  Object.keys(out).forEach((k) => {
    if (!isMoneyName(k)) return;
    const s = String(out[k] ?? '').trim();
    if (!/^-?₱?\s?-?[\d,]+(\.\d+)?$/.test(s)) return;
    const n = Number(s.replace(/[₱,\s]/g, ''));
    if (!isNaN(n)) out[k] = titleAmount(n);
  });
  return out;
}
// The amount placeholder "Automatic" picks: the first one in the topic sentence (or null).
export function autoAmountVar(d) {
  const topic = (d.blocks || []).find((b) => b.type === 'topic');
  return [...String((topic && topic.text) || '').matchAll(/\[([A-Z0-9_]+)\]/g)].map((m) => m[1]).find(isMoneyName) || null;
}
// The amount placeholders in an AOM's wording, in order (choices for the amount in the title).
export function moneyPlaceholders(d) {
  const names = [];
  const scan = (t) => { for (const m of String(t || '').matchAll(/\[([A-Z0-9_]+)\]/g)) if (isMoneyName(m[1]) && !names.includes(m[1])) names.push(m[1]); };
  (d.blocks || []).forEach((b) => { scan(b.lead); scan(b.text); (b.items || []).forEach(scan); });
  return names;
}
export const peso = (n) => '₱' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// The first money placeholder in the topic sentence, read from the working paper.
// The template can name the placeholder whose amount goes after the title (titleVar); 'NONE' = no amount in the title.
export function aomAmount(d) {
  if (d.titleVar === 'NONE') return null;
  const topic = (d.blocks || []).find((b) => b.type === 'topic');
  const vars = (d.wpData && d.wpData.vars) || {};
  const names = d.titleVar ? [d.titleVar] : [...String((topic && topic.text) || '').matchAll(/\[([A-Z0-9_]+)\]/g)].map((m) => m[1]).filter(isMoneyName);
  for (const n of names) {
    const raw = vars[n] && vars[n].raw;
    const num = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[₱,\s]/g, ''));
    if (raw !== undefined && raw !== '' && !isNaN(num)) return num;
  }
  return null;
}
// COA rule for figures in the topic sentence and title: below ₱100,000 the whole amount (₱30,570.72);
// from ₱100,000 up in millions, rounded to three decimals (₱5,285,690.72 → ₱5.286 million).
export function titleAmount(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  const v = Number(n);
  return Math.abs(v) >= 100000 ? `₱${(Math.round(v / 1000) / 1000).toFixed(3)} million` : '₱' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// A title that already carries an amount (typed, or a money placeholder) does not get it twice.
export const titleHasAmount = (title) => /₱|\bP\s?\d/.test(String(title || '')) || [...String(title || '').matchAll(/\[([A-Z0-9_]+)\]/g)].some((m) => MONEY.test(m[1]) && !/YEAR|DAYS|NO_OF|COUNT|RATE|PERCENT/.test(m[1]));

// Split text into runs: plain text, filled placeholders and missing placeholders.
export function fillRuns(text, vars) {
  const out = [];
  const re = /\[([A-Z0-9_]+)\]/g;
  let last = 0, m;
  const src = String(text || '');
  while ((m = re.exec(src))) {
    let before = src.slice(last, m.index);
    const name = m[1];
    const has = vars && vars[name] !== undefined && vars[name] !== '';
    let val = has ? String(vars[name]) : '';
    if (has && val.startsWith('₱') && before.endsWith('₱')) before = before.slice(0, -1);   // no double peso sign
    if (before) out.push({ t: before });
    out.push(has ? { t: val, filled: name } : { t: `[${name}]`, missing: name });
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ t: src.slice(last) });
  return boldMarks(out, src);
}
// Words typed between ** marks print in bold, e.g. **draw journal vouchers** (works within one paragraph).
// A lone ** with no closing mark stays as typed. Plain-text uses (titles, SAOR, Part III) simply drop the marks.
function boldMarks(runs, src) {
  const n = (src.match(/\*\*/g) || []).length;
  if (!n || n % 2) return runs;
  const out = [];
  let on = false;
  runs.forEach((r) => {
    if (r.filled || r.missing) { out.push(on ? { ...r, b: true } : r); return; }
    String(r.t).split('**').forEach((piece, i) => { if (i) on = !on; if (piece) out.push(on ? { ...r, t: piece, b: true } : { ...r, t: piece }); });
  });
  return out;
}
export const fillText = (text, vars) => fillRuns(text, vars).map((r) => r.t).join('');
export function placeholders(aom) {
  const names = new Set();
  const scan = (t) => String(t || '').replace(/\[([A-Z0-9_]+)\]/g, (_, n) => { names.add(n); return ''; });
  scan(aom.title);
  (aom.blocks || []).forEach((b) => {
    if (b.perYear) { String(b.text || '').replace(/\[([A-Z0-9_]+)\]/g, (_, n) => { if (!isYearVar(n)) names.add(n); return ''; }); return; }
    scan(b.text); scan(b.lead); (b.items || []).forEach(scan);
  });
  return [...names];
}

/* ───────── Numbering ───────── */

// Locked numbers stay; the rest follow in list order after the highest locked number, so later AOMs
// continue from the last approved one. Returns { id: { n, locked } }.
export function numberAoms(aoms) {
  const list = aoms.filter((a) => !a.deleted).sort((a, b) => (a.data.seq || 0) - (b.data.seq || 0));
  const out = {};
  let max = 0;
  list.forEach((a) => { if (a.data.number) max = Math.max(max, a.data.number); });
  const lockedNums = new Set(list.filter((a) => a.data.number).map((a) => a.data.number));
  let next = 1;
  list.forEach((a) => {
    if (a.data.number) { out[a.id] = { n: a.data.number, locked: true }; return; }
    while (lockedNums.has(next) || next <= max) next++;
    out[a.id] = { n: next++, locked: false };
  });
  // Without locked numbers the list simply runs 1, 2, 3…
  if (!max) { let i = 1; list.forEach((a) => { out[a.id] = { n: i++, locked: false }; }); }
  return out;
}
export function numberingCheck(nums) {
  const ns = Object.values(nums).map((x) => x.n).sort((a, b) => a - b);
  const dup = ns.filter((n, i) => i && ns[i - 1] === n);
  const gaps = [];
  for (let i = 1; i < ns.length; i++) for (let k = ns[i - 1] + 1; k < ns[i]; k++) gaps.push(k);
  return { ok: !dup.length && !gaps.length, dup, gaps, first: ns[0], last: ns[ns.length - 1] };
}

/* ───────── New AOM records ───────── */

export function fromTemplate(tpl) {
  const blocks = clone(tpl.blocks || []).map((b) => ({ ...b, id: bid() }));
  return { poolCode: tpl.code, poolVersion: tpl.version || 1, mode: 'Standard', title: tpl.title, section: tpl.section || 'B', area: tpl.area || '', wp: tpl.wp || '', ...(tpl.titleVar ? { titleVar: tpl.titleVar } : {}), ...(tpl.titleShow === false ? { titleShow: false } : {}), blocks };
}
export function blankAom() {
  return {
    poolCode: '', poolVersion: 0, mode: 'New', title: 'New Finding', section: 'B', area: '', wp: '',
    blocks: [{ type: 'topic', text: '' }, { type: 'criteria', lead: '', text: '', quoted: false }, { type: 'condition', text: '' },
      { type: 'effect', text: '' }, { type: 'recommendation', lead: '', items: [], text: 'We recommend that Management ' }].map((b) => ({ ...b, id: bid() }))
  };
}
export function newBlock(type) {
  const id = bid();
  if (type === 'criteria') return { id, type, lead: '', text: '', quoted: true };
  if (type === 'recommendation') return { id, type, lead: 'We recommend that Management:', items: ['', ''], text: '' };
  if (type === 'table') return { id, type, n: 1, annex: false, caption: '' };
  if (type === 'subheading') return { id, type, text: '' };
  return { id, type, text: '' };
}

/* ───────── Checks ───────── */

export function checks(aom, vars, audit) {
  const out = [];
  const miss = placeholders(aom).filter((n) => vars[n] === undefined || vars[n] === '');
  out.push(miss.length ? { st: 'bad', t: `${miss.length} value${miss.length > 1 ? 's' : ''} missing (shown in red in the preview): ${miss.map((m) => '[' + m + ']').join(', ')}. Import the working paper, or edit the sentence.` } : { st: 'ok', t: 'All values filled' });
  const texts = [aom.title, ...(aom.blocks || []).flatMap((b) => [b.text, b.lead, ...(b.items || [])])].filter(Boolean).map((t) => fillText(t, vars)).join('\n');
  const bare = texts.match(/(^|[^₱\d,.])\d{1,3}(,\d{3})+\.\d{2}\b/g);
  out.push(bare ? { st: 'warn', t: `Amount without a peso sign: ${bare.slice(0, 3).map((x) => x.replace(/^[^\d]/, '')).join(', ')}` } : { st: 'ok', t: 'Peso signs and number format' });
  const from = Number(audit.periodFrom), to = Number(audit.periodTo);
  const yrs = [...texts.matchAll(/\b(?:CYs?|FYs?|December 31,|year-end)\s*(\d{4})(?:\s*(?:to|and|-|–)\s*(\d{4}))?/gi)].flatMap((m) => [m[1], m[2]]).filter(Boolean).map(Number);
  const off = [...new Set(yrs.filter((y) => y < from || y > to))];
  out.push(off.length ? { st: 'warn', t: `Year outside the audit period (${from === to ? to : from + '–' + to}): ${off.join(', ')}` } : { st: 'ok', t: 'Year and period match the Audit Setup' });
  const tables = (aom.blocks || []).filter((b) => b.type === 'table' && !isFixedTable(b));
  const noData = tables.filter((b) => !((aom.wpData && aom.wpData.tables) || {})[b.n]);
  if (tables.length) out.push(noData.length ? { st: 'bad', t: `Table ${noData.map((b) => b.n).join(', ')} has no data. Import the working paper.` } : { st: 'ok', t: 'Tables imported from the working paper' });
  out.push({ st: 'wait', t: 'Amount vs. trial balance: shown for reference in BAAR Part 06 · FS Input' });
  return out;
}

/* ───────── Word-level difference (Draft vs. Corrected) ───────── */

export function diffWords(a, b) {
  const tok = (x) => String(x || '').split(/(\s+|[,.;:!?()“”"])/).filter((t) => t !== '');
  const A = tok(a), B = tok(b);
  const n = A.length, m = B.length;
  if (n * m > 400000) return [{ t: b, op: a === b ? '=' : '+' }];
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = []; let i = 0, j = 0;
  const push = (t, op) => { const l = out[out.length - 1]; if (l && l.op === op) l.t += t; else out.push({ t, op }); };
  while (i < n && j < m) {
    if (A[i] === B[j]) { push(A[i], '='); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) { push(A[i], '-'); i++; } else { push(B[j], '+'); j++; }
  }
  while (i < n) push(A[i++], '-');
  while (j < m) push(B[j++], '+');
  return out;
}
export const blockPlain = (b) => [b.lead, b.text, ...(b.items || [])].filter((x) => x !== undefined && x !== '').join('\n');

/* ───────── Review tracking: block ids, who changed what ───────── */

export const bid = () => 'b' + Math.random().toString(36).slice(2, 9);
// Every block gets a stable id so corrections and comments stay attached when blocks move.
// Older AOMs without ids get 'k' + position, the same on every device, so nothing breaks.
export function ensureIds(aom) {
  const fix = (list) => (list || []).forEach((b, i) => { if (!b.id) b.id = 'k' + i; });
  fix(aom.blocks);
  if (aom.submitted) fix(aom.submitted.blocks);
  if (aom.editedBy && Object.keys(aom.editedBy).some((k) => /^\d+$/.test(k))) {
    const e = {};
    Object.entries(aom.editedBy).forEach(([k, v]) => { const b = /^\d+$/.test(k) ? (aom.blocks || [])[+k] : null; e[b ? b.id : k] = v; });
    aom.editedBy = e;
  }
  aom.comments = (aom.comments || []).map((c, i) => ({ id: c.id || 'c' + i, replies: [], ...c }));
  return aom;
}
const baseOf = (aom, id) => ((aom.submitted && aom.submitted.blocks) || []).find((b) => b.id === id);
// Mark the blocks this person changed since the last save. With prune (when forwarding), blocks that match the
// wording the reviewer will compare against lose their mark.
export function stampEdits(prev, next, email, { prune = false } = {}) {
  const e = { ...(next.editedBy || prev.editedBy || {}) };
  const before = {}; (prev.blocks || []).forEach((b) => { before[b.id] = blockPlain(b); });
  (next.blocks || []).forEach((b) => { if (before[b.id] !== blockPlain(b)) e[b.id] = email; });
  if ((prev.title || '') !== (next.title || '')) e._title = email;
  if (prune && next.submitted) {
    Object.keys(e).forEach((k) => {
      if (k === '_title') { if (next.title === next.submitted.title) delete e[k]; return; }
      const cur = (next.blocks || []).find((b) => b.id === k), base = baseOf(next, k);
      if ((cur && base && blockPlain(cur) === blockPlain(base))) delete e[k];
    });
  }
  next.editedBy = e;
  return next;
}
// Keep a copy of the wording at every review step (forward, return, approve, final), for the Review Trail.
export function snapshot(d, step, email) {
  d.versions = [...(d.versions || []), { at: new Date().toISOString(), by: email, step, title: d.title, blocks: clone(d.blocks || []), editedBy: clone(d.editedBy || {}) }];
  return d;
}
// A comment is answered once someone other than its writer replies.
export const answered = (c) => (c.replies || []).some((r) => r.by !== c.by);
export const openComments = (aom, notBy) => (aom.comments || []).filter((c) => !c.resolved && !answered(c) && c.by !== notBy);

/* ───────── Document layout ───────── */
// Units: twips (1/1440 inch) as in Word.
const BODY = 993, SUB = 1440, QL = 1985, QR = 1242, QL_SUB = 2835, QR_SUB = 1269;

const P = (runs, o = {}) => ({ kind: 'p', runs: typeof runs === 'string' ? [{ t: runs }] : runs, ...o });
const BL = () => ({ kind: 'p', runs: [], blank: true });

function textParas(text, vars, o) {
  return String(text || '').split('\n').filter((l) => l.trim() !== '').map((line) => P(fillRuns(line.trim(), vars), { align: 'both', ...o }));
}
const withBlanks = (paras) => paras.flatMap((p, i) => (i ? [BL(), p] : [p]));

export function letterOf(i) { return String.fromCharCode(97 + i); }

// One finding's paragraphs. ctx: { vars, num (display number "1."), aomNoText, annexLetters (map n->letter) }
export function findingParas(aom, ctx) {
  const vars = ctx.vars || {};
  const out = [];
  out.push(P([{ t: 'AOM No. ' + ctx.aomNoText }], { bold: true }));
  out.push(BL());   // a blank line between the AOM No. and the finding title
  // The amount follows the title, the same as in BAAR Part II.
  const amt = aom.titleShow === false || titleHasAmount(aom.title) ? null : aomAmount(aom);
  const tv = topicVars(vars);
  out.push(P([...fillRuns(aom.title || '', tv), ...(amt !== null ? [{ t: ' - ' + titleAmount(amt) }] : [])], { italic: true }));
  out.push(BL());
  let subIdx = -1;
  (aom.blocks || []).forEach((b, bi) => {
    const inSub = !!b.sub && subIdx >= 0 && b.type !== 'subheading';
    const left = inSub ? SUB : BODY;
    const blockStart = out.length;
    if (b.type === 'topic') {
      out.push(P(fillRuns(b.text, tv), { bold: true, align: 'both', ind: { left: 567, hanging: 567 }, label: ctx.num }));
    } else if (b.type === 'criteria') {
      if (b.quoted) {
        if (b.lead && b.lead.trim()) { out.push(...textParas(b.lead, vars, { ind: { left } })); out.push(BL()); }
        const lines = String(b.text || '').split('\n').filter((l) => l.trim());
        lines.forEach((l, i) => {
          if (i > 0) out.push(BL());   // a blank line between quoted paragraphs, as in the other parts
          const runs = fillRuns(l.trim(), vars);
          if (i === 0) runs.unshift({ t: '“' });
          if (i === lines.length - 1) runs.push({ t: '”' });
          out.push(P(runs, { italic: true, align: 'both', ind: { left: inSub ? QL_SUB : QL, right: inSub ? QR_SUB : QR } }));
        });
      } else {
        const t = [b.lead, b.text].filter((x) => x && x.trim()).join('\n');
        out.push(...withBlanks(textParas(t, vars, { ind: { left } })));
      }
    } else if (b.type === 'table') {
      const tbl = tableData(aom, b);
      if (b.annex) {
        const L = (ctx.annexLetters || {})[aom._id + ':' + b.n] || 'A';
        out.push(P([{ t: `(See Annex ${L}${b.caption ? ' – ' + b.caption : ''})` }], { italic: true, ind: { left } }));
      } else if (tbl) {
        if (b.caption) out.push(P(fillRuns(b.caption, vars), { bold: true, align: 'center', ind: { left } }));
        out.push({ kind: 'table', rows: tbl.rows, left, source: tbl.sheet, n: b.n });
      } else {
        out.push(P([{ t: `[TABLE ${b.n}: import the working paper]`, missing: 'TABLE_' + b.n }], { ind: { left } }));
      }
    } else if (b.type === 'subheading') {
      subIdx++;
      out.push(P(fillRuns(b.text, vars), { bold: true, italic: true, ind: { left: 1418, hanging: 425 }, label: letterOf(subIdx) + ')' }));
    } else if (b.type === 'recommendation') {
      const items = (b.items || []).filter((x) => x !== undefined);
      if (items.length) {
        out.push(...textParas(b.lead || 'We recommend that Management:', vars, { bold: true, ind: { left } }));
        items.forEach((it, i) => { out.push(BL()); out.push(P(fillRuns(it, vars), { bold: true, align: 'both', ind: { left: left + 807, hanging: 360 }, label: letterOf(i) + '.' })); });
      } else {
        out.push(...withBlanks(textParas(b.text, vars, { bold: true, ind: { left } })));
      }
    } else if (b.perYear) {
      // Printed once per year of AOM Table 1, lettered a., b., c., with that year's values.
      const groups = yearGroups(aom, Number(b.perYearTable) || 1);
      if (!groups.length) out.push(...withBlanks(textParas(b.text, vars, { ind: { left } })));
      groups.forEach((g, gi) => {
        if (gi) out.push(BL());
        out.push(P(fillRuns(String(b.text || '').replace(/\s*\n\s*/g, ' ').trim(), { ...vars, ...g }), { align: 'both', ind: { left: left + 360, hanging: 360 }, label: letterOf(gi) + '.' }));
      });
    } else {
      out.push(...withBlanks(textParas(b.text, vars, { ind: { left } })));
    }
    if (out.length > blockStart) {
      out[blockStart].block = bi;                 // lets the screen link a paragraph back to its block
      if (bi < aom.blocks.length - 1) out.push(BL());
    }
  });
  return out;
}

// Whole AOM letter for one Barangay. info: { audit, lgu, mun, team, atl, sa, aoms (records, ordered), nums, varsFor(aom), draft }
export function buildLetter(info) {
  const { audit, lgu, mun, team, atl, sa, aoms, nums } = info;
  const list = aoms.slice().sort((a, b) => nums[a.id].n - nums[b.id].n);
  const first = list.length ? nums[list[0].id].n : 1, last = list.length ? nums[list[list.length - 1].id].n : 1;
  const rangeText = first === last ? aomNo(audit.auditYear, first, audit.periodFrom, audit.periodTo) : aomRange(audit.auditYear, first, last, audit.periodFrom, audit.periodTo);
  const addr = `${upper(lgu.name)}, ${upper(mun.name)}, QUIRINO`;
  const body = [];
  // Letterhead as in the team's template: seal on the left, name and office lines centered under it.
  body.push({ kind: 'letterhead', seal: { src: 'img/lh-seal.jpg', w: 1.1, h: 1.1, left: 0.53, top: -0.16 }, name: { src: 'img/lh-name.jpg', w: 3.0, h: 0.434 } });
  body.push(P('REGIONAL OFFICE NO. II', { bold: true, align: 'center' }));
  body.push(P('PROVINCE OF QUIRINO', { align: 'center' }));
  body.push(P('PROVINCIAL SATELLITE AUDITING OFFICE', { align: 'center' }));
  body.push(P('Capitol Hills, Cabarroguis, Quirino', { align: 'center', size: 18 }));
  body.push(BL());
  body.push(P('Office of the Auditor' + (team && team.officeCode ? ' – Audit Team ' + team.officeCode : ''), { bold: true, align: 'center', ruleBelow: true }));
  body.push(BL());
  body.push(P('AOM No. ' + rangeText, { ind: { left: 4770 } }));
  body.push(P('Date:  ' + (longDate(audit.aomDate) || '__________'), { ind: { left: 4770 } }));
  body.push(BL());
  body.push(P('AUDIT OBSERVATION MEMORANDUM', { bold: true, align: 'center', size: 32 }));
  body.push(BL()); body.push(BL());
  const officials = audit.officials || [];
  const pos = (o) => (o.acting ? 'Acting ' : '') + (o.pos || '');
  officials.filter((o) => o.role === 'For').forEach((o, i) => {
    if (i) body.push(BL());
    body.push(P(fullName(o) || '__________', { bold: true }));
    body.push(P(pos(o)));
    body.push(P(addr));
  });
  const att = officials.filter((o) => o.role === 'Attention');
  if (att.length) {
    body.push(BL());
    att.forEach((o, i) => {
      if (i) body.push(BL());
      body.push(P([{ t: i === 0 ? 'Attention:' : '' }, { t: '\t' }, { t: fullName(o) || '__________', b: true }], { ind: { left: 2880, hanging: 1440 } }));
      body.push(P(pos(o), { ind: { left: 2880 } }));
    });
  }
  body.push(BL());
  body.push(P(`We have reviewed and audited the financial transactions and other pertinent documents of the barangay ${periodPhrase(audit.periodFrom, audit.periodTo, true)} and observed the following deficiencies:`, { align: 'both', ind: { firstLine: 720 } }));

  // Annex letters for tables printed as annexes
  const annexes = [];
  const annexLetters = {};
  list.forEach((a) => (a.data.blocks || []).forEach((b) => {
    if (b.type === 'table' && b.annex) {
      const L = String.fromCharCode(65 + annexes.length);
      annexLetters[a.id + ':' + b.n] = L;
      annexes.push({ letter: L, aom: a, block: b });
    }
  }));

  list.forEach((a, i) => {
    body.push(BL()); body.push(BL());
    const n = nums[a.id].n;
    body.push(...findingParas({ ...a.data, _id: a.id }, { vars: info.varsFor(a), num: (i + 1) + '.', aomNoText: aomNo(audit.auditYear, n, audit.periodFrom, audit.periodTo), annexLetters }));
  });

  body.push(BL()); body.push(BL());
  // From "May we have your comments…" down to the Proof of Receipt table: kept on one page; if it does not fit, it all moves to the next page.
  const keepFrom = body.length;
  body.push({ kind: 'keepStart' });
  body.push(P('May we have your comments on the foregoing audit observation within five (5) calendar days upon receipt hereof.', { align: 'both', ind: { firstLine: 567 } }));
  const sig = (u, boldAll) => {
    if (!u) return;
    // A signature block (the space for signing, name, position, designation) is never split across pages.
    body.push(BL()); body.push({ ...BL(), keep: true }); body.push({ ...BL(), keep: true });
    body.push(P(upper(u.name), { bold: true, ind: { left: 4770 }, keep: true }));
    body.push(P(u.position || '', { bold: boldAll, ind: { left: 4770 }, keep: !!u.designation }));
    if (u.designation) body.push(P(u.designation, { bold: boldAll, ind: { left: 4770 } }));
  };
  const oneStep = atl && sa && atl.id === sa.id;
  if (!oneStep) sig(atl, false);   // only the name is bold
  sig(sa, false);
  body.push(BL()); body.push(BL());
  body.push(P('Proof of Receipt of AOM:', { bold: true, keep: true }));
  const rec = officials.filter((o) => o.role === 'For' || o.role === 'Attention');
  // The name column fits the longest name or position; Signature and Date share the rest of the 6.5" width.
  const rrows = rec.map((o) => [fullName(o), pos(o)]);
  const nameW = Math.min(5040, Math.max(2900, ...rrows.map(([n, p]) => Math.max(String(n).length * 128, String(p).length * 105)), 'Proof of Receipt of AOM'.length * 118) + 280);
  const sigW = Math.round((9360 - nameW) * 0.56);
  body.push({
    kind: 'table', receipt: true, widths: [nameW, sigW, 9360 - nameW - sigW],
    rows: [['Proof of Receipt of AOM', 'Signature', 'Date'], ...rrows.map((c) => [c, '', ''])], keepTogether: true
  });
  body.slice(keepFrom).forEach((p) => { if (p.kind === 'p') p.keep = true; });
  body.push({ kind: 'keepEnd' });

  const annexParts = annexes.map((x) => {
    const tbl = tableData(x.aom.data, x.block);
    return {
      letter: x.letter,
      paras: [
        P(fillRuns(x.block.caption || x.aom.data.title || '', info.varsFor(x.aom)), { align: 'center', bold: true }),
        P(lgu.name, { align: 'center' }), BL(),
        tbl ? { kind: 'table', rows: tbl.rows, left: 0 } : P('[Table not imported]', { align: 'center' })
      ]
    };
  });

  return {
    body, annexes: annexParts, draft: !!info.draft,
    footer: [`AOM No. ${rangeText}`, `Barangay ${lgu.name}, ${mun.name}, Quirino`],
    rangeText, fileName: `${upper(lgu.name).replace(/[^A-Z0-9]+/g, '')}_AOM-No.-${rangeText.replace(/[^0-9A-Za-z-]+/g, '-').replace(/-+/g, '-').replace(/-$/, '')}`
  };
}

/* ───────── HTML rendering ───────── */

const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tw = (v) => (v || 0) / 1440 + 'in';
const isNum = (s) => /^[(₱-]?\s*[\d,]+(\.\d+)?%?\)?$/.test(String(s).trim());

function runsHTML(runs, mark) {
  return runs.map((r) => {
    let t = escH(r.t).replace(/\t/g, '<span class="tab"></span>');
    if (r.b) t = `<b>${t}</b>`;
    if (mark && r.missing) return `<span class="ph-miss" title="No value yet for ${escH(r.missing)}. Import the working paper or edit this sentence.">${t}</span>`;
    if (mark && r.filled) return `<span class="ph-fill" title="${SETUP_VAR_NAMES.includes(r.filled) ? 'From Audit Setup' : 'From your working paper'} (${escH(r.filled)})">${t}</span>`;
    return t;
  }).join('');
}

export function paraHTML(p, mark = true) {
  if (p.kind === 'image') return `<div class="lh"><img src="${p.src}" alt="Commission on Audit letterhead" style="width:${p.w}in;height:${p.h}in"></div>`;
  if (p.kind === 'letterhead') return `<div class="lh2"><img class="seal" src="${p.seal.src}" alt="Commission on Audit seal" style="width:${p.seal.w}in;height:${p.seal.h}in;left:${p.seal.left}in;top:${p.seal.top}in"><img class="name" src="${p.name.src}" alt="Republic of the Philippines, Commission on Audit" style="width:${p.name.w}in;height:${p.name.h}in"></div>`;
  if (p.kind === 'keepStart') return '<div class="keepblk">';
  if (p.kind === 'keepEnd') return '</div>';
  if (p.kind === 'table') return tableHTML(p);
  if (p.blank) return `<p class="bl"${p.keep ? ' style="break-after:avoid;page-break-after:avoid"' : ''}>&nbsp;</p>`;
  const ind = p.ind || {};
  const st = [`margin-left:${tw(ind.left)}`, `margin-right:${tw(ind.right)}`];
  if (ind.firstLine) st.push(`text-indent:${tw(ind.firstLine)}`);
  if (ind.hanging) st.push(`text-indent:-${tw(ind.hanging)}`);
  if (p.align) st.push(`text-align:${p.align === 'both' ? 'justify' : p.align}`);
  if (p.size) st.push(`font-size:${p.size / 2}pt`);
  if (p.keep) st.push('break-after:avoid;page-break-after:avoid');   // stays on the same page as the next paragraph
  const cls = [p.bold ? 'b' : '', p.italic ? 'i' : '', p.ruleBelow ? 'rule-below' : ''].join(' ');
  let runs = p.runs, labelText = p.label;
  const tab = runs.findIndex((r) => r.t === '\t');
  if (tab >= 0 && ind.hanging) { labelText = runs.slice(0, tab).map((r) => r.t).join(''); runs = runs.slice(tab + 1); }
  const label = labelText !== undefined && (p.label || tab >= 0) ? `<span class="lbl" style="width:${tw(ind.hanging || 360)}">${escH(labelText)}</span>` : '';
  const blk = p.block !== undefined ? ` data-block="${p.block}"` : '';
  return `<p class="${cls}" style="${st.join(';')}"${blk}>${label}${runsHTML(runs, mark) || '&nbsp;'}</p>`;
}

function tableHTML(t) {
  if (t.receipt) {
    return `<table class="aom-t receipt"><colgroup>${t.widths.map((w) => `<col style="width:${tw(w)}">`).join('')}</colgroup>${t.rows.map((r, i) => `<tr>${r.map((c) => i === 0 ? `<th>${escH(c)}</th>` : `<td>${Array.isArray(c) ? `<b>${escH(c[0])}</b><br>${escH(c[1])}` : '&nbsp;'}</td>`).join('')}</tr>`).join('')}</table>`;
  }
  const rows = t.rows || [];
  return `<div style="margin-left:${tw(t.left)}"><table class="aom-t">${rows.map((r, i) => {
    const total = i > 0 && (/total/i.test(r.join(' ')) || isYearHead(r));
    return `<tr class="${total ? 'tot' : ''}">${r.map((c) => i === 0 ? `<th>${escH(c)}</th>` : `<td class="${isNum(c) ? 'num' : ''}">${escH(c)}</td>`).join('')}</tr>`;
  }).join('')}</table></div>`;
}

export function letterHTML(doc, mark = false) {
  return `<div class="aom-doc">${doc.draft ? '<div class="wm">DRAFT</div>' : ''}${doc.body.map((p) => paraHTML(p, mark)).join('')}
    ${doc.annexes.map((a) => `<div class="annex"><div class="annex-h">Annex ${a.letter}</div>${a.paras.map((p) => paraHTML(p, mark)).join('')}</div>`).join('')}</div>`;
}

export const DOC_CSS = `
.aom-doc{font-family:'Times New Roman',Tinos,Times,serif;font-size:12pt;line-height:1.15;color:#000;position:relative}
.aom-doc p{margin-top:0;margin-bottom:0;min-height:1em}
.aom-doc p.b{font-weight:700}.aom-doc p.i{font-style:italic}
.aom-doc .lbl{display:inline-block;text-indent:0}
.aom-doc .tab{display:inline-block;width:1in}
.aom-doc .lh{text-align:center;line-height:0}
.aom-doc .lh2{position:relative;text-align:center;line-height:0;margin-top:.16in}
.aom-doc .lh2 .seal{position:absolute;z-index:0;mix-blend-mode:multiply}
.aom-doc .lh2 ~ p{position:relative;z-index:1}
.aom-doc .lh2 .name{display:inline-block}
.aom-doc .lh img{display:inline-block}
.aom-doc p.rule-below{border-bottom:3px solid #000;padding-bottom:4pt;margin-bottom:6px;position:relative}
.aom-doc p.rule-below::after{content:'';position:absolute;left:0;right:0;bottom:-5px;border-bottom:1px solid #000}
.keepblk{break-inside:avoid;page-break-inside:avoid}
.aom-t{border-collapse:collapse;width:100%;font-size:11pt;margin:2pt 0}
.aom-t th,.aom-t td{border:1px solid #000;padding:2pt 5pt;vertical-align:top}
.aom-t th{font-weight:700;text-align:center}
.aom-t td.num{text-align:right;white-space:nowrap}
.aom-t tr.tot td{font-weight:700}
.aom-t.receipt td{height:auto;padding-top:3pt;padding-bottom:3pt}
.aom-t.receipt td b{white-space:nowrap}
.ph-fill{background:#E3F1E7;border-radius:2px}
.ph-miss{background:#FDE2E1;color:#9F1C1C;font-weight:700;border-radius:2px}
.annex{break-before:page;page-break-before:always}
.annex-h{text-align:right;margin-bottom:12pt}
.wm{position:fixed;top:45%;left:0;right:0;text-align:center;font:700 110pt Arial,sans-serif;color:rgba(0,0,0,.08);transform:rotate(-35deg);pointer-events:none;z-index:0}
`;
export { nice };
