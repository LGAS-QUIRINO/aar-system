// Uploaded files (PDF only): sent to the backend (Google Drive of the office account), kept on this device after the
// first download so they open offline, and drawn page by page as pictures for the Print View, printouts and Word.
import { call } from './api.js';
import { db } from './db.js';
import { loadScript } from './wp.js';

const MAX = 10 * 1024 * 1024;
const toB64 = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (b64) => { const s = atob(b64); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b.buffer; };

async function pdfjs() {
  const lib = await loadScript('lib/pdf.min.js', 'pdfjsLib');
  lib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
  return lib;
}

// Checks and uploads a PDF. Returns { fileId, name, size, pages }.
export async function uploadPdf(file, { teamId, auditId, kind }) {
  if (!navigator.onLine) throw new Error('Uploading needs internet. Connect and try again.');
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') throw new Error('Only PDF files can be uploaded. Save the Word file as PDF first.');
  if (file.size > MAX) throw new Error('The file is larger than 10 MB.');
  const buf = await file.arrayBuffer();
  const head = String.fromCharCode(...new Uint8Array(buf.slice(0, 4)));
  if (head !== '%PDF') throw new Error('This file is not a PDF.');
  const pages = (await renderPdf(buf)).length;   // also confirms the PDF can be read
  const out = await call('uploadFile', { teamId, auditId, kind, name: file.name, data: toB64(buf) });
  await db.put('meta', { name: out.name, buf }, 'file:' + out.fileId);
  return { fileId: out.fileId, name: out.name, size: out.size, pages };
}

// The file's bytes: from this device, or downloaded once and kept.
export async function getPdf(fileId) {
  const hit = await db.get('meta', 'file:' + fileId);
  if (hit && hit.buf) return hit.buf;
  if (!navigator.onLine) throw new Error('This file has not been opened on this device yet. Connect to the internet once to download it.');
  const out = await call('getFile', { fileId });
  const buf = fromB64(out.data);
  await db.put('meta', { name: out.name, buf }, 'file:' + fileId);
  return buf;
}

export async function removeFile(fileId) {
  try { await call('deleteFile', { fileId }); } catch (e) { /* already removed, or offline: the record no longer points to it */ }
  await db.del('meta', 'file:' + fileId);
}

// Each page as a picture (150 dpi), with its size in inches.
const cache = new Map();
export async function renderPdf(buf, key) {
  if (key && cache.has(key)) return cache.get(key);
  const lib = await pdfjs();
  const pdf = await lib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  const out = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const v1 = page.getViewport({ scale: 1 });
    const v = page.getViewport({ scale: 150 / 72 });
    const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: v }).promise;
    out.push({ src: c.toDataURL('image/jpeg', 0.88), wIn: v1.width / 72, hIn: v1.height / 72 });
  }
  if (key) cache.set(key, out);
  return out;
}
export const openPdf = async (fileId) => { const buf = await getPdf(fileId); const url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' })); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); };
