import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanTabs, moveTab, nextOrder, tabsToMigrate, linkProblems, DEFAULT_TITLE, MAX_TABS} from '../problems/notebook-core.mjs';

const tab = (id, order, extra = {}) => ({id, title: id.toUpperCase(), text: 'x', order, updated: 1, ...extra});
const keys = new Set(['isl:2019:C6', 'isl:2001:G4', 'isl:1993:CAN2', 'isl:1990:5', 'isl:1997:P16', 'rmm:2017:6', 'usatst:2026:5', 'usatst:2025:5', 'usatstst:2025:5']);
const has = k => keys.has(k);

test('tabs are cleaned, de-duplicated and sorted by order', () => {
  const out = cleanTabs([tab('b', 2), tab('a', 1), tab('a', 0), {id: 'bad id!'}, null, {id: 'c', title: '  ', order: 'x'}]);
  assert.deepEqual(out.map(t => t.id), ['c', 'a', 'b']);
  assert.equal(out[0].title, DEFAULT_TITLE);
  assert.equal(cleanTabs(Array.from({length: 80}, (_, i) => tab('t' + i, i))).length, MAX_TABS);
});
test('moving a tab renumbers the order and reports only changed tabs', () => {
  const {tabs, changed} = moveTab([tab('a', 0), tab('b', 1), tab('c', 2)], 'c', 0);
  assert.deepEqual(tabs.map(t => [t.id, t.order]), [['c', 0], ['a', 1], ['b', 2]]);
  assert.deepEqual(changed.map(t => t.id).sort(), ['a', 'b', 'c']);
  assert.deepEqual(moveTab([tab('a', 0), tab('b', 1)], 'b', 5).changed, []);
  assert.deepEqual(moveTab([tab('a', 0)], 'zz', 0).changed, []);
  assert.equal(nextOrder([tab('a', 0), tab('b', 7)]), 8);
});
test('local tabs are appended to the account on sign-in, skipping existing ids and empty tabs', () => {
  const remote = [tab('a', 0), tab('b', 1)];
  const local = [tab('a', 0), tab('l1', 5), {id: 'empty', title: '', text: '  ', order: 6}, tab('l2', 9)];
  assert.deepEqual(tabsToMigrate(remote, local).map(t => [t.id, t.order]), [['l1', 2], ['l2', 3]]);
});
test('problem names become links only when the problem exists', () => {
  assert.deepEqual(linkProblems('See 2019 C6 and 2019 C9.', has),
    [{type: 'text', text: 'See '}, {type: 'link', key: 'isl:2019:C6', text: '2019 C6'}, {type: 'text', text: ' and 2019 C9.'}]);
  const linked = s => linkProblems(s, has).filter(p => p.type === 'link').map(p => p.key);
  assert.deepEqual(linked('2001 ISL G4, ISL 1990 5, 1993 ISL CAN2, 1997 P16'), ['isl:2001:G4', 'isl:1990:5', 'isl:1993:CAN2', 'isl:1997:P16']);
  assert.deepEqual(linked('RMM 2017/6 · rmm 2017 #6 · 2017 RMM 6 · RMM 2017 P6'), ['rmm:2017:6', 'rmm:2017:6', 'rmm:2017:6', 'rmm:2017:6']);
  assert.deepEqual(linked('USA TST 2026/5 · TST 2026 #5 · 2026 USA TST 5 · usa tst 2026 P5'), ['usatst:2026:5', 'usatst:2026:5', 'usatst:2026:5', 'usatst:2026:5']);
  assert.deepEqual(linked('USA TSTST 2025/5 · TSTST 2025 #5 · 2025 TSTST 5 · 2025 USA TSTST P5 · TST 2025 #5'), ['usatstst:2025:5', 'usatstst:2025:5', 'usatstst:2025:5', 'usatstst:2025:5', 'usatst:2025:5']);
  assert.deepEqual(linked('12019 C6 and 2019 C67 and year 2019'), []);
});
test('math is never split by a link', () => {
  const parts = linkProblems('$2019 C6$ vs 2019 C6 and $$x$$ \\(2001 G4\\)', has);
  assert.deepEqual(parts.map(p => p.type), ['text', 'link', 'text']);
  assert.equal(parts[0].text, '$2019 C6$ vs ');
  assert.equal(parts[2].text, ' and $$x$$ \\(2001 G4\\)');
});
