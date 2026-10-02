// Word (.docx) file of the AOM letter, built from the same layout as the screen and the printout.
import { loadScript } from './wp.js';

const isNum = (s) => /^[(₱-]?\s*[\d,]+(\.\d+)?%?\)?$/.test(String(s).trim());

export async function downloadWord(doc) {
  const D = await loadScript('lib/docx.min.js', 'docx');
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, Footer, Header, PageNumber, Tab, VerticalAlign, HeightRule } = D;
  const FONT = 'Times New Roman';
  const run = (r, p) => new TextRun({ text: r.t, bold: !!(p.bold || r.b), italics: !!p.italic, font: FONT, size: p.size || 24 });
  const align = (a) => ({ both: AlignmentType.JUSTIFIED, center: AlignmentType.CENTER, right: AlignmentType.RIGHT }[a] || AlignmentType.LEFT);
  let letterhead = null;
  try { letterhead = await (await fetch('img/letterhead.jpg')).arrayBuffer(); } catch (e) { letterhead = null; }

  const para = (p) => {
    if (p.blank) return new Paragraph({ children: [new TextRun({ text: '', font: FONT, size: 24 })] });
    const kids = [];
    if (p.label) kids.push(new TextRun({ text: p.label, bold: !!p.bold, italics: !!p.italic, font: FONT, size: p.size || 24 }), new TextRun({ children: [new Tab()], font: FONT }));
    (p.runs || []).forEach((r) => kids.push(r.t === '\t' ? new TextRun({ children: [new Tab()], font: FONT }) : run(r, p)));
    const ind = p.ind || {};
    return new Paragraph({
      children: kids, alignment: align(p.align),
      indent: { left: ind.left || 0, right: ind.right || 0, hanging: ind.hanging || undefined, firstLine: ind.firstLine || undefined },
      spacing: { after: 0, line: 240 }
    });
  };
  const cellP = (text, o = {}) => new Paragraph({ alignment: o.align || AlignmentType.LEFT, spacing: { after: 0 }, children: [new TextRun({ text: String(text || ''), bold: !!o.bold, font: FONT, size: o.size || 22 })] });
  const table = (t) => {
    if (t.receipt) {
      return new Table({
        columnWidths: t.widths, width: { size: t.widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
        rows: t.rows.map((r, i) => new TableRow({
          height: i ? { value: 820, rule: HeightRule.ATLEAST } : undefined,
          children: r.map((c, ci) => new TableCell({
            width: { size: t.widths[ci], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
            children: i === 0 ? [cellP(c, { bold: true, align: AlignmentType.CENTER, size: 24 })]
              : Array.isArray(c) ? [cellP(c[0], { bold: true, size: 24 }), cellP(c[1], { size: 24 })] : [cellP('')]
          }))
        }))
      });
    }
    const rows = t.rows || [];
    return new Table({
      width: { size: 9360 - (t.left || 0), type: WidthType.DXA }, indent: t.left ? { size: t.left, type: WidthType.DXA } : undefined,
      rows: rows.map((r, i) => {
        const total = i > 0 && /total/i.test(r.join(' '));
        return new TableRow({
          tableHeader: i === 0,
          children: r.map((c) => new TableCell({ children: [cellP(c, { bold: i === 0 || total, align: i === 0 ? AlignmentType.CENTER : isNum(c) ? AlignmentType.RIGHT : AlignmentType.LEFT })] }))
        });
      })
    });
  };
  const toChildren = (list) => list.map((p) => {
    if (p.kind === 'table') return table(p);
    if (p.kind === 'image') {
      if (!letterhead) return new Paragraph({ children: [] });
      return new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'jpg', data: letterhead, transformation: { width: Math.round(p.w * 96), height: Math.round(p.h * 96) } })] });
    }
    return para(p);
  });

  const page = { size: { width: 12240, height: 18720 }, margin: { top: 1440, right: 1440, bottom: 1930, left: 1440, header: 720, footer: 360 } };
  const draftHeader = () => new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'DRAFT – Not for Issuance', bold: true, color: '9A9A9A', font: FONT, size: 20 })] })] });
  const foot = new Footer({
    children: [
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], font: FONT, size: 20 })] }),
      ...doc.footer.map((t) => new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: t, font: FONT, size: 20 })] }))
    ]
  });
  const sections = [{ properties: { page }, headers: doc.draft ? { default: draftHeader() } : undefined, footers: { default: foot }, children: toChildren(doc.body) }];
  doc.annexes.forEach((a) => sections.push({
    properties: { page },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: (doc.draft ? 'DRAFT – ' : '') + 'Annex ' + a.letter, font: FONT, size: 24 })] })] }) },
    footers: { default: foot },
    children: toChildren(a.paras)
  }));
  const file = new Document({ creator: 'Annual Audit Report System', title: 'Audit Observation Memorandum', styles: { default: { document: { run: { font: FONT, size: 24 } } } }, sections });
  const blob = await Packer.toBlob(file);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = doc.fileName + (doc.draft ? '_DRAFT' : '') + '.docx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
