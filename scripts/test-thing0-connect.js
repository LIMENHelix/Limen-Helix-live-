/**
 * test-thing0-connect.js — CI entry point for THING0-CONNECT-1.
 *
 * Pins the connection contract:
 *   - Thing 0 qualification comes only from scorer evidence;
 *   - legacy c.real.inEnvelope / command-board fields do not qualify a row;
 *   - the flat scorer qualifies before running Thing 1 and refuses without it;
 *   - sector-rule disagreements are exposed, not silently reconciled;
 *   - snapshots carry Thing 0 evidence for downstream consumers.
 *
 * RUN: node scripts/test-thing0-connect.js
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var { spawnSync } = require('child_process');

var ROOT = path.join(__dirname, '..');
var failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log('  pass: ' + name);
  } catch (e) {
    failures++;
    console.error('  FAIL: ' + name + ' — ' + (e && e.message));
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function functionBody(source, signature, nextMarker) {
  var start = source.indexOf(signature);
  assert.ok(start !== -1, signature + ' not found');
  var end = nextMarker ? source.indexOf(nextMarker, start) : source.length;
  assert.ok(end !== -1, nextMarker + ' not found');
  return source.slice(start, end);
}

console.log('thing0 connect');

var python = process.env.PYTHON || 'python';
var result = spawnSync(python, [path.join(__dirname, 'test_thing0_connect.py')], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: 300000
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
check('python Thing 0 connection suite passes', function () {
  assert.equal(result.status, 0,
    'python exited ' + result.status + (result.error ? ' (' + result.error.message + ')' : ''));
});

// ── Formula layer: legacy scores confer no qualification ──────────────────
var F = require('../lib/thing-formulas');

check('legacy c.real.inEnvelope no longer qualifies a row', function () {
  var verdict = F.thing0Eligible({
    t: 'LEGACY', hist: 20, vs: 'validated', sic: '1311',
    real: { inEnvelope: true, validated: true, composite: 0.8, alert: false }
  });
  assert.equal(verdict.eligible, false, JSON.stringify(verdict));
  assert.equal(verdict.reason, 'thing0-evidence-unavailable', JSON.stringify(verdict));
  assert.equal(verdict.legacy.thing1_snapshot_in_envelope, true, JSON.stringify(verdict));
});

check('scorer Thing 0 evidence qualifies only when it permits Thing 1', function () {
  var qualified = F.thing0Eligible({
    t: 'OK',
    thing0: { qualification_status: 'qualified', permits_thing1_use: true }
  });
  assert.equal(qualified.eligible, true, JSON.stringify(qualified));

  var partial = F.thing0Eligible({
    t: 'PART',
    thing0: { qualification_status: 'partially_qualified', permits_thing1_use: false }
  });
  assert.equal(partial.eligible, false, JSON.stringify(partial));
  assert.equal(partial.reason, 'partially_qualified', JSON.stringify(partial));
});

check('camelCase snapshot evidence is accepted', function () {
  var verdict = F.thing0Eligible({
    t: 'CAMEL',
    thing0Eligibility: { qualificationStatus: 'qualified', permitsThing1Use: true }
  });
  assert.equal(verdict.eligible, true, JSON.stringify(verdict));
});

check('Thing 1 calculation itself is unchanged', function () {
  var signal = F.thing1Distress({
    t: 'T1',
    real: { composite: 0.8, alert: true, inEnvelope: true, validated: true, firstAlertQuarter: '2024Q1' }
  }, { degenerate: false });
  assert.ok(signal, 'validated in-envelope Thing 1 signal disappeared');
  assert.equal(signal.validated, true, JSON.stringify(signal));
  assert.equal(signal.band, 'elevated', JSON.stringify(signal));
});

var formulas = read('lib/thing-formulas.js');
var t0Body = functionBody(formulas, 'function thing0Eligible', '// ── THING 1');
check('thing0Eligible has no legacy positive eligibility branch', function () {
  assert.ok(!/if\s*\(\s*c\.real\s*\)/.test(t0Body),
    'legacy c.real eligibility branch remains');
  assert.ok(t0Body.includes("permits && status === 'qualified'"),
    'positive path is not gated on scorer-qualified evidence');
  assert.ok(t0Body.includes('thing0-evidence-unavailable'),
    'missing no-evidence abstention');
});

// ── Brain signals: marshal evidence, gate before Thing 1 ───────────────────
var brain = read('handlers/brain-signals.js');
check('brain-signals marshals Thing 0 evidence', function () {
  assert.ok(brain.includes('thing0Evidence'), 'evidence counter missing');
  assert.ok(brain.includes('c.thing0 = _thing0Of(r)'), 'evidence is not attached to rows');
  assert.ok(brain.includes('_mergeThing0Evidence('), 'per-ticker merge missing');
  assert.ok(brain.includes('no company is qualified for Thing 1 or action authority'),
    'legacy-unqualified note missing');
});
check('brain-signals evaluates Thing 0 before Thing 1', function () {
  var t0 = brain.indexOf('F.thing0Eligible(c)');
  var t1 = brain.indexOf('F.thing1Distress(c');
  assert.ok(t0 !== -1 && t1 !== -1, 'pipeline calls not found');
  assert.ok(t0 < t1, 'Thing 1 is evaluated before Thing 0');
});

// ── Flat scorer: qualify before any Thing 1 computation ───────────────────
var flat = read('python_runtime/limen_app.py');
check('flat scorer computes Thing 0 before the kernel', function () {
  var t0 = flat.indexOf('_thing0.from_company_data(');
  var kernel = flat.indexOf('lbt.compute_all_features(');
  assert.ok(t0 !== -1, 'Thing 0 call missing');
  assert.ok(kernel !== -1, 'kernel call missing');
  assert.ok(t0 < kernel, 'kernel runs before Thing 0 qualification');
  assert.ok(flat.includes('not_permitted_by_thing0'), 'refusal status missing');
  assert.ok(flat.includes('SECTOR_RULE_FLAT_SCORER'), 'sector provenance missing');
});

// ── Report path: sector provenance, no formula change ─────────────────────
var report = read('python_runtime/helix_app/index.py');
var thing0Module = read('python_runtime/helix_app/thing0.py');
check('history uses the shared aligned-quarter intersection', function () {
  assert.ok(thing0Module.includes('set.intersection(*quarter_sets)'),
    'aligned-quarter intersection missing');
  assert.ok(report.includes('thing0_pkg.common_history_quarters(company_data)'),
    'report does not use the shared history helper');
  assert.ok(!report.includes('def _thing0_history_quarters('),
    'duplicate history helper remains in the report');
});
check('sectioned report records its sector rule and the disagreement', function () {
  assert.ok(report.includes('SECTOR_RULE_SECTIONED_REPORT'), 'sectioned rule id missing');
  assert.ok(report.includes('sector_provenance'), 'sector provenance missing');
  assert.ok(!report.includes('6000 <= sic <= 6999'),
    'inline sector comparison remains outside the named rule');
});

// ── Snapshots and dynamic scorer ───────────────────────────────────────────
var rescore = read('scripts/rescore-portals.mjs');
check('portal snapshot writer carries Thing 0 evidence', function () {
  assert.ok(rescore.includes('thing0Eligibility: r.thing0_eligibility'),
    'portal snapshot does not carry Thing 0');
  assert.ok(rescore.includes('thing0PermitsThing1'), 'permit flag missing');
});

var commandBoard = read('scripts/build-command-board.js');
check('command-board writer records actual validation and Thing 0', function () {
  assert.ok(!commandBoard.includes("vs: 'validated'"),
    'command-board still stamps validated unconditionally');
  assert.ok(commandBoard.includes('t0: t0'), 'Thing 0 evidence not written');
  assert.ok(commandBoard.includes('NOT_QUALIFIED_BY_THING0'), 'Thing 0 refusal label missing');
});

var scorer = read('lib/company-phase-scorer.js');
check('dynamic phase scorer stops on a Thing 0 refusal', function () {
  assert.ok(scorer.includes('not_permitted_by_thing0:'), 'refusal handling missing');
  assert.ok(scorer.includes('thing0_qualification_status'), 'qualification not persisted');
});

var commandBoardPage = read('assets/js/kernel-comparison.js');
check('Command Board derives Thing 0 only from snapshot evidence', function () {
  assert.ok(commandBoardPage.includes('d.t0 || d.thing0 || d.thing0Eligibility'),
    'Command Board does not read Thing 0 evidence');
  assert.ok(!commandBoardPage.includes("validation === 'validated' && history >= 8"),
    'Command Board still infers qualification from Thing 1 validation status');
});
check('Command Board requires effective Thing 1 validation before ALERT or NO_ALERT', function () {
  assert.ok(commandBoardPage.includes('function _thing1Validated('),
    'effective validation helper missing');
  assert.ok(commandBoardPage.includes("return 'ABSTAIN'"),
    'abstention result missing');
  assert.ok(commandBoardPage.includes("d.vs === 'validated'"),
    'validation status is not required');
  assert.ok(commandBoardPage.includes("d._thing1Result || 'ABSTAIN'"),
    'T1 badge still falls back to raw validation status');
  assert.ok(commandBoardPage.includes('function _thing0Permits('),
    'Thing 0 permit helper missing');
  assert.ok(commandBoardPage.includes("normalized === 'QUALIFIED' && _thing0Permits(d)"),
    'qualified label is trusted without permits_thing1_use');
  assert.ok(commandBoardPage.includes("d._thing0Status !== 'QUALIFIED' || !_thing0Permits(d)"),
    'T1 result does not re-check the Thing 0 permit');
  assert.ok(commandBoardPage.includes("if (d._thing0Status !== 'QUALIFIED') return 'NOT_QUALIFIED'"),
    'refused rows still classify as NOMINAL');
  assert.ok(commandBoardPage.includes("if (d._thing1Result === 'ABSTAIN') return 'ABSTAIN'"),
    'unvalidated rows can still classify as a scored signal');
  assert.ok(commandBoardPage.includes('NOT_QUALIFIED: 0, ABSTAIN: 0'),
    'refused rows can still carry severity');
});
check('Command Board rendering tolerates null composite scores', function () {
  assert.ok(!/d\.co\.toFixed/.test(commandBoardPage),
    'unguarded d.co.toFixed remains');
  assert.ok(commandBoardPage.includes("co === null ? '—'"),
    'table composite fallback missing');
  assert.ok(commandBoardPage.includes("detailCo === null ? '—'"),
    'detail composite fallback missing');
});

check('Command Board opens with unmigrated rows visible', function () {
  var page = read('kernel-comparison.html');
  assert.ok(page.includes('class="filter-btn active" data-filter="all"'),
    'default filter still hides unmigrated rows');
  assert.ok(commandBoardPage.includes("var _currentFilter = 'all'"),
    'default filter still starts at kernel');
  assert.ok(commandBoardPage.includes('counts.NOT_QUALIFIED'),
    'summary omits NOT_QUALIFIED count');
  assert.ok(commandBoardPage.includes('counts.ABSTAIN'),
    'summary omits ABSTAIN count');
  assert.ok(commandBoardPage.includes('dom.signals.NOT_QUALIFIED'),
    'per-domain cards omit NOT_QUALIFIED');
  assert.ok(commandBoardPage.includes('dom.signals.ABSTAIN'),
    'per-domain cards omit ABSTAIN');
});

check('Helix Report adapter carries Thing 0 and null-safe path scores', function () {
  var report = read('helix-report.html');
  assert.ok(report.includes('thing0_eligibility: t0'),
    'flat report adapter drops Thing 0');
  assert.ok(report.includes('_fmt3(t1.path_a_score)'),
    'path scores are not null-safe');
  assert.ok(!report.includes('t1.path_a_score.toFixed(3)'),
    'unguarded path score formatting remains');
  assert.ok(report.includes('Thing 0 permits Thing 1 use.'),
    'reconciliation text does not derive from Thing 0');
  assert.ok(report.includes('abstained: abstained'),
    'report packet does not carry the abstention state');
  assert.ok(report.includes("available: t0Permits && effectiveValidation === 'validated'"),
    'unvalidated results still report the scorer as available');
  assert.ok(report.includes('Thing 1 abstains:'),
    'report narrative still issues NO ALERT for a refusal');
  assert.ok(report.includes('gatedT1.abstained === true'),
    'report status line still issues NO ALERT for a refusal');
  assert.ok(report.includes("serverValidation === 'not_permitted_by_thing0' || serverValidation === 'unavailable'"),
    'client envelope can overwrite the server refusal status');
});

check('brain-signals merges Thing 0 evidence per ticker', function () {
  var emitter = require('../handlers/brain-signals');
  var merged = emitter._mergeThing0Evidence(
    { ticker: 'X', composite: 0.9, alert: false },
    { thing0: { qualification_status: 'qualified', permits_thing1_use: true } }
  );
  assert.equal(merged.composite, 0.9);
  assert.ok(merged.thing0 && merged.thing0.permits_thing1_use === true,
    'fallback Thing 0 evidence was not attached');
  var preferred = { ticker: 'X', thing0: { qualification_status: 'qualified' } };
  assert.strictEqual(
    emitter._mergeThing0Evidence(preferred, { thing0: { qualification_status: 'not_qualified' } }),
    preferred, 'preferred Thing 0 evidence was overwritten');
  var untouched = { ticker: 'Y', composite: 0.5 };
  emitter._mergeThing0Evidence(untouched, { thing0: { qualification_status: 'qualified' } });
  assert.equal(untouched.thing0, undefined, 'source snapshot was mutated');

  var errored = { ticker: 'GEV', error: 'http 502' };
  var fallbackScore = {
    ticker: 'GEV', composite: 0.8, validated: true, inEnvelope: true, alert: false,
    thing0: { qualification_status: 'qualified', permits_thing1_use: true }
  };
  assert.strictEqual(emitter._mergeThing0Evidence(errored, fallbackScore), fallbackScore,
    'errored preferred row was not replaced by the fallback');
  var loneError = emitter._mergeThing0Evidence(errored, null);
  assert.strictEqual(loneError, errored, 'errored preferred row was rewritten without a fallback');
  assert.equal(emitter._thing0Of(loneError), null, 'errored row was given Thing 0 evidence');
  var F = require('../lib/thing-formulas');
  assert.equal(F.thing0Eligible({ ticker: 'GEV', real: loneError }).eligible, false,
    'an errored row without a fallback qualified');
});

check('snapshot --resume retries incomplete qualification', function () {
  var script = read('scripts/build-command-board.js');
  assert.ok(script.includes('isResumeComplete(prior)'),
    'resume does not use the terminal-success predicate');
  assert.ok(script.includes('rescoredLegacy'),
    'legacy rescores are not counted');
  var board = require('../scripts/build-command-board');
  assert.equal(board.isResumeComplete({
    t0: { qualification_status: 'qualified', permits_thing1_use: true },
    vs: 'validated', kid: 'limen_backtest.py'
  }), true, 'qualified and validated should resume');
  assert.equal(board.isResumeComplete({
    t0: { qualification_status: 'qualified', permits_thing1_use: true },
    vs: 'unvalidated_after_modification', kid: 'limen_backtest.py'
  }), false, 'qualified but unvalidated must be retried');
  assert.equal(board.isResumeComplete({
    t0: { qualification_status: 'partially_qualified', permits_thing1_use: false },
    vs: 'validated', kid: 'limen_backtest.py'
  }), false, 'transient partial qualification must be retried');
  assert.equal(board.isResumeComplete({
    t0: { qualification_status: 'not_qualified', permits_thing1_use: false },
    vs: 'not_permitted_by_thing0', kid: 'limen_backtest.py'
  }), false, 'refused qualification must be retried');
  assert.equal(board.isResumeComplete({}), false, 'missing evidence must be retried');
  assert.equal(board.numOrNull(null), null);
  assert.equal(board.numOrNull(0), 0);
  assert.equal(board.numOrNull(1.2), 1.2);
  assert.equal(board.numOrNull('0'), null, 'strings must not become numbers');
  assert.ok(script.includes('pa: numOrNull(d.path_a_score)'),
    'path scores still convert null to zero');
});
check('snapshot writing preserves refused trajectories', function () {
  var script = read('scripts/build-command-board.js');
  assert.ok(/d\.trajectory === 'NOT_RUN' \|\| d\.trajectory === 'UNVALIDATED'/.test(script),
    'refused trajectory can still be derived as STABLE');
});

check('phase scorer invalidates cached phases on Thing 0 refusal', function () {
  var scorer = read('lib/company-phase-scorer.js');
  assert.ok(scorer.includes("await db.del('company_phase_' + company.cik)"),
    'cache invalidation missing');
  assert.ok(scorer.includes('invalidated: invalidated'),
    'invalidation result missing');
});

check('investment engine quarantines on a Thing 1 refusal', function () {
  var engine = require('../scripts/run-investment-engine');
  var co = {
    slug: 'fixture', kernelStatus: 'ELIGIBLE_NOW',
    financialHealth: {
      compositeScore: 1.6, alert: true,
      validationStatus: 'not_permitted_by_thing0',
      thing1Validation: { status: 'not_permitted_by_thing0', available: false }
    },
    opportunitySignals: [
      { engine: 'investment', id: 'inv-1' },
      { engine: 'other', id: 'other-1' }
    ]
  };
  var evaluated = engine.evaluatePortal(co);
  assert.equal(evaluated.quarantine, true, JSON.stringify(evaluated));
  assert.equal(evaluated.signals.length, 0);
  assert.ok(/thing1_not_validated/.test(evaluated.skipped), evaluated.skipped);
  assert.equal(engine.quarantineInvestmentSignals(co, 'thing1_not_validated', '2026-01-01T00:00:00.000Z'), 1);
  assert.equal(co.opportunitySignals.length, 1);
  assert.equal(co.opportunitySignals[0].engine, 'other');
  assert.equal(co.quarantinedOpportunitySignals.length, 1);
  assert.equal(co.quarantinedOpportunitySignals[0].quarantined, true);
  assert.equal(engine.quarantineInvestmentSignals(co, 'thing1_not_validated', '2026-01-01T00:00:00.000Z'), 0);
  assert.equal(co.quarantinedOpportunitySignals.length, 1, 'quarantine archive was duplicated');
});

check('kernel-status refusals also quarantine stale investment signals', function () {
  var engine = require('../scripts/run-investment-engine');
  ['ERROR', 'PRIVATE', 'INSUFFICIENT_HISTORY'].forEach(function (status) {
    var co = {
      slug: 'fixture-' + status, kernelStatus: status,
      financialHealth: status === 'INSUFFICIENT_HISTORY' ? {} : { compositeScore: 1.6, alert: true },
      opportunitySignals: [
        { engine: 'investment', id: 'inv-' + status },
        { engine: 'other', id: 'other-' + status }
      ]
    };
    var evaluated = engine.evaluatePortal(co);
    assert.equal(evaluated.quarantine, true, status + ': ' + JSON.stringify(evaluated));
    assert.equal(evaluated.signals.length, 0, status);
    assert.equal(
      engine.quarantineInvestmentSignals(co, evaluated.skipped, '2026-01-01T00:00:00.000Z'),
      1, status + ': stale signal was not quarantined');
    assert.equal(co.opportunitySignals.length, 1, status);
    assert.equal(co.opportunitySignals[0].engine, 'other', status);
    assert.equal(co.quarantinedOpportunitySignals.length, 1, status);
    assert.equal(co.quarantinedOpportunitySignals[0].quarantined, true, status);
  });
});

check('investment engine quarantines when Thing 1 is not validated', function () {
  var engine = require('../scripts/run-investment-engine');
  var co = {
    slug: 'fixture', kernelStatus: 'ELIGIBLE_NOW',
    financialHealth: {
      compositeScore: 1.6, alert: true,
      validationStatus: 'unvalidated_after_modification',
      thing1Validation: { status: 'unvalidated_after_modification', available: false }
    },
    opportunitySignals: [{ engine: 'investment', id: 'inv-1' }]
  };
  var evaluated = engine.evaluatePortal(co);
  assert.equal(evaluated.quarantine, true, JSON.stringify(evaluated));
  assert.equal(evaluated.signals.length, 0);
  assert.ok(/thing1_not_validated/.test(evaluated.skipped), evaluated.skipped);
  assert.equal(engine.quarantineInvestmentSignals(co, evaluated.skipped, '2026-01-01T00:00:00.000Z'), 1);
  assert.equal(co.opportunitySignals.length, 0);

  var legacy = {
    slug: 'fixture-legacy', kernelStatus: 'ELIGIBLE_NOW',
    financialHealth: { compositeScore: 1.6, alert: true, validationStatus: 'validated' },
    opportunitySignals: [{ engine: 'investment', id: 'legacy-signal' }]
  };
  var evLegacy = engine.evaluatePortal(legacy);
  assert.equal(evLegacy.quarantine, true, JSON.stringify(evLegacy));
  assert.ok(/thing1_not_validated:no_provenance/.test(evLegacy.skipped), evLegacy.skipped);
  assert.equal(engine.quarantineInvestmentSignals(legacy, evLegacy.skipped, '2026-01-01T00:00:00.000Z'), 1);
  assert.equal(legacy.opportunitySignals.length, 0);

  var validated = {
    slug: 'fixture-valid', kernelStatus: 'ELIGIBLE_NOW',
    financialHealth: {
      compositeScore: 1.6, alert: true, validationStatus: 'validated',
      thing1Validation: { status: 'validated', available: true }
    },
    opportunitySignals: []
  };
  var ok = engine.evaluatePortal(validated);
  assert.equal(ok.quarantine, undefined);
  assert.ok(ok.signals.length > 0, 'validated signal did not fire');

  var engineSource = read('scripts/run-investment-engine.js');
  assert.ok(!/thing0Eligibility|thing0PermitsThing1|permits_thing1_use|thing0Qualification/.test(engineSource),
    'investment engine still uses Thing 0 as an investment criterion');
  assert.ok(engineSource.includes('thing1Validation'),
    'investment engine does not consume Thing 1 provenance');
  assert.ok(!engineSource.includes('fh.envelopeStatus'),
    'investment engine still reads stale envelopeStatus');
  assert.ok(engineSource.includes('fh.inEnvelope'),
    'investment engine does not read inEnvelope');

  var rescoreSource = read('scripts/rescore-portals.mjs');
  var applyBody = rescoreSource.slice(rescoreSource.indexOf('export function applyFinancialRefresh'));
  assert.ok(!applyBody.includes('thing0PermitsThing1'),
    'portal refresh still gates on Thing 0');
  assert.ok(applyBody.includes('thing1Validation'),
    'portal refresh does not gate on Thing 1 provenance');
  assert.ok(applyBody.includes('portal.financialHealth = { ...preserved, ...financialHealth }'),
    'portal refresh does not replace the kernel verdict subset');
  assert.ok(rescoreSource.includes('KERNEL_VERDICT_FIELDS'),
    'refresh does not define the kernel verdict field set');
  assert.ok(rescoreSource.includes('pathA: r.path_a_score'),
    'refresh does not map pathA from the current response');
  assert.ok(rescoreSource.includes('pathAThreshold: r.path_a_threshold'),
    'refresh does not map pathAThreshold from the current response');
});

check('legacy phase cache entries are not counted as scored', function () {
  var scorer = require('../lib/company-phase-scorer');
  assert.equal(scorer._cacheProvenanceValid({
    validation_status: 'validated', thing0_qualification_status: 'qualified', timestamp: 1
  }), true);
  assert.equal(scorer._cacheProvenanceValid({
    validation_status: 'unvalidated_after_modification', thing0_qualification_status: 'qualified'
  }), false);
  assert.equal(scorer._cacheProvenanceValid({ validation_status: 'validated' }), false);
  assert.equal(scorer._cacheProvenanceValid({ timestamp: 1, phase: 'p4' }), false);
  var source = read('lib/company-phase-scorer.js');
  assert.ok(source.includes('_cacheProvenanceValid(cached)'),
    'cache reads do not check validation provenance');
});

check('brain-signals counts only validated Thing 1 rows as scanned', function () {
  var emitter = require('../handlers/brain-signals');
  assert.equal(emitter._thing1ValidatedRow({ validated: true, inEnvelope: true }), true);
  assert.equal(emitter._thing1ValidatedRow({ validation_status: 'validated', inEnvelope: true }), true);
  assert.equal(emitter._thing1ValidatedRow({ validated: false, inEnvelope: true }), false);
  assert.equal(emitter._thing1ValidatedRow({ validated: true, inEnvelope: false }), false);
  assert.equal(emitter._thing1ValidatedRow({ error: 'http 502', validated: true, inEnvelope: true }), false);
});

check('eligibility probe honors a Thing 0 refusal', function () {
  var probe = require('../scripts/probe-eligibility');
  var refused = probe.deriveStatus({
    history_quarters: 8,
    latest_quarter: '2026Q3',
    input_presence: { dc_coverage_quarters: 8, dl_coverage_quarters: 8 },
    thing0_eligibility: {
      permits_thing1_use: false,
      qualification_status: 'partially_qualified',
      reasons: ['sector_lookup_unavailable']
    }
  });
  assert.equal(refused.status, 'NOT_QUALIFIED_BY_THING0', JSON.stringify(refused));
  assert.ok(refused.reasons.indexOf('sector_lookup_unavailable') !== -1, JSON.stringify(refused));

  var noPermit = probe.deriveStatus({
    history_quarters: 8,
    latest_quarter: '2026Q3',
    input_presence: { dc_coverage_quarters: 8, dl_coverage_quarters: 8 },
    thing0_eligibility: { permits_thing1_use: false, qualification_status: 'qualified' }
  });
  assert.equal(noPermit.status, 'NOT_QUALIFIED_BY_THING0', JSON.stringify(noPermit));
  assert.ok(noPermit.reasons.indexOf('thing0_permission_missing') !== -1, JSON.stringify(noPermit));

  var legacy = probe.deriveStatus({
    history_quarters: 8,
    latest_quarter: '2026Q3',
    input_presence: { dc_coverage_quarters: 8, dl_coverage_quarters: 8 }
  });
  assert.equal(legacy.status, 'THING0_EVIDENCE_UNAVAILABLE', JSON.stringify(legacy));

  var eligible = probe.deriveStatus({
    history_quarters: 8,
    latest_quarter: '2026Q3',
    input_presence: { dc_coverage_quarters: 8, dl_coverage_quarters: 8 },
    thing0_eligibility: { permits_thing1_use: true, qualification_status: 'qualified' }
  });
  assert.equal(eligible.status, 'ELIGIBLE_NOW', JSON.stringify(eligible));
});

// ── Handler contract against the current static snapshots ──────────────────
async function handlerCheck() {
  var handler = require('../handlers/brain-signals');
  var payload = null;
  await handler(
    { url: '/api/brain-signals?domain=energy' },
    { setHeader: function () {}, end: function (s) { payload = JSON.parse(s); } }
  );
  assert.ok(payload, 'handler did not respond');
  if (!payload.tracked) {
    console.log('  SKIP: handler integration (command-board data unavailable)');
    return;
  }

  /* The checked-in Command Board now carries scorer-produced Thing 0 evidence.
     The handler must detect it even though the energy distress snapshot does
     not carry it, and the merge must remain per ticker. */
  var eligible = require('../assets/data/command-board-eligible.json');
  var energyWithThing0 = (eligible.companies || []).filter(function (c) {
    return c && String(c.d).toLowerCase() === 'energy'
      && (c.t0 || c.thing0 || c.thing0Eligibility);
  });
  assert.ok(energyWithThing0.length > 0,
    'current Command Board energy snapshot carries no Thing 0 evidence');
  assert.ok(payload.thing0Evidence > 0, JSON.stringify(payload));
  assert.ok(payload.thing0Evidence <= energyWithThing0.length,
    'handler reported more Thing 0 evidence than the Command Board source');

  /* The merge is per ticker and returns a copy. It must not mutate either
     source row or promote Thing 1 validation. */
  var preferred = { validated: false, inEnvelope: false, composite: 1 };
  var fallback = { thing0: { qualification_status: 'qualified', permits_thing1_use: true } };
  var preferredBefore = JSON.stringify(preferred);
  var fallbackBefore = JSON.stringify(fallback);
  var merged = handler._mergeThing0Evidence(preferred, fallback);
  assert.equal(merged.thing0.qualification_status, 'qualified');
  assert.equal(merged.validated, false, 'Thing 0 evidence promoted Thing 1 validation');
  assert.equal(JSON.stringify(preferred), preferredBefore, 'preferred source row was mutated');
  assert.equal(JSON.stringify(fallback), fallbackBefore, 'fallback source row was mutated');
  assert.equal(handler._thing1ValidatedRow(merged), false,
    'Thing 0 evidence alone made Thing 1 validated');

  /* The board classifies a qualified but unvalidated row as ABSTAIN, never
     ALERT or NO_ALERT. */
  var vm = require('vm');
  var boardSource = read('assets/js/kernel-comparison.js');
  var boardStart = boardSource.indexOf('function _thing0Permits');
  var boardEnd = boardSource.indexOf('function _initBoard');
  assert.ok(boardStart !== -1 && boardEnd > boardStart,
    'board classification functions not found');
  var sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(boardSource.slice(boardStart, boardEnd) +
    '\nthis._thing1Result = _thing1Result;', sandbox);
  var boardBase = {
    _thing0Status: 'QUALIFIED',
    t0: { permits_thing1_use: true },
    kid: 'limen_backtest.py',
    a: false
  };
  assert.equal(sandbox._thing1Result(Object.assign({}, boardBase, {
    vs: 'unvalidated_after_modification'
  })), 'ABSTAIN', 'unvalidated row did not abstain');
  assert.equal(sandbox._thing1Result(Object.assign({}, boardBase, {
    vs: 'unavailable'
  })), 'ABSTAIN', 'unavailable row did not abstain');
  assert.equal(sandbox._thing1Result(Object.assign({}, boardBase, {
    vs: 'validated'
  })), 'NO_ALERT', 'validated no-alert row did not classify as NO_ALERT');
  assert.equal(sandbox._thing1Result(Object.assign({}, boardBase, {
    vs: 'validated', a: true
  })), 'ALERT', 'validated alert row did not classify as ALERT');
  assert.equal(sandbox._thing1Result(Object.assign({}, boardBase, {
    _thing0Status: 'NOT_QUALIFIED', vs: 'validated'
  })), null, 'Thing 0 refusal did not suppress the Thing 1 result');

  /* Retain the missing-evidence fail-closed path with isolated in-memory
     fixtures. The checked-in snapshot now has evidence; this coverage must not
     disappear with it. */
  var Module = require('module');
  var originalLoad = Module._load;
  var handlerPath = require.resolve('../handlers/brain-signals');
  delete require.cache[handlerPath];
  try {
    Module._load = function (request, parent, isMain) {
      if (request === '../assets/data/command-board-data.json') {
        return { companies: [{ n: 'Fixture Co', t: 'FIX', d: 'energy', ds: 0.5 }] };
      }
      if (request === '../assets/data/energy-distress-scores.json') return { scores: [] };
      if (request === '../assets/data/command-board-eligible.json') return { companies: [] };
      return originalLoad.apply(this, arguments);
    };
    var fixtureHandler = require('../handlers/brain-signals');
    var fixturePayload = null;
    await fixtureHandler(
      { url: '/api/brain-signals?domain=energy' },
      { setHeader: function () {}, end: function (s) { fixturePayload = JSON.parse(s); } }
    );
    assert.ok(fixturePayload, 'fixture handler did not respond');
    assert.equal(fixturePayload.thing0Evidence, 0, JSON.stringify(fixturePayload));
    assert.equal(fixturePayload.eligible, 0, JSON.stringify(fixturePayload));
    assert.equal(fixturePayload.publishable.length, 0, JSON.stringify(fixturePayload));
    assert.ok(/Thing 0 qualification evidence is unavailable/.test(fixturePayload.note),
      fixturePayload.note);
  } finally {
    Module._load = originalLoad;
    delete require.cache[handlerPath];
  }
}

async function phaseCacheCheck() {
  var db = require('../lib/limen-db');
  var scorer = require('../lib/company-phase-scorer');
  var origGet = db.get, origDel = db.del, origFetch = global.fetch;
  var deleted = [];
  db.get = async function () { return { phase: 'p4', timestamp: 1 }; };
  db.del = async function (k) { deleted.push(k); };

  function ok(payload) {
    return { ok: true, status: 200, json: async function () { return payload; } };
  }
  async function run(response) {
    deleted.length = 0;
    global.fetch = async function () { return response; };
    return scorer._scoreOne({ cik: '123', ticker: 'T', domain: 'energy' });
  }

  try {
    var r = await run(ok({
      thing0_eligibility: { permits_thing1_use: false, qualification_status: 'not_qualified' }
    }));
    assert.equal(r.scored, false, JSON.stringify(r));
    assert.equal(r.invalidated, true, JSON.stringify(r));
    assert.deepEqual(deleted, ['company_phase_123']);

    /* A successful-looking phase without Thing 0 evidence must not be cached. */
    var missing = await run(ok({ dominant_phase: 'p4' }));
    assert.equal(missing.scored, false, JSON.stringify(missing));
    assert.equal(missing.invalidated, true, JSON.stringify(missing));
    assert.equal(missing.error, 'thing0_evidence_unavailable', JSON.stringify(missing));
    assert.deepEqual(deleted, ['company_phase_123']);

    /* A truthy status object plus a stray permit is not qualification. */
    var statusObject = await run(ok({
      thing0_eligibility: { qualification_status: { bogus: true }, permits_thing1_use: true },
      dominant_phase: 'p4'
    }));
    assert.equal(statusObject.scored, false, JSON.stringify(statusObject));
    assert.equal(statusObject.error, 'thing0_status_invalid', JSON.stringify(statusObject));
    assert.equal(statusObject.invalidated, true, JSON.stringify(statusObject));

    /* not_qualified with a stray permit must not cache. */
    var notQualified = await run(ok({
      thing0_eligibility: { qualification_status: 'not_qualified', permits_thing1_use: true },
      dominant_phase: 'p4'
    }));
    assert.equal(notQualified.scored, false, JSON.stringify(notQualified));
    assert.equal(notQualified.error, 'not_permitted_by_thing0:not_qualified', JSON.stringify(notQualified));
    assert.equal(notQualified.invalidated, true, JSON.stringify(notQualified));

    /* qualified without explicit permission must not cache. */
    var noPermit = await run(ok({
      thing0_eligibility: { qualification_status: 'qualified', permits_thing1_use: false },
      dominant_phase: 'p4'
    }));
    assert.equal(noPermit.scored, false, JSON.stringify(noPermit));
    assert.equal(noPermit.error, 'thing0_permission_missing', JSON.stringify(noPermit));
    assert.equal(noPermit.invalidated, true, JSON.stringify(noPermit));

    /* Thing 0 permits, but Thing 1 is not validated: do not cache. */
    var unvalidatedPhase = await run(ok({
      thing0_eligibility: { qualification_status: 'qualified', permits_thing1_use: true },
      validation_status: 'unvalidated_after_modification',
      dominant_phase: 'p4'
    }));
    assert.equal(unvalidatedPhase.scored, false, JSON.stringify(unvalidatedPhase));
    assert.equal(unvalidatedPhase.error,
      'thing1_not_validated:unvalidated_after_modification', JSON.stringify(unvalidatedPhase));
    assert.equal(unvalidatedPhase.invalidated, true, JSON.stringify(unvalidatedPhase));
    assert.deepEqual(deleted, ['company_phase_123']);

    /* Valid qualified + explicit permission + validated Thing 1 still caches. */
    var valid = await run(ok({
      thing0_eligibility: { qualification_status: 'qualified', permits_thing1_use: true },
      validation_status: 'validated',
      dominant_phase: 'p4',
      trajectory: 'STABLE'
    }));
    assert.equal(valid.scored, true, JSON.stringify(valid));
    assert.equal(valid.phase, 'p4', JSON.stringify(valid));
    assert.equal(deleted.length, 0, 'valid result invalidated the cache');

    /* A scorer outage preserves the cached phase; it is not a refusal. */
    var httpFail = await run({
      ok: false, status: 503,
      json: async function () { return { detail: 'fred-not-configured' }; }
    });
    assert.equal(httpFail.scored, false, JSON.stringify(httpFail));
    assert.equal(httpFail.invalidated, false, JSON.stringify(httpFail));
    assert.equal(httpFail.error, 'scorer_http_503', JSON.stringify(httpFail));
    assert.equal(deleted.length, 0, 'HTTP failure invalidated the cache');
  } finally {
    db.get = origGet;
    db.del = origDel;
    global.fetch = origFetch;
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    console.log('  pass: ' + name);
  } catch (e) {
    failures++;
    console.error('  FAIL: ' + name + ' — ' + (e && e.message));
  }
}

(async function () {
  await checkAsync('phase scorer actually deletes a refused cached phase', phaseCacheCheck);
  await checkAsync('handler contract against current static snapshots', handlerCheck);
  console.log('');
  if (failures) {
    console.error(failures + ' failure(s)');
    process.exit(1);
  }
  console.log('thing0 connect: all checks passed');
})();
