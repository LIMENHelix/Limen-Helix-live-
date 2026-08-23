'use strict';

/* The adapters below already receive publisher observation dates.  This
 * exercises their real fetcher paths and asserts the date is carried through;
 * local clocks are never accepted as identity. */
var assert = require('node:assert/strict');
var H = require('../handlers/domain-snapshot.js');

var originalFetch = global.fetch;
var originalFred = process.env.FRED_API_KEY;
process.env.FRED_API_KEY = 'test-key';
global.fetch = async function (url) {
  var isFred = String(url).indexOf('api.stlouisfed.org') >= 0;
  var body = isFred
    ? { observations: [{ value: '100', date: '2026-08-01' }, { value: '99', date: '2026-07-01' }] }
    : [{ page: 1 }, [{ value: 2, date: '2025' }, { value: 1, date: '2024' }]];
  return { ok: true, status: 200, json: async function () { return body; } };
};

(async function () {
  try {
    var fred = [
      H._fetchFREDGasPrice, H._fetchFREDFoodCPI, H._fetchFREDConsumerSentiment,
      H._fetchFREDConstructionSpending, H._fetchFREDTransportationIndex,
      H._fetchFREDFederalInvestment
    ];
    var wb = [
      H._fetchWorldBankGDPGrowth, H._fetchWorldBankInflation,
      H._fetchWorldBankFertility, H._fetchWorldBankTertiary, H._fetchWorldBankRD,
      H._fetchWorldBankInfra, H._fetchWorldBankFoodIndex
    ];
    for (var i = 0; i < fred.length; i++) assert.equal((await fred[i]()).sourceUpdatedAt, '2026-08-01');
    for (var j = 0; j < wb.length; j++) assert.equal((await wb[j]()).sourceUpdatedAt, '2025');
    console.log('13/13 passed');
  } finally {
    global.fetch = originalFetch;
    if (originalFred === undefined) delete process.env.FRED_API_KEY;
    else process.env.FRED_API_KEY = originalFred;
  }
})().catch(function (err) {
  console.error(err.stack || err);
  process.exitCode = 1;
});
