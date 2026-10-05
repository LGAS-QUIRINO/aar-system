// Chart of Accounts: the official accounts and the accounts added by the team. Admin and SA add, edit and remove
// added accounts; an added account can be edited or removed only while no trial balance uses it.
import { store, emitChange } from '../store.js';
import { esc, toast, modal, pill, confirmBox, $, $$ } from '../ui.js';
import { has } from '../refs.js';
import { COA_ID, LINES, LINE, loadChart, loadAdded, validCode } from '../coa.js';

export const canEditChart = (me) => has(me, 'sa') || has(me, 'admin');
const STMT = { perf: 'Statement of Financial Performance', pos: 'Statement of Financial Position' };
const lineOptions = (sel) => ['perf', 'pos'].map((s) => `<optgroup label="${STMT[s]}">${LINES.filter((l) => l.st === s).map((l) => `<option value="${l.k}" ${l.k === sel ? 'selected' : ''}>${esc(l.label)}${l.note ? ` (Note ${l.note})` : ''}</option>`).join('')}</optgroup>`).join('');
export const lineText = (k) => { const l = LINE[k]; return l ? `${l.label}${l.note ? ` (Note ${l.note})` : ''}` : ''; };

// Which codes some trial balance already uses: { code: true }.
export async function usedCodes() {
  const out = {};
  (await store.list('letters')).filter((l) => l.data.type === 'tb').forEach((l) => (l.data.rows || []).forEach((r) => { if (r.use) out[r.use] = true; if (r.code) out[String(r.code).trim()] = true; }));
  return out;
}
async function saveAdded(list, me, what) {
  await store.save('letters', COA_ID, { type: 'coa', list, savedBy: me.email, savedAt: new Date().toISOString() }, { silent: true });
  await store.log(what, '', '', me.email);
}

/**
 * The Add Account window. preset: { code, title } from a trial balance row. edit: the added account being changed.
 * Saves the account and resolves with it, or with null.
 */
export async function openAddAccount({ me, preset = {}, edit = null }) {
  const chart = await loadChart();
  const a = edit || { code: preset.code || '', title: preset.title || '', line: preset.line || '', interfund: false };
  let out = null;
  const body = `<div class="field"><label class="label" for="aa-code">Account Code</label><input class="input" id="aa-code" value="${esc(a.code)}" placeholder="e.g. 2-03-01-050" ${edit ? 'disabled' : ''}></div>
    <div class="field"><label class="label" for="aa-title">Account Title</label><input class="input" id="aa-title" value="${esc(a.title)}"></div>
    <div class="field"><label class="label" for="aa-line">Shows in</label><select class="input" id="aa-line"><option value="">Choose the line…</option>${lineOptions(a.line)}</select></div>
    <label class="check"><input type="checkbox" id="aa-inter" ${a.interfund ? 'checked' : ''}>Between funds of this barangay (left out when the funds are combined)</label>
    <div class="hint" id="aa-hint" style="line-height:1.5"></div>`;
  const hint = (bg) => {
    const l = LINE[$('#aa-line', bg).value];
    $('#aa-hint', bg).innerHTML = l ? `Shows in the ${STMT[l.st]} under <b>${esc(l.label)}</b>${l.note ? ` (Note ${l.note})` : ''}, with a ${l.side === 'dr' ? 'debit' : 'credit'} balance.` : 'The line decides where the account shows in the statements and the Notes.';
  };
  const ok = await modal({ title: edit ? 'Edit Account' : 'Add Account', body,
    onOpen: (bg) => { hint(bg); $('#aa-line', bg).onchange = () => hint(bg); },
    buttons: [{ label: 'Cancel', cls: 'ghost', value: null }, { label: edit ? 'Save' : 'Add', cls: 'primary', value: 'ok', check: (bg) => {
      const code = $('#aa-code', bg).value.trim(), title = $('#aa-title', bg).value.trim().replace(/\s+/g, ' '), line = $('#aa-line', bg).value;
      if (!validCode(code)) { toast('Type the code like 2-03-01-050.', 'bad'); return false; }
      if (!edit && chart.byCode[code]) { toast(`Code ${code} is already ${chart.byCode[code].title}.`, 'bad'); return false; }
      if (!title) { toast('Type the account title.', 'bad'); return false; }
      if (!line) { toast('Choose where the account shows.', 'bad'); return false; }
      out = { code, title, line, interfund: $('#aa-inter', bg).checked };
      return true;
    } }] });
  if (!ok || !out) return null;
  const list = (await loadAdded()).filter((x) => x.code !== out.code);
  const rec = { ...out, cls: LINE[out.line].cls, addedBy: (edit && edit.addedBy) || me.email, addedAt: (edit && edit.addedAt) || new Date().toISOString() };
  list.push(rec);
  list.sort((x, y) => x.code.localeCompare(y.code));
  await saveAdded(list, me, `${edit ? 'changed' : 'added'} account ${out.code} ${out.title} in the Chart of Accounts`);
  toast(edit ? 'Account saved.' : 'Account added to the Chart of Accounts.', 'ok');
  return rec;
}

// A window to pick an account from the chart. Resolves with the account code, or null.
export async function pickAccount({ title = 'Match Account', hintText = '', start = '' }) {
  const chart = await loadChart();
  let picked = null;
  const rowsFor = (q) => {
    const t = q.trim().toLowerCase();
    const hits = chart.list.filter((a) => !t || a.code.includes(t) || a.title.toLowerCase().includes(t)).slice(0, 80);
    return hits.map((a) => `<button type="button" class="pick" data-code="${esc(a.code)}"><span class="mono">${esc(a.code)}</span><span>${esc(a.title)}${a.official ? '' : ' <span class="pill violet">Added by the team</span>'}</span></button>`).join('') || '<div class="empty">No account found.</div>';
  };
  await modal({ title, wide: true,
    body: `${hintText ? `<p class="hint" style="margin:0 0 8px">${esc(hintText)}</p>` : ''}<input class="input" id="pk-q" placeholder="Find code or title" value="${esc(start)}" aria-label="Find code or title"><div class="picklist" id="pk-list">${rowsFor(start)}</div>`,
    onOpen: (bg) => {
      $('#pk-q', bg).oninput = (e) => { $('#pk-list', bg).innerHTML = rowsFor(e.target.value); };
      $('#pk-list', bg).addEventListener('click', (e) => { const b = e.target.closest('[data-code]'); if (!b) return; picked = b.dataset.code; $('.x', bg).click(); });
    },
    buttons: [{ label: 'Cancel', cls: 'ghost', value: null }] });
  return picked;
}

/* ── The Chart of Accounts screen ── */
export async function coaView(refs, params, q) {
  const me = refs.me;
  const can = canEditChart(me);
  const chart = await loadChart();
  const used = await usedCodes();
  const show = q.get('show') === 'added' ? 'added' : 'all';
  const rows = chart.list.filter((a) => show === 'all' || !a.official);
  const body = `<div class="page-head"><div><h1>Chart of Accounts</h1><p>${chart.list.length - chart.added.length} official accounts · ${chart.added.length} added by the team</p></div>
      ${can ? '<div class="btn-row"><button class="btn primary" id="c-add" type="button">+ Add Account</button></div>' : ''}</div>
    <div class="topnote">The official accounts cannot be changed. An account added by the team can be edited or removed while no trial balance uses it. ${can ? '' : 'Only the SA or Admin can add accounts.'}</div>
    <section class="panel"><div class="panel-head"><div class="seg" role="group" aria-label="Show"><a class="${show === 'all' ? 'on' : ''}" href="#/coa">All</a><a class="${show === 'added' ? 'on' : ''}" href="#/coa?show=added">Added by the team</a></div>
      <input class="input" id="c-find" placeholder="Find code or title" aria-label="Find code or title" style="margin-left:auto;width:260px"></div>
      <div class="panel-body" style="padding-top:4px"><table class="coat" style="table-layout:auto"><thead><tr><th style="width:130px">Code</th><th>Account Title</th><th>Shows in</th><th style="width:200px"></th></tr></thead>
      <tbody>${rows.map((a) => `<tr data-f="${esc((a.code + ' ' + a.title).toLowerCase())}"><td class="mono">${esc(a.code)}</td><td>${esc(a.title)}${a.interfund ? ' <span class="hint">(between funds)</span>' : ''}</td><td>${esc(lineText(a.line))}</td>
        <td style="text-align:right">${a.official ? pill('Official', 'grey') : `${pill('Added by the team', 'violet')} ${can && !used[a.code] ? `<button class="btn sm ghost" type="button" data-ed="${esc(a.code)}">Edit</button><button class="btn sm ghost" type="button" data-rm="${esc(a.code)}">Remove</button>` : used[a.code] ? '<span class="hint">In use</span>' : ''}`}</td></tr>`).join('')
        || '<tr><td colspan="4"><div class="empty">No accounts added by the team yet.</div></td></tr>'}</tbody></table></div></section>`;
  return {
    active: '#/coa', crumbs: '<b>Chart of Accounts</b>', body,
    mount(root) {
      $('#c-find', root).oninput = (e) => { const t = e.target.value.trim().toLowerCase(); $$('tr[data-f]', root).forEach((r) => { r.hidden = !!t && !r.dataset.f.includes(t); }); };
      const add = $('#c-add', root); if (add) add.onclick = async () => { if (await openAddAccount({ me })) emitChange('local'); };
      $$('[data-ed]', root).forEach((b) => { b.onclick = async () => { const a = chart.added.find((x) => x.code === b.dataset.ed); if (a && await openAddAccount({ me, edit: a })) emitChange('local'); }; });
      $$('[data-rm]', root).forEach((b) => { b.onclick = async () => {
        const a = chart.added.find((x) => x.code === b.dataset.rm); if (!a) return;
        if (!(await confirmBox('Remove Account', `Remove ${esc(a.code)} ${esc(a.title)} from the Chart of Accounts?`, 'Remove'))) return;
        if ((await usedCodes())[a.code]) { toast('A trial balance now uses this account, so it stays.', 'bad'); return; }
        await saveAdded((await loadAdded()).filter((x) => x.code !== a.code), me, `removed account ${a.code} ${a.title} from the Chart of Accounts`);
        toast('Account removed.', 'ok'); emitChange('local');
      }; });
    }
  };
}
