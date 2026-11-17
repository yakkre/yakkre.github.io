# AoPS tail pass: handoff guide

This file is the full brief for continuing the tail pass (TODO.md item 1). A new session should read
it top to bottom, then start at "What is left". Progress, decisions and the exact resume point are
all here.

## What the task is

Every catalogue row was first classified from the first ~10 posts of its AoPS thread. The tail pass
re-reads the END of each thread (the last ~10 posts, plus the most-thanked posts in the middle of
long threads), because late posts often give a short clean proof by a method that is not tagged
yet. It also completes the geometry rows whose analytic route is still pending.

Priorities (set by the user, in this order):
1. **Analytic tags first.** For geometry rows whose analytic route is pending, check the official
   solutions and the whole thread (early and late posts) for a complete analytic proof
   (complex numbers, barycentric/Cartesian coordinates, vectors, trigonometric computation).
2. **Then the late-post pass over every remaining row.**

## Rules (from the user; follow strictly)

- **Never change or remove a primary tag**, unless the late solution is truly the best one; in
  practice, do not touch primaries. Secondary (additional) tags may be added: at most 1–2 per row.
- Add a tag only for a **complete, correct proof that you read in full** whose main method is not
  tagged yet. Do not tag from sketches, truncated posts, attachments only, posts flagged unsure or
  wrong by their author, posts corrected by a later reply, or proofs relying on outside results.
- **Check decisive computations** (python is available). Several forum "bashes" were wrong and
  rejected after a numeric check, e.g. 1999 G8 (HoRI_DA_GRe8 #21), 2005 G6 (infiniteturtle #24),
  2020 G5 (lksb #21). A pure typo whose corrected value has the same consequence is fine; say so in the note
  (RMM 2017/6, v_Enhance #6).
- When a late post is the cleanest solution, add a **one-sentence explanation** of its idea.
- **Record the exact post ranges read** for every row, e.g. `#41–#52 of 52 (all loaded)`; add
  `; middle skimmed by thanks` and `; analytic scan #1–#52` when done.
- Geometry tags go on a route: prefix `syn:` or `ana:`. A new analytic route on a pending row gets
  `--ana-status "Reviewed"` (pure analytic) or `"Reviewed — hybrid"` (analytic main step plus
  synthetic steps), an `--ana-explanation` of one or two sentences, and `--ana-refs` with the
  source (thread URL and post, or official booklet and solution number). If nothing qualifies,
  the note must say "analytic route stays pending".
- Tag labels must match the taxonomy exactly (`taxonomy` in `problems/data/catalogue.json`).
- Do **not** update the Drive Sheets or the Progress tab (the user decided against it).
- Commit and push to `main` are authorised for this task; catalogue commits must start with
  `Tail pass:` (the rebuild script relies on that) and end with the usual Co-Authored-By line.
- Privacy: never put the user's name, email or other personal data into any external request.

## Tools in the repo

| File | What it does |
|---|---|
| `scripts/tail_pass_todo.py isl 2012` | Rows of one year with no ledger entry yet: key, AoPS thread id (or `NO-URL`), cited posts, tags/routes |
| `scripts/tail_pass_add.py KEY RANGE NOTE [--tags …] [--explanation …] [--cite …] [--ana-status …] [--ana-explanation …] [--ana-refs …]` | Record one row in `problems/data/tail-pass.json` (re-running merges) |
| `scripts/tail_pass_rebuild.sh` | Rebuild `catalogue.json` = last workbook export + ledger, run Python and JS tests (no commit) |
| `scripts/tail_pass.py` | Applies the ledger (used by the rebuild script and by `export_catalogue.py`) |
| `scripts/aops_tail_helpers.js` | Browser helpers for reading AoPS threads and collections |
| `scripts/official_pdf_helpers.js` | Browser helpers for reading official solution PDFs as text |
| `tests/test_tail_pass.py` | Ledger rules: tags only added, primaries kept, idempotent, labels valid |

## Workflow per batch

1. `python3 scripts/tail_pass_todo.py isl 2012` to see what is left for a year.
2. Browser (Claude in Chrome; the user chose "Browser 1"): open a new tab on any AoPS thread, paste
   `scripts/aops_tail_helpers.js` with `javascript_exec`, then `await __many(['c6h…','c6h…','c6h…'], 120)`
   (3–4 threads per call). For rows marked `NO-URL`, get thread ids from the year's collection:
   `await __coll('c3963_2012_imo_shortlist')` (ids are listed under "What is left").
3. For each row: compare the late posts with the row's tags. If a post looks like a new main
   method, read it in full with `__go('c6h…',50,1)` then `__f(n)`, verify it, and only then tag.
4. Record every row right after reading it with `scripts/tail_pass_add.py`. Note style used so far:
   `"Late posts (user #n, user #m method, …) <what they do>; corroborates existing tags."`
5. Every year or so: `sh scripts/tail_pass_rebuild.sh` (must end with `fail 0`), then
   `git add problems/data && git commit -m "Tail pass: …" && git push` (with the Co-Authored-By line).

Practical notes:
- Tool output containing `= ; & ?` is blocked; the helpers already replace them. Slice long posts.
- If `__go` returns the previous thread again, retry that thread alone.
- A Cloudflare "Just a moment…" page sometimes appears after a full navigation; wait ~8 s and it
  clears. Never click through or solve a CAPTCHA; ask the user if it does not clear.
- After any full page load the helpers are gone: paste the helpers file again.

## Done so far (2026-11-16)

- Late-post pass: ISL 2025–2004 (all rows with URLs), RMM 2026–2025, ISL 2005 A/C, 1999 A1–A6 and C1–C5.
- Rows that had no AoPS URL, via the AoPS collections: 2021 A1–A3, 2019 C6/C9/N5–N8, 2018–2014
  A/C/N, 2013 A1–A6, C1–C8, N1–N4 (the thread link is in each row's range).
- Analytic routes: every pending/hybrid ISL geometry row was checked against the official solutions
  (imo-official booklets 2006–2025; IMO Compendium for 2005–1990), and every pending geometry row
  (ISL down to 1990, RMM) had its whole thread scanned. New analytic routes: 2010 G3 (trig hybrid),
  2010 G5 (trig), 2010 G7 (vector hybrid), 2014 G6 (complex hybrid), 2016 G6 (trig hybrid),
  2003 G7 (inversion + Cartesian hybrid), RMM 2017/6 (complex hybrid), RMM 2012/6 (complex); plus
  earlier ones from forum posts (e.g. 2025 G5/G7, 2024 G4/G5, 2023 G1/G8, 2017 G3, 2015 G4, 2011 G2,
  2008 G3, 2007 G1). Each pending route's references now say what the official check found.
- New secondary tags so far are listed in the ledger (`addTags`); examples: 2006 A2 Generating
  functions, 2006 C3 Probability, 2006 C6 Matchings, 2019 A4 Induction, 2009 A4 Convexity.
- RMM official solutions: the RMM site only posts problem papers for 2009–2018, so none could be checked.

## Done on 2026-11-17

- Rows without an AoPS URL: ISL 2013 N5–N7, all of 2012 and 2011, 2010 A1–A8 (thread ids from the AoPS collections; the link is in each row's range).
- Late-post pass for every remaining ISL row, 2003 back to 1990 (geometry rows included). ISL is now complete: 1,050 ledger rows.
- New secondary tags (each from a complete late proof, checked): 2002 A6 Generating functions (math154 #11, Dirichlet-series comparison), 2001 N5 Advanced NT (pi_quadrat_sechstel #78, Eisenstein integers; ab+cd=±(p²−q²)(s²−st+t²) checked in 2000 random trials), 1995 N6 Generating functions (teralux #61; (C(2p,p)+2p−2)/p matches brute force for p=3, 5, 7).
- Considered and not tagged: Lagrange multipliers (2010 A2, 1993 VIE2; same as 2007 A6), outside results (Zsigmondy, Kobayashi, Chebotarev, Perron, Han's inequality), expected-value rephrasings of double counting (1998 C5), unfinished or flagged sketches (2012 C6 #37, 2001 A1 #44, 1999 C6 #8, 1991 #11 #2, 1990 #5 #10).

Reading method that worked well: the Chrome tool cuts JS results at about 1,000 characters, so the batch helper writes its summary into an off-screen `<article id="__o">` and `get_page_text` reads it (up to ~40,000 characters). Run batches of 10–13 threads asynchronously (`__batch(...).then(n=>window.__done=n)`) and poll `window.__done`, since one JS call times out after 45 s.

## What is left (resume here)

1. **RMM 2024 and older** (75 rows; `tail_pass_todo.py rmm YEAR`). Not started: RMM work belongs to Codex (user's division of work, 2026-11-15), so only on request.
2. Loose ends: 1992 (CHN-2, FRA1, IND-4), 1991 (1, 2, 7) and 1996 G8 were thread-scanned but could not be matched to their Compendium solutions; 1999 G2's official "Solution 2" (coordinate determinants)
   is only known from a truncated AoPS quote and could be verified against an original booklet.

## Flagged for the user (do not decide alone)

- 2008 G6: mathocean97 #6 is a candidate trigonometric proof.
- 2010 G7: G81928128 #24 light-cone proof (the official vector-hybrid route is already recorded).
- 1990 #9 and 1993 ISA1: the Compendium solutions are length/cosine-law computations that might
  count as analytic routes.
- 2005 G6: infiniteturtle #24's barycentric coordinates fail a numeric check; not used.
- 1993 CAN2: YII.I. #4 says the stated inequality should be p ≤ 1 − (1+r)²/3 (statement typo?).
- 1992 SWE: aansc1729 #6 says part (a) as posted has a typo (Compendium: α(n²) ≤ α(n)(α(n)+1)/2).
- 1992 IRE1: no complete correct solution in the thread; litongyang #2 doubts the Compendium's.
- 1990 #5: Little Gauss #10 sketches a synthetic region argument (acute case only); not recorded as a route.

Resolved: 2009 G7 (2026-11-16) — home245's synthetic proof (#14 of 17; the ledger's "#15") was added in the
workbook as the synthetic route with Medium confidence, by user decision (IMO workbook checkpoint 194).
