#!/usr/bin/env node
/**
 * D3-G — Global Artifact Deep Source Indexer
 *
 * Scans the portal corpus under assets/data/domains/ ONCE, normalizes
 * each portal JSON into a compact record, builds inverted indexes, and
 * emits compact per-diagnosis/per-lane artifact-source bundles for use
 * by ArtifactPacket enrichment at runtime.
 *
 * Why a global index, not a per-diagnosis crawl:
 *   - Corpus is ~466,000 portal JSON files (~23 GB on disk).
 *   - Per-diagnosis crawl walks the entire corpus once per diagnosis;
 *     for ~100 distinct diagnoses that is ~46M file reads.
 *   - Global index = one pass; per-diagnosis bundle = one lookup.
 *
 * STATUS: SCAFFOLD / OFFLINE. Runs from Node CLI. NO browser. NO server.
 * NO network. NO modification of portal/domain-brain/feed/kernel files.
 * NO fabrication of missing source. NO submission/filing/trading/funding/
 * approval/execution side effects. executionAllowed semantics are not
 * applicable here — this script writes static index data only.
 *
 * CLI:
 *   node scripts/build-artifact-deep-source-index.js --dry-run
 *   node scripts/build-artifact-deep-source-index.js --domain energy --sample
 *   node scripts/build-artifact-deep-source-index.js --diagnosis GRID_COLLAPSE --sample
 *   node scripts/build-artifact-deep-source-index.js --build-global
 *   node scripts/build-artifact-deep-source-index.js --build-diagnosis-bundles
 *   node scripts/build-artifact-deep-source-index.js --resume
 *   node scripts/build-artifact-deep-source-index.js --limit 500
 *
 * Output (when --sample or --build-* flags emit files):
 *   assets/data/artifact-source-index/
 *     sample/
 *       summary.json            — corpus stats from sample run
 *       by-diagnosis-sample.json — first-N diagnosis bundles
 *     by-diagnosis/<id>.json    — per-diagnosis bundles (full build only)
 *     missing-references.json   — reportable bad inbound references
 *     stats.json                — global index stats
 *     checkpoint.json           — resumable pointer (when --resume)
 */

'use strict';

var fs   = require('fs');
var path = require('path');

// ─── Constants ────────────────────────────────────────────────────────

var REPO_ROOT      = process.cwd();
var DOMAINS_DIR    = path.join(REPO_ROOT, 'assets', 'data', 'domains');
var INDEX_OUT_DIR  = path.join(REPO_ROOT, 'assets', 'data', 'artifact-source-index');
var SAMPLE_OUT_DIR = path.join(INDEX_OUT_DIR, 'sample');
var BY_DX_OUT_DIR  = path.join(INDEX_OUT_DIR, 'by-diagnosis');
var CHECKPOINT_FILE= path.join(INDEX_OUT_DIR, 'checkpoint.json');

var PROGRESS_EVERY = 5000;   // log every N files

// Bundle caps (per task spec — keep bundles small so runtime lookup is fast).
var CAPS = {
  topSources:           100,
  treatments:           100,
  implementationSteps:  200,
  evidenceAnchors:      100,
  mechanismCandidates:  100,
  methodCandidates:     100,
  embodimentCandidates: 100,
  figureCandidates:     100,
  sourcePortals:        200
};

// Lane-scoring keyword hints. Lightweight — these tilt prioritization
// rather than gate inclusion. False matches are tolerable; full anti-
// overclaim still runs at finalize time.
var LANE_KEYWORDS = {
  patents: [
    /\bmechanism\b/i, /\bsystem\b/i, /\bmethod\b/i, /\bprocess\b/i,
    /\bdevice\b/i, /\bapparatus\b/i, /\bsensor\b/i, /\bsignal\b/i,
    /\bthreshold\b/i, /\balgorithm\b/i, /\bcontrol\s+loop\b/i,
    /\bfeedback\b/i, /\bactuat(or|ion)\b/i, /\bcontroller\b/i,
    /\binhibit(or|ion)\b/i, /\bantagonist\b/i, /\bagonist\b/i,
    /\bmodulat(or|ion|e)\b/i
  ],
  grants: [
    /\bproblem\b/i, /\bneed\b/i, /\bobjective\b/i, /\boutcome\b/i,
    /\bbroader\s+impact\b/i, /\bpublic\s+benefit\b/i,
    /\bevidence\b/i, /\bwork\s+plan\b/i, /\bmilestone\b/i,
    /\bmeasurable\b/i, /\bindicator\b/i
  ],
  sba: [
    /\bbusiness\b/i, /\boperator\b/i, /\bcustomer\b/i, /\brevenue\b/i,
    /\buse\s+of\s+funds\b/i, /\bmarket\b/i, /\bcollateral\b/i,
    /\bworking\s+capital\b/i
  ],
  investments: [
    /\bcatalyst\b/i, /\bthesis\b/i, /\binvalidation\b/i,
    /\bdrawdown\b/i, /\binventor(y|ies)\b/i, /\bstress\s+band\b/i,
    /\bticker\b/i, /\bfundamental\b/i
  ]
};

// Treatments are the canonical "implementationStep candidate" source in
// the addiction-style schema we observed; portals expose them under
// activations[*].treatments[*].
//
// "Mechanism" and "method" candidates are inferred from treatment
// descriptions matching technical patents-leaning regex; this is a
// heuristic, not a contract.

// ─── CLI parsing ──────────────────────────────────────────────────────

function _parseArgs(argv) {
  var out = {
    dryRun:                false,
    domain:                null,
    diagnosis:             null,
    sample:                false,
    buildGlobal:           false,
    buildDiagnosisBundles: false,
    resume:                false,
    limit:                 0
  };
  for (var i = 2; i < argv.length; i++) {
    var a = argv[i];
    if (a === '--dry-run')                  out.dryRun = true;
    else if (a === '--sample')              out.sample = true;
    else if (a === '--build-global')        out.buildGlobal = true;
    else if (a === '--build-diagnosis-bundles') out.buildDiagnosisBundles = true;
    else if (a === '--resume')              out.resume = true;
    else if (a === '--domain')              out.domain    = argv[++i] || null;
    else if (a === '--diagnosis')           out.diagnosis = argv[++i] || null;
    else if (a === '--limit')               out.limit     = parseInt(argv[++i] || '0', 10) || 0;
  }
  return out;
}

// ─── File enumeration ────────────────────────────────────────────────

// We list the directory once. The corpus is flat (no nested dirs),
// so a single readdirSync gives us every portal file in deterministic
// order. We also filter out the helper batch JS files at the source.
function _listCandidates(opts) {
  if (!fs.existsSync(DOMAINS_DIR)) {
    throw new Error('Portal directory not found: ' + DOMAINS_DIR);
  }
  var entries = fs.readdirSync(DOMAINS_DIR);
  var jsons = [];
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (!e.endsWith('.json')) continue;
    // D3-G.2 — skip underscore-prefixed batch-data inputs (e.g.
    // _treat_data_part1.json). These are not portal-shape; they
    // were the source materials used to populate the real portal
    // files. Indexing them produces empty records and pollutes the
    // missingReferences cross-check.
    if (e.charAt(0) === '_') continue;
    if (opts.domain && e.indexOf(opts.domain + '_') !== 0 && e !== opts.domain + '.json') continue;
    jsons.push(e);
  }
  jsons.sort();
  if (opts.limit > 0 && jsons.length > opts.limit) jsons = jsons.slice(0, opts.limit);
  return jsons;
}

// ─── Diagnosis canonicalization (D3-G.1) ─────────────────────────────
//
// Path A: normalize at INDEX time.
//   - Already-upper-snake IDs (e.g. "GRID_COLLAPSE", "ALCOHOL_USE")
//     are preserved verbatim.
//   - Descriptive labels (e.g. "Grid Collapse", "Renewable
//     Intermittency Crisis") are canonicalized to upper-snake.
//   - Punctuation other than [A-Z0-9_] is stripped.
//   - Spaces / hyphens / slashes / dots become single underscores.
//   - Repeated underscores collapse to one.
//   - Leading/trailing underscores trimmed.
//
// The bundle stores BOTH the canonical id AND the raw label set,
// so the runtime client can normalize either form to the same key.
//
// Examples (also exercised by canonicalizeSelfTest below):
//   "Grid Collapse"                  → "GRID_COLLAPSE"
//   "Renewable Intermittency Crisis" → "RENEWABLE_INTERMITTENCY_CRISIS"
//   "GRID_COLLAPSE"                  → "GRID_COLLAPSE"   (idempotent)
//   "  market collapse!! "           → "MARKET_COLLAPSE"
//   "supply-chain breakdown"         → "SUPPLY_CHAIN_BREAKDOWN"
//   "Phase-3 / over-load"            → "PHASE_3_OVER_LOAD"
function canonicalizeDiagnosisLabel(label) {
  if (typeof label !== 'string') return null;
  var s = label.trim();
  if (!s) return null;
  // Replace any non-alphanumeric run with a single underscore.
  s = s.replace(/[^A-Za-z0-9]+/g, '_');
  // Collapse repeats and trim edge underscores.
  s = s.replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (!s) return null;
  return s.toUpperCase();
}

// Quick sanity self-test exposed for unit-style verification. Returns
// { ok: true } on pass, { ok: false, failures: [...] } otherwise.
function canonicalizeSelfTest() {
  var cases = [
    ['Grid Collapse',                   'GRID_COLLAPSE'],
    ['Renewable Intermittency Crisis',  'RENEWABLE_INTERMITTENCY_CRISIS'],
    ['GRID_COLLAPSE',                   'GRID_COLLAPSE'],
    ['  market collapse!! ',            'MARKET_COLLAPSE'],
    ['supply-chain breakdown',          'SUPPLY_CHAIN_BREAKDOWN'],
    ['Phase-3 / over-load',             'PHASE_3_OVER_LOAD'],
    ['  ',                              null],
    ['',                                null]
  ];
  var failures = [];
  for (var i = 0; i < cases.length; i++) {
    var got = canonicalizeDiagnosisLabel(cases[i][0]);
    if (got !== cases[i][1]) failures.push({ input: cases[i][0], expected: cases[i][1], got: got });
  }
  return { ok: failures.length === 0, failures: failures, total: cases.length };
}

// ─── Normalized record ───────────────────────────────────────────────

// Each portal becomes a compact record. We deliberately do NOT keep raw
// text — only token-level signals + traceability fields — so memory
// stays bounded across the full 466k-file pass.
function _normalizePortal(filename, raw) {
  var portalId = filename.replace(/\.json$/, '');
  var domain   = portalId.split('_')[0] || portalId;

  // Derive depth from underscore-segment count:
  //   addiction.json                          → depth 0
  //   addiction_anticipatory.json             → depth 1
  //   addiction_anticipatory_action.json      → depth 2
  //   addiction_anticipatory_action_assess.js → depth 3
  // ancestryPath is the prefix walk (parent portal IDs).
  var segments = portalId.split('_');
  var depth = segments.length - 1;
  var ancestryPath = [];
  for (var d = 1; d < segments.length; d++) ancestryPath.push(segments.slice(0, d).join('_'));

  var rec = {
    recordId:             portalId,
    portalId:             portalId,
    sourceFile:           filename,
    domain:               domain,
    title:                (raw && typeof raw.title === 'string') ? raw.title : null,
    parentPortal:         (raw && typeof raw.parentPortal === 'string') ? raw.parentPortal : null,
    depth:                depth,
    ancestryPath:         ancestryPath,
    diagnosisIds:         [],         // canonicalized upper-snake IDs
    rawDiagnosisLabels:   [],         // original strings as captured
    treatments:           [],         // {label, type, description, evidence, brainNode, diagnosisIds}
    implementationSteps:  [],         // dedup'd treatment.label list
    mechanismCandidates:  [],         // treatments matching mechanism keywords
    methodCandidates:     [],         // treatments matching method keywords
    embodimentCandidates:[],          // treatments matching system/device/apparatus
    figurePlaceholders:   [],         // synthesized figure-caption hints
    evidenceAnchors:      [],         // {evidence, node, diagnosisId}
    laneSignals: {
      'patents':           { score: 0, hits: 0 },
      'business-grants':   { score: 0, hits: 0 },
      'research-grants':   { score: 0, hits: 0 },
      'nsf-project-pitch': { score: 0, hits: 0 },
      'sba-loans':         { score: 0, hits: 0 },
      'investments':       { score: 0, hits: 0 }
    },
    childPortalReferences: [],        // childPortal links for missing-reference report
    warnings:             []
  };

  if (!raw || typeof raw !== 'object') {
    rec.warnings.push('PARSE_FAIL: portal JSON not an object');
    return rec;
  }

  var diagSet = Object.create(null);
  var implSet = Object.create(null);
  var activations = Array.isArray(raw.activations) ? raw.activations : [];

  for (var i = 0; i < activations.length; i++) {
    var act = activations[i];
    if (!act || typeof act !== 'object') continue;
    var brainNode = act.brainNodeId || null;

    if (Array.isArray(act.diagnosticTriggers)) {
      for (var t = 0; t < act.diagnosticTriggers.length; t++) {
        var dx = act.diagnosticTriggers[t];
        if (typeof dx !== 'string' || !dx.length) continue;
        var canon = canonicalizeDiagnosisLabel(dx);
        if (!canon) continue;
        if (!diagSet[canon]) {
          diagSet[canon] = true;
          rec.diagnosisIds.push(canon);
        }
        // Track raw → canonical alias so the bundle can carry the
        // original label for traceability without changing lookup keys.
        if (rec.rawDiagnosisLabels.indexOf(dx) === -1) rec.rawDiagnosisLabels.push(dx);
      }
    }

    if (Array.isArray(act.treatments)) {
      for (var tr = 0; tr < act.treatments.length; tr++) {
        var treat = act.treatments[tr];
        if (!treat || typeof treat !== 'object') continue;
        var label = treat.label || '';
        var desc  = treat.description || '';
        var type  = treat.type || null;
        var ev    = treat.evidence || null;
        // Canonicalize per-treatment dxList so evidenceAnchors and
        // bucket-keyed lookups all share the upper-snake form.
        var dxList = [];
        if (Array.isArray(act.diagnosticTriggers)) {
          for (var dxI = 0; dxI < act.diagnosticTriggers.length; dxI++) {
            var dxC = canonicalizeDiagnosisLabel(act.diagnosticTriggers[dxI]);
            if (dxC && dxList.indexOf(dxC) === -1) dxList.push(dxC);
          }
        }

        var treatRec = {
          label: label, type: type, description: desc,
          evidence: ev, brainNode: brainNode, diagnosisIds: dxList
        };
        rec.treatments.push(treatRec);

        if (label && !implSet[label]) {
          implSet[label] = true;
          rec.implementationSteps.push(label);
        }

        var combined = (label + ' ' + desc).slice(0, 1024);

        // Patent-leaning candidate categorization. Heuristic only; the
        // finalizer remains the canonical anti-overclaim authority.
        if (LANE_KEYWORDS.patents.some(function (rx) { return rx.test(combined); })) {
          rec.mechanismCandidates.push({ label: label, brainNode: brainNode });
        }
        if (/\bmethod\b|\bprocess\b|\balgorithm\b|\bprotocol\b/i.test(combined)) {
          rec.methodCandidates.push({ label: label, brainNode: brainNode });
        }
        if (/\bsystem\b|\bdevice\b|\bapparatus\b|\bplatform\b/i.test(combined)) {
          rec.embodimentCandidates.push({ label: label, brainNode: brainNode });
        }

        if (ev) {
          rec.evidenceAnchors.push({
            evidence: ev, brainNode: brainNode,
            diagnosisIds: dxList.slice(0, 6)
          });
        }

        // Lane scoring — count keyword hits per lane bucket.
        var lk = LANE_KEYWORDS;
        if (lk.patents.some(function (rx) { return rx.test(combined); })) {
          rec.laneSignals['patents'].hits++;
          rec.laneSignals['patents'].score += 1;
        }
        if (lk.grants.some(function (rx) { return rx.test(combined); })) {
          rec.laneSignals['business-grants'].hits++;
          rec.laneSignals['business-grants'].score += 1;
          rec.laneSignals['research-grants'].hits++;
          rec.laneSignals['research-grants'].score += 1;
          rec.laneSignals['nsf-project-pitch'].hits++;
          rec.laneSignals['nsf-project-pitch'].score += 1;
        }
        if (lk.sba.some(function (rx) { return rx.test(combined); })) {
          rec.laneSignals['sba-loans'].hits++;
          rec.laneSignals['sba-loans'].score += 1;
        }
        if (lk.investments.some(function (rx) { return rx.test(combined); })) {
          rec.laneSignals['investments'].hits++;
          rec.laneSignals['investments'].score += 1;
        }
      }
    }

    if (typeof act.childPortal === 'string' && act.childPortal.length) {
      // childPortal is a filename like "addiction_reward_portal.html" —
      // record for missing-reference cross-check downstream.
      rec.childPortalReferences.push(act.childPortal);
    }

    // Figure placeholders synthesized from node descriptions —
    // lightweight scaffolding for patents lane.
    if (brainNode && (act.domainLabel || act.domainDescription)) {
      rec.figurePlaceholders.push({
        caption: 'Architecture excerpt — ' + brainNode + ': ' + (act.domainLabel || ''),
        brainNode: brainNode
      });
    }
  }

  return rec;
}

// ─── Inverted-index aggregator ───────────────────────────────────────

// As we scan, we accumulate per-diagnosis lane buckets directly. Memory
// shape: O(diagnoses * lanes * avg-bundle-size). With ~hundreds of
// diagnoses this stays bounded.
function _newAggregator() {
  return {
    byDiagnosis:        Object.create(null),
    byDomain:           Object.create(null),
    byPortalId:         Object.create(null),
    childGraphEdges:    [],
    missingReferences:  [],
    stats: {
      filesScanned:      0,
      filesParsed:       0,
      filesParseFailed:  0,
      portalsWithDiag:   0,
      totalDiagnoses:    0,
      totalTreatments:   0,
      totalImplSteps:    0,
      totalEvidence:     0,
      totalMechanisms:   0,
      totalMethods:      0,
      totalEmbodiments:  0,
      totalFigures:      0
    }
  };
}

function _aggregate(agg, rec, portalIdSet) {
  agg.stats.filesParsed++;
  agg.byDomain[rec.domain] = (agg.byDomain[rec.domain] || 0) + 1;
  agg.byPortalId[rec.portalId] = rec.sourceFile;

  if (rec.diagnosisIds.length) agg.stats.portalsWithDiag++;
  agg.stats.totalTreatments  += rec.treatments.length;
  agg.stats.totalImplSteps   += rec.implementationSteps.length;
  agg.stats.totalEvidence    += rec.evidenceAnchors.length;
  agg.stats.totalMechanisms  += rec.mechanismCandidates.length;
  agg.stats.totalMethods     += rec.methodCandidates.length;
  agg.stats.totalEmbodiments += rec.embodimentCandidates.length;
  agg.stats.totalFigures     += rec.figurePlaceholders.length;

  // Capture child-portal references for missing-reference cross-check.
  for (var c = 0; c < rec.childPortalReferences.length; c++) {
    agg.childGraphEdges.push({ from: rec.portalId, to: rec.childPortalReferences[c] });
  }

  // Per-diagnosis bucket: append per-lane signals.
  for (var d = 0; d < rec.diagnosisIds.length; d++) {
    var dx = rec.diagnosisIds[d];
    if (!agg.byDiagnosis[dx]) {
      agg.byDiagnosis[dx] = _newDxBucket(dx);
      agg.stats.totalDiagnoses++;
    }
    var bucket = agg.byDiagnosis[dx];
    bucket.portalCount++;
    // Carry forward each unique raw label so the runtime client can
    // reverse-map for display purposes without re-scanning the corpus.
    for (var rli = 0; rli < rec.rawDiagnosisLabels.length; rli++) {
      var rawLabel = rec.rawDiagnosisLabels[rli];
      if (canonicalizeDiagnosisLabel(rawLabel) !== dx) continue;
      if (bucket.rawDiagnosisLabels.indexOf(rawLabel) === -1) {
        bucket.rawDiagnosisLabels.push(rawLabel);
      }
    }
    if (bucket.domains.indexOf(rec.domain) === -1) bucket.domains.push(rec.domain);
    if (rec.depth > bucket.maxDepth) bucket.maxDepth = rec.depth;
    if (bucket.sourcePortals.length < CAPS.sourcePortals) {
      bucket.sourcePortals.push({
        portalId: rec.portalId, domain: rec.domain, depth: rec.depth,
        title: rec.title, ancestry: rec.ancestryPath.slice()
      });
    }

    // D3-G.2 Option B compression — populate the shared grants block ONCE
    // per portal record. The 4 grant/SBA lanes formerly emitted byte-
    // identical arrays; this collapses to a single shared block. The
    // _sharedSeen guard ensures dedup across the 4-lane loop below
    // (which runs per-lane to keep topSources scoring per-lane).
    var sharedG = bucket.byLaneShared.grants;
    var seen    = bucket._sharedSeen;
    for (var t0 = 0; t0 < rec.treatments.length; t0++) {
      if (sharedG.treatments.length >= CAPS.treatments) break;
      var tr0 = rec.treatments[t0];
      var key0 = rec.portalId + '|' + (tr0.label || '');
      if (seen.treatments[key0]) continue;
      seen.treatments[key0] = true;
      sharedG.treatments.push({
        portalId:  rec.portalId, label: tr0.label, type: tr0.type,
        evidence:  tr0.evidence, brainNode: tr0.brainNode
      });
    }
    for (var s0 = 0; s0 < rec.implementationSteps.length; s0++) {
      if (sharedG.implementationSteps.length >= CAPS.implementationSteps) break;
      var stepK = rec.portalId + '|' + (rec.implementationSteps[s0] || '');
      if (seen.implSteps[stepK]) continue;
      seen.implSteps[stepK] = true;
      sharedG.implementationSteps.push({ portalId: rec.portalId, step: rec.implementationSteps[s0] });
    }
    for (var ea0 = 0; ea0 < rec.evidenceAnchors.length; ea0++) {
      if (sharedG.evidenceAnchors.length >= CAPS.evidenceAnchors) break;
      var anch0 = rec.evidenceAnchors[ea0];
      var anchK = rec.portalId + '|' + (anch0.evidence || '') + '|' + (anch0.brainNode || '');
      if (seen.evidenceAnchors[anchK]) continue;
      seen.evidenceAnchors[anchK] = true;
      sharedG.evidenceAnchors.push({
        portalId: rec.portalId, evidence: anch0.evidence,
        brainNode: anch0.brainNode, diagnosisIds: anch0.diagnosisIds
      });
    }

    var lanes = ['patents','business-grants','research-grants','nsf-project-pitch','sba-loans','investments'];
    for (var L = 0; L < lanes.length; L++) {
      var lane = lanes[L];
      var laneBucket = bucket.byLane[lane];
      var laneRecScore = (rec.laneSignals[lane] && rec.laneSignals[lane].score) || 0;

      if (laneBucket.topSources.length < CAPS.topSources && laneRecScore > 0) {
        laneBucket.topSources.push({
          portalId: rec.portalId, score: laneRecScore,
          domain: rec.domain, depth: rec.depth, title: rec.title
        });
      }

      // Patents keeps its own filtered treatments/implementationSteps/
      // evidenceAnchors (different filter — patents-keyword-gated).
      // Investments has no shared block (no treatment harvest there).
      // Grant/SBA lanes draw from byLaneShared.grants via _sharedRef.
      if (lane === 'patents') {
        for (var t = 0; t < rec.treatments.length; t++) {
          if (laneBucket.treatments.length >= CAPS.treatments) break;
          var tr = rec.treatments[t];
          var combined = (tr.label + ' ' + tr.description).slice(0, 256);
          if (!LANE_KEYWORDS.patents.some(function (rx) { return rx.test(combined); })) continue;
          laneBucket.treatments.push({
            portalId:   rec.portalId,
            label:      tr.label,
            type:       tr.type,
            evidence:   tr.evidence,
            brainNode:  tr.brainNode
          });
        }
        for (var s = 0; s < rec.implementationSteps.length; s++) {
          if (laneBucket.implementationSteps.length >= CAPS.implementationSteps) break;
          laneBucket.implementationSteps.push({
            portalId: rec.portalId, step: rec.implementationSteps[s]
          });
        }
        for (var ea = 0; ea < rec.evidenceAnchors.length; ea++) {
          if (laneBucket.evidenceAnchors.length >= CAPS.evidenceAnchors) break;
          var anch = rec.evidenceAnchors[ea];
          laneBucket.evidenceAnchors.push({
            portalId: rec.portalId, evidence: anch.evidence,
            brainNode: anch.brainNode, diagnosisIds: anch.diagnosisIds
          });
        }
      }
      // Note: grant/SBA lanes intentionally skip the per-lane push —
      // they reference the shared block via _sharedRef='grants'.

      if (lane === 'patents') {
        for (var m = 0; m < rec.mechanismCandidates.length; m++) {
          if (laneBucket.mechanismCandidates.length >= CAPS.mechanismCandidates) break;
          laneBucket.mechanismCandidates.push({
            portalId: rec.portalId, label: rec.mechanismCandidates[m].label,
            brainNode: rec.mechanismCandidates[m].brainNode
          });
        }
        for (var mt = 0; mt < rec.methodCandidates.length; mt++) {
          if (laneBucket.methodCandidates.length >= CAPS.methodCandidates) break;
          laneBucket.methodCandidates.push({
            portalId: rec.portalId, label: rec.methodCandidates[mt].label,
            brainNode: rec.methodCandidates[mt].brainNode
          });
        }
        for (var emb = 0; emb < rec.embodimentCandidates.length; emb++) {
          if (laneBucket.embodimentCandidates.length >= CAPS.embodimentCandidates) break;
          laneBucket.embodimentCandidates.push({
            portalId: rec.portalId, label: rec.embodimentCandidates[emb].label,
            brainNode: rec.embodimentCandidates[emb].brainNode
          });
        }
        for (var fg = 0; fg < rec.figurePlaceholders.length; fg++) {
          if (laneBucket.figurePlaceholders.length >= CAPS.figureCandidates) break;
          laneBucket.figurePlaceholders.push({
            portalId: rec.portalId, caption: rec.figurePlaceholders[fg].caption,
            brainNode: rec.figurePlaceholders[fg].brainNode
          });
        }
      }
    }

    if (rec.warnings.length) {
      for (var w = 0; w < rec.warnings.length; w++) bucket.warnings.push({
        portalId: rec.portalId, warning: rec.warnings[w]
      });
    }
  }

  // Capture portal-id existence set for downstream missing-ref check.
  if (portalIdSet) portalIdSet[rec.portalId] = true;
}

// D3-G.2 (Option B compression):
// The 4 grant/SBA lanes (business-grants, research-grants,
// nsf-project-pitch, sba-loans) accept ALL treatments / impl steps /
// evidence anchors with no lane-specific filter — the arrays are
// byte-equivalent across these 4 lanes today. Emit them ONCE under
// byLaneShared.grants and reference from each lane via _sharedRef.
//
// Lane-specific things that still differ (kept per-lane):
//   - topSources (lane-specific keyword scoring)
//   - sourcePortals (per-lane cap, future-flexible)
//   - patents only: mechanismCandidates / methodCandidates /
//     embodimentCandidates / figurePlaceholders (patents-keyword-gated;
//     never populated for non-patents lanes)
//
// Runtime client (assets/js/civilization/artifact-source-index-client.js)
// reconstructs the full lane shape via selectLaneSource() — consumers
// see the same arrays they always saw, sourced from the shared block
// when _sharedRef is set.
var GRANT_LANES = { 'business-grants': 1, 'research-grants': 1, 'nsf-project-pitch': 1, 'sba-loans': 1 };

function _newDxBucket(dxId) {
  var bucket = {
    diagnosisId:        dxId,
    rawDiagnosisLabels: [],
    aliases:            [],   // additional canonical forms encountered (rare)
    builtAt:            null,
    portalCount:        0,
    domains:            [],
    maxDepth:           0,
    sourcePortals:      [],
    byLaneShared:       {
      // Shared grant/SBA harvest. Populated from any portal-treatment
      // we'd otherwise duplicate across the 4 grant lanes.
      grants: {
        treatments:          [],
        implementationSteps: [],
        evidenceAnchors:     [],
        sourcePortals:       []
      }
    },
    byLane:             {},
    warnings:           []
  };
  ['patents','business-grants','research-grants','nsf-project-pitch','sba-loans','investments'].forEach(function (lane) {
    if (Object.prototype.hasOwnProperty.call(GRANT_LANES, lane)) {
      // Compressed grant lane: only lane-specific fields. Shared arrays
      // live under bucket.byLaneShared.grants; client reconstructs.
      bucket.byLane[lane] = {
        topSources:    [],
        sourcePortals: [],
        _sharedRef:    'grants'
      };
    } else {
      bucket.byLane[lane] = {
        topSources:           [],
        treatments:           [],
        implementationSteps:  [],
        mechanismCandidates:  [],
        methodCandidates:     [],
        embodimentCandidates: [],
        figurePlaceholders:   [],
        evidenceAnchors:      [],
        sourcePortals:        []
      };
    }
  });
  // Track which (portalId, label) tuples have already been added to the
  // shared grants block so we dedup across the 4 lane iterations of the
  // same portal record. Stored as a non-enumerable scratch map; cleared
  // before bundle write.
  Object.defineProperty(bucket, '_sharedSeen', {
    value: { treatments: Object.create(null), implSteps: Object.create(null), evidenceAnchors: Object.create(null) },
    enumerable: false, writable: true, configurable: true
  });
  return bucket;
}

// ─── Missing-reference resolution (post-scan) ─────────────────────────

function _resolveMissingReferences(agg, portalIdSet) {
  var missingMap = Object.create(null);
  for (var i = 0; i < agg.childGraphEdges.length; i++) {
    var edge = agg.childGraphEdges[i];
    var to = edge.to;
    // childPortal is typically "<id>_portal.html" or "<id>.html".
    var refId = to.replace(/\.html$/, '').replace(/_portal$/, '');
    if (!portalIdSet[refId]) {
      if (!missingMap[refId]) missingMap[refId] = { refId: refId, referencedBy: [] };
      if (missingMap[refId].referencedBy.length < 8) {
        missingMap[refId].referencedBy.push({ from: edge.from, raw: to });
      }
    }
  }
  agg.missingReferences = Object.keys(missingMap).map(function (k) { return missingMap[k]; });
  agg.missingReferences.sort(function (a, b) {
    return (b.referencedBy.length - a.referencedBy.length) || a.refId.localeCompare(b.refId);
  });
}

// ─── Main scan loop ──────────────────────────────────────────────────

function _scanCorpus(opts) {
  console.log('[D3-G] starting scan');
  console.log('[D3-G]   DOMAINS_DIR =', DOMAINS_DIR);
  console.log('[D3-G]   options     =', JSON.stringify(opts));

  var files = _listCandidates(opts);
  console.log('[D3-G] candidate files:', files.length);

  var t0 = Date.now();
  var agg = _newAggregator();
  agg.stats.filesScanned = files.length;
  var portalIdSet = Object.create(null);

  // Resume support — checkpoint stores last filename completed.
  var startIdx = 0;
  if (opts.resume && fs.existsSync(CHECKPOINT_FILE)) {
    try {
      var cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
      if (cp && typeof cp.lastIndex === 'number') startIdx = cp.lastIndex + 1;
      console.log('[D3-G] resuming from index', startIdx);
    } catch (e) {
      console.log('[D3-G] checkpoint unreadable; starting fresh');
    }
  }

  for (var i = startIdx; i < files.length; i++) {
    var f = files[i];
    var full = path.join(DOMAINS_DIR, f);
    var raw = null;
    try {
      var text = fs.readFileSync(full, 'utf8');
      raw = JSON.parse(text);
    } catch (e) {
      agg.stats.filesParseFailed++;
      // Still aggregate as a parse-fail record so missing-source diagnostics fire.
      var parseFailRec = _normalizePortal(f, null);
      _aggregate(agg, parseFailRec, portalIdSet);
      if ((i + 1) % PROGRESS_EVERY === 0) console.log('[D3-G] scanned', (i + 1), '/', files.length);
      continue;
    }

    var rec = _normalizePortal(f, raw);
    _aggregate(agg, rec, portalIdSet);

    // Diagnosis-only sample mode — keep only matching diagnosis bucket.
    if (opts.diagnosis && opts.sample) {
      // No-op here; we aggregate for all diagnoses, then filter at write time.
    }

    if ((i + 1) % PROGRESS_EVERY === 0) {
      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      var rate = ((i + 1) / Math.max(1, parseFloat(dt))).toFixed(0);
      console.log('[D3-G] scanned', (i + 1), '/', files.length,
        ' (' + dt + 's, ' + rate + ' files/sec)');
    }
  }

  _resolveMissingReferences(agg, portalIdSet);

  agg.stats.elapsedMs = Date.now() - t0;
  agg.stats.filesPerSec = Math.round(agg.stats.filesParsed / Math.max(1, agg.stats.elapsedMs / 1000));
  console.log('[D3-G] scan complete in', (agg.stats.elapsedMs / 1000).toFixed(1), 's');
  console.log('[D3-G] parsed:', agg.stats.filesParsed,
              ' parseFail:', agg.stats.filesParseFailed,
              ' portalsWithDiag:', agg.stats.portalsWithDiag,
              ' totalDiagnoses:', agg.stats.totalDiagnoses);

  return agg;
}

// ─── Output ──────────────────────────────────────────────────────────

function _ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function _writeJson(p, obj) {
  _ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  return fs.statSync(p).size;
}

function _emitSampleSummary(agg, opts) {
  _ensureDir(SAMPLE_OUT_DIR);
  var summary = {
    builtAt:   new Date().toISOString(),
    options:   opts,
    stats:     agg.stats,
    domains:   agg.byDomain,
    diagnosisCount: Object.keys(agg.byDiagnosis).length,
    sampleDiagnoses: Object.keys(agg.byDiagnosis).slice(0, 16),
    missingReferenceCount: agg.missingReferences.length,
    missingReferenceTop: agg.missingReferences.slice(0, 10)
  };
  var size = _writeJson(path.join(SAMPLE_OUT_DIR, 'summary.json'), summary);
  console.log('[D3-G] wrote sample summary (', size, 'bytes)');

  // Emit a single bundle if --diagnosis was specified
  if (opts.diagnosis && agg.byDiagnosis[opts.diagnosis]) {
    var b = agg.byDiagnosis[opts.diagnosis];
    b.builtAt = new Date().toISOString();
    var sz = _writeJson(path.join(SAMPLE_OUT_DIR, 'by-diagnosis-' + opts.diagnosis + '.json'), b);
    console.log('[D3-G] wrote diagnosis bundle for', opts.diagnosis, '(', sz, 'bytes)');
  } else if (opts.diagnosis) {
    console.log('[D3-G] requested --diagnosis ' + opts.diagnosis + ' produced no bucket (no matches)');
  }

  // Sample-mode also emits the first 5 diagnosis bundles for inspection
  var sampleIds = Object.keys(agg.byDiagnosis).slice(0, 5);
  var combined = {};
  for (var i = 0; i < sampleIds.length; i++) {
    var id = sampleIds[i];
    var bb = agg.byDiagnosis[id];
    bb.builtAt = new Date().toISOString();
    combined[id] = bb;
  }
  var s2 = _writeJson(path.join(SAMPLE_OUT_DIR, 'by-diagnosis-sample.json'), combined);
  console.log('[D3-G] wrote sample bundles (', sampleIds.length, ') size:', s2, 'bytes');
}

function _emitGlobal(agg) {
  _ensureDir(INDEX_OUT_DIR);
  var statsOut = {
    builtAt: new Date().toISOString(),
    stats:   agg.stats,
    domains: agg.byDomain,
    diagnosisCount: Object.keys(agg.byDiagnosis).length,
    missingReferenceCount: agg.missingReferences.length
  };
  var size = _writeJson(path.join(INDEX_OUT_DIR, 'stats.json'), statsOut);
  console.log('[D3-G] wrote stats.json (', size, 'bytes)');

  var miss = _writeJson(path.join(INDEX_OUT_DIR, 'missing-references.json'),
                        { builtAt: new Date().toISOString(), missingReferences: agg.missingReferences });
  console.log('[D3-G] wrote missing-references.json (', miss, 'bytes,',
    agg.missingReferences.length, 'entries)');
}

function _emitDiagnosisBundles(agg) {
  _ensureDir(BY_DX_OUT_DIR);
  var ids = Object.keys(agg.byDiagnosis);
  var totalBytes = 0;
  for (var i = 0; i < ids.length; i++) {
    var b = agg.byDiagnosis[ids[i]];
    b.builtAt = new Date().toISOString();
    var sz = _writeJson(path.join(BY_DX_OUT_DIR, ids[i] + '.json'), b);
    totalBytes += sz;
    if ((i + 1) % 25 === 0) console.log('[D3-G] wrote', (i + 1), 'bundles');
  }
  console.log('[D3-G] wrote', ids.length, 'diagnosis bundles, total', totalBytes, 'bytes');
}

// ─── Main ────────────────────────────────────────────────────────────

// ─── Lane scoring documentation (D3-G.1) ─────────────────────────────
//
// Scoring runs AFTER harvest. Each portal's treatments are scanned for
// lane-leaning keyword patterns (LANE_KEYWORDS at the top of this
// file). Per-portal hits accumulate into laneSignals[lane].score,
// which the bundle aggregator uses to rank candidate sources within
// each lane bucket.
//
// What raises each lane's score:
//   patents:
//     - mechanism / system / method / process / device / apparatus
//     - sensor / signal / threshold / algorithm
//     - control loop / feedback / actuator / controller
//     - inhibitor / antagonist / agonist / modulator
//     Treatments matching these patterns also populate
//     mechanismCandidates / methodCandidates / embodimentCandidates.
//   business-grants / research-grants / nsf-project-pitch:
//     - problem / need / objective / outcome
//     - broader impact / public benefit
//     - evidence / work plan / milestone / measurable indicator
//   sba-loans:
//     - business / operator / customer / revenue
//     - use of funds / market / collateral / working capital
//   investments:
//     - catalyst / thesis / invalidation
//     - drawdown / inventory / stress band / ticker / fundamental
//
// topSources selection per lane:
//   - Iterate all portals contributing to a diagnosis bucket.
//     Add (portalId, score, domain, depth, title) to lane.topSources
//     when laneSignals[lane].score > 0 and bucket is below cap.
//   - Cap is 100 entries per lane (CAPS.topSources).
//   - Order is insertion-order; downstream consumers can re-sort by
//     score if they need ranking. The cap is conservative — full-corpus
//     output stays small enough to load synchronously.
//
// All other lane-scoped lists are deduplicated by (portalId, label)
// and capped per CAPS at the top of the file.
//
// Scoring is BIASED — it favors portals with technical depth in the
// patents lane and operational/business depth in the SBA lane. The
// bias is a heuristic; downstream finalizer anti-overclaim rules
// (api/finalize-artifact.js) remain the authoritative gate on what
// the OpenAI output can claim.

function main() {
  var opts = _parseArgs(process.argv);

  // Self-test the canonicalizer up front so a regression in the
  // normalization regex shows immediately rather than corrupting
  // every bucket key in the bundle.
  var selfTest = canonicalizeSelfTest();
  if (!selfTest.ok) {
    console.error('[D3-G.1] canonicalizeSelfTest FAILED:', JSON.stringify(selfTest.failures));
    process.exit(2);
  }
  console.log('[D3-G.1] canonicalizeSelfTest OK (' + selfTest.total + ' cases)');

  if (opts.dryRun) {
    var files = _listCandidates(opts);
    console.log('[D3-G] DRY RUN');
    console.log('  files matching:', files.length);
    if (files.length) {
      console.log('  first 5:', files.slice(0, 5));
      console.log('  last 5:',  files.slice(-5));
    }
    return;
  }

  var agg = _scanCorpus(opts);

  if (opts.sample) {
    _emitSampleSummary(agg, opts);
    return;
  }
  if (opts.buildGlobal) {
    _emitGlobal(agg);
    return;
  }
  if (opts.buildDiagnosisBundles) {
    _emitGlobal(agg);
    _emitDiagnosisBundles(agg);
    return;
  }
  if (opts.diagnosis) {
    // No --sample but --diagnosis: emit just the bundle.
    _ensureDir(SAMPLE_OUT_DIR);
    if (agg.byDiagnosis[opts.diagnosis]) {
      var b = agg.byDiagnosis[opts.diagnosis];
      b.builtAt = new Date().toISOString();
      var sz = _writeJson(path.join(SAMPLE_OUT_DIR, 'by-diagnosis-' + opts.diagnosis + '.json'), b);
      console.log('[D3-G] wrote diagnosis bundle for', opts.diagnosis, '(', sz, 'bytes)');
    } else {
      console.log('[D3-G] no bucket for diagnosis', opts.diagnosis);
    }
    return;
  }

  console.log('[D3-G] scan-only mode (no --sample, --build-*, or --diagnosis output flag)');
}

if (require.main === module) {
  try { main(); }
  catch (e) { console.error('[D3-G] fatal:', e && e.message); process.exit(2); }
}

module.exports = {
  canonicalizeDiagnosisLabel: canonicalizeDiagnosisLabel,
  canonicalizeSelfTest:       canonicalizeSelfTest,
  _internal: {
    _normalizePortal:     _normalizePortal,
    _newAggregator:       _newAggregator,
    _aggregate:           _aggregate,
    _resolveMissingReferences: _resolveMissingReferences,
    LANE_KEYWORDS:        LANE_KEYWORDS,
    CAPS:                 CAPS
  }
};
