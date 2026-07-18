# ENERGY_REFERENCE.md — the full Energy domain, top to bottom

Authoritative, code-current map of the ENERGY domain of LIMEN Helix. Generated 2026-07-17 by
a **10-agent exhaustive audit** that read every energy file body (all 66 `energy-brain.js`
methods, all 31 base methods, the ~28 `energy-*.js` support files, `energy.json`, the portal
JSON schema, the node/motif tables, and the deep-tree fold). Supersedes the pre-session maps.
Firewalled (repo-only via `.vercelignore`).

**Tag legend.** GENERIC = in `DomainBrainBase`, inherited by all 20 domains. ENERGY-SPECIFIC =
must be ported. Each item also tagged WIRED (executing call site) / OBSERVE-ONLY (computed, informs
but doesn't actuate) / SHADOW (log-only) / ARMED (actuates live) / LOADED-BUT-INERT (no call site)
/ ORPHAN (no host) / UNREFERENCED (never loaded).

## Contents
- §0 Deploy status & orientation
- §A Brain IO pipeline · §B Recurrent model + K1–K8 · §C Higher layers/brake/forecast/emission/phase/DDP
- §D Learning substrate · §E Neuro-substrate overlay modules · §F Business/opportunity engine
- §G Directive/operator/claim/pulse layer · §H Data, server, runtime def · §I Portals/nodes/motifs/deep tree
- §J Outward surface, generic base, consumers
- §K DEAD/INERT SURFACE inventory · §L Port spec · §M Discrepancies & data gaps

---

## §0. Deploy status & orientation

The energy brain is one IIFE (`energy-brain.js:29-3587`) that aborts if `window.LIMENDomainBrainBase`
is absent, prototypes off `Base`, instantiates a singleton, calls `init()`+`start()`, publishes
`window.LIMENEnergyBrain`, and runs a 30 s cycle. On `domain-console?domain=energy` it lazy-loads an
18-script operator stack (`:3552-3585`).

| Subsystem | On `main`? | State | Consumer |
|---|---|---|---|
| Feed ingest → domain-snapshot → recurrent model | ✅ | live | stress spine |
| K1,K2,K4,K5,K6,K7,K8 (closed loops) | ✅ | live | stress/rank/LR/floor |
| K3 slow, E/I+SPOF advisories, interoception, H1–H6 | ✅ | observe-only | informs brake |
| Truth-brake ledger + HALT brake + servo + refractory | ✅ | live/actuated | emission/opps/drafts |
| Server snapshot worker, company/node scoring, recorder | ✅ | live | snapshot/join |
| Three-factor plasticity + active inference | ✅ | **SHADOW, no consumer** | — |
| Brain-weights persistence | ✅ | inert (token unset) | self |
| **Phase percept (client arming + server grounding)** | ❌ branch `agent/phase-percept` | **ARMED** | `s.phase`/snapshot phase |
| Directive pipeline (extract→rank→translate→target→promote) | ✅ | live, deterministic, $0 | opportunities |
| 6 overlay "removal/metaplasticity" modules | ✅ | **LOADED-BUT-INERT** | — |

Git: `7c1aa227` (plasticity+AI+persistence) on **main**; `7db91fc6`→`4ff1246a`→`58c8c915` (phase
percept: shadow→arm→server-grounding) **branch-only**; `main` HEAD `efd63c7`, branch HEAD `4fe524c3`.

---

## §A. Brain IO pipeline (energy-brain.js)

**constructor (`:43-50`)** — `Base.call` with `{domainId:'energy',label:'Energy',snapshotKey:'energy',cycleInterval:30000}`.

**init (`:60-186`)** — `Base.prototype.init` then 6 one-shot loaders (`_loadCommandBoardCompanies`,
`_loadBrainSignals`, `_loadDiagnosisBundles`, `_loadL1PortalDepth`, `_loadDatacenterDiagnoses`,
`:62-66`) + `_initEnergyPlasticity`/`_initEnergyActiveInference` (`:67-68`). Writes
`_actuation={refractory,servo,eiBrake,phase,phasePercept:all true}` (`:78`) and
`_refractoryParams={absoluteWindow:900000,relativeWindow:3600000,overrideThreshold:0.9}` (`:79-83`,
MIRROR energy.json runtime.params, not read from it). Thing2 kernel state `_kernelPhase=null`,
`_phaseSeries=[]` hydrated from localStorage (`:93-100`). Writes `diagnosisIndex` + `emissionRules`.

**diagnosisIndex (`:104-114`)** — the condition dictionary (8 diagnoses → trigger tokens):
`OIL_SHOCK`→crude_above_90/100,STRAIT_DISRUPTION,OIL_SHOCK,REFINERY_ATTACK,SANCTIONS,energy_high_stress;
`GRID_COLLAPSE`→grid_stress,infrastructure_cross,CYBER_ATTACK,weather_extreme,structural_stress;
`PIPELINE_DISRUPTION`→STRAIT_DISRUPTION,PORT_DISRUPTION,TANKER_THREAT,chokepoint;
`RENEWABLE_INTERMITTENCY`→weather_extreme,generation_mix,storage_low; `NUCLEAR_INCIDENT`→NUCLEAR_THREAT,MILITARY_ESCALATION;
`SYSTEMIC_ENERGY_STRESS`→energy_high_stress,structural_stress,macro_shock; +2 datacenter dx. Every
token is produced by `normalizeSignals` (`:210-457`): `crude_above_*` price-only (`:257-263`), ALL-CAPS
event tokens from fresh defenseSignals (`:283-298`), soft tokens from the 15-feed institutional block
(`:307-441`), `macro_shock` from `snap.macroShock` (`:444-446`).

**emissionRules (`:118-185`)** — 6 rules, ALL require ≥1 active dx: supplyChain(stress≥0.60, mag
`min(1,s·0.6)`), finance(≥0.65, ·0.5), agriculture(≥0.55, ·0.4), industry(≥0.60, ·0.45),
population/energy-poverty(≥0.55 + burden pathway, ·0.35 grid-led/·0.25). Consumed by the **inherited**
`emitCrossDomainSignals` (`domain-brain-base.js:821-837`).

**normalizeSignals (`:210-457`)** — dedups feeds to one canonical crude price (`isCrudePriceFeed`
`:197-208`; >$10 divergence emits WARNING, takes higher), pushes price/event/institutional/macro tokens
to `_activeConditions` (rebuilt each cycle), bands `_stressFlag` at 0.70/0.50.

**scoreStress (`:465-482`)** — base first (folds afferent pressure, sets `_externalPressureApplied`),
then captures `_phaseHeuristicRaw = state.phase` (`:472`, honest pre-arm baseline) and adds operator
request-steer `reqDelta = max(0, min(0.3-ext, stressBias))` (`:476-480`). Only place steer touches stress.

**deriveDiagnoses (`:488-533`)** — matches portal `issues[]` ids against `diagnosisIndex` triggers vs
`_activeConditions` (substring-tolerant, `:502`); `active=matchCount>0`, `relevance=matchCount/triggers`;
sorts active-first; calls `_checkDiagnosisActions`.

**recommendTreatments (`:539-591`)** — for each active-dx circuit node, pulls activation treatments,
sorts by evidence rank (A/Strong 10…Emerging 1). Overwritten by `resolveDeepContent` deep versions.

**surfaceOpportunities (`:640-1121`, largest method)** — base first (join companies + augmenters +
command-board fallback), then TIER 1 direct (4/active-dx `:665-709`; company-driven only from validated
`_pubSignals`, silent today `:711-741`), TIER 2 cross-domain (`:756-774`), TIER 3 lagging (`:776-815`),
near-dx watchlist (`:817-831`), DC layer (`:833-876`); sort → `_applyNeuroGating` (`:882`) → canonical
playbook enrichment (`_PB_MAP`/`_SRC_MAP`/`moneyChain`, `:889-1111`) → `_applyEmissionBrake` (`:1115`).

**_checkDiagnosisActions (`:1127-1192`)** — the one place the brain ACTS (drafts). HALT-brake gate first
(`:1128-1130`); refractory gate via `_refractoryLimiter.fire(dx.id,_now,stress)` suppresses duplicate
drafts (`:1157-1168`); else `adapters.createDraft('REPORT_GENERATION',…)` 3-step intent. Human-gated downstream.

**cycle (`:1236-1293`)** — saves `_origCycle`=base cycle; runs it, then `resolveDeepContent` (`:1240`),
pulse + **evidence-contract validation** that can flip diagnoses `active=false/blocked=true` (`:1243-1275`),
telemetry overlay (`:1279-1285`), and `_updateEnergyModel()` (`:1291`). Every added stage try/caught.

**_applyNeuroGating (`:2913-2943`)** — the K2/K6/K7 loop closure (prior-cycle lag): lane bias ×1.3,
K7 down-weight `×(1-suppressBy)`, K6 boost `×(1+0.15·salience)`, re-sort, K2 cap `round(len·outputScale)`
with a +1 phase-coherence window when `couplingStrength>0.15`.

**_applyEmissionBrake (`:3007-3018`)** — prior-cycle brake: clear→passthrough; else multiply opp
confidence by penalty; if suppressOpportunities set `held=true`.

**resolveDeepContent (`:1198-1233`)** — `resolver.resolveForBrain(state)`; rebuilds `state.treatments`
as deep `canonical_deep` versions when available.

**Other:** `_readRequestBiases (:3189)` decayed steer (TTL `EK_BIAS_TTL=20min`); `applyRequestBias
(:3199)` clamps stressBias≤0.3/focus≤5/lane∈{INVESTABLE,RESEARCHABLE}; `setEnergyConfig (:3212)`
autonomy + maxConcurrent[1,8]; `_resolveCanonicalDiagnosis (:1541)`; `_isMadLibTreatment (:1585)`;
`generateInvestorMemo (:3521)` on-demand P7a memo (human-gated). Constants: `EM_LEARNING_RATE=0.25`,
`EM_SLOW_RATE=0.08`, `EM_STRESS_FLOOR=0.30`, `EM_FLOOD_CAP=12`, `EM_STALE_MS=6h`, `EK_*` ledger/forecast.

---

## §B. Recurrent model + K1–K8 (energy-brain.js)

Invoked once/cycle at `:1291`. Constants `:1301-1306`; helpers `_emClamp`, `_emJaccardDistance` (`:1308-1318`).

**_updateEnergyModel (`:1399-1477`)** — reads `em.prior` from last cycle. **Kalman blend** (`:1406-1407`):
`predictedStress = prior.expectedStress·(1−gainBlend) + obs.stress·gainBlend`, `gainBlend=clamp(pe.novelty,0.05,0.95)`.
**K8 floor** (`:1414-1417`): `_floor = (adaptiveBaseline & samples≥10) ? clamp(min(0.5·0.30+0.5·adaptiveBaseline, 0.45),0.15,0.6) : 0.30`.
**Handoff** (`:1420`): `cycle>0 && predictedStress≥_floor && diagnosisCount>0 && !flooding && !stale`.
**K4 credit** (`:1428-1467`): `_sig={externalOutcome:null (always), phaseValidated, phaseTransitionHit,
callHitRate, callSamples, stressSelfPred, stressSamples}` → `window.LIMENK4.credit(_sig)`; preemption
external(4)>phase(3)>call(2)>stress(1). LR feedback: `_lr=clamp(_lr·(1+(1−_hit)), EM_SLOW_RATE, 0.6)`;
`_isReward` ALWAYS false. Then fans to H1–H6 (`:1481`), DC layer (`:1485`), `_computeEnergyNeuroLayers`
(`:1489`), DDP packets (`:1497`), outcomeLog.

**Helpers:** `_neutralEnergyModel (:1320)` cold-start; `_buildObservation (:1331)` (`signal=min(1,feedCount/8)`);
`_computePredictionError (:1350)` = `0.35·stressErr+0.2·signalErr+0.25·diagnosisErr(Jaccard)+0.15·oppErr+0.05·portalErr`,
`novelty=max(stressErr,diagnosisErr)`; `_updatePrior (:1365)` bounded EWMA at `_lr` (diagnoses hard-replaced,
`confidence=min(1,(samples+1)/20)`); `_computeRegulation (:1378)` gain/inhibition/outputScale, flood
hysteresis (on >12, release <9), looping (streak≥3), stale, overconfident.

**K-layers** (all read cached state, no network, none rewrite stress/diagnoses directly):
- **K1 `_computeEnergyAfferent` (:1959)** — age-weight `age<5min?1:max(0,1−(age−5min)/10min)`; closes via base `scoreStress` (`:476`). WIRED.
- **K2 `_computeEnergyGainControl` (:1996)** — `outputScale`; closes at `_applyNeuroGating:2934-2940`. WIRED.
- **K3 `_consolidateEnergySlowModel` (:2022)** — parallel slow track @0.08, `regimeShift` = divergence>0.25. **ADVISORY-ONLY** (never touches em.prior).
- **K4 `_scoreEnergyOutcomes` (:2049)** — reconciles last predictedStress vs realized (buffer 40); `hitRate` (err≤0.1); closes via `_sig.stressSelfPred`→LR (`:1463`). WIRED.
- **K5 `_computeEnergyPerceptionDepth` (:2079)** — `portalErrorEstimate = blocked/(admissible+blocked)`; closes at `_computePredictionError:1358` (weight 0.05). WIRED.
- **K6 `_computeEnergyAttention` (:2107)** — `salience=(active?0.5:0)+relevance·0.4+pe·0.1 (+0.5 focus)`; closes at `_applyNeuroGating:2927`. WIRED.
- **K7 `_computeEnergyInhibition` (:2132)** — `suppressBy=relevance·inhib`; closes at `_applyNeuroGating:2922`. WIRED.
- **K8 `_computeEnergyHomeostasis` (:2151)** — adaptive baseline over 60, `scalingFactor=0.5/max(0.1,baseline)`; closes at handoff floor (`:1414`) + servo. WIRED.

Net: K1,K2,K4,K5,K6,K7,K8 closed (one-cycle lag); **K3 alone advisory**.

---

## §C. Higher layers, brake, forecast, emission, phase, DDP (energy-brain.js)

**H1–H6 `_computeEnergyHigherLayers` (:1915)** → `state.cognition`:
- H1 immune (`:1737`) — antigen list (synthetic-portal baseline, bundle-missing, pe-spike >0.4, stale, flood, l1-synthetic); state alert/active/watch/clear. WIRED (feeds brake/interoception).
- H2 awareness (`:1771`), H3 conscience (`:1796`, feeds brake `conscience-no-lane`; patent/grant readiness hard-false), H4 intuition (`:1824`, never promotes to dx), H5 simulation (`:1870`, 5 hypotheticals), H6 executive report (`:1892`). H4/H5 advisory.
- `_energyBundleStates (:1722)` helper (found/missing/shallow per dx).

**Servo `_computeEnergyServo` (:2183)** — gated `_actuation.servo`. PI: drive=`clamp[0,2](stress+conds/24+dxA/24)`,
target=`max(0.15,min(1,max(drive,0.15+deviation)))`, error=target−inhibition, integral clamp±0.5,
**Kp=0.8/Ki=0.4**, correction add-only, `emissionFactor=max(0.2,1−correction)`. Closes → brake `eiFactor`. WIRED+actuated.

**Regulation advisories `_computeEnergyRegulationAdvisories` (:2744)** — E/I balance (`EnergyEIBalance`) + SPOF
audit (`EnergyConnectivityAudit.singlePointsOfFailure`, lazily fetches 81 edges). OBSERVE-ONLY → `neuro.regulation`.

**Truth brake `_scoreEnergyCallOutcomes` (:3034)** — resolves open calls (confirm≥3, expire 20, falsify Δ0.1,
cap 60) → `callHitRate`. Closes into K4 + brake + forecast + interoception. WIRED.

**HALT brake `_computeEnergyBrake` (:2955)** — HALT: immune-alert, stale-feeds, no-evidence-backed-dx.
DAMPEN: pe-spike>0.4, opportunity-flood, conscience-no-lane, poor-call-calibration (callHitRate<0.34 & ≥5),
ei-imbalance (servo runaway-risk, if eiBrake on). `confidencePenalty=min(halt?0:dampen?0.5:1, eiFactor)`. WIRED+actuated.

**Forecast `_computeEnergyForecast` (:3082)** — OLS slope over 12, `projected=clamp(cur+slope·8)`, direction
±0.005, `confidence=(1−pe)·(callHitRate||0.7)`, falsifier string. WIRED.

**Emission `_computeEnergyEmissionQueue` (:3123)** — non-held allowed-lane opps, cap 3, each package
`requiresSignoff=(path==='INVESTABLE')` (capital always human). **`_runEnergyAutonomousEmission` (:3151)** —
`window.LIMEN_ENERGY_AUTONOMY` (default on); **fail-safe: any non-clear brake holds everything**; INVESTABLE
staged-for-signoff, research emitted to internal `energyEmitted` stream (cap 50, audience-of-one). WIRED+actuated.

**Interoception `_computeEnergyInteroception` (:2800)** — 6 channels W={financial 1.0, prediction 0.85,
regulation 0.7, metacognitive 0.75, immune 0.6, allostatic 0.6}; confidence×weight integration;
**DIV_T=0.22**: blind-channel (consensusOther−primary≥0.22 & primary<0.5), financial-only (primary≥0.5 &
primary−consensusOther≥0.22), else aligned. OBSERVE-ONLY. (Non-financial channels near baseline BY
CONSTRUCTION → financial-only is the default artifact.)

**Phase `_updatePhaseKernel` (:2231)** (Thing2 kernel over stress series ≥8, cap 60) + **`_computeEnergyPhaseDynamics`
(:2263)** — gated `_actuation.phase`. PRIOR=kernelPhase; **node-evidence correction**: `myPhase=(armPercept
&& grounded)?groundedPhase:kernelPhase`; coherence router (PHASE_M) + transition calibration run on the
authoritative phase; **ARM (:2351-2355)**: writes `s.phase/phaseLabel/phaseSource='node-grounded'` when grounded. WIRED+actuated.

**DDP `_buildDomainDiagnosisPacket` (:3255-3516)** — per diagnosis (`:1497`). Sections: identity, brainState,
portalContext (l1Depth, depth 0/root-only), evidence (real bundle only, empty if none), treatmentContext
(+authoringIntake for external-source bundles), operatorContext, artifactContext (patent/grant/sba=false),
audit (H1–H6, proofTier), and a **promptView** (compact G2, caps arrays, retains warnings/blockers). WIRED.

**Datacenter** `_loadDatacenterDiagnoses (:1629)` / `_buildDatacenterLayer (:1646)` — additive content track,
hand-authored citation-backed treatments (the only real treatments), NEVER merged into the validated 6-dx spine.

`getEnergyStateSummary (:3222)` — the compact AI/console readout (stress/phase/regulation/pe/forecast/brake/
ledger/autoEmission/config/interoception+caveat).

---

## §D. Learning substrate (modules + wiring)

Five deterministic dual-export modules + one handler, wired in `_computeEnergyNeuroLayers`. Plasticity +
active-inference = SHADOW; **phase percept = ARMED** (the one non-shadow member, despite `mode:'shadow'`).

**`limen-plasticity.js`** — `Δw=η·pre·post·modulator`. `createLayer` (w starts at seed), `tick` (eligibility
`e=traceDecay·e+pre·post` + prior shrinkage `w+=priorLambda·(seed−w)`, every cycle, NO modulator),
`applyModulator` (`w+=η·modScale·rpe·e`, on fresh only), `readModulator` (centers K4 credit into RPE,
fresh keys on `resolvedSamples` increase), diagnostics (oscillating: 6 flips/24-win & meanAbsΔ>0.002; runaway:
≥0.95·ceiling or monotone), `serialize/hydrate` (resets on seed mismatch). **8 seed vectors (`_initEnergyPlasticity:2447-2466`):**

| key | seed | eta | traceDecay | priorLambda | maxW |
|---|---|---|---|---|---|
| K1_pressure | [1.0] | .02 | .85 | .002 | 1.5 |
| K2_gain | [0.5] | .02 | .85 | .002 | 1.0 |
| K3_slow | [0.08] | .005 | .9 | .001 | 0.3 |
| K4_lr | [1.0] | .02 | .85 | .002 | 2.0 |
| K5_pe | [0.35,0.2,0.25,0.15,0.05] | .03 | .8 | .003 | 0.8 |
| K6_attention | [0.5,0.4,0.1,0.5] | .03 | .8 | .003 | 1.0 |
| K7_inhib | [1.0] | .02 | .85 | .002 | 1.5 |
| K8_floor | [0.5,0.5] | .02 | .85 | .002 | 0.9 |

`_computeEnergyPlasticity (:2497)` re-calls the K4 gate on the fresh ledger (`externalOutcome:null`),
per-layer tick+applyModulator+shadowSum → `s.energyPlasticity`. **No consumer** (DDP field only).
`_persistEnergyPlasticity (:2598)` throttled 10 cycles + tab-hide, gated on `localStorage['limen:brainwts:token']`.
Credit gate `limen-k4-selfconsistency.js`: tier4 external-reward (finance only) `isReward:true`; tiers 3/2/1
self-consistency `isReward:false`.

**`limen-active-inference.js`** — Kalman over (level,slope); `selectAction` EFE=risk+ambiguity over
observe/broaden/emit/hold, setpoint=K8 floor, emit penalized by `1−callHitRate`. `_computeEnergyActiveInference
(:2637)` records `agreement=selected===actual` (stage-1 proof). **No consumer** (DDP field only).

**`limen-phase-percept.js`** (browser) + **`lib/phase-percept.js`** (server canonical, mirror; parity guarded
by `test-phase-percept-mirror.js`): `posterior ∝ prior + precision·(evidence−prior)`; precision `w=coverage·scored/(scored+3)`;
`grounded = w≥0.15 && scored≥2`, else abstains; `PHASE_LABELS` p8=PIVOT etc. **ARMED** in `_computeEnergyPhaseDynamics`
(client) and `limen-worker-snapshot.js:107-143` (server, all domains). Real prod: energy p5→p8 divergent.

**`brain-weights.js`** — GET open, POST token-gated (`BRAIN_WEIGHTS_TOKEN`, fail-closed), Redis, cap 500, 64KB.
Tests: `test-plasticity/-active-inference/-phase-percept(-mirror)/-energy-*-wiring/-worker-phase-grounding/-brain-weights-handler.js`.

---

## §E. Neuro-substrate overlay modules — MOSTLY DEAD

Co-resident with the brain only on `domain-console?domain=energy` (static-loaded `domain-console.html:539-548`
+ brain auto-loader `:3557-3576`). The 5 all-brains pages load NONE of these — every `window.Energy*` guard
resolves undefined there. "WIRED" = executing call site on the console surface.

| Module | Lines | Verdict | Evidence |
|---|---|---|---|
| energy-refractory-limiter | 75 | **WIRED (behavior-affecting)** | `energy-brain.js:1140,1157-1168` gates draft emission |
| energy-telemetry-adapter | 164 | **WIRED** | `energy-brain.js:1280-1284` every cycle — but its volatility/triggers/load outputs feed only dead sinks |
| energy-ei-balance | 94 | **WIRED (observe-only)** | `_computeEnergyRegulationAdvisories:2748` → `neuro.regulation.eiBalance` |
| energy-connectivity-audit | 94 | **WIRED (half)** | `singlePointsOfFailure` used `:2771`; `recurrenceAudit` has NO call site |
| energy-metaplasticity | 66 | **LOADED-BUT-INERT** | `adaptParams` no call site |
| energy-extinction | 47 | **LOADED-BUT-INERT** | `proposeExtinction` no call site |
| energy-retrograde-throttle | 57 | **LOADED-BUT-INERT** | `computeThrottle` no call site |
| energy-prediction-error-compressor | 81 | **LOADED-BUT-INERT** | `compress` no call site (brain has own PE math) |
| energy-offline-maintenance | 93 | **LOADED-BUT-INERT** | `runOfflineMaintenance` no call site (no cron) |
| energy-neuro-substrate | 100 | **LOADED-BUT-INERT** | self-documents `[INTEGRATION HOOK]` unapplied |
| energy-cortex-retrieval | 94 | **UNREFERENCED** | no script tag, no loader entry, never parsed |
| energy-refresh-controller | 91 | **WIRED (UI, not cognition)** | feeds `energy-opportunities.html` refresh, not the brain |

**Load-bearing finding (state at audit time).** The overlay modules implementing the biological
*removal/metaplasticity* mechanisms — metaplasticity (BCM), extinction (vmPFC), retrograde throttle
(endocannabinoid), PE-compression (management-by-exception), offline maintenance (glymphatic),
incomplete-circuit audit — **all existed as files but were dead code**. The telemetry adapter already
computed their exact inputs (volatility, activeTriggers, load/capacity), but nothing bridged producer to consumer.

**UPDATE 2026-07-17 — WIRED + ARMED.** `_computeEnergyOverlays()` (`energy-brain.js`, neuro sequence after active
inference) bridges the telemetry overlay's live inputs to all 6 formerly-inert modules + `recurrenceAudit`, computing
each every cycle onto `state.energyOverlays`; the metaplasticity→offline/PE loop is closed in-shadow. **ARMED
(`_actuation.overlays=true`, default):** the ONE proposal with a live consumer — metaplasticity → the refractory
dead-time — actuates: metaplasticity raises `_refractoryLimiter.params.absoluteWindow` with volatility, IN PLACE
(read each `fire()`, no re-init / no log reset), clamped to [base, 1.2×base] and **fail-toward-quiet** (only ever
raises the dead-time = fewer duplicate drafts), reversible (disarm restores base). Everything else stays inert-by-
design: retrograde-throttle has no live edge-weight consumer, PE-compression targets observe-only interoception,
and **extinction retirement + offline pruning REMOVE STRUCTURE and never actuate — proposal-only forever
(human-gated).** 26/26 wiring test (each module non-noop; arming raises+clamps+reverts the window; removal stays
proposal-only; energy def untouched). E-slice status now: refractory + metaplasticity→refractory WIRED-behavior;
ei-balance + connectivity + the removal modules WIRED (shadow/proposal); cortex-retrieval still UNREFERENCED.

---

## §F. Business / opportunity engine layer

7 files, loaded only on the energy console (`energy-brain.js:3555-3576`). Splits into a **live emission path**
and a **dead approval tool**.

**Live path (brain → money):** `energy-promotion-bridge.js (371)` **[WIRED]** is the conductor (driven by
clarity-operator `:1342-1387`): `directive-extractor.extract → directive-ranker.rank (mechanism-classified,
drift-penalized) → directive-translator.translate/shape (0-90-day deals) → targeting-engine.resolveTargets`
(3-tier: verified portal cos / segment classes / example tickers, `EXCLUSIONS` block cross-segment) → injected
into `state.opportunities` (`source:'portal_directive'`) + `state.treatments`. Then `energy-opportunity-economics.js
(178)` **[WIRED]** decorates each `.opp-card` via `energy-compensation.js (92)` **[WIRED]** (10%/15%/85% split;
grant/patent/loan purged).

**Dead path:** `energy-node-business-engine.js (1541)` **[WIRED inference, ORPHAN output]** — 103-node
NODE_BUSINESS_DIRECTORY infers which businesses should exist; but `getApprovedMappings` has NO external caller,
so approvals are inert localStorage. `energy-business-review.js (396)` **[WIRED]** renders it. `energy-business-build.js
(771)` **[ORPHAN]** — 7-stage launch workspace, loaded + IIFE-executed every console load, never invoked (its
only button was removed).

---

## §G. Directive / operator / claim / pulse layer

10 files (operator money surface), dynamically injected by the brain loader (`energy-brain.js:3552-3585`),
never via HTML script tags — why the first pass missed it.

**Pulse:** `energy-pulse-engine.js (367)` **[WIRED]** — computed INSIDE the brain cycle (`energy-brain.js:1243-1248`);
`EVIDENCE_CONTRACTS` block a diagnosis from activating on stress alone; regime stable/watchful/elevated/crisis.

**Directive pipeline (all WIRED, deterministic, $0):** `directive-extractor (395)` fractal portal traversal
(prebuilt `energy-deep-directives.json` then live), `directive-ranker (296)` mechanism-classified depth-aware
scoring, `directive-translator (602)` → opportunity objects + deal-shaping. Gated on `LIMEN_ENABLE_DIRECTIVE_EXTRACTION`.

**Render host:** `energy-clarity-operator.js (1781)` **[WIRED]** — the entire Operator Surface (Anchor Directive
→ Deep Proof → Money Summary → Top Plays → Action Queue), presentation-only, drives `bridge.promote`, mounts
the GLOBAL operator/claim stacks. Rich embedded intel (`DX_CONTEXT`, `MECH_EXPLAIN`, `INVEST_TARGETS` with CIKs).

**Paid AI touchpoint:** `energy-agent-box.js (196)` **[WIRED]** — free LOCAL default, passcode → `/api/energy-agent`
(Haiku), fail-closed to local.

**Legacy ORPHANS (target old `#oppGrid`/`.opp-card` the current surface doesn't render):** `energy-operator-panel
(199)`, `energy-claim-flow (252)`, `energy-claim-ledger (167)` — the `LIMENEnergy.economy.*` trio; live surface
uses the GLOBAL `LIMENClaimLedger`/`LIMENClaimFlow`/`LIMENOperatorPanel` instead. `energy-execution-panels (469)`
**[WIRED-but-dormant]** — grant/patent workspaces, reachable only if a retired-lane opportunity appears.

---

## §H. Data, server handlers, runtime def

**Feeds (`domain-snapshot.js`, 309 KB, ~240 fetchers).** Energy = 17 sources (`:788-805`). **Only 3 are REAL
stress drivers** (all near-duplicate crude prices): Massive Crude (Polygon CL, `clamp((p−60)/50)`), FRED Crude
(WTI `DCOILWTICO`, `(v−55)/50`), EIA Petroleum (Brent `EPCBRENT`, `(v−60)/50`). Everything named
EIA-Weekly/IEA/OPEC/grid/nuclear/solar/wind/coal is Google-News RSS → **EVENT overlay** (`_isRss` demotes it
regardless of the `stress` channel); FedReg DOE/NRC are DEGRADED (doc-count); NOAA/CISA REAL-but-reused (cap 0.3).
So baseline energy stress ≈ "is crude expensive" + a news-volume overlay.

**buildDomain (`:1384-1712`):** stress=mean stressDrivers (LOW_SIGNAL cap 0.3 if <2 real); confidence
`0.35·quality+0.30·corrob+0.20·specificity+0.15·recency`; **event overlay** `finalStress=min(1, baseline +
eventScore·0.3)` (where ~13 EVENT feeds re-enter); maturity STRUCTURAL/CONFIRMED/FORMING/EARLY.
`resolveEnergyFeeds (:1318)` **defined but not called**.

**Worker (`limen-worker-snapshot.js`, cron 15 min):** heuristic phase (p0–p5 only, p7a/p8/p9/p10 suppressed);
scoreBatch; buildDomainJoin; **node-grounding pass (`:113-143`)** overwrites phase when grounded; writes
`console_snapshot` (Redis 1200s) + changelog + `opportunities_snapshot`.

**Scoring (`lib/company-phase-scorer.js`):** elevated=stress≥0.65; POSTs padded CIK to `limenhelix.com/api/limen/score`
(public domain mandatory); `company_phase_<cik>` 24h; `domain_company_join` (600s) with p7a/p7b/p3/p9 counts +
`companies[]{phase,scored}` + coverage; convergence TERMINAL/INSTABILITY/STRUCTURAL/FAILURE_CLUSTER.

**Recorder (`feed-record.js`, hourly):** `feedhist:<domain>` capped 2160 (~90d), idempotent/hour.
**Persistence (`brain-weights.js`):** token-gated POST, fail-closed. **Public backends:** `energy-entry.js`
(zip3 k-anon, `energy:agg:v1`, admin key), `energy-news.js` (Google News RSS, 30-min cache, headlines only).
**Thing2 (`limen-thing2-adapter.js`):** `phaseOfSeries` ≥8 pts → `{phase,distribution,cAccumulator,trajectory,
interpretive:true,validated:false}`. **Fast-boot:** server-first snapshot, localStorage cache only.

**`energy.json` (101 KB) — schema + neutral defaults; the brain does NOT load it.** `runtime.params`:
`offlineDownscaleFactor 0.95, offlineConsolidateTopK 8, offlinePruneThreshold 0, refractoryAbsoluteWindow 900000,
refractoryRelativeWindow 3600000, refractoryOverrideThreshold 0.9, predictionErrorThreshold 0.1,
retrogradeThrottleGain 0.2, metaplasticityGain 0.2`. The brain hand-mirrors ONLY the 3 refractory params
(match exactly); the other 6 belong to the inert offline/retrograde/metaplasticity modules (§E). `activations[21]`
(nodes HYPO/M1/THAL/STRI/VTA/PAG/NTS/HIPP/CC/FORN/CBLM/OFC/dlPFC/dACC/vmPFC/ENS/S1/CAUD/FEF/BNST/EMP + childPortals).
`issues[6]` = the 6 diagnoses with resolved motifs (GRID_COLLAPSE→THAL/M4, OIL_SHOCK→THAL/M4, NUCLEAR_INCIDENT→PAG/**M8**,
RENEWABLE→HYPO/M3, PIPELINE→THAL/M4, SYSTEMIC→HIPP/M3). `edges[81]` (SUPPLIES 15/CONTROLS 5/DEPENDS_ON 7 + excit 33/inhib 11/modul 9).

---

## §I. Portals, nodes, motifs, deep tree (L1–L7)

**Live repo = L1–L3 surface only: 197 energy portals (1:1 HTML↔JSON), 21 families.** 11-member families
(storage/offgrid/hydrogen/gridmod/energytrans/energytrade/energypolicy/energydata/efficiency/distribution)
= L1+10 L2; 9-member (transmission/solar/power/pipeline/nuclear/hydro/grid/fossil/battery); datacenter goes
**5 deep** (`_powerdemand_rackdensity_hvpower`); carbon is a stub. **The real tree is ~27,165 energy files
(part of ~466k across 29 domains) in the FULL repo `C:\Users\Chris\Limen-Helix`, folded up into L1–L3** via
`build-cumulative-fold.mjs` (afferent upward fold, `SURFACE_MAX_DEPTH=3`).

**Portal JSON schema (`energy_fossil.json` 4147 lines):** `activations[]{brainNodeId, state, group, weight,
companies[]{name,ticker_or_id,binding_strength}, treatments[]{label,type,evidence,cite,citation[],steps}, childPortal}`
— **treatments only on the top 8 nodes, then 0**; `diagnosticTriggers[]` empty (supplied externally, §5).

**Node/motif (`canonical-nodes.json`, 123 nodes):** class real 81/composite 15/molecule 5/…; **`canBindBusiness`:
81 true / 42 false** — the load-bearing gate (`realNode` in `build-cumulative-fold.mjs:43` / `lib/node-guard`).
Motif = failure-mode family (M4×7, M6×5, M2×5…, none×88); HAB=M8 (killswitch). Portal activation's `brainNodeId`
→ canonical node → motif; non-node or non-canonical bindings are **BRAKED/blocked**. Override chain:
`diagnosis-node-overrides.json` (10,205) → `diagnosis-ancestor-map.json` (3,376, walks slug segments up) → type default.

**Fold (`energy-fold.json`):** `srcFiles:27165, surface[196]`; energy root `subtreeCount:25973, subtreeMass:51159,
**blockedBindings:113507**` (the pun-mush the node-guard rejects); `topNodes` STN/M1 17212, THAL/M4 14500, CBLM/M6 12160.
Sibling `energy-diagnosis-digest.json` (180 dx, 4702 tx). **Condition aliases (`energy-condition-trigger-aliases.json`):**
where the empty per-portal triggers get populated — `crude_above_90 → {linkedDiagnoses, activations[STRI,FORN,OFC,…]}`.
**Artifact bundles (`by-diagnosis/`, 8 files):** `buildMethod:'external-source-authored', humanVerification:'required',
no fabricated grades`. **treatment-discovery:** `_summary energy:183`, by-node files — indexed by node, real energy usage.

**Runtime resolve (`portal-content-resolver.js`):** `DIAGNOSIS_PORTAL_MAP` (energy `:43-54`); **negative cache
1h** — static-first, non-eager 404 → cache+null (the guard against the undeployed deep-tree 404 storm); eager →
`/api/fetch-portal` (GitHub-backed). `portal-ui.js` synthesizes the dx list from activations when deep leaves lack `issues[]`.

---

## §J. Outward surface, generic base, consumers

**Generic base (`domain-brain-base.js`, 31 methods).** Energy overrides ~10 (init, cycle, normalizeSignals,
scoreStress, deriveDiagnoses, recommendTreatments, surfaceOpportunities, _readRequestBiases, applyRequestBias,
setEnergyConfig) and inherits the rest verbatim — including `getExternalPressure` (cap 0.3), `ingestFeeds`,
`_applyDeepDigest`/`_applyDeepFold`/`_applyLiveDerivation` (the portals-as-feeds engine, non-node BRAKE),
`emitCrossDomainSignals`, `_getPortalContent` (negative cache), `_emitEvent` (**the single outbound channel**),
`getStateSummary`, and the generic `_computeGenericKStack`/`_applyGenericBrakeGate`/`_computeGenericInteroception`
(**energy self-skips all three** — runs its own). The generic per-domain interoception weight table is empty until
calibrated — so the other 19 domains run one default profile; energy's per-channel W is the only tuned one.

**Pages loading the brain (5, identical prefix order base→decision→workspace→[energy stack]→energy-brain→19 siblings→adapter):**
civilization.html:421, admin-master.html:125, helix-brain-grid.html:66, opportunities.html:254,
civilization-opportunities.html:219. `domain-console.html` uses a dynamic per-domain loader (`:558-561`) +
the overlay stack (`:539-548`).

**Public front `energy.html`** (Bill X-Ray) — client-side price×quantity decomposition, localStorage history,
opt-in anonymized POST `/api/energy-entry`, external ZIP resolve (zippopotam), complaint-letter builder, `/api/energy-news` strip.

**Attached AI** (all admin-gated + kill-switch + daily cap + 1 call/msg): `energy-agent.js` (Haiku, cap 150,
steer/config tools + honesty clause: financial-only = construction artifact), `domain-agent.js` (Sonnet 5, cap
300/domain), `master-agent.js` (Sonnet 5, observe-only, no toolCalls). Client boxes: `energy-agent-box.js`,
`domain-agent-box.js`, `master-consciousness-box.js` (payload `:212` per domain: `{domain,label,stress,phase,
regulation,immune,salience,attend,divergence,topDx,topOpp}` — **the last-hop insertion point for phaseGrounded/phaseDivergent**).

**Consumer chain (energy → decisions/fleet):** `state._emitEvent('domain-brain-update')` (the only outbound signal)
→ `domain-brain-adapter.js` `_onBrainUpdate:258` flattens state into `window.LIMENDomains.energy.brain*` (brainStress,
brainPhase, **brainPhaseSource**, brainCognition, brainOpportunities…) → `LIMENDecision.decide` (`limen-decision.js:40`,
pure: `lowConf = conf<0.4 || src==='fallback'` caps at `recommend`; `boundedAction∈{abstain,monitor,recommend,
open-human-gate}`, never autonomous) → `LIMENWorkspace.synthesize` (spotlight 4; system conscience restrictive if
>60% acting domains on fallback → caps system at recommend). Server: `lib/fleet-decision.js` (verbatim CJS copy,
since Vercel excludes assets/**) → `operator-fleet.runFleet` (20 operators + master Kai; `hasLiveSignal` honest —
no fabrication). **Nothing in the chain exceeds `open-human-gate`.**

---

## §K. DEAD / INERT SURFACE inventory (the acquisition-without-removal finding)

Energy's own code exhibits the exact pattern the project keeps diagnosing at the business layer. Loaded-and-executed
but reaching nothing:

1. **6 overlay modules were LOADED-BUT-INERT** (§E) — the biological removal/metaplasticity mechanisms with zero
   call sites. **RESOLVED 2026-07-17:** now WIRED in shadow via `_computeEnergyOverlays()` (proposals computed each
   cycle; destructive ops stay proposal-only). Remaining dead: `cortex-retrieval` (unreferenced).
2. **1 overlay UNREFERENCED**: cortex-retrieval (never even loaded). **1 half-dead**: connectivity-audit `recurrenceAudit`.
   **1 wired-to-dead-sinks**: telemetry-adapter computes volatility/triggers/load that only the inert modules would consume.
3. **`energy-business-build.js` (771 lines) ORPHAN** — IIFE-executes every console load, never invoked.
4. **node-business-engine approvals ORPHAN** — `getApprovedMappings` feeds nothing (card copy promises otherwise).
5. **Legacy claim/operator trio** (operator-panel, claim-flow, claim-ledger) target the retired `#oppGrid`/`.opp-card` DOM.
6. **execution-panels dormant** (retired grant/patent lanes). **`resolveEnergyFeeds` defined-not-called.**
7. **Retired-lane vocabulary lingers** in `opportunity-economics.DEFAULT_VALUES` and targeting keyword sets despite
   compensation purging those lanes.

Rough dead/inert mass: ~3,000+ lines of energy JS load and run to no effect. Prune candidates pending confirmation
no other page hosts them.

---

## §L. Port spec — copying energy to the other 19 domains

**Generic (free, inherited):** pipeline skeleton, afferent integration, memory pruning, deep-digest/fold/live-derivation,
emission-rule engine, snapshot hydration, the decision/workspace/fleet consumer chain, AND the **server phase grounding**
(the worker loops all domains; client inherits via `scoreStress` reading `snap.phase`).

**Phase grounding → PORT = MERGE `agent/phase-percept`.** Grounds all 20 domains server-side, zero per-domain code;
unscored domains abstain. Then the last hop: feed `phaseGrounded`/`phaseDivergent` into `master-consciousness-box.js:212`
+ the `master-agent.js` prompt.

**Plasticity + active inference → DO NOT PORT YET.** Pure SHADOW, zero consumers. Copying dead shadow ×19 = the §K
pattern again. Port only after armed on energy (`diag.stable`) AND consumed. When porting, LIFT the wiring into the
generic base path, not 19 copies.

**Overlay "removal" modules → WIRE ON ENERGY FIRST, don't replicate.** Six exist but are inert (§E). The value is
in wiring them (bridging the telemetry-adapter outputs to metaplasticity/extinction/throttle/offline-maintenance),
not in copying dead files to 19 more domains.

**Per-domain config to set (not code):** feed list + stress mappings, `diagnosisIndex`, `emissionRules`, interoception
weight profile W, K-layer seeds, condition-trigger-aliases, diagnosis bundles, truth-eligibility (finance only).

**The real gap is CONTENT depth.** Energy's edge = 8 hand-authored citation-backed datacenter bundles + 27k deep-tree
files + real node bindings. Machinery ports cheaply; real content is the work. And even energy's L1 treatments are
100% mad-lib (admitted:false) — only the datacenter layer carries real treatments.

---

## §M. Discrepancies & data gaps found

1. **Stale block comment** `energy-brain.js:1946-1949` ("ADVISORY BY DESIGN") contradicts the now-CLOSED K-layers.
2. **Worker cron header** says "2-5 min"; actual schedule is 15 min (`vercel.json`).
3. **runtime.params drift risk:** brain hand-mirrors 3 of `energy.json`'s 9 params (the other 6 feed inert modules); manual-sync comment `:76-77`.
4. **Node data gaps in `energy.json`:** CAUD/FEF/BNST/EMP have no `functional_role`; EMP has zero company bindings.
5. **Thin real signal:** only 3 crude-price feeds drive baseline stress; all else is event-overlay → energy stress ≈ crude price + news volume.
6. **No consumers** for `energyPlasticity`/`energyActiveInference`/`phaseGrounded`/`phaseDivergent`; brain-weights persistence inert (token unset).
7. **Double-grounding** after merge (server heuristic-prior + client kernel-prior); converges on same evidence, decide authority.
8. ~~Master-agent prompt frames financial-only as artifact; not phase-grounding-aware.~~ **RESOLVED 2026-07-17:**
   `phaseGrounded`/`phaseDivergent`/`phasePrior` now flow brain summaries → base snapshot capture →
   `master-consciousness-box.js:212` payload + local synthesis → `master-agent.js` prompt (grounded-divergent named
   the high-value signal alongside blind-channel; interoception's "no external ground truth" line corrected).
9. **~3,000+ lines dead/inert energy JS** (§K) executing to no effect.
10. **Phase-percept feature unmerged** — the one armed learning member is branch-only, not in production.
