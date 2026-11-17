import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNote, noteExcerpt, DEFAULT_HIDE_LABEL} from '../problems/notes-view.mjs';
const text = s => ({type: 'text', text: s});
const hide = (label, ...children) => ({type: 'hide', label, children});

test('a labelled box hides the text between its tags', () => {
  assert.deepEqual(parseNote('[\\hide="Hint"] use induction [\\hide]'), [hide('Hint', text('use induction'))]);
  assert.deepEqual(parseNote('Try it.\n[\\hide="Solution"]\nInduct on $n$.\n[\\hide]\nDone.'),
    [text('Try it.'), hide('Solution', text('Induct on $n$.')), text('Done.')]);
});
test('plain text and math pass through untouched', () => {
  assert.deepEqual(parseNote(''), []);
  assert.deepEqual(parseNote('$$\\sum a_i$$ and \\(x\\)'), [text('$$\\sum a_i$$ and \\(x\\)')]);
  assert.deepEqual(parseNote('[\\hidden] [hide] [\\hide="a'), [text('[\\hidden] [hide] [\\hide="a')]);
});
test('a bare tag opens a default box when none is open, otherwise closes', () => {
  assert.deepEqual(parseNote('a [\\hide] b [\\hide] c'), [text('a'), hide(DEFAULT_HIDE_LABEL, text('b')), text('c')]);
  assert.deepEqual(parseNote('[\\hide=""] b [\\hide]'), [hide(DEFAULT_HIDE_LABEL, text('b'))]);
});
test('boxes nest and an unclosed box runs to the end', () => {
  assert.deepEqual(parseNote('[\\hide="Outer"] x [\\hide="Inner"] y [\\hide] z [\\hide] w'),
    [hide('Outer', text('x'), hide('Inner', text('y')), text('z')), text('w')]);
  assert.deepEqual(parseNote('before [\\hide="Open"] rest'), [text('before'), hide('Open', text('rest'))]);
});
test('blank lines written by the reader are kept, box lines are not doubled', () => {
  assert.deepEqual(parseNote('p1\n\n[\\hide="S"]\nhidden\n[\\hide]\n\np2'), [text('p1\n'), hide('S', text('hidden')), text('\np2')]);
});
test('excerpts never leak hidden text', () => {
  assert.equal(noteExcerpt('Key idea: [\\hide="Solution"] the answer is 42 [\\hide]\nthen finish'), 'Key idea: [Solution] then finish');
  assert.equal(noteExcerpt('x'.repeat(200)).length, 161);
});

import {parseLatexText, parseInline, itemLabel} from '../problems/notes-view.mjs';
const list = (kind, label, ...items) => ({type: 'list', kind, label, items});
const item = (label, ...parts) => ({label, parts});
test('enumerate and itemize become lists, nested lists stay inside their item', () => {
  const t = 'Plan:\n\\begin{enumerate}\n  \\item First $x$.\n  \\item Then\n    \\begin{itemize}\n      \\item a\n      \\item[$\\star$] b\n    \\end{itemize}\n\\end{enumerate}\nDone.';
  assert.deepEqual(parseLatexText(t), [text('Plan:'),
    list('enumerate', null, item(null, text('First $x$.')), item(null, text('Then'), list('itemize', null, item(null, text('a')), item('$\\star$', text('b'))))),
    text('Done.')]);
});
test('list commands inside math are left for MathJax, and stray \\item or \\end stay as text', () => {
  assert.deepEqual(parseLatexText('$\\begin{itemize}$ and $$\\item$$'), [text('$\\begin{itemize}$ and $$\\item$$')]);
  assert.deepEqual(parseLatexText('a \\item b \\end{enumerate}'), [text('a \\item b \\end{enumerate}')]);
  assert.deepEqual(parseLatexText('\\begin{enumerate}[(a)]\\item x'), [list('enumerate', '(a)', item(null, text('x')))]);
});
test('enumerate labels follow depth or the given label', () => {
  const e = {kind: 'enumerate'};
  assert.deepEqual([0, 1].map(i => itemLabel(e, i, 0)), ['1.', '2.']);
  assert.equal(itemLabel(e, 1, 1), '(b)');
  assert.equal(itemLabel(e, 3, 2), 'iv.');
  assert.equal(itemLabel({kind: 'enumerate', label: '(a)'}, 26, 0), '(aa)');
  assert.equal(itemLabel({kind: 'enumerate', label: 'label=(\\roman*)'}, 2, 0), '(iii)');
  assert.equal(itemLabel({kind: 'itemize'}, 0, 1), '–');
});
test('text formatting nests and skips math', () => {
  assert.deepEqual(parseInline('a \\textbf{b \\emph{c}} $\\textbf{x}$'), [text('a '),
    {type: 'fmt', tag: 'strong', parts: [text('b '), {type: 'fmt', tag: 'em', parts: [text('c')]}]}, text(' $\\textbf{x}$')]);
  assert.deepEqual(parseInline('\\textbf{open'), [text('\\textbf{open')]);
});
