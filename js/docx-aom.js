// Word (.docx) file of the AOM letter, built from the same layout as the screen and the printout.
import { loadScript } from './wp.js';
import { tableLayout, isYearHead, isNum } from './aom.js';


export async function downloadWord(doc) {
  const D = await loadScript('lib/docx.min.js', 'docx');
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, Footer, Header, PageNumber, Tab, VerticalAlign, HeightRule, BorderStyle, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType, TableLayoutType } = D;
  const FONT = 'Times New Roman';
  const run = (r, p) => new TextRun({ text: r.t, bold: !!(p.bold || r.b), italics: !!p.italic, font: FONT, size: p.size || 24 });
  const align = (a) => ({ both: AlignmentType.JUSTIFIED, center: AlignmentType.CENTER, right: AlignmentType.RIGHT }[a] || AlignmentType.LEFT);
  const load = async (src) => { try { return await (await fetch(src)).arrayBuffer(); } catch (e) { return null; } };
  const letterhead = await load('img/letterhead.jpg');
  const lhImgs = {};
  for (const p of doc.body) if (p.kind === 'letterhead') { lhImgs.seal = await load(p.seal.src); lhImgs.name = await load(p.name.src); }
  const EMU = 914400;

  const para = (p) => {
    if (p.blank) return new Paragraph({ keepNext: !!p.keep, children: [new TextRun({ text: '', font: FONT, size: 24 })] });
    const kids = [];
    if (p.label) kids.push(new TextRun({ text: p.label, bold: !!p.bold, italics: !!p.italic, font: FONT, size: p.size || 24 }), new TextRun({ children: [new Tab()], font: FONT }));
    (p.runs || []).forEach((r) => kids.push(r.t === '\t' ? new TextRun({ children: [new Tab()], font: FONT }) : run(r, p)));
    const ind = p.ind || {};
    return new Paragraph({
      keepNext: !!p.keep, children: kids, alignment: align(p.align),
      indent: { left: ind.left || 0, right: ind.right || 0, hanging: ind.hanging || undefined, firstLine: ind.firstLine || undefined },
      spacing: { after: 0, line: 240 },
      border: p.ruleBelow ? { bottom: { style: BorderStyle.THICK_THIN_SMALL_GAP, size: 24, color: '000000', space: 4 } } : undefined
    });
  };
  const cellP = (text, o = {}) => new Paragraph({ keepNext: !!o.keep, alignment: o.align || AlignmentType.LEFT, spacing: { after: 0 }, children: [new TextRun({ text: String(text || ''), bold: !!o.bold, font: FONT, size: o.size || 22 })] });
  const table = (t) => {
    if (t.receipt) {
      // Word prints these cells in 12 pt (the preview uses 11 pt): give the name column a little more room so names stay on one line.
      const nw = Math.min(5040, Math.round(t.widths[0] * 1.12)), sw = Math.round((9360 - nw) * 0.56);
      t = { ...t, widths: [nw, sw, 9360 - nw - sw] };
      return new Table({
        columnWidths: t.widths, width: { size: t.widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
        rows: t.rows.map((r, i) => new TableRow({
          cantSplit: true,
          children: r.map((c, ci) => new TableCell({
            width: { size: t.widths[ci], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
            // Rows keep with the next row, so the whole table stays on one page with what comes before it.
            children: i === 0 ? [cellP(c, { bold: true, align: AlignmentType.CENTER, size: 24, keep: true })]
              : Array.isArray(c) ? [cellP(c[0], { bold: true, size: 24, keep: true }), cellP(c[1], { size: 24, keep: i < t.rows.length - 1 })] : [cellP('', { keep: i < t.rows.length - 1 })]
          }))
        }))
      });
    }
    const rows = t.rows || [];
    const avail = 9360 - (t.left || 0), L = t.layout || tableLayout(rows, avail), size = L ? Math.round(L.size * 2) : 22;
    const line = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
    const isDate = (s) => /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(String(s ?? '').trim());
    const isRef = (s) => /^(?:DV|CK|OR|Check|Voucher|RCD|DV\s*No|Check\s*No)\.?\s*[-–0-9A-Za-z]+$/i.test(String(s ?? '').trim());

    return new Table({
      width: { size: avail, type: WidthType.DXA }, indent: t.left ? { size: t.left, type: WidthType.DXA } : undefined,
      columnWidths: L ? L.widths : undefined, layout: L ? TableLayoutType.FIXED : undefined,
      // every cell ruled, with comfortable margin inside
      borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      rows: rows.map((r, i) => {
        if (i === 0) {
          return new TableRow({
            tableHeader: true,
            cantSplit: true,
            children: r.map((c, ci) => new TableCell({
              width: L ? { size: L.widths[ci], type: WidthType.DXA } : undefined,
              verticalAlign: VerticalAlign.CENTER,
              children: [cellP(c, { bold: true, size, align: AlignmentType.CENTER })]
            }))
          });
        }
        if (isYearHead(r)) {
          return new TableRow({
            cantSplit: true,
            children: [new TableCell({
              columnSpan: r.length,
              width: { size: avail, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              children: [cellP(r[0], { bold: true, size, align: AlignmentType.CENTER })]
            })]
          });
        }
        const isSub = /sub-?\s*total/i.test(r.join(' '));
        const isGrand = /grand\s*total/i.test(r.join(' ')) || /^\s*total\s*$/i.test(String(r[0] ?? '').trim()) || (t.isSplit && /total/i.test(r.join(' ')));
        const total = isSub || isGrand;
        const cellBorders = isGrand
          ? { top: line, bottom: { style: BorderStyle.DOUBLE, size: 12, color: '000000' }, left: line, right: line }
          : isSub
            ? { top: { style: BorderStyle.SINGLE, size: 8, color: '000000' }, bottom: line, left: line, right: line }
            : undefined;

        return new TableRow({
          cantSplit: true,
          children: r.map((c, ci) => {
            const v = String(c ?? '').trim();
            const align = /^(19|20)\d{2}$/.test(v) || isDate(v) || isRef(v) || /^[-–—]$/.test(v)
              ? AlignmentType.CENTER
              : isNum(c)
                ? AlignmentType.RIGHT
                : AlignmentType.LEFT;
            return new TableCell({
              width: L ? { size: L.widths[ci], type: WidthType.DXA } : undefined,
              verticalAlign: isNum(c) ? VerticalAlign.TOP : undefined,
              borders: cellBorders,
              children: [cellP(c, { bold: total, size, align })]
            });
          })
        });
      })
    });
  };
  const toChildren = (list) => list.filter((p) => p.kind !== 'keepStart' && p.kind !== 'keepEnd').map((p) => {
    if (p.kind === 'table') return table(p);
    if (p.kind === 'letterhead') {
      const kids = [];
      if (lhImgs.seal) kids.push(new ImageRun({ type: 'jpg', data: lhImgs.seal, transformation: { width: Math.round(p.seal.w * 96), height: Math.round(p.seal.h * 96) },
        floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, offset: Math.round(p.seal.left * EMU) },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: Math.round(p.seal.top * EMU) }, wrap: { type: TextWrappingType.NONE }, allowOverlap: true, behindDocument: true } }));
      if (lhImgs.name) kids.push(new ImageRun({ type: 'jpg', data: lhImgs.name, transformation: { width: Math.round(p.name.w * 96), height: Math.round(p.name.h * 96) } }));
      return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 230, after: 0 }, children: kids });
    }
    if (p.kind === 'image') {
      if (!letterhead) return new Paragraph({ children: [] });
      return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new ImageRun({ type: 'jpg', data: letterhead, transformation: { width: Math.round(p.w * 96), height: Math.round(p.h * 96) } })] });
    }
    return para(p);
  });

  const page = { size: { width: 12240, height: 18720 }, margin: { top: 1440, right: 1440, bottom: 1930, left: 1440, header: 720, footer: 360 } };
  const draftHeader = () => new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'DRAFT – Not for Issuance', bold: true, color: '9A9A9A', font: FONT, size: 20 })] })] });
  const foot = new Footer({
    children: [
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], font: FONT, size: 20 })] }),
      ...doc.footer.map((t) => new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: t, font: FONT, size: 20, italics: true })] }))
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
