import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('export', Path(__file__).parents[1] / 'scripts/export_statements.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ExportTests(unittest.TestCase):
    def test_ambiguous_topics_and_truncated_archive_rows_are_not_published(self):
        url = 'https://artofproblemsolving.com/community/c6h123'
        archive = 'https://datasets-server.huggingface.co/rows?dataset=AI-MO%2Faops&config=default&split=train&offset=5&length=1'
        catalogue = {'problems': [
            {'key': 'a', 'aopsUrl': url, 'sourceUrls': [archive]},
            {'key': 'b', 'aopsUrl': url, 'sourceUrls': []}]}
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'cache.json'
            path.write_text(json.dumps({'url': url, 'posts': [{'number': '#1', 'text': 'Statement ' * 10}],
                'rows': [{'row_idx': 5, 'truncated_cells': ['problem'], 'row': {'problem': 'Partial'}}]}))
            self.assertEqual(module.collect(catalogue, [path])['statements'], {})
            cache = json.loads(path.read_text()); cache['rows'][0]['truncated_cells'] = []
            cache['rows'][0]['row']['problem'] = 'Complete statement'
            cache['rows'][0]['row']['solution'] = 'Never publish this proof'
            path.write_text(json.dumps(cache))
            result = module.collect(catalogue, [path])
            self.assertEqual(result['statements']['a']['text'], 'Complete statement')
            self.assertNotIn('solution', result['statements']['a'])
            self.assertEqual(result['pendingKeys'], ['b'])


if __name__ == '__main__':
    unittest.main()
