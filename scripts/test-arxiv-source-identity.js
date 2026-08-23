/* Verify arXiv count fetchers preserve the publisher's feed.updated timestamp. */
'use strict';

var DS = require('../handlers/domain-snapshot.js');
var identity = DS._arxivFeedIdentity;
var failures = 0, tests = 0;
function assert(name, condition, detail) {
  tests++;
  if (condition) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var xml = "<?xml version='1.0'?><feed><updated>2026-08-23T15:28:31Z</updated><opensearch:totalResults>924848</opensearch:totalResults></feed>";
console.log('=== ARXIV SOURCE IDENTITY ===');
assert('feed.updated is preserved verbatim', identity(xml) === '2026-08-23T15:28:31Z', identity(xml));
assert('missing feed.updated abstains', identity('<feed><opensearch:totalResults>1</opensearch:totalResults></feed>') === null);
assert('malformed feed.updated abstains', identity('<feed><updated>not-a-date</updated></feed>') === null);

var realFetch = global.fetch;
var feed = "<feed><updated>2026-08-23T15:28:31Z</updated><opensearch:totalResults>924848</opensearch:totalResults></feed>";
global.fetch = function () { return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(feed); } }); };
(async function () {
  try {
    var cs = await DS._fetchArXivCS();
    assert('CS fetcher carries publisher identity', cs && cs.sourceUpdatedAt === '2026-08-23T15:28:31Z', JSON.stringify(cs));
    var all = await DS._fetchArXivAll();
    assert('all-arXiv fetcher carries publisher identity', all && all.sourceUpdatedAt === '2026-08-23T15:28:31Z', JSON.stringify(all));

    global.fetch = function () { return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve('<feed><opensearch:totalResults>4</opensearch:totalResults></feed>'); } }); };
    var noStamp = await DS._fetchArXivCS();
    assert('missing publisher identity does not remove the reading', noStamp && noStamp.value === 4 && noStamp.sourceUpdatedAt === null, JSON.stringify(noStamp));
  } finally {
    global.fetch = realFetch;
  }
  console.log(tests + '/' + tests + ' passed' + (failures ? ', ' + failures + ' FAILED' : ''));
  process.exit(failures ? 1 : 0);
})();
