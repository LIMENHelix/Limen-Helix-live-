# Energy K6 — Cortex Rehydration Plan

**Date:** 2026-06-18  **Type:** planning doc (no code, no data change)
**Inputs:** K1 access map · K2 reality classifier · K3 certified index · K5 authoring queue
**Purpose:** the practical path to convert *some* synthetic portals into real cortex — distinguishing
**source-building** (human authoring from primary sources) from **code-wiring** (mechanical). No synthetic
branch is treated as complete; nothing here admits or fabricates.

## The shape of the problem (from K0–K3)

- 26,967 deep portals (L3–L6) exist + are reachable via `/api/fetch-portal`, but **0 are evidence-eligible**:
  100% DANGEROUS (authority masquerade — evidence grades / DOI citations on templated content, no provenance).
- The only evidence layer is the 6 curated external-source bundles. 3 are full corpus (32 anchors); 3 are
  external-source-authored and thin (OIL 4, NUCLEAR 2, SYSTEMIC 3 anchors) with empty method/embodiment/figure.
- **Rehydration ≠ traversal.** You don't make the deep tree real by crawling it. You author real content
  into the diagnosis-branch nodes (or the bundles) from primary sources, then re-classify.

## What "evidenceEligible" requires (the bar the classifier enforces)

A node/bundle becomes evidence-eligible only when `classifyPortalV2` returns REAL: **verifiable provenance
(source URL or `sources[]`) + real companies + non-template treatments**. So rehydration must add, per branch:
real source references (URL/DOI that resolves), de-templated treatments, and (for patent/grant) method/
embodiment/figure candidates drawn from a primary document.

## Branch-by-branch plan (priority order)

Priority is by diagnosis value + how close the branch is to a usable evidence layer. Recommended first
branch: **NUCLEAR** (smallest gap, highest-authority public sources, thinnest current bundle).

### 1. NUCLEAR (recommended first)
- **Now:** bundle OIL/NUCLEAR-class = 2 anchors (IAEA/NRC), method/embodiment/figure empty; deep `energy_nuclear_*` portals DANGEROUS.
- **Why synthetic:** deep nuclear treatments are templated, no provenance, no companies.
- **Source material:** IAEA INES event reports, NRC event notifications + 10 CFR, nuclear patent literature.
- **Fields to author:** 3 method + 3 embodiment + 1–2 figure candidates; +2–4 more evidence anchors.
- **Evidence-eligible when:** bundle has ≥1 sourced method + verifiable anchors → conscience lifts patent/grant veto for NUCLEAR.
- **Tests:** g1d-style probe (anchors have URLs, no fabricated candidates), classifyPortalV2 → REAL on the rehydrated bundle, K4 retrieval returns it as evidence without HV-required warning once human-verified.
- **Supports:** bundles + context; NOT live deep traversal (deep portals stay blocked).
- **Lift:** small–medium (public, authoritative, well-structured sources).

### 2. FOSSIL / OIL
- **Now:** OIL_SHOCK bundle 4 anchors (EIA/IEA/OPEC/DOE), candidates empty; `energy_fossil_*` DANGEROUS.
- **Source:** EIA STEO + Weekly Petroleum, IEA OMR, OPEC MOMR, DOE SPR, refining/pipeline patents.
- **Fields:** method/embodiment/figure; richer price-shock + supply-disruption anchors.
- **Evidence-eligible when:** sourced mechanism + anchors. **Lift:** medium (data-rich, frequent updates).

### 3. GRID
- **Now:** GRID_FREQUENCY_INSTABILITY bundle is full corpus (32 anchors) — the *strongest* starting point; deep `energy_grid_*` DANGEROUS.
- **Source:** NERC reliability standards, IEEE 1547/1366, ISO/RTO filings.
- **Gap:** mostly de-templating deep treatments + verifying company relevance; the bundle is already solid.
- **Evidence-eligible when:** already closest — needs method/embodiment if patent lane desired. **Lift:** low–medium.

### 4. PIPELINE
- **Now:** PIPELINE_RUPTURE_EVENT (human-approved alias) full corpus (32 anchors); deep portals DANGEROUS.
- **Source:** PHMSA incident reports, API 1160, 49 CFR 192.
- **Note:** alias is human-approved (risk medium) — keep the alias warning. **Lift:** low–medium.

### 5. SYSTEMIC ENERGY STRESS
- **Now:** bundle 3 anchors (NERC/FERC/EIA), candidates empty; broadest, fuzziest branch.
- **Source:** NERC reliability assessments, FERC orders, EIA electricity.
- **Lift:** medium–high (cross-cutting; hardest to scope crisply).

### 6. RENEWABLE / INTERMITTENCY
- **Now:** INTERMITTENCY_SPIKE full corpus (32 anchors); deep `energy_solar/hydro/storage/offgrid_*` DANGEROUS.
- **Source:** NREL, IEA PVPS, ISO interconnection studies.
- **Lift:** low–medium.

## Source-building vs code-wiring (explicit split)

- **Source-building (human, the real work):** author method/embodiment/figure + real anchors from the
  primary sources above. This is the K5 queue (priority 1 = 9 bundle gaps; priority 2 = 136 portal replacements).
- **Code-wiring (mechanical, already mostly built):** wire authored content into a bundle file (G1d shape),
  re-run classifyPortalV2 → REAL, and the existing K3 index + K4 retrieval pick it up automatically. No new
  engine needed — the certified index + retrieval layer already consume bundles.

## Guardrails (unchanged)

No synthetic branch is "complete" until classifyPortalV2 returns REAL on real content. Deep portals stay
blocked from evidence/traversal regardless. Immune/conscience gates remain the enforcers. Authoring is
human; the system records the queue and re-classifies — it never invents.

## Recommended first action

Author the **NUCLEAR** bundle's 3 method + 3 embodiment + 1 figure candidates from IAEA/NRC + patent
literature (K5 priority-1 tasks), human-verify, wire into `NUCLEAR_INCIDENT.json`, re-classify. Smallest
proven path from "0 evidence portals" to "1 evidence-eligible diagnosis with real depth."

## Next: K7 — final deep-portal rescue audit.
