"""Apply the AoPS tail-pass ledger (problems/data/tail-pass.json) to an exported catalogue.

The tail pass re-reads the END of each AoPS thread (see TODO.md and problems/README.md).
Its results live in a ledger so they survive later re-exports from the workbooks:
export_catalogue.py applies the ledger after building the catalogue, and this script
can apply it to an existing catalogue.json directly.

Rules enforced here:
- tags are only ever added, never removed; an existing primary tag is never changed;
- an analytic geometry primary is set only when the route has none yet;
- every change is idempotent (re-applying the ledger changes nothing).

Ledger entry fields (all optional except range/note):
  date, range, note, cite            -> appended to "Reviewed solution references" (notes)
  addTags: ["Label", "syn:Label", "ana:Label"]
                                      -> row additional tag / synthetic additional / analytic
                                         (analytic becomes primary only if the route has none)
  explanationAppend                   -> appended to the brief classification explanation
  ana_explanation, ana_refs, ana_status -> analytic route fields (explanation/refs appended;
                                         status set only together with a new analytic primary)
"""
import argparse, json
from pathlib import Path

DEFAULT_LEDGER = Path(__file__).resolve().parent.parent / 'problems' / 'data' / 'tail-pass.json'


def _append(text, extra, sep=' '):
    text = text or ''
    if not extra or extra in text:
        return text
    return (text.rstrip() + sep + extra) if text.strip() else extra


def _add(lst, tag_id):
    if tag_id not in lst:
        lst.append(tag_id)


def apply(data, ledger):
    labels = {t['label']: t['id'] for t in data['taxonomy']}
    by_key = {p['key']: p for p in data['problems']}
    applied = 0
    for key, e in ledger['entries'].items():
        p = by_key.get(key)
        if p is None:
            continue  # row not in this export (e.g. not yet reviewed); keep the ledger entry
        g = p.get('geometry')
        newly_reviewed = False  # analytic route that had no primary before this entry
        for raw in e.get('addTags', []):
            route, _, label = raw.partition(':') if raw.startswith(('syn:', 'ana:')) else ('', '', raw)
            tag_id = labels[label]
            if route == 'syn':
                assert g, f'{key}: synthetic tag on a non-geometry row'
                if g['synthetic']['primaryTag'] != tag_id:
                    _add(g['synthetic']['additionalTags'], tag_id)
            elif route == 'ana':
                assert g, f'{key}: analytic tag on a non-geometry row'
                a = g['analytic']
                if not a['primaryTag']:
                    a['primaryTag'] = tag_id
                    newly_reviewed = True
                    if e.get('ana_status'):
                        a['status'] = e['ana_status']
                    p['primaryTags'] = [v for v in [g['synthetic']['primaryTag'], a['primaryTag']] if v]
                elif a['primaryTag'] != tag_id:
                    _add(a['additionalTags'], tag_id)
            _add(p['tags'], tag_id)
        if g and e.get('ana_explanation'):
            a = g['analytic']
            if newly_reviewed:
                # The old text was a "pending" note; keep it as a reference, not as the explanation.
                old = a['explanation']
                a['explanation'] = e['ana_explanation']
                if old and old != e['ana_explanation']:
                    a['references'] = _append(a['references'], 'earlier note: ' + old, ' | ')
            else:
                a['explanation'] = _append(a['explanation'], e['ana_explanation'])
        if g and e.get('ana_refs'):
            g['analytic']['references'] = _append(g['analytic']['references'], e['ana_refs'], ' | ')
        p['explanation'] = _append(p['explanation'], e.get('explanationAppend'))
        record = f"tail pass {e.get('date', '')}: {e['range']}" + (f"; cite {e['cite']}" if e.get('cite') else '') + f"; {e['note']}"
        p['notes'] = _append(p['notes'], record, ' | ')
        p['tailPass'] = dict(date=e.get('date'), range=e['range'])
        applied += 1
    return applied


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--catalogue', default='problems/data/catalogue.json')
    ap.add_argument('--ledger', default=str(DEFAULT_LEDGER))
    args = ap.parse_args()
    path = Path(args.catalogue)
    data = json.loads(path.read_text())
    n = apply(data, json.loads(Path(args.ledger).read_text()))
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'Applied tail-pass ledger to {n} rows')


if __name__ == '__main__':
    main()
