// Wording and number rules agreed for all documents.
export const pad3 = (n) => String(n).padStart(3, '0');
export const periodYears = (from, to) => (Number(from) === Number(to) ? String(to) : `${from}-${to}`);
// "2026-001 (2024-2025)" · single year "2026-001 (2025)"
export const aomNo = (auditYear, n, from, to) => `${auditYear}-${pad3(n)} (${periodYears(from, to)})`;
// "2026-001 to 010 (2023-2025)"
export const aomRange = (auditYear, a, b, from, to) => `${auditYear}-${pad3(a)} to ${b ? pad3(b) : '___'} (${periodYears(from, to)})`;
// "For the Years 2023 to 2025" / "For the Year 2025"; mid-sentence form is lower case.
// The audit period in words. In a sentence (mid = true): "for the calendar years 2023 to 2025" / "for the calendar year 2025".
// As a title or heading: "For the Calendar Years 2023 to 2025" / "For the Calendar Year 2025".
export function periodPhrase(from, to, mid = false) {
  const one = Number(from) === Number(to);
  const yrs = one ? String(to) : `${from} to ${to}`;
  return mid ? `for the calendar year${one ? '' : 's'} ${yrs}` : `For the Calendar Year${one ? '' : 's'} ${yrs}`;
}
export const upper = (s) => String(s || '').toLocaleUpperCase('en-PH');
export const fullName = (o) => [upper(o.title), upper(o.name)].filter(Boolean).join(' ');
export const longDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};
// Title Case names typed in caps, for screen display: "GRINGO A. BARROGA" → "Gringo A. Barroga"
export const nice = (s) => String(s || '').toLowerCase().replace(/(^|[\s.\-'(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\bIi\b|\bIii\b|\bIv\b/g, (x) => x.toUpperCase());
export const initials = (s) => String(s || '').replace(/^(atty|engr|dr|hon|mr|ms|mrs)\.?\s+/i, '').split(/\s+/).filter((w) => /^\p{L}/u.test(w) && !/\.$/.test(w)).map((w) => w[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase();
export const timeAgo = (iso) => {
  if (!iso) return 'never';
  const d = new Date(iso), s = (Date.now() - d) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  const sameDay = new Date().toDateString() === d.toDateString();
  return (sameDay ? 'Today, ' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ') + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};
export const ROLE_NAMES = { member: 'Team Member', staff: 'Team Staff', atl: 'Audit Team Leader', sa: 'Supervising Auditor', osa: 'OSA Staff', admin: 'Admin' };
export const FUND_NAMES = { GF: 'General Fund', BDRRMF: '5% BDRRMF', SEF: 'Special Education Fund', TF: 'Trust Fund' };
