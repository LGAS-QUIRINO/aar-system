// AOM pages: the letter cut into long-bond pages (8.5" × 13") with the footer at the bottom of every page,
// "Page 1 of 2" and the AOM No. and Barangay in italics. The preview and the printout use the same pages.
// How: the letter flows through CSS columns that are exactly one page of text high (the browser breaks lines and
// table rows the same way it does when printing); each page shows one column.
import { DOC_CSS, letterHTML } from './aom.js';

const IN = 96;                                   // CSS pixels per inch
const W = 6.5 * IN, H = 10.66 * IN, GAP = 1 * IN;   // text area of a page: 13" less 1" top and 1.34" bottom margins
const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const PAGE_CSS = `
.pg{position:relative;box-sizing:border-box;width:8.5in;height:13in;padding:1in 1in 0;background:#fff;overflow:hidden}
.pg .pg-vp{width:6.5in;height:10.66in;overflow:hidden;position:relative;z-index:1}
.pg .pg-flow,.pg-measure{width:${W}px;height:${H}px;column-width:${W}px;column-gap:${GAP}px;column-fill:auto}
.pg .wm{display:none}
.pg .annex{break-before:auto;page-break-before:auto}
.pg-foot{position:absolute;right:1in;bottom:.45in;text-align:right;font:10pt/1.25 'Times New Roman',Tinos,Times,serif;color:#000}
.pg-foot i{font-style:italic}
.pg-wm{position:absolute;top:45%;left:0;right:0;text-align:center;font:700 110pt Arial,sans-serif;color:rgba(0,0,0,.08);transform:rotate(-35deg);pointer-events:none;z-index:0}
.pg-measure{position:absolute;left:-99999px;top:0;visibility:hidden}
`;

function ensureCss() {
  if (document.getElementById('aompages-css')) return;
  const s = document.createElement('style');
  s.id = 'aompages-css';
  s.textContent = DOC_CSS + PAGE_CSS;
  document.head.appendChild(s);
}

// The letter as separate flows: the letter itself, then each annex (an annex starts on a new page).
function flows(d) {
  const main = { ...d, annexes: [] };
  return [letterHTML(main, false), ...d.annexes.map((a) => letterHTML({ body: [], draft: false, annexes: [a] }, false))];
}

// How many pages one flow takes.
async function countPages(html) {
  const m = document.createElement('div');
  m.className = 'pg-measure';
  m.innerHTML = html;
  document.body.appendChild(m);
  const imgs = [...m.querySelectorAll('img')].filter((i) => !i.complete);
  await Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; })));
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const n = Math.max(1, Math.round((m.scrollWidth + GAP) / (W + GAP)));
  m.remove();
  return n;
}

/** The pages as HTML: [{ html }] — each page a .pg box with its footer. */
export async function aomPages(d) {
  ensureCss();
  const fl = flows(d);
  const counts = [];
  for (const h of fl) counts.push(await countPages(h));
  const total = counts.reduce((a, b) => a + b, 0);
  const pages = [];
  let no = 0;
  fl.forEach((h, fi) => {
    for (let k = 0; k < counts[fi]; k++) {
      no += 1;
      pages.push(`<div class="pg">${d.draft ? '<div class="pg-wm">DRAFT</div>' : ''}
        <div class="pg-vp"><div class="pg-flow" style="transform:translateX(${-k * (W + GAP)}px)">${h}</div></div>
        <div class="pg-foot">Page ${no} of ${total}${d.footer.map((t) => `<br><i>${escH(t)}</i>`).join('')}</div></div>`);
    }
  });
  return { pages, total };
}
