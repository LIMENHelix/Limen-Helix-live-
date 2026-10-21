#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'kernel-comparison.html'), 'utf8');
const board = fs.readFileSync(path.join(root, 'assets', 'js', 'kernel-comparison.js'), 'utf8');
const report = fs.readFileSync(path.join(root, 'helix-report.html'), 'utf8');
const api = fs.readFileSync(path.join(root, 'python_runtime', 'helix_app', 'index.py'), 'utf8');

assert.match(page, /data-filter="kernel"[^>]*>[^<]*T0 QUALIFIED/);
assert.match(page, /data-filter="partial"[^>]*>[^<]*T0 PARTIAL/);
assert.match(page, /data-filter="thing1-alert"[^>]*>T1 ALERT/);
assert.doesNotMatch(page, />[^<]*SHORT<\/button>/);

assert.match(board, /function _thing0Status\(/);
assert.match(board, /function _thing1Result\(/);
assert.match(board, /T2:MASK CHECK/);
assert.match(board, /Thing 2 has zero trade authority/);
assert.doesNotMatch(board, /WHY INVEST/);
assert.doesNotMatch(board, /Paper-trade thesis/);
assert.doesNotMatch(board, /_kernelSide|\._side/);

assert.match(api, /"masking_assessment"/);
assert.match(api, /"thing2_role"\] = "alignment_and_masking_reconciliation_only"/);
assert.match(api, /"thing2_trade_weight"\] = 0/);
assert.match(report, /masking\/alignment check/);
assert.match(report, /Thing 2 trade weight: <b>0<\/b>/);

// ── Classification order: authority gates precede the extraction heuristic ──
function block(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start !== -1 && end > start, 'missing block: ' + startMarker);
  return source.slice(start, end);
}

const classifierSource = [
  block(board, 'var TERMINAL_PHASES', 'function phaseColor'),
  block(board, 'function _isValidatedAlert', '// LIMEN lanes'),
  block(board, 'function _thing0Permits', 'function _initBoard')
].join('\n');

const classifier = {};
vm.createContext(classifier);
vm.runInContext(classifierSource + `
this._thing0Status = _thing0Status;
this._thing1Result = _thing1Result;
this.classifySignal = classifySignal;
this.computeSeverity = computeSeverity;
`, classifier);

function classifyRow(row) {
  const d = Object.assign({}, row);
  d._thing0Status = classifier._thing0Status(d);
  d._thing1Result = classifier._thing1Result(d);
  d._signal = classifier.classifySignal(d);
  d._severity = classifier.computeSeverity(d);
  return d;
}

const T0 = { qualification_status: 'qualified', permits_thing1_use: true };

const unvalidatedTerminal = classifyRow({
  t: 'T', p: 'p7', ds: 0.07, vs: 'unvalidated_after_modification',
  kid: 'limen_backtest.py', a: false, co: 1.03, t0: T0
});
assert.strictEqual(unvalidatedTerminal._thing0Status, 'QUALIFIED');
assert.strictEqual(unvalidatedTerminal._thing1Result, 'ABSTAIN');
assert.strictEqual(unvalidatedTerminal._signal, 'ABSTAIN',
  'unvalidated terminal row did not abstain');
assert.strictEqual(unvalidatedTerminal._severity, 0,
  'unvalidated terminal row kept a non-zero severity');

const partialTerminal = classifyRow({
  t: 'CRL', p: 'p7', ds: 0.28, vs: 'not_permitted_by_thing0',
  t0: { qualification_status: 'partially_qualified', permits_thing1_use: false }
});
assert.strictEqual(partialTerminal._signal, 'NOT_QUALIFIED',
  'partially qualified terminal row was not NOT_QUALIFIED');
assert.strictEqual(partialTerminal._severity, 0);

const nonPermitting = classifyRow({
  t: 'X', p: 'p7', ds: 0.10, vs: 'validated', kid: 'limen_backtest.py',
  t0: { qualification_status: 'qualified', permits_thing1_use: false }
});
assert.strictEqual(nonPermitting._signal, 'NOT_QUALIFIED',
  'non-permitting terminal row was not NOT_QUALIFIED');
assert.strictEqual(nonPermitting._severity, 0);

assert.strictEqual(classifyRow({ t: 'ERR', p: 'ERROR', ds: 0 })._signal,
  'DATA_ERROR', 'explicit p=ERROR did not remain DATA_ERROR');

const validatedTerminal = classifyRow({
  t: 'CTRL', p: 'p7', ds: 0.07, vs: 'validated', kid: 'limen_backtest.py',
  a: false, co: 0.3, t0: T0
});
assert.strictEqual(validatedTerminal._thing0Status, 'QUALIFIED');
assert.strictEqual(validatedTerminal._thing1Result, 'NO_ALERT');
assert.strictEqual(validatedTerminal._signal, 'DATA_ERROR',
  'validated terminal control no longer signals an extraction contradiction');

const dataFeed = JSON.parse(fs.readFileSync(
  path.join(root, 'assets', 'data', 'command-board-data.json'), 'utf8')).companies || [];
const eligibleFeed = JSON.parse(fs.readFileSync(
  path.join(root, 'assets', 'data', 'command-board-eligible.json'), 'utf8')).companies || [];

const citedTerminal = dataFeed
  .filter((r) => ['T', 'CRL', 'GEHC', 'GMED', 'RDFN'].indexOf(r.t) !== -1
    && ['p7', 'p7a', 'p9'].indexOf(r.p) !== -1)
  .map(classifyRow);
assert.ok(citedTerminal.length >= 5, 'cited terminal rows missing from the fallback feed');
assert.ok(citedTerminal.every((r) => r._signal !== 'DATA_ERROR'),
  'fallback feed still promotes non-authoritative terminal rows to DATA_ERROR');
assert.strictEqual(
  dataFeed.map(classifyRow).filter((r) => r._signal === 'DATA_ERROR').length, 0,
  'fallback feed still contains DATA_ERROR rows without validated provenance');
assert.strictEqual(
  eligibleFeed.map(classifyRow).filter((r) => r._signal === 'DATA_ERROR').length, 0,
  'primary feed produced DATA_ERROR without a validated extraction failure');

console.log('kernel comparison: explicit Thing 0, Thing 1 result, and zero-authority Thing 2 masking reconciliation passed');
