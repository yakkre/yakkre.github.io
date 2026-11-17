// Floating notebook: free-form notes in tabs, not tied to one problem.
// Collapses into a small book button; the panel can be dragged by its header and resized from its corner.
// Edit mode is a plain textarea; view mode renders LaTeX, [\hide] boxes and links problem names (e.g. 2019 C6).
import {parseNote} from './notes-view.mjs?v=20261116-hide';
import {typesetMath} from './statement-view.mjs?v=20261110-aopsmacros';
import {cleanTabs, moveTab, nextOrder, newTabId, linkProblems, readLocalTabs, writeLocalTabs, MAX_TABS, MAX_TITLE, MAX_TEXT, DEFAULT_TITLE} from './notebook-core.mjs?v=20261117-notebook';

const UI_KEY = 'raindrops-notebook-ui';
const readUi = () => { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {}; } catch { return {}; } };
const el = (tag, className, text) => { const n = document.createElement(tag); if (className) n.className = className; if (text != null) n.textContent = text; return n; };
const BOOK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="40" height="40" aria-hidden="true"><rect x="13" y="9" width="42" height="51" rx="5" fill="#f3ead6" stroke="#ddd0b2" stroke-width="1.2"/><path d="M52.5 14v40M17 56.5h30" stroke="#d6c8a6" stroke-width="1.3" stroke-linecap="round"/><rect x="8" y="4" width="43" height="50" rx="5" fill="#0b5cad"/><path d="M13 4a5 5 0 0 0-5 5v40a5 5 0 0 0 5 5h3V4z" fill="#08427c"/><path d="M23 17h17M23 23h11" stroke="#cfe3fb" stroke-width="3" stroke-linecap="round"/><path d="M37 4v19l4-3.2 4 3.2V4z" fill="#e3b341"/></svg>';

// Storage used when the account module couldn't load: this browser only.
function localStore() {
  let tabs = readLocalTabs();
  return {
    notebookTabs: () => tabs.map(t => ({...t})),
    async saveTabs(changed) { const m = new Map(tabs.map(t => [t.id, t])); for (const t of changed) m.set(t.id, {...t, updated: Date.now()}); tabs = cleanTabs([...m.values()]); return writeLocalTabs(tabs); },
    async deleteTab(id) { tabs = tabs.filter(t => t.id !== id); return writeLocalTabs(tabs); },
  };
}

// store: the progress object (or null); has(key)/hrefFor(key)/open(key) link problem names to entries.
export function createNotebook({store, has, hrefFor, open}) {
  store = store || localStore();
  const ui = {open: false, mode: 'edit', active: null, ...readUi()};
  const saveUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* ignore */ } };
  let tabs = store.notebookTabs(), dirty = false, saveTimer = null, renaming = null, dragId = null;

  // ---- DOM
  const root = el('div', 'nb');
  const book = el('button', 'nb-book'); book.type = 'button'; book.innerHTML = BOOK; book.title = 'Notebook';
  book.setAttribute('aria-label', 'Open notebook'); book.setAttribute('aria-expanded', 'false');
  const panel = el('section', 'nb-panel'); panel.setAttribute('aria-label', 'Notebook'); panel.hidden = true;
  const head = el('header', 'nb-head');
  const title = el('span', 'nb-title'); title.innerHTML = BOOK; title.append(' Notebook');
  const modes = el('div', 'nb-mode'); modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'Mode');
  const modeBtn = {};
  for (const [m, label] of [['edit', 'Edit'], ['view', 'View']]) {
    const b = el('button', null, label); b.type = 'button'; b.dataset.mode = m; modeBtn[m] = b; modes.append(b);
    b.addEventListener('click', () => setMode(m));
  }
  const status = el('span', 'nb-status'); status.setAttribute('aria-live', 'polite');
  const min = el('button', 'nb-min', '–'); min.type = 'button'; min.title = 'Collapse to the book'; min.setAttribute('aria-label', 'Collapse notebook');
  head.append(title, modes, status, min);
  const body = el('div', 'nb-body');
  const side = el('nav', 'nb-side'); side.setAttribute('aria-label', 'Notebook tabs');
  const list = el('ul', 'nb-tabs');
  const add = el('button', 'nb-add', '+ New tab'); add.type = 'button';
  side.append(list, add);
  const page = el('div', 'nb-page');
  const text = el('textarea', 'nb-text'); text.maxLength = MAX_TEXT; text.spellcheck = true;
  text.placeholder = 'Main ideas, tricks, observations… LaTeX works: $x^2$, $$\\sum a_i$$. Hide spoilers with [\\hide="Label"] … [\\hide]. Problem names like 2019 C6 become links in View mode.';
  text.setAttribute('aria-label', 'Notebook page');
  const view = el('div', 'nb-view statement-text'); view.tabIndex = 0;
  page.append(text, view);
  body.append(side, page);
  const menu = el('div', 'nb-menu'); menu.hidden = true; menu.setAttribute('role', 'menu');
  panel.append(head, body, menu);
  root.append(book, panel);
  document.body.append(root);

  // ---- Position and size (kept inside the window)
  const small = () => matchMedia('(max-width: 600px)').matches;
  function clampBook() {
    const w = book.offsetWidth || 44, h = book.offsetHeight || 44;
    const x = ui.bx ?? innerWidth - w - 20, y = ui.by ?? innerHeight - h - 20;
    book.style.left = Math.max(4, Math.min(innerWidth - w - 4, x)) + 'px';
    book.style.top = Math.max(4, Math.min(innerHeight - h - 4, y)) + 'px';
  }
  function clampPanel() {
    if (small()) { panel.style.cssText = ''; return; }
    const w = Math.min(ui.w || 560, innerWidth - 16), h = Math.min(ui.h || 440, innerHeight - 16);
    const x = ui.x ?? innerWidth - w - 24, y = ui.y ?? innerHeight - h - 80;
    panel.style.width = w + 'px'; panel.style.height = h + 'px';
    panel.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + 'px';
    panel.style.top = Math.max(8, Math.min(innerHeight - 40, y)) + 'px';
  }
  addEventListener('resize', () => { clampBook(); if (!panel.hidden) clampPanel(); });
  // Drag: pointer on the handle moves target; returns true from onEnd if it was a real drag.
  function draggable(handle, target, onMove, onEnd, skip) {
    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0 || (skip && skip(e)) || small()) return;
      const r = target.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top, sx = e.clientX, sy = e.clientY;
      let moved = false;
      const move = ev => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
        moved = true; target.classList.add('nb-dragging');
        onMove(ev.clientX - dx, ev.clientY - dy);
      };
      const up = () => {
        removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
        target.classList.remove('nb-dragging'); onEnd(moved);
      };
      addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    });
  }
  let bookDragged = false;
  draggable(book, book, (x, y) => { ui.bx = x; ui.by = y; clampBook(); }, moved => { bookDragged = moved; if (moved) saveUi(); });
  draggable(head, panel, (x, y) => { ui.x = x; ui.y = y; clampPanel(); }, moved => { if (moved) saveUi(); }, e => e.target.closest('button'));
  // Native corner resize (CSS resize: both); remember the size.
  let sizeTimer = null;
  new ResizeObserver(() => {
    if (panel.hidden || small()) return;
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(() => { const w = panel.offsetWidth, h = panel.offsetHeight; if (w && h && (w !== ui.w || h !== ui.h)) { ui.w = w; ui.h = h; const r = panel.getBoundingClientRect(); ui.x = r.left; ui.y = r.top; saveUi(); } }, 200);
  }).observe(panel);

  // ---- Open / collapse
  function setOpen(on) {
    ui.open = on; saveUi();
    book.setAttribute('aria-expanded', String(on));
    root.classList.toggle('nb-is-open', on);
    if (on) {
      panel.hidden = false; clampPanel(); renderAll();
      requestAnimationFrame(() => panel.classList.add('nb-shown'));
      (ui.mode === 'edit' ? text : view).focus({preventScroll: true});
    } else {
      flush(); closeMenu();
      panel.classList.remove('nb-shown');
      setTimeout(() => { if (!ui.open) panel.hidden = true; }, 200);
      book.focus({preventScroll: true});
    }
  }
  book.addEventListener('click', () => { if (bookDragged) { bookDragged = false; return; } setOpen(true); });
  min.addEventListener('click', () => setOpen(false));

  // ---- Tabs
  const active = () => tabs.find(t => t.id === ui.active) || null;
  function setStatus(s) { status.textContent = s; }
  async function persist(changed) {
    if (!changed.length) return true;
    const ok = await store.saveTabs(changed);
    tabs = store.notebookTabs();
    return ok;
  }
  function renderTabs() {
    list.replaceChildren();
    if (!tabs.some(t => t.id === ui.active)) ui.active = tabs[0]?.id ?? null;
    for (const t of tabs) {
      const li = el('li', 'nb-tab' + (t.id === ui.active ? ' is-active' : '')); li.dataset.id = t.id; li.draggable = renaming !== t.id;
      if (renaming === t.id) {
        const input = el('input', 'nb-rename'); input.value = t.title; input.maxLength = MAX_TITLE; input.setAttribute('aria-label', 'Tab name');
        const done = async keep => {
          if (renaming !== t.id) return;
          renaming = null;
          const name = input.value.trim();
          if (keep && name && name !== t.title) { if (!(await persist([{...t, title: name}]))) setStatus('Couldn’t rename. Try again.'); }
          renderTabs();
        };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); done(true); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } });
        input.addEventListener('blur', () => done(true));
        li.append(input); list.append(li);
        requestAnimationFrame(() => { input.focus(); input.select(); });
        continue;
      }
      const b = el('button', 'nb-tab-name', t.title); b.type = 'button'; b.title = 'Double-click to rename';
      if (t.id === ui.active) b.setAttribute('aria-current', 'page');
      b.addEventListener('click', () => selectTab(t.id));
      b.addEventListener('dblclick', () => startRename(t.id));
      const more = el('button', 'nb-tab-more', '⋯'); more.type = 'button'; more.setAttribute('aria-label', `Options for ${t.title}`); more.setAttribute('aria-haspopup', 'menu');
      more.addEventListener('click', e => { e.stopPropagation(); openMenu(t.id, more); });
      li.append(b, more);
      // Drag to reorder
      li.addEventListener('dragstart', e => { dragId = t.id; li.classList.add('nb-drag-src'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.title); });
      li.addEventListener('dragend', () => { dragId = null; li.classList.remove('nb-drag-src'); list.querySelectorAll('.nb-drop-before,.nb-drop-after').forEach(n => n.classList.remove('nb-drop-before', 'nb-drop-after')); });
      li.addEventListener('dragover', e => {
        if (!dragId || dragId === t.id) return;
        e.preventDefault(); const r = li.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
        li.classList.toggle('nb-drop-after', after); li.classList.toggle('nb-drop-before', !after);
      });
      li.addEventListener('dragleave', () => li.classList.remove('nb-drop-before', 'nb-drop-after'));
      li.addEventListener('drop', async e => {
        e.preventDefault(); if (!dragId || dragId === t.id) return;
        const after = li.classList.contains('nb-drop-after'), from = tabs.findIndex(x => x.id === dragId);
        let to = tabs.findIndex(x => x.id === t.id) + (after ? 1 : 0); if (from < to) to--;
        await reorder(dragId, to);
      });
      list.append(li);
    }
    add.disabled = tabs.length >= MAX_TABS;
    add.title = add.disabled ? `Up to ${MAX_TABS} tabs` : '';
  }
  async function reorder(id, to) {
    const {changed} = moveTab(tabs, id, to);
    if (!(await persist(changed))) setStatus('Couldn’t reorder. Try again.');
    renderTabs();
  }
  function startRename(id) { closeMenu(); renaming = id; renderTabs(); }
  async function selectTab(id) {
    if (id === ui.active) return;
    await flush(); ui.active = id; saveUi(); dirty = false; renderAll();
  }
  async function addTab() {
    if (tabs.length >= MAX_TABS) return;
    await flush();
    const t = {id: newTabId(), title: `Tab ${tabs.length + 1}`, text: '', order: nextOrder(tabs), updated: Date.now()};
    if (!(await persist([t]))) { setStatus('Couldn’t add a tab. Try again.'); return; }
    ui.active = t.id; saveUi(); renaming = t.id; setMode('edit', true); renderAll();
  }
  add.addEventListener('click', addTab);

  // Tab options menu: rename, move up/down, delete
  function openMenu(id, anchor) {
    const t = tabs.find(x => x.id === id); if (!t) return;
    const i = tabs.indexOf(t);
    menu.replaceChildren();
    const item = (label, fn, disabled = false, danger = false) => {
      const b = el('button', danger ? 'nb-danger' : null, label); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.disabled = disabled;
      b.addEventListener('click', () => { closeMenu(); fn(); }); menu.append(b);
    };
    item('Rename', () => startRename(id));
    item('Move up', () => reorder(id, i - 1), i === 0);
    item('Move down', () => reorder(id, i + 1), i === tabs.length - 1);
    item('Delete', async () => {
      if (!confirm(`Delete the tab “${t.title}”? This can’t be undone.`)) return;
      if (!(await store.deleteTab(id))) { setStatus('Couldn’t delete. Try again.'); return; }
      tabs = store.notebookTabs(); if (ui.active === id) { ui.active = tabs[Math.min(i, tabs.length - 1)]?.id ?? null; saveUi(); dirty = false; }
      renderAll();
    }, false, true);
    const pr = panel.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    menu.style.left = (ar.left - pr.left) + 'px'; menu.style.top = (ar.bottom - pr.top + 2) + 'px';
    menu.hidden = false; menu.dataset.id = id; menu.querySelector('button:not(:disabled)')?.focus();
  }
  function closeMenu() { menu.hidden = true; }
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !e.target.closest('.nb-tab-more')) closeMenu(); });
  panel.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { e.stopPropagation(); closeMenu(); } });

  // ---- Page: edit / view
  function setMode(m, quiet = false) {
    if (m === 'view') flush();
    ui.mode = m; saveUi();
    for (const [k, b] of Object.entries(modeBtn)) b.setAttribute('aria-pressed', String(k === m));
    panel.classList.toggle('nb-viewing', m === 'view');
    renderPage();
    if (!quiet) (m === 'edit' ? text : view).focus({preventScroll: true});
  }
  let viewRun = 0;
  async function renderPage() {
    const t = active();
    if (!dirty || !t) text.value = t?.text ?? '';
    if (ui.mode !== 'view') return;
    const run = ++viewRun, src = t ? (dirty ? text.value : t.text) : '';
    view.replaceChildren();
    if (!src.trim()) { view.append(el('p', 'nb-empty', t ? 'This tab is empty. Switch to Edit to write.' : 'No tabs yet. Add one, or switch to Edit and start writing.')); return; }
    renderParts(view, parseNote(src));
    try { await typesetMath(view); } catch { if (run === viewRun) view.prepend(el('p', 'nb-empty', 'Math rendering is unavailable right now.')); }
  }
  function renderParts(parent, parts) {
    for (const part of parts) {
      if (part.type === 'text') {
        for (const p of linkProblems(part.text, has)) {
          if (p.type === 'text') { parent.append(document.createTextNode(p.text)); continue; }
          const a = el('a', 'nb-link', p.text); a.href = hrefFor(p.key);
          a.addEventListener('click', e => { if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); open(p.key); });
          parent.append(a);
        }
        continue;
      }
      const box = el('details', 'note-hide'), summary = el('summary', null, part.label), inner = el('div', 'note-hide-body');
      renderParts(inner, part.children); box.append(summary, inner); parent.append(box);
    }
  }
  // Autosave while typing (first text with no tab creates one).
  async function flush() {
    clearTimeout(saveTimer); saveTimer = null;
    if (!dirty) return;
    dirty = false;
    let t = active();
    const value = text.value;
    if (!t) {
      if (!value.trim()) return;
      t = {id: newTabId(), title: 'Notes', text: '', order: nextOrder(tabs)}; ui.active = t.id; saveUi();
    }
    if (t.text === value && tabs.some(x => x.id === t.id)) { setStatus('Saved'); return; }
    const ok = await persist([{...t, text: value}]);
    setStatus(ok ? 'Saved' : 'Couldn’t save. Your text is still here.');
    if (!ok) dirty = true;
    renderTabs();
  }
  text.addEventListener('input', () => { dirty = true; setStatus('Saving…'); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 700); });
  text.addEventListener('blur', flush);
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  // Keyboard: Ctrl/Cmd+E toggles Edit/View while the notebook has focus.
  panel.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e') { e.preventDefault(); setMode(ui.mode === 'edit' ? 'view' : 'edit'); }
  });

  function renderAll() { renderTabs(); renderPage(); }
  // Called when the account data changes (sign-in, sync from another device).
  let lastSig = '';
  function refresh() {
    const next = store.notebookTabs(), sig = JSON.stringify(next.map(t => [t.id, t.title, t.text, t.order]));
    if (sig === lastSig) return;
    lastSig = sig; tabs = next;
    if (!panel.hidden && renaming == null) renderAll();
  }
  function setStore(s) { if (s) { store = s; refresh(); } }

  // ---- Start
  for (const [k, b] of Object.entries(modeBtn)) b.setAttribute('aria-pressed', String(k === ui.mode));
  panel.classList.toggle('nb-viewing', ui.mode === 'view');
  clampBook();
  if (ui.open) { ui.open = false; setOpen(true); text.blur(); view.blur(); }
  return {refresh, setStore, open: () => setOpen(true)};
}
export {DEFAULT_TITLE};
