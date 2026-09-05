/**
 * test-recall-and-fedreg-honesty.js — acceptance for the P0 recall rebind and the
 * Federal Register page-pin repair. Hits the real publishers.
 *
 * Two claims, both of which were FALSE in production on 2026-09-05:
 *
 *   1. openFDA drug enforcement (health `FDARecalls`) and the FDA food-recall RSS
 *      (agriculture `FDARecalls_2`) are different quantities and must be free to
 *      DIVERGE. A function-shadowing bug served both from the same RSS fetch, so they
 *      were identical by construction. Equality is the failure signature.
 *
 *   2. A Federal Register 30-day count must come from the publisher's own filtered
 *      total, not from counting inside a 20-item page. The old shape reported HHS as
 *      20 when the true figure was 200.
 *
 * NETWORK TEST, AND IT IS IN THE CI SWEEP. scripts/run-tests.mjs discovers it by name,
 * so it reaches openFDA, FDA and federalregister.gov on every run.
 *
 * A publisher outage therefore MUST NOT report as a pass. The runner treats exit code 77
 * as SKIP, and that is what an unreachable publisher exits with here. An earlier version
 * of this file exited 0 after printing "SKIP", which the runner counted as PASS, so the
 * suite would have gone green while asserting nothing. That is the precise failure this
 * header warns about, committed in the file that warns about it.
 */
var SKIP_STATUS = 77;   // scripts/run-tests.mjs
'use strict';

var https = require('https');

function get(url) {
  return new Promise(function (resolve) {
    var req = https.get(url, { headers: { 'User-Agent': 'LIMEN-Helix/1.0', 'Accept': '*/*' } }, function (res) {
      var body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () { resolve({ status: res.statusCode, body: body }); });
    });
    req.setTimeout(30000, function () { req.destroy(); resolve({ status: 0, body: '', err: 'timeout' }); });
    req.on('error', function (e) { resolve({ status: 0, body: '', err: e.message }); });
  });
}

function ymd(d) { return d.toISOString().slice(0, 10); }
function compact(d) { return ymd(d).replace(/-/g, ''); }

var failures = 0;
var skips = 0;

function fail(msg) { failures++; console.error('FAIL: ' + msg); }
function skip(msg) { skips++; console.log('SKIP: ' + msg); }
function pass(msg) { console.log('pass: ' + msg); }

async function checkRecallDivergence() {
  var now = Date.now();
  var from = compact(new Date(now - 30 * 86400000));
  var to = compact(new Date(now));

  var ofdaRes = await get('https://api.fda.gov/drug/enforcement.json?search=report_date:%5B'
    + from + '+TO+' + to + '%5D&limit=1');
  var rssRes = await get('https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml');

  if (ofdaRes.status !== 200) { skip('openFDA drug enforcement unreachable (' + (ofdaRes.err || ofdaRes.status) + ')'); return; }
  if (rssRes.status !== 200) { skip('FDA recalls RSS unreachable (' + (rssRes.err || rssRes.status) + ')'); return; }

  var enforcement;
  try {
    var j = JSON.parse(ofdaRes.body);
    enforcement = j && j.meta && j.meta.results && j.meta.results.total;
  } catch (e) { skip('openFDA returned unparseable JSON'); return; }
  if (typeof enforcement !== 'number') { skip('openFDA returned no meta.results.total'); return; }

  var rssItems = (rssRes.body.match(/<item[\s>]/gi) || []).length;
  if (rssItems === 0) { skip('FDA recalls RSS returned no items'); return; }

  console.log('  openFDA drug enforcement, 30d total = ' + enforcement);
  console.log('  FDA food-recall RSS item count      = ' + rssItems);

  /* The point of the repair. Identical values are the exact signature of the shadowing
     bug: one fetch answering for two channels. They can coincide by chance, so this is
     reported rather than hard-failed, but it must never be silent. */
  if (enforcement === rssItems) {
    fail('the two recall channels report the SAME value (' + enforcement + '). '
      + 'Either the shadowing bug is back, or the two quantities coincided by chance. '
      + 'Check that handlers/domain-snapshot.js still declares fetchFDARecalls and '
      + 'fetchFDARecallsFoodRSS as SEPARATE functions.');
  } else {
    pass('recall channels carry different quantities and diverge ('
      + enforcement + ' enforcement actions vs ' + rssItems + ' feed items)');
  }

  /* The RSS item count is bounded by the feed's page size. If it ever equals a round
     page limit it is a censored reading, not a measurement. */
  if (rssItems === 100 || rssItems === 20) {
    console.log('  NOTE: RSS item count ' + rssItems + ' may be the feed page size rather than a '
      + 'true total. It is a ">=" reading. This is a known property of the food-recall channel.');
  }
}

async function checkFedRegTrueCount() {
  var since = ymd(new Date(Date.now() - 30 * 86400000));
  var until = ymd(new Date());
  var agencies = [
    { label: 'HHS', slug: 'health-and-human-services-department' },
    { label: 'CDC', slug: 'centers-for-disease-control-and-prevention' },
    { label: 'CMS', slug: 'centers-for-medicare-medicaid-services' },
    { label: 'NIH', slug: 'national-institutes-of-health' }
  ];

  for (var i = 0; i < agencies.length; i++) {
    var a = agencies[i];
    var base = 'https://www.federalregister.gov/api/v1/documents.json?order=newest'
      + '&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(a.slug)
      + '&conditions%5Bpublication_date%5D%5Bgte%5D=' + encodeURIComponent(since)
      + '&conditions%5Bpublication_date%5D%5Blte%5D=' + encodeURIComponent(until);

    var res = await get(base + '&per_page=1');
    if (res.status !== 200) { skip('Federal Register unreachable for ' + a.label + ' (' + (res.err || res.status) + ')'); continue; }

    var parsed;
    try { parsed = JSON.parse(res.body); } catch (e) { skip('Federal Register unparseable for ' + a.label); continue; }
    if (typeof parsed.count !== 'number') { skip('Federal Register returned no count for ' + a.label); continue; }

    var trueCount = parsed.count;
    /* Reproduce the OLD behaviour to show the repair is load-bearing rather than
       cosmetic: page 20 newest and count those inside the window. */
    var oldRes = await get('https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest'
      + '&conditions%5Bagencies%5D%5B%5D=' + encodeURIComponent(a.slug));
    var oldCount = null;
    if (oldRes.status === 200) {
      try {
        var oj = JSON.parse(oldRes.body);
        var cutoff = Date.now() - 30 * 86400000;
        oldCount = (oj.results || []).filter(function (d) {
          var t = Date.parse(d.publication_date);
          return !isNaN(t) && t >= cutoff;
        }).length;
      } catch (e) { oldCount = null; }
    }

    console.log('  ' + a.label + ': true 30d = ' + trueCount
      + (oldCount === null ? '' : ('   old page-pinned method = ' + oldCount)));

    /* The page size is a hard ceiling on the old method. Exceeding it would mean the
       reproduction below is not reproducing the old code. */
    if (oldCount !== null && oldCount > 20) {
      fail(a.label + ': the old method returned ' + oldCount + ', which exceeds its own page size. '
        + 'The reproduction is wrong, not the publisher.');
    }
    if (trueCount < 0) { fail(a.label + ': negative count'); }

    /* CORRECTED TWICE, AND THE SEQUENCE IS THE POINT.
       First model: "a true count above 20 forces the old method to exactly 20." CDC
       falsified it (true 20, old 17) because the old cutoff dropped boundary-day
       documents. Second model: "the old method undercounts." CMS falsified that too
       (true 11, old 12) because the old method counted a document scheduled for FUTURE
       publication. The three errors push in opposite directions, so the old value has no
       defined relationship to the truth: it can land above or below.
       Assert only the one thing that is structurally guaranteed, which is the page
       ceiling, and REPORT the signed error rather than predicting its sign. */
    if (oldCount !== null) {
      var delta = oldCount - trueCount;
      pass(a.label + ': old ' + oldCount + ' vs true ' + trueCount
        + ' (old was ' + (delta === 0 ? 'coincidentally correct' : (delta > 0 ? 'HIGH by ' + delta : 'LOW by ' + (-delta))) + ')');
    }
  }

  /* Error 3 on its own: dropping the upper bound admits documents that have not been
     published yet. Asserted separately so a regression names the specific cause. */
  var probe = 'https://www.federalregister.gov/api/v1/documents.json?per_page=1&order=newest'
    + '&conditions%5Bagencies%5D%5B%5D=health-and-human-services-department'
    + '&conditions%5Bpublication_date%5D%5Bgte%5D=' + encodeURIComponent(since);
  var unbounded = await get(probe);
  var bounded = await get(probe + '&conditions%5Bpublication_date%5D%5Blte%5D=' + encodeURIComponent(until));
  if (unbounded.status === 200 && bounded.status === 200) {
    try {
      var u = JSON.parse(unbounded.body).count;
      var b = JSON.parse(bounded.body).count;
      console.log('  HHS future-dated documents excluded by the lte bound: ' + (u - b));
      if (b > u) {
        fail('bounding the window upward INCREASED the count (' + b + ' > ' + u + '). '
          + 'The lte filter does not mean what this code assumes.');
      } else {
        pass('the lte bound excludes future-dated documents (' + u + ' unbounded vs ' + b + ' bounded)');
      }
    } catch (e) { skip('future-document probe returned unparseable JSON'); }
  } else {
    skip('future-document probe unreachable');
  }
}

(async function () {
  console.log('recall channel divergence');
  await checkRecallDivergence();
  console.log('');
  console.log('Federal Register true 30d counts (health agencies)');
  await checkFedRegTrueCount();
  console.log('');

  /* A real assertion failure outranks an outage: if something we DID reach is wrong,
     that is a failure regardless of what else was unreachable. */
  if (failures) {
    console.error(failures + ' failure(s), ' + skips + ' skip(s)');
    process.exit(1);
  }
  if (skips) {
    console.log(skips + ' publisher(s) unreachable — asserted nothing about them. '
      + 'Exiting ' + SKIP_STATUS + ' so the runner records SKIP, not PASS.');
    process.exit(SKIP_STATUS);
  }
  console.log('all acceptance checks passed');
})();
