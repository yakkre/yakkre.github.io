"""List catalogue rows of one contest/year that have no tail-pass ledger entry yet.

Usage: python3 scripts/tail_pass_todo.py isl 2012      (or: rmm 2024)
Prints: key | AoPS thread id (or "NO-URL": find it in the AoPS collection) | post numbers
already cited in the notes | current tags. Geometry rows show the synthetic and analytic
routes and the analytic status.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
d = json.loads((ROOT / 'problems/data/catalogue.json').read_text())
done = set(json.loads((ROOT / 'problems/data/tail-pass.json').read_text())['entries'])
T = {t['id']: t['label'] for t in d['taxonomy']}
contest, year = sys.argv[1], int(sys.argv[2])
for p in d['problems']:
    if p['contest'] != contest or p['year'] != year or p['key'] in done:
        continue
    g = p.get('geometry')
    cited = sorted(set(int(x) for x in re.findall(r'#(\d+)', p['notes'] or '')))
    if g:
        s, a = g['synthetic'], g['analytic']
        tags = (f"[ANA {a['status']}] SYN {T.get(s['primaryTag'])} +{[T[x] for x in s['additionalTags']]}"
                f" | ANA {T.get(a['primaryTag'])} +{[T[x] for x in a['additionalTags']]}")
    else:
        tags = ' ; '.join(T[t] for t in p['tags'])
    url = p['aopsUrl'].split('community/')[1] if p['aopsUrl'] else 'NO-URL'
    print(f"{p['key']} | {url} | cited{cited[-5:]} | {tags}")
