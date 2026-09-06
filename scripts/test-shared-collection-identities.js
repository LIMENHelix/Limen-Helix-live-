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

var fedReg = { results: [
  { document_number: '2026-17321', publication_date: '2026-08-25' },
  { document_number: '2026-17280', publication_date: '2026-08-24' }
] };
var fedRegIdentity = H._federalRegisterIdentity(fedReg, 'energy-department', Date.parse('2026-08-25T12:00:00Z'));
assert.match(fedRegIdentity, /^fr1:[a-f0-9]{64}$/);
assert.equal(fedRegIdentity,
  H._federalRegisterIdentity(fedReg, 'energy-department', Date.parse('2026-08-25T23:59:59Z')));
assert.notEqual(fedRegIdentity,
  H._federalRegisterIdentity(fedReg, 'energy-department', Date.parse('2026-08-26T00:00:00Z')));
assert.equal(H._federalRegisterIdentity({ results: [{ publication_date: '2026-08-25' }] },
  'energy-department', Date.now()), null);

var realFetch = global.fetch;
function response(body) {
  return { ok: true, status: 200, json: function () { return Promise.resolve(body); } };
}
function textResponse(body) {
  return { ok: true, status: 200, text: function () { return Promise.resolve(body); } };
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

    var cisaRss = '<rss><channel><description>' + 'official '.repeat(20) + '</description><item><title>CISA alert</title><guid>/node/1</guid>' +
      '<pubDate>Mon, 24 Aug 2026 12:00:00 GMT</pubDate><description>critical ICS exploit</description></item></channel></rss>';
    global.fetch = function () { return Promise.resolve(textResponse(cisaRss)); };
    var advisoryReading = await H._fetchCISAAdvisories();
    assert.match(advisoryReading.sourceUpdatedAt,
      /^rss-set-v1:cisa-advisories\|items:1\|sha256:[a-f0-9]{64}$/);

    var fdaRss = '<rss><channel><description>' + 'official '.repeat(20) + '</description><item><title>FDA recall</title><guid>recall/1</guid>' +
      '<pubDate>Sat, 22 Aug 2026 00:00:00 EDT</pubDate><description>salmonella Class I</description></item></channel></rss>';
    global.fetch = function () { return Promise.resolve(textResponse(fdaRss)); };
    /* Renamed 2026-09-05. `_fetchFDARecalls` now exports the openFDA drug-enforcement
       fetcher, which is what that name always claimed to be; the food-recall RSS reader
       this assertion is about is `_fetchFDARecallsFoodRSS`. The assertion itself is
       unchanged: the RSS reading must still carry an `rss-set-v1:fda-recalls` identity. */
    var recallReading = await H._fetchFDARecallsFoodRSS();
    assert.match(recallReading.sourceUpdatedAt,
      /^rss-set-v1:fda-recalls\|items:1\|sha256:[a-f0-9]{64}$/);

    var today = new Date().toISOString().slice(0, 10);
    var registerPayload = { results: [
      { document_number: '2026-test-1', publication_date: today },
      { document_number: '2026-test-2', publication_date: today }
    ] };
    global.fetch = function () { return Promise.resolve(response(registerPayload)); };
    var registerReading = await H._fetchFedRegAgencyResearch('Fed Reg Test', 'test-agency');
    assert.equal(registerReading.value, 2);
    assert.match(registerReading.sourceUpdatedAt, /^fr1:[a-f0-9]{64}$/);

    console.log('shared collection identities: 19/19 passed');
  } finally {
    global.fetch = realFetch;
  }
})().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
