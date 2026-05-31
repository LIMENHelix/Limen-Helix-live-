---
fireDate: 2026-05-31
lane: research-note
cube_cell: BLA__hyperactive__economy
residual_id: residual-BLA-hyperactive-economy-N2D-exposure-therapy
source_treatment: exposure therapy
port_proposal: graded volatility re-exposure
gate_status:
  source_verification:
    verifier: pubmed
    verdict: VERIFIED
    confidence: 0.8
    top_pmid: 34954460
    top_pmid_title: "Exposure therapy for PTSD: A meta-analysis"
    top_pmid_journal: "Clin Psychol Rev 2022"
    secondary_pmids: [30287083, 39505447]
    checked_at: 2026-05-31T13:56:03.339Z
  fidelity_gate:
    source_primitive: {actionClass: re-application, effectClass: recalibration}
    port_primitive: {actionClass: re-application, effectClass: recalibration}
    required_fields_check: passed (re-application + recalibration are unconditional classes)
    verdict: mechanism-coherent
  port_verification:
    verifier: not-yet-built
    verdict: UNVERIFIABLE
    note: "Port proposes a candidate intervention that does not exist in distressed-credit literature as a named protocol. This is by definition — it is what makes the residual a discovery rather than a recapitulation. Gate #36 (target-domain empirical-defensibility audit) is the verifier that would assess this leg's empirical premises against target-domain literature; currently unbuilt."
  lane_assignment:
    triple: (sourceVerified=VERIFIED, portVerified=UNVERIFIABLE, fidelity=mechanism-coherent)
    rule_applied: "mechanism-coherent + source VERIFIED + port UNVERIFIABLE → RESEARCH/PATENT lane (discovery: port doesn't exist yet)"
    chosen_lane: research-note
    rationale: "Research framing carries lower epistemic load than patent. Port is candidate-target, not claim."
claim_class_rendering:
  source_leg: existing-intervention
  port_leg: candidate-target
authoring_disposition: author-on-fire (per port-mechanism-statements.json header)
authoring_note: "The primitives consumed by this fire were pre-existing in the BLA × economy calibration set. This is not a real author-on-fire event in the sense that the calibration ports were authored before any engine fire. The first true mid-fire authoring event will occur when an engine fires on a residual whose primitives are not in the calibration set."
---

# Graded Volatility Re-Exposure as a Candidate Distressed-Credit Intervention: A Cross-Domain Hypothesis Drawn from Exposure Therapy for PTSD

**LIMEN Helix Research Note · 2026-05-31**

*claimClass: existing-intervention (source leg) · candidate-target (port leg)*

---

## Abstract

Exposure therapy for PTSD operates by graded controlled re-exposure to a feared stimulus until the threat-detection threshold of the amygdala-centered circuit recalibrates to match the actual outcome distribution. The mechanism is well-characterized in clinical literature [McLean et al., 2022, PMID 34954460]. We propose, as a candidate intervention not yet demonstrated, a structurally analogous protocol for credit markets exhibiting basolateral-amygdala-pattern reactivity to systemic-risk signals: graded controlled re-exposure of market participants to volatility shocks at pre-announced intervals, repeated until the risk-pricing threshold recalibrates and signals previously classified as systemic threats are reclassified as within-band variance. The structural transfer is mechanism-coherent under the LIMEN fidelity gate: both legs share the action class `re-application` (graded re-exposure of the signal, with the signal preserved) and the effect class `recalibration` (a threshold moves to a new setpoint). We name three testable predictions, and we explicitly state the empirical premises this proposal rests on which have not been verified and which a target-domain audit (forthcoming) would need to check.

## 1. Background

Basolateral amygdala (BLA) hyperactivation underlies the threat-overdetection observed in PTSD, generalized anxiety disorders, and phobias. The clinical literature is settled that the BLA's threat-detection threshold is set by the prediction-error signal generated when an expected outcome differs from an actual outcome [LeDoux 2014; Phelps 2004]. Exposure therapy delivers graded controlled re-exposure to the feared stimulus across multiple sessions; the prediction-error signal recalibrates as the actual benign outcome distribution updates the threshold downward. Meta-analytic evidence is strong (Hedges' g ≈ 0.82 for trauma-focused exposure therapy in PTSD per McLean et al. 2022). The stimulus is preserved; what moves is the system's response.

## 2. Cross-Domain Mechanism Hypothesis (candidate-target, not claim)

Credit markets in the wake of recent crisis episodes display patterns structurally consistent with BLA-style threat-overdetection: minor signals (e.g. NIM compression of single-digit basis points, tenant-credit deterioration in single REIT portfolios) trigger spread-widening responses disproportionate to their actual ex-post outcome distributions. We propose, as a candidate regulatory or central-bank intervention, **scheduled pre-announced graded volatility re-exposure**: at pre-disclosed intervals, the market is exposed to controlled volatility shocks (e.g. announced uncertainty windows, controlled rate-test windows, scheduled stress-disclosure events) calibrated below the actual systemic-threat threshold. The mechanism asserted is that repeated controlled re-exposure recalibrates the risk-pricing threshold to match the actual outcome distribution, just as exposure therapy recalibrates the prediction-error threshold of the amygdala-centered circuit. The volatility signal is preserved; what is intended to move is the market's response threshold.

This is a **candidate-target**, not a claim. The proposal is that the structural mechanism is plausibly transferable; whether it transfers in practice is an empirical question this note does not resolve.

## 3. Testable Predictions

Under the hypothesis, the following would be observable:

3.1. Markets exposed to scheduled controlled volatility windows for N ≥ 4 cycles would show progressively smaller credit-spread reactions to volatility events of similar magnitude in subsequent cycles, controlling for actual outcome distribution.

3.2. The threshold update would be specific to the recalibrated signal class (e.g. volatility) and not generalize to structurally distinct signal classes (e.g. tenant credit deterioration), mirroring stimulus-specific extinction in exposure therapy.

3.3. Markets exposed to a single uncontrolled volatility event (analog: flooding / non-graded exposure) would NOT show recalibration; they would show acute spread-widening followed by partial recovery without threshold update. This prediction is structurally important because it distinguishes the proposed mechanism from suppression-based interventions (e.g. liquidity facilities).

## 4. Limitations and Empirical Premises Requiring Verification

This proposal rests on four empirical premises drawn from the target domain (credit markets) which have not been verified and which would need to be checked before the candidate-target could be promoted to a claim:

**4.1.** *Credit markets have a stable identifiable risk-pricing threshold that is updateable.* The hypothesis presumes the existence of a threshold function similar to a prediction-error-signal-modulated detector. Whether credit-spread response curves exhibit threshold-update dynamics versus continuous reactivity is empirically open.

**4.2.** *The threshold update occurs by graded re-exposure rather than by accumulation of priors or by participant turnover.* Markets are not biological organisms; the "memory" of prior crises may live in institutional rules, participant priors, or in modeling assumptions rather than in a threshold function. The mechanism of update is the operative question.

**4.3.** *Scheduled pre-announced volatility windows are operationally feasible without inducing the very response they aim to recalibrate.* A pre-announced volatility window may itself trigger the threat-pricing response and defeat the protocol. This is a feasibility question independent of mechanism.

**4.4.** *The recalibration would be welfare-improving.* Reducing the response amplitude to systemic-risk signals may correctly recalibrate a threshold currently over-set, OR it may degrade an appropriately-set protective response. The clinical analog has decades of randomized-controlled evidence on outcomes; the financial analog has none.

## 5. Status

This research note is the output of the LIMEN Helix treatment-discovery cube cell `BLA × hyperactive × economy`, residual `residual-BLA-hyperactive-economy-N2D-exposure-therapy`. Source verification (PubMed, tightened gate): **VERIFIED**. Mechanism-fidelity gate: **mechanism-coherent**. Port verification (target-domain empirical-defensibility audit, gate #36): **NOT YET PERFORMED — gate unbuilt**. This note is published as a candidate-target hypothesis to invite empirical work; it does not assert the proposed intervention is effective.

## References

- McLean CP, Levy HC, Miller ML, Tolin DF. *Exposure therapy for PTSD: A meta-analysis.* Clin Psychol Rev. 2022 Feb;91:102115. doi: 10.1016/j.cpr.2021.102115. PMID: 34954460.
- LeDoux JE. *Coming to terms with fear.* Cell. 2014. (Source-leg mechanism citation, BLA fear-circuit literature.)
- Phelps EA. *The human amygdala in social judgment.* Curr Opin Neurobiol. 2004. (Source-leg mechanism citation, BLA threat-detection literature.)

---

# Fire Record (audit trail)

The artifact above was produced by a manual end-to-end fire on 2026-05-31, exercising the residual→artifact chain without the firing trigger being built. This section preserves the chain handoffs so a future audit can verify what the gates actually did to this artifact.

## Handoff 1 — Source verification

```
claim ID:    ntx::BLA-hyperactive-exposure-therapy
verdict:     VERIFIED
verifier:    pubmed (tightened gate, post-2026-05-31)
confidence:  0.8
top PMID:    34954460
top PMID:    "Exposure therapy for PTSD: A meta-analysis" (Clin Psychol Rev 2022)
note:        Top PMID abstract contains claim phrase "exposure therapy".
secondary:   pubmed:30287083, pubmed:39505447
checkedAt:   2026-05-31T13:56:03.339Z
```

Source-leg ready to consume.

## Handoff 2 — Fidelity gate

Primitives consumed from `assets/data/audit/port-mechanism-statements.json` (calibration-set entry, pre-existing). Source and port both: `action="re-application"`, `effect="recalibration"`. Neither class carries `requiredFields` (both are unconditional under the inventory's PASS classification). Comparator verdict: **mechanism-coherent**.

## Handoff 3 — Lane assignment, applied by hand

```
sourceVerified  = VERIFIED      (PubMed PMID 34954460)
portVerified    = UNVERIFIABLE  (no named protocol exists — discovery)
fidelity        = mechanism-coherent

→ mechanism-coherent + source VERIFIED + port UNVERIFIABLE → RESEARCH/PATENT lane
→ Picked: RESEARCH (lower epistemic load; candidate-target framing)
```

## Three reports from this fire

### Report 1 — Did the gates compose?

Yes, cleanly. Three handoffs, zero friction at the interfaces. Source-verification ledger entry was queryable by claim ID directly without translation; fidelity comparator consumed primitives in the schema the comparator already used in calibration; lane rule applied by reading three values off the prior gates' outputs.

The three gates were built in separate turns under separate pressures, with no coordinating refactor between them. They composed without coordination.

**Wiring gap noted, not failure:** the cube's per-residual records carry the OLD residual structure (no `claimClass` field, no link to authored primitives in `port-mechanism-statements.json`, no link to source-verification ledger entry). The artifact was assembled by hand-joining three files. For author-on-fire to be operational at scale, the cube's residual record needs to carry these references explicitly, otherwise every fire repeats the same hand-join. Suggested additions to residual schema: `verificationLedgerKey`, `portMechanismStatementId`, `claimClass`.

### Report 2 — What would a reviewer push on?

The four empirical premises in §4 of the artifact are what gate #36 (empirical-defensibility audit) has to check. Each is a specific, statable, target-domain claim that the fidelity gate did not and structurally cannot verify. Reading the artifact as a hostile reviewer:

> *"Premise 4.1 — that credit markets have a stable identifiable risk-pricing threshold that updates by re-exposure — is doing all the work of the analogy. If this premise is false (e.g. if credit-spread response is continuous-elastic rather than threshold-gated), the entire transfer fails regardless of how cleanly the structural primitives match neurologically. The authors cite no evidence for this premise."*

That's the actual reviewer move. The fidelity gate certifies the analogy is structurally honest; it doesn't certify the target-domain has the structure the analogy requires.

**Concretely, gate #36 needs to verify (for this artifact) four target-domain literatures:**

1. *Existence and updateability of a credit-market risk-pricing threshold* — Adrian-Brunnermeier financial-conditions index, FX threshold models, credit-spread regime literature
2. *Mechanism of threshold update — re-exposure vs prior accumulation vs participant turnover* — Greenwood-Shleifer extrapolative-expectations, reflexivity literature
3. *Operational feasibility of pre-announced volatility windows* — central-bank communication research, forward-guidance literature
4. *Welfare effects of reduced systemic-risk-signal response amplitude* — empirically open in either direction; load-bearing

**Specification for gate #36 derived from this real instance:** target-domain literature router. For each empirical premise extracted from the artifact, route to the appropriate database (NBER, SSRN, ECB papers, IMF working papers, Journal of Finance) with a tightened-query + abstract-substring approach analogous to the PubMed gate. Premise extraction is the harder problem; LLM-extracted premise-list with operator review of the extracted set seems plausible. The verifier itself is a port of the tightened PubMed gate to non-PubMed sources.

**Critically:** the artifact §4 makes the empirical premises EXPLICIT. A research note that buried these premises in framing would be much harder to audit. The author-on-fire authoring discipline of naming the premises is itself a precondition for the next gate to work. Worth standardizing.

### Report 3 — Was author-on-fire workable?

For this specific fire: trivially workable, but only because the primitives existed from calibration. Fair criticism: this run didn't actually test mid-fire authoring; it tested mid-fire *retrieval* of authored primitives.

Honest assessment of authoring from scratch (for a future residual NOT in calibration):

| Step | Time | Notes |
|---|---|---|
| Read source treatment literature, extract mechanism in prose | 5–10 min if PubMed evidence is strong; 30+ min if not | The substantive read |
| Assign source actionClass + effectClass from controlled vocabulary | 5 min clear cases, longer at margin | The propranolol margin grading took multiple turns of dialogue |
| Author port-leg prose — name the analogous mechanism in target domain | **15–30 min** | The real authoring time; this is the substantive analogical work, not gate machinery |
| Assign port-leg classes | 5 min if Step 3 done well | |
| Populate `requiredFields` if classes carry them | 5–10 min | Re-read prose to confirm conditional assertion present; revise if not |
| Run comparator | <1 min | |

**Total per residual: ~30–60 min of operator+AI time** if the analogical work is honest. That IS the audit, not overhead. The 30–60 min IS what catches the analogy that doesn't survive.

**Honest verdict on the disposition:** author-on-fire is workable **at the scale the disposition implies** — one or a small handful of artifacts per session, each carefully fired. NOT workable at high throughput. For grant / patent / research-note lanes consumed by a human, this scale matches.

**Specific friction points worth naming:**

1. *No tooling support for retrieval.* This run hand-joined three files. Per Report 1, the cube schema needs explicit references.
2. *No template for the port-leg prose authoring.* I free-formed the port-leg statement; a structured authoring template (source mechanism → target-domain element identification → analog action prose → analog effect prose) would speed this without prejudicing the substance.
3. *Required-field validation order is wrong for a UI.* Required-field check fires AFTER class assignment. For UI flow, the prompt should be: "you assigned class X which requires assertion Y; please populate Y" — surfacing the requirement at assignment time. Not urgent.

**Net:** the disposition (author-on-fire) holds. The cost is real (~30–60 min per fired residual) and it IS the audit, not overhead. Don't industrialize.
