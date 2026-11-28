// Reader-note markup. [\hide="Label"] … [\hide] hides the text in a box that opens on click.
// A bare [\hide] closes the open box, or opens one with the default label when none is open. Boxes nest.
// Spaces and one newline directly before an opening tag and after a closing tag are dropped, and the hidden
// text is trimmed, so a box written inline or on its own lines does not add stray spaces or blank lines.
const TAG = /\[\\hide(?:="([^"\n]*)")?\]/g;
export const DEFAULT_HIDE_LABEL = 'Hidden';

// Returns a tree of {type:'text', text} and {type:'hide', label, children} parts.
export function parseNote(text) {
  text = String(text ?? '');
  const root = {children: []}, stack = [root];
  const push = s => { if (s) stack.at(-1).children.push({type: 'text', text: s}); };
  let position = 0;
  for (const match of text.matchAll(TAG)) {
    const label = match[1], opens = label != null || stack.length === 1;
    let before = text.slice(position, match.index);
    position = match.index + match[0].length;
    if (opens) {
      push(before.replace(/[ \t]*\n?$/, ''));
      const box = {type: 'hide', label: label?.trim() || DEFAULT_HIDE_LABEL, children: []};
      stack.at(-1).children.push(box); stack.push(box);
      position += /^\s*/.exec(text.slice(position))[0].length;
    } else {
      push(before.replace(/\s+$/, ''));
      stack.pop();
      position += /^[ \t]*\n?/.exec(text.slice(position))[0].length;
    }
  }
  push(text.slice(position));
  return root.children;
}

// ---- Text-mode LaTeX inside notes: lists (enumerate, itemize, description, with \item and \item[label]) and
// \textbf, \textit, \emph, \underline, \texttt. Math ($…$, $$…$$, \(…\), \[…\]) is left for MathJax untouched, so math
// environments such as align*, cases or pmatrix keep working inside math as before.
const MATH = /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?:\\.|[^$\\])+?\$/g;
const LIST_TOKEN = /\\begin\{(enumerate|itemize|description)\}(?:\[([^\]\n]*)\])?|\\end\{(enumerate|itemize|description)\}|\\item\b(?:\s*\[([^\]\n]*)\])?/g;
const INLINE = {textbf: 'strong', textit: 'em', emph: 'em', underline: 'u', texttt: 'code'};

// Positions inside math spans, which list and formatting commands must ignore.
function mathRanges(text) { return [...text.matchAll(MATH)].map(m => [m.index, m.index + m[0].length]); }
const inRanges = (ranges, i) => ranges.some(([a, b]) => i >= a && i < b);

// Returns [{type:'text', text}, {type:'list', kind, label, items:[{label, parts}]}], lists nested inside items.
export function parseLatexText(text) {
  text = String(text ?? '');
  const ranges = mathRanges(text), root = {parts: []}, stack = [root];
  const current = () => { const top = stack.at(-1); return top.items ? top.items.at(-1) : top; };
  const pushText = s => {
    const at = current(), last = at?.parts.at(-1);
    if (!s || !at) return; // text between \begin{…} and the first \item is dropped, as in LaTeX
    if (last?.type === 'text') last.text += s; else at.parts.push({type: 'text', text: s});
  };
  let position = 0;
  for (const m of text.matchAll(LIST_TOKEN)) {
    if (inRanges(ranges, m.index)) continue;
    const before = text.slice(position, m.index), top = stack.at(-1);
    if (m[1]) { // \begin{…}
      pushText(before.replace(/\s+$/, ''));
      const list = {type: 'list', kind: m[1], label: m[2] ?? null, items: []};
      (current() || root).parts.push(list); stack.push(list);
    } else if (m[3]) { // \end{…}
      if (!top.items) { pushText(before + m[0]); position = m.index + m[0].length; continue; }
      pushText(before.replace(/\s+$/, ''));
      stack.pop();
      position = m.index + m[0].length + /^[ \t]*\n?/.exec(text.slice(m.index + m[0].length))[0].length;
      continue;
    } else { // \item
      if (!top.items) { pushText(before + m[0]); position = m.index + m[0].length; continue; }
      pushText(before.replace(/\s+$/, ''));
      top.items.push({label: m[4] ?? null, parts: []});
    }
    position = m.index + m[0].length;
    position += /^\s*/.exec(text.slice(position))[0].length;
  }
  pushText(text.slice(position));
  return root.parts;
}

// Splits text into [{type:'text', text}, {type:'fmt', tag, parts}] for \textbf{…} and friends (braces may nest).
export function parseInline(text) {
  text = String(text ?? '');
  const ranges = mathRanges(text), out = [], re = /\\(textbf|textit|emph|underline|texttt)\s*\{/g;
  let position = 0, m;
  while ((m = re.exec(text))) {
    if (inRanges(ranges, m.index)) continue;
    let depth = 1, i = m.index + m[0].length;
    for (; i < text.length && depth; i++) { if (text[i] === '\\') { i++; continue; } if (text[i] === '{') depth++; else if (text[i] === '}') depth--; }
    if (depth) break; // unclosed: leave the rest as text
    if (m.index > position) out.push({type: 'text', text: text.slice(position, m.index)});
    out.push({type: 'fmt', tag: INLINE[m[1]], parts: parseInline(text.slice(m.index + m[0].length, i - 1))});
    position = re.lastIndex = i;
  }
  if (position < text.length) out.push({type: 'text', text: text.slice(position)});
  return out;
}

// Labels: enumerate counts 1. / (a) / i. / A. by depth unless the list gives its own label, e.g. \begin{enumerate}[(a)]
// or [label=(\roman*)]; itemize uses • – ∗ by depth; \item[x] always wins.
const ROMAN = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
function roman(n) { let s = ''; for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; } return s; }
function alpha(n) { let s = ''; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }
const COUNTERS = {'1': n => String(n), a: alpha, A: n => alpha(n).toUpperCase(), i: roman, I: n => roman(n).toUpperCase()};
const DEPTH_TEMPLATES = ['1.', '(a)', 'i.', 'A.'];
export function itemLabel(list, index, depth) {
  if (list.kind === 'itemize') return ['•', '–', '∗', '·'][depth % 4];
  if (list.kind === 'description') return '';
  let t = list.label?.trim();
  if (t) t = t.replace(/^label\s*=\s*/, '').replace(/\\arabic\*/, '1').replace(/\\alph\*/, 'a').replace(/\\Alph\*/, 'A').replace(/\\roman\*/, 'i').replace(/\\Roman\*/, 'I');
  if (!t || !/[1aAiI]/.test(t)) t = DEPTH_TEMPLATES[depth % 4];
  // the first counter character in the template is replaced by the item's number in that style
  return t.replace(/[1aAiI]/, c => COUNTERS[c](index + 1));
}

// Builds the note inside parent: text (with lists and formatting), and a <details> box for each hidden part.
// renderText(parent, string) appends plain text; callers can pass one that links problem names.
const plain = (parent, text) => parent.append(document.createTextNode(text));
export function renderNote(parent, parts, renderText = plain) {
  for (const part of parts) {
    if (part.type === 'text') { renderLatexText(parent, part.text, renderText); continue; }
    const box = document.createElement('details'), summary = document.createElement('summary'), body = document.createElement('div');
    box.className = 'note-hide'; summary.textContent = part.label; body.className = 'note-hide-body';
    renderNote(body, part.children, renderText);
    box.append(summary, body); parent.append(box);
  }
}
function renderLatexText(parent, text, renderText, depth = 0) {
  for (const part of parseLatexText(text)) {
    if (part.type === 'text') { renderInline(parent, part.text, renderText); continue; }
    renderList(parent, part, renderText, depth);
  }
}
function renderList(parent, list, renderText, depth) {
  const el = document.createElement(list.kind === 'itemize' ? 'ul' : list.kind === 'description' ? 'dl' : 'ol');
  el.className = `note-list note-${list.kind}`;
  list.items.forEach((item, i) => {
    const li = document.createElement('li'), label = document.createElement('span'), body = document.createElement('div');
    label.className = 'note-label'; body.className = 'note-item';
    const custom = item.label != null;
    label.textContent = custom ? item.label : itemLabel(list, i, depth);
    if (custom || list.kind === 'description') label.classList.add('note-label-custom');
    for (const p of item.parts) {
      if (p.type === 'text') renderInline(body, p.text, renderText);
      else renderList(body, p, renderText, depth + 1);
    }
    li.append(label, body); el.append(li);
  });
  parent.append(el);
}
function renderInline(parent, text, renderText) { renderInlineParts(parent, parseInline(text), renderText); }
function renderInlineParts(parent, parts, renderText) {
  for (const p of parts) {
    if (p.type === 'text') { renderText(parent, p.text); continue; }
    const el = document.createElement(p.tag); renderInlineParts(el, p.parts, renderText); parent.append(el);
  }
}

// Short plain-text version for menus: hidden parts show only their label, never their text.
export function noteExcerpt(text, max = 160) {
  const flat = parts => parts.map(p => p.type === 'text' ? p.text : ` [${p.label}] `).join('');
  const s = flat(parseNote(text)).replace(/\\(?:begin|end)\{(?:enumerate|itemize|description)\}(?:\[[^\]\n]*\])?|\\item\b(?:\s*\[[^\]\n]*\])?/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s;
}
