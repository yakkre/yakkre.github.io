// The notebook: a small black-and-white book in the corner of /problems/.
// Closed, it is the book mark (drag it anywhere, click to open). Open, the cover swings back into a two-page spread:
// the left page lists your tabs (add, rename, reorder, delete), the right page is the open tab with Edit and View
// modes and a ribbon that closes the book. The handle in the middle slides left or right to give one page more room;
// drag the book from its frame, anywhere on the left page, the header, or empty space on the right page in View mode;
// resize it from the bottom-right corner. On narrow screens it opens as a single page with a Tabs button.
// Design adapted from the user's <book-widget> reference; built in the light DOM so MathJax can render notes.
import {parseNote, renderNote} from './notes-view.mjs?v=20261117-latex';
import {typesetMath} from './statement-view.mjs?v=20261110-aopsmacros';
import {cleanTabs, moveTab, nextOrder, newTabId, linkProblems, readLocalTabs, writeLocalTabs, MAX_TABS, MAX_TITLE, MAX_TEXT} from './notebook-core.mjs?v=20261117-notebook';

const UI_KEY = 'raindrops-notebook-ui-v2';
const EDGE = 8, DRAG_THRESHOLD = 4, CORNER_OFFSET = 24, FRAME = 8;
const MIN_LW = 150, MAX_LW = 560, MIN_RW = 260, MAX_RW = 1000, MIN_PH = 320, MAX_PH = 900;
// The book body inside the 32-unit icon box: x 6–26, y 2–30 (the spread grows out of it).
const GLYPH = {x: 6 / 32, y: 2 / 32, w: 20 / 32, h: 28 / 32};
const BODY_PATH = 'M10 2H24.5A1.5 1.5 0 0 1 26 3.5V28.5A1.5 1.5 0 0 1 24.5 30H10A4 4 0 0 1 6 26V6A4 4 0 0 1 10 2Z';
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const readUi = () => { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {}; } catch { return {}; } };
const el = (tag, className, text) => { const n = document.createElement(tag); if (className) n.className = className; if (text != null) n.textContent = text; return n; };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ARROW = d => `<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="${d}" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

const TEMPLATE = `
<button class="nbk-tome" type="button" aria-haspopup="dialog" aria-expanded="false" draggable="false" title="Notebook (drag to move)" aria-label="Open notebook">
  <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <path class="nbk-g-halo" d="${BODY_PATH}"/><path class="nbk-g-ink" d="${BODY_PATH}"/>
    <path class="nbk-g-paper" d="M10 22H26V26H10A2 2 0 0 1 10 22Z"/><path class="nbk-g-rule" d="M10.5 24H26"/>
    <path class="nbk-g-paper" d="M18 2H22V12L20 10L18 12Z"/>
  </svg>
</button>
<div class="nbk-spread" role="dialog" aria-label="Notebook" tabindex="-1">
  <div class="nbk-shade"></div>
  <div class="nbk-half nbk-left"><div class="nbk-page">
    <div class="nbk-front">
      <h2 class="nbk-title">Notebook</h2>
      <svg class="nbk-fleuron" viewBox="0 0 76 9" aria-hidden="true" focusable="false"><path d="M0 4.5H30M46 4.5H76" stroke="currentColor" stroke-width="1" fill="none"/><path d="M38 .5L42 4.5L38 8.5L34 4.5Z" fill="currentColor"/></svg>
      <p class="nbk-intro"></p>
      <nav aria-label="Tabs"><ol class="nbk-toc"></ol></nav>
      <button class="nbk-add" type="button"><span aria-hidden="true">+</span> New tab</button>
    </div>
  </div></div>
  <div class="nbk-half nbk-right"><div class="nbk-page">
    <div class="nbk-head">
      <button class="nbk-contents" type="button" aria-label="Show tabs">${ARROW('M9 2L4 7L9 12')}<span>Tabs</span></button>
      <span class="nbk-running"></span><span class="nbk-status" aria-live="polite"></span>
      <div class="nbk-size" role="group" aria-label="Text size"><button type="button" data-size="-1" aria-label="Smaller text" title="Smaller text (Ctrl/⌘ −)"><span class="nbk-a-small">A</span></button><button type="button" data-size="1" aria-label="Larger text" title="Larger text (Ctrl/⌘ +)"><span class="nbk-a-large">A</span></button></div>
      <div class="nbk-mode" role="group" aria-label="Mode"><button type="button" data-mode="edit">Edit</button><button type="button" data-mode="view">View</button></div>
    </div>
    <button class="nbk-ribbon" type="button" aria-label="Close notebook" title="Close (Esc)">
      <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>
    </button>
    <div class="nbk-body">
      <textarea class="nbk-text" spellcheck="true" aria-label="Notebook page"></textarea>
      <div class="nbk-view statement-text" tabindex="0"></div>
    </div>
    <div class="nbk-turn"></div>
  </div></div>
  <div class="nbk-spine" title="Slide to give a page more room · double-click to even them out" aria-hidden="true"></div>
  <div class="nbk-rz" data-dir="n" title="Drag to resize" aria-hidden="true"></div>
  <div class="nbk-rz" data-dir="s" title="Drag to resize" aria-hidden="true"></div>
  <div class="nbk-rz" data-dir="e" title="Drag to resize" aria-hidden="true"></div>
  <div class="nbk-rz" data-dir="w" title="Drag to resize" aria-hidden="true"></div>
  <div class="nbk-rz" data-dir="ne" title="Drag to resize" aria-hidden="true"></div>
  <div class="nbk-rz" data-dir="nw" title="Drag to resize" aria-hidden="true"></div>
  <div class="nbk-rz" data-dir="se" title="Drag to resize" aria-hidden="true"></div>
  <div class="nbk-rz" data-dir="sw" title="Drag to resize" aria-hidden="true"></div>
  <div class="nbk-grip" aria-hidden="true"></div>
  <div class="nbk-cover" aria-hidden="true">
    <div class="nbk-face nbk-out"><svg viewBox="0 0 20 28" preserveAspectRatio="none" focusable="false"><path class="nbk-g-paper" d="M4 20H20V24H4A2 2 0 0 1 4 20Z"/><path class="nbk-g-paper" d="M12 0H16V10L14 8L12 10Z"/></svg></div>
    <div class="nbk-face nbk-in"></div>
  </div>
  <div class="nbk-menu" role="menu" hidden></div>
</div>`;

// Storage used when the account module couldn't load: this browser only.
function localStore() {
  let tabs = readLocalTabs();
  return {
    notebookTabs: () => tabs.map(t => ({...t})),
    async saveTabs(changed) { const m = new Map(tabs.map(t => [t.id, t])); for (const t of changed) m.set(t.id, {...t, updated: Date.now()}); tabs = cleanTabs([...m.values()]); return writeLocalTabs(tabs); },
    async deleteTab(id) { tabs = tabs.filter(t => t.id !== id); return writeLocalTabs(tabs); },
  };
}

// store: the progress object (or null); has(key)/hrefFor(key)/open(key) link problem names to their entries.
export function createNotebook({store, has, hrefFor, open}) {
  store = store || localStore();
  const ui = {open: false, mode: 'edit', active: null, anchor: null, lw: 300, rw: 400, ph: 470, fs: 15, ...readUi()};
  if (ui.pw && !readUi().lw) { ui.lw = ui.pw; ui.rw = ui.pw; } delete ui.pw; // sizes saved before the slider
  const saveUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* ignore */ } };

  const root = el('div', 'nbk'); root.dataset.state = 'closed'; root.dataset.layout = 'spread';
  root.innerHTML = TEMPLATE;
  document.body.append(root);
  const $ = s => root.querySelector(s);
  const tome = $('.nbk-tome'), spread = $('.nbk-spread'), shade = $('.nbk-shade'), cover = $('.nbk-cover');
  const front = $('.nbk-front'), toc = $('.nbk-toc'), add = $('.nbk-add'), intro = $('.nbk-intro');
  const running = $('.nbk-running'), ribbon = $('.nbk-ribbon'), body = $('.nbk-body'), text = $('.nbk-text'), view = $('.nbk-view');
  const statusEl = $('.nbk-status'), turnEl = $('.nbk-turn');
  const spine = $('.nbk-spine'), menu = $('.nbk-menu'), contentsBtn = $('.nbk-contents');
  const modeBtn = {edit: $('[data-mode=edit]'), view: $('[data-mode=view]')};
  text.maxLength = MAX_TEXT;
  text.placeholder = 'Main ideas, tricks, observations…\n\nLaTeX works: $x^2$ or $$\\sum a_i$$.\nHide a spoiler with [\\hide="Label"] … [\\hide].\nProblem names like 2019 C6 become links in View.';

  let state = 'closed', tabs = store.notebookTabs(), dirty = false, saveTimer = null, renaming = null, dragId = null;
  let status = '', home = {x: 0, y: 0}, pos = {x: 0, y: 0}, anims = [], settle = null, turn = null, drag = null, lastDragEnd = -1e9;

  // ---------- geometry
  const vp = () => ({w: document.documentElement.clientWidth || innerWidth, h: document.documentElement.clientHeight || innerHeight});
  function applySize() {
    ui.lw = clamp(ui.lw, MIN_LW, MAX_LW); ui.rw = clamp(ui.rw, MIN_RW, MAX_RW); ui.ph = clamp(ui.ph, MIN_PH, MAX_PH);
    root.style.setProperty('--nbk-lw', ui.lw + 'px');
    root.style.setProperty('--nbk-rw', ui.rw + 'px');
    root.style.setProperty('--nbk-ph', ui.ph + 'px');
    root.style.setProperty('--nbk-fs', ui.fs + 'px');
    // share of the spread taken by the right-hand page (the closed book is that page)
    root.style.setProperty('--nbk-rfrac', String((ui.rw + FRAME) / (ui.lw + ui.rw + 2 * FRAME)));
  }
  function updateLayout() {
    root.dataset.layout = 'spread';
    if (spread.offsetWidth > vp().w - 2 * EDGE) root.dataset.layout = 'single';
  }
  const single = () => root.dataset.layout === 'single';
  const rightWidth = () => single() ? spread.offsetWidth : spread.offsetWidth - (ui.lw + FRAME);
  const rfrac = () => single() ? 1 : rightWidth() / spread.offsetWidth;
  const cornerAnchor = () => ({h: 'right', dx: CORNER_OFFSET, v: 'bottom', dy: CORNER_OFFSET});
  const validAnchor = a => a && (a.h === 'left' || a.h === 'right') && (a.v === 'top' || a.v === 'bottom') && Number.isFinite(a.dx) && Number.isFinite(a.dy);
  function clampHome() { const v = vp(), s = tome.offsetWidth; home.x = clamp(home.x, EDGE, v.w - s - EDGE); home.y = clamp(home.y, EDGE, v.h - s - EDGE); }
  function applyTome() { tome.style.left = home.x + 'px'; tome.style.top = home.y + 'px'; }
  function applySpread() { spread.style.left = pos.x + 'px'; spread.style.top = pos.y + 'px'; }
  function placeTome() {
    const v = vp(), s = tome.offsetWidth, a = validAnchor(ui.anchor) ? ui.anchor : cornerAnchor();
    home.x = a.h === 'left' ? a.dx : v.w - s - a.dx; home.y = a.v === 'top' ? a.dy : v.h - s - a.dy;
    clampHome(); applyTome();
  }
  // Pin the closed book to whichever corner it is nearest, so it survives window resizes.
  function anchorFromHome() {
    const v = vp(), s = tome.offsetWidth, right = v.w - s - home.x, bottom = v.h - s - home.y;
    ui.anchor = {h: home.x <= right ? 'left' : 'right', dx: Math.round(Math.min(home.x, right)), v: home.y <= bottom ? 'top' : 'bottom', dy: Math.round(Math.min(home.y, bottom))};
    saveUi();
  }
  function glyphRect() { const s = tome.offsetWidth; return {x: home.x + s * GLYPH.x, y: home.y + s * GLYPH.y, w: s * GLYPH.w, h: s * GLYPH.h}; }
  // The right-hand page grows out of the closed book, kept on screen.
  function placeSpread() {
    const v = vp(), W = spread.offsetWidth, H = spread.offsetHeight, g = glyphRect();
    const R = rightWidth();
    pos.x = clamp(g.x + g.w / 2 - (W - R) - R / 2, EDGE, v.w - W - EDGE);
    pos.y = clamp(g.y + g.h / 2 - H / 2, EDGE, v.h - H - EDGE);
    applySpread();
  }
  function keepSpreadOnScreen() {
    const v = vp(), W = spread.offsetWidth, H = spread.offsetHeight;
    pos.x = clamp(pos.x, EDGE, v.w - W - EDGE); pos.y = clamp(pos.y, EDGE, v.h - H - EDGE); applySpread();
  }
  // The transform that shrinks the spread so its closed half lands exactly on the icon.
  function closedTransform() {
    const W = spread.offsetWidth, H = spread.offsetHeight, g = glyphRect(), R = rightWidth();
    const sx = g.w / R, sy = g.h / H;
    return `translate(${g.x - pos.x - sx * (W - R)}px, ${g.y - pos.y}px) scale(${sx}, ${sy})`;
  }
  addEventListener('resize', () => {
    finish(); finishTurn(); updateLayout(); placeTome();
    if (state === 'open') keepSpreadOnScreen();
  });

  // ---------- open / close
  function setState(s) { state = s; root.dataset.state = s; tome.setAttribute('aria-expanded', String(s === 'open' || s === 'opening')); }
  const isOpen = () => state === 'open' || state === 'opening';
  function setOpen(on, animate = true) {
    if (on === isOpen()) return;
    finish(); finishTurn();
    const motion = animate && !reduced() && typeof spread.animate === 'function';
    const focusInside = root.contains(document.activeElement);
    ui.open = on; saveUi();
    if (on) {
      renderAll(); updateLayout(); placeSpread();
      const done = () => { setState('open'); front.scrollTop = 0; if (animate) focusPage(); };
      if (motion) { setState('opening'); run(openAnimations(), done); } else done();
    } else {
      flush(); closeMenu(); root.classList.remove('nbk-show-tabs');
      const done = () => { setState('closed'); if (focusInside) tome.focus({preventScroll: true}); };
      if (motion) { setState('closing'); run(closeAnimations(), done); } else done();
    }
  }
  function focusPage() { (ui.mode === 'edit' ? text : view).focus({preventScroll: true}); }
  // The cover is as wide as the right-hand page and swings about the middle. Once it passes edge-on it is sized at
  // every angle so its on-screen footprint (perspective included) never reaches past either edge of the book, and it lands
  // exactly on the left page however far the middle has been slid. Returns keyframes for the opening swing.
  const PERSPECTIVE = 2200; // must match .nbk-spread perspective in catalogue.css
  function coverSwing() {
    const R = rightWidth(), L = spread.offsetWidth - R, frames = [];
    for (let a = 0; a <= 180; a += 7.5) {
      let sx = 1;
      if (a > 0 && a < 90) {
        // lifting off the right page: perspective would push the free edge past the book's right edge
        const rad = a * Math.PI / 180;
        sx = Math.min(1, PERSPECTIVE / (Math.cos(rad) * PERSPECTIVE + R * Math.sin(rad)));
      } else if (a > 90) {
        const rad = a * Math.PI / 180, c = -Math.cos(rad), si = Math.sin(rad);
        // largest scale whose free edge, projected, stays within the left page: R·s·c·P / (P − R·s·si) ≤ L
        const fit = L * PERSPECTIVE / (R * (c * PERSPECTIVE + L * si));
        const ease = (a - 90) / 90;
        sx = Math.min(1 + (L / R - 1) * ease, fit, Math.max(1, L / R));
        if (a === 180) sx = L / R;
      }
      frames.push({transform: `rotateY(${-a}deg) scaleX(${sx.toFixed(4)})`, offset: a / 180});
    }
    return frames;
  }
  function openAnimations() {
    const list = [spread.animate([{transform: closedTransform()}, {transform: 'translate(0px, 0px) scale(1, 1)'}], {duration: 520, easing: 'cubic-bezier(.2, .85, .25, 1)', fill: 'both'})];
    if (single()) {
      list.push(cover.animate([{transform: 'rotateY(0deg)', opacity: 1}, {transform: 'rotateY(-65deg)', opacity: 1, offset: 0.6}, {transform: 'rotateY(-90deg)', opacity: 0}],
        {duration: 520, delay: 70, easing: 'cubic-bezier(.45, .05, .35, 1)', fill: 'both'}));
    } else {
      const timing = {duration: 580, delay: 70, easing: 'cubic-bezier(.45, .05, .3, 1)', fill: 'both'};
      list.push(cover.animate(coverSwing(), timing));
      list.push(shade.animate([{transform: `scaleX(${rfrac()})`}, {transform: `scaleX(${rfrac()})`, offset: 0.5}, {transform: 'scaleX(1)'}], timing));
    }
    return list;
  }
  function closeAnimations() {
    const list = [spread.animate([{transform: 'translate(0px, 0px) scale(1, 1)'}, {transform: closedTransform()}], {duration: 420, delay: 110, easing: 'cubic-bezier(.6, 0, .75, .35)', fill: 'both'})];
    if (single()) {
      list.push(cover.animate([{transform: 'rotateY(-90deg)', opacity: 0}, {transform: 'rotateY(-65deg)', opacity: 1, offset: 0.4}, {transform: 'rotateY(0deg)', opacity: 1}],
        {duration: 420, easing: 'cubic-bezier(.45, .05, .35, 1)', fill: 'both'}));
    } else {
      const timing = {duration: 440, easing: 'cubic-bezier(.45, .05, .3, 1)', fill: 'both'};
      list.push(cover.animate(coverSwing().reverse().map(k => ({...k, offset: 1 - k.offset})), timing));
      list.push(shade.animate([{transform: 'scaleX(1)'}, {transform: `scaleX(${rfrac()})`, offset: 0.5}, {transform: `scaleX(${rfrac()})`}], timing));
    }
    return list;
  }
  // Run animations, then apply the end state exactly once.
  function run(list, done) {
    anims = list; settle = done;
    Promise.all(list.map(a => a.finished)).then(() => { if (anims === list) finish(); }, () => {});
    // Safety net: settle even if the browser throttles animations (e.g. a background tab).
    setTimeout(() => { if (anims === list) finish(); }, 900);
  }
  function finish() { const s = settle, list = anims; settle = null; anims = []; if (s) s(); list.forEach(a => a.cancel()); }

  // ---------- page turn (switching tabs)
  function animateTurn(dir, swap) {
    const t = {swap, anim: null}; turn = t;
    turnEl.style.visibility = 'visible';
    const ease = 'cubic-bezier(.5, 0, .2, 1)';
    const hide = dir > 0 ? [[{transform: 'scaleX(1)', opacity: 0}, {transform: 'scaleX(1)', opacity: 1}], {duration: 90, fill: 'both'}]
      : [[{transform: 'scaleX(0)'}, {transform: 'scaleX(1)'}], {duration: 360, easing: ease, fill: 'both'}];
    const reveal = dir > 0 ? [[{transform: 'scaleX(1)'}, {transform: 'scaleX(0)'}], {duration: 400, easing: ease, fill: 'both'}]
      : [[{transform: 'scaleX(1)', opacity: 1}, {transform: 'scaleX(1)', opacity: 0}], {duration: 130, fill: 'both'}];
    t.anim = turnEl.animate(...hide);
    t.anim.finished.then(() => {
      if (turn !== t) return;
      t.swap(); t.swap = null;
      const first = t.anim; t.anim = turnEl.animate(...reveal); first.cancel();
      return t.anim.finished.then(() => { if (turn === t) finishTurn(); });
    }).catch(() => {});
  }
  function finishTurn() { const t = turn; if (!t) return; turn = null; if (t.swap) t.swap(); if (t.anim) t.anim.cancel(); turnEl.style.visibility = ''; }

  // ---------- dragging: the closed book; the open book (frame, left page, header, empty space in View);
  // the middle slider (page widths); the edges and corners (size)
  function dragStart(e, what) {
    if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (what === 'tome' ? state !== 'closed' : state !== 'open') return;
    const target = what === 'tome' ? tome : what === 'resize' ? e.target : what === 'split' ? spine : spread;
    // resize works from the size actually on screen (the page may be capped by the window)
    const right = root.querySelector('.nbk-right .nbk-page');
    drag = {id: e.pointerId, what, target, x: e.clientX, y: e.clientY, moved: false, dir: e.target.dataset?.dir,
      lw: ui.lw, rw: what === 'resize' ? right.offsetWidth : ui.rw, ph: right.offsetHeight, px: pos.x, py: pos.y};
    if (what === 'resize') root.style.setProperty('--nbk-rz-cursor', getComputedStyle(e.target).cursor);
    try { target.setPointerCapture(e.pointerId); } catch { /* gone */ }
    if (what !== 'tome') e.preventDefault();
  }
  function dragMove(e) {
    const d = drag; if (!d || e.pointerId !== d.id) return;
    let dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved) { if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return; d.moved = true; root.classList.add({resize: 'nbk-resizing', split: 'nbk-splitting'}[d.what] || 'nbk-dragging'); closeMenu(); }
    const v = vp();
    if (d.what === 'tome') {
      const bx = home.x, by = home.y; home.x += dx; home.y += dy; clampHome();
      d.x += home.x - bx; d.y += home.y - by; applyTome();
    } else if (d.what === 'spread') {
      const W = spread.offsetWidth, H = spread.offsetHeight;
      const nx = clamp(pos.x + dx, EDGE, v.w - W - EDGE), ny = clamp(pos.y + dy, EDGE, v.h - H - EDGE);
      dx = nx - pos.x; dy = ny - pos.y; pos.x = nx; pos.y = ny; d.x += dx; d.y += dy; applySpread();
      // the closed book follows, so closing returns it near where the spread was left
      home.x += dx; home.y += dy; clampHome(); applyTome();
    } else if (d.what === 'split') {
      // the outer edges stay put; the middle moves, so one page grows as the other shrinks
      const total = d.lw + d.rw;
      ui.lw = Math.round(clamp(d.lw + dx, MIN_LW, Math.min(MAX_LW, total - MIN_RW)));
      ui.rw = total - ui.lw;
      applySize();
    } else if (d.what === 'resize') {
      // Edges move with the pointer: east/south grow the right page and the height; west grows the left page
      // (or the only page) and moves the book left; north grows the height and moves the book up.
      const one = single(), dir = d.dir;
      if (dir.includes('e')) {
        const left = one ? 0 : ui.lw + FRAME;
        ui.rw = Math.round(clamp(d.rw + dx, MIN_RW, Math.min(MAX_RW, v.w - EDGE - d.px - left - FRAME)));
      }
      if (dir.includes('w')) {
        const key = one ? 'rw' : 'lw', min = one ? MIN_RW : MIN_LW, max = one ? MAX_RW : MAX_LW;
        const w = Math.round(clamp(d[key] - dx, min, Math.min(max, d[key] + d.px - EDGE)));
        pos.x = d.px + (d[key] - w); ui[key] = w;
      }
      if (dir.includes('s')) ui.ph = Math.round(clamp(d.ph + dy, MIN_PH, Math.min(MAX_PH, v.h - EDGE - d.py - 2 * FRAME)));
      if (dir.includes('n')) {
        const h = Math.round(clamp(d.ph - dy, MIN_PH, Math.min(MAX_PH, d.ph + d.py - EDGE)));
        pos.y = d.py + (d.ph - h); ui.ph = h;
      }
      applySize(); applySpread();
    }
  }
  function dragEnd(e) {
    const d = drag; if (!d || e.pointerId !== d.id) return;
    drag = null;
    try { d.target.releasePointerCapture(d.id); } catch { /* released */ }
    if (!d.moved) return;
    root.classList.remove('nbk-dragging', 'nbk-resizing', 'nbk-splitting');
    lastDragEnd = performance.now();
    if (d.what === 'resize' || d.what === 'split') { saveUi(); updateLayout(); keepSpreadOnScreen(); } else anchorFromHome();
  }
  tome.addEventListener('pointerdown', e => dragStart(e, 'tome'));
  tome.addEventListener('click', () => { if (performance.now() - lastDragEnd < 350) return; setOpen(true); });
  // Shift + arrow keys move the closed book.
  tome.addEventListener('keydown', e => {
    const delta = {ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24]}[e.key];
    if (!e.shiftKey || !delta || state !== 'closed') return;
    e.preventDefault(); home.x += delta[0]; home.y += delta[1]; clampHome(); applyTome(); anchorFromHome();
  });
  // Is the point over a character of text (so a press there should select text, not move the book)?
  function overText(x, y) {
    let node, offset;
    if (document.caretPositionFromPoint) { const c = document.caretPositionFromPoint(x, y); node = c?.offsetNode; offset = c?.offset; }
    else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); node = r?.startContainer; offset = r?.startOffset; }
    if (!node || node.nodeType !== Node.TEXT_NODE) return false;
    for (const i of [offset - 1, offset]) {
      if (i < 0 || i >= node.length) continue;
      const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 1);
      for (const b of r.getClientRects()) if (x >= b.left - 3 && x <= b.right + 3 && y >= b.top - 2 && y <= b.bottom + 2) return true;
    }
    return false;
  }
  const onScrollbar = (el, e) => el.scrollHeight > el.clientHeight && e.clientX >= el.getBoundingClientRect().left + el.clientWidth;
  const CONTROLS = 'button, a, input, textarea, select, summary, details, mjx-container, .nbk-toc li, .nbk-menu';
  // Where a press moves the open book: the frame, anywhere on the left page (except its controls), the header of the
  // right page, and empty space in View mode. The middle is the page slider; the corner resizes.
  function moveTarget(e) {
    const t = e.target;
    if (t.classList.contains('nbk-half')) return true;
    if (t.closest(CONTROLS)) return false;
    if (t.closest('.nbk-left .nbk-page')) return !(t === front && onScrollbar(front, e));
    if (t.closest('.nbk-head')) return true;
    if (t === view) return ui.mode === 'view' && !onScrollbar(view, e) && !overText(e.clientX, e.clientY);
    return false;
  }
  spread.addEventListener('pointerdown', e => {
    if (e.target.classList.contains('nbk-rz')) dragStart(e, 'resize');
    else if (e.target === spine) dragStart(e, 'split');
    else if (moveTarget(e)) dragStart(e, 'spread');
  });
  // In View mode the cursor shows a hand over empty space, where a press moves the book.
  view.addEventListener('pointermove', e => { if (!drag) view.classList.toggle('nbk-grabbable', moveTarget(e)); });
  view.addEventListener('pointerleave', () => view.classList.remove('nbk-grabbable'));
  spine.addEventListener('dblclick', () => { const total = ui.lw + ui.rw; ui.lw = Math.round(total / 2); ui.rw = total - ui.lw; applySize(); saveUi(); });
  for (const node of [tome, spread]) {
    node.addEventListener('pointermove', dragMove);
    node.addEventListener('pointerup', dragEnd); node.addEventListener('pointercancel', dragEnd); node.addEventListener('lostpointercapture', dragEnd);
  }
  ribbon.addEventListener('click', () => setOpen(false));
  // Escape closes the book from inside it (a rename or the menu takes Escape first).
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.defaultPrevented || !isOpen()) return;
    const a = document.activeElement;
    if (!root.contains(a) && a && a !== document.body) return;
    e.preventDefault(); setOpen(false);
  });

  // ---------- tabs (left page)
  const active = () => tabs.find(t => t.id === ui.active) || null;
  const setStatus = s => { status = s; renderFolio(); };
  async function persist(changed) {
    if (!changed.length) return true;
    const ok = await store.saveTabs(changed);
    tabs = store.notebookTabs();
    return ok;
  }
  function renderIntro() {
    intro.textContent = store.user ? 'Your notes, kept with your account.' : 'Your notes, kept in this browser. Sign in to have them on every device.';
  }
  function renderToc() {
    if (!tabs.some(t => t.id === ui.active)) ui.active = tabs[0]?.id ?? null;
    toc.replaceChildren();
    if (!tabs.length) toc.append(el('li', 'nbk-none', 'No tabs yet.'));
    tabs.forEach((t, i) => {
      const li = el('li'); li.dataset.id = t.id;
      if (renaming === t.id) {
        const input = el('input', 'nbk-rename'); input.value = t.title; input.maxLength = MAX_TITLE; input.setAttribute('aria-label', 'Tab name');
        const done = async keep => {
          if (renaming !== t.id) return;
          renaming = null;
          const name = input.value.trim();
          if (keep && name && name !== t.title && !(await persist([{...t, title: name}]))) setStatus('Couldn’t rename');
          renderToc(); renderRunning();
        };
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); done(true); }
          if (e.key === 'Escape') { e.preventDefault(); done(false); }
        });
        input.addEventListener('blur', () => done(true));
        li.append(input); toc.append(li);
        requestAnimationFrame(() => { input.focus(); input.select(); });
        return;
      }
      li.draggable = true;
      const b = el('button', 'nbk-entry'); b.type = 'button'; b.title = 'Double-click to rename';
      if (t.id === ui.active) b.setAttribute('aria-current', 'page');
      const dots = el('span', 'dots'); dots.setAttribute('aria-hidden', 'true');
      b.append(el('span', 't', t.title), dots, el('span', 'n', String(i + 1)));
      b.addEventListener('click', () => { goTo(t.id); root.classList.remove('nbk-show-tabs'); });
      b.addEventListener('dblclick', () => startRename(t.id));
      const more = el('button', 'nbk-more', '⋯'); more.type = 'button'; more.setAttribute('aria-label', `Options for ${t.title}`); more.setAttribute('aria-haspopup', 'menu');
      more.addEventListener('click', e => { e.stopPropagation(); openMenu(t.id, more); });
      li.append(b, more);
      li.addEventListener('dragstart', e => { dragId = t.id; li.classList.add('nbk-drag-src'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.title); });
      li.addEventListener('dragend', () => { dragId = null; li.classList.remove('nbk-drag-src'); toc.querySelectorAll('.nbk-drop-before,.nbk-drop-after').forEach(n => n.classList.remove('nbk-drop-before', 'nbk-drop-after')); });
      li.addEventListener('dragover', e => {
        if (!dragId || dragId === t.id) return;
        e.preventDefault(); const r = li.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
        li.classList.toggle('nbk-drop-after', after); li.classList.toggle('nbk-drop-before', !after);
      });
      li.addEventListener('dragleave', () => li.classList.remove('nbk-drop-before', 'nbk-drop-after'));
      li.addEventListener('drop', async e => {
        e.preventDefault(); if (!dragId || dragId === t.id) return;
        const after = li.classList.contains('nbk-drop-after'), from = tabs.findIndex(x => x.id === dragId);
        let to = tabs.findIndex(x => x.id === t.id) + (after ? 1 : 0); if (from < to) to--;
        await reorder(dragId, to);
      });
      toc.append(li);
    });
    add.disabled = tabs.length >= MAX_TABS;
    add.title = add.disabled ? `Up to ${MAX_TABS} tabs` : '';
  }
  async function reorder(id, to) {
    const {changed} = moveTab(tabs, id, to);
    if (!(await persist(changed))) setStatus('Couldn’t reorder');
    renderToc(); renderFolio();
  }
  function startRename(id) { closeMenu(); renaming = id; if (single()) root.classList.add('nbk-show-tabs'); renderToc(); }
  async function goTo(id) {
    if (!id || id === ui.active) return;
    await flush();
    const from = tabs.findIndex(t => t.id === ui.active), to = tabs.findIndex(t => t.id === id);
    finishTurn();
    const swap = () => { ui.active = id; saveUi(); dirty = false; renderToc(); renderPage(); body.scrollTop = 0; text.scrollTop = 0; };
    if (state === 'open' && !reduced() && from >= 0) animateTurn(to > from ? 1 : -1, swap); else swap();
  }
  async function addTab() {
    if (tabs.length >= MAX_TABS) return;
    await flush();
    const t = {id: newTabId(), title: `Tab ${tabs.length + 1}`, text: '', order: nextOrder(tabs), updated: Date.now()};
    if (!(await persist([t]))) { setStatus('Couldn’t add a tab'); return; }
    ui.active = t.id; saveUi(); dirty = false; setMode('edit', true); renaming = t.id; renderAll();
  }
  add.addEventListener('click', addTab);
  const step = d => { const i = tabs.findIndex(t => t.id === ui.active), next = tabs[i + d]; if (i >= 0 && next) goTo(next.id); };
  contentsBtn.addEventListener('click', () => root.classList.toggle('nbk-show-tabs'));
  // Cmd/Ctrl+E switches Edit/View; left/right arrows turn between tabs when the focus isn't in a text field.
  spread.addEventListener('keydown', e => {
    if (state !== 'open' || e.defaultPrevented) return;
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e') { e.preventDefault(); setMode(ui.mode === 'edit' ? 'view' : 'edit'); return; }
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });

  // Tab menu: rename, move up/down, delete
  function openMenu(id, anchor) {
    const t = tabs.find(x => x.id === id); if (!t) return;
    const i = tabs.indexOf(t);
    menu.replaceChildren();
    const item = (label, fn, disabled = false) => {
      const b = el('button', null, label); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.disabled = disabled;
      b.addEventListener('click', () => { closeMenu(); fn(); }); menu.append(b);
    };
    item('Rename', () => startRename(id));
    item('Move up', () => reorder(id, i - 1), i === 0);
    item('Move down', () => reorder(id, i + 1), i === tabs.length - 1);
    item('Delete', async () => {
      if (!confirm(`Delete the tab “${t.title}”? This can’t be undone.`)) return;
      if (!(await store.deleteTab(id))) { setStatus('Couldn’t delete'); return; }
      tabs = store.notebookTabs();
      if (ui.active === id) { ui.active = tabs[Math.min(i, tabs.length - 1)]?.id ?? null; saveUi(); dirty = false; }
      renderAll();
    });
    const sr = spread.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    menu.hidden = false;
    menu.style.left = Math.max(12, ar.right - sr.left - menu.offsetWidth) + 'px'; menu.style.top = (ar.bottom - sr.top + 4) + 'px';
    menu.querySelector('button:not(:disabled)')?.focus();
  }
  function closeMenu() { menu.hidden = true; }
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !e.target.closest('.nbk-more')) closeMenu(); });
  menu.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); closeMenu(); } });

  // ---------- the open tab (right page): Edit / View
  function setMode(m, quiet = false) {
    if (m === 'view') flush();
    ui.mode = m; saveUi();
    for (const [k, b] of Object.entries(modeBtn)) b.setAttribute('aria-pressed', String(k === m));
    root.classList.toggle('nbk-viewing', m === 'view');
    renderPage();
    if (!quiet && state === 'open') focusPage();
  }
  for (const [k, b] of Object.entries(modeBtn)) b.addEventListener('click', () => setMode(k));
  // View text size (equations scale with it): A A buttons in the header, or Ctrl/⌘ +, −, 0 while the book has focus.
  const SIZES = [11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 27, 30], DEFAULT_FS = 15;
  const sizeBtns = root.querySelectorAll('[data-size]');
  function setSize(fs) {
    ui.fs = fs; saveUi(); applySize();
    sizeBtns[0].disabled = fs <= SIZES[0]; sizeBtns[1].disabled = fs >= SIZES.at(-1);
  }
  function stepSize(dir) {
    const i = SIZES.findIndex(v => v >= ui.fs);
    setSize(SIZES[clamp((i < 0 ? SIZES.length - 1 : SIZES[i] === ui.fs ? i : dir > 0 ? i - 1 : i) + dir, 0, SIZES.length - 1)]);
  }
  sizeBtns.forEach(b => b.addEventListener('click', () => stepSize(Number(b.dataset.size))));
  spread.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || ui.mode !== 'view') return;
    if (e.key === '=' || e.key === '+') { e.preventDefault(); stepSize(1); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); stepSize(-1); }
    else if (e.key === '0') { e.preventDefault(); setSize(DEFAULT_FS); }
  });
  function renderRunning() { running.textContent = active()?.title ?? 'Notebook'; }
  function renderFolio() { statusEl.textContent = status; }
  let viewRun = 0;
  async function renderPage() {
    const t = active();
    renderRunning(); renderFolio();
    if (!dirty || !t) text.value = t?.text ?? '';
    if (ui.mode !== 'view') return;
    const run = ++viewRun, src = t ? (dirty ? text.value : t.text) : '';
    view.replaceChildren();
    if (!src.trim()) { view.append(el('p', 'nbk-empty', t ? 'This page is empty. Switch to Edit to write on it.' : 'No tabs yet. Add one on the left, or switch to Edit and start writing.')); return; }
    renderNote(view, parseNote(src), linkText);
    try { await typesetMath(view); } catch { if (run === viewRun) view.prepend(el('p', 'nbk-empty', 'Math rendering is unavailable right now.')); }
  }
  // Plain text, with problem names (2019 C6, RMM 2017/6) turned into links to their entries.
  function linkText(parent, str) {
    for (const p of linkProblems(str, has)) {
      if (p.type === 'text') { parent.append(document.createTextNode(p.text)); continue; }
      const a = el('a', 'nbk-link', p.text); a.href = hrefFor(p.key);
      a.addEventListener('click', e => { if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); open(p.key); });
      parent.append(a);
    }
  }
  // Autosave while typing; the first words written with no tab create one.
  async function flush() {
    clearTimeout(saveTimer); saveTimer = null;
    if (!dirty) return;
    dirty = false;
    let t = active();
    const value = text.value;
    if (!t) {
      if (!value.trim()) { setStatus(''); return; }
      t = {id: newTabId(), title: 'Notes', text: '', order: nextOrder(tabs)}; ui.active = t.id; saveUi();
    }
    if (t.text === value && tabs.some(x => x.id === t.id)) { setStatus('Saved'); return; }
    const ok = await persist([{...t, text: value}]);
    setStatus(ok ? 'Saved' : 'Couldn’t save');
    if (!ok) dirty = true;
    renderToc(); renderRunning();
  }
  text.addEventListener('input', () => { dirty = true; setStatus('Saving…'); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 700); });
  text.addEventListener('blur', flush);
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

  function renderAll() { renderIntro(); renderToc(); renderPage(); }
  // Called when the account data changes (sign-in, sync from another device).
  let lastSig = '';
  function refresh() {
    const next = store.notebookTabs(), sig = JSON.stringify([!!store.user, next.map(t => [t.id, t.title, t.text, t.order])]);
    if (sig === lastSig) return;
    lastSig = sig; tabs = next;
    if (state !== 'closed' && renaming == null) renderAll(); else renderIntro();
  }

  // ---------- start
  applySize(); setSize(clamp(Number(ui.fs) || DEFAULT_FS, SIZES[0], SIZES.at(-1)));
  for (const [k, b] of Object.entries(modeBtn)) b.setAttribute('aria-pressed', String(k === ui.mode));
  root.classList.toggle('nbk-viewing', ui.mode === 'view');
  placeTome();
  renderAll();
  if (ui.open) { ui.open = false; setOpen(true, false); }
  return {refresh, open: () => setOpen(true), close: () => setOpen(false)};
}
