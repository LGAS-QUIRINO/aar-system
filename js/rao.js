// The budget for the Statement of Comparison of Budget and Actual Amounts, read from Excel files.
//   RAO (Registry of Appropriations and Obligations): each sheet has the rows APPROPRIATIONS (current year), C.R.O
//   (continuing), EXPENDITURES (obligations) and BALANCE; each column is one item.
//   Annual Budget / Supplemental Budget: rows of item names with amounts; the column to use is chosen.
// Only the values are kept, never the file.
import { loadScript } from './wp.js';
import { parseAmt, cents, SCBAA } from './fs.js';
import { normTitle, similar } from './coa.js';

const txt = (c) => (c ? String(c.w !== undefined ? c.w : c.v !== undefined ? c.v : '').trim() : '');
const num = (c) => {
  if (!c || c.v === undefined || c.v === null || c.v === '') return null;
  if (typeof c.v === 'number') return c.v;
  const n = parseAmt(c.v);
  return n === null || isNaN(n) ? null : n;
};
const peso = (n) => cents(n || 0) / 100;
const up = (s) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();

async function sheetsOf(file) {
  if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) throw new Error('Choose an Excel file (.xlsx or .xls).');
  const XLSX = await loadScript('lib/xlsx.full.min.js', 'XLSX');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, cellNF: true, cellText: true, bookVBA: false });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    if (!ws || !ws['!ref']) return { name, empty: true };
    const rg = XLSX.utils.decode_range(ws['!ref']);
    return { name, rg, at: (r, c) => ws[XLSX.utils.encode_cell({ r, c })] };
  });
}

// Statutory sheets go to their row as a whole.
export const STAT_SHEETS = [[/^\s*20\s*%|development fund/i, '20% Development Fund'], [/^\s*5\s*%|drrm/i, '5% LDRRMF'], [/^\s*10\s*%|\bsk\b/i, '10% SK allocation'],
  [/bcpc|children/i, '1% Barangay Council for the Protection of Children'], [/^\s*1\s*%|senior|elderly|pwd/i, '1% for the Elderly and Disabled']];
export const statRowOf = (sheet) => { const x = STAT_SHEETS.find(([re]) => re.test(sheet)); return x ? SCBAA.find((r) => r.t === x[1]) : null; };

/* ── RAO ── */
export async function readRao(file) {
  const out = { sheets: [], fileYear: null, barangay: '' };
  const years = {};
  for (const sh of await sheetsOf(file)) {
    if (sh.empty) continue;
    const { rg, at } = sh;
    // the PARTICULARS column and its header row
    let hr = -1, pc = -1;
    for (let r = rg.s.r; r <= Math.min(rg.e.r, rg.s.r + 15) && hr < 0; r++) for (let c = rg.s.c; c <= Math.min(rg.e.c, 8); c++) if (/^PARTICULARS/.test(up(txt(at(r, c))))) { hr = r; pc = c; break; }
    for (let r = rg.s.r; r <= Math.min(rg.e.r, 5); r++) { const t = up(txt(at(r, 0))); if (/^BARANGAY/.test(t)) out.barangay = out.barangay || txt(at(r, 1)); }
    if (hr < 0) { out.sheets.push({ name: sh.name, ok: false, reason: 'no PARTICULARS column' }); continue; }
    const rowOf = {};
    for (let r = hr + 1; r <= rg.e.r; r++) {
      const t = up(txt(at(r, pc)));
      if (!t) continue;
      if (/^APPROPRIATION/.test(t) && rowOf.ap === undefined) { rowOf.ap = r; const m = t.match(/(20\d\d)/); if (m) years[m[1]] = (years[m[1]] || 0) + 5; }
      else if (/^BEGINNING\s*BAL/.test(t) && rowOf.beg === undefined) rowOf.beg = r;
      else if (/^C\.?\s*R\.?\s*O\b/.test(t)) rowOf.cro = r;
      else if (/EXPEND/.test(t)) rowOf.exp = r;
      else if (/^BALANCE/.test(t)) rowOf.bal = r;
    }
    // the year from the JEV / voucher numbers
    for (let r = hr + 1; r <= rg.e.r; r++) for (let c = 0; c < pc; c++) { const m = txt(at(r, c)).match(/^(20\d\d)-\d/); if (m) years[m[1]] = (years[m[1]] || 0) + 1; }
    if (rowOf.ap === undefined && rowOf.beg !== undefined) rowOf.ap = rowOf.beg;   // some sheets give the appropriation as "Beginning Balance"
    if (rowOf.ap === undefined || rowOf.exp === undefined) { out.sheets.push({ name: sh.name, ok: false, reason: 'a different layout (no APPROPRIATIONS or EXPENDITURES row)' }); continue; }
    const items = [];
    let commit = null;
    for (let c = pc + 1; c <= rg.e.c; c++) {
      const head = up(txt(at(hr, c)));
      if (/^BALANCE/.test(head)) continue;
      if (/TOTAL|COMMIT/.test(head)) { if (commit === null) commit = num(at(rowOf.exp, c)); continue; }
      let label = txt(at(hr, c));
      for (let r = hr + 1; !label && r < rowOf.ap; r++) label = txt(at(r, c));
      let group = '';
      for (let r = hr - 1; r >= Math.max(0, hr - 3) && !group; r--) for (let cc = c; cc > pc && !group; cc--) group = txt(at(r, cc));
      const ap = num(at(rowOf.ap, c)), cro = rowOf.cro !== undefined ? num(at(rowOf.cro, c)) : null, exp = num(at(rowOf.exp, c)), bal = rowOf.bal !== undefined ? num(at(rowOf.bal, c)) : null;
      if (!ap && !cro && !exp) continue;
      items.push({ label: label.replace(/\s+/g, ' ') || `Column ${c + 1}`, group: group.replace(/\s+/g, ' '), ap: peso(ap), cro: peso(cro), exp: peso(exp), bal: bal === null ? null : peso(bal) });
    }
    const tot = items.reduce((t, x) => ({ ap: t.ap + cents(x.ap), cro: t.cro + cents(x.cro), exp: t.exp + cents(x.exp) }), { ap: 0, cro: 0, exp: 0 });
    out.sheets.push({ name: sh.name, ok: true, items, commit: commit === null ? null : peso(commit), total: { ap: tot.ap / 100, cro: tot.cro / 100, exp: tot.exp / 100 } });
  }
  const ys = Object.entries(years).sort((a, b) => b[1] - a[1]);
  out.fileYear = ys.length ? Number(ys[0][0]) : null;
  if (!out.sheets.some((s) => s.ok)) throw new Error('No sheet of this file looks like an RAO (PARTICULARS, APPROPRIATIONS and EXPENDITURES rows).');
  return out;
}

// What the RAO shows that may be a finding: obligations more than the appropriation, and totals that don't add up.
export function raoFlags(rao) {
  const out = [];
  if (!rao) return out;
  rao.sheets.filter((s) => s.ok).forEach((s) => {
    s.items.forEach((x) => {
      const ap = cents(x.ap) + cents(x.cro), ex = cents(x.exp);
      if (ex > ap) out.push({ kind: ap ? 'over' : 'noap', sheet: s.name, label: x.label, ap, exp: ex, over: ex - ap });
    });
    if (s.commit !== null && s.commit !== undefined && cents(s.commit) !== cents(s.total.exp)) out.push({ kind: 'total', sheet: s.name, commit: cents(s.commit), sum: cents(s.total.exp), diff: cents(s.total.exp) - cents(s.commit) });
  });
  return out;
}

/* ── Annual Budget / Supplemental Budget ── */
// Rows with a name and amounts; columns described by the text above them.
export async function readBudget(file) {
  const sheets = [];
  for (const sh of await sheetsOf(file)) {
    if (sh.empty) continue;
    const { rg, at } = sh;
    const rows = [], cnt = {}, head = {};
    for (let r = rg.s.r; r <= rg.e.r; r++) {
      let label = '', lc = -1;
      for (let c = rg.s.c; c <= Math.min(rg.e.c, rg.s.c + 6); c++) { const t = txt(at(r, c)); if (/[a-z]{3}/i.test(t) && num(at(r, c)) === null) { label = t; lc = c; break; } }
      if (!label) continue;
      const vals = {};
      for (let c = lc + 1; c <= rg.e.c; c++) { const n = num(at(r, c)); if (n !== null && Math.abs(n) >= 1 && !(n >= 1900 && n <= 2100 && Number.isInteger(n))) { vals[c] = peso(n); cnt[c] = (cnt[c] || 0) + 1; } }
      if (Object.keys(vals).length) rows.push({ label: label.replace(/\s+/g, ' '), vals });
      else for (let c = lc; c <= rg.e.c; c++) { const t = txt(at(r, c)); if (t && c > lc) head[c] = ((head[c] || '') + ' ' + t).trim().slice(-80); }
    }
    const cols = Object.keys(cnt).map(Number).filter((c) => cnt[c] >= 2).sort((a, b) => a - b).map((c) => ({ c, head: head[c] || `Column ${String.fromCharCode(65 + (c % 26))}`, n: cnt[c] }));
    if (rows.length && cols.length) sheets.push({ name: sh.name, cols, rows });
  }
  if (!sheets.length) throw new Error('No rows with item names and amounts were found in this file.');
  return { sheets };
}
// The column a budget probably uses: the one whose heading names the year, else the last one with many amounts.
export function defaultCol(sheet, year) {
  const y = sheet.cols.find((c) => c.head.includes(String(year)) && /budget\s*year|proposed|approved/i.test(c.head)) || sheet.cols.find((c) => c.head.includes(String(year)) && !/past|actual|current/i.test(c.head)) || sheet.cols.find((c) => c.head.includes(String(year)) && !/past|actual/i.test(c.head));
  if (y) return y.c;
  const most = Math.max(...sheet.cols.map((c) => c.n));
  return sheet.cols.filter((c) => c.n >= most * 0.6).pop().c;
}

/* ── Matching an item name to a row of the statement ── */
const KW = [
  [/honorari/, 'ps', 'Honoraria'], [/cash gift/, 'ps', 'Cash Gift'], [/pag-?ibig|philhealth|gsis|\becc\b|contribution/, 'ps', 'Personnel Benefit Contributions'],
  [/terminal leave/, 'ps', 'Terminal Leave Benefits'], [/year.?end|mid.?year|bonus/, 'ps', 'Year End Bonus'], [/clothing|uniform/, 'ps', 'Clothing/Uniform Allowance'],
  [/\bpera\b/, 'ps', 'Personal Economic Relief Allowance (PERA)'], [/productivity|\bpei\b/, 'ps', 'Productivity Incentive Allowance'],
  [/travel|\btev\b/, 'mooe', 'Traveling Expenses'], [/training|seminar/, 'mooe', 'Training Expenses'], [/office suppl|computer suppl/, 'mooe', 'Office Supplies Expenses'],
  [/accountable form/, 'mooe', 'Accountable Forms Expenses'], [/fuel|lubricant|gasoline/, 'mooe', 'Fuel, Oil and Lubricant Expenses'], [/medicine|drug/, 'mooe', 'Drugs and Medicines Expenses'],
  [/feeding|food|vegetable/, 'mooe', 'Food Supplies Expenses'], [/welfare goods/, 'mooe', 'Welfare Goods Expenses'], [/water (bill|expense)/, 'mooe', 'Water Expenses'],
  [/electric|light bill/, 'mooe', 'Electricity Expenses'], [/internet/, 'mooe', 'Internet Subscription Expenses'], [/telephone|mobile|communication/, 'mooe', 'Telephone Expenses'],
  [/postage|courier/, 'mooe', 'Postage and Courier Services'], [/auditing/, 'mooe', 'Auditing Services'], [/consultan/, 'mooe', 'Consultancy Services'],
  [/garbage|eswm|sanitar/, 'mooe', 'Environment/Sanitary Services'], [/janitor/, 'mooe', 'Janitorial Services'], [/other general/, 'mooe', 'Other General Services'],
  [/repair.*(building|bldg|hall|center)/, 'mooe', 'Repairs and Maintenance - Buildings and Other Structures'], [/repair.*(vehicle|transport|motor|patrol)/, 'mooe', 'Repairs and Maintenance - Transportation Equipment'],
  [/repair.*(equip|machin)/, 'mooe', 'Repairs and Maintenance - Machinery and Equipment'], [/repair.*(road|infra|drain|bridge|canal)/, 'mooe', 'Repairs and Maintenance - Infrastructure Assets'],
  [/fidelity|bond premium/, 'mooe', 'Fidelity Bond Premiums'], [/representation/, 'mooe', 'Representation Expenses'], [/labor|wages/, 'mooe', 'Labor and Wages'],
  [/rent|lease/, 'mooe', 'Rent/Lease Expenses'], [/membership|\bdues\b/, 'mooe', 'Membership Dues and Contributions to Organizations'], [/other suppl|supplies/, 'mooe', 'Other Supplies and Materials Expenses'],
  [/real property|\brpt\b/, 'rev', 'Real Property Tax'], [/business tax/, 'rev', 'Business Tax'], [/\bira\b|\bnta\b|internal revenue|national tax allot/, 'rev', 'Share from Internal Revenue Collections'],
  [/clearance|certification/, 'rev', 'Clearance and Certification Fees'], [/quarry|sand.*gravel/, 'rev', 'Share on the tax from sand, gravel and other quarry products'],
  [/cockpit|cockfight/, 'rev', 'Fees and Charges on commercial breeding of fighting cocks, cockfights and cockpits'], [/grant|donation/, 'rev', 'Grants and Donations in Cash']
];
const KW_CO = [[/titling|\bland\b|\blot\b/, 'Land'], [/building|hall|center|school|evac|station|stage|court|multi.?purpose|\bmp\b/, 'Buildings and Other Structures'],
  [/road|fmr|ftm|drain|riprap|bridge|canal|pathway|water system|street/, 'Infrastructure Assets'], [/vehicle|motor|patrol|ambulance/, 'Transportation Equipment'],
  [/furniture|fixture|book|chair|table/, 'Furniture, Fixtures and Books'], [/equipment|machin|computer|generator|printer|cctv/, 'Machinery and Equipment']];
const rowsIn = (sec) => SCBAA.filter((r) => !r.h && r.sec === sec);
const byTitle = (sec, t) => rowsIn(sec).find((r) => r.t === t);
const ITEM_ROWS = SCBAA.filter((r) => !r.h && r.sec !== 'stat').map((r) => ({ r, n: normTitle(r.t) }));
// → { k, how: 'name' | 'suggested' } or null. co: the sheet is the Capital Outlays sheet.
export function suggestRow(label, { co = false, rev = false } = {}) {   // rev: true revenue only, false expenses only, null either
  const t = String(label || '').toLowerCase();
  if (co) { const x = KW_CO.find(([re]) => re.test(t)); if (x) return { k: byTitle('co', x[1]).k, how: 'name' }; }
  const k = KW.find(([re, sec]) => re.test(t) && (rev === null || (rev ? sec === 'rev' : sec !== 'rev')));
  if (k) { const r = byTitle(k[1], k[2]); if (r) return { k: r.k, how: 'name' }; }
  const n = normTitle(label);
  let best = null;
  ITEM_ROWS.forEach(({ r, n: rn }) => { if (rev !== null && rev !== (r.sec === 'rev')) return; const s = similar(n, rn); if (!best || s > best.s) best = { r, s }; });
  if (best && best.s >= 0.8) return { k: best.r.k, how: 'name' };
  if (best && best.s >= 0.5) return { k: best.r.k, how: 'suggested' };
  if (!co) { const x = KW_CO.find(([re]) => re.test(t)); if (x) return { k: byTitle('co', x[1]).k, how: 'suggested' }; }
  return null;
}
export const memKey = (src, sheet, label) => `${src}|${String(sheet || '').toLowerCase().trim()}|${normTitle(label).join(' ')}`;
export const isCoSheet = (name) => /^c\.?\s*o\b|capital/i.test(name);

/**
 * Where each item goes: the choice made here, else the one remembered for this barangay, else by name.
 * Returns { k, how: 'chosen'|'remembered'|'name'|'suggested'|'' }; k 'skip' leaves the item out.
 */
export function placeOf(scb, mem, src, sheet, label) {
  const key = `${src}|${sheet}|${label}`;
  const m = (scb.map || {})[key];
  if (m) return { k: m, how: 'chosen', key };
  const r = (mem || {})[memKey(src, sheet, label)];
  if (r) return { k: r, how: 'remembered', key };
  if (/^(sub-?\s*)?total\b|grand total/i.test(String(label).trim())) return { k: 'skip', how: 'name', key };
  if (src === 'rao') { const st = statRowOf(sheet); if (st) return { k: st.k, how: 'name', key }; }
  const s = suggestRow(label, { co: isCoSheet(sheet), rev: src === 'rao' ? false : null });
  return s ? { ...s, key } : { k: '', how: '', key };
}

// The amounts the imported files give each row: { k: { ob, adj, act } } in pesos.
// Original Budget: the Annual Budget where it has the row, else the RAO (current year plus continuing). Adjustments: Supplemental Budgets.
// Actual: the RAO obligations.
export function autoLayer(scb, mem) {
  const ab = {}, sb = {}, rob = {}, ract = {};
  const add = (o, k, v) => { if (!k || k === 'skip') return; o[k] = (o[k] || 0) + cents(v); };
  const take = (src, o) => { const b = scb[src]; if (!b) return; b.rows.forEach((x) => { const p = placeOf(scb, mem, src, b.sheet, x.label); if (p.how !== 'suggested') add(o, p.k, x.amt); }); };
  take('ab', ab); take('sb', sb);
  if (scb.rao) scb.rao.sheets.filter((s) => s.ok).forEach((s) => {
    const st = statRowOf(s.name);
    if (st) { add(rob, st.k, cents(s.total.ap) / 100 + cents(s.total.cro) / 100); add(ract, st.k, s.total.exp); return; }
    s.items.forEach((x) => { const p = placeOf(scb, mem, 'rao', s.name, x.label); if (p.how === 'suggested') return; add(rob, p.k, cents(x.ap) / 100 + cents(x.cro) / 100); add(ract, p.k, x.exp); });
  });
  const out = {};
  const keys = new Set([...Object.keys(ab), ...Object.keys(sb), ...Object.keys(rob), ...Object.keys(ract)]);
  keys.forEach((k) => {
    const o = {};
    if (ab[k] !== undefined) o.ob = ab[k] / 100; else if (rob[k] !== undefined) o.ob = rob[k] / 100;
    if (sb[k] !== undefined) o.adj = sb[k] / 100;
    if (ract[k] !== undefined) o.act = ract[k] / 100;
    out[k] = o;
  });
  return out;
}

export const raoMapId = (lguId) => `raomap-${lguId}`;
