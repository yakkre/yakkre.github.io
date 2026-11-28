export function normalize(text) {
  return String(text ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
export function problemName(problem) {
  const rmmShortlist = problem.contest === 'rmm'
    && (problem.section === 'Shortlist' || /^SL\s+/i.test(String(problem.id)));
  const collection = problem.contest === 'isl' ? 'ISL'
    : problem.contest === 'rmm' ? `RMM${rmmShortlist ? ' SL' : ''}`
    : problem.contest === 'usatst' ? 'USA TST'
    : problem.contest === 'usatstst' ? 'USA TSTST'
    : problem.contest === 'usamo' ? 'USAMO'
    : problem.contestName || problem.contest;
  const displayId = rmmShortlist ? String(problem.id).replace(/^SL\s+/i, '') : problem.id;
  return `${problem.year} ${collection} ${displayId}`;
}
export function validTagIds(ids, taxonomy) {
  const valid = new Set(taxonomy.map(t => t.id));
  return [...new Set(ids.map(Number).filter(id => valid.has(id)))];
}
export function selectProblems(problems, taxonomy, filters = {}) {
  const ids = validTagIds(filters.tags || [], taxonomy);
  const labels = new Map(taxonomy.map(t => [t.id, `${t.id} ${t.label} ${t.definition}`]));
  const words = normalize(filters.query).trim().split(/\s+/).filter(Boolean);
  const mode = filters.mode === 'OR' ? 'OR' : 'AND';
  if (filters.from && filters.to && Number(filters.from) > Number(filters.to)) return [];
  return problems.map((p, index) => {
    const hits = ids.filter(id => p.tags.includes(id)).length;
    return {problem:p, index, hits, primary:(p.primaryTags || [p.primaryTag]).some(id => ids.includes(id))};
  }).filter(({problem:p, hits}) => {
    if (filters.problem && p.key !== filters.problem) return false;
    if (filters.contest && p.contest !== filters.contest) return false;
    if (filters.subject && p.subject !== filters.subject) return false;
    if (filters.evidence && p.forumStatus !== filters.evidence) return false;
    if (filters.difficulty && (filters.difficulty === 'none' ? p.difficulty != null : String(p.difficulty) !== filters.difficulty)) return false;
    if (filters.from && p.year < Number(filters.from)) return false;
    if (filters.to && p.year > Number(filters.to)) return false;
    if (ids.length && (mode === 'AND' ? hits !== ids.length : hits === 0)) return false;
    if (!words.length) return true;
    const haystack = normalize(`${problemName(p)} ${p.contestName} ${p.year} ${p.id} ${p.subject} ${p.explanation} ${p.tags.map(t => labels.get(t)).join(' ')}`);
    return words.every(word => haystack.includes(word));
  }).sort((a,b) => Number(b.primary)-Number(a.primary) || b.hits-a.hits || b.problem.year-a.problem.year || a.index-b.index);
}
// Parses typed method input such as "44, 46" or "44 46". Returns valid distinct IDs,
// or null when the text is not purely a list of numbers.
export function parseTagInput(text, taxonomy) {
  const parts = String(text ?? '').trim().split(/[\s,;]+/).filter(Boolean);
  if (!parts.length || !parts.every(p => /^\d+$/.test(p))) return null;
  return validTagIds(parts, taxonomy);
}


// ---- Difficulty for contests without the ISL position estimate (1 = easiest … 5 = hardest).
// MOHS ratings (Evan Chen) where available; otherwise the problem's place within its day.
export const mohsToDifficulty = m => m <= 10 ? 1 : m <= 20 ? 2 : m <= 30 ? 3 : m <= 40 ? 4 : 5;
const POSITION_LEVEL = [2, 3, 4]; // first, second, third problem of a day
function positionEstimate(p, dayLength) {
  if (!/^\d+$/.test(String(p.id))) return null;
  const n = Number(p.id), slot = (n - 1) % dayLength;
  if (n < 1 || dayLength !== 3) return null;
  return {difficulty: POSITION_LEVEL[slot], difficultyBasis: `Position estimate: problem ${n} is problem ${slot + 1} of 3 on its day; not a judgement of the solution.`};
}
// problems: catalogue rows; mohs: difficulty.json ({ratings: {key: {mohs}}}). Returns new rows; ISL rows are unchanged.
export function withDifficulty(problems, mohs) {
  const ratings = mohs?.ratings || {};
  const perYear = new Map();
  for (const p of problems) { const k = `${p.contest}:${p.year}`; perYear.set(k, (perYear.get(k) || 0) + 1); }
  return problems.map(p => {
    if (p.difficulty != null || p.contest === 'isl') return p;
    const r = ratings[p.key];
    if (r && Number.isFinite(r.mohs)) return {...p, difficulty: mohsToDifficulty(r.mohs), difficultyBasis: `MOHS rating ${r.mohs}M by Evan Chen, mapped to ${mohsToDifficulty(r.mohs)}/5.`};
    if (!['usamo', 'usatst', 'usatstst', 'rmm'].includes(p.contest) || (p.contest === 'rmm' && p.section === 'Shortlist')) return p;
    const est = positionEstimate(p, 3);
    // Only papers laid out as days of three problems (6 or 9 per year).
    return est && [6, 9].includes(perYear.get(`${p.contest}:${p.year}`)) ? {...p, ...est} : p;
  });
}

// ---- "Add by name": turn text like "2019 ISL C6, USAMO 2021/3, TSTST 2019 P4" into catalogue keys.
const CONTEST_WORDS = [[/\b(?:usa\s*)?tstst\b/, 'usatstst'], [/\busa\s*tst\b|\busatst\b|\btst\b/, 'usatst'], [/\busamo\b/, 'usamo'],
  [/\brmm\b/, 'rmm'], [/\bisl\b|\bimo\s*sl\b|\bshortlist\b|\bimo\s*shortlist\b/, 'isl']];
export function parseProblemList(text, problems) {
  const index = new Map(problems.map(p => [`${p.contest}|${p.year}|${normalize(p.id).replace(/\s+/g, '')}`, p.key]));
  const keys = [], missing = [];
  for (const raw of String(text ?? '').split(/[,;\n]+/)) {
    const item = raw.trim(); if (!item) continue;
    let s = normalize(item);
    const contest = CONTEST_WORDS.find(([re]) => re.test(s))?.[1];
    const year = s.match(/\b(19|20)\d\d\b/)?.[0];
    if (!contest || !year) { missing.push(item); continue; }
    for (const [re] of CONTEST_WORDS) s = s.replace(re, ' ');
    s = s.replace(year, ' ').replace(/\b(?:problem|prob|no\.?|p(?=\d))\s*/g, ' ').replace(/[/#.]/g, ' ').trim();
    const id = s.replace(/\s+/g, '');
    const key = index.get(`${contest}|${year}|${id}`) || index.get(`${contest}|${year}|sl${id}`);
    if (key) keys.push(key); else missing.push(item);
  }
  return {keys: [...new Set(keys)], missing};
}

// ---- Collections: "By topic" sort with a section heading per topic.
export const TOPICS = [['A', 'Algebra'], ['C', 'Combinatorics'], ['G', 'Geometry'], ['N', 'Number theory']];
const OTHER_TOPIC = 'Other';
const TOPIC_TITLES = new Set([...TOPICS.map(t => t[1]), OTHER_TOPIC]);
// keys: a collection's keys (problem keys and "§<id>|<title>" sections, see progress.mjs); byKey: key -> problem;
// cmp: the order inside a topic. Returns the new keys: Algebra, Combinatorics, Geometry, Number theory (then
// Other), each after a heading; headings from an earlier topic sort are reused and empty ones dropped.
// Returns null when the collection has sections of its own, since topic headings would mix with them.
export function arrangeByTopic(keys, byKey, cmp, newId = () => Math.random().toString(36).slice(2, 8)) {
  const isSec = k => k.startsWith('§'), title = k => k.slice(k.indexOf('|') + 1);
  const sections = keys.filter(isSec);
  if (sections.some(k => !TOPIC_TITLES.has(title(k)))) return null;
  const old = new Map(sections.map(k => [title(k), k]));
  const names = new Map(TOPICS), groups = new Map([...TOPICS.map(t => [t[1], []]), [OTHER_TOPIC, []]]);
  for (const k of keys) if (!isSec(k)) groups.get(names.get(byKey.get(k)?.subject) ?? OTHER_TOPIC).push(k);
  const out = [];
  for (const [t, list] of groups) {
    if (!list.length) continue;
    const known = list.filter(k => byKey.has(k)).sort((a, b) => cmp(byKey.get(a), byKey.get(b)));
    out.push(old.get(t) ?? `§${newId()}|${t}`, ...known, ...list.filter(k => !byKey.has(k)));
  }
  return out;
}

// ---- Random set (ISL only for now). The level of a problem is its shortlist number (A3 -> 3), the usual
// ISL difficulty scale. `count` problems split evenly over `topics` (letters A/C/G/N; the remainder goes to
// random topics). Inside each topic the levels span [min, max]: exactly one problem at min and one at max,
// the rest from the levels strictly between (repeats allowed). With one problem in a
// topic it gets a random level; when nothing lies between min and max the rest are drawn from the two ends.
// If a level has run out, the nearest level in range that still has problems is used. skip: keys to leave out.
// Returns {keys, missing}: missing counts problems that couldn't be found at all.
// Only ids like A3 / C7 with the topic's letter: older shortlists (1990–1993, 1995, 1997) are numbered without
// topics (P3, 17, UNK-2), so their numbers say nothing about difficulty and they're left out.
export const islNumber = p => { const m = String(p.id).match(/^([ACGN])(\d+)$/); return m && m[1] === p.subject ? Number(m[2]) : null; };
export function randomSet(problems, {count, topics, min, max, skip = new Set()}, rand = Math.random) {
  const pickIndex = n => Math.floor(rand() * n);
  const between = (a, b) => a + pickIndex(b - a + 1);
  const pool = new Map();
  for (const p of problems) {
    if (p.contest !== 'isl' || !topics.includes(p.subject) || skip.has(p.key)) continue;
    const level = islNumber(p); if (!(level >= min && level <= max)) continue;
    const k = `${p.subject}${level}`; if (!pool.has(k)) pool.set(k, []); pool.get(k).push(p.key);
  }
  const counts = new Map(topics.map(t => [t, Math.floor(count / topics.length)]));
  const order = [...topics];
  for (let i = order.length - 1; i > 0; i--) { const j = pickIndex(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  order.slice(0, count % topics.length).forEach(t => counts.set(t, counts.get(t) + 1));
  const keys = []; let missing = 0;
  for (const [t, n] of counts) {
    let levels;
    if (n === 1 || min === max) levels = Array.from({length: n}, () => between(min, max));
    else levels = [min, max, ...Array.from({length: n - 2}, () => max - min > 1 ? between(min + 1, max - 1) : (rand() < .5 ? min : max))];
    for (const d of levels) {
      const near = Array.from({length: max - min + 1}, (_, i) => min + i).sort((a, b) => Math.abs(a - d) - Math.abs(b - d) || rand() - .5);
      const list = near.map(l => pool.get(`${t}${l}`)).find(l => l?.length);
      if (!list) { missing++; continue; }
      keys.push(...list.splice(pickIndex(list.length), 1));
    }
  }
  return {keys, missing};
}
