'use strict';

/* Official collection identities shared across otherwise independent domain brains. */
var assert = require('node:assert/strict');
var H = require('../handlers/domain-snapshot.js');

var cisa = {
  catalogVersion: '2026.08.24',
  dateReleased: '2026-08-24T18:00:04.7056Z',
  count: 1,
  vulnerabilities: [{ dateAdded: '2026-08-24', knownRansomwareCampaignUse: 'Known' }]
};
var noaa = {
  updated: '2026-08-25T11:17:21+00:00',
  features: [{ properties: { event: 'Storm', severity: 'Severe' } }]
};
var usgs = {
  metadata: { generated: 1787656858000, count: 1 },
  features: [{ properties: { mag: 6.1 } }]
};

assert.equal(H._cisaKevIdentity(cisa),
  'cisa-kev-version:2026.08.24|released:2026-08-24T18:00:04.7056Z|count:1');
assert.equal(H._cisaKevIdentity(Object.assign({}, cisa, { count: 2 })), null);
assert.equal(H._cisaKevIdentity(Object.assign({}, cisa, { dateReleased: 'not-a-date' })), null);
assert.equal(H._noaaAlertsIdentity(noaa), '2026-08-25T11:17:21+00:00');
assert.equal(H._usgsEarthquakeIdentity(usgs), 'usgs-generated:1787656858000|count:1');
assert.equal(H._usgsEarthquakeIdentity({ metadata: usgs.metadata, features: [] }), null);

var realFetch = global.fetch;
function response(body) {
  return { ok: true, status: 200, json: function () { return Promise.resolve(body); } };
}

(async function () {
  try {
    global.fetch = function () { return Promise.resolve(response(cisa)); };
    var cisaReading = await H._fetchCISAKEV();
    assert.equal(cisaReading.sourceUpdatedAt, H._cisaKevIdentity(cisa));

    global.fetch = function () { return Promise.resolve(response(noaa)); };
    var noaaReading = await H._fetchNOAANWSAlerts();
    assert.equal(noaaReading.sourceUpdatedAt, H._noaaAlertsIdentity(noaa));

    global.fetch = function () { return Promise.resolve(response(usgs)); };
    var usgsReading = await H._fetchUSGSEarthquakes();
    assert.equal(usgsReading.sourceUpdatedAt, H._usgsEarthquakeIdentity(usgs));

    global.fetch = function () {
      return Promise.resolve(response({ vulnerabilities: cisa.vulnerabilities,
        catalogVersion: cisa.catalogVersion, dateReleased: null, count: 1 }));
    };
    var unstamped = await H._fetchCISAKEV();
    assert.equal(unstamped.value, 1);
    assert.equal(unstamped.sourceUpdatedAt, null);

    console.log('shared collection identities: 11/11 passed');
  } finally {
    global.fetch = realFetch;
  }
})().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
