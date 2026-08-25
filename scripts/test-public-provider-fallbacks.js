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

var noaa = {
  description: { title: 'Global July departures', units: 'Degrees Celsius', base_period: '1991-2020' },
  data: { '2024': { departure: 0.61 }, '2025': { departure: 0.38 }, '2026': { departure: 0.61 } }
};
assert.deepEqual(H._noaaClimateAtAGlancePeriod(new Date('2026-08-25T12:00:00Z')), { year: 2026, month: 7 });
var noaaSelected = H._selectNOAAClimateAtAGlance(noaa, { year: 2026, month: 7 });
assert.equal(noaaSelected.departure, 0.61);
assert.equal(noaaSelected.identity,
  'noaa-cag-global:v1|period:2026-07|base:1991-2020|departure-c:0.61');
assert.equal(H._selectNOAAClimateAtAGlance({ description: {}, data: noaa.data }, { year: 2026, month: 7 }), null);

var gazetteHtml = '<table><tbody><tr><td><a href="https://patentsgazette.uspto.gov/week34">' +
  'August 25, 2026</a></td><td>34</td><td>1549-4</td></tr></tbody></table>';
var gazette = H._selectUSPTOGazetteIssue(gazetteHtml);
assert.equal(gazette.week, 34);
assert.equal(gazette.date, '2026-08-25');
assert.equal(gazette.identity, 'uspto-gazette:v1|date:2026-08-25|week:34|issue:1549-4');
assert.equal(H._selectUSPTOGazetteIssue(gazetteHtml.replace('<td>34</td>', '<td>33</td>')), null);

var usdaHtml = '<div class="block"><a href="/datasets/qs.crops_20260825.txt.gz">' +
  '<span class="bold">Size:</span> 1.05<span class="bold">GB</span>' +
  '<span class="bold">Last modified:</span> Tue. August 25th, 2026 - 03:13am</a></div>';
var usda = H._selectUSDAQuickStatsCrops(usdaHtml);
assert.equal(usda.release, '2026-08-25');
assert.equal(usda.mb, 1075.2);
assert.equal(usda.identity,
  'usda-quickstats-crops:v1|release:2026-08-25|file:qs.crops_20260825.txt.gz|size:1.05GB|' +
  'modified:Tue. August 25th, 2026 - 03:13am');
assert.equal(H._selectUSDAQuickStatsCrops('<html>no dataset</html>'), null);

var unCatalog = { Folders: [{ MajorGroup: [{ SubGroup: [{ Item: [{ File: [{
  type: 'gz',
  Path: 'assets/Excel Files/1_Indicator (Standard)/CSV_FILES/WPP2024_TotalPopulationBySex.csv.gz',
  Title: '1950-2100, all scenarios'
}] }] }] }] }] };
var unDataset = H._selectUNWPPPopulationDataset(unCatalog);
assert.match(unDataset.path, /WPP2024_TotalPopulationBySex\.csv\.gz$/);
assert.equal(H._selectUNWPPPopulationDataset({ Folders: [] }), null);

var realFetch = global.fetch;
var realKey = process.env.REGULATIONS_GOV_API_KEY;
var realNoaaKey = process.env.NOAA_TOKEN;
var realUsptoKey = process.env.USPTO_API_KEY;
var realUsdaKey = process.env.USDA_API_KEY;
var realUnKey = process.env.UN_POPULATION_API_KEY;
var urls = [];
function response(body, headers) {
  var lookup = {};
  Object.keys(headers || {}).forEach(function (key) { lookup[key.toLowerCase()] = headers[key]; });
  return {
    ok: true, status: 200,
    json: function () { return Promise.resolve(body); },
    text: function () { return Promise.resolve(String(body)); },
    headers: { get: function (name) { return lookup[String(name).toLowerCase()] || null; } }
  };
}

(async function () {
  try {
    delete process.env.REGULATIONS_GOV_API_KEY;
    delete process.env.NOAA_TOKEN;
    delete process.env.USPTO_API_KEY;
    delete process.env.USDA_API_KEY;
    delete process.env.UN_POPULATION_API_KEY;
    global.fetch = function (url, opts) {
      var target = String(url);
      urls.push(target + ' [' + ((opts && opts.method) || 'GET') + ']');
      if (target.indexOf('bulks-faostat') >= 0) return Promise.resolve(response(fao));
      if (target.indexOf('regulations.gov') >= 0) return Promise.resolve(response(regulations));
      if (target.indexOf('climate-at-a-glance') >= 0) return Promise.resolve(response(noaa));
      if (target.indexOf('official-gazette-patents') >= 0) return Promise.resolve(response(gazetteHtml));
      if (target.indexOf('nass.usda.gov/datasets') >= 0) return Promise.resolve(response(usdaHtml));
      if (target.indexOf('downloads.json') >= 0) return Promise.resolve(response(unCatalog));
      if (target.indexOf('WPP2024_TotalPopulationBySex.csv.gz') >= 0) {
        return Promise.resolve(response('', {
          'content-length': '16980593', 'last-modified': 'Fri, 13 Dec 2024 19:11:28 GMT',
          etag: '"0x8DD1BA9F26A865E"'
        }));
      }
      throw new Error('unexpected URL ' + target);
    };

    var faoReading = await H._fetchFAO();
    assert.equal(faoReading.value, 4209110);
    assert.equal(faoReading.sourceUpdatedAt, '2025-12-31T00:00:00');

    var regulationsReading = await H._fetchRegulationsGov();
    assert.ok(urls.some(function (url) { return url.indexOf('api_key=DEMO_KEY') >= 0; }));
    assert.equal(regulationsReading.value, 7);
    assert.equal(regulationsReading.sourceUpdatedAt, regulationsIdentity);

    var noaaReading = await H._fetchNOAAClimate();
    assert.equal(noaaReading.value, 0.61);
    assert.match(noaaReading.sourceUpdatedAt, /^noaa-cag-global:v1\|period:2026-07\|/);

    var patentReading = await H._fetchPatents();
    assert.equal(patentReading.value, 34);
    assert.equal(patentReading.channel, 'context');

    var usdaReading = await H._fetchUSDA();
    assert.equal(usdaReading.value, 1075.2);
    assert.equal(usdaReading.channel, 'context');

    var unReading = await H._fetchUNPopulation();
    assert.equal(unReading.value, 16.19);
    assert.match(unReading.sourceUpdatedAt,
      /^un-wpp-population:v1\|path:.*WPP2024_TotalPopulationBySex\.csv\.gz\|bytes:16980593\|/);
    assert.ok(urls.some(function (url) { return /WPP2024_TotalPopulationBySex\.csv\.gz.*\[HEAD\]$/.test(url); }));

    process.env.REGULATIONS_GOV_API_KEY = 'private-test-key';
    urls = [];
    await H._fetchRegulationsGov();
    assert.ok(urls.some(function (url) { return url.indexOf('api_key=private-test-key') >= 0; }));

    console.log('public provider fallbacks: 35/35 passed');
  } finally {
    global.fetch = realFetch;
    if (realKey === undefined) delete process.env.REGULATIONS_GOV_API_KEY;
    else process.env.REGULATIONS_GOV_API_KEY = realKey;
    if (realNoaaKey === undefined) delete process.env.NOAA_TOKEN; else process.env.NOAA_TOKEN = realNoaaKey;
    if (realUsptoKey === undefined) delete process.env.USPTO_API_KEY; else process.env.USPTO_API_KEY = realUsptoKey;
    if (realUsdaKey === undefined) delete process.env.USDA_API_KEY; else process.env.USDA_API_KEY = realUsdaKey;
    if (realUnKey === undefined) delete process.env.UN_POPULATION_API_KEY; else process.env.UN_POPULATION_API_KEY = realUnKey;
  }
})().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
