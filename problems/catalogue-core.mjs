export function normalize(text) {
  return String(text ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
    return {problem:p, index, hits, primary:ids.includes(p.primaryTag)};
  }).filter(({problem:p, hits}) => {
    if (filters.problem && p.key !== filters.problem) return false;
    if (filters.contest && p.contest !== filters.contest) return false;
    if (filters.subject && p.subject !== filters.subject) return false;
    if (filters.evidence && p.forumStatus !== filters.evidence) return false;
    if (filters.from && p.year < Number(filters.from)) return false;
    if (filters.to && p.year > Number(filters.to)) return false;
    if (ids.length && (mode === 'AND' ? hits !== ids.length : hits === 0)) return false;
    if (!words.length) return true;
    const haystack = normalize(`${p.contestName} ${p.year} ${p.id} ${p.subject} ${p.explanation} ${p.tags.map(t => labels.get(t)).join(' ')}`);
    return words.every(word => haystack.includes(word));
  }).sort((a,b) => Number(b.primary)-Number(a.primary) || b.hits-a.hits || b.problem.year-a.problem.year || a.index-b.index);
}
