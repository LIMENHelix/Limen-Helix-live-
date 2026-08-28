#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'kernel-comparison.html'), 'utf8');
const board = fs.readFileSync(path.join(root, 'assets', 'js', 'kernel-comparison.js'), 'utf8');
const report = fs.readFileSync(path.join(root, 'helix-report.html'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api', 'helix_app', 'index.py'), 'utf8');

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

console.log('kernel comparison: explicit Thing 0, Thing 1 result, and zero-authority Thing 2 masking reconciliation passed');
