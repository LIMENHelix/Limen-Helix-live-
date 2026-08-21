# PROTECTED FILES — the register

Internal. Firewalled in `.vercelignore`.

**§3 of the master system prompt should defer to this file rather than naming paths inline.**
Inline names in a prompt re-enter context every session and re-sanctify whatever they contain,
including things that do not exist. This register is the single place a path is asserted, and
every entry states **what the artifact is**, not only where it lives — because the failures this
file exists to prevent were all name-checked-against-the-wrong-object.

Three dispositions, and the distinction is load-bearing:

| | meaning |
|---|---|
| **PROTECTED** | load-bearing and believed correct. Do not change internals without an explicit task. |
| **QUARANTINED** | present, not load-bearing, not yet judged. Do not extend, do not delete, do not cite as evidence. |
| **DEPRECATED** | superseded for its original role but still load-bearing for a stated remaining one. Do not cite it for the superseded role, do not delete it, and do not migrate the remaining consumer without replacing what it supplies. |
| **PHANTOM** | named somewhere as if real. Does not exist. Recorded so it is not re-sanctified. |

Protecting dead code is the same failure as protecting a phantom, one rung up. A path may not be
PROTECTED without a stated reason it is load-bearing.

---

## PHANTOM

### `connectome-weights.json` — DOES NOT EXIST

Named in §3 of the master system prompt as a file to protect. It is not in this repo, under any
path. Verified 2026-08-01 by full-tree search.

It is not merely unused — it is **actively depended on**:

- `assets/js/propagation-engine.js:178` — `url = url || 'connectome-weights.json'`, then fetches it
- production returns **HTTP 404** for `/assets/data/connectome-weights.json`

Do not create a file to satisfy the name. Decide first whether the propagation engine should exist
at all (see QUARANTINE below); if it should, the weight source already exists and is named in the
PROTECTED section — it is not this.

### `432-edge connectome weight matrix` — DESCRIBES NO OBJECT

`assets/js/propagation-engine.js:3`. Verified 2026-08-01: **3,365 edge-bearing JSON files in the
repo, zero with 432 edges.** Largest single edge set is 87 (`domains/defense.json`,
`domains/law.json`). Not a sum either — five domain files total 416, all twenty total 1,444.

Struck. The number should not appear in any artifact. It is retained on line 3 only as the sole
surviving evidence of what the module was intended to do (see QUARANTINE).

---

## DEPRECATED

### `assets/data/brain-nodes-111.json` — deprecated as a taxonomy source, retained as a prose source

**Deprecated as taxonomy source; retained as prose source for `build-neuro-disorder-lookup.mjs`
pending migration.** Not to be deleted.

- **Its name is wrong and its contents are wrong for the name.** "111" is a stale label; the file
  holds **129** legacy numeric-id records (`id: 1…129`), including entries the canonical set
  deliberately excludes. The canonical registry is `assets/data/canonical-nodes.json` — **123**
  nodes, `_meta.total` now enforced by `scripts/check-repository.mjs`.
- **It was never the cube's taxonomy.** `build-treatment-discovery-cube.mjs` declared a
  `NODES_111_FILE` constant and **never referenced it** — dead code, removed 2026-08-19. Anyone
  reading that constant would conclude the cube was built off this file. It was not.
- **One real consumer remains.** `scripts/build-neuro-disorder-lookup.mjs:223` reads it for
  `region`, `network`, `function` and `dysregulation` **prose**. Canonical carries none of those
  fields (it carries `class`, `canBindBusiness`, `motif`, `tier`, `fractalWeight`,
  `businessFunction`, `role`, `failureModes`). Repointing that consumer at canonical would
  silently strip the prose, so it has deliberately **not** been repointed.
- **Migration condition:** move it only once canonical (or another registry) supplies the prose
  fields. Until then this file is the only surviving record of the legacy numeric-id schema and
  its `limen_phase` assignments.

---

## QUARANTINED

### `assets/js/propagation-engine.js` — T1, quarantined 2026-08-01

Spreading activation over a connectome. Present and syntactically fine. Also:

- **no HTML page loads it** — verified by full-tree grep
- fetches `connectome-weights.json`, which does not exist (404 in production)
- its only distinguishing figure, 432 edges, describes no object in the repo

That is four No-Shortcut rows failing at once: file exists ≠ implemented, import ≠ wired, wired ≠
invoked, invoked ≠ effective.

**Not protected**, because protection means load-bearing-and-correct and this is neither.
**Not deleted**, because the 432 comment is the only surviving record of the intended design, and
destroying it would remove the evidence before anyone has judged whether the intent was sound.

Decide before extending: was spreading activation over a weighted connectome a good idea that was
never wired, or an idea that was abandoned for a reason nobody wrote down?

---

## PROTECTED

### `assets/data/brain-connectome.json` — the L2 ANATOMY. Not a weight source.

65 edges, typed (`excit` 25, `fast` 16, **`inhib` 6**, `modul` 4, `auto` 5, `hormonal` 3,
`peptide` 4, `plastic` 2). **No weight field on any edge** — all 65 read `(none)`.

Load-bearing because `lib/limen-stress-propagator.js` `loadInhibitoryEdges()` reads exactly the six
`inhib` edges (CAUD→GP, GP→THAL, HAB→RAPHE, HAB→VTA, PUT→GP, vmPFC→BLA) and they are the only
regulatory (non-additive) term in the live propagation. Live check: `inhibitoryEdgesLoaded: 6`,
354 of 795 nodes damped.

This file was absent from the immune workflow's sparse checkout until 2026-07-31, so every
committed snapshot reported `inhibitoryEdgesLoaded: 0` and `/vitals` showed "0 damped" while the
running system was regulating normally. Keep it in the checkout.

### `assets/data/domains/*.json` — the WEIGHT SOURCE. Not the anatomy.

**1,444 weighted edges across 18 readable domain files** (78-87 each). Measured weight
distribution over five files / 416 edges: `0.7 ×115 · 0.6 ×109 · 0.8 ×71 · 0.85 ×52 · 0.95 ×40 ·
0.75 ×10 · 0.9 ×10 · 0.5 ×5 · 0.65 ×4`.

**Type these weights `[PROJECT HYPOTHESIS]`, never `[VERIFIED FACT]`.** Nine values, all on a 0.05
grid, none below 0.5, none above 0.95 — a hand-authored set. Weighted-degree, rich-club and
small-world are computable on this graph, and what they measure is the author's model of the
domain, not an observed structure.

**If small-world sigma is computed, it must be run against a rewired null preserving this weight
distribution, or the number is decoration.** A graph with no weak edges returns high clustering
and high sigma close to trivially, because weak ties are what make the measure informative. The
floor at 0.5 is an authoring convention, and sigma would be reporting the convention.

### `lib/limen-stress-propagator.js`

795 nodes, 13,010 edges, hourly. Consumed by `handlers/limen-worker-stress-refresh.js` and served
at `/api/limen-stress-slim`; `company-portal.html:105` renders it. Carries a hub exclusion on
stated grounds ("a bank is highly connected, not distressed"), self-loop and return-to-source
guards, and a per-edge cap. Correct and load-bearing.

### `lib/phase-estimator.js`

The precision-weighted fusion core, and the strictest honesty convention in the repo — including
the rule any new module should inherit verbatim: *"the fusion mechanics are well-evidenced, the
state space is not — do not let one launder the other."*

### `scripts/heal-corpus.mjs`

Daily offline pass with **write authority over the corpus**, and since 2026-07-31 it verifies its
own effect: success requires the measured defect count to fall, not the exit code to be zero.

Structurally this is efference copy plus reafference cancellation already running in production —
emit a command, state a predicted consequence, measure the actual, let the **residual** gate the
success claim. Any new actuated path should copy this contract rather than invent one.

---

## CORRECTIONS ISSUED FROM THIS PASS

### `BRAIN_COMPLETENESS_ANALYSIS.md:51` — "every edge weight hardcoded 0.3"

**False.** Corrected in place 2026-08-01. The line concluded that weighted-degree, rich-club and
small-world metrics are "impossible." They are not impossible; 1,444 weighted edges exist across
the domain files, with nine distinct values and none equal to 0.3.

The diagnosis read `brain-connectome.json` (65 edges, genuinely unweighted) and reported it as the
whole graph. Same error class as the phantom path: a claim checked against the wrong object.

This correction runs *against* the diagnosis, which makes it the more expensive of the two errors —
a missing file causes inaction on one file, whereas a false structural claim declared an entire
class of analysis impossible and closed it to inquiry.

---

## STANDING SCORE, recorded with its denominator

**3 of 15**, not 3 of 28. Rows 8, 9 and 26 of the Part 8 checklist pass for `brain-v2/`.

The denominator is 15, not 28, because roughly 13 rows are gated behind a motor loop that does not
exist — rows 1-2 gate row 21, rows 12-15 gate everything downstream of consolidation. Scoring
against 28 lets a future session re-derive 3/28 and report improvement that did not happen.

All three passing rows are afferent-side. That is a coherent picture and it should be stated as
one: **the system senses somewhat and acts not at all.**

One motor-side row is now claimable: **row 2** (execution flag written by the actuator, not the
approver) closed for `heal-corpus.mjs` on 2026-07-31, after nineteen days of `success: true` on a
defect count that never moved.
