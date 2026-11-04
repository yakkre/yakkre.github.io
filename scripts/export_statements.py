"""Export statements from previously matched research caches; makes no network requests.

Usage: python scripts/export_statements.py --cache-root PATH [--cache-root PATH]
Only exact, unambiguous catalogue source links establish a cache-to-entry mapping.
Solutions and local filesystem paths are never included in the public output.
"""
import argparse
import collections
import json
from pathlib import Path
import re
from urllib.parse import parse_qs, urlparse


def topic(url):
    match = re.search(r'artofproblemsolving\.com/community/[^\s/]*h(\d+)', url or '')
    return match.group(1) if match else None


def archive_row(url):
    parsed = urlparse(url or '')
    query = parse_qs(parsed.query)
    if (parsed.hostname == 'datasets-server.huggingface.co' and parsed.path == '/rows'
            and query.get('dataset') == ['AI-MO/aops'] and query.get('length') == ['1']
            and query.get('config') == ['default'] and query.get('split') == ['train']):
        try:
            return int(query['offset'][0])
        except (ValueError, KeyError):
            pass


def collect(catalogue, paths):
    topics, rows = collections.defaultdict(set), collections.defaultdict(set)
    archive_urls = {}
    for problem in catalogue['problems']:
        key = problem['key']
        for url in [problem.get('aopsUrl'), *problem.get('sourceUrls', [])]:
            if topic(url):
                topics[topic(url)].add(key)
            index = archive_row(url)
            if index is not None:
                rows[index].add(key)
                archive_urls[index] = url
    statements = {}
    for path in sorted(paths):
        try:
            cache = json.loads(path.read_text())
        except (ValueError, UnicodeError, OSError):
            continue
        if not isinstance(cache, dict):
            continue
        for wrapper in cache.get('rows', []):
            index = wrapper.get('row_idx')
            row = wrapper.get('row', {})
            if len(rows.get(index, ())) != 1 or wrapper.get('truncated_cells') != []:
                continue
            text = row.get('problem', '')
            if not isinstance(text, str) or not text.strip() or '<img' in text or '\\includegraphics' in text:
                continue
            key = next(iter(rows[index]))
            if key not in statements:
                statements[key] = {'text': text.strip(), 'kind': 'archive',
                    'sourceUrl': archive_urls[index], 'archiveRow': index,
                    'archivePath': row.get('metadata', {}).get('path', '')}
        url = cache.get('source_url') or cache.get('url', '')
        keys = topics.get(topic(url), ())
        posts = cache.get('posts', [])
        if len(keys) != 1 or not posts or str(posts[0].get('number')) not in ('#1', '1'):
            continue
        post = posts[0]
        text = post.get('text', '')
        if not isinstance(text, str) or len(text.strip()) < 40:
            continue
        key = next(iter(keys))
        statement = {'text': text.strip(), 'kind': 'forum', 'sourceUrl': url,
            'post': 1, 'author': post.get('author', ''), 'postDate': post.get('date', ''),
            'retrieved': cache.get('retrieved_utc') or cache.get('retrieved') or cache.get('checked', '')}
        diagrams = [i for i in post.get('images', []) if i.get('src', '').startswith('https://')
                    and 'latex' not in i['src'].lower()]
        if diagrams:
            statement['images'] = diagrams
        previous = statements.get(key)
        if not previous or previous['kind'] != 'forum' or str(statement['retrieved']) > str(previous.get('retrieved', '')):
            statements[key] = statement
    return {'version': 1, 'statements': dict(sorted(statements.items())),
        'pendingKeys': [p['key'] for p in catalogue['problems'] if p['key'] not in statements]}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-root', action='append', required=True, type=Path)
    parser.add_argument('--catalogue', type=Path, default=Path('problems/data/catalogue.json'))
    parser.add_argument('--output', type=Path, default=Path('problems/data/statements.json'))
    args = parser.parse_args()
    paths = {p for root in args.cache_root for p in root.rglob('*.json') if p.stat().st_size < 30_000_000}
    output = collect(json.loads(args.catalogue.read_text()), paths)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'available': len(output['statements']), 'pending': len(output['pendingKeys']),
        'sources': dict(collections.Counter(s['kind'] for s in output['statements'].values()))}))
