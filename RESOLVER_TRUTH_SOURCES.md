# Resolver External-Truth Sources (hippocampus component 2 of 3 — SPEC ONLY)

INTERNAL — firewalled via `.vercelignore`. Repo/history only. No code, no deploy.
Written 2026-07-16. Prerequisite: component 1 (RECORDER, feed-record.js) merged + weeks of history.
Parent: HIPPOCAMPUS_CONSOLIDATION_SPEC.md.

## Purpose
The RESOLVER closes the loop: it grades each domain's stress FORECAST against what
REALITY actually did, producing the (error, reliability) label the CONSOLIDATOR fits on.
The label MUST come from an observable EXTERNAL to the brain's own feeds — grading a brain
against its own inputs is self-graded homework (the flaw in the current truth-brake ledger,
which scores calls against the brain's own stress number).

## THE HARD LIMITATION (lead with this)
Only ~8 of 20 domains have a clean, external, verifiable observable. The rest have laggy
proxies or NOTHING. Per the project's no-fabrication doctrine (same posture as _pubSignals={}
on degenerate data), the resolver ABSTAINS — returns NO label — for domains with no external
truth. It never invents one. Learning lights up in a subset first; that is correct, not a gap.

## Resolution mechanics (applies to every resolvable domain)
- Compare FORECAST DIRECTION (rising / falling / stable) against the REALIZED direction of the
  external observable over a per-source CALENDAR window. Not the brain's cycle-count horizon.
- Emit: { forecastId, domain, predictedDir, realizedDir, error, reliability, truthSource,
  window, resolvedAt }. error = magnitude of the miss (0 = perfect, up to 1). reliability =
  truth-source quality x freshness x cross-source agreement (feeds RULE 1 weighting).
- ABSTAIN path: { domain, status:'no-external-truth' } — logged, never fabricated.

## THREE DESIGN RULES (each prevents a named failure)
1. FORWARD-ONLY / NO LEAKAGE. Prefer truth the brain does NOT ingest (e.g. XLE ETF realized
   vol — the energy brain reads crude, not the ETF). Where overlap is unavoidable, use ONLY
   post-forecast values the brain had not seen. Contemporaneous overlap = self-grading.
2. SERVER-DERIVED FORECAST. The brain's forecasts live in BROWSER state; the server never sees
   them. But the RECORDER now gives the server the stress history, so the resolver computes the
   SAME slope-projection itself and grades that — whole loop stays server-side + deterministic.
   (Alt: browser POSTs its forecasts — more moving parts; NOT recommended for v1.)
3. CALENDAR HORIZON, NOT CYCLE COUNT. The brain's EK_FORECAST_HORIZON=8 is 8 CYCLES, not time.
   The resolver sets its own per-source window (5 trading days for market truth; "next release"
   for monthly gov data). Wiring "8" as 8 hours grades against noise.

## Per-domain mapping
Legend — VERIFY = confirm the exact series ID / API path before wiring (do NOT assume).

### TIER A — STRONG (clean daily market / weekly-index truth)
- ENERGY: Yahoo XLE, USO, UNG (ETF vol/return, brain does NOT ingest these); EIA API v2 crude
  WTI series RWTC, Henry Hub RNGWHHD [VERIFY v2 facet path]. Stress-rose = price spike OR XLE
  realized-vol up. Cadence daily.
- FINANCE: FRED BAMLH0A0HYM2 (ICE BofA US HY OAS — credit-stress gold standard), VIXCLS; Yahoo
  HYG, KRE. Stress-rose = HY spread widens / VIX up / HYG drawdown. Daily.
- ECONOMY: FRED NFCI (Chicago Fed Nat'l Financial Conditions, weekly), T10Y2Y; Yahoo ^GSPC.
  Stress-rose = conditions tighten / curve inverts / index drawdown. Weekly+daily.
- SUPPLYCHAIN/TRADE: NY Fed GSCPI [VERIFY host — NY Fed site, may not be on FRED]; Freightos FBX
  freight index; Yahoo BDRY. Stress-rose = pressure index up / freight rates spike. Monthly+daily.
- TECHNOLOGY (market side ONLY): Yahoo XLK, SMH, ^NDX. Stress-rose = tech/semi drawdown or vol up.
  Daily. NOTE: cyber-incident stress has NO clean daily truth — that sub-signal is Tier C.
- INDUSTRY: FRED INDPRO (monthly), ICSA (weekly initial claims); Yahoo XLI. Stress-rose =
  production falls / claims rise / XLI drawdown. Weekly+monthly.
- AGRICULTURE: Yahoo DBA, CORN, WEAT, SOYB, MOO. Stress-rose = crop-input futures spike / DBA
  vol up. Daily but weather-noisy (lower reliability weight).
- DEFENSE (CAREFUL SIGN): Yahoo ITA, GLD, crude. Measure ESCALATION via safe-haven co-movement
  (oil+gold+VIX co-spike), NOT ITA direction (defense stocks RISE on conflict = wrong sign if
  used naively). Daily. Transform is the tricky part — spec the sign explicitly when built.

### TIER B — MODERATE (laggy / proxy; LOW reliability weight)
- GOVERNANCE: FRED USEPUINDXD (Economic Policy Uncertainty, daily) [VERIFY series]. Proxy only.
- INFRASTRUCTURE: Yahoo XLU vol / PAVE as weak proxy — reflects INVESTMENT not distress. Weak.
- ENVIRONMENT: NOAA billion-dollar-disaster / nat-cat insurance losses. Very laggy. Weak.

### TIER C — ABSTAIN (NO external truth — resolver returns no label, never fabricated)
Health/Medicine, Research/Science, Education, Communication, Culture, Law, Population, Religion,
Intelligence, + Technology's cyber sub-signal. Adverse-event counts / enrollment / congregation
decline / breaches have no daily external observable. Brains keep running; they get NO learning
signal until a real external series is sourced. DO NOT invent one.

## Runtime-key caveat
Domain runtimeKeys vary in the codebase (health vs medicine, research vs science, trade vs
supplyChain). Confirm each key against the domain registry (command-board-data / domains registry)
before wiring — map by CONCEPT above, not by assumed key string.

## Verify-before-wiring checklist
- [ ] EIA API v2 facet paths for RWTC / RNGWHHD (v2 differs from v1)
- [ ] GSCPI hosting (NY Fed vs FRED) + cadence
- [ ] FRED series IDs: BAMLH0A0HYM2, NFCI, VIXCLS, T10Y2Y, INDPRO, ICSA, USEPUINDXD
- [ ] Yahoo endpoint that returns free daily OHLC without a key (or a free alt)
- [ ] Confirm each Tier-A truth is NOT already an input to that domain's brain (leakage check)

## Build order when history matures
2a. FORECAST LOG (server-derived slope-projection persisted per domain per cycle) — cheap.
2b. RESOLVER (grade matured forecasts vs the Tier-A/B sources above; abstain on Tier C).
Then component 3 CONSOLIDATOR: offline fit weighted by error x reliability (RULE 1), decayed by
count (RULE 2), Bayesian few-parameter with prior on today's defaults (RULE 3).
