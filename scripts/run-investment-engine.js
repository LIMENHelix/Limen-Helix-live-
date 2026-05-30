#!/usr/bin/env node
/**
 * run-investment-engine.js — Investment engine MVP (rule-based, no ML).
 *
 * Reads each v2 portal's financialHealth and emits opportunitySignals[]
 * entries per the rule set below. This is the simplest engine in the
 * 6-engine stack (Patent / Grant / SBA / Franchise / Investment / Research)
 * and the first to produce real output. Sets the schema-write pattern for
 * the other engines.
 *
 * Engine signals are SEPARATE from Helix Report's clinical-intervention
 * templates (which are gated by Thing 1 alert per Operating Envelope §6).
 * Engine signals can fire on non-alert companies — cohort anchors,
 * recovery thesis, pivot thesis — without violating that gating, because
 * they make portfolio-construction claims, not clinical-narrative claims.
 *
 * Rules:
 *
 *   distress-short-candidate (lead, high-confidence)
 *     IF alert=true OR compositeScore >= 1.5
 *     "Validated kernel alert. Path X breach. Distress short or
 *      restructuring play candidate. Verify on Helix Report."
 *
 *   early-warning-watch (watch, watchlist-tier)
 *     IF compositeScore IN [1.1, 1.5) AND alert=false
 *     "Path A breach without composite alert. Watchlist tier; paper
 *      trade only. Likely INGESTION_SUSPECT or early-cycle stress."
 *
 *   pivot-thesis (lead, watchlist-tier)
 *     IF dominantPhase = p8 AND compositeScore < 1.1
 *     "Phase tracker reads structural pivot in progress (P8 PIVOT)
 *      with composite stable. Capital-allocation target if narrative
 *      supports turnaround."
 *
 *   recovery-thesis (lead, watchlist-tier)
 *     IF dominantPhase = p10 AND compositeScore < 1.1 AND historyQuarters > 40
 *     "Phase tracker reads new-baseline post-distress (P10 RESURRECTION).
 *      Long history confirms structural break is past. Recovery long
 *      candidate."
 *
 *   cohort-anchor (reference, research-only)
 *     IF compositeScore < 0.5 AND historyQuarters >= 60
 *     AND dominantPhase IN {p0, p6} AND envelopeStatus = ELIGIBLE_NOW
 *     "Kernel-stable across long history. Calibration-cohort anchor for
 *      retail/CPG-regime backtest. Reference data; not a trade thesis."
 *
 *   data-quality-suspect (reference, no-action)
 *     IF compositeScore = 0 AND historyQuarters > 0
 *     "Composite=0 anomaly. Likely fallback when revenue extraction
 *      fails. Investigate kernel input_presence; do not act on signal."
 *
 *   no-signal (reference)
 *     Otherwise: no signal emitted (silent on no-thesis portals).
 *
 * Each signal carries:
 *   id              stable per-company-per-day
 *   engine          "investment"
 *   type            lead | watch | reference
 *   subType         distress-short-candidate | early-warning-watch | ...
 *   message         human-readable thesis (1-2 sentences)
 *   evidence        kernel snapshot at signal-fire time
 *   estimatedValue  high-confidence | watchlist-tier | research-only | no-action
 *   createdAt       ISO timestamp
 *   status          draft (auto-generated; needs human review before "surfaced")
 *
 * Idempotent: reading the same portal twice on the same day overwrites
 * any same-day signal of the same subType. Replaces the engine's prior
 * signals; preserves any other-engine signals.
 *
 * Usage:
 *   node scripts/run-investment-engine.js                  # run all v2 portals
 *   node scripts/run-investment-engine.js --dry-run        # preview only
 *   node scripts/run-investment-engine.js procter_gamble   # single portal
 */

const fs = require('fs');
const path = require('path');

const COMPANIES_DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SINGLE = args.find(a => !a.startsWith('--'));
const ENGINE_NAME = 'investment';

function isoDate(d) { return (d || new Date()).toISOString().slice(0, 10); }
function isoNow() { return new Date().toISOString(); }

function evaluatePortal(co) {
  const fh = co.financialHealth;
  if (!fh) return { signals: [], skipped: 'no financialHealth' };
  if (co.kernelStatus === 'ERROR' || co.kernelStatus === 'PRIVATE') {
    return { signals: [], skipped: 'kernelStatus=' + co.kernelStatus };
  }
  if (co.kernelStatus === 'INSUFFICIENT_HISTORY') {
    return { signals: [], skipped: 'INSUFFICIENT_HISTORY (kernel needs ≥32Q)' };
  }

  const composite = fh.compositeScore;
  const alert = !!fh.alert;
  const phase = fh.dominantPhase;
  const history = fh.historyQuarters || 0;
  const envelope = fh.envelopeStatus;

  // Frozen evidence snapshot for every signal this run — refers to kernel
  // state at signal-fire time, not the live state when the signal is read.
  const evidence = {
    compositeScore: composite,
    alert,
    pathway: fh.pathway,
    pathA: fh.pathA, pathB: fh.pathB, pathC: fh.pathC,
    pathAThreshold: fh.pathAThreshold, pathBThreshold: fh.pathBThreshold, pathCThreshold: fh.pathCThreshold,
    phaseStateLabel: fh.phaseStateLabel,
    dominantPhase: phase,
    historyQuarters: history,
    distressBand: fh.distressBand,
    envelopeStatus: envelope,
    kernelShaLock: fh.kernelShaLock,
    lastKernelRun: fh.lastKernelRun,
  };

  const signals = [];
  const ts = isoNow();
  const dateStamp = isoDate();
  const slug = co.slug;

  // Rule 1: distress-short-candidate
  if (composite != null && (alert || composite >= 1.5)) {
    const breachPaths = [];
    if (fh.alertA || (fh.pathA != null && fh.pathA >= (fh.pathAThreshold || 1.1))) breachPaths.push('A');
    if (fh.alertB || (fh.pathB != null && fh.pathB >= (fh.pathBThreshold || 1.5))) breachPaths.push('B');
    if (fh.alertC || (fh.pathC != null && fh.pathC >= (fh.pathCThreshold || 1.5))) breachPaths.push('C');
    const pathStr = breachPaths.length ? 'Path ' + breachPaths.join('+') + ' breach' : 'composite breach';
    signals.push({
      id: slug + '-investment-' + dateStamp + '-distress-short-candidate',
      engine: ENGINE_NAME,
      type: 'lead',
      subType: 'distress-short-candidate',
      message: 'Validated kernel ' + (alert ? 'alert' : 'distress') +
               ' (composite=' + Number(composite).toFixed(3) + '). ' + pathStr +
               '. Distress short or restructuring play candidate. Verify thesis on Helix Report (interventions tab fires only on alert + reconciliation authority).',
      evidence,
      estimatedValue: alert ? 'high-confidence' : 'watchlist-tier',
      createdAt: ts,
      status: 'draft',
    });
  }
  // Rule 2: early-warning-watch
  else if (composite != null && composite >= 1.1 && composite < 1.5 && !alert) {
    signals.push({
      id: slug + '-investment-' + dateStamp + '-early-warning-watch',
      engine: ENGINE_NAME,
      type: 'watch',
      subType: 'early-warning-watch',
      message: 'Path A breach (composite=' + Number(composite).toFixed(3) +
               ') without composite-alert threshold. Watchlist tier; paper trade only. ' +
               'Likely early-cycle stress or INGESTION_SUSPECT envelope. Re-evaluate next quarter.',
      evidence,
      estimatedValue: 'watchlist-tier',
      createdAt: ts,
      status: 'draft',
    });
  }
  // Rule 3: pivot-thesis
  else if (phase === 'p8' && composite != null && composite < 1.1) {
    signals.push({
      id: slug + '-investment-' + dateStamp + '-pivot-thesis',
      engine: ENGINE_NAME,
      type: 'lead',
      subType: 'pivot-thesis',
      message: 'Phase tracker reads structural pivot in progress (P8 · PIVOT) with composite=' +
               Number(composite).toFixed(3) + ' stable below distress threshold. Capital-allocation ' +
               'target if narrative supports turnaround thesis. Pair with management-change tracker.',
      evidence,
      estimatedValue: 'watchlist-tier',
      createdAt: ts,
      status: 'draft',
    });
  }
  // Rule 4: recovery-thesis
  else if (phase === 'p10' && composite != null && composite < 1.1 && history > 40) {
    signals.push({
      id: slug + '-investment-' + dateStamp + '-recovery-thesis',
      engine: ENGINE_NAME,
      type: 'lead',
      subType: 'recovery-thesis',
      message: 'Phase tracker reads new-baseline post-distress (P10 · RESURRECTION). ' +
               history + 'Q history confirms structural break is past; composite=' +
               Number(composite).toFixed(3) + ' below distress threshold. Recovery long candidate.',
      evidence,
      estimatedValue: 'watchlist-tier',
      createdAt: ts,
      status: 'draft',
    });
  }
  // Rule 5: cohort-anchor (research-only reference)
  else if (composite != null && composite < 0.5 && history >= 60 &&
           (phase === 'p0' || phase === 'p6') && envelope === 'ELIGIBLE_NOW') {
    signals.push({
      id: slug + '-investment-' + dateStamp + '-cohort-anchor',
      engine: ENGINE_NAME,
      type: 'reference',
      subType: 'cohort-anchor',
      message: 'Kernel-stable across ' + history + 'Q history (composite=' +
               Number(composite).toFixed(3) + ', ' + (fh.phaseStateLabel || phase) +
               '). Calibration-cohort anchor for ' + (co.industry || co.domainId) +
               '-regime backtest. Reference data; not a trade thesis.',
      evidence,
      estimatedValue: 'research-only',
      createdAt: ts,
      status: 'draft',
    });
  }
  // Rule 6: data-quality-suspect
  if (composite === 0 && history > 0) {
    signals.push({
      id: slug + '-investment-' + dateStamp + '-data-quality-suspect',
      engine: ENGINE_NAME,
      type: 'reference',
      subType: 'data-quality-suspect',
      message: 'Composite=0 anomaly with ' + history + 'Q history. Likely revenue-extraction ' +
               'fallback in kernel. Inspect inputPresence (revenue_quarters=' +
               (fh.inputPresence?.revenue_quarters ?? '?') + '). Do not act on signal until kernel ' +
               'team confirms extraction is sound.',
      evidence,
      estimatedValue: 'no-action',
      createdAt: ts,
      status: 'draft',
    });
  }

  return { signals, skipped: null };
}

function applySignals(co, newSignals) {
  // Replace this engine's same-day signals; preserve other engines' signals
  // and prior-day signals from this engine.
  const existing = Array.isArray(co.opportunitySignals) ? co.opportunitySignals : [];
  const dateStamp = isoDate();
  const filtered = existing.filter(s => {
    if (s.engine !== ENGINE_NAME) return true; // keep other engines
    // Drop same-engine signals from same day (idempotent re-run)
    return !(s.id && s.id.startsWith(co.slug + '-' + ENGINE_NAME + '-' + dateStamp));
  });
  return filtered.concat(newSignals);
}

function processOne(slug) {
  const file = path.join(COMPANIES_DIR, slug + '.json');
  const co = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { signals, skipped } = evaluatePortal(co);
  if (skipped) return { slug, signals: [], skipped };
  if (!signals.length) {
    if (!DRY_RUN) {
      // Even with no new signals, clear stale same-day signals of this engine
      co.opportunitySignals = applySignals(co, []);
      fs.writeFileSync(file, JSON.stringify(co, null, 2) + '\n');
    }
    return { slug, signals: [] };
  }
  if (!DRY_RUN) {
    co.opportunitySignals = applySignals(co, signals);
    fs.writeFileSync(file, JSON.stringify(co, null, 2) + '\n');
  }
  return { slug, signals };
}

function main() {
  const v2Slugs = SINGLE
    ? [SINGLE]
    : fs.readdirSync(COMPANIES_DIR)
        .filter(f => f.endsWith('.json'))
        .filter(f => {
          const j = JSON.parse(fs.readFileSync(path.join(COMPANIES_DIR, f), 'utf8'));
          return j.schemaVersion === '2.0.1' && j.functionalNetwork;
        })
        .map(f => f.replace('.json', ''));

  console.log('Investment engine ' + (DRY_RUN ? '[DRY-RUN] ' : '') + 'across ' + v2Slugs.length + ' portal(s)...\n');
  const results = v2Slugs.map(processOne);

  const fired = results.filter(r => r.signals.length > 0);
  const silent = results.filter(r => r.signals.length === 0 && !r.skipped);
  const skipped = results.filter(r => r.skipped);

  for (const r of results) {
    if (r.skipped) {
      console.log('  ⊘ ' + r.slug.padEnd(20) + ' SKIPPED — ' + r.skipped);
    } else if (r.signals.length === 0) {
      console.log('  · ' + r.slug.padEnd(20) + ' (no thesis)');
    } else {
      for (const s of r.signals) {
        console.log('  ✓ ' + r.slug.padEnd(20) + ' [' + s.subType.padEnd(28) + '] ' + s.estimatedValue);
      }
    }
  }

  console.log('\n──── INVESTMENT ENGINE SUMMARY ────');
  console.log('signals fired:    ' + fired.reduce((n, r) => n + r.signals.length, 0));
  console.log('portals with thesis: ' + fired.length);
  console.log('portals silent:   ' + silent.length);
  console.log('portals skipped:  ' + skipped.length);

  // Group by subType for an at-a-glance view
  const bySubType = {};
  for (const r of fired) for (const s of r.signals) {
    bySubType[s.subType] = (bySubType[s.subType] || 0) + 1;
  }
  console.log('by subType:');
  for (const [k, v] of Object.entries(bySubType).sort((a,b)=>b[1]-a[1])) {
    console.log('  ' + k.padEnd(28) + ' ' + v);
  }
}

main();
