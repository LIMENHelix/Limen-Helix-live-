/**
 * api/limen-worker-autofire.js — Autonomous engine firing for HIGH-salience single-call lanes
 *
 * Closes the perception→action loop. Reads HIGH-salience PENDING
 * entries from the autoqueue, generates the recommended artifact via
 * /api/expand-artifact-claude, persists to /api/limen-engine-output
 * as READY_TO_SIGN, marks autoqueue FIRED, logs the action.
 *
 * Cron every 30 min.
 *
 * SAFETY GUARDS (must-have for autonomous Anthropic spend):
 *   - Single-call lanes only (investment, research). Multi-pass lanes
 *     stay operator-fire because they take 6-25 min and exceed the
 *     300s Vercel function budget.
 *   - Shared autonomy master arm + daily budget cap. Both
 *     LIMEN_AUTONOMY_ENABLED=1 and LIMEN_AUTONOMY_DAILY_USD>0 are
 *     required; lib/autonomy-budget is the single spend ledger.
 *   - Per-CIK 24h dedupe — same CIK won't auto-fire twice in 24h.
 *   - HIGH salience only — MEDIUM/LOW stay operator-fire.
 *   - Status persisted as READY_TO_SIGN only when placeholder-free;
 *     otherwise DRAFT_NEEDS_DATA. Never auto-submitted externally.
 *   - Max 2 fires per cron tick — bounds invocation time.
 *
 * GET /api/limen-worker-autofire
 *   Returns summary { evaluated, fired, budgetSpent, dedupedCount,
 *   errors, sample }.
 */

var db = require('../lib/limen-db');
var stageClassifier = require('../lib/limen-stage-classifier');
var { loadPortal } = require('../lib/portal-loader');
var cronAuth = require('../lib/cron-auth');
var autonomyBudget = require('../lib/autonomy-budget');
var aiKillSwitch = require('../lib/ai-kill-switch');
var fs = require('fs');
var path = require('path');

var AUTOQUEUE_KEY = 'autoqueue';
var AUTOFIRE_AUDIT_LOG = 'autofire_audit_log';
// Per (CIK, lane) dedupe so same CIK can fire DIFFERENT lanes within
// 24h. Same lane re-fire blocked for 24h to prevent thrashing.
var CIK_DEDUPE_PREFIX = 'autofire_cik_lane_dedupe_'; // _{cik}
var CIK_DEDUPE_TTL = 86400;
var AUDIT_LOG_MAX = 500;
var AUDIT_LOG_TTL = 30 * 86400;

// 1 fire per tick — guarantees we stay within Vercel's 300s budget
// even on the slowest Sonnet call (we've seen 270s+ on dense lanes).
// Cron runs every 30 min, so 48 fires/day cap is structural even
// before the dollar budget binds.
var MAX_FIRES_PER_TICK = parseInt(process.env.AUTOFIRE_MAX_PER_TICK || '1', 10);
var SINGLE_CALL_LANES = new Set(['investment', 'research']);

// Per-call estimated cost in dollars — order-of-magnitude (Sonnet 4.6
// pricing as of build date). Conservative high-end estimate so we
// don't overshoot budget.
var COST_PER_CALL_USD = { investment: 0.40, research: 0.30 };

var BASE = process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://limenhelix.com';

function _internalHeaders() {
  var h = { 'content-type': 'application/json' };
  var master = process.env.ADMIN_MASTER || process.env.ADMIN_MASTER_KEY || '';
  if (master) h['x-limen-pass'] = master;
  return h;
}

// ── Portal load (matches lib/company-phase-scorer pattern) ──
var _PORTAL_CACHE = {};

// Per-slug company portal via the shared loader (fetch-first /assets/data/
// companies/<slug>.json, fs-fallback while includeFiles still bundles). Keeps the
// per-invocation cache + null-on-miss so the loop's skip behavior is unchanged.
async function _loadPortal(slug) {
  if (!slug) return null;
  if (_PORTAL_CACHE[slug]) return _PORTAL_CACHE[slug];
  var r = await loadPortal(slug);
  if (r && r.portal) { _PORTAL_CACHE[slug] = r.portal; return r.portal; }
  return null;
}

function _slugForCik(cik) {
  // Try common slug-from-name heuristics; otherwise the portal-loading
  // will simply return null and we skip this CIK.
  var manifestPaths = [
    path.join(__dirname, '..', 'assets', 'data', 'companies-manifest.json'),
    '/var/task/assets/data/companies-manifest.json',
    path.join(process.cwd(), 'assets', 'data', 'companies-manifest.json')
  ];
  for (var i = 0; i < manifestPaths.length; i++) {
    try {
      if (!fs.existsSync(manifestPaths[i])) continue;
      var m = JSON.parse(fs.readFileSync(manifestPaths[i], 'utf8'));
      var normFocal = String(cik).replace(/^0+/, '') || '0';
      var idx = m.index || {};
      for (var slug in idx) {
        if (!idx.hasOwnProperty(slug)) continue;
        var entry = idx[slug];
        var entCik = String((entry && entry.cik) || '').replace(/^0+/, '') || '0';
        if (entCik === normFocal) return slug;
      }
    } catch (_) { /* try next */ }
  }
  return null;
}

// ── Scope templates per lane (mirror _test-multipass-generic.mjs) ──
var SCOPE_TEMPLATES = {
  investment: {
    title: 'Multi-horizon investment thesis for {company}',
    description: 'Equity-investment thesis covering 12-month tactical, 36-month strategic, and 60-month structural horizons. Includes phase-conditioned scenario tree, position-sizing recommendations, and explicit kill-criteria.',
    problemStatement: 'Generic equity research treats {industry} sector exposure uniformly despite wide intra-sector dispersion in operational phase. A position in {company} requires phase-specific entry/exit logic, scenario-conditioned downside, and a kill-criteria framework that does not require panic-driven discretion at the threshold.',
    proposedApproach: 'Three-horizon scenario tree with probability-weighted IRR per scenario. Position sizing keyed to Kelly criterion under quoted scenario probabilities, capped at portfolio-concentration limits. Kill criteria specified ex-ante across phase transition triggers, leverage/liquidity covenants, and reflexive market events.'
  },
  research: {
    title: 'Structural research brief — {company}',
    description: 'Independent research brief for {company} ({industry}) suitable for institutional consumption. Covers competitive moat, capital efficiency, scenario-conditioned cash-flow durability, and three-event-horizon catalysts.',
    problemStatement: 'Institutional investors evaluating {company} need a research artifact that synthesizes operational topology, capital-structure exposure, and event-conditioned cash-flow paths in one document. Sell-side coverage tends to be either superficial (snapshot) or so detailed it loses the decision-relevant signal.',
    proposedApproach: 'Five-section brief: Operating model + topology of dependencies, Capital structure + covenant ladder, Three scenario-conditioned 5-year free cash flow paths, Three-event-horizon catalyst calendar with binary outcomes flagged, Methodology + sources + assumptions ledger.'
  }
};

function _specializeScope(template, portal) {
  var company = portal.name || portal.companyId || 'Subject Entity';
  var industry = (portal.industry || 'multi-segment operations').replace(/\s+/g, ' ');
  function subst(s) {
    return s.replace(/\{company\}/g, company).replace(/\{industry\}/g, industry);
  }
  return {
    title: subst(template.title),
    description: subst(template.description),
    problemStatement: subst(template.problemStatement),
    proposedApproach: subst(template.proposedApproach)
  };
}

// Full per-company network-stress node (with the named source counterparties)
// from the bundled spider-web snapshot. This is the DEEP read — the slim Redis
// map (for routing/UI) drops inducedSources; the artifact context wants the
// causation, so it reads the full node here. Cached per cold start.
var _STRESS_STATE = null;
function _loadStressNode(slug) {
  if (!slug) return null;
  if (_STRESS_STATE === null) {
    _STRESS_STATE = {};
    var paths = [
      path.join(__dirname, '..', 'assets', 'data', 'stress-network-state.json'),
      '/var/task/assets/data/stress-network-state.json',
      path.join(process.cwd(), 'assets', 'data', 'stress-network-state.json')
    ];
    for (var i = 0; i < paths.length; i++) {
      try {
        if (!fs.existsSync(paths[i])) continue;
        var sn = JSON.parse(fs.readFileSync(paths[i], 'utf8'));
        var arr = (sn && sn.propagated) || [];
        for (var j = 0; j < arr.length; j++) { if (arr[j] && arr[j].slug) _STRESS_STATE[arr[j].slug] = arr[j]; }
        break;
      } catch (e) { /* try next path */ }
    }
  }
  var n = _STRESS_STATE[slug];
  if (!n) return null;
  var srcs = Array.isArray(n.inducedSources) ? n.inducedSources.slice(0, 6).map(function (s) {
    return { source: s.sourceSlug, contribution: s.contribution, via: s.edgeCategory };
  }) : [];
  return {
    inducedStress: n.inducedStress, totalStress: n.totalStress,
    amplificationRank: n.amplificationRank, isHub: !!n.isHub,
    stressRatio: n.stressRatio, topSources: srcs
  };
}

function _buildContextPacket(portal, lane) {
  var template = SCOPE_TEMPLATES[lane] || SCOPE_TEMPLATES.research;
  var scope = _specializeScope(template, portal);
  var financialHealth = portal.financialHealth || {};
  return {
    subject: {
      cik: portal.cik || '0000000000',
      slug: portal.slug,
      entityName: portal.name,
      industry: {
        naics: portal.sic || '999999',
        label: portal.industry || 'Multi-segment',
        descriptor: portal.industry || 'Multi-segment operations'
      },
      proposedScope: scope
    },
    evidence: {
      citations: [
        { author: 'Porter, M.E.', year: 2008, title: 'The Five Competitive Forces That Shape Strategy', journal: 'Harvard Business Review', volume: '86(1)', pages: '78-93', doi: '10.0/hbr-2008-86-1', source: 'Porter (2008)', sourceType: 'foundational' },
        { author: 'Brynjolfsson, E. and McAfee, A.', year: 2017, title: 'The Business of Artificial Intelligence', journal: 'Harvard Business Review', volume: '95(4)', pages: '3-11', doi: '10.0/hbr-2017-95-4', source: 'Brynjolfsson & McAfee (2017)', sourceType: 'practitioner-peer-reviewed' }
      ],
      news: [], priorArt: [],
      financial: {
        latestQuarter: financialHealth.latestQuarter || '2026Q1',
        historyQuarters: 16
      },
      networkStress: _loadStressNode(portal.slug)
    }
  };
}

async function _fireOne(entry) {
  var slug = _slugForCik(entry.cik);
  if (!slug) {
    return { skipped: true, reason: 'no-portal-for-cik', cik: entry.cik };
  }
  var portal = await _loadPortal(slug);
  if (!portal) {
    return { skipped: true, reason: 'portal-load-failed', cik: entry.cik };
  }

  var lane = entry.recommendedLane;
  var packet = _buildContextPacket(portal, lane);
  var sig = 'autofire-' + lane + '-' + entry.cik + '-' + Date.now();

  // Call expand-artifact-claude (single-call only — investment / research)
  var expandResp;
  try {
    var r = await fetch(BASE + '/api/expand-artifact-claude', {
      method: 'POST',
      headers: _internalHeaders(),
      body: JSON.stringify({
        lane: lane,
        cik: entry.cik,
        sourcePatternSig: sig,
        readiness: 0.62,
        contextPacket: packet,
        kernelSnapshot: {
          thing2: {
            dominantPhase: entry.to,
            stress: 0.4,
            trajectory: entry.direction === 'deteriorating' ? 'ESCALATING' : 'STABILIZING'
          },
          ts: Date.now()
        }
      }),
      // 240s leaves ~60s headroom under Vercel's 300s function cap
      // for portal-load + persist + audit-write
      signal: AbortSignal.timeout(240000)
    });
    expandResp = await r.json();
  } catch (e) {
    return { skipped: false, ok: false, billableAttempt: true, cik: entry.cik, lane: lane, reason: 'expand-error', detail: String(e.message) };
  }

  if (!expandResp || !expandResp.ok) {
    return {
      skipped: false, ok: false, cik: entry.cik, lane: lane,
      billableAttempt: true,
      reason: 'expand-not-ok', detail: (expandResp && expandResp.error) || 'unknown'
    };
  }

  var outer = expandResp.structured || {};
  var inner = outer.structured || outer;
  var draftBody = expandResp.draftBody || '';
  var wordCount = draftBody.split(/\s+/).filter(Boolean).length;

  // Persist as READY_TO_SIGN — human still signs before any external submission
  var persistResp;
  try {
    var p = await fetch(BASE + '/api/limen-engine-output', {
      method: 'POST',
      headers: _internalHeaders(),
      body: JSON.stringify({
        cik: entry.cik,
        slug: slug,
        engineId: 'engine-' + lane,
        lane: lane,
        sourcePatternSig: sig,
        readiness: 0.62,
        operator: 'autofire-worker',
        kernelSnapshot: { thing2: { dominantPhase: entry.to, stress: 0.4, trajectory: entry.direction === 'deteriorating' ? 'ESCALATING' : 'STABILIZING' }, ts: Date.now() },
        payload: {
          title: inner.title || (lane.toUpperCase() + ' — ' + (portal.name || slug)),
          lane: lane,
          agency_or_office: inner.agency_or_office,
          format_standard: inner.format_standard,
          draftBody: draftBody,
          structured: {
            title: inner.title, lane: lane,
            sections: inner.sections || [], openItems: inner.openItems || [],
            readyToSignChecklist: inner.readyToSignChecklist || [],
            readyToSign: !!inner.readyToSign,
            wordCount: wordCount,
            evidenceCitationsUsed: inner.evidenceCitationsUsed || []
          },
          readyToSign: !!inner.readyToSign,
          openItems: inner.openItems || [],
          readyToSignChecklist: inner.readyToSignChecklist || [],
          wordCount: wordCount,
          multiPass: false,
          passes: [{ ok: true, tokens: (expandResp.usage && expandResp.usage.output_tokens) || 0 }],
          claudeModel: expandResp.model,
          claudeUsage: { output_tokens: (expandResp.usage && expandResp.usage.output_tokens) || 0 },
          citations: inner.evidenceCitationsUsed || [],
          autofire: {
            triggeredBy: 'phase-transition',
            transition: { from: entry.from, to: entry.to },
            salience: entry.salience,
            triggeredAt: Date.now()
          }
        }
      }),
      signal: AbortSignal.timeout(30000)
    });
    persistResp = await p.json();
  } catch (e) {
    return { skipped: false, ok: false, billableAttempt: true, cik: entry.cik, lane: lane, reason: 'persist-error', detail: String(e.message) };
  }

  if (!persistResp || !persistResp.ok) {
    return {
      skipped: false, ok: false, cik: entry.cik, lane: lane,
      billableAttempt: true,
      reason: 'persist-not-ok', detail: (persistResp && persistResp.error) || 'unknown'
    };
  }

  return {
    skipped: false, ok: true, billableAttempt: true, cik: entry.cik, lane: lane,
    outputId: persistResp.outputId,
    wordCount: wordCount,
    viewerUrl: 'https://limenhelix.com/helix-artifact?id=' + persistResp.outputId
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end(); }
  if (!cronAuth.enforce(req, res)) return;
  var t0 = Date.now();

  // Probe mode — quick sanity check of all preflight ops without firing.
  // GET /api/limen-worker-autofire?probe=1
  var url = new URL(req.url, 'http://localhost');
  var probeMode = url.searchParams.get('probe') === '1';

  try {
    // 1. Enforce both paid-AI gates before reading or mutating the queue.
    //    CRON_SECRET authenticates this invocation; ADMIN_MASTER authenticates
    //    the two internal mutation calls made by _fireOne().
    var master = process.env.ADMIN_MASTER || process.env.ADMIN_MASTER_KEY || '';
    if (!master) {
      res.setHeader('content-type', 'application/json');
      res.statusCode = 503;
      return res.end(JSON.stringify({ ok: false, paused: 'admin-master-unconfigured' }));
    }

    var stepT = Date.now();
    var spendDisabled = await aiKillSwitch.spendDisabled();
    var budgetStatus = await autonomyBudget.status();
    var t_budget = Date.now() - stepT;

    if (spendDisabled || !budgetStatus.armed) {
      res.setHeader('content-type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true,
        paused: spendDisabled ? 'ai-spend-disabled' : 'autonomy-not-armed',
        budget: budgetStatus,
        timing: { budget_ms: t_budget }
      }));
    }

    if (probeMode) {
      stepT = Date.now();
      var q0 = await db.get(AUTOQUEUE_KEY);
      if (!Array.isArray(q0)) q0 = [];
      var t_queue = Date.now() - stepT;
      var cands = q0.filter(function (q) {
        return q.status === 'PENDING' && q.salience === 'HIGH'
            && SINGLE_CALL_LANES.has(q.recommendedLane);
      });
      stepT = Date.now();
      var sampleSlug = cands.length > 0 ? _slugForCik(cands[0].cik) : null;
      var t_slug = Date.now() - stepT;
      stepT = Date.now();
      var sampleRes = sampleSlug ? await loadPortal(sampleSlug) : { portal: null, source: 'miss' };
      var samplePortal = sampleRes.portal;
      var t_portal = Date.now() - stepT;
      res.setHeader('content-type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true, probe: true,
        queueSize: q0.length,
        candidatesHighSingle: cands.length,
        sampleSlug: sampleSlug,
        samplePortalLoaded: !!samplePortal,
        samplePortalName: samplePortal && samplePortal.name,
        sampleLoaderSource: sampleRes.source,
        budget: budgetStatus,
        timing: {
          budget_ms: t_budget,
          queue_read_ms: t_queue,
          slug_resolve_ms: t_slug,
          portal_load_ms: t_portal,
          total_ms: Date.now() - t0
        }
      }));
    }

    // 2. Read autoqueue, filter HIGH-salience PENDING single-call lanes
    var queue = await db.get(AUTOQUEUE_KEY);
    if (!Array.isArray(queue)) queue = [];
    var candidates = queue.filter(function (q) {
      return q.status === 'PENDING'
          && q.salience === 'HIGH'
          && SINGLE_CALL_LANES.has(q.recommendedLane);
    });

    // 3. Per-CIK dedupe + stage-aware routing + bound to MAX_FIRES_PER_TICK
    var toFire = [];
    var dedupedCount = 0;
    var stageRefused = [];
    var budgetRefusal = null;
    for (var i = 0; i < candidates.length && toFire.length < MAX_FIRES_PER_TICK; i++) {
      var c = candidates[i];
      var dedupeKey = CIK_DEDUPE_PREFIX + c.cik + '_' + c.recommendedLane;
      var recentFire = await db.get(dedupeKey);
      if (recentFire) { dedupedCount++; continue; }

      // Stage-aware refusal — classify the entity + check the routing
      // matrix. Pre-revenue applicants shouldn't get SBA / Franchise
      // even on single-call paths; same applies to investment lane
      // mid-stage equity if the entity has no operating history.
      var slugForStage = _slugForCik(c.cik);
      if (slugForStage) {
        var portalForStage = await _loadPortal(slugForStage);
        if (portalForStage) {
          var classification = stageClassifier.classifyStage(portalForStage);
          var routing = stageClassifier.routeLaneForStage(classification.stage, c.recommendedLane);
          if (!routing.allowed) {
            // Mark queue entry DISMISSED with reason
            var q2s = await db.get(AUTOQUEUE_KEY);
            if (Array.isArray(q2s)) {
              for (var k0 = 0; k0 < q2s.length; k0++) {
                if (q2s[k0].cik === c.cik && q2s[k0].recommendedLane === c.recommendedLane && q2s[k0].status === 'PENDING') {
                  q2s[k0].status = 'DISMISSED';
                  q2s[k0].actionedAt = Date.now();
                  q2s[k0].actionedBy = 'autofire-stage-router';
                  q2s[k0].dismissReason = routing.refuseReason;
                  q2s[k0].dismissSuggest = routing.suggest;
                  q2s[k0].dismissStage = classification.stage;
                  break;
                }
              }
              await db.set(AUTOQUEUE_KEY, q2s, 14 * 86400);
            }
            stageRefused.push({ cik: c.cik, lane: c.recommendedLane, reason: routing.refuseReason, stage: classification.stage });
            continue;
          }
          // Stash routing on the candidate so _fireOne can use it later
          c._stageClassification = classification;
          c._stageRouting = routing;
        }
      }

      var estimatedCost = COST_PER_CALL_USD[c.recommendedLane] || 0.50;
      var budgetCheck = await autonomyBudget.check(estimatedCost);
      if (!budgetCheck.allow) {
        budgetRefusal = budgetCheck;
        break;
      }
      c._estimatedCostUsd = estimatedCost;
      toFire.push(c);
    }

    // 4. Pre-write a tentative audit-log entry so partial completion
    //    leaves a trail even if the function times out. We'll overwrite
    //    it at the end with the final state.
    var cycleStartAt = Date.now();
    var tentativeAudit = {
      at: cycleStartAt,
      status: 'IN_FLIGHT',
      evaluated: candidates.length,
      fired: 0, skipped: 0, errors: 0,
      dedupedCount: dedupedCount,
      results: []
    };
    var initialAudit = await db.get(AUTOFIRE_AUDIT_LOG);
    if (!Array.isArray(initialAudit)) initialAudit = [];
    initialAudit.unshift(tentativeAudit);
    if (initialAudit.length > AUDIT_LOG_MAX) initialAudit = initialAudit.slice(0, AUDIT_LOG_MAX);
    await db.set(AUTOFIRE_AUDIT_LOG, initialAudit, AUDIT_LOG_TTL);

    // 5. Fire all candidates in PARALLEL — both finish within Vercel's
    //    300s budget even if each Sonnet call takes ~270s. Sequential
    //    would blow past on the second fire.
    var firePromises = toFire.map(function (entry) {
      return _fireOne(entry).then(function (result) {
        return { entry: entry, result: result };
      }).catch(function (err) {
        return { entry: entry, result: { skipped: false, ok: false, cik: entry.cik, lane: entry.recommendedLane, reason: 'unhandled-exception', detail: String(err && err.message || err) } };
      });
    });
    var settled = await Promise.allSettled(firePromises);
    var results = [];
    for (var j = 0; j < settled.length; j++) {
      var s = settled[j];
      if (s.status !== 'fulfilled') {
        results.push({ skipped: false, ok: false, reason: 'promise-rejected', detail: String(s.reason) });
        continue;
      }
      var entry = s.value.entry;
      var result = s.value.result;
      results.push(result);

      if (result.ok && !result.skipped) {
        // Mark autoqueue FIRED
        try {
          var q2 = await db.get(AUTOQUEUE_KEY);
          if (Array.isArray(q2)) {
            for (var k = 0; k < q2.length; k++) {
              if (q2[k].cik === entry.cik && q2[k].recommendedLane === entry.recommendedLane && q2[k].status === 'PENDING') {
                q2[k].status = 'FIRED';
                q2[k].actionedAt = Date.now();
                q2[k].actionedBy = 'autofire-worker';
                q2[k].autofireOutputId = result.outputId;
                break;
              }
            }
            await db.set(AUTOQUEUE_KEY, q2, 14 * 86400);
          }
          await db.set(CIK_DEDUPE_PREFIX + entry.cik + '_' + entry.recommendedLane, { at: Date.now() }, CIK_DEDUPE_TTL);
        } catch (_) { /* state-write errors must not poison the result */ }
      }

      // The provider request may have incurred cost even if persistence failed.
      // Debit only after an attempted paid call, never merely for selection.
      if (result.billableAttempt) {
        try {
          await autonomyBudget.record(entry._estimatedCostUsd || (COST_PER_CALL_USD[entry.recommendedLane] || 0.50), {
            streamId: 'autofire:' + entry.recommendedLane,
            note: 'conservative estimated cost for autonomous ' + entry.recommendedLane + ' artifact attempt for CIK ' + entry.cik
          });
        } catch (budgetErr) {
          // Losing the budget ledger must stop the next paid invocation. The
          // runtime kill switch is the durable fail-closed boundary.
          result.budgetRecordError = String(budgetErr && budgetErr.message || budgetErr);
          try { await aiKillSwitch.setSpendPaused(true); } catch (_) {}
        }
      }
    }

    // 6. Read the shared budget after all billable attempts.
    budgetStatus = await autonomyBudget.status();

    // 7. Overwrite the tentative audit entry with final state.
    //    Match by 'at' timestamp.
    var auditFinal = await db.get(AUTOFIRE_AUDIT_LOG);
    if (!Array.isArray(auditFinal)) auditFinal = [];
    var finalRecord = {
      at: cycleStartAt,
      completedAt: Date.now(),
      status: 'COMPLETE',
      evaluated: candidates.length,
      fired: results.filter(function (r) { return r.ok; }).length,
      skipped: results.filter(function (r) { return r.skipped; }).length,
      errors: results.filter(function (r) { return !r.skipped && !r.ok; }).length,
      dedupedCount: dedupedCount,
      budgetAfter: budgetStatus,
      budgetAccounting: 'conservative-estimate-per-provider-attempt',
      budgetRefusal: budgetRefusal,
      elapsedMs: Date.now() - cycleStartAt,
      results: results
    };
    var foundTentative = false;
    for (var ai = 0; ai < auditFinal.length; ai++) {
      if (auditFinal[ai].at === cycleStartAt && auditFinal[ai].status === 'IN_FLIGHT') {
        auditFinal[ai] = finalRecord;
        foundTentative = true;
        break;
      }
    }
    if (!foundTentative) auditFinal.unshift(finalRecord);
    if (auditFinal.length > AUDIT_LOG_MAX) auditFinal = auditFinal.slice(0, AUDIT_LOG_MAX);
    await db.set(AUTOFIRE_AUDIT_LOG, auditFinal, AUDIT_LOG_TTL);

    res.setHeader('content-type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      generatedAt: Date.now(),
      elapsedMs: Date.now() - t0,
      evaluated: candidates.length,
      fired: results.filter(function (r) { return r.ok; }).length,
      skipped: results.filter(function (r) { return r.skipped; }).length,
      errors: results.filter(function (r) { return !r.skipped && !r.ok; }).length,
      dedupedCount: dedupedCount,
      budget: budgetStatus,
      budgetAccounting: 'conservative-estimate-per-provider-attempt',
      budgetRefusal: budgetRefusal,
      maxPerTick: MAX_FIRES_PER_TICK,
      results: results
    }));

  } catch (err) {
    res.setHeader('content-type', 'application/json');
    res.statusCode = 500;
    return res.end(JSON.stringify({
      ok: false, error: 'internal',
      detail: String(err && err.message || err)
    }));
  }
};
