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

// Builds the note inside parent: text nodes, and a <details> box for each hidden part.
export function renderNote(parent, parts) {
  for (const part of parts) {
    if (part.type === 'text') { parent.append(document.createTextNode(part.text)); continue; }
    const box = document.createElement('details'), summary = document.createElement('summary'), body = document.createElement('div');
    box.className = 'note-hide'; summary.textContent = part.label; body.className = 'note-hide-body';
    renderNote(body, part.children);
    box.append(summary, body); parent.append(box);
  }
}

// Short plain-text version for menus: hidden parts show only their label, never their text.
export function noteExcerpt(text, max = 160) {
  const flat = parts => parts.map(p => p.type === 'text' ? p.text : ` [${p.label}] `).join('');
  const s = flat(parseNote(text)).replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s;
}
