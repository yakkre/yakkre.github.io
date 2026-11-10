# Problem catalogue

Static, buildless catalogue at `/problems/`. It adds to the existing raindrops blog without replacing its homepage, authentication or Firebase data.

## Data

`data/catalogue.json` is a reviewed snapshot exported from the canonical IMO Shortlist and RMM workbooks. It contains original classification summaries, the exact60-label taxonomy, evidence types, caveats and source links. Full copyrighted problem statements and solutions are not copied here. Pending problems are not fabricated as completed entries.

Both RMM main papers and shortlists are in scope; current coverage is explicit in the site. `Live forum checked` and `Archived forum checked` describe the recorded check source, not a guarantee that all replies are complete correct proofs.

Refresh from the current canonical workbooks, without modifying them:

```sh
python3 scripts/export_catalogue.py --imo '/path/to/IMO Shortlist Classification.xlsx' --rmm '/path/to/RMM Classification.xlsx' --output problems/data/catalogue.json
node --test tests/catalogue.test.mjs
python3 -m http.server 8765 --bind 127.0.0.1
```

Requires Python `openpyxl` for read-only export. The website itself needs no build step or backend. Readers can tick problems as done (saved in the browser); signing in by an emailed one-time link (Firebase passwordless auth, project in `../firebase-config.js`) syncs those marks to Firestore at `progress/{uid}` (see `../firestore.rules`). The page has three tabs: Problem lookup (the filtered list), Progress grid (every available ISL or RMM problem by year, green when done, with filter matches highlighted; clicking a square offers mark done / open / add to collection) and Collections (named lists with descriptions, stored with the done marks). Search state and entry permalinks live in URL query parameters. Filters include collection, descriptive subject, years, source-review type and all60 primary/additional method tags; multiple tags support AND/OR and primary-first ranking.

Keep workbook review/source caveats intact during refresh. Snapshot provenance includes input hashes without local machine paths. Do not publish arbitrary research caches, credentials, Firebase data, or project administration notes.

## Hosting

The folder works with an existing GitHub Pages deployment from the repository root. Ensure the `.mjs` files and `data/catalogue.json` are served. The repository visibility/Pages plan is configured separately by its owner; this change does not change access settings or Firebase rules.
