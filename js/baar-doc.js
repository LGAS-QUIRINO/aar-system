// Shared printing and Word saving for the BAAR parts, so each part prints alone or together as the complete BAAR.
import { loadScript } from './wp.js';

const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// css: page rules (named pages per part); html: the parts, each in a .pg block. Every .pg starts on a new page.
export function printPages(css, html, title) {
  const full = `${css} @page { size: 8.5in 11in; margin: 1in; } body { margin: 0; } .pg + .pg { break-before: page; page-break-before: always; }`;
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${escH(title)}</title><base href="${location.href.split('#')[0]}"><style>${full}</style></head><body>${html}</body></html>`;
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(doc); f.contentDocument.close();
  const go = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); };
  const imgs = [...f.contentDocument.images];
  Promise.all(imgs.map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => setTimeout(go, 150));
}

export async function saveDocx(sections, fileName, title) {
  const D = await loadScript('lib/docx.min.js', 'docx');
  const doc = new D.Document({ creator: 'Annual Audit Report System', title, styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } }, sections });
  const blob = await D.Packer.toBlob(doc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = fileName + '.docx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
