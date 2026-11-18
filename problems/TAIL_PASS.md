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

1. **RMM 2021 and older** (64 open rows after completing 2024/2023 and two 2021 checks; `tail_pass_todo.py rmm YEAR`). Not started: RMM work belongs to Codex (user's division of work, 2026-11-15), so only on request.
2. Loose ends: 1992 (CHN-2, FRA1, IND-4), 1991 (1, 2, 7) and 1996 G8 were thread-scanned but could not be matched to their Compendium solutions; 1999 G2's official "Solution 2" (coordinate determinants)
   is only known from a truncated AoPS quote and could be verified against an original booklet.

## RMM pass completed for 2024 (2026-11-18)

- All 14 originally open 2024 rows checked and recorded, plus the pre-existing shortlist A4 entry. The 2024 todo is empty; 71 rows remain from 2023 back to 2008.
- Four secondary additions: main 1 and main 6 Algebraic combinatorics methods, main 4 Number theoretic sequences, shortlist C4 Inequalities—convexity arguments. No primary or existing tag changed.
- Official-source check: organizer 2024 problems page and linked Day1/Day2 papers, plus UKMT Day1, expose statements only. A focused search on rmms.lbi.ro and bmos.ukmt.org.uk found no supplied main/shortlist solution booklet. This is a source gap, not a claim that none exists online. Main 2 #17 and shortlist A2 #3 are attributed forum reproductions, with caveats below.
- 2024 published via the connected GitHub account as `3d1da1a` (tree identical to validated local `8afdfec`), after explicit approval in this chat. CLI authentication was unavailable.

## RMM pass completed for 2023 (2026-11-18)

- Five remaining rows recorded; the pre-existing problem 4 review is preserved. The 2023 todo is empty.
- Added Graph theory—structural on problem 2, plus Induction and recursion and Extremal arguments on problem 6, each from complete proofs.
- Read both supplied Day1/Day2 solution booklets for these five problems, including their alternatives; minor slips and incomplete forum candidates are flagged below. Problem 3 remains Medium for the user’s decision.
- Next row: **rmm:2021:1** (confirm against the year todo). Python ledger tests OK; 34 Node checks passed, fail 0. Exact preservation confirmed: only five 2023 rows changed, existing ledger entries/primaries/tags/confidence retained. Local year commit prepared; no push is claimed.

## RMM 2021 partial checkpoint (2026-11-18)

- Problems 1 and 2 checked and recorded; four rows remain for 2021. This year is incomplete.
- Problem 1 adds analytic Vectors and dot products and Power of a point from SnowPanda #12’s complete hybrid proof. Problem 2 adds nothing. Existing routes, primaries and confidence retained.
- Supplied organizer Day1 pp1–3 read for these two rows. Next row: **rmm:2021:3**.
- Publishing this partial checkpoint at the user’s explicit “push everything that is local rn” request; no completed-year claim.

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

RMM 2024 flags (2026-11-18):
- Main 1: vsamc #5 and lnzhonglp #8 print a geometric sum as 2^n instead of 2^n−1. The added tag relies on KevinYang2.71 #12, not these slips.
- Main 2: Assassino9931 #17 is labelled the second official solution, but alpha is undefined in the final estimate and the j>1 argument counts q remaining b values after a preceding b is consumed; the missing case/parity justification should be checked against the original booklet. No tag added from it. DottedCaculator #2 invokes Cauchy–Davenport without supplying that result; MS_Kekas #4 links an outside editorial and Safal #7 supplies only an attachment. These were not used as complete proofs for new tags.

- Main 3: #2 Hall/determinant argument is compressed and #6 invokes Chevalley–Warning without proof. #8 claims all three colors are used, whereas its dimension argument only establishes nonconstancy; the weaker conclusion suffices. No new tags.
- Main 4: #4 omits a difference-sign case; #15 is an uncertain sketch; #16 stronger generalization fails for a=3,b=2; #19 omits a multiplier-sign justification; #20 reverses a valuation inequality. The addition uses the complete #21 instead.
- Main 5: #6 complex expansion failed numerical checks in its first expanded line (100/100 trials), despite the final cross-ratio being real; do not add Complex numbers from it. #13 has a final circle-power sign issue; #22 barycentric formulas remain unverified here. #17/#19/#24/#26 invoke outside degree-counting/conic results, #18 leaves its lemma to an inversion, #20 is explicitly a sketch and #23 invokes DDIT without proof. None used for a new tag.
- Main 6: #8 invokes Fourier inversion, #9 leaves its Littlewood–Offord/Sperner step unproved, #10 links part of its auxiliary argument, and #12 is link-only. #13 drops Q² to Q in the flip argument and omits the degree cutoff in a displayed bound. The new Algebraic combinatorics methods tag uses the complete #11 finite-field counting argument.

Year validation passed: Python ledger tests OK; 34 Node tests passed, fail 0. Exact preservation check: all existing ledger entries, all primaries/confidence/existing tags and every non-2024 catalogue object unchanged; 14 new ledger entries. Run the shell rebuild with NODE_OPTIONS=--test-reporter=spec in this non-TTY environment so its existing summary grep sees the expected output. No script changes.

- Shortlist A1: #2 states its dominance claims with arbitrary real constants where positivity is needed, and its constant-shift sentence needs a sign correction. #3 swaps a/b in its final display; its pairing argument otherwise corroborates the existing tags. No new tag.

- Shortlist A2: #5 is corrected in #6 and retracted in #7; #9 has malformed/sign-inconsistent identities. Attributed official reproduction #3 prints xt for zt and omits the zero-sum additivity boundary (covered by the same negative auxiliary-variable argument); #4 is explicitly tentative. No new tag.

- Shortlist A3: #2 is not injective: exponent triples (1,2,2) and (0,2,3) have the same proposed image. #5 has an induction-list typo and stops its claim one index early; zero variables need continuity. Exact-rational checks corroborate its corrected ratio argument. #6 is attachment/outside-research only. No new tag.

- Shortlist C1: #2 says 2n points instead of n and its attainment configuration needs distinct pairwise directions. #5 does not justify its scanning-line model/count; not used for additions.

- Shortlist C3: #2/#6 wrongly count entire same-majority blocks as popular cells (#5 objects); all 512 n=3 grids confirm counterexamples. #3 has a plus/minus typo in its block inequality and only sketches zero-block cases. No additions or confidence changes; the prior classification remains untouched.

- Shortlist C4: #2 uses inconsistent 0/1-based bucket notation and reverses the two comparisons with n/p in its missing/repeated-bucket sentence. With the earlier 0-based ranks retained, the full elementary majorization proof is correct; its score identities passed n=2–30 checks. Added convexity/majorization, with all existing tags and primary retained.

- Shortlist N1: #3 has an incorrect displayed quotient identity and later loses a 2024 factor; #4 omits k=0 (b=a²), which needs exclusion using the next sequence step. No new tags; complete #2 retained as evidence.

- Shortlist N2: #3 prints a strict lower bound a_(i_k)>2kp where ≥ is justified; the earlier strict bound a_p>a_(i_k) suffices. #4 is tentative/attachment-only, not used for additions.

- Shortlist A4: the pre-existing reviewed entry retains Medium confidence because the posted positive-root branch omits negative tails; the prior review supplies a finite-branch/fallback completion. Keep confidence unchanged pending the user’s decision.

RMM 2023 flags (2026-11-18):
- Main 1: official Solution 1 needs p≠3 for coprime cancellation, prints 27−s for 27−3s, while its factored size inequality is a valid weakening of the exact bound with 4(p²−p³), rather than an equivalent rewrite. The intended bound survives; p=3 is handled directly. Forum #16/#27/#36 leave cancellation/divisor-case gaps, #19 has sign/answer typos, #21 is outline-only, #25 omits k=1, #32 has an unjustified strict inequality and a 12/13 typo, and #35 has an incorrect discriminant. No new tags.

- Main 2: #5/#8 observe that the lower bound works for arbitrary triple weights and question the geometric label; existing classification and primary retained for the user’s decision. #17 reverses component inequalities. Added Graph theory—structural from complete #4/#18, not that faulty write-up.

- Main 3 (Medium retained): complete proposer #11, official pp3–4 and corrected #14 support a possible High upgrade for the user to decide. #8’s one-variable divisibility argument is invalid and its construction needs squared moduli; #15 has reciprocal/zero-locus slips and an unaddressed final cancellation step. #19’s claimed 2n ratio roots fail already for n=2, q=exp(iπ/4), where the four points repeat in pairs. #14’s final “nth roots” should read “2nth roots”; the preceding proof is complete.

- Main 5: official Solution 1 substitutes S(x) where Q(x) is intended. Forum #10 has undefined/inconsistent symbols, #11 needs branch/uniform-asymptotic justification, #12 confuses powers/composition and degrees, #14 compresses its asymptotic fibre matching and induction. No new tags from these candidates.

- Main 6: #10/#14/#18/#23/#24 use unproved matroid, polytope or real-stability results; no tags from those. #34 wrongly infers isolated vertices from disconnection; #37 leaves mutual tree exchange unjustified and reverses its common-edge potential; #32/#36 compress the cut invariant. #38 reverses the words naming the removed/added edges but its counts specify the intended valid two-edge repair. Official Solution 2 has minor R(C) and C1/C2 symbol slips. Added induction and extremal methods from the two complete supplied proofs.

RMM 2021 flags (2026-11-18):
- Main 1: #9 swaps V/W relative to the present statement; existing Cartesian source #13 projects onto the T-line where the transversal is needed. #14 compresses its reflection reduction. Official final RQ should be RS. Added analytic vector and circle-power methods only from complete #12; existing primaries and Reviewed status retained.

- Main 2: #2’s fixed-swap construction does not cover arbitrary query subsets. The official cyclic lower bound needs singleton queries treated separately; the forum #3/#14 do so explicitly. #13/#15 alter the statement by changing distinctness/remainder requirements. No new tags.
