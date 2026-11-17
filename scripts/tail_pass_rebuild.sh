#!/bin/sh
# Rebuild problems/data/catalogue.json = last workbook export + the tail-pass ledger, then run the tests.
# Rebuilding from the export (instead of re-applying to the current file) avoids duplicate
# "tail pass" note records when an existing ledger entry is extended.
# The base is the newest commit touching catalogue.json whose subject is not a "Tail pass" commit.
# It does not commit or push; do that only when the user has asked for it.
set -e
cd "$(dirname "$0")/.."
BASE=$(git log --format='%h %s' -- problems/data/catalogue.json | grep -v '^[0-9a-f]* Tail pass' | head -1 | cut -d' ' -f1)
echo "base export: $BASE"
git show "$BASE":problems/data/catalogue.json > problems/data/catalogue.json
python3 scripts/tail_pass.py
python3 tests/test_tail_pass.py 2>&1 | tail -1
node --test tests/*.mjs 2>&1 | grep -E '^ℹ (pass|fail)'
