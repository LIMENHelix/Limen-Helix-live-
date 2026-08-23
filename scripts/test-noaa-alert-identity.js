'use strict';
var DS = require('../handlers/domain-snapshot.js');
var failures = 0, tests = 0;
function assert(name, condition, detail) { tests++; if (condition) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }
console.log('=== NOAA ALERT COLLECTION IDENTITY ===');
assert('valid top-level updated is preserved', DS._noaaAlertsIdentity({ updated: '2026-08-23T16:32:56Z' }) === '2026-08-23T16:32:56Z');
assert('missing updated abstains', DS._noaaAlertsIdentity({}) === null);
assert('malformed updated abstains', DS._noaaAlertsIdentity({ updated: 'not-a-date' }) === null);

var realFetch = global.fetch;
function response(body) { return { ok: true, status: 200, json: function () { return Promise.resolve(body); } }; }
(async function () {
  try {
    global.fetch = function () { return Promise.resolve(response({ updated: '2026-08-23T16:32:56Z', features: [{ properties: { severity: 'Severe', expires: '2026-08-24T16:32:56Z' } }] })); };
    var stamped = await DS._fetchNOAAAlerts();
    assert('real fetcher carries collection identity', stamped && stamped.sourceUpdatedAt === '2026-08-23T16:32:56Z', JSON.stringify(stamped));
    global.fetch = function () { return Promise.resolve(response({ features: [] })); };
    var unstamped = await DS._fetchNOAAAlerts();
    assert('missing collection identity preserves reading', unstamped && unstamped.value === 0 && unstamped.sourceUpdatedAt === null, JSON.stringify(unstamped));
  } finally { global.fetch = realFetch; }
  console.log(tests + '/' + tests + ' passed' + (failures ? ', ' + failures + ' FAILED' : ''));
  process.exit(failures ? 1 : 0);
})();
