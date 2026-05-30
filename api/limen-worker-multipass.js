/**
 * api/limen-worker-multipass.js — Multi-pass engine state-machine
 *
 * Closes the autofire loop for multi-pass lanes (patent / grant / sba /
 * franchise). Single Vercel function invocation = ONE pass. State for
 * each in-progress multi-pass artifact is kept in Redis; subsequent
 * cron ticks pick up where the last one left off. When all passes
 * complete, the artifact is stitched and persisted as READY_TO_SIGN.
 *
 * Cron every 5 min. Patent (6 passes) takes ~30 min wall, grant/sba/
 * franchise (8 passes) take ~40 min wall. Each pass is ≤90s so
 * comfortably within Vercel's 300s function budget.
 *
 * SAFETY GUARDS:
 *   - HIGH-salience PENDING multipass recommendations only
 *   - Daily $ budget shared with single-call autofire
 *   - Per-CIK 24h dedupe
 *   - Max ONE in-flight multipass job at a time (serialization avoids
 *     parallel resource contention; cron picks up next when current
 *     finishes)
 *   - Status persisted READY_TO_SIGN; never auto-submitted externally
 *
 * State keys (Redis):
 *   multipass_inflight        — array of in-progress jobs (max 1 in
 *                               this build; future: per-lane parallel)
 *   multipass_audit_log       — append-only completed-job log
 */

var db = require('./lib/limen-db');
var stageClassifier = require('./lib/limen-stage-classifier');
var fs = require('fs');
var path = require('path');

var AUTOQUEUE_KEY = 'autoqueue';
var AUTOFIRE_AUDIT_LOG = 'autofire_audit_log';
var MULTIPASS_INFLIGHT_KEY = 'multipass_inflight';
var MULTIPASS_AUDIT_KEY = 'multipass_audit_log';
var BUDGET_KEY_PREFIX = 'autofire_budget_';
// Per (CIK, lane) dedupe — same CIK can fire DIFFERENT lanes within
// 24h (e.g. LIMEN sba + grant + patent back-to-back), but won't
// re-fire the SAME lane for the same CIK.
var CIK_DEDUPE_PREFIX = 'autofire_cik_lane_dedupe_';
var CIK_DEDUPE_TTL = 86400;
var AUDIT_TTL = 30 * 86400;

var MULTIPASS_LANES = new Set(['patent', 'grant', 'sba', 'franchise']);
var COST_PER_PASS_USD = { patent: 0.15, grant: 0.15, sba: 0.15, franchise: 0.20 };
var DAILY_BUDGET_DOLLARS = parseFloat(process.env.AUTOFIRE_DAILY_BUDGET || '30');

var BASE = process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://limenhelix.com';
var OPERATOR_TOKEN = process.env.LIMEN_OPERATOR_TOKEN || '';

function _internalHeaders() {
  var h = { 'content-type': 'application/json' };
  if (OPERATOR_TOKEN) h.authorization = 'Bearer ' + OPERATOR_TOKEN;
  return h;
}

// ── Portal load (same pattern as autofire) ──
var _PORTAL_PATHS = [
  path.join(__dirname, '..', 'assets', 'data', 'companies'),
  '/var/task/assets/data/companies',
  path.join(process.cwd(), 'assets', 'data', 'companies')
];
var _MANIFEST_PATHS = [
  path.join(__dirname, '..', 'assets', 'data', 'companies-manifest.json'),
  '/var/task/assets/data/companies-manifest.json',
  path.join(process.cwd(), 'assets', 'data', 'companies-manifest.json')
];
var _PORTAL_CACHE = {};

function _loadPortal(slug) {
  if (!slug) return null;
  if (_PORTAL_CACHE[slug]) return _PORTAL_CACHE[slug];
  for (var i = 0; i < _PORTAL_PATHS.length; i++) {
    try {
      var fp = path.join(_PORTAL_PATHS[i], slug + '.json');
      if (fs.existsSync(fp)) {
        var p = JSON.parse(fs.readFileSync(fp, 'utf8'));
        _PORTAL_CACHE[slug] = p;
        return p;
      }
    } catch (_) { /* try next */ }
  }
  return null;
}

function _slugForCik(cik) {
  for (var i = 0; i < _MANIFEST_PATHS.length; i++) {
    try {
      if (!fs.existsSync(_MANIFEST_PATHS[i])) continue;
      var m = JSON.parse(fs.readFileSync(_MANIFEST_PATHS[i], 'utf8'));
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

// ── Per-lane scope templates (mirror generic test runner) ──
var SCOPE_TEMPLATES = {
  patent: {
    title: 'Adaptive operational intelligence platform for {industry} risk mitigation',
    description: 'A computer-implemented system for {company} that ingests multi-source operational signals from its {industry} operations and produces phase-conditioned risk forecasts with calibrated confidence bands, surfacing leading-indicator deviations 4-12 weeks before they manifest in financial metrics.',
    problemStatement: '{industry} operators presently rely on backward-looking financial KPIs and unstructured news monitoring to detect operational stress; both methods systematically miss 60-80% of high-impact deviations until they materialize in earnings.',
    proposedApproach: 'The invention couples (a) a graph database of counterparty relationships, (b) a phase-state estimator that assigns each node a discrete operating regime, (c) a stress-propagation engine that runs forward simulations under phase-conditioned transition probabilities, and (d) a calibration layer producing per-CIK 4-12 week probability forecasts.'
  },
  grant: {
    title: 'Workforce upskilling and operational resilience research for {industry}',
    description: 'Research and workforce-development program at {company} addressing technology-driven labor displacement in {industry}.',
    problemStatement: '{industry} is undergoing rapid automation that displaces mid-career operational roles while creating shortages in robotics-adjacent and technology-supervised roles.',
    proposedApproach: 'A 12-week paid cohort program combining classroom instruction, on-floor mentorship, and stipend-supported certification across five core competencies appropriate to {industry}.'
  },
  sba: {
    title: '{industry} expansion working capital + equipment finance package',
    description: '{company} seeks SBA 7(a) financing for working-capital expansion and equipment refresh tied to a defined growth plan within its {industry} operations.',
    problemStatement: 'The applicant operates in {industry} with documented demand exceeding current operational capacity. Conventional lender appetite is constrained by sector-specific collateral-coverage ratios despite strong cash-flow coverage.',
    proposedApproach: 'Five-year capital plan with milestone gating, personal guaranty, real-estate collateral, and standard SBA 7(a) terms.'
  },
  franchise: {
    title: '{company} franchise system disclosure document (FDD) refresh',
    description: 'Franchise Disclosure Document for {company} prepared per FTC 16 CFR Part 436.',
    problemStatement: '{company} is expanding its franchise system in {industry} and requires a current FDD that meets the FTC Franchise Rule and the most-restrictive state registration regimes (CA, MN, NY, IL, IN, RI, VA, WA).',
    proposedApproach: 'Full 23-item FDD with state-specific addenda where required.'
  }
};

function _specializeScope(template, portal) {
  var company = portal.name || portal.companyId || 'Subject Entity';
  var industry = (portal.industry || 'multi-segment operations').replace(/\s+/g, ' ');
  function subst(s) { return s.replace(/\{company\}/g, company).replace(/\{industry\}/g, industry); }
  return {
    title: subst(template.title),
    description: subst(template.description),
    problemStatement: subst(template.problemStatement),
    proposedApproach: subst(template.proposedApproach)
  };
}

// Full per-company network-stress node (with named source counterparties) from
// the bundled spider-web snapshot — the DEEP read for artifact causation (the
// slim Redis map used for routing/UI drops inducedSources). Cached per cold start.
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
  var template = SCOPE_TEMPLATES[lane] || SCOPE_TEMPLATES.grant;
  var scope = _specializeScope(template, portal);
  var fh = portal.financialHealth || {};
  return {
    subject: {
      cik: portal.cik || '0000000000',
      slug: portal.slug,
      entityName: portal.name,
      industry: { naics: portal.sic || '999999', label: portal.industry || 'Multi-segment', descriptor: portal.industry || 'Multi-segment operations' },
      proposedScope: scope
    },
    evidence: {
      citations: [
        { author: 'Porter, M.E.', year: 2008, title: 'The Five Competitive Forces That Shape Strategy', journal: 'Harvard Business Review', volume: '86(1)', pages: '78-93', doi: '10.0/hbr-2008-86-1', source: 'Porter (2008)', sourceType: 'foundational' },
        { author: 'Brynjolfsson, E. and McAfee, A.', year: 2017, title: 'The Business of Artificial Intelligence', journal: 'Harvard Business Review', volume: '95(4)', pages: '3-11', doi: '10.0/hbr-2017-95-4', source: 'Brynjolfsson & McAfee (2017)', sourceType: 'practitioner-peer-reviewed' }
      ],
      news: [], priorArt: [],
      financial: { latestQuarter: fh.latestQuarter || '2026Q1', historyQuarters: 16 },
      networkStress: _loadStressNode(portal.slug)
    }
  };
}

// Fetch the LANE_SECTIONS catalog from expand-artifact-claude GET
async function _fetchSectionsCatalog() {
  var r = await fetch(BASE + '/api/expand-artifact-claude', { signal: AbortSignal.timeout(15000) });
  var j = await r.json();
  return (j && j.sections) || {};
}

async function _runOnePass(job, sectionIdx, sections, contextPacket) {
  var sec = sections[sectionIdx];
  var priorTitles = (job.aggregateSections || []).map(function (s) { return s.heading || s.id || ''; });
  var r = await fetch(BASE + '/api/expand-artifact-claude', {
    method: 'POST',
    headers: _internalHeaders(),
    body: JSON.stringify({
      lane: job.lane,
      cik: job.cik,
      sourcePatternSig: job.sourcePatternSig,
      readiness: 0.62,
      maxTokens: Math.min(Math.round(sec.targetTokens * 1.3), 16000),
      contextPacket: contextPacket,
      kernelSnapshot: job.kernelSnapshot,
      pass: { sectionIndex: sectionIdx, sectionId: sec.id, sectionName: sec.name, priorSectionTitles: priorTitles }
    }),
    signal: AbortSignal.timeout(240000)
  });
  var j = await r.json();
  if (!j || !j.ok) {
    return { ok: false, sectionId: sec.id, error: j && j.error };
  }
  var outer = j.structured || {};
  var inner = outer.structured || outer;
  return {
    ok: true,
    sectionId: sec.id,
    sectionName: sec.name,
    draftBody: j.draftBody || '',
    structured: inner,
    tokens: (j.usage && j.usage.output_tokens) || 0,
    model: j.model
  };
}

async function _persistFinal(job) {
  // Stitch + persist as READY_TO_SIGN
  var aggregateDraft = job.passes.map(function (p) { return p.draftBody; }).filter(Boolean).join('\n\n---\n\n');
  var totalWords = aggregateDraft.split(/\s+/).filter(Boolean).length;
  var totalTokens = job.passes.reduce(function (acc, p) { return acc + (p.tokens || 0); }, 0);
  var firstTitle = (job.aggregateSections[0] && job.aggregateSections[0].title) || (job.lane.toUpperCase() + ' — ' + job.entityName);

  var r = await fetch(BASE + '/api/limen-engine-output', {
    method: 'POST',
    headers: _internalHeaders(),
    body: JSON.stringify({
      cik: job.cik,
      slug: job.slug,
      engineId: 'engine-' + job.lane,
      lane: job.lane,
      sourcePatternSig: job.sourcePatternSig,
      readiness: 0.62,
      operator: 'multipass-autofire-worker',
      kernelSnapshot: job.kernelSnapshot,
      payload: {
        title: firstTitle,
        lane: job.lane,
        agency_or_office: job.firstAgency,
        format_standard: job.firstFormat,
        draftBody: aggregateDraft,
        structured: {
          title: firstTitle, lane: job.lane,
          agency_or_office: job.firstAgency, format_standard: job.firstFormat,
          sections: job.aggregateSections, openItems: job.aggregateOpenItems,
          readyToSignChecklist: job.aggregateChecklist,
          readyToSign: job.passes.every(function (p) { return p.ok; }),
          wordCount: totalWords,
          evidenceCitationsUsed: job.aggregateCitations
        },
        readyToSign: job.passes.every(function (p) { return p.ok; }),
        openItems: job.aggregateOpenItems,
        readyToSignChecklist: job.aggregateChecklist,
        wordCount: totalWords,
        multiPass: true,
        passes: job.passes.map(function (p) {
          return { ok: p.ok, sectionId: p.sectionId, tokens: p.tokens, draftBytes: (p.draftBody || '').length };
        }),
        claudeModel: job.lastModel,
        claudeUsage: { output_tokens: totalTokens },
        citations: job.aggregateCitations,
        autofire: {
          triggeredBy: 'phase-transition-multipass',
          transition: { from: job.transitionFrom, to: job.transitionTo },
          salience: job.salience,
          triggeredAt: job.startedAt,
          completedAt: Date.now(),
          totalPasses: job.passes.length,
          cronTicksToComplete: job.tickCount,
          stageRouting: job.stageRouting || null,
          stageClassification: job.stageClassification || null,
          catalogKey: job.catalogKey || job.lane
        }
      }
    }),
    signal: AbortSignal.timeout(30000)
  });
  var pj = await r.json();
  return pj;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  var t0 = Date.now();

  try {
    // 1. Budget check
    var d = new Date();
    var todayKey = BUDGET_KEY_PREFIX + d.toISOString().slice(0, 10);
    var spentToday = (await db.get(todayKey)) || 0;
    if (typeof spentToday !== 'number') spentToday = 0;
    if (spentToday >= DAILY_BUDGET_DOLLARS) {
      res.setHeader('content-type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true, paused: 'daily-budget-exhausted',
        spentToday: spentToday, dailyBudget: DAILY_BUDGET_DOLLARS
      }));
    }

    // 2. Load in-flight jobs
    var inflight = await db.get(MULTIPASS_INFLIGHT_KEY);
    if (!Array.isArray(inflight)) inflight = [];

    // 3. If no in-flight job, pick next from autoqueue
    var job = inflight.length > 0 ? inflight[0] : null;
    if (!job) {
      var queue = await db.get(AUTOQUEUE_KEY);
      if (!Array.isArray(queue)) queue = [];
      var candidates = queue.filter(function (q) {
        return q.status === 'PENDING' && q.salience === 'HIGH' && MULTIPASS_LANES.has(q.recommendedLane);
      });
      if (candidates.length === 0) {
        res.setHeader('content-type', 'application/json');
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, idle: true, reason: 'no-high-salience-multipass-candidates' }));
      }
      // Pick first eligible (not dedupe-blocked + stage allows + within budget)
      var refusedCandidates = [];
      for (var i = 0; i < candidates.length; i++) {
        var c = candidates[i];
        var recent = await db.get(CIK_DEDUPE_PREFIX + c.cik + '_' + c.recommendedLane);
        if (recent) continue;
        var slug = _slugForCik(c.cik);
        if (!slug) continue;
        var portal = _loadPortal(slug);
        if (!portal) continue;

        // ─ Stage-aware routing ─
        // Classify the entity stage from portal data + route the lane
        // through the stage matrix. Pre-revenue applicants can't get
        // SBA 7(a) cash-flow underwriting; they get SBIR Phase I for
        // grants, microloan/Express for SBA if at all.
        var classification = stageClassifier.classifyStage(portal);
        var routing = stageClassifier.routeLaneForStage(classification.stage, c.recommendedLane);
        if (!routing.allowed) {
          // Refuse this candidate. Mark the autoqueue entry DISMISSED
          // with the refuse reason so the operator sees why.
          var q2 = await db.get(AUTOQUEUE_KEY);
          if (Array.isArray(q2)) {
            for (var k0 = 0; k0 < q2.length; k0++) {
              if (q2[k0].cik === c.cik && q2[k0].recommendedLane === c.recommendedLane && q2[k0].status === 'PENDING') {
                q2[k0].status = 'DISMISSED';
                q2[k0].actionedAt = Date.now();
                q2[k0].actionedBy = 'multipass-stage-router';
                q2[k0].dismissReason = routing.refuseReason;
                q2[k0].dismissSuggest = routing.suggest;
                q2[k0].dismissStage = classification.stage;
                break;
              }
            }
            await db.set(AUTOQUEUE_KEY, q2, 14 * 86400);
          }
          refusedCandidates.push({ cik: c.cik, lane: c.recommendedLane, reason: routing.refuseReason, stage: classification.stage });
          continue;
        }

        // Resolve catalog key (stage may map e.g. lane=grant +
        // template=sbir-phase-1 → catalogKey="grant_sbir_phase_1")
        var catalogKey = c.recommendedLane;
        if (routing.template === 'sbir-phase-1') catalogKey = 'grant_sbir_phase_1';
        // (Future variants: sba-express-or-microloan, fdd-standard, etc.
        //  add their catalog keys here when the corresponding LANE_SECTIONS
        //  entries are populated in expand-artifact-claude.js.)

        // Found a fireable job — initialize state
        var catalog = await _fetchSectionsCatalog();
        var sectionsForLane = (catalog && catalog[catalogKey]) || (catalog && catalog[c.recommendedLane]) || [];
        if (!sectionsForLane.length) continue;
        job = {
          cik: c.cik, slug: slug, entityName: portal.name || c.ticker || slug,
          lane: c.recommendedLane,
          catalogKey: catalogKey,
          stageClassification: classification,
          stageRouting: routing,
          sectionsTotal: sectionsForLane.length,
          sourcePatternSig: 'autofire-multipass-' + c.recommendedLane + '-' + c.cik + '-' + Date.now(),
          kernelSnapshot: { thing2: { dominantPhase: c.to, stress: 0.4, trajectory: c.direction === 'deteriorating' ? 'ESCALATING' : 'STABILIZING' }, ts: Date.now() },
          transitionFrom: c.from, transitionTo: c.to, salience: c.salience,
          passes: [], aggregateSections: [], aggregateOpenItems: [],
          aggregateChecklist: [], aggregateCitations: [],
          firstAgency: null, firstFormat: null, lastModel: null,
          startedAt: Date.now(), tickCount: 0
        };
        inflight = [job];
        await db.set(MULTIPASS_INFLIGHT_KEY, inflight, 86400);
        break;
      }
      if (!job) {
        res.setHeader('content-type', 'application/json');
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, idle: true, reason: 'all-candidates-deduped-or-no-portal' }));
      }
    }

    // 4. Fire next pass
    var nextIdx = job.passes.length;
    job.tickCount = (job.tickCount || 0) + 1;

    var catalog2 = await _fetchSectionsCatalog();
    var effectiveCatalogKey = job.catalogKey || job.lane;
    var sections = (catalog2 && catalog2[effectiveCatalogKey]) || (catalog2 && catalog2[job.lane]) || [];
    if (nextIdx >= sections.length) {
      // Defensive — shouldn't happen, but stitch + complete anyway
      var ppFinal = await _persistFinal(job);
      inflight = [];
      await db.set(MULTIPASS_INFLIGHT_KEY, inflight, 86400);
      res.setHeader('content-type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, completed: true, outputId: ppFinal && ppFinal.outputId }));
    }

    var portal2 = _loadPortal(job.slug);
    if (!portal2) {
      // Portal evicted — abort this job
      inflight = [];
      await db.set(MULTIPASS_INFLIGHT_KEY, inflight, 86400);
      res.setHeader('content-type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: false, aborted: 'portal-missing', cik: job.cik }));
    }
    var packet = _buildContextPacket(portal2, job.lane);

    var passResult = await _runOnePass(job, nextIdx, sections, packet);

    // 5. Update state
    job.passes.push(passResult);
    if (passResult.ok) {
      var inner = passResult.structured || {};
      if (!job.firstAgency && inner.agency_or_office) job.firstAgency = inner.agency_or_office;
      if (!job.firstFormat && inner.format_standard) job.firstFormat = inner.format_standard;
      if (Array.isArray(inner.sections) && inner.sections.length > 0) {
        inner.sections.forEach(function (s) { job.aggregateSections.push(Object.assign({}, s, { passId: passResult.sectionId })); });
      } else {
        job.aggregateSections.push({ heading: passResult.sectionName, id: passResult.sectionId, completeness: 0.9, passId: passResult.sectionId });
      }
      (inner.openItems || []).forEach(function (oi) { job.aggregateOpenItems.push(Object.assign({}, oi, { passId: passResult.sectionId })); });
      (inner.readyToSignChecklist || []).forEach(function (cc) { job.aggregateChecklist.push(Object.assign({}, cc, { passId: passResult.sectionId })); });
      (inner.evidenceCitationsUsed || []).forEach(function (cit) { job.aggregateCitations.push(cit); });
      job.lastModel = passResult.model;
    }

    // 6. Charge budget
    var passCost = (COST_PER_PASS_USD[job.lane] || 0.15);
    spentToday += passCost;
    var dayTtl = Math.max(60, 86400 - Math.floor((Date.now() % 86400000) / 1000));
    await db.set(todayKey, spentToday, dayTtl);

    var completed = job.passes.length >= sections.length;
    if (completed) {
      // 7. Persist final artifact + clear inflight + mark autoqueue FIRED + dedupe
      var pj = await _persistFinal(job);
      if (pj && pj.ok) {
        // Mark autoqueue
        var q2 = await db.get(AUTOQUEUE_KEY);
        if (Array.isArray(q2)) {
          for (var k = 0; k < q2.length; k++) {
            if (q2[k].cik === job.cik && q2[k].recommendedLane === job.lane && q2[k].status === 'PENDING') {
              q2[k].status = 'FIRED';
              q2[k].actionedAt = Date.now();
              q2[k].actionedBy = 'multipass-autofire-worker';
              q2[k].autofireOutputId = pj.outputId;
              break;
            }
          }
          await db.set(AUTOQUEUE_KEY, q2, 14 * 86400);
        }
        await db.set(CIK_DEDUPE_PREFIX + job.cik + '_' + job.lane, { at: Date.now() }, CIK_DEDUPE_TTL);

        // Audit
        var aud = await db.get(MULTIPASS_AUDIT_KEY);
        if (!Array.isArray(aud)) aud = [];
        aud.unshift({
          at: Date.now(), cik: job.cik, slug: job.slug, lane: job.lane,
          entityName: job.entityName, salience: job.salience,
          ticks: job.tickCount, totalPasses: job.passes.length,
          successPasses: job.passes.filter(function (p) { return p.ok; }).length,
          outputId: pj.outputId
        });
        if (aud.length > 200) aud = aud.slice(0, 200);
        await db.set(MULTIPASS_AUDIT_KEY, aud, AUDIT_TTL);
      }
      inflight = [];
      await db.set(MULTIPASS_INFLIGHT_KEY, inflight, 86400);

      res.setHeader('content-type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true, completed: true,
        cik: job.cik, lane: job.lane, ticks: job.tickCount,
        outputId: pj && pj.outputId,
        viewerUrl: pj && pj.outputId ? ('https://limenhelix.com/helix-artifact?id=' + pj.outputId) : null,
        spentToday: spentToday,
        elapsedMs: Date.now() - t0
      }));
    }

    // 7'. Job continues next tick — persist state
    inflight = [job];
    await db.set(MULTIPASS_INFLIGHT_KEY, inflight, 86400);

    res.setHeader('content-type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true, completed: false,
      cik: job.cik, lane: job.lane,
      passesDone: job.passes.length, passesTotal: sections.length,
      lastPassOk: passResult.ok, lastPassError: passResult.error || null,
      tick: job.tickCount,
      spentToday: spentToday,
      elapsedMs: Date.now() - t0
    }));

  } catch (err) {
    res.setHeader('content-type', 'application/json');
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: 'internal', detail: String(err && err.message || err) }));
  }
};
