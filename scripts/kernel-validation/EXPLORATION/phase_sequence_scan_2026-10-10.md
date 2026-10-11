# EXPLORATION — Phase-sequence scan (2026-10-10)

**Mode: EXPLORATION** (standing rule, THING2_REPLACEMENT_PLAN.md). Everything
below is an observation or a hunch. No claims, no pass bars, nothing to
defend. Task from the operator: run the phase reader across all domains and
entities; log which phase sequences occur, and whether the same sequence
appears at company, sector, and domain level.

Instrument: fpm-r2 walked point-in-time over every `facts_*.json` in
`board_cache/` (last 40 revenue quarters per entity; solvency recomputed per
quarter; sector = coarse 5-way grouping of the board's 20 domains;
domain/sector walks = plurality verdict across member entities, UNKNOWN
votes included). Runner: `phase_sequence_scan_2026-10-10.py`; raw output:
`phase_sequence_scan_2026-10-10.json`.

## Instrument observations

- Reading quarter q as of q's own end is impossible — the filing does not
  exist yet — and fpm-r2's zero-gap rule then yields UNKNOWN on every
  position (first pass: 413 of 466 entities all-UNKNOWN). The walk now reads
  quarter q at the END of q+1 (10-Q ~40d, 10-K ~60–90d availability).
- 466 of 535 cached files yielded walks. 69 did not (no decumulated revenue
  or unreadable file).

## What occurred

**Census.** 215 distinct compressed sequences across 466 entities. The
recurrent shapes (count = entities):

| compressed sequence | n | examples |
|---|---|---|
| UNKNOWN_INSUFFICIENT_HISTORY (never readable in 40q) | 54 | ACM, ACN, AXSM, BRKR |
| p2 | 42 | A, ACN, ADM, ADP |
| UNKNOWN_NOT_BUILT | 18 | ADI, CAT, CVX, CWCO |
| p2 → NOT_BUILT → p2 | 14 | AMZN, AON, BKNG, EL |
| p2 → NOT_BUILT | 14 | APD, BRO, CNHI, EA |
| INSUFF_HISTORY → p2 | 10 | BAH, DCI, ETN, GEV |
| NOT_BUILT → p2 → NOT_BUILT → p2 → NOT_BUILT | 8 | AGCO, CCRN, EMR, GMED |
| INSUFF_HISTORY → NOT_BUILT | 8 | ARM, AVGO, CEG, CORT |
| p2 → NOT_BUILT → p2 → NOT_BUILT | 8 | AZTA, D, HPE, MWA |
| NOT_BUILT → p0 → NOT_BUILT | 6 | ABT, AMAT, BMY, PENN |
| NOT_BUILT → p0 | 6 | AKAM, AMED, CSGP, IQV |

**Observation 1 — the dominant motif is p2 ↔ UNKNOWN_NOT_BUILT
alternation.** Pure shapes (54+42+18) account for only ~25% of entities; the
bulk of the long tail alternates p2 and NOT_BUILT at quarter or multi-quarter
period (some for the entire 40-quarter walk: ABBV, BRK.B, GOOGL). A single
company flipping between "rhythm" and "no detector fired" quarter-to-quarter
with a sliding 16-quarter window smells like a marginal-threshold strobe at
the coherence/amplitude boundary, not regime change. *Hunch:* re-run the
strobing companies emitting the raw intermediates (coh, amp, lock per
quarter) and look for values hovering at 0.5 / 0.03 / 0.6.

**Observation 2 — P4 and P5 are transient in walk form.** They appear
mid-sequence (domain walks: agriculture …→p5→p2…, intelligence shows
p4→p2→p4…, religion …→p2→p0…→p4…) but almost never as a company's dominant
shape, and never as the plurality of a domain for long. Companies that read
p5 at the latest quarter (the board's single-point channel shows 35) got
there recently — their 40-quarter walks are long p2/NOT_BUILT histories with
a short p5 tail.

**Observation 3 — UNKNOWN_INSUFFICIENT_HISTORY has two distinct
populations.** (a) A warmup prefix present in nearly every walk (first ~7
positions: history floor + TTM boundary) — instrument-shaped, not
company-shaped. (b) 54 entities UNKNOWN across all 40 quarters — sparse
filers / short histories / gap-laden series.

**Observation 4 — the finance domain reads pure UNKNOWN_NOT_BUILT** (all 28
financials, whole walk). The r1 detectors don't fire on bank-style flows
(CFF includes deposits; interest-income revenue doesn't phase-lock the same
way). Finance is the only domain with a single-state walk.

**Observation 5 — cross-scale recurrence.** 10 company-level patterns also
appear verbatim in ≥1 aggregated walk. One pattern appears at all three
levels — company AND domain AND sector walk:
`INSUFFICIENT_HISTORY → NOT_BUILT → p2` (7 companies). `p2` (42 companies)
shows in domain walks but never as a sector walk — sector plurality smooths
pure-p2 domains into alternations when members desynchronize. Every one of
the 20 domains and all 5 sectors produced a readable sequence; most end in
p2 or an alternation that resolves to p2.

## Next observations to run

1. Strobe anatomy: per-quarter coh/amp/lock for the alternating companies
   (Observation 1 hunch).
2. P4/P5 dwell-time distribution: how long scaffold/endurance episodes last
   when they do occur (Observation 2).
3. The 54 never-readable entities: what do their filing patterns look like
   (Observation 3b).
4. Finance-reader sketch: what a bank-flow-aware rhythm detector would read
   on the same facts (Observation 4).
5. Standing agenda: map P0–P10 against Holling's adaptive cycle (r–K–Ω–α);
   test whether revolt/remember links appear in data (segment-level vs
   company-level).
