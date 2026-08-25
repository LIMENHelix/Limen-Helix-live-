'use strict';

var assert = require('node:assert/strict');
var H = require('../handlers/domain-snapshot.js');

var fao = { Datasets: { Dataset: [{
  DatasetCode: 'QCL',
  DatasetName: 'Production: Crops and livestock products',
  DateUpdate: '2025-12-31T00:00:00',
  FileRows: 4209110,
  FileLocation: 'https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data_(Normalized).zip'
}] } };
var selected = H._selectFaostatDataset(fao, 'QCL');
assert.equal(selected.FileRows, 4209110);
assert.equal(H._selectFaostatDataset({ Datasets: { Dataset: [{}] } }, 'QCL'), null);

var today = new Date().toISOString().slice(0, 10);
var regulations = { data: [{
  type: 'documents', id: 'FDA-2026-N-0001-0001',
  attributes: { lastModifiedDate: today + 'T15:17:35Z', title: 'Public filing' }
}], meta: { totalElements: 7 } };
var regulationsIdentity = H._regulationsGovIdentity(regulations, today);
assert.match(regulationsIdentity,
  /^regulations-set-v1:date:\d{4}-\d{2}-\d{2}\|total:7\|sha256:[a-f0-9]{64}$/);
assert.notEqual(regulationsIdentity, H._regulationsGovIdentity({
  data: [Object.assign({}, regulations.data[0], { attributes: { title: 'Corrected filing' } })],
  meta: regulations.meta
}, today));
assert.equal(H._regulationsGovIdentity({ data: [{}], meta: { totalElements: 1 } }, today), null);

var realFetch = global.fetch;
var realKey = process.env.REGULATIONS_GOV_API_KEY;
var urls = [];
function response(body) {
  return { ok: true, status: 200, json: function () { return Promise.resolve(body); } };
}

(async function () {
  try {
    delete process.env.REGULATIONS_GOV_API_KEY;
    global.fetch = function (url) {
      urls.push(String(url));
      return Promise.resolve(response(String(url).indexOf('bulks-faostat') >= 0 ? fao : regulations));
    };

    var faoReading = await H._fetchFAO();
    assert.equal(faoReading.value, 4209110);
    assert.equal(faoReading.sourceUpdatedAt, '2025-12-31T00:00:00');

    var regulationsReading = await H._fetchRegulationsGov();
    assert.ok(urls.some(function (url) { return url.indexOf('api_key=DEMO_KEY') >= 0; }));
    assert.equal(regulationsReading.value, 7);
    assert.equal(regulationsReading.sourceUpdatedAt, regulationsIdentity);

    process.env.REGULATIONS_GOV_API_KEY = 'private-test-key';
    urls = [];
    await H._fetchRegulationsGov();
    assert.ok(urls.some(function (url) { return url.indexOf('api_key=private-test-key') >= 0; }));

    console.log('public provider fallbacks: 11/11 passed');
  } finally {
    global.fetch = realFetch;
    if (realKey === undefined) delete process.env.REGULATIONS_GOV_API_KEY;
    else process.env.REGULATIONS_GOV_API_KEY = realKey;
  }
})().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
