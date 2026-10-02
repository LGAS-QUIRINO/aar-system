// Talks to the backend (Apps Script) or, in Demo Mode, to the in-browser demo server.
import { CONFIG, DEMO } from './config.js';
import { auth } from './auth.js';
import { demoServer } from './demo-server.js';

export async function call(action, payload = {}) {
  if (DEMO) return demoServer.handle(action, payload, auth.email);
  const idToken = await auth.getToken();
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // simple request: no CORS preflight
    body: JSON.stringify({ action, idToken, ...payload })
  });
  if (!res.ok) throw new Error('Server error ' + res.status);
  const out = await res.json();
  if (!out.ok) throw new Error(out.error || 'Server error');
  return out;
}
