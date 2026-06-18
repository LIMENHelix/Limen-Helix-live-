# Energy Missing Source-Bundle Coverage (G1b, 2026-06-17)

**Status:** 4 of 6 Energy canonical diagnoses have **no real artifact-source bundle**. No bundle
was fabricated or auto-aliased. The 4 stay `bundleStatus: "missing"` with blocker
`source-bundle-build-required`. This doc is the proof-backed proposal for human review.

## Search results (full repo, 556 bundles in `assets/data/artifact-source-index/by-diagnosis/`)

| Missing diagnosis | exact `<ID>.json`? |
|---|---|
| OIL_SHOCK | ❌ absent |
| PIPELINE_DISRUPTION | ❌ absent |
| NUCLEAR_INCIDENT | ❌ absent |
| SYSTEMIC_ENERGY_STRESS | ❌ absent |

All candidate bundles below are shallow (`portalCount` 1–2, `maxDepth` 0) — same root-only
limitation as the 2 already-shipped Energy bundles.

## Proposed alias/build table (NOT applied — human review required)

| diagnosisId | candidateBundle | bundle domain | reason | confidence | risk | action |
|---|---|---|---|---|---|---|
| PIPELINE_DISRUPTION | `PIPELINE_RUPTURE_EVENT` | infrastructure | Direct semantic match (label "Pipeline rupture event"); treat=4/evAnch=32/mech=4; cross-domain precedent already accepted (GRID_COLLAPSE→GRID_FREQUENCY_INSTABILITY is also infrastructure-domain). | **HIGH** | MEDIUM — infra-domain corpus, not energy-native; "disruption" is broader than "rupture". | **ALIAS-CANDIDATE** — recommend approve as alias after one human check. |
| SYSTEMIC_ENERGY_STRESS | `CAPACITY_SHORTFALL` / `CASCADING_TRIP_SEQUENCE` / `SUPPLY_DISRUPTION` (all energy-domain) | energy | Multiple energy-domain candidates, but each is a *specific* failure; SYSTEMIC_ENERGY_STRESS is an **aggregate/meta** diagnosis with no single corpus equivalent. | **MEDIUM** | HIGH — aggregate→specific mapping would mislabel; picking one hides the others. | **BUILD (composite)** — do not alias to one; build a systemic bundle or compose from the energy-domain set. |
| OIL_SHOCK | (none oil-specific; closest `SUPPLY_DISRUPTION`, energy) | energy | No oil/crude/petroleum/price-shock bundle exists. `SUPPLY_DISRUPTION` is generic supply, not an oil price shock. | **LOW** | HIGH — semantic mismatch (price shock ≠ supply disruption). | **BUILD** — no acceptable source; build from verified root/source material. |
| NUCLEAR_INCIDENT | `NUCLEAR_PROLIFERATION` (defense) / `FUEL_ROD_DEGRADATION` (energy) | defense / energy | `NUCLEAR_PROLIFERATION` is weapons-domain (wrong semantics for a safety incident); `FUEL_ROD_DEGRADATION` is one reactor failure mode, not an incident. | **LOW** | HIGH — proliferation alias would be a category error. | **BUILD** — no acceptable source; build a nuclear-incident bundle. |

## Recommendation (the mechanical next step)
- **1 alias-candidate** pending human approval: `PIPELINE_DISRUPTION → PIPELINE_RUPTURE_EVENT` (HIGH confidence). If approved, add to the energy alias map (like the existing 2) and ship the real `PIPELINE_RUPTURE_EVENT.json`.
- **3 require a build (G1c):** OIL_SHOCK, NUCLEAR_INCIDENT (no acceptable source), and SYSTEMIC_ENERGY_STRESS (aggregate — build or compose). None should be auto-aliased.
- Until then: the 4 stay `missing` + `source-bundle-build-required`; candidate arrays stay empty; nothing fabricated.

## Build plan sketch (G1c, when authorized)
Build each missing bundle from **verified root/source material only** (root portal issues/treatments
for the energy sub-domains: fossil/oil, pipeline, nuclear, grid/systemic), in the existing bundle
shape (`byLane.patents.{treatments,implementationSteps,mechanism/embodiment/figureCandidates,evidenceAnchors}`),
marked `portalCount`/`maxDepth` honestly. No invented evidence; if root material is thin, the bundle
stays small and flagged `source-bundle-root-only`.
