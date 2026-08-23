'use strict';

/* Behavioral coverage for the real _fetchRSS path.  A channel-level
 * lastBuildDate is a feed snapshot token; item pubDate must never be promoted
 * to sourceUpdatedAt, and malformed/missing channel metadata must abstain. */
var assert = require('node:assert/strict');
var H = require('../handlers/domain-snapshot.js');

var originalFetch = global.fetch;
var xml = '<?xml version="1.0"?><rss><channel>' +
  '<lastBuildDate><![CDATA[Sun, 23 Aug 2026 18:07:37 GMT]]></lastBuildDate>' +
  '<item><title>One</title><pubDate>Sun, 23 Aug 2026 17:00:00 GMT</pubDate><link>https://example.test/1</link><source>Example</source></item>' +
  '</channel></rss>';
global.fetch = async function () { return { text: async function () { return xml; } }; };

(async function () {
  try {
    var got = await H._fetchRSS('identity test', 'Identity Test', 'research', 'activity');
    assert.equal(got.sourceUpdatedAt, 'Sun, 23 Aug 2026 18:07:37 GMT');
    assert.equal(got.headlinePublishedAt[0], Date.parse('Sun, 23 Aug 2026 17:00:00 GMT'));
    assert.notEqual(got.sourceUpdatedAt, String(got.headlinePublishedAt[0]));

    global.fetch = async function () { return { text: async function () { return '<rss><channel><item><title>x</title></item></channel></rss>'; } }; };
    var absent = await H._fetchRSS('identity test', 'Identity Test', 'research', 'activity');
    assert.equal(absent.sourceUpdatedAt, null);

    global.fetch = async function () { return { text: async function () { return '<rss><channel><lastBuildDate>not-a-date</lastBuildDate><item><title>x</title></item></channel></rss>'; } }; };
    var malformed = await H._fetchRSS('identity test', 'Identity Test', 'research', 'activity');
    assert.equal(malformed.sourceUpdatedAt, null);

    console.log('3/3 passed');
  } finally {
    global.fetch = originalFetch;
  }
})().catch(function (err) {
  console.error(err.stack || err);
  process.exitCode = 1;
});
