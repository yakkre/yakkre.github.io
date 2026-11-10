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
      const compiled = 'https://drive.google.com/file/d/0B2qYu535vGeQMFNKNlJoREM2YUU/view';
      const sources = {1998: compiled, 1999: compiled, 2000: compiled,
        2001: 'https://www.imomath.com/imocomp/sl01.pdf',
        2002: 'https://www.imomath.com/imocomp/sl02.pdf',
        2003: 'https://www.imomath.com/imocomp/sl03.pdf',
        2004: 'https://www.imomath.com/imocomp/sl04.pdf',
        2005: 'https://www.imomath.com/imocomp/sl05_0707.pdf'};
      assert.equal(statement.sourceUrl, sources[p.year]);
      assert.match(statement.sourceLabel, /Compendium|reproduction/);
      assert.ok(statement.verified);
    }
    else {
      assert.equal(statement.kind, 'archive');
      const p = catalogue.problems.find(p => p.key === key);
      const matchedG8Archive = key === 'isl:1999:G8' && statement.archiveRow === 25368
        && statement.sourceYear === 1999 && statement.sourceProblem === 'G8'
        && statement.archivePath === 'Contest Collections/International Contests/IMO Shortlist/1999 IMO Shortlist/19777.json'
        && statement.verified === '2026-11-10';
      assert.ok(p.sourceUrls.includes(statement.sourceUrl) || matchedG8Archive);
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

test('2003–1998 geometry supplements retain exact inventories and the source hold', () => {
  const supplements = read('../problems/data/statement-supplements.json').statements;
  for (const [year, count] of [[2003, 7], [2002, 8], [2001, 8], [2000, 8], [1999, 8], [1998, 8]]) {
    for (let number = 1; number <= count; number++) {
      const key = `isl:${year}:G${number}`;
      const statement = supplements[key];
      assert.ok(statement.text.trim().length > 60);
      assert.equal(statement.sourceYear, year);
      assert.equal(statement.sourceProblem, `G${number}`);
      assert.ok(statement.verified);
      assert.equal('solution' in statement, false);
      assert.equal(statement.text.split('$').length % 2, 1);
      if (key !== 'isl:1999:G8') assert.ok(Number.isInteger(statement.sourcePage) && statement.sourcePage > 0);
    }
  }
  assert.equal(supplements['isl:1999:G4'].publicationStatus, 'hold');
  assert.ok(supplements['isl:1999:G4'].sourceCaveat.includes('AX/AB'));
  assert.ok(supplements['isl:1999:G4'].text.includes('AX/XB=4/5'));
  assert.ok(supplements['isl:2000:G6'].text.includes('not parallel'));
  assert.equal(supplements['isl:1999:G8'].archiveRow, 25368);
  assert.equal(data.statements['isl:1999:G4'], undefined);
});
