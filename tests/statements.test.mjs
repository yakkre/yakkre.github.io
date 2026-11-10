import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const catalogue = read('../problems/data/catalogue.json');
const data = read('../problems/data/statements.json');
test('statement coverage reconciles with catalogue and preserves provenance', () => {
  const keys = Object.keys(data.statements);
  assert.equal(new Set([...keys, ...data.pendingKeys]).size, catalogue.problems.length);
  assert.equal(keys.length + data.pendingKeys.length, catalogue.problems.length);
  for (const [key, statement] of Object.entries(data.statements)) {
    assert.ok(catalogue.problems.some(p => p.key === key));
    assert.equal(new URL(statement.sourceUrl).protocol, 'https:');
    assert.ok(statement.text.trim());
    assert.equal('solution' in statement, false);
    if (statement.kind === 'forum') assert.equal(statement.post, 1);
    else if (statement.kind === 'official') {
      const p = catalogue.problems.find(p => p.key === key);
      assert.equal(statement.sourceYear, p.year);
      assert.equal(statement.sourceProblem, p.id);
      assert.ok(Number.isInteger(statement.sourcePage) && statement.sourcePage > 0);
      const source = new URL(statement.sourceUrl);
      assert.equal(source.hostname, 'www.imo-official.org');
      assert.equal(source.pathname, `/assets/documents/problems/${p.year}/IMO${p.year}SL.pdf`);
      assert.ok(statement.verified);
    }
    else if (statement.kind === 'reference') {
      const p = catalogue.problems.find(p => p.key === key);
      assert.equal(statement.sourceYear, p.year);
      assert.equal(statement.sourceProblem, p.id);
      assert.ok(Number.isInteger(statement.sourcePage) && statement.sourcePage > 0);
      const sources = {2004: 'https://www.imomath.com/imocomp/sl04.pdf',
        2005: 'https://www.imomath.com/imocomp/sl05_0707.pdf'};
      assert.equal(statement.sourceUrl, sources[p.year]);
      assert.match(statement.sourceLabel, /Compendium/);
      assert.ok(statement.verified);
    }
    else {
      assert.equal(statement.kind, 'archive');
      const p = catalogue.problems.find(p => p.key === key);
      assert.ok(p.sourceUrls.includes(statement.sourceUrl));
      assert.equal(new URL(statement.sourceUrl).searchParams.get('offset'), String(statement.archiveRow));
    }
  }
  const sample = data.statements['rmm:2026:4'];
  assert.match(sample.text, /For any positive integer/);
  assert.match(sample.text, /at most \$n\$ distinct prime divisors/);
  assert.match(sample.text, /\\varphi_0/);
  assert.match(sample.sourceUrl, /h3780397/);
});

test('geometry statement supplements have complete verified source metadata', () => {
  const supplements = read('../problems/data/statement-supplements.json').statements;
  for (const [year, count] of [[2008, 7], [2007, 8], [2006, 10], [2005, 7], [2004, 8]]) {
    for (let number = 1; number <= count; number++) {
      const statement = supplements[`isl:${year}:G${number}`];
      assert.ok(statement.text.trim().length > 60);
      assert.equal(statement.sourceYear, year);
      assert.equal(statement.sourceProblem, `G${number}`);
      assert.ok(Number.isInteger(statement.sourcePage) && statement.sourcePage > 0);
      assert.equal(statement.kind, year >= 2006 ? 'official' : 'reference');
      assert.equal(new URL(statement.sourceUrl).protocol, 'https:');
      assert.equal('solution' in statement, false);
      assert.ok(statement.verified);
      assert.equal(statement.text.split('$').length % 2, 1);
    }
  }
  assert.match(supplements['isl:2004:G8'].text, /AN\/BN=AM\/BM/);
  assert.ok(supplements['isl:2008:G5'].text.includes('\\tfrac12(k+1)(k+2)'));
});
