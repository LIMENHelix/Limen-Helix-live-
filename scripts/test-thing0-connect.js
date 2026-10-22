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
var os = require('os');
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

check('real scorer selection is authoritative over legacy fields', function () {
  var F = require('../lib/thing-formulas');
  var legacy = { ds: 0.91, vs: 'validated', a: true, q: '2026Q2' };

  assert.equal(F.thing1Distress(Object.assign({}, legacy, {
    real: { composite: null, validated: false }
  }), { degenerate: false }), null, 'null-composite real record borrowed legacy fields');

  assert.equal(F.thing1Distress(Object.assign({}, legacy, { real: null }),
    { degenerate: false }), null, 'real:null borrowed legacy fields');

  var explicitUndefined = Object.assign({}, legacy);
  explicitUndefined.real = undefined;
  assert.equal(F.thing1Distress(explicitUndefined, { degenerate: false }), null,
    'real:undefined borrowed legacy fields');

  assert.equal(F.thing1Distress(Object.assign({}, legacy, {
    real: { composite: '0.8', validated: true, inEnvelope: true }
  }), { degenerate: false }), null, 'non-numeric real composite published');

  assert.equal(F.thing1Distress(Object.assign({}, legacy, {
    real: { composite: 0.8, validated: false, inEnvelope: true }
  }), { degenerate: false }), null, 'unvalidated real record published');

  assert.equal(F.thing1Distress(Object.assign({}, legacy, {
    real: { composite: 0.8, validated: true, inEnvelope: false }
  }), { degenerate: false }), null, 'out-of-envelope real record published');

  assert.equal(F.thing1Distress(Object.assign({}, legacy, {
    real: { composite: 0.8, validated: true, inEnvelope: true, error: 'http 502' }
  }), { degenerate: false }), null, 'errored real record published');

  var coherent = F.thing1Distress({
    real: { composite: 0.8, validated: true, inEnvelope: true, alert: false, error: null, isFinancial: false }
  }, { degenerate: false });
  assert.ok(coherent && coherent.validated === true && coherent.score === 0.8,
    'coherent real control did not publish');

  var legacyOnly = F.thing1Distress(legacy, { degenerate: false });
  assert.ok(legacyOnly && legacyOnly.score === 0.91 && legacyOnly.alert === true,
    'validated legacy fallback without a real property was lost');
});

check('ordinary score-companies path persists scorer Thing Zero evidence', function () {
  var producer = require('../scripts/score-companies');
  var build = producer.buildOrdinaryRow;
  var co = { name: 'New Co', ticker: 'NEW', cik: '123', slug: 'new_co' };
  var context = {
    canon: { domain: 'energy', subTag: null }, ds: 0.77,
    portal: { slug: 'new_co', cik: '0000000123', ticker: 'NEW' }
  };

  var qualified = build(co, {
    thing0_eligibility: { qualification_status: 'qualified', permits_thing1_use: true },
    validation_status: 'validated',
    composite_score: 0.72,
    alert: false,
    path_a_score: null,
    path_b_score: 0.1,
    path_c_score: null,
    kernel_id: 'limen_backtest.py'
  }, context);
  assert.deepEqual(qualified.t0,
    { qualification_status: 'qualified', permits_thing1_use: true },
    'qualified Thing Zero evidence was not persisted exactly');
  assert.equal(qualified.vs, 'validated');
  assert.equal(qualified.es, 'ELIGIBLE_NOW');
  assert.equal(qualified.co, 0.72);
  assert.equal(qualified.pa, null, 'null path score was converted');
  assert.equal(qualified.pb, 0.1);
  assert.equal(qualified.pc, null, 'null path score was converted');
  assert.equal(qualified.thing0_source, 'live_scorer');
  assert.equal(qualified.thing0_validation_status, 'validated');
  assert.equal(qualified.s, 'new_co', 'coherent Board route was dropped');

  var incoherent = build(Object.assign({}, co, { cik: '999' }), {
    thing0_eligibility: { qualification_status: 'qualified', permits_thing1_use: true },
    validation_status: 'validated',
    composite_score: 0.72,
    alert: false,
    path_a_score: null,
    path_b_score: 0.1,
    path_c_score: null,
    kernel_id: 'limen_backtest.py'
  }, context);
  assert.equal(incoherent.s, null, 'incoherent Board route survived the producer');

  var partial = build(co, {
    thing0_eligibility: { qualification_status: 'partially_qualified', permits_thing1_use: false },
    validation_status: 'not_permitted_by_thing0',
    composite_score: null
  }, context);
  assert.equal(partial.t0.qualification_status, 'partially_qualified');
  assert.equal(partial.t0.permits_thing1_use, false);
  assert.equal(partial.es, 'NOT_QUALIFIED_BY_THING0');
  assert.equal(partial.co, null, 'null composite was converted');

  var refused = build(co, {
    thing0_eligibility: { qualification_status: 'not_qualified', permits_thing1_use: false },
    validation_status: 'not_permitted_by_thing0'
  }, context);
  assert.equal(refused.t0.qualification_status, 'not_qualified');
  assert.equal(refused.t0.permits_thing1_use, false);
  assert.equal(refused.es, 'NOT_QUALIFIED_BY_THING0');

  var missing = build(co, { validation_status: 'unvalidated_after_modification' }, context);
  assert.equal(missing.t0, null, 'missing Thing Zero evidence was synthesized');
  assert.equal(missing.es, 'NOT_QUALIFIED_BY_THING0');
  assert.equal(missing.vs, 'unvalidated_after_modification');

  var malformed = build(co, {
    thing0_eligibility: 'qualified',
    validation_status: 'validated'
  }, context);
  assert.equal(malformed.t0, 'qualified', 'malformed evidence was not preserved exactly');
  assert.equal(malformed.es, 'NOT_QUALIFIED_BY_THING0');
  assert.notEqual(typeof malformed.t0, 'object');

  var source = read('scripts/score-companies.js');
  assert.ok(source.includes('buildOrdinaryRow(co, d'),
    'ordinary path does not use the Thing Zero row builder');
  var resume = source.slice(source.indexOf('if (existing[existingKey]'),
    source.indexOf('// Metadata repair'));
  assert.ok(resume.includes('results.push(ex)'),
    'resume path does not preserve the existing row');
  assert.ok(!/delete\s+ex\.t0/.test(resume),
    'resume path deletes Thing Zero evidence');
  var ordinary = source.slice(source.indexOf('const d = await postScore(co.cik);'),
    source.indexOf('if ((scored + errors) % 10'));
  var catchBlock = ordinary.slice(ordinary.indexOf('} catch (e) {'));
  assert.ok(catchBlock.includes("vs: 'error'"),
    'scorer failure did not produce an explicit error row');
  assert.ok(!catchBlock.includes('buildOrdinaryRow'),
    'scorer failure wrote a successful row');
  assert.ok(source.includes('async function refreshThing0Rows'),
    'refresh mode removed');
});

check('command-board resume reconciles against current eligible frontier', function () {
  var board = require('../scripts/build-command-board');
  var frontier = {
    _universe_total: 3,
    _processed_total: 3,
    companies: [
      { cik: '1', ticker: 'ONE', name: 'One', envelope_status: 'ELIGIBLE_NOW' },
      { cik: '2', ticker: 'TWO', name: 'Two', envelope_status: 'STALE' },
      { cik: '3', ticker: 'THREE', name: 'Three', envelope_status: 'ELIGIBLE_NOW' }
    ]
  };
  var prior = [
    { c: '1', t: 'ONE', n: 'One', t0: { qualification_status: 'qualified', permits_thing1_use: true }, vs: 'validated', kid: 'limen_backtest.py' },
    { c: '2', t: 'TWO', n: 'Two', t0: { qualification_status: 'qualified', permits_thing1_use: true }, vs: 'validated', kid: 'limen_backtest.py' },
    { c: '3', t: 'THREE', n: 'Three' }
  ];
  var plan = board.planCommandBoard(frontier, prior, { batch: 1, thing0Migration: true });
  assert.equal(plan.removedCount, 1, 'stale prior row was not removed');
  assert.deepEqual(plan.removed, ['2']);
  assert.deepEqual(plan.order, ['1', '3'],
    'still-eligible rows outside the batch were not preserved');
  assert.equal(plan.queue.length, 1, 'small batch did not limit scorer work');
  assert.equal(plan.queue[0].cik, '3', 'newly incomplete eligible row was not queued');
  assert.equal(plan.resumed, 1, 'completed eligible row was not counted as resumed');
  assert.strictEqual(plan.existing['1'], prior[0],
    'completed eligible row was not preserved by identity');
  assert.equal(plan.existing['1'].t0.qualification_status, 'qualified');

  assert.throws(function () {
    board.planCommandBoard({
      _universe_total: 2, _processed_total: 2,
      companies: [
        { cik: '1', envelope_status: 'ELIGIBLE_NOW' },
        { cik: '1', envelope_status: 'STALE' }
      ]
    }, [], {});
  }, /duplicate frontier CIK/, 'duplicate frontier CIK was accepted');

  assert.throws(function () {
    board.planCommandBoard({ _universe_total: 2, _processed_total: 1, companies: [] }, [], {});
  }, /incomplete/, 'incomplete frontier was accepted');

  assert.throws(function () {
    board.planCommandBoard({ companies: [] }, [], {});
  }, /completeness metadata/, 'missing completeness metadata was accepted');

  assert.throws(function () {
    board.planCommandBoard(null, [], {});
  }, /missing or malformed/, 'missing frontier was accepted');

  assert.throws(function () {
    board.planCommandBoard({
      _universe_total: 1, _processed_total: 1,
      companies: [{ envelope_status: 'ELIGIBLE_NOW' }]
    }, [], {});
  }, /missing CIK/, 'frontier row without CIK was accepted');
});

// ── Brain signals: marshal evidence, gate before Thing 1 ───────────────────
var brain = read('handlers/brain-signals.js');
check('brain-signals marshals Thing 0 evidence', function () {
  assert.ok(brain.includes('thing0Evidence'), 'evidence counter missing');
  assert.ok(brain.includes('row.thing0 = _thing0Of(r)'), 'evidence is not attached to rows');
  assert.ok(brain.includes('_mergeThing0Evidence('), 'per-issuer selection missing');
  assert.ok(brain.includes('_normCik('), 'CIK identity normalization missing');
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
  assert.ok(report.includes("available: t0Authorized && effectiveValidation === 'validated'"),
    'unvalidated or non-permitting results still report the scorer as available');
  assert.ok(report.includes('var abstained = !(t0Authorized && effectiveValidation'),
    'abstention is not gated on the Thing 0 authorization chain');
  assert.ok(report.includes('Thing 1 abstains:'),
    'report narrative still issues NO ALERT for a refusal');
  assert.ok(report.includes('gatedT1.abstained === true'),
    'report status line still issues NO ALERT for a refusal');
  assert.ok(report.includes("serverValidation === 'not_permitted_by_thing0' || serverValidation === 'unavailable'"),
    'client envelope can overwrite the server refusal status');
});

check('brain-signals selects coherent Thing 0 rows per issuer', function () {
  var emitter = require('../handlers/brain-signals');
  var preferred = { ticker: 'X', cik: '1001', composite: 0.9, alert: false, validated: true, inEnvelope: true };
  var fallback = {
    ticker: 'X', cik: '1001', composite: null, alert: false, validated: false, inEnvelope: false,
    thing0: { qualification_status: 'qualified', permits_thing1_use: true }
  };
  var selected = emitter._mergeThing0Evidence(preferred, fallback);
  assert.strictEqual(selected, fallback,
    'preferred Thing 1 fields were combined with fallback Thing 0 evidence');
  assert.equal(selected.composite, null, 'old preferred score survived beside current evidence');
  assert.equal(selected.validated, false, 'fallback validation state was not preserved');

  var preferredOwn = {
    ticker: 'X', cik: '1001', composite: 0.4, validated: true, inEnvelope: true,
    thing0: { qualification_status: 'qualified', permits_thing1_use: true }
  };
  assert.strictEqual(
    emitter._mergeThing0Evidence(preferredOwn, fallback), preferredOwn,
    'preferred response with its own Thing 0 was not used wholesale');

  var diagnostic = { ticker: 'Y', cik: '1002', composite: 0.5 };
  assert.strictEqual(emitter._mergeThing0Evidence(diagnostic, { ticker: 'Y', cik: '1002' }), diagnostic,
    'no-evidence row did not remain the diagnostic source');
  assert.equal(emitter._thing0Of(diagnostic), null, 'diagnostic row acquired Thing 0 evidence');

  var untouchedPreferred = { ticker: 'Z', cik: '1003', composite: 0.7 };
  var untouchedFallback = { ticker: 'Z', cik: '1003', thing0: { qualification_status: 'qualified' } };
  var preferredBefore = JSON.stringify(untouchedPreferred);
  var fallbackBefore = JSON.stringify(untouchedFallback);
  emitter._mergeThing0Evidence(untouchedPreferred, untouchedFallback);
  assert.equal(JSON.stringify(untouchedPreferred), preferredBefore,
    'preferred source row was mutated');
  assert.equal(JSON.stringify(untouchedFallback), fallbackBefore,
    'fallback source row was mutated');

  var errored = { ticker: 'GEV', cik: '1004', error: 'http 502' };
  var fallbackScore = {
    ticker: 'GEV', cik: '1004', composite: 0.8, validated: true, inEnvelope: true, alert: false,
    thing0: { qualification_status: 'qualified', permits_thing1_use: true }
  };
  assert.strictEqual(emitter._mergeThing0Evidence(errored, fallbackScore), fallbackScore,
    'errored preferred row was not replaced by the coherent fallback');
  var loneError = emitter._mergeThing0Evidence(errored, null);
  assert.strictEqual(loneError, errored, 'errored preferred row was rewritten without a fallback');
  assert.equal(emitter._thing0Of(loneError), null, 'errored row was given Thing 0 evidence');

  var crossTicker = emitter._mergeThing0Evidence(
    { ticker: 'AAA', cik: '1005', composite: 0.9 },
    { ticker: 'BBB', cik: '1006', thing0: { qualification_status: 'qualified', permits_thing1_use: true } });
  assert.equal(crossTicker.ticker, 'AAA', 'cross-issuer fallback was selected');
  assert.equal(emitter._thing0Of(crossTicker), null, 'Thing 0 evidence crossed issuer identities');

  var F = require('../lib/thing-formulas');
  assert.equal(F.thing0Eligible({ ticker: 'GEV', real: loneError }).eligible, false,
    'an errored row without a fallback qualified');

  var coherent = {
    t: 'CTRL',
    thing0: { qualification_status: 'qualified', permits_thing1_use: true },
    real: { composite: 0.8, alert: false, inEnvelope: true, validated: true, error: null, isFinancial: false }
  };
  assert.equal(F.thing0Eligible(coherent).eligible, true,
    'coherent qualified control failed Thing 0');
  var signal = F.thing1Distress(coherent, { degenerate: false });
  assert.ok(signal && signal.validated === true && signal.score === 0.8,
    'coherent qualified + validated control did not publish');

  var unvalidated = {
    t: 'CTRL',
    thing0: { qualification_status: 'qualified', permits_thing1_use: true },
    real: { composite: 0.8, alert: false, inEnvelope: true, validated: false, error: null, isFinancial: false }
  };
  assert.equal(F.thing1Distress(unvalidated, { degenerate: false }), null,
    'coherent unvalidated control did not abstain');
});

check('brain-signals joins fallback evidence by normalized CIK', function () {
  var emitter = require('../handlers/brain-signals');
  var t0 = { qualification_status: 'qualified', permits_thing1_use: true };
  var fallback = {
    ticker: 'ALKS', cik: '0001520262', composite: 0.3, validated: true,
    inEnvelope: true, thing0: t0
  };
  var preferred = {
    ticker: 'ALKS', cik: '850261', composite: 0.9, validated: true, inEnvelope: true
  };

  assert.equal(emitter._normCik('0001520262'), emitter._normCik('1520262'),
    'padded and unpadded CIKs did not normalize to the same issuer');
  assert.equal(emitter._normCik('not-a-cik'), null, 'malformed CIK was accepted');
  assert.equal(emitter._normCik(''), null, 'empty CIK was accepted');
  assert.equal(emitter._normCik(null), null, 'null CIK was accepted');

  var crossed = emitter._mergeThing0Evidence(preferred, fallback, '850261');
  assert.strictEqual(crossed, preferred, 'same-ticker/different-CIK fallback was selected');
  assert.equal(emitter._thing0Of(crossed), null,
    'ALKS 850261 borrowed Thing 0 evidence from 1520262');

  assert.strictEqual(emitter._mergeThing0Evidence(null, fallback, '1520262'), fallback,
    'matching normalized CIK did not select the coherent fallback');
  assert.strictEqual(emitter._mergeThing0Evidence(null, fallback, '0001520262'), fallback,
    'padded CIK did not select the same issuer fallback');

  assert.strictEqual(
    emitter._mergeThing0Evidence(null, { ticker: 'ALKS', thing0: t0 }, '850261'), null,
    'fallback without a CIK was used');
  assert.strictEqual(
    emitter._mergeThing0Evidence(null, { ticker: 'ALKS', cik: 'not-a-cik', thing0: t0 }, '850261'), null,
    'fallback with a malformed CIK was used');
  assert.strictEqual(
    emitter._mergeThing0Evidence(preferred, { ticker: 'ALKS', thing0: t0 }), preferred,
    'ticker-only fallback displaced an identified preferred row');

  var contradictory = emitter._selectSameIssuer([
    { ticker: 'ALKS', cik: '850261', validated: true, thing0: t0 },
    { ticker: 'ALK', cik: '850261', validated: false }
  ]);
  assert.equal(contradictory.conflict, true,
    'contradictory rows for one CIK did not fail closed');
  assert.equal(contradictory.record, null, 'a contradictory duplicate was selected');

  var duplicates = emitter._selectSameIssuer([
    { ticker: 'ALKS', cik: '850261', validated: true, thing0: t0 },
    { ticker: 'ALKS', cik: '000850261', validated: true, thing0: t0 }
  ]);
  assert.equal(duplicates.conflict, false,
    'identical duplicate rows were treated as contradictory');
  assert.ok(duplicates.record, 'identical duplicate rows produced no record');

  var alertConflict = emitter._selectSameIssuer([
    { ticker: 'ALKS', cik: '850261', validated: true, inEnvelope: true, composite: 0.5, alert: true, thing0: t0 },
    { ticker: 'ALKS', cik: '850261', validated: true, inEnvelope: true, composite: 0.5, alert: false, thing0: t0 }
  ]);
  assert.equal(alertConflict.conflict, true,
    'alert-only contradiction was not detected');
  assert.equal(alertConflict.record, null, 'an alert-only contradictory row was selected');

  var kidConflict = emitter._selectSameIssuer([
    { ticker: 'ALKS', cik: '850261', validated: true, inEnvelope: true, composite: 0.5, kid: 'limen_backtest.py', thing0: t0 },
    { ticker: 'ALKS', cik: '850261', validated: true, inEnvelope: true, composite: 0.5, kid: 'phase_engine.py', thing0: t0 }
  ]);
  assert.equal(kidConflict.conflict, true,
    'scorer-identity contradiction was not detected');
  assert.equal(kidConflict.record, null, 'a scorer-identity contradictory row was selected');
});

check('score-companies refresh does not inherit scorer identity', function () {
  var source = read('scripts/score-companies.js');
  assert.ok(!source.includes('d.kernel_id || row.kid'),
    'refresh inherits the prior scorer identity');
  assert.ok(source.includes('const responseKid'),
    'refresh does not derive an explicit identity');
  assert.ok(source.includes('next.kid = responseKid'),
    'refresh does not persist the current response identity');
});

check('snapshot --resume retries incomplete qualification', function () {
  var script = read('scripts/build-command-board.js');
  assert.ok(script.includes('isResumeComplete(row)'),
    'resume does not use the terminal-success predicate');
  assert.ok(script.includes('completeRow('),
    'resume completion predicate missing');
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
    validation_status: 'validated', kernel_id: 'limen_backtest.py',
    thing0_qualification_status: 'qualified', thing0_permits_thing1_use: true, timestamp: 1
  }), true);
  assert.equal(scorer._cacheProvenanceValid({
    validation_status: 'validated', thing0_qualification_status: 'qualified', timestamp: 1
  }), false, 'legacy entry without the protected scorer identity was counted');
  assert.equal(scorer._cacheProvenanceValid({
    validation_status: 'validated', kernel_id: 'limen_backtest.py',
    thing0_qualification_status: 'qualified', timestamp: 1
  }), false, 'entry without the canonical permit was counted');
  assert.equal(scorer._cacheProvenanceValid({
    validation_status: 'unvalidated_after_modification', kernel_id: 'limen_backtest.py',
    thing0_qualification_status: 'qualified', thing0_permits_thing1_use: true
  }), false);
  assert.equal(scorer._cacheProvenanceValid({ validation_status: 'validated' }), false);
  assert.equal(scorer._cacheProvenanceValid({ timestamp: 1, phase: 'p4' }), false);
  var source = read('lib/company-phase-scorer.js');
  assert.ok(source.includes('_cacheProvenanceValid(cached)'),
    'cache reads do not check validation provenance');
});

check('brain-signals counts only validated Thing 1 rows as scanned', function () {
  var emitter = require('../handlers/brain-signals');
  assert.equal(emitter._thing1ValidatedRow({ validated: true, inEnvelope: true, kid: 'limen_backtest.py' }), true);
  assert.equal(emitter._thing1ValidatedRow({ validation_status: 'validated', inEnvelope: true, kid: 'limen_backtest.py' }), true);
  assert.equal(emitter._thing1ValidatedRow({ validated: true, inEnvelope: true }), false,
    'missing scorer identity counted as a validated Thing 1 scan');
  assert.equal(emitter._thing1ValidatedRow({ validated: true, inEnvelope: true, kid: 'other.py' }), false,
    'wrong scorer identity counted as a validated Thing 1 scan');
  assert.equal(emitter._thing1ValidatedRow({ validated: false, inEnvelope: true, kid: 'limen_backtest.py' }), false);
  assert.equal(emitter._thing1ValidatedRow({ validated: true, inEnvelope: false, kid: 'limen_backtest.py' }), false);
  assert.equal(emitter._thing1ValidatedRow({ error: 'http 502', validated: true, inEnvelope: true, kid: 'limen_backtest.py' }), false);
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
  var cbPath = require.resolve('../assets/data/command-board-data.json');
  var cbBefore = JSON.stringify(require(cbPath));
  var eligPath = require.resolve('../assets/data/command-board-eligible.json');
  var engPath = require.resolve('../assets/data/energy-distress-scores.json');
  var eligBefore = JSON.stringify(require(eligPath));
  var engBefore = JSON.stringify(require(engPath));
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
  assert.equal(JSON.stringify(require(cbPath)), cbBefore,
    'handler mutated command-board-data source rows');
  assert.equal(JSON.stringify(require(eligPath)), eligBefore,
    'handler mutated command-board-eligible source rows');
  assert.equal(JSON.stringify(require(engPath)), engBefore,
    'handler mutated energy-distress-scores source rows');

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
  assert.ok(!payload.publishable.some(function (row) { return row.ticker === 'EOG'; }),
    'EOG still publishes beside unvalidated Thing 1 data');
  assert.equal(payload.publishable.length, 0,
    'unvalidated selected rows still publish');
  assert.equal(payload.flagged, 0, 'unvalidated rows produced a fabricated alert');
  assert.ok(!/Scored live via the validated kernel/.test(payload.note),
    'note still claims a live validated kernel for unvalidated rows');

  /* Selection is wholesale and must not mutate either source row or promote
     Thing 1 validation. */
  var preferred = { ticker: 'X', cik: '1007', validated: false, inEnvelope: false, composite: 1 };
  var fallback = {
    ticker: 'X', cik: '1007', validated: false, composite: null, inEnvelope: false,
    thing0: { qualification_status: 'qualified', permits_thing1_use: true }
  };
  var preferredBefore = JSON.stringify(preferred);
  var fallbackBefore = JSON.stringify(fallback);
  var merged = handler._mergeThing0Evidence(preferred, fallback);
  assert.strictEqual(merged, fallback,
    'Thing 0 evidence was attached to preferred Thing 1 fields');
  assert.equal(merged.thing0.qualification_status, 'qualified');
  assert.equal(merged.validated, false, 'Thing 1 validation was changed');
  assert.equal(merged.composite, null, 'preferred score survived the coherent fallback');
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

/* Production handler, isolated fixtures: the board's ALKS row is CIK 850261,
   while the eligible feed's ALKS row is CIK 1520262. A ticker-only join would
   publish the latter issuer under the former issuer's row. */
async function identityCoherenceCheck() {
  var Module = require('module');
  var originalLoad = Module._load;
  var handlerPath = require.resolve('../handlers/brain-signals');
  var t0 = { qualification_status: 'qualified', permits_thing1_use: true };
  var scenario = null;

  async function runScenario(next) {
    scenario = next;
    delete require.cache[handlerPath];
    var fixtureHandler = require('../handlers/brain-signals');
    var payload = null;
    await fixtureHandler(
      { url: '/api/brain-signals?domain=medicine' },
      { setHeader: function () {}, end: function (s) { payload = JSON.parse(s); } }
    );
    assert.ok(payload, 'fixture handler did not respond');
    return payload;
  }

  try {
    Module._load = function (request, parent, isMain) {
      if (!scenario) return originalLoad.apply(this, arguments);
      if (request === '../assets/data/command-board-data.json') return scenario.cb;
      if (request === '../assets/data/energy-distress-scores.json') return { scores: [] };
      if (request === '../assets/data/command-board-eligible.json') return scenario.elig;
      return originalLoad.apply(this, arguments);
    };

    var collision = await runScenario({
      cb: { companies: [
        { n: 'Alkermes board row', t: 'ALKS', c: '850261', d: 'medicine', ds: 0.65 },
        { n: 'Coherent control', t: 'CTRL', c: '0001234567', d: 'medicine', ds: 0.5 }
      ] },
      elig: { companies: [
        { t: 'ALKS', c: '0001520262', d: 'medicine', co: 0.30, a: false,
          es: 'ELIGIBLE_NOW', kid: 'limen_backtest.py', vs: 'validated', t0: t0 },
        { t: 'CTRL', c: '1234567', d: 'medicine', co: 0.5, a: false,
          es: 'ELIGIBLE_NOW', kid: 'limen_backtest.py', vs: 'validated', t0: t0 }
      ] }
    });
    assert.equal(collision.thing0Evidence, 1, JSON.stringify(collision));
    assert.equal(collision.publishable.length, 1, JSON.stringify(collision));
    assert.equal(collision.publishable[0].ticker, 'CTRL',
      'coherent same-CIK control did not publish');
    assert.ok(!collision.publishable.some(function (r) { return r.ticker === 'ALKS'; }),
      'ALKS 850261 inherited the colliding 1520262 qualification');

    var unvalidated = await runScenario({
      cb: { companies: [
        { n: 'Unvalidated issuer', t: 'UNV', c: '42', d: 'medicine', ds: 0.9 }
      ] },
      elig: { companies: [
        { t: 'UNV', c: '0000042', d: 'medicine', co: 0.99, a: true,
          es: 'ELIGIBLE_NOW', kid: 'limen_backtest.py', vs: 'unvalidated_after_modification', t0: t0 }
      ] }
    });
    assert.equal(unvalidated.thing0Evidence, 1, JSON.stringify(unvalidated));
    assert.equal(unvalidated.publishable.length, 0,
      'unvalidated same-CIK row published by borrowing legacy score fields');
    assert.equal(unvalidated.flagged, 0, 'unvalidated row produced an alert');

    var conflict = await runScenario({
      cb: { companies: [
        { n: 'Duplicate issuer', t: 'DUP', c: '77', d: 'medicine', ds: 0.5 }
      ] },
      elig: { companies: [
        { t: 'DUP', c: '77', d: 'medicine', co: 0.4, a: false,
          es: 'ELIGIBLE_NOW', kid: 'limen_backtest.py', vs: 'validated', t0: t0 },
        { t: 'DUPX', c: '000077', d: 'medicine', co: 0.4, a: false,
          es: 'ELIGIBLE_NOW', kid: 'limen_backtest.py', vs: 'validated', t0: t0 }
      ] }
    });
    assert.equal(conflict.thing0Evidence, 0, JSON.stringify(conflict));
    assert.equal(conflict.publishable.length, 0,
      'contradictory duplicate CIK rows still published');
  } finally {
    Module._load = originalLoad;
    delete require.cache[handlerPath];
  }
}

async function executePlanCheck() {
  var board = require('../scripts/build-command-board');
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-cb-plan-'));
  var outPath = path.join(dir, 'feed.json');
  var sentinel = '{"sentinel":true}';
  fs.writeFileSync(outPath, sentinel);
  var frontier = {
    _universe_total: 1,
    _processed_total: 1,
    companies: [{ cik: '1', ticker: 'ONE', name: 'One', envelope_status: 'ELIGIBLE_NOW' }]
  };
  try {
    var plan = board.planCommandBoard(frontier, [], { batch: 1, thing0Migration: true });
    await assert.rejects(board.executePlan(plan, {
      outputPath: outPath,
      atomic: true,
      thing0Migration: true,
      delayMs: 0,
      scoreFn: async function () { throw new Error('boom'); }
    }), /Scorer failure/);
    assert.equal(fs.readFileSync(outPath, 'utf8'), sentinel,
      'scorer failure modified the prior output');

    var dryPlan = board.planCommandBoard(frontier, [], { batch: 1, thing0Migration: true });
    var calls = 0;
    await board.executePlan(dryPlan, {
      outputPath: outPath,
      atomic: true,
      thing0Migration: true,
      dryRun: true,
      delayMs: 0,
      scoreFn: async function () { calls++; return {}; }
    });
    assert.equal(calls, 0, 'dry run called the scorer');
    assert.equal(fs.readFileSync(outPath, 'utf8'), sentinel,
      'dry run modified the prior output');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function phaseCacheCheck() {
  var db = require('../lib/limen-db');
  var scorer = require('../lib/company-phase-scorer');
  var origGet = db.get, origDel = db.del, origSet = db.set, origFetch = global.fetch;
  var deleted = [];
  var store = { 'company_phase_123': { phase: 'p4', timestamp: 1 } };
  var rejectDel = false;
  db.get = async function (k) { return store[k] || null; };
  db.set = async function (k, v) { store[k] = v; return true; };
  db.del = async function (k) {
    deleted.push(k);
    if (rejectDel) return false;
    delete store[k];
    return true;
  };

  function ok(payload) {
    return { ok: true, status: 200, json: async function () { return payload; } };
  }
  async function run(response) {
    deleted.length = 0;
    store['company_phase_123'] = { phase: 'p4', timestamp: 1 };
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

    /* A rejected deletion is not an invalidation and leaves the stale value. */
    rejectDel = true;
    var rejected = await run(ok({
      thing0_eligibility: { permits_thing1_use: false, qualification_status: 'not_qualified' },
      dominant_phase: 'p4'
    }));
    assert.equal(rejected.scored, false, JSON.stringify(rejected));
    assert.equal(rejected.invalidated, false, JSON.stringify(rejected));
    assert.equal(rejected.invalidation_error, 'phase_delete_failed', JSON.stringify(rejected));
    assert.deepEqual(await db.get('company_phase_123'), { phase: 'p4', timestamp: 1 },
      'rejected deletion lost the retained value');
    rejectDel = false;

    /* Valid qualified + explicit permission + validated Thing 1 still caches. */
    var valid = await run(ok({
      thing0_eligibility: { qualification_status: 'qualified', permits_thing1_use: true },
      validation_status: 'validated',
      kernel_id: 'limen_backtest.py',
      dominant_phase: 'p4',
      trajectory: 'STABLE'
    }));
    assert.equal(valid.scored, true, JSON.stringify(valid));
    assert.equal(valid.phase, 'p4', JSON.stringify(valid));
    assert.ok(!deleted.includes('company_phase_123'),
      'valid result invalidated the phase cache');

    /* camelCase Thing Zero evidence must persist canonical provenance and must
       not be rescored repeatedly. */
    var camel = ok({
      thing0Eligibility: { qualificationStatus: 'QUALIFIED', permitsThing1Use: true },
      validation_status: 'validated',
      kernel_id: 'limen_backtest.py',
      dominant_phase: 'p4',
      trajectory: 'STABLE'
    });
    var camelRun = await run(camel);
    assert.equal(camelRun.scored, true, JSON.stringify(camelRun));
    var camelEntry = store['company_phase_123'];
    assert.equal(camelEntry.thing0_qualification_status, 'qualified');
    assert.equal(camelEntry.thing0_permits_thing1_use, true);
    assert.equal(camelEntry.kernel_id, 'limen_backtest.py');
    assert.equal(scorer._cacheProvenanceValid(camelEntry), true,
      'camelCase cache entry would be rescored');
    var camelAgain = await run(camel);
    assert.equal(camelAgain.scored, true, JSON.stringify(camelAgain));
    assert.ok(!deleted.includes('company_phase_123'),
      'valid camelCase cache entry was invalidated');

    /* camelCase without an explicit affirmative permission must not cache. */
    var camelMissingPermit = await run(ok({
      thing0Eligibility: { qualificationStatus: 'qualified' },
      validation_status: 'validated',
      kernel_id: 'limen_backtest.py',
      dominant_phase: 'p4'
    }));
    assert.equal(camelMissingPermit.scored, false, JSON.stringify(camelMissingPermit));
    assert.equal(camelMissingPermit.error, 'thing0_permission_missing');

    var camelFalsePermit = await run(ok({
      thing0Eligibility: { qualificationStatus: 'qualified', permitsThing1Use: false },
      validation_status: 'validated',
      kernel_id: 'limen_backtest.py',
      dominant_phase: 'p4'
    }));
    assert.equal(camelFalsePermit.scored, false, JSON.stringify(camelFalsePermit));
    assert.equal(camelFalsePermit.error, 'thing0_permission_missing');

    /* Mixed contradictory spellings must fail closed. */
    var mixedStatus = await run(ok({
      thing0_eligibility: {
        qualification_status: 'qualified', qualificationStatus: 'not_qualified',
        permits_thing1_use: true
      },
      validation_status: 'validated', kernel_id: 'limen_backtest.py', dominant_phase: 'p4'
    }));
    assert.equal(mixedStatus.scored, false, JSON.stringify(mixedStatus));
    assert.equal(mixedStatus.error, 'thing0_evidence_contradictory');

    var mixedPermit = await run(ok({
      thing0_eligibility: {
        qualification_status: 'qualified',
        permits_thing1_use: false, permitsThing1Use: true
      },
      validation_status: 'validated', kernel_id: 'limen_backtest.py', dominant_phase: 'p4'
    }));
    assert.equal(mixedPermit.scored, false, JSON.stringify(mixedPermit));
    assert.equal(mixedPermit.error, 'thing0_evidence_contradictory');

    /* A validated response without the explicit protected scorer identity
       must not cache. */
    var noKernelId = await run(ok({
      thing0_eligibility: { qualification_status: 'qualified', permits_thing1_use: true },
      validation_status: 'validated',
      dominant_phase: 'p4'
    }));
    assert.equal(noKernelId.scored, false, JSON.stringify(noKernelId));
    assert.equal(noKernelId.error, 'thing1_kernel_identity_invalid:missing');

    var wrongKernelId = await run(ok({
      thing0_eligibility: { qualification_status: 'qualified', permits_thing1_use: true },
      validation_status: 'validated', kernel_id: 'phase_engine.py', dominant_phase: 'p4'
    }));
    assert.equal(wrongKernelId.scored, false, JSON.stringify(wrongKernelId));
    assert.equal(wrongKernelId.error, 'thing1_kernel_identity_invalid:phase_engine.py');

    assert.equal(scorer._cacheProvenanceValid({
      validation_status: 'validated', kernel_id: 'limen_backtest.py',
      thing0_qualification_status: 'qualified', thing0_permits_thing1_use: false
    }), false, 'cache provenance accepted a missing canonical permit');

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
    db.set = origSet;
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
  await checkAsync('brain-signals identity coherence across colliding tickers', identityCoherenceCheck);
  await checkAsync('command-board executePlan is atomic and dry-run-safe', executePlanCheck);
  await checkAsync('handler contract against current static snapshots', handlerCheck);
  console.log('');
  if (failures) {
    console.error(failures + ' failure(s)');
    process.exit(1);
  }
  console.log('thing0 connect: all checks passed');
})();
