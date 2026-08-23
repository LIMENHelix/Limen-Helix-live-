'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const consumer = require('../lib/master-brain-consumer');
const autoqueue = require('../handlers/limen-worker-autoqueue');

const inbox = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'data', '_master-inbox.json'), 'utf8'));
assert.equal(Array.isArray(inbox.readyForAutofire), true, 'full feeder pool is present');
assert.equal(inbox.readyForAutofire.length, inbox.stats.readyToFire, 'feeder pool covers every ready candidate');
assert.equal(inbox.topPriority.length, 25, 'presentation slice remains capped at 25');
assert.equal(inbox.readyForAutofire.every(item => ['investment', 'research'].includes(item.lane)), true, 'feeder pool contains only active lanes');
assert.equal(Object.keys(consumer.LANE_THRESHOLDS).sort().join(','), 'investment,research', 'consumer active lane vocabulary');

const terminal = status => ({ status, queuedAt: 1 });
const pending = n => Array.from({ length: n }, () => ({ status: 'PENDING' }));
assert.equal(autoqueue._queueSeedCapacity([]), 200, 'empty queue has full capacity');
assert.equal(autoqueue._queueSeedCapacity(pending(200)), 0, 'full pending queue admits nothing');
assert.equal(autoqueue._queueSeedCapacity(pending(198).concat([terminal('FIRED'), terminal('FAILED')])), 2, 'terminal slots are reusable');

const result = autoqueue._trimQueue(pending(198).concat([terminal('FIRED'), terminal('FAILED'), terminal('DISMISSED')]));
assert.equal(result.queue.length, 200, 'trim keeps hard queue bound');
assert.equal(result.evicted, 1, 'trim evicts terminal records only');
assert.equal(result.queue.filter(q => q.status === 'PENDING').length, 198, 'trim preserves all pending work');

const blocked = autoqueue._trimQueue(pending(201));
assert.equal(blocked.queue.length, 200, 'pending overflow is still bounded');
assert.equal(blocked.evicted, 0, 'pending work is never mislabeled as terminal eviction');

console.log('11/11 master-autofire-pool assertions passed');
