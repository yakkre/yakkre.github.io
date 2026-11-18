import test from 'node:test';
import assert from 'node:assert/strict';
import {withStatementOnlyProblems, collectionOptions, matchingCollections} from '../problems/statement-catalogue.mjs';
import {selectProblems} from '../problems/catalogue-core.mjs';

const source = (year,id) => ({text:'Complete verified problem statement.', kind:'official',
  sourceUrl:'https://example.org/paper.pdf', verified:'2026-11-17', sourceYear:year,sourceProblem:id});
test('ready unclassified statements are usable without fabricating tags or proof checks', () => {
  const existing = {key:'usatst:2026:1',contest:'usatst',contestName:'USA TST',year:2026,id:'1',tags:[10],primaryTag:10};
  const result = withStatementOnlyProblems([existing], {
    'usatst:2026:1':source(2026,'1'), 'usatst:2015:2':source(2015,'2'),
    'rmm:2024:SL A1':source(2024,'SL A1'), 'rmm:2024:1':source(2024,'1'),
    'isl:1994:G2':{...source(1994,'G2'),publicationStatus:'hold'},
    'usatst:2014:1':{...source(2014,'1'),publicationStatus:'hold'},
    'usatst:2013:1':source(2012,'1'), 'usatst:2012:1':{...source(2012,'1'),verified:''},
  });
  assert.equal(result.length,4); assert.strictEqual(result[0],existing);
  const pending = result.filter(p => p.statementOnly);
  assert.equal(pending.length,3);
  for (const p of pending) { assert.deepEqual(p.tags,[]); assert.equal(p.primaryTag,null); assert.equal(p.forumStatus,'pending'); }
  assert.equal(pending.find(p => p.id==='SL A1').section,'Shortlist');
  assert.equal(selectProblems(result,[{id:10,label:'Polynomials'}],{tags:[10]}).length,1);
  assert.equal(selectProblems(result,[],{problem:'usatst:2015:2'})[0].problem.id,'2');
  // Once classification arrives, its exact object takes precedence with no duplicate key.
  const reviewed = {...pending[0],statementOnly:false,tags:[10],primaryTag:10};
  const upgraded = withStatementOnlyProblems([existing,reviewed],{[reviewed.key]:source(reviewed.year,reviewed.id)});
  assert.equal(upgraded.length,2); assert.strictEqual(upgraded[1],reviewed);
});

test('grid choices scale to many collections and search names or abbreviations', () => {
  const problems = Array.from({length:40},(_,i)=>({contest:`c${i}`,contestName:`Contest ${i}`}));
  problems.push({contest:'rmm',contestName:'Romanian Masters of Mathematics'},
    {contest:'usatst',contestName:'USA TST'},{contest:'rmm',contestName:'RMM'});
  const options = collectionOptions(problems,{rmm:'Romanian Masters of Mathematics (RMM)'});
  assert.equal(options.length,42); assert.equal(options.find(o=>o.id==='rmm').count,2);
  assert.deepEqual(matchingCollections(options,'rmm').map(o=>o.id),['rmm']);
  assert.deepEqual(matchingCollections(options,'ROMANIAN mathematics').map(o=>o.id),['rmm']);
  assert.deepEqual(matchingCollections(options,'usa tst').map(o=>o.id),['usatst']);
  assert.equal(matchingCollections(options,'no such collection').length,0);
  assert.equal(matchingCollections(options,'').length,42);
});

test('full TST statement inventory retains historical sessions and source caveats', async () => {
  const fs = await import('node:fs');
  const s = JSON.parse(fs.readFileSync(new URL('../problems/data/statement-supplements.json',import.meta.url))).statements;
  const entries = Object.entries(s).filter(([k])=>k.startsWith('usatst:'));
  assert.equal(entries.length,172);
  const years = [...new Set(entries.map(([k])=>Number(k.split(':')[1])))].sort((a,b)=>a-b);
  assert.deepEqual(years,Array.from({length:27},(_,i)=>2000+i).filter(y=>y!==2022));
  for(const year of [2012,2013]) for(const month of ['Dec','Jan']) for(let n=1;n<=4;n++) {
    const p=s[`usatst:${year}:${month} ${n}`]; assert.ok(p?.text); assert.equal(p.sourceOriginalProblem,String(n));
    assert.match(p.sourceSession,month==='Dec'?/December/:/January/);
  }
  for(const [k,p] of entries){assert.equal(p.sourceYear,Number(k.split(':')[1]));assert.equal(p.sourceProblem,k.split(':').slice(2).join(':'));assert.ok(p.verified && p.sourceSha256);}
  assert.match(s['usatst:2003:4'].sourceCaveat,/domain|positive integers/);
  assert.match(s['usatst:2005:3'].sourceCaveat,/monic/);
});
