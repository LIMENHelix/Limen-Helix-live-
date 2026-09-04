'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var identity = require('../assets/js/domain-identity.js');

var ROOT = path.join(__dirname, '..');

assert.deepStrictEqual(
  ['supplyChain', 'health', 'legal', 'contemplative'].map(function (key) {
    var row = identity.resolve(key);
    return [key, row.canonical, row.portalKey];
  }),
  [
    ['supplyChain', 'trade', 'trade'],
    ['health', 'medicine', 'medicine'],
    ['legal', 'law', 'law'],
    ['contemplative', 'religion', 'religion']
  ],
  'runtime and historical aliases must resolve without rewriting source records'
);

['trade', 'medicine', 'law', 'religion'].forEach(function (domain) {
  assert.ok(fs.existsSync(path.join(ROOT, domain + '_portal.html')), domain + ' portal target must exist');
});

var html = fs.readFileSync(path.join(ROOT, 'company-portal.html'), 'utf8');
assert.ok(
  html.indexOf('assets/js/domain-identity.js') < html.indexOf('assets/js/company-portal-ui.js'),
  'domain identity must load before the company portal renderer'
);
assert.ok(
  html.indexOf("domainRoute.portalKey + '_portal.html'") >= 0,
  'the Domain Pipeline link must ignore stale alias attachments and use the resolved portal target'
);

var renderer = fs.readFileSync(path.join(ROOT, 'assets/js/company-portal-ui.js'), 'utf8');
assert.ok(renderer.indexOf('var portalFile = portalDomain + \'_portal.html\';') >= 0, 'renderer must route through resolved portal identity');
assert.ok(renderer.indexOf("if (canonicalDomain === 'law')") >= 0, 'legacy legal records must receive the Law presentation');

console.log('company portal domain routing: 9/9 passed');
