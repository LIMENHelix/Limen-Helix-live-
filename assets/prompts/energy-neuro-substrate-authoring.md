# Energy Neuro-Substrate — Authoring Prompts

**Source (only):** LIMEN Helix Comprehensive Neurology Reference.
**Companion data:** `assets/data/deep/energy-neuro-substrate.json`.
**Contract:** additive only. These prompts fill the per-node / per-edge assignments the
source document does **not** supply for Energy. They are prompts, **not** guessed values —
each one must be run against Energy's real data (`assets/data/domains/energy.json`,
`assets/data/deep/energy-fold.json`) by a human or an authoring agent. Every prompt ends
with the same discipline: **if there is no basis in Energy's own data or the source document,
return `unassigned`. Do not fabricate.**

Each prompt is keyed to a `status:needs_authoring` mechanism in the substrate JSON.

---

## EI_SCALING — Inhibition scales with drive (Part XIII.1)

> Energy already signs edges as `excit` / `inhib` / `modul`. For each Energy node in
> `activations[]`, compute its excitatory in-degree and inhibitory in-degree from `edges[]`.
> The document's invariant is: **inhibition must scale with excitatory drive.** Flag any node
> whose excitatory in-degree materially exceeds its inhibitory in-degree — that node is a
> candidate SEIZURE (no-brakes runaway) risk per Part XIV. Output: `{ nodeId, excitIn,
> inhibIn, ratio, flag }`. Do not add or change any edge; report only. If a node has zero
> edges, return `unassigned`.

## INHIB_MOTIF_TYPE — Type each inhibitory edge (Part XIII.2)

> For each `inhib` edge in Energy, classify it as exactly one of the four documented motifs:
> `feedforward` (input excites target + an interneuron that inhibits the target → narrow time
> window), `feedback` (target's output feeds back to inhibit itself → self-limiting/stability),
> `lateral` (active unit suppresses a sibling → contrast / winner-take-all), or `disinhibition`
> (inhibits another inhibitor → permissive gating). Decide **only** from the edge's source/target
> functional_roles and topology in Energy's graph. If the topology does not clearly indicate one
> motif, return `unassigned` — do not guess.

## OSC_BAND — Assign an oscillatory band to functional couplings (Part XIII.3)

> The document gives five bands (delta 1-4, theta 4-8, alpha 8-12, beta 13-30, gamma 30-80+ Hz)
> and the rule **coherence = a routing switch; there is an optimal coupling band and both extremes
> fail.** Energy has no band layer. For each strongly coupled cluster of Energy nodes, propose the
> band whose documented role matches the cluster's function (e.g., local fast processing → gamma;
> maintenance/set → beta; inhibitory gating/idling → alpha). This requires a domain-timing basis
> Energy does not currently encode; **if the cluster has no timing basis in Energy's data, return
> `unassigned`.** This is the item most likely to be a guess — treat it conservatively.

## PRED_DIRECTION — Forward=error / backward=prediction (Part XIII.5)

> Energy has CBLM (stabilizer / forward-model analog) but no predictive direction on edges. For
> each hierarchical edge (parent-portal → child-portal, or group → group), label the up-edge as
> `error` (bottom-up mismatch) and the down-edge as `prediction` (top-down), per the document's
> laminar correlate. Only label edges that are genuinely hierarchical in Energy's structure; for
> lateral/peer edges return `unassigned`.

## PLASTICITY_RULE — Learning rule per edge (Part XIII.6)

> Assign, where Energy's data supports it, which edges are Hebbian-plastic and require a
> homeostatic-scaling counter-process. The document's invariant: **homeostatic scaling must
> counter Hebbian runaway.** For any edge marked plastic, require that a normalizing counter-edge
> or global scaling exist; if it does not, flag as an invariant violation (candidate runaway).
> Energy currently encodes no plasticity; **default every edge to `unassigned` unless Energy's
> data explicitly indicates a learning/weight-update relationship.**

## NEUROMOD_GAIN — Neuromodulatory gain layer (Part XIII.7)

> The document names four diffuse gain systems (DA, NE, 5-HT, ACh) that set global regime
> (gain, SNR, exploration/exploitation, learning rate, arousal). Energy has `modul` edges (4) but
> no named gain layer. For each `modul` edge or `amplifier`-role node, propose which regime it
> sets (gain / SNR / learning-rate / arousal) **from Energy's own domainFunction text**, not from
> the neuromodulator identity (do not assign 'this node = dopamine' — the document gives no Energy
> basis for that). If the domainFunction text does not indicate a regime, return `unassigned`.

## OFFLINE_CYCLE — Mandatory offline maintenance (Part XIII.9)

> The document's invariant: **a mandatory offline maintenance/reset phase — a system with no
> downtime accumulates damage** (synaptic down-scaling + glymphatic clearance during sleep). Energy
> has no offline phase. Propose where in the Energy operating loop (ingest → snapshot → score →
> refresh) an offline maintenance step belongs — one that down-scales accumulated weights and
> clears stale signal (see TERMINATION_CLEARANCE). This is a design proposal for the loop, not a
> data edit; present it as a recommendation, not an applied change.

---

## Discipline (applies to every prompt above)

1. Read only `assets/data/domains/energy.json` and `assets/data/deep/energy-fold.json` for Energy
   facts, and this document's substrate JSON for rules.
2. Change nothing in existing Energy files. Emit assignments only into a NEW overlay object.
3. Return `unassigned` whenever the basis is absent. An honest `unassigned` beats a plausible guess —
   the guess is exactly the failure the source document names (a mapping that omits or fabricates a
   regulatory arm is "lesioned in the same way a brain is").
