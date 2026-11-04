import {normalize, parseTagInput, selectProblems, validTagIds, problemName} from './catalogue-core.mjs?v=20261104-geometry';
import {renderStatement} from './statement-view.mjs?v=20261103-proposers';

const $ = id => document.getElementById(id);
const PAGE_SIZE = 50;
const SUBJECTS = {A:'Algebra', C:'Combinatorics', N:'Number theory', G:'Geometry'};
const STATUS = {live:'Live forum checked', archive:'Archived forum checked', pending:'Forum check pending'};
const CONTESTS = {isl:'IMO Shortlist', rmm:'RMM'};
const FIELDS = [['search','query'],['contest','contest'],['subject','subject'],['evidence','evidence'],['difficulty','difficulty'],['from-year','from'],['to-year','to']];
let data, tags, filters, page = 1;

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
const emptyFilters = () => ({query:'', contest:'', subject:'', from:'', to:'', evidence:'', difficulty:'', tags:[], mode:'AND', problem:''});

function readFilters() {
  const q = new URLSearchParams(location.search);
  return {query:q.get('q')||'', contest:['isl','rmm'].includes(q.get('contest'))?q.get('contest'):'',
    subject:Object.hasOwn(SUBJECTS,q.get('subject'))?q.get('subject'):'',
    evidence:['live','archive','pending'].includes(q.get('evidence'))?q.get('evidence'):'',
    difficulty:['1','2','3','4','5','none'].includes(q.get('difficulty'))?q.get('difficulty'):'',
    from:q.get('from')||'', to:q.get('to')||'', mode:q.get('mode')==='OR'?'OR':'AND',
    tags:validTagIds((q.get('tags')||'').split(','), data.taxonomy),
    problem:data.problems.some(p=>p.key===q.get('problem'))?q.get('problem'):''};
}
function searchUrl(override={}) {
  const f = {...filters, ...override}, q = new URLSearchParams();
  for (const [key,val] of Object.entries({q:f.query, contest:f.contest, subject:f.subject, evidence:f.evidence, difficulty:f.difficulty, from:f.from, to:f.to, problem:f.problem})) if (val) q.set(key, val);
  if (f.tags.length) q.set('tags', f.tags.join(','));
  if (f.mode === 'OR') q.set('mode', 'OR');
  return location.pathname + (q.size ? '?' + q : '');
}
const entryUrl = p => searchUrl({...emptyFilters(), problem:p.key});

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
  head.append(link, node('span', 'sub', `${CONTESTS[p.contest] || p.contestName}${p.section && p.section !== 'Shortlist' ? ` ${p.section}` : ''} · ${SUBJECTS[p.subject] || p.subject}`));
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
  history.replaceState(null, '', searchUrl()); renderTags(); renderActive();
  const warning = filters.from && filters.to && Number(filters.from) > Number(filters.to);
  $('filter-warning').hidden = !warning;
  $('filter-warning').textContent = warning ? '“From” year is later than “To” year.' : '';
  const results = selectProblems(data.problems, data.taxonomy, filters), total = results.length;
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
    pagination.append(prev, node('span', null, `Page ${page} of ${pages}`), next);
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
    window.addEventListener('popstate', () => { filters = readFilters(); page = 1; syncControls(); render(); });
    render();
  } catch (error) {
    $('result-count').textContent = 'Catalogue unavailable'; $('problem-list').setAttribute('aria-busy', 'false');
    const box = node('div', 'empty'); box.append(node('p', null, 'The catalogue data could not be loaded.'), button(null, 'Retry', () => location.reload()));
    $('problem-list').replaceChildren(box); console.error('Catalogue load failed:', error);
  }
}
start();

