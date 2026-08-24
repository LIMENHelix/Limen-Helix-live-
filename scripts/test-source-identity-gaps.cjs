'use strict';

const assert = require('node:assert/strict');
const audit = require('./audit-source-identity-gaps.js');

const snapshot = {
  domains: {
    test: {
      sources: [
        { name: 'present numeric', value: 0, live: true },
        { name: 'provider failure', value: null, live: false, failReason: 'HTTP 429' },
        { name: 'headline present', value: 4, headlines: ['x'], headlinePublishedAt: ['2026-08-24T00:00:00Z'] },
        { name: 'undefined reading', live: true }
      ]
    }
  }
};

const rows = audit.sourceList(snapshot);
assert.equal(rows.length, 4);
assert.equal(rows[0].availability, 'reading-present');
assert.equal(rows[0].status, 'open');
assert.equal(rows[1].availability, 'no-reading');
assert.equal(rows[1].status, 'blocked-source-unavailable');
assert.match(rows[1].requiredAction, /not yet an identity defect/);
assert.equal(rows[2].kind, 'headline-item-identity-only');
assert.equal(rows[2].status, 'open');
assert.equal(rows[3].availability, 'no-reading');
assert.equal(rows[3].status, 'blocked-source-unavailable');
console.log('source identity gap classification: 8/8 passed');
