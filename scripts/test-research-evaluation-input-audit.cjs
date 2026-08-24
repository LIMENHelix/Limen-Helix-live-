'use strict';

const assert = require('assert');
const audit = require('./audit-research-evaluation-input.cjs');
const report = audit.build();
assert.strictEqual(report.readOnly, true);
assert.strictEqual(report.contract.builderPresent, true);
assert.strictEqual(report.contract.independenceRequired, true);
assert.strictEqual(report.contract.evidenceIdsRequired, true);
assert.strictEqual(report.contract.requiredMappings.length, 4);
assert.strictEqual(report.learner.consumerPresent, true);
assert.strictEqual(report.publicationPath.persistsCitations, false);
assert.strictEqual(report.publicationPath.engineOutputCarriesCitations, true);
assert.strictEqual(report.publicationPath.persistsProvenance, true);
assert.strictEqual(report.publicationPath.persistsEvaluationMetadata, false);
assert.strictEqual(report.publicationPath.observerEmitsEvaluation, false);
assert.strictEqual(report.outcomeEndpoint.autonomousProducer, false);
assert.deepStrictEqual(report.outcomeEndpoint.producerFiles, []);
console.log('research evaluation input audit: 12/12 passed');
