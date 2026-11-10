import {normalize, parseTagInput, selectProblems, validTagIds, problemName} from './catalogue-core.mjs?v=20261104-geometry';
import {renderStatement} from './statement-view.mjs?v=20261103-proposers';

const START_HREF = location.href; // before render() rewrites the URL: a sign-in link's code is in it
const $ = id => document.getElementById(id);
const PAGE_SIZE = 50;
const SUBJECTS = {A:'Algebra', C:'Combinatorics', N:'Number theory', G:'Geometry'};
const STATUS = {live:'Live forum checked', archive:'Archived forum checked', pending:'Forum check pending'};
const CONTESTS = {isl:'IMO Shortlist', rmm:'RMM'};
const FIELDS = [['search','query'],['contest','contest'],['subject','subject'],['evidence','evidence'],['difficulty','difficulty'],['done','done'],['from-year','from'],['to-year','to']];
const DONE = {yes:'Marked done', no:'Not done yet'};
let data, tags, filters, page = 1, progress = null, view = 'list', currentColl = '', sharedId = '', sharedCache = null;
let selecting = false, selectNote = '', lastResults = [];
const selected = new Set();
const VIEWS = ['list', 'grid', 'collections'];
function readView() {
  const q = new URLSearchParams(location.search);
  view = VIEWS.includes(q.get('view')) ? q.get('view') : 'list';
  currentColl = view === 'collections' ? q.get('c') || '' : '';
  sharedId = view === 'collections' && /^[A-Za-z0-9_-]{4,40}$/.test(q.get('shared') || '') ? q.get('shared') : '';
}

const node = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
};
const button = (className, text, onClick, title) => {
  const b = node('button', className, text); b.type = 'button';
  if (title) b.title = title;
  b.addEventListener('click', onClick); return b;
};
function sourceLink(label, url) {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== 'https:') return null;
  const a = node('a', null, label);
  a.href = parsed.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
  return a;
}
const shorten = label => label.replace(/^[ACNG]: /, '');
const emptyFilters = () => ({query:'', contest:'', subject:'', from:'', to:'', evidence:'', difficulty:'', done:'', tags:[], mode:'AND', problem:''});

function readFilters() {
  const q = new URLSearchParams(location.search);
  return {query:q.get('q')||'', contest:['isl','rmm'].includes(q.get('contest'))?q.get('contest'):'',
    subject:Object.hasOwn(SUBJECTS,q.get('subject'))?q.get('subject'):'',
    evidence:['live','archive','pending'].includes(q.get('evidence'))?q.get('evidence'):'',
    difficulty:['1','2','3','4','5','none'].includes(q.get('difficulty'))?q.get('difficulty'):'',
    done:Object.hasOwn(DONE,q.get('done'))?q.get('done'):'',
    from:q.get('from')||'', to:q.get('to')||'', mode:q.get('mode')==='OR'?'OR':'AND',
    tags:validTagIds((q.get('tags')||'').split(','), data.taxonomy),
    problem:data.problems.some(p=>p.key===q.get('problem'))?q.get('problem'):''};
}
function searchUrl(override={}) {
  const f = {...filters, ...override}, q = new URLSearchParams();
  for (const [key,val] of Object.entries({q:f.query, contest:f.contest, subject:f.subject, evidence:f.evidence, difficulty:f.difficulty, done:f.done, from:f.from, to:f.to, problem:f.problem})) if (val) q.set(key, val);
  if (f.tags.length) q.set('tags', f.tags.join(','));
  const v = override.view ?? view;
  if (v !== 'list') q.set('view', v);
  if (v === 'collections' && (override.c ?? currentColl)) q.set('c', override.c ?? currentColl);
  if (v === 'collections' && (override.shared ?? sharedId)) q.set('shared', override.shared ?? sharedId);
  if (f.mode === 'OR') q.set('mode', 'OR');
  return location.pathname + (q.size ? '?' + q : '');
}
const entryUrl = p => searchUrl({...emptyFilters(), problem:p.key, view:'list'});
const filtersActive = f => !!(f.query || f.contest || f.subject || f.from || f.to || f.evidence || f.difficulty || f.done || f.tags.length);

function syncControls() {
  for (const [id,key] of FIELDS) $(id).value = filters[key];
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === filters.mode)));
}
function update(changes) { Object.assign(filters, changes); page = 1; syncControls(); render(); }
function toggleTag(id) {
  update({tags: filters.tags.includes(id) ? filters.tags.filter(t => t !== id) : [...filters.tags, id], problem:''});
}

function renderTags() {
  $('selection-count').textContent = filters.tags.length ? `· ${filters.tags.length} selected` : '';
  const raw = $('tag-search').value, query = normalize(raw).trim();
  const ids = parseTagInput(raw, data.taxonomy);
  const match = t => !query || (ids ? ids.includes(t.id) : normalize(`${t.id} ${t.label} ${t.definition}`).includes(query));
  const options = [];
  for (const [subject,title] of Object.entries(SUBJECTS)) {
    const found = data.taxonomy.filter(t => t.subject === subject && match(t));
    if (!found.length) continue;
    options.push(node('p', 'tag-group', title));
    let lastKind;
    for (const t of found) {
      if (subject === 'G' && t.kind !== lastKind) {
        options.push(node('p', 'help', t.kind === 'Configuration' ? 'Configurations (secondary tags)' : `${t.kind}s`)); lastKind = t.kind;
      }
      const on = filters.tags.includes(t.id);
      const b = button('tag-option', null, () => toggleTag(t.id), `${t.label}: ${t.definition}`);
      b.setAttribute('aria-pressed', String(on));
      b.append(node('span', 'box', on ? '✓' : ''), node('span', 'id', t.id), node('span', null, shorten(t.label)));
      options.push(b);
    }
  }
  if (!options.length) options.push(node('p', 'tag-empty', `No matching method. Use a name or an ID from 1 to ${data.taxonomy.length}.`));
  $('tag-options').replaceChildren(...options);
}

function renderActive() {
  const chips = [];
  const chip = (text, clear) => chips.push(button('chip', `${text} ×`, clear, `Remove: ${text}`));
  if (filters.problem) { const p = data.problems.find(p => p.key === filters.problem); chip(`Entry: ${problemName(p)}`, () => update({problem:''})); }
  if (filters.query) chip(`“${filters.query}”`, () => update({query:''}));
  if (filters.contest) chip(CONTESTS[filters.contest], () => update({contest:''}));
  if (filters.subject) chip(SUBJECTS[filters.subject], () => update({subject:''}));
  if (filters.from || filters.to) chip(`Years ${filters.from || '…'}–${filters.to || '…'}`, () => update({from:'', to:''}));
  if (filters.evidence) chip(STATUS[filters.evidence], () => update({evidence:''}));
  if (filters.done) chip(DONE[filters.done], () => update({done:''}));
  if (filters.difficulty) chip(filters.difficulty === 'none' ? 'Difficulty not estimated' : `Difficulty ${filters.difficulty}/5`, () => update({difficulty:''}));
  filters.tags.forEach((id, i) => {
    if (i) chips.push(node('span', 'match', filters.mode));
    chip(`${id} ${shorten(tags.get(id).label)}`, () => toggleTag(id));
  });
  $('active').replaceChildren(...chips);
  const n = chips.filter(c => c.tagName === 'BUTTON').length - (filters.query ? 1 : 0);
  $('filter-count').textContent = n > 0 ? `(${n} active)` : '';
}

function tagButton(id) {
  const t = tags.get(id), b = button(`tag${filters.tags.includes(id) ? ' hit' : ''}`, null, () => toggleTag(id), `${t.label}: ${t.definition} (click to filter)`);
  b.setAttribute('aria-pressed', String(filters.tags.includes(id)));
  b.append(node('span', 'id', `${id} `), shorten(t.label));
  return b;
}
function problemRow(result) {
  const p = result.problem, tr = node('tr');
  const cell = className => { const td = node('td', className); tr.append(td); return td; };
  const head = cell('c-problem'), link = node('a', null, problemName(p));
  link.href = entryUrl(p); link.title = 'View problem statement';
  const on = !!progress?.isDone(p.key);
  if (on) tr.classList.add('is-done');
  if (selecting) {
    const sel = selected.has(p.key), cb = node('input', 'select-box');
    cb.type = 'checkbox'; cb.checked = sel; cb.setAttribute('aria-label', `Select ${problemName(p)}`);
    cb.addEventListener('change', () => toggleSelect(p.key));
    head.append(cb); tr.classList.add('selectable'); if (sel) tr.classList.add('is-selected');
    tr.addEventListener('click', e => { if (!e.target.closest('a, button, input, summary, details, label')) toggleSelect(p.key); });
  }
  head.append(link);
  if (on) head.append(node('span', 'done-tag', '✓ Done'));
  head.append(node('span', 'sub', `${CONTESTS[p.contest] || p.contestName}${p.section && p.section !== 'Shortlist' ? ` ${p.section}` : ''} · ${SUBJECTS[p.subject] || p.subject}`));
  if (p.difficulty) { const d = node('span', 'sub difficulty', `Difficulty ${p.difficulty}/5 (estimate)`); d.title = p.difficultyBasis || ''; head.append(d); }
  if (filters.tags.length) head.append(node('span', 'sub match', `${result.primary ? 'Primary match' : 'Additional match'} · ${result.hits}/${filters.tags.length}`));
  const primary = cell('c-method');
  if (p.geometry) {
    for (const [label, route] of [['Synthetic',p.geometry.synthetic],['Analytic',p.geometry.analytic]]) {
      const block = node('div','geometry-route'); block.append(node('span','sub',label));
      block.append(route.primaryTag ? tagButton(route.primaryTag) : node('span','sub','Not yet reviewed')); primary.append(block);
    }
  } else primary.append(tagButton(p.primaryTag));
  const others = p.tags.filter(id => !(p.primaryTags || [p.primaryTag]).includes(id)), other = cell('c-other');
  if (others.length) { const box = node('span', 'others'); box.append(...others.map(tagButton)); other.append(box); }
  const notes = cell('c-notes'), classification = node('details', 'classification');
  classification.append(node('summary', null, 'Classification'));
  if (p.geometry) {
    for (const [label, route] of [['Synthetic',p.geometry.synthetic],['Analytic',p.geometry.analytic]]) {
      classification.append(node('h3','route-heading',label),node('p',null,route.explanation));
      if (route.status && route.status !== 'Reviewed') classification.append(node('p','sub',route.status));
    }
  } else classification.append(node('p', null, p.explanation));
  const detail = node('details'), research = node('div', 'research');
  detail.append(node('summary', null, 'Research notes & caveats'));
  research.append(node('p', null, `${p.evidence}${p.confidence ? ` · Confidence: ${p.confidence}` : ''}`), node('p', null, p.notes));
  const refs = node('ul');
  for (const url of new Set(p.sourceUrls)) { const a = sourceLink(url, url); if (a) { const li = node('li'); li.append(a); refs.append(li); } }
  if (refs.children.length) research.append(refs);
  detail.append(research); classification.append(detail); notes.append(classification);
  const src = cell('c-src');
  for (const [label, url] of [['AoPS', p.aopsUrl], ['Official', p.officialUrl]]) { const a = url && sourceLink(label, url); if (a) src.append(a); }
  src.append(node('span', `status ${p.forumStatus}`, STATUS[p.forumStatus]));
  return tr;
}
function resultsTable(rows) {
  const table = node('table'), thead = node('thead'), hr = node('tr');
  for (const h of ['Problem', 'Primary method', 'Other methods', 'Classification', 'Sources']) { const th = node('th', null, h); th.scope = 'col'; hr.append(th); }
  thead.append(hr);
  const tbody = node('tbody'); tbody.append(...rows);
  table.append(thead, tbody); return table;
}

function render() {
  history.replaceState(null, '', searchUrl());
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === view)));
  const coll = view === 'collections';
  document.querySelector('.layout').hidden = coll; $('collections-view').hidden = !coll;
  document.body.classList.toggle('grid-mode', view === 'grid');
  renderCollectMenu();
  if (coll) { renderCollections(); return; }
  renderTags(); renderActive();
  const warning = filters.from && filters.to && Number(filters.from) > Number(filters.to);
  $('filter-warning').hidden = !warning;
  $('filter-warning').textContent = warning ? '“From” year is later than “To” year.' : '';
  const results = selectProblems(data.problems, data.taxonomy, filters)
    .filter(r => !filters.done || !progress || progress.isDone(r.problem.key) === (filters.done === 'yes')), total = results.length;
  const grid = view === 'grid';
  $('grid-view').hidden = !grid; $('problem-list').hidden = grid; $('pagination').hidden = grid;
  if (grid) {
    const active = filtersActive(filters);
    $('result-count').textContent = active ? `${total.toLocaleString()} problems match your filters` : 'Pick methods or filters to highlight problems';
    $('problem-statement').hidden = true;
    renderGrid(active ? new Set(results.map(r => r.problem.key)) : null);
    lastResults = results; renderSelectBar();
    return;
  }
  lastResults = results; renderSelectBar();
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE)); page = Math.min(page, pages);
  const first = (page - 1) * PAGE_SIZE;
  $('result-count').textContent = total
    ? `${total.toLocaleString()} of ${data.problems.length.toLocaleString()} problems${pages > 1 ? ` · showing ${first + 1}–${Math.min(total, first + PAGE_SIZE)}` : ''}`
    : `0 of ${data.problems.length.toLocaleString()} problems`;
  const list = $('problem-list'); list.setAttribute('aria-busy', 'false');
  if (total) list.replaceChildren(resultsTable(results.slice(first, first + PAGE_SIZE).map(problemRow)));
  else {
    const e = node('div', 'empty');
    e.append(node('p', null, filters.tags.length > 1 && filters.mode === 'AND' ? 'No problem has all selected methods. Try “Any selected (OR)” or remove a method.' : 'No problems match these filters.'));
    e.append(button(null, 'Reset filters', reset)); list.replaceChildren(e);
  }
  const pagination = $('pagination'); pagination.replaceChildren();
  if (pages > 1) {
    const prev = button(null, '← Previous', () => changePage(page - 1)); prev.disabled = page === 1;
    const next = button(null, 'Next →', () => changePage(page + 1)); next.disabled = page === pages;
    const input = node('input', 'page-input'); input.type = 'number'; input.min = 1; input.max = pages; input.value = page;
    input.setAttribute('aria-label', 'Page number');
    const go = () => { const v = Math.min(pages, Math.max(1, Math.round(Number(input.value)) || 1)); if (v !== page) changePage(v); else input.value = page; };
    input.addEventListener('change', go);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    const label = node('label', 'page-label'); label.append('Page ', input, ` of ${pages}`);
    pagination.append(prev, label, next);
  }
  renderStatement($('problem-statement'), filters.problem && results.find(r => r.problem.key === filters.problem)?.problem);
}
function changePage(value) { page = value; render(); $('results').scrollIntoView({block:'start'}); }
function reset() { filters = emptyFilters(); page = 1; $('tag-search').value = ''; syncControls(); render(); }
async function copyUrl(url, b) {
  const text = b.textContent;
  try { await navigator.clipboard.writeText(url); b.textContent = 'Copied'; }
  catch { b.textContent = 'Copy from address bar'; }
  setTimeout(() => b.textContent = text, 2000);
}
function renderCoverage() {
  const c = $('coverage-content'); c.append(node('p', null, data.scope));
  for (const s of data.snapshots || []) if (s.count != null) c.append(node('p', null, `${CONTESTS[s.contest] || s.contest}: ${s.count} entries`));
  for (const x of data.coverage) c.append(node('h3', null, x.title), node('p', null, x.text));
  c.append(node('h3', null, 'Caveats'));
  const ul = node('ul'); for (const x of data.caveats) ul.append(node('li', null, x)); c.append(ul);
}

function renderProgress() {
  const box = $('account');
  if (!progress) { box.hidden = true; return; }
  box.hidden = false;
  const u = progress.user;
  $('account-button').textContent = u ? u.email : 'Sign in';
  $('account-button').title = u ? `Signed in as ${u.email}` : 'Sign in to save your marks';
  $('signed-out').hidden = !!u; $('signed-in').hidden = !u;
  $('signed-in-email').textContent = u ? u.email : '';
  $('progress-status').textContent = progress.status;
}
function setMenu(open) {
  $('account-menu').hidden = !open; $('account-button').setAttribute('aria-expanded', String(open));
  if (open && !progress?.user) $('signin-email').focus();
}
// Grid of every available problem in one collection: a row per year, green when done, blue when not.
let gridContest = 'isl';
const idOrder = id => { const m = String(id).match(/^(\D*)(\d+)/); return m ? [m[1], Number(m[2])] : [String(id), 0]; };
// matches: keys selected by the current filters (highlighted), or null when no filter is active.
function renderGrid(matches) {
  if (filters.contest) gridContest = filters.contest;
  const isDone = key => !!progress?.isDone(key);
  document.querySelectorAll('[data-grid]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.grid === gridContest)));
  const probs = data.problems.filter(p => p.contest === gridContest);
  const doneCount = probs.filter(p => isDone(p.key)).length;
  const hits = matches ? probs.filter(p => matches.has(p.key)).length : 0;
  $('grid-count').textContent = `${doneCount} of ${probs.length} done` + (matches ? ` · ${hits} highlighted` : '');
  $('grid-legend-match').hidden = !matches;
  $('grid-body').classList.toggle('filtering', !!matches);
  const years = new Map();
  for (const p of probs) { if (!years.has(p.year)) years.set(p.year, []); years.get(p.year).push(p); }
  const subjectRank = s => ({A:0, C:1, G:2, N:3})[s] ?? 4;
  let units = 1; // widest year in square widths (a subject gap counts as a quarter square); CSS sizes squares to fit it
  const rows = [...years.entries()].sort((a, b) => b[0] - a[0]).map(([year, list]) => {
    const row = node('div', 'grid-row');
    row.append(node('span', 'grid-year', year));
    const cells = node('div', 'grid-cells');
    list.sort((a, b) => (gridContest === 'isl' ? subjectRank(a.subject) - subjectRank(b.subject) : 0)
      || idOrder(a.id)[0].localeCompare(idOrder(b.id)[0]) || idOrder(a.id)[1] - idOrder(b.id)[1]);
    let last;
    for (const p of list) {
      if (gridContest === 'isl' && last && last !== p.subject) cells.append(node('span', 'grid-gap'));
      last = p.subject;
      const on = isDone(p.key), hit = matches?.has(p.key), sel = selecting && selected.has(p.key);
      const a = node('a', `grid-cell ${on ? 'done' : 'todo'}${hit ? ' match' : ''}${sel ? ' selected' : ''}`, p.id); a.href = entryUrl(p);
      a.title = `${problemName(p)}: ${on ? 'done' : 'not done'}${hit ? ', matches your filters' : ''}${selecting ? (sel ? ' (selected)' : ' (click to select)') : ''}`;
      a.dataset.key = p.key;
      if (selecting) { a.setAttribute('aria-pressed', String(sel)); a.draggable = false; } else a.setAttribute('aria-haspopup', 'dialog');
      a.addEventListener('click', e => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // let modified clicks open a new tab
        e.preventDefault(); e.stopPropagation();
        if (!selecting) openCollectMenu(p, e.currentTarget, true);
        else if (dragHandled) dragHandled = false; // a mouse press already selected it (see setupGridDrag)
        else toggleSelect(p.key);
      });
      cells.append(a);
    }
    units = Math.max(units, list.length + 0.25 * cells.querySelectorAll('.grid-gap').length);
    row.append(cells); return row;
  });
  $('grid-body').style.setProperty('--units', units);
  $('grid-body').classList.toggle('selecting', selecting);
  $('grid-body').replaceChildren(...rows);
}
// Drag-select on the grid (mouse/pen, Select mode): every square inside the rectangle spanned by the
// square where the press started and the square under the pointer is selected, like a spreadsheet.
// Starting on an already-selected square unselects instead. Touch keeps tap-to-select, so scrolling works.
let drag = null, dragHandled = false;
function setupGridDrag() {
  const body = $('grid-body');
  const pageBox = el => { const r = el.getBoundingClientRect(); return {l: r.left + scrollX, t: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY}; };
  const cellAt = e => document.elementFromPoint(e.clientX, e.clientY)?.closest('#grid-body .grid-cell');
  const apply = cell => {
    const a = drag.start, z = pageBox(cell);
    const box = {l: Math.min(a.l, z.l), t: Math.min(a.t, z.t), r: Math.max(a.r, z.r), b: Math.max(a.b, z.b)};
    const now = new Set(drag.base);
    for (const c of body.querySelectorAll('.grid-cell')) {
      const q = pageBox(c);
      const inside = q.l < box.r && q.r > box.l && q.t < box.b && q.b > box.t;
      if (inside) { if (drag.adding) now.add(c.dataset.key); else now.delete(c.dataset.key); }
    }
    selected.clear(); for (const k of now) selected.add(k);
    for (const c of body.querySelectorAll('.grid-cell')) c.classList.toggle('selected', selected.has(c.dataset.key));
    selectNote = ''; renderSelectBar();
  };
  body.addEventListener('pointerdown', e => {
    if (!selecting || e.pointerType === 'touch' || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const cell = e.target.closest('.grid-cell'); if (!cell) return;
    e.preventDefault();
    drag = {start: pageBox(cell), last: cell, adding: !selected.has(cell.dataset.key), base: new Set(selected)};
    body.setPointerCapture(e.pointerId);
    apply(cell);
  });
  body.addEventListener('pointermove', e => {
    if (!drag) return;
    const cell = cellAt(e);
    if (cell && cell !== drag.last) { drag.last = cell; apply(cell); }
  });
  const end = () => { if (!drag) return; drag = null; dragHandled = true; render(); setTimeout(() => { dragHandled = false; }, 0); };
  body.addEventListener('pointerup', end);
  body.addEventListener('pointercancel', end);
  body.addEventListener('dragstart', e => { if (selecting) e.preventDefault(); });
}
// A link to one problem's entry that opens it in place (keeping Back working); modified clicks open normally.
function problemLink(p, className, text) {
  const a = node('a', className, text); a.href = entryUrl(p);
  a.addEventListener('click', e => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); openProblem(p);
  });
  return a;
}
function openProblem(p) {
  filters = {...emptyFilters(), problem: p.key}; view = 'list'; currentColl = ''; sharedId = ''; page = 1;
  $('tag-search').value = ''; syncControls();
  history.pushState(null, '', searchUrl()); render();
  $('results').scrollIntoView({block: 'start'});
}

// ---- "+ Collection" menu on a problem
let menuProblem = null, menuDraft = '', menuActions = false;
// actions: also offer "mark done" and "open problem" (used by the progress grid).
function openCollectMenu(p, anchor, actions = false) {
  if (menuProblem === p.key) { closeCollectMenu(); return; }
  menuProblem = p.key; menuDraft = ''; menuActions = actions;
  const r = anchor.getBoundingClientRect(), m = $('collect-menu');
  m.style.top = `${r.bottom + scrollY + 4}px`;
  m.style.left = `${Math.max(8, Math.min(r.left + scrollX, scrollX + document.documentElement.clientWidth - 288))}px`;
  renderCollectMenu();
  (m.querySelector('.menu-actions button') || m.querySelector('input'))?.focus();
}
function closeCollectMenu() { menuProblem = null; menuBulk = false; $('collect-menu').hidden = true; }

// ---- Select mode (Problem lookup and Progress grid): pick problems, then mark them done or add them to a collection
let menuBulk = false;
function toggleSelect(key) { if (selected.has(key)) selected.delete(key); else selected.add(key); selectNote = ''; render(); }
function setSelecting(on) { selecting = on; selected.clear(); selectNote = ''; if (!on && menuBulk) closeCollectMenu(); render(); }
function renderSelectBar() {
  const bar = $('select-bar'), t = $('select-toggle');
  const usable = view === 'list' || view === 'grid';
  t.hidden = !progress || !usable; t.textContent = selecting ? 'Done selecting' : 'Select';
  t.setAttribute('aria-pressed', String(selecting));
  bar.hidden = !selecting || !usable;
  if (bar.hidden) return;
  const n = selected.size, keys = () => [...selected];
  // "All": every result in the list, or on the grid every square in the shown collection that matches the filters.
  const all = lastResults.filter(r => view !== 'grid' || r.problem.contest === gridContest).map(r => r.problem.key);
  const allIn = all.length && all.every(k => selected.has(k)), noun = view === 'grid' ? (filtersActive(filters) ? 'highlighted' : 'shown') : 'results';
  const actions = node('div', 'select-actions');
  const act = (label, fn, title) => { const b = button(null, label, fn, title); b.disabled = !n; return b; };
  actions.append(
    act('Mark done', async () => { await progress.setDoneMany(keys(), true); selectNote = `Marked ${n} as done.`; render(); }),
    act('Mark not done', async () => { await progress.setDoneMany(keys(), false); selectNote = `Marked ${n} as not done.`; render(); }),
    act('Add to collection…', e => { e.stopPropagation(); openBulkMenu(e.currentTarget); }));
  const pick = node('div', 'select-pick');
  pick.append(node('strong', null, `${n} selected`),
    button('link-button', allIn ? `Unselect all ${noun}` : `Select all ${all.length.toLocaleString()} ${noun}`, () => { for (const k of all) allIn ? selected.delete(k) : selected.add(k); selectNote = ''; render(); }));
  if (n) pick.append(button('link-button', 'Clear', () => { selected.clear(); selectNote = ''; render(); }));
  bar.replaceChildren(pick, actions);
  if (selectNote || progress.status) bar.append(node('p', 'select-note', selectNote || progress.status));
}
function openBulkMenu(anchor) {
  if (menuBulk) { closeCollectMenu(); return; }
  menuBulk = true; menuProblem = null; menuDraft = '';
  const r = anchor.getBoundingClientRect(), m = $('collect-menu');
  m.style.top = `${r.bottom + scrollY + 4}px`;
  m.style.left = `${Math.max(8, Math.min(r.left + scrollX, scrollX + document.documentElement.clientWidth - 288))}px`;
  renderCollectMenu();
}
function renderBulkMenu(m) {
  const keys = [...selected], items = [node('p', 'collect-title', `Add ${keys.length} problem${keys.length === 1 ? '' : 's'} to:`)];
  const done = (n, c) => { selectNote = n == null ? '' : `Added ${n} to “${c}”${n < keys.length ? ` (${keys.length - n} already there)` : ''}.`; closeCollectMenu(); render(); };
  const list = progress.collections();
  if (!list.length) items.push(node('p', 'help', 'No collections yet. Make one below.'));
  for (const c of list) items.push(button('collect-pick', c.name, async () => done(await progress.addManyToCollection(c.id, keys), c.name)));
  const form = node('form', 'collect-new'), input = node('input');
  input.placeholder = 'New collection name'; input.maxLength = 80; input.value = menuDraft; input.setAttribute('aria-label', 'New collection name');
  input.addEventListener('input', () => { menuDraft = input.value; });
  const add = node('button', null, 'Add'); add.type = 'submit';
  form.append(input, add);
  form.addEventListener('submit', async e => {
    e.preventDefault(); const name = input.value.trim(); if (!name) return;
    menuDraft = ''; const id = await progress.createCollection(name);
    if (id) done(await progress.addManyToCollection(id, keys), name);
  });
  items.push(form);
  m.replaceChildren(...items);
}
function renderCollectMenu() {
  const m = $('collect-menu');
  if (menuBulk) { if (!progress || view === 'collections' || !selecting || !selected.size) { closeCollectMenu(); return; } m.hidden = false; renderBulkMenu(m); return; }
  const p = menuProblem && data.problems.find(x => x.key === menuProblem);
  if (!p || !progress || view === 'collections') { m.hidden = true; if (view === 'collections') menuProblem = null; return; }
  m.hidden = false;
  const items = [];
  if (menuActions) {
    const on = progress.isDone(p.key), row = node('div', 'menu-actions');
    items.push(node('p', 'collect-title', problemName(p)));
    const mark = button(on ? 'is-on' : null, on ? '✓ Done' : 'Mark done', () => progress.toggle(p.key), on ? 'Click to mark as not done' : null);
    const open = button(null, 'Open problem', () => { closeCollectMenu(); openProblem(p); });
    row.append(mark, open); items.push(row, node('p', 'collect-sub', 'Add to collection'));
  } else items.push(node('p', 'collect-title', `Add ${problemName(p)} to:`));
  const list = progress.collections();
  if (!list.length) items.push(node('p', 'help', 'No collections yet. Make one below.'));
  for (const c of list) {
    const label = node('label', 'collect-item'), cb = node('input');
    cb.type = 'checkbox'; cb.checked = c.keys.includes(p.key);
    cb.addEventListener('change', () => progress.setInCollection(c.id, p.key, cb.checked));
    label.append(cb, node('span', null, c.name)); items.push(label);
  }
  const form = node('form', 'collect-new'), input = node('input');
  input.placeholder = 'New collection name'; input.maxLength = 80; input.value = menuDraft;
  input.setAttribute('aria-label', 'New collection name');
  input.addEventListener('input', () => { menuDraft = input.value; });
  const add = node('button', null, 'Add'); add.type = 'submit';
  form.append(input, add);
  form.addEventListener('submit', async e => {
    e.preventDefault(); const name = input.value.trim(); if (!name) return;
    menuDraft = '';
    const id = await progress.createCollection(name);
    if (id) await progress.setInCollection(id, p.key, true);
  });
  items.push(form);
  if (progress.status) items.push(node('p', 'help', progress.status));
  m.replaceChildren(...items);
}

// ---- Collections tab
let collDraft = {name: '', description: ''}, editing = null;
const shareUrl = id => `${location.origin}${location.pathname}?view=collections&shared=${encodeURIComponent(id)}`;
// remove(key) adds a Remove button (own collections only).
function collectionProblems(keys, byKey, remove) {
  const ol = node('ol', 'coll-problems');
  for (const k of keys) {
    const p = byKey.get(k), li = node('li'), on = !!progress?.isDone(k);
    if (on) li.classList.add('is-done');
    const primary = p.geometry ? p.geometry.synthetic?.primaryTag : p.primaryTag;
    const info = node('span', 'sub', `${SUBJECTS[p.subject] || p.subject}${primary && tags.get(primary) ? ` · ${shorten(tags.get(primary).label)}` : ''}${p.difficulty ? ` · difficulty ${p.difficulty}/5` : ''}`);
    const name = node('div', 'coll-pname'); name.append(problemLink(p, null, problemName(p)), info);
    li.append(name);
    if (progress) li.append(button(`coll-done${on ? ' is-on' : ''}`, on ? '✓ Done' : 'Mark done', () => progress.toggle(k), on ? 'Click to mark as not done' : null));
    if (remove) li.append(button('coll-remove', 'Remove', () => remove(k), `Remove ${problemName(p)} from this collection`));
    ol.append(li);
  }
  return ol;
}
function renderShared(box, byKey) {
  const back = button('link-button', '← Your collections', () => { sharedId = ''; render(); });
  if (!sharedCache || sharedCache.id !== sharedId) {
    box.replaceChildren(node('div', 'coll-main'));
    box.firstChild.append(back, node('p', 'empty', 'Loading collection…'));
    const id = sharedId;
    (progress ? progress.getShared(id) : Promise.reject(new Error('unavailable')))
      .then(d => { sharedCache = {id, data: d}; }, e => { console.error(e); sharedCache = {id, data: null, error: true}; })
      .then(() => { if (sharedId === id) render(); });
    return;
  }
  const main = node('div', 'coll-main shared'), d = sharedCache.data;
  main.append(back);
  if (!d) {
    main.append(node('p', 'empty', sharedCache.error ? 'This collection couldn’t be loaded. Check your connection and try again.' : 'This collection is private or no longer exists.'));
    box.replaceChildren(main); return;
  }
  const keys = d.keys.filter(k => byKey.has(k)), done = keys.filter(k => progress?.isDone(k)).length;
  const head = node('div', 'coll-head'), titles = node('div');
  titles.append(node('p', 'collect-sub', 'Shared collection'), node('h2', null, d.name));
  if (d.description) titles.append(node('p', 'coll-desc', d.description));
  const actions = node('div', 'coll-actions');
  const mine = progress?.user && progress.user.uid === d.ownerUid;
  if (mine) actions.append(button(null, 'Manage', () => { sharedId = ''; currentColl = d.id; render(); }));
  else if (progress) actions.append(button(null, 'Save a copy', async e => {
    e.currentTarget.disabled = true;
    const id = await progress.copyShared({...d, keys});
    if (id) { sharedId = ''; currentColl = id; render(); }
  }, 'Copy this list into your own collections'));
  head.append(titles, actions); main.append(head);
  main.append(node('p', 'sub', `${keys.length} problem${keys.length === 1 ? '' : 's'}${progress ? ` · ${done} done by you` : ''}`));
  if (keys.length) main.append(collectionProblems(keys, byKey, null));
  box.replaceChildren(main);
}
function renderCollections() {
  const box = $('collections-view');
  if (!progress) { box.classList.add('single'); box.replaceChildren(node('p', 'empty', 'Collections couldn’t load. Try reloading the page.')); return; }
  const byKey = new Map(data.problems.map(p => [p.key, p]));
  box.classList.toggle('single', !!sharedId);
  if (sharedId) { renderShared(box, byKey); return; }
  const list = progress.collections();
  if (currentColl && !progress.collection(currentColl)) currentColl = '';

  const side = node('div', 'coll-side');
  side.append(node('h2', null, 'Your collections'));
  const form = node('form', 'coll-form');
  const name = node('input'); name.placeholder = 'Name, e.g. “Geometry to review”'; name.maxLength = 80; name.value = collDraft.name;
  name.setAttribute('aria-label', 'Collection name');
  const desc = node('textarea'); desc.placeholder = 'Description (optional)'; desc.maxLength = 1000; desc.rows = 2; desc.value = collDraft.description;
  desc.setAttribute('aria-label', 'Collection description');
  name.addEventListener('input', () => { collDraft.name = name.value; });
  desc.addEventListener('input', () => { collDraft.description = desc.value; });
  const create = node('button', null, 'New collection'); create.type = 'submit';
  form.append(name, desc, create);
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (!name.value.trim()) { name.focus(); return; }
    const draft = collDraft; collDraft = {name: '', description: ''};
    const id = await progress.createCollection(draft.name, draft.description);
    if (id) { currentColl = id; render(); } else { collDraft = draft; render(); }
  });
  side.append(form);
  if (!progress.user) side.append(node('p', 'help', 'Saved in this browser. Sign in (top right) to keep your collections on every device.'));
  if (progress.status) side.append(node('p', 'help', progress.status));
  const ul = node('ul', 'coll-list');
  for (const c of list) {
    const keys = c.keys.filter(k => byKey.has(k)), d = keys.filter(k => progress.isDone(k)).length;
    const li = node('li'), b = button(`coll-pick${c.id === currentColl ? ' on' : ''}`, null, () => { currentColl = c.id; editing = null; render(); });
    b.setAttribute('aria-current', String(c.id === currentColl));
    b.append(node('span', 'coll-name', c.name), node('span', 'sub', `${keys.length} problem${keys.length === 1 ? '' : 's'} · ${d} done${c.public ? ' · public' : ''}`));
    li.append(b); ul.append(li);
  }
  if (list.length) side.append(ul);

  const main = node('div', 'coll-main');
  const c = currentColl && progress.collection(currentColl);
  if (!c) {
    main.append(node('p', 'empty', list.length ? 'Pick a collection to see its problems.'
      : 'Collections are your own named lists of problems, such as a training set or problems to revisit. Make one on the left, then add problems from Problem lookup with “+ Collection”.'));
  } else if (editing === c.id) {
    const f = node('form', 'coll-form coll-edit');
    const n = node('input'); n.value = c.name; n.maxLength = 80; n.setAttribute('aria-label', 'Collection name');
    const t = node('textarea'); t.value = c.description; t.maxLength = 1000; t.rows = 3; t.setAttribute('aria-label', 'Collection description');
    const save = node('button', null, 'Save'); save.type = 'submit';
    const cancel = button(null, 'Cancel', () => { editing = null; render(); });
    const actions = node('div', 'coll-actions'); actions.append(save, cancel);
    f.append(n, t, actions);
    f.addEventListener('submit', async e => { e.preventDefault(); editing = null; await progress.updateCollection(c.id, {name: n.value, description: t.value}); render(); });
    main.append(f);
  } else {
    const head = node('div', 'coll-head');
    const titles = node('div'); titles.append(node('h2', null, c.name));
    if (c.description) titles.append(node('p', 'coll-desc', c.description));
    const actions = node('div', 'coll-actions');
    actions.append(button(null, 'Edit', () => { editing = c.id; render(); }),
      button(null, 'Delete', async () => { if (confirm(`Delete the collection “${c.name}”?${c.public ? ' Its public link will stop working.' : ''} The problems themselves are not affected.`)) { await progress.deleteCollection(c.id); currentColl = ''; render(); } }));
    head.append(titles, actions); main.append(head);
    // Private / Public
    const share = node('div', 'coll-share');
    const seg = node('div', 'mode share-mode'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Who can see this collection');
    for (const [on, label] of [[false, 'Private'], [true, 'Public']]) {
      const b = button(null, label, async () => { b.disabled = true; await progress.setPublic(c.id, on); render(); });
      b.setAttribute('aria-pressed', String(c.public === on)); b.disabled = !progress.user && on; seg.append(b);
    }
    share.append(seg);
    if (c.public) {
      const link = node('input', 'share-link'); link.readOnly = true; link.value = shareUrl(c.id); link.setAttribute('aria-label', 'Share link');
      link.addEventListener('focus', () => link.select());
      share.append(node('span', 'help', 'Anyone with the link can view this list (not your done marks).'), link,
        button(null, 'Copy link', e => copyUrl(shareUrl(c.id), e.currentTarget)));
    } else share.append(node('span', 'help', progress.user ? 'Only you can see this collection.' : 'Only you can see this. Sign in to make it public.'));
    main.append(share);
    const keys = c.keys.filter(k => byKey.has(k));
    if (!keys.length) main.append(node('p', 'empty', 'No problems yet. In Problem lookup, use “+ Collection” under a problem’s name to add it here.'));
    else {
      const d = keys.filter(k => progress.isDone(k)).length;
      main.append(node('p', 'sub', `${keys.length} problem${keys.length === 1 ? '' : 's'} · ${d} done`));
      main.append(collectionProblems(keys, byKey, k => progress.setInCollection(c.id, k, false)));
    }
  }
  box.replaceChildren(side, main);
}

async function setupProgress() {
  try {
    const {createProgress} = await import('./progress.mjs?v=20261110-select');
    progress = createProgress({startHref: START_HREF, validKeys: new Set(data.problems.map(p => p.key)), onChange: () => { renderProgress(); render(); }});
    $('signin-form').addEventListener('submit', async e => {
      e.preventDefault(); const b = e.submitter || e.target.querySelector('button'); b.disabled = true;
      if (await progress.sendLink($('signin-email').value)) $('signin-email').value = '';
      b.disabled = false;
    });
    $('signout').addEventListener('click', () => progress.signOut());
    $('account-button').addEventListener('click', () => setMenu($('account-menu').hidden));
    document.addEventListener('click', e => { if (!$('account').contains(e.target)) setMenu(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('account-menu').hidden) { setMenu(false); $('account-button').focus(); } });
    renderProgress(); progress.init();
  } catch (error) { progress = null; renderProgress(); console.error('Progress tracking unavailable:', error); }
}

async function start() {
  try {
    const response = await fetch('./data/catalogue.json'); if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    tags = new Map(data.taxonomy.map(t => [t.id, t])); filters = readFilters();
    $('tag-total').textContent = data.taxonomy.length;
    $('total-stat').textContent = `${data.problems.length.toLocaleString()} (${Object.entries(data.counts || {}).map(([k,v]) => `${CONTESTS[k] || k} ${v}`).join(', ')})`;
    $('updated').textContent = 'snapshot ' + new Intl.DateTimeFormat('en', {dateStyle:'medium', timeZone:'UTC'}).format(new Date(data.updated));
    const years = [...new Set(data.problems.map(p => p.year))].sort((a,b) => b - a);
    for (const id of ['from-year','to-year']) for (const year of years) { const o = node('option', null, year); o.value = year; $(id).append(o); }
    // Keep a valid boundary year from the URL even if the snapshot has no entries in that year.
    for (const [id,key] of [['from-year','from'],['to-year','to']]) if (filters[key] && !years.includes(Number(filters[key]))) {
      if (/^\d{4}$/.test(filters[key])) { const o = node('option', null, filters[key]); o.value = filters[key]; $(id).append(o); } else filters[key] = '';
    }
    if (matchMedia('(max-width: 860px)').matches) $('filters').open = false;
    syncControls(); renderCoverage();
    for (const [id,key] of FIELDS) $(id).addEventListener(id === 'search' ? 'input' : 'change', () => { filters[key] = $(id).value; filters.problem = ''; page = 1; render(); });
    $('tag-search').addEventListener('input', renderTags);
    $('tag-search').addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const ids = parseTagInput(e.target.value, data.taxonomy);
      const found = ids || [...$('tag-options').querySelectorAll('.tag-option')].length === 1 && [Number($('tag-options').querySelector('.tag-option .id').textContent)];
      if (found && found.length) { e.target.value = ''; update({tags:[...new Set([...filters.tags, ...found])], problem:''}); }
    });
    document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => update({mode:b.dataset.mode})));
    $('reset').addEventListener('click', reset);
    $('copy-link').addEventListener('click', e => copyUrl(location.href, e.currentTarget));
    $('coverage-open').addEventListener('click', () => $('coverage-dialog').showModal());
    $('coverage-close').addEventListener('click', () => $('coverage-dialog').close());
    readView();
    document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { view = b.dataset.view; currentColl = ''; sharedId = ''; if (view === 'collections') { selecting = false; selected.clear(); } closeCollectMenu(); render(); }));
    // (the menu re-renders on each change, so a click inside it can land on a node that is already detached)
    document.addEventListener('click', e => { if ((menuProblem || menuBulk) && e.target.isConnected && !$('collect-menu').contains(e.target)) closeCollectMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && (menuProblem || menuBulk)) closeCollectMenu(); });
    $('select-toggle').addEventListener('click', () => setSelecting(!selecting));
    setupGridDrag();
    document.querySelectorAll('[data-grid]').forEach(b => b.addEventListener('click', () => {
      gridContest = b.dataset.grid;
      if (filters.contest && filters.contest !== gridContest) update({contest:''}); else render();
    }));
    await setupProgress();
    window.addEventListener('popstate', () => { filters = readFilters(); readView(); page = 1; syncControls(); render(); });
    render();
  } catch (error) {
    $('result-count').textContent = 'Catalogue unavailable'; $('problem-list').setAttribute('aria-busy', 'false');
    const box = node('div', 'empty'); box.append(node('p', null, 'The catalogue data could not be loaded.'), button(null, 'Retry', () => location.reload()));
    $('problem-list').replaceChildren(box); console.error('Catalogue load failed:', error);
  }
}
start();

