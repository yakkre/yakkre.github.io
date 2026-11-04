export function normalize(text) {
  return String(text ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
export function problemName(problem) {
  const collection = problem.contest === 'isl' ? 'ISL'
    : problem.contest === 'rmm' ? `RMM${problem.section === 'Shortlist' ? ' SL' : ''}`
    : problem.contestName || problem.contest;
  return `${problem.year} ${collection} ${problem.id}`;
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

