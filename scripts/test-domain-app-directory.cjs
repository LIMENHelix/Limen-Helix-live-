'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var ROOT = path.join(__dirname, '..');
var pages = fs.readFileSync(path.join(ROOT, 'pages.html'), 'utf8');
var home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var atlas = fs.readFileSync(path.join(ROOT, 'atlas.html'), 'utf8');
var topbar = fs.readFileSync(path.join(ROOT, 'assets/js/limen-topbar.js'), 'utf8');
var ladder = fs.readFileSync(path.join(ROOT, 'assets/js/domain-business-ladder.js'), 'utf8');
var domains = [
  'agriculture', 'communication', 'culture', 'defense', 'economy', 'education', 'energy',
  'environment', 'finance', 'governance', 'industry', 'infrastructure', 'intelligence',
  'law', 'medicine', 'population', 'religion', 'science', 'technology', 'trade'
];

assert.match(pages, /<title>LIMEN HELIX &middot; DOMAINS &amp; APPS<\/title>/);
assert.match(pages, /Public App/);
assert.match(pages, /Portal \/ Engine/);
assert.match(pages, /Operator Console/);
assert.match(pages, /type="search"[^>]+id="smSearch"/);
assert.match(pages, /label for="smSearch"/);
assert.equal((pages.match(/\{ d: '/g) || []).length, 20, 'directory must declare twenty domains once');
domains.forEach(function (domain) {
  assert.match(pages, new RegExp("\\{ d: '" + domain + "'"), domain + ' missing from directory');
  var front = fs.readFileSync(path.join(ROOT, domain + '.html'), 'utf8');
  assert.match(front, /assets\/js\/domain-business-ladder\.js/,
    domain + ' must load the shared navigation/regulation surface');
});

assert.doesNotMatch(home, /class="domain-directory" href="\/pages"/, 'front page must not expose the directory without authentication');
assert.match(home, /class="domain-directory" href="#" id="directoryEntry"/);
assert.match(home, /directoryEntry\.addEventListener\('click', show\)/);
assert.match(home, /fetch\('\/api\/admin-auth'/);
assert.match(atlas, /class="directorybtn" href="\/pages"/);
assert.match(topbar, /DOMAINS & APPS/);
assert.match(topbar, /href: '\/pages'/);
assert.match(ladder, /All domains & apps/);
assert.match(ladder, /\/portal\?domain=/);
assert.match(ladder, /\/domain-console\?domain=/);

console.log('domain app directory: home + atlas + global menu + twenty public fronts: PASS');
