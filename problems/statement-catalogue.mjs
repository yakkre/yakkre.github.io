// Verified statements can be browsed before their solution methods are classified.
// The reviewed catalogue remains authoritative whenever the same key arrives later.
export function withStatementOnlyProblems(problems, statements, contests = ['usatst', 'rmm']) {
  const keys = new Set(problems.map(p => p.key));
  const added = [];
  for (const [key, s] of Object.entries(statements || {})) {
    const [contest, rawYear, ...parts] = key.split(':');
    const year = Number(rawYear), id = parts.join(':');
    if (keys.has(key) || !contests.includes(contest) || !Number.isInteger(year)
      || !id || s.publicationStatus === 'hold' || !s.text?.trim() || !s.sourceUrl
      || (!s.verified && !s.retrieved)) continue;
    if (s.sourceYear != null && s.sourceYear !== year) continue;
    if (s.sourceProblem != null && String(s.sourceProblem) !== id) continue;
    let url;
    try { url = new URL(s.sourceUrl); } catch { continue; }
    if (url.protocol !== 'https:') continue;
    added.push({key, contest, contestName:{usatst:'USA TST', usatstst:'USA TSTST', usamo:'USAMO'}[contest] || 'RMM', year, id,
      section:id.startsWith('SL ') ? 'Shortlist' : 'Contest', subject:'',
      statementOnly:true, primaryTag:null, tags:[], explanation:'Classification pending.',
      aopsUrl:url.hostname === 'artofproblemsolving.com' || url.hostname.endsWith('.artofproblemsolving.com') ? s.sourceUrl : null,
      officialUrl:s.kind === 'official' ? s.sourceUrl : null, sourceUrls:[s.sourceUrl],
      evidence:'Statement collected; solution and method review pending',
      notes:s.sourceCaveat || s.sourceLabel || 'Verified statement source; no classification or proof review claimed.',
      confidence:'', forumStatus:'pending'});
  }
  return [...problems, ...added.sort((a,b) => b.year-a.year || a.contest.localeCompare(b.contest)
    || a.id.localeCompare(b.id, undefined, {numeric:true}))];
}

export function collectionOptions(problems, names = {}) {
  const options = new Map();
  for (const p of problems) {
    if (!options.has(p.contest)) options.set(p.contest, {id:p.contest,
      label:names[p.contest] || p.contestName || p.contest, count:0});
    options.get(p.contest).count++;
  }
  return [...options.values()];
}

export function matchingCollections(options, query) {
  const clean = s => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const words = clean(query).trim().split(/\s+/).filter(Boolean);
  return options.filter(o => words.every(w => clean(`${o.id} ${o.label}`).includes(w)));
}
