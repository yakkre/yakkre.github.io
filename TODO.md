# TODO

Open tasks for raindrops, in priority order. Written 2026-11-16. Not started unless marked.

## 1. Tail pass over AoPS threads (most important)

Status: in progress (started 2026-11-16). Results are recorded in `problems/data/tail-pass.json` (one entry per row: posts read, tags added, explanation additions) and applied by `scripts/tail_pass.py`, which `scripts/export_catalogue.py` also runs after every export so the results survive workbook refreshes. The Drive Sheets were a week behind the committed catalogue, so the pass works from `problems/data/catalogue.json` instead of the workbooks. Rows without an AoPS URL are skipped. Each row in the catalogue that has been tail-passed carries a `tailPass` field.

Every forum check so far read only the first ~10 posts of each AoPS thread. The newest posts in a long thread often distil the best earlier ideas into a short clean solution, so each problem needs a second pass over the END of its thread.

Scope, per problem row in the IMO Shortlist Classification and RMM Classification workbooks:

- Open the AoPS thread (column "AoPS URL"), go to the last page, read the last ~10 posts. Skim the middle of threads longer than ~25 posts for posts that others quote or thank.
- Add at most one or two tags, and only when a late post gives a complete proof whose main method is not already tagged. Never remove existing tags.
- When a late post has the best solution, add a one-sentence summary of its main idea to the "Brief classification explanation" cell (keep the existing sentence; append).
- In "Reviewed solution references", record the exact post ranges read, e.g. `tail pass 2026-11-xx: #38–#47 of 47; cite #41 (user) complete proof`.
- Record progress in the Progress tab: rows tail-passed per year, and a daily checkpoint line.
- Keep all existing caveats, source conventions and the personal Sheet intact; same checkpoint and preservation procedure as before.

Budget: this should be far faster than the original classification. Most rows need no tag change at all. Then refresh the site with `scripts/export_catalogue.py` and run `node --test tests/`.

See also: Drive doc "Forum-check guidance — read the END of AoPS threads (2026-11-16)" and the guidance paragraph in `problems/README.md`.

## 2. Personal notebook tab ("quick reference notes")

Status: not started.

A fourth view tab on `/problems/`, next to Problem lookup / Progress grid / Collections, holding free-form notes that are not tied to one problem: a main idea from a problem worth remembering, a small observation, a trick. Like a mini document with its own tabs.

Requirements:

- Tabs the reader can add, rename, reorder and delete. Each tab is one text document.
- LaTeX rendering like the per-problem notes (same `typesetMath`), with an edit/preview split or a live preview under the textarea. Support the `[\hide="Label"] … [\hide]` boxes from `problems/notes-view.mjs`.
- Autosave while typing, same debounce and "Saved" status as per-problem notes.
- Storage: localStorage when signed out; Firestore at `progress/{uid}/notebook/{tabId}` (`{title, text, order, updatedAt}`) when signed in, migrating local tabs on first sign-in, exactly as notes do in `problems/progress.mjs`. Needs a matching rule in `firestore.rules` with a size cap (notes use 10,000 chars; allow more here, e.g. 50,000).
- Optional: link to a problem from a note by writing its name (e.g. `2019 C6`) and have it become a link to that entry.
- URL: `?view=notebook&tab=<id>` so a tab can be bookmarked.
- Mobile: tabs scroll horizontally; textarea full width.
- Tests: pure functions (tab ordering, migration, name linking) in `tests/`.
