// Pure helpers for the floating notebook: tab records, ordering, sign-in migration and problem-name links.
// A tab is {id, title, text, order, updated}. Limits must match firestore.rules (progress/{uid}/notebook/{tabId}).
export const MAX_TABS = 50, MAX_TITLE = 60, MAX_TEXT = 50000;
export const DEFAULT_TITLE = 'Untitled';

export const newTabId = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function cleanTab(t) {
  if (!t || typeof t.id !== 'string' || !/^[\w-]{1,40}$/.test(t.id)) return null;
  const title = typeof t.title === 'string' && t.title.trim() ? t.title.trim().slice(0, MAX_TITLE) : DEFAULT_TITLE;
  return {id: t.id, title, text: typeof t.text === 'string' ? t.text.slice(0, MAX_TEXT) : '',
    order: Number.isFinite(Number(t.order)) ? Number(t.order) : 0, updated: Number(t.updated) || 0};
}
// Valid, de-duplicated tabs in display order (by order, then oldest id first).
export function cleanTabs(list) {
  const seen = new Set(), out = [];
  for (const t of Array.isArray(list) ? list : []) {
    const c = cleanTab(t);
    if (c && !seen.has(c.id)) { seen.add(c.id); out.push(c); }
  }
  return out.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, MAX_TABS);
}
// Moves tab `id` to position `index` (0-based) and renumbers every tab 0..n-1. Returns the changed tabs.
export function moveTab(tabs, id, index) {
  const list = cleanTabs(tabs), from = list.findIndex(t => t.id === id);
  if (from < 0) return {tabs: list, changed: []};
  const [tab] = list.splice(from, 1);
  list.splice(Math.max(0, Math.min(list.length, index)), 0, tab);
  const changed = [];
  list.forEach((t, i) => { if (t.order !== i) { t.order = i; changed.push(t); } });
  return {tabs: list, changed};
}
// Order value for a new tab at the end.
export const nextOrder = tabs => tabs.reduce((m, t) => Math.max(m, t.order + 1), 0);

// On sign-in: tabs kept in this browser are added to the account's tabs (after them, keeping their own order).
// Returns the tabs to upload. A local tab whose id already exists in the account is skipped.
export function tabsToMigrate(remote, local) {
  const have = new Set(remote.map(t => t.id)), room = MAX_TABS - remote.length;
  let order = nextOrder(remote);
  return cleanTabs(local).filter(t => !have.has(t.id) && (t.text.trim() || t.title !== DEFAULT_TITLE)).slice(0, Math.max(0, room))
    .map(t => ({...t, order: order++}));
}

// ---- Problem names in viewing mode
// Recognised forms (case-insensitive): "2019 C6", "2019 ISL C6", "ISL 2019 C6", "1993 ISL CAN2", "ISL 1990 5",
// "RMM 2017/6", "RMM 2017 #6", "RMM 2017 P6", "2017 RMM 6", "USA TST 2026/5", "2026 USA TST 5", "TST 2026 #5",
// "USA TSTST 2025/9", "TSTST 2025 #9", "2025 TSTST 9", "USAMO 2025/6", "USAMO 2025 #6", "2025 USAMO 6".
// A match becomes a link only if the problem exists.
const NAME = new RegExp([
  String.raw`\b(?<y1>(?:19|20)\d\d)\s+(?:ISL\s+)?(?<s1>[ACGNPS]\d{1,2})\b`,
  String.raw`\bISL\s+(?<y2>(?:19|20)\d\d)\s+(?<s2>[A-Z]{0,3}-?\d{1,2})\b`,
  String.raw`\b(?<y3>(?:19|20)\d\d)\s+ISL\s+(?<s3>[A-Z]{0,3}-?\d{1,2})\b`,
  String.raw`\bRMM\s+(?<y4>(?:19|20)\d\d)\s*(?:\/|#|P|problem\s+)?\s*(?<s4>\d)\b`,
  String.raw`\b(?<y5>(?:19|20)\d\d)\s+RMM\s*(?:\/|#|P|problem\s+)?\s*(?<s5>\d)\b`,
  String.raw`\b(?:USA\s+)?TST\s+(?<y6>(?:19|20)\d\d)\s*(?:\/|#|P|problem\s+)?\s*(?<s6>\d)\b`,
  String.raw`\b(?<y7>(?:19|20)\d\d)\s+(?:USA\s+)?TST\s*(?:\/|#|P|problem\s+)?\s*(?<s7>\d)\b`,
  String.raw`\b(?:USA\s+)?TSTST\s+(?<y8>(?:19|20)\d\d)\s*(?:\/|#|P|problem\s+)?\s*(?<s8>\d)\b`,
  String.raw`\b(?<y9>(?:19|20)\d\d)\s+(?:USA\s+)?TSTST\s*(?:\/|#|P|problem\s+)?\s*(?<s9>\d)\b`,
  String.raw`\bUSAMO\s+(?<y10>(?:19|20)\d\d)\s*(?:\/|#|P|problem\s+)?\s*(?<s10>\d)\b`,
  String.raw`\b(?<y11>(?:19|20)\d\d)\s+USAMO\s*(?:\/|#|P|problem\s+)?\s*(?<s11>\d)\b`,
].join('|'), 'gi');
// Math spans ($$…$$, $…$, \[…\], \(…\)) are left alone so links never split a formula.
const MATH = /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?:\\.|[^$\\])+?\$/g;

function candidates(m) {
  const g = m.groups;
  if (g.y1) return [`isl:${g.y1}:${g.s1.toUpperCase()}`];
  if (g.y2 || g.y3) return [`isl:${g.y2 || g.y3}:${(g.s2 || g.s3).toUpperCase()}`];
  if (g.y6 || g.y7) return [`usatst:${g.y6 || g.y7}:${g.s6 || g.s7}`];
  if (g.y8 || g.y9) return [`usatstst:${g.y8 || g.y9}:${g.s8 || g.s9}`];
  if (g.y10 || g.y11) return [`usamo:${g.y10 || g.y11}:${g.s10 || g.s11}`];
  return [`rmm:${g.y4 || g.y5}:${g.s4 || g.s5}`];
}
function linkPlain(text, has, out) {
  let position = 0;
  for (const m of text.matchAll(NAME)) {
    const key = candidates(m).find(has);
    if (!key) continue;
    if (m.index > position) out.push({type: 'text', text: text.slice(position, m.index)});
    out.push({type: 'link', key, text: m[0]});
    position = m.index + m[0].length;
  }
  if (position < text.length) out.push({type: 'text', text: text.slice(position)});
}
// Splits text into [{type:'text', text}, {type:'link', key, text}] parts. has(key) says whether a problem exists.
export function linkProblems(text, has) {
  text = String(text ?? '');
  const out = [];
  let position = 0;
  for (const m of text.matchAll(MATH)) {
    linkPlain(text.slice(position, m.index), has, out);
    out.push({type: 'text', text: m[0]});
    position = m.index + m[0].length;
  }
  linkPlain(text.slice(position), has, out);
  // Merge neighbouring text parts.
  return out.reduce((acc, p) => {
    const last = acc.at(-1);
    if (p.type === 'text' && last?.type === 'text') last.text += p.text; else if (p.text) acc.push({...p});
    return acc;
  }, []);
}

// Tabs kept in this browser (signed out, or when sign-in is unavailable).
export const NOTEBOOK_KEY = 'raindrops-notebook-v1';
export function readLocalTabs() {
  try { return cleanTabs(JSON.parse(localStorage.getItem(NOTEBOOK_KEY) || '[]')); } catch { return []; }
}
export function writeLocalTabs(tabs) {
  try { localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(cleanTabs(tabs))); return true; } catch { return false; }
}
export function clearLocalTabs() { try { localStorage.removeItem(NOTEBOOK_KEY); } catch { /* ignore */ } }
