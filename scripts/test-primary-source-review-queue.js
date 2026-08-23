'use strict';
var assert = require('assert');
var child = require('child_process');
var path = require('path');
var root = path.join(__dirname, '..');
var text = child.execFileSync(process.execPath, [path.join(__dirname, 'build-primary-source-review-queue.cjs')], { cwd: root, encoding: 'utf8' });
var data = JSON.parse(text);
assert.strictEqual(data.schemaVersion, 'primary-source-review-queue/1.0');
assert.strictEqual(data.readOnlyAdmission, true);
assert.deepStrictEqual(data.domains, ['science', 'medicine', 'finance']);
assert(data.summary.sampledSourceFiles > 0);
assert(data.summary.uniqueUnresolvedIdentifiers > 0);
assert(data.tasks.length === data.summary.uniqueUnresolvedIdentifiers);
assert(data.tasks.every(function (task) {
  return ['DOI', 'PMID'].indexOf(task.identifierType) >= 0 &&
    task.identifier && task.status === 'UNRESOLVED' &&
    task.evidenceEligible === false && task.consumedByRuntime === false &&
    task.sourceFiles.length > 0 && task.portalTargets.length > 0;
}));
var keys = data.tasks.map(function (task) { return task.domain + '|' + task.identifierType + '|' + task.identifier.toLowerCase(); });
assert.strictEqual(new Set(keys).size, keys.length, 'identifiers must be deduplicated per domain');
assert(data.tasks.every(function (task) { return task.requiredReview.length === 4; }));
console.log('9/9 passed');

