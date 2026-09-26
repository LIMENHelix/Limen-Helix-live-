'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var ROOT = path.join(__dirname, '..');
var pages = fs.readFileSync(path.join(ROOT, 'pages.html'), 'utf8');
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

// The front gate and the atlas deliberately carry no directory button: both pages stay
// clean, and the directory is reached from the global menu and the domain fronts instead.
assert.match(topbar, /DOMAINS & APPS/);
assert.match(topbar, /href: '\/pages'/);
assert.match(ladder, /All domains & apps/);
assert.match(ladder, /\/portal\?domain=/);
assert.match(ladder, /\/domain-console\?domain=/);

console.log('domain app directory: global menu + twenty public fronts: PASS');
