# Energy Portal Cortex Content-Quality Audit (C1, 2026-06-17)

**Read-only.** No runtime changes. Probe: `scripts/_taxonomy-pilot/c1-energy-portal-cortex-audit.cjs`.
Classifier: a portal file is **REAL** if it has real companies + non-template treatments,
**MIXED** if real companies but template (mad-lib) treatments, **SYNTHETIC** if no companies +
template treatments, **EMPTY** otherwise. Template = treatment label starts with a generic
management verb (Develop/Establish/Implement/…); real treatments are noun phrases
("Diversified Generation Portfolio") — verified 0/32 L0 reals start with a verb.

## L0–L6 level count + quality table

| Level | files | REAL | MIXED | SYNTH | EMPTY | companies | avg template-treatment ratio | verdict |
|---|---|---|---|---|---|---|---|---|
| **L0** | 1 | 1 | 0 | 0 | 0 | 57 | **0.00** | **REAL** |
| **L1** | 19 | 0 | 10 | 9 | 0 | 169 | **0.71** | **MIXED** (real companies, template treatments) |
| **L2** | 173 | 0 | 1 | 169 | 3 | 34 | **0.70** | **SYNTHETIC** (98% synthetic) |
| L3–L6 | 0 | — | — | — | — | — | — | not deployed in live repo |

## Real-vs-synthetic classification (the core finding)
- **Only L0 (`energy.json`) is REAL** — 57 real companies (GE Vernova, Duke Energy, …) and 32 authored, specific treatments ("Diversified Generation Portfolio", "Advanced Reactor Designs", "Probabilistic Safety Assessment", "Carbon Capture and Storage", "Stranded Asset Risk Assessment"). Diagnosis-relevant content lives here, tagged to brain nodes via `issue.circuits`.
- **L1 is MIXED** — real parent companies are present, but **71% of treatments are mad-lib** ("Develop Nuclear Power Assessment & Diagnostics Training Curriculum", "Build … Standards & Governance Assessment Protocol"). The node skeleton is the repeated 9-group template.
- **L2 is SYNTHETIC** — 169/173 synthetic: **no companies**, fully template treatments. This is noise.
- **No portal level at any depth carries `evidenceAnchors`, `methodCandidates`, `mechanismCandidates`, `embodimentCandidates`, or `figurePlaceholders`** — those are bundle-build artifacts, absent from the portal corpus entirely.

## Diagnosis → portal candidate map

| Diagnosis | best branch | class | usable real content |
|---|---|---|---|
| GRID_COLLAPSE | energy_grid | MIXED | companies yes; treatments template |
| RENEWABLE_INTERMITTENCY | energy_hydro / energy_solar | MIXED | companies yes; treatments template |
| PIPELINE_DISRUPTION | energy_pipeline | MIXED | companies yes; treatments template |
| OIL_SHOCK | energy_fossil | MIXED | companies yes; L0 has real fossil treatments (CCS, stranded-asset) |
| NUCLEAR_INCIDENT | energy_nuclear | MIXED | companies yes; L0 has real nuclear treatments (reactor designs, PSA) |
| SYSTEMIC_ENERGY_STRESS | energy_grid / energytrans | MIXED | companies yes; L0 grid treatments real |

Every diagnosis has a usable (MIXED) L1 branch for **companies**, and L0 carries some **real treatments** mappable to each via brain-node circuits — but **none** has artifact-grade evidence anchors/candidates at any portal level.

## Usable vs excluded branches
- **Usable (12):** `energy` (L0, REAL) + the 11 MIXED L1 roots (energy_grid, energy_nuclear, energy_fossil, energy_pipeline, energy_hydro, energy_solar, energy_power, energy_transmission, energy_battery, energy_energytrade, energy_carbon_cap).
- **Excluded (181):** the L2 synthetic mass + empty L1 shells. **Do not feed these to bundles or traversal.**

## Can OIL_SHOCK / NUCLEAR_INCIDENT / SYSTEMIC_ENERGY_STRESS be built from portal material?
**Partially — but NOT to artifact grade.** L0 supplies real per-domain treatments + companies (mappable to these diagnoses via `issue.circuits`), so a *thin* bundle (treatments + targets + provenance) is portal-buildable. But `evidenceAnchors` and the method/mechanism/embodiment/figure candidates exist at **no** portal level, so a full artifact-grade bundle **requires external verified source material** (or running the build pipeline against real, non-synthetic source). Building from L1/L2 treatments would inject mad-lib noise — prohibited.

## Recommendation
- **C2 live/deeper traversal: BLOCKED for L2+** (98% synthetic — traversing it crawls noise). **Allowed for L0→L1 ONLY, with filters.**
- **G1d bundle authoring: ALLOWED only with the L0-treatment filter** for the partial (treatments+companies+provenance) layer; **the evidence-grade layer REQUIRES external verified source material.** Portal alone is not artifact-grade.

### Exact filters required before C2 (and for any G1d portal extraction)
1. `depth ≤ 1` — never descend to L2+.
2. `companies.length > 0` — drop no-company stubs.
3. **Drop template treatments** — exclude any treatment whose label starts with a generic management verb (the `isTemplate` rule). Currently only **L0** treatments survive this filter.
4. Require `non-template treatment count > 0` per node before using it as source.

**Net:** the Energy portal cortex is **REAL at L0, MIXED at L1 (companies-only), SYNTHETIC at L2.** Live traversal and portal-only bundle building below L1 are unsafe; the missing 3 bundles need external real source, not portal mad-lib.
