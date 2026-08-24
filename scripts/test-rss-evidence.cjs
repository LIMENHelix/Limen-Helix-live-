#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const RSS = require('../lib/rss-evidence.js');

const xml = '<rss><channel><item><title><![CDATA[Bank update &amp; outlook]]></title>' +
  '<link>https://example.test/a</link><pubDate>Mon, 24 Aug 2026 12:00:00 GMT</pubDate>' +
  '<source>Official Publisher</source></item><item><title>Second</title></item></channel></rss>';
const out = RSS.extract(xml, 5);
assert.deepEqual(out.headlines, ['Bank update & outlook', 'Second']);
assert.equal(out.headlineLinks[0], 'https://example.test/a');
assert.equal(out.headlineLinks[1], null);
assert.equal(out.headlinePublishers[0], 'Official Publisher');
assert.equal(out.headlinePublishedAt[1], null);

const atom = RSS.extract('<feed><entry><title>SEC filing</title><link href="https://sec.test/1"/>' +
  '<updated>2026-08-24T12:00:00Z</updated></entry></feed>');
assert.equal(atom.headlines[0], 'SEC filing');
assert.equal(atom.headlineLinks[0], 'https://sec.test/1');
assert.equal(atom.headlinePublishedAt[0], Date.parse('2026-08-24T12:00:00Z'));

console.log('rss evidence: 8/8 passed');
