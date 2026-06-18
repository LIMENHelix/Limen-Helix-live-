# Energy K3 — Certified Cortex Index

**Date:** 2026-06-18  **Probe:** `scripts/_taxonomy-pilot/k3-energy-certified-cortex-index.cjs` (read-only build)
**Index:** `assets/data/deep/energy-certified-cortex-index.json` (52 KB) · built from K1 + K2 only
**Verdict:** The portal-truth layer is now machine-readable. Portal tree = navigation/context/authoring
substrate; the **only evidence-bearing layer is the curated external-source bundles.** Nothing admitted.

## The rule, made machine-readable

> Portal tree = navigation / context / authoring substrate only. No L2–L6 portal is admissible as
> evidence. The only evidence-bearing layer is the curated external-source bundles.

## Four groups

### 1. evidenceEligible
- **Portals: 0** — by design. `classifyPortalV2` returned `REAL` for **zero** portals (no verifiable
  provenance anywhere in L0–L6).
- **External bundles: 6** (verifiable, anchors > 0):

  | Diagnosis | Bundle | Anchors | Build | Human-verify |
  |---|---|---|---|---|
  | GRID_COLLAPSE | GRID_FREQUENCY_INSTABILITY | 32 | corpus | — |
  | RENEWABLE_INTERMITTENCY | INTERMITTENCY_SPIKE | 32 | corpus | — |
  | PIPELINE_DISRUPTION | PIPELINE_RUPTURE_EVENT | 32 | corpus | — |
  | OIL_SHOCK | OIL_SHOCK | 4 | external-source | **required** |
  | NUCLEAR_INCIDENT | NUCLEAR_INCIDENT | 2 | external-source | **required** |
  | SYSTEMIC_ENERGY_STRESS | SYSTEMIC_ENERGY_STRESS | 3 | external-source | **required** |

### 2. contextOnly (11 portals — never evidence)
`energy` (L0) + 10 company-bearing L1 branches (`energy_battery`, `energy_grid`, `energy_nuclear`,
`energy_fossil`, `energy_solar`, `energy_hydro`, `energy_pipeline`, `energy_power`, `energy_transmission`,
`energy_energytrade`). All `MIXED_CONTEXT_ONLY`: real company tickers (relevance-unverified) + templated
treatments → usable as context, `admissibleAsEvidence = false`.

### 3. blockedDangerous
- **Policy: ALL L2–L6 portals blocked** from evidence/bundle/traversal by default.
- **Deep tree (L3–L6): 26,967 files** blocked.
- Sampled (K2): **608 DANGEROUS**, 0 SYNTHETIC. Reason: deep sample was 100% authority-masquerade
  (evidence grades / DOI citations on templated content, no provenance, no companies).

### 4. needsRehydration (136 queued)
The K2 diagnosis-branch authoring queue, carried verbatim — portals to **replace** with sourced content
(`replace-fake-authority-with-sourced-content`), not trust. Feeds a future K5/K6 authoring effort.

## Verification (12/12)

K1 present · K2 present · K3 generated · **0 portals admitted as evidence** · external bundles verifiable
(anchors > 0) · external-source bundles flagged human-verification-required · contextOnly all
`admissibleAsEvidence=false` · blockedDangerous matches K2 rollup (608) · needsRehydration = K2 queue (136) ·
index inert (`consumedByRuntime=false`) · 52 KB (< 300 KB) · doc present.

## Boundary / non-regression

The index is **inert** — no runtime reads it, so no behavior changed. Immune/conscience gates untouched.
Template-lock gate (H7 + J + 5 critical gates) still green. No traversal, no rewrite, no rehydration, no
Hono/Vercel/manifest/Redis/Python/Stripe/AI-spend touched.

## Done — Energy portal-truth layer is complete

K0 (located) → K1 (mapped) → K2 (classified) → **K3 (certified)**. The truth is now explicit and
machine-readable without becoming a repair project. Per the lane plan, **pausing the Energy portal lane
here** and returning to the manifest/downsizing queue. Rehydration (K5/K6) remains available on demand.
