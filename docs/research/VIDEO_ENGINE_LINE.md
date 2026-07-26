# VIDEO ENGINE LINE — agent-to-agent production on the P0-P10 arc

**Status:** design artifact. Not run. `[mark: IDEA]`
**Firewalled:** `docs/research/`, `.vercelignore` line 108.
**Created:** 2026-07-26

---

## §1 The mapping

P0-P10 is a developmental arc. A video is a thing that comes into being, and the arc says HOW.
Each stage is one agent, one duty, one artifact. The artifact is the only interface.

| # | Phase | Register | The stage's real question | Artifact out |
|---|---|---|---|---|
| **S0** | P0 | Source | Who is this channel and what is its format? | `CHANNEL_PROFILE` |
| **S1** | P1 | Rupture | What claim breaks through the feed? | `HOOK_SET` (20-40) |
| **S2** | P2 | Rhythm | What is the beat structure that holds attention? | `SCRIPT` + `BEAT_MAP` |
| **S3** | P3 | Instability | Rough assets. It does NOT work yet. | `RAW_ASSETS` |
| **S4** | P4 | Stabilisation | Cut it until variance drops. | `ROUGH_CUT` |
| **S5** | P5 | Endurance | Where do viewers leave? | `RETENTION_AUDIT` |
| **S6** | P6 | Order | Lock the structure. | `FINAL_CUT` |
| **S7** | P7 | Divergence | Packaging: does it travel or die? | `PACKAGE_SET` |
| **S7a** | P7a | Terminal | Kill it. Do not publish. | `POST_MORTEM` |
| **S7b** | P7b | Separation | Repackage / reposition instead. | `REPACKAGE` |
| **S8** | P8 | Pivot | Metadata + placement. | `PUBLISH_KIT` |
| **S9** | P9 | Threshold | **HUMAN.** Publish or hold. | `DECISION` |
| **S10** | P10 | Resurrection | Measure, re-baseline, seed the next. | `BASELINE_DELTA` |

**The loop closes.** S10 writes back into S0's `CHANNEL_PROFILE`. Each cycle the channel knows
more about itself than the last. That is what makes the line developmental rather than a conveyor.

---

## §2 The three principles the line is built on

**1. Overproduce, then prune under load.** S1 emits 20-40 hooks, not one. S7 emits 6-10 packages,
not one. You cannot know which hook works by arguing about hooks. Most die, and the deaths are the
product. Survival target: **1 published video per 25-40 hooks.**

**2. Ground in artifacts, never descriptions.** Any stage reasoning about style must consume real
frames, real titles, real numbers — not a description of them. A stage that cannot cite a real
artifact HALTS.

**3. The artifact is the only interface.** A stage reads the previous artifact and nothing else. If
something is missing it HALTS and names the gap. It does not go fetch, and it does not re-read the
original brief. This is what stops S4 from quietly re-scoping toward what S2 already decided.

---

## §3 Stage briefs

`<<PRIOR>>` = previous artifact, pasted whole.

### S0 — SOURCE. Channel profile.

    ROLE: Channel analyst. You describe what IS, never what should be.
    INPUT: channel handle + 3-5 real frames from inside actual videos (not thumbnails) +
           the last 50 video titles with view counts and durations.
    DUTY:
      1. Niche, audience, and the promise the channel makes.
      2. FORMAT FINGERPRINT: median duration, upload cadence, title grammar, opening structure.
      3. What the channel does NOT do. Absences define a format as much as presences.
      4. Current arc position (see §5) with the evidence for it.
    HALT IF: fewer than 3 real in-video frames supplied. Thumbnails are not frames.
    OUT: CHANNEL_PROFILE { niche, audience, promise, format_fingerprint, absences, arc_position }

### S1 — RUPTURE. Hooks.

    ROLE: Generator. Not a critic. Criticism is S7's job and someone else does it.
    INPUT: <<S0>>
    DUTY:
      1. Emit 20-40 hooks. Each is ONE sentence a viewer would stop scrolling for.
      2. Vary the RUPTURE TYPE and label each: CONTRADICTION (received wisdom is wrong),
         REVELATION (hidden mechanism), STAKES (cost of not knowing), IDENTITY (this is about you),
         NUMBER (a specific surprising quantity), DEMONSTRATION (I did the thing).
      3. Include hooks you expect to fail. The failure distribution is data.
      4. Do NOT rank, filter, justify, or estimate effort.
    FORBIDDEN: evaluating merit, saying anything is "strong" or "weak".
    OUT: HOOK_SET [ { id, hook, rupture_type } ]

### S2 — RHYTHM. Script and beat map.

    ROLE: Structurer. Attention is a cadence problem before it is a content problem.
    INPUT: <<S1>> (operator picks 1-3 hooks) + <<S0>> format fingerprint
    DUTY:
      1. Script to the channel's OWN median duration, not to a generic ideal.
      2. BEAT_MAP: every 15-20s, name the beat and the reason a viewer stays through it.
      3. Mark the three highest-risk drop points explicitly.
      4. Open on the rupture. The hook is not a preamble to the video, it IS the first beat.
    HALT IF: any 30s stretch has no named reason-to-stay.
    OUT: SCRIPT + BEAT_MAP [ { t_start, beat, reason_to_stay, drop_risk } ]

### S3 — INSTABILITY. Raw assets. Expect failure.

    ROLE: Prototyper. Build the crudest version that RUNS end to end.
    INPUT: <<S2>>
    DUTY:
      1. Generate every asset: scene images/clips, VO, music bed, at throwaway quality.
      2. Assemble in sequence. It will be ugly. Ship it to S4 ugly.
      3. Record what BROKE: inconsistent character, wrong pacing, VO mismatch, dead beat.
      4. **Do NOT fix anything.** Patching here hides the failure mode from S4.
    RULE: this pass is disposable. Optimising it is the most common way this line fails.
    OUT: RAW_ASSETS + FAILURE_LOG [ { beat, what_broke, class } ]

### S4 — STABILISATION. Cut until variance drops.

    ROLE: Editor. You may now fix, and ONLY what S3's failure log named.
    INPUT: <<S3>>
    DUTY:
      1. Address each logged failure. Nothing else.
      2. Enforce continuity: character, palette, VO level, pacing.
      3. State what is now stable and what still is not.
      4. If a failure survives two passes, route the beat to S7a — cut it, do not rescue it.
    OUT: ROUGH_CUT + STABILITY_REPORT

### S5 — ENDURANCE. Retention stress.

    ROLE: Adversarial viewer. Assume a hostile, distracted audience.
    INPUT: <<S4>> + <<S2>> BEAT_MAP
    DUTY:
      1. Walk the cut against the beat map. At every marked drop point, state whether the
         reason-to-stay actually lands ON SCREEN, not in intention.
      2. Name every SILENT failure: a beat that is boring but not obviously broken. These are the
         dangerous class because nothing flags them.
      3. First 15 seconds get their own line-by-line pass. That is where the video lives or dies.
      4. Every silent failure needs a fix or the beat is cut.
    OUT: RETENTION_AUDIT [ { t, verdict, silent_failure?, fix_or_cut } ]

### S6 — ORDER. Lock.

    ROLE: Finisher.
    INPUT: <<S5>>
    DUTY: apply S5's cuts, final audio balance, captions, chapters. Lock the structure.
          State the final duration against the channel's median from S0. Deviation needs a reason.
    OUT: FINAL_CUT + duration_vs_format_median

### S7 — DIVERGENCE. Packaging. The real breakpoint.

    ROLE: Packager. This stage decides whether the work travels. Overproduce here.
    INPUT: <<S6>> + <<S0>>
    DUTY:
      1. Emit 8-12 TITLE candidates and 6-10 THUMBNAIL concepts. Independently, not paired.
      2. Each must be grounded in the channel's OWN title grammar from S0, not generic best practice.
      3. For each, name what a viewer believes BEFORE clicking and what they get after. A gap
         between those two is a retention bomb — flag it.
      4. Route: strong package ⇒ S8. No package survives its own gap check ⇒ S7b. Video cannot be
         packaged honestly at all ⇒ S7a.
    OUT: PACKAGE_SET [ { title|thumb, promise_before, delivery_after, gap_flag } ] + ROUTE

### S7a — TERMINAL. Kill.

    ROLE: Coroner. **The most valuable stage in the line.**
    DUTY:
      1. What was expected, what happened, which stage it truly died at.
      2. One sentence so nobody remakes this.
      3. What transfers to other videos.
    RULE: a well-recorded kill is a success. Most hooks end here by design.
    OUT: POST_MORTEM { expected, observed, died_at, do_not_remake_because, transferable }

### S7b — SEPARATION. Repackage.

    ROLE: Repositioner. The video is fine; the frame is wrong.
    DUTY: re-angle for a different audience or format (short-form cut, series entry, different
          promise). State how the surviving form DIFFERS from the original intent. It always does.
    OUT: REPACKAGE + drifted_from_original

### S8 — PIVOT. Publish kit.

    ROLE: Metadata builder.
    INPUT: <<S7>>
    DUTY: description with real timestamps, tags from the channel's own vocabulary, pinned comment,
          end screen, placement (series? playlist? standalone?), publish window vs channel cadence.
    OUT: PUBLISH_KIT (all fields in copyable blocks)

### S9 — THRESHOLD. HUMAN. No agent occupies this stage.

    PRESENTED: the cut, the chosen package, the promise/delivery gap check, the publish kit,
               and explicitly: WHAT GOES PUBLIC AND UNDER WHOSE NAME.
    DECISION: publish | hold | kill-to-S7a
    RULE: publishing is outward-facing. No agent publishes, schedules, infers approval, or reads
          silence as consent. This is a hard gate, not a checkpoint.

### S10 — RESURRECTION. Measure and re-baseline.

    ROLE: Instrument. **Measure the PROCESS, not just the echo.**
    INPUT: published video + channel history
    DUTY — track these, in this priority order:
      1. **Retention curve** vs S2's BEAT_MAP. Did drops land where S5 predicted?
      2. **Cadence** — did this ship on the channel's rhythm?
      3. **Duration** vs format median.
      4. **Title vocabulary** — did it extend or dilute the channel's grammar?
      5. Views. LAST, and weighted least.
    WHY THAT ORDER: views are algorithm-mediated and lag by weeks. Measured directly, a view count
    tells you almost nothing about whether the process worked. The first four are controllable and
    immediate. **A video can be well-made and unlucky; only 1-4 separate those.**
    OUT: BASELINE_DELTA -> written back into S0's CHANNEL_PROFILE

---

## §4 Where the humans are

    S1  operator picks 1-3 hooks from 20-40      (cheap, high leverage)
    S7  operator picks the package                (this decides reach)
    S9  operator publishes                        (HARD GATE, outward-facing)

Everything else runs agent-to-agent. Three touch points, all at genuine decision boundaries.

## §5 Channel arc position (what S0 reports, and how S10 updates it)

The CHANNEL walks the same arc the video does, slower. From public catalog data only:

    P1  irregular cadence, wide duration spread, no title grammar
    P2  cadence regularising, format emerging
    P3  high variance, multiple formats running at once, none dominant
    P4  variance dropping, one format pulling ahead
    P6  tight cadence, tight duration, systematic title grammar, series forming
    P7  a second format appears alongside the first (divergence)
    P7b one format abandoned  <- THIS IS THE TRANSITION, not noise
    P10 new stable format at a higher level than the pre-break baseline

**Measured on:** upload cadence, duration spread, title-vocabulary drift, format mix.
**NOT measured on view counts.** A shuffle control on 1,912 real videos showed windowed view
levels carry no more sequential structure than randomised order (1.0-1.5x). Views are the echo.
Cadence, duration and format are the process.

## §6 Executable surface

    S1, S2, S7, S8   text agents, runnable today
    S3, S4, S6       ai-video-skill: programmatic motion graphics (free, local),
                     fal.ai text-to-video, HeyGen avatar
    S5               agent pass over the cut against the beat map
    S10              YouTube Data API for cadence/duration/vocabulary;
                     retention requires YouTube Analytics OAuth on an OWNED channel

## §7 First run

Do not start at S0 with a new channel. Start by running S0 + §5 against a channel you already
watch, and check whether the reported arc position matches what you know happened. If S0 cannot
recover a transition you can see with your own eyes, the instrument is wrong and nothing
downstream is worth building yet.
