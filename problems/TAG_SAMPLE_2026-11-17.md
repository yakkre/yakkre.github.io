# TST/RMM classification sample — 2026-11-17

A bounded check requested by the user while missing website statements were being added.
Six entries per collection were selected before detailed solution review, spanning algebra,
combinatorics, number theory and geometry. This is a deliberate coverage sample, not a
random sample or an estimate of the entire catalogue's error rate. The baseline was
`d5b5fb59e73d099a4c212495b0ce150762b52a7f`.

## Result

- Primary classifications requiring replacement: **0/12**.
- Clear missing substantial additional methods: **2/12** (one TST, one RMM).
- Additional search-specificity improvement: **1/12** (TST).
- Rows receiving an additional tag in total: **3/12** (TST 2/6, RMM 1/6).

The main classifications were sound in this sample. Additional-method coverage has real,
localized omissions; it would be inaccurate to call it perfect or infer a negligible global
miss rate from twelve entries. Apply the three precise additions and keep future checks
focused, rather than restart a full classification pass. No primary or existing tag is removed.

## Per-problem check

| Problem | Evidence examined | Outcome |
|---|---|---|
| USA TST 2026/1 | Supplied solutions p2; existing forum assessment #2 vsamc/#25 retained | Polynomial reduction on the Boolean cube, support grouping and induction are covered by tags 10, 38, 46. No addition. |
| USA TST 2026/2 | Supplied solutions p3; existing complete forum assessment retained | Floor intervals and additive pairing are covered by 35, 39; the separately recorded lattice proof is covered by 51. No addition. |
| USA TST 2026/5 | Supplied solutions pp9–10, including the complete Involutions alternative; actual AoPS #2 DottedCaculator reread | Add **74 Projective incidence** on the synthetic route: Desargues' involution theorem supplies the pivotal midpoint claim. Keep the existing Cartesian route and both primaries. |
| USA TST 2025/2 | Supplied solutions p5, full cubic-roots proof | Vieta/power sums, recurrence iteration and conjugate-root dominance are covered by 11, 8, 12. No addition. |
| USA TST 2024/3 | Supplied TeX, full section including both cyclotomic-divisibility proofs | Add **16 Generating functions**. Existing primary 59 already covers this broadly, so this is a specificity improvement, not an unrecognized main proof. |
| USA TST 2020/4 | Supplied TeX, full section | Triangle-count monovariant, connected-component structure and iteration are covered by 47, 44. No addition. |
| RMM 2026/2 | Saved actual forum #5 Assassino9931, complete statement and proof | Wilson pairing and product comparison are covered by 19, 39. No new official-solution review claimed. |
| RMM 2025/3 | Attributed supplied-booklet reproduction, Solution1; saved actual #2 DottedCaculator in full | Polynomial encoding, roots-of-unity sharpness, trees and pairing are covered by 59, 12, 47, 49. The generic linear-combination step does not warrant a separate probability tag. |
| RMM 2024/2 | Attributed supplied-booklet reproduction, Day1 pp4–5 Solution1 | Residue ordering, greedy choices, dominant-value block and induction are covered by 52, 41, 46. No addition. |
| RMM 2023/3 | Organizer Day1 supplied solutions pp3–4, complete main construction and lower bound | Complex roots, Newton sums, real signs and degree bounds are covered by 12, 11, 10. No addition. |
| RMM 2023/4 | Organizer Day2 p1, Solutions1–4 | Add **77 Cartesian coordinates** as analytic additional for Solution4's ellipse parametrization and completed-square bound. Keep 78 Complex numbers as analytic primary. |
| RMM 2023/5 | Organizer Day2 p2, complete Solution1 | Composition and leading-degree obstruction are covered by 13, 10. No addition. |

No exhaustive new forum audit was performed. Complete cached forum proofs and prior
assessments were reused where adequate; an official proof was not invented for RMM 2026/2.
The RMM 2025/3 reproduction and forum wording issues already recorded in its notes remain.
For RMM 2023/3 the sign argument uses path connectedness of the complement of the finite
union of labelled regular-configuration subspaces. For RMM 2023/5 the printed final
substitution `t=S(x)` reads `t=Q(x)`. Both pre-existing caveats are retained.

In TST 2026/5 #2, the initial definition of `c` has a sign inconsistency with `a <= b`;
read it as the positive tangent length. The subsequent calculation uses `c²`, and the
recorded Cartesian formulas and equality of powers are unaffected. This does not create
a new route or tag.

The RMM ellipse route was checked algebraically: with focal half-distance `t`, semi-major
axis `u`, and distance `s` from M to the projection line, parametrizing the ellipse gives
`MX² = R² - (t sin(theta) - s sqrt(u²-t²)/t)²`, using the projection relation
`R² = u² + s²u²/t²`. Thus the ellipse lies inside the M-centred circle containing K.
Degenerate projection cases are immediate or follow by continuity. This is a complete
coordinate route, rather than a sketch inferred merely from the word “ellipse”.

## Sources and preservation

- [USA TST 2026 supplied solutions](https://github.com/usa-tst-public/USA-TST-Archive/blob/main/IMOTST2026Solutions.pdf).
- [USA TST 2026/5 actual forum](https://artofproblemsolving.com/community/c6h3750493p36924021), #2 DottedCaculator.
- [USA TST 2025 supplied solutions](https://web.evanchen.cc/exams/sols-TST-IMO-2025.pdf).
- [USA TST 2024 supplied TeX](https://web.evanchen.cc/exams/sols-TST-IMO-2024.tex).
- [USA TST 2020 supplied TeX](https://web.evanchen.cc/exams/sols-TST-IMO-2020.tex).
- [RMM 2026/2 actual forum](https://artofproblemsolving.com/community/c6h3780321p37324677), cached #5 Assassino9931.
- [RMM 2025 supplied-booklet reproduction](https://www.scribd.com/document/942788632/Rmm2025-Sol); [actual forum](https://artofproblemsolving.com/community/c6h3499496p33992592), cached #2 DottedCaculator.
- [RMM 2024 supplied-booklet reproduction](https://www.scribd.com/document/916704532/Romanian-Master-of-Mathematics-2024), uploader Mohammed Imran; no direct organizer solution download claimed.
- [RMM 2023 organizer Day1 supplied solutions](https://rmms.lbi.ro/rmm2023/pr1/RMM2023-Day1-English_Solutions.pdf).
- [RMM 2023 organizer Day2 supplied solutions](https://rmms.lbi.ro/rmm2023/pr2/RMM2023-Day2-English_Solutions.pdf).

The three additions live in `data/tail-pass.json` so they survive future exports. Only those
three catalogue objects change; all existing tags, primaries, rows and prior evidence remain.
No workbook, Google Sheet, UI, user notes or account controls are modified.

Separately, this statement batch attached 40 texts (all 33 then-published USA TST entries
and seven ready ISL supplements), preserving 1,117 existing objects. Twenty-four additional
TST texts through 2016 are saved for exact future catalogue keys. The only active statement
hold is ISL 1994 G2, whose printed assertion is false; the prepared correction stays separate.
A transcription error in our new TST 2026/2 proposer credit was corrected to **Daniel Zhu**,
verified from its actual forum statement #1 and the supplied solution heading.
