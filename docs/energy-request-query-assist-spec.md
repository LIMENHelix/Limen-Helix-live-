# Energy QUERY + ASSIST Build Spec

Scope: energy domain only. Status: spec (no code written). Governed by
[energy-request-prior-contract.md](energy-request-prior-contract.md) - every element here maps
to that contract's PASS test (section 9). EXECUTE, drafts, effectors, and persistence are out
of scope for this slice.

## 1. What this slice delivers

- **QUERY**: type a request, get a read-only readout of the energy brain's current state,
  carrying an honesty stamp. Zero edits to `energy-brain.js` (pure new reader module).
- **ASSIST**: type a request, it becomes a decaying, competing bias on the spine at the four
  contract injection points; the spine runs and the system reports what changed. Adds four
  additive read-hooks to `energy-brain.js` and one bias-writer. No draft, no action.

Build order is QUERY first (no spine edits), then ASSIST (the four read-hooks).

## 2. Modules

| Module | Responsibility | Touches spine? |
|---|---|---|
| `energy-request-classifier.js` | `text -> Request {channel, intent, biases}`. Keyword default; LLM pluggable behind the same interface. Degrades gracefully. | no |
| `energy-request-console.js` | Intake API, QUERY resolver, ASSIST bias-writer, response formatter, honesty stamp. Exposes `window.LIMENEnergyRequest`. | reads only (QUERY); writes `state.requestBiases` (ASSIST) |
| `energy-brain.js` read-hooks | Four additive fold-ins so the spine reads `state.requestBiases`. ASSIST only. | yes, additive |

UI (an intake box on `domain-console`) is a thin layer over `window.LIMENEnergyRequest.ask()`
and is optional for the programmatic slice.

## 3. Data shapes

```
Request = {
  id, text, createdAt,
  channel: 'query' | 'assist' | 'execute',   // execute -> graceful "not built" (section 8)
  intent,                                     // enum, section 4
  parse: { method: 'keyword'|'llm', confidence },
  biases: {                                   // ASSIST only; QUERY has none
    stressBias,                               // number >= 0, capped
    conditionPriors: [ {condition, weight} ],
    attentionFocus:  [ {id, weight} ],
    valuationWeights: { lane?, company?, urgency? }
  }
}

state.requestBiases = {                       // aggregate the spine reads
  entries: [ {id, biases, at} ],              // one per live request
  // _readRequestBiases() returns the DECAYED, SUMMED, capped aggregate:
  //   stressBias total capped so (external + request) injected pressure <= 0.3
  //   half-life ~10 min (a request is a task set that relaxes, not a permanent command)
}

Response = {
  channel, intent, answer,                    // formatted readout / assist result
  delta?,                                      // ASSIST: what changed vs previous cycle
  stamp: HonestyStamp                          // section 7, always present
}
```

Multiple requests coexist as competing, decaying entries. There is no queue that serializes
selection (contract section 6 forbidden edge).

## 4. Classifier

Single job: `text -> Request`. Never executes. The intent taxonomy:

- **QUERY**: `STATUS`, `DIAGNOSES`, `OPPORTUNITIES`, `COMPANIES`, `SELFMODEL`, `CROSSDOMAIN`,
  `SIMULATION`, `EVIDENCE`.
- **ASSIST**: `FOCUS`, `CONCERN`, `PRIORITIZE`, `PREFER`, `URGENCY`, `SCENARIO`.
- **EXECUTE** (deferred): `DRAFT`, `POSITION`, `PUBLISH`, `MONITOR_CREATE` -> returns the
  graceful "needs the execute channel + sign-off, not built" response. Never partially acts.
- **UNKNOWN**: falls back to `STATUS` plus a capability list. Graceful degradation: a bad or
  off-vocabulary parse yields weak/empty biases so the spine behaves as if no request arrived.

Keyword backend (default, no token cost): a rule table of phrase patterns -> (channel, intent,
bias template). LLM backend (pluggable): same output contract, graded semantic mapping, better
on paraphrase, token cost weighed against the freeze. The contract does not pick one; this spec
only requires the interface be identical so either drops in.

## 5. QUERY resolver (read-only; no spine edits)

Each intent reads existing state and formats it. No mutation, no side effect.

| Intent | Reads | Returns |
|---|---|---|
| STATUS | `state.stress`, `_stressFlag`, `cognition.model`, `energyExecutiveReport.brainStatus` | current stress, regulation state, predicted stress, brain status |
| DIAGNOSES | `state.diagnoses` (active, relevance, blocked/evidenceReason) | active + near diagnoses with why |
| OPPORTUNITIES | `state.opportunities` top N + `moneyChain` | ranked opportunities with doThis/whyPays/timing |
| COMPANIES | `state.companies` + `_pubSignals` bands | flagged companies + distress band |
| SELFMODEL | `state.cognition` (awareness knowns/unknowns, immune, conscience, prediction error), `energyNeuro` | what it knows/does not, immune + conscience state, closed-loop status |
| CROSSDOMAIN | `state.crossDomainEmissions` | what energy is transmitting and to whom |
| SIMULATION | `energySimulation.scenarios` | hypothetical scenarios + falsifiers (labelled hypothetical) |
| EVIDENCE | DDP for the named diagnosis (`evidence`, `bundleStatus`, `warnings`) | source backing + gaps for a claim |

## 6. ASSIST writer + the four read-hooks

ASSIST writes `state.requestBiases`, then triggers one cycle, then reports the delta. The spine
consumes the bias at exactly the four contract injection points, each an additive fold-in:

| # | Injection point | Additive edit in energy-brain.js | Guard (contract) |
|---|---|---|---|
| I | salience | `scoreStress` also folds `requestBiases.stressBias` on the SAME capped channel as `getExternalPressure` | combined injected pressure <= 0.3; never sets stress |
| II | condition prior | `deriveDiagnoses` adds a `requestRelevanceBoost` to matched diagnoses' relevance and marks `requestBiased:true` | raises relevance ONLY; activation still requires a real `_activeConditions` match + pulse; never forces `active` |
| III | attention | `_computeEnergyAttention` adds `requestBiases.attentionFocus` into the salience score | never removes immune/conscience suppressions |
| IV | valuation | `_applyNeuroGating` reads `requestBiases.valuationWeights` to tilt rank BEFORE the K2 cap (so a preferred item can survive the cap) | candidates still generated by the spine; request never authors an opportunity |

ASSIST intent -> bias mapping:

| Intent | Example | Writes |
|---|---|---|
| FOCUS | "watch the grid" | attentionFocus:[GRID_COLLAPSE] |
| CONCERN | "I'm worried about oil supply" | stressBias(bounded) + conditionPriors:[crude/oil] |
| PRIORITIZE | "show me investable, not research" | valuationWeights.lane=INVESTABLE |
| PREFER | "focus on NEE" | valuationWeights.company=NEE |
| URGENCY | "urgent only" | valuationWeights.urgency=IMMEDIATE |
| SCENARIO | "consider a nuclear incident" | conditionPriors:[NUCLEAR] (raises prior; evidence still decides) |

ASSIST response reports the `delta`: which diagnoses re-ranked, which opportunities entered/left
the top set, whether anything the request pointed at is evidence-backed or only request-lifted.
It never claims an action was taken.

## 7. Honesty stamp (every response)

Built from live state, non-negotiable on both channels:

```
HonestyStamp = {
  immuneState,                 // state.energyImmune.immuneState
  confidence,                  // 1 - cognition.model.predictionError.total
  requestLifted?,              // true if the answer was surfaced by an ASSIST bias, not evidence
  interoceptionCaveat: 'stress read rests on a single-channel interoceptive layer (multimodal not yet built)'
}
```

This exists because QUERY/ASSIST read from the self-model, which can score itself healthy on
structural markers over a shallow interoceptive layer (contract section 7). The stamp surfaces
that limit rather than hiding it.

## 8. Hard boundaries (this slice)

- No drafts, no `createDraft`, no effectors. An EXECUTE-intent request returns the graceful
  "not built, needs sign-off" response and stops.
- ASSIST biases live in memory and decay; they evaporate on reload (persistence is freeze-gated,
  contract section 8). Acceptable because a task set is meant to relax anyway.
- ASSIST may trigger at most one on-demand cycle per request on top of the 30s cadence.

## 9. Contract compliance (maps to the PASS test)

- QUERY is side-effect-free read -> PASS.
- ASSIST writes only `state.requestBiases`, consumed only at injection points I-IV, no draft, no
  effector, no `active` forcing, no direct `state.stress`/`opportunities` mutation, competing
  biases not a queue -> PASS.
- No forbidden edge from section 6 of the contract is introduced.

## 10. Build slices

1. **S1 - QUERY** (no spine edits): classifier (keyword) + console reader + STATUS/DIAGNOSES/
   OPPORTUNITIES/SELFMODEL intents + honesty stamp. Fully buildable under the freeze.
2. **S2 - ASSIST wiring**: add `state.requestBiases` + `_readRequestBiases()` decay/cap helper +
   the four additive read-hooks. Verify each hook against the contract with the headless harness
   pattern already used for the K-loops.
3. **S3 - ASSIST intents**: FOCUS/CONCERN/PRIORITIZE/PREFER/URGENCY/SCENARIO + delta reporting.
4. **S4 - remaining QUERY intents**: COMPANIES/CROSSDOMAIN/SIMULATION/EVIDENCE.
5. **UI (optional)**: intake box on `domain-console` over `window.LIMENEnergyRequest.ask()`.

## 11. Open decision (deferred to you)

Classifier backend: keyword (free, rigid, fails off-vocabulary) vs LLM (graded, paraphrase-
robust, token cost against the freeze). The interface is identical either way, so S1 can ship on
keyword and swap later without touching the spine.
