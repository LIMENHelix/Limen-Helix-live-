'use strict';

var assert = require('node:assert/strict');
var H = require('../handlers/domain-snapshot.js');

var realFetch = global.fetch;
var active = 0;
var maxActive = 0;
var calls = 0;

function response(body) {
  return { ok: true, status: 200, json: function () { return Promise.resolve(body); } };
}

function federalRegisterBody(index) {
  return { count: 1, results: [{
    document_number: '2026-test-' + index,
    publication_date: new Date().toISOString().slice(0, 10)
  }] };
}

(async function () {
  try {
    H._resetFederalRegisterRequestState();
    global.fetch = function (url) {
      calls++;
      active++;
      maxActive = Math.max(maxActive, active);
      var index = calls;
      return new Promise(function (resolve) {
        setTimeout(function () {
          active--;
          resolve(response(federalRegisterBody(index)));
        }, 15);
      });
    };

    var jobs = [];
    for (var i = 0; i < 12; i++) {
      jobs.push(H._fetchFedRegAgencyResearch('Fed Reg Test ' + i, 'test-agency-' + i));
    }
    var readings = await Promise.all(jobs);
    assert.equal(readings.length, 12);
    assert.ok(maxActive <= 4, 'Federal Register concurrency was ' + maxActive);
    assert.equal(calls, 12);

    H._resetFederalRegisterRequestState();
    calls = 0;
    active = 0;
    maxActive = 0;
    var shared = await Promise.all([
      H._fetchFedRegAgencyResearch('Fed Reg Shared A', 'shared-agency'),
      H._fetchFedRegAgencyResearch('Fed Reg Shared B', 'shared-agency'),
      H._fetchFedRegAgencyResearch('Fed Reg Shared C', 'shared-agency')
    ]);
    assert.equal(calls, 1);
    assert.equal(new Set(shared.map(function (x) { return x.sourceUpdatedAt; })).size, 1);

    var urls = [];
    global.fetch = function (url) {
      urls.push(String(url));
      return Promise.resolve(response([{ page: 1 }, [
        { date: '2025', value: null },
        { date: '2024', value: 1.25 }
      ]]));
    };
    var worldBank = await Promise.all([
      H._fetchWorldBankGovernance(),
      H._fetchWBGovEffectiveness(),
      H._fetchWBRuleOfLaw(),
      H._fetchWBManufacturing()
    ]);
    worldBank.forEach(function (reading) {
      assert.equal(reading.value, 1.25);
      assert.equal(reading.sourceUpdatedAt, '2024');
    });
    assert.ok(urls.some(function (u) { return u.indexOf('GOV_WGI_CC.EST') >= 0 && u.indexOf('source=3') >= 0; }));
    assert.ok(urls.some(function (u) { return u.indexOf('GOV_WGI_GE.EST') >= 0 && u.indexOf('source=3') >= 0; }));
    assert.ok(urls.some(function (u) { return u.indexOf('GOV_WGI_RL.EST') >= 0 && u.indexOf('source=3') >= 0; }));
    assert.ok(urls.some(function (u) { return u.indexOf('NV.IND.MANF.ZS') >= 0; }));

    console.log('provider cadence repair: 17/17 passed');
  } finally {
    global.fetch = realFetch;
    H._resetFederalRegisterRequestState();
  }
})().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
