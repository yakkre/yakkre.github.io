"""Export the reviewed classification catalogue without changing either workbook.

Uses openpyxl only for reading. Publication contains original classification notes
and source links; it does not reproduce the underlying problem/solution texts.
"""
import argparse, collections, datetime, hashlib, json, re
from pathlib import Path
import openpyxl

def export(imo, rmm, output):
    sources = [('isl', 'IMO Shortlist', Path(imo)), ('rmm', 'RMM', Path(rmm))]
    problems, taxonomy, snapshots = [], None, []
    for contest, name, path in sources:
        raw = path.read_bytes()
        book = openpyxl.load_workbook(path, read_only=True, data_only=True)
        tags = [dict(id=r[3], subject=r[0], label=r[1], definition=r[2], **({'kind':r[4]} if len(r)>4 and r[4] else {}))
                for r in list(book['Taxonomy'].values)[5:] if r[0] and isinstance(r[3],int)]
        if taxonomy is None: taxonomy = tags
        else: assert tags == taxonomy, 'Taxonomies differ'
        tag_ids = {t['label']: t['id'] for t in taxonomy}
        count = 0
        for row in list(book['Problems'].values)[5:]:
            if not row[0] or row[10] != 'Reviewed': continue
            year, ident, subject, primary, extra, explanation, aops, evidence, notes, confidence, status = row[:11]
            assigned = [primary] + [x.strip() for x in (extra or '').split(';') if x.strip()]
            assert len(assigned) == len(set(assigned))
            assigned_ids = [tag_ids[t] for t in assigned]
            evidence = evidence or ''
            forum = 'live' if 'live aops' in evidence.lower() else 'archive' if 'aops' in evidence.lower() else 'pending'
            # Keep all mathematical caveats; remove only local machine paths.
            notes = re.sub(r'/Users/[^\s;|]+', '[local research cache]', notes or '')
            urls = list(dict.fromkeys(re.findall(r'https?://[^\s<>"\[\]]+', notes)))
            urls = [u.rstrip('.,;|)') for u in urls]
            aops = aops if aops and re.match(r'^https://(?:www\.)?artofproblemsolving\.com/', aops) else None
            refs = [u for u in urls if u != aops]
            official = next((u for u in refs if '.pdf' in u.lower() and 'artofproblemsolving.com' not in u), None)
            if not official: official = next((u for u in refs if 'scribd.com' in u), None)
            key = f'{contest}:{year}:{ident}'
            problems.append(dict(key=key, contest=contest, contestName=name, year=year,
                id=str(ident), subject=subject, primaryTag=assigned_ids[0], tags=assigned_ids,
                explanation=explanation, aopsUrl=aops, officialUrl=official,
                sourceUrls=refs, evidence=evidence, notes=notes, confidence=confidence,
                forumStatus=forum, section='Shortlist' if contest=='isl' or str(ident).startswith('SL ') else 'Contest'))
            if contest=='isl' and len(row)>=23: problems[-1].update(difficulty=(int(row[21]) if row[21] is not None else None), difficultyBasis=row[22])
            if subject == 'G':
                assert len(row)>=21, 'Geometry requires reviewed route fields'
                def route(primary,extra,explanation,refs,status):
                    return dict(primaryTag=tag_ids.get(primary),additionalTags=[tag_ids[x.strip()] for x in (extra or '').split(';') if x.strip()],explanation=explanation or '',references=refs or '',status=status)
                syn=route(row[11],row[12],row[13],row[14],'Reviewed')
                analytic=route(row[15],row[16],row[17],row[18],row[19])
                problems[-1]['geometry']=dict(synthetic=syn,analytic=analytic,configurations=[tag_ids[x.strip()] for x in (row[20] or '').split(';') if x.strip()])
                problems[-1]['primaryTags']=[v for v in [syn['primaryTag'],analytic['primaryTag']] if v]
            count += 1
        snapshots.append(dict(contest=contest, name=name, count=count, sha256=hashlib.sha256(raw).hexdigest()))
        book.close()
        assert hashlib.sha256(path.read_bytes()).hexdigest()==snapshots[-1]['sha256'], 'Workbook changed during export'
    assert len(taxonomy)==88 and [t['id'] for t in taxonomy]==list(range(1,89))
    assert len({p['key'] for p in problems})==len(problems)
    counts = collections.Counter(p['contest'] for p in problems)
    recent_pending = sum(p['contest']=='isl' and p['year']>=2010 and p['forumStatus']=='pending' for p in problems)
    rmm_ids = ', '.join(f"{p['year']} {p['id']}" for p in problems if p['contest']=='rmm')
    data = dict(updated=datetime.datetime.now(datetime.timezone.utc).isoformat(), taxonomy=taxonomy,
        problems=problems, snapshots=snapshots, counts=dict(counts),
        scope='IMO A/C/N 1990–2025 plus all seven 2025 geometry problems. Geometry in earlier years and RMM has not yet been added. Geometry records separate reviewed synthetic and analytic primaries; unreviewed routes remain pending.',
        coverage=[dict(contest='isl', title='IMO Shortlist · 1990–2025', text=f"{counts['isl']} classifications. The later forum audit is ongoing: {recent_pending} recent entries currently have official-only evidence. Earlier archived and live checks are preserved. Pending source checks are distinguished from completed classifications."),
                  dict(contest='rmm', title='RMM · work in progress', text=f"{counts['rmm']} reviewed entries: {rmm_ids}. Both main papers and shortlists are in scope. This is partial collection coverage; entries with unresolved official-solution support or unpublished inventories are not included as reviewed. Individual research notes identify reproduced official booklets and any incomplete forum proofs.")],
        caveats=['A forum check can find an incomplete proof; it does not certify every reply. Expand research notes for the exact outcome.',
                 'Official booklets, attributed reproductions and Compendium fallbacks are distinguished in each entry. Some original older booklets remain unavailable.',
                 '2016 N8 has a literal-versus-intended-statement caveat, retained in its research notes.',
                 'Main RMM problem numbers are preserved; A/C/N subjects are descriptive mappings. Shortlist IDs will remain distinct from main-contest IDs.'])
    output=Path(output);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(',',':'))+'\n')
    print(f'Exported {len(problems)} entries, {len(taxonomy)} tags; '+str(dict(counts)))
    return data

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--imo',required=True);p.add_argument('--rmm',required=True)
    p.add_argument('--output',default='problems/data/catalogue.json')
    args=p.parse_args();export(args.imo,args.rmm,args.output)

