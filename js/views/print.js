// Print and Word download of the AOM letter for one Barangay.
import { store } from '../store.js';
import { esc, toast, pill, $, $$ } from '../ui.js';
import { loadAudit, stepsBar } from '../auditctx.js';
import { buildLetter, letterHTML, DOC_CSS, ST, statusPill, fillText } from '../aom.js';
import { downloadWord } from '../docx-aom.js';
import { aomNo } from '../format.js';

export async function print(refs, params, q) {
  const ctx = await loadAudit(refs, params.id);
  if (!ctx) return { active: '#/audits', crumbs: '<b>Not Found</b>', body: '<div class="note bad">This audit was not found.</div>' };
  const list = ctx.aoms;
  const forceDraft = q.get('draft') === '1';
  const chosen = new Set(list.map((a) => a.id));
  const allFinal = () => [...chosen].every((id) => list.find((a) => a.id === id).data.status === ST.FINAL);
  const isDraft = () => forceDraft || !allFinal();
  const doc = () => buildLetter({ audit: ctx.audit, lgu: ctx.lgu, mun: ctx.mun, team: ctx.team, atl: ctx.atl, sa: ctx.sa, aoms: list.filter((a) => chosen.has(a.id)), nums: ctx.nums, varsFor: ctx.varsFor, draft: isDraft() });

  const body = `${stepsBar(ctx, 'AOM Review')}
    <div class="page-head"><div><h1>Print · Barangay ${esc(ctx.lgu.name)} AOMs</h1><p>Long bond (8.5" × 13") · Times New Roman 12. Final copies print only when every chosen AOM is Final; otherwise it prints as a DRAFT.</p></div>
      <div class="btn-row"><a class="btn ghost" href="#/audits/${ctx.rec.id}/aoms">← Back to AOMs</a></div></div>
    <div class="split" style="grid-template-columns:320px minmax(0,1fr)">
      <section class="panel" style="align-self:start"><div class="panel-head"><h2>AOMs to Include</h2></div>
        ${list.map((a) => `<label class="t-row click" style="grid-template-columns:24px 1fr;padding:10px 16px"><input type="checkbox" data-pick="${a.id}" checked>
          <span><span class="mono" style="font-size:12px">${esc(aomNo(ctx.audit.auditYear, ctx.nums[a.id].n, ctx.audit.periodFrom, ctx.audit.periodTo))}</span> ${pill(a.data.status || 'Draft', statusPill(a.data.status || 'Draft'))}<br><b>${esc(fillText(a.data.title, ctx.varsFor(a)))}</b></span></label>`).join('')}
        <div class="panel-body"><div id="pr-mode"></div>
          <button class="btn primary" id="pr-print">Print</button><button class="btn ghost" id="pr-word">Download Word</button>
          <span class="hint">Printing uses your browser's print window. In it, choose paper size Legal or 8.5 × 13 if your printer lists it, and Margins: Default.</span></div></section>
      <section class="panel" style="min-width:0"><div class="panel-head"><h2>Preview</h2></div><div class="panel-body"><div class="paper-wrap big" id="pr-prev"></div></div></section>
    </div>`;

  return {
    active: '#/drafts', crumbs: `<a href="#/audits">My Audit</a> / <a href="#/audits/${ctx.rec.id}/aoms">${esc(ctx.title)}</a> / <b>Print</b>`, body,
    mount(root) {
      const draw = () => {
        const d = doc();
        $('#pr-prev', root).innerHTML = `<div class="sheet">${letterHTML(d, false)}</div>`;
        $('#pr-mode', root).innerHTML = d.draft ? '<div class="note warn">Prints as <b>DRAFT</b> with a watermark.</div>' : '<div class="note ok">All chosen AOMs are Final. Prints without a watermark.</div>';
        $('#pr-print', root).disabled = $('#pr-word', root).disabled = chosen.size === 0;
      };
      $$('[data-pick]', root).forEach((c) => { c.onchange = () => { c.checked ? chosen.add(c.dataset.pick) : chosen.delete(c.dataset.pick); draw(); }; });
      draw();
      $('#pr-print', root).onclick = async () => {
        const d = doc();
        printDoc(d);
        await store.log(d.draft ? 'printed a draft AOM' : 'printed the final AOM', `${ctx.lgu.name} · AOM No. ${d.rangeText}`, ctx.teamId, refs.me.email);
      };
      $('#pr-word', root).onclick = async () => {
        const d = doc();
        try { toast('Preparing the Word file…'); await downloadWord(d); } catch (e) { toast('Word file failed: ' + e.message, 'bad'); return; }
        await store.log(d.draft ? 'downloaded a draft AOM (Word)' : 'downloaded the final AOM (Word)', `${ctx.lgu.name} · AOM No. ${d.rangeText}`, ctx.teamId, refs.me.email);
      };
    }
  };
}

export function printDoc(d) {
  const cssStr = (t) => String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const foot = `"Page " counter(page) " of " counter(pages) "${d.footer.map((t) => '\\A ' + cssStr(t)).join('')}"`;
  const css = `${DOC_CSS}
    @page { size: 8.5in 13in; margin: 1in 1in 1.34in 1in;
      @bottom-right { content: ${foot}; white-space: pre; font: 10pt 'Times New Roman', serif; text-align: right; vertical-align: top; } }
    body { margin: 0; } .wm { display: ${d.draft ? 'block' : 'none'}; }`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>AOM No. ${esc(d.rangeText)}</title><base href="${location.href.split('#')[0]}"><style>${css}</style></head><body>${letterHTML(d, false)}</body></html>`;
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  const go = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); };
  const img = f.contentDocument.querySelector('img');
  if (img && !img.complete) img.onload = img.onerror = go; else setTimeout(go, 200);
}
