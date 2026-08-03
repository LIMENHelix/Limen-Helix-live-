# CORPUS CONTRACT — energy domain artifacts

## Document metadata

These are **facts about this document**, not epistemic labels. An earlier version put
`MEASURED_SNAPSHOT` in an `authority:` field, which made a snapshot TYPE masquerade as one
of the six authorized labels. It is not one of them.

    document_type:        corpus contract
    scope:                Layers 1 and 2 only
    measured_at:          2026-08-02
    corpus_repository:    Limen-Helix
    corpus_commit:        57b3144a5e393541964f7334f24bb10632d76d1b
    corpus_dirty:         true (3,500 dirty worktree entries)
    source_snapshot_hash: 8b5fed51266141b9abc4d97e754b296e...
    artifacts:            27,165
    approved_by:          null
    recorded_by:          engineering agent (Claude)

**The commit does not identify this snapshot.** The worktree was dirty when it was read,
so `source_snapshot_hash` — folded over every (path, contentHash) pair in sorted order —
is what names what was actually measured.

## Epistemic labels — exactly six, one per interpretation

| label | meaning |
|---|---|
| `OWNER_CONFIRMED` | the owner stated it |
| `WRITER_CONFIRMED` | the code that writes the field was located and read |
| `AUTHORITATIVE_DOC_CONFIRMED` | a schema or spec document defines it |
| `MEASURED_PATTERN` | occurrence or correlation observed. **Establishes nothing about authorship, intended meaning, causality, quality, or external provenance.** |
| `HYPOTHESIS` | a candidate reading, not established |
| `UNKNOWN` | no writer and no authoritative definition located |

Every field below carries **exactly one**. Where measurement exists but meaning does not,
the label is `UNKNOWN` and the measurements are reported separately as data — a count is
not an interpretation.

---

## What this contract does NOT establish

No writer or authoritative definition was located for `_canonical`, `_authored`,
`issues[].resolved.source`, or the `circuits[].evidence` scale. Searching the full
595,286-file repository for writers of these fields returned candidates that write
*differently named* fields on *different objects* — notably
`scripts/resolve-portal-brain-node-mapping.mjs`, which writes a `source` of
`classifier_v1` / `hand_authored` / `inherited_unchanged` onto `brainNodeMapping`
cells per `docs/brain-node-mapping-schema.md §3`. **That is a different field.** It does
not define `issues[].resolved.source`.

Every field below is therefore labelled `UNKNOWN` or `MEASURED_PATTERN`, and never both. Layers 1 and 2 do not
need these meanings in order to work, which is why they were built first.

---

## Field register

### `circuits[].evidence`

- **Label:** `UNKNOWN`
- **Measured values (data, not an interpretation):** `"Moderate"` ×154,218 · `"Strong"` ×68,540 · `"Unrated"` ×584 = **223,342**, exactly the resolved-circuit count
- **Separate population:** authored circuits are `"Moderate"` ×1,731 · `"Strong"` ×821 = **2,552**, tallied under `authoredCircuitEvidence` and never pooled with the above
- **Writer:** not located
- **Permits:** grouping claims by identical raw string; reporting the distribution
- **Does NOT permit:** ordering the three values, treating `Strong` as better than
  `Moderate`, treating `Unrated` as an analogy, a refutation, or a zero, or mapping any
  of them onto the treatment scale
- **Namespace:** `circuitEvidence.raw`

### `treatments[].evidence`

- **Label:** `UNKNOWN`
- **Measured values:** `"A"` ×182,250 · `"B"` ×153,879 · `"C"` ×130,565 · `"Strong"` ×32 = **466,726**
- **Writer:** `scripts/treat_batch2.js` emits treatment objects carrying `evidence` and
  `cite`. That locates a writer of the FIELD but not a definition of its SCALE, so the
  field's label stays `UNKNOWN`: what A/B/C mean, and what thresholds separate them, is
  defined nowhere located.
- **Schema anomaly:** the 32 `"Strong"` values belong to the *circuit* vocabulary.
  Preserved unchanged, flagged `schemaAnomaly: true`, never converted to A/B/C.
  Rewriting them would destroy the evidence of the anomaly.
- **Does NOT permit:** comparison with `circuitEvidence`, or any assumption that A > B > C

### `treatments[].cite`

- **Label:** `MEASURED_PATTERN`
- **Measured, SCOPED TO TREATMENTS:** 445,376 claimed + 21,350 unknown = **466,726**. An earlier version reported "370,874 unknown", which pooled 346,972 records (circuits, authored circuits, activations) that carry **no citation field at all**. A record type without the field has not lost a citation.
- **Example values:** `"ASABE EP486 – Earthmoving Equipment Standards"`,
  `"NRCS CPS 560 – Access Road"`
- **Recorded as:** `citation.raw` plus `citationStatus: 'claimed' | 'unknown'`
- **Permits:** stating that the corpus asserts a citation
- **Does NOT permit:** treating the string as a *verified* citation. Nothing has resolved
  these to a real document. A claimed citation is `citation-claimed`, never confirmed.
- **Missing citation is `unknown`** — not absent, not false, not zero, not refuted

### `circuits[]._canonical`

- **Label:** `UNKNOWN`
- **Measured:** `true` ×584, and no other value anywhere
- **Population (measurement, not a second label):** appears on exactly 584 circuits, and only at
  L1 (6) + L2 (59) + L3 (519) = 584, co-occurring exactly with `_authored`,
  `resolved`, and every `"Unrated"` grade
- **Candidate readings, none established:** normalised/canonicalised data · the
  authoritative variant among several · hand-curated tier marker
- **Does NOT permit:** treating it as external provenance, as a quality signal, or as
  evidence that the claim is correct

### `issues[]._authored`

- **Label:** `UNKNOWN`
- **Shape:** array of `{nodeId, dir, detail, evidence}` — the same shape as `circuits[]`
- **Population:** 584 blocks, all L1–L3
- **Does NOT permit:** assuming precedence in either direction against `circuits[]`.
  **They are stored as separate claims** (`kind: 'circuit'` and `kind: 'authored-circuit'`)
  because merging them would silently decide which supersedes which.

### `issues[].resolved.source`

- **Label:** `UNKNOWN`
- **Measured:** `"override"` ×584, and no other value
- **Does NOT permit:** reading it as an evidentiary citation. It is preserved verbatim in
  `issueContext.resolvedRaw`.

### `activations[].state`

- **Label:** `MEASURED_PATTERN`
- **Measured:** `"active"` ×123,630 — **a single value across the entire corpus**
- **Consequence:** the field currently carries no discriminating information. A prototype
  channel derived a hypo/hyper imbalance from it; that channel would have returned `null`
  for every record in the corpus.
- **Does NOT permit:** any inference of activation level, direction, or intensity

### `activations[].companies`

- **Label:** `MEASURED_PATTERN`
- **Measured:** 295 company associations, concentrated at L1–L3, effectively zero below L4
- **Permits:** stating that an association exists in the corpus
- **Does NOT permit:** treating an association as an opportunity, a customer, a lead, a
  relationship, or evidence of commercial interest

### `_enrichment`

- **Label:** `UNKNOWN`  — an earlier version gave this TWO labels (`MEASURED_PATTERN`, `HYPOTHESIS`), which the one-label rule forbids. The population below is measurement; the reading below is a candidate, and neither makes the meaning known.
- **Keys:** `schemaVersion`, `networkMapVersion`, `neuralRoleMigratedAt`
- **Population:** 175 of 27,165 artifacts, scattered across all levels — **not a tier marker**
- **Candidate reading, unconfirmed:** transformation metadata describing *our* pipeline
- **Does NOT permit:** use as source provenance, freshness, or observation time, and
  **does not gate admission**. A prototype excluded 26,990 artifacts for lacking it.

### `domainId`

- **Label:** `MEASURED_PATTERN`
- **Uniqueness: NOT unique.** 27,160 distinct values across 27,165 artifacts.
  `"energy"` appears on **6 different artifacts**.
- **Consequence:** the artifact index is keyed on `relativePath`. Keying on `domainId`
  would have silently dropped five of those six.

---

## Artifact identity

```
{ repository, repositoryCommit, relativePath, contentHash, domainId, byteSize }
```

`fileModifiedAt` is retained as **non-authoritative operational metadata**. It never
determines identity, evidence, freshness, or observation time — a fresh clone changes
every mtime while changing nothing about any artifact.

---

## Layer boundaries

| layer | file | status |
|---|---|---|
| 1 — artifact index | `corpus/artifact-index.js` | built |
| 2 — raw claim store | `corpus/raw-claim-store.js` | built |
| 3 — semantic memory | `kernel/memory.js` | **NOT CONNECTED.** Its `assertClaim` requires citations; 370,874 claims have none, and no circuit claim has any citation field at all. The corpus does not meet that contract. |
| 4 — opportunity engine | — | **NOT BUILT.** Requires separate authorization. |

## Halted prototypes

`corpus/adapter.js` and `corpus/opportunity.js` are failed experimental prototypes,
retained untouched for an owner decision. **Nothing imports them**, and a test asserts
that. `adapter.js` contains the `_enrichment` admission gate and a single cross-vocabulary
evidence classifier — both of which this contract's measurements refute.
