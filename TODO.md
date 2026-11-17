# TODO

Open tasks for raindrops, in priority order. Written 2026-11-16. Not started unless marked.

## 1. Tail pass over AoPS threads (most important)

Status: ISL done 2026-11-17; RMM 2024 and older not started (Codex's area). **Handoff guide with rules, tools, progress and the exact resume point: `problems/TAIL_PASS.md`.** Results are recorded in `problems/data/tail-pass.json` (one entry per row: posts read, tags added, explanation additions) and applied by `scripts/tail_pass.py`, which `scripts/export_catalogue.py` also runs after every export so the results survive workbook refreshes. The Drive Sheets were a week behind the committed catalogue, so the pass works from `problems/data/catalogue.json` instead of the workbooks. Rows without an AoPS URL are skipped. Each row in the catalogue that has been tail-passed carries a `tailPass` field.

Progress (2026-11-17): **every ISL row is done** (2025–1990, 1,050 of 1,125 ledger rows), plus RMM 2026–2025. On 2026-11-17 the rows without an AoPS URL (ISL 2013 N5–N7, 2012, 2011, 2010 A1–A8) were linked through the AoPS collections, and the late-post pass covered ISL 2003–1990. Three new secondary tags, each from a complete late proof that was checked: 2002 A6 Generating functions (math154 #11, Dirichlet series), 2001 N5 Advanced NT (pi_quadrat_sechstel #78, Eisenstein integers; identity checked numerically), 1995 N6 Generating functions (teralux #61; count checked by brute force for p=3, 5, 7). Earlier (2026-11-16): ISL 2025–2004, all pending/hybrid geometry analytic routes checked against the official solutions, and new analytic routes 2010 G3/G5/G7, 2014 G6, 2016 G6, 2003 G7, RMM 2017/6, RMM 2012/6. Remaining:
1. RMM 2024 and older (75 rows). Not started: RMM work belongs to Codex (division of work, 2026-11-15), so only on the user's request.
2. 1992 (CHN-2, FRA1, IND-4), 1991 (1, 2, 7) and 1996 G8 were thread-scanned but not matched to Compendium solutions; 1999 G2's official "Solution 2" could be checked against an original booklet.
Flagged for a human decision: 2008 G6 (mathocean97 #6 trig), 2010 G7 (G81928128 #24 light-cone proof), 1990 #9 and 1993 ISA1 (Compendium computations that might count as analytic routes), 2005 G6 (infiniteturtle #24 barycentric coordinates fail a numeric check). Noticed in the 2026-11-17 pass: 1993 CAN2 (YII.I. #4 says the stated bound should read p ≤ 1 − (1+r)²/3), 1992 SWE (aansc1729 #6: part (a) as posted has a typo), 1992 IRE1 (no complete correct solution in the thread; litongyang #2 doubts the Compendium's), 1990 #5 (Little Gauss #10 sketches a synthetic region argument for acute triangles only). Resolved 2026-11-16: 2009 G7 — home245's proof (#14 of 17) added to the workbook as the synthetic route, Medium confidence (user decision).

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

Status: done 2026-11-17 as a floating notebook (book button → movable, resizable panel; tabs on the left; Edit/View modes; problem-name links; Firestore sync at `progress/{uid}/notebook/{tabId}`). The user chose a floating panel instead of a fourth view tab, so the `?view=notebook` URL below was not built. The original brief is kept for reference.

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
