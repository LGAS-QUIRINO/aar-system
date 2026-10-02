// Working paper import. The file stays on the auditor's computer; only the values are kept.
// Reads the VARIABLE / VALUE list (any sheet) and the sheets named "AOM Table 1", "AOM Table 2", …
// Same rules as the workbook macro.
const loaded = {};
export function loadScript(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (!loaded[src]) {
    loaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => (window[globalName] ? resolve(window[globalName]) : reject(new Error(src + ' did not load')));
      s.onerror = () => { delete loaded[src]; reject(new Error('Could not load ' + src + '. Open the app online once so it is saved for offline use.')); };
      document.head.appendChild(s);
    });
  }
  return loaded[src];
}

const cellText = (c) => (c ? String(c.w !== undefined ? c.w : c.v !== undefined ? c.v : '').trim() : '');

export async function readWorkingPaper(file) {
  const XLSX = await loadScript('lib/xlsx.full.min.js', 'XLSX');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false, cellNF: true, cellText: true, bookVBA: false });
  const vars = {}, rawVars = {}, tables = {}, notes = [];
  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    if (!ws || !ws['!ref']) return;
    const rg = XLSX.utils.decode_range(ws['!ref']);
    const at = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
    // VARIABLE / VALUE list
    let vh = null, nh = null;
    for (let r = rg.s.r; r <= Math.min(rg.e.r, rg.s.r + 200) && !vh; r++) {
      for (let c = rg.s.c; c <= rg.e.c; c++) {
        const t = cellText(at(r, c)).toUpperCase();
        if (t === 'VALUE') { vh = { r, c }; }
        if (t === 'VARIABLE' || t === 'VARIABLE NAME' || t === 'VARIABLES') nh = { r, c };
      }
    }
    if (vh) {
      const nameCol = nh && nh.r === vh.r ? nh.c : vh.c - 1;
      for (let r = vh.r + 1; r <= rg.e.r; r++) {
        const key = cellText(at(r, nameCol)).replace(/^\[|\]$/g, '').toUpperCase();
        if (!/^[A-Z][A-Z0-9_]*$/.test(key)) continue;
        const cell = at(r, vh.c);
        if (!cell || cell.v === undefined || cell.v === '') continue;
        rawVars[key] = cell.v;
        vars[key] = { raw: cell.v, text: cellText(cell), sheet: name };
      }
    }
    // AOM Table n
    const m = /^AOM\s*Table\s*(\d+)$/i.exec(name.trim());
    if (m) {
      const rows = [];
      for (let r = rg.s.r; r <= rg.e.r; r++) {
        const row = [];
        for (let c = rg.s.c; c <= rg.e.c; c++) row.push(cellText(at(r, c)));
        rows.push(row);
      }
      // trim empty rows and columns
      let R = rows.filter((r) => r.some((x) => x !== ''));
      if (R.length) {
        const keep = R[0].map((_, c) => R.some((r) => r[c] !== ''));
        R = R.map((r) => r.filter((_, c) => keep[c]));
        tables[Number(m[1])] = { sheet: name, rows: R };
      } else notes.push(`Sheet "${name}" is empty.`);
    }
  });
  return { file: file.name, vars, rawVars, tables, notes, sheets: wb.SheetNames };
}
