# ENERGY_REFERENCE.md — the full Energy domain, top to bottom

Authoritative, code-current map of the ENERGY domain of LIMEN Helix, generated 2026-07-17
from the running source by a 6-agent parallel audit. This supersedes the pre-session maps
(`ENERGY_BRAIN_MAP.md`, `ENERGY_NEURO_AUDIT.md`, `energy-brain-v1-template-lock.md`), which
predate the learning substrate. It is the **port template**: everything is tagged
GENERIC (in `DomainBrainBase`, inherited by all 20 domains) vs ENERGY-SPECIFIC (must be
ported), and LIVE / SHADOW / BRANCH-ONLY. Firewalled (repo-only via `.vercelignore`).

Primary files: `assets/js/domain-brains/energy-brain.js` (~3,550 lines), base
`assets/js/domain-brains/domain-brain-base.js` (~1,299 lines), the pure modules
`limen-plasticity.js` / `limen-active-inference.js` / `limen-phase-percept.js` /
`limen-k4-selfconsistency.js` (+ `lib/phase-percept.js`), server `handlers/limen-worker-snapshot.js`
+ `handlers/domain-snapshot.js` + `lib/company-phase-scorer.js`, persistence
`handlers/brain-weights.js` + `handlers/feed-record.js`.

---

## 0. Deploy status & LIVE/SHADOW quick reference

| Subsystem | On `main` (prod)? | State | Consumed? |
|---|---|---|---|
| Feed ingestion → domain-snapshot | ✅ live | live | yes (stress spine) |
| Recurrent energy model (`_updateEnergyModel`) | ✅ live | live | yes |
| K1,K2,K4,K5,K6,K7,K8 (closed loops) | ✅ live | live | yes (stress / ranking / LR / floor) |
| K3 slow model, E/I + SPOF advisories, interoception, H1–H6 | ✅ live | advisory / observe-only | informs brake, not spine |
| Truth-brake ledger + HALT brake + servo | ✅ live | live | yes (emission/opps) |
| Server snapshot worker (heuristic phase, join, recorder) | ✅ live | live | yes |
| Company/node kernel scoring + `domainCompanyJoin` | ✅ live | live | yes |
| **Three-factor plasticity** (`limen-plasticity.js`) | ✅ on main | **SHADOW** | **no consumer** |
| **Active inference v1** (`limen-active-inference.js`) | ✅ on main | **SHADOW** | **no consumer** |
| Brain-weights persistence (`brain-weights.js`) | ✅ on main | **inert** (token unset) | self (hydrate) |
| **Phase percept — client arming** | ❌ branch `agent/phase-percept` | **ARMED** | via `s.phase`/`phaseSource` |
| **Phase percept — server grounding** (all-domain) | ❌ branch `agent/phase-percept` | **ARMED** | via snapshot `phase`/`phaseSource` |

Commit map (verified via `git merge-base`): `7c1aa227` plasticity+active-inference = **on main**;
`7db91fc6` phase-percept + `58c8c915` server grounding = **branch-only**. `main` HEAD `efd63c7`.

**Consumption nuance:** the grounded *phase value* reaches consumers (`domain-brain-adapter.js:211`
`brainPhaseSource`, `limen-decision.js:97`, `limen-workspace.js:49`, `lib/fleet-decision.js:86,115`)
through the overwritten `phase`/`phaseSource`. The raw `phaseGrounded`/`phaseDivergent` booleans
and the `energyPlasticity`/`energyActiveInference` objects have **no production reader** yet.

---

## 1. Brain core & cycle

### 1.1 The per-cycle pipeline (GENERIC, `DomainBrainBase`)
`DomainBrainBase.prototype.cycle` (`domain-brain-base.js:319`) runs a sequential promise chain
(`:324-331`): `ingestFeeds → normalizeSignals → scoreStress → deriveDiagnoses → recommendTreatments
→ surfaceOpportunities → emitCrossDomainSignals → updateMemory`, then a generic tail (`:332-339`):
`_applyRequestSteer`, `_computeGenericKStack`, `_applyGenericBrakeGate`, `_computeGenericInteroception`
(**energy self-skips these three generics** — its own K-stack replaces them), sets `state.updated`,
fires `limen:domain-brain-update`. Errors caught, never thrown (`:340-342`). State contract at
`domain-brain-base.js:247-272`.

Energy wraps the whole pipeline in a recurrent shell: `EnergyBrain.prototype.cycle`
(`energy-brain.js:1237`) captures `_origCycle` (`:1236`), runs it (`:1239`), then `resolveDeepContent`
(`:1240`), pulse/evidence-contract validation (`:1242-1275`), telemetry overlay (`:1279-1285`), and
finally `_updateEnergyModel()` at the very end (`:1291`, try/caught). So the recurrent model runs
**once per cycle after the base pipeline settles**.

### 1.2 Energy pipeline overrides (all ENERGY-SPECIFIC)
- **scoreStress — STEP 3** (`energy-brain.js:465`): calls base first (`:467`) — base copies
  stress/confidence/activity/maturity, reads snapshot `phase/phaseLabel` (`domain-brain-base.js:494-499`),
  folds afferent cross-domain pressure into stress (cap 0.3, `:510-512`). Energy then captures
  `_phaseHeuristicRaw = state.phase` (`:472`, the honest pre-grounding baseline, reset every cycle so
  arming never feeds back) and adds operator request-steer (`rb.stressBias`, combined ≤0.3, `:476-480`).
- **deriveDiagnoses — STEP 4** (`:488`): matches portal issue ids against `diagnosisIndex` triggers vs
  `_activeConditions`; `active = matchCount>0`, `relevance = matchCount/triggers.length` (`:498-528`).
  `_activeConditions` are produced by the `normalizeSignals` override (`:210`): canonical crude-price
  gating (`:197-208`), 30-min event clusters (`:266-303`), ~15 institutional RSS/FedReg thresholds
  (`:305-441`).
- **surfaceOpportunities — STEP 6** (`:640`): base first (`:642`, reads convergence + join companies +
  deep-digest/fold/live-derivation + command-board fallback), then energy TIERS (dedupe by thesis,
  `:658-663`): TIER 1 direct per-diagnosis (`:665-754`, company positioning gated only on validated
  `_pubSignals`, `{}` today so silent), TIER 2 cross-domain (`:757-774,817-831`), TIER 3 lagging
  (`:776-815`), datacenter layer (`:833-876`). Then `_applyNeuroGating` (`:882`) applies the prior
  cycle's K2/K6/K7. Then canonical playbook enrichment (`:884+`).
- **`_applyNeuroGating`** (ENERGY-SPECIFIC, `:2913`): operator lane bias ×1.3, K7 non-winner
  down-weight, K6 focus boost, re-sort, K2 gain cap to `round(len×outputScale)` with a
  phase-coherence +1 window when `couplingStrength>0.15` (`:2920-2941`).
- **emitCrossDomainSignals**: energy does NOT override it — uses the base engine
  (`domain-brain-base.js:821-837`) iterating `this.emissionRules`. The **rules are ENERGY-SPECIFIC**
  (`init`, `:118-185`): each gated on `stress ≥ threshold AND ≥1 active dx` → supplyChain(≥0.60),
  finance(≥0.65), agriculture(≥0.55), industry(≥0.60), population/energy-poverty(≥0.55).

### 1.3 Recurrent model `_updateEnergyModel` (ENERGY-SPECIFIC, `:1399`)
Reads `em.prior` from the previous cycle (`:1401`). B1 `_neutralEnergyModel` seed (`:1320`); B2
`_buildObservation` (`:1331`); B3 `_computePredictionError` = `0.35·stressErr + 0.2·signalErr +
0.25·diagnosisErr(Jaccard) + 0.15·oppErr + 0.05·portalErr`, `novelty = max(stressErr,diagnosisErr)`
(`:1350-1359`); predictedStress Kalman blend `prior·(1−gain)+obs·gain`, `gain=clamp(novelty,0.05,0.95)`
(`:1406-1407`); B5 `_computeRegulation` (gain/inhibition/outputScale, flooding hysteresis, looping,
stale, overconfident, `:1378`); `readyForHandoff` gates on K8 `_floor` (50/50 `EM_STRESS_FLOOR`×adaptive,
`:1414-1420`); **K4 credit gate** call with `externalOutcome:null` always (energy never rewarded),
routed through `window.LIMENK4.credit` with in-line fallback, scaling `_lr` (`:1422-1464`); B4
`_updatePrior` moves every `expected*` toward obs at `_lr` → stored as next `em.prior` (`:1365,1475`).
Then fires H1–H6 (`:1481`), datacenter (`:1485`), `_computeEnergyNeuroLayers` (`:1489`), DDP packet
(`:1493-1499`), outcomeLog (`:1502-1508`).

### 1.4 `init()` + actuation (ENERGY-SPECIFIC, `:60`)
Loaders (fail-closed to empty): `_loadCommandBoardCompanies` (`:62`), `_loadBrainSignals` (`:63`,
validated Thing pipeline only), `_loadDiagnosisBundles` (`:64`), `_loadL1PortalDepth` (`:65`),
`_loadDatacenterDiagnoses` (`:66`), `_initEnergyPlasticity`+`_initEnergyActiveInference` (`:67-68`).
`_actuation = {refractory,servo,eiBrake,phase,phasePercept}` all true (`:78`) — each a reversible
gate. `_refractoryParams`: 15-min absolute / 1-hr relative (1:4) / override 0.9 (`:79-83`), MIRROR
`energy.json` runtime.params (keep in sync manually). Thing2 kernel: `_kernelPhase`/`_phaseSeries`
hydrated from localStorage (`:85-100`); fed by `_updatePhaseKernel` (`:2231`) → `LIMENThing2.phaseOfSeries`
(interpretive, `validated:false`). `diagnosisIndex` (`:104-114`), `emissionRules` (`:118-185`).

### 1.5 Constants (ENERGY-SPECIFIC, module scope)
`EM_LEARNING_RATE=0.25`, `EM_SLOW_RATE=0.08` (K3 + lower LR clamp), `EM_STRESS_FLOOR=0.30` (handoff
floor + starving test), `EM_FLOOD_CAP=12` (flood, 75% hysteresis), `EM_STALE_MS=6h` (`:1301-1306`).
`EK_OUTCOME_BUFFER=40`, `EK_HOMEO_WINDOW=60`, `EK_LEDGER_CONFIRM=3`/`MAXAGE=20`/`DELTA=0.1`/`MAX=60`,
`EK_FORECAST_HORIZON=8`/`WINDOW=12`, `EK_EMIT_MAXCONCURRENT=3`, `EK_BIAS_TTL=20min`.

---

## 2. K-layer neuro substrate (ENERGY-SPECIFIC)

Orchestrator `_computeEnergyNeuroLayers` (`:2362`, called `:1489`): K1→K8, servo, truth-brake,
HALT brake, forecast, phase-dynamics, emission queue, autonomous emission, interoception, plasticity,
active-inference (`:2363-2380`); rollup `s.energyNeuro`/`s.cognition.neuro` (`:2384-2418`).

> **Discrepancy (flagged):** the block comment "ADVISORY BY DESIGN… NONE rewires the scoring spine"
> (`:1946-1949`) is **stale**. The per-layer notes + `status:'closed'` + the `closedLoops` manifest
> (`:2404-2412`) are current truth: K1/K2/K4/K5/K6/K7/K8 now close into the spine.

- **K1 `_computeEnergyAfferent`** (`:1959`) → `s.energyAfferent`. CLOSED: `externalPressure` added to
  stress in scoreStress (`:476`).
- **K2 `_computeEnergyGainControl`** (`:1996`) → `s.energyGainControl`. CLOSED: `outputScale` caps
  ranked opportunities via `_applyNeuroGating` (`:2932-2941`); also blends into predictedStress.
- **K3 `_consolidateEnergySlowModel`** (`:2022`) → `s.energySlowModel`. ADVISORY-only (never touches
  `em.prior`, `:2027`); `fastSlowDivergence`/`regimeShift` indicator.
- **K4 `_scoreEnergyOutcomes`** (`:2049`) → `s.energyOutcomeModel`. CLOSED: `hitRate` (≥5 samples)
  feeds the credit gate, scaling `_lr` (`:1459-1464`). Energy never `externalRewardEligible`.
- **K5 `_computeEnergyPerceptionDepth`** (`:2079`) → `s.energyPerceptionDepth`. CLOSED:
  `portalErrorEstimate` folded into prediction error at weight 0.05 (`:1357-1359`).
- **K6 `_computeEnergyAttention`** (`:2107`) → `s.energyAttention`. CLOSED: `focus[]` boosts rank
  (`:2926-2930`).
- **K7 `_computeEnergyInhibition`** (`:2132`) → `s.energyInhibition`. CLOSED: non-winner down-weight
  by `suppressBy` (`:2921-2924`).
- **K8 `_computeEnergyHomeostasis`** (`:2151`) → `s.energyHomeostasis`. CLOSED: 50/50 floor blend for
  `readyForHandoff` (`:1417,1420`); supplies servo deviation.
- **Servo `_computeEnergyServo`** (`:2183`, actuated `_actuation.servo`): PI controller (Kp 0.8 / Ki 0.4
  clamped ±0.5), add-braking-only → `emissionFactor`; CLOSED narrow → HALT brake `eiFactor` →
  emission-confidence only. `_computeEnergyRegulationAdvisories` (`:2744`): E/I balance
  (`EnergyEIBalance`) + SPOF audit (`EnergyConnectivityAudit`), observe-only, attached as
  `neuro.regulation`.
- **Truth brake `_scoreEnergyCallOutcomes`** (`:3034`) → `s.energyOutcomeLedger.callHitRate`. CLOSED
  into 3 sinks: K4 credit, HALT dampen (<0.34 over ≥5), forecast confidence.
- **HALT brake `_computeEnergyBrake`** (`:2955`) → `s.energyBrake`. HALT (immune-alert/stale/no-evidence),
  DAMPEN (PE spike >0.4 / flood / conscience-no-lane / poor calibration / E-I imbalance). CLOSED:
  `_applyEmissionBrake` on opportunities next cycle + gates autonomous emission.
- **Forecast `_computeEnergyForecast`** (`:3082`): LSQ slope over 12, projected over 8, `confidence =
  (1−pe)·(callHitRate||0.7)`, falsifier string. Feeds allostatic interoception + every emission package.
- **Emission queue `_computeEnergyEmissionQueue`** (`:3123`) + **autonomous `_runEnergyAutonomousEmission`**
  (`:3151`): capital-fit packages, `requiresSignoff` for INVESTABLE, fail-safe on any non-clear brake,
  research emits to internal stream only (audience-of-one).
- **Interoception `_computeEnergyInteroception`** (`:2800`): 6 channels (financial 1.0 / prediction 0.85
  / regulation 0.7 / metacognitive 0.75 / immune 0.6 / allostatic 0.6), confidence×weight integration,
  salience blind-channel / financial-only / aligned. OBSERVE-ONLY. **Note:** non-financial channels sit
  near baseline BY CONSTRUCTION → `financial-only` is the default artifact for any stressed domain (this
  is the honest-AI caveat).
- **Higher layers H1–H6** (`_computeEnergyHigherLayers`, `:1915`): immune, awareness, conscience,
  intuition (never auto-promotes to dx), simulation, executive report. Governors that inform the brake,
  don't rewrite the spine.
- **Datacenter layer** (`_buildDatacenterLayer`, `:1646`): additive content track, NEVER merged into the
  validated 6-dx spine; hand-authored citation-backed treatments (the only real treatments — see §5).

---

## 3. Learning substrate (plasticity, active inference, phase percept)

All three: pure dual-export module + energy wiring writing `state.energy*` + DDP-packet field.

### 3.1 Three-factor plasticity — SHADOW, on `main`
`limen-plasticity.js`: `Δw = η·pre·post·modulator` (NOT backprop). `createLayer` (w starts at seed=prior,
named `eta/modScale/traceDecay/priorLambda/minW/maxW`, `:79-103`); `tick` = eligibility `e←traceDecay·e+pre·post`
+ prior shrinkage `w←w+priorLambda·(seed−w)` every cycle (`:141-152`); `readModulator` centers K4 credit
into RPE, `fresh` only on `resolvedSamples` increase (no double-teach, `:176-196`); `applyModulator`
= `w←clamp(w+η·modScale·rpe·e)` on fresh only (`:156-164`); diagnostics `oscillating`(6 flips/24-win)
/`runaway`(≥0.95·ceiling or monotone)/`stable` (`:59-63,107-136`); `serialize/hydrate` (hydrate RESETS a
layer if its stored seed ≠ current config). Credit gate `limen-k4-selfconsistency.js`: tier4 external-reward
(`isReward:true`) only with `externalOutcome.hit`; tiers 3/2/1 self-consistency (`isReward:false`);
`externalRewardEligible` = **finance only** (`:69-73`), so energy never mints reward.
Wiring: `_initEnergyPlasticity` seeds **8 K-layers** from live constants + hydrates from `/api/brain-weights`
(`:2440-2495`); `_computeEnergyPlasticity` (`:2497`) recomputes the gate on the fresh ledger, per-layer
tick+applyModulator+shadowSum → `s.energyPlasticity` (mode shadow, isReward false, armGate note);
`_persistEnergyPlasticity` (`:2598`) POSTs snapshot, gated on operator localStorage token.
**No consumer** (only DDP field `plasticity` `:2393`). Tests: `test-plasticity.js`,
`test-energy-plasticity-wiring.js`, `test-brain-weights-handler.js`.
> Do not confuse with the OLDER `em.plasticity.learningRate` (`:1429`, `:3309`) — different thing.

### 3.2 Active inference v1 — SHADOW, on `main`
`limen-active-inference.js`: linear-Gaussian model over `(level,slope)`; exact Kalman = free-energy
minimization (`:78-100`). `selectAction` scores 4 actions by EFE `G = risk + ambiguity` (risk =
divergence from K8 homeostatic preference; ambiguity = obs entropy; emit-call penalized by
`1−callHitRate`), softmin (`:104-153`). Actions map to real levers: observe / broaden-attention(K6) /
emit-call(STEP5/6) / hold-emission(HALT). Wiring `_init/_computeEnergyActiveInference` (`:2631/2637`):
updates beliefs on `s.stress`, selects with `setpoint=em._effectiveFloor`, records `actualBehavior`
+ `agreement` (stage-1 proof metric). **No consumer** (DDP field `activeInference` `:2394`). Stage 1
of 3 (widen observations, then tune params via plasticity — deferred). Test: `test-active-inference.js`.

### 3.3 Phase percept — ARMED, branch-only (`agent/phase-percept`)
Browser `limen-phase-percept.js` + server canonical `lib/phase-percept.js` (mirrored; parity enforced by
`test-phase-percept-mirror.js`). `computePercept(prior, companies)`: `posterior ∝ prior + precision·(evidence−prior)`;
evidence = kernel-scored nodes only (valid `p0–p10` token; `ERROR`/`UNKNOWN` excluded); precision
`w=coverage·scored/(scored+3)`; `grounded = w≥0.15 && scored≥2`, else ABSTAINS (holds prior); divergence
flagged `grounded-divergent`. Causal rule: evidence flows nodes→brain only.
Client: `_computeEnergyPhasePercept` (`:2693`) is observational; **arming is in `_computeEnergyPhaseDynamics`**
— `myPhase = groundedPhase` when armed+grounded (`:2292-2294`), router/transition run on that, and it sets
`s.phase/phaseLabel/phaseSource='node-grounded'` (`:2351-2355`). Reversible via `_actuation.phasePercept`.
Server: `handlers/limen-worker-snapshot.js:107-146` runs the same percept for **all domains** after
`buildDomainJoin`, overwriting `dsum.phase`/`phaseLabel` + `stressRanked` when grounded, abstaining when
thin, rolling up `phaseGroundingStats`. **Real prod result:** energy heuristic p5/ENDURANCE → node-grounded
p8/PIVOT (16/18 scored, precision 0.75), grounded-divergent. Tests: `test-phase-percept.js`,
`-mirror.js`, `-energy-phase-percept-wiring.js`, `-worker-phase-grounding.js`.

---

## 4. Data & server pipeline

### 4.1 Feeds (`handlers/domain-snapshot.js`)
Energy = 18 sources in `buildDomain('energy', …)` (`:783-806`). Real stress drivers = numeric price +
doc-count feeds: `fetchEIA` (Brent, `stress=clamp((v−60)/50)`, `:1911`), `fetchFREDEnergy` (WTI,
`clamp((v−55)/50)`, `:1940`), `fetchMassiveCrudeOil` (Polygon CL), Fed Reg DOE/NRC doc-counts. **RSS
energy feeds declare `channel:'stress'` but are demoted** to activity/event (`_isRss`, `STRESS_SCALE.energy=35`,
`:4779-4784`) — they never enter `stressDrivers`. Aggregation `buildDomain` (`:1384-1712`): stress = mean of
`stressDrivers` (cross-domain-reuse cap 0.3, LOW_SIGNAL cap 0.3 if <2 real feeds) + event overlay
(`eventScore·0.3`); confidence = quality/corroboration/specificity/recency weighted; maturity thresholds;
`clusterBoost` only supplements (≤+0.15) when no live driver.

### 4.2 Server snapshot worker (`handlers/limen-worker-snapshot.js`, cron `5,20,35,50 * * * *` = 15 min)
Fetches domain-snapshot + defense-signals. `domainSummary` provisional phase = stress-threshold heuristic
(p5/p3/p2/p1/p0 only; p7a/p8/p9/p10 suppressed server-side, `:48-76`). `stressRanked` sorted desc. Calls
`companyScorer.scoreBatch` then `buildDomainJoin` + `evaluateConvergenceSignals`. **Node-grounded phase pass**
(`:107-146`, branch-only). Writes `console_snapshot` to Redis (TTL 1200) + changelog + `opportunities_snapshot`.

### 4.3 Company/node scoring (`lib/company-phase-scorer.js`)
Registry from `command-board-data.json` (506 CIKs; energy = largest block). `_scoreOne` POSTs to
`limenhelix.com/api/limen/score` (validated kernel, MUST be public domain). Stores `company_phase_{cik}`
(24h TTL: phase/trajectory/composite/alert). Scheduler: elevated = stress≥0.65, priority-queue unscored/stale,
round-robin rest, ≤60 parallel. `domain_company_join` (10min TTL) per-domain: `mapped/scored_count`,
`p7a/p7b/p3/p9_count`, `coverage`, `companies[]` (each `{name,ticker,cik,phase,trajectory,alert,scored}`).
Convergence classes: TERMINAL / INSTABILITY / STRUCTURAL / FAILURE_CLUSTER.

### 4.4 Recorder (`handlers/feed-record.js`, cron `12 * * * *` hourly)
Appends one compact row/domain to `feedhist:<domain>` (lpush+ltrim, CAP 2160 ≈ 90d), idempotent per hour.
`?read=` / `?stats=`. The system's first durable feed memory.

### 4.5 Client hydration (`assets/js/limen-fast-boot.js`) + Thing2 kernel
`getConsoleSnapshotSync` returns `_serverConsole` or localStorage cache; brain reads via
`_getSnapshot` (`domain-brain-base.js:864`). `scoreStress` reads `snap.domains[key].phase`;
`surfaceOpportunities` reads `snap.domainCompanyJoin[key].companies`. Thing2 `phaseOfSeries`
(`limen-thing2-adapter.js:50`) adapts a stress series into the financial kernel (≥8 pts), returns
`{phase,…,interpretive:true,validated:false}` — used only as a phase PRIOR.

---

## 5. Portals & content layer

- **198 energy portal HTML pages** (`energy_*_portal.html` + root) backed by **197 JSONs**
  `assets/data/domains/energy_*.json` (repo-wide: 3,284 `*_portal.html`). Portals store **baked
  activation content** (nodes/companies/treatment labels/triggers) but **NOT** numeric dx/tx readings —
  those derive live at read time. `portal-ui.js:17` sets `DATA` = the domain JSON; synthesizes the dx
  list from `activations[]` when no authored `issues[]`.
- **`energy-condition-trigger-aliases.json`** (857 lines): grounds the **extinction** mechanism — maps
  each condition-code + diagnosis id to the activation `brainNodeIds`/`diagnosticTriggers` that count as
  active, so `energy-extinction.js` doesn't falsely retire activations. Honest `unmapped{}` gaps recorded.
  The brain's own `diagnosisIndex` (`energy-brain.js:104-114`) is a SEPARATE hard-coded 6+2 map.
- **Diagnosis bundles** (`_loadDiagnosisBundles`, `:1558`): fetches
  `artifact-source-index/by-diagnosis/{canonicalId}.json` — **8 files exist** (OIL_SHOCK,
  SYSTEMIC_ENERGY_STRESS, GRID_FREQUENCY_INSTABILITY, INTERMITTENCY_SPIKE, NUCLEAR_INCIDENT,
  PIPELINE_RUPTURE_EVENT, ENERGY_DATACENTER_GRID_STRAIN/WATER_STRESS). Never fabricates.
- **L1 depth** (`_loadL1PortalDepth`, `:1587`): honest finding — **100% of L1 treatments classify as
  mad-lib (template)**, so `admitted:false`; only real tickers surfaced (`relevanceUnverified:true`).
  `portalErrorEstimate` folds into K5.
- **Datacenter sub-portal** (5 JSONs: `energy_datacenter[_cooling/_powerdemand/…]`): the ONLY
  hand-authored, citation-backed (real) treatments. Additive layer, held out of the validated spine.
- **`treatment-discovery/by-node/*.json`** (113 files, ~55MB) — **NOT used by energy** (UI index only).
- **Portals-as-feeds live derivation** (GENERIC, `domain-brain-base.js:575-585`): `_applyDeepDigest`
  (deep sub-portal dx/tx), `_applyDeepFold` (cumulative fold of the ~466k-file deep tree into L1, lit
  live by feed×motif), `_applyLiveDerivation` (`:765` — each dx reading = live feed level × node motif
  failure-pole; supersedes baked text; **BRAKES** any dx wired to a non-node via `canonical-nodes.json`).
- **Runtime fetch** (`portal-content-resolver.js`): static-first from the Vercel bundle; **negative cache**
  1h (the guard against the deep-portal 404 storm); `/api/fetch-portal` (GitHub-backed) only in eager mode.

---

## 6. Outward surface (UI, public front, attached AI)

- **Pages loading the brain (5):** `civilization.html`, `admin-master.html`, `helix-brain-grid.html`,
  `opportunities.html`, `civilization-opportunities.html`. Fixed load order: base → k4 → plasticity →
  active-inference → phase-percept → (decision/workspace/resolver/bus/changelog) → `energy-brain.js`
  (first of 20). Self-instantiates `window.LIMENEnergyBrain`, 30s cycle.
- **Public front (ENERGY-SPECIFIC, bespoke):** `energy.html` = the **Energy Bill X-Ray** at `/energy`
  (free ZIP/usage tool → `POST /api/energy-entry`, anonymized). Unlike the other 19 domains, energy does
  NOT use the generic `domain-front.html`. Handler `handlers/energy-entry.js`.
- **Attached AI (paid, on-demand, admin-gated + kill-switch + daily cap):**
  `handlers/energy-agent.js` (Haiku, cap 150/day, embeds live state, tools steer/config) — but its client
  box `energy-agent-box.js` is an **ORPHAN** (not loaded by any page); energy actually reaches AI via the
  generic `domain-agent-box.js` → `handlers/domain-agent.js` (Sonnet 5). Cross-domain
  `handlers/master-agent.js` (observe-only, no toolCalls) receives the compact self-model payload built at
  `master-consciousness-box.js:212`: `{domain,label,stress,phase,regulation,immune,salience,attend,
  divergence,topDx,topOpp}` — **the last-hop insertion point for `phaseGrounded`/`phaseDivergent`.**
- **Console:** `domain-console.html?domain=energy` loads `domain-console-brain.js` renderer + the full
  overlay stack (§7). State surface = `getEnergyStateSummary()` (`:3222`).
- **Emission/delivery:** `_computeEnergyEmissionQueue` (capital-fit, `requiresSignoff` financial gate) +
  `_runEnergyAutonomousEmission` (fail-safe on brake, research-only autonomous, internal audience-of-one).
  Only operator write paths = `applyRequestBias` / `setEnergyConfig` (clamped; no effector).

---

## 7. Energy neuro-substrate overlay modules (ENERGY-SPECIFIC extras)

Loaded on `domain-console.html` (`:539-548`): `energy-telemetry-adapter.js`, `energy-metaplasticity.js`,
`energy-refractory-limiter.js`, `energy-prediction-error-compressor.js`, `energy-connectivity-audit.js`,
`energy-retrograde-throttle.js`, `energy-extinction.js`, `energy-neuro-substrate.js`. All 7 files confirmed
present.

**Integration status (verified vs unconfirmed — a follow-up audit target):**
- **Wired / referenced in the brain:** refractory-limiter (`_actuation.refractory` + `_refractoryParams`),
  connectivity-audit (`EnergyConnectivityAudit.singlePointsOfFailure` in regulation advisories), E/I balance
  (`EnergyEIBalance.assessFromState`), telemetry-adapter (pulse→runtime overlay + loads the aliases JSON),
  extinction (grounded by `energy-condition-trigger-aliases.json`).
- **Loaded but wiring-into-30s-cycle NOT confirmed in this audit:** `energy-metaplasticity.js`,
  `energy-retrograde-throttle.js`, `energy-prediction-error-compressor.js`.

> This reconciles the engineer's "metaplasticity / removal-mechanisms are missing" note: energy already has
> **modules** for metaplasticity, extinction, retrograde negative feedback, and PE-only compression. Whether
> each is actually driving the live cycle (vs present-but-inert) is the open question to verify before
> claiming these gaps closed.

---

## 8. PORT SPEC — copying energy to the other 19 domains

**Generic (inherited, no port work):** the whole pipeline skeleton, afferent integration, memory pruning,
deep-digest/fold/live-derivation, the emission-rule engine, snapshot hydration, and the SERVER phase
grounding (the worker loops ALL domains; the client inherits via `scoreStress` reading `snap.phase`).

**Phase grounding → PORT = MERGE.** Merging `agent/phase-percept` grounds all 20 domains at once
(server) with zero per-domain code; unscored domains auto-abstain. Then the last hop: add
`phaseGrounded`/`phaseDivergent` to `master-consciousness-box.js:212` + update the `master-agent.js`
prompt. This is the high-value, ready piece.

**Plasticity + active inference → DO NOT PORT YET.** Both are pure SHADOW with **zero consumers**.
Copying dead shadow to 19 domains is the exact "brain-shaped mass nothing reads" failure the project
guardrail forbids. Port only after (a) armed on energy past the `diag.stable` gate AND (b) a real consumer
exists. When porting, **lift the wiring into the generic base path** (next to `_computeGenericKStack`), not
19 hand-copied `_computeEnergy*` methods — the modules are already generic; only the wiring is energy-named.

**Per-domain parameters to set when porting** (not code, config): the domain's feed list + stress mappings
(§4.1), `diagnosisIndex` (its own dx spine), `emissionRules`, interoception weight profile `W`, the K-layer
seeds (its live constants), condition-trigger-aliases, diagnosis bundles, and truth-eligibility (only
finance is `externalRewardEligible`).

**Content depth is the real per-domain gap:** energy's advantage is the datacenter hand-authored
citation-backed treatments + 8 diagnosis bundles + 198 portals. Other domains mostly have mad-lib L1 only.
Porting the *machinery* is cheap; porting *real content* is the work.

---

## 9. Discrepancies & gaps found in this audit

1. **Stale block comment** `energy-brain.js:1946-1949` ("ADVISORY BY DESIGN") contradicts the now-CLOSED
   K-layers. Update the comment.
2. **Worker cron mismatch:** `limen-worker-snapshot.js` header says "every 2-5 minutes"; `vercel.json`
   schedules every 15 min. Fix the header.
3. **Overlay wiring unverified:** metaplasticity / retrograde-throttle / PE-compressor are loaded on the
   console but their live-cycle wiring is unconfirmed (§7).
4. **No consumers** for `energyPlasticity` / `energyActiveInference` / `phaseGrounded` / `phaseDivergent`.
5. **Brain-weights persistence inert** (no `BRAIN_WEIGHTS_TOKEN`).
6. **Double-grounding** after merge: server (heuristic prior) + client energy (kernel prior) both ground.
   Same node evidence so they converge; decide the authority.
7. **Master-agent prompt** still carries the "financial-only is an artifact" framing; not phase-grounding-aware.
