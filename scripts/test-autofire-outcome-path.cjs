'use strict';

const assert = require('assert');
const audit = require('./audit-autofire-outcome-path.cjs');

const report = audit.build();
assert.strictEqual(report.readOnly, true);
assert.strictEqual(report.events.length, 3);
assert.ok(report.productionLearningConsumers.includes('handlers/limen-outcome.js'));
assert.ok(report.commandProducers.includes('handlers/limen-worker-autofire.js'));
assert.ok(report.commandProducers.includes('lib/tradier-b14.js'));
assert.strictEqual(report.boundaries.researchPublicationReceipt, 'PRESENT_UNGRADED');
assert.strictEqual(report.boundaries.independentResearchOutcome, 'MISSING_AUTONOMOUS_PRODUCER');
assert.strictEqual(report.boundaries.independentInvestmentOutcome, 'MISSING_AUTONOMOUS_PRODUCER');
for (const row of report.events) {
  if (row.event === 'OUTCOME_RESEARCH_PUBLISHED') {
    assert.strictEqual(row.autonomousProducerCount, 1);
    assert.strictEqual(row.status, 'AUTONOMOUS_PUBLICATION_RECEIPT_UNGRADED');
  } else {
    assert.strictEqual(row.autonomousProducerCount, 0);
    assert.strictEqual(row.status, 'NO_AUTONOMOUS_PRODUCER_FOUND');
  }
}
console.log('13/13 passed');
