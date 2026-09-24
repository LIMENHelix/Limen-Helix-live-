'use strict';

/**
 * Every domain a subscriber can pay for must produce real digest content — the
 * THE TWENTY #1 / DEFECT_LEDGER #28 pin: no lane may silently answer
 * nothing-to-say while its live source is up. Personal domains run the watch
 * value through their tool; the other twelve read the domain-wide live figures;
 * the artifact path (covered by test-domain-commercial-digest.cjs) is the
 * fallback when a live source is down.
 */
var assert = require('node:assert/strict');
var Digest = require('../lib/digest.js');

var STATS = { stats: [{ n: '41', k: 'Headline figure', c: 'context', hot: true }, { n: '7', k: 'Second figure', c: 'more' }], wow: ['A wow line.'] };
var FIXTURES = {
  'agriculture-tools': { drought: { rows: [{ state: 'OK', name: 'Oklahoma', crops: 'wheat', band: 'severe', changeD2: 2.5, validStart: '2026-09-22' }] } },
  'communication-live': STATS, 'defense-live': STATS, 'economy-live': STATS, 'governance-live': STATS,
  'industry-live': STATS, 'infrastructure-live': STATS, 'science-live': STATS, 'trade-live': STATS,
  'population-live': { global: { worldPop: 8062923417, worldGrowth: 0.93, migGainers: [{ iso: 'USA', country: 'United States', value: 1322668 }] } },
  'culture-markets': { quotes: { SPOT: { price: 509.03, changePct: -0.27 }, WMG: { price: 27.03, changePct: -0.48 } } },
  'energy-markets': { quotes: { NEE: { price: 76.04, changePct: -1.27 }, SO: { price: 83.29, changePct: -0.22 } } },
  'medicine-tools': { found: 1, rows: [{ drug: 'albuterol', status: 'Current', company: 'X', reason: 'demand' }] },
  'technology-tools': { found: 1, ransomware: 0, overdue: 0, rows: [{ cve: 'CVE-2026-1', product: 'Widget' }] },
  'intelligence-tools': { found: 1, rows: [{ name: 'DESIGNATED EXAMPLE' }] },
  'finance-tools': { rows: [{ name: 'Test Bank', cert: '1234', active: true, city: 'Omaha', state: 'NE' }] },
  'law-tools': { rows: [{ title: 'A proposed rule', daysLeft: 3, closes: '2026-09-30' }] },
  'education-tools': { rows: [{ name: 'Test University', state: 'KS' }] },
  'religion-tools': { rows: [{ name: 'Test Charity', state: 'MO' }] },
  'environment-tools': { aqi: 42, band: 'Good', place: 'Here', state: 'KS', say: 'Air is fine.' }
};
function stubGet(path) {
  var stem = path.split('?')[0];
  return Promise.resolve(FIXTURES[stem] || null);
}

var WATCH = { medicine: 'albuterol', technology: 'widget', intelligence: 'example', finance: 'test',
  law: 'rule', education: 'test', religion: 'test', environment: '64111' };
var ALL = ['agriculture', 'communication', 'culture', 'defense', 'economy', 'education', 'energy',
  'environment', 'finance', 'governance', 'industry', 'infrastructure', 'intelligence', 'law',
  'medicine', 'population', 'religion', 'science', 'technology', 'trade'];

(async function () {
  var covered = 0;
  for (var i = 0; i < ALL.length; i++) {
    var d = ALL[i];
    var sub = { domain: d, offer: 'p2', active: true };
    if (WATCH[d]) sub.watch = WATCH[d];
    var built = await Digest.buildFor(sub, { get: stubGet, now: Date.now() });
    assert.ok(built && built.body && built.key, d + ' produced no digest');
    assert.ok(built.body.indexOf('Reply to this email to cancel') > 0, d + ' missing cancel line');
    covered++;
    // key moves when the salient figure moves
    if (!WATCH[d]) {
      var moved = await Digest.buildFor(sub, { now: Date.now(), get: function (path) {
        var j = JSON.parse(JSON.stringify(FIXTURES[path.split('?')[0]] || {}));
        if (j.stats) j.stats[0].n = '42';
        if (j.drought) j.drought.rows[0].changeD2 = 9.9;
        if (j.global) j.global.worldPop += 100000000;
        if (j.quotes) j.quotes[Object.keys(j.quotes)[0]].changePct = 5.5;
        return Promise.resolve(j);
      } });
      assert.notEqual(built.key, moved.key, d + ' key did not move with the figures');
    }
  }
  assert.equal(covered, 20);
  // source down + no artifact => still nothing (honesty preserved)
  var down = await Digest.buildFor({ domain: 'trade', offer: 'p2', active: true },
    { get: async function () { return null; }, store: { assertDurable: function () {}, get: async function () { return null; } }, now: Date.now() });
  assert.equal(down, null);
  // domain-wide body says what it is
  var dw = await Digest.buildFor({ domain: 'trade', offer: 'p2', active: true }, { get: stubGet, now: Date.now() });
  assert.match(dw.body, /domain-wide trade read/);
  assert.equal(dw.personal, false);
  // personal stays personal
  var p = await Digest.buildFor({ domain: 'finance', watch: 'test', offer: 'p2', active: true }, { get: stubGet, now: Date.now() });
  assert.equal(p.personal, true);
  assert.match(p.subject, /Your finance watch: test/);
  console.log('digest domain-wide coverage: all 20 domains produce content, keys move with figures, fallback honesty preserved: PASS');
})().catch(function (error) { console.error(error); process.exit(1); });
