// Report Wording: wording that changes now and then, kept in one place (Admin and SA edit; everyone uses it).
// Period Wording: the period patterns used in the letters and on the cover.
// GAA References: the General Provisions section cited in Paragraph 6 of the transmittal letter.
import { store } from '../store.js';
import { esc, toast, modal, pill, $, $$ } from '../ui.js';
import { has } from '../refs.js';
import { GAA_ID, GAA_DEFAULT, gaaFor, gaaComplete, gaaText, PW_ID, PERIOD_STANDARD, periodWords } from '../baar-transmittal.js';

export async function loadGaa() {
  const r = await store.get('letters', GAA_ID);
  return r && !r.deleted && Array.isArray(r.data.list) ? r.data.list : GAA_DEFAULT.map((g) => ({ ...g }));
}
export async function loadPeriodWording() {
  const r = await store.get('letters', PW_ID);
  return { ...PERIOD_STANDARD, ...(r && !r.deleted ? r.data.period || {} : {}) };
}
export const canEditWording = (me) => has(me, 'sa') || has(me, 'admin');

const PW_ROWS = [['lettersOne', 'Letters', 'one year'], ['lettersMany', 'Letters', 'more than one year'], ['coverOne', 'Cover', 'one year'], ['coverMany', 'Cover', 'more than one year']];

/**
 * Opens the Report Wording window. tab: 'period' or 'gaa'. year: the "To" year of the audit being worked on (for the previews).
 * Resolves with { gaa, pw } after Save, or null.
 */
export async function openReportWording({ me, tab = 'period', year, teamId = '' }) {
  const can = canEditWording(me);
  const dis = can ? '' : 'disabled';
  const gaa = (await loadGaa()).map((g) => ({ ...g }));
  const pw = await loadPeriodWording();
  const y = Number(year) || new Date().getFullYear() - 1;
  if (!gaaFor(gaa, y)) gaa.push({ fy: y, ra: '', sec: '', src: '' });
  gaa.sort((a, b) => a.fy - b.fy);

  const pwPrev = (k) => k.endsWith('One') ? periodWords(pw, y, y, k.startsWith('cover') ? 'cover' : 'letters') : periodWords(pw, y - 1, y, k.startsWith('cover') ? 'cover' : 'letters');
  const pwTable = () => `<table class="gt"><thead><tr><th style="width:170px">Used in</th><th>Pattern</th><th style="width:290px">Preview</th></tr></thead><tbody>${PW_ROWS.map(([k, a, b]) => `<tr><td><b>${a}</b> · ${b}</td>
      <td><input class="input" data-pw="${k}" value="${esc(pw[k])}" aria-label="${a}, ${b}" ${dis}></td><td class="hint" data-pv="${k}">${esc(pwPrev(k))}</td></tr>`).join('')}</tbody></table>`;
  const gRow = (g, i) => `<tr><td><input class="input" data-g="fy" data-i="${i}" value="${esc(g.fy)}" inputmode="numeric" aria-label="Fiscal Year" ${dis}></td>
      <td><input class="input" data-g="ra" data-i="${i}" value="${esc(g.ra)}" aria-label="Republic Act No." ${dis}></td><td><input class="input" data-g="sec" data-i="${i}" value="${esc(g.sec)}" aria-label="Section" ${dis}></td>
      <td><input class="input" data-g="src" data-i="${i}" value="${esc(g.src || '')}" aria-label="Checked From" ${dis}></td><td data-gp="${i}">${gaaComplete(g) ? '' : pill('Incomplete', 'warn')}</td></tr>`;
  const gTable = () => `<table class="gt"><thead><tr><th style="width:100px">Fiscal Year</th><th style="width:140px">Republic Act No.</th><th style="width:90px">Section</th><th>Checked From</th><th style="width:96px"></th></tr></thead><tbody>${gaa.map(gRow).join('')}</tbody></table>`;
  const body = `<div class="seg" role="tablist" aria-label="Report Wording"><button type="button" data-rt="period" class="${tab === 'period' ? 'on' : ''}">Period Wording</button><button type="button" data-rt="gaa" class="${tab === 'gaa' ? 'on' : ''}">GAA References</button></div>
    <div data-rp="period" ${tab === 'period' ? '' : 'hidden'} style="display:flex;flex-direction:column;gap:10px">
      <p class="hint" style="margin:0">[YEAR] is the "To" year in Audit Setup. [N] is the number of years in words (two, three…); on the cover it starts with a capital (Two, Three…).</p>
      ${pwTable()}${can ? '<button class="btn sm ghost" type="button" id="rw-reset" style="align-self:flex-start">Reset to Standard</button>' : ''}</div>
    <div data-rp="gaa" ${tab === 'gaa' ? '' : 'hidden'} style="display:flex;flex-direction:column;gap:10px">
      <p class="hint" style="margin:0">The General Provisions section that asks agencies to report actions on audit recommendations within 60 days (AAPSI). Add each new year once; everyone gets it.</p>
      <div id="g-tbl">${gTable()}</div>${can ? '<button class="btn sm" type="button" id="g-add" style="align-self:flex-start">+ Add Fiscal Year</button>' : ''}<div id="g-prev" class="note ok" style="margin:0;display:block"></div></div>
    <div class="note ok" style="margin:0;display:block">${can ? 'Applies to every printout from now on. BAARs already printed are not changed.' : 'Only the Admin or the SA can change these.'}</div>`;
  const gPrev = (bg) => { const g = gaaFor(gaa, y); $('#g-prev', bg).textContent = gaaComplete(g) ? `Preview for FY ${y}: “…pursuant to ${gaaText(g)}, using the…”` : `FY ${y} is not complete yet.`; };
  const v = await modal({ title: 'Report Wording', wide: true, body,
    buttons: can ? [{ label: 'Cancel', cls: 'ghost', value: null }, { label: 'Save', cls: 'primary', value: 'save' }] : [{ label: 'Close', cls: 'ghost', value: null }],
    onOpen: (bg) => {
      $$('[data-rt]', bg).forEach((b) => { b.onclick = () => { $$('[data-rt]', bg).forEach((x) => x.classList.toggle('on', x === b)); $$('[data-rp]', bg).forEach((p) => { p.hidden = p.dataset.rp !== b.dataset.rt; }); }; });
      bg.addEventListener('input', (e) => {
        const p = e.target.closest('[data-pw]');
        if (p) { pw[p.dataset.pw] = p.value; PW_ROWS.forEach(([k]) => { const c = $(`[data-pv="${k}"]`, bg); if (c) c.textContent = pwPrev(k); }); return; }
        const el = e.target.closest('[data-g]'); if (!el) return;
        const i = +el.dataset.i; gaa[i][el.dataset.g] = el.dataset.g === 'fy' ? Number(el.value) || el.value : el.value;
        const tag = $(`[data-gp="${i}"]`, bg); if (tag) tag.innerHTML = gaaComplete(gaa[i]) ? '' : pill('Incomplete', 'warn');
        gPrev(bg);
      });
      const add = $('#g-add', bg); if (add) add.onclick = () => { const next = Math.max(y, ...gaa.map((r) => Number(r.fy) || 0)) + 1; gaa.push({ fy: next, ra: '', sec: '', src: '' }); $('#g-tbl', bg).innerHTML = gTable(); gPrev(bg); };
      const rs = $('#rw-reset', bg); if (rs) rs.onclick = () => { Object.assign(pw, PERIOD_STANDARD); $$('[data-pw]', bg).forEach((i) => { i.value = pw[i.dataset.pw]; }); PW_ROWS.forEach(([k]) => { $(`[data-pv="${k}"]`, bg).textContent = pwPrev(k); }); };
      gPrev(bg);
    } });
  if (v !== 'save') return null;
  const list = gaa.filter((g) => Number(g.fy)).map((g) => ({ fy: Number(g.fy), ra: String(g.ra || '').trim(), sec: String(g.sec || '').trim(), src: String(g.src || '').trim() }))
    .filter((g, i, a) => a.findIndex((x) => x.fy === g.fy) === i).sort((a, b) => a.fy - b.fy);
  const period = Object.fromEntries(Object.keys(PERIOD_STANDARD).map((k) => [k, String(pw[k] || '').trim() || PERIOD_STANDARD[k]]));
  const at = new Date().toISOString();
  await store.save('letters', GAA_ID, { type: 'gaa', list, savedBy: me.email, savedAt: at }, { silent: true });
  await store.save('letters', PW_ID, { type: 'wording', period, savedBy: me.email, savedAt: at }, { silent: true });
  await store.log('saved the Report Wording', `Period wording; GAA: ${list.map((g) => `FY ${g.fy} R.A. ${g.ra || '?'} Sec. ${g.sec || '?'}`).join('; ')}`, teamId, me.email);
  toast('Report Wording saved.', 'ok');
  return { gaa: list, pw: period };
}
