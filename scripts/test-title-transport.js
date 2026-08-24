/**
 * scripts/test-title-transport.js — titles survive the recorder boundary, with provenance.
 * Run: node scripts/test-title-transport.js   (in-memory limen-db)
 *
 * WHAT THIS GUARDS. The recorder kept a headline COUNT and a set HASH and dropped the
 * strings, so a title could be counted and never cited. This carries the title across with
 * the provenance the feed already supplies, and these tests exist to hold three lines:
 *
 *   1  the NUMERIC row is untouched — no title field leaks into `src`, because that row is
 *      what every binder replays and what the pinned READ_SHA covers
 *   2  provenance is recorded as what it IS — an aggregator redirect is never stored as a
 *      canonical URL or a publisher-issued id, and a missing field is null, never a guess
 *   3  nothing here classifies, scores, or judges a title
 *
 *   T1  a changed headline set writes one record per title, with full provenance
 *   T2  contentKind is headline_title, and no field claims more than that
 *   T3  the numeric row is byte-identical to what it was before titles existed
 *   T4  an UNCHANGED set writes nothing — storage is bounded by turnover, not by cadence
 *   T5  a changed set writes again
 *   T6  absent link / publication time / publisher record null, and never a neighbour's value
 *   T7  no record carries a score, stress, classification or candidate field
 *   T8  a failed title write is retried on a later cycle
 *   T9  a failed title write is retried within the same hour
 *   T10 an over-long title is bounded with an explicit truncation marker
 */

var handler = require('../handlers/feed-record');
var db = require('../lib/limen-db');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

function call(url) {
  return new Promise(function (resolve) {
    var res = {
      setHeader: function () {}, statusCode: 200,
      status: function (c) { res.statusCode = c; return res; },
      json: function (b) { resolve({ status: res.statusCode, json: b }); }
    };
    handler({ method: 'GET', url: url, headers: {} }, res);
  });
}

/** A snapshot with one headline-bearing RSS source and one numeric source. */
function snapshot(headlines, links, pubAt, pubBy) {
  return {
    domains: {
      testdom: {
        stress: 0.4, activity: 0.5,
        sources: [
          { name: 'Numeric Source', channel: 'stress', live: true, value: 42, quality: 0.9,
            updated: Date.now(), fetchedAt: Date.now() },
          { name: 'RSS Source', channel: 'activity', live: true, value: 100, quality: 0.5,
            updated: Date.now(), fetchedAt: Date.now(),
            headlines: headlines, headlineLinks: links,
            headlinePublishedAt: pubAt, headlinePublishers: pubBy,
            rss: { articleCount: 100, recent7d: 3, medianAgeDays: 2 } }
        ]
      }
    }
  };
}

var currentSnap = null;
global.fetch = function () {
  return Promise.resolve({ json: function () { return Promise.resolve(currentSnap); } });
};

/* The recorder is idempotent per HOUR, so each write in this test has to land in its own
   hour bucket or the second and third runs would be skipped for that reason instead of the
   one under test. Clock is advanced deliberately rather than by sleeping. */
var realNow = Date.now;
var clock = realNow();
function advanceOneHour() { clock += 3600 * 1000; Date.now = function () { return clock; }; }

(async function () {
  Date.now = function () { return clock; };

  console.log('T1: a changed headline set writes one record per title, with provenance');
  currentSnap = snapshot(
    ['Grid warning issued for the southeast - RTO Insider', 'LNG cargo diverted - Reuters'],
    ['https://news.google.com/rss/articles/AAA', 'https://news.google.com/rss/articles/BBB'],
    [1786000000000, 1786000111000],
    ['RTO Insider', 'Reuters']
  );
  var w1 = await call('/api/feed-record');
  assert('write succeeded', w1.json.ok === true, JSON.stringify(w1.json).slice(0, 200));
  assert('two titles written', w1.json.titlesWritten === 2, String(w1.json.titlesWritten));
  assert('no title errors', w1.json.titleErrors === 0, String(w1.json.titleErrors));

  var r1 = await call('/api/feed-record?titles=testdom');
  var sets = r1.json.titles || [];
  assert('one SET was stored, not two loose titles', sets.length === 1, String(sets.length));
  assert('the set records its own size', sets[0] && sets[0].n === 2, sets[0] && String(sets[0].n));
  assert('the set carries both items', sets[0] && sets[0].items.length === 2);
  var rec = sets[0].items.filter(function (x) { return /Grid warning/.test(x.ti); })[0];
  assert('each item records its index in the set', rec && rec.i === 0, rec && String(rec.i));
  assert('the title is stored verbatim', !!rec && rec.ti === 'Grid warning issued for the southeast - RTO Insider',
    rec && rec.ti);
  assert('the FEED it arrived on is recorded on the set', sets[0].f === 'RSS Source', sets[0].f);
  assert('the publisher LABEL from <source> is recorded', rec && rec.pl === 'RTO Insider', rec && rec.pl);
  assert('the source publication time is recorded', rec && rec.pa === 1786000000000, rec && String(rec.pa));
  assert('the aggregator item URL is recorded', rec && rec.au === 'https://news.google.com/rss/articles/AAA', rec && rec.au);
  assert('the domain is recorded on the set', sets[0].d === 'testdom', sets[0].d);
  assert('the set hash ties it to the numeric row', typeof sets[0].hh === 'number');

  console.log('T2: contentKind says what it is, and nothing claims more');
  assert('contentKind is headline_title', sets[0].ck === 'headline_title', sets[0].ck);
  assert('the feed name is NOT stored as the publisher label', sets[0].f !== rec.pl);
  /* The link is a news.google.com redirect. Storing it under a name that implies a canonical
     publisher URL or a publisher-issued id would make it unusable as either, silently. */
  assert('no field claims to be a canonical URL', rec && rec.canonicalUrl === undefined);
  assert('no field claims to be a publisher-issued id', rec && rec.publisherItemId === undefined);

  console.log('T3: the numeric row is untouched');
  var rows = (await call('/api/feed-record?read=testdom')).json.rows || [];
  var src = (rows[0] && rows[0].src) || [];
  var rssRow = src.filter(function (s) { return s.n === 'RSS Source'; })[0];
  assert('the numeric row still carries the count and hash', rssRow && rssRow.hc === 2 && typeof rssRow.hh === 'number',
    JSON.stringify(rssRow));
  var leaked = Object.keys(rssRow || {}).filter(function (k) {
    return ['ti', 'au', 'pa', 'pb', 'ck', 'headlines', 'headlineLinks'].indexOf(k) > -1;
  });
  assert('no title field leaked into the numeric row', leaked.length === 0, leaked.join(','));
  assert('the numeric row keeps exactly its known field vocabulary',
    Object.keys(rssRow).every(function (k) {
      return ['n', 'ch', 'l', 's', 'a', 'v', 'q', 'hc', 'hh', 'r7', 'r1', 'ma', 'ua', 'su'].indexOf(k) > -1;
    }), Object.keys(rssRow).join(','));

  console.log('T4: an UNCHANGED set writes nothing');
  advanceOneHour();
  var w2 = await call('/api/feed-record');
  assert('the row was still recorded', w2.json.written === 1, String(w2.json.written));
  assert('but no title was rewritten', w2.json.titlesWritten === 0, String(w2.json.titlesWritten));
  var after2 = (await call('/api/feed-record?titles=testdom')).json.titles || [];
  assert('the store did not grow', after2.length === 1, String(after2.length));

  console.log('T5: a changed set writes again');
  advanceOneHour();
  currentSnap = snapshot(
    ['Refinery outage cuts output - Bloomberg', 'LNG cargo diverted - Reuters'],
    ['https://news.google.com/rss/articles/CCC', 'https://news.google.com/rss/articles/BBB'],
    [1786000222000, 1786000111000],
    ['Bloomberg', 'Reuters']
  );
  var w3 = await call('/api/feed-record');
  assert('the changed set wrote its titles', w3.json.titlesWritten === 2, String(w3.json.titlesWritten));
  assert('as ONE set', w3.json.titleSetsWritten === 1, String(w3.json.titleSetsWritten));
  var after3 = (await call('/api/feed-record?titles=testdom')).json.titles || [];
  assert('the store grew by exactly one set', after3.length === 2, String(after3.length));
  assert('newest set is at the head',
    after3[0].items.some(function (x) { return /Refinery outage/.test(x.ti); }),
    JSON.stringify(after3[0].items.map(function (x) { return x.ti; })));

  console.log('T6: absent provenance is null, never a neighbour\'s value');
  advanceOneHour();
  /* The middle item carries no publication time, no link and no publisher. The guard being
     tested is index alignment: it must not inherit the item above or below it. In the
     fetcher this is also why `_pt` is reset per item — `var` is function-scoped, so an
     unreset value would attach the previous item's timestamp to this one. */
  currentSnap = snapshot(
    ['First story - AP', 'Middle story with nothing', 'Third story - BBC'],
    ['https://news.google.com/rss/articles/DDD', null, 'https://news.google.com/rss/articles/EEE'],
    [1786000333000, null, 1786000555000],
    ['AP', null, 'BBC']
  );
  await call('/api/feed-record');
  var sets6 = (await call('/api/feed-record?titles=testdom')).json.titles || [];
  var recs6 = sets6.reduce(function (a, s2) { return a.concat(s2.items); }, []);
  var mid = recs6.filter(function (x) { return /Middle story/.test(x.ti); })[0];
  assert('the middle title was stored', !!mid);
  assert('its publication time is null, not a neighbour\'s', mid && mid.pa === null, mid && String(mid.pa));
  assert('its link is null, not a neighbour\'s', mid && mid.au === null, mid && String(mid.au));
  assert('its publisher label is null, not a neighbour\'s', mid && mid.pl === null, mid && String(mid.pl));
  assert('and its index still places it in the set', mid && mid.i === 1, mid && String(mid.i));
  var first = recs6.filter(function (x) { return /First story/.test(x.ti); })[0];
  assert('and the neighbours kept their own values',
    first && first.pa === 1786000333000 && first.pl === 'AP', JSON.stringify(first));

  console.log('T7: nothing here classifies or scores a title');
  var banned = ['score', 'stress', 'classification', 'sentiment', 'candidate', 'weight', 'rank', 'severity'];
  var offenders = [];
  recs6.forEach(function (x) {
    Object.keys(x).forEach(function (k) { if (banned.indexOf(k) > -1) offenders.push(k); });
  });
  assert('no record carries a score, stress, classification or candidate field',
    offenders.length === 0, offenders.join(','));
  assert('the record vocabulary is exactly transport: when, domain, feed, kind, title, url, published, publisher, set',
    recs6.every(function (x) {
      return Object.keys(x).every(function (k) { return ['i', 'ti', 'au', 'pa', 'pl', 'tr'].indexOf(k) > -1; });
    }) && sets6.every(function (x) {
      return Object.keys(x).every(function (k) { return ['t', 'd', 'f', 'ck', 'hh', 'n', 'items'].indexOf(k) > -1; });
    }), Object.keys(recs6[0] || {}).join(',') + ' | ' + Object.keys(sets6[0] || {}).join(','));

  console.log('T8 [regression]: a failed title write is RETRIED, not lost forever');
  /**
   * THE DEFECT THIS REPLACES. The first version decided "changed?" against the previous
   * NUMERIC row's hash. So if the numeric row was written and the title write then failed,
   * the next cycle compared against a numeric row already carrying the new hash, concluded
   * nothing had changed, and never retried. The titles were gone silently.
   *
   * Here the title write is forced to fail on a genuinely new set, and the next cycle must
   * still write it. Against the old design this assertion fails.
   */
  advanceOneHour();
  currentSnap = snapshot(
    ['Only story of this set - AFP'],
    ['https://news.google.com/rss/articles/FFF'],
    [1786000777000],
    ['AFP']
  );
  var realLpush = db.lpush;
  db.lpush = function (key) {
    if (String(key).indexOf('feedtitles:') === 0) return Promise.reject(new Error('simulated title store failure'));
    return realLpush.apply(db, arguments);
  };
  var wFail = await call('/api/feed-record');
  db.lpush = realLpush;
  assert('the numeric row was still written', wFail.json.written === 1, String(wFail.json.written));
  assert('the title write failed and said so', wFail.json.titleErrors > 0, String(wFail.json.titleErrors));
  assert('and no title was persisted', wFail.json.titlesWritten === 0, String(wFail.json.titlesWritten));

  advanceOneHour();
  var wRetry = await call('/api/feed-record');   // SAME set: unchanged as far as the numeric row knows
  assert('the next cycle RETRIES the lost set', wRetry.json.titlesWritten === 1, String(wRetry.json.titlesWritten));
  var afterRetry = (await call('/api/feed-record?titles=testdom')).json.titles || [];
  assert('and the set is now in the store',
    afterRetry.some(function (s2) { return s2.items.some(function (x) { return /Only story of this set/.test(x.ti); }); }),
    String(afterRetry.length));

  advanceOneHour();
  var wSettled = await call('/api/feed-record');
  assert('once persisted it is not written again', wSettled.json.titlesWritten === 0, String(wSettled.json.titlesWritten));

  console.log('T9 [regression]: a failed title write retries within the same hour');
  /* Numeric idempotency and title persistence are separate contracts. If a title write
     fails after the numeric row succeeds, a retry in the same hour must still reach the
     title checkpoint even though the numeric row is skipped. */
  advanceOneHour();
  currentSnap = snapshot(
    ['Same-hour retry - AP'],
    ['https://news.google.com/rss/articles/HHH'],
    [1786000999000],
    ['AP']
  );
  var realLpush2 = db.lpush;
  db.lpush = function (key) {
    if (String(key).indexOf('feedtitles:') === 0) return Promise.reject(new Error('same-hour title failure'));
    return realLpush2.apply(db, arguments);
  };
  var wSameFail = await call('/api/feed-record');
  db.lpush = realLpush2;
  assert('same-hour setup writes the numeric row', wSameFail.json.written === 1, String(wSameFail.json.written));
  assert('same-hour setup reports title failure', wSameFail.json.titleErrors > 0, String(wSameFail.json.titleErrors));
  var wSameRetry = await call('/api/feed-record');
  assert('same-hour retry skips only the numeric row', wSameRetry.json.written === 0 && wSameRetry.json.skipped === 1,
    JSON.stringify(wSameRetry.json));
  assert('same-hour retry persists the title set', wSameRetry.json.titlesWritten === 1, String(wSameRetry.json.titlesWritten));
  var sameHourSets = (await call('/api/feed-record?titles=testdom')).json.titles || [];
  assert('same-hour title is present', sameHourSets.some(function (s3) {
    return s3.items.some(function (x) { return /Same-hour retry/.test(x.ti); });
  }), String(sameHourSets.length));

  console.log('T10: an over-long title is cut, and the cut is RECORDED');
  advanceOneHour();
  var longTitle = 'X'.repeat(2500) + ' - Wire';
  currentSnap = snapshot([longTitle], ['https://news.google.com/rss/articles/GGG'], [1786000888000], ['Wire']);
  await call('/api/feed-record');
  var sets9 = (await call('/api/feed-record?titles=testdom')).json.titles || [];
  var long = sets9[0].items[0];
  assert('the stored title is bounded', long.ti.length === 2000, String(long.ti.length));
  assert('and the truncation is declared, not silent', long.tr && long.tr.truncated === true);
  assert('with the original length kept', long.tr && long.tr.originalLength === longTitle.length,
    long.tr && String(long.tr.originalLength));
  /* A title within bounds carries no truncation marker at all, so `tr` present always means
     something was actually cut. */
  var shortOne = recs6.filter(function (x) { return /First story/.test(x.ti); })[0];
  assert('a normal title carries no truncation marker', shortOne && shortOne.tr === undefined);

  Date.now = realNow;
  console.log('');
  console.log(tests - failures + '/' + tests + ' passed' + (failures ? ', ' + failures + ' FAILED' : ''));
  console.log('');
  console.log('WHAT THIS DID NOT DO: it classified no title, created no candidate, computed no');
  console.log('stress and activated nothing. Titles crossed the recorder boundary and stopped.');
  if (failures) process.exit(1);
})();
