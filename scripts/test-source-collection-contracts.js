'use strict';

var assert = require('node:assert/strict');
var H = require('../handlers/domain-snapshot.js');

var ofac = '<html><body>' +
  '<div class="search-result views-row"><a href="/recent-actions/20260824">Iran-related Designations</a></div>' +
  '<div class="search-result views-row"><a href="/recent-actions/20260821">Venezuela General License</a></div>' +
  '<p>' + 'official sanctions action '.repeat(20) + '</p></body></html>';
var ofacIdentity = H._ofacRecentActionsIdentity(ofac);
assert.match(ofacIdentity, /^ofac-set-v1:items:2\|sha256:[a-f0-9]{64}$/);
assert.equal(ofacIdentity, H._ofacRecentActionsIdentity(ofac.replace('<body>', '<body><nav>chrome changed</nav>')));
assert.notEqual(ofacIdentity, H._ofacRecentActionsIdentity(ofac.replace('Iran-related', 'Syria-related')));
assert.equal(H._ofacRecentActionsIdentity('<html>no action records</html>'), null);

var fedReg = { count: 2, results: [
  { document_number: '2026-17354', publication_date: '2026-08-25' },
  { document_number: '2026-17353', publication_date: '2026-08-25' }
] };
assert.match(H._federalRegisterResultIdentity(fedReg, 'rules-newest'), /^fr-set-v1:[a-f0-9]{64}$/);
assert.notEqual(H._federalRegisterResultIdentity(fedReg, 'rules-newest'),
  H._federalRegisterResultIdentity(Object.assign({}, fedReg, { count: 3 }), 'rules-newest'));
assert.equal(H._federalRegisterResultIdentity({ count: 1, results: [{}] }, 'rules-newest'), null);

var openAlex = { results: [{
  id: 'https://openalex.org/I27837315', updated_date: '2026-08-25T05:59:34', works_count: 991844
}] };
assert.equal(H._openAlexInstitutionIdentity(openAlex),
  'openalex:https://openalex.org/I27837315|updated:2026-08-25T05:59:34|works:991844');
assert.equal(H._openAlexInstitutionIdentity({ results: [{ id: 'I1', works_count: 4 }] }), null);

var metaHtml = '<html><head><meta content="2026-08-24T13:52:10-0400" ' +
  'property="og:updated_time" /></head><body></body></html>';
assert.equal(H._htmlMetaUpdatedIdentity(metaHtml, 'og:updated_time'), '2026-08-24T13:52:10-0400');
assert.equal(H._htmlMetaUpdatedIdentity(metaHtml.replace('2026-08-24T13:52:10-0400', 'not-a-date'),
  'og:updated_time'), null);

var cpcHtml = '<nav>outside chrome</nav><!-- Begin content area -->' +
  '<p>Drought persistence and improvement assessment.</p><!-- End content area --><footer>outside</footer>';
var cpcIdentity = H._htmlSectionIdentity(cpcHtml, 'noaa-cpc-drought',
  '<!-- Begin content area -->', '<!-- End content area -->');
assert.match(cpcIdentity, /^html-section-v1:noaa-cpc-drought\|sha256:[a-f0-9]{64}$/);
assert.equal(cpcIdentity, H._htmlSectionIdentity(cpcHtml.replace('outside chrome', 'new chrome'),
  'noaa-cpc-drought', '<!-- Begin content area -->', '<!-- End content area -->'));

var nvd = { totalResults: 1, vulnerabilities: [{ cve: {
  id: 'CVE-2026-1000', metrics: { cvssMetricV31: [{ cvssData: { baseScore: 9.8 } }] }
} }] };
var nvdIdentity = H._nvdRecentIdentity(nvd);
assert.match(nvdIdentity, /^nvd-set-v1:total:1\|items:1\|sha256:[a-f0-9]{64}$/);
assert.notEqual(nvdIdentity, H._nvdRecentIdentity({ totalResults: 1, vulnerabilities: [{ cve: {
  id: 'CVE-2026-1000', metrics: { cvssMetricV31: [{ cvssData: { baseScore: 8.8 } }] }
} }] }));
assert.equal(H._nvdRecentIdentity({ totalResults: 1, vulnerabilities: [{}] }), null);

var item = '<item><title>Publisher item</title><guid>item-1</guid>' +
  '<pubDate>Tue, 25 Aug 2026 12:00:00 GMT</pubDate><description>' +
  'official source text '.repeat(20) + '</description></item>';
var rss = '<rss><channel><title>Official feed</title>' + item + '</channel></rss>';
var realFetch = global.fetch;
function textResponse(body) {
  return { ok: true, status: 200, text: function () { return Promise.resolve(body); } };
}
function jsonResponse(body) {
  return { ok: true, status: 200, json: function () { return Promise.resolve(body); } };
}

(async function () {
  try {
    global.fetch = function () { return Promise.resolve(textResponse(ofac)); };
    var ofacReading = await H._fetchOFACRecentActions();
    assert.equal(ofacReading.sourceUpdatedAt, ofacIdentity);

    global.fetch = function () { return Promise.resolve(textResponse(rss)); };
    var bbcReading = await H._fetchBBCWorldNews();
    assert.match(bbcReading.sourceUpdatedAt,
      /^rss-set-v1:bbc-world\|items:1\|sha256:[a-f0-9]{64}$/);

    global.fetch = function () { return Promise.resolve(textResponse(rss)); };
    var cftcReading = await H._fetchCFTCPress();
    assert.match(cftcReading.sourceUpdatedAt,
      /^rss-set-v1:cftc-press\|items:1\|sha256:[a-f0-9]{64}$/);

    global.fetch = function () {
      return Promise.resolve(textResponse('<eSearchResult><Count>1309204</Count></eSearchResult>'));
    };
    var pubmedReading = await H._fetchPubMed();
    assert.match(pubmedReading.sourceUpdatedAt, /^pubmed-year:\d{4}\|count:1309204$/);

    global.fetch = function () { return Promise.resolve(jsonResponse(openAlex)); };
    var openAlexReading = await H._fetchOpenAlex();
    assert.equal(openAlexReading.sourceUpdatedAt, H._openAlexInstitutionIdentity(openAlex));

    global.fetch = function () { return Promise.resolve(jsonResponse(fedReg)); };
    var fedRegReading = await H._fetchFederalRegister();
    assert.equal(fedRegReading.sourceUpdatedAt,
      H._federalRegisterResultIdentity(fedReg, 'rules-newest'));

    global.fetch = function () { return Promise.resolve(textResponse(rss)); };
    var secReading = await H._fetchSECEnforcement();
    assert.match(secReading.sourceUpdatedAt,
      /^rss-set-v1:sec-press-releases\|items:1\|sha256:[a-f0-9]{64}$/);

    var atom = '<feed><entry><title>10-K filing</title><id>edgar-1</id>' +
      '<updated>2026-08-25T12:00:00Z</updated><summary>' +
      'publisher filing data '.repeat(12) + '</summary></entry></feed>';
    global.fetch = function () { return Promise.resolve(textResponse(atom)); };
    var edgarReading = await H._fetchSECEDGARCurrent();
    assert.match(edgarReading.sourceUpdatedAt,
      /^rss-set-v1:sec-edgar-current\|items:1\|sha256:[a-f0-9]{64}$/);

    var bls = { status: 'REQUEST_SUCCEEDED', Results: { series: [{ data: [{
      year: '2026', period: 'M07', value: '143.5'
    }] }] } };
    global.fetch = function () { return Promise.resolve(jsonResponse(bls)); };
    var blsReading = await H._fetchBLSManufacturing();
    assert.equal(blsReading.sourceUpdatedAt,
      'bls-series:PCUOMFG--OMFG--|year:2026|period:M07');

    global.fetch = function () { return Promise.resolve(jsonResponse([101, 99, 42])); };
    var hackerNewsReading = await H._fetchHackerNews();
    assert.match(hackerNewsReading.sourceUpdatedAt, /^hn-top-v1:[a-f0-9]{64}$/);

    var treasury = { data: [{ record_date: '2026-08-22', tot_pub_debt_out_amt: '37637553494935.61' }] };
    global.fetch = function () { return Promise.resolve(jsonResponse(treasury)); };
    var treasuryReading = await H._fetchTreasuryDebt();
    assert.equal(treasuryReading.sourceUpdatedAt, '2026-08-22');

    var sofr = { refRates: [{ effectiveDate: '2026-08-24', percentRate: 3.65 }] };
    global.fetch = function () { return Promise.resolve(jsonResponse(sofr)); };
    var sofrReading = await H._fetchNYFedSOFR();
    assert.equal(sofrReading.sourceUpdatedAt, '2026-08-24');

    var droughtCsv = 'MapDate,AreaOfInterest,None,D0,D1,D2,D3,D4,ValidStart,ValidEnd,StatisticFormatID\n' +
      '20260818,CONUS,20,30,25,14.5,5.5,1.2,20260818,20260824,1\n';
    global.fetch = function () { return Promise.resolve(textResponse(droughtCsv)); };
    var droughtReading = await H._fetchUSDADroughtMonitor();
    assert.equal(droughtReading.sourceUpdatedAt, '20260818');

    var alerts = { updated: '2026-08-25T11:17:21+00:00', features: [
      { properties: { event: 'Freeze Warning' } }
    ] };
    global.fetch = function () { return Promise.resolve(jsonResponse(alerts)); };
    var alertReading = await H._fetchNOAANWSAgAlerts();
    assert.equal(alertReading.sourceUpdatedAt, alerts.updated);

    global.fetch = function () { return Promise.resolve(textResponse(rss)); };
    var govTrackReading = await H._fetchGovTrack();
    assert.match(govTrackReading.sourceUpdatedAt,
      /^rss-set-v1:govtrack-active-bills\|items:1\|sha256:[a-f0-9]{64}$/);

    var ncuaHtml = metaHtml.replace('</body>',
      '<article class="press-release">credit union conservatorship action</article>' +
      '<p>' + 'official NCUA release '.repeat(20) + '</p></body>');
    global.fetch = function () { return Promise.resolve(textResponse(ncuaHtml)); };
    var ncuaReading = await H._fetchNCUACreditUnion();
    assert.equal(ncuaReading.sourceUpdatedAt, '2026-08-24T13:52:10-0400');

    var cpcRuntimeHtml = '<html>' + 'official '.repeat(30) + '<!-- Begin content area -->' +
      '<p>Drought persistence will expand while other areas improve.</p>' +
      '<!-- End content area --></html>';
    global.fetch = function () { return Promise.resolve(textResponse(cpcRuntimeHtml)); };
    var cpcReading = await H._fetchNOAACPCDrought();
    assert.equal(cpcReading.sourceUpdatedAt, H._htmlSectionIdentity(cpcRuntimeHtml,
      'noaa-cpc-drought', '<!-- Begin content area -->', '<!-- End content area -->'));

    global.fetch = function () { return Promise.resolve(jsonResponse(nvd)); };
    var nvdReading = await H._fetchNVDRecent();
    assert.equal(nvdReading.sourceUpdatedAt, nvdIdentity);

    console.log('source collection contracts: 34/34 passed');
  } finally {
    global.fetch = realFetch;
  }
})().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
