import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectProblems,validTagIds,problemName} from '../problems/catalogue-core.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../problems/data/catalogue.json',import.meta.url)));
const {problems,taxonomy}=data;
test('problem names distinguish collections and original contest versus shortlist IDs',()=>{
  assert.equal(problemName({year:2025,contest:'isl',id:'A6',section:'Shortlist'}),'2025 ISL A6');
  assert.equal(problemName({year:2026,contest:'rmm',id:'4',section:'Contest'}),'2026 RMM 4');
  assert.equal(problemName({year:2026,contest:'rmm',id:'A6',section:'Shortlist'}),'2026 RMM SL A6');
  assert.ok(selectProblems(problems,taxonomy,{query:'2025 ISL A6'}).some(x=>x.problem.key==='isl:2025:A6'));
});
test('export preserves complete reviewed keys, exact taxonomy and source caveats',()=>{
  assert.equal(new Set(problems.map(p=>p.key)).size,problems.length);
  for(const snapshot of data.snapshots)assert.equal(problems.filter(p=>p.contest===snapshot.contest).length,snapshot.count);
  assert.deepEqual(taxonomy.map(t=>t.id),Array.from({length:88},(_,i)=>i+1));
  for(const p of problems.filter(p=>p.forumStatus==='pending'))assert.doesNotMatch(p.evidence,/aops/i);
  const caveat=problems.find(p=>p.key==='isl:2016:N8');assert.match(caveat.notes,/distinct|literal/i);
  assert.match(problems.find(p=>p.key==='rmm:2026:6').notes,/incomplete|sketchy/);
  for(const p of problems){assert.equal(new Set(p.tags).size,p.tags.length);assert.ok(p.tags.includes(p.primaryTag));for(const id of p.tags)assert.ok(id>=1&&id<=88);for(const u of [p.aopsUrl,p.officialUrl,...p.sourceUrls].filter(Boolean))assert.equal(new URL(u).protocol,'https:');}
});
test('all 88 tag selections return exact matches with primary-first ranking',()=>{
  for(const tag of taxonomy){
    const actual=selectProblems(problems,taxonomy,{tags:[tag.id]});
    const expected=problems.filter(p=>p.tags.includes(tag.id));
    assert.deepEqual(new Set(actual.map(x=>x.problem.key)),new Set(expected.map(p=>p.key)));
    let passedPrimary=false;for(const r of actual){if(!r.primary)passedPrimary=true;else assert.equal(passedPrimary,false);}
  }
});
test('AND, OR and duplicate selections preserve exact independent matches',()=>{
  for(const mode of ['AND','OR'])for(const ids of [[44,46],[44,44,46],[1,5,19,22,38,44,49,54]]){
    const distinct=[...new Set(ids)];const actual=selectProblems(problems,taxonomy,{tags:ids,mode});
    const expected=problems.filter(p=>mode==='AND'?distinct.every(t=>p.tags.includes(t)):distinct.some(t=>p.tags.includes(t)));
    assert.deepEqual(new Set(actual.map(x=>x.problem.key)),new Set(expected.map(p=>p.key)));
    for(let i=1;i<actual.length;i++){const a=actual[i-1],b=actual[i];assert.ok(Number(a.primary)>Number(b.primary)||(a.primary===b.primary&&a.hits>=b.hits));}
  }
  assert.deepEqual(selectProblems(problems,taxonomy,{tags:[44,46]}),selectProblems(problems,taxonomy,{tags:[44,44,46]}));
});
test('collection, subject, years, evidence, text and permalink compose correctly',()=>{
  assert.equal(selectProblems(problems,taxonomy,{contest:'rmm',from:2025,to:2025}).length,problems.filter(p=>p.contest==='rmm'&&p.year===2025).length);
  assert.equal(selectProblems(problems,taxonomy,{contest:'rmm',subject:'N'}).length,problems.filter(p=>p.contest==='rmm'&&p.subject==='N').length);
  assert.equal(selectProblems(problems,taxonomy,{evidence:'pending'}).length,problems.filter(p=>p.forumStatus==='pending').length);
  assert.equal(selectProblems(problems,taxonomy,{from:2025,to:2010}).length,0);
  const one=selectProblems(problems,taxonomy,{problem:'isl:2016:N8'});assert.equal(one.length,1);assert.equal(one[0].problem.id,'N8');
  assert.ok(selectProblems(problems,taxonomy,{query:'2019 C6'}).some(x=>x.problem.key==='isl:2019:C6'));
  assert.equal(selectProblems(problems,taxonomy,{query:'zz-unmatchable-1234567'}).length,0);
  assert.deepEqual(validTagIds(['0','89','3','3','1.5','wrong'],taxonomy),[3]);
  assert.equal(selectProblems(problems,taxonomy).length,problems.length);
});
test('typed method ID input accepts numeric lists only',async()=>{
  const {parseTagInput}=await import('../problems/catalogue-core.mjs');
  assert.deepEqual(parseTagInput('44, 46',taxonomy),[44,46]);
  assert.deepEqual(parseTagInput('44 44;89 0',taxonomy),[44]);
  assert.equal(parseTagInput('invariant',taxonomy),null);
  assert.equal(parseTagInput('',taxonomy),null);
});

test('geometry keeps independent proof routes and both verified primary tags',()=>{
  const geometry=problems.filter(p=>p.contest==='isl'&&p.year===2025&&p.subject==='G');
  assert.deepEqual(geometry.map(p=>p.id),['G1','G2','G3','G4','G5','G6','G7']);
  assert.equal(geometry.filter(p=>p.geometry.analytic.primaryTag).length,6);
  const g2=geometry.find(p=>p.id==='G2');
  assert.deepEqual(g2.primaryTags,[62,78]);
  assert.equal(selectProblems(problems,taxonomy,{problem:g2.key,tags:[78]})[0].primary,true);
  assert.equal(selectProblems(problems,taxonomy,{problem:g2.key,tags:[62,78]})[0].hits,2);
  assert.equal(selectProblems(problems,taxonomy,{problem:g2.key,tags:[82]})[0].primary,false);
  const g1=geometry.find(p=>p.id==='G1');assert.equal(g1.geometry.analytic.primaryTag,null);assert.match(g1.geometry.analytic.status,/Pending/);
  for(const p of geometry)for(const tag of p.geometry.configurations)assert.ok(!p.primaryTags.includes(tag));
  assert.equal(selectProblems(problems,taxonomy,{subject:'G'}).length,7);
});

