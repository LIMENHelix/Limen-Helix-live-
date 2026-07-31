# DEFECT LEDGER

Internal. Firewalled from the site in `.vercelignore`.

One list, worked one item at a time. Started 2026-07-31 because defects were being found daily
and not staying fixed: the same class of bug kept reappearing under different names, and the
operator queue in `/vitals` mixed real findings with hardcoded strings and phantom severities.

**Rule for this file:** an item moves to FIXED only when a measurement shows the number moved.
Not when a script exits 0, not when a commit lands. That rule exists because `heal-corpus.mjs`
reported `success: true` on a heal whose count sat unchanged for nineteen days.

---

## THE RECURRING BUG, named once so it stops being rediscovered

**A probe reads a path inside a `try/catch`, the read fails, and the failure is recorded as a
fact about the system rather than a fact about the environment.**

Three separate confirmed instances, all found 2026-07-30/31:

| where | the ENOENT | what it was reported as |
|---|---|---|
| `lib/limen-stress-propagator.js` | `assets/data/brain-connectome.json` absent from the sparse checkout | `inhibitoryEdgesLoaded: 0` — read as "the system has no regulation" |
| `scripts/sense/organ-dead-links.mjs:121` | `assets/js/company-portal-ui.js` absent from the sparse checkout | `fallbackPresent = false` → finding escalated to **HIGH** |
| `scripts/sense/organ-propagator.mjs` | n/a — a hardcoded string, no probe at all | "NO downstream consumers", MED, for two months after the wiring existed |

**The fix pattern** (applied to `organ-propagator.mjs` only so far, use it as the template):
declare required inputs, and on failure emit `INPUT MISSING, not a system finding` naming the
paths. Never infer a system property from a read failure.

---

## OPEN · ranked, knock these out one at a time

| # | item | count | evidence | why it is here |
|---|---|---|---|---|
| ~~1~~ | ~~**Organs still infer from ENOENT**~~ | ~~13 of 14~~ | **FIXED 2026-07-31** — `scripts/sense/_inputs.mjs` + 5 organs guarded | see FIXED table |
| 2 | **`organ-propagator` score ignores `dampedCount`** | 1 | `scoreParts = presence + fresh + size` | it measured `0 damped` for weeks and scored 100. A vital sign that cannot affect the diagnosis |
| 3 | **Dead-link guards** | 25 surfaces | see chart below | **ROOT CAUSE FIXED** — links now resolve 97.6% vs 30.0%. The 25 emitters are still technically unguarded; the remaining 2.4% is the 8 ambiguous tickers, which correctly land on the absent page. Downgrade, do not delete: threading `hp` is still the tidy fix |
| 3b | **Aliases pointing at portals that do not exist** | 165 | `hubbell_incorporated -> hubbell`, `idex_corp -> idex`, `itron_inc -> itron` — target `.json` absent | pre-existing, found while fixing #3. A link resolving through one of these still lands on the absent page, so harm equals having no alias. Stale map entries, probably portals renamed or never built |
| 4 | **`wire-eligible-slugs.mjs` fixes 0 of 2 rewirable rows** | 2 | dry run says `slugs fixed: 0` while 2 rows have a portal under another slug for the same CIK | narrow CIK/alias matching gap. Small and now visible because the healer reports NO EFFECT |
| 5 | **Master Brain gates 4 retired lanes** | 4 | `master-living-brain.js:35-40` gates patent/grant/sba/franchise | strategy retired those lanes; the executor still thresholds them |
| 6 | **Master Brain inbox never built** | 1 | `assets/data/_master-inbox.json` absent | `scripts/build-master-inbox.mjs --apply` exists and has never run |
| 7 | **Dead tickers in live baskets** | 14 | ATGE, CNHI, DFS, EDR, FOVL, GDIT, KOCG, MAXR, PARA, PSO.L, SUM, TWOU, VRNT, WWE | `GDIT` was never a ticker. These handlers serve production |
| 8 | **Null kernel composite on ELIGIBLE portals** | 1 | vitals HIGH | kernel never scored them — CIK mismatch or API failure during generation |
| 9 | **Name-fingerprint dup clusters** | 1 | vitals HIGH | needs a human canonical choice, `scripts/_dedup-analysis.mjs` |
| 10 | **Domain mis-routing** | 5 | pharma SIC on non-medicine domain | fix `domainId` at CB source, then re-wire |
| 11 | **path-C anomalies** | 11 | propagator output, unbounded composites | may be data error; inspect |
| 12 | **Truncated prose in fn entries** | 515 | vitals MED | `heal-prose-truncation.mjs` does not exist yet |
| 13 | **Portals with no kernel reading** | 146 | K1/K2/K3 all empty | K3 design pending. Not actionable yet |
| 14 | **Portals never built** | 174 | split out of the old "176 broken links" | belongs to the paused portal-regen queue, NOT a wiring fix |

---

## DEAD LINKS · the chart

Surfaces that build `company-portal.html?company=<slug>` with no `hp` guard. Measured
2026-07-31 on the full tree: **25 unguarded, 51 total emitters, 1 already guarded**
(`assets/js/kernel-comparison.js` — use it as the reference implementation).

**The real defect was not the missing guard.** 15 of these build the URL from `t.ticker` when the
row has no CIK. Measured before the fix: of 703 portals carrying a ticker, the ticker was the slug
for 190 (27.0%), resolved through the alias map for 21 (3.0%), and **resolved to nothing for 492
(70.0%)**. A labelled COMPANY PORTAL button failed seven times in ten. Not a 404 —
`company-portal-ui.js:1464` tries the slug, then the alias map, then a graceful absent page — but a
70% miss on an action button is a defect, not a mitigation.

**FIXED at the resolver, not at the 25 emitters.** `scripts/wire-ticker-aliases.mjs` fills the map
the receiver already consults, so every emitter is fixed at once including any written later.
**Resolve rate 30.0% → 97.6%.** The residual 2.4% is 8 ambiguous tickers held by several portals
(`abt`, `googl`, `amzn`, `msft`, `fdx`, `ge`, `ctlt`, `atai`) which are deliberately not guessed;
sending an operator to the wrong subsidiary is worse than the absent page.

**Still open, downgraded:** the 25 emit points remain formally unguarded, and **16 of the 25 are one
repeated pattern** (`*-clarity-operator.js`, one per domain, same line). Threading `hp` would drop
the count from 25 to 9. Worth doing, no longer urgent.

| # | file | unguarded | group |
|---|---|---|---|
| 1 | `agriculture-opportunities.html` | 2 | opportunities pages |
| 2 | `communication-opportunities.html` | 2 | opportunities pages |
| 3 | `culture-opportunities.html` | 2 | opportunities pages |
| 4 | `education-opportunities.html` | 2 | opportunities pages |
| 5 | `finance-opportunities.html` | 2 | opportunities pages |
| 6 | `company-lookup.html` | 2 | standalone |
| 7 | `energy-opportunities.html` | 1 | opportunities pages |
| 8 | `environment-opportunities.html` | 1 | opportunities pages |
| 9 | `company-portal.html` | 1 | standalone |
| 10 | `assets/js/company-resolver.js` | 1 | standalone |
| 11-25 | `assets/js/<domain>-clarity-operator.js` × 15 | 1 each | **one pattern**: agriculture, communication, culture, defense, economy, energy, environment, finance, governance, industry, infrastructure, intelligence, population, religion, technology |

Reference fix, already correct in `assets/js/kernel-comparison.js`: gate on `hp` before rendering
the link — `if (d.hp) { …render link… }`, else render the name unlinked.

---

## BLOCKED · not defects, decisions

| item | state |
|---|---|
| **Gate A** | `limen-worker-autoqueue`, `autofire`, `multipass`, `sleep-cycle` paused since 2026-06-01. The propagator IS wired into lane salience via `lib/limen-policy.js`; it drives nothing because these are paused. Restore instruction is in `ops/crons-paused-2026-06-01-pre-gate-a.json`. Operator decision, not a fix |
| **Portal regen** | `autonomous-portal-regen.mjs` queues, never builds, deliberately. The generator produces placeholder-contaminated output; mass-building would multiply that bug |
| **AI-authored heals** | Not built. The PR gate that would contain them IS built and live (`.github/workflows/immune-system.yml`, phase B). Adding an LLM to the daily pulse trades the loop's deterministic guarantee for coverage — operator call |

---

## FIXED · 2026-07-30 → 31

Kept because "nothing stays fixed" is the complaint this ledger exists to answer. Each line
states how it was verified, not that it was committed.

| commit | defect | verified by |
|---|---|---|
| _pending_ | **ENOENT-inference across the sense organs.** `organ-feeds` defaulted `snapshotSrc` to `''`, so one unreadable file would have made all 20 domains read as uncovered and fired a HIGH. `organ-bridge` collapsed two libraries to empty, producing two false HIGHs. `organ-dead-links` invented severity from a missing file. `organ-kernel` collapsed the corpus to zero. `organ-master-brain` reported a gitignored artifact as never built | before/after fingerprint of all 14 organs: **identical** with inputs present; then 4 fault-injection cases reproducing each historical phantom: **4/4 report the gap and refuse to invent the finding** |
| `6d2d6c2a` | `sevRank[a.severity] \|\| 9` — `high` ranks 0, `0 \|\| 9` is 9, so HIGH sorted BELOW med and low | 08:00 pulse: HIGH now at positions 1-2, was 12-14 |
| `f9674559` | `organ-dead-links` counted itself and comment lines; `/g` regex used with `.test()` in a loop skipped every other hit; HIGH severity came from a file missing from the checkout | full-tree run: 2 → 25 unguarded surfaces, item no longer HIGH |
| `1ce3dfe0` | `brain-connectome.json` missing from the sparse checkout | 08:00 pulse summary: `0 damped` → `354 damped` |
| `d8527b62` | **correction** to the above: the LIVE path was never additive, only the audit was blind | `/api/limen-stress-slim`: 6 edges, 354 damped, `loadError: null` |
| `9d0da023` | `heal success = exitCode === 0` | first run after: `wire-eligible-cb NO EFFECT — exited 0 but the count did not fall (2 → 2)` |
| `13073114` | 176 "broken portal links" conflated 174 never-built with 2 rewirable | 08:00 pulse: two separate items, 174 and 2 |
| `2fad9987` | `outcome-ledger.js` claimed the CISS floor was independent of the belief; `marketScore` sits in both terms | behaviour unchanged (comment-only), arithmetic re-verified |
| `11c83217` | sparse checkout excluded the surfaces: audit saw 1 of 40 link-builders | cone simulation: 38 of 40 now inside, 2 excluded are prose |
| `a3c86874` | propagator "NO downstream consumers" was a hardcoded TODO, not a reading | organ now measures: action=[autoqueue,autofire] both paused, display=[company-portal.html] |
| `4df309db` | immune pulse could push code to production unreviewed | 4 scenarios in a throwaway repo: data→main, code→branch, neither leaks |
| `118209d6` | `/vitals` linked none of the three places the pulse reports | markup validated, links present |

---

## NEXT PHASE · efferent

Not started. Opened here so it is not lost.

The system has three afferent pathways and no efferent one. The fold carries L4-L7 up into L1-L3,
the recorder turns the feed river into a reservoir, the estimator fuses channels by precision.
Nothing descends. Measured consequence: `corr(refusal%, liveCount) = -0.029` — the number of live
sources a domain has bears no relationship to whether it can forecast at all.

The smallest real efferent step, from `lib/feed-resolver.js`: `K` is hardcoded at 0.5 in
`deriveForecast`. The ledger already stores `currentStress`, `projectedStress` and
`realizedStress`, so the delta rule `K += eta * (realized - projected) * (mean - cur)` needs no
new storage and no new cron. That single change is the difference between a system that measures
and a system that learns.

Open measurement, unresolved: whether the composite unfreeze (`830491d4`) actually moved the
recorder at the 24h horizon the grader uses. Pre-deploy null is 29.4% pooled movement at 24h
separation, every domain ≥ 12%. The recorder holds 90 days, so this is computable retrospectively
at any time — no live tracker needed.
