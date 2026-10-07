// Block editor: Topic Sentence, Criteria, Condition, Table, Sub-heading, Cause, Effect, Recommendation.
// Labels never print. Placeholders like [TOTAL_UNLIQ_CA] are filled from the working paper and Setup.
import { esc } from './ui.js';
import { BLOCK_LABELS, ADDABLE, newBlock, letterOf, diffWords, blockPlain } from './aom.js';

const area = (bi, key, val, rows = 3, extra = '') =>
  `<textarea class="input be-text" data-bi="${bi}" data-k="${key}" rows="${rows}" ${extra}>${esc(val || '')}</textarea>`;

function autoRows(t, min = 2) { return Math.max(min, Math.min(18, Math.ceil(String(t || '').length / 95) + String(t || '').split('\n').length)); }

export function blocksHTML(aom, o = {}) {
  const { editable = true, tables = {}, initials = {} } = o;
  const dis = editable ? '' : 'disabled';
  let sub = -1;
  const blocks = aom.blocks || [];
  return `<div class="be">${blocks.map((b, bi) => {
    if (b.type === 'subheading') sub++;
    const inSub = !!b.sub && sub >= 0 && b.type !== 'subheading';
    const label = b.type === 'subheading' ? `Sub-heading ${letterOf(sub)})` : BLOCK_LABELS[b.type] + (b.type === 'criteria' ? ` · ${b.quoted ? '“ ” Quoted' : 'Paraphrased'}` : '');
    const tools = editable && b.type !== 'topic' ? `<span class="be-tools">
        <button class="x sm" data-act="up" data-bi="${bi}" aria-label="Move up" title="Move up">▲</button>
        <button class="x sm" data-act="down" data-bi="${bi}" aria-label="Move down" title="Move down">▼</button>
        <button class="x sm" data-act="del" data-bi="${bi}" aria-label="Delete block" title="Delete">✕</button></span>` : '';
    const subToggle = editable && sub >= 0 && b.type !== 'subheading' && b.type !== 'topic'
      ? `<label class="check be-sub"><input type="checkbox" data-bi="${bi}" data-k="sub" ${b.sub ? 'checked' : ''}>Inside sub-heading ${letterOf(sub)})</label>` : '';
    const yearToggle = editable && ['paragraph', 'condition', 'effect', 'cause'].includes(b.type)
      ? `<label class="check be-sub" title="Prints once per year of AOM Table 1 (a., b., c.). Use [YEAR], [ROW_COUNT], [COUNT_IMPLEMENTED] (a Remarks word), [SUM_APPROPRIATION] (a column name)."><input type="checkbox" data-bi="${bi}" data-k="perYear" ${b.perYear ? 'checked' : ''}>Repeat for each year of AOM Table 1</label>` : (b.perYear ? '<span class="pill grey">Repeats for each year of AOM Table 1</span>' : '');
    const who = initials[bi] ? `<span class="pill violet" title="Edited during review">${esc(initials[bi])}</span>` : '';
    let body = '';
    if (b.type === 'criteria') {
      body = `<div class="be-row">
          <div class="seg" role="group" aria-label="Criteria style">
            <button type="button" class="${b.quoted ? 'on' : ''}" data-act="quoted" data-bi="${bi}" ${dis}>“ ” Quoted</button>
            <button type="button" class="${b.quoted ? '' : 'on'}" data-act="para" data-bi="${bi}" ${dis}>Paraphrased</button></div></div>
        ${b.quoted ? `<input class="input" data-bi="${bi}" data-k="lead" value="${esc(b.lead || '')}" placeholder="Lead-in, e.g. Section 89 of P.D. No. 1445 provides that:" ${dis}>` : ''}
        ${area(bi, 'text', b.text, autoRows(b.text), dis + (b.quoted ? ' style="font-style:italic"' : ''))}
        ${b.quoted ? '<span class="hint">Quotation marks “ ” are added when printed. Each line prints as its own paragraph.</span>' : ''}`;
    } else if (b.type === 'recommendation') {
      const lettered = (b.items || []).length > 0;
      body = `<div class="be-row"><div class="seg" role="group" aria-label="Recommendation style">
          <button type="button" class="${lettered ? '' : 'on'}" data-act="rec1" data-bi="${bi}" ${dis}>One Paragraph</button>
          <button type="button" class="${lettered ? 'on' : ''}" data-act="recN" data-bi="${bi}" ${dis}>Lettered a., b., c.</button></div></div>
        ${lettered ? `<input class="input" data-bi="${bi}" data-k="lead" value="${esc(b.lead || '')}" ${dis}>
          ${(b.items || []).map((it, ii) => `<div class="be-item"><span class="be-letter">${letterOf(ii)}.</span>
            <textarea class="input be-text" data-bi="${bi}" data-k="item" data-ii="${ii}" rows="${autoRows(it)}" ${dis}>${esc(it)}</textarea>
            ${editable ? `<button class="x sm" data-act="delitem" data-bi="${bi}" data-ii="${ii}" aria-label="Remove item ${letterOf(ii)}">✕</button>` : ''}</div>`).join('')}
          ${editable ? `<div><button class="btn sm dashed" data-act="additem" data-bi="${bi}">+ Add Item</button></div>` : ''}`
        : area(bi, 'text', b.text, autoRows(b.text), dis)}`;
    } else if (b.type === 'table') {
      const nums = Object.keys(tables);
      const t = tables[b.n];
      body = `<div class="grid-3">
          <div class="field"><label class="label">Table</label><select class="input" data-bi="${bi}" data-k="n" ${dis}>
            ${[...new Set([...nums.map(Number), b.n || 1])].sort((x, y) => x - y).map((n) => `<option value="${n}" ${Number(b.n) === n ? 'selected' : ''}>AOM Table ${n}${tables[n] || (Number(b.n) === n && String(b.fixed || '').trim()) ? '' : ' (not imported)'}</option>`).join('')}</select></div>
          <div class="field"><label class="label">Placement</label><select class="input" data-bi="${bi}" data-k="annex" ${dis}>
            <option value="0" ${b.annex ? '' : 'selected'}>In the text</option><option value="1" ${b.annex ? 'selected' : ''}>As an annex (after the AOM)</option></select></div>
          <div class="field"><label class="label">Caption (optional)</label><input class="input" data-bi="${bi}" data-k="caption" value="${esc(b.caption || '')}" ${dis}></div></div>
        <div class="field"><label class="label">Columns (when filled in the app)</label><input class="input" data-bi="${bi}" data-k="cols" value="${esc(b.cols || '')}" placeholder="e.g. Account, [EACH_YEAR]" ${dis}><span class="hint">Separate with commas. [EACH_YEAR] gives one amount column per year of the audit period.</span></div>
        <div class="field"><label class="label">Fixed Table (same in every AOM)</label><textarea class="input be-text" data-bi="${bi}" data-k="fixed" rows="${Math.max(2, Math.min(14, String(b.fixed || '').split('\n').length + 1))}" placeholder="Only for a table that never changes, e.g. a circular's sample format. One row per line; separate cells with | or paste from Excel." ${dis}>${esc(b.fixed || '')}</textarea></div>
        <label class="check" style="min-height:0"><input type="checkbox" data-bi="${bi}" data-k="subYear" ${b.subYear ? 'checked' : ''} ${dis}>Sub-Total per Year (grouped by the year in the first column, e.g. the date)</label>
        ${String(b.fixed || '').trim() ? '<div class="hint">Fixed table: prints the same in every AOM. No working paper needed.</div>' : t ? `<div class="hint">From sheet "${esc(t.sheet)}" · ${t.rows.length - 1} rows · ${t.rows[0].length} columns. Edit the numbers in the working paper, then re-import.</div>`
          : '<div class="note warn">Not imported yet. Import the working paper on the Findings screen.</div>'}`;
    } else if (b.type === 'subheading') {
      body = `<input class="input" style="font-weight:600;font-style:italic" data-bi="${bi}" data-k="text" value="${esc(b.text || '')}" placeholder="Sub-heading title" ${dis}>`;
    } else {
      body = area(bi, 'text', b.text, autoRows(b.text, b.type === 'topic' ? 3 : 2), dis + (b.type === 'topic' ? ' style="font-weight:600"' : ''));
    }
    return `<div class="be-block ${inSub ? 'in-sub' : ''} t-${b.type}" data-block-wrap="${bi}">
        <div class="be-head"><span class="be-label">${label}</span>${who}${subToggle}${yearToggle}${tools}</div>${body}</div>`;
  }).join('')}
  ${editable ? `<div class="be-add"><label class="label" for="be-add-type">+ Add Block</label>
     <select class="input" id="be-add-type" style="max-width:240px"><option value="">Choose…</option>${ADDABLE.map((t) => `<option value="${t}">${BLOCK_LABELS[t]}</option>`).join('')}</select>
     <span class="hint">Added at the end. Use ▲ ▼ to move it.</span></div>` : ''}</div>`;
}

// Wire an editor rendered by blocksHTML. state.aom is changed in place; onChange(redraw) is called after each change.
export function wireBlocks(root, state, onChange) {
  const aom = () => state.aom;
  root.addEventListener('input', (e) => {
    const el = e.target; const bi = el.dataset.bi; if (bi === undefined || el.type === 'checkbox' || el.tagName === 'SELECT') return;
    const b = aom().blocks[+bi];
    if (el.dataset.k === 'item') b.items[+el.dataset.ii] = el.value; else b[el.dataset.k] = el.value;
    onChange(false);
  });
  root.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'be-add-type' && el.value) { aom().blocks.push(newBlock(el.value)); el.value = ''; onChange(true); return; }
    const bi = el.dataset.bi; if (bi === undefined) return;
    const b = aom().blocks[+bi];
    if (el.dataset.k === 'sub') b.sub = el.checked;
    else if (el.dataset.k === 'subYear') b.subYear = el.checked;
    else if (el.dataset.k === 'perYear') b.perYear = el.checked;
    else if (el.dataset.k === 'n') b.n = Number(el.value);
    else if (el.dataset.k === 'annex') b.annex = el.value === '1';
    else return;
    onChange(el.dataset.k === 'sub');
  });
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]'); if (!btn || btn.disabled) return;
    const bi = +btn.dataset.bi; const bl = aom().blocks; const b = bl[bi];
    switch (btn.dataset.act) {
      case 'up': if (bi > 1) [bl[bi - 1], bl[bi]] = [bl[bi], bl[bi - 1]]; break;
      case 'down': if (bi < bl.length - 1) [bl[bi + 1], bl[bi]] = [bl[bi], bl[bi + 1]]; break;
      case 'del': bl.splice(bi, 1); break;
      case 'quoted': b.quoted = true; break;
      case 'para': b.quoted = false; break;
      case 'rec1': b.text = [b.lead, ...(b.items || [])].filter(Boolean).join(' '); b.items = []; break;
      case 'recN': b.items = b.text ? [b.text] : ['']; b.lead = b.lead || 'We recommend that Management:'; b.text = ''; break;
      case 'additem': b.items.push(''); break;
      case 'delitem': b.items.splice(+btn.dataset.ii, 1); break;
      default: return;
    }
    e.preventDefault();
    onChange(true);
  });
}

// Draft (as forwarded) vs. Corrected (now), word by word.
export function diffHTML(before, after, initialsFor) {
  const bb = (before && before.blocks) || [], ab = after.blocks || [];
  const n = Math.max(bb.length, ab.length);
  const rows = [];
  if ((before && before.title) !== after.title) rows.push(`<div class="be-block"><div class="be-head"><span class="be-label">Finding Title</span></div><div class="diff">${diffWords(before ? before.title : '', after.title).map(seg).join('')}</div></div>`);
  for (let i = 0; i < n; i++) {
    const a = bb[i] ? blockPlain(bb[i]) : '', b = ab[i] ? blockPlain(ab[i]) : '';
    const type = (ab[i] || bb[i]).type;
    const changed = a !== b;
    rows.push(`<div class="be-block ${changed ? 'changed' : ''}"><div class="be-head"><span class="be-label">${BLOCK_LABELS[type]}</span>${changed && initialsFor && initialsFor[i] ? `<span class="pill violet">${esc(initialsFor[i])}</span>` : ''}${changed ? '<span class="pill warn">Corrected</span>' : ''}</div>
      <div class="diff">${diffWords(a, b).map(seg).join('')}</div></div>`);
  }
  return rows.join('') || '<div class="empty">No changes.</div>';
  function seg(s) {
    const t = esc(s.t).replace(/\n/g, '<br>');
    return s.op === '+' ? `<ins>${t}</ins>` : s.op === '-' ? `<del>${t}</del>` : t;
  }
}

export const BE_CSS = `
.be{display:flex;flex-direction:column;gap:12px}
.be-block{border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:#fff;display:flex;flex-direction:column;gap:8px}
.be-block.in-sub{margin-left:34px;border-left:3px solid #C9D6E5}
.be-block.t-topic{border-color:#9DB4CF;background:#F8FAFD}
.be-block.t-subheading{background:#F5F3FC;border-color:#CFC6EE}
.be-block.changed{border-color:var(--warn-line);background:#FFFCF5}
.be-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.be-label{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.be-tools{margin-left:auto;display:flex;gap:2px}
.x.sm{width:28px;height:28px;font-size:13px}
.be-sub{font-size:12px;margin-left:8px}
.be-text{height:auto;min-height:64px;padding:10px 12px;line-height:1.5;resize:vertical;font-family:var(--sans)}
.be-item{display:grid;grid-template-columns:26px minmax(0,1fr) 32px;gap:6px;align-items:start}
.be-letter{font-weight:700;padding-top:12px;text-align:right}
.be-row{display:flex;gap:8px}
.seg{display:inline-flex;border:1px solid #C9D3DD;border-radius:8px;overflow:hidden}
.seg button{border:0;background:#fff;padding:6px 12px;font-size:12px;cursor:pointer}
.seg button.on{background:var(--primary);color:#fff;font-weight:600}
.seg button[disabled]{cursor:default}
.be-add{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 0}
.diff{font-family:var(--serif);font-size:15px;line-height:1.6;white-space:normal}
.diff ins{background:#DDF1E4;text-decoration:none;color:#1E5C38;border-bottom:2px solid #2F7D4F}
.diff del{background:#FDE2E1;color:#9F1C1C}
`;
