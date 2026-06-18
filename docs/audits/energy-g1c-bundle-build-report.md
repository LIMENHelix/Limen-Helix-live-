# Energy G1c — Bundle Build / Alias Report (2026-06-17)

Two lanes. Part A applied; Part B is an honest "cannot build from verified source" finding.

## Part A — Human-approved alias (APPLIED)

**`PIPELINE_DISRUPTION → PIPELINE_RUPTURE_EVENT`**

| field | value |
|---|---|
| aliasUsed | true |
| aliasReviewStatus | human-approved |
| aliasRisk | medium |
| aliasNote | pipeline disruption mapped to rupture-event bundle; verify that rupture-specific evidence is appropriate for broader disruption claims |
| warning retained | "alias-resolved; verify source appropriateness" + "source-bundle-root-only" (bundle is shallow) |

**Provenance (imported verbatim, not modified):**

| bundle | source | domains | portalCount | maxDepth | treat | evAnchors | mech | shape |
|---|---|---|---|---|---|---|---|---|
| PIPELINE_RUPTURE_EVENT.json | `C:\Users\Chris\Limen-Helix\…\by-diagnosis\PIPELINE_RUPTURE_EVENT.json` (full repo, canonical build) | infrastructure | 1 | 0 | 4 | 32 | 4 | unchanged copy |

Result: PIPELINE_DISRUPTION now resolves `bundleStatus: found` with real enrichment, like the other 2 aliased diagnoses.

## Part B — Build the 3 remaining (NOT BUILT — insufficient verified source)

Diagnoses: `OIL_SHOCK`, `NUCLEAR_INCIDENT`, `SYSTEMIC_ENERGY_STRESS`.

**Source-material audit (what real material exists vs what a bundle needs):**

| source | what it carries for these 3 | artifact-grade? |
|---|---|---|
| `assets/data/domains/energy.json` L0 issues | `id, label, summary, circuits[]` (node-level mechanism prose) | NO — metadata + circuits, **no** evidenceAnchors / treatments-as-bundle / candidate arrays |
| `assets/data/deep/energy-deep-directives.json` | 500 directives, rich treatment fields BUT **not diagnosis-tagged**, and content is the synthetic mad-lib template set (audit-flagged L2+ stub problem, e.g. "Assess … Assessment & Diagnostics Capability Maturity Model") | NO — untagged + synthetic, not verified-real |
| full repo `by-diagnosis/` (556 canonical bundles) | the canonical build pipeline (`build-artifact-deep-source-index.js`) emitted **no** bundle for any of the 3 | NO — corpus has no real coverage |

**Conclusion:** there is **no verified, real, artifact-grade source** to build these 3 bundles from. Per the build rules ("use only verified existing source material; do not invent evidenceAnchors/candidates; if source material is insufficient, do not create the bundle"), **no bundle was created.** Fabricating from bare summaries or from the synthetic deep-directives would violate the no-invention rule.

**Therefore the 3 remain:** `bundleStatus: missing`, blocker `source-bundle-build-required`, all candidate arrays empty.

## Recommended next (G1d, when authorized)
A real source-material effort (not fabrication): author/ingest genuine oil-shock, nuclear-incident, and systemic-energy-stress source material (treatments + evidence + mechanism), then run `build-artifact-deep-source-index.js` to emit real bundles. This is content authoring, outside the brain-wiring lane. Until then the gap is honestly bounded: **3 of 6 source-backed (PIPELINE via approved alias, GRID + RENEWABLE via corpus alias), 3 of 6 explicitly build-required.**
