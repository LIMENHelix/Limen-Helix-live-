'use strict';

/* Regression checks for the reconciliation-only queue.  This file is not an
 * authoring queue and must never become an opportunity or execution input. */
var assert = require('node:assert/strict');
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');
var file = path.join(ROOT, 'assets', 'data', 'deep', 'aggregate-treatment-provenance-queue.json');
var queue = JSON.parse(fs.readFileSync(file, 'utf8'));
var tasks = queue.tasks || [];

assert.equal(queue.note, 'Reconciliation-only tasks. Not merged into per-domain authoring queues until reviewed.');
assert.equal(queue.readOnly, false);
assert.equal(tasks.length, 10);
assert.deepEqual([...new Set(tasks.map(function (t) { return t.domain; }))].sort(), ['defense', 'finance', 'religion', 'technology']);
assert.equal(new Set(tasks.map(function (t) { return t.id; })).size, tasks.length);
assert(tasks.every(function (t) {
  return t.level === 'aggregate-treatment' &&
    t.authoringType === 'source provenance reconciliation needed' &&
    Array.isArray(t.missingFields) &&
    t.missingFields.indexOf('exact discovery-cell match') >= 0 &&
    t.missingFields.indexOf('sourceProvenance or citation') >= 0;
}));
assert(tasks.every(function (t) { return /do not infer provenance/i.test(t.sourceHints); }));
assert(tasks.every(function (t) { return t.requiredHumanAction && t.whyItMatters; }));
console.log('8/8 passed');
