# Energy K2 — Portal Reality Classifier v2

**Date:** 2026-06-18  **Probe:** `scripts/_taxonomy-pilot/k2-energy-portal-reality-classifier.cjs` (read-only)
**Classifier:** `classifyPortalV2` in the canonical `_portal-real-content-classifier.cjs` (reusable)
**Index:** `assets/data/deep/energy-portal-quality-index.json` (47 KB)
**Verdict:** **No portal at any depth (L0–L6) is evidence-eligible.** The deep substrate is uniformly
`DANGEROUS` (authority masquerade). Real evidence lives only in the curated external-source bundles.

## Six-way classification + admissibility

| Class | Evidence? | Context? | Traversal? | Bundle? | Meaning |
|---|---|---|---|---|---|
| REAL | ✅ | ✅ | ✅ | ✅ | verifiable provenance + companies + non-template treatments |
| MIXED_CONTEXT_ONLY | ❌ | ✅ | ❌ | ❌ | real companies, but template treatments / no provenance |
| SYNTHETIC | ❌ | ❌ | ❌ | ❌ | template treatments, no companies, no provenance |
| **DANGEROUS** | ❌ | ❌ | ❌ | ❌ | **evidence grades / DOI citations on templated content with NO verifiable provenance — looks sourced, isn't** |
| NEEDS_AUTHORING | ❌ | ❌ | ❌ | ❌ | thin structural node — an authoring slot |
| EMPTY | ❌ | ❌ | ❌ | ❌ | no content |

## Classification by depth (representative sample, 620 portals)

| Depth | sampled | REAL | MIXED_CONTEXT | SYNTHETIC | DANGEROUS | EMPTY |
|---|---|---|---|---|---|---|
| L0 | 1 | 0 | 1 | 0 | 0 | 0 |
| L1 | 19 | 0 | 10 | 0 | 9 | 0 |
| L2 | 120 | 0 | 1 | 0 | 119 | 0 |
| L3 | 120 | 0 | 0 | 0 | 120 | 0 |
| L4 | 120 | 0 | 0 | 0 | 120 | 0 |
| L5 | 120 | 0 | 0 | 0 | 120 | 0 |
| L6 | 120 | 0 | 0 | 0 | 120 | 0 |

**Totals:** DANGEROUS 608 · MIXED_CONTEXT_ONLY 12 · **REAL 0** · SYNTHETIC 0 · EMPTY 0.

## The key findings

1. **Zero REAL portals.** Across the whole sample, nothing has verifiable provenance (0 source URLs,
   0 `sources[]` fields in 400 deep files scanned). The only evidence-eligible material Energy has is the
   curated external-source bundles (G1d) — **not** the portal cortex, at any depth.
2. **The deep substrate is `DANGEROUS`, not merely synthetic.** Every deep portal carries an `evidence`
   grade (A/B/C) and many carry DOI citations (166/400) on **templated treatments with no companies and no
   verifiable provenance**. This is authority masquerade — the most insidious failure mode, because naive
   admission would inject "evidence-grade" fabrications. This is the strongest possible justification for
   the immune/conscience gates built in H1–H3.
3. **L1/L2 confirmed quarantined.** `energy_grid` (L1) → MIXED_CONTEXT_ONLY (companies real, treatments
   template → context only, not evidence). `energy_battery_battrecycling` (L2) → DANGEROUS. Both
   `admissibleAsEvidence = false`. Consistent with J1.
4. **Even L0 is context-only, not evidence.** `energy.json` has real companies + noun-phrase treatments but
   no verifiable provenance → MIXED_CONTEXT_ONLY. The classifier holds a strict provenance bar: real
   companies + real-sounding treatments still don't make evidence without a source.

## Per-diagnosis rollup (sampled)

| Diagnosis | sampled | evidenceEligible | contextOnly | dangerous |
|---|---|---|---|---|
| GRID_COLLAPSE | 26 | 0 | 1 | 25 |
| OIL_SHOCK | 26 | 0 | 1 | 25 |
| NUCLEAR_INCIDENT | 26 | 0 | 1 | 25 |
| RENEWABLE_INTERMITTENCY | 13 | 0 | 1 | 12 |
| PIPELINE_DISRUPTION | 17 | 0 | 1 | 16 |
| SYSTEMIC_ENERGY_STRESS | 33 | 0 | 0 | 33 |

For each diagnosis: exactly one context-only portal (the L1 branch with real companies), the rest DANGEROUS.

## Authoring / rehydration queue (feeds K5)

Diagnosis-branch portals classified DANGEROUS/SYNTHETIC/NEEDS_AUTHORING are emitted as candidates with an
action: `replace-fake-authority-with-sourced-content` (DANGEROUS/SYNTHETIC) or `author-missing-fields`
(NEEDS_AUTHORING). These are the portals to **rehydrate** — not trust. No facts are fabricated; the queue
records what must be authored from real sources.

## Acceptance (9/9)

L1 reclassified context-only · L2 blocked · deep dominated by DANGEROUS/SYNTHETIC · DANGEROUS category
detected · nothing admitted as evidence · authoring queue produced · classifier v2 is the shared canonical
module · compact index written · doc present.

## What this means for K3–K7

- **K3 certified index:** `evidenceEligible` will be **empty from portals** — populated only by external
  bundles. `contextOnly` = the L0/L1 company-bearing portals. `tickerOnly_relevanceUnverified` = L1 tickers.
  `blockedSynthetic` + `dangerous` = the rest. `authoringQueue` = the K2 candidate list.
- **K4 retrieval:** must surface DANGEROUS portals with a hard block (never into prompt/evidence), context
  portals with a warning, and authoring needs.
- **K6 rehydration:** the practical path is to author real content into diagnosis-branch portals from primary
  sources — converting DANGEROUS nodes into REAL ones — not to traverse what exists.

Nothing admitted. No traversal. Immune/conscience untouched. Template-lock gate (H7 + J + 5 critical gates) green.
