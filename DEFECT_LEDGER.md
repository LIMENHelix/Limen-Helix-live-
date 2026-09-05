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

**Four** confirmed instances, all found 2026-07-30/31:

| where | the ENOENT | what it was reported as |
|---|---|---|
| `lib/limen-stress-propagator.js` | `assets/data/brain-connectome.json` absent from the sparse checkout | `inhibitoryEdgesLoaded: 0` — read as "the system has no regulation" |
| `scripts/sense/organ-dead-links.mjs:121` | `assets/js/company-portal-ui.js` absent from the sparse checkout | `fallbackPresent = false` → finding escalated to **HIGH** |
| `scripts/sense/organ-propagator.mjs` | n/a — a hardcoded string, no probe at all | "NO downstream consumers", MED, for two months after the wiring existed |
| `scripts/sense/organ-master-brain.mjs` | `assets/data/_master-inbox.json` is **gitignored**, so CI never sees it | "Master Brain inbox never built", MED, on every pulse. The file exists: 171 KB, generated 2026-06-01 |
| `scripts/sense/organ-feeds.mjs` | *latent* — `snapshotSrc` defaulted to `''` | would have put **all 20 domains** in "NO feed source" at HIGH from one unreadable file. Never fired; one cone edit away |

**FIXED 2026-07-31** by `scripts/sense/_inputs.mjs` and six organs. Accessors return `null` on
failure, never `[]` or `{}`. Findings that depend on a null input are **suppressed, not guessed**,
and the gap is reported separately at LOW. Verified two ways: all 14 organs byte-identical with
inputs present, and 4 fault-injection cases reproducing each phantom above — 4/4 now report the
gap and refuse to invent the finding. Use `_inputs.mjs` for any new organ.

---

## OPEN · ranked, knock these out one at a time

| # | item | count | evidence | why it is here |
|---|---|---|---|---|
| ~~1~~ | ~~**Organs still infer from ENOENT**~~ | ~~13 of 14~~ | **FIXED 2026-07-31** — `scripts/sense/_inputs.mjs` + 5 organs guarded | see FIXED table |
| ~~2~~ | ~~**Scores that ignore what the organ measures**~~ | 3 organs | **FIXED 2026-07-31** — propagator scores `regulation`, master-brain and bridge score `freshness` | replaying the historical 0-damped state now gives **67 IN_PAIN + a HIGH**, where it scored **100 HEALTHY** before |
| 3 | **Dead-link guards** | 25 surfaces | see chart below | **ROOT CAUSE FIXED** — links now resolve 97.6% vs 30.0%. The 25 emitters are still technically unguarded; the remaining 2.4% is the 8 ambiguous tickers, which correctly land on the absent page. Downgrade, do not delete: threading `hp` is still the tidy fix |
| ~~3b~~ | ~~**Stale aliases**~~ → **FRACTAL NETWORK DEAD LINKS** | **16,424 of 30,457 (53.9%)** | measured across all 796 portals 2026-07-31 | **I called this cosmetic and was wrong.** The 165 aliases were a symptom. `company-portal.html:428` used `hasLink = !!(e.slug \|\| e.cik)`, so EVERY functionalNetwork entry with a slug rendered as a clickable company portal regardless of kind. Every one of the 796 portals had dead clicks in its network panel. **8,404 were a category error** — regulators (SEC/FTC/EPA/FDA, 100% dead), executiveTeam (PEOPLE, 99%), marketSignals (94%). **FIXED**: links gated to entity kinds that can have a portal; those three render as plain text, keeping their notes and chips. Remaining 8,687 are real companies awaiting portals → graceful absent page, the designed behaviour |
| ~~4~~ | ~~**`wire-eligible-slugs.mjs` fixes 0 of 2 rewirable rows**~~ | ~~2~~ → **0** | **FIXED 2026-08-18** — direct portal slugs now take precedence over aliases in both audit and wiring resolution | the two rows were false positives: `sunoco_lp` and `heico_corp` both existed, but stale aliases pointed at missing `sunoco` and `heico` files; canonical dry audit now reports no eligible rewirable item |
| 5 | **Master Brain gates 4 retired lanes** | 4 | `master-living-brain.js:35-40` gates patent/grant/sba/franchise | strategy retired those lanes; the executor still thresholds them |
| ~~6~~ | ~~**Master Brain inbox not auditable**~~ | — | **FIXED 2026-07-31** — tracked + added to the cone; CI now reports it **1431h stale (60 days)**, which it could never see before | the artifact was built; the audit was blind |
| ~~7~~ | ~~**Dead tickers in live baskets**~~ | 14 | **ALREADY FIXED — verified 2026-07-31** | all 14 are in `DEAD_SYMBOLS` (`lib/domain-market-feed.js:60-63`) and filtered before any fetch. Probed all **321** tickers against the live endpoint: exactly 14 dead, 307 live, 0 indeterminate — the list is complete. Display path clean too (failed fetches dropped; `/api/culture-markets` returns 22 quotes, zero dead). Religion correctly abstains at 2 live < MIN_TICKERS 3, which the module documents. Residue is ~14 wasted fetch attempts per display cycle |
| 8 | **111 portals claim `validated` on a score the kernel cannot have produced** | 111 | measured 2026-07-31 | started as "1 null composite". The one is `patheon_thermo_fisher` (a Thermo Fisher subsidiary, `cik: null`). Chasing it found the real issue: **180 portals are `ELIGIBLE_NOW` with no CIK**, and 111 of those carry `validationStatus: "validated"`. `limen_backtest.py` scores from EDGAR keyed by CIK. Their composites cluster on **8 values** (0.78 ×34, 0.72 ×32, 0.68 ×20, 0.62 ×19) vs **357 distinct** for the 518 CIK-backed portals, with 9 `lastKernelRun` timestamps all from Oct/Nov 2024. Mostly foreign filers (Airbus, BASF, Shell, Saudi Aramco) and subsidiaries (AWS, google_cloud, pratt_whitney). **6 raise a distress ALERT. 9 back a curated Command Board row.** Audit now detects it at HIGH; **relabelling is an operator decision** because it changes a live surface |
| 9 | **Name-fingerprint dup clusters** | 1 | vitals HIGH | needs a human canonical choice, `scripts/_dedup-analysis.mjs` |
| ~~10~~ | ~~**Domain mis-routing**~~ | ~~5~~ → **0** | **FIXED 2026-08-18** — primary-domain overrides now survive operator-reference regeneration; metadata-only Command Board refresh changed 4 stale source rows and the scoped portal rewire corrected all 5 | `wire-pharma-domain-routing.mjs --dry-run` measured **5 eligible before → 0 after**; corpus audit now reports `domainRouting: 100` and removed the finding |
| 11 | **Upstream path-C scores over propagator cap** | **11 → 8** | inspected 2026-08-18: live scorer reproduced 8 exactly; Ecolab, Rocket Companies, and American Water Works were stale and now score below path C | propagation was already bounded at 5; the organ now measures current CB inputs rather than a stale snapshot. Remaining 8 are v1 kernel outputs and need kernel-validation authority, not a propagator change |
| 12 | **Functional-network prose quality residuals** | **515 legacy audit / 670 expanded → 10** | measured 2026-09-04 | **DETERMINISTIC SUBSET FIXED:** the old audit called 498 complete sentences ending in `..` “truncated” and only noticed leading punctuation on short notes. A shared detector exposed 169 stray leading periods, for 670 unique affected entries. `heal-prose-truncation.mjs` repaired 664 entries across 127 portals without changing a word (498 duplicate terminal periods + 169 leading periods, 3 entries had both). The re-audit reports **0 safe repair targets** and **10 source-backed/operator residuals**; empty, fragmentary, or merely short notes are not auto-completed. Evidence: `assets/data/audit/prose-quality-heal.json` |
| 13 | **Portals with no kernel reading** | **249 → 2** | measured 2026-09-04 against all 796 portals | **K3 RELATIONAL FALLBACK BUILT:** the current count was 249, not the stale 146. K3 now observes relational-map topology only for K1/K2-blind portals; it emits no P0–P10 phase, financial composite, alert, or outcome-validation claim. The deterministic gate persisted **247/247 eligible** readings and abstained on **2** weak maps: `csx` has only 2 relationship categories; `xpo` is 61.9% topology/evidence-tagged. Exact-diff proof reports 0 outside-kernel changes and 0 invalid readings. Evidence: `assets/data/audit/k3-relational-persistence.json`; rerun `node scripts/prove-k3-persistence.mjs` |
| 14 | **Portals never built** | **170 runnable → 167** | measured 2026-09-04 after two bounded batches | **REGENERATION RESUMED, BOUNDED:** identity-aware reconciliation removed 5 already-satisfied curated aliases, then `edison_international`, `mach_natural_resources_lp`, and `sable_offshore_corp` passed fail-closed admission and canonical schema validation. Batch 2 rejected Abeona and Aytu before commit when the repository schema/prose audit found an array-valued singular auditor and 35 notes below the prose floor; admission now catches both defect classes. All 3 admitted portals preserve unavailable/null financial and kernel state. Curated wiring is 100%, with no broken rewirable pointer. **167 eligible portals remain.** Evidence: `assets/data/audit/portal-regeneration-batch-1.json`, `assets/data/audit/portal-regeneration-batch-2.json` |
| ~~15~~ | ~~**Treatment-discovery cube built off a stale node set and silently skipped agriculture**~~ | ~~113 nodes / 26 agri cells~~ | **FIXED 2026-08-19** — measured before→after below | **Before:** `_index.json` builtAt `2026-06-04T14:21:53.355Z`, **113 nodes**, **5,234 cells**, agriculture **26** cells against a 156–188 band for every other domain, `NAc` 60 + `NAcc` 105 as two separate node files, `research` absent. **Root cause was NOT the node registry** — `canonicalNodeIds` already came from `brain-node-business-mapping.json` (123, canonical-aligned); `NODES_111_FILE` was declared at line 53 and **never referenced**, dead code. The real defect was the domain glob `/^[a-z]+\.json$/`, which cannot match `p2_agri.json` (digits + underscore), so agriculture was skipped in silence — the identical failure `domain-identity.js:31` records for the neuro-substrate rollout, and playbook §G.3 forbids. The builder's own line-152 comment misdiagnosed it as "data lives only in deep `p2_agri_*` files, never aggregated"; `p2_agri.json` **is** the aggregate (38 activations, 736 treatments, 0 ids unresolvable to canonical). **After:** **115 nodes**, **5,537 cells**, agriculture **174**, `research` **153** (the silent `science→research` miss the hand-written alias patch omitted), `NAc`/`nACC`/`vMPFC` merged at ingestion with **0 of 150 NAc claims lost**. Domain enumeration now resolves through `domain-identity`; canonical is the id+class source with `_meta.total` and canonical↔taxonomy parity **enforced** at build time |
| 16 | **8 canonical nodes unreachable by the cube builder (L1-only enumeration)** | 8 | measured 2026-08-19 against `origin/main` `756d80a0` | The builder reads only the **28 L1 templates** its glob matches, out of **3,715** files in `assets/data/domains/`. These 8 canonical ids therefore receive no cell, despite being referenced in hundreds of **deep** domain files: **ARC 333 · TrkB 320 · PPN 292 · OLF 292 · PPA 202 · SCN 196 · ASTRO 195 · EBA 180**. Adding `p2_agri` recovered 3 others (**MFC 198, SDH 205, BBB 203** — now 1 cell each, activation-only, **0 treatments and 0 diagnostic triggers**: row-bearing but hollow, disclosed rather than hidden). **Amended with the labelMatch reclassification:** of the 8, exactly **one — `ASTRO` — is reachable today under its longhand label** ("Astrocytes", 1 occurrence, exact region-label match). The other 7 have **no** longhand match, so they are genuinely absent from every source the builder reads, not merely unmapped. Two near-misses are recorded so nobody "fixes" them wrongly: `Arcuate Fasciculus` ≠ `ARC` (Arcuate Nucleus) and `Corpus Callosum` ≠ `CC` (Cingulate Cortex) — different structures with confusable names. **Fix design deferred** (enrich L1 templates vs. a deliberate deep-read pass); a deep read would recount every domain's cells and interact with the L2–L6 content policy, which is a corpus redesign, not a taxonomy fix |
| 17 | **A second brainNodeId namespace: 65 prose region names referenced as node ids** | 65 of 71 | `assets/data/audit/cube-unresolved-ids.json`, generated 2026-08-19 | Sources reference brain nodes by **prose region name** rather than id — `Putamen`, `Spinal Dorsal Horn`, `Perirhinal Cortex`, `Paraventricular Nucleus`, `Olfactory Bulb / Piriform Cortex` — alongside frequency bands (`4-8Hz`, `40Hz`), neurotransmitter tokens (`NMDA/AMPA`, `eCB`) and bare fragments (`Lateral`, `neural`, `inhibitory`). **All of these were already being dropped**; the old code did it silently with a bare `canonicalNodeIds.has()`. The build now publishes them instead of discarding them. **15 of the 71 match a canonical node's region label exactly** after normalisation and are very likely UNMAPPED rather than unknown: ASTRO, CAUD, CING, CLAUST, MI, MICRO, PI, PIN, PRC, PRECUNEUS, PULV, PUT, SDH, SEPT, UNC. Nothing is auto-aliased — only unambiguous casing drift (`NAc`/`nACC`→`NAcc`, `vMPFC`→`vmPFC`) is applied in the builder; `dPFC`, `AMY`, `INS`, `EMG` are left for an operator because choosing between dlPFC/mPFC, BLA/CeA or AI/PI is an anatomical judgement, not a rename |
| ~~18~~ | ~~**Verification ledger, discovery cube and Master Brain inbox described different snapshots**~~ | ~~ledger rollup +172 VERIFIED / +24 DISPUTED over its own records; cube June 4; inbox August 18~~ | **FIXED 2026-08-20** — one orchestrated rebuild and a versioned reconciliation report | The 7,900-record ledger now recounts its rollup from records (**3,700 VERIFIED, 89 DISPUTED, 1,583 THEORETICAL, 2,528 UNVERIFIABLE**) instead of incrementing a second authority. Against the canonical cube, **47,177 unique current claims = 5,910 ledger-matched + 41,267 current without ledger**; **1,990** historical ledger claims are preserved as archived evidence and excluded from current UI totals. The operator's PENDING count is now unique claims, while the old **75,149** broadcast-occurrence count is retained separately. Cube, render summary, unresolved-id report and the research/investment-only inbox share one timestamp and source commit in `assets/data/audit/discovery-store-reconciliation.json`; `scripts/reconcile-discovery-stores.mjs` is the only supported full rebuild path |
| 19 | **Live source quota/credential gaps** | **4 current no-reading rows** | measured 2026-09-04, snapshot `1788566006754-264` | Three rows are one defect class: Economy/BLS Employment, Supply Chain/BLS Freight PPI, and Industry/BLS Manufacturing PPI each spent a separate call from one BLS daily quota. The bounded repair batches all three publisher series into one request, caches only successful monthly responses for six hours in a warm runtime, binds each adapter by exact `seriesID`, and redacts any registration key echoed by BLS. Production movement is **UNMEASURED until exact-SHA deployment**. Culture/Event Registry remains explicitly unavailable because `EVENT_REGISTRY_API_KEY` is unset; no unrelated RSS feed is mislabeled as Event Registry. Evidence: `DOMAIN_SOURCE_RESILIENCE_PROOF_2026-09-04.md` |
| 20 | **Phase-belief abstentions are observable but not diagnosable by channel** | **3 of 20 domains** | measured 2026-09-04, console snapshot `1788575956737` | Industry (`0.067`), Education (`0.072`), and Law (`0.080`) correctly abstain below the protected `0.5` total-precision floor, but the estimator intentionally returns no channel list on that path. The worker can therefore name the refusal but cannot show which inputs lost precision. The telemetry-only repair replays the same pure estimator at a zero diagnostic floor, emits only bounded channel precision and its sum, and discards its belief/correlation result. The authoritative abstention, promotion gate, protected estimator, and domain stress remain unchanged. Production channel cause is **UNMEASURED until exact-SHA deployment and a fresh worker tick**. Evidence: `DOMAIN_NEURO_ABSTENTION_PROOF_2026-09-04.md` |

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

**Threading `hp` is NOT a simple edit, verified 2026-07-31.** The emit points hold `t.cik` and
`t.ticker` and nothing else — there is no `hp` field to gate on. Doing it properly means shipping a
portal-existence index (the 150 KB `companies-manifest.json`) to 25 surfaces, which costs more than
the problem. And after the alias fix these links resolve **97.6%** of the time, so a gate would
remove links that mostly work. The residual 2.4% is the 8 ambiguous tickers, which SHOULD land on
the absent page. **Closed as not-worth-fixing rather than left open forever.**

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

## STOPPED PIPELINES · found by the scoring fix, then actually restarted

Both surfaced only because item #2 made staleness affect the score. Both are now RUN, not reported.

| pipeline | was | cause | now |
|---|---|---|---|
| bridge readings | 1131h (47 days) stale, organ 99/HEALTHY | nothing prompted a rebuild while staleness was unscored | **run** — 511 portals re-evaluated, organ 99/HEALTHY with freshness 100 |
| master inbox | 1431h (60 days) stale, organ 95/HEALTHY | **`scripts/build-master-inbox.mjs` did not exist in this repo**, nor did `lib/master-brain-consumer.js`. Both lived only in the full repo. /vitals told the operator to run a script that was not there | **ported + run** — inbox rebuilt, 2013/2504 artifacts ready, organ 63/IN_PAIN → 96/HEALTHY |

The inbox case is the sharpest example of the whole ledger: a finding, a severity, and a
recommended action, all of which pointed at a script that had never been ported. Following the
instruction would have produced "command not found" and taught the operator to distrust the queue.

---

## LINK-INTEGRITY SWEEP · 2026-07-31

After the fractal-network fix, every navigable surface was checked for the same pattern:
**rendering a link to something structurally incapable of resolving.**

| surface | uses | verdict |
|---|---|---|
| `company-portal.html` functionalNetwork | 51 | **WAS BROKEN, FIXED.** `hasLink = !!(e.slug \|\| e.cik)` linked all 9 categories. 8,404 category-error links removed |
| `assets/js/company-portal-ui.js` | — | clean, mentions functionalNetwork only in a comment; builds no fn links |
| `lib/limen-stress-propagator.js` | graph edges | **clean by construction.** `if (!targetSlug) continue; // edge to a node we don't have`. Nodes come only from portals, so regulators/executives never become phantom nodes |
| `portal.html?domain=` | 46 | destinations deploy — 3,713 of 3,715 domain JSONs (only 2 are L4+, excluded by design). `portal-content-resolver.js` adds a 1h negative cache against the undeployed-deep-tree 404 storm |
| `helix-report.html?cik=` | 39 | page exists, 7 absence handlers |
| `investment-console.html?opp=` | 32 | page exists, 12 absence handlers; the id comes from a live object already on the page, not a stored slug |
| `portal-ui.js` drill (ENTER PORTAL) | — | gated on `n.childPortal` declared in the data, then resolved through the negative-cache fallback |

**The pattern existed in exactly one place.** Everything else either gates on a data-declared
flag, drops unresolvable targets before use, or degrades to a designed empty state.

The generalisable rule, now that it has cost two wrong calls: *check what the page DOES with the
data before judging whether stale data matters.* The 165 aliases looked cosmetic until the
question became "what references these", which surfaced 16,424 dead links across all 796 portals.

---

## AUDIT COVERAGE · proven, not assumed

A CI simulation (`git ls-files` INTERSECT the sparse-checkout patterns, with `fs` stubbed to raise
ENOENT for everything else) runs all 14 organs in exactly the environment the daily pulse gets.
As of 2026-07-31: **no organ is missing an input, and CI agrees with the full tree on every organ
score.** Two checks that CI had NEVER been able to run now do:

| check | was | now |
|---|---|---|
| Master Brain inbox freshness | invisible (gitignored) | **1431h stale — 60 days** |
| Bridge readings freshness | invisible (gitignored) | **1131h stale — 47 days** |

Re-run that simulation after any change to the cone or to `.gitignore`. Those two files were
gitignored while two organs audited their freshness, so the pulse silently skipped both for months.

**Honest score preview:** running the organs on the full tree after these fixes gives overall **89**,
not the 96 the last pulse reported. The drop is organs finally seeing the whole body.

---

## BLOCKED · not defects, decisions

| item | state |
|---|---|
| **Gate A** | `limen-worker-autoqueue`, `autofire`, `multipass`, `sleep-cycle` paused since 2026-06-01. The propagator IS wired into lane salience via `lib/limen-policy.js`; it drives nothing because these are paused. Restore instruction is in `ops/crons-paused-2026-06-01-pre-gate-a.json`. Operator decision, not a fix |
| **Portal regen** | The manual bounded drain is fail-closed and 3 portals have passed across two batches; autonomous scheduling remains deliberately unwired. Anthropic credits are exhausted, so the live path uses the already-configured metered xAI fallback. Batch 2 exposed and closed singular-auditor shape and shallow-prose gaps before publication. **167 eligible portals remain**, and generated relationship source claims are not independently verified. |
| **AI-authored heals** | Not built. The PR gate that would contain them IS built and live (`.github/workflows/immune-system.yml`, phase B). Adding an LLM to the daily pulse trades the loop's deterministic guarantee for coverage — operator call |

---

## FIXED · 2026-07-30 → 31

Kept because "nothing stays fixed" is the complaint this ledger exists to answer. Each line
states how it was verified, not that it was committed.

| commit | defect | verified by |
|---|---|---|
| _this commit_ | **111 portal records exposed unsupported validated K1 scores, including 6 active alerts and 212 research/investment artifacts derived from those scores.** Some records carried CIKs only inside report URLs, and unrelated companies reused the same embedded CIK, so neither “identity absent” nor “identity proven” was safe. | Original verdicts are preserved in `assets/data/audit/unsupported-kernel-claims.json` and the full files at its pinned source commit. Active scores, alerts, bridge matches and derived outputs are quarantined; portal identity/content remains. The corpus audit now describes unverifiable provenance instead of claiming scoring was impossible. |
| _this commit_ | `audit-corpus-vitals.mjs` applied aliases before checking the requested portal, unlike the live company resolver's fetch-direct-then-alias fallback. Valid `sunoco_lp` and `heico_corp` portals were therefore reported as two broken rewirable rows, while the correctly CIK-first wiring script changed zero rows. | focused resolver regression **4/4 passed**; wiring dry run remains **slugs fixed: 0**; canonical corpus audit moves eligible broken **172 → 170**, rewirable **2 → 0**, and no longer emits the eligible broken-link attention item. |
| _this commit_ | **SEC CIK identity drift produced 33 measured HTTP-502 rows:** 32 wrong-CIK rows and one stale-ticker row, represented by 31 keyed identity repairs. V2X had been partially repaired from ticker `V2X` to `VVX` while retaining unrelated CIK `1844488`; its registrant-of-record identity is `VVX` / `1601548`. Three retired public securities are excluded rather than rescored. | repair apply measured every before→after record; the post-rebase idempotence run reports **0 records / 0 files**. SEC submissions probe for `CIK0001601548.json` returns **HTTP 200**, `V2X, Inc.`, ticker `VVX`. Live scorer moved the V2X row from **ERROR / HTTP 502** to **p10 / STABLE**, with **0** corrected-CIK 502s; **24** unrelated error rows remain and are out of this repair's scope. The exact commit SHA is the containing Git commit and is repeated in the PR proof. |
| _this commit_ | **Functional-network prose punctuation was misclassified and incompletely detected.** The legacy audit reported 515 “truncated” entries, but 498 were complete sentences with a duplicated terminal period; its short-fragment condition also missed long notes beginning with a stray period. | the shared detector measured **670** affected entries; the deterministic healer changed **664 entries / 127 files**, consisting of **498** duplicate terminal periods and **169** leading periods with **3 overlaps**. Dedicated and body-wide re-audits report **10 ambiguous residuals**, **0 safe repair targets**, and prose quality **100/100** after rounding. A second healer pass changes **0 files / 0 entries**. Full record-level evidence is in `assets/data/audit/prose-quality-heal.json`; no prose or facts were generated. |
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
