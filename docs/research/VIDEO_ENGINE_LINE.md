# VIDEO ENGINE — driving a video P0 to P10 (idea to viral)

**Status:** design artifact. Not run. `[mark: IDEA]`
**Firewalled:** `docs/research/`, `.vercelignore` line 108.
**Created:** 2026-07-26. **Rewritten same day** — v1 was an assembly line, which is the wrong shape.

---

## §0 What changed from v1, and why it matters

**v1 treated P0-P10 as production STEPS** — S2 is scripting, S4 is editing, S6 is locking. A
conveyor. Every video walks the same path at the same speed and comes out the end.

**That is wrong. P0-P10 is the state of the VIDEO, not the stage of the work.**

A video is *in* a phase. It has a condition. The system's job is to diagnose which phase it is in
and apply the intervention that unblocks the transition to the next one. Two videos in the same
week can be in P2 and P6. A video can sit in P4 for a month.

**Distress is a stuck transition.** A video stuck at P4 (competent, not spreading) needs a
completely different intervention than one stuck at P2 (no form yet). A conveyor cannot tell those
apart because it only knows what step it is on. A state machine can.

This makes the video engine the SAME ARCHITECTURE as LIMEN itself: diagnose phase from observables,
detect stuck, intervene, re-measure.

---

## §1 THE CEILING — read this before building anything

**P0 → P6 is craft. Controllable.** You can reliably take a video from nothing to genuinely
well-made. Every transition in that range responds to work.

**P7 → P10 is not controllable.** Divergence, threshold and virality are algorithm, timing,
audience mood, and luck. **No system makes a video go viral.** Anything claiming a reliable
idea-to-viral path is selling something.

What a real system CAN do, in descending order of honesty:

1. **Guarantee P0→P6.** Craft is learnable and repeatable. This is most of the value.
2. **Raise P(P7 divergence).** Packaging, timing, distribution, and format-fit shift the odds.
   They do not decide the outcome.
3. **DETECT A BREAKOUT EARLY AND FEED IT.** ← the largest recoverable value, and the most missed.
   The first 2-24 hours of a P7 divergence are when intervention still compounds. Most creators
   publish and move on.
4. **Kill fast at P7a.** Sunk cost is the main enemy after publish.

**Expected distribution, stated as a prior `[mark: prior]`:** of 100 ideas that enter at P0,
roughly 25-40 reach P6 (well-made and published), 3-8 achieve P7 divergence, and 1 or fewer reaches
P10. **A system that claims better than that is measuring something other than virality.**

---

## §2 The phase table — video state, signature, blocker, intervention

| Phase | The video's condition | Observable signature | What blocks the exit | Intervention |
|---|---|---|---|---|
| **P0** Source | Void. Raw material only. | nothing exists | no rupture yet | mine the source: comments, search gaps, own back-catalogue, adjacent-domain transfer |
| **P1** Rupture | An idea has broken in. | one sentence that stops a scroll | it does not actually disrupt anything | force the contradiction: what does the audience believe that this breaks |
| **P2** Rhythm | The idea has found form. | beat structure, a reason-to-stay every 15-20s | shapeless; no cadence | impose the channel's own format fingerprint, not a generic one |
| **P3** Instability | Made, but not working. | assembled, high variance, beats misfire | patching symptoms instead of naming the mode | characterise the failure mode FIRST; do not fix until named |
| **P4** Stabilisation | It works. Competent. | clean, coherent, holds together | competent is not compelling | raise the stakes or cut length; competence without tension dies here |
| **P5** Endurance | Holds attention under load. | retention curve survives the drop points | first 15s not earning the rest | rebuild the opening only; the rest is fine |
| **P6** Order | Fully formed. Well-made. | locked, on-format, publishable | **NOTHING. This is the honest terminus of craft.** | publish. Everything past here is probability. |
| **P7** Divergence | Published. Breaking one way or the other. | CTR and early retention diverge from channel median | packaging promises what the video does not deliver | repackage within hours; title/thumb are the only live levers |
| **P7a** Terminal | Not travelling. | flat vs channel baseline at 48h | sunk cost | **kill. record why. do not rescue.** |
| **P7b** Separation | Found a smaller, different audience. | engagement high, reach low | wrong frame, right content | re-cut for that audience; short-form, series entry, different promise |
| **P8** Pivot | Someone else's pattern picked it up. | traffic source shifts to suggested/external | invisible to the creator | watch traffic sources, not view count |
| **P9** Threshold | Tipping. Algorithm deciding. | velocity accelerating, not decaying | **not controllable** | feed it: shorts cut from it, community post, reply to every comment, sequel queued |
| **P10** Resurrection | Viral. Own life. New baseline. | sustained multiple of channel median | complacency | **treat as the new P0.** Mine it for the next idea. |

---

## §3 Stuck detection — the actual product

Distress is not a phase. **It is failure to leave one.**

    stuck(video, phase) = time_in_phase / median_time_in_that_phase_for_this_channel

Flag `stuck > 2`. The phase where a creator's videos pile up names their real bottleneck:

- **Stuck at P1** — ideas never rupture. Making content nobody was asking about.
- **Stuck at P2** — ideas exist, form never arrives. No repeatable structure. Most common early failure.
- **Stuck at P3** — endless tinkering. Fixing symptoms because the failure mode was never named.
- **Stuck at P4** — **the most common professional plateau.** Everything is competent. Nothing is
  compelling. Craft is sufficient and stakes are absent.
- **Stuck at P6** — finished videos not shipping. Perfectionism as avoidance.
- **Stuck at P7** — publishing into silence repeatedly. Usually packaging, not content.

**The stuck phase is the diagnosis. The intervention column in §2 is the treatment.** That is the
whole system, and it is the same regulation logic as LIMEN's domain brains.

---

## §4 Agents

Not a chain. A **diagnostician plus a bench of specialists**, dispatched by phase.

    DIAGNOSTICIAN   reads the artifact + channel baseline, returns { phase, confidence, stuck, blocker }
                    ABSTAINS on thin evidence rather than guessing a phase. Never skips ahead.

    Then dispatch ONE specialist for the diagnosed phase:

    SOURCE-MINER    P0   comment mining, search-gap analysis, back-catalogue transfer
    RUPTURE-SMITH   P1   20-40 hooks, six rupture types, no ranking, includes expected failures
    RHYTHM-SETTER   P2   beat map to the channel's own median duration
    FAILURE-NAMER   P3   characterise, do NOT fix. Naming is the whole duty.
    STAKES-RAISER   P4   the P4 plateau specialist. Tension, not polish.
    OPENING-SURGEON P5   first 15s only, rebuilt line by line
    PACKAGER        P7   8-12 titles, 6-10 thumbs, generated independently, each gap-checked
    CORONER         P7a  post-mortem. Most-used specialist by design.
    RE-CUTTER       P7b  re-frame for the audience that actually showed up
    AMPLIFIER       P9   breakout response, hours not days
    MINER           P10  treat the hit as new source material

**Human gates, three:**
- hook selection (P1) — cheap, high leverage
- package selection (P7) — this decides reach
- **publish (P6→P7) — HARD GATE. Outward-facing. No agent publishes, schedules, or infers approval.**

---

## §5 What to measure, and in what order

    1. Time-in-phase per video          -> the stuck map. THE PRODUCT.
    2. Retention vs the P2 beat map     -> did the structure hold where it was designed to
    3. First-24h velocity vs channel median -> P7 divergence signal, the only early one
    4. Traffic source mix               -> P8 detection; invisible in view count
    5. CTR vs channel median            -> packaging, isolated from content
    6. Total views                      -> LAST, weighted least

**Why views are last.** A shuffle control on 1,912 real videos across four channels found windowed
view levels carry no more sequential structure than randomised order — 1.0x on the channel whose
arc looked most dramatic, 1.5x at best elsewhere. Views are algorithm-mediated and lag by weeks.
**A video can be excellent and unlucky. Only 1-5 separate craft failure from bad luck.** A system
optimising on views cannot tell you which one happened, and will therefore teach you the wrong
lesson roughly as often as the right one.

---

## §6 The honest summary

**This system cannot make a video go viral.** It can:

- take an idea reliably from P0 to P6 (well-made, on-format, published)
- tell you WHICH transition you are stuck at, which is the thing creators cannot self-diagnose
- raise the odds at P7 through packaging and timing
- catch a P9 breakout inside hours, when feeding it still compounds
- kill dead videos fast instead of nursing them

**P10 remains a probability, not a destination.** The system's real output is a higher hit rate and
a much shorter time-to-kill, not a viral guarantee.

## §7 First run

Do not start on a new video. **Run the DIAGNOSTICIAN over an existing catalogue** and produce the
stuck map. If it says a creator is stuck at P4 and they recognise that as true, the instrument
works. If it cannot recover a bottleneck the creator already knows they have, nothing downstream is
worth building.
