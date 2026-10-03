// Review View: the AOM shown like a Word document with tracked changes, and comments in the margin.
// Used by the member (returned AOMs) and by the ATL and SA (during review).
// Red strikethrough = removed, green underline = added (with initials), yellow = words someone commented on.
import { store } from './store.js';
import { esc, toast, setDirty } from './ui.js';
import { BLOCK_LABELS, clone, diffWords, fillText, letterOf, ensureIds, answered, blockPlain } from './aom.js';
import { initials, nice } from './format.js';

const br = (h) => h.replace(/\n/g, '<br>');
const short = (s, n = 90) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
export function when(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === now.toDateString() ? t : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + t;
}

// The printable parts of a block, each with a key so comments can point at the exact part.
function partsOf(b) {
  if (!b) return [];
  if (b.type === 'topic') return [{ k: 'text', cls: 'topic' }];
  if (b.type === 'criteria') return b.quoted ? [{ k: 'lead', cls: 'body' }, { k: 'text', cls: 'quote' }] : [{ k: 'text', cls: 'body' }];
  if (b.type === 'recommendation') return (b.items || []).length ? [{ k: 'lead', cls: 'rec' }, ...b.items.map((_, i) => ({ k: 'item' + i, cls: 'item', letter: letterOf(i) + '.' }))] : [{ k: 'text', cls: 'body' }];
  if (b.type === 'subheading') return [{ k: 'text', cls: 'sub' }];
  if (b.type === 'table') return [{ k: 'caption', cls: 'body tbl', pre: `[AOM Table ${b.n || 1}${b.annex ? ', as an annex' : ''}] ` }];
  return [{ k: 'text', cls: 'body' }];
}
const partVal = (b, k) => (!b ? '' : k.startsWith('item') ? (b.items || [])[+k.slice(4)] || '' : b[k] || '');

// Counts for banners and lists.
export function reviewCounts(aom) {
  ensureIds(aom);
  const base = (aom.submitted && aom.submitted.blocks) || null;
  let corrections = 0;
  if (base) {
    const ids = new Set([...aom.blocks.map((b) => b.id), ...base.map((b) => b.id)]);
    ids.forEach((id) => { const a = base.find((b) => b.id === id), b = aom.blocks.find((x) => x.id === id); if (!a || !b || blockPlain(a) !== blockPlain(b)) corrections++; });
    if (aom.submitted.title !== aom.title) corrections++;
  }
  const cs = aom.comments || [];
  return { corrections, comments: cs.length, answered: cs.filter((c) => c.resolved || answered(c)).length };
}

/**
 * Show the Review View inside host.
 * opts: { rec, vars, me, users, canAct, heading, navEl, onChange(data) }
 * Returns { flush() } — flush() saves any comment or reply still being typed.
 */
export function mountReview(host, opts) {
  const { me, vars } = opts;
  const rec = opts.rec;
  let data = ensureIds(clone(rec.data));
  let focus = mountReview.focus[rec.id] || '';
  let draft = null;                    // new comment being typed: { blockId, part, quote }
  const typed = {};                    // reply boxes with text, by comment id
  let items = [];
  const userOf = (email) => (opts.users || []).find((u) => u.data.email === email)?.data || { name: email || '' };
  const nameOf = (email) => (email === me.email ? 'You' : nice(userOf(email).name || email));
  const iniOf = (who) => (!who ? '' : who.includes('@') ? initials(userOf(who).name || who) : who);
  const fill = (t) => fillText(t || '', vars);

  function render() {
    const base = (data.submitted && data.submitted.blocks) || null;
    const baseOf = (id) => (base ? base.find((b) => b.id === id) : null);
    const cs = data.comments || [];
    const byBlock = {};
    cs.forEach((c) => { (byBlock[c.blockId || ''] = byBlock[c.blockId || ''] || []).push(c); });
    items = [];
    const cards = [];
    const found = {};

    const partHTML = (blockId, before, after, k, cls, pre, letter, ini) => {
      const marks = [];
      (byBlock[blockId] || []).filter((c) => c.part === k && c.quote).forEach((c) => {
        const s = after.indexOf(c.quote);
        if (s >= 0) { marks.push({ s, e: s + c.quote.length, id: c.id, res: c.resolved }); found[c.id] = s; }
      });
      if (draft && draft.blockId === blockId && draft.part === k) { const s = after.indexOf(draft.quote); if (s >= 0) marks.push({ s, e: s + draft.quote.length, id: '_new' }); }
      const segs = before === after ? [{ t: after, op: '=' }] : diffWords(before, after);
      let pos = 0, html = '';
      for (const sg of segs) {
        if (sg.op === '-') { html += `<del class="chg" data-x="${blockId}">${br(esc(sg.t))}</del>`; continue; }
        const st = pos, en = pos + sg.t.length; pos = en;
        const cuts = new Set([st, en]);
        marks.forEach((m) => { if (m.s > st && m.s < en) cuts.add(m.s); if (m.e > st && m.e < en) cuts.add(m.e); });
        const pts = [...cuts].sort((a, b) => a - b);
        for (let i = 0; i < pts.length - 1; i++) {
          let h = br(esc(after.slice(pts[i], pts[i + 1])));
          const m = marks.find((x) => x.s <= pts[i] && x.e >= pts[i + 1]);
          if (m) h = `<mark class="hl ${m.res ? 'res' : ''}" data-c="${m.id}">${h}</mark>`;
          if (sg.op === '+') h = `<ins class="chg" data-x="${blockId}">${h}</ins>`;
          html += h;
        }
      }
      const changed = before !== after;
      return `<p class="${cls}" data-b="${blockId}" data-part="${k}">${letter ? `<span class="lt">${letter}</span>` : ''}${pre ? esc(pre) : ''}${html || '&nbsp;'}${changed && ini ? `<span class="ini" title="Changed by ${esc(nameOf(data.editedBy?.[blockId] || ''))}">${esc(ini)}</span>` : ''}</p>`;
    };

    const correctionCard = (id, label, before, after, kind) => {
      const who = data.editedBy?.[id] || '';
      const segs = diffWords(before, after);
      const rem = short(segs.filter((s) => s.op === '-' && s.t.trim()).map((s) => s.t.trim()).join(' … ')), add = short(segs.filter((s) => s.op === '+' && s.t.trim()).map((s) => s.t.trim()).join(' … '));
      const what = kind === 'added' ? `Added a new ${label}.` : kind === 'removed' ? `Removed the whole ${label}.`
        : [rem && `Removed “${esc(rem)}”`, add && `Added “${esc(add)}”`].filter(Boolean).join(' · ') || 'Reworded (punctuation or spacing).';
      items.push('x:' + id);
      cards.push(`<div class="rv-card chgcard ${focus === 'x:' + id ? 'on' : ''}" data-key="x:${id}" tabindex="0">
        <div class="who">${who ? `<span class="ini">${esc(iniOf(who))}</span><b>${esc(nameOf(who))}</b>` : '<b>Correction</b>'}<span>· ${esc(label)}</span></div>
        <div>${what}</div>
        ${opts.canAct ? `<div class="acts"><button class="btn sm ghost" data-act="restore" data-b="${id}">Restore Original</button><button class="btn sm ghost" data-act="replyx" data-b="${id}">Reply</button></div>` : ''}
        ${opts.canAct && draft && draft.corr === id ? draftBox('Your note on this correction') : ''}</div>`);
    };

    const commentCard = (c) => {
      items.push('c:' + c.id);
      const mine = c.by === me.email;
      const ans = answered(c);
      const showBox = opts.canAct && !c.resolved && (focus === 'c:' + c.id || (!ans && !mine) || typed[c.id]);
      cards.push(`<div class="rv-card cmt ${c.resolved ? 'resolved' : ''} ${focus === 'c:' + c.id ? 'on' : ''}" data-key="c:${c.id}" tabindex="0">
        <div class="who"><span class="ini">${esc(iniOf(c.by))}</span><b>${esc(nameOf(c.by))}</b><span>· ${esc(when(c.at))}</span></div>
        ${c.quote ? `<div class="quote">“${esc(short(c.quote, 120))}”${found[c.id] === undefined && c.blockId ? ' <small>(these words were changed)</small>' : ''}</div>` : c.onCorrection ? '<div class="quote">On a correction</div>' : ''}
        <div class="txt">${br(esc(c.text))}</div>
        ${(c.replies || []).map((r) => `<div class="reply"><div class="who"><span class="ini">${esc(iniOf(r.by))}</span><b>${esc(nameOf(r.by))}</b><span>· ${esc(when(r.at))}</span></div><div class="txt">${br(esc(r.text))}</div></div>`).join('')}
        ${c.resolved ? `<div class="acts"><span class="pill grey">Resolved by ${esc(nameOf(c.resolvedBy))}</span>${opts.canAct ? `<button class="btn sm ghost" data-act="reopen" data-c="${c.id}">Reopen</button>` : ''}</div>`
          : `${showBox ? `<textarea class="input" rows="2" data-reply="${c.id}" placeholder="Type your reply…" aria-label="Reply to ${esc(nameOf(c.by))}">${esc(typed[c.id] || '')}</textarea>` : ''}
            <div class="acts">${ans ? '<span class="pill ok">✓ Answered</span>' : ''}${opts.canAct ? `${showBox ? `<button class="btn sm primary" data-act="reply" data-c="${c.id}">Reply</button>` : `<button class="btn sm ghost" data-act="open" data-c="${c.id}">Reply</button>`}<button class="btn sm ghost" data-act="resolve" data-c="${c.id}">Mark Resolved</button>` : ''}</div>`}
      </div>`);
    };

    const draftBox = (ph) => `<div class="rv-draft"><textarea class="input" rows="3" id="rv-draft" placeholder="${esc(ph)}">${esc(draft.text || '')}</textarea>
      <div class="acts"><button class="btn sm primary" data-act="adddraft">${draft.corr ? 'Send' : 'Add Comment'}</button><button class="btn sm ghost" data-act="canceldraft">Cancel</button></div></div>`;

    // Walk the document: title, then every block (removed ones stay where they were, struck through).
    const docParts = [];
    const tBefore = fill(data.submitted ? data.submitted.title : data.title), tAfter = fill(data.title);
    docParts.push(`<div class="aomno">${esc(opts.heading || '')}</div>`);
    docParts.push(partHTML('_title', tBefore, tAfter, 'title', 'ttl', '', '', iniOf(data.editedBy?._title)));
    if (tBefore !== tAfter) correctionCard('_title', 'Finding Title', tBefore, tAfter);
    (byBlock._title || []).sort((a, b) => (found[a.id] ?? 1e9) - (found[b.id] ?? 1e9)).forEach(commentCard);

    const order = [];
    (data.blocks || []).forEach((b) => order.push({ id: b.id, cur: b }));
    if (base) {
      base.forEach((b, i) => {
        if (order.some((o) => o.id === b.id)) return;
        let at = 0;
        for (let j = i - 1; j >= 0; j--) { const k = order.findIndex((o) => o.id === base[j].id); if (k >= 0) { at = k + 1; break; } }
        order.splice(at, 0, { id: b.id, cur: null });
      });
    }
    order.forEach(({ id, cur }) => {
      const old = base ? baseOf(id) : cur;
      const b = cur || old;
      const ini = iniOf(data.editedBy?.[id]);
      const keys = partsOf(b);
      if (cur && old && cur.type === 'recommendation') partsOf(old).forEach((p) => { if (!keys.some((x) => x.k === p.k)) keys.push(p); });
      let html = '';
      keys.forEach((p) => { html += partHTML(id, fill(partVal(old, p.k)), cur ? fill(partVal(cur, p.k)) : '', p.k, p.cls, p.pre, p.letter, ini); });
      docParts.push(`<div class="rv-block t-${b.type} ${cur && cur.sub ? 'in-sub' : ''}" data-block="${id}">${html}</div>`);
      const label = BLOCK_LABELS[b.type] || 'Block';
      if (base && (!old || !cur || blockPlain(old) !== blockPlain(cur))) correctionCard(id, label, fill(old ? blockPlain(old) : ''), fill(cur ? blockPlain(cur) : ''), !old ? 'added' : !cur ? 'removed' : '');
      (byBlock[id] || []).sort((a, c) => (found[a.id] ?? 1e9) - (found[c.id] ?? 1e9)).forEach(commentCard);
    });
    // Comments not tied to any words (older comments, or on a block that no longer exists).
    cs.filter((c) => !c.blockId || (c.blockId !== '_title' && !order.some((o) => o.id === c.blockId))).forEach(commentCard);

    const newCard = draft && !draft.corr ? `<div class="rv-card cmt on new" data-key="_new"><div class="who"><span class="ini">${esc(initials(me.name))}</span><b>New Comment</b></div>
      <div class="quote">“${esc(short(draft.quote, 120))}”</div>${draftBox('Type your comment')}</div>` : '';

    host.innerHTML = `<div class="rv-work">
      <div class="rv-doc" id="rv-doc">${docParts.join('')}
        ${opts.canAct ? '<button class="btn sm primary rv-float" id="rv-float" hidden>💬 Comment</button>' : ''}</div>
      <aside class="rv-margin" id="rv-margin"><h3>Comments and Corrections</h3>
        ${opts.canAct ? '<div class="hint rv-tip">Select words in the AOM to comment on them.</div>' : ''}
        ${newCard}${cards.join('') || '<div class="hint">No corrections or comments.</div>'}</aside></div>`;
    navUpdate();
    if (focus) applyFocus(false);
    const d = host.querySelector('#rv-draft'); if (d) d.focus();
  }

  function navUpdate() {
    const n = opts.navEl; if (!n) return;
    const i = items.indexOf(focus);
    n.innerHTML = items.length ? `<button class="btn sm ghost" data-nav="-1" ${i <= 0 ? 'disabled' : ''}>‹ Previous</button>
      <b class="rv-pos">${i >= 0 ? `Item ${i + 1} of ${items.length}` : `${items.length} item${items.length > 1 ? 's' : ''}`}</b>
      <button class="btn sm ghost" data-nav="1" ${i >= items.length - 1 ? 'disabled' : ''}>${i < 0 ? 'Start' : 'Next'} ›</button>` : '<span class="hint">No corrections or comments.</span>';
  }

  function applyFocus(scroll = true) {
    mountReview.focus[rec.id] = focus;
    host.querySelectorAll('.on').forEach((e) => { if (!e.classList.contains('new')) e.classList.remove('on'); });
    if (!focus) return navUpdate();
    const [kind, id] = [focus.slice(0, 1), focus.slice(2)];
    const card = host.querySelector(`.rv-card[data-key="${focus}"]`);
    const marks = [...host.querySelectorAll(kind === 'c' ? `mark[data-c="${id}"]` : `[data-x="${id}"]`)];
    if (card) card.classList.add('on');
    marks.forEach((m) => m.classList.add('on'));
    navUpdate();
    if (!scroll) return;
    const target = marks[0] || host.querySelector(`[data-block="${kind === 'c' ? (data.comments.find((c) => c.id === id) || {}).blockId : id}"]`);
    if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const mg = host.querySelector('#rv-margin');
    if (card && mg && mg.scrollHeight > mg.clientHeight) mg.scrollTop = card.offsetTop - mg.offsetTop - 40;
  }

  // Save a change on the latest copy of the AOM (another person may have saved in between).
  async function act(mutate, action) {
    const fresh = await store.get('aoms', rec.id);
    const d = ensureIds(clone(fresh ? fresh.data : data));
    if (mutate(d) === false) return;
    if (action) d.history = [...(d.history || []), { at: new Date().toISOString(), by: me.email, action }];
    await store.save('aoms', rec.id, d, { silent: true });
    rec.data = d; data = ensureIds(clone(d));
    dirtyCheck();
    render();
    if (opts.onChange) opts.onChange(d);
  }
  function dirtyCheck() {
    const any = (draft && (draft.text || '').trim()) || Object.values(typed).some((t) => t && t.trim());
    setDirty(!!any, any ? async () => { await flush(); return true; } : null);
  }

  async function flush() {
    const now = new Date().toISOString();
    const replies = Object.entries(typed).filter(([, t]) => t && t.trim());
    const dr = draft && (draft.text || '').trim() ? { ...draft } : null;
    if (!replies.length && !dr) return false;
    await act((d) => {
      replies.forEach(([cid, t]) => { const c = d.comments.find((x) => x.id === cid); if (c) c.replies = [...(c.replies || []), { by: me.email, at: now, text: t.trim() }]; });
      if (dr) d.comments = [...(d.comments || []), dr.corr ? { id: 'c' + Date.now().toString(36), by: me.email, at: now, text: dr.text.trim(), blockId: dr.corr, onCorrection: true, replies: [], resolved: false }
        : { id: 'c' + Date.now().toString(36), by: me.email, at: now, text: dr.text.trim(), quote: dr.quote, blockId: dr.blockId, part: dr.part, replies: [], resolved: false }];
      replies.forEach(([cid]) => delete typed[cid]);
      draft = null;
    });
    return true;
  }

  const LABEL = (d, id) => (id === '_title' ? 'Finding Title' : BLOCK_LABELS[(d.blocks.find((b) => b.id === id) || (d.submitted?.blocks || []).find((b) => b.id === id) || {}).type] || 'block');

  host.addEventListener('click', async (e) => {
    const nav = e.target.closest('[data-nav]');
    const btn = e.target.closest('[data-act]');
    if (btn) {
      e.stopPropagation();
      const cid = btn.dataset.c, b = btn.dataset.b;
      switch (btn.dataset.act) {
        case 'reply': {
          const t = (typed[cid] || '').trim();
          if (!t) { toast('Type your reply first.', 'warn'); return; }
          await act((d) => { const c = d.comments.find((x) => x.id === cid); if (!c) return false; c.replies = [...(c.replies || []), { by: me.email, at: new Date().toISOString(), text: t }]; delete typed[cid]; });
          toast('Reply saved.', 'ok'); return;
        }
        case 'open': focus = 'c:' + cid; render(); host.querySelector(`[data-reply="${cid}"]`)?.focus(); return;
        case 'resolve': await act((d) => { const c = d.comments.find((x) => x.id === cid); if (!c) return false; c.resolved = true; c.resolvedBy = me.email; c.resolvedAt = new Date().toISOString(); delete typed[cid]; }); return;
        case 'reopen': await act((d) => { const c = d.comments.find((x) => x.id === cid); if (!c) return false; c.resolved = false; delete c.resolvedBy; delete c.resolvedAt; }); return;
        case 'restore': {
          await act((d) => {
            const base = d.submitted ? d.submitted.blocks : [];
            if (b === '_title') d.title = d.submitted.title;
            else {
              const i = d.blocks.findIndex((x) => x.id === b), old = base.find((x) => x.id === b);
              if (i >= 0 && old) d.blocks[i] = clone(old);
              else if (i >= 0) d.blocks.splice(i, 1);
              else if (old) {
                const bi = base.indexOf(old); let at = 0;
                for (let j = bi - 1; j >= 0; j--) { const k = d.blocks.findIndex((x) => x.id === base[j].id); if (k >= 0) { at = k + 1; break; } }
                d.blocks.splice(at, 0, clone(old));
              }
            }
            d.editedBy = { ...(d.editedBy || {}), [b]: me.email };
          }, `Restored the original wording (${LABEL(data, b)})`);
          toast('Original wording restored.', 'ok'); return;
        }
        case 'replyx': draft = { corr: b, text: '' }; focus = 'x:' + b; render(); return;
        case 'adddraft': if (!(draft && (draft.text || '').trim())) { toast('Type your comment first.', 'warn'); return; } await flush(); toast('Comment added.', 'ok'); return;
        case 'canceldraft': draft = null; dirtyCheck(); render(); return;
      }
      return;
    }
    if (nav) {
      if (nav.disabled) return;
      const i = items.indexOf(focus);
      focus = items[Math.max(0, Math.min(items.length - 1, i < 0 ? 0 : i + Number(nav.dataset.nav)))] || '';
      applyFocus(); return;
    }
    if (e.target.id === 'rv-float') return;
    const m = e.target.closest('mark[data-c]'), x = e.target.closest('[data-x]');
    if (m && m.dataset.c !== '_new') { focus = 'c:' + m.dataset.c; applyFocus(); return; }
    if (x) { focus = 'x:' + x.dataset.x; applyFocus(); return; }
    const card = e.target.closest('.rv-card[data-key]');
    if (card && card.dataset.key !== '_new' && !e.target.closest('textarea')) { if (focus !== card.dataset.key) { focus = card.dataset.key; applyFocus(); } }
  });
  if (opts.navEl) opts.navEl.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]'); if (!nav || nav.disabled) return;
    const i = items.indexOf(focus);
    focus = items[Math.max(0, Math.min(items.length - 1, i < 0 ? 0 : i + Number(nav.dataset.nav)))] || '';
    applyFocus();
  });
  host.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA') return;
    const card = e.target.closest('.rv-card[data-key]'); if (card) { focus = card.dataset.key; applyFocus(); }
  });
  host.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'rv-draft' && draft) draft.text = t.value;
    else if (t.dataset.reply) typed[t.dataset.reply] = t.value;
    dirtyCheck();
  });

  // Select words in the document → "Comment" button next to them.
  if (opts.canAct) {
    host.addEventListener('mouseup', () => setTimeout(pickSelection, 0));
    host.addEventListener('keyup', (e) => { if (e.shiftKey) pickSelection(); });
  }
  let picked = null;
  function pickSelection() {
    const fl = host.querySelector('#rv-float'); if (!fl) return;
    const s = window.getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) { fl.hidden = true; return; }
    const r = s.getRangeAt(0);
    const docEl = host.querySelector('#rv-doc');
    if (!docEl.contains(r.commonAncestorContainer)) { fl.hidden = true; return; }
    const startEl = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement).closest('[data-part]');
    if (!startEl) { fl.hidden = true; return; }
    const frag = r.cloneContents();
    frag.querySelectorAll('del, .ini, .lt').forEach((n) => n.remove());
    let quote = frag.textContent.split('\n')[0].replace(/\s+/g, ' ').trim().slice(0, 300);
    const blockId = startEl.dataset.b, part = startEl.dataset.part;
    const curB = blockId === '_title' ? null : data.blocks.find((b) => b.id === blockId);
    const full = blockId === '_title' ? fill(data.title) : curB ? fill(partVal(curB, part)) : '';
    if (!quote || !full) { fl.hidden = true; return; }
    if (full.indexOf(quote) < 0) { const q2 = full.replace(/\s+/g, ' '); if (q2.indexOf(quote) < 0) { fl.hidden = true; return; } }
    picked = { blockId, part, quote };
    const box = r.getBoundingClientRect(), dbox = docEl.getBoundingClientRect();
    fl.style.top = (box.bottom - dbox.top + 6) + 'px';
    fl.style.left = Math.max(8, Math.min(dbox.width - 130, box.left - dbox.left)) + 'px';
    fl.hidden = false;
  }
  host.addEventListener('mousedown', (e) => {
    if (e.target.id !== 'rv-float') return;
    e.preventDefault();
    if (!picked) return;
    draft = { ...picked, text: '' }; focus = '_new';
    window.getSelection().removeAllRanges();
    render();
  });

  render();
  return { flush, get data() { return data; } };
}
mountReview.focus = {};

