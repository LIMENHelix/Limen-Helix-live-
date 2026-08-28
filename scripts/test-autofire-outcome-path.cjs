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
assert.strictEqual(report.boundaries.independentResearchOutcome, 'PRESENT_INPUT_GATED_PENDING_EVALUATION_RECORDS');
assert.strictEqual(report.boundaries.paperInvestmentOutcome, 'PRESENT_PAPER_ONLY_PENDING_HORIZONS');
assert.strictEqual(report.boundaries.independentInvestmentOutcome, 'MISSING_LIVE_PRODUCER');
for (const row of report.events) {
  if (row.event === 'OUTCOME_RESEARCH_PUBLISHED') {
    assert.strictEqual(row.autonomousProducerCount, 1);
    assert.strictEqual(row.status, 'AUTONOMOUS_PUBLICATION_RECEIPT_UNGRADED');
  } else if (row.event === 'OUTCOME_INVESTMENT_PNL') {
    assert.strictEqual(row.autonomousProducerCount, 1);
    assert.strictEqual(row.status, 'AUTONOMOUS_PAPER_OUTCOME_OBSERVER_PENDING_HORIZON');
  } else {
    assert.strictEqual(row.autonomousProducerCount, 1);
    assert.strictEqual(row.status, 'AUTONOMOUS_EXTERNAL_EVALUATION_INTAKE_OBSERVER');
  }
}
console.log('15/15 passed');
