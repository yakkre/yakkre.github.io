import {normalize, parseTagInput, selectProblems, validTagIds, problemName, withDifficulty, parseProblemList, arrangeByTopic, randomSet, islNumber, TOPICS} from './catalogue-core.mjs?v=20261127-islnum2';
import {renderStatement, typesetMath, loadStatementSources, statementElement} from './statement-view.mjs?v=20261127-practice';
import {withStatementOnlyProblems, collectionOptions} from './statement-catalogue.mjs?v=20261120-usamo';
import {createGridPicker} from './grid-picker.mjs?v=20261120-usamo';
import {parseNote, renderNote, noteExcerpt} from './notes-view.mjs?v=20261117-latex';

const START_HREF = location.href; // before render() rewrites the URL: a sign-in link's code is in it
const $ = id => document.getElementById(id);
const PAGE_SIZE = 50;
const SUBJECTS = {A:'Algebra', C:'Combinatorics', N:'Number theory', G:'Geometry'};
const STATUS = {live:'Live forum checked', archive:'Archived forum checked', pending:'Forum check pending'};
const CONTESTS = {isl:'IMO Shortlist', rmm:'RMM', usatst:'USA TST', usatstst:'USA TSTST', usamo:'USAMO'};
const FIELDS = [['search','query'],['contest','contest'],['subject','subject'],['evidence','evidence'],['difficulty','difficulty'],['done','done'],['from-year','from'],['to-year','to']];
const DONE = {yes:'Marked done', no:'Not done yet', due:'Due to revisit'};
let data, tags, filters, page = 1, progress = null, view = 'list', currentColl = '', sharedId = '', sharedCache = null;
let selecting = false, selectNote = '', lastResults = [];
let gridPicker;
const selected = new Set();
const VIEWS = ['list', 'grid', 'collections'];
function readView() {
  const q = new URLSearchParams(location.search);
  view = VIEWS.includes(q.get('view')) ? q.get('view') : 'list';
  if (view === 'grid' && Object.hasOwn(CONTESTS, q.get('grid'))) gridContest = q.get('grid');
  currentColl = view === 'collections' ? q.get('c') || '' : '';
  sharedId = view === 'collections' && /^[A-Za-z0-9_-]{4,40}$/.test(q.get('shared') || '') ? q.get('shared') : '';
  practiceId = view === 'list' && q.get('problem') && /^[A-Za-z0-9_-]{4,40}$/.test(q.get('practice') || '') ? q.get('practice') : '';
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
  return {query:q.get('q')||'', contest:Object.keys(CONTESTS).includes(q.get('contest'))?q.get('contest'):'',
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
  if (v === 'grid') q.set('grid', filters.contest || gridContest);
  if (v === 'collections' && (override.c ?? currentColl)) q.set('c', override.c ?? currentColl);
  if (v === 'collections' && (override.shared ?? sharedId)) q.set('shared', override.shared ?? sharedId);
  if (f.mode === 'OR') q.set('mode', 'OR');
  if (v === 'list' && f.problem && practiceId && !override.view) q.set('practice', practiceId);
  return location.pathname + (q.size ? '?' + q : '');
}
const entryUrl = p => searchUrl({...emptyFilters(), problem:p.key, view:'list'});
const filtersActive = f => !!(f.query || f.contest || f.subject || f.from || f.to || f.evidence || f.difficulty || f.done || f.tags.length);

function syncControls() {
  if (filters.evidence) $('more-filters').open = true;
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
  b.append(shorten(t.label));
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
  if (progress?.hasNote(p.key)) { const t = node('span', 'note-tag', 'Notes'); t.title = 'You have notes on this problem'; head.append(t); }
  const rv = progress?.revisitOn(p.key);
  if (rv) { const due = rv <= todayStr(), t = node('span', `revisit-tag${due ? ' due' : ''}`, due ? 'Revisit due' : `Revisit ${shortDate(rv)}`); t.title = `You planned to come back to this on ${shortDate(rv)}`; head.append(t); }
  head.append(node('span', 'sub', `${CONTESTS[p.contest] || p.contestName}${p.section && !['Shortlist','Contest'].includes(p.section) ? ` ${p.section}` : ''}${p.subject ? ` · ${SUBJECTS[p.subject] || p.subject}` : ''}`));
  if (p.difficulty) { const d = node('span', 'sub difficulty', `Difficulty ${p.difficulty}/5`); d.title = p.difficultyBasis || ''; head.append(d); }
  if (filters.tags.length) head.append(node('span', 'sub match', `${result.primary ? 'Primary match' : 'Additional match'} · ${result.hits}/${filters.tags.length}`));
  const primary = cell('c-method');
  if (p.geometry) {
    for (const [label, route] of [['Synthetic',p.geometry.synthetic],['Analytic',p.geometry.analytic]]) {
      const block = node('div','geometry-route'); block.append(node('span','sub',label));
      block.append(route.primaryTag ? tagButton(route.primaryTag) : node('span','sub',route.status==='None found'?'None found':'Not yet reviewed')); primary.append(block);
    }
  } else primary.append(p.primaryTag ? tagButton(p.primaryTag) : node('span','sub','Classification pending'));
  if (filters.problem === p.key && !p.statementOnly) primary.prepend(methodsControls(p));
  const others = p.tags.filter(id => !(p.primaryTags || [p.primaryTag]).includes(id)), other = cell('c-other');
  if (others.length) { const box = node('span', 'others'); box.append(...others.map(tagButton)); other.append(box); }
  const notes = cell('c-notes'), classification = node('details', 'classification');
  classification.append(node('summary', null, p.statementOnly ? 'Classification pending' : 'Classification'));
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
  if (p.statementOnly && !p.aopsUrl && !p.officialUrl && p.sourceUrls[0]) {
    const a = sourceLink('Source', p.sourceUrls[0]); if (a) src.append(a);
  }
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
  if (!filters.problem || view !== 'list') practiceId = '';
  history.replaceState(null, '', searchUrl());
  if (reveal.key !== filters.problem) reveal = {key: filters.problem, level: 0};
  document.body.classList.toggle('methods-hidden', methodsHidden() || !!practiceId);
  applyReveal();
  $('random').hidden = view === 'collections'; $('random').textContent = filters.problem ? 'Another random' : 'Random problem';
  renderDueNote();
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === view)));
  const coll = view === 'collections';
  $('collections-view').hidden = !coll;
  document.body.classList.toggle('grid-mode', view === 'grid');
  renderCollectMenu();
  renderTags(); renderActive();
  const warning = filters.from && filters.to && Number(filters.from) > Number(filters.to);
  $('filter-warning').hidden = !warning;
  $('filter-warning').textContent = warning ? '“From” year is later than “To” year.' : '';
  if (coll) {
    // Filters and search narrow the open collection's problems ("Your progress" uses its own Done here marks).
    $('grid-view').hidden = true; $('problem-list').hidden = true; $('pagination').hidden = true;
    $('select-bar').hidden = true; $('select-toggle').hidden = true;
    renderStatement($('problem-statement'), null); renderNotes(null); renderPractice(null); setProblemView(false);
    const f = {...filters, problem: '', done: ''};
    collMatch = filtersActive(f) ? new Set(selectProblems(data.problems, data.taxonomy, f).map(r => r.problem.key)) : null;
    $('result-count').textContent = 'Filters and search apply to the collection you open';
    renderCollections(); return;
  }
  const results = selectProblems(data.problems, data.taxonomy, filters)
    .filter(r => !progress || passesProgress(r.problem.key, k => progress.isDone(k))), total = results.length;
  const grid = view === 'grid';
  $('grid-view').hidden = !grid; $('problem-list').hidden = grid; $('pagination').hidden = grid;
  if (grid) {
    const active = filtersActive(filters);
    $('result-count').textContent = active ? `${total.toLocaleString()} problems match your filters` : 'Pick methods or filters to highlight problems';
    renderStatement($('problem-statement'), null); renderNotes(null); renderPractice(null); setProblemView(false);
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
  const shown = filters.problem && results.find(r => r.problem.key === filters.problem)?.problem;
  renderStatement($('problem-statement'), shown);
  renderNotes(shown);
  renderPractice(shown || null);
  setProblemView(!!shown);
}
function changePage(value) { page = value; render(); $('results').scrollIntoView({block:'start'}); }
function reset() { practiceId = ''; filters = emptyFilters(); page = 1; $('tag-search').value = ''; syncControls(); render(); }
async function copyUrl(url, b) {
  const text = b.textContent;
  try { await navigator.clipboard.writeText(url); b.textContent = 'Copied'; }
  catch { b.textContent = 'Copy from address bar'; }
  setTimeout(() => b.textContent = text, 2000);
}
function renderCoverage() {
  const c = $('coverage-content'); c.append(node('p', null, data.scope));
  const waiting = data.problems.filter(p => p.statementOnly).length;
  if (waiting) c.append(node('p', null, `${waiting} additional verified statements are available without method tags. Classification and proof review are still pending for these entries.`));
  for (const s of data.snapshots || []) if (s.count != null) c.append(node('p', null, `${CONTESTS[s.contest] || s.contest}: ${s.count} entries`));
  for (const x of data.coverage) c.append(node('h3', null, x.title), node('p', null, x.text));
  c.append(node('h3', null, 'Difficulty estimates'), node('p', null, 'Every difficulty shown is an estimate. ISL: the problem’s position in its subject list that year, adjusted by era. USAMO, USA TSTST 2014–2020 and USA TST 2014–2021: Evan Chen’s MOHS ratings (web.evanchen.cc), mapped 0–10M → 1, 15–20M → 2, 25–30M → 3, 35–40M → 4, 45M+ → 5. Other USAMO, TST, TSTST and RMM papers: the problem’s place in its day (first, second or third problem → 2, 3, 4). These are rough guides, not judgements of the solutions.'));
  c.append(node('h3', null, 'Forum checks'), node('p', null, 'Each classified problem was checked against its forum thread: live (the current AoPS thread), archived (a saved copy) or still pending. A check records that the review was done, not that every forum proof is correct. The “Forum check” filter is under “More filters”.'));
  c.append(node('h3', null, 'Method numbers'), node('p', null, 'Each method has a number (its place in the tag list). Problems show only the name; you can still type a number in the Methods search, e.g. 44.'));
  c.append(node('h3', null, 'Caveats'));
  c.append(node('p', null, 'Classifications are original summaries; full solutions are at the linked sources.'));
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
  gridPicker?.setSelected(gridContest);
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
      const a = node('a', `grid-cell ${on ? 'done' : 'todo'}${hit ? ' match' : ''}${sel ? ' selected' : ''}${progress?.hasNote(p.key) ? ' has-note' : ''}`, p.id); a.href = entryUrl(p);
      a.title = `${problemName(p)}: ${on ? 'done' : 'not done'}${p.statementOnly ? ', statement available; classification pending' : ''}${hit ? ', matches your filters' : ''}${selecting ? (sel ? ' (selected)' : ' (click to select)') : ''}`;
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
  filters = {...emptyFilters(), problem: p.key}; view = 'list'; currentColl = ''; sharedId = ''; page = 1; practiceId = '';
  $('tag-search').value = ''; syncControls();
  history.pushState(null, '', searchUrl()); render();
  $('results').scrollIntoView({block: 'start'});
}

// ---- "+ Collection" menu on a problem
let notebook = null;
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
    row.append(mark, open); items.push(row);
    const text = progress.note(p.key);
    if (text) { const q = node('p', 'menu-note', noteExcerpt(text)); q.title = 'Your notes (open the problem to edit)'; items.push(q); }
    items.push(node('p', 'collect-sub', 'Add to collection'));
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

// ---- Notes on the problem being viewed (autosaves while typing)
let notesKey = null, notesTimer = null, notesDirty = false;
function renderNotes(p) {
  const box = $('problem-notes'), ta = $('notes-text');
  renderRevisit(p);
  if (!progress || !p) { flushNotes(); box.hidden = true; notesKey = null; return; }
  box.hidden = false;
  if (notesKey !== p.key) { flushNotes(); notesKey = p.key; ta.value = progress.note(p.key); $('notes-status').textContent = ''; renderNotesPreview(); }
  else if (!notesDirty && document.activeElement !== ta && ta.value !== progress.note(p.key)) { ta.value = progress.note(p.key); renderNotesPreview(); } // changed on another device
  $('notes-where').textContent = progress.user ? 'Private: only you can see these. Saved to your account.'
    : 'Private, saved in this browser. Sign in (top right) to keep notes on every device.';
}
// Rendered preview of the note (LaTeX, hidden boxes [\hide="Label"] … [\hide]), shown whenever the note has text.
let previewTimer = null, previewRun = 0;
async function renderNotesPreview() {
  clearTimeout(previewTimer); previewTimer = null;
  const box = $('notes-preview'), body = $('notes-preview-body'), text = $('notes-text').value;
  const run = ++previewRun;
  if (!text.trim()) { box.hidden = true; body.textContent = ''; body.style.minHeight = ''; return; }
  // Hold the old height while the new text is typeset, so the page doesn't shrink and pull the view up.
  if (!box.hidden) body.style.minHeight = `${body.offsetHeight}px`;
  // Boxes the reader has opened stay open (by position) while the preview is rebuilt as they type.
  const wasOpen = [...body.querySelectorAll('details.note-hide')].map(d => d.open);
  box.hidden = false; body.replaceChildren(); renderNote(body, parseNote(text));
  body.querySelectorAll('details.note-hide').forEach((d, i) => { if (wasOpen[i]) d.open = true; });
  try { await typesetMath(body); } catch { if (run === previewRun) { body.style.minHeight = ''; $('notes-preview-note').textContent = 'Math preview is unavailable right now.'; } return; }
  if (run === previewRun) { body.style.minHeight = ''; $('notes-preview-note').textContent = ''; }
}
async function flushNotes() {
  clearTimeout(notesTimer); notesTimer = null;
  if (!notesDirty || !notesKey || !progress) return;
  const key = notesKey, text = $('notes-text').value, had = progress.hasNote(key); notesDirty = false;
  const ok = await progress.setNote(key, text);
  if (ok && had !== progress.hasNote(key)) render(); // show or hide the "Notes" markers
  if (key === notesKey) $('notes-status').textContent = ok ? (text.trim() ? 'Saved' : 'Cleared') : 'Couldn’t save. Check your connection; your text is still here.';
  if (!ok && key === notesKey) notesDirty = true;
}
function setupNotes() {
  const ta = $('notes-text');
  ta.addEventListener('input', () => { clearTimeout(previewTimer); previewTimer = setTimeout(renderNotesPreview, 400); notesDirty = true; $('notes-status').textContent = 'Saving…'; clearTimeout(notesTimer); notesTimer = setTimeout(flushNotes, 700); });
  ta.addEventListener('blur', flushNotes);
  // Browsers scroll the page to bring the cursor into view on every keystroke. Keep the page where it is instead,
  // so you can type while reading the preview (or the statement) further down. Arrow keys and clicks still move it as usual.
  let typingY = null, typingX = 0;
  const hold = () => { if (typingY != null && (scrollY !== typingY || scrollX !== typingX)) scrollTo(typingX, typingY); };
  ta.addEventListener('beforeinput', () => {
    typingX = scrollX; typingY = scrollY;
    requestAnimationFrame(() => requestAnimationFrame(() => { hold(); typingY = null; }));
  });
  ta.addEventListener('input', hold);
  addEventListener('scroll', hold, {passive: true});
  addEventListener('pagehide', flushNotes);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushNotes(); });
}

// ---- Collections tab
// A collection's keys are problem keys plus section dividers ("§<id>|<title>", see progress.mjs).
const isSection = k => typeof k === 'string' && k.startsWith('§');
const sectionTitle = k => k.slice(k.indexOf('|') + 1);
let randomDraft = {count: 20, topics: ['A', 'C', 'G', 'N'], min: 1, max: 5, skipDone: true, open: false, note: ''};
let collDraft = {name: '', description: ''}, editing = null, collMatch = null, noteEditing = '', addNote = '', addText = '';
// Keys of a collection that pass the sidebar filters (sections always stay); doneIn(key) decides "Your progress".
function filterCollection(keys, doneIn) {
  return keys.filter(k => isSection(k) || ((!collMatch || collMatch.has(k)) && passesProgress(k, doneIn)));
}
function filteredNote(main, shown, total) {
  if (!collMatch && !filters.done) return;
  const p = node('p', 'coll-filtered', shown ? `Showing ${shown} of ${total} (filters on) ` : 'No problems in this collection match your filters. ');
  p.append(button('link-button', 'Clear filters', reset)); main.append(p);
}
const shareUrl = id => `${location.origin}${location.pathname}?view=collections&shared=${encodeURIComponent(id)}`;
const minutes = s => s < 3600 ? `${Math.max(1, Math.round(s / 60))} min` : `${Math.floor(s / 3600)} h ${Math.round(s % 3600 / 60)} min`;
// own: the reader's collection (adds its own "Done here" marks, notes, sections and Remove buttons); omit for shared views.
function collectionProblems(keys, byKey, own) {
  const ol = node('ol', 'coll-problems');
  for (const k of keys) {
    if (isSection(k)) {
      const li = node('li', 'coll-section'); li.dataset.key = k;
      if (own) li.append(dragHandle(li, own, keys, `section ${sectionTitle(k)}`));
      li.append(node('h3', null, sectionTitle(k)));
      if (own) li.append(button('coll-remove', 'Rename', async () => {
        const t = prompt('Section name', sectionTitle(k)); if (t && t.trim()) await progress.renameSection(own.id, k, t);
      }), button('coll-remove', 'Remove', () => progress.setInCollection(own.id, k, false), `Remove the section “${sectionTitle(k)}” (its problems stay)`));
      ol.append(li); continue;
    }
    const p = byKey.get(k), li = node('li'); li.dataset.key = k;
    if (own) li.append(dragHandle(li, own, keys, problemName(p)));
    const overall = !!progress?.isDone(k), here = own ? progress.isDoneIn(own.id, k) : overall;
    if (here) li.classList.add('is-done');
    const primary = p.geometry ? (p.geometry.synthetic?.primaryTag ?? p.geometry.analytic?.primaryTag) : p.primaryTag;
    const spent = timeSpent(k), rv = progress?.revisitOn(k);
    const info = node('span', 'sub', `${SUBJECTS[p.subject] || p.subject}${primary && tags.get(primary) ? ` · ${shorten(tags.get(primary).label)}` : ''}${p.difficulty ? ` · difficulty ${p.difficulty}/5` : ''}${progress?.hasNote(k) ? ' · has notes' : ''}${spent >= 60 ? ` · ⏱ ${minutes(spent)}` : ''}${rv ? ` · revisit ${shortDate(rv)}` : ''}`);
    const name = node('div', 'coll-pname'); name.append(problemLink(p, null, problemName(p)));
    if (own && overall) { const t = node('span', 'done-tag overall', '✓ done overall'); t.title = 'Marked done in your overall progress'; name.append(t); }
    name.append(info);
    if (own) {
      const text = progress.collectionNote(own.id, k);
      if (noteEditing === k) {
        const f = node('form', 'coll-note-form'), input = node('input');
        input.value = text; input.maxLength = 300; input.placeholder = 'Why it’s here, e.g. “redo without hints”'; input.setAttribute('aria-label', `Note on ${problemName(p)}`);
        const save = node('button', null, 'Save'); save.type = 'submit';
        f.append(input, save, button(null, 'Cancel', () => { noteEditing = ''; render(); }));
        f.addEventListener('submit', async e => { e.preventDefault(); noteEditing = ''; await progress.setCollectionNote(own.id, k, input.value); render(); });
        input.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); noteEditing = ''; render(); } });
        name.append(f); requestAnimationFrame(() => input.isConnected && input.focus());
      } else if (text) name.append(node('p', 'coll-note', text));
    }
    li.append(name);
    if (own) {
      li.append(button('coll-remove', progress.collectionNote(own.id, k) ? 'Edit note' : 'Note', () => { noteEditing = noteEditing === k ? '' : k; render(); }, 'A short private note on this problem in this collection'));
      li.append(button(`coll-done${here ? ' is-on' : ''}`, here ? '✓ Done here' : 'Done here', () => progress.toggleDoneIn(own.id, k),
        here ? 'Done in this collection only. Click to unmark.' : 'Mark done in this collection only (doesn’t change your overall progress or other collections)'));
      li.append(button('coll-remove', 'Remove', () => progress.setInCollection(own.id, k, false), `Remove ${problemName(p)} from this collection`));
    } else if (progress) li.append(button(`coll-done${overall ? ' is-on' : ''}`, overall ? '✓ Done' : 'Mark done', () => progress.toggle(k), overall ? 'Click to mark as not done' : null));
    ol.append(li);
  }
  return ol;
}
// Reordering a collection: drag a row by its handle (mouse, pen or touch), or focus the handle and use
// the arrow keys. With filters on only the shown rows move; the hidden ones keep their places.
function commitOrder(own, shown, ol) {
  const moved = [...ol.children].map(li => li.dataset.key), slots = new Set(shown);
  let i = 0; const order = own.keys.map(k => slots.has(k) ? moved[i++] : k);
  return progress.reorderCollection(own.id, order);
}
function dragHandle(li, own, shown, label) {
  const h = button('coll-drag', '⠿', null, 'Drag to reorder (or focus and use the arrow keys)');
  h.setAttribute('aria-label', `Move ${label}`);
  h.addEventListener('keydown', async e => {
    const ol = li.parentElement, sib = e.key === 'ArrowUp' ? li.previousElementSibling : e.key === 'ArrowDown' ? li.nextElementSibling : null;
    if (!sib) return;
    e.preventDefault();
    if (e.key === 'ArrowUp') ol.insertBefore(li, sib); else ol.insertBefore(sib, li);
    refocus = li.dataset.key;
    await commitOrder(own, shown, ol);
  });
  h.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    const ol = li.parentElement, start = [...ol.children].map(x => x.dataset.key);
    // Listen on the document: moving the row in the DOM would drop a pointer capture on the handle.
    li.classList.add('dragging');
    const move = ev => {
      if (ev.pointerId !== e.pointerId) return;
      // Drop position: before the first other row whose middle is below the pointer.
      const others = [...ol.children].filter(x => x !== li);
      const next = others.find(x => { const r = x.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; }) || null;
      if (li.nextElementSibling !== next) ol.insertBefore(li, next);
      if (ev.clientY < 40) scrollBy(0, -12); else if (ev.clientY > innerHeight - 40) scrollBy(0, 12);
    };
    const end = ev => {
      if (ev.pointerId !== e.pointerId) return;
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end); document.removeEventListener('pointercancel', end);
      li.classList.remove('dragging');
      if ([...ol.children].some((x, i) => x.dataset.key !== start[i])) commitOrder(own, shown, ol);
    };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  });
  return h;
}
let refocus = '';
// Sort once: problems are sorted within each section; sections stay where they are. The topic sort instead
// adds a heading per topic, unless the collection has sections of its own (then it sorts within those).
const contestRank = c => Object.keys(CONTESTS).indexOf(c);
const byName = (a, b) => contestRank(a.contest) - contestRank(b.contest) || a.year - b.year
  || idOrder(a.id)[0].localeCompare(idOrder(b.id)[0]) || idOrder(a.id)[1] - idOrder(b.id)[1];
const topicRank = s => ({A:0, C:1, G:2, N:3})[s] ?? 4;   // same order as the Progress grid
const SORTS = {
  newest: ['Newest first', (a, b) => b.year - a.year || byName(a, b)],
  oldest: ['Oldest first', (a, b) => a.year - b.year || byName(a, b)],
  contest: ['By contest, then year', byName],
  topic: ['By topic (with headings), then easiest first', (a, b) => topicRank(a.subject) - topicRank(b.subject) || (a.difficulty ?? 9) - (b.difficulty ?? 9) || byName(a, b)],
  easiest: ['Easiest first', (a, b) => (a.difficulty ?? 9) - (b.difficulty ?? 9) || byName(a, b)],
  hardest: ['Hardest first', (a, b) => (b.difficulty ?? 0) - (a.difficulty ?? 0) || byName(a, b)],
  todo: ['Not done here first', null],
};
function sortCollection(c, how, byKey) {
  if (how === 'topic') { const keys = arrangeByTopic(c.keys, byKey, SORTS.topic[1]); if (keys) return progress.arrangeCollection(c.id, keys); }
  const cmp = how === 'todo' ? (a, b) => Number(progress.isDoneIn(c.id, a.key)) - Number(progress.isDoneIn(c.id, b.key)) : SORTS[how][1];
  const out = []; let block = [];
  const flush = () => { block.sort((a, b) => cmp(byKey.get(a), byKey.get(b))); out.push(...block); block = []; };
  for (const k of c.keys) { if (byKey.has(k)) block.push(k); else { flush(); out.push(k); } }
  flush();
  return progress.reorderCollection(c.id, out);
}
// Print a problem set: the collection's statements (and section headings) in order, via the browser's print dialog.
async function printCollection(name, description, keys, byKey, b) {
  const label = b.textContent; b.disabled = true; b.textContent = 'Preparing…';
  document.getElementById('print-view')?.remove();
  const box = node('div'); box.id = 'print-view';
  box.append(node('h1', null, name));
  if (description) box.append(node('p', 'print-desc', description));
  let n = 0;
  try {
    for (const k of keys) {
      if (isSection(k)) { box.append(node('h2', 'print-section', sectionTitle(k))); continue; }
      const p = byKey.get(k); if (!p) continue;
      const item = node('section', 'print-problem');
      item.append(node('h3', null, `${++n}. ${problemName(p)}`));
      const body = await statementElement(k).catch(() => null);
      item.append(body || node('p', 'help', 'The statement isn’t in the catalogue yet; see the problem’s source.'));
      box.append(item);
    }
    box.append(node('p', 'print-foot', `Printed from ${location.host}${location.pathname} · each problem’s source is listed on its page in the catalogue.`));
    document.body.append(box);
    try { await typesetMath(box); } catch { /* print the LaTeX as typed */ }
    await Promise.all([...box.querySelectorAll('img')].map(i => i.decode().catch(() => {})));
    document.body.classList.add('printing');
    const cleanup = () => { removeEventListener('afterprint', cleanup); document.body.classList.remove('printing'); box.remove(); };
    addEventListener('afterprint', cleanup);
    print();
  } finally { b.disabled = false; b.textContent = label; }
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
  const items = d.keys.filter(k => byKey.has(k) || isSection(k)), keys = items.filter(k => byKey.has(k));
  const done = keys.filter(k => progress?.isDone(k)).length;
  const head = node('div', 'coll-head'), titles = node('div');
  titles.append(node('p', 'collect-sub', 'Shared collection'), node('h2', null, d.name));
  if (d.description) titles.append(node('p', 'coll-desc', d.description));
  const actions = node('div', 'coll-actions');
  const mine = progress?.user && progress.user.uid === d.ownerUid;
  if (mine) actions.append(button(null, 'Manage', () => { sharedId = ''; currentColl = d.id; render(); }));
  else if (progress) actions.append(button(null, 'Save a copy', async e => {
    e.currentTarget.disabled = true;
    const id = await progress.copyShared({...d, keys: items});
    if (id) { sharedId = ''; currentColl = id; render(); }
  }, 'Copy this list into your own collections (then you can practise it)'));
  actions.append(button(null, 'Print', e => printCollection(d.name, d.description, items, byKey, e.currentTarget), 'Print the statements as a problem set (or save as PDF)'));
  head.append(titles, actions); main.append(head);
  main.append(node('p', 'sub', `${keys.length} problem${keys.length === 1 ? '' : 's'}${progress ? ` · ${done} done by you` : ''}`));
  const shown = filterCollection(items, k => !!progress?.isDone(k)), shownProblems = shown.filter(k => byKey.has(k)).length;
  filteredNote(main, shownProblems, keys.length);
  if (shown.length) main.append(collectionProblems(shown, byKey, null));
  box.replaceChildren(main);
}
function collectionTools(c, byKey, main) {
  const tools = node('div', 'coll-tools');
  // Sort once
  const sort = node('select'); sort.setAttribute('aria-label', 'Sort this collection');
  sort.append(new Option('Sort…', ''), ...Object.entries(SORTS).map(([id, [label]]) => new Option(label, id)));
  sort.addEventListener('change', async () => { const how = sort.value; if (how) await sortCollection(c, how, byKey); });
  // Section divider
  const sec = node('form', 'coll-inline'), secName = node('input');
  secName.placeholder = 'New section, e.g. “Week 1”'; secName.maxLength = 80; secName.setAttribute('aria-label', 'New section name');
  const secAdd = node('button', null, 'Add section'); secAdd.type = 'submit';
  sec.append(secName, secAdd);
  sec.addEventListener('submit', async e => { e.preventDefault(); if (!secName.value.trim()) { secName.focus(); return; } await progress.addSection(c.id, secName.value); });
  tools.append(sort, sec);
  // Add by name
  const add = node('details', 'coll-addnames'); add.open = !!(addText || addNote);
  add.append(node('summary', null, 'Add problems by name'));
  const f = node('form'), ta = node('textarea');
  ta.rows = 2; ta.value = addText; ta.placeholder = 'e.g. 2019 ISL C6, USAMO 2021/3, TSTST 2019 P4, RMM 2020/2'; ta.setAttribute('aria-label', 'Problem names to add');
  ta.addEventListener('input', () => { addText = ta.value; });
  const go = node('button', null, 'Add'); go.type = 'submit';
  f.append(ta, go);
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const {keys, missing} = parseProblemList(ta.value, data.problems);
    const n = keys.length ? await progress.addManyToCollection(c.id, keys) : 0;
    addText = missing.join(', ');
    addNote = `${n == null ? 'Couldn’t save.' : `Added ${n}${keys.length > n ? ` (${keys.length - n} already here)` : ''}.`}${missing.length ? ` Not found: ${missing.join(', ')}. Write them like “2019 ISL C6” or “USAMO 2021/3”.` : ''}`;
    render();
  });
  add.append(f);
  if (addNote) add.append(node('p', 'help', addNote));
  main.append(tools, add);
}
// "Random ISL set": a new collection of random ISL problems, spread evenly over the chosen topics, and inside
// each topic from the lowest to the highest chosen shortlist number, e.g. A1–A5 (randomSet in catalogue-core.mjs).
// Numbers 9 and 10 are too rare to build sets from, so the choice stops at 8.
function randomSetForm(byKey) {
  const r = randomDraft, box = node('details', 'coll-random'); box.open = r.open;
  box.addEventListener('toggle', () => { r.open = box.open; });
  box.append(node('summary', null, 'Random ISL set'));
  const f = node('form');
  const count = node('input'); count.type = 'number'; count.min = 1; count.max = 100; count.value = r.count;
  count.addEventListener('input', () => { r.count = count.value; });
  const countL = node('label', null, 'Problems '); countL.append(count);
  const topics = node('fieldset'); topics.append(node('legend', null, 'Topics'));
  for (const [t, label] of TOPICS) {
    const cb = node('input'); cb.type = 'checkbox'; cb.checked = r.topics.includes(t);
    cb.addEventListener('change', () => { r.topics = TOPICS.map(x => x[0]).filter(x => x === t ? cb.checked : r.topics.includes(x)); });
    const l = node('label'); l.append(cb, ` ${label}`); topics.append(l);
  }
  const level = (v, aria, set) => { const sel = node('select'); sel.setAttribute('aria-label', aria);
    for (let i = 1; i <= 8; i++) sel.append(new Option(String(i), String(i), false, i === v));
    sel.addEventListener('change', () => set(Number(sel.value))); return sel; };
  const diff = node('label', null, 'Difficulty: ISL ');
  diff.append(level(r.min, 'Lowest shortlist number', v => { r.min = v; }), ' to ', level(r.max, 'Highest shortlist number', v => { r.max = v; }));
  diff.title = 'The problem’s number in its topic on the shortlist (A1, C5, …)';
  const skip = node('input'); skip.type = 'checkbox'; skip.checked = r.skipDone;
  skip.addEventListener('change', () => { r.skipDone = skip.checked; });
  const skipL = node('label'); skipL.append(skip, ' Leave out problems I’ve done');
  const go = node('button', null, 'Make the set'); go.type = 'submit';
  f.append(countL, topics, diff, skipL, go);
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const n = Math.round(Number(r.count)); const [min, max] = [Math.min(r.min, r.max), Math.max(r.min, r.max)];
    if (!(n >= 1 && n <= 100)) { r.note = 'Choose between 1 and 100 problems.'; render(); return; }
    if (!r.topics.length) { r.note = 'Choose at least one topic.'; render(); return; }
    const {keys, missing} = randomSet(data.problems, {count: n, topics: r.topics, min, max, skip: {has: k => r.skipDone && progress.isDone(k)}});
    if (!keys.length) { r.note = 'No ISL problems match these choices.'; render(); return; }
    const all = r.topics.length === TOPICS.length;
    const name = `Random ISL · ${keys.length} problems · ISL ${min === max ? min : `${min}–${max}`}${all ? '' : ` · ${r.topics.join('')}`}`;
    const id = await progress.createCollection(name, `Made ${new Date().toLocaleDateString()}.`);
    if (!id) { r.note = 'Couldn’t make the collection.'; render(); return; }
    await progress.addManyToCollection(id, keys);
    const c = progress.collection(id), arranged = c && arrangeByTopic(c.keys, byKey, (a, b) => islNumber(a) - islNumber(b) || byName(a, b));
    if (arranged) await progress.arrangeCollection(id, arranged);
    r.note = missing ? `Only ${keys.length} of ${n} found: there aren’t enough ISL problems left for these choices.` : '';
    currentColl = id; editing = null; render();
  });
  box.append(f);
  if (r.note) box.append(node('p', 'help', r.note));
  return box;
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
  side.append(form, randomSetForm(byKey));
  if (!progress.user) side.append(node('p', 'help', 'Saved in this browser. Sign in (top right) to keep your collections on every device.'));
  if (progress.status) side.append(node('p', 'help', progress.status));
  const ul = node('ul', 'coll-list');
  for (const c of list) {
    const keys = c.keys.filter(k => byKey.has(k)), d = keys.filter(k => progress.isDoneIn(c.id, k)).length;
    const li = node('li'), b = button(`coll-pick${c.id === currentColl ? ' on' : ''}`, null, () => { currentColl = c.id; editing = null; noteEditing = ''; addNote = ''; addText = ''; render(); });
    b.setAttribute('aria-current', String(c.id === currentColl));
    b.append(node('span', 'coll-name', c.name), node('span', 'sub', `${keys.length} problem${keys.length === 1 ? '' : 's'} · ${d} done here${c.public ? ' · public' : ''}`));
    if (keys.length) { const bar = node('span', 'coll-progress'); bar.style.setProperty('--pct', `${Math.round(100 * d / keys.length)}%`); bar.setAttribute('aria-hidden', 'true'); b.append(bar); }
    li.append(b); ul.append(li);
  }
  if (list.length) side.append(ul);

  const main = node('div', 'coll-main');
  const c = currentColl && progress.collection(currentColl);
  if (!c) {
    main.append(node('p', 'empty', list.length ? 'Pick a collection to see its problems.'
      : 'Collections are your own named lists of problems, such as a training set or problems to revisit. Make one on the left, then add problems by name, with Select (in Problem lookup or on the Progress grid) or from a grid square’s menu.'));
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
    const items = c.keys.filter(k => byKey.has(k) || isSection(k)), keys = items.filter(k => byKey.has(k));
    const head = node('div', 'coll-head');
    const titles = node('div'); titles.append(node('h2', null, c.name));
    if (c.description) titles.append(node('p', 'coll-desc', c.description));
    const actions = node('div', 'coll-actions');
    const practise = button('primary', 'Practice', () => startPractice(c, byKey), 'Work through this collection one problem at a time: statement first, method hints on request, with a timer');
    practise.disabled = !keys.length;
    const printB = button(null, 'Print', e => printCollection(c.name, c.description, items, byKey, e.currentTarget), 'Print the statements as a problem set (or save as PDF)');
    printB.disabled = !keys.length;
    actions.append(practise, printB, button(null, 'Edit', () => { editing = c.id; render(); }),
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
      share.append(node('span', 'help', 'Anyone with the link can view this list and its sections (not your done marks or notes).'), link,
        button(null, 'Copy link', e => copyUrl(shareUrl(c.id), e.currentTarget)));
    } else share.append(node('span', 'help', progress.user ? 'Only you can see this collection.' : 'Only you can see this. Sign in to make it public.'));
    main.append(share);
    collectionTools(c, byKey, main);
    if (!keys.length) main.append(node('p', 'empty', 'No problems yet. Add them by name above, with Select in Problem lookup or on the Progress grid, or from a grid square’s menu.'));
    if (items.length) {
      const d = keys.filter(k => progress.isDone(k)).length;
      const here = keys.filter(k => progress.isDoneIn(c.id, k)).length;
      if (keys.length) main.append(node('p', 'sub', `${keys.length} problem${keys.length === 1 ? '' : 's'} · ${here} done here · ${d} done overall${items.length > 1 ? ' · drag ⠿ to reorder' : ''}`));
      const shown = filterCollection(items, k => progress.isDoneIn(c.id, k)), shownProblems = shown.filter(k => byKey.has(k)).length;
      filteredNote(main, shownProblems, keys.length);
      if (shown.length) main.append(collectionProblems(shown, byKey, c));
    }
  }
  box.replaceChildren(side, main);
  if (refocus) { box.querySelector(`li[data-key="${CSS.escape(refocus)}"] .coll-drag`)?.focus(); refocus = ''; }
}

// ---- Practice mode: one problem of a collection at a time, method tags hidden behind hints, with a timer
let practiceId = '';
const SKIP_KEY = 'raindrops.practiceSkipDone';
const skipDone = () => { try { return localStorage.getItem(SKIP_KEY) === '1'; } catch { return false; } };
function practiceKeys(c, current) {
  const byKey = new Set(data.problems.map(p => p.key));
  const all = c.keys.filter(k => byKey.has(k));
  return skipDone() ? all.filter(k => k === current || !progress.isDoneIn(c.id, k)) : all;
}
function startPractice(c, byKey) {
  const keys = c.keys.filter(k => byKey.has(k));
  const first = keys.find(k => !progress.isDoneIn(c.id, k)) || keys[0];
  if (first) openPractice(c.id, first);
}
function openPractice(id, key) {
  filters = {...emptyFilters(), problem: key}; view = 'list'; currentColl = ''; sharedId = ''; page = 1; practiceId = id;
  $('tag-search').value = ''; syncControls();
  history.pushState(null, '', searchUrl()); render();
  $('problem-focus').scrollIntoView({block: 'start'});
}
function renderPractice(shown) {
  const bar = $('practice-bar');
  const c = practiceId && progress?.collection(practiceId);
  const on = !!(shown && c && c.keys.includes(shown.key));
  if (!on) practiceId = shown ? '' : practiceId;
  document.body.classList.toggle('practicing', on);
  bar.hidden = !on;
  if (!on) { stopTimer(); return; }
  const keys = practiceKeys(c, shown.key), i = keys.indexOf(shown.key), byKey = new Map(data.problems.map(p => [p.key, p]));
  let section = ''; for (const k of c.keys) { if (k === shown.key) break; if (isSection(k)) section = sectionTitle(k); }
  const here = progress.isDoneIn(c.id, shown.key);
  const where = node('div', 'practice-where');
  where.append(node('span', 'collect-sub', 'Practice'), node('strong', null, c.name),
    node('span', 'sub', `${section ? `${section} · ` : ''}${i + 1} of ${keys.length}`));
  const nav = node('div', 'practice-nav');
  const prev = button(null, '← Previous', () => openPractice(c.id, keys[i - 1])); prev.disabled = i <= 0;
  const next = button(null, 'Next →', () => openPractice(c.id, keys[i + 1])); next.disabled = i >= keys.length - 1;
  const time = node('span', 'practice-time'); time.id = 'practice-time';
  const pause = button('practice-pause', timer.paused ? 'Resume' : 'Pause', () => { if (timer.paused) resumeTimer(); else pauseTimer(); renderPractice(shown); }, 'Pause or resume the timer for this problem');
  const done = button(`coll-done${here ? ' is-on' : ''}`, here ? '✓ Done here' : 'Done here', () => progress.toggleDoneIn(c.id, shown.key), 'Mark done in this collection');
  const skip = node('label', 'practice-skip'), cb = node('input'); cb.type = 'checkbox'; cb.checked = skipDone();
  cb.addEventListener('change', () => { try { localStorage.setItem(SKIP_KEY, cb.checked ? '1' : '0'); } catch {} renderPractice(shown); });
  skip.append(cb, ' Skip done');
  const exit = button(null, 'Exit', () => { const id = c.id; stopTimer(); practiceId = ''; view = 'collections'; currentColl = id; filters.problem = ''; history.pushState(null, '', searchUrl()); render(); }, 'Back to the collection');
  nav.append(prev, next, time, pause, done, skip, exit);
  const note = progress.collectionNote(c.id, shown.key);
  bar.replaceChildren(where, nav);
  if (note) bar.append(node('p', 'coll-note', note));
  timerFor(shown.key); showTime();
}
// Time spent per problem (practice mode), kept in this browser.
const TIME_KEY = 'raindrops.timeSpent';
let timeStore = (() => { try { const v = JSON.parse(localStorage.getItem(TIME_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } })();
let timer = {key: '', since: 0, paused: false};
const running = () => timer.key && !timer.paused && timer.since;
function commitTime() {
  if (!running()) return;
  const now = performance.now();
  timeStore[timer.key] = (timeStore[timer.key] || 0) + (now - timer.since) / 1000; timer.since = now;
  try { localStorage.setItem(TIME_KEY, JSON.stringify(timeStore)); } catch {}
}
function timeSpent(k) { return (timeStore[k] || 0) + (running() && timer.key === k ? (performance.now() - timer.since) / 1000 : 0); }
function timerFor(k) { if (timer.key === k) return; commitTime(); timer = {key: k, since: document.hidden ? 0 : performance.now(), paused: false}; }
function stopTimer() { commitTime(); timer = {key: '', since: 0, paused: false}; }
function pauseTimer() { commitTime(); timer.paused = true; }
function resumeTimer() { timer.paused = false; timer.since = document.hidden ? 0 : performance.now(); }
function showTime() {
  const el = document.getElementById('practice-time'); if (!el || !timer.key) return;
  const s = Math.floor(timeSpent(timer.key)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
  el.textContent = `⏱ ${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(sec).padStart(2, '0')}${timer.paused ? ' (paused)' : ''}`;
}
function setupTimer() {
  setInterval(showTime, 1000);
  setInterval(commitTime, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { commitTime(); timer.since = 0; }
    else if (timer.key && !timer.paused) timer.since = performance.now();
  });
  addEventListener('pagehide', commitTime);
}

// ---- Revisit dates ("come back to this in a week")
const todayStr = () => new Date().toLocaleDateString('en-CA');
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const shortDate = s => new Intl.DateTimeFormat('en', {month: 'short', day: 'numeric', ...(s.slice(0, 4) !== todayStr().slice(0, 4) ? {year: 'numeric'} : {})}).format(new Date(`${s}T12:00:00`));
const isDue = k => { const d = progress?.revisitOn(k); return !!d && d <= todayStr(); };
function passesProgress(key, doneIn) {
  if (!filters.done) return true;
  if (filters.done === 'due') return isDue(key);
  return doneIn(key) === (filters.done === 'yes');
}
function renderRevisit(p) {
  const box = $('revisit-row');
  if (!progress || !p) { box.replaceChildren(); return; }
  const d = progress.revisitOn(p.key), items = [];
  if (d) {
    items.push(node('span', `revisit-when${d <= todayStr() ? ' due' : ''}`, d <= todayStr() ? `Due to revisit (set for ${shortDate(d)})` : `Revisit on ${shortDate(d)}`),
      button('link-button', 'Clear', () => progress.setRevisit(p.key, '')));
  } else {
    items.push(node('span', 'help', 'Revisit:'));
    for (const [label, n] of [['in 3 days', 3], ['in a week', 7], ['in a month', 30]]) items.push(button(null, label, () => progress.setRevisit(p.key, addDays(n)), `Come back to this problem on ${shortDate(addDays(n))}`));
    const pick = node('input'); pick.type = 'date'; pick.min = addDays(1); pick.setAttribute('aria-label', 'Revisit on a date');
    pick.addEventListener('change', () => { if (pick.value) progress.setRevisit(p.key, pick.value); });
    items.push(pick);
  }
  box.replaceChildren(...items);
}
function renderDueNote() {
  const el = $('due-note');
  const n = progress && !filters.problem && filters.done !== 'due' && view !== 'collections' ? progress.revisitKeys().filter(isDue).length : 0;
  el.hidden = !n;
  if (!n) { el.replaceChildren(); return; }
  el.replaceChildren(`${n} problem${n === 1 ? ' is' : 's are'} due to revisit. `, button('link-button', n === 1 ? 'Show it' : 'Show them', () => { view = view === 'grid' ? 'grid' : 'list'; update({done: 'due'}); }));
}

// ---- Random problem from the current filters (not done yet, when there are any)
function randomProblem() {
  const pool = selectProblems(data.problems, data.taxonomy, {...filters, problem: ''}).map(r => r.problem.key)
    .filter(k => !progress || passesProgress(k, x => progress.isDone(x)));
  const fresh = progress ? pool.filter(k => !progress.isDone(k)) : pool;
  let list = (fresh.length ? fresh : pool).filter(k => k !== filters.problem);
  if (!list.length) list = pool;
  if (!list.length) { const b = $('random'), t = b.textContent; b.textContent = 'No problems match'; setTimeout(() => { b.textContent = t; }, 1800); return; }
  const key = list[Math.floor(Math.random() * list.length)];
  filters = {...filters, problem: key}; view = 'list'; practiceId = ''; page = 1; syncControls();
  history.pushState(null, '', searchUrl()); render();
  $('results').scrollIntoView({block: 'start'});
}

// ---- Guide (a dialog anyone can open) and the welcome note shown on a first visit
const WELCOME_KEY = 'raindrops.welcomed';
function dismissWelcome() {
  $('welcome').hidden = true;
  try { localStorage.setItem(WELCOME_KEY, '1'); } catch {}
}
function openGuide(section) {
  const d = $('guide-dialog');
  if (!d.open) d.showModal();
  if (section) d.querySelector(`#${section}`)?.scrollIntoView({block: 'start'}); else d.scrollTop = 0;
}
function guideAction(action) {
  $('guide-dialog').close();
  if (action === 'random') randomProblem();
  else if (action === 'coverage') $('coverage-dialog').showModal();
  else if (action === 'grid' || action === 'collections') {
    view = action; currentColl = ''; sharedId = ''; practiceId = ''; filters.problem = '';
    if (action === 'collections') { selecting = false; selected.clear(); }
    closeCollectMenu(); history.pushState(null, '', searchUrl()); render();
    document.querySelector('.view-tabs').scrollIntoView({block: 'start'});
  }
}
function setupGuide() {
  $('guide-open').addEventListener('click', () => openGuide());
  $('guide-close').addEventListener('click', () => $('guide-dialog').close());
  $('guide-dialog').addEventListener('click', e => {
    const link = e.target.closest('.guide-toc a');
    if (link) { e.preventDefault(); openGuide(link.getAttribute('href').slice(1)); return; }
    const b = e.target.closest('[data-guide]');
    if (b) guideAction(b.dataset.guide);
  });
  $('welcome').addEventListener('click', e => {
    const b = e.target.closest('[data-welcome]'); if (!b) return;
    dismissWelcome();
    if (b.dataset.welcome === 'guide') openGuide();
    else if (b.dataset.welcome === 'random') randomProblem();
  });
  let seen = false;
  try { seen = localStorage.getItem(WELCOME_KEY) === '1'; } catch {}
  $('welcome').hidden = seen;
  if (location.hash === '#guide') openGuide();
}

// ---- Problem view: collapsible filters sidebar and focus mode (statement + notes only)
const FILTERS_KEY = 'raindrops.filtersCollapsed';
function storedCollapsed() { try { return localStorage.getItem(FILTERS_KEY) === '1'; } catch { return false; } }
function setFiltersCollapsed(on) {
  document.body.classList.toggle('filters-collapsed', on);
  const b = $('filters-collapse');
  b.setAttribute('aria-expanded', String(!on));
  b.title = on ? 'Show the filters' : 'Hide the filters';
  b.firstElementChild.textContent = on ? '»' : '«';
  b.lastElementChild.textContent = on ? 'Show filters' : 'Hide filters';
  try { localStorage.setItem(FILTERS_KEY, on ? '1' : '0'); } catch {}
}
// In the single-problem view the method tags can be hidden so they don't give the solution away (remembered in
// this browser; always on in practice mode). While hidden they come back one step at a time, like hints:
// first the primary method, then the other methods and the classification.
const METHODS_KEY = 'raindrops.methodsHidden';
let reveal = {key: '', level: 0};
function methodsHidden() { try { return localStorage.getItem(METHODS_KEY) === '1'; } catch { return false; } }
function setMethodsHidden(on) {
  try { localStorage.setItem(METHODS_KEY, on ? '1' : '0'); } catch {}
  reveal.level = 0; render();
}
function applyReveal() {
  document.body.classList.toggle('reveal-1', reveal.level >= 1);
  document.body.classList.toggle('reveal-2', reveal.level >= 2);
}
function methodsControls(p) {
  const box = node('span', 'methods-toggle');
  if (!document.body.classList.contains('methods-hidden')) {
    box.append(button(null, 'Hide', () => setMethodsHidden(true), 'Hide the method tags (for this and other problems); bring them back one hint at a time'));
    return box;
  }
  const steps = ['Hint: primary method', 'Hint: other methods', 'Hide again'];
  const b = button(null, steps[reveal.level], () => { reveal.level = (reveal.level + 1) % 3; applyReveal(); render(); },
    ['Show the primary method', 'Show the other methods and the classification', 'Hide the methods again'][reveal.level]);
  b.setAttribute('aria-pressed', String(reveal.level > 0));
  box.append(b);
  if (!practiceId) box.append(button('link-button', 'Always show', () => setMethodsHidden(false), 'Stop hiding the method tags'));
  return box;
}
function setProblemView(on) {
  document.body.classList.toggle('viewing-problem', on);
  $('focus-toggle').hidden = !on;
  if (!on) setFocus(false, true);
}
// Focus mode hides everything except the statement and notes (fade out, then enlarge them in place).
let focusTimer = null;
function setFocus(on, instant = false) {
  const body = document.body, b = $('focus-toggle');
  if (on === body.classList.contains('focus-mode') && !focusTimer) return;
  clearTimeout(focusTimer); focusTimer = null;
  b.setAttribute('aria-pressed', String(on));
  b.textContent = on ? 'Exit focus' : 'Focus';
  b.title = on ? 'Back to the full page (Esc)' : 'Show only the statement and your notes';
  const quick = instant || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (on) {
    body.classList.add('focus-fade');
    const go = () => { focusTimer = null; body.classList.add('focus-mode'); window.scrollTo(0, 0); b.focus({preventScroll: true}); };
    if (quick) go(); else focusTimer = setTimeout(go, 180);
  } else {
    body.classList.remove('focus-mode');
    if (quick) body.classList.remove('focus-fade');
    else requestAnimationFrame(() => requestAnimationFrame(() => body.classList.remove('focus-fade')));
    if (!instant) { $('problem-focus').scrollIntoView({block: 'start'}); b.focus({preventScroll: true}); }
  }
}
function setupProblemView() {
  setFiltersCollapsed(storedCollapsed());
  $('filters-collapse').addEventListener('click', () => setFiltersCollapsed(!document.body.classList.contains('filters-collapsed')));
  $('filters-rail').addEventListener('click', () => setFiltersCollapsed(false));
  $('focus-toggle').addEventListener('click', () => setFocus(!document.body.classList.contains('focus-mode')));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !document.body.classList.contains('focus-mode') || menuProblem || menuBulk || $('coverage-dialog').open || !$('account-menu').hidden) return;
    e.preventDefault(); setFocus(false);
  }, true); // capture: decide before other Escape handlers close their menus
}

async function setupProgress() {
  try {
    const {createProgress} = await import('./progress.mjs?v=20261127-topicsort');
    progress = createProgress({startHref: START_HREF, validKeys: new Set(data.problems.map(p => p.key)), onChange: () => { renderProgress(); render(); notebook?.refresh(); }});
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
    const response = await fetch('./data/catalogue.json', {cache:'no-cache'}); if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    const classifiedCount = data.problems.length;
    try {
      const sources = await loadStatementSources();
      data.problems = withStatementOnlyProblems(data.problems, sources.statements);
    } catch (error) { console.warn('Additional statements unavailable:', error); }
    try {
      const r = await fetch('./data/difficulty.json?v=20261127-mohs', {cache:'no-cache'}); if (!r.ok) throw new Error(`HTTP ${r.status}`);
      data.problems = withDifficulty(data.problems, await r.json());
    } catch (error) { console.warn('MOHS ratings unavailable:', error); data.problems = withDifficulty(data.problems, null); }
    const options = collectionOptions(data.problems, CONTESTS);
    for (const o of options) CONTESTS[o.id] = o.label;
    const contestSelect = $('contest');
    contestSelect.replaceChildren(new Option('All',''), ...options.map(o => new Option(o.label,o.id)));
    tags = new Map(data.taxonomy.map(t => [t.id, t])); filters = readFilters();
    $('tag-total').textContent = data.taxonomy.length;
    $('total-stat').textContent = `${data.problems.length.toLocaleString()} problems (${options.map(o => `${o.label} ${o.count}`).join(', ')})${data.problems.length > classifiedCount ? ` · ${(data.problems.length-classifiedCount).toLocaleString()} awaiting classification` : ''}`;
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
    $('random').addEventListener('click', randomProblem);
    setupTimer();
    $('copy-link').addEventListener('click', e => copyUrl(location.href, e.currentTarget));
    $('coverage-open').addEventListener('click', () => $('coverage-dialog').showModal());
    $('coverage-close').addEventListener('click', () => $('coverage-dialog').close());
    setupGuide();
    readView();
    document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { view = b.dataset.view; currentColl = ''; sharedId = ''; practiceId = ''; if (view === 'collections') { selecting = false; selected.clear(); filters.problem = ''; } closeCollectMenu(); render(); }));
    // (the menu re-renders on each change, so a click inside it can land on a node that is already detached)
    document.addEventListener('click', e => { if ((menuProblem || menuBulk) && e.target.isConnected && !$('collect-menu').contains(e.target)) closeCollectMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && (menuProblem || menuBulk)) closeCollectMenu(); });
    $('select-toggle').addEventListener('click', () => setSelecting(!selecting));
    setupGridDrag();
    setupNotes();
    setupProblemView();
    gridPicker = createGridPicker($('grid-chooser'), options, id => {
      gridContest = id;
      if (filters.contest && filters.contest !== gridContest) update({contest:''}); else render();
    });
    await setupProgress();
    try {
      const {createNotebook} = await import('./notebook.mjs?v=20261127-tabs');
      const keys = new Set(data.problems.map(p => p.key)), byKey = new Map(data.problems.map(p => [p.key, p]));
      notebook = createNotebook({store: progress, has: k => keys.has(k), hrefFor: k => entryUrl(byKey.get(k)), open: k => openProblem(byKey.get(k))});
    } catch (error) { console.error('Notebook unavailable:', error); }
    window.addEventListener('popstate', () => { filters = readFilters(); readView(); page = 1; syncControls(); render(); });
    render();
  } catch (error) {
    $('result-count').textContent = 'Catalogue unavailable'; $('problem-list').setAttribute('aria-busy', 'false');
    const box = node('div', 'empty'); box.append(node('p', null, 'The catalogue data could not be loaded.'), button(null, 'Retry', () => location.reload()));
    $('problem-list').replaceChildren(box); console.error('Catalogue load failed:', error);
  }
}
start();

