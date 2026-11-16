"""Tail-pass ledger: only adds tags, never changes an existing primary, and is idempotent."""
import copy, json, sys, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from tail_pass import apply, DEFAULT_LEDGER  # noqa: E402


def toy():
    taxonomy = [dict(id=i, label=l) for i, l in [(61, 'G: Angle chasing and cyclicity'), (62, 'G: Similarity'), (78, 'G: Complex numbers'), (46, 'C: Induction and recursion'), (39, 'C: Global arguments')]]
    route = lambda p, a: dict(primaryTag=p, additionalTags=a, explanation='', references='', status='Reviewed' if p else 'Pending — analytic proof not selected')
    return dict(taxonomy=taxonomy, problems=[
        dict(key='isl:1:C1', tags=[39], primaryTag=39, explanation='E.', notes='N'),
        dict(key='isl:1:G1', tags=[61], primaryTag=61, primaryTags=[61], explanation='E.', notes='N',
             geometry=dict(synthetic=route(61, []), analytic=route(None, []), configurations=[]))])


LEDGER = dict(entries={
    'isl:1:C1': dict(date='d', range='#5–#9 of 9', note='n', addTags=['C: Induction and recursion', 'C: Global arguments'], explanationAppend='More.'),
    'isl:1:G1': dict(date='d', range='#1–#9 of 9', note='n', addTags=['syn:G: Similarity', 'syn:G: Angle chasing and cyclicity', 'ana:G: Complex numbers'], ana_status='Reviewed'),
    'isl:9:A1': dict(range='r', note='row not exported'),
})


class TailPass(unittest.TestCase):
    def test_adds_without_touching_primaries_and_is_idempotent(self):
        data = toy()
        self.assertEqual(apply(data, LEDGER), 2)
        c1, g1 = data['problems']
        self.assertEqual((c1['primaryTag'], c1['tags']), (39, [39, 46]))
        self.assertEqual(c1['explanation'], 'E. More.')
        syn, ana = g1['geometry']['synthetic'], g1['geometry']['analytic']
        self.assertEqual((syn['primaryTag'], syn['additionalTags']), (61, [62]))
        self.assertEqual((ana['primaryTag'], ana['status']), (78, 'Reviewed'))
        self.assertEqual(g1['primaryTags'], [61, 78])
        self.assertEqual(sorted(g1['tags']), [61, 62, 78])
        once = copy.deepcopy(data)
        apply(data, LEDGER)
        self.assertEqual(data, once)

    def test_new_analytic_route_replaces_pending_note(self):
        data = toy()
        data['problems'][1]['geometry']['analytic']['explanation'] = 'Pending: no analytic proof found.'
        ledger = dict(entries={'isl:1:G1': dict(range='r', note='n', addTags=['ana:G: Complex numbers'],
                                                ana_status='Reviewed', ana_explanation='Complex bash.', ana_refs='#9 user')})
        apply(data, ledger)
        apply(data, ledger)
        ana = data['problems'][1]['geometry']['analytic']
        self.assertEqual(ana['explanation'], 'Complex bash.')
        self.assertIn('earlier note: Pending: no analytic proof found.', ana['references'])
        self.assertEqual(ana['references'].count('earlier note'), 1)

    def test_existing_analytic_primary_is_kept(self):
        data = toy()
        data['problems'][1]['geometry']['analytic'] = dict(primaryTag=62, additionalTags=[], explanation='', references='', status='Reviewed')
        apply(data, LEDGER)
        ana = data['problems'][1]['geometry']['analytic']
        self.assertEqual((ana['primaryTag'], ana['additionalTags']), (62, [78]))

    def test_repo_ledger_labels_exist(self):
        labels = {t['label'] for t in json.loads((ROOT / 'problems/data/catalogue.json').read_text())['taxonomy']}
        for key, e in json.loads(DEFAULT_LEDGER.read_text())['entries'].items():
            for t in e.get('addTags', []):
                self.assertIn(t.split(':', 1)[1] if t.startswith(('syn:', 'ana:')) else t, labels, key)


if __name__ == '__main__':
    unittest.main()
