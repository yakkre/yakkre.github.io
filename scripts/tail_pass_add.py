"""Add or extend one entry in the AoPS tail-pass ledger (problems/data/tail-pass.json).

One call per problem row, right after reading its thread. Re-running for the same key
merges (range/note/cite are appended, tags are unioned, ana_* fields are overwritten),
so a later official-solution check or analytic scan can be added to an existing row.

Usage:
  python3 scripts/tail_pass_add.py KEY RANGE NOTE [--tags "T1;T2"] [--explanation TEXT] [--cite TEXT]
                                   [--ana-status S] [--ana-explanation TEXT] [--ana-refs TEXT]

Examples:
  python3 scripts/tail_pass_add.py isl:2012:A1 "#40–#49 of 49 (all loaded; thread https://artofproblemsolving.com/community/c6h…)" \
      "Late posts (userA #41, userB #45) repeat the AM–GM bound; corroborates existing tags."
  python3 scripts/tail_pass_add.py isl:2006:C6 "#8–#17 of 17 (all loaded)" "userC #11 gives a complete Hall's-theorem proof …" \
      --tags "C: Matchings and assignments" --explanation "A forum proof …" --cite "#11 (userC) complete Hall proof"
  Geometry rows prefix tags with syn:/ana:, e.g. --tags "ana:G: Complex numbers" --ana-status "Reviewed"
      --ana-explanation "…" --ana-refs "<thread url> | #54 user complete complex proof".
Tag labels must match the taxonomy exactly (see `taxonomy` in problems/data/catalogue.json).
"""
import argparse, datetime, json
from pathlib import Path

LEDGER = Path(__file__).resolve().parent.parent / 'problems' / 'data' / 'tail-pass.json'
CATALOGUE = Path(__file__).resolve().parent.parent / 'problems' / 'data' / 'catalogue.json'


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('key'); ap.add_argument('range'); ap.add_argument('note')
    ap.add_argument('--tags', default=''); ap.add_argument('--explanation', default='')
    ap.add_argument('--cite', default='')
    ap.add_argument('--ana-status'); ap.add_argument('--ana-explanation'); ap.add_argument('--ana-refs')
    a = ap.parse_args()

    labels = {t['label'] for t in json.loads(CATALOGUE.read_text())['taxonomy']}
    tags = [t.strip() for t in a.tags.split(';') if t.strip()]
    for t in tags:
        label = t.split(':', 1)[1] if t.startswith(('syn:', 'ana:')) else t
        if label not in labels:
            raise SystemExit(f'Unknown tag label: {label!r}')

    doc = json.loads(LEDGER.read_text())
    E = doc['entries']
    new = dict(date=datetime.date.today().isoformat(), range=a.range, note=a.note,
               addTags=tags, explanationAppend=a.explanation, cite=a.cite)
    if a.key not in E:
        E[a.key] = new
    else:
        m = E[a.key]
        for f, sep in (('range', '; '), ('note', '; '), ('cite', '; '), ('explanationAppend', ' ')):
            if new[f] and new[f] not in m.get(f, ''):
                m[f] = (m.get(f, '') + sep + new[f]).strip('; ').strip()
        for t in tags:
            m.setdefault('addTags', [])
            if t not in m['addTags']:
                m['addTags'].append(t)
    for f, v in (('ana_status', a.ana_status), ('ana_explanation', a.ana_explanation), ('ana_refs', a.ana_refs)):
        if v:
            E[a.key][f] = v
    E[a.key] = {f: v for f, v in E[a.key].items() if v not in ('', [], None)}
    LEDGER.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n')
    print('recorded', a.key)


if __name__ == '__main__':
    main()
